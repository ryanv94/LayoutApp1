# Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Layout, a browser-only Astro site that auto-arranges 6–10 photos into a balanced, print-ready composition at a chosen physical size and DPI, with live preview and PNG/JPEG/PDF export.

**Architecture:** A pure, unit-tested `logic.ts` (units, geometry, seeded guillotine-partition solver with hero support) feeds a canvas preview in `ui.ts`. `export.ts` re-renders the same cells at full resolution in horizontal bands and encodes PNG/JPEG (with DPI metadata) and PDF with hand-written writers. Visual system is CLAUDE.md's "Darkroom".

**Tech Stack:** Astro 7 (static), TypeScript strict, hand-written CSS, Vitest, Playwright, fontsource (Fraunces, IBM Plex Mono), GitHub Actions → Pages. Node ≥ 22.22.

**Spec:** `docs/superpowers/specs/2026-10-21-layout-design.md` (also read `CLAUDE.md`).

## Global Constraints

- Everything runs in the browser: no servers, uploads, CDNs or hotlinked assets; fonts/libraries bundled at build time. Canvas 2D only; no image-processing libraries.
- `PRIVACY` in `src/data/tools.ts` is exactly: "Your photos are processed entirely on your device and are never uploaded. We use anonymous analytics to improve the site." Never claim "zero third-party".
- Dark theme only. Metric only, except print sizes (inch standards alongside ISO A-sizes) and DPI (per inch).
- No `alert()`/`confirm()`; errors inline via `ErrorBox` + `showError`. All `localStorage` access via `src/lib/storage.ts`.
- 360px wide, no horizontal scroll; every input labelled; focus ring uses `--accent`; all motion inside `prefers-reduced-motion: no-preference`.
- Tokens: `--bg #12100E`, `--surface #1C1916`, `--surface-2 #26221E`, `--line #3A342D`, `--text #EDE6DA`, `--text-dim #A39A8C`, `--accent #E5352B` (only interactive accent), `--amber #F2B544`, `--ok #8FBF6A`.
- Work on branch `feat/layout-tool`; never commit to `main`. Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No GitHub credentials: the owner pushes.
- Photo count must be 6–10; `validateFile` rejects HEIC.
- Astro scoped styles don't reach runtime DOM (use `:global(...)`); `[hidden]` is `display:none !important`; import library CSS statically in page frontmatter.

## Review Focus

1. Panorama (10:1) and tall (1:10) photos mixed with squares — cells must stay within a sane crop-loss bound, never zero/negative size.
2. EXIF-rotated phone photos — preview and export must use the displayed orientation (`imageOrientation: 'from-image'`).
3. Margin + gap too large for the canvas (or tiny custom canvas) — clamp, never produce NaN/negative cells.
4. Exactly 5 or 11 files, or a mix of valid and invalid files — inline error, previous valid state kept.
5. Unit switch mm↔in and orientation flip keep the same physical size (no rounding drift); export at huge size/DPI hits the cap path, not a crash.

---

### Task 1: Scaffold project, tokens, shell

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore`, `src/data/tools.ts`, `src/layouts/Base.astro`, `src/pages/index.astro`, `src/styles/{tokens,base,controls}.css`, `src/lib/{storage,errors}.ts`, `tests/unit/storage.test.ts`, `tests/e2e/fixtures.ts`, `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Produces: `PRIVACY: string` and `TOOL: ToolMeta` in `src/data/tools.ts`; `storage.get<T>(key: string, fallback: T): T`, `storage.set(key: string, value: unknown): void` (try/catch around every `localStorage` access); `showError(box: HTMLElement, message: string): void`, `clearError(box: HTMLElement): void`; e2e `fixtures.ts` exporting `{ test, expect, fixture }` where `fixture(name)` resolves `tests/fixtures/<name>`.

