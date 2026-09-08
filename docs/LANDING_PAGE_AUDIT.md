# One Day on an Island — landing page audit

Reviewed: 8 September 2026
Page reviewed: `public/index.html` at 1252 px desktop and 390 px mobile
Event shown on the page: 19 September 2026, Villa Büyükada

## Short verdict

The page already has a distinctive visual world. The warm palette, editorial type, real venue photography and restrained UI feel much stronger than a conventional event template. The hero is the best part: it establishes place, scale and mood quickly.

The problem is not mainly the art direction. It is the path through the page. The experience is described several times in increasingly abstract language, the longest visual sections arrive before the buying decision, and the application copy creates distance at exactly the point where the visitor needs reassurance. The launch blockers are functional rather than aesthetic: the form is not connected, the logo asset is missing, the reveal implementation can hide most of the page, and several accessibility issues affect the form and workshop modal.

## What to keep

- Keep the cream, ink, clay and forest palette. It feels grown-up and recognisable.
- Keep Fraunces for display copy and Inter for practical information. The contrast between editorial and functional text suits the event.
- Keep the contained hero rather than making it full-bleed. It makes the event feel intimate rather than mass-market.
- Keep the specific visual details: the private pier, long table, pool, garden and boat. They sell the day better than claims such as “unique” or “unforgettable.”
- Keep the workshop cards and the dark music block. They give the page useful changes of pace.
- Keep the bilingual switch, but make the entire interface bilingual rather than only the visible copy.

## Fix before sharing the link

### 1. Make the event page the single source of truth

The event page does load at `/`: the static `public/index.html` file currently takes precedence. However, the repository still contains an unrelated Yogagrove page in `app/page.tsx`, Yogagrove metadata in `app/layout.tsx`, and Yogagrove documentation. This creates two competing homepages and makes a future migration or file move risky.

Choose one implementation. Prefer moving the event experience into the Next.js route, then remove the dormant demo and update the metadata and README. If the static file is intentionally the production page for now, document that choice and remove or quarantine the demo so it cannot reappear unexpectedly.

### 2. Connect the application form

The form action is still `FORM_ENDPOINT`; submitting it opens a developer-facing alert. This must be connected and tested end to end. The success state should say when the guest will hear back and what happens next. The failure state should offer the email address as a fallback.

### 3. Add the missing brand asset

`assets/mark.png` is referenced as the favicon, navigation mark and footer mark, but the file does not exist. The browser currently hides the two broken visible images, leaving only the wordmark, and the favicon request fails.

### 4. Do not hide the page when JavaScript or motion fails

All major blocks start with `.rev { opacity: 0 }` and only become visible after an IntersectionObserver runs. In a full-page capture, nearly the entire page is blank because those blocks have not entered the viewport. Make content visible by default and apply reveal styles only after JavaScript adds an enhancement class. Add a `prefers-reduced-motion` rule that removes transitions and transforms.

### 5. Make the form and modal accessible

- Form labels are visually present but are not associated with their inputs. Add matching `for` and `id` values.
- The workshop overlay has no `dialog` role, no `aria-modal`, no labelled title relationship, no focus trap and no focus return.
- The close button has no accessible label.
- The lightbox has an empty alt and no visible close control.
- Add clear `:focus-visible` styles to buttons, links, cards, form controls and FAQ summaries.
- Add a skip link and wrap the page content in `<main>`.

## Improve before ticket release

### 6. Make anchor navigation land cleanly

On desktop, anchored sections can begin behind the sticky navigation; the gallery heading was visibly cut off during review. Add `scroll-margin-top` to every target section.

On mobile, all section links disappear and only the language control plus “Başvur” remain. Either add a compact menu or a small “Keşfet” control so a returning visitor can jump directly to tickets, schedule or FAQ.

### 7. Shorten the mobile journey

The page is 18,918 px tall at 390 px wide. The biggest contributors are:

| Section | Mobile height |
| --- | ---: |
| Workshops | 3,103 px |
| Venue and boat gallery | 3,474 px |
| Day flow | 2,193 px |
| Hosts | 1,938 px |
| Tickets | 1,461 px |

The gallery is the clearest cut. Show four strong venue images and one boat image in an editorial grid, then open the rest in a lightbox or “See all photos” gallery. The current nine-plus-two stack costs more than four mobile screens without adding equivalent confidence.

