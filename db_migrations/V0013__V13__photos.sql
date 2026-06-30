ALTER TABLE t_p84631928_service_booking_syst.masters
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

UPDATE t_p84631928_service_booking_syst.masters
SET photo_url = photo1_url
WHERE photo1_url IS NOT NULL AND photo_url IS NULL;

ALTER TABLE t_p84631928_service_booking_syst.services
  ADD COLUMN IF NOT EXISTS photo1_url TEXT,
  ADD COLUMN IF NOT EXISTS photo2_url TEXT,
  ADD COLUMN IF NOT EXISTS photo3_url TEXT