- [ ] **Step 1: Write failing test** `tests/unit/storage.test.ts`: `storage.get('k', 5)` returns `5` when empty; after `storage.set('k', 7)` returns `7`; when `localStorage.getItem` throws, returns fallback without throwing.
- [ ] **Step 2: Run** `npx vitest run` → FAIL (module missing).
- [ ] **Step 3: Scaffold** `npm init`, install `astro@7 typescript vitest @playwright/test @fontsource-variable/fraunces @fontsource/ibm-plex-mono`; set `"engines": {"node": ">=22.22"}`, scripts `dev|build|preview|test|test:e2e` as in CLAUDE.md; strict tsconfig extending `astro/tsconfigs/strict`. Write the three CSS files with the Darkroom tokens, grain overlay, top safelight glow, `.panel/.row/.stack/.label/.readout/.hint/.btn*` utilities, focus ring, `[hidden]` rule. `Base.astro` imports fonts and CSS, renders header (ApertureMark-style SVG + "Layout"), `<slot/>`, and a footer showing `PRIVACY`. Implement `storage.ts` and `errors.ts` to pass the test.
- [ ] **Step 4: Playwright smoke** `smoke.spec.ts`: page loads, title contains "Layout", footer text equals `PRIVACY`, `document.documentElement.scrollWidth <= innerWidth` at 360×800.
- [ ] **Step 5: Run** `npx vitest run` (PASS), `npm run build`, `npx playwright install chromium`, `npm run test:e2e` (PASS).
- [ ] **Step 6: Commit** `chore: scaffold Astro project with Darkroom shell`.

### Task 2: Units, presets, DPI (logic)

**Files:** Create `src/tools/layout/logic.ts`, `tests/unit/units.test.ts`

**Interfaces:**
- Produces: `type Unit = 'mm' | 'in'`; `interface Preset { id: string; label: string; wMm: number; hMm: number; group: 'ISO' | 'Inch' | 'Metric' }`; `PRESETS: Preset[]` (A0–A6 in ISO; 4×6, 5×7, 8×10, 11×14, 12×16, 16×20, 20×24 in; 10×15, 13×18, 20×30 cm); `toMm(v: number, u: Unit): number`; `fromMm(mm: number, u: Unit): number`; `mmToPx(mm: number, dpi: number): number` (rounded); `flip(size: {wMm:number;hMm:number}): {wMm:number;hMm:number}`.

