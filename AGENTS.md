<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project overview

This repository is a Next.js App Router frontend for Collective by Soul, presenting One Day on an Island in the original Yogagrove-inspired layout. Keep the implementation simple: reusable components, content arrays, and focused CSS. Applications are submitted through a server route to Google Forms. The `/misafir` guest portal, the `/yonetim` management console and the `/yonetim/adisyon` Adisyon (bar/pizza tab) module (bar/pizza roles, `db/tab.sql`) use server-side PostgreSQL access; there is no checkout or payment integration. The unlinked `/menu` bar menu opens only through the QR link `/m/<MENU_ACCESS_KEY>` (404 otherwise) and reads prices from the Adisyon menu; never link to it or commit the key or QR image. The static `public/index.html` homepage was removed; do not reintroduce static HTML pages or rewrites.

## Package manager

- Use pnpm only. The exact version is pinned in `package.json` under `packageManager`.
- Install with `pnpm install --frozen-lockfile` for existing dependencies. Use `pnpm add` or `pnpm add -D` for intentional dependency changes.
- Commit `package.json` and `pnpm-lock.yaml` together when dependencies change. Do not create `package-lock.json` or `yarn.lock`.
- Use `pnpm exec` for installed tools, including `pnpm exec shadcn`. Use `pnpm dlx` only when an uninstalled tool is necessary.
- Do not bypass the package-manager guard or change dependency versions as an incidental part of unrelated work.

## Code and design conventions

- Read the relevant bundled Next.js documentation before changing framework code, as required above.
- Keep `app/page.tsx` and `app/layout.tsx` as Server Components. Interactive state and Motion belong in client components.
- Page sections and interactions live in `components/yoga-grove.tsx`; bilingual copy and workshop data live in `components/event-content.ts`; styling lives in `app/globals.css`.
- Reuse the existing shadcn components in `components/ui/`. This project uses Base UI, so check its APIs instead of assuming Radix `asChild` patterns.
- Use `next/image` with descriptive alt text and responsive sizes. Keep Poppins self-hosted through `next/font/local`.
- Preserve the warm cream and forest-green palette, readable contrast, responsive layout, and reduced-motion behavior.
- Review adjacent section padding together to avoid doubled whitespace. Keep deliberate breathing room around the closing banner.
- Keep navigation, keyboard focus, dialog titles, and FAQ interactions accessible.
- Keep application limitations explicit. Google Forms receipt does not confirm a booking. Keep field mappings and confirmation text in `lib/google-form.ts` synchronized with the published form.

## Validation

- Run `pnpm lint` and `pnpm build` for code or dependency changes.
- For visual changes, inspect affected sections on desktop (around 1252px wide) and mobile (around 390px wide). Check overflow, spacing, image loading, and text wrapping.
- For interaction changes, verify the affected menu, dialog, FAQ, or link in the browser and check keyboard operation.
- Run the focused Node tests with `node --experimental-strip-types --test tests/google-form.test.mjs` (Node.js 22.6+). Report the checks actually performed; use clearly labeled synthetic data for live submission checks.
- Keep documentation aligned with actual scripts, features, and limitations.

## Working in this repository

- Inspect the working tree before editing and preserve unrelated user changes.
- Keep changes focused; avoid unnecessary dependencies or abstractions.
- Never commit credentials, environment files, generated build output, or `node_modules`.
- Preserve the generated Next.js instruction block above. `CLAUDE.md` imports this file; maintain shared guidance here rather than duplicating it.
