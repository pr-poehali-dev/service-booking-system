"""
Оценки.
GET  /?target_user_id=N&from_role=master — оценки клиента от мастеров (для мастера при просмотре клиента)
POST /  — поставить оценку (X-Session-Token, booking_id, score, comment)
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


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    token = (event.get("headers") or {}).get("x-session-token") or (event.get("headers") or {}).get("X-Session-Token")

    conn = get_conn()
    cur = conn.cursor()

    try:
        if method == "GET":
            action = params.get("action", "")

            # Оценки, которые клиент поставил мастерам: {master_id -> avg_score}
            if action == "by_client":
                if not token:
                    return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "unauthorized"})}
                cur.execute(f"SELECT id FROM {S}.users WHERE session_token=%s", (token,))
                u = cur.fetchone()
                if not u:
                    return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "forbidden"})}
                client_id = u[0]
                cur.execute(f"""
                    SELECT b.master_id, ROUND(AVG(r.score)::numeric, 1) AS avg_score
                    FROM {S}.ratings r
                    JOIN {S}.bookings b ON b.id = r.booking_id
                    WHERE r.from_role = 'client' AND b.client_id = %s
                    GROUP BY b.master_id
                """, (client_id,))
                result = {str(row[0]): float(row[1]) for row in cur.fetchall()}
                return {"statusCode": 200, "headers": CORS, "body": json.dumps(result)}

            target_user_id = params.get("target_user_id")
            from_role = params.get("from_role", "master")
            if not target_user_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "target_user_id required"})}

            # Если from_role=master — оценки клиента от мастеров
            if from_role == "master":
                cur.execute(f"""
                    SELECT r.score, r.comment, r.created_at,
                           reviewer.name AS reviewer_name
                    FROM {S}.ratings r
                    JOIN {S}.bookings b ON b.id=r.booking_id
                    JOIN {S}.users target ON target.id=b.client_id AND target.id=%s
                    JOIN {S}.masters m ON m.id=b.master_id
                    JOIN {S}.users reviewer ON reviewer.id=m.user_id
                    WHERE r.from_role='master'
                    ORDER BY r.created_at DESC
                """, (target_user_id,))
            else:
                cur.execute(f"""
                    SELECT r.score, r.comment, r.created_at,
                           reviewer.name AS reviewer_name
                    FROM {S}.ratings r
                    JOIN {S}.bookings b ON b.id=r.booking_id
                    JOIN {S}.users reviewer ON reviewer.id=b.client_id AND reviewer.id=%s
                    WHERE r.from_role='client'
                    ORDER BY r.created_at DESC
                """, (target_user_id,))

            cols = ["score", "comment", "created_at", "reviewer_name"]
            rows = []
            for r in cur.fetchall():
                row = dict(zip(cols, r))
                row["created_at"] = row["created_at"].isoformat()
                rows.append(row)

            avg = round(sum(r["score"] for r in rows) / len(rows), 1) if rows else 0
            return {"statusCode": 200, "headers": CORS,
                    "body": json.dumps({"avg": avg, "reviews": rows})}

        elif method == "POST":
            if not token:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "unauthorized"})}
            cur.execute(f"SELECT id, is_master FROM {S}.users WHERE session_token=%s", (token,))
            u = cur.fetchone()
            if not u:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "forbidden"})}
            user_id, is_master = u

            body = json.loads(event.get("body") or "{}")
            booking_id = body["booking_id"]
            score = int(body["score"])
            comment = body.get("comment")

            # Проверяем что бронь существует
            cur.execute(f"SELECT status, client_id, master_id FROM {S}.bookings WHERE id=%s", (booking_id,))
            b = cur.fetchone()
            if not b:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "booking not found"})}
            b_status, b_client, b_master_id = b

            if is_master:
                # Мастер оценивает клиента
                cur.execute(f"SELECT id FROM {S}.masters WHERE user_id=%s", (user_id,))
                m = cur.fetchone()
                if not m or m[0] != b_master_id:
                    return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "not your booking"})}
                from_role = "master"
            else:
                # Клиент оценивает мастера — только после done
                if b_client != user_id:
                    return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "not your booking"})}
                if b_status != "done":
                    return {"statusCode": 409, "headers": CORS,
                            "body": json.dumps({"error": "Оценка доступна только после подтверждения услуги мастером"})}
                from_role = "client"

            cur.execute(f"""
                INSERT INTO {S}.ratings (booking_id, from_role, score, comment)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (booking_id, from_role)
                DO UPDATE SET score=EXCLUDED.score, comment=EXCLUDED.comment
            """, (booking_id, from_role, score, comment))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

    finally:
        conn.close()