- [ ] **Step 1: Failing tests:** `toMm(1,'in') === 25.4`; A4 preset is `210×297`; `mmToPx(297, 300) === 3508`; `mmToPx(420, 300) === 4961`; `fromMm(toMm(8,'in'),'in')` is within 1e-9 of 8; `flip` swaps and is its own inverse; `PRESETS` has 7 inch entries with 8×10 = 203.2×254.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(logic): units, presets and DPI conversion`.

### Task 3: Inner rect and margin/gap clamping (logic)

**Files:** Modify `logic.ts`; Create `tests/unit/geometry.test.ts`

**Interfaces:**
- Produces: `interface Rect { x: number; y: number; w: number; h: number }`; `innerRect(wMm: number, hMm: number, marginMm: number): Rect` (margin clamped to at most 45% of the shorter side, min 0); `clampGap(inner: Rect, gapMm: number, count: number): number` (gap never exceeds 10% of the shorter inner side divided by the grid cut count; never negative/NaN).

- [ ] **Step 1: Failing tests:** margin 10 on 210×297 → `{x:10,y:10,w:190,h:277}`; margin 500 on 100×100 clamps so `w>0`; `NaN`/negative margin → 0; `clampGap` of huge gap on a tiny rect returns a value < shorter side/10; gap 0 → 0.
- [ ] **Step 2–4:** Run FAIL → implement → PASS. **Step 5: Commit** `feat(logic): inner rect and gap clamping`.

### Task 4: Seeded guillotine solver (no hero)

**Files:** Modify `logic.ts`; Create `tests/unit/solver.test.ts`

**Interfaces:**
- Consumes: `Rect`, `clampGap`.
- Produces: `interface Cell extends Rect { photo: number }`; `solveLayout(aspects: number[], inner: Rect, gap: number, seed: number): Cell[]` where `aspects[i] = width/height` of photo `i`; `cropLoss(cellAspect: number, photoAspect: number): number` (fraction of the photo discarded by cover-fit, 0–1); `mulberry32(seed: number): () => number`.

- [ ] **Step 1: Failing tests** (use a fixed mixed set: `[1.5, 0.667, 1, 1.5, 0.75, 1.33, 0.8, 1.78]`, inner `{0,0,297,420}`, gap 4):
  - returns one cell per photo, each `photo` index exactly once;
  - no two cells overlap (tolerance 1e-6) and every cell lies within `inner`;
  - covered area ≥ 85% of `inner` area minus gaps' share;
  - `solveLayout(...)` twice with the same seed deep-equals; seeds 1 and 2 differ;
  - average `cropLoss` < 0.35 for the mixed set;
  - extreme set `[10, 0.1, 1, 1, 1, 1]` still yields all cells with `w>0 && h>0`;
  - `cropLoss(1.5, 1.5) === 0`; `cropLoss(1, 2)` is `0.5`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** the algorithm: build candidate split trees recursively over photo subsets (ordered by seeded shuffle); at each node choose H/V cut and a ratio proportional to the sum of "ideal area" of each side (ideal area = photo area share); score = Σ `cropLoss` + small penalty for cells with aspect outside 1:3–3:1; keep the best of N seeded randomised tries (N≈200, cap by time budget 50 ms for the preview). Gaps are subtracted at each cut.
- [ ] **Step 4:** Run → PASS. **Step 5: Commit** `feat(logic): seeded guillotine layout solver`.

### Task 5: Hero placement

**Files:** Modify `logic.ts`, `tests/unit/solver.test.ts`

**Interfaces:**
- Consumes: `solveLayout`, `Cell`.
- Produces: `solveWithHero(aspects: number[], hero: number, inner: Rect, gap: number, seed: number): Cell[]`.

- [ ] **Step 1: Failing tests** (same mixed set, `hero = 2`): the hero cell has the largest area; its centre is within 10% of the inner rect's centre on both axes; no overlaps, all photos once, deterministic per seed; with 6 photos and with 10 photos both succeed; hero cropLoss < 0.1.
- [ ] **Step 2:** Run → FAIL. **Step 3: Implement:** reserve a centred rect with the hero's aspect covering 40–55% of inner area (fit within the inner rect); partition the four surrounding bands (top, bottom, left, right) among the rest by assigning photos proportionally to band area, then reuse `solveLayout` per band. **Step 4:** PASS. **Step 5: Commit** `feat(logic): hero placement`.

### Task 6: Assignment helpers (shuffle seed, swap)

**Files:** Modify `logic.ts`; Create `tests/unit/assign.test.ts`

**Interfaces:**
- Produces: `swapPhotos(cells: Cell[], a: number, b: number): Cell[]` (swap the `photo` field of cells at indices `a` and `b`, returns new array, geometry untouched); `nextSeed(seed: number): number`; `cellAt(cells: Cell[], x: number, y: number): number` (index or -1).

- [ ] **Step 1: Failing tests:** swap exchanges `photo` values only and leaves other cells unchanged; swapping the same index is a no-op; `cellAt` finds the right cell and returns `-1` in a gap/margin; `nextSeed` is deterministic and ≠ input.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(logic): swap and hit-test helpers`.

### Task 7: Image loading and cover-fit math

**Files:** Create `src/lib/image.ts`, `tests/unit/image.test.ts`

**Interfaces:**
- Produces: `validateFile(file: File): string | null` (error message or null; rejects non-image and HEIC/HEIF by type or extension); `validateCount(n: number): string | null` (message unless 6 ≤ n ≤ 10); `interface Photo { id: string; name: string; file: File; w: number; h: number; preview: ImageBitmap }`; `loadPhoto(file: File, previewMax: number): Promise<Photo>` (uses `createImageBitmap(file, { imageOrientation: 'from-image' })`, then a downscaled copy `resizeWidth/resizeHeight` so the longest side ≤ `previewMax`; `w`,`h` are the oriented full-size dimensions); `coverSource(srcW: number, srcH: number, cellW: number, cellH: number): { sx: number; sy: number; sw: number; sh: number }` (centred crop).