For workshop cards on mobile, keep the image, title, host and one-line promise; move time, capacity and full copy into the detail view. For hosts, use landscape or square portraits on mobile instead of three 4:5 portraits stacked vertically.

### 8. Reorder the story around the decision

Recommended order:

1. Hero: what, where, when, capacity, primary action.
2. “How the day works”: participation explained in plain language.
3. Place: short description plus a compact proof gallery.
4. Day flow: boat, afternoon, table/night.
5. Workshops and the people leading them.
6. Music schedule.
7. Tickets: explain the one meaningful difference first.
8. Why there is an application, followed immediately by the form.
9. Practical FAQ.
10. Closing invitation and contact.

This avoids asking people to cross the full gallery and host section before they can compare tickets.

### 9. Present one ticket clearly

The site now offers one ticket only: The Crossing Pass. Keep the price off the landing page, make the private outbound and return boat explicit, and show every inclusion once in the same card. Name the food partner and serving format in plain language. Avoid generic urgency language.

### 10. Explain the application without making people audition

“Referansın varsa, adını söyle” makes the event sound invitation-only, while the site also allows people without a connection to apply. That ambiguity can feel cliquish. If a reference is genuinely optional, say so directly.

Recommended framing: the application is not a status test; it helps a small team plan a fifty-person house, workshop capacities and who is arriving together. If applications are actually curated, publish the criteria and expected response time. Do not borrow “radical inclusion” language unless the process reflects it.

### 11. Reduce image weight and layout shift

The 27 JPEGs in `public/assets` total about 17 MB, are loaded eagerly and do not declare intrinsic dimensions. Add responsive image sizes, modern formats, explicit width/height and lazy loading below the fold. Prioritise only the hero. The workshop card and gallery thumbnails do not need to download 1 MB portrait originals.

### 12. Finish the bilingual experience

The TR/EN switch works and the main copy changes correctly, but several elements do not:

- `aria-label="Language selection"` stays English in Turkish.
- Image alt text stays Turkish in English.
- The visible `Instagram` label is not in the translation map.
- Modal accessibility text is missing entirely.
- Metadata and social preview values do not change by language on a static client-side toggle.

If organic search in both languages matters, use separate `/tr` and `/en` routes with their own metadata rather than a client-only switch.

## Content diagnosis

The current copy feels generated because it frequently uses the same sentence architecture: a short atmospheric claim, followed by a three-part list and a soft abstraction. Examples include “başka bir ritim,” “günün parçası,” “kendi rotanı kur” and “yanında bir hikâye götür.” None is wrong alone; together they make every section sound equally important and equally polished.

The rewrite should follow four rules:

- Prefer evidence over adjectives: boat times, fifty seats, a private pier, one quiet hour, a perfume guests take home.
- Let sentences vary. Some can be blunt, some sensory, some practical.
- Speak as hosts (“gidiyoruz,” “masayı kuruyoruz”) rather than as a lifestyle brand describing an audience.
- Reserve mystery for the Fortune Dome. Be precise everywhere else.

## What the benchmark sites teach us

This event is not presented as an official Burning Man regional, so the language should not imply an affiliation. The useful lesson is the relationship with the guest:

- [Burning Man’s principles](https://burningman.org/about-us/10-principles/) emphasise participation, immediacy and communal effort.
- [Midburn](https://www.midburn.org/en/onmidburn) makes the distinction especially clear: there are no spectators; everyone participates.
- [AfrikaBurn](https://www.afrikaburn.org/) uses energetic, direct language and tells people that the more they do, the more they get from the gathering.
- [Wonderfruit’s manifesto](https://www.wonderfruit.co/manifesto) connects music, food, art and place through specific modes of participation instead of selling a generic “festival vibe.”
- [Garbicz’s join page](https://garbiczfestival.com/join) is warm and brief, although its “magic/tapestry” phrasing is exactly the sort of abstraction this site should use sparingly.

The right voice for One Day on an Island is smaller, closer and more concrete: “we are taking one boat to one house; here is what we will make together.”

## Questions to settle before final implementation

1. Is the application an open capacity check, or is the guest list curated? What would cause an application to be declined?
2. What exactly do the Bite Foods refreshments include?
3. Are all workshop materials included, and can one person realistically attend every timed workshop?
4. Are the house rules and cancellation terms already written and linkable?
5. Is `Chapter II` real and announced? If not, remove the dead footer link.
6. Should the venue’s exact address remain private until approval? If so, say that explicitly in the FAQ.
