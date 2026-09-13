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
| `components/yoga-grove.tsx`         | Event sections, animation helpers, and dialogs         |
| `components/event-content.ts`       | Turkish and English event copy and workshop data       |
| `public/assets/web/`                | Current event photography                              |
| `components/ui/`                    | shadcn components built on Base UI                     |
| `components.json`                   | shadcn configuration and aliases                       |
| `app/globals.css`                   | Design tokens, layouts, spacing, and responsive styles |
| `app/fonts/`                        | Self-hosted Poppins fonts and their license            |
| `public/images/`                    | Reference imagery served locally                       |
| `scripts/check-package-manager.mjs` | pnpm install guard                                     |
| `AGENTS.md`                         | Repository guidance for coding agents                  |
| `CLAUDE.md`                         | Imports AGENTS.md to keep guidance in one place        |

## Editing the site

Edit bilingual copy and workshop information in `components/event-content.ts` and section composition in `components/yoga-grove.tsx`. Update metadata in `app/layout.tsx` and styles in `app/globals.css`.

The page preserves the original full-width hero, reveal animations, sticky stacking photo cards, workshop cards, host portraits, FAQ layout, closing banner, and large footer wordmark. Event-specific additions include venue and boat photo dialogs, music listings, a single Crossing Pass, and a participation form. Motion and CSS respect reduced-motion preferences.

The homepage is served by the App Router. The previous `/index.html` address redirects to `/`, including existing section anchors. Turkish is the initial language; the TR/EN control switches the copy and document language. Social image URLs use `VERCEL_PROJECT_PRODUCTION_URL` when deployed on Vercel, and localhost during local development.

Check desktop and mobile layouts and keyboard interactions after changes. Run `pnpm lint` and `pnpm build` before submitting changes. Run `node --experimental-strip-types --test tests/google-form.test.mjs` on Node.js 22.6+ to check validation, field mapping, and upstream confirmation handling. These tests use mocked network responses and do not create Google Form entries.

## Current scope

The participation form posts to `/api/applications`, which validates the request and forwards it to Google Forms. Responses are stored in Google Forms; the linked Google Sheet is an optional response copy, not a dependency of the website. There is no database, checkout, or booking service. A successful application does not confirm a place.

The client preserves entered details on failure and prevents repeated clicks during submission. The route limits request size, checks browser origins, and includes a honeypot. These are basic protections, not durable rate limiting or deduplication. An uncertain network failure is not retried automatically because Google may already have saved the response.

## Google Forms configuration

- [Edit the event form](https://docs.google.com/forms/d/1tsIfu_1e0izB2uegBdWZXn0BYcH4YZwyCF7t0EXbFbs/edit).
- In **Responses → More → Get email notifications for new responses**, enable notifications for each organizer account that needs them. The setting is per account. Notifications alert the organizer; they do not send a custom reply to applicants.
- Keep the form published and accepting responses without a required Google sign-in. Do not enable response summaries for respondents.
- Public field identifiers, answer values, and the confirmation marker live in `lib/google-form.ts`. If you recreate questions, change option values, or change the confirmation message, update this mapping and verify a clearly labeled test response.
- The integration uses the Google Forms web submission endpoint, not an official submission API. Google UI or endpoint changes can require maintenance. Success is shown only when Google's visible confirmation matches the configured message.
- `components/application-form.tsx` owns the bilingual form interaction; `app/api/applications/route.ts` handles submissions. No credentials or Sheets API are required.

## Assets and attribution

Current event copy and photography are preserved from the event landing page. Original reference imagery remains in `public/images/` for historical reference. Poppins is distributed under the [SIL Open Font License](app/fonts/OFL.txt) and is hosted locally, so builds do not need a Google Fonts connection.