- [ ] **Step 1: Failing tests:** `validateFile` rejects a `.heic` file and `text/plain`, accepts `image/jpeg`; `validateCount(5)`/`(11)` return messages, `(6)`/`(10)` return `null`; `coverSource(4000,3000,100,100)` → `{sx:500,sy:0,sw:3000,sh:3000}`; `coverSource(3000,4000,200,100)` → full width, height 1500 centred (`sy:1250`).
- [ ] **Step 2–4:** FAIL → implement → PASS (`loadPhoto` is covered by e2e). **Step 5: Commit** `feat(lib): image validation, loading and cover-fit`.

### Task 8: Page, components and controls markup

**Files:** Create `src/components/{DropZone,Slider,NumberField,Select,Segmented,Readout,Button,ErrorBox,ToolHeader}.astro`, update `src/pages/index.astro`, `src/styles/controls.css`

**Interfaces:**
- Produces DOM ids used by `ui.ts`: `#drop` (DropZone, `accept="image/*" multiple`), `#error` (ErrorBox), `#unit` (Segmented mm/in), `#preset` (Select grouped by `PRESETS.group`, plus "Custom"), `#w`, `#h` (NumberField), `#flip` (Button), `#dpi-preset` (Select 150/240/300/600/Custom), `#dpi` (NumberField), `#margin`, `#gap` (Slider, mm), `#bg` (Segmented swatches: black `#0B0A09`, white `#F5F1EA`, warm grey `#8A8176`), `#shuffle`, `#thumbs` (`ul`, one `li` per photo with a hero toggle `button[aria-pressed]` and remove button), `#stage` (preview `canvas`), `#readout` (output px and file-size estimate, amber), `#export-png`, `#export-jpg`, `#export-pdf`.

- [ ] **Step 1:** Build the components with labels and `.panel` grid; two-column on desktop (controls left, stage right), single column at 360px. Style `.stage` with a paper-on-darkroom-table look (drop shadow), staggered `.develop` reveal, and film-edge `FilmStrip` for the thumbnail strip.
- [ ] **Step 2:** Add an e2e test `layout-shell.spec.ts` asserting every id above exists, every input has an accessible label, export buttons are disabled initially, no horizontal scroll at 360px.
- [ ] **Step 3:** Run `npm run build && npm run test:e2e` → PASS. **Step 4: Commit** `feat(ui): layout page shell and controls`.

### Task 9: Wire state, preview, upload, hero, shuffle, flip

**Files:** Create `src/tools/layout/ui.ts`, `src/lib/url-state.ts`, `tests/unit/url-state.test.ts`, `tests/fixtures/*` (generate 10 tiny JPEGs with mixed orientations via a `scripts/make-fixtures.mjs` using Playwright/canvas-free PNG encoding), `tests/e2e/layout.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–7.
- Produces: `encodeState(s: SettingsState): string` / `decodeState(q: string): Partial<SettingsState>` where `interface SettingsState { unit: Unit; wMm: number; hMm: number; dpi: number; marginMm: number; gapMm: number; bg: string }`; `ui.ts` renders the preview with `render()` whenever state, photos, hero or seed changes (debounced by `requestAnimationFrame`).

- [ ] **Step 1: Failing unit test** for `encodeState`/`decodeState` round-trip and for garbage input returning `{}`.
- [ ] **Step 2: Implement** url-state; persist settings via `storage` and `history.replaceState`.
- [ ] **Step 3: Implement `ui.ts`:** file add via drop/pick/paste (up to 10 total; excess → inline error via `validateCount`/`validateFile`, valid state retained); `loadPhoto(file, 1600)`; solver call picks `solveWithHero` when a hero is set; preview canvas sized to container × `devicePixelRatio`, drawing `bg` then each cell with `coverSource`; selecting a preset sets `w/h` (respecting current unit display); typing a size sets preset to Custom; unit switch converts displayed values only (state stays in mm); `#flip` swaps; hero toggle is single-select (toggling the same one clears); Shuffle → `nextSeed`; export buttons enabled only when 6–10 photos; `#readout` shows px dimensions and megapixels.
- [ ] **Step 4: Write e2e** (`layout.spec.ts`): drop 8 fixtures → `#thumbs li` count 8 (wait for it before clicking); 5 fixtures → `#error` visible; set hero → hero cell centred (read cells via `window.__layoutCells` exposed only when `location.search` has `debug`); shuffle changes `__layoutCells`; flip swaps `#w`/`#h` values; preset A4 → `#w=210 #h=297`.
- [ ] **Step 5:** `npm test && npm run build && npm run test:e2e` → PASS. **Step 6: Commit** `feat(ui): upload, preview, hero, shuffle and flip`.

