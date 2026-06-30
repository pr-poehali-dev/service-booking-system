"""
Каталог мастеров, профили и слоты.
GET  /           — список всех мастеров с рейтингом
GET  /?master_id=N  — профиль одного мастера
PUT  /           — обновить профиль (X-Session-Token мастера)
GET  /?action=slots&master_id=N  — слоты мастера
POST /?action=slots               — создать слот (X-Session-Token мастера)
"""
import json, os
import psycopg2

S = "t_p84631928_service_booking_syst"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Token",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_token(event):
    h = event.get("headers") or {}
    return h.get("x-session-token") or h.get("X-Session-Token")


def resolve_master(cur, token):
    if not token:
        return None
    cur.execute(
        f"SELECT u.id, m.id FROM {S}.users u JOIN {S}.masters m ON m.user_id=u.id WHERE u.session_token=%s AND u.role='master'",
        (token,)
    )
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
        # ============ СЛОТЫ ============
        if action == "slots":
            if method == "GET":
                master_id = params.get("master_id")
                if not master_id:
                    return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "master_id required"})}
                date_filter = params.get("date")
                if date_filter:
                    cur.execute(f"""
                        SELECT s.id, s.slot_start, s.slot_end, s.is_blocked,
                               EXISTS(SELECT 1 FROM {S}.bookings b WHERE b.slot_id=s.id AND b.status IN ('pending','confirmed')) AS has_booking
                        FROM {S}.slots s
                        WHERE s.master_id=%s AND s.slot_start::date=%s::date
                        ORDER BY s.slot_start
                    """, (master_id, date_filter))
                else:
                    cur.execute(f"""
                        SELECT s.id, s.slot_start, s.slot_end, s.is_blocked,
                               EXISTS(SELECT 1 FROM {S}.bookings b WHERE b.slot_id=s.id AND b.status IN ('pending','confirmed')) AS has_booking
                        FROM {S}.slots s
                        WHERE s.master_id=%s AND s.slot_start >= NOW()
                        ORDER BY s.slot_start LIMIT 60
                    """, (master_id,))
                cols = ["id", "slot_start", "slot_end", "is_blocked", "has_booking"]
                result = []
                for r in cur.fetchall():
                    row = dict(zip(cols, r))
                    row["slot_start"] = row["slot_start"].isoformat()
                    row["slot_end"] = row["slot_end"].isoformat()
                    result.append(row)
                return {"statusCode": 200, "headers": CORS, "body": json.dumps(result)}

            elif method == "POST":
                row = resolve_master(cur, get_token(event))
                if not row:
                    return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "forbidden"})}
                _, master_id = row
                body = json.loads(event.get("body") or "{}")
                cur.execute(f"""
                    INSERT INTO {S}.slots (master_id, slot_start, slot_end)
                    VALUES (%s,%s,%s) ON CONFLICT DO NOTHING RETURNING id
                """, (master_id, body["slot_start"], body["slot_end"]))
                res = cur.fetchone()
                conn.commit()
                return {"statusCode": 201, "headers": CORS, "body": json.dumps({"id": res[0] if res else None})}

        # ============ МАСТЕРА ============
        if method == "GET":
            master_id = params.get("master_id")
            if master_id:
                cur.execute(f"""
                    SELECT m.id, u.id AS user_id, u.name, m.about,
                           m.photo1_url, m.photo2_url, m.photo3_url,
                           COALESCE(ROUND(AVG(r.score)::numeric,1), 0) AS rating,
                           COUNT(DISTINCT r.id) AS review_count
                    FROM {S}.masters m
                    JOIN {S}.users u ON u.id=m.user_id
                    LEFT JOIN {S}.bookings b ON b.master_id=m.id AND b.status='done'
                    LEFT JOIN {S}.ratings r ON r.booking_id=b.id AND r.from_role='client'
                    WHERE m.id=%s
                    GROUP BY m.id, u.id, u.name, m.about, m.photo1_url, m.photo2_url, m.photo3_url
                """, (master_id,))
                row = cur.fetchone()
                if not row:
                    return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "not found"})}
                cols = ["id","user_id","name","about","photo1_url","photo2_url","photo3_url","rating","review_count"]
                master = dict(zip(cols, row))
                master["rating"] = float(master["rating"])
                cur.execute(f"""
                    SELECT id, title, description, price_type, price::float
                    FROM {S}.services WHERE master_id=%s AND is_active=TRUE
                """, (master_id,))
                master["services"] = [dict(zip(["id","title","description","price_type","price"], r)) for r in cur.fetchall()]
                return {"statusCode": 200, "headers": CORS, "body": json.dumps(master)}
            else:
                cur.execute(f"""
                    SELECT m.id, u.id AS user_id, u.name, m.about,
                           m.photo1_url, m.photo2_url, m.photo3_url,
                           COALESCE(ROUND(AVG(r.score)::numeric,1), 0) AS rating,
                           COUNT(DISTINCT r.id) AS review_count,
                           ARRAY_AGG(DISTINCT s.title) FILTER (WHERE s.title IS NOT NULL) AS service_titles
                    FROM {S}.masters m
                    JOIN {S}.users u ON u.id=m.user_id
                    LEFT JOIN {S}.bookings b ON b.master_id=m.id AND b.status='done'
                    LEFT JOIN {S}.ratings r ON r.booking_id=b.id AND r.from_role='client'
                    LEFT JOIN {S}.services s ON s.master_id=m.id AND s.is_active=TRUE
                    GROUP BY m.id, u.id, u.name, m.about, m.photo1_url, m.photo2_url, m.photo3_url
                    ORDER BY rating DESC
                """)
                cols = ["id","user_id","name","about","photo1_url","photo2_url","photo3_url","rating","review_count","service_titles"]
                result = []
                for r in cur.fetchall():
                    row = dict(zip(cols, r))
                    row["rating"] = float(row["rating"])
                    result.append(row)
                return {"statusCode": 200, "headers": CORS, "body": json.dumps(result)}

        elif method == "PUT":
            row = resolve_master(cur, get_token(event))
            if not row:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "forbidden"})}
            _, master_id = row
            body = json.loads(event.get("body") or "{}")
            fields, vals = [], []
            for f in ["about", "photo1_url", "photo2_url", "photo3_url"]:
                if f in body:
                    fields.append(f"{f}=%s")
                    vals.append(body[f])
            if fields:
                vals.append(master_id)
                cur.execute(f"UPDATE {S}.masters SET {', '.join(fields)} WHERE id=%s", vals)
                conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "method not allowed"})}

    finally:
        conn.close()
