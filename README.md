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

The page preserves the original full-width hero, reveal animations, workshop cards, host portraits, FAQ layout and closing banner. The day flow is a static three-step photo grid, and the footer leads with the brand mark. Event-specific additions include venue photo dialogs, the animated Tugen music block under the workshops, a single Island Pass with a guest portal entry, and a participation form. Motion and CSS respect reduced-motion preferences.

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

### Bekleme listesi
Dolu atölyeler misafir ekranında kapanmaz: kart "Dolu · bekleme listesine katıl" der, dokununca kişi o atölyenin bekleme listesine yazılır ve "Yer açılırsa sana haber verip yerini ayarlayacağız" notunu görür. Fortune Dome'da boş saat kalmadıysa saat ızgarasının altında "Boş saat kalmadı · bekleme listesine katıl" seçeneği çıkar; yönetim boşalan saati kişiye atar (Fortune Dome düzenleyicisi atamayla birlikte kişiyi listeden çıkarır). Kayıtlar `guest_event.waitlist` tablosunda katılım sırasıyla tutulur (`db/waitlist.sql`); plan JSON'unda `waitlist` ve `fortuneWaitlist` alanları aynı bilgiyi taşır, eski planlar boş kabul edilir. Yer ayırtılan atölyenin bekleme kaydı düşer; deneme hesapları listeye girmez; listeden kaldırılan katılımcının bekleme kayıtları silinir. Yönetim panelinde atölye kartında bekleyen sayısı, atölye detayında ve Fortune Dome bölümünde sıralı isimler görünür. Bildirim otomatik gönderilmez; yer açılınca organizatör kişiye haber verir.