### Task 10: Drag-to-swap in the preview

**Files:** Modify `ui.ts`, `tests/e2e/layout.spec.ts`

- [ ] **Step 1: Failing e2e:** with 8 photos loaded, pointer-drag from cell A's centre to cell B's centre swaps their `photo` values in `__layoutCells` and nothing else; dropping onto a gap/margin changes nothing; works with touch via Pointer Events (`touch-action: none` on canvas).
- [ ] **Step 2: Implement** with Pointer Events: `cellAt` on pointerdown, ghost thumbnail follows pointer, highlight target cell with `--accent` outline, `swapPhotos` on pointerup. Keyboard alternative: focusing a thumbnail and pressing arrow keys reorders (swap with neighbour).
- [ ] **Step 3:** Run e2e → PASS. **Step 4: Commit** `feat(ui): drag-to-swap`.

### Task 11: Encoders — PNG/JPEG DPI metadata and PDF writer

**Files:** Create `src/tools/layout/encode.ts`, `tests/unit/encode.test.ts`

**Interfaces:**
- Produces: `setPngDpi(png: Uint8Array, dpi: number): Uint8Array` (inserts/replaces a `pHYs` chunk before the first `IDAT`, px/metre = round(dpi/0.0254), unit byte 1, valid CRC32); `setJpegDpi(jpg: Uint8Array, dpi: number): Uint8Array` (patches JFIF APP0 units=1 and X/Y density, or inserts a JFIF APP0 after SOI if absent); `buildPdf(jpg: Uint8Array, pxW: number, pxH: number, wMm: number, hMm: number): Uint8Array` (single page, MediaBox in points = mm/25.4×72 to 2 decimals, `/DCTDecode` image stream, valid xref table and offsets); `crc32(bytes: Uint8Array): number`.

