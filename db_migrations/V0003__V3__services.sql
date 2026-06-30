CREATE TABLE IF NOT EXISTS services (
  id          SERIAL PRIMARY KEY,
  master_id   INT NOT NULL REFERENCES masters(id),
  title       TEXT NOT NULL,
  description TEXT,
  price_type  TEXT NOT NULL DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'per_hour')),
  price       NUMERIC(12,2) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)