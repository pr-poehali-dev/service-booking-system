"""
Каталог мастеров, профили, слоты.
GET  /                             — список всех мастеров
GET  /?master_id=N                 — профиль мастера со слотами
PUT  /                             — обновить профиль (имя, about, address, фото)
GET  /?action=slots&master_id=N[&date=YYYY-MM-DD] — слоты
POST /?action=slots                — создать слот(ы)
DELETE /?action=slots&slot_id=N    — удалить слот
"""
import json, os
import psycopg2

S = "t_p84631928_service_booking_syst"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
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
        f"SELECT u.id, m.id FROM {S}.users u JOIN {S}.masters m ON m.user_id=u.id "
        f"WHERE u.session_token=%s AND u.is_master=TRUE",
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
        # ──────────── СЛОТЫ ────────────────────────────────────────────────
        if action == "slots":
            if method == "GET":
                master_id = params.get("master_id")
                if not master_id:
                    return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "master_id required"})}
                date_filter = params.get("date")
                if date_filter:
                    cur.execute(f"""
                        SELECT s.id, s.slot_start, s.slot_end, s.is_blocked,
                               EXISTS(
                                 SELECT 1 FROM {S}.bookings b
                                 WHERE b.slot_id=s.id AND b.status IN ('pending','confirmed')
                               ) AS has_booking,
                               EXISTS(
                                 SELECT 1 FROM {S}.bookings b
                                 WHERE b.slot_id=s.id AND b.status = 'confirmed'
                               ) AS has_confirmed
                        FROM {S}.slots s
                        WHERE s.master_id=%s AND s.slot_start::date=%s::date
                        ORDER BY s.slot_start
                    """, (master_id, date_filter))
                else:
                    cur.execute(f"""
                        SELECT s.id, s.slot_start, s.slot_end, s.is_blocked,
                               EXISTS(
                                 SELECT 1 FROM {S}.bookings b
                                 WHERE b.slot_id=s.id AND b.status IN ('pending','confirmed')
                               ) AS has_booking,
                               EXISTS(
                                 SELECT 1 FROM {S}.bookings b
                                 WHERE b.slot_id=s.id AND b.status = 'confirmed'
                               ) AS has_confirmed
                        FROM {S}.slots s
                        WHERE s.master_id=%s AND s.slot_start >= NOW()
                        ORDER BY s.slot_start LIMIT 200
                    """, (master_id,))
                cols = ["id", "slot_start", "slot_end", "is_blocked", "has_booking", "has_confirmed"]
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
                # Поддерживаем одиночный слот и массив
                slots_input = body.get("slots") or [{"slot_start": body["slot_start"], "slot_end": body["slot_end"]}]
                created = []
                for sl in slots_input:
                    cur.execute(f"""
                        INSERT INTO {S}.slots (master_id, slot_start, slot_end)
                        VALUES (%s,%s,%s) ON CONFLICT DO NOTHING RETURNING id
                    """, (master_id, sl["slot_start"], sl["slot_end"]))
                    res = cur.fetchone()
                    if res:
                        created.append(res[0])
                conn.commit()
                return {"statusCode": 201, "headers": CORS, "body": json.dumps({"created": created})}

            elif method == "DELETE":
                row = resolve_master(cur, get_token(event))
                if not row:
                    return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "forbidden"})}
                _, master_id = row
                slot_id = params.get("slot_id")
                if not slot_id:
                    return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "slot_id required"})}
                # Только если нет активных броней
                cur.execute(f"""
                    SELECT 1 FROM {S}.bookings
                    WHERE slot_id=%s AND status IN ('pending','confirmed')
                """, (slot_id,))
                if cur.fetchone():
                    return {"statusCode": 409, "headers": CORS,
                            "body": json.dumps({"error": "Слот занят активной бронью"})}
                cur.execute(f"UPDATE {S}.slots SET is_blocked=TRUE WHERE id=%s AND master_id=%s",
                            (slot_id, master_id))
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # ──────────── СПИСОК / ПРОФИЛЬ ─────────────────────────────────────
        if method == "GET":
            master_id = params.get("master_id")
            if master_id:
                cur.execute(f"""
                    SELECT m.id, u.id AS user_id, u.name, m.about, m.address,
                           m.photo_url,
                           COALESCE(ROUND(AVG(r.score)::numeric,1), 0) AS rating,
                           COUNT(DISTINCT r.id) AS review_count,
                           m.ref_code
                    FROM {S}.masters m
                    JOIN {S}.users u ON u.id=m.user_id
                    LEFT JOIN {S}.bookings b ON b.master_id=m.id AND b.status='done'
                    LEFT JOIN {S}.ratings r ON r.booking_id=b.id AND r.from_role='client'
                    WHERE m.id=%s
                    GROUP BY m.id, u.id, u.name, m.about, m.address, m.photo_url, m.ref_code
                """, (master_id,))
                row = cur.fetchone()
                if not row:
                    return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "not found"})}
                cols = ["id","user_id","name","about","address","photo_url","rating","review_count","ref_code"]
                master = dict(zip(cols, row))
                master["rating"] = float(master["rating"])
                cur.execute(f"""
                    SELECT id, title, description, price_type, price::float,
                           photo1_url, photo2_url, photo3_url
                    FROM {S}.services
                    WHERE master_id=%s AND is_active=TRUE AND is_blocked=FALSE ORDER BY id
                """, (master_id,))
                master["services"] = [
                    dict(zip(["id","title","description","price_type","price",
                              "photo1_url","photo2_url","photo3_url"], r))
                    for r in cur.fetchall()
                ]
                return {"statusCode": 200, "headers": CORS, "body": json.dumps(master)}
            else:
                cur.execute(f"""
                    SELECT m.id, u.id AS user_id, u.name, m.about, m.address,
                           m.photo_url,
                           COALESCE(ROUND(AVG(r.score)::numeric,1), 0) AS rating,
                           COUNT(DISTINCT r.id) AS review_count,
                           ARRAY_AGG(DISTINCT s.title) FILTER (WHERE s.title IS NOT NULL) AS service_titles
                    FROM {S}.masters m
                    JOIN {S}.users u ON u.id=m.user_id
                    LEFT JOIN {S}.bookings b ON b.master_id=m.id AND b.status='done'
                    LEFT JOIN {S}.ratings r ON r.booking_id=b.id AND r.from_role='client'
                    LEFT JOIN {S}.services s ON s.master_id=m.id AND s.is_active=TRUE AND s.is_blocked=FALSE
                    WHERE m.is_blocked=FALSE
                    GROUP BY m.id, u.id, u.name, m.about, m.address, m.photo_url
                    ORDER BY rating DESC
                """)
                cols = ["id","user_id","name","about","address","photo_url",
                        "rating","review_count","service_titles"]
                result = []
                for r in cur.fetchall():
                    row = dict(zip(cols, r))
                    row["rating"] = float(row["rating"])
                    result.append(row)
                return {"statusCode": 200, "headers": CORS, "body": json.dumps(result)}

        # ──────────── ОБНОВИТЬ ПРОФИЛЬ ─────────────────────────────────────
        elif method == "PUT":
            row = resolve_master(cur, get_token(event))
            if not row:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "forbidden"})}
            user_id, master_id = row
            body = json.loads(event.get("body") or "{}")

            # Обновить имя в таблице users
            if "name" in body:
                cur.execute(f"UPDATE {S}.users SET name=%s WHERE id=%s", (body["name"], user_id))

            # Обновить профиль мастера
            master_fields, master_vals = [], []
            for f in ["about", "address", "photo_url"]:
                if f in body:
                    master_fields.append(f"{f}=%s")
                    master_vals.append(body[f])
            if master_fields:
                master_vals.append(master_id)
                cur.execute(f"UPDATE {S}.masters SET {', '.join(master_fields)} WHERE id=%s", master_vals)

            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "method not allowed"})}

    finally:
        conn.close()