# „1. mandat od” column in the virtual okręg result table

Date: 2026-07-09
Status: approved

## Goal

In the virtual okręg view (BuilderView → ResultsPanel), add a column to the
single-method result table showing, for every committee, the minimum okręg
size (number of seats) at which that committee would win at least one seat —
votes and method unchanged.

## The metric

Both d'Hondt and Sainte-Laguë use 1 as the first divisor, so a committee's
first quotient is its full vote total. The committee wins its first seat
exactly when the okręg has at least R seats, where R is the rank of that
first quotient among **all** quotients of all committees, under the existing
allocation ordering (quotient descending, then total votes, then lower lista
number — see `cmp` in `src/engine/allocate.ts`).

R is computed in closed form, per rival committee `m` with votes `w` against
the subject committee with votes `v`:

- Strictly greater quotients: divisors `d` in the method's sequence with
  `w > v·d`, i.e. `d ≤ dmax` where `dmax = ⌈w/v⌉ − 1`.
  - d'Hondt (divisors 1,2,3,…): count = `dmax`.
  - Sainte-Laguë (divisors 1,3,5,…): count = `⌊(dmax+1)/2⌋`.
- Tie: if `v` divides `w` and `w/v` is in the divisor sequence, the quotients
  are equal; the rival wins the tie iff `w > v`, or `w = v` and the rival has
  the lower lista number (mirrors `cmp`).

`R = 1 + Σ counts`. Integer arithmetic only, no floats, no re-running
`allocate` in a loop.

Properties: the vote leader always shows 1; committees holding seats show a
value ≤ current mandaty; fringe committees may show very large values — shown
uncapped, formatted with `fmt`.

## Changes

### `src/engine/analytics.ts`
- `ListaAnalytics` gains `firstSeatAt: number` (required — defined for every
  lista with votes > 0, independent of `alloc.last`).
- Populated inside `analyze()` from `votes` + `method` alone.

### `src/engine/format.ts`
- Add `plMandat(n)` — Polish declension mandat/mandaty/mandatów, same logic
  as `plGlos`.

### `src/app/ResultsPanel.tsx` — `SingleTable` only
- New column after „Mandaty”: header **„1. mandat od”**, cell
  `{fmt(firstSeatAt)} {plMandat(firstSeatAt)}` in mono.
- Header `<th>` carries a native `title` tooltip (existing app pattern,
  cf. ObwodySelector.tsx) with class `th-hint`:

  > Najmniejsza liczba mandatów w okręgu, przy której komitet — przy
  > niezmienionych głosach i tej samej metodzie — zdobyłby swój pierwszy
  > mandat. Wartość 1 oznacza mandat nawet w okręgu jednomandatowym; im
  > wyższa liczba, tym dalej komitetowi do jakiegokolwiek mandatu.

- `CompareTable` unchanged.

### `src/styles.css`
- `.th-hint`: `cursor: help` + dotted underline as the hover-affordance cue.

## Testing (`src/engine/analytics.test.ts`, `format.test.ts`)
- Leader's `firstSeatAt` = 1.
- Seatless committee: value > current mandaty; allocating exactly that many
  seats gives it a seat, one fewer does not (cross-check against `allocate`).
- Exact-multiple tie cases (w = v·d), including equal votes with lista-number
  tie-break.
- d'Hondt vs Sainte-Laguë give different values where divisor sequences
  diverge.
- `plMandat`: 1/2/5/12/22 → mandat/mandaty/mandatów/mandatów/mandaty.

## Out of scope
- Compare table, GminaView/PickerView tables, any cap on large values.
