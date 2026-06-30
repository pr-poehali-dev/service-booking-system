CREATE TABLE IF NOT EXISTS bookings (
  id         SERIAL PRIMARY KEY,
  client_id  INT NOT NULL REFERENCES users(id),
  master_id  INT NOT NULL REFERENCES masters(id),
  service_id INT NOT NULL REFERENCES services(id),
  slot_id    INT NOT NULL REFERENCES slots(id),
  status     TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','confirmed','cancelled','done')),
  confirm_by TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bookings_client  ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_master  ON bookings(master_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status  ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_confirm ON bookings(confirm_by)