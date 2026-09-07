<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project overview

This repository is a Next.js App Router frontend for Collective by Soul, currently recreating the Yogagrove reference. Keep the implementation simple: reusable components, content arrays, and focused CSS. There is no database, authentication, checkout, or booking backend.

## Package manager

- Use pnpm only. The exact version is pinned in `package.json` under `packageManager`.
- Install with `pnpm install --frozen-lockfile` for existing dependencies. Use `pnpm add` or `pnpm add -D` for intentional dependency changes.
- Commit `package.json` and `pnpm-lock.yaml` together when dependencies change. Do not create `package-lock.json` or `yarn.lock`.
- Use `pnpm exec` for installed tools, including `pnpm exec shadcn`. Use `pnpm dlx` only when an uninstalled tool is necessary.
- Do not bypass the package-manager guard or change dependency versions as an incidental part of unrelated work.

## Code and design conventions

- Read the relevant bundled Next.js documentation before changing framework code, as required above.
- Keep `app/page.tsx` and `app/layout.tsx` as Server Components. Interactive state and Motion belong in client components.
- Page content and interactions currently live in `components/yoga-grove.tsx`; styling lives in `app/globals.css`.
- Reuse the existing shadcn components in `components/ui/`. This project uses Base UI, so check its APIs instead of assuming Radix `asChild` patterns.
- Use `next/image` with descriptive alt text and responsive sizes. Keep Poppins self-hosted through `next/font/local`.
- Preserve the warm cream and forest-green palette, readable contrast, responsive layout, and reduced-motion behavior.
- Review adjacent section padding together to avoid doubled whitespace. Keep deliberate breathing room around the closing banner.
- Keep navigation, keyboard focus, dialog titles, and FAQ interactions accessible.
- Keep demo limitations explicit. Do not imply a booking is confirmed when only an email enquiry is available.

## Validation

- Run `pnpm lint` and `pnpm build` for code or dependency changes.
- For visual changes, inspect affected sections on desktop (around 1252px wide) and mobile (around 390px wide). Check overflow, spacing, image loading, and text wrapping.
- For interaction changes, verify the affected menu, dialog, FAQ, or link in the browser and check keyboard operation.
- There is no test runner configured. Do not claim automated tests passed; report the checks actually performed. Add tests when meaningful behavior warrants them.
- Keep documentation aligned with actual scripts, features, and limitations.

## Working in this repository

- Inspect the working tree before editing and preserve unrelated user changes.
- Keep changes focused; avoid unnecessary dependencies or abstractions.
- Never commit credentials, environment files, generated build output, or `node_modules`.
- Preserve the generated Next.js instruction block above. `CLAUDE.md` imports this file; maintain shared guidance here rather than duplicating it.
