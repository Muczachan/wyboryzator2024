# 5% Electoral Threshold Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Model the statutory 5% gmina-wide electoral threshold in the virtual okręg builder behind a toggle (ON by default): committees below 5% of gmina-wide valid votes are excluded from seat division but stay visible in results as „poniżej progu".

**Architecture:** The threshold is a pre-filter, mirroring the statute: `GminaModel` gains gmina-wide vote totals and an `overProg` helper (`src/engine/derive.ts`); `BuilderView` filters the selection votes map before the untouched `allocate`/`analyze`; `ResultsPanel` sources rows from the unfiltered map and renders excluded committees distinctly; state flows through a new `prog` field in `AppState` (`prog=0` in the hash only when OFF). Spec: `docs/superpowers/specs/2026-07-10-electoral-threshold-toggle-design.md`.

**Tech Stack:** TypeScript, Preact (`class=`, not `className=`), Vitest, pnpm.

## Global Constraints

- Threshold rule (exact): qualifies iff `20 * (votesGmina[lista] ?? 0) >= glosyGmina` — integer arithmetic; exactly 5.000% qualifies.
- Base is gmina-wide (all okręgi), independent of the obwody selection; same qualified set for both methods and compare mode.
- `allocate`, `analyze`, `firstSeatAt` signatures and bodies unchanged.
- URL: `prog` param emitted only when OFF (`prog=0`); anything except literal `'0'` (including absence) parses as ON.
- Polish copy, verbatim:
  - Banner ON: `próg 5% w skali gminy (ustawowy)` · Banner OFF: `bez progu wyborczego (wariant hipotetyczny)`
  - Excluded row gap cell: `poniżej progu — <fmtPct> głosów w gminie`
  - All-excluded message: `Żaden komitet z głosami w zaznaczonych obwodach nie przekracza progu 5% w skali gminy — przy włączonym progu nie ma czego przeliczać.`
  - Toggle label: `Próg 5% w skali gminy (ustawowy)`; block title: `Próg wyborczy`; note: `wyłączenie progu to wariant hipotetyczny — w wyborach komitety poniżej 5% nie uczestniczą w podziale mandatów`
  - Divisor-table legend addition: `Komitety poniżej progu nie uczestniczą w podziale mandatów i nie są ujęte w tej tabeli.`
- `GminaView` and preset configs untouched. Existing suite is 126 tests; all must stay green.
- Package manager pnpm; tests via `pnpm test`; type-check + build via `pnpm build`.

---

### Task 1: Threshold facts in the model + `prog` URL state

**Files:**
- Modify: `src/engine/derive.ts`
- Modify: `src/state/url.ts`
- Test: `src/engine/derive.test.ts`, `src/state/url.test.ts`

**Interfaces:**
- Consumes: existing `deriveGmina`, `VotesMap`, `AppState`.
- Produces (Task 2 relies on these exact names):
  - `GminaModel.votesGmina: VotesMap` and `GminaModel.glosyGmina: number`
  - `overProg(m: GminaModel, lista: string): boolean` exported from `src/engine/derive.ts`
  - `AppState.prog: boolean` (default `true`); `toHash` emits `prog=0` only when false.

- [ ] **Step 1: Write the failing tests**

In `src/engine/derive.test.ts`: add `overProg` to the import from `./derive`, add `import { allocate } from './allocate';` after it, and append:

```ts
describe('próg wyborczy (5% gmina-wide)', () => {
  it('gmina-wide vote totals', () => {
    // okręg 1: {1: 230, 2: 160}, okręg 2: {2: 90, 3: 60}
    expect(m.votesGmina).toEqual({ '1': 230, '2': 250, '3': 60 });
    expect(m.glosyGmina).toBe(540);
  });

  it('overProg: integer boundary — exactly 5% qualifies', () => {
    const t = { votesGmina: { '1': 50, '2': 49, '3': 901 }, glosyGmina: 1000 } as unknown as
      Parameters<typeof overProg>[0];
    expect(overProg(t, '1')).toBe(true);   // 50/1000 = exactly 5%
    expect(overProg(t, '2')).toBe(false);  // one vote short
    expect(overProg(t, '3')).toBe(true);
    expect(overProg(t, '9')).toBe(false);  // unknown lista
  });

  it('threshold pre-filter flips a seat (integration)', () => {
    const votes = { '1': 60, '2': 25, '3': 18 };
    // full: quotients 60, 30, 25, 20, 18 → L1 3, L2 1, L3 1
    expect(allocate(votes, 5, 'dh').seatsBy).toEqual({ '1': 3, '2': 1, '3': 1 });
    // L3 filtered out pre-allocation: 60, 30, 25, 20, 15 → L1 4, L2 1
    expect(allocate({ '1': 60, '2': 25 }, 5, 'dh').seatsBy).toEqual({ '1': 4, '2': 1 });
  });
});
```

