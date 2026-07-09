# „1. mandat od” Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a column to the virtual okręg single-method result table showing, per committee, the minimum okręg size (seat count) at which it would win its first seat.

**Architecture:** The metric is the rank of a committee's full vote total (its first quotient — divisor 1 in both methods) among all quotients of all committees, computed in closed form with integer arithmetic in `analyze()` (`src/engine/analytics.ts`). The UI is one new column in `SingleTable` (`src/app/ResultsPanel.tsx`) with a native `title` tooltip on the header. Spec: `docs/superpowers/specs/2026-07-09-first-seat-at-column-design.md`.

**Tech Stack:** TypeScript, Preact (note: `class=`, not `className=`), Vitest, pnpm.

## Global Constraints

- All UI copy is Polish; exact strings are given in the tasks — copy them verbatim.
- Engine code uses integer arithmetic only (cross-multiplication, `Math.floor` on integer operands) — no floating-point quotient comparison.
- Tie-breaking must mirror `cmp` in `src/engine/allocate.ts`: higher quotient, then more total votes, then lower lista number.
- Package manager is pnpm. Test with `pnpm test` (runs `vitest run`). Type-check + build with `pnpm build`.
- Compare table (`CompareTable`) and other views (GminaView, PickerView) are out of scope — do not touch them.

---

### Task 1: `plMandat` plural helper

**Files:**
- Modify: `src/engine/format.ts`
- Test: `src/engine/format.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `plMandat(n: number): string` exported from `src/engine/format.ts`, returning the Polish declension `mandat`/`mandaty`/`mandatów`. Task 3 imports it.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/format.test.ts` (and add `plMandat` to the import on line 2):

```ts
describe('plMandat', () => {
  it('handles Polish plural forms', () => {
    expect(plMandat(1)).toBe('mandat');
    expect(plMandat(2)).toBe('mandaty');
    expect(plMandat(4)).toBe('mandaty');
    expect(plMandat(5)).toBe('mandatów');
    expect(plMandat(12)).toBe('mandatów');
    expect(plMandat(14)).toBe('mandatów');
    expect(plMandat(22)).toBe('mandaty');
    expect(plMandat(112)).toBe('mandatów');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/engine/format.test.ts`
Expected: FAIL — `plMandat` is not exported / not defined.

- [ ] **Step 3: Implement via a shared declension helper**

In `src/engine/format.ts`, replace the existing `plGlos` function (lines 9–15) with:

```ts
const pl = (one: string, few: string, many: string) => (n: number): string => {
  const a = Math.abs(n) % 100;
  const b = Math.abs(n) % 10;
  if (n === 1) return one;
  if (b >= 2 && b <= 4 && (a < 12 || a > 14)) return few;
  return many;
};

export const plGlos = pl('głos', 'głosy', 'głosów');
export const plMandat = pl('mandat', 'mandaty', 'mandatów');
```

This is a refactor of `plGlos`, not a behavior change — its existing tests must still pass unmodified.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/engine/format.test.ts`
Expected: PASS, including all pre-existing `plGlos` cases.

- [ ] **Step 5: Commit**

```bash
git add src/engine/format.ts src/engine/format.test.ts
git commit -m "feat: plMandat plural helper via shared declension factory"
```

---

### Task 2: `firstSeatAt` in the analytics engine

**Files:**
- Modify: `src/engine/analytics.ts`
- Test: `src/engine/analytics.test.ts`

**Interfaces:**
- Consumes: `VotesMap`, `Method`, `allocate` from `src/engine/allocate.ts` (existing).
- Produces: `ListaAnalytics` gains a **required** field `firstSeatAt: number`, populated by `analyze()` for every lista it reports (all listy with votes > 0). Task 3 reads `info.perLista[l].firstSeatAt`.

**The math:** a committee with `v` votes wins its first seat exactly when the okręg has at least R seats, where R = 1 + (number of rival quotients strictly ahead of `v/1`, plus rival quotients tying it that win the tie-break). For a rival with `w` votes, divisors `d` with `w > v·d` are `d ≤ dmax` where `dmax = ⌊(w−1)/v⌋`. d'Hondt uses divisors 1,2,3,… (count = `dmax`); Sainte-Laguë uses 1,3,5,… (count = odd numbers ≤ dmax = `⌊(dmax+1)/2⌋`). If `v` divides `w` and `w/v` is in the divisor sequence, the quotients tie; the rival wins iff `w > v`, or `w = v` and the rival's lista number is lower.

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/analytics.test.ts`. Expected values are hand-derived from the Bolesławiec fixture at the top of the file (`votes = { '1': 621, '3': 168, '5': 997, '14': 580, '15': 303, '16': 783 }`); e.g. for L15 (303) under d'Hondt, exactly 8 quotients exceed 303 — 997/1, 783/1, 621/1, 580/1, 997/2 = 498.5, 783/2 = 391.5, 997/3 ≈ 332.3, 621/2 = 310.5 — so its first seat arrives in a 9-seat okręg.

```ts
describe('firstSeatAt — Bolesławiec okręg 1 (hand-derived quotient ranks)', () => {
  it("d'Hondt", () => {
    const { info } = run('dh');
    expect(info.perLista['5'].firstSeatAt).toBe(1);   // vote leader
    expect(info.perLista['16'].firstSeatAt).toBe(2);
    expect(info.perLista['1'].firstSeatAt).toBe(3);
    expect(info.perLista['14'].firstSeatAt).toBe(4);
    expect(info.perLista['15'].firstSeatAt).toBe(9);  // seatless: > 5 mandaty
    expect(info.perLista['3'].firstSeatAt).toBe(17);
  });

  it('Sainte-Laguë: sparser divisor sequence reaches small committees sooner', () => {
    const { info } = run('sl');
    expect(info.perLista['5'].firstSeatAt).toBe(1);
    expect(info.perLista['15'].firstSeatAt).toBe(6);  // 9 under d'Hondt
    expect(info.perLista['3'].firstSeatAt).toBe(11);  // 17 under d'Hondt
  });
});

describe('firstSeatAt — tie-breaks mirror the allocator', () => {
  const v = { '1': 100, '2': 50, '3': 50 };

  it("d'Hondt: exact multiple ties, more-votes then lower-lista wins", () => {
    const info = analyze(v, allocate(v, 4, 'dh'), 'dh');
    // 100/2 ties 50/1 and wins (more total votes); L2 beats L3 at equal votes.
    expect(info.perLista['1'].firstSeatAt).toBe(1);
    expect(info.perLista['2'].firstSeatAt).toBe(3);
    expect(info.perLista['3'].firstSeatAt).toBe(4);
  });

  it('Sainte-Laguë: even multiple is not in the divisor sequence, no tie', () => {
    const info = analyze(v, allocate(v, 4, 'sl'), 'sl');
    // Divisor 2 does not exist in 1,3,5,… so 100 has no quotient tying 50.
    expect(info.perLista['2'].firstSeatAt).toBe(2);
    expect(info.perLista['3'].firstSeatAt).toBe(3);
  });
});

describe('firstSeatAt — property checks (re-run the engine)', () => {
  const fixtures: Array<Record<string, number>> = [
    votes,
    { '1': 90, '2': 59, '3': 19 },
    { '1': 1000, '2': 999, '3': 998, '4': 3 },
    { '1': 50, '2': 50, '3': 49 },
  ];

  for (const method of ['dh', 'sl'] as const) {
    for (const v of fixtures) {
      const info = analyze(v, allocate(v, 5, method), method);
      for (const l of Object.keys(v)) {
        it(`${method} ${JSON.stringify(v)} lista ${l}: first seat appears exactly at firstSeatAt`, () => {
          const r = info.perLista[l].firstSeatAt;
          expect(allocate(v, r, method).seatsBy[l]).toBeGreaterThanOrEqual(1);
          if (r > 1) {
            expect(allocate(v, r - 1, method).seatsBy[l]).toBe(0);
          }
        });
      }
    }
  }
});
```

Also extend the existing `'single committee: …'` edge-case test with one line:

```ts
    expect(info.perLista['1'].firstSeatAt).toBe(1);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/engine/analytics.test.ts`
Expected: FAIL — `firstSeatAt` is `undefined` in every new assertion.

- [ ] **Step 3: Implement**

In `src/engine/analytics.ts`:

1. Add the required field to the interface:

```ts
export interface ListaAnalytics {
  firstSeatAt: number;
  missing?: number;
  margin?: number;
  marginOver?: string;
  surplus?: number;
}
```

2. Add the helper above `analyze` (not exported — tested through `analyze`):

