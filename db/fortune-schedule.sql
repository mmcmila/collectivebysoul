-- Fourteen 15-minute sessions (3.5 hours); existing reservations are kept.
BEGIN;
SELECT pg_advisory_xact_lock(19092026);
DO $$
DECLARE candidate text;
BEGIN
 FOREACH candidate IN ARRAY ARRAY['20:30','20:45','21:00','22:15','22:30','22:45']
 LOOP
  IF (SELECT count(*) FROM guest_event.workshops WHERE id LIKE 'fortune-%') < 14 THEN
   INSERT INTO guest_event.workshops(id,capacity,enabled) VALUES('fortune-'||candidate,1,true) ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
END $$;
COMMIT;
