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
ADMIN_EMAIL = "bouh.cbeta@gmail.com"
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
    cur.execute(f"SELECT is_admin FROM {S}.users WHERE session_token=%s", (token,))
    row = cur.fetchone()
    return bool(row and row[0])


def handler(event: dict, context) -> dict:
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

        # ── GET — все пользователи: мастера + клиенты ─────────────────────────
        if method == "GET":
            # Мастера с услугами
            cur.execute(f"""
                SELECT m.id, u.id AS user_id, u.name, u.email, m.is_blocked,
                       COALESCE(ROUND(AVG(r.score)::numeric,1), 0) AS rating,
                       COUNT(DISTINCT b.id) AS booking_count,
                       COUNT(DISTINCT ru.id) AS ref_count,
                       u.last_seen
                FROM {S}.masters m
                JOIN {S}.users u ON u.id = m.user_id
                LEFT JOIN {S}.bookings b ON b.master_id = m.id AND b.status != 'cancelled'
                LEFT JOIN {S}.bookings bd ON bd.master_id = m.id AND bd.status = 'done'
                LEFT JOIN {S}.ratings r ON r.booking_id = bd.id AND r.from_role = 'client'
                LEFT JOIN {S}.users ru ON ru.referred_by = m.id
                GROUP BY m.id, u.id, u.name, u.email, m.is_blocked, u.last_seen
                ORDER BY m.id
            """)
            masters = []
            for row in cur.fetchall():
                mid, uid, name, email, is_blocked, rating, booking_count, ref_count, last_seen = row
                cur.execute(f"""
                    SELECT id, title, is_active, is_blocked,
                           (SELECT COUNT(*) FROM {S}.bookings WHERE service_id=s.id) AS booking_count
                    FROM {S}.services s
                    WHERE master_id=%s ORDER BY id
                """, (mid,))
                services = [
                    {"id": r[0], "title": r[1], "is_active": r[2],
                     "is_blocked": r[3], "booking_count": r[4]}
                    for r in cur.fetchall()
                ]
                masters.append({
                    "id": mid, "user_id": uid, "name": name, "email": email,
                    "is_blocked": is_blocked, "rating": float(rating),
                    "booking_count": booking_count, "ref_count": ref_count,
                    "services": services,
                    "last_seen": last_seen.isoformat() if last_seen else None,
                    "is_master": True,
                })

            # Клиенты (пользователи без кабинета мастера)
            master_user_ids = [m["user_id"] for m in masters]
            if master_user_ids:
                ids_str = ",".join(str(i) for i in master_user_ids)
                where = f"WHERE id NOT IN ({ids_str})"
            else:
                where = ""
            cur.execute(f"""
                SELECT u.id, u.name, u.email, u.last_seen,
                       COUNT(b.id) AS booking_count
                FROM {S}.users u
                LEFT JOIN {S}.bookings b ON b.user_id = u.id AND b.status != 'cancelled'
                {where}
                GROUP BY u.id, u.name, u.email, u.last_seen
                ORDER BY u.id
            """)

            clients = []
            for row in cur.fetchall():
                uid, name, email, last_seen, booking_count = row
                clients.append({
                    "user_id": uid, "name": name, "email": email,
                    "booking_count": int(booking_count),
                    "last_seen": last_seen.isoformat() if last_seen else None,
                    "is_master": False,
                })

            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"masters": masters, "clients": clients})}

        if method == "POST":
            body = json.loads(event.get("body") or "{}")

            # ── Блокировка мастера ─────────────────────────────────────────────
            if action == "block_master":
                master_id = int(body["master_id"])
                blocked = bool(body.get("blocked", True))
                cur.execute(f"UPDATE {S}.masters SET is_blocked=%s WHERE id=%s", (blocked, master_id))
                if blocked:
                    cur.execute(f"""
                        UPDATE {S}.bookings SET status='cancelled', updated_at=NOW()
                        WHERE master_id=%s AND status IN ('pending','confirmed')
                    """, (master_id,))
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

            # ── Удаление мастера ───────────────────────────────────────────────
            if action == "delete_master":
                master_id = int(body["master_id"])
                cur.execute(f"""
                    DELETE FROM {S}.ratings
                    WHERE booking_id IN (
                        SELECT id FROM {S}.bookings WHERE master_id=%s
                    )
                """, (master_id,))
                cur.execute(f"DELETE FROM {S}.bookings WHERE master_id=%s", (master_id,))
                cur.execute(f"DELETE FROM {S}.slots WHERE master_id=%s", (master_id,))
                cur.execute(f"DELETE FROM {S}.services WHERE master_id=%s", (master_id,))
                cur.execute(f"""
                    UPDATE {S}.users SET is_master=FALSE
                    WHERE id=(SELECT user_id FROM {S}.masters WHERE id=%s)
                """, (master_id,))
                cur.execute(f"DELETE FROM {S}.masters WHERE id=%s", (master_id,))
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

            # ── Блокировка услуги ──────────────────────────────────────────────
            if action == "block_service":
                service_id = int(body["service_id"])
                blocked = bool(body.get("blocked", True))
                cur.execute(f"UPDATE {S}.services SET is_blocked=%s WHERE id=%s", (blocked, service_id))
                if blocked:
                    cur.execute(f"""
                        UPDATE {S}.bookings SET status='cancelled', updated_at=NOW()
                        WHERE service_id=%s AND status IN ('pending','confirmed')
                    """, (service_id,))
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

            # ── Удаление услуги ────────────────────────────────────────────────
            if action == "delete_service":
                service_id = int(body["service_id"])
                cur.execute(f"""
                    DELETE FROM {S}.ratings
                    WHERE booking_id IN (
                        SELECT id FROM {S}.bookings WHERE service_id=%s
                    )
                """, (service_id,))
                cur.execute(f"DELETE FROM {S}.bookings WHERE service_id=%s", (service_id,))
                cur.execute(f"UPDATE {S}.services SET is_active=FALSE, is_blocked=TRUE WHERE id=%s", (service_id,))
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "unknown action"})}

    finally:
        conn.close()