```ts
// Minimum okręg size at which `lista` wins its first seat: the rank of its
// full vote total (first quotient, divisor 1) among all quotients, under the
// allocation ordering. Closed form per rival: divisors with a strictly higher
// quotient satisfy w > v·d, i.e. d ≤ ⌊(w−1)/v⌋; an exact multiple ties and
// the rival wins by cmp's total-votes/lista-number rules.
function firstSeatAt(votes: VotesMap, lista: string, method: Method): number {
  const v = votes[lista];
  let rank = 1;
  for (const m of Object.keys(votes)) {
    const w = votes[m];
    if (m === lista || w <= 0) continue;
    const dmax = Math.floor((w - 1) / v);
    rank += method === 'dh' ? dmax : Math.floor((dmax + 1) / 2);
    if (w % v === 0) {
      const d = w / v;
      const inSeq = method === 'dh' || d % 2 === 1;
      if (inSeq && (w > v || Number(m) < Number(lista))) rank++;
    }
  }
  return rank;
}
```

3. In `analyze()`, change the per-lista record initialization (currently `const rec: ListaAnalytics = {};`) to:

```ts
    const rec: ListaAnalytics = { firstSeatAt: firstSeatAt(votes, l, method) };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/engine/analytics.test.ts`
Expected: PASS — all new and pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/analytics.ts src/engine/analytics.test.ts
git commit -m "feat: firstSeatAt — minimum okręg size for a committee's first seat"
```

---

### Task 3: „1. mandat od” column with header tooltip

**Files:**
- Modify: `src/app/ResultsPanel.tsx` (`SingleTable` only)
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `info.perLista[l].firstSeatAt: number` (Task 2), `plMandat(n: number): string` and existing `fmt` from `src/engine/format.ts` (Task 1).
- Produces: UI only — nothing downstream.

There is no component test setup in this project; this task is verified by the full test suite, the type-checking build, and a browser check.

- [ ] **Step 1: Add the column**

In `src/app/ResultsPanel.tsx`:

1. Extend the format import (line 4):

```tsx
import { fmt, fmtPct, plGlos, plMandat } from '../engine/format';
```

2. Add the tooltip text as a module-level const next to `genitive`:

```tsx
const FIRST_SEAT_HINT =
  'Najmniejsza liczba mandatów w okręgu, przy której komitet — przy niezmienionych głosach ' +
  'i tej samej metodzie — zdobyłby swój pierwszy mandat. Wartość 1 oznacza mandat nawet ' +
  'w okręgu jednomandatowym; im wyższa liczba, tym dalej komitetowi do jakiegokolwiek mandatu.';
```

3. In `SingleTable`'s `<thead>`, insert a new header directly after `<th>Mandaty</th>`:

```tsx
            <th class="th-hint" title={FIRST_SEAT_HINT}>1. mandat od</th>
```

4. In the row renderer, change `const rec = info.perLista[l] ?? {};` to:

```tsx
            const rec = info.perLista[l];
```

(`analyze` populates `perLista` for exactly the listy in `alloc.listy`, which is what `sorted` iterates — and `firstSeatAt` is a required field, so the `?? {}` fallback no longer type-checks.)

5. Insert the new cell directly after the „Mandaty” `<td>` (the one containing the `dots` span):

```tsx
                <td class="r mono">{fmt(rec.firstSeatAt)} <span class="dim">{plMandat(rec.firstSeatAt)}</span></td>
```

- [ ] **Step 2: Add the hover-affordance style**

In `src/styles.css`, after the `.tbl th.c` rule (line 84):

```css
.tbl th.th-hint { cursor: help; text-decoration: underline dotted; text-underline-offset: 3px; }
```

- [ ] **Step 3: Run the full suite and the type-checking build**

Run: `pnpm test && pnpm build`
Expected: all tests PASS; `tsc --noEmit` and `vite build` succeed with no errors.

- [ ] **Step 4: Verify in the browser**

Invoke the project's `verify` skill (`/verify`) to build, serve, and drive the SPA headlessly. Confirm in the virtual okręg view with several obwody selected:
- the „1. mandat od” column appears after „Mandaty”,
- the vote leader shows `1 mandat`, seatless committees show values greater than the current mandaty count,
- the header carries the `title` tooltip text (inspect the `th[title]` attribute),
- compare mode (d'Hondt vs S-L side by side) is unchanged — no new column there.

- [ ] **Step 5: Commit**

```bash
git add src/app/ResultsPanel.tsx src/styles.css
git commit -m "feat: 1. mandat od column with explanatory header tooltip"
```
