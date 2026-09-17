-- Açık Hesap (bar / pizza tab) module. Idempotent; run after db/admin.sql.
-- Money is stored as integer kuruş (250 ₺ = 25000).
BEGIN;

ALTER TABLE guest_event.admins
 ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin'
 CHECK (role IN ('admin','bar','pizza'));
-- Short staff login codes are kept readable so the organiser can look them up
-- in the console and hand them out again. The organiser password stays hashed.
ALTER TABLE guest_event.admins ADD COLUMN IF NOT EXISTS login_code text;
CREATE UNIQUE INDEX IF NOT EXISTS admins_login_code_idx ON guest_event.admins(login_code) WHERE login_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS guest_event.tab_guests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guest_event.menu_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
 price integer NOT NULL CHECK (price >= 0),
 station text NOT NULL CHECK (station IN ('bar','pizza')),
 active boolean NOT NULL DEFAULT true,
 sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS guest_event.tab_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 guest_id uuid NOT NULL REFERENCES guest_event.tab_guests(id) ON DELETE CASCADE,
 menu_item_id uuid REFERENCES guest_event.menu_items(id) ON DELETE SET NULL,
 name text NOT NULL,
 price integer NOT NULL CHECK (price >= 0),
 qty integer NOT NULL DEFAULT 1 CHECK (qty > 0),
 station text NOT NULL CHECK (station IN ('bar','pizza')),
 created_by uuid REFERENCES guest_event.admins(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tab_lines_guest_idx ON guest_event.tab_lines(guest_id, created_at);

CREATE TABLE IF NOT EXISTS guest_event.tab_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 guest_id uuid NOT NULL REFERENCES guest_event.tab_guests(id) ON DELETE CASCADE,
 amount integer NOT NULL CHECK (amount > 0),
 method text NOT NULL CHECK (method IN ('cash','iban')),
 created_by uuid REFERENCES guest_event.admins(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tab_payments_guest_idx ON guest_event.tab_payments(guest_id, created_at);

-- Who deleted what, and when. Rows and payments are removed physically, so the
-- snapshot of the deleted record is kept here.
CREATE TABLE IF NOT EXISTS guest_event.tab_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 action text NOT NULL,
 guest_id uuid,
 record jsonb NOT NULL,
 actor_id uuid REFERENCES guest_event.admins(id) ON DELETE SET NULL,
 actor_name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guest_event.settings (
 key text PRIMARY KEY,
 value text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO guest_event.settings(key,value) VALUES ('bar_iban','') ON CONFLICT DO NOTHING;

-- Seed menu only on an empty table so admin edits are never overwritten.
INSERT INTO guest_event.menu_items(name,price,station,sort_order)
SELECT * FROM (VALUES
 ('Pizza dilim', 25000, 'pizza', 1),
 ('Bira', 20000, 'bar', 2),
 ('Kokteyl', 40000, 'bar', 3),
 ('Şarap kadeh', 30000, 'bar', 4),
 ('Shot', 20000, 'bar', 5),
 ('Su / soft', 8000, 'bar', 6)
) AS seed(name,price,station,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM guest_event.menu_items);

-- Several IBANs (whose account it is + IBAN); a payment records which one it went to.
CREATE TABLE IF NOT EXISTS guest_event.bank_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 80),
 iban text NOT NULL CHECK (length(btrim(iban)) BETWEEN 5 AND 60),
 active boolean NOT NULL DEFAULT true,
 sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE guest_event.tab_payments ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES guest_event.bank_accounts(id) ON DELETE SET NULL;
ALTER TABLE guest_event.tab_payments DROP CONSTRAINT IF EXISTS tab_payments_method_check;
ALTER TABLE guest_event.tab_payments ADD CONSTRAINT tab_payments_method_check CHECK (method IN ('cash','iban','pos'));
-- Carry an IBAN text entered before this table existed over as the first account.
INSERT INTO guest_event.bank_accounts(label,iban,sort_order)
SELECT 'Organizatör', value, 1 FROM guest_event.settings
WHERE key='bar_iban' AND btrim(value)<>'' AND NOT EXISTS (SELECT 1 FROM guest_event.bank_accounts);

-- Every participant issued in the management console gets a tab automatically.
ALTER TABLE guest_event.tab_guests ADD COLUMN IF NOT EXISTS ticket_id uuid UNIQUE REFERENCES guest_event.tickets(id) ON DELETE SET NULL;
-- One-time backfill of existing active, non-demo participants (guarded so a
-- later re-run does not resurrect tabs the organiser deleted on purpose).
INSERT INTO guest_event.tab_guests(name,ticket_id)
SELECT t.name,t.id FROM guest_event.tickets t
WHERE t.active AND NOT t.is_demo
 AND NOT EXISTS (SELECT 1 FROM guest_event.settings WHERE key='tab_backfill_done')
 AND NOT EXISTS (SELECT 1 FROM guest_event.tab_guests g WHERE g.ticket_id=t.id);
INSERT INTO guest_event.settings(key,value) VALUES ('tab_backfill_done','1') ON CONFLICT DO NOTHING;

-- Discounts per guest, complimentary lines, and "will pay by IBAN later" state.
ALTER TABLE guest_event.tab_guests ADD COLUMN IF NOT EXISTS discount_percent integer NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100);
ALTER TABLE guest_event.tab_guests ADD COLUMN IF NOT EXISTS pending_method text CHECK (pending_method IN ('iban'));
ALTER TABLE guest_event.tab_guests ADD COLUMN IF NOT EXISTS pending_account_id uuid REFERENCES guest_event.bank_accounts(id) ON DELETE SET NULL;
ALTER TABLE guest_event.tab_lines ADD COLUMN IF NOT EXISTS complimentary boolean NOT NULL DEFAULT false;

-- Discount rules (per participant type or per person) and per-line discount
-- snapshots: removing a rule or a personal discount only affects new lines.
CREATE TABLE IF NOT EXISTS guest_event.discount_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK (kind IN ('category','guest')),
 category text CHECK (category IN ('paid','team','guest')),
 guest_id uuid REFERENCES guest_event.tab_guests(id) ON DELETE CASCADE,
 percent integer NOT NULL CHECK (percent BETWEEN 0 AND 100),
 label text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((kind='category' AND category IS NOT NULL) OR (kind='guest' AND guest_id IS NOT NULL))
);
ALTER TABLE guest_event.tab_lines ADD COLUMN IF NOT EXISTS discount_percent integer NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100);
-- tab_guests.discount_percent becomes an optional override: NULL = follow the rules.
ALTER TABLE guest_event.tab_guests ALTER COLUMN discount_percent DROP NOT NULL;
ALTER TABLE guest_event.tab_guests ALTER COLUMN discount_percent DROP DEFAULT;
UPDATE guest_event.tab_lines l SET discount_percent=COALESCE(g.discount_percent,0)
 FROM guest_event.tab_guests g WHERE g.id=l.guest_id
 AND NOT EXISTS (SELECT 1 FROM guest_event.settings WHERE key='line_discount_backfill');
UPDATE guest_event.tab_guests SET discount_percent=NULL WHERE discount_percent=0
 AND NOT EXISTS (SELECT 1 FROM guest_event.settings WHERE key='line_discount_backfill');
INSERT INTO guest_event.settings(key,value) VALUES ('line_discount_backfill','1') ON CONFLICT DO NOTHING;

-- Rounds: a closed tab that is reopened starts round n+1 on the same guest;
-- earlier rounds stay on the profile as history.
ALTER TABLE guest_event.tab_guests ADD COLUMN IF NOT EXISTS round integer NOT NULL DEFAULT 1 CHECK (round >= 1);
ALTER TABLE guest_event.tab_lines ADD COLUMN IF NOT EXISTS round integer NOT NULL DEFAULT 1 CHECK (round >= 1);
ALTER TABLE guest_event.tab_payments ADD COLUMN IF NOT EXISTS round integer NOT NULL DEFAULT 1 CHECK (round >= 1);

REVOKE ALL ON guest_event.tab_guests, guest_event.menu_items, guest_event.tab_lines,
 guest_event.tab_payments, guest_event.tab_audit, guest_event.settings, guest_event.bank_accounts,
 guest_event.discount_rules
 FROM PUBLIC, anon, authenticated;

COMMIT;
