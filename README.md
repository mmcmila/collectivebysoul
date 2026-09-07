# Collective by Soul · Yogagrove

A responsive recreation of the [Yogagrove Framer homepage](https://yogagrove.framer.website/), built with Next.js App Router, TypeScript, shadcn/ui (Base UI), Tailwind CSS, and Motion.

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

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm lint` | Run ESLint |
| `pnpm build` | Build for production and check TypeScript |
| `pnpm start` | Serve the production build after `pnpm build` |
| `pnpm add <package>` | Add a runtime dependency |
| `pnpm add -D <package>` | Add a development dependency |
| `pnpm exec shadcn add <component>` | Add a shadcn component using the installed CLI |

For CI and clean checkouts, use `pnpm install --frozen-lockfile`, then `pnpm lint` and `pnpm build`.

## Project structure

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Server-rendered page entry point |
| `app/layout.tsx` | Root layout, metadata, and local fonts |
| `components/yoga-grove.tsx` | Sections, content arrays, animation helpers, and dialogs |
| `components/ui/` | shadcn components built on Base UI |
| `components.json` | shadcn configuration and aliases |
| `app/globals.css` | Design tokens, layouts, spacing, and responsive styles |
| `app/fonts/` | Self-hosted Poppins fonts and their license |
| `public/images/` | Reference imagery served locally |
| `scripts/check-package-manager.mjs` | pnpm install guard |
| `AGENTS.md` | Repository guidance for coding agents |
| `CLAUDE.md` | Imports AGENTS.md to keep guidance in one place |

## Editing the site

Edit classes, plans, FAQs, teachers, and journal previews in `components/yoga-grove.tsx`. Update metadata in `app/layout.tsx` and visual tokens and section spacing in `app/globals.css`. Keep image descriptions meaningful and update asset paths when replacing images.

The page includes a hero entrance and parallax, scroll reveals, sticky stacking cards, hover effects, mobile navigation, FAQs, class selection, pricing enquiries, and journal previews. Motion and CSS respect reduced-motion preferences.

Check both desktop and mobile after layout changes, especially the testimonial-to-pricing transition and spacing around the closing banner. Run `pnpm lint` and `pnpm build` before submitting changes. There is currently no automated test suite; check affected interactions in the browser.

## Current scope

This is a single-page frontend recreation. About and journal content opens in dialogs. The schedule displays class frequencies rather than live availability. Booking and pricing actions open an enquiry dialog with email and telephone links; no reservations, payments, or submissions are stored.

Replace the reference studio contact details and connect a booking provider before accepting real bookings. The privacy link currently points to the reference website. Production hosting is not configured in this repository.

## Assets and attribution

Imagery and studio content come from the [reference site](https://yogagrove.framer.website/); journal preview text is sample content. Confirm appropriate permissions before reusing reference assets for another brand. Poppins is distributed under the [SIL Open Font License](app/fonts/OFL.txt) and is hosted locally, so builds do not need a Google Fonts connection.
