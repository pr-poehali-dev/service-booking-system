"""
Уведомления пользователей.
GET  /           — список непрочитанных уведомлений текущего пользователя
POST /?action=read&id=N — пометить уведомление прочитанным
POST /?action=read_all  — пометить все прочитанными
"""
import json, os, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import psycopg2

S = "t_p84631928_service_booking_syst"
FROM_EMAIL = "lepestok-servis@yandex.ru"
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


def resolve_user(cur, token):
    if not token:
        return None
    cur.execute(f"SELECT id FROM {S}.users WHERE session_token=%s", (token,))
    row = cur.fetchone()
    return row[0] if row else None


def send_email(to_email: str, subject: str, html: str, text: str):
    password = os.environ.get("YANDEX_SMTP_PASSWORD") or os.environ.get("YANDEX_EMAIL_PASSWORD", "")
    if not password:
        print(f"[DEV] Email to {to_email}: {subject}")
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = FROM_EMAIL
        msg["To"] = to_email
        msg.attach(MIMEText(text, "plain", "utf-8"))
        msg.attach(MIMEText(html, "html", "utf-8"))
        with smtplib.SMTP_SSL("smtp.yandex.ru", 465) as server:
            server.login(FROM_EMAIL, password)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())
    except Exception as e:
        print(f"Email error: {e}")


def email_html(title: str, lines: list) -> str:
    rows = "".join(f"<p style='color:#555;margin:6px 0'>{l}</p>" for l in lines)
    return f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff9fb;border-radius:16px">
      <h2 style="color:#d45a7a;margin-bottom:8px">🌸 Лепесток</h2>
      <h3 style="color:#222;margin-bottom:16px">{title}</h3>
      {rows}
      <p style="color:#aaa;font-size:12px;margin-top:24px">Это автоматическое уведомление — не отвечайте на него.</p>
    </div>"""


def notify(cur, conn, user_id: int, booking_id: int, title: str, body: str, email: str):
    cur.execute(
        f"INSERT INTO {S}.notifications (user_id, booking_id, title, body) VALUES (%s,%s,%s,%s)",
        (user_id, booking_id, title, body)
    )
    conn.commit()
    subject = f"Лепесток: {title}"
    html = email_html(title, [body])
    send_email(email, subject, html, f"{title}\n{body}")


def handler(event: dict, context) -> dict:
    """Уведомления: получить список, пометить прочитанными."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    conn = get_conn()
    cur = conn.cursor()

    try:
        token = get_token(event)
        user_id = resolve_user(cur, token)
        if not user_id:
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "unauthorized"})}

        method = event.get("httpMethod", "GET")
        params = event.get("queryStringParameters") or {}
        action = params.get("action", "")

        if method == "GET":
            cur.execute(f"""
                SELECT id, booking_id, title, body, is_read, created_at
                FROM {S}.notifications
                WHERE user_id=%s
                ORDER BY created_at DESC
                LIMIT 50
            """, (user_id,))
            cols = ["id", "booking_id", "title", "body", "is_read", "created_at"]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
            for r in rows:
                r["created_at"] = r["created_at"].isoformat()
            unread = sum(1 for r in rows if not r["is_read"])
            return {"statusCode": 200, "headers": CORS,
                    "body": json.dumps({"items": rows, "unread": unread})}

        if method == "POST":
            if action == "read" and params.get("id"):
                cur.execute(
                    f"UPDATE {S}.notifications SET is_read=TRUE WHERE id=%s AND user_id=%s",
                    (params["id"], user_id)
                )
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

            if action == "read_all":
                cur.execute(
                    f"UPDATE {S}.notifications SET is_read=TRUE WHERE user_id=%s AND is_read=FALSE",
                    (user_id,)
                )
                conn.commit()
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "unknown action"})}

    finally:
        conn.close()
