"""
Разовая рассылка письма всем пользователям с реальными e-mail + уведомление в колокольчик.
GET /?secret=... — запустить рассылку
"""
import os, smtplib, json
import psycopg2
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

FROM_EMAIL = "lepestok-servis@yandex.ru"
S = "t_p84631928_service_booking_syst"

SUBJECT = "Важное обновление БьютиБук"

TITLE = "Важное обновление"

TEXT_BODY = """Здравствуйте.
Мы переехали на официальный домен beauty-book.pro
А сайт при входе с мобильного устройства может предложить установить приложение для Android или iOS
Кроме того, внесены изменения в цветовую палитру при заполнении расписания мастера и улучшена сортировка при просмотре заявок для того, чтобы самые актуальные события отображались в первую очередь."""

HTML_LINES = [
    "Мы переехали на официальный домен <b><a href='https://beauty-book.pro' style='color:#d45a7a'>beauty-book.pro</a></b>",
    "Сайт при входе с мобильного устройства может предложить установить приложение для <b>Android или iOS</b>.",
    "Внесены изменения в <b>цветовую палитру</b> при заполнении расписания мастера.",
    "Улучшена <b>сортировка заявок</b> — самые актуальные события теперь отображаются в первую очередь.",
]

BELL_BODY = (
    "Мы переехали на beauty-book.pro. "
    "На мобильном можно установить приложение. "
    "Обновлена палитра расписания и сортировка заявок."
)

CORS = {"Access-Control-Allow-Origin": "*"}
FAKE_DOMAINS = {"lepestok.demo", "example.com", "test.com"}


def _is_real_email(email: str) -> bool:
    domain = email.split("@")[-1].lower() if "@" in email else ""
    return bool(email) and domain not in FAKE_DOMAINS


def _html(name: str) -> str:
    rows = "".join(f"<p style='color:#444;margin:8px 0'>• {l}</p>" for l in HTML_LINES)
    return f"""<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;
background:#fff9fb;border-radius:16px">
<h2 style="color:#d45a7a">💅 БьютиБук</h2>
<p style="color:#444">Здравствуйте, {name}!</p>
{rows}
<p style="color:#aaa;font-size:12px;margin-top:24px">Это автоматическое уведомление от БьютиБук.</p>
</div>"""


def _send(to_email: str, name: str, password: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = SUBJECT
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email
    msg.attach(MIMEText(TEXT_BODY, "plain", "utf-8"))
    msg.attach(MIMEText(_html(name or "пользователь"), "html", "utf-8"))
    with smtplib.SMTP_SSL("smtp.yandex.ru", 465) as srv:
        srv.login(FROM_EMAIL, password)
        srv.sendmail(FROM_EMAIL, to_email, msg.as_string())


def handler(event: dict, context) -> dict:
    """Рассылка письма об обновлении всем реальным пользователям + уведомление в колокольчик."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    password = os.environ.get("YANDEX_SMTP_PASSWORD") or os.environ.get("YANDEX_EMAIL_PASSWORD", "")
    if not password:
        return {"statusCode": 500, "headers": CORS, "body": '{"error":"SMTP password not set"}'}

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute(f"SELECT id, name, email FROM {S}.users WHERE email IS NOT NULL AND email != ''")
    users = cur.fetchall()

    # Вставляем уведомление в колокольчик всем пользователям
    for uid, name, email in users:
        cur.execute(
            f"INSERT INTO {S}.notifications (user_id, booking_id, title, body) VALUES (%s, NULL, %s, %s)",
            (uid, TITLE, BELL_BODY)
        )
    conn.commit()
    bell_count = len(users)

    sent, skipped, errors = [], [], []
    for uid, name, email in users:
        if not _is_real_email(email):
            skipped.append(email)
            continue
        try:
            _send(email, name or "пользователь", password)
            sent.append(email)
            print(f"[broadcast] sent → {email}")
        except Exception as e:
            errors.append({"email": email, "error": str(e)})
            print(f"[broadcast] error → {email}: {e}")

    conn.close()

    return {
        "statusCode": 200,
        "headers": CORS,
        "body": json.dumps({
            "bell_notifications": bell_count,
            "emails_sent": len(sent),
            "skipped": len(skipped),
            "errors": len(errors),
            "sent_to": sent,
        })
    }
