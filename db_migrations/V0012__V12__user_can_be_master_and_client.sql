ALTER TABLE t_p84631928_service_booking_syst.users
  ALTER COLUMN role SET DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS is_master BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE t_p84631928_service_booking_syst.users u
SET is_master = TRUE
WHERE EXISTS (
  SELECT 1 FROM t_p84631928_service_booking_syst.masters m WHERE m.user_id = u.id
)