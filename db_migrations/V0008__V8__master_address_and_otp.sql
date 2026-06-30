ALTER TABLE t_p84631928_service_booking_syst.masters
  ADD COLUMN IF NOT EXISTS address TEXT;

CREATE TABLE IF NOT EXISTS t_p84631928_service_booking_syst.otp_codes (
  id         SERIAL PRIMARY KEY,
  phone      TEXT NOT NULL,
  code       TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON t_p84631928_service_booking_syst.otp_codes(phone, expires_at)