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

            # 1. Все мастера одним запросом
            cur.execute(f"""
                SELECT m.id, u.id, u.name, u.email, m.is_blocked, u.last_seen
                FROM {S}.masters m
                JOIN {S}.users u ON u.id = m.user_id
                ORDER BY m.id
            """)
            master_rows = cur.fetchall()
            master_ids = [r[0] for r in master_rows]
            master_user_ids = [r[1] for r in master_rows]

            if master_ids:
                ids_str = ",".join(str(i) for i in master_ids)

                # 2. Брони всех мастеров одним запросом
                cur.execute(f"""
                    SELECT master_id, COUNT(*) FROM {S}.bookings
                    WHERE master_id IN ({ids_str}) AND status <> 'cancelled'
                    GROUP BY master_id
                """)
                booking_counts = {r[0]: int(r[1]) for r in cur.fetchall()}

                # 3. Рейтинги всех мастеров одним запросом
                cur.execute(f"""
                    SELECT b.master_id, COALESCE(ROUND(AVG(r.score)::numeric, 1), 0)
                    FROM {S}.ratings r
                    JOIN {S}.bookings b ON b.id = r.booking_id
                    WHERE b.master_id IN ({ids_str}) AND r.from_role = 'client'
                    GROUP BY b.master_id
                """)
                ratings = {r[0]: float(r[1]) for r in cur.fetchall()}

                # 4. Рефералы всех мастеров одним запросом
                cur.execute(f"""
                    SELECT referred_by, COUNT(*) FROM {S}.users
                    WHERE referred_by IN ({ids_str})
                    GROUP BY referred_by
                """)
                ref_counts = {r[0]: int(r[1]) for r in cur.fetchall()}

                # 5. Услуги всех мастеров одним запросом
                cur.execute(f"""
                    SELECT s.id, s.master_id, s.title, s.is_active, s.is_blocked,
                           COUNT(b.id) as bc
                    FROM {S}.services s
                    LEFT JOIN {S}.bookings b ON b.service_id = s.id
                    WHERE s.master_id IN ({ids_str})
                    GROUP BY s.id, s.master_id, s.title, s.is_active, s.is_blocked
                    ORDER BY s.id
                """)
                services_by_master = {}
                for sid, mid, title, is_active, sblocked, bc in cur.fetchall():
                    services_by_master.setdefault(mid, []).append({
                        "id": sid, "title": title, "is_active": is_active,
                        "is_blocked": sblocked, "booking_count": int(bc)
                    })
            else:
                booking_counts = {}
                ratings = {}
                ref_counts = {}
                services_by_master = {}

            masters = []
            for mid, uid, name, email, is_blocked, last_seen in master_rows:
                masters.append({
                    "id": mid, "user_id": uid, "name": name, "email": email,
                    "is_blocked": is_blocked,
                    "rating": ratings.get(mid, 0.0),
                    "booking_count": booking_counts.get(mid, 0),
                    "ref_count": ref_counts.get(mid, 0),
                    "services": services_by_master.get(mid, []),
                    "last_seen": last_seen.isoformat() if last_seen else None,
                    "is_master": True,
                })

            # 6. Клиенты одним запросом (без мастеров)
            if master_user_ids:
                excl = ",".join(str(i) for i in master_user_ids)
                client_filter = f"WHERE u.id NOT IN ({excl})"
            else:
                client_filter = ""

            cur.execute(f"""
                SELECT u.id, u.name, u.email, u.last_seen,
                       COUNT(b.id) FILTER (WHERE b.status <> 'cancelled') as bc
                FROM {S}.users u
                LEFT JOIN {S}.bookings b ON b.client_id = u.id
                {client_filter}
                GROUP BY u.id, u.name, u.email, u.last_seen
                ORDER BY u.id
            """)
            clients = []
            for uid, name, email, last_seen, bc in cur.fetchall():
                clients.append({
                    "user_id": uid, "name": name, "email": email,
                    "booking_count": int(bc or 0),
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
        cur.close()
        conn.close()
