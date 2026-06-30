CREATE TABLE t_p84631928_service_booking_syst.notifications (
    id          serial PRIMARY KEY,
    user_id     integer NOT NULL REFERENCES t_p84631928_service_booking_syst.users(id),
    booking_id  integer REFERENCES t_p84631928_service_booking_syst.bookings(id),
    title       text NOT NULL,
    body        text NOT NULL,
    is_read     boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT NOW()
);