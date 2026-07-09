# Wyboryzator — implementation design

PKW 2024 virtual-okręg recount app. This spec covers the implementation of the
app described in `DESIGN_PROMPT.md`, whose visual design and interaction model
are fully specified by the working prototype in
`PKW_2024_wirtualne_okręgi/Wirtualne okręgi.dc.html`. Where this spec is
silent, the mockup is the source of truth for layout, labels, colors, and
behavior. All UI text is Polish, copied verbatim from the mockup.

## Stack

- Vite + Preact + TypeScript, pnpm.
- Vitest for unit tests.
- No state library, no router library, no runtime YAML parser. One CSS
  stylesheet (class-based), styles lifted from the mockup's inline styles.
- Fully static; deployed to GitHub Pages.

## Repo layout

```
scripts/build-index.mjs     teryt_mappings.yml → public/data/index.json (prebuild step)
public/data/                320 gmina JSONs + teryt_mappings.yml (MOVED from results/)
                            + optional <TERYT>.config.json preset files
src/
  engine/
    allocate.ts             d'Hondt / Sainte-Laguë quotient allocation
    analytics.ts            brakujące / przewaga / nadwyżkowe / zmarnowane
    derive.ts               gmina JSON → derived model
    format.ts               fmt / fmtPct / plGlos Polish formatters
    *.test.ts
  state/
    url.ts                  app state ↔ location.hash codec + sanitization
  app/                      Preact components
docs/superpowers/specs/     this document
PKW_2024_wirtualne_okręgi/  design reference only; excluded from build
```

`results/` is moved (not copied) to `public/data/` — the data's only consumer
is this app, and duplicating 132 MB in git serves nobody. Vite serves
`public/` in dev and copies it into `dist/` at build. No single file exceeds
GitHub's 100 MB limit (largest is Kraków at ≈ 7.2 MB; several are 2–4 MB — the plain "Wczytywanie…" indicator was judged sufficient even for these, since Pages serves them gzipped at roughly 1 MB).

## URL scheme

Exactly the mockup's: `URLSearchParams` serialized into the hash.

```
#g=020101&v=builder&o=1.2.3&m=5&met=sl&cmp=1
```

- `g` — TERYT; `v` — view (`picker` | `gmina` | `builder`)
- `o` — selected obwód numbers, dot-joined (obwód numbers are unique
  gmina-wide)
