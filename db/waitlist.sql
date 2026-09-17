-- Waitlist for full workshops and for Fortune Dome when no slot is left.
-- Order of joining matters, so rows keep their created_at across re-saves.
CREATE TABLE IF NOT EXISTS guest_event.waitlist (
 ticket_id uuid NOT NULL REFERENCES guest_event.tickets(id) ON DELETE CASCADE,
 target text NOT NULL, -- 'sound' | 'scent' | 'style' | 'fortune'
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (ticket_id, target)
);
REVOKE ALL ON guest_event.waitlist FROM PUBLIC, anon, authenticated;
