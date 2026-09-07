# Yogagrove

A responsive recreation of the Yogagrove Framer homepage using Next.js App Router, TypeScript, shadcn/ui (Base UI), Tailwind CSS, and Motion.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:3000. For production, run `npm run build` and `npm start`. Run `npm run lint` to check the source.

## Structure

- `app/page.tsx` — page entry point.
- `components/yoga-grove.tsx` — page sections, editable content arrays, animation helpers, and dialogs.
- `components/ui/` — shadcn primitives.
- `app/globals.css` — palette, layout, responsive breakpoints, and reduced-motion styles.
- `app/fonts/` — self-hosted Poppins fonts; no Google Fonts connection required at build time.
- `public/images/` — locally stored reference imagery.

## Interactions

Hero entrance and parallax, scroll reveals, sticky stacking method cards, hover effects, mobile navigation, FAQs, class selection, pricing enquiries, and short journal previews. Motion respects the visitor’s reduced-motion preference.

This is a single-page frontend recreation. About and journal content opens in dialogs. The schedule displays the reference class frequencies, not live availability. Booking and pricing actions open an enquiry dialog with email and telephone links; no reservations, payments, or submissions are stored. Replace the reference studio contact details and connect a booking provider when needed.

Reference: https://yogagrove.framer.website/. Imagery and studio content come from the reference; journal preview text is sample content. Fonts: Poppins, distributed under the SIL Open Font License (see `app/fonts/OFL.txt`).