- `m` — mandaty override (absent = smart default)
- `met=sl` — Sainte-Laguë (absent = d'Hondt); `cmp=1` — compare mode

Hash is rewritten via `history.replaceState` on every state change. Parsing
sanitizes everything: unknown obwód numbers dropped, `m` clamped to 1–60,
unrecognized `met`/`v` fall back to defaults. A mangled shared link always
yields a working view.

## State & data flow

One state atom at the app root via plain Preact hooks:

```ts
{ view, teryt, sel: Set<string>, mandatyOverride: number | null,
  method: 'dh' | 'sl', compare: boolean }
```

All derived data (`obwodByNr`, committee vote sums, allocations, analytics)
computed with `useMemo`. The recount is arithmetic over ≤10 lists × ≤60
seats; recomputing per render is microseconds. No signals, no store.

Data loading:

- `index.json` (~15 KB, `{ teryt, name, wojewodztwo }[]`) fetched once at
  startup.
- Gmina JSON + optional `<TERYT>.config.json` fetched on selection, cached in
  memory keyed by TERYT.

## Components

1:1 translation of the mockup; no invented components.

```
App                      state atom, hash sync, fetching, view routing
├─ Header                breadcrumb (Gminy / {gmina} / Okręg wirtualny)
├─ PickerView            search + gmina list from index.json, no-results state
├─ GminaView             stats strip + OkregCard per okręg
│  └─ OkregCard          committee table (d'Hondt), obwody table, granice <details>
├─ BuilderView
│  ├─ ObwodySelector     checkbox grid grouped by real okręg, select-all per
│  │                     okręg, preset chips, "wyczyść zaznaczenie"
│  ├─ EmptyState         dashed box when nothing selected
│  ├─ ParamsPanel        selection stats, mandaty input + formula + reset,
│  │                     method toggle (d'Hondt crimson #9E1B32 /
│  │                     S-L blue #1D5C87), compare checkbox
│  ├─ ResultsPanel       banner tinted by method (black in compare mode)
│  │  ├─ SingleTable     votes, %, seats+dots, brakło/przewaga, nadwyżkowe
│  │  ├─ CompareTable    d'H vs S-L seats + różnica pills, "identical" note
│  │  ├─ SummaryCards    zmarnowane / nadwyżkowe cards (×2 in compare mode)
│  │  ├─ NoEffectBar     black "głosy bez wpływu na wynik" strip
│  │  └─ DivisorTable    <details>, quotient grid, winner + last-seat highlight
│  └─ RealComparison     virtual seats vs aggregated real seats of touched okręgi
└─ Footer                PKW attribution + disclaimer
```

Shared: `KomitetChip` (color dot; hue table keyed by lista number, as in the
mockup), formatters from `engine/format.ts` (space thousands separator, comma
decimal, `plGlos` plural rules).

Presets: if `public/data/<TERYT>.config.json` exists with
`{ presety: [{ nazwa, opis, obwody }] }`, render toggle chips above the
selector (mockup behavior: clicking adds/removes that obwód set and clears
the mandaty override).

## Recount engine

Pure TypeScript, zero Preact imports. Ported from the mockup's reference
implementation with three deliberate changes.

### allocate(votes: Map<lista, number>, seats: number, method): Allocation

Generate `seats` quotients per committee with positive votes (divisors
1,2,3,… for d'Hondt; 1,3,5,… for Sainte-Laguë), take the top `seats`.
Returns per-committee seat counts, the ordered winning quotients, the last
(lowest) winning quotient, and the losing quotients.

1. **Integer arithmetic only.** Quotients are never divided; comparisons use
   cross-multiplication (`v₁·d₂ > v₂·d₁`). Votes ≤ ~10⁵, divisors ≤ 119, so
   products stay far below `Number.MAX_SAFE_INTEGER`. (The divisor table
   displays `v/d` rounded to 1 decimal for humans; display-only.)
2. **Deterministic tie-break, documented in the UI:** equal quotients → more
   total votes → lower lista number. The statute resolves the final tie by
   drawing lots; the lista-number substitute is disclosed in the divisor-table
   legend.

### analytics(allocation, method): per-committee record

- **Brakujące głosy** (committees not holding the last seat): smallest
  integer Δ such that `(v+Δ)/dNext` strictly exceeds the last winning
  quotient, computed in integers as `⌊lastV·dNext/lastD⌋ + 1 − v`, minimum 1.
  `dNext` = the committee's next unused divisor. The committee with the
  smallest Δ gets the "najbliżej mandatu" badge and row highlight.
- **Przewaga** (the committee holding the last seat): votes it could lose
  before the best losing quotient **of another committee** overtakes its last
  seat; shown as "przewaga N głosów nad: {komitet}". **Fixes a mockup bug:**
  the mockup compares against the best losing quotient overall, which can be
  the committee's own next quotient — a committee cannot take a seat from
  itself.
- **Głosy nadwyżkowe** (every seat winner): votes it could lose without
  losing its lowest-won seat to the best losing quotient of another
  committee: `v − (⌊vOther·dLast/dOther⌋ + 1)`, floor 0, where `dLast` =
  divisor of its last won seat and `vOther/dOther` = the best losing
  quotient of another committee. For the committee holding the last seat
  this coincides with its przewaga — that is correct, not a bug: its
  lowest-won seat is the contested one.
- **Głosy zmarnowane:** sum of votes of zero-seat committees, with the list
  of affected committees.
- **Bez wpływu na wynik:** zmarnowane + nadwyżkowe, as count and % of valid
  votes.

All analytics recomputed on method switch; in compare mode, computed for both
methods (summary cards ×2, no-effect bar shows both).

### derive.ts

Parses a gmina JSON once into a typed model: `obwodByNr` (nr → okręg,
wyborcy, per-lista vote sums), gmina-wide `komitetName` map (lista →
komitet), totals (wyborcy, mandaty, obwód count), and per-okręg real d'Hondt
allocations (used by GminaView and RealComparison — the real-world baseline
is always d'Hondt).

Mandaty default: `max(1, round(gminaMandaty × selWyborcy / gminaWyborcy))`,
clamped 1–60, with the formula rendered as in the mockup.

### Edge cases

- Zero valid votes in selection → results panel shows a "brak głosów
  ważnych" notice instead of tables.
- Single committee with votes → no losing quotients: no brakujące/przewaga
  values (render "—"), surplus = votes above the minimum to win its seats.
- Fewer positive-vote committees than would fill seats: each committee still
  generates `seats` quotients, so all seats are always assigned when any
  votes exist.
- Selection spanning okręgi with disjoint committees: vote map is the union;
  committees absent from some obwody simply sum over fewer obwody.

## Error handling

- `index.json` fetch fails → full-page error + retry button.
- Gmina JSON fails or TERYT unknown → picker view with inline notice
  ("Nie udało się wczytać danych gminy"). Stale shared links degrade here.
- `<TERYT>.config.json` 404 → no preset chips, silent (it's optional).
- Loading state: inline "Wczytywanie…" placeholder (files are ~300 KB; no
  skeleton screens).

## Testing

Vitest, engine and codec only (components are thin views over tested logic):

- Textbook d'Hondt vs Sainte-Laguë fixtures where the methods differ.
- Real-data fixtures: vote maps from several actual okręgi hardcoded into
  test files, asserted against PKW-published seat counts (no I/O in tests).
- Property checks that re-run the engine: adding exactly `missing` votes
  gains the seat, `missing − 1` does not; removing `surplus` votes keeps all
  seats, `surplus + 1` loses one; seat counts always sum to `mandaty` when
  any votes exist.
- Tie-break tests: equal quotients resolved by votes, then lista number.
- URL codec: `state → hash → state` round-trip identity; sanitization of
  garbage input.

## Deployment

GitHub Actions on push to `main`: `pnpm install` → `pnpm test` →
`pnpm build` (prebuild runs `scripts/build-index.mjs`) → deploy `dist/` to
GitHub Pages. Vite `base: '/wyboryzator/'` (adjust to the repo's final name).
Failing tests block deployment.

## Out of scope

- Candidate-level recounts (data supports committee-level only across
  arbitrary obwód sets — see DESIGN_PROMPT.md).
- Electoral threshold (none in these elections).
- Server-side anything.