### Adisyon (bar ve pizza)
`/yonetim/adisyon`, POS olmayan bar ve pizza noktaları için açık hesap modülüdür; telefon öncelikli tasarlanmıştır. Her misafirin bir hesabı vardır; personel alınan ürünü hesaba işler, misafir nakit veya IBAN ile istediği zaman kapatır. Toplam / ödenen / kalan saklanmaz, satır ve ödemelerden hesaplanır. Her ürün ekleme yeni bir satır oluşturur ve ürünün o anki adı ile fiyatı satıra kopyalanır; menü sonradan değişse de eski satırlar değişmez. Tutar boş bırakılırsa kalanın tamamı alınır; kalan sıfırlanınca hesap kendiliğinden kapanır, kapalı hesaba ürün eklenince yeniden açılır. Silme işlemleri sayfa içi onay kutusuyla sorulur (`components/confirm-dialog.tsx`; gömülü tarayıcılar `window.confirm`’i engellediği için). Yanlış girilen ürünü ve ödemeyi bütün personel silebilir, başkası girmiş olsa da; ikram işaretini yalnızca kaydı giren kişi veya yönetici değiştirebilir; ödenmiş geçmiş hesaplardaki kayıtları ve misafiri yalnızca yönetici silebilir. Silinen her şey (ürün, ödeme, misafir, menü ürünü, IBAN) ve menüye eklenen ürünler kim/ne zaman bilgisiyle `guest_event.tab_audit` tablosuna yazılır; Özet’teki “İşlem geçmişi”ni yalnızca yönetici görür ve tek tek veya toplu silebilir. Menüyü bütün personel yönetir: personelde “Menü” sekmesi (yöneticide Ayarlar → Menü, `components/tab-menu-editor.tsx`) ile ürün ekler, fiyat değiştirir, biten ürünü “Pasif” yapıp gizler ve tekrar açar; profil ekranındaki “+ Menüde yok, yeni ürün ekle” de hızlı ekleme içindir. Her menü değişikliği (`menu.create`, `menu.update`, `menu.delete`) işlem geçmişine yazılır; ürünü kalıcı silmek yöneticidedir. Ödeme yöntemi Nakit / IBAN / POS’tur; IBAN seçilince hangi hesaba ödendiği seçilir (Ayarlar → IBAN hesapları: kimin hesabı + IBAN, birden fazla olabilir) ve ödemeye kaydedilir. Kural: borcu olan hesap açıktır, hesabının tamamını ödeyen kapalıdır; açık/kapalı elle seçilmez, her sipariş, ödeme, ikram ve silmeden sonra bakiyeden hesaplanır (`tabStatus`, `tab_guests.status` sunucuda eşitlenir). “Açık” filtresinde kalan borç, “Kapalı” filtresinde misafirin toplam ödediği tutar görünür; Özet’te de “Açık hesaplar · borcu olanlar” ve “Kapalı hesaplar · ödeyenler” listeleri vardır. “Ödeme alındı” yazılan tutarı (boşsa kalanın tamamını) kaydeder; borç bitince hesap kendiliğinden kapanır. “Açık hesap” ödeme almadan hesabı açık bırakır; IBAN seçiliyken hesabı `pending_method=iban` ile işaretler ve listede “IBAN bekleniyor” gösterir, para gelince kaydedilen ödeme bu durumu temizler. Özet güne (06:00–06:00, gece yarısından sonraki satış aynı geceye sayılır) ve personele göre süzülebilir; borç ve ödeyen listeleri her zaman güncel durumu gösterir. Yönetici Özet’in altındaki “Adisyonu sıfırla” ile (SIFIRLA yazarak) bütün satış, ödeme ve işlem geçmişini silip temiz başlayabilir; misafirler, menü, IBAN’lar, indirim kuralları ve personel girişleri kalır, silinenlerin özeti tek bir `data.reset` kaydı olarak tutulur. Silmeler sonucu boş kalan yeni hesap (tur) düşürülür, misafir son dolu hesabına döner. Ödemesi tamamlanmış hesaba yeni sipariş girilince aynı profilde yeni hesap (tur) açılır; ödenmiş önceki siparişler profilin en altında “Ödenmiş geçmiş siparişler” altında kalır. İndirim kuralları Ayarlar → İndirimler’de tanımlanır (`discount_rules`: Ekipten / Misafir / Biletli türü için veya kişiye özel, serbest yüzde, silinebilir); yönetici kişi profilinden istediği yüzdeyi yazabilir, “İndirimi kaldır” (kural olsa da 0) veya “Kurala dön” diyebilir (`tab_guests.discount_percent` = kişiye özel geçersiz kılma, NULL = kurallar). İndirim her kaleme eklendiği anda kopyalanır (`tab_lines.discount_percent`); kural veya kişisel indirim sonradan kaldırılınca önceki kalemler indirimli kalır, yeni siparişler indirimsiz olur; her kalem 🎁 ile ikram işaretlenebilir (`complimentary`, 0 ₺ sayılır, listede “İkram” etiketiyle kalır). İndirim ve ikram özet ile CSV’de ayrı görünür (`tip=ikram`, `tip=indirim`). Ayarlarda menü ürünü ve IBAN silinebilir; ödeme kaydı olan IBAN silinmez, pasife alınır. Misafir silme, menüden kalıcı silme, IBAN hesapları, indirim kuralları, toplu misafir ekleme ve personel girişleri yalnızca yöneticiye açıktır. Yönetim panelinde oluşturulan her katılımcı (Biletli / Ekipten / Misafir, planı dolu olsun olmasın) `tab_guests.ticket_id` bağıyla otomatik olarak Adisyon’da açılır; listede türü görünür. Listeden kaldırılıp geri eklenen katılımcı için de hesap açılır. Adisyon’dan elle isim eklemek mümkün olmaya devam eder. `db/tab.sql` mevcut aktif katılımcıları bir kez aktarır (`settings.tab_backfill_done`).

Roller `guest_event.admins.role` sütununda tutulur: `admin` (organizatör, her şey), `bar`, `pizza` (etikette “Yemek”). Bar ve yemek hesapları yalnızca Adisyon’u görür; `/yonetim` onları `/yonetim/adisyon`'a yönlendirir ve yönetim action'ları reddeder. Giriş ekranı ortaktır. Personel için e-posta/şifre yoktur: her kişiye 6 karakterlik kısa bir giriş kodu (`ABC-DEF`) verilir; kod büyük/küçük harf, boşluk ve tire duyarsız girilir. Kodlar `admins.login_code` sütununda okunabilir tutulur ve yönetim panelinde Hesap ayarları → “Adisyon girişleri” bölümünde (aynı bölüm Adisyon → Ayarlar’da) görünür; ana panel yalnızca katılımcı ve atölye yönetimidir; oradan kod oluşturulur, kopyalanır, adı düzeltilir (“Adı düzenle”), “Yeni kod” ile yenilenir veya hesap kapatılır. Bu işlemlerin hepsi `tab_audit` tablosuna kim/ne zaman bilgisiyle yazılır ve aynı bölümdeki “Geçmiş hareketler” listesinden (son 100) izlenir; Adisyon → Özet → “İşlem geçmişi” silme, ikram, indirim ve personel işlemlerini birlikte gösterir. Yenileme ve kapatma o hesabın açık oturumlarını düşürür. Organizatör şifresi hash olarak saklanmaya devam eder ve hiçbir yerde gösterilmez. Giriş denemeleri IP başına 15 dakikada 8 ile sınırlıdır. Yönetici için istasyon seçici (Bar/Yemek) yalnızca menü filtresini belirler; satırın istasyonu ürünün istasyonudur.

