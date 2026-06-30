ALTER TABLE t_p84631928_service_booking_syst.masters
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE t_p84631928_service_booking_syst.services
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE t_p84631928_service_booking_syst.users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE t_p84631928_service_booking_syst.users
SET is_admin = TRUE
WHERE email = 'bouh.cbeta@gmail.com';