ALTER TABLE t_p84631928_service_booking_syst.services
  DROP CONSTRAINT services_price_type_check;

ALTER TABLE t_p84631928_service_booking_syst.services
  ADD CONSTRAINT services_price_type_check
  CHECK (price_type IN ('fixed', 'per_hour', 'per_minute'));