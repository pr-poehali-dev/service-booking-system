"""
Брони и автоматическая отмена просроченных.
GET  /              — мои брони (X-Session-Token клиента или мастера)
GET  /?action=expire — отменить просроченные pending-брони (cron / ручной вызов)
POST /              — создать бронь (X-Session-Token клиента)
PUT  /?booking_id=N — изменить статус мастером или клиентом
"""
import json, os
from datetime import datetime, timezone, timedelta
import psycopg2

S = "t_p84631928_service_booking_syst"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Token",
}
MAX_SLOTS_PER_MASTER = 2


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def resolve_user(cur, token):
    """Возвращает (user_id, role, master_id|None)"""
    if not token:
        return None
    cur.execute(f"SELECT id, role FROM {S}.users WHERE session_token=%s", (token,))
    row = cur.fetchone()
    if not row:
        return None
    user_id, role = row
    master_id = None
    if role == "master":
        cur.execute(f"SELECT id FROM {S}.masters WHERE user_id=%s", (user_id,))
        m = cur.fetchone()
        master_id = m[0] if m else None
    return user_id, role, master_id


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    token = (event.get("headers") or {}).get("x-session-token") or (event.get("headers") or {}).get("X-Session-Token")

    conn = get_conn()
    cur = conn.cursor()

    try:
        user_info = resolve_user(cur, token)
        if not user_info:
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "unauthorized"})}
        user_id, role, master_id = user_info

        # --- Истекшие pending-брони закрываем при каждом запросе ---
        cur.execute(f"""
            UPDATE {S}.bookings SET status='cancelled', updated_at=NOW()
            WHERE status='pending' AND confirm_by IS NOT NULL AND confirm_by < NOW()
        """)
        conn.commit()

        # ---------------------------------------------------------- EXPIRE (cron)
        if method == "GET" and params.get("action") == "expire":
            cur.execute(f"""
                UPDATE {S}.bookings SET status='cancelled', updated_at=NOW()
                WHERE status='pending' AND confirm_by IS NOT NULL AND confirm_by < NOW()
                RETURNING id
            """)
            ids = [r[0] for r in cur.fetchall()]
            conn.commit()
            return {"statusCode": 200, "headers": CORS,
                    "body": json.dumps({"cancelled_count": len(ids), "ids": ids})}

        # ---------------------------------------------------------- GET
        if method == "GET":
            if role == "client":
                cur.execute(f"""
                    SELECT b.id, b.status, b.confirm_by, b.created_at,
                           m.id AS master_id, u.name AS master_name,
                           m.photo1_url,
                           s.title AS service_title, s.price::float, s.price_type,
                           sl.slot_start, sl.slot_end
                    FROM {S}.bookings b
                    JOIN {S}.masters m ON m.id=b.master_id
                    JOIN {S}.users u ON u.id=m.user_id
                    JOIN {S}.services s ON s.id=b.service_id
                    JOIN {S}.slots sl ON sl.id=b.slot_id
                    WHERE b.client_id=%s
                    ORDER BY sl.slot_start DESC
                """, (user_id,))
            else:
                cur.execute(f"""
                    SELECT b.id, b.status, b.confirm_by, b.created_at,
                           cl.id AS client_id, cl.name AS client_name,
                           s.title AS service_title, s.price::float, s.price_type,
                           sl.slot_start, sl.slot_end
                    FROM {S}.bookings b
                    JOIN {S}.users cl ON cl.id=b.client_id
                    JOIN {S}.services s ON s.id=b.service_id
                    JOIN {S}.slots sl ON sl.id=b.slot_id
                    WHERE b.master_id=%s
                    ORDER BY sl.slot_start DESC
                """, (master_id,))

            rows = cur.fetchall()
            if role == "client":
                cols = ["id","status","confirm_by","created_at","master_id","master_name",
                        "photo1_url","service_title","price","price_type","slot_start","slot_end"]
            else:
                cols = ["id","status","confirm_by","created_at","client_id","client_name",
                        "service_title","price","price_type","slot_start","slot_end"]

            result = []
            for r in rows:
                row = dict(zip(cols, r))
                for k in ["confirm_by","created_at","slot_start","slot_end"]:
                    if row.get(k):
                        row[k] = row[k].isoformat()
                result.append(row)
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(result)}

        # ---------------------------------------------------------- POST
        elif method == "POST":
            if role != "client":
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "only clients can book"})}

            body = json.loads(event.get("body") or "{}")
            target_master_id = body["master_id"]
            service_id = body["service_id"]
            slot_id = body["slot_id"]

            # Проверка лимита слотов на мастера
            cur.execute(f"""
                SELECT COUNT(*) FROM {S}.bookings
                WHERE client_id=%s AND master_id=%s AND status IN ('pending','confirmed')
            """, (user_id, target_master_id))
            count = cur.fetchone()[0]
            if count >= MAX_SLOTS_PER_MASTER:
                return {"statusCode": 409, "headers": CORS,
                        "body": json.dumps({"error": f"Не более {MAX_SLOTS_PER_MASTER} бронирований у одного мастера"})}

            # Проверка слота
            cur.execute(f"""
                SELECT slot_start FROM {S}.slots WHERE id=%s AND master_id=%s AND is_blocked=FALSE
            """, (slot_id, target_master_id))
            slot = cur.fetchone()
            if not slot:
                return {"statusCode": 409, "headers": CORS, "body": json.dumps({"error": "слот недоступен"})}

            cur.execute(f"""
                SELECT 1 FROM {S}.bookings WHERE slot_id=%s AND status IN ('pending','confirmed')
            """, (slot_id,))
            if cur.fetchone():
                return {"statusCode": 409, "headers": CORS, "body": json.dumps({"error": "слот уже занят"})}

            slot_start = slot[0]
            now = datetime.now(timezone.utc)
            # Если до начала слота > 2 ч — мастер должен подтвердить в течение 2 ч
            if (slot_start - now) > timedelta(hours=2):
                confirm_by = now + timedelta(hours=2)
            else:
                confirm_by = None  # запись в пределах 2 ч — подтверждения нет

            cur.execute(f"""
                INSERT INTO {S}.bookings (client_id, master_id, service_id, slot_id, confirm_by)
                VALUES (%s,%s,%s,%s,%s) RETURNING id
            """, (user_id, target_master_id, service_id, slot_id, confirm_by))
            new_id = cur.fetchone()[0]
            conn.commit()
            return {"statusCode": 201, "headers": CORS, "body": json.dumps({"id": new_id})}

        # ---------------------------------------------------------- PUT
        elif method == "PUT":
            booking_id = params.get("booking_id")
            if not booking_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "booking_id required"})}

            body = json.loads(event.get("body") or "{}")
            new_status = body.get("status")

            cur.execute(f"""
                SELECT b.id, b.status, b.client_id, b.master_id, b.slot_id
                FROM {S}.bookings b WHERE b.id=%s
            """, (booking_id,))
            booking = cur.fetchone()
            if not booking:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "not found"})}

            bid, cur_status, b_client, b_master, b_slot = booking

            allowed = False
            if role == "master" and b_master == master_id:
                if new_status in ("confirmed", "cancelled", "done"):
                    allowed = True
            if role == "client" and b_client == user_id:
                if new_status == "cancelled":
                    allowed = True

            if not allowed:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "forbidden"})}

            cur.execute(f"""
                UPDATE {S}.bookings SET status=%s, updated_at=NOW() WHERE id=%s
            """, (new_status, booking_id))

            # Если мастер подтвердил — отменяем все pending-брони клиента на тот же слот у других мастеров
            if new_status == "confirmed":
                cur.execute(f"""
                    UPDATE {S}.bookings SET status='cancelled', updated_at=NOW()
                    WHERE client_id=%s AND slot_id=%s AND id<>%s AND status='pending'
                """, (b_client, b_slot, booking_id))

            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

    finally:
        conn.close()
