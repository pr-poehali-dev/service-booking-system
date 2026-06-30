CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT UNIQUE NOT NULL,
  role          TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'master')),
  session_token TEXT UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
