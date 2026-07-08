# Wyboryzator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the static Preact SPA that recounts PKW 2024 local-election seats for user-composed virtual okręgi, per `docs/superpowers/specs/2026-07-08-wyboryzator-app-design.md`.

**Architecture:** Pure TypeScript engine (allocation, analytics, derived model) + hash-URL state codec, with thin Preact components on top. Data is static JSON in `public/data/`, one file per gmina, fetched on demand. Deployed to GitHub Pages via Actions.

**Tech Stack:** Vite, Preact, TypeScript, Vitest, pnpm.

## Global Constraints

- Dependencies are managed ONLY via `pnpm add` / `pnpm remove` — never hand-edit `package.json` dependency blocks.
- All UI copy is Polish, copied verbatim from the mockup `PKW_2024_wirtualne_okręgi/Wirtualne okręgi.dc.html`. Domain terms (gmina, okręg, obwód, komitet, lista, mandat, wyborcy) are never translated.
- Engine code (`src/engine/`) imports nothing from Preact and does no I/O. All quotient comparisons use integer cross-multiplication — never floating-point division (display formatting is the only place division is allowed).
- Tie-break everywhere: higher quotient → more total committee votes → lower lista number. Disclosed to users in the divisor-table legend.
- No state library, no router library, no runtime YAML parser.
- Colors: crimson `#9E1B32` (d'Hondt / accent), blue `#1D5C87` (Sainte-Laguë), paper `#F6F5F2`, ink `#1C1B1A`. Fonts: IBM Plex Sans / IBM Plex Mono via Google Fonts.
- Polish number formatting via `toLocaleString('pl-PL')`.
- Vitest tests do no I/O — all fixtures hardcoded.
- Mandaty always clamped to 1–60.
- The mockup directory `PKW_2024_wirtualne_okręgi/` is reference-only: never imported, never built.
- After the data move (Task 1), gmina data lives at `public/data/<TERYT>.json`; `public/data/index.json` is generated, git-ignored.

**Reference values used across tasks (m. Bolesławiec, TERYT 020101):** 4 okręgi, 21 mandatów, 28 861 wyborcy, 24 obwody. Okręg nr 1: 5 mandatów, obwody 1–5, committee vote sums: lista 1 → 621, lista 3 → 168, lista 5 → 997, lista 14 → 580, lista 15 → 303, lista 16 → 783 (total 3452).

---

### Task 1: Project scaffold + data move

**Files:**
- Create: `package.json`, `pnpm-lock.yaml` (via pnpm), `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/app/App.tsx` (stub), `src/styles.css` (minimal; replaced in Task 8)
- Modify: `.gitignore`
- Move: `results/` → `public/data/` (git mv)

**Interfaces:**
- Produces: `pnpm dev` / `pnpm build` / `pnpm test` scripts; `import.meta.env.BASE_URL` = `/wyboryzator/`; gmina data served at `<BASE_URL>data/<TERYT>.json`.

- [ ] **Step 1: Initialize package and install dependencies**

```bash
pnpm init
pnpm add preact
pnpm add -D vite @preact/preset-vite typescript vitest
```

- [ ] **Step 2: Set package.json scripts and type**

Use `npm pkg set` (edits scripts/meta only — not dependencies, which stay pnpm-managed):

```bash
npm pkg set name=wyboryzator type=module
npm pkg set private=true --json
npm pkg set scripts.dev=vite \
  scripts.predev="node scripts/build-index.mjs" \
  scripts.build="tsc --noEmit && vite build" \
  scripts.prebuild="node scripts/build-index.mjs" \
  scripts.preview="vite preview" \
  scripts.test="vitest run --passWithNoTests"
```

Note: `predev`/`prebuild` reference `scripts/build-index.mjs`, created in Task 2. Until then run plain `vite`/`vite build` via `pnpm exec` for verification.

- [ ] **Step 3: Write `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: '/wyboryzator/',
  plugins: [preact()],
  test: { environment: 'node' },
});
```

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 5: Write `index.html`**

```html
<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Wybory samorządowe 2024 — przelicznik wirtualnych okręgów</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 6: Write `src/main.tsx`, stub `src/app/App.tsx`, minimal `src/styles.css`**

`src/main.tsx`:
```tsx
import { render } from 'preact';
import { App } from './app/App';
import './styles.css';

render(<App />, document.getElementById('app')!);
```

`src/app/App.tsx` (stub — fully replaced in Task 8):
```tsx
export function App() {
  return <h1>Wybory samorządowe 2024</h1>;
}
```

`src/styles.css` (minimal — fully replaced in Task 8):
```css
html, body { margin: 0; background: #F6F5F2; }
body { font-family: 'IBM Plex Sans', sans-serif; color: #1C1B1A; }
```

- [ ] **Step 7: Move the data and update .gitignore**

```bash
mkdir -p public
git mv results public/data
printf 'public/data/index.json\n' >> .gitignore
```

- [ ] **Step 8: Verify build and test run**

```bash
pnpm exec tsc --noEmit && pnpm exec vite build
pnpm test
ls dist/data/020101.json dist/index.html
```
Expected: build succeeds (it copies `public/` — 132 MB — into `dist/`, takes a few seconds); vitest exits 0 with "no test files found" allowed; both `ls` targets exist.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite+Preact+TS app, move data to public/data"
```

---

### Task 2: Index build script

**Files:**
- Create: `scripts/build-index.mjs`

**Interfaces:**
- Consumes: `public/data/teryt_mappings.yml` — lines shaped `"020101": "m. Bolesławiec, dolnośląskie"`.
- Produces: `public/data/index.json` = `Array<{ teryt: string; name: string; wojewodztwo: string }>`, sorted by `name` with Polish collation. Generated by `predev`/`prebuild` hooks (wired in Task 1).

- [ ] **Step 1: Write `scripts/build-index.mjs`**

The name may itself contain commas, so split on the LAST `", "`:

```js
import { readFileSync, writeFileSync } from 'node:fs';

const src = new URL('../public/data/teryt_mappings.yml', import.meta.url);
const out = new URL('../public/data/index.json', import.meta.url);

const entries = [];
for (const line of readFileSync(src, 'utf8').split('\n')) {
  const m = line.match(/^"(\d{6})":\s*"(.*)"\s*$/);
  if (!m) continue;
  const cut = m[2].lastIndexOf(', ');
  if (cut === -1) throw new Error(`Unparseable entry: ${line}`);
  entries.push({ teryt: m[1], name: m[2].slice(0, cut), wojewodztwo: m[2].slice(cut + 2) });
}
if (entries.length < 300) throw new Error(`Only ${entries.length} entries parsed — expected ~320`);
entries.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
writeFileSync(out, JSON.stringify(entries));
console.log(`index.json: ${entries.length} gmin`);
```

- [ ] **Step 2: Run and verify**

```bash
node scripts/build-index.mjs
jq length public/data/index.json
jq -r '.[] | select(.teryt=="020101") | "\(.name)|\(.wojewodztwo)"' public/data/index.json
jq length public/data/index.json; grep -c '^"' public/data/teryt_mappings.yml
```
Expected: prints entry count (~319–320); `m. Bolesławiec|dolnośląskie`; index length equals the yml line count.

- [ ] **Step 3: Verify pnpm hooks fire**

```bash
pnpm build 2>&1 | head -3
```
Expected: first output lines include `index.json: <N> gmin` (prebuild ran), then tsc/vite output.

- [ ] **Step 4: Commit**

```bash
git add scripts/build-index.mjs
git commit -m "feat: generate gmina index from teryt_mappings.yml at build time"
```

---

### Task 3: Polish formatters (`engine/format.ts`)

**Files:**
- Create: `src/engine/format.ts`
- Test: `src/engine/format.test.ts`

**Interfaces:**
- Produces:
  - `fmt(n: number): string` — rounded integer, pl-PL grouping (space thousands separator)
  - `fmtPct(x: number): string` — 1 decimal, comma separator, trailing `%` (input is already a percentage, e.g. `8.3`)
  - `fmtDec(x: number, digits: number): string` — fixed decimals, pl-PL
  - `plGlos(n: number): string` — Polish plural of "głos": 1 → `głos`, 2–4 (except 12–14) → `głosy`, else → `głosów`

- [ ] **Step 1: Write the failing tests — `src/engine/format.test.ts`**

pl-PL grouping uses a non-breaking/narrow space depending on ICU; tests normalize any whitespace to a plain space.

```ts
import { describe, expect, it } from 'vitest';
import { fmt, fmtDec, fmtPct, plGlos } from './format';

const sp = (s: string) => s.replace(/[\s  ]/g, ' ');

describe('fmt', () => {
  it('groups thousands and rounds', () => {
    expect(sp(fmt(1234567))).toBe('1 234 567');
    expect(sp(fmt(999))).toBe('999');
    expect(sp(fmt(1254.6))).toBe('1 255');
  });
});

describe('fmtPct', () => {
  it('one decimal, comma, percent sign', () => {
    expect(fmtPct(8.34)).toBe('8,3%');
    expect(fmtPct(12)).toBe('12,0%');
    expect(fmtPct(100)).toBe('100,0%');
  });
});

describe('fmtDec', () => {
  it('fixed decimals with comma', () => {
    expect(fmtDec(3.14159, 2)).toBe('3,14');
    expect(fmtDec(498.5, 1)).toBe('498,5');
  });
});

describe('plGlos', () => {
  it('handles Polish plural forms', () => {
    expect(plGlos(1)).toBe('głos');
    expect(plGlos(2)).toBe('głosy');
    expect(plGlos(4)).toBe('głosy');
    expect(plGlos(5)).toBe('głosów');
    expect(plGlos(12)).toBe('głosów');
    expect(plGlos(14)).toBe('głosów');
    expect(plGlos(22)).toBe('głosy');
    expect(plGlos(112)).toBe('głosów');
    expect(plGlos(122)).toBe('głosy');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/engine/format.test.ts`
Expected: FAIL — cannot resolve `./format`.

- [ ] **Step 3: Write `src/engine/format.ts`**

```ts
export const fmt = (n: number): string => Math.round(n).toLocaleString('pl-PL');

export const fmtPct = (x: number): string =>
  x.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

export const fmtDec = (x: number, digits: number): string =>
  x.toLocaleString('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function plGlos(n: number): string {
  const a = Math.abs(n) % 100;
  const b = Math.abs(n) % 10;
  if (n === 1) return 'głos';
  if (b >= 2 && b <= 4 && (a < 12 || a > 14)) return 'głosy';
  return 'głosów';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/engine/format.test.ts`
Expected: PASS (4 test groups).

- [ ] **Step 5: Commit**

```bash
git add src/engine/format.ts src/engine/format.test.ts
git commit -m "feat: Polish number and plural formatters"
```

---

### Task 4: Seat allocation (`engine/allocate.ts`)

**Files:**
- Create: `src/engine/allocate.ts`
- Test: `src/engine/allocate.test.ts`

**Interfaces:**
- Produces:
  - `type Method = 'dh' | 'sl'`
  - `type VotesMap = Record<string, number>` (lista → votes)
  - `interface Quotient { lista: string; votes: number; divisor: number }` (value = votes/divisor, never materialized)
  - `interface Allocation { seatsBy: Record<string, number>; winners: Quotient[]; last: Quotient | null; losing: Quotient[]; listy: string[] }` — `winners` ordered best→worst (length = `seats` when any votes exist), `last` = lowest winning quotient, `losing` = remaining quotients ordered best→worst, `listy` = lists with votes > 0
  - `divisor(k: number, method: Method): number` — k-th divisor (0-based): d'Hondt k+1, Sainte-Laguë 2k+1
  - `allocate(votes: VotesMap, seats: number, method: Method): Allocation`

- [ ] **Step 1: Write the failing tests — `src/engine/allocate.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { allocate, divisor } from './allocate';

describe('divisor', () => {
  it('d’Hondt 1,2,3…; Sainte-Laguë 1,3,5…', () => {
    expect([0, 1, 2].map(k => divisor(k, 'dh'))).toEqual([1, 2, 3]);
    expect([0, 1, 2].map(k => divisor(k, 'sl'))).toEqual([1, 3, 5]);
  });
});

describe('allocate — textbook example where methods differ', () => {
  // A=90 B=59 C=19, 5 seats.
  // d'Hondt quotients: A 90,45,30,22.5,18 | B 59,29.5,19.67 | C 19
  //   top5 = 90,59,45,30,29.5 → A3 B2 C0, last = B/2
  // Sainte-Laguë: A 90,30,18 | B 59,19.67 | C 19
  //   top5 = 90,59,30,19.67,19 → A2 B2 C1, last = C/1
  const votes = { '1': 90, '2': 59, '3': 19 };

  it('d’Hondt', () => {
    const a = allocate(votes, 5, 'dh');
    expect(a.seatsBy).toEqual({ '1': 3, '2': 2, '3': 0 });
    expect(a.last).toEqual({ lista: '2', votes: 59, divisor: 2 });
    expect(a.winners).toHaveLength(5);
  });

  it('Sainte-Laguë', () => {
    const a = allocate(votes, 5, 'sl');
    expect(a.seatsBy).toEqual({ '1': 2, '2': 2, '3': 1 });
    expect(a.last).toEqual({ lista: '3', votes: 19, divisor: 1 });
  });
});

describe('allocate — real data: Bolesławiec (020101) okręg 1, 5 mandatów, d’Hondt', () => {
  // Committee vote sums computed from public/data/020101.json okręg 1.
  // Hand-derived quotient table:
  //   L5:  997, 498.5, 332.33…   L16: 783, 391.5   L1: 621, 310.5
  //   L14: 580, 290              L15: 303          L3: 168
  // top5 = 997, 783, 621, 580, 498.5 → L5=2, L16=1, L1=1, L14=1; last = L5/2.
  const votes = { '1': 621, '3': 168, '5': 997, '14': 580, '15': 303, '16': 783 };

  it('matches the hand-computed allocation', () => {
    const a = allocate(votes, 5, 'dh');
    expect(a.seatsBy).toEqual({ '1': 1, '3': 0, '5': 2, '14': 1, '15': 0, '16': 1 });
    expect(a.last).toEqual({ lista: '5', votes: 997, divisor: 2 });
  });
});

describe('allocate — tie-breaks', () => {
  it('equal quotients, equal votes → lower lista number', () => {
    // 100,100,50,50,… — 3rd seat: 50 vs 50 tie, equal totals → lista 1
    const a = allocate({ '1': 100, '2': 100 }, 3, 'dh');
    expect(a.seatsBy).toEqual({ '1': 2, '2': 1 });
  });

  it('equal quotients → more total votes wins', () => {
    // 200/2 = 100 ties 100/1 = 100 → lista 1 has more total votes
    const a = allocate({ '1': 200, '2': 100 }, 2, 'dh');
    expect(a.seatsBy).toEqual({ '1': 2, '2': 0 });
  });

  it('exact integer comparison (cross-multiplied, no float noise)', () => {
    // 333/3 === 111/1 exactly; tie-break by votes → lista 1
    const a = allocate({ '1': 333, '2': 111 }, 3, 'dh');
    expect(a.seatsBy).toEqual({ '1': 3, '2': 0 });
  });
});

describe('allocate — edge cases', () => {
  it('zero-vote lists are excluded', () => {
    const a = allocate({ '1': 100, '2': 0 }, 2, 'dh');
    expect(a.listy).toEqual(['1']);
    expect(a.seatsBy).toEqual({ '1': 2 });
  });

  it('no votes at all → empty allocation', () => {
    const a = allocate({}, 5, 'dh');
    expect(a.seatsBy).toEqual({});
    expect(a.winners).toEqual([]);
    expect(a.last).toBeNull();
  });

  it('seats always fully assigned when any votes exist', () => {
    const a = allocate({ '1': 3 }, 10, 'dh');
    expect(a.seatsBy).toEqual({ '1': 10 });
    expect(a.winners).toHaveLength(10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/engine/allocate.test.ts`
Expected: FAIL — cannot resolve `./allocate`.

- [ ] **Step 3: Write `src/engine/allocate.ts`**

```ts
export type Method = 'dh' | 'sl';
export type VotesMap = Record<string, number>;

export interface Quotient {
  lista: string;
  votes: number;
  divisor: number;
}

export interface Allocation {
  seatsBy: Record<string, number>;
  winners: Quotient[];
  last: Quotient | null;
  losing: Quotient[];
  listy: string[];
}

export const divisor = (k: number, method: Method): number =>
  method === 'dh' ? k + 1 : 2 * k + 1;

// Descending by quotient value (cross-multiplied — integers only),
// then more total votes, then lower lista number.
const cmp = (a: Quotient, b: Quotient): number =>
  b.votes * a.divisor - a.votes * b.divisor ||
  b.votes - a.votes ||
  Number(a.lista) - Number(b.lista);

export function allocate(votes: VotesMap, seats: number, method: Method): Allocation {
  const listy = Object.keys(votes).filter(l => votes[l] > 0);
  const quots: Quotient[] = [];
  for (const l of listy) {
    for (let k = 0; k < seats; k++) {
      quots.push({ lista: l, votes: votes[l], divisor: divisor(k, method) });
    }
  }
  quots.sort(cmp);
  const winners = quots.slice(0, seats);
  const seatsBy: Record<string, number> = {};
  for (const l of listy) seatsBy[l] = 0;
  for (const w of winners) seatsBy[w.lista]++;
  return {
    seatsBy,
    winners,
    last: winners[winners.length - 1] ?? null,
    losing: quots.slice(seats),
    listy,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/engine/allocate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/allocate.ts src/engine/allocate.test.ts
git commit -m "feat: d'Hondt / Sainte-Laguë allocation with integer-exact comparisons"
```

---

### Task 5: Vote analytics (`engine/analytics.ts`)

**Files:**
- Create: `src/engine/analytics.ts`
- Test: `src/engine/analytics.test.ts`

**Interfaces:**
- Consumes: `allocate`, `divisor`, `Allocation`, `Quotient`, `Method`, `VotesMap` from `./allocate`.
- Produces:
  - `interface ListaAnalytics { missing?: number; margin?: number; marginOver?: string; surplus?: number }`
  - `interface Analytics { perLista: Record<string, ListaAnalytics>; wastedSum: number; wastedListy: string[]; surplusSum: number; minMissingLista: string | null }`
  - `minVotesToBeat(target: Quotient, d: number, lista: string): number` — smallest total vote count with which `lista` at divisor `d` outranks `target` under the allocation ordering (quotient → total votes → lower lista number). This is tie-break-aware: strictly-exceeding is not required when the challenger wins the tie.
  - `analyze(votes: VotesMap, alloc: Allocation, method: Method): Analytics`

**Semantics** (per spec, refined to be tie-break-aware so the property tests below hold exactly):
- `missing` — committees not holding the last seat: `minVotesToBeat(last, divisor(seats, method), lista) − votes`, min 1.
- `margin`/`marginOver` — the last-seat holder: `votes − minVotesToBeat(bestLosingOfOtherCommittee, last.divisor, lista)`, floor 0.
- `surplus` — every seat winner: `votes − minVotesToBeat(bestLosingOfOtherCommittee, divisor(seats−1, method), lista)`, floor 0. When no other committee has a losing quotient, `surplus = votes − 1` (one vote suffices when unopposed). For the last-seat holder, surplus equals margin by construction.
- `wastedListy`/`wastedSum` — lists with votes but zero seats, ordered by votes descending.
- `minMissingLista` — lista with the smallest `missing` (first in votes-descending order on ties); `null` when none.

- [ ] **Step 1: Write the failing tests — `src/engine/analytics.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { allocate } from './allocate';
import { analyze } from './analytics';

// Bolesławiec okręg 1, 5 seats, d'Hondt. Hand-derived (see allocate.test.ts):
// seats L5=2 L16=1 L1=1 L14=1, last = L5/2 (q 498.5),
// losing (best first): L16/2=391.5, L5/3=332.33, L1/2=310.5, L15/1=303, …
const votes = { '1': 621, '3': 168, '5': 997, '14': 580, '15': 303, '16': 783 };
const run = (m: 'dh' | 'sl') => {
  const alloc = allocate(votes, 5, m);
  return { alloc, info: analyze(votes, alloc, m) };
};

describe('analyze — Bolesławiec okręg 1, d’Hondt', () => {
  const { info } = run('dh');

  it('missing votes (hand-computed)', () => {
    // L16 needs its /2 quotient to outrank last (997/2). Strict threshold is 998,
    // but at 997 the quotients tie and lista 16 loses the tie (equal votes, higher nr) → 998.
    expect(info.perLista['16'].missing).toBe(998 - 783); // 215
    expect(info.perLista['1'].missing).toBe(998 - 621);  // 377
    expect(info.perLista['14'].missing).toBe(998 - 580); // 418
    // Seatless lists challenge with divisor 1: threshold 499 (499 > 498.5).
    expect(info.perLista['15'].missing).toBe(499 - 303); // 196
    expect(info.perLista['3'].missing).toBe(499 - 168);  // 331
  });

  it('najbliżej mandatu = smallest missing', () => {
    expect(info.minMissingLista).toBe('15');
  });

  it('margin of the last-seat holder (tie-break-aware)', () => {
    // L5 keeps its /2 seat vs best other losing quotient L16/2 (783/2).
    // At 783 votes the quotients tie and lista 5 wins the tie (lower nr) → keeps at 783.
    expect(info.perLista['5'].margin).toBe(997 - 783); // 214
    expect(info.perLista['5'].marginOver).toBe('16');
    expect(info.perLista['5'].surplus).toBe(214); // coincides for the holder
  });

  it('surplus of other winners', () => {
    // L16/1 vs best other losing quotient L5/3 (997/3): threshold 333.
    expect(info.perLista['16'].surplus).toBe(783 - 333); // 450
    // L1/1 and L14/1 vs L16/2 (391.5): threshold 392.
    expect(info.perLista['1'].surplus).toBe(621 - 392);  // 229
    expect(info.perLista['14'].surplus).toBe(580 - 392); // 188
    expect(info.surplusSum).toBe(214 + 450 + 229 + 188); // 1081
  });

  it('wasted votes', () => {
    expect(info.wastedListy).toEqual(['15', '3']);
    expect(info.wastedSum).toBe(303 + 168); // 471
  });
});

describe('analyze — property checks (re-run the engine)', () => {
  const fixtures: Array<[Record<string, number>, number]> = [
    [votes, 5],
    [{ '1': 90, '2': 59, '3': 19 }, 5],
    [{ '1': 1000, '2': 999, '3': 998, '4': 3 }, 7],
    [{ '1': 50, '2': 50, '3': 49 }, 4],
  ];

  for (const method of ['dh', 'sl'] as const) {
    for (const [v, seats] of fixtures) {
      const alloc = allocate(v, seats, method);
      const info = analyze(v, alloc, method);

      for (const l of alloc.listy) {
        const rec = info.perLista[l];
        const before = alloc.seatsBy[l];

        if (rec.missing != null) {
          it(`${method} ${JSON.stringify(v)} lista ${l}: +missing gains a seat, +missing−1 does not`, () => {
            const plus = allocate({ ...v, [l]: v[l] + rec.missing! }, seats, method);
            expect(plus.seatsBy[l]).toBeGreaterThan(before);
            if (rec.missing! > 1) {
              const minus = allocate({ ...v, [l]: v[l] + rec.missing! - 1 }, seats, method);
              expect(minus.seatsBy[l]).toBe(before);
            }
          });
        }

        if (rec.surplus != null && rec.surplus > 0) {
          it(`${method} ${JSON.stringify(v)} lista ${l}: −surplus keeps seats, −surplus−1 loses one`, () => {
            const kept = allocate({ ...v, [l]: v[l] - rec.surplus! }, seats, method);
            expect(kept.seatsBy[l]).toBe(before);
            const lost = allocate({ ...v, [l]: v[l] - rec.surplus! - 1 }, seats, method);
            expect(lost.seatsBy[l] ?? 0).toBeLessThan(before);
          });
        }
      }
    }
  }
});

describe('analyze — edge cases', () => {
  it('single committee: no missing/margin, surplus = votes − 1', () => {
    const alloc = allocate({ '1': 42 }, 3, 'dh');
    const info = analyze({ '1': 42 }, alloc, 'dh');
    expect(info.perLista['1'].missing).toBeUndefined();
    expect(info.perLista['1'].margin).toBeUndefined();
    expect(info.perLista['1'].surplus).toBe(41);
    expect(info.minMissingLista).toBeNull();
    expect(info.wastedSum).toBe(0);
  });

  it('empty votes: empty analytics', () => {
    const alloc = allocate({}, 3, 'dh');
    const info = analyze({}, alloc, 'dh');
    expect(info.perLista).toEqual({});
    expect(info.wastedSum).toBe(0);
    expect(info.surplusSum).toBe(0);
    expect(info.minMissingLista).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/engine/analytics.test.ts`
Expected: FAIL — cannot resolve `./analytics`.

- [ ] **Step 3: Write `src/engine/analytics.ts`**

```ts
import { Allocation, Method, Quotient, VotesMap, divisor } from './allocate';

export interface ListaAnalytics {
  missing?: number;
  margin?: number;
  marginOver?: string;
  surplus?: number;
}

export interface Analytics {
  perLista: Record<string, ListaAnalytics>;
  wastedSum: number;
  wastedListy: string[];
  surplusSum: number;
  minMissingLista: string | null;
}

// Smallest total vote count with which `lista`, at divisor `d`, outranks
// `target` under the allocation ordering (quotient, then total votes, then
// lower lista number). Integer arithmetic throughout.
export function minVotesToBeat(target: Quotient, d: number, lista: string): number {
  const num = target.votes * d;
  const strict = Math.floor(num / target.divisor) + 1;
  if (num % target.divisor === 0) {
    const tie = num / target.divisor;
    if (tie > target.votes || (tie === target.votes && Number(lista) < Number(target.lista))) {
      return tie; // wins the tie-break at exactly-equal quotients
    }
  }
  return strict;
}

export function analyze(votes: VotesMap, alloc: Allocation, method: Method): Analytics {
  const { last, losing, seatsBy } = alloc;
  const listy = [...alloc.listy].sort((a, b) => votes[b] - votes[a]);
  const perLista: Record<string, ListaAnalytics> = {};
  let surplusSum = 0;
  let minMissing = Infinity;
  let minMissingLista: string | null = null;

  for (const l of listy) {
    const v = votes[l];
    const sc = seatsBy[l] ?? 0;
    const rec: ListaAnalytics = {};
    if (last) {
      const bestOther = losing.find(q => q.lista !== l);
      if (last.lista !== l) {
        rec.missing = Math.max(1, minVotesToBeat(last, divisor(sc, method), l) - v);
        if (rec.missing < minMissing) {
          minMissing = rec.missing;
          minMissingLista = l;
        }
      } else if (bestOther) {
        rec.margin = Math.max(0, v - minVotesToBeat(bestOther, last.divisor, l));
        rec.marginOver = bestOther.lista;
      }
      if (sc > 0) {
        rec.surplus = bestOther
          ? Math.max(0, v - minVotesToBeat(bestOther, divisor(sc - 1, method), l))
          : v - 1;
        surplusSum += rec.surplus;
      }
    }
    perLista[l] = rec;
  }

  const wastedListy = listy.filter(l => (seatsBy[l] ?? 0) === 0);
  const wastedSum = wastedListy.reduce((a, l) => a + votes[l], 0);
  return { perLista, wastedSum, wastedListy, surplusSum, minMissingLista };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/engine/analytics.test.ts`
Expected: PASS (including all generated property checks).

- [ ] **Step 5: Commit**

```bash
git add src/engine/analytics.ts src/engine/analytics.test.ts
git commit -m "feat: brakujące/przewaga/nadwyżkowe/zmarnowane analytics, tie-break-aware"
```

---

### Task 6: Gmina data model (`engine/derive.ts`)

**Files:**
- Create: `src/engine/derive.ts`
- Test: `src/engine/derive.test.ts`

**Interfaces:**
- Consumes: `allocate`, `VotesMap` from `./allocate`.
- Produces:
  - Raw JSON types: `RawKandydat { name: string; glosy: number }`, `RawObwod { okreg: number; wyborcy: number; wyborcy_glosujacy: number; kandydaci: Record<string, Record<string, RawKandydat>> }`, `RawOkreg { mandaty: number; listy: number; wyborcy: number; granice: string; kandydaci: Record<string, { komitet: string }>; obwody: Record<string, RawObwod> }`, `RawGmina { wojewodztwo: string; powiat: string; gmina: string; organ: string; siedziba: string; okregi: Record<string, RawOkreg> }`
  - `interface ObwodInfo { nr: string; okreg: string; wyborcy: number; glosy: number; votes: VotesMap }`
  - `interface OkregModel { nr: string; mandaty: number; listy: number; wyborcy: number; granice: string; obwodNrs: string[]; votes: VotesMap; totalVotes: number; realSeats: Record<string, number> }`
  - `interface GminaModel { teryt: string; nazwa: string; organ: string; powiat: string; wojewodztwo: string; siedziba: string; okregNrs: string[]; okregi: Record<string, OkregModel>; komitetName: Record<string, string>; obwodByNr: Record<string, ObwodInfo>; obwodNrs: string[]; wyborcyGmina: number; mandatyGmina: number }`
  - `deriveGmina(teryt: string, raw: RawGmina): GminaModel` — `realSeats` computed with `allocate(votes, mandaty, 'dh')`; all nr arrays sorted numerically ascending
  - `nameOf(m: GminaModel, lista: string): string` — `komitetName[lista] ?? 'Lista nr ' + lista`
  - `votesOfSelection(model: GminaModel, sel: string[]): VotesMap` — unknown nrs silently skipped
  - `sumVotes(v: VotesMap): number`
  - `defaultMandaty(model: GminaModel, selWyborcy: number): number` — `max(1, round(mandatyGmina × selWyborcy / wyborcyGmina))`
  - `clampMandaty(n: number): number` — clamp 1–60

- [ ] **Step 1: Write the failing tests — `src/engine/derive.test.ts`**

Synthetic 2-okręg fixture; obwód numbers unique gmina-wide as in the real data.

```ts
import { describe, expect, it } from 'vitest';
import {
  RawGmina, clampMandaty, defaultMandaty, deriveGmina, nameOf, sumVotes, votesOfSelection,
} from './derive';

const raw: RawGmina = {
  wojewodztwo: 'testowe', powiat: 'testowy', gmina: 'm. Test', organ: 'Rada Miasta Test', siedziba: 'Test',
  okregi: {
    '1': {
      mandaty: 2, listy: 2, wyborcy: 1000, granice: 'Test ulice: A, B',
      kandydaci: { '1': { komitet: 'KW ALFA' }, '2': { komitet: 'KW BETA' } },
      obwody: {
        '1': { okreg: 1, wyborcy: 600, wyborcy_glosujacy: 300,
          kandydaci: { '1': { '1': { name: 'A A', glosy: 100 }, '2': { name: 'B B', glosy: 50 } },
                       '2': { '1': { name: 'C C', glosy: 120 } } } },
        '2': { okreg: 1, wyborcy: 400, wyborcy_glosujacy: 200,
          kandydaci: { '1': { '1': { name: 'A A', glosy: 80 } },
                       '2': { '1': { name: 'C C', glosy: 40 } } } },
      },
    },
    '2': {
      mandaty: 3, listy: 2, wyborcy: 500, granice: 'Test ulice: C',
      kandydaci: { '2': { komitet: 'KW BETA' }, '3': { komitet: 'KW GAMMA' } },
      obwody: {
        '3': { okreg: 2, wyborcy: 500, wyborcy_glosujacy: 250,
          kandydaci: { '2': { '1': { name: 'D D', glosy: 90 } },
                       '3': { '1': { name: 'E E', glosy: 60 } } } },
      },
    },
  },
};

const m = deriveGmina('999999', raw);

describe('deriveGmina', () => {
  it('gmina-wide totals and orderings', () => {
    expect(m.okregNrs).toEqual(['1', '2']);
    expect(m.obwodNrs).toEqual(['1', '2', '3']);
    expect(m.wyborcyGmina).toBe(1500);
    expect(m.mandatyGmina).toBe(5);
  });

  it('komitet names merged across okręgi, with fallback', () => {
    expect(m.komitetName).toEqual({ '1': 'KW ALFA', '2': 'KW BETA', '3': 'KW GAMMA' });
    expect(nameOf(m, '3')).toBe('KW GAMMA');
    expect(nameOf(m, '9')).toBe('Lista nr 9');
  });

  it('per-obwód committee vote sums (candidates summed per lista)', () => {
    expect(m.obwodByNr['1'].votes).toEqual({ '1': 150, '2': 120 });
    expect(m.obwodByNr['1'].glosy).toBe(270);
    expect(m.obwodByNr['2'].votes).toEqual({ '1': 80, '2': 40 });
    expect(m.obwodByNr['3'].okreg).toBe('2');
  });

  it('per-okręg aggregates and real d’Hondt seats', () => {
    expect(m.okregi['1'].votes).toEqual({ '1': 230, '2': 160 });
    expect(m.okregi['1'].totalVotes).toBe(390);
    // 2 seats, d'Hondt: 230, 160, 115 → lista 1: 1, lista 2: 1
    expect(m.okregi['1'].realSeats).toEqual({ '1': 1, '2': 1 });
    // 3 seats: 90, 60, 45, 30, 20 → lista 2: 2, lista 3: 1
    expect(m.okregi['2'].realSeats).toEqual({ '2': 2, '3': 1 });
  });
});

describe('selection helpers', () => {
  it('votesOfSelection sums across obwody, skips unknown nrs', () => {
    expect(votesOfSelection(m, ['1', '2', '99'])).toEqual({ '1': 230, '2': 160 });
    expect(sumVotes(votesOfSelection(m, ['1', '3']))).toBe(270 + 150);
  });

  it('defaultMandaty: proportional, rounded, min 1', () => {
    // 5 × (1000/1500) = 3.33 → 3
    expect(defaultMandaty(m, 1000)).toBe(3);
    // 5 × (30/1500) = 0.1 → min 1
    expect(defaultMandaty(m, 30)).toBe(1);
  });

  it('clampMandaty', () => {
    expect(clampMandaty(0)).toBe(1);
    expect(clampMandaty(61)).toBe(60);
    expect(clampMandaty(21)).toBe(21);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/engine/derive.test.ts`
Expected: FAIL — cannot resolve `./derive`.

- [ ] **Step 3: Write `src/engine/derive.ts`**

```ts
import { VotesMap, allocate } from './allocate';

export interface RawKandydat { name: string; glosy: number }
export interface RawObwod {
  okreg: number;
  wyborcy: number;
  wyborcy_glosujacy: number;
  kandydaci: Record<string, Record<string, RawKandydat>>;
}
export interface RawOkreg {
  mandaty: number;
  listy: number;
  wyborcy: number;
  granice: string;
  kandydaci: Record<string, { komitet: string }>;
  obwody: Record<string, RawObwod>;
}
export interface RawGmina {
  wojewodztwo: string;
  powiat: string;
  gmina: string;
  organ: string;
  siedziba: string;
  okregi: Record<string, RawOkreg>;
}

export interface ObwodInfo { nr: string; okreg: string; wyborcy: number; glosy: number; votes: VotesMap }
export interface OkregModel {
  nr: string;
  mandaty: number;
  listy: number;
  wyborcy: number;
  granice: string;
  obwodNrs: string[];
  votes: VotesMap;
  totalVotes: number;
  realSeats: Record<string, number>;
}
export interface GminaModel {
  teryt: string;
  nazwa: string;
  organ: string;
  powiat: string;
  wojewodztwo: string;
  siedziba: string;
  okregNrs: string[];
  okregi: Record<string, OkregModel>;
  komitetName: Record<string, string>;
  obwodByNr: Record<string, ObwodInfo>;
  obwodNrs: string[];
  wyborcyGmina: number;
  mandatyGmina: number;
}

const numAsc = (a: string, b: string) => Number(a) - Number(b);

function addVotes(into: VotesMap, from: VotesMap): void {
  for (const l of Object.keys(from)) into[l] = (into[l] ?? 0) + from[l];
}

export function deriveGmina(teryt: string, raw: RawGmina): GminaModel {
  const okregNrs = Object.keys(raw.okregi).sort(numAsc);
  const komitetName: Record<string, string> = {};
  const obwodByNr: Record<string, ObwodInfo> = {};
  const okregi: Record<string, OkregModel> = {};
  let wyborcyGmina = 0;
  let mandatyGmina = 0;

  for (const nr of okregNrs) {
    const ok = raw.okregi[nr];
    wyborcyGmina += ok.wyborcy;
    mandatyGmina += ok.mandaty;
    for (const l of Object.keys(ok.kandydaci ?? {})) {
      if (ok.kandydaci[l].komitet) komitetName[l] = ok.kandydaci[l].komitet;
    }
    const obwodNrs = Object.keys(ok.obwody ?? {}).sort(numAsc);
    const votes: VotesMap = {};
    for (const onr of obwodNrs) {
      const ob = ok.obwody[onr];
      const obVotes: VotesMap = {};
      for (const l of Object.keys(ob.kandydaci ?? {})) {
        let s = 0;
        for (const pos of Object.keys(ob.kandydaci[l])) s += ob.kandydaci[l][pos].glosy ?? 0;
        obVotes[l] = s;
      }
      obwodByNr[onr] = {
        nr: onr,
        okreg: nr,
        wyborcy: ob.wyborcy,
        glosy: Object.values(obVotes).reduce((a, b) => a + b, 0),
        votes: obVotes,
      };
      addVotes(votes, obVotes);
    }
    okregi[nr] = {
      nr,
      mandaty: ok.mandaty,
      listy: ok.listy,
      wyborcy: ok.wyborcy,
      granice: ok.granice || '—',
      obwodNrs,
      votes,
      totalVotes: Object.values(votes).reduce((a, b) => a + b, 0),
      realSeats: allocate(votes, ok.mandaty, 'dh').seatsBy,
    };
  }

  return {
    teryt,
    nazwa: raw.gmina,
    organ: raw.organ,
    powiat: raw.powiat,
    wojewodztwo: raw.wojewodztwo,
    siedziba: raw.siedziba,
    okregNrs,
    okregi,
    komitetName,
    obwodByNr,
    obwodNrs: Object.keys(obwodByNr).sort(numAsc),
    wyborcyGmina,
    mandatyGmina,
  };
}

export const nameOf = (m: GminaModel, lista: string): string =>
  m.komitetName[lista] ?? 'Lista nr ' + lista;

export function votesOfSelection(model: GminaModel, sel: string[]): VotesMap {
  const v: VotesMap = {};
  for (const nr of sel) {
    const ob = model.obwodByNr[nr];
    if (ob) addVotes(v, ob.votes);
  }
  return v;
}

export const sumVotes = (v: VotesMap): number =>
  Object.values(v).reduce((a, b) => a + b, 0);

export function defaultMandaty(model: GminaModel, selWyborcy: number): number {
  return Math.max(1, Math.round((model.mandatyGmina * selWyborcy) / model.wyborcyGmina));
}

export const clampMandaty = (n: number): number => Math.min(60, Math.max(1, n));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/engine/derive.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/derive.ts src/engine/derive.test.ts
git commit -m "feat: gmina JSON -> typed model with real d'Hondt baselines"
```

---

### Task 7: URL state codec (`state/url.ts`)

**Files:**
- Create: `src/state/url.ts`
- Test: `src/state/url.test.ts`

**Interfaces:**
- Consumes: `Method` from `../engine/allocate`.
- Produces:
  - `type View = 'picker' | 'gmina' | 'builder'`
  - `interface AppState { view: View; teryt: string | null; sel: string[]; mandatyOverride: number | null; method: Method; compare: boolean }` — `sel` always deduplicated and numerically sorted
  - `parseHash(hash: string): AppState` — accepts with or without leading `#`; sanitizes everything
  - `toHash(s: AppState): string` — URLSearchParams string WITHOUT leading `#` (caller prepends). Params: `g`, `v`, `o` (dot-joined), `m`, `met=sl`, `cmp=1` — matching the mockup scheme exactly

- [ ] **Step 1: Write the failing tests — `src/state/url.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { AppState, parseHash, toHash } from './url';

const st = (p: Partial<AppState> = {}): AppState => ({
  view: 'picker', teryt: null, sel: [], mandatyOverride: null, method: 'dh', compare: false, ...p,
});

describe('round-trips', () => {
  const cases: AppState[] = [
    st(),
    st({ view: 'gmina', teryt: '020101' }),
    st({ view: 'builder', teryt: '020101', sel: ['1', '2', '14'], mandatyOverride: 5, method: 'sl', compare: true }),
    st({ view: 'builder', teryt: '020101', sel: ['3'] }),
  ];
  for (const s of cases) {
    it(JSON.stringify(s), () => {
      expect(parseHash(toHash(s))).toEqual(s);
    });
  }
});

describe('parseHash sanitization', () => {
  it('accepts a leading #', () => {
    expect(parseHash('#g=020101&v=gmina')).toEqual(st({ view: 'gmina', teryt: '020101' }));
  });

  it('garbage in, defaults out', () => {
    // no valid teryt → picker; sel still parsed & deduped; m clamped; met/cmp fall back
    expect(parseHash('g=abc&v=weird&o=1.x.2.2&m=999&met=xx&cmp=2')).toEqual(
      st({ sel: ['1', '2'], mandatyOverride: 60 }),
    );
  });

  it('clamps mandaty and dedupes/sorts selection', () => {
    const s = parseHash('g=020101&v=builder&o=10.2.10.1&m=999');
    expect(s.sel).toEqual(['1', '2', '10']);
    expect(s.mandatyOverride).toBe(60);
  });

  it('teryt without view → gmina; unknown view falls back', () => {
    expect(parseHash('g=020101').view).toBe('gmina');
    expect(parseHash('g=020101&v=nope').view).toBe('gmina');
  });

  it('empty hash → default state', () => {
    expect(parseHash('')).toEqual(st());
    expect(parseHash('#')).toEqual(st());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/state/url.test.ts`
Expected: FAIL — cannot resolve `./url`.

- [ ] **Step 3: Write `src/state/url.ts`**

```ts
import { Method } from '../engine/allocate';

export type View = 'picker' | 'gmina' | 'builder';

export interface AppState {
  view: View;
  teryt: string | null;
  sel: string[];
  mandatyOverride: number | null;
  method: Method;
  compare: boolean;
}

const numAsc = (a: string, b: string) => Number(a) - Number(b);

export function parseHash(hash: string): AppState {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const g = p.get('g') ?? '';
  const teryt = /^\d{6}$/.test(g) ? g : null;
  const v = p.get('v');
  const view: View = teryt ? (v === 'builder' ? 'builder' : 'gmina') : 'picker';
  const m = parseInt(p.get('m') ?? '', 10);
  const sel = [...new Set((p.get('o') ?? '').split('.').filter(s => /^\d+$/.test(s)))].sort(numAsc);
  return {
    view,
    teryt,
    sel,
    mandatyOverride: Number.isInteger(m) ? Math.min(60, Math.max(1, m)) : null,
    method: p.get('met') === 'sl' ? 'sl' : 'dh',
    compare: p.get('cmp') === '1',
  };
}

export function toHash(s: AppState): string {
  const p = new URLSearchParams();
  if (s.teryt) {
    p.set('g', s.teryt);
    p.set('v', s.view);
  }
  if (s.sel.length) p.set('o', s.sel.join('.'));
  if (s.mandatyOverride != null) p.set('m', String(s.mandatyOverride));
  if (s.method === 'sl') p.set('met', 'sl');
  if (s.compare) p.set('cmp', '1');
  return p.toString();
}
```

Note: the garbage-input test expects `sel: ['1','2']` even with `teryt: null` — selection params are parsed independently of the gmina; the App layer drops nrs that don't exist in the loaded gmina.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/state/url.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/url.ts src/state/url.test.ts
git commit -m "feat: hash URL codec with sanitizing round-trip"
```

---

### Task 8: App shell, stylesheet, PickerView

**Files:**
- Create: `src/app/PickerView.tsx`, `src/app/KomitetChip.tsx`
- Modify: `src/app/App.tsx` (replace stub), `src/styles.css` (replace entirely)

**Interfaces:**
- Consumes: `parseHash`, `toHash`, `AppState` from `../state/url`; `deriveGmina`, `GminaModel` from `../engine/derive`.
- Produces (used by Tasks 9–12):
  - `interface IndexEntry { teryt: string; name: string; wojewodztwo: string }` (exported from `App.tsx`)
  - `interface Preset { nazwa: string; opis?: string; obwody: string[] }`, `interface GminaConfig { presety?: Preset[] }` (exported from `App.tsx`)
  - `App` renders `<GminaView model onBuilder />` and `<BuilderView model config state patch />` — these components are created in Tasks 9–10; until then App renders inline minimal mains (shown below) that Tasks 9–10 replace
  - `patch(p: Partial<AppState>): void` — single state mutator, hash-synced
  - `listaColor(lista: string): string` and `KomitetChip({ lista })` from `KomitetChip.tsx`
  - The full app stylesheet: class names referenced by Tasks 9–12 (`.card`, `.sec-head`, `.tbl`, `.results`, etc.) are all defined here

- [ ] **Step 1: Write `src/app/KomitetChip.tsx`**

```tsx
const HUES = [250, 45, 160, 310, 200, 25, 100, 340, 70, 130];

export const listaColor = (lista: string): string =>
  `oklch(0.55 0.09 ${HUES[(Number(lista) - 1) % HUES.length]})`;

export const KomitetChip = ({ lista }: { lista: string }) => (
  <span class="chip" style={{ background: listaColor(lista) }} />
);
```

- [ ] **Step 2: Write `src/app/PickerView.tsx`**

```tsx
import { useState } from 'preact/hooks';
import type { IndexEntry } from './App';

interface Props {
  index: IndexEntry[];
  notice: string | null;
  onPick: (teryt: string) => void;
}

export function PickerView({ index, notice, onPick }: Props) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const hits = index.filter(g => !needle || `${g.name} ${g.wojewodztwo}`.toLowerCase().includes(needle));
  return (
    <main class="pick">
      <h1>Wybierz gminę</h1>
      <p class="pick-lead">
        Oficjalne wyniki wyborów do rad gmin w gminach powyżej 20&nbsp;tys. mieszkańców. Po wybraniu
        gminy możesz przeglądać wyniki okręgów i budować własne, wirtualne okręgi z dowolnych obwodów
        głosowania.
      </p>
      {notice && <p class="notice">{notice}</p>}
      <input
        class="pick-search"
        type="text"
        value={q}
        onInput={e => setQ((e.target as HTMLInputElement).value)}
        placeholder="Szukaj gminy lub województwa…"
      />
      <div class="pick-list">
        {hits.map(g => (
          <div key={g.teryt} class="pick-row" onClick={() => onPick(g.teryt)}>
            <div class="pick-name">{g.name}</div>
            <div class="pick-detail">woj. {g.wojewodztwo}</div>
            <div class="pick-teryt">TERYT {g.teryt}</div>
          </div>
        ))}
        {hits.length === 0 && <div class="pick-empty">Brak gmin pasujących do zapytania.</div>}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Replace `src/app/App.tsx`**

```tsx
import { useEffect, useRef, useState } from 'preact/hooks';
import { deriveGmina, GminaModel } from '../engine/derive';
import { AppState, parseHash, toHash } from '../state/url';
import { PickerView } from './PickerView';

export interface IndexEntry { teryt: string; name: string; wojewodztwo: string }
export interface Preset { nazwa: string; opis?: string; obwody: string[] }
export interface GminaConfig { presety?: Preset[] }
interface GminaBundle { model: GminaModel; config: GminaConfig | null }

const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;

export function App() {
  const [state, setState] = useState<AppState>(() => parseHash(location.hash));
  const [index, setIndex] = useState<IndexEntry[] | null>(null);
  const [indexError, setIndexError] = useState(false);
  const [indexTry, setIndexTry] = useState(0);
  const [bundle, setBundle] = useState<GminaBundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cache = useRef(new Map<string, GminaBundle>());

  const patch = (p: Partial<AppState>) => {
    setLoadError(null);
    setState(s => ({ ...s, ...p }));
  };

  useEffect(() => {
    history.replaceState(null, '', '#' + toHash(state));
  }, [state]);

  useEffect(() => {
    setIndexError(false);
    fetch(dataUrl('index.json'))
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((j: IndexEntry[]) => setIndex(j))
      .catch(() => setIndexError(true));
  }, [indexTry]);

  useEffect(() => {
    const teryt = state.teryt;
    if (!teryt) { setBundle(null); return; }
    const hit = cache.current.get(teryt);
    if (hit) { setBundle(hit); return; }
    setLoading(true);
    setBundle(null);
    Promise.all([
      fetch(dataUrl(`${teryt}.json`)).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch(dataUrl(`${teryt}.config.json`)).then(r => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([raw, config]) => {
        const b: GminaBundle = { model: deriveGmina(teryt, raw[teryt]), config };
        cache.current.set(teryt, b);
        setBundle(b);
      })
      .catch(() => {
        setLoadError('Nie udało się wczytać danych gminy.');
        setState(s => ({ ...s, view: 'picker', teryt: null, sel: [] }));
      })
      .finally(() => setLoading(false));
  }, [state.teryt]);

  // Drop selected obwód numbers that don't exist in the loaded gmina (stale links).
  useEffect(() => {
    if (!bundle) return;
    const valid = state.sel.filter(nr => bundle.model.obwodByNr[nr]);
    if (valid.length !== state.sel.length) setState(s => ({ ...s, sel: valid }));
  }, [bundle, state.sel]);

  const model = bundle?.model ?? null;
  const view = model ? state.view : state.teryt && (loading || !index) ? 'loading' : 'picker';

  return (
    <div class="page">
      <header class="hdr">
        <div class="hdr-in">
          <div class="hdr-title" onClick={() => patch({ view: 'picker', teryt: null, sel: [], mandatyOverride: null })}>
            Wybory samorządowe 2024
          </div>
          <div class="hdr-sub">rady gmin powyżej 20 tys. mieszkańców · przelicznik wirtualnych okręgów</div>
          <nav class="crumbs">
            <span class="crumb" onClick={() => patch({ view: 'picker', teryt: null, sel: [], mandatyOverride: null })}>Gminy</span>
            {model && view !== 'picker' && (
              <>
                <span class="crumb-sep">/</span>
                <span class="crumb" onClick={() => patch({ view: 'gmina' })}>{model.nazwa}</span>
              </>
            )}
            {model && view === 'builder' && (
              <>
                <span class="crumb-sep">/</span>
                <span class="crumb-cur">Okręg wirtualny</span>
              </>
            )}
          </nav>
        </div>
      </header>

      {view === 'picker' && (
        indexError ? (
          <main class="pick">
            <div class="load-error">
              <p>Nie udało się wczytać indeksu gmin.</p>
              <button class="btn-primary" onClick={() => setIndexTry(n => n + 1)}>Spróbuj ponownie</button>
            </div>
          </main>
        ) : index ? (
          <PickerView
            index={index}
            notice={loadError}
            onPick={teryt => patch({ teryt, view: 'gmina', sel: [], mandatyOverride: null })}
          />
        ) : (
          <main class="pick"><p class="loading">Wczytywanie…</p></main>
        )
      )}
      {view === 'loading' && <main class="wide"><p class="loading">Wczytywanie…</p></main>}
      {view === 'gmina' && model && (
        <main class="wide">
          <div class="view-head">
            <div>
              <h1>{model.nazwa}</h1>
              <div class="view-sub">{model.organ} · {model.powiat}, woj. {model.wojewodztwo} · siedziba: {model.siedziba}</div>
            </div>
            <button class="btn-primary" onClick={() => patch({ view: 'builder' })}>Zbuduj okręg wirtualny →</button>
          </div>
        </main>
      )}
      {view === 'builder' && model && (
        <main class="wide">
          <h1>Okręg wirtualny — {model.nazwa}</h1>
        </main>
      )}

      <footer class="ftr">
        <div class="ftr-in">
          <span>Dane: Państwowa Komisja Wyborcza — wybory do rad gmin, 7 kwietnia 2024</span>
          <span class="ftr-right">Narzędzie poglądowe. Nie stanowi oficjalnej interpretacji wyników.</span>
        </div>
      </footer>
    </div>
  );
}
```

(The two inline `<main class="wide">` blocks are working minimal views; Task 9 replaces the gmina one with `<GminaView model={model} onBuilder={() => patch({ view: 'builder' })} />` and Task 10 replaces the builder one with `<BuilderView model={model} config={bundle!.config} state={state} patch={patch} />`.)

- [ ] **Step 4: Replace `src/styles.css` with the complete app stylesheet**

```css
/* ===== tokens & base ===== */
:root {
  --paper: #F6F5F2; --ink: #1C1B1A; --card: #FFFFFF;
  --line: #E3E0DB; --line-soft: #EFEDE9; --head-bg: #FBFAF8;
  --dim: #6B6660; --faint: #9B958D; --mute: #B5B0A8; --dark: #444038;
  --crimson: #9E1B32; --crimson-dark: #7A1526; --blue: #1D5C87;
  --green: #2F6B4F; --hover: #FBF6F4; --sel: #FBF1F0; --border-input: #D8D4CE;
  --sans: 'IBM Plex Sans', sans-serif; --mono: 'IBM Plex Mono', monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--paper); }
body { font-family: var(--sans); color: var(--ink); font-size: 14px; }
button { font-family: var(--sans); }
.mono { font-family: var(--mono); }
.b { font-weight: 600; }
.dim { color: var(--dim); }
.pos { color: var(--green); }
.neg { color: var(--crimson); }
input[type='checkbox'] { accent-color: var(--crimson); width: 15px; height: 15px; flex: none; }

/* ===== layout ===== */
.page { min-height: 100vh; display: flex; flex-direction: column; }
main { flex: 1; width: 100%; }
.pick { max-width: 720px; margin: 0 auto; padding: 48px 24px 80px; }
.wide { max-width: 1240px; margin: 0 auto; padding: 32px 24px 80px; }
h1 { font-size: 26px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
.loading { color: var(--dim); }

/* ===== header / footer ===== */
.hdr { background: var(--card); border-top: 4px solid var(--crimson); border-bottom: 1px solid var(--line); }
.hdr-in { max-width: 1240px; margin: 0 auto; padding: 14px 24px; display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; }
.hdr-title { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; cursor: pointer; }
.hdr-sub { font-size: 13px; color: var(--dim); }
.crumbs { margin-left: auto; display: flex; gap: 6px; font-size: 13px; align-items: center; }
.crumb { color: var(--crimson); cursor: pointer; font-weight: 500; }
.crumb-sep { color: var(--mute); }
.crumb-cur { color: var(--dim); font-weight: 500; }
.ftr { border-top: 1px solid var(--line); background: var(--card); }
.ftr-in { max-width: 1240px; margin: 0 auto; padding: 16px 24px; font-size: 12px; color: var(--faint); display: flex; gap: 16px; flex-wrap: wrap; }
.ftr-right { margin-left: auto; }

/* ===== picker ===== */
.pick h1 { margin-bottom: 6px; }
.pick-lead { font-size: 14px; color: var(--dim); margin: 0 0 24px; line-height: 1.5; }
.notice { padding: 10px 14px; background: var(--sel); border: 1px solid var(--crimson); border-radius: 4px; font-size: 13px; color: var(--crimson-dark); }
.pick-search { width: 100%; padding: 12px 16px; font-size: 15px; font-family: var(--sans); border: 1px solid var(--border-input); border-radius: 4px; background: var(--card); outline: none; }
.pick-search:focus { border-color: var(--crimson); box-shadow: 0 0 0 3px rgba(158, 27, 50, 0.1); }
.pick-list { margin-top: 16px; background: var(--card); border: 1px solid var(--line); border-radius: 4px; overflow: hidden; }
.pick-row { display: flex; align-items: baseline; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--line-soft); cursor: pointer; }
.pick-row:hover { background: var(--hover); }
.pick-name { font-weight: 600; font-size: 15px; }
.pick-detail { font-size: 13px; color: var(--dim); }
.pick-teryt { margin-left: auto; font-family: var(--mono); font-size: 12px; color: var(--faint); }
.pick-empty { padding: 24px 16px; font-size: 14px; color: var(--dim); }
.load-error { padding: 48px 0; }
.load-error .btn-primary { margin-left: 0; }

/* ===== view head, buttons, stat strips ===== */
.view-head { display: flex; align-items: flex-start; gap: 24px; flex-wrap: wrap; margin-bottom: 20px; }
.view-sub { font-size: 14px; color: var(--dim); margin-top: 4px; }
.btn-primary { margin-left: auto; padding: 12px 20px; background: var(--crimson); color: #fff; border: none; border-radius: 4px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn-primary:hover { background: var(--crimson-dark); }
.btn-ghost { margin-left: auto; padding: 10px 16px; background: var(--card); color: var(--ink); border: 1px solid var(--border-input); border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-ghost:hover { border-color: var(--crimson); color: var(--crimson); }
.stats-strip { display: flex; gap: 32px; flex-wrap: wrap; padding: 14px 0 6px; border-bottom: 2px solid var(--ink); margin-bottom: 24px; }
.stat-val { font-family: var(--mono); font-size: 20px; font-weight: 600; }
.stat-lbl { font-size: 12px; color: var(--dim); }

/* ===== cards & section heads ===== */
.card { background: var(--card); border: 1px solid var(--line); border-radius: 4px; margin-bottom: 20px; overflow: hidden; }
.card-head { display: flex; align-items: baseline; gap: 16px; padding: 14px 20px; border-bottom: 1px solid var(--line); background: var(--head-bg); flex-wrap: wrap; }
.card-title { font-size: 16px; font-weight: 700; }
.card-meta { font-family: var(--mono); font-size: 13px; color: var(--dark); }
.sec-head { display: flex; align-items: baseline; gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--line); background: var(--head-bg); flex-wrap: wrap; }
.sec-title { font-size: 14px; font-weight: 700; }
.sec-sub { font-size: 12px; color: var(--dim); }
.link-btn { font-size: 12px; color: var(--crimson); cursor: pointer; font-weight: 500; }
.sec-head .link-btn { margin-left: auto; }

/* ===== tables ===== */
.tbl-wrap { overflow-x: auto; }
.tbl-wrap.pad { padding: 16px 20px; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl thead tr { border-bottom: 2px solid var(--ink); }
.tbl th { padding: 4px 8px 6px; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--dim); text-align: right; }
.tbl th.l { text-align: left; padding-left: 0; }
.tbl th.c { text-align: center; }
.tbl td { padding: 6px 8px; }
.tbl td:first-child { padding-left: 0; }
.tbl tbody tr { border-bottom: 1px solid var(--line-soft); }
.tbl .r { text-align: right; }
.tbl .c { text-align: center; }
.kom { display: flex; align-items: center; gap: 8px; }
.chip { display: inline-block; width: 10px; height: 10px; border-radius: 2px; flex: none; }
.kom-name { font-weight: 500; }
.col-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--dim); margin-bottom: 8px; }

/* ===== gmina overview ===== */
.okreg-grid { display: grid; grid-template-columns: minmax(420px, 3fr) minmax(300px, 2fr); }
.okreg-col { padding: 16px 20px; }
.okreg-col:first-child { border-right: 1px solid var(--line-soft); }
.granice { border-top: 1px solid var(--line-soft); }
.granice summary { padding: 10px 20px; font-size: 12px; color: var(--dim); cursor: pointer; }
.granice div { padding: 0 20px 14px; font-size: 12px; color: var(--dim); line-height: 1.6; }
@media (max-width: 900px) {
  .okreg-grid { grid-template-columns: 1fr; }
  .okreg-col:first-child { border-right: none; border-bottom: 1px solid var(--line-soft); }
}

/* ===== builder: presets & obwody ===== */
.presets { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 12px 20px; border-bottom: 1px solid var(--line-soft); }
.presets-lbl { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--dim); }
.preset { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 14px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid var(--border-input); background: var(--card); color: var(--dark); }
.preset.on { border-color: var(--crimson); background: var(--crimson); color: #fff; }
.obwody-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0 24px; padding: 8px 20px 16px; }
.obwody-head { display: flex; align-items: center; gap: 8px; padding: 8px 6px; border-bottom: 2px solid var(--ink); cursor: pointer; margin-top: 8px; }
.obwody-okreg { font-size: 13px; font-weight: 700; }
.obwody-count { font-family: var(--mono); font-size: 12px; color: var(--dim); margin-left: auto; }
.obwod-row { display: flex; align-items: center; gap: 8px; padding: 7px 6px; border-bottom: 1px solid var(--line-soft); cursor: pointer; }
.obwod-row:hover { background: var(--hover); }
.obwod-row.on { background: var(--sel); }
.obwod-nr { font-family: var(--mono); font-size: 13px; width: 44px; }
.obwod-meta { font-family: var(--mono); font-size: 12px; color: var(--dim); margin-left: auto; }

/* ===== builder: empty state & params ===== */
.empty { background: var(--card); border: 1px dashed #C9C4BC; border-radius: 4px; padding: 48px 24px; text-align: center; }
.empty-t { font-size: 15px; font-weight: 600; color: var(--dark); }
.empty-s { font-size: 13px; color: var(--dim); margin-top: 6px; }
.params { display: flex; gap: 32px; flex-wrap: wrap; padding: 16px 20px; align-items: flex-start; }
.params-stats { display: flex; gap: 28px; flex-wrap: wrap; }
.params-block { border-left: 1px solid var(--line-soft); padding-left: 28px; }
@media (max-width: 900px) { .params-block { border-left: none; padding-left: 0; } }
.mandaty-row { display: flex; align-items: center; gap: 10px; }
.mandaty-input { width: 72px; padding: 8px 10px; font-size: 18px; font-weight: 600; font-family: var(--mono); border: 1px solid var(--border-input); border-radius: 4px; outline: none; }
.mandaty-input:focus { border-color: var(--crimson); }
.formula { font-family: var(--mono); font-size: 12px; color: var(--dim); margin-top: 8px; line-height: 1.5; }
.method-toggle { display: flex; border: 1px solid var(--border-input); border-radius: 4px; overflow: hidden; width: fit-content; }
.method-btn { padding: 10px 18px; border: none; cursor: pointer; text-align: left; background: var(--card); color: var(--dim); }
.method-btn.dh.on { background: var(--crimson); color: #fff; }
.method-btn.sl.on { background: var(--blue); color: #fff; }
.method-name { display: block; font-size: 14px; font-weight: 700; }
.method-tag { display: block; font-size: 11px; opacity: 0.85; }
.compare-toggle { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 13px; cursor: pointer; color: var(--dark); }

/* ===== results panel ===== */
.results { background: var(--card); border: 1px solid var(--line); border-radius: 4px; overflow: hidden; margin-bottom: 20px; }
.results.dh { border-left: 5px solid var(--crimson); }
.results.sl { border-left: 5px solid var(--blue); }
.results.cmp { border-left: 5px solid var(--ink); }
.results-banner { padding: 14px 20px; display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
.results.dh .results-banner { background: var(--crimson); }
.results.sl .results-banner { background: var(--blue); }
.results.cmp .results-banner { background: var(--ink); }
.banner-t { font-size: 15px; font-weight: 700; color: #fff; }
.banner-s { font-size: 12px; color: rgba(255, 255, 255, 0.85); }
.results > .tbl-wrap { padding: 16px 20px 4px; }
.no-votes { padding: 32px 20px; font-size: 14px; color: var(--dim); }
.results-tbl td { padding: 8px; }
.results-tbl td:first-child { padding-left: 0; }
.results-tbl th.gap-col, .results-tbl td.gap-col { text-align: left; padding-left: 20px; }
.seats { font-weight: 700; font-size: 15px; }
.dots { font-size: 10px; letter-spacing: 2px; }
.badge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: var(--crimson); color: #fff; padding: 2px 7px; border-radius: 10px; white-space: nowrap; }
tr.closest { background: var(--sel); }
tr.seatless { color: var(--dim); }
.gap-margin { font-size: 13px; color: var(--green); font-weight: 500; }
.gap-missing { font-size: 13px; color: var(--dim); }
.gap-missing.hot { color: var(--crimson); font-weight: 600; }
.results-tbl th.th-dh { color: var(--crimson); border-left: 1px solid var(--line-soft); }
.results-tbl th.th-sl { color: var(--blue); }
.results-tbl td.bl { border-left: 1px solid var(--line-soft); }
tr.differs { background: #FDF8EA; }
.diff-pill { background: #F6E7B8; color: #6B4E00; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
.identical { margin: 12px 0 8px; padding: 10px 14px; background: #F4F3F0; border-radius: 4px; font-size: 13px; color: var(--dark); }

/* ===== summaries ===== */
.summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; padding: 12px 20px 20px; }
.summary-card { border: 1px solid var(--line); border-radius: 4px; padding: 14px 16px; background: var(--head-bg); }
.sum-t { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--dim); }
.sum-v { font-family: var(--mono); font-size: 19px; font-weight: 600; margin-top: 6px; }
.sum-n { font-size: 12px; color: var(--dim); margin-top: 4px; line-height: 1.5; }
.no-effect { margin: 0 20px 20px; padding: 12px 16px; background: var(--ink); color: var(--paper); border-radius: 4px; font-size: 13px; display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.ne-v { font-family: var(--mono); font-size: 15px; font-weight: 600; }
.ne-n { color: var(--mute); }

/* ===== divisor table ===== */
.div-details { border-top: 1px solid var(--line-soft); }
.div-details summary { padding: 12px 20px; font-size: 13px; font-weight: 600; color: var(--dark); cursor: pointer; }
.div-details .tbl-wrap { padding: 4px 20px 20px; }
.div-tbl { width: auto; font-size: 12px; }
.div-tbl th, .div-tbl td { padding: 5px 10px; }
.div-name { font-weight: 500; white-space: nowrap; padding-right: 12px; }
.cell-win { background: #EFE9E4; font-weight: 600; }
.cell-lose { color: var(--mute); }
.cell-last { color: #fff; font-weight: 600; border-radius: 3px; }
.cell-last.dh { background: var(--crimson); }
.cell-last.sl { background: var(--blue); }
.div-legend { font-size: 12px; color: var(--dim); margin-top: 10px; line-height: 1.6; }
```

- [ ] **Step 5: Verify build + serve**

```bash
pnpm build
pnpm exec vite preview --port 4173 &
sleep 1
curl -s http://localhost:4173/wyboryzator/ | grep -o '<title>[^<]*</title>'
curl -s http://localhost:4173/wyboryzator/data/index.json | head -c 120
kill %1
```
Expected: title `Wybory samorządowe 2024 — przelicznik wirtualnych okręgów`; index.json starts with `[{"teryt":`.

Manual check (dev server `pnpm dev`, open `http://localhost:5173/wyboryzator/`): picker with search; typing `bolesł` filters to `m. Bolesławiec / woj. dolnośląskie / TERYT 020101`; clicking it shows the gmina heading and the URL hash becomes `#g=020101&v=gmina`; reloading restores the view; the crumb `Gminy` returns to the picker.

- [ ] **Step 6: Commit**

```bash
git add src/app src/styles.css
git commit -m "feat: app shell with hash routing, data loading, picker view, full stylesheet"
```

---

### Task 9: GminaView

**Files:**
- Create: `src/app/GminaView.tsx`
- Modify: `src/app/App.tsx` (replace the inline gmina `<main>` with the component)

**Interfaces:**
- Consumes: `GminaModel`, `nameOf` from `../engine/derive`; `fmt`, `fmtPct` from `../engine/format`; `KomitetChip`; stylesheet classes from Task 8.
- Produces: `GminaView({ model, onBuilder }: { model: GminaModel; onBuilder: () => void })`.

- [ ] **Step 1: Write `src/app/GminaView.tsx`**

```tsx
import { GminaModel, nameOf } from '../engine/derive';
import { fmt, fmtPct } from '../engine/format';
import { KomitetChip } from './KomitetChip';

interface Props {
  model: GminaModel;
  onBuilder: () => void;
}

export function GminaView({ model, onBuilder }: Props) {
  const stats = [
    { value: String(model.okregNrs.length), label: 'okręgi wyborcze' },
    { value: String(model.mandatyGmina), label: 'mandaty w radzie' },
    { value: fmt(model.wyborcyGmina), label: 'wyborcy uprawnieni' },
    { value: String(model.obwodNrs.length), label: 'obwody głosowania' },
  ];
  return (
    <main class="wide">
      <div class="view-head">
        <div>
          <h1>{model.nazwa}</h1>
          <div class="view-sub">
            {model.organ} · {model.powiat}, woj. {model.wojewodztwo} · siedziba: {model.siedziba}
          </div>
        </div>
        <button class="btn-primary" onClick={onBuilder}>Zbuduj okręg wirtualny →</button>
      </div>
      <div class="stats-strip">
        {stats.map(s => (
          <div key={s.label}>
            <div class="stat-val">{s.value}</div>
            <div class="stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {model.okregNrs.map(nr => {
        const ok = model.okregi[nr];
        const rows = Object.keys(ok.votes).sort((a, b) => ok.votes[b] - ok.votes[a]);
        return (
          <section key={nr} class="card">
            <div class="card-head">
              <div class="card-title">Okręg nr {nr}</div>
              <div class="card-meta">
                {ok.mandaty} mandatów · {ok.listy} list · {fmt(ok.wyborcy)} wyborców · {fmt(ok.totalVotes)} głosów ważnych
              </div>
            </div>
            <div class="okreg-grid">
              <div class="okreg-col">
                <div class="col-label">Wyniki komitetów · podział mandatów (d'Hondt)</div>
                <div class="tbl-wrap">
                  <table class="tbl">
                    <thead>
                      <tr><th class="l">Komitet</th><th>Głosy</th><th>%</th><th>Mandaty</th></tr>
                    </thead>
                    <tbody>
                      {rows.map(l => (
                        <tr key={l}>
                          <td><span class="kom"><KomitetChip lista={l} /><span class="kom-name">{nameOf(model, l)}</span></span></td>
                          <td class="r mono">{fmt(ok.votes[l])}</td>
                          <td class="r mono dim">{ok.totalVotes ? fmtPct((100 * ok.votes[l]) / ok.totalVotes) : '—'}</td>
                          <td class="r mono b">{ok.realSeats[l] ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="okreg-col">
                <div class="col-label">Obwody głosowania</div>
                <div class="tbl-wrap">
                  <table class="tbl">
                    <thead>
                      <tr><th class="l">Obwód</th><th>Wyborcy</th><th>Głosy ważne</th><th>% wyborców</th></tr>
                    </thead>
                    <tbody>
                      {ok.obwodNrs.map(onr => {
                        const ob = model.obwodByNr[onr];
                        return (
                          <tr key={onr}>
                            <td class="mono">nr {onr}</td>
                            <td class="r mono">{fmt(ob.wyborcy)}</td>
                            <td class="r mono">{fmt(ob.glosy)}</td>
                            <td class="r mono dim">{ob.wyborcy ? fmtPct((100 * ob.glosy) / ob.wyborcy) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <details class="granice">
              <summary>Granice okręgu</summary>
              <div>{ok.granice}</div>
            </details>
          </section>
        );
      })}
    </main>
  );
}
```

- [ ] **Step 2: Wire into `src/app/App.tsx`**

Add the import:
```tsx
import { GminaView } from './GminaView';
```
Replace the entire `{view === 'gmina' && model && ( <main class="wide"> … </main> )}` block with:
```tsx
{view === 'gmina' && model && (
  <GminaView model={model} onBuilder={() => patch({ view: 'builder' })} />
)}
```

- [ ] **Step 3: Verify**

```bash
pnpm build
pnpm test
```
Expected: both pass. Manual check (`pnpm dev`, open `http://localhost:5173/wyboryzator/#g=020101&v=gmina`): Bolesławiec shows stats `4 / 21 / 28 861 / 24`; four okręg cards; okręg 1's table shows KKW KOALICJA OBYWATELSKA first with 997 głosy and 2 mandaty; "Granice okręgu" expands.

- [ ] **Step 4: Commit**

```bash
git add src/app/GminaView.tsx src/app/App.tsx
git commit -m "feat: gmina overview with real d'Hondt results per okręg"
```

---

### Task 10: BuilderView skeleton — selector, empty state, params, copy link

**Files:**
- Create: `src/app/BuilderView.tsx`, `src/app/ObwodySelector.tsx`, `src/app/ParamsPanel.tsx`
- Modify: `src/app/App.tsx` (replace the inline builder `<main>`)

**Interfaces:**
- Consumes: engine helpers (`votesOfSelection`, `sumVotes`, `defaultMandaty`, `clampMandaty`, `allocate`, `analyze`), `AppState`, `patch`, `GminaConfig`/`Preset` from `App.tsx`.
- Produces:
  - `BuilderView({ model, config, state, patch }: { model: GminaModel; config: GminaConfig | null; state: AppState; patch: (p: Partial<AppState>) => void })`
  - `ObwodySelector({ model, config, selSet, onToggle, onToggleGroup, onPreset, onClear })` with `onToggle(nr: string)`, `onToggleGroup(nrs: string[], allOn: boolean)`, `onPreset(nrs: string[], active: boolean)`, `onClear()`
  - `ParamsPanel({ model, state, patch, selCount, selWyborcy, selVotes, defMandaty, mandaty })` — all numbers plain `number`
  - BuilderView computes and (in Task 11) passes down: `allocDh`, `allocSl`, `infoDh`, `infoSl`, `votes`, `selVotes`, `mandaty`

- [ ] **Step 1: Write `src/app/ObwodySelector.tsx`**

```tsx
import { GminaModel } from '../engine/derive';
import { fmt } from '../engine/format';
import type { GminaConfig } from './App';

interface Props {
  model: GminaModel;
  config: GminaConfig | null;
  selSet: Set<string>;
  onToggle: (nr: string) => void;
  onToggleGroup: (nrs: string[], allOn: boolean) => void;
  onPreset: (nrs: string[], active: boolean) => void;
  onClear: () => void;
}

export function ObwodySelector({ model, config, selSet, onToggle, onToggleGroup, onPreset, onClear }: Props) {
  const presety = (config?.presety ?? [])
    .map(p => {
      const obw = (p.obwody ?? []).map(String).filter(nr => model.obwodByNr[nr]);
      return { nazwa: p.nazwa, opis: p.opis, obw, active: obw.length > 0 && obw.every(nr => selSet.has(nr)) };
    })
    .filter(p => p.obw.length > 0);

  return (
    <section class="card">
      <div class="sec-head">
        <div class="sec-title">1. Wybór obwodów</div>
        <div class="sec-sub">obwody pogrupowane wg rzeczywistych okręgów</div>
        <span class="link-btn" onClick={onClear}>wyczyść zaznaczenie</span>
      </div>
      {presety.length > 0 && (
        <div class="presets">
          <span class="presets-lbl">Gotowe zestawy (nazwy zwyczajowe):</span>
          {presety.map(p => (
            <span
              key={p.nazwa}
              class={p.active ? 'preset on' : 'preset'}
              title={`${p.opis ? p.opis + ' · ' : ''}obwody: ${p.obw.join(', ')} · kliknij, aby ${p.active ? 'usunąć z' : 'dodać do'} zaznaczenia`}
              onClick={() => onPreset(p.obw, p.active)}
            >
              {p.active ? '✓ ' : '+ '}{p.nazwa}
            </span>
          ))}
        </div>
      )}
      <div class="obwody-grid">
        {model.okregNrs.map(nr => {
          const ok = model.okregi[nr];
          const allOn = ok.obwodNrs.length > 0 && ok.obwodNrs.every(o => selSet.has(o));
          return (
            <div key={nr}>
              <label class="obwody-head">
                <input type="checkbox" checked={allOn} onChange={() => onToggleGroup(ok.obwodNrs, allOn)} />
                <span class="obwody-okreg">Okręg nr {nr}</span>
                <span class="obwody-count">{ok.obwodNrs.length} obw.</span>
              </label>
              {ok.obwodNrs.map(onr => {
                const ob = model.obwodByNr[onr];
                const on = selSet.has(onr);
                return (
                  <label key={onr} class={on ? 'obwod-row on' : 'obwod-row'}>
                    <input type="checkbox" checked={on} onChange={() => onToggle(onr)} />
                    <span class="obwod-nr">nr {onr}</span>
                    <span class="obwod-meta">{fmt(ob.wyborcy)} wyb. · {fmt(ob.glosy)} gł.</span>
                  </label>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `src/app/ParamsPanel.tsx`**

```tsx
import { GminaModel } from '../engine/derive';
import { fmt, fmtDec } from '../engine/format';
import { AppState } from '../state/url';

interface Props {
  model: GminaModel;
  state: AppState;
  patch: (p: Partial<AppState>) => void;
  selCount: number;
  selWyborcy: number;
  selVotes: number;
  defMandaty: number;
  mandaty: number;
}

export function ParamsPanel({ model, state, patch, selCount, selWyborcy, selVotes, defMandaty, mandaty }: Props) {
  const raw = (model.mandatyGmina * selWyborcy) / model.wyborcyGmina;
  const overridden = state.mandatyOverride != null && state.mandatyOverride !== defMandaty;
  return (
    <section class="card">
      <div class="sec-head"><div class="sec-title">2. Parametry przeliczenia</div></div>
      <div class="params">
        <div class="params-stats">
          <div><div class="stat-val">{selCount}</div><div class="stat-lbl">zaznaczone obwody</div></div>
          <div><div class="stat-val">{fmt(selWyborcy)}</div><div class="stat-lbl">wyborcy uprawnieni</div></div>
          <div><div class="stat-val">{fmt(selVotes)}</div><div class="stat-lbl">głosy ważne</div></div>
        </div>
        <div class="params-block">
          <div class="col-label">Mandaty do obsadzenia</div>
          <div class="mandaty-row">
            <input
              class="mandaty-input"
              type="number"
              min={1}
              max={60}
              value={mandaty}
              onInput={e => {
                const v = parseInt((e.target as HTMLInputElement).value, 10);
                patch({ mandatyOverride: Number.isInteger(v) && v >= 1 ? Math.min(60, v) : null });
              }}
            />
            {overridden && (
              <span class="link-btn" onClick={() => patch({ mandatyOverride: null })}>
                przywróć domyślne ({defMandaty})
              </span>
            )}
          </div>
          <div class="formula">
            domyślnie: {model.mandatyGmina} mandatów × ({fmt(selWyborcy)} ∕ {fmt(model.wyborcyGmina)} wyborców) = {fmtDec(raw, 2)} ≈ {defMandaty}
          </div>
        </div>
        <div class="params-block">
          <div class="col-label">Metoda podziału mandatów</div>
          <div class="method-toggle">
            <button class={state.method === 'dh' ? 'method-btn dh on' : 'method-btn dh'} onClick={() => patch({ method: 'dh' })}>
              <span class="method-name">d'Hondt</span>
              <span class="method-tag">metoda ustawowa</span>
            </button>
            <button class={state.method === 'sl' ? 'method-btn sl on' : 'method-btn sl'} onClick={() => patch({ method: 'sl' })}>
              <span class="method-name">Sainte-Laguë</span>
              <span class="method-tag">wariant hipotetyczny</span>
            </button>
          </div>
          <label class="compare-toggle">
            <input type="checkbox" checked={state.compare} onChange={() => patch({ compare: !state.compare })} />
            Porównaj obie metody obok siebie
          </label>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Write `src/app/BuilderView.tsx`**

```tsx
import { useMemo, useState } from 'preact/hooks';
import { allocate } from '../engine/allocate';
import { analyze } from '../engine/analytics';
import { GminaModel, clampMandaty, defaultMandaty, sumVotes, votesOfSelection } from '../engine/derive';
import { AppState } from '../state/url';
import type { GminaConfig } from './App';
import { ObwodySelector } from './ObwodySelector';
import { ParamsPanel } from './ParamsPanel';

interface Props {
  model: GminaModel;
  config: GminaConfig | null;
  state: AppState;
  patch: (p: Partial<AppState>) => void;
}

const numAsc = (a: string, b: string) => Number(a) - Number(b);

export function BuilderView({ model, config, state, patch }: Props) {
  const [copied, setCopied] = useState(false);
  const selSet = useMemo(() => new Set(state.sel), [state.sel]);
  const votes = useMemo(() => votesOfSelection(model, state.sel), [model, state.sel]);
  const selVotes = sumVotes(votes);
  const selWyborcy = state.sel.reduce((a, nr) => a + (model.obwodByNr[nr]?.wyborcy ?? 0), 0);
  const defMandaty = defaultMandaty(model, selWyborcy);
  const mandaty = clampMandaty(state.mandatyOverride ?? defMandaty);

  const allocDh = useMemo(() => allocate(votes, mandaty, 'dh'), [votes, mandaty]);
  const allocSl = useMemo(() => allocate(votes, mandaty, 'sl'), [votes, mandaty]);
  const infoDh = useMemo(() => analyze(votes, allocDh, 'dh'), [votes, allocDh]);
  const infoSl = useMemo(() => analyze(votes, allocSl, 'sl'), [votes, allocSl]);

  const setSel = (s: Set<string>) => patch({ sel: [...s].sort(numAsc) });
  const onToggle = (nr: string) => {
    const s = new Set(selSet);
    s.has(nr) ? s.delete(nr) : s.add(nr);
    setSel(s);
  };
  const onToggleGroup = (nrs: string[], allOn: boolean) => {
    const s = new Set(selSet);
    for (const nr of nrs) allOn ? s.delete(nr) : s.add(nr);
    setSel(s);
  };
  const onPreset = (nrs: string[], active: boolean) => {
    const s = new Set(selSet);
    for (const nr of nrs) active ? s.delete(nr) : s.add(nr);
    patch({ sel: [...s].sort(numAsc), mandatyOverride: null });
  };
  const onClear = () => patch({ sel: [], mandatyOverride: null });

  const copyLink = () => {
    navigator.clipboard?.writeText(location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <main class="wide">
      <div class="view-head">
        <div>
          <h1>Okręg wirtualny — {model.nazwa}</h1>
          <div class="view-sub">Zaznacz dowolne obwody głosowania, a mandaty zostaną przeliczone tak, jakby tworzyły jeden okręg.</div>
        </div>
        <button class="btn-ghost" onClick={copyLink}>{copied ? 'Skopiowano ✓' : 'Kopiuj link do tego okręgu'}</button>
      </div>

      <ObwodySelector
        model={model} config={config} selSet={selSet}
        onToggle={onToggle} onToggleGroup={onToggleGroup} onPreset={onPreset} onClear={onClear}
      />

      {state.sel.length === 0 ? (
        <section class="empty">
          <div class="empty-t">Nie zaznaczono żadnego obwodu</div>
          <div class="empty-s">Zaznacz obwody powyżej — liczba mandatów, podział głosów i wynik przeliczenia pojawią się tutaj automatycznie.</div>
        </section>
      ) : (
        <ParamsPanel
          model={model} state={state} patch={patch}
          selCount={state.sel.length} selWyborcy={selWyborcy} selVotes={selVotes}
          defMandaty={defMandaty} mandaty={mandaty}
        />
      )}
    </main>
  );
}
```

(`allocDh`/`allocSl`/`infoDh`/`infoSl` are computed but not yet rendered — Task 11 adds `<ResultsPanel>` and Task 12 `<RealComparison>` after `<ParamsPanel>`. If the linter complains about unused variables, prefix nothing — Task 11 lands immediately after.)

- [ ] **Step 4: Wire into `src/app/App.tsx`**

Add the import:
```tsx
import { BuilderView } from './BuilderView';
```
Replace the entire `{view === 'builder' && model && ( <main class="wide"> … </main> )}` block with:
```tsx
{view === 'builder' && model && (
  <BuilderView model={model} config={bundle!.config} state={state} patch={patch} />
)}
```

- [ ] **Step 5: Verify**

```bash
pnpm build && pnpm test
```
Expected: pass (if `tsc` flags the four unused alloc/info consts, silence by exporting nothing — instead add `void allocDh, allocSl, infoDh, infoSl;` on one line and remove it in Task 11; note `noUnusedLocals` is not enabled in our tsconfig, so this should not trigger).

Manual check (`pnpm dev`, `#g=020101&v=builder`): checkbox grid grouped by 4 okręgi; okręg-level select-all works; selection turns rows pink and updates the URL `o=` param; empty state shows when nothing selected; with obwody 1–5 selected the params panel shows 3 stats, mandaty input pre-filled with the formula underneath, editing it shows "przywróć domyślne", the d'Hondt/S-L toggle switches color, compare checkbox toggles `cmp=1` in the URL; "Kopiuj link" flips to "Skopiowano ✓".

- [ ] **Step 6: Commit**

```bash
git add src/app
git commit -m "feat: builder view with obwody selector, presets, params panel"
```

---

### Task 11: ResultsPanel — single table, compare table, summaries, divisor table

**Files:**
- Create: `src/app/ResultsPanel.tsx`, `src/app/DivisorTable.tsx`
- Modify: `src/app/BuilderView.tsx` (render `<ResultsPanel>` after `<ParamsPanel>`)

**Interfaces:**
- Consumes: `Allocation`, `Method`, `VotesMap`, `divisor` from `../engine/allocate`; `Analytics` from `../engine/analytics`; `GminaModel`, `nameOf` from `../engine/derive`; formatters; `KomitetChip`, `listaColor`.
- Produces:
  - `ResultsPanel({ model, votes, selVotes, mandaty, method, compare, allocDh, allocSl, infoDh, infoSl })`
  - `DivisorTable({ model, votes, alloc, mandaty, method, compare, sorted })` — `sorted: string[]` = listy ordered by votes descending

- [ ] **Step 1: Write `src/app/DivisorTable.tsx`**

```tsx
import { Allocation, Method, VotesMap, divisor } from '../engine/allocate';
import { GminaModel, nameOf } from '../engine/derive';
import { fmt, fmtDec } from '../engine/format';

interface Props {
  model: GminaModel;
  votes: VotesMap;
  alloc: Allocation;
  mandaty: number;
  method: Method;
  compare: boolean;
  sorted: string[];
}

export function DivisorTable({ model, votes, alloc, mandaty, method, compare, sorted }: Props) {
  const winKeys = new Set(alloc.winners.map(w => `${w.lista}/${w.divisor}`));
  const lastKey = alloc.last ? `${alloc.last.lista}/${alloc.last.divisor}` : '';
  const divisors = Array.from({ length: mandaty }, (_, k) => divisor(k, method));
  return (
    <details class="div-details">
      <summary>
        Tabela dzielników — jak przydzielono mandaty ({compare ? 'metoda z przełącznika: ' : ''}
        metoda {method === 'dh' ? "d'Hondta" : 'Sainte-Laguë'}, dzielniki {method === 'dh' ? '1, 2, 3, 4…' : '1, 3, 5, 7…'})
      </summary>
      <div class="tbl-wrap">
        <table class="tbl div-tbl">
          <thead>
            <tr>
              <th class="l">Komitet</th>
              <th>Głosy</th>
              {divisors.map(d => <th key={d} class="mono">÷{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {sorted.map(l => (
              <tr key={l}>
                <td class="div-name">{nameOf(model, l)}</td>
                <td class="r mono">{fmt(votes[l])}</td>
                {divisors.map(d => {
                  const key = `${l}/${d}`;
                  const cls = key === lastKey ? `cell-last ${method}` : winKeys.has(key) ? 'cell-win' : 'cell-lose';
                  return <td key={d} class={`r mono ${cls}`}>{fmtDec(votes[l] / d, 1)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div class="div-legend">
          Pogrubione komórki to {mandaty} najwyższych ilorazów — każdy oznacza mandat. Wyróżniona komórka to
          ostatni (najniższy) zwycięski iloraz: o ten mandat toczy się gra w kolumnie „brakujące głosy / przewaga".
          Remisy ilorazów rozstrzyga wyższa łączna liczba głosów komitetu, następnie niższy numer listy
          (ustawowo: losowanie).
        </div>
      </div>
    </details>
  );
}
```

- [ ] **Step 2: Write `src/app/ResultsPanel.tsx`**

```tsx
import { Allocation, Method, VotesMap } from '../engine/allocate';
import { Analytics } from '../engine/analytics';
import { GminaModel, nameOf } from '../engine/derive';
import { fmt, fmtPct, plGlos } from '../engine/format';
import { DivisorTable } from './DivisorTable';
import { KomitetChip, listaColor } from './KomitetChip';

interface Props {
  model: GminaModel;
  votes: VotesMap;
  selVotes: number;
  mandaty: number;
  method: Method;
  compare: boolean;
  allocDh: Allocation;
  allocSl: Allocation;
  infoDh: Analytics;
  infoSl: Analytics;
}

const genitive = (m: Method) => (m === 'dh' ? "d'Hondta" : 'Sainte-Laguë');

export function ResultsPanel(props: Props) {
  const { model, votes, selVotes, mandaty, method, compare } = props;
  const alloc = method === 'dh' ? props.allocDh : props.allocSl;
  const info = method === 'dh' ? props.infoDh : props.infoSl;
  const sorted = [...alloc.listy].sort((a, b) => votes[b] - votes[a]);
  const cls = compare ? 'results cmp' : `results ${method}`;

  if (selVotes === 0) {
    return (
      <section class={cls}>
        <div class="results-banner"><div class="banner-t">3. Wynik</div></div>
        <div class="no-votes">Brak głosów ważnych w zaznaczonych obwodach — nie ma czego przeliczać.</div>
      </section>
    );
  }

  return (
    <section class={cls}>
      <div class="results-banner">
        <div class="banner-t">
          3. Wynik: {compare
            ? 'porównanie metod — d’Hondt i Sainte-Laguë'
            : `metoda ${genitive(method)} ${method === 'dh' ? '(ustawowa)' : '(wariant hipotetyczny)'}`}
        </div>
        <div class="banner-s">{mandaty} mandatów · {fmt(selVotes)} głosów ważnych · bez progu wyborczego</div>
      </div>
      {compare
        ? <CompareTable model={model} votes={votes} selVotes={selVotes} allocDh={props.allocDh} allocSl={props.allocSl} sorted={sorted} />
        : <SingleTable model={model} votes={votes} selVotes={selVotes} alloc={alloc} info={info} sorted={sorted} />}
      <Summaries {...props} activeInfo={info} />
      <DivisorTable model={model} votes={votes} alloc={alloc} mandaty={mandaty} method={method} compare={compare} sorted={sorted} />
    </section>
  );
}

function SingleTable({ model, votes, selVotes, alloc, info, sorted }: {
  model: GminaModel; votes: VotesMap; selVotes: number; alloc: Allocation; info: Analytics; sorted: string[];
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
            <th class="gap-col">Brakujące głosy / przewaga</th>
            <th>Głosy nadwyżkowe</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(l => {
            const v = votes[l];
            const sc = alloc.seatsBy[l] ?? 0;
            const rec = info.perLista[l] ?? {};
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
                <td class="gap-col">
                  {rec.margin != null && rec.marginOver != null && (
                    <span class="gap-margin">przewaga {fmt(rec.margin)} {plGlos(rec.margin)} nad: {nameOf(model, rec.marginOver)}</span>
                  )}
                  {rec.missing != null && (
                    <span class={closest ? 'gap-missing hot' : 'gap-missing'}>
                      brakło {fmt(rec.missing)} {plGlos(rec.missing)} do ostatniego mandatu
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

function CompareTable({ model, votes, selVotes, allocDh, allocSl, sorted }: {
  model: GminaModel; votes: VotesMap; selVotes: number; allocDh: Allocation; allocSl: Allocation; sorted: string[];
}) {
  const rows = sorted.map(l => ({ l, a: allocDh.seatsBy[l] ?? 0, b: allocSl.seatsBy[l] ?? 0 }));
  const anyDiff = rows.some(r => r.a !== r.b);
  return (
    <div class="tbl-wrap">
      <table class="tbl results-tbl">
        <thead>
          <tr>
            <th class="l">Komitet</th>
            <th>Głosy</th>
            <th>% ważnych</th>
            <th class="th-dh">Mandaty · d'Hondt (ustawowa)</th>
            <th class="th-sl">Mandaty · Sainte-Laguë (hipot.)</th>
            <th class="c">Różnica</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ l, a, b }) => (
            <tr key={l} class={a !== b ? 'differs' : ''}>
              <td><span class="kom"><KomitetChip lista={l} /><span class="kom-name b">{nameOf(model, l)}</span></span></td>
              <td class="r mono">{fmt(votes[l])}</td>
              <td class="r mono dim">{fmtPct((100 * votes[l]) / selVotes)}</td>
              <td class="r mono seats bl">{a}</td>
              <td class="r mono seats">{b}</td>
              <td class="c mono">
                {a === b ? <span class="dim">=</span> : <span class="diff-pill">{b > a ? `+${b - a} S-L` : `+${a - b} d'H`}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!anyDiff && <div class="identical">Przy tym zaznaczeniu obie metody dają identyczny podział mandatów.</div>}
    </div>
  );
}

function Summaries({ model, votes, selVotes, method, compare, infoDh, infoSl, activeInfo }: Props & { activeInfo: Analytics }) {
  const cards = (info: Analytics, suffix: string) => {
    const names = info.wastedListy.map(l => `${nameOf(model, l)} (${fmt(votes[l])})`).join(', ');
    return [
      {
        title: `Głosy zmarnowane${suffix}`,
        value: `${fmt(info.wastedSum)} (${fmtPct((100 * info.wastedSum) / selVotes)})`,
        note: info.wastedListy.length ? `oddane na komitety bez mandatu: ${names}` : 'każdy komitet z głosami zdobył mandat',
      },
      {
        title: `Głosy nadwyżkowe${suffix}`,
        value: `${fmt(info.surplusSum)} (${fmtPct((100 * info.surplusSum) / selVotes)})`,
        note: 'głosy, które komitety z mandatami mogłyby stracić bez utraty żadnego mandatu',
      },
    ];
  };
  const noEffect = (i: Analytics) => i.wastedSum + i.surplusSum;
  const list = compare
    ? (() => {
        const a = cards(infoDh, " — d'Hondt");
        const b = cards(infoSl, ' — Sainte-Laguë');
        return [a[0], b[0], a[1], b[1]];
      })()
    : cards(activeInfo, '');
  return (
    <>
      <div class="summary-grid">
        {list.map(c => (
          <div key={c.title} class="summary-card">
            <div class="sum-t">{c.title}</div>
            <div class="sum-v">{c.value}</div>
            <div class="sum-n">{c.note}</div>
          </div>
        ))}
      </div>
      <div class="no-effect">
        <span class="b">Głosy bez wpływu na wynik:</span>
        {compare ? (
          <>
            <span class="ne-v mono">{fmt(noEffect(infoDh))} (d'H) · {fmt(noEffect(infoSl))} (S-L)</span>
            <span class="ne-n">
              głosy bez wpływu (zmarnowane + nadwyżkowe): {fmtPct((100 * noEffect(infoDh)) / selVotes)} wg d'Hondta,{' '}
              {fmtPct((100 * noEffect(infoSl)) / selVotes)} wg Sainte-Laguë
            </span>
          </>
        ) : (
          <>
            <span class="ne-v mono">{fmt(noEffect(activeInfo))} z {fmt(selVotes)}</span>
            <span class="ne-n">
              ({fmtPct((100 * noEffect(activeInfo)) / selVotes)} głosów ważnych) — zmarnowane + nadwyżkowe,
              metoda {genitive(method)}
            </span>
          </>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Wire into `src/app/BuilderView.tsx`**

Add the import:
```tsx
import { ResultsPanel } from './ResultsPanel';
```
Replace the `<ParamsPanel … />` element (the non-empty branch) with a fragment:
```tsx
<>
  <ParamsPanel
    model={model} state={state} patch={patch}
    selCount={state.sel.length} selWyborcy={selWyborcy} selVotes={selVotes}
    defMandaty={defMandaty} mandaty={mandaty}
  />
  <ResultsPanel
    model={model} votes={votes} selVotes={selVotes} mandaty={mandaty}
    method={state.method} compare={state.compare}
    allocDh={allocDh} allocSl={allocSl} infoDh={infoDh} infoSl={infoSl}
  />
</>
```

- [ ] **Step 4: Verify**

```bash
pnpm build && pnpm test
```
Manual check (`pnpm dev`, `#g=020101&v=builder&o=1.2.3.4.5&m=5`) — this selection reproduces okręg 1, so the numbers must match the hand-computed fixture:
- Single d'Hondt: KO 997 głosy / 2 mandaty; KWW ZIEMI BOLESŁAWIECKIEJ has the "najbliżej mandatu" badge with "brakło 196 głosów"; KO row shows "przewaga 214 głosów nad: KWW PIOTRA ROMANA FORUM MIASTA"; nadwyżkowe column shows 450 for FORUM.
- Zmarnowane card: 471 (13,6%); nadwyżkowe card: 1 081 (31,3%); no-effect bar: 1 552 z 3 452 (45,0%).
- Method switch to S-L recolors the banner blue and recomputes; compare checkbox shows both seat columns with różnica pills (or the "identyczny podział" note); divisor table opens with the last-seat cell highlighted.

- [ ] **Step 5: Commit**

```bash
git add src/app
git commit -m "feat: results panel with recount, compare mode, summaries, divisor table"
```

---

### Task 12: RealComparison

**Files:**
- Create: `src/app/RealComparison.tsx`
- Modify: `src/app/BuilderView.tsx` (render after `<ResultsPanel>`)

**Interfaces:**
- Consumes: `Allocation`, `Method`, `VotesMap`; `GminaModel`, `nameOf`; `KomitetChip`.
- Produces: `RealComparison({ model, sel, votes, alloc, method }: { model: GminaModel; sel: string[]; votes: VotesMap; alloc: Allocation; method: Method })`.

- [ ] **Step 1: Write `src/app/RealComparison.tsx`**

```tsx
import { Allocation, Method, VotesMap } from '../engine/allocate';
import { GminaModel, nameOf } from '../engine/derive';
import { KomitetChip } from './KomitetChip';

interface Props {
  model: GminaModel;
  sel: string[];
  votes: VotesMap;
  alloc: Allocation;
  method: Method;
}

export function RealComparison({ model, sel, votes, alloc, method }: Props) {
  const touched = [...new Set(sel.map(nr => model.obwodByNr[nr]?.okreg).filter((x): x is string => !!x))]
    .sort((a, b) => Number(a) - Number(b));
  const realSum: Record<string, number> = {};
  for (const nr of touched) {
    for (const [l, s] of Object.entries(model.okregi[nr].realSeats)) realSum[l] = (realSum[l] ?? 0) + s;
  }
  const listy = [...new Set([...alloc.listy, ...Object.keys(realSum)])]
    .sort((a, b) => (votes[b] ?? 0) - (votes[a] ?? 0));

  return (
    <section class="card">
      <div class="sec-head">
        <div class="sec-title">4. Porównanie z wynikiem rzeczywistym</div>
        <div class="sec-sub">
          mandaty realnie zdobyte w okręgach nr {touched.join(', ')} (zawsze d’Hondt — tak liczono naprawdę) vs okręg wirtualny
        </div>
      </div>
      <div class="tbl-wrap pad">
        <table class="tbl">
          <thead>
            <tr>
              <th class="l">Komitet</th>
              <th>Mandaty realne (d'Hondt)</th>
              <th>Okręg wirtualny ({method === 'dh' ? "d'Hondt" : 'Sainte-Laguë'})</th>
              <th class="c">Różnica</th>
            </tr>
          </thead>
          <tbody>
            {listy.map(l => {
              const r = realSum[l] ?? 0;
              const v = alloc.seatsBy[l] ?? 0;
              const d = v - r;
              return (
                <tr key={l}>
                  <td><span class="kom"><KomitetChip lista={l} /><span class="kom-name">{nameOf(model, l)}</span></span></td>
                  <td class="r mono b">{r}</td>
                  <td class="r mono b">{v}</td>
                  <td class={`c mono b ${d === 0 ? 'dim' : d > 0 ? 'pos' : 'neg'}`}>
                    {d === 0 ? '=' : d > 0 ? `+${d}` : String(d)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div class="div-legend">
          Kolumna „realne" sumuje mandaty zdobyte przez komitety we wszystkich okręgach, z których pochodzą
          zaznaczone obwody. Porównanie ma charakter poglądowy — liczba mandatów okręgu wirtualnego może różnić
          się od sumy mandatów tych okręgów.
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire into `src/app/BuilderView.tsx`**

Add the import:
```tsx
import { RealComparison } from './RealComparison';
```
Inside the fragment, after `<ResultsPanel … />`, add:
```tsx
<RealComparison
  model={model} sel={state.sel} votes={votes}
  alloc={state.method === 'dh' ? allocDh : allocSl} method={state.method}
/>
```

- [ ] **Step 3: Verify**

```bash
pnpm build && pnpm test
```
Manual check (`#g=020101&v=builder&o=1.2.3.4.5&m=5`): section 4 lists okręg nr 1; with the default 5 mandates and d'Hondt every row shows `=` (the virtual okręg reproduces the real one exactly — good sanity check). Selecting obwody across two okręgi shows summed real seats and nonzero differences.

- [ ] **Step 4: Commit**

```bash
git add src/app
git commit -m "feat: comparison of virtual result vs real-world seats"
```

---

### Task 13: Deployment workflow + final verification

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `pnpm test`, `pnpm build` (prebuild generates the index).
- Produces: GitHub Pages deployment on every push to `main`; failing tests block deploy.

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Note: `pnpm/action-setup@v4` reads the pnpm version from `packageManager` in package.json if present; if the action complains, run `corepack use pnpm@latest` locally, commit the `packageManager` field it adds, and retry.

- [ ] **Step 2: Full local verification**

```bash
pnpm test
pnpm build
pnpm exec vite preview --port 4173 &
sleep 1
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4173/wyboryzator/
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4173/wyboryzator/data/020101.json
kill %1
```
Expected: all tests pass; both curls print `200`.

- [ ] **Step 3: Commit**

```bash
git add .github
git commit -m "ci: test-gated GitHub Pages deployment"
```

- [ ] **Step 4: Note for the human**

Deployment requires two one-time manual actions (do NOT attempt from the CLI without being asked): create the GitHub repo + push, and in repo Settings → Pages set Source to "GitHub Actions". If the repo name is not `wyboryzator`, update `base` in `vite.config.ts` to match. Report this to the user instead of doing it.

---

## Self-review notes (already applied)

- Spec coverage: every spec section maps to a task — stack/layout (T1), index (T2), formatters (T3), allocation + integer math + tie-break (T4), analytics incl. przewaga bug fix and property tests (T5), derived model + real d'Hondt baseline (T6), URL codec + sanitization (T7), shell/picker/error handling/loading (T8), overview (T9), builder+presets+params (T10), results/compare/summaries/divisor incl. tie-break disclosure in the legend (T11), real comparison (T12), CI deploy (T13).
- The spec's strict-exceed formula for `missing` was refined to tie-break-aware `minVotesToBeat` (T5) — otherwise the spec's own property tests fail in exact-tie corners; semantics documented in the divisor legend.
- Type/name consistency verified across tasks: `Allocation`, `Analytics`, `GminaModel`, `AppState`, `patch`, `IndexEntry`, `GminaConfig` are defined once and consumed with matching signatures.
