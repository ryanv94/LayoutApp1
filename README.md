# Layout

Arrange 6–10 photos into a balanced, print-ready composition and export it as PNG, JPEG or PDF. Everything runs in your browser; photos are never uploaded.

```bash
npm install
npm run dev          # http://localhost:4321
npm test             # Vitest unit tests
npm run build        # dist/
npm run test:e2e     # Playwright against the built site (run `npm run build` first)
npm run preview      # serve dist/ (add `--ignore-lock` if a stale lock exists)
```

Deployment: GitHub Actions builds, tests and deploys `dist/` to GitHub Pages on push to `main`. In the repo settings, **Pages → Source must be "GitHub Actions"**.

Design and plan: `docs/superpowers/specs/` and `docs/superpowers/plans/`. See `CLAUDE.md` for constraints.
