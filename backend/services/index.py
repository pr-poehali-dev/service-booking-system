"""
Услуги мастера.
GET  /?master_id=N  — список услуг мастера
POST /              — создать услугу (X-Session-Token мастера)
PUT  /?service_id=N — обновить услугу
"""
import json, os
import psycopg2

S = "t_p84631928_service_booking_syst"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Token",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def resolve_master(cur, token):
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
    conn = get_conn()
    cur = conn.cursor()

    try:
        if method == "GET":
            master_id = params.get("master_id")
            if not master_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "master_id required"})}
            cur.execute(f"""
                SELECT id, title, description, price_type, price::float, is_active
                FROM {S}.services WHERE master_id=%s ORDER BY id
            """, (master_id,))
            cols = ["id", "title", "description", "price_type", "price", "is_active"]
            return {"statusCode": 200, "headers": CORS,
                    "body": json.dumps([dict(zip(cols, r)) for r in cur.fetchall()])}

        elif method == "POST":
            token = (event.get("headers") or {}).get("x-session-token") or (event.get("headers") or {}).get("X-Session-Token")
            row = resolve_master(cur, token)
            if not row:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "forbidden"})}
            _, master_id = row
            body = json.loads(event.get("body") or "{}")
            cur.execute(f"""
                INSERT INTO {S}.services (master_id, title, description, price_type, price)
                VALUES (%s, %s, %s, %s, %s) RETURNING id
            """, (master_id, body["title"], body.get("description"), body.get("price_type", "fixed"), body["price"]))
            new_id = cur.fetchone()[0]
            conn.commit()
            return {"statusCode": 201, "headers": CORS, "body": json.dumps({"id": new_id})}

        elif method == "PUT":
            token = (event.get("headers") or {}).get("x-session-token") or (event.get("headers") or {}).get("X-Session-Token")
            row = resolve_master(cur, token)
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
            for f in ["title", "description", "price_type", "price", "is_active"]:
                if f in body:
                    fields.append(f"{f}=%s")
                    vals.append(body[f])
            if fields:
                vals.append(service_id)
                cur.execute(f"UPDATE {S}.services SET {', '.join(fields)} WHERE id=%s", vals)
                conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

    finally:
        conn.close()
