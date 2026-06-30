ALTER TABLE t_p84631928_service_booking_syst.masters
  ADD COLUMN IF NOT EXISTS ref_code text UNIQUE;

ALTER TABLE t_p84631928_service_booking_syst.users
  ADD COLUMN IF NOT EXISTS referred_by integer REFERENCES t_p84631928_service_booking_syst.masters(id);

UPDATE t_p84631928_service_booking_syst.masters
  SET ref_code = UPPER(SUBSTRING(MD5(CAST(id AS text) || 'lepestok'), 1, 8))
  WHERE ref_code IS NULL;