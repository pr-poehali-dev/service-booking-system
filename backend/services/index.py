"""
Услуги мастера.
GET    /?master_id=N  — список услуг (с фото)
POST   /              — создать (X-Session-Token мастера)
PUT    /?service_id=N — обновить (в т.ч. фото photo1_url/2/3)
DELETE /?service_id=N — удалить (мягко: is_active=FALSE)
"""
import json, os
import psycopg2

S = "t_p84631928_service_booking_syst"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Token",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def resolve_master(cur, token):
    if not token:
        return None
    cur.execute(
        f"SELECT u.id, m.id FROM {S}.users u JOIN {S}.masters m ON m.user_id=u.id "
        f"WHERE u.session_token=%s AND u.is_master=TRUE",
        (token,)
    )
    return cur.fetchone()


def get_token(event):
    h = event.get("headers") or {}
    return h.get("x-session-token") or h.get("X-Session-Token")


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    conn = get_conn()
    cur = conn.cursor()

    try:
        if method == "GET":
            master_id = params.get("master_id")
            if not master_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "master_id required"})}
            cur.execute(f"""
                SELECT id, title, description, price_type, price::float, is_active,
                       photo1_url, photo2_url, photo3_url
                FROM {S}.services WHERE master_id=%s AND is_active=TRUE ORDER BY id
            """, (master_id,))
            cols = ["id","title","description","price_type","price","is_active",
                    "photo1_url","photo2_url","photo3_url"]
            return {"statusCode": 200, "headers": CORS,
                    "body": json.dumps([dict(zip(cols, r)) for r in cur.fetchall()])}

        elif method == "POST":
            row = resolve_master(cur, get_token(event))
            if not row:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "forbidden"})}
            _, master_id = row
            body = json.loads(event.get("body") or "{}")
            if not body.get("title") or body.get("price") is None:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "title and price required"})}
            cur.execute(f"""
                INSERT INTO {S}.services
                  (master_id, title, description, price_type, price, photo1_url, photo2_url, photo3_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """, (master_id, body["title"], body.get("description"),
                  body.get("price_type", "fixed"), float(body["price"]),
                  body.get("photo1_url"), body.get("photo2_url"), body.get("photo3_url")))
            new_id = cur.fetchone()[0]
            conn.commit()
            return {"statusCode": 201, "headers": CORS, "body": json.dumps({"id": new_id})}

        elif method == "PUT":
            row = resolve_master(cur, get_token(event))
            if not row:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "forbidden"})}
            _, master_id = row
            service_id = params.get("service_id")
            if not service_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "service_id required"})}
            cur.execute(f"SELECT id FROM {S}.services WHERE id=%s AND master_id=%s", (service_id, master_id))
            if not cur.fetchone():
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "not your service"})}
            body = json.loads(event.get("body") or "{}")
            fields, vals = [], []
            for f in ["title","description","price_type","price","photo1_url","photo2_url","photo3_url"]:
                if f in body:
                    fields.append(f"{f}=%s")
                    vals.append(body[f] if body[f] != "" else None)
            if fields:
                vals.append(service_id)
                cur.execute(f"UPDATE {S}.services SET {', '.join(fields)} WHERE id=%s", vals)
                conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        elif method == "DELETE":
            row = resolve_master(cur, get_token(event))
            if not row:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "forbidden"})}
            _, master_id = row
            service_id = params.get("service_id")
            if not service_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "service_id required"})}
            cur.execute(f"SELECT id FROM {S}.services WHERE id=%s AND master_id=%s", (service_id, master_id))
            if not cur.fetchone():
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "not your service"})}
            cur.execute(f"UPDATE {S}.services SET is_active=FALSE WHERE id=%s", (service_id,))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

    finally:
        conn.close()
