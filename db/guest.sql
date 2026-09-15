-- Kept outside public: inaccessible through Supabase's anonymous Data API.
CREATE SCHEMA IF NOT EXISTS guest_event;
REVOKE ALL ON SCHEMA guest_event FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS guest_event.tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL, code_hash text UNIQUE NOT NULL,
 active boolean NOT NULL DEFAULT true, is_demo boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS guest_event.sessions (
 token_hash text PRIMARY KEY, ticket_id uuid NOT NULL REFERENCES guest_event.tickets(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS guest_event.workshops (
 id text PRIMARY KEY, capacity integer CHECK (capacity > 0),
 enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS guest_event.reservations (
 ticket_id uuid NOT NULL REFERENCES guest_event.tickets(id) ON DELETE CASCADE,
 workshop_id text NOT NULL REFERENCES guest_event.workshops(id),
 PRIMARY KEY(ticket_id, workshop_id)
);
CREATE TABLE IF NOT EXISTS guest_event.plans (
 ticket_id uuid PRIMARY KEY REFERENCES guest_event.tickets(id) ON DELETE CASCADE,
 data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS guest_event.login_limits (
 key text PRIMARY KEY, attempts integer NOT NULL, expires_at timestamptz NOT NULL
);
INSERT INTO guest_event.workshops (id) VALUES ('sound'), ('scent'), ('style'),
 ('fortune-16:30'), ('fortune-16:45'), ('fortune-17:00'), ('fortune-17:15'),
 ('fortune-21:15'), ('fortune-21:30'), ('fortune-21:45'), ('fortune-22:00')
 ON CONFLICT DO NOTHING;

CREATE OR REPLACE VIEW guest_event.katilimci_listesi AS
SELECT
 t.name AS "Katılımcı",
 CASE WHEN t.is_demo THEN 'Deneme' ELSE 'Biletli' END AS "Kayıt türü",
 CASE WHEN t.active THEN 'Aktif' ELSE 'İptal' END AS "Durum",
 p.data->>'transport' AS "Ulaşım",
 NULLIF(p.data->>'origin', '') AS "Hareket noktası",
 COALESCE(NULLIF(p.data->>'arrival', ''), 'Henüz belli değil') AS "Varış saati",
 (p.data->>'party')::integer AS "Birlikte gelen kişi sayısı",
 CASE WHEN p.data->'selected' ? 'sound' THEN 'Seçildi' ELSE '—' END AS "Kolektif Ses",
 CASE WHEN p.data->'selected' ? 'scent' THEN 'Seçildi' ELSE '—' END AS "Koku Laboratuvarı",
 CASE WHEN p.data->'selected' ? 'style' THEN 'Seçildi' ELSE '—' END AS "Stil İçgüdüdür",
 NULLIF(p.data->>'slot', '') AS "Fortune Dome saati",
 p.data->>'allergy' AS "Alerji veya intolerans",
 NULLIF(p.data->>'allergyNote', '') AS "Alerji açıklaması",
 p.data->>'diet' AS "Beslenme tercihi",
 NULLIF(p.data->>'note', '') AS "Özel ihtiyaçlar ve notlar",
 CASE WHEN p.data->>'consent' = 'true' THEN 'Onaylandı' ELSE 'Onaylanmadı' END AS "Bilgi paylaşım onayı",
 p.updated_at AT TIME ZONE 'Europe/Istanbul' AS "Son kayıt (Türkiye saati)",
 t.id AS "Katılımcı ID"
FROM guest_event.plans p
JOIN guest_event.tickets t ON t.id = p.ticket_id;
REVOKE ALL ON guest_event.katilimci_listesi FROM PUBLIC, anon, authenticated;
