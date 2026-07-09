---
name: verify
description: Build, serve, and drive the wyboryzator SPA end-to-end in headless Chrome to verify changes at the browser surface.
---

# Verifying wyboryzator

Static Preact SPA; all state lives in the URL hash, so most flows are drivable via deep links.

## Build & serve

```bash
pnpm build                        # prebuild generates public/data/index.json, tsc + vite
pnpm exec vite preview --port 4173 &   # serves at http://localhost:4173/ (base is './', path-agnostic)
```

## Drive (headless Chrome via playwright-core)

No browsers need downloading: `npm i playwright-core` in a scratch dir, then
`chromium.launch({ channel: 'chrome' })` uses the system Chrome.

Key facts:

- **Deep links must be full page loads.** The app reads the hash only on mount
  (no `hashchange` listener). In Playwright, hop through `about:blank` before
  each `page.goto(BASE + '#…')`, otherwise only a hashchange fires and nothing
  happens.
- URL scheme: `#g=<teryt>&v=gmina|builder&o=1.2.3&m=<mandaty>&met=sl&cmp=1`.
- A 404 console error for `<TERYT>.config.json` is expected (optional presets file).
- Useful selectors: `.pick-search`, `.pick-row`, `.stats-strip .stat-val`,
  `.params-stats .stat-val`, `.mandaty-input`, `.method-btn.sl`,
  `.compare-toggle input`, `.results-tbl tbody tr`, `.badge`, `.summary-card`,
  `.no-effect`, `.div-details summary`, `.cell-last`, `.diff-pill`, `.obwod-row input`.

## Hand-verified fixture (m. Bolesławiec, TERYT 020101)

Gmina stats: 4 okręgi / 21 mandatów / 28 861 wyborców / 24 obwody.
`#g=020101&v=builder&o=1.2.3.4.5&m=5` reproduces okręg 1 exactly (d'Hondt):

- KO 997 głosów → 2 mandaty, przewaga 214 nad FORUM, nadwyżka 214
- FORUM 783 → 1, brakło 215, nadwyżka 450; PiS 621 → 1, brakło 376, nadwyżka 229
- IMPULS 580 → 1, brakło 418, nadwyżka 188; ZIEMI 303 → 0, brakło 196 (badge "najbliżej mandatu"); TD 168 → 0, brakło 331
- zmarnowane 471 (13,6%), nadwyżkowe 1081 (31,3%), bez wpływu 1552 z 3452 (45,0%)
- Divisor table: last seat = 498,5 (KO ÷2)

Methods diverge at `…&o=1.2.3.4.5&m=6&cmp=1`: FORUM +1 d'H, ZIEMI +1 S-L
(two `.diff-pill`s, two `tr.differs`, no identical-note).

## Gotchas

- pl-PL formatting groups only ≥ 10 000 (CLDR minimumGroupingDigits=2): "3452", not "3 452".
- Test output in this environment is rtk-proxied and compressed to `PASS (n) FAIL (m)`.
