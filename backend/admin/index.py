"""
Панель администратора.
GET  /                        — список мастеров и клиентов со статусами
POST /?action=block_master    — заблокировать/разблокировать мастера   body: {master_id, blocked}
POST /?action=delete_master   — удалить мастера и всё связанное         body: {master_id}
POST /?action=block_service   — заблокировать/разблокировать услугу     body: {service_id, blocked}
POST /?action=delete_service  — удалить услугу и все её брони           body: {service_id}
"""
import json, os
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


def resolve_admin(cur, token):
    if not token:
        return False
    cur.execute(f"SELECT is_admin FROM {S}.users WHERE session_token = '{token}'")
    row = cur.fetchone()
    return bool(row and row[0])


def handler(event: dict, context) -> dict:
    """Панель администратора: список пользователей, управление мастерами и услугами."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    conn = get_conn()
    cur = conn.cursor()

    try:
        token = get_token(event)
        if not resolve_admin(cur, token):
            return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "forbidden"})}

        method = event.get("httpMethod", "GET")
        params = event.get("queryStringParameters") or {}
        action = params.get("action", "")

        # ── GET — все пользователи ────────────────────────────────────────────
        if method == "GET":

            # 1. Все мастера
            cur.execute(f"""
                SELECT m.id, u.id, u.name, u.email, m.is_blocked, u.last_seen
                FROM {S}.masters m
                JOIN {S}.users u ON u.id = m.user_id
                ORDER BY m.id
            """)
            master_rows = cur.fetchall()

            masters = []
            for mid, uid, name, email, is_blocked, last_seen in master_rows:

                # Брони мастера
                cur.execute(f"""
                    SELECT COUNT(*) FROM {S}.bookings
                    WHERE master_id = {mid} AND status <> 'cancelled'
                """)
                booking_count = cur.fetchone()[0]

                # Рейтинг
                cur.execute(f"""
                    SELECT COALESCE(ROUND(AVG(r.score)::numeric, 1), 0)
                    FROM {S}.ratings r
                    JOIN {S}.bookings b ON b.id = r.booking_id
                    WHERE b.master_id = {mid} AND r.from_role = 'client'
                """)
                rating = float(cur.fetchone()[0])

                # Рефералы
                cur.execute(f"""
                    SELECT COUNT(*) FROM {S}.users WHERE referred_by = {mid}
                """)
                ref_count = cur.fetchone()[0]

                # Услуги
                cur.execute(f"""
                    SELECT id, title, is_active, is_blocked FROM {S}.services
                    WHERE master_id = {mid} ORDER BY id
                """)
                services = []
                for sid, title, is_active, sblocked in cur.fetchall():
                    cur.execute(f"SELECT COUNT(*) FROM {S}.bookings WHERE service_id = {sid}")
                    bc = cur.fetchone()[0]
                    services.append({
                        "id": sid, "title": title, "is_active": is_active,
                        "is_blocked": sblocked, "booking_count": bc
                    })

                masters.append({
                    "id": mid, "user_id": uid, "name": name, "email": email,
                    "is_blocked": is_blocked, "rating": rating,
                    "booking_count": int(booking_count), "ref_count": int(ref_count),
                    "services": services,
                    "last_seen": last_seen.isoformat() if last_seen else None,
                    "is_master": True,
                })

            # 2. Клиенты (без кабинета мастера)
            master_user_ids = [m["user_id"] for m in masters]
            if master_user_ids:
                ids_str = ",".join(str(i) for i in master_user_ids)
                client_filter = f"WHERE u.id NOT IN ({ids_str})"
            else:
                client_filter = ""

            cur.execute(f"""
                SELECT u.id, u.name, u.email, u.last_seen
                FROM {S}.users u
                {client_filter}
                ORDER BY u.id
            """)
            client_rows = cur.fetchall()

            clients = []
            for uid, name, email, last_seen in client_rows:
                cur.execute(f"""
                    SELECT COUNT(*) FROM {S}.bookings
                    WHERE client_id = {uid} AND status <> 'cancelled'
                """)
                booking_count = cur.fetchone()[0]
                clients.append({
                    "user_id": uid, "name": name, "email": email,
                    "booking_count": int(booking_count),
                    "last_seen": last_seen.isoformat() if last_seen else None,
                    "is_master": False,
                })

            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"masters": masters, "clients": clients})}

        if method == "POST":
            body = json.loads(event.get("body") or "{}")

            if action == "block_master":
                master_id = int(body["master_id"])
                blocked = bool(body.get("blocked", True))
                cur.execute(f"UPDATE {S}.masters SET is_blocked = {blocked} WHERE id = {master_id}")
                if blocked:
                    cur.execute(f"""
                        UPDATE {S}.bookings SET status = 'cancelled', updated_at = NOW()
                        WHERE master_id = {master_id} AND status IN ('pending', 'confirmed')
                    """)
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

            if action == "delete_master":
                master_id = int(body["master_id"])
                cur.execute(f"""
                    DELETE FROM {S}.ratings
                    WHERE booking_id IN (SELECT id FROM {S}.bookings WHERE master_id = {master_id})
                """)
                cur.execute(f"DELETE FROM {S}.bookings WHERE master_id = {master_id}")
                cur.execute(f"DELETE FROM {S}.slots WHERE master_id = {master_id}")
                cur.execute(f"DELETE FROM {S}.services WHERE master_id = {master_id}")
                cur.execute(f"""
                    UPDATE {S}.users SET is_master = FALSE
                    WHERE id = (SELECT user_id FROM {S}.masters WHERE id = {master_id})
                """)
                cur.execute(f"DELETE FROM {S}.masters WHERE id = {master_id}")
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

            if action == "block_service":
                service_id = int(body["service_id"])
                blocked = bool(body.get("blocked", True))
                cur.execute(f"UPDATE {S}.services SET is_blocked = {blocked} WHERE id = {service_id}")
                if blocked:
                    cur.execute(f"""
                        UPDATE {S}.bookings SET status = 'cancelled', updated_at = NOW()
                        WHERE service_id = {service_id} AND status IN ('pending', 'confirmed')
                    """)
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

            if action == "delete_service":
                service_id = int(body["service_id"])
                cur.execute(f"""
                    DELETE FROM {S}.ratings
                    WHERE booking_id IN (SELECT id FROM {S}.bookings WHERE service_id = {service_id})
                """)
                cur.execute(f"DELETE FROM {S}.bookings WHERE service_id = {service_id}")
                cur.execute(f"UPDATE {S}.services SET is_active = FALSE, is_blocked = TRUE WHERE id = {service_id}")
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "unknown action"})}

    finally:
        conn.close()