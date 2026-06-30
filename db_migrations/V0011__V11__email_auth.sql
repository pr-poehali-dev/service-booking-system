ALTER TABLE t_p84631928_service_booking_syst.users
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON t_p84631928_service_booking_syst.users(email)
  WHERE email IS NOT NULL;

ALTER TABLE t_p84631928_service_booking_syst.otp_codes
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_otp_email
  ON t_p84631928_service_booking_syst.otp_codes(email, expires_at)
  WHERE email IS NOT NULL;

UPDATE t_p84631928_service_booking_syst.users
SET email = 'anna@lepestok.demo' WHERE phone = '+79001001010';
UPDATE t_p84631928_service_booking_syst.users
SET email = 'darya@lepestok.demo' WHERE phone = '+79001001020';
UPDATE t_p84631928_service_booking_syst.users
SET email = 'elena@lepestok.demo' WHERE phone = '+79001001030';
UPDATE t_p84631928_service_booking_syst.users
SET email = 'ivan@lepestok.demo' WHERE phone = '+79001002010';
UPDATE t_p84631928_service_booking_syst.users
SET email = 'maria@lepestok.demo' WHERE phone = '+79001002020'