In `src/state/url.test.ts`: add `prog: true` to the `st` helper defaults:

```ts
const st = (p: Partial<AppState> = {}): AppState => ({
  view: 'picker', teryt: null, sel: [], mandatyOverride: null, method: 'dh', compare: false, prog: true, ...p,
});
```

add one round-trip case to the `cases` array:

```ts
    st({ view: 'builder', teryt: '020101', sel: ['3'], prog: false }),
```

and append:

```ts
describe('prog param', () => {
  it('absent → ON; prog=0 → OFF; anything else → ON', () => {
    expect(parseHash('g=020101').prog).toBe(true);
    expect(parseHash('g=020101&prog=0').prog).toBe(false);
    expect(parseHash('g=020101&prog=1').prog).toBe(true);
    expect(parseHash('g=020101&prog=xyz').prog).toBe(true);
  });

  it('emitted only when OFF', () => {
    expect(toHash(st({ teryt: '020101', view: 'gmina' }))).not.toContain('prog');
    expect(toHash(st({ teryt: '020101', view: 'gmina', prog: false }))).toContain('prog=0');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/engine/derive.test.ts src/state/url.test.ts`
Expected: FAIL — `overProg` not exported; `votesGmina` undefined; AppState objects missing `prog` (round-trip mismatches).

- [ ] **Step 3: Implement**

In `src/engine/derive.ts`:

1. Extend `GminaModel` (after `mandatyGmina: number;`):

```ts
  votesGmina: VotesMap;
  glosyGmina: number;
```

2. In `deriveGmina`, next to the existing accumulators (`let wyborcyGmina = 0;`), add:

```ts
  const votesGmina: VotesMap = {};
```

then inside the okręg loop, directly after `okregi[nr] = { ... };`, add:

```ts
    addVotes(votesGmina, votes);
```

then just before the `return` statement add (do NOT call `sumVotes` here — it is an arrow const defined below `deriveGmina`, not hoisted):

```ts
  const glosyGmina = Object.values(votesGmina).reduce((a, b) => a + b, 0);
```

and extend the return object (after `mandatyGmina,`):

```ts
    votesGmina,
    glosyGmina,
```

3. Add the exported helper after `nameOf`:

```ts
// Statutory 5% threshold (art. 416 Kodeksu wyborczego): a committee takes
// part in seat division iff it won at least 5% of valid votes gmina-wide.
// Integer arithmetic: v/total ≥ 1/20 ⟺ 20·v ≥ total.
export const overProg = (m: GminaModel, lista: string): boolean =>
  20 * (m.votesGmina[lista] ?? 0) >= m.glosyGmina;
```

In `src/state/url.ts`:

1. `AppState` gains (after `compare: boolean;`):

```ts
  prog: boolean;
```

2. `parseHash` return gains (after `compare: ...,`):

```ts
    prog: p.get('prog') !== '0',
```

3. `toHash` gains (after the `compare` line):

```ts
  if (!s.prog) p.set('prog', '0');
```

- [ ] **Step 4: Run the full suite**

Run: `pnpm test`
Expected: all pass — 126 existing (the `st` helper update keeps url round-trips consistent) + 5 new = 131.

- [ ] **Step 5: Commit**

```bash
git add src/engine/derive.ts src/engine/derive.test.ts src/state/url.ts src/state/url.test.ts
git commit -m "feat: gmina-wide vote totals, overProg helper, prog URL state"
```

---

### Task 2: Threshold wiring in the builder UI

