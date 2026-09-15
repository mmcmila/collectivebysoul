# Collective by Soul · One Day on an Island

A bilingual event landing page using the original Yogagrove-inspired frontend from commit `0f02bf104b30b8af63335894d518069b45ba318b`, built with Next.js App Router, TypeScript, shadcn/ui (Base UI), Tailwind CSS, and Motion.

## Requirements

- Node.js 20.9 or newer; use an actively supported LTS release.
- pnpm 10.17.1, pinned in `package.json`.

**Use pnpm for all package commands.** Commit `pnpm-lock.yaml` with dependency changes. Do not add other package-manager lockfiles. The install script rejects other package managers during normal lifecycle execution.

If Corepack is available on your machine, run `corepack enable` once. It will select the pinned pnpm version when you run commands in this repository. Otherwise, follow the [pnpm installation guide](https://pnpm.io/installation) and install the pinned version.

## Get started

```sh
git clone git@github.com:hasanharman/collectivebysoul.git
cd collectivebysoul
pnpm install --frozen-lockfile
pnpm dev
```

Open [localhost:3000](http://localhost:3000). No environment variables are required. Application submissions require access to the configured Google Form.

## Commands

| Command                            | Purpose                                        |
| ---------------------------------- | ---------------------------------------------- |
| `pnpm dev`                         | Start the development server                   |
| `pnpm lint`                        | Run ESLint                                     |
| `pnpm build`                       | Build for production and check TypeScript      |
| `pnpm start`                       | Serve the production build after `pnpm build`  |
| `pnpm add <package>`               | Add a runtime dependency                       |
| `pnpm add -D <package>`            | Add a development dependency                   |
| `pnpm exec shadcn add <component>` | Add a shadcn component using the installed CLI |

For CI and clean checkouts, use `pnpm install --frozen-lockfile`, then `pnpm lint` and `pnpm build`.

## Project structure

| Path                                | Purpose                                                |
| ----------------------------------- | ------------------------------------------------------ |
| `app/page.tsx`                      | Server-rendered page entry point                       |
| `app/layout.tsx`                    | Root layout, metadata, and local fonts                 |
| `app/favicon.ico`, `app/icon.png`, `app/apple-icon.png` | Brand icons via Next.js file conventions |
| `components/yoga-grove.tsx`         | Event sections, animation helpers, and dialogs         |
| `components/event-content.ts`       | Turkish and English event copy and workshop data       |
| `public/assets/web/`                | Current event photography                              |
| `components/ui/`                    | shadcn components built on Base UI                     |
| `components.json`                   | shadcn configuration and aliases                       |
| `app/globals.css`                   | Design tokens, layouts, spacing, and responsive styles |
| `app/fonts/`                        | Self-hosted Poppins fonts and their license            |
| `public/images/footer-alternatives/` | Illustrated footer artwork for `/home-01` and `/home-02` |
| `scripts/check-package-manager.mjs` | pnpm install guard                                     |
| `AGENTS.md`                         | Repository guidance for coding agents                  |
| `CLAUDE.md`                         | Imports AGENTS.md to keep guidance in one place        |

## Editing the site

Edit bilingual copy and workshop information in `components/event-content.ts` and section composition in `components/yoga-grove.tsx`. Update metadata in `app/layout.tsx` and styles in `app/globals.css`. The event ticket covers on-site activities and hospitality; transport is not listed as a ticket inclusion. The FAQ links to ferry timetables and explains optional group sea taxi arrangements and the İBB Deniz Taksi app. The older copy and audit in `docs/` are historical references.

The page preserves the original full-width hero, reveal animations, sticky stacking photo cards, workshop cards, host portraits, FAQ layout, closing banner, and large footer wordmark. Event-specific additions include venue photo dialogs, the animated Tugen music block under the workshops, a single Island Pass with a guest portal entry, and a participation form. Motion and CSS respect reduced-motion preferences.

The homepage is served by the App Router. The previous `/index.html` address redirects to `/`, including existing section anchors. Turkish is the initial language; the TR/EN control switches the copy and document language. Social image URLs use `VERCEL_PROJECT_PRODUCTION_URL` when deployed on Vercel, and localhost during local development.

Check desktop and mobile layouts and keyboard interactions after changes. Run `pnpm lint` and `pnpm build` before submitting changes. Run `node --experimental-strip-types --test tests/google-form.test.mjs` on Node.js 22.6+ to check validation, field mapping, and upstream confirmation handling. These tests use mocked network responses and do not create Google Form entries.

## Current scope

The participation form posts to `/api/applications`, which validates the request and forwards it to Google Forms. Responses are stored in Google Forms; the linked Google Sheet is an optional response copy, not a dependency of the website. The landing page has no checkout or booking service; the guest portal below uses PostgreSQL only for issued tickets. A successful application does not confirm a place.

The client preserves entered details on failure and prevents repeated clicks during submission. The route limits request size, checks browser origins, and includes a honeypot. These are basic protections, not durable rate limiting or deduplication. An uncertain network failure is not retried automatically because Google may already have saved the response.

## Google Forms configuration

- [Edit the event form](https://docs.google.com/forms/d/1tsIfu_1e0izB2uegBdWZXn0BYcH4YZwyCF7t0EXbFbs/edit).
- In **Responses → More → Get email notifications for new responses**, enable notifications for each organizer account that needs them. The setting is per account. Notifications alert the organizer; they do not send a custom reply to applicants.
- Keep the form published and accepting responses without a required Google sign-in. Do not enable response summaries for respondents.
- Public field identifiers, answer values, and the confirmation marker live in `lib/google-form.ts`. If you recreate questions, change option values, or change the confirmation message, update this mapping and verify a clearly labeled test response.
- The integration uses the Google Forms web submission endpoint, not an official submission API. Google UI or endpoint changes can require maintenance. Success is shown only when Google's visible confirmation matches the configured message.
- `components/application-form.tsx` owns the bilingual form interaction; `app/api/applications/route.ts` handles submissions. No credentials or Sheets API are required.

## Assets and attribution

Current event copy and photography are preserved from the event landing page. Only optimised photography that the site uses is kept in `public/assets/web/`; add new images there and reference them from components. Poppins is distributed under the [SIL Open Font License](app/fonts/OFL.txt) and is hosted locally, so builds do not need a Google Fonts connection.

## Guest planning portal

`/misafir` is the code-protected guest portal linked from the live landing page. It stores travel details, dietary/access needs and workshop selections in the existing Supabase PostgreSQL database, in the private `guest_event` schema. No data is exposed via Supabase's anonymous API. The app uses server-side database queries, hashed personal codes, random hashed sessions with HttpOnly cookies, and database-backed login throttling. Anonymous visitors only see the login form.

Group sessions have 12 places. Fortune Dome has one place per 15-minute slot. Reservations are checked and replaced inside a transaction with an event advisory lock: concurrent requests cannot overbook, and changed selections release previous seats. Availability refreshes every 20 seconds and is rechecked on save. Open studios remain walk-in, as advertised on the event page.

The website application form sends an application through Google Forms; it is not checkout. Payment is verified manually by the organiser before issuing a personal code. Codes are bearer credentials: share only with the intended guest. No code is automatically emailed or sent via WhatsApp.

### Organiser commands

Use the linked project's `.env.local` (`vercel env pull .env.local`). Never commit or share it. Commands below require the server-only `POSTGRES_URL`.

- Initialise schema: `node --env-file=.env.local scripts/guest-admin.mjs migrate`
- After confirming payment: `node --env-file=.env.local scripts/guest-admin.mjs issue "Guest name" --paid`
- Review account without consuming seats: `node --env-file=.env.local scripts/guest-admin.mjs issue "Design review" --demo`
- Set capacity: `node --env-file=.env.local scripts/guest-admin.mjs capacity sound 12` (IDs: `sound`, `scent`, `style`, `fortune-16:30`, etc.)
- Revoke a code and release seats: `node --env-file=.env.local scripts/guest-admin.mjs revoke TICKET_UUID`

Issuance outputs the personal code only once; only its hash is stored. Keep the ticket UUID to revoke it. Demo accounts save their example plans but never reserve seats. There is no organiser dashboard or payment integration yet. Guest details, including optional allergy information, should be accessed only by the organising team and deleted when no longer needed; a guest can request deletion by email.

### Management dashboard

`/yonetim` has separate organiser authentication; guest codes cannot access it. The dashboard refreshes every 15 seconds while visible, shows all issued tickets (including those without a saved plan), allows filtering and viewing every saved answer, and displays real workshop occupancy. Demo accounts are labelled and excluded from totals. Unsaved guest drafts cannot be tracked.

The organiser confirms payment manually and creates a personal guest code. The generated message can be copied for manual sharing; the app never sends it. Issuance uses a unique request ID to prevent duplicate tickets on retries. Codes are displayed once. Management sessions use a separate HttpOnly, SameSite=Lax cookie. Login offers a 30-day remembered session; without it sessions expire after 12 hours. Account settings let the organiser choose a 12–120 character password after verifying the current password/code. New passwords use salted scrypt hashes, and changing a password revokes other sessions while renewing the current one. Existing random codes continue to work until changed. All dashboard reads and ticket creation actions check the organiser session on the server.

Initial schema: `db/admin.sql`. The one-time management access file is local only (`tmp/yonetim-giris.txt`); never deploy, commit or share it with guests.

### Bilet iletişim planı ve kısa kodlar
Yeni misafir kodları 5 rakamdır; eski kodlar çalışmaya devam eder. Otomatik e-posta ve WhatsApp için kararlaştırılan, henüz uygulanmamış plan: [COMMUNICATION_PLAN.md](docs/COMMUNICATION_PLAN.md).

### Katılımcı ve Fortune Dome yönetimi
Atölye kartına tıklanınca aktif gerçek katılımcılar adlarına göre listelenir. “Atölyeden çıkar” onayından sonra yalnızca seçilen atölyenin rezervasyonu ve kişinin planındaki ilgili seçim tek veritabanı işlemiyle kaldırılır. Panelin listesi, kişi detayları ve kontenjan bilgileri birlikte yenilenir; diğer açık paneller en geç kendi 15 saniyelik yenilemesinde güncellenir. `tests/admin-workshops.mjs`, yerel üretim sunucusunda geçici test kaydıyla yetki, doğrulama, rezervasyon kaldırma ve diğer seçimleri koruma kontrollerini yapar.
Yönetim panelinde Biletli / Ekipten / Misafir türleri oluşturulabilir ve Detaylar içinden değiştirilebilir. Listeden kaldırma kodu kapatır, oturumları ve rezervasyonları serbest bırakır; kayıt silinmez. Kaldırılanları göster → Geri ekle ile geri alınır; önceki rezervasyonlar geri yüklenmez.
Fortune Dome bölümünde rezervasyonu olan kişinin adı görünür. Planını doldurmuş aktif kişiye saat atama, rezervasyonu kaldırma ve saati açma/kapatma desteklenir. Değişiklikler planla birlikte tek işlemde kaydedilir; çakışan atölye ve eşzamanlı güncellemeler kontrol edilir.
Yeni kurulumda db/admin-management.sql çalıştırılmalıdır. Mevcut canlı kurulumda uygulandı.

Yönetim özetinde aktif Biletli / Ekipten / Misafir sayıları ayrı gösterilir; liste katılımcı türüne göre filtrelenebilir. Tür filtresi isim, kayıt durumu ve deneme/kaldırılan kayıt seçenekleriyle birlikte çalışır.

### Misafir dili
/misafir giriş ve planlama akışı TR/EN destekler. İlk yanıtta tarayıcının tercih ettiği dil İngilizceyse İngilizce açılır; diğer dillerde Türkçe kullanılır. Üstteki TR/EN seçimi /misafir yoluna ait soul_guest_language çerezinde 1 yıl tutulur ve otomatik algılamadan önceliklidir. Dil değişimi form taslağını sıfırlamaz. Görünen seçenekler çevrilir; mevcut veritabanı değerleri ve yönetim panelinin Türkçe alanları korunur. Serbest metin kullanıcı yazdığı dilde saklanır.

Fortune Dome saatleri veritabanından dinamik okunur. Yönetim panelinde 14:00–23:45 arasında 15 dakika aralıklarla seans eklenip boş seanslar çıkarılabilir. Program, kapalı seanslar dahil en fazla 14 seans (210 dakika / 3,5 saat) içerir. Dolu seansın kaldırılması engellenir. Atölye çakışmaları hem misafir hem yönetici tarafında doğrulanır. db/fortune-schedule.sql mevcut kayıtları koruyarak altı akşam seansı ekler: 20:30, 20:45, 21:00, 22:15, 22:30, 22:45.

Misafir kontenjan yenilemesinde oturum süresi dolmuşsa giriş ekranına yönlendirilir.
