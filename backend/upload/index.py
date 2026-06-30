"""
Загрузка фотографий в S3.
POST / — загрузить фото (base64 в теле), вернуть CDN-URL
  body: { "data": "<base64>", "mime": "image/jpeg", "target": "master"|"service" }
  X-Session-Token обязателен
"""
import json, os, uuid, base64
import psycopg2
import boto3

S = "t_p84631928_service_booking_syst"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Token",
}
ALLOWED_MIME = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_SIZE = 5 * 1024 * 1024  # 5 МБ


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_token(event):
    h = event.get("headers") or {}
    return h.get("x-session-token") or h.get("X-Session-Token")


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    token = get_token(event)
    if not token:
        return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "unauthorized"})}

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"SELECT id FROM {S}.users WHERE session_token=%s", (token,))
    user = cur.fetchone()
    conn.close()
    if not user:
        return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "invalid token"})}

    body = json.loads(event.get("body") or "{}")
    data_b64 = body.get("data", "")
    mime = body.get("mime", "image/jpeg")
    target = body.get("target", "master")

    if mime not in ALLOWED_MIME:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "unsupported image type"})}

    # Убираем data-URL префикс если есть
    if "," in data_b64:
        data_b64 = data_b64.split(",", 1)[1]

    try:
        img_bytes = base64.b64decode(data_b64)
    except Exception:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "invalid base64"})}

    if len(img_bytes) > MAX_SIZE:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "file too large (max 5MB)"})}

    ext = ALLOWED_MIME[mime]
    key = f"photos/{target}/{uuid.uuid4()}.{ext}"

    s3 = boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )
    s3.put_object(Bucket="files", Key=key, Body=img_bytes, ContentType=mime)

    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"url": cdn_url})}
