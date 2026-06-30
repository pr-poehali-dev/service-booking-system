CREATE TABLE IF NOT EXISTS ratings (
  id         SERIAL PRIMARY KEY,
  booking_id INT NOT NULL REFERENCES bookings(id),
  from_role  TEXT NOT NULL CHECK (from_role IN ('client','master')),
  score      SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(booking_id, from_role)
)