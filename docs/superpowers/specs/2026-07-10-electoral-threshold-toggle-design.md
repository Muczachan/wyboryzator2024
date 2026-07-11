# 5% electoral threshold toggle (próg wyborczy)

Date: 2026-07-10
Status: approved

## Goal

Model the statutory 5% threshold (art. 416 Kodeksu wyborczego: in gminas
above 20k inhabitants, only committees with at least 5% of valid votes in
the whole gmina participate in seat division) in the virtual okręg builder,
behind a toggle. ON by default — the app models the real rules out of the
box; turning it OFF is the hypothetical no-threshold variant that was the
app's only behavior until now.

## The rule

- A committee qualifies iff `20 × votesGmina[l] ≥ glosyGmina` — integer
  arithmetic, no floats; the boundary case of exactly 5.000% **qualifies**
  („co najmniej 5%").
- The base is **gmina-wide** valid votes (all okręgi, all obwody),
  independent of the current obwody selection — per user decision, matching
  the statute. A committee strong in the selection but below 5% gmina-wide
  is excluded, exactly as in the real election.
- The threshold is method-independent: the same qualified set applies to
  d'Hondt, Sainte-Laguë, and compare mode.

## Changes

### `src/engine/derive.ts`
- `GminaModel` gains `votesGmina: VotesMap` (per-lista sum over all okręgi)
  and `glosyGmina: number` (sum of all valid votes). Computed in
  `deriveGmina` from the per-okręg `votes` maps it already builds.
- New exported helper:
  `overProg = (m: GminaModel, lista: string): boolean =>
   20 * (m.votesGmina[lista] ?? 0) >= m.glosyGmina`
  (returns false when `glosyGmina` is 0 only in the degenerate empty-gmina
  case, where nothing renders anyway — `0 >= 0` is fine to leave as true;
  no special-casing).
- `allocate`, `analyze`, `firstSeatAt` are untouched — the threshold is a
  pre-filter, mirroring the statute (excluded lists never enter division).

### `src/state/url.ts`
- `AppState.prog: boolean`, default `true`.
- Hash: parameter emitted only when OFF (`prog=0`); `parseHash` treats
  anything except literal `'0'` (including absence) as ON. Existing shared
  links therefore silently gain statutory behavior (user-accepted).

### `src/app/BuilderView.tsx`
- Computes `qualified: Set<string>` from the model (memoized per model) and
  `votesForAlloc`: when `state.prog`, the selection votes map restricted to
  qualified listy; otherwise the full selection votes map.
- `allocate`/`analyze` (both methods) run on `votesForAlloc`. The full
  selection votes map continues to feed the table rows and percentages.
- Passes to `ResultsPanel`: the full `votes`, `votesForAlloc`'s allocations/
  analytics as today, plus `prog: boolean` and the model (already passed)
  for gmina-share display.

### `src/app/ResultsPanel.tsx`
- Table rows are sourced from the **full** selection votes map (every
  committee with votes > 0 in the selection, sorted by votes desc) — no
  longer from `alloc.listy`, which is now the filtered set.
- Excluded committees (prog ON, not qualified): 0 seats rendered dim, „—"
  in „1. mandat od" and surplus columns, and in the gap column:
  „poniżej progu — x,x% głosów w gminie" (share =
  `100 × votesGmina[l] / glosyGmina`, formatted with `fmtPct`).
- „% ważnych" column keeps showing the committee's share of selection
  votes, for all rows, as today.
- Summaries: excluded committees' selection votes are added to „Głosy
  zmarnowane" (sum and the by-name note), in both single and compare mode.
  Surplus and „bez wpływu" then follow arithmetically.
- Banner subtitle: „próg 5% w skali gminy (ustawowy)" when ON,
  „bez progu wyborczego (wariant hipotetyczny)" when OFF.
- Edge case: selection has valid votes but no qualified committee →
  explanatory message („Żaden komitet z głosami w zaznaczonych obwodach nie
  przekracza progu 5% w skali gminy — przy włączonym progu nie ma czego
  przeliczać.") instead of the results table; the existing zero-votes
  message stays as-is.
- Compare mode: same row-sourcing and exclusion treatment; the diff column
  is „=" for excluded rows (both methods give 0).

### `src/app/ParamsPanel.tsx`
- Third `params-block` titled „Próg wyborczy" with a checkbox in the
  existing `compare-toggle` idiom:
  label „Próg 5% w skali gminy (ustawowy)", checked = `state.prog`,
  toggling patches `{ prog: !state.prog }`.
- One-line note under it (`formula`-style dim text): „wyłączenie progu to
  wariant hipotetyczny — w wyborach komitety poniżej 5% nie uczestniczą w
  podziale mandatów".

### `src/app/DivisorTable.tsx`
- Excluded committees are omitted from the divisor table entirely — it
  explains how seats were divided, and excluded lists never entered the
  division; rendering their quotients as "losing" cells would be
  misleading. When prog is ON and at least one committee in the selection
  is excluded, the legend gains one sentence: „Komitety poniżej progu nie
  uczestniczą w podziale mandatów i nie są ujęte w tej tabeli."
- Implementation-wise the table keeps iterating the rows it is given; the
  parent passes the filtered row list (excluded rows removed) plus an
  `anyExcluded` flag for the legend sentence.

### Untouched
- `GminaView` (real-results view; its no-threshold `realSeats` is a
  pre-existing trait out of scope here) and preset configs.

## Testing

- `derive.test.ts`: `votesGmina`/`glosyGmina` totals on the existing
  fixture; `overProg` boundary — exactly 5.000% qualifies (e.g. 50 of
  1000), one vote fewer does not; missing lista → false.
- `url.test.ts`: default `prog: true`; `prog=0` parses OFF; round-trip both
  ways; absence of param when ON.
- Engine-level integration test: fixture where filtering flips seat counts
  vs unfiltered allocation (assert both allocations differ as hand-derived).
- Existing 126 tests stay green (`analyze`/`allocate` signatures unchanged;
  ResultsPanel row-sourcing change is behavior-compatible when prog OFF
  because every lista with selection votes qualified implicitly before).
- Browser pass (verify skill): toggle visible and ON by default; Bolesławiec
  fixture unchanged with prog ON iff all fixture committees ≥5% gmina-wide
  (check; if some are below, assert new expected values); toggling OFF
  reproduces pre-feature results exactly; URL round-trip with `prog=0`;
  excluded-row rendering and banner copy in a gmina that has a sub-5%
  committee (Wrocław has several).

## Out of scope

Threshold in `GminaView`/`realSeats`; per-selection threshold variant;
coalition thresholds (8% for koalicje does not apply to rady gmin lists
here — single 5% rule only).