- [ ] **Step 1: Failing tests:** `crc32(ascii 'IEND')` equals `0xAE426082`; given a minimal 1×1 PNG fixture, output contains `pHYs` before `IDAT`, with value `11811` for 300 DPI and passes a CRC check on every chunk; existing `pHYs` is replaced, not duplicated; given a minimal JPEG with JFIF, bytes at units/density offsets read `1, 300, 300`; JPEG without JFIF gains one and still starts `FFD8` and ends `FFD9`; `buildPdf` output starts with `%PDF-1.4`, contains `/MediaBox [0 0 595.28 841.89]` for A4, `/Filter /DCTDecode`, `%%EOF`, and the `startxref` offset points at the `xref` keyword; every xref entry offset points at its `N 0 obj`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(export): PNG/JPEG DPI metadata and PDF writer`.

### Task 12: Full-resolution banded rendering and export wiring

**Files:** Create `src/tools/layout/export.ts`, `src/lib/download.ts`, `tests/unit/export-plan.test.ts`; Modify `ui.ts`, `tests/e2e/layout.spec.ts`

**Interfaces:**
- Consumes: encoders, `coverSource`, `Cell`, `mmToPx`.
- Produces: `planExport(wMm: number, hMm: number, dpi: number, maxArea: number, maxSide: number): { pxW: number; pxH: number; dpi: number; capped: boolean }` (reduces DPI proportionally so `pxW*pxH ≤ maxArea` and each side ≤ `maxSide`; `capped` true when reduced; defaults `maxArea = 268_000_000`, `maxSide = 16384`, iOS `16_000_000`); `renderBanded(photos: Photo[], cells: Cell[], plan, bg: string, bandPx: number): Promise<Blob>` for JPEG/PNG output (draws bands into a reusable canvas and stitches by encoding the final canvas when it fits, else falls back to a smaller capped DPI and notifies); `download(blob: Blob, filename: string): void`.

- [ ] **Step 1: Failing unit tests for `planExport`:** A4@300 uncapped (3508×2480 swapped per orientation, `capped=false`); A0@600 under default caps → `capped=true`, `pxW*pxH ≤ 268e6`, aspect preserved within 1px; `maxArea 16e6` on A2@300 → capped to ≈ 16 MP; zero/NaN dimensions throw `RangeError`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Wire export** buttons: reload full-resolution bitmaps one at a time (`createImageBitmap(file,{imageOrientation:'from-image'})`, `close()` after drawing) to bound memory; scale cell rects from mm to px; fill bg; `drawImage` with `coverSource`; encode with `toBlob` (`image/png`, `image/jpeg` quality 0.92); apply `setPngDpi`/`setJpegDpi` with the plan's DPI; PDF uses JPEG bytes + `buildPdf`; filename `layout-<w>x<h>mm-<dpi>dpi.<ext>`; on `capped` show an inline notice (not an error) stating the effective DPI; failures → `showError`; disable buttons while exporting with a progress readout.
- [ ] **Step 6: e2e:** with 8 fixtures, clicking each export button triggers a download; the PNG's bytes contain `pHYs`; the PDF download starts with `%PDF`; A6 at 72 DPI completes fast.
- [ ] **Step 7:** Run all tests → PASS. **Step 8: Commit** `feat(export): banded full-resolution export`.

### Task 13: Layout test at 360px, accessibility pass, polish

**Files:** Modify CSS and components as needed; Create `tests/e2e/layout-360.spec.ts`

- [ ] **Step 1: e2e:** at 360×800 with 8 photos loaded and after an export notice appears, `scrollWidth ≤ innerWidth`; every `input/select` has an associated label; hero toggle buttons have `aria-pressed`; focus ring visible (`outline-color` is `--accent`).
- [ ] **Step 2:** Fix any failures; verify `prefers-reduced-motion: reduce` disables `.develop` animation.
- [ ] **Step 3:** Run e2e → PASS. **Step 4: Commit** `fix(ui): 360px and accessibility pass`.

### Task 14: CI/CD workflow and docs

**Files:** Create `.github/workflows/deploy.yml`, `public/robots.txt`, `README.md`

- [ ] **Step 1:** Workflow: on `pull_request` run `npm ci`, `npm test`, `npm run build`, `npx playwright install --with-deps chromium`, `CI=true npm run test:e2e`; on `push` to `main` run the same, then upload `dist/` with `actions/upload-pages-artifact` and deploy with `actions/deploy-pages` (permissions `pages: write`, `id-token: write`). Pin latest action majors.
- [ ] **Step 2:** `README.md` documenting the commands from CLAUDE.md and the note that Pages Source must be "GitHub Actions".
- [ ] **Step 3:** Verify locally: `npm test && npm run build && npm run test:e2e` all pass.
- [ ] **Step 4: Commit** `ci: add Pages deploy workflow and README`. Tell the owner to push the branch (`! git push -u origin feat/layout-tool`) and open the PR.

## Notes

- Service worker/PWA and New Relic from CLAUDE.md belong to the multi-tool site and are deliberately out of scope for this standalone project (spec lists no offline requirement); add later if merged into the main site.
- Analytics is mentioned by the fixed privacy copy but no snippet is supplied; ask the owner for the snippet before adding any.
