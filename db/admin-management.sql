ALTER TABLE guest_event.tickets ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'paid' CHECK(category IN ('paid','team','guest'));
