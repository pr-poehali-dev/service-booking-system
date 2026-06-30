"""
SMS-авторизация.
POST /?action=send   — отправить OTP на номер телефона
POST /?action=verify — проверить OTP, вернуть session_token
GET  /               — текущий пользователь по X-Session-Token
"""
import json, os, random, string, uuid, urllib.request, urllib.parse
import psycopg2

S = "t_p84631928_service_booking_syst"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Token",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_token(event):
    h = event.get("headers") or {}
    return h.get("x-session-token") or h.get("X-Session-Token")


def send_sms(phone: str, code: str) -> bool:
    api_key = os.environ.get("SMSRU_API_KEY", "")
    if not api_key:
        # Режим разработки — просто логируем код
        print(f"[DEV] OTP for {phone}: {code}")
        return True
    params = urllib.parse.urlencode({
        "api_id": api_key,
        "to": phone,
        "msg": f"Ваш код входа в Лепесток: {code}",
        "json": 1,
    })
    try:
        req = urllib.request.urlopen(f"https://sms.ru/sms/send?{params}", timeout=10)
        resp = json.loads(req.read())
        return resp.get("status") == "OK"
    except Exception as e:
        print(f"SMS error: {e}")
        return False


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")

    conn = get_conn()
    cur = conn.cursor()

    try:
        # ── GET /  — кто я? ──────────────────────────────────────────────────
        if method == "GET":
            token = get_token(event)
            if not token:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "unauthorized"})}
            cur.execute(f"""
                SELECT u.id, u.name, u.phone, u.role, m.id AS master_id, m.address
                FROM {S}.users u
                LEFT JOIN {S}.masters m ON m.user_id = u.id
                WHERE u.session_token = %s
            """, (token,))
            row = cur.fetchone()
            if not row:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "invalid token"})}
            cols = ["id", "name", "phone", "role", "master_id", "address"]
            user = dict(zip(cols, row))
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(user)}

        # ── POST ?action=send  — отправить код ───────────────────────────────
        if method == "POST" and action == "send":
            body = json.loads(event.get("body") or "{}")
            phone = (body.get("phone") or "").strip()
            name  = (body.get("name") or "").strip()
            role  = body.get("role", "client")

            if not phone:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "phone required"})}
            if role not in ("client", "master"):
                role = "client"

            # Убедимся, что пользователь существует
            cur.execute(f"SELECT id FROM {S}.users WHERE phone=%s", (phone,))
            user_row = cur.fetchone()
            if not user_row:
                if not name:
                    return {"statusCode": 400, "headers": CORS,
                            "body": json.dumps({"error": "new_user", "message": "Введите ваше имя"})}
                cur.execute(
                    f"INSERT INTO {S}.users (name, phone, role) VALUES (%s, %s, %s) RETURNING id",
                    (name, phone, role)
                )
                user_id = cur.fetchone()[0]
                if role == "master":
                    cur.execute(f"INSERT INTO {S}.masters (user_id) VALUES (%s)", (user_id,))
                conn.commit()

            # Генерируем OTP
            code = "".join(random.choices(string.digits, k=4))
            cur.execute(f"""
                INSERT INTO {S}.otp_codes (phone, code, expires_at)
                VALUES (%s, %s, NOW() + interval '10 minutes')
            """, (phone, code))
            conn.commit()

            ok = send_sms(phone, code)
            return {"statusCode": 200, "headers": CORS,
                    "body": json.dumps({"ok": True, "dev_code": code if not os.environ.get("SMSRU_API_KEY") else None})}

        # ── POST ?action=verify — проверить код ──────────────────────────────
        if method == "POST" and action == "verify":
            body = json.loads(event.get("body") or "{}")
            phone = (body.get("phone") or "").strip()
            code  = (body.get("code") or "").strip()

            if not phone or not code:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "phone and code required"})}

            cur.execute(f"""
                SELECT id FROM {S}.otp_codes
                WHERE phone=%s AND code=%s AND used=FALSE AND expires_at > NOW()
                ORDER BY created_at DESC LIMIT 1
            """, (phone, code))
            otp = cur.fetchone()
            if not otp:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Неверный или истёкший код"})}

            cur.execute(f"UPDATE {S}.otp_codes SET used=TRUE WHERE id=%s", (otp[0],))

            token = str(uuid.uuid4())
            cur.execute(f"UPDATE {S}.users SET session_token=%s WHERE phone=%s", (token, phone))
            conn.commit()

            cur.execute(f"""
                SELECT u.id, u.name, u.phone, u.role, m.id AS master_id, m.address
                FROM {S}.users u
                LEFT JOIN {S}.masters m ON m.user_id = u.id
                WHERE u.phone = %s
            """, (phone,))
            row = cur.fetchone()
            cols = ["id", "name", "phone", "role", "master_id", "address"]
            user = dict(zip(cols, row))
            user["session_token"] = token
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(user)}

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "unknown action"})}

    finally:
        conn.close()
