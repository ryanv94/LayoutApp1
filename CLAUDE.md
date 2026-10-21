## Non-negotiable constraints

- **Everything runs in the visitor's browser.** No servers, no uploads, no third-party processing or APIs at runtime. Libraries, fonts, logos and data are bundled at build time — never load from a CDN or hotlink images.
- **Privacy copy is fixed** (in `src/data/tools.ts` as `PRIVACY`): "Your photos are processed entirely on your device and are never uploaded. We use anonymous analytics to improve the site." Never claim "zero third-party".
- **Dark theme only. Metric only** (print sizes are the exception: inch standards alongside ISO A-sizes; DPI is per inch).
- No `alert()`/`confirm()`; errors are inline (`ErrorBox` + `showError`). Every `localStorage` access goes through `src/lib/storage.ts`.
- Ask the owner when a requirement is unclear rather than guessing. The owner is token-conscious: don't offer the browser "visual companion"; describe options in text.

## Stack and commands

Astro 7 (static) · TypeScript strict · hand-written CSS (no Tailwind) · Vitest · Playwright · Node ≥ 22.22.

```bash
npm install
npm run dev          # http://localhost:4321 (no service worker in dev)
npm test             # Vitest unit tests (tests/unit)
npm run build        # dist/ (+ Workbox service worker via integrations/service-worker.mjs)
npm run test:e2e     # Playwright against the built site (run `npm run build` first)
npm run preview      # serve dist/ (Astro 7: add `--ignore-lock` if a stale lock exists)
```

- Playwright starts `astro preview --ignore-lock` on port 4321 and reuses a running one locally. With `CI=true` it refuses an occupied port — stop any preview first.
- Claude's shell has **no GitHub credentials and no `gh`**: the owner pushes (`! git push -u origin <branch>`) and opens PRs. Work on a branch, never commit straight to `main`.

## Layout

```
src/
  layouts/Base.astro          <head> (fonts, manifest, New Relic), nav, footer, global scripts
  layouts/newrelic.html       New Relic snippet, verbatim
  data/tools.ts               ToolMeta list (slug, frame "01".."09", name, short nav label, blurb) + PRIVACY
  components/                 SiteNav, SiteFooter, ToolHeader, ToolFrame, ToolIcon, FilmStrip, ApertureMark,
                              DropZone, Slider, NumberField, Select, Segmented, Readout, Button, ErrorBox, Modal
  pages/<slug>.astro          one page per tool + index.astro (contact sheet)
  tools/<tool>/logic.ts       pure maths/geometry, no DOM — unit-tested
  tools/<tool>/ui.ts          DOM wiring, imported by the page via <script>import '../tools/<tool>/ui';</script>
  lib/                        shared: image, format, stops, download, storage, url-state, toast, errors,
                              cropper, slider-fill, pwa
  styles/tokens.css           design tokens   base.css: reset/layout/grain/.develop   controls.css: form controls,
                              buttons, segmented, readouts, error box, toasts, modal, stage, crop dialog
integrations/service-worker.mjs   workbox-build generateSW after build (+ public/sw-cleanup.js removes legacy cache)
public/                       CNAME, robots.txt, manifest.webmanifest, icons/, logos/, data/cities.json
scripts/                      dev-time generators (fixtures, logos, cities, icons) — outputs are committed
tests/unit, tests/e2e         e2e specs import { test, expect, fixture, PAGES } from './fixtures'
docs/superpowers/             original design spec and implementation plan (historical reference)
```


## Design system — "Darkroom"

- Tokens (`src/styles/tokens.css`): `--bg #12100E`, `--surface #1C1916`, `--surface-2 #26221E`, `--line #3A342D`, `--text #EDE6DA`, `--text-dim #A39A8C`, `--accent #E5352B` (safelight red — the **only** interactive accent), `--amber #F2B544` (results/readouts), `--ok #8FBF6A`. Per-tool colours are deliberately not used.
- Fonts: **Fraunces** (display, big numerals; variable `opsz`/`SOFT` axes) and **IBM Plex Mono** (UI/data), self-hosted via fontsource.
- Motifs: film grain overlay, red safelight glow at the top, film-edge strips (`FilmStrip`, edge codes like `▸ 07A`), the contact-sheet home page with a grease-pencil hover mark, and the staggered `.develop` load reveal. All motion sits inside `prefers-reduced-motion: no-preference`.
- Utilities: `.panel`, `.panel-title`, `.panel-grid`, `.row`, `.stack`, `.label`, `.readout`, `.readout-card`, `.hint`, `.stage`, `.stage-empty`, `.btn` / `.btn-primary` / `.btn-ghost` / `.btn-block`, `.check`, `.visually-hidden`.
- Must work at 360px wide with no horizontal scroll (a layout test enforces this). Every input has a label; focus ring uses `--accent`.

## Gotchas already hit (don't rediscover them)

- **Astro scoped styles don't reach DOM created at runtime** — style injected elements with `:global(...)`.
- `[hidden]` is forced to `display: none !important` in `base.css`, because `.row` / grid display overrode it.
- **Astro drops CSS imported dynamically from client scripts** — import library CSS statically in page frontmatter.
- Cropper.js owns the class `.cropper-modal`; our dialog is `.crop-dialog`.
- **suncalc 2.x**: named exports only (`import * as SunCalc`), and `getPosition().altitude` is in **degrees**. The Golden Hour timeline samples real time from local midnight to the next local midnight and maps it to wall-clock minutes, so DST days are correct.
- Golden Hour time zones: a city's own IANA zone; for GPS or coordinates, the zone of the nearest city in `cities.json`. Format with `Intl.DateTimeFormat({ timeZone })`.
- `@vite-pwa/astro` doesn't support Astro 7, hence the local Workbox integration.
- New Relic's loader fails its SRI check against the test stub; `tests/e2e/fixtures.ts` filters New Relic console noise. Keep that filter narrow.
- **E2E race**: after dropping an image in Resize, the thumbnail strip appears and shifts the controls down about 60px. Wait for `#thumbs li` (or another loaded-state signal) before clicking controls. The same applies to any tool whose layout changes after decode.
- `validateFile` rejects HEIC everywhere (the iOS picker already converts to JPEG for `accept="image/*"`).

## Deployment

- `.github/workflows/deploy.yml`: on PR → unit tests, build, e2e. On push to `main` → the same, then deploy to Pages.
- The repo's **Settings → Pages → Source must be "GitHub Actions"**. With "Deploy from a branch", GitHub runs a Jekyll build of the raw source and fails. The custom domain lives in the Pages settings; `public/CNAME` also ships with the build.
- Workflow actions currently run on deprecated Node 20 runtimes (a warning, not a failure); bump the action major versions when convenient.


## Frontend aesthetics directive (owner's)

DISTILLED_AESTHETICS_PROMPT = """
<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight. Focus on:

Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.

Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.

Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.

Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!
</frontend_aesthetics>
"""

For this site the directive is already realised as "Darkroom": extend that system for new tools rather than inventing a new look per tool.
