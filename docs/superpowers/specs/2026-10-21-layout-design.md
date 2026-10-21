# Layout — design spec

Date: 2026-10-21

## Purpose
Layout is a client-side tool for photographers: upload 6–10 photos, get an aesthetically balanced, print-ready composition on a canvas of chosen physical size and DPI, preview it live, and export PNG / JPEG / PDF. Standalone Astro 7 project built to `CLAUDE.md` (Darkroom theme, dark only, metric — inches only for print sizes, browser-only, fixed `PRIVACY` copy in `src/data/tools.ts`).

## Requirements
- **Canvas size:** custom width/height in mm or in; presets: A0–A6, 4×6, 5×7, 8×10, 11×14, 12×16, 16×20, 20×24 in, 10×15, 13×18, 20×30 cm. Orientation flip (swap W/H).
- **DPI:** user-defined (presets 150/240/300/600 + custom). px = mm / 25.4 × DPI.
- **Input:** 6–10 images, mixed orientation/aspect/resolution. Other counts → inline `ErrorBox` (`showError`), no `alert()`. `validateFile` rejects HEIC.
- **Auto layout:** seeded recursive guillotine partition. Cells scored by crop loss (cell aspect vs. photo aspect); photos are cover-fitted (centre crop). Same seed + inputs → same layout.
- **Hero (optional):** at most one photo marked hero; it is pinned to a large, centred cell and the rest partition the surrounding region.
- **Extras:** margin (mm), gap (mm), background swatches (black, white, warm grey); Shuffle (new seed); drag a cell onto another to swap photos; orientation flip.
- **Preview:** live canvas at screen size from downscaled `createImageBitmap` bitmaps. Full-resolution decode only at export.
- **Export:** PNG (pHYs DPI chunk), JPEG (JFIF density), PDF (hand-written, exact physical page size, embeds JPEG). Large canvases rendered in horizontal bands to stay under browser canvas limits; if still impossible (iOS ≈16 MP cap), DPI is capped with an inline notice.
- **Non-negotiables:** no CDN/third-party processing; storage via `src/lib/storage.ts`; 360px with no horizontal scroll; every input labelled; focus ring `--accent`; motion inside `prefers-reduced-motion: no-preference`.

## Architecture
```
src/data/tools.ts            ToolMeta + PRIVACY
src/pages/index.astro        the Layout tool page
src/tools/layout/logic.ts    pure: units, presets, DPI→px, margin/gap geometry, seeded solver, hero placement
src/tools/layout/export.ts   banded rendering; PNG/JPEG/PDF encoders; DPI metadata
src/tools/layout/ui.ts       DOM wiring: DropZone, controls, preview, hero toggle, drag-swap, shuffle, flip, export
src/lib/                     image, format, download, storage, url-state, errors
tests/unit, tests/e2e
.github/workflows/deploy.yml PR: unit+build+e2e; main: + deploy to Pages
```
Settings (units, size, DPI, margin, gap, background) persist via `storage.ts` and are shareable via `url-state`.

## Solver
Input: list of `{aspect}`, canvas inner rect (after margin), gap, seed, optional hero index. Recursively split the rect (horizontal/vertical, split ratio proportional to subtree "area weights"), enumerating tree shapes with seeded tie-breaking, minimising Σ crop loss. Hero: reserve a central rect sized to the hero's aspect (~40–55% of area), partition the four surrounding bands among the remaining photos. Output: array of `{index, x, y, w, h}` in canvas units.

## Error handling
Wrong file count, non-image/HEIC, decode failure, export failure/too-large → inline `ErrorBox`. Export buttons disabled until 6–10 photos are loaded.

## Testing
- Vitest: unit conversion, presets, DPI px, geometry (no overlaps, full coverage within tolerance, margins/gaps honoured), determinism per seed, hero centred and largest, PNG/JPEG/PDF byte-level writers (headers, DPI fields, page size).
- Playwright: upload 6–10, count validation, hero, shuffle, drag-swap, flip, export downloads, 360px layout test. Wait for loaded-state signal (thumbnails) before interacting.

## Out of scope
Per-photo manual crop/zoom, text/captions, multiple pages, HEIC decoding.
