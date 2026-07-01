"""
Разовая рассылка письма всем пользователям с реальными e-mail.
GET /?secret=... — запустить рассылку
"""
import os, smtplib
import psycopg2
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

FROM_EMAIL = "lepestok-servis@yandex.ru"
S = "t_p84631928_service_booking_syst"

SUBJECT = "Что нового в БьютиБук"

BODY = """Здравствуйте.
Изменения в новой версии:
1. Добавлены уведомления для клиентов и мастеров об изменении статуса бронирования. Прямо из уведомлений можно перейти к нужной брони.
2. В кабинете Мастера добавлена реферальная ссылка. Вы можете приглашать своих знакомых пользоваться нашим приложением.
3. Добавлен вариант стоимость услуги за минуту.
4. Календарь разбит теперь на получасовые отметки. Вы можете более удобно планировать своё рабочее время."""

CORS = {"Access-Control-Allow-Origin": "*"}

FAKE_DOMAINS = {"lepestok.demo", "example.com", "test.com"}


def _is_real_email(email: str) -> bool:
    domain = email.split("@")[-1].lower() if "@" in email else ""
    return bool(email) and domain not in FAKE_DOMAINS


def _send(to_email: str, name: str, password: str):
    html = f"""<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;
background:#fff9fb;border-radius:16px">
<h2 style="color:#d45a7a">💅 БьютиБук</h2>
<p style="color:#444">Здравствуйте, {name}!</p>
<p style="color:#444">Мы обновили приложение. Вот что изменилось:</p>
<ol style="color:#444;line-height:1.8">
  <li>Добавлены <b>уведомления</b> для клиентов и мастеров об изменении статуса бронирования. Прямо из уведомлений можно перейти к нужной брони.</li>
  <li>В кабинете Мастера добавлена <b>реферальная ссылка</b>. Вы можете приглашать своих знакомых пользоваться нашим приложением.</li>
  <li>Добавлен вариант <b>стоимость услуги за минуту</b>.</li>
  <li><b>Календарь</b> разбит теперь на получасовые отметки. Вы можете более удобно планировать своё рабочее время.</li>
</ol>
<p style="color:#aaa;font-size:12px;margin-top:24px">Это автоматическое уведомление от БьютиБук.</p>
</div>"""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = SUBJECT
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email
    msg.attach(MIMEText(BODY, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    with smtplib.SMTP_SSL("smtp.yandex.ru", 465) as srv:
        srv.login(FROM_EMAIL, password)
        srv.sendmail(FROM_EMAIL, to_email, msg.as_string())


def handler(event: dict, context) -> dict:
    """Рассылка письма об обновлении всем реальным пользователям."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    password = os.environ.get("YANDEX_SMTP_PASSWORD") or os.environ.get("YANDEX_EMAIL_PASSWORD", "")
    if not password:
        return {"statusCode": 500, "headers": CORS, "body": '{"error":"SMTP password not set"}'}

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute(f"SELECT name, email FROM {S}.users WHERE email IS NOT NULL AND email != ''")
    users = cur.fetchall()
    conn.close()

    sent, skipped, errors = [], [], []
    for name, email in users:
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

    return {
        "statusCode": 200,
        "headers": CORS,
        "body": f'{{"sent":{len(sent)},"skipped":{len(skipped)},"errors":{len(errors)},"sent_to":{sent}}}'
    }
