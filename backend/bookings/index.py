"""
Брони и автоматическая отмена просроченных.
GET  /              — мои брони (клиент видит свои, мастер — входящие)
GET  /?action=expire — отменить просроченные pending-брони
POST /              — создать бронь (нельзя бронировать самого себя)
PUT  /?booking_id=N — изменить статус
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
MAX_SLOTS_PER_MASTER = 4


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_token(event):
    h = event.get("headers") or {}
    return h.get("x-session-token") or h.get("X-Session-Token")


def resolve_user(cur, token):
    """Возвращает (user_id, is_master, master_id|None)"""
    if not token:
        return None
    cur.execute(
        f"SELECT id, is_master FROM {S}.users WHERE session_token=%s", (token,)
    )
    row = cur.fetchone()
    if not row:
        return None
    user_id, is_master = row
    master_id = None
    if is_master:
        cur.execute(f"SELECT id FROM {S}.masters WHERE user_id=%s", (user_id,))
        m = cur.fetchone()
        master_id = m[0] if m else None
    return user_id, is_master, master_id


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    token = get_token(event)

    conn = get_conn()
    cur = conn.cursor()

    try:
        user_info = resolve_user(cur, token)
        if not user_info:
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "unauthorized"})}
        user_id, is_master, master_id = user_info

        # Автоматически отменяем просроченные pending-брони
        cur.execute(f"""
            UPDATE {S}.bookings SET status='cancelled', updated_at=NOW()
            WHERE status='pending' AND confirm_by IS NOT NULL AND confirm_by < NOW()
        """)
        conn.commit()

        # ── EXPIRE (cron) ─────────────────────────────────────────────────────
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

        # ── GET — список броней ───────────────────────────────────────────────
        if method == "GET":
            view = params.get("view", "client")  # client | master

            if view == "master" and is_master and master_id:
                cur.execute(f"""
                    SELECT b.id, b.status, b.confirm_by, b.created_at,
                           cl.id AS client_id, cl.name AS client_name,
                           s.title AS service_title, s.price::float, s.price_type,
                           sl.slot_start, sl.slot_end,
                           COALESCE(ROUND(AVG(r.score)::numeric,1), 0) AS client_rating,
                           COALESCE((
                               SELECT r2.score FROM {S}.ratings r2
                               WHERE r2.booking_id=b.id AND r2.from_role='master'
                               LIMIT 1
                           ), 0) AS my_rating
                    FROM {S}.bookings b
                    JOIN {S}.users cl ON cl.id = b.client_id
                    JOIN {S}.services s ON s.id = b.service_id
                    JOIN {S}.slots sl ON sl.id = b.slot_id
                    LEFT JOIN {S}.bookings b2 ON b2.client_id = cl.id AND b2.status='done'
                    LEFT JOIN {S}.ratings r ON r.booking_id=b2.id AND r.from_role='master'
                    WHERE b.master_id = %s
                    GROUP BY b.id, cl.id, cl.name, s.title, s.price, s.price_type, sl.slot_start, sl.slot_end
                    ORDER BY sl.slot_start ASC
                """, (master_id,))
                cols = ["id","status","confirm_by","created_at","client_id","client_name",
                        "service_title","price","price_type","slot_start","slot_end",
                        "client_rating","my_rating"]
            else:
                cur.execute(f"""
                    SELECT b.id, b.status, b.confirm_by, b.created_at,
                           m.id AS master_id, u.name AS master_name,
                           m.photo_url,
                           s.title AS service_title, s.price::float, s.price_type,
                           sl.slot_start, sl.slot_end
                    FROM {S}.bookings b
                    JOIN {S}.masters m ON m.id = b.master_id
                    JOIN {S}.users u ON u.id = m.user_id
                    JOIN {S}.services s ON s.id = b.service_id
                    JOIN {S}.slots sl ON sl.id = b.slot_id
                    WHERE b.client_id = %s
                    ORDER BY sl.slot_start DESC
                """, (user_id,))
                cols = ["id","status","confirm_by","created_at","master_id","master_name",
                        "photo_url","service_title","price","price_type","slot_start","slot_end"]

            result = []
            for r in cur.fetchall():
                row = dict(zip(cols, r))
                for k in ["confirm_by", "created_at", "slot_start", "slot_end"]:
                    if row.get(k):
                        row[k] = row[k].isoformat()
                for k in ["client_rating", "my_rating", "price"]:
                    if k in row and row[k] is not None:
                        row[k] = float(row[k])
                result.append(row)
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(result)}

        # ── POST — создать бронь ──────────────────────────────────────────────
        elif method == "POST":
            body = json.loads(event.get("body") or "{}")
            target_master_id = int(body["master_id"])
            service_id = int(body["service_id"])
            slot_id = int(body["slot_id"])

            # Нельзя бронировать самого себя
            if is_master and master_id == target_master_id:
                return {"statusCode": 403, "headers": CORS,
                        "body": json.dumps({"error": "Нельзя записаться к себе"})}

            # Лимит слотов
            cur.execute(f"""
                SELECT COUNT(*) FROM {S}.bookings
                WHERE client_id=%s AND master_id=%s AND status IN ('pending','confirmed')
            """, (user_id, target_master_id))
            if cur.fetchone()[0] >= MAX_SLOTS_PER_MASTER:
                return {"statusCode": 409, "headers": CORS,
                        "body": json.dumps({"error": f"Не более {MAX_SLOTS_PER_MASTER} бронирований у одного мастера"})}

            # Проверка слота
            cur.execute(f"""
                SELECT slot_start FROM {S}.slots
                WHERE id=%s AND master_id=%s AND is_blocked=FALSE
            """, (slot_id, target_master_id))
            slot = cur.fetchone()
            if not slot:
                return {"statusCode": 409, "headers": CORS, "body": json.dumps({"error": "Слот недоступен"})}

            # Проверяем что этот клиент ещё не подавал заявку на этот же слот
            cur.execute(f"""
                SELECT 1 FROM {S}.bookings
                WHERE slot_id=%s AND client_id=%s AND status IN ('pending','confirmed')
            """, (slot_id, user_id))
            if cur.fetchone():
                return {"statusCode": 409, "headers": CORS, "body": json.dumps({"error": "Вы уже подали заявку на этот слот"})}

            slot_start = slot[0]
            now = datetime.now(timezone.utc)
            confirm_by = (now + timedelta(hours=2)) if (slot_start - now) > timedelta(hours=2) else None

            cur.execute(f"""
                INSERT INTO {S}.bookings (client_id, master_id, service_id, slot_id, confirm_by)
                VALUES (%s,%s,%s,%s,%s) RETURNING id
            """, (user_id, target_master_id, service_id, slot_id, confirm_by))
            new_id = cur.fetchone()[0]
            conn.commit()
            return {"statusCode": 201, "headers": CORS, "body": json.dumps({"id": new_id})}

        # ── PUT — изменить статус ─────────────────────────────────────────────
        elif method == "PUT":
            booking_id = params.get("booking_id")
            if not booking_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "booking_id required"})}

            body = json.loads(event.get("body") or "{}")
            new_status = body.get("status")

            cur.execute(f"""
                SELECT id, status, client_id, master_id, slot_id FROM {S}.bookings WHERE id=%s
            """, (booking_id,))
            booking = cur.fetchone()
            if not booking:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "not found"})}

            bid, cur_status, b_client, b_master, b_slot = booking

            allowed = False
            if is_master and b_master == master_id and new_status in ("confirmed", "cancelled", "done"):
                allowed = True
            if b_client == user_id and new_status == "cancelled":
                allowed = True

            if not allowed:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "forbidden"})}

            cur.execute(f"""
                UPDATE {S}.bookings SET status=%s, updated_at=NOW() WHERE id=%s
            """, (new_status, booking_id))

            # Подтверждение — отменяем все остальные pending-брони на тот же слот (любые клиенты)
            if new_status == "confirmed":
                cur.execute(f"""
                    UPDATE {S}.bookings SET status='cancelled', updated_at=NOW()
                    WHERE slot_id=%s AND id<>%s AND status='pending'
                """, (b_slot, booking_id))

            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

    finally:
        conn.close()