Listede “Açık” yalnızca hesabı gerçekten açılmış (kalem veya ödeme girilmiş) ve kapanmamış misafirleri, “Kapalı” kapananları, “Hepsi” herkesi gösterir; arama filtreden bağımsız herkeste çalışır. Kapanan bir hesap yeniden açılınca aynı misafir profilinde yeni bir “hesap turu” (`round`) başlar: Toplam / Ödenen / Kalan güncel turu gösterir, önceki turlar profilin altında “Geçmiş hesaplar” olarak değiştirilemez şekilde kalır; Özet ve CSV tüm turları kapsar. Canlı güncelleme için ekran görünürken 5 saniyede bir sunucu action'ı ile yenilenir; ekleme ve ödeme optimistic gösterilir, hata olursa geri alınır. Yanlış dokunuş, toast üzerindeki "Geri al" ile onaysız geri alınır (silme kaydına yazılır). Aramada bulunmayan isim tek dokunuşla misafir olarak eklenir; liste başında açık hesap sayısı ve bekleyen toplam görünür. IBAN kutusundaki "Kalan + IBAN gönder" telefonun paylaşım menüsüyle (yoksa panoya) misafire ad, kalan ve IBAN metnini verir. Özet ekranında yönetici son 50 silme işlemini (kim, neyi, ne zaman) görür. Özet ekranı satış / tahsil / açık tutarlarını, yönteme (Nakit / IBAN / POS) ve istasyona göre dağılımı, IBAN hesabı bazında tahsilatı, satılan ürünleri adet çubuklarıyla, borcu olanları gösterir; `/yonetim/adisyon/csv` tüm satış ve ödemeleri noktalı virgülle ayrılmış, UTF-8 BOM'lu tek CSV olarak indirir (kolonlar: tip, misafir, urun, adet, fiyat, tutar, istasyon_veya_yontem, iban_hesabi, kullanici, zaman). Para birimi kuruş cinsinden tam sayı saklanır (250 ₺ = 25000).

Kurulum: `db/tab.sql` bir kez çalıştırılmalıdır (idempotent; `admins.role` sütununu, `tab_guests`, `menu_items`, `tab_lines`, `tab_payments`, `tab_audit`, `settings`, `bank_accounts` tablolarını ve tahmini fiyatlarla başlangıç menüsünü ekler; menü boş değilse seed atlanır). Koddan önce uygulanmalıdır, aksi halde giriş `role` sütununu bulamaz. Testler: `node --experimental-strip-types --test tests/tab-calc.test.mjs` hesap, kapanma/açılma ve yetki kurallarını veritabanı olmadan doğrular; `tests/tab-actions.mjs` yerel üretim sunucusunda (`pnpm build`, `pnpm start -p 3006`, `POSTGRES_URL`) geçici TEST kayıtlarıyla rol yetkilerini ve kuralları uçtan uca dener.

## Gizli bar menüsü (`/menu`)

`/menu`, HIDA Bar menüsünü basılı A4 tasarımıyla (sistem temasına göre açık/koyu) gösterir ve siteden hiçbir yerden bağlantı verilmez. Yalnızca QR kodundaki `/m/<anahtar>` adresiyle açılır: anahtar sunucudaki `MENU_ACCESS_KEY` ile eşleşirse 3 günlük HttpOnly `soul_menu` çerezi yazılır ve adres `/menu`’ye çevrilir; anahtarsız, yanlış anahtarlı veya `MENU_ACCESS_KEY` tanımsızken her iki adres de 404 döner. Sayfa `noindex`’tir. Bu bir şifre değil paylaşılabilir bir bağlantıdır; sızarsa Vercel’de `MENU_ACCESS_KEY` değiştirilip yeni QR basılır (eski çerezler de düşer). Anahtarı içeren QR görseli repoya veya `public/` altına konmaz.

Fiyatlar ve ürünlerin açık/kapalı durumu Adisyon menüsünden (`guest_event.menu_items`, yalnızca `active`) okunur; kategori sırası ve yazım `lib/menu/data.ts` içindedir ve ürünler adla eşleşir (aksan/büyük-küçük harf duyarsız). Personelin sonradan eklediği ürünler bar için “Bardan”, yemek için “Mutfaktan” altında kendiliğinden görünür.
