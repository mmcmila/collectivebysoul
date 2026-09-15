CREATE TABLE IF NOT EXISTS guest_event.admins (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text UNIQUE NOT NULL, code_hash text UNIQUE NOT NULL,
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS guest_event.admin_sessions (
 token_hash text PRIMARY KEY, admin_id uuid NOT NULL REFERENCES guest_event.admins(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
ALTER TABLE guest_event.tickets ADD COLUMN IF NOT EXISTS issue_request_id uuid UNIQUE;
REVOKE ALL ON guest_event.admins, guest_event.admin_sessions FROM PUBLIC, anon, authenticated;