**Files:**
- Modify: `src/app/BuilderView.tsx`
- Modify: `src/app/ParamsPanel.tsx`
- Modify: `src/app/ResultsPanel.tsx`
- Modify: `src/app/DivisorTable.tsx`

**Interfaces:**
- Consumes (from Task 1): `overProg(m, lista)`, `model.votesGmina`, `model.glosyGmina`, `state.prog`.
- Produces: UI only. No component test harness exists; verification = full suite + `pnpm build` + browser pass (Step 6).

- [ ] **Step 1: BuilderView — qualified set, filtered allocation, prop plumbing**

In `src/app/BuilderView.tsx`:

1. Extend the derive import to include `overProg`:

```tsx
import { GminaModel, clampMandaty, defaultMandaty, overProg, sumVotes, votesOfSelection } from '../engine/derive';
```

2. Directly after `const votes = useMemo(...)`, insert:

```tsx
  const qualified = useMemo(
    () => new Set(Object.keys(model.votesGmina).filter(l => overProg(model, l))),
    [model],
  );
  const votesForAlloc = useMemo(
    () => (state.prog
      ? Object.fromEntries(Object.entries(votes).filter(([l]) => qualified.has(l)))
      : votes),
    [votes, state.prog, qualified],
  );
```

3. Point the allocations at the filtered map (replace the four existing memo lines):

```tsx
  const allocDh = useMemo(() => allocate(votesForAlloc, mandaty, 'dh'), [votesForAlloc, mandaty]);
  const allocSl = useMemo(() => allocate(votesForAlloc, mandaty, 'sl'), [votesForAlloc, mandaty]);
  const infoDh = useMemo(() => analyze(votesForAlloc, allocDh, 'dh'), [votesForAlloc, allocDh]);
  const infoSl = useMemo(() => analyze(votesForAlloc, allocSl, 'sl'), [votesForAlloc, allocSl]);
```

4. Pass the flag to `ResultsPanel` (add to its existing props):

```tsx
            prog={state.prog}
```

- [ ] **Step 2: ParamsPanel — the toggle**

In `src/app/ParamsPanel.tsx`, insert a third `params-block` after the closing `</div>` of the „Metoda podziału mandatów" block (before the closing `</div>` of `.params`):

```tsx
        <div class="params-block">
          <div class="col-label">Próg wyborczy</div>
          <label class="compare-toggle">
            <input type="checkbox" checked={state.prog} onChange={() => patch({ prog: !state.prog })} />
            Próg 5% w skali gminy (ustawowy)
          </label>
          <div class="formula">
            wyłączenie progu to wariant hipotetyczny — w wyborach komitety poniżej 5% nie uczestniczą w podziale mandatów
          </div>
        </div>
```

- [ ] **Step 3: ResultsPanel — row sourcing, excluded rows, banner, edge case, wasted votes**

In `src/app/ResultsPanel.tsx`:

1. Extend the derive import: `import { GminaModel, nameOf, overProg } from '../engine/derive';`

2. `Props` gains (after `compare: boolean;`):

```tsx
  prog: boolean;
```

3. In `ResultsPanel(props)`, replace the destructuring and `sorted` lines with:

```tsx
  const { model, votes, selVotes, mandaty, method, compare, prog } = props;
  const alloc = method === 'dh' ? props.allocDh : props.allocSl;
  const info = method === 'dh' ? props.infoDh : props.infoSl;
  const sorted = Object.keys(votes).filter(l => votes[l] > 0).sort((a, b) => votes[b] - votes[a]);
  const belowProg = new Set(prog ? sorted.filter(l => !overProg(model, l)) : []);
```

4. Replace the banner subtitle line with:

```tsx
        <div class="banner-s">
          {mandaty} mandatów · {fmt(selVotes)} głosów ważnych ·{' '}
          {prog ? 'próg 5% w skali gminy (ustawowy)' : 'bez progu wyborczego (wariant hipotetyczny)'}
        </div>
```

5. Directly after the existing `if (selVotes === 0) { ... }` block, add:

```tsx
  if (sorted.length > 0 && belowProg.size === sorted.length) {
    return (
      <section class={cls}>
        <div class="results-banner"><div class="banner-t">3. Wynik</div></div>
        <div class="no-votes">
          Żaden komitet z głosami w zaznaczonych obwodach nie przekracza progu 5% w skali gminy —
          przy włączonym progu nie ma czego przeliczać.
        </div>
      </section>
    );
  }
```

6. Pass `belowProg` into `SingleTable` and the filtered rows into `DivisorTable` (replace the two call sites):

```tsx
      {compare
        ? <CompareTable model={model} votes={votes} selVotes={selVotes} allocDh={props.allocDh} allocSl={props.allocSl} sorted={sorted} />
        : <SingleTable model={model} votes={votes} selVotes={selVotes} alloc={alloc} info={info} sorted={sorted} belowProg={belowProg} />}
      <Summaries {...props} activeInfo={info} />
      <DivisorTable
        model={model} votes={votes} alloc={alloc} mandaty={mandaty} method={method} compare={compare}
        sorted={sorted.filter(l => !belowProg.has(l))} anyExcluded={belowProg.size > 0}
      />
```

7. `SingleTable` — new signature and an excluded-row branch. Replace the whole function with:

```tsx
function SingleTable({ model, votes, selVotes, alloc, info, sorted, belowProg }: {
  model: GminaModel; votes: VotesMap; selVotes: number; alloc: Allocation; info: Analytics;
  sorted: string[]; belowProg: Set<string>;
}) {
  return (
    <div class="tbl-wrap">
      <table class="tbl results-tbl">
        <thead>
          <tr>
            <th class="l">Komitet</th>
            <th>Głosy</th>
            <th>% ważnych</th>
            <th>Mandaty</th>
            <th class="th-hint" title={FIRST_SEAT_HINT}>1. mandat od</th>
            <th class="gap-col">Brakujące głosy / przewaga</th>
            <th>Głosy nadwyżkowe</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(l => {
            const v = votes[l];
            if (belowProg.has(l)) {
              return (
                <tr key={l} class="seatless">
                  <td>
                    <span class="kom">
                      <KomitetChip lista={l} />
                      <span class="kom-name b">{nameOf(model, l)}</span>
                    </span>
                  </td>
                  <td class="r mono">{fmt(v)}</td>
                  <td class="r mono dim">{fmtPct((100 * v) / selVotes)}</td>
                  <td class="r mono"><span class="seats dim">0</span></td>
                  <td class="r mono dim">—</td>
                  <td class="gap-col">
                    <span class="dim">
                      poniżej progu — {fmtPct((100 * (model.votesGmina[l] ?? 0)) / model.glosyGmina)} głosów w gminie
                    </span>
                  </td>
                  <td class="r mono dim">—</td>
                </tr>
              );
            }
            const sc = alloc.seatsBy[l] ?? 0;
            const rec = info.perLista[l];
            const closest = l === info.minMissingLista;
            return (
              <tr key={l} class={closest ? 'closest' : sc === 0 ? 'seatless' : ''}>
                <td>
                  <span class="kom">
                    <KomitetChip lista={l} />
                    <span class="kom-name b">{nameOf(model, l)}</span>
                    {closest && <span class="badge">najbliżej mandatu</span>}
                  </span>
                </td>
                <td class="r mono">{fmt(v)}</td>
                <td class="r mono dim">{fmtPct((100 * v) / selVotes)}</td>
                <td class="r mono">
                  <span class="seats">{sc}</span>{' '}
                  <span class="dots" style={{ color: listaColor(l) }}>{'●'.repeat(Math.min(sc, 12))}</span>
                </td>
                <td class="r mono">{fmt(rec.firstSeatAt)} <span class="dim">{plMandat(rec.firstSeatAt)}</span></td>
                <td class="gap-col">
                  {rec.margin != null && rec.marginOver != null && (
                    <span class="gap-margin">przewaga {fmt(rec.margin)} {plGlos(rec.margin)} nad: {nameOf(model, rec.marginOver)}</span>
                  )}
                  {rec.missing != null && (
                    <span class={closest ? 'gap-missing hot' : 'gap-missing'}>
                      brakło {fmt(rec.missing)} {plGlos(rec.missing)} do {sc > 0 ? 'kolejnego' : 'pierwszego'} mandatu
                    </span>
                  )}
                  {rec.margin == null && rec.missing == null && <span class="dim">—</span>}
                </td>
                <td class="r mono dim">{rec.surplus != null ? fmt(rec.surplus) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

(The non-excluded branch is today's row body unchanged; only the header row and the excluded branch are new relative to the current file. `CompareTable` needs NO body change — excluded listy are absent from both `seatsBy` maps, so its rows naturally show 0 / 0 / `=`.)

8. `Summaries` — count excluded committees' votes as wasted. Replace the function's opening and `cards`/`noEffect` with:

```tsx
function Summaries({ model, votes, selVotes, method, compare, prog, infoDh, infoSl, activeInfo }: Props & { activeInfo: Analytics }) {
  const belowProg = prog ? Object.keys(votes).filter(l => votes[l] > 0 && !overProg(model, l)) : [];
  const belowSum = belowProg.reduce((a, l) => a + votes[l], 0);
  const cards = (info: Analytics, suffix: string) => {
    const wastedListy = [...info.wastedListy, ...belowProg].sort((a, b) => votes[b] - votes[a]);
    const wastedSum = info.wastedSum + belowSum;
    const names = wastedListy.map(l => `${nameOf(model, l)} (${fmt(votes[l])})`).join(', ');
    return [
      {
        title: `Głosy zmarnowane${suffix}`,
        value: `${fmt(wastedSum)} (${fmtPct((100 * wastedSum) / selVotes)})`,
        note: wastedListy.length ? `oddane na komitety bez mandatu: ${names}` : 'każdy komitet z głosami zdobył mandat',
      },
      {
        title: `Głosy nadwyżkowe${suffix}`,
        value: `${fmt(info.surplusSum)} (${fmtPct((100 * info.surplusSum) / selVotes)})`,
        note: 'głosy, które komitety z mandatami mogłyby stracić bez utraty żadnego mandatu',
      },
    ];
  };
  const noEffect = (i: Analytics) => i.wastedSum + belowSum + i.surplusSum;
```

(the remainder of `Summaries` — the `list` construction and JSX — is unchanged.)

- [ ] **Step 4: DivisorTable — legend note**

In `src/app/DivisorTable.tsx`:

1. `Props` gains:

```tsx
  anyExcluded?: boolean;
```

2. Destructure it: `export function DivisorTable({ model, votes, alloc, mandaty, method, compare, sorted, anyExcluded }: Props) {`

3. Append inside the legend div, after `(ustawowo: losowanie).`:

```tsx
          {anyExcluded && ' Komitety poniżej progu nie uczestniczą w podziale mandatów i nie są ujęte w tej tabeli.'}
```

- [ ] **Step 5: Full suite + build**

Run: `pnpm test && pnpm build`
Expected: 131 tests pass; `tsc --noEmit` + `vite build` succeed. (If tsc flags the `GminaView`'s use of the model, something leaked — `GminaView` must be untouched.)

- [ ] **Step 6: Browser verification**

Invoke the project's `verify` skill (`/verify`). Base path is `/wyboryzator2024/`. Confirm:
- Bolesławiec `#g=020101&v=builder&o=1.2.3.4.5&m=5`: the toggle is visible and CHECKED by default. Check whether every fixture committee (KO, FORUM, PiS, IMPULS, ZIEMI, TD) has ≥5% gmina-wide: if yes, all hand-verified fixture numbers are unchanged; if some committee is below, record the new (threshold-on) values and verify the OFF state instead matches the fixture exactly.
- Toggling OFF reproduces the pre-feature fixture values exactly, and the URL gains `prog=0`; toggling back ON removes it.
- Banner text matches the verbatim strings (ON and OFF).
- In Wrocław (`#g=026401&v=builder` with a handful of obwody selected): at least one committee renders the „poniżej progu — x,x% głosów w gminie" row with dim zeros and dashes; the divisor table omits it and shows the extra legend sentence; „Głosy zmarnowane" includes its votes.
- Compare mode (`cmp=1`): excluded rows show 0 / 0 / `=`.
- Deep link with `prog=0` loads OFF (full page load, not hash edit).

- [ ] **Step 7: Commit**

```bash
git add src/app/BuilderView.tsx src/app/ParamsPanel.tsx src/app/ResultsPanel.tsx src/app/DivisorTable.tsx
git commit -m "feat: 5% electoral threshold toggle in virtual okręg builder"
```
