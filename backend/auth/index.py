"""
Email-авторизация через Яндекс SMTP.
POST /?action=send   — отправить OTP на email
POST /?action=verify — проверить OTP, вернуть session_token
POST /?action=become_master — создать профиль мастера для текущего пользователя
GET  /               — текущий пользователь по X-Session-Token
"""
import json, os, random, string, uuid, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import psycopg2

S = "t_p84631928_service_booking_syst"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Token",
}
FROM_EMAIL = "lepestok-servis@yandex.ru"


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_token(event):
    h = event.get("headers") or {}
    return h.get("x-session-token") or h.get("X-Session-Token")


def send_email(to_email: str, code: str) -> bool:
    password = os.environ.get("YANDEX_SMTP_PASSWORD") or os.environ.get("YANDEX_EMAIL_PASSWORD", "")
    if not password:
        print(f"[DEV] OTP for {to_email}: {code}")
        return True
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Код входа в Лепесток: {code}"
        msg["From"] = FROM_EMAIL
        msg["To"] = to_email

        text = f"Ваш код для входа в приложение Лепесток: {code}\n\nКод действует 10 минут."
        html = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff9fb;border-radius:16px">
          <h2 style="color:#d45a7a;margin-bottom:8px">🌸 Лепесток</h2>
          <p style="color:#555;margin-bottom:24px">Код для входа в приложение:</p>
          <div style="background:#fff;border:2px solid #f0c0d0;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
            <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#d45a7a;font-family:monospace">{code}</span>
          </div>
          <p style="color:#888;font-size:13px">Код действует 10 минут. Не передавайте его никому.</p>
        </div>
        """
        msg.attach(MIMEText(text, "plain", "utf-8"))
        msg.attach(MIMEText(html, "html", "utf-8"))

        with smtplib.SMTP_SSL("smtp.yandex.ru", 465) as server:
            server.login(FROM_EMAIL, password)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False


def get_user_row(cur, token):
    cur.execute(f"""
        SELECT u.id, u.name, u.email, u.is_master, m.id AS master_id, m.address, u.is_admin
        FROM {S}.users u
        LEFT JOIN {S}.masters m ON m.user_id = u.id
        WHERE u.session_token = %s
    """, (token,))
    return cur.fetchone()


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")

    conn = get_conn()
    cur = conn.cursor()

    try:
        # ── GET / — кто я? ────────────────────────────────────────────────────
        if method == "GET":
            token = get_token(event)
            if not token:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "unauthorized"})}
            row = get_user_row(cur, token)
            if not row:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "invalid token"})}
            cols = ["id", "name", "email", "is_master", "master_id", "address", "is_admin"]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(dict(zip(cols, row)))}

        # ── POST ?action=send — отправить код ──────────────────────────────────
        if method == "POST" and action == "send":
            body = json.loads(event.get("body") or "{}")
            email = (body.get("email") or "").strip().lower()
            name  = (body.get("name") or "").strip()

            if not email or "@" not in email:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "email required"})}

            # Проверяем / создаём пользователя
            cur.execute(f"SELECT id FROM {S}.users WHERE email=%s", (email,))
            user_row = cur.fetchone()
            if not user_row:
                if not name:
                    return {"statusCode": 400, "headers": CORS,
                            "body": json.dumps({"error": "new_user", "message": "Введите ваше имя"})}
                cur.execute(
                    f"INSERT INTO {S}.users (name, phone, email) VALUES (%s, %s, %s) RETURNING id",
                    (name, email, email)
                )
                conn.commit()

            # OTP
            code = "".join(random.choices(string.digits, k=4))
            cur.execute(f"""
                INSERT INTO {S}.otp_codes (phone, email, code, expires_at)
                VALUES (%s, %s, %s, NOW() + interval '10 minutes')
            """, (email, email, code))
            conn.commit()

            ok = send_email(email, code)
            dev_code = code if not os.environ.get("YANDEX_EMAIL_PASSWORD") else None
            return {"statusCode": 200, "headers": CORS,
                    "body": json.dumps({"ok": True, "dev_code": dev_code})}

        # ── POST ?action=verify — проверить код ───────────────────────────────
        if method == "POST" and action == "verify":
            body = json.loads(event.get("body") or "{}")
            email = (body.get("email") or "").strip().lower()
            code  = (body.get("code") or "").strip()

            if not email or not code:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "email and code required"})}

            cur.execute(f"""
                SELECT id FROM {S}.otp_codes
                WHERE email=%s AND code=%s AND used=FALSE AND expires_at > NOW()
                ORDER BY created_at DESC LIMIT 1
            """, (email, code))
            otp = cur.fetchone()
            if not otp:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Неверный или истёкший код"})}

            cur.execute(f"UPDATE {S}.otp_codes SET used=TRUE WHERE id=%s", (otp[0],))

            token = str(uuid.uuid4())
            cur.execute(f"UPDATE {S}.users SET session_token=%s WHERE email=%s", (token, email))
            conn.commit()

            row = get_user_row(cur, token)
            if not row:
                return {"statusCode": 500, "headers": CORS, "body": json.dumps({"error": "user not found after verify"})}
            cols = ["id", "name", "email", "is_master", "master_id", "address", "is_admin"]
            user = dict(zip(cols, row))
            user["session_token"] = token
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(user)}

        # ── POST ?action=become_master — стать мастером ───────────────────────
        if method == "POST" and action == "become_master":
            token = get_token(event)
            if not token:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "unauthorized"})}
            cur.execute(f"SELECT id FROM {S}.users WHERE session_token=%s", (token,))
            u = cur.fetchone()
            if not u:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "invalid token"})}
            user_id = u[0]

            cur.execute(f"SELECT id FROM {S}.masters WHERE user_id=%s", (user_id,))
            if not cur.fetchone():
                cur.execute(f"INSERT INTO {S}.masters (user_id) VALUES (%s)", (user_id,))
            cur.execute(f"UPDATE {S}.users SET is_master=TRUE WHERE id=%s", (user_id,))
            conn.commit()

            row = get_user_row(cur, token)
            cols = ["id", "name", "email", "is_master", "master_id", "address"]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(dict(zip(cols, row)))}

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "unknown action"})}

    finally:
        conn.close()