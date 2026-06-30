CREATE TABLE IF NOT EXISTS slots (
  id         SERIAL PRIMARY KEY,
  master_id  INT NOT NULL REFERENCES masters(id),
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end   TIMESTAMPTZ NOT NULL,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(master_id, slot_start)
)