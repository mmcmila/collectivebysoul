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

Open [localhost:3000](http://localhost:3000). No environment variables or external services are required for the current frontend.

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

Check desktop and mobile layouts and keyboard interactions after changes. Run `pnpm lint` and `pnpm build` before submitting changes. There is no configured automated test suite.

## Current scope

There is no database, checkout, booking service, or stored form submission. The participation form validates required fields and opens an email draft addressed to `hello@soulcollective.co`. Guests must send the email themselves; opening the draft is not a reservation confirmation.

## Assets and attribution

Current event copy and photography are preserved from the event landing page. Original reference imagery remains in `public/images/` for historical reference. Poppins is distributed under the [SIL Open Font License](app/fonts/OFL.txt) and is hosted locally, so builds do not need a Google Fonts connection.
