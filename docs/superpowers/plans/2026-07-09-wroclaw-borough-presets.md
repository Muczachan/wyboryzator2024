# Wrocław Borough Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and commit `public/data/026401.config.json` — Wrocław obwody presets in a new group-first format (5 dzielnice exact, osiedla by polling-station address) — plus the generator script and data-invariant tests. **No app code changes** (UI wiring is a deferred follow-up).

**Architecture:** A committed one-off Python (stdlib-only) generator reads two downloaded official sources — the PKW obwody CSV (dzielnica tags + siedziba addresses) and Wrocław's EMUiA address registry XLSX (address → osiedle) — validates hard invariants, and writes the config. A vitest re-asserts the invariants against the committed files. Spec: `docs/superpowers/specs/2026-07-09-wroclaw-borough-presets-design.md`.

**Tech Stack:** Python 3 stdlib (csv, zipfile, xml.etree, json), Vitest, pnpm.

## Global Constraints

- Config shape (exact): top-level `{ "zrodla": string, "grupy": Grupa[] }`, `Grupa = { nazwa, opis, presety[] }`, `Preset = { nazwa, opis, obwody: string[] }`.
- Exactly two groups, in order: `"Dzielnice"` then `"Osiedla"`.
- Group opis strings, verbatim:
  - Dzielnice: `podział administracyjny do 1990 r. — przypisanie dokładne, wg opisów granic obwodów PKW`
  - Osiedla: `przybliżenie — obwód liczony do osiedla, w którym mieści się siedziba komisji`
- Scope: only `Typ obwodu == "stały"` (obwody 1–301); institutional obwody 302–330 excluded from all presets.
- Dzielnica counts must equal: Stare Miasto 27, Śródmieście 49, Fabryczna 93, Psie Pole 49, Krzyki 83.
- Both preset sets must partition {"1"..."301"} exactly; every obwód number must exist in `public/data/026401.json`.
- Preset opis = obwód count with Polish declension (`1 obwód`, `2 obwody`, `5 obwodów`); obwody arrays numerically sorted; presets alphabetical (Polish collation) within groups.
- Source downloads are NOT committed. Generator hard-fails rather than silently guessing (unresolvable siedziba ⇒ add to `OVERRIDES`).
- No changes to any file under `src/app/` or to `GminaConfig`/`Preset` types. Existing 120 tests must stay green.
- Package manager pnpm; tests via `pnpm test`.

---

### Task 1: Generator script + generated config

**Files:**
- Create: `scripts/build-wroclaw-presets.py`
- Create (generated output, committed): `public/data/026401.config.json`

**Interfaces:**
- Consumes: downloaded source files (step 1), `public/data/026401.json` (existing).
- Produces: `public/data/026401.config.json` in the Global Constraints shape. Task 2's test reads it with `JSON.parse(readFileSync('public/data/026401.config.json', 'utf8'))`.

There is no unit-test harness for this one-off script; its test cycle is the built-in hard validation (the script refuses to write output that violates any invariant) plus Task 2's independent vitest. TDD evidence for this task = the validation report output.

- [ ] **Step 1: Download the two sources into a temp dir**

```bash
SRC=$(mktemp -d)
curl -sL "https://samorzad2024.pkw.gov.pl/samorzad2024/data/csv/obwody_glosowania_csv.zip" -o "$SRC/obwody.zip"
unzip -o -q "$SRC/obwody.zip" -d "$SRC"
# geoportal.wroclaw.pl's TLS chain fails strict verification — -k is required and expected
curl -skL "https://geoportal.wroclaw.pl/www/emuia/Adresy.zip" -o "$SRC/Adresy.zip"
unzip -o -q "$SRC/Adresy.zip" -d "$SRC"
ls "$SRC"
```

Expected: `obwody_glosowania_utf8.csv` (~12.6 MB) and one `Adresy_StanNa<YYYYMMDD>.xlsx` (~2.8 MB). (If the controller supplied pre-downloaded copies, using those instead is fine — same files.)

- [ ] **Step 2: Write the generator**

Create `scripts/build-wroclaw-presets.py` with exactly this content:

```python
#!/usr/bin/env python3
"""Generate public/data/026401.config.json — Wrocław borough presets.

Two preset groups for the virtual-okręg builder:
  Dzielnice — exact, from the "Wrocław-<dzielnica>" tag PKW puts in each
              obwód's boundary description (Opis granic).
  Osiedla   — approximation: each obwód is assigned to the osiedle that
              contains its polling station's address (user-accepted
              heuristic; boundary obwody may land in a neighbour osiedle).

Sources (official, downloaded manually, NOT committed):
  1. PKW obwody CSV:
     curl -sL https://samorzad2024.pkw.gov.pl/samorzad2024/data/csv/obwody_glosowania_csv.zip -o obwody.zip
     -> obwody_glosowania_utf8.csv
  2. EMUiA address registry (TLS chain fails strict verification, hence -k):
     curl -skL https://geoportal.wroclaw.pl/www/emuia/Adresy.zip -o Adresy.zip
     -> Adresy_StanNa<YYYYMMDD>.xlsx  (updated daily)

Usage:
  python3 scripts/build-wroclaw-presets.py <obwody_csv> <adresy_xlsx>

Hard-fails (exit 1, no output written) on any invariant violation.
"""
import csv
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

TERYT = '026401'
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'data' / '026401.config.json'
GMINA_JSON = ROOT / 'public' / 'data' / '026401.json'

DZ_RE = re.compile(r'Wrocław-(Stare Miasto|Śródmieście|Krzyki|Fabryczna|Psie Pole)')
EXPECTED_DZ = {'Stare Miasto': 27, 'Śródmieście': 49, 'Fabryczna': 93,
               'Psie Pole': 49, 'Krzyki': 83}

# Hand-curated obwód-nr -> osiedle, for siedziby the automatic match cannot
# resolve. Populate only when the script fails and names the obwód.
OVERRIDES: dict[str, str] = {}

M = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

# Polish collation without relying on installed locales: diacritics sort
# right after their base letter.
PL = str.maketrans({'ą': 'a~', 'ć': 'c~', 'ę': 'e~', 'ł': 'l~', 'ń': 'n~',
                    'ó': 'o~', 'ś': 's~', 'ź': 'z~', 'ż': 'z~~'})


def pl_key(s: str) -> str:
    return s.lower().translate(PL)


def pl_obwod(n: int) -> str:
    if n == 1:
        return 'obwód'
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return 'obwody'
    return 'obwodów'


def fail(msg: str) -> None:
    print(f'FAIL: {msg}', file=sys.stderr)
    sys.exit(1)


def norm_street(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r'^(ul|pl|al|bulw|wyb|park|rondo|skwer)\.?\s+', '', s)
    return re.sub(r'\s+', ' ', s)


def load_addresses(xlsx_path: str):
    """EMUiA XLSX -> (exact: street -> {house_nr -> osiedle},
                      freq: street -> Counter(osiedle)).

    The file is a single sheet with inline strings (no sharedStrings) and
    dense rows; cells are read positionally against the header row. If the
    city ever changes the export format, the downstream invariants fail
    loudly rather than mis-assigning.
    """
    exact: dict[str, dict[str, str]] = defaultdict(dict)
    freq: dict[str, Counter] = defaultdict(Counter)
    with zipfile.ZipFile(xlsx_path) as z, z.open('xl/worksheets/sheet1.xml') as f:
        idx = None
        for _, el in ET.iterparse(f):
            if el.tag != M + 'row':
                continue
            vals = []
            for c in el:
                is_el = c.find(M + 'is')
                if is_el is not None:
                    vals.append(''.join(t.text or '' for t in is_el.iter(M + 't')))
                else:
                    v = c.find(M + 'v')
                    vals.append(v.text if v is not None else '')
            el.clear()
            if idx is None:
                try:
                    idx = tuple(vals.index(k) for k in
                                ('ULICA_NAZWA', 'NUMER_ADR', 'RMWROC_OSIEDLE'))
                except ValueError:
                    fail(f'EMUiA header changed, got: {vals}')
                continue
            if len(vals) <= max(idx):
                continue
            ul = norm_street(vals[idx[0]])
            nr = vals[idx[1]].strip().upper()
            osiedle = vals[idx[2]].strip()
            if not ul or not osiedle:
                continue
            exact[ul][nr] = osiedle
            freq[ul][osiedle] += 1
    return exact, freq


def main(csv_path: str, xlsx_path: str) -> None:
    with open(csv_path, encoding='utf-8-sig', newline='') as f:
        rows = [r for r in csv.DictReader(f, delimiter=';')
                if r['TERYT gminy'] == TERYT]
    stale = [r for r in rows if r['Typ obwodu'] == 'stały']
    if len(rows) != 330 or len(stale) != 301:
        fail(f'expected 330 obwody / 301 stałe, got {len(rows)} / {len(stale)}')

    # --- Dzielnice (exact) ---
    dz_groups: dict[str, list[str]] = defaultdict(list)
    for r in stale:
        m = DZ_RE.search(r['Opis granic'])
        if not m:
            fail(f"obwód {r['Numer']}: no dzielnica tag in Opis granic")
        dz_groups[m.group(1)].append(r['Numer'])
    counts = {k: len(v) for k, v in dz_groups.items()}
    if counts != EXPECTED_DZ:
        fail(f'dzielnica counts {counts} != expected {EXPECTED_DZ}')

    # --- Osiedla (siedziba address heuristic) ---
    exact, freq = load_addresses(xlsx_path)
    os_groups: dict[str, list[str]] = defaultdict(list)
    fallbacks, overridden = [], []
    for r in stale:
        nr = r['Numer']
        if nr in OVERRIDES:
            osiedle = OVERRIDES[nr]
            overridden.append(nr)
        else:
            ul = norm_street(r['Ulica'])
            num_m = re.search(r'\d+[A-Za-z]?', r['Numer posesji'] or '')
            num = num_m.group(0).upper() if num_m else ''
            osiedle = exact.get(ul, {}).get(num)
            if osiedle is None:
                c = freq.get(ul)
                if not c:
                    fail(f"obwód {nr}: siedziba '{r['Ulica']} {r['Numer posesji']}'"
                         f' not found in EMUiA — add to OVERRIDES')
                osiedle = c.most_common(1)[0][0]
                fallbacks.append((nr, r['Ulica'], r['Numer posesji'], osiedle))
        os_groups[osiedle].append(nr)

    # --- Invariants (mirrored in src/data/wroclaw-config.test.ts) ---
    want = {str(n) for n in range(1, 302)}
    for label, groups in (('dzielnice', dz_groups), ('osiedla', os_groups)):
        got = [nr for nrs in groups.values() for nr in nrs]
        if len(got) != 301 or set(got) != want:
            fail(f'{label} do not partition 1..301')
        if any(not nrs for nrs in groups.values()):
            fail(f'{label}: empty preset')
    valid = set()
    gmina = json.loads(GMINA_JSON.read_text(encoding='utf-8'))[TERYT]
    for ok in gmina['okregi'].values():
        valid.update(ok['obwody'].keys())
    missing = want - valid
    if missing:
        fail(f'obwody absent from {GMINA_JSON.name}: {sorted(missing, key=int)}')

    def preset(nazwa: str, nrs: list[str]) -> dict:
        nrs = sorted(nrs, key=int)
        return {'nazwa': nazwa, 'opis': f'{len(nrs)} {pl_obwod(len(nrs))}',
                'obwody': nrs}

    config = {
        'zrodla': f'PKW obwody_glosowania_utf8.csv (samorzad2024) + '
                  f'EMUiA {Path(xlsx_path).name}; '
                  f'wygenerowano {date.today().isoformat()}',
        'grupy': [
            {'nazwa': 'Dzielnice',
             'opis': 'podział administracyjny do 1990 r. — przypisanie '
                     'dokładne, wg opisów granic obwodów PKW',
             'presety': [preset(n, dz_groups[n])
                         for n in sorted(dz_groups, key=pl_key)]},
            {'nazwa': 'Osiedla',
             'opis': 'przybliżenie — obwód liczony do osiedla, w którym '
                     'mieści się siedziba komisji',
             'presety': [preset(n, os_groups[n])
                         for n in sorted(os_groups, key=pl_key)]},
        ],
    }
    OUT.write_text(json.dumps(config, ensure_ascii=False, indent=1) + '\n',
                   encoding='utf-8')

    print(f'wrote {OUT.relative_to(ROOT)}')
    print(f'dzielnice: {counts}')
    print(f'osiedla: {len(os_groups)} presets')
    for n in sorted(os_groups, key=pl_key):
        print(f'  {n}: {len(os_groups[n])}')
    print(f'exact matches: {301 - len(fallbacks) - len(overridden)}, '
          f'street-majority fallbacks: {len(fallbacks)}, '
          f'overrides: {len(overridden)}')
    for fb in fallbacks:
        print(f'  fallback: obwód {fb[0]} ({fb[1]} {fb[2]}) -> {fb[3]}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
```

- [ ] **Step 3: Run the generator**

```bash
python3 scripts/build-wroclaw-presets.py "$SRC/obwody_glosowania_utf8.csv" "$SRC"/Adresy_StanNa*.xlsx
```

Expected: `wrote public/data/026401.config.json`, dzielnica counts `{'Stare Miasto': 27, 'Śródmieście': 49, 'Fabryczna': 93, 'Psie Pole': 49, 'Krzyki': 83}`, osiedla preset count somewhere in the 30s–40s, and a fallback list. **Read the report.** A handful of street-majority fallbacks is expected (siedziba house number absent from EMUiA); if the script FAILs naming an obwód, resolve that siedziba's osiedle manually — look up the address in the EMUiA file, or as a last resort use the `GUS_TERC_DELEGATURA`-consistent street majority — add it to `OVERRIDES` with a comment, and re-run. If more than ~20 obwody need fallback, stop and report DONE_WITH_CONCERNS with the report attached.

- [ ] **Step 4: Sanity-check the output**

```bash
python3 - <<'EOF'
import json
c = json.load(open('public/data/026401.config.json'))
assert list(g['nazwa'] for g in c['grupy']) == ['Dzielnice', 'Osiedla']
for g in c['grupy']:
    nrs = [n for p in g['presety'] for n in p['obwody']]
    assert sorted(nrs, key=int) == [str(i) for i in range(1, 302)], g['nazwa']
print('partitions OK;', {g['nazwa']: len(g['presety']) for g in c['grupy']})
EOF
```

Expected: `partitions OK; {'Dzielnice': 5, 'Osiedla': <N>}`.

- [ ] **Step 5: Run the existing suite (must be untouched)**

Run: `pnpm test`
Expected: 120 tests pass (config file is not imported by any code).

- [ ] **Step 6: Commit**

```bash
git add scripts/build-wroclaw-presets.py public/data/026401.config.json
git commit -m "feat: Wrocław borough presets — group-first config + generator"
```

---

### Task 2: Data-invariant vitest + browser smoke check

**Files:**
- Test: `src/data/wroclaw-config.test.ts` (new directory `src/data/` is fine — vitest picks up `src/**/*.test.ts`)

**Interfaces:**
- Consumes: `public/data/026401.config.json` (Task 1) and `public/data/026401.json` (existing), read via `node:fs` relative to the repo root (vitest's cwd).
- Produces: nothing downstream.

- [ ] **Step 1: Write the test**

Create `src/data/wroclaw-config.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Preset { nazwa: string; opis: string; obwody: string[] }
interface Grupa { nazwa: string; opis: string; presety: Preset[] }

const cfg: { zrodla: string; grupy: Grupa[] } =
  JSON.parse(readFileSync('public/data/026401.config.json', 'utf8'));
const gmina = JSON.parse(readFileSync('public/data/026401.json', 'utf8'))['026401'];

const validNrs = new Set<string>();
for (const ok of Object.values(gmina.okregi) as { obwody: Record<string, unknown> }[]) {
  for (const nr of Object.keys(ok.obwody)) validNrs.add(nr);
}
const stale301 = Array.from({ length: 301 }, (_, i) => String(i + 1));

describe('026401.config.json — Wrocław borough presets', () => {
  it('has exactly the two groups, in order', () => {
    expect(cfg.grupy.map(g => g.nazwa)).toEqual(['Dzielnice', 'Osiedla']);
  });

  it('dzielnica presets have the exact official counts', () => {
    const dz = Object.fromEntries(
      cfg.grupy[0].presety.map(p => [p.nazwa, p.obwody.length]));
    expect(dz).toEqual({
      'Stare Miasto': 27, 'Śródmieście': 49, 'Fabryczna': 93,
      'Psie Pole': 49, 'Krzyki': 83,
    });
  });

  for (const [i, name] of (['Dzielnice', 'Osiedla'] as const).entries()) {
    it(`${name}: presets partition obwody 1–301`, () => {
      const nrs = cfg.grupy[i].presety.flatMap(p => p.obwody);
      expect([...nrs].sort((a, b) => Number(a) - Number(b))).toEqual(stale301);
    });
  }

  it('every preset obwód exists in the gmina data', () => {
    for (const g of cfg.grupy)
      for (const p of g.presety)
        for (const nr of p.obwody) expect(validNrs.has(nr)).toBe(true);
  });

  it('presets are non-empty, numerically sorted, with count in opis', () => {
    for (const g of cfg.grupy)
      for (const p of g.presety) {
        expect(p.obwody.length).toBeGreaterThan(0);
        const sorted = [...p.obwody].sort((a, b) => Number(a) - Number(b));
        expect(p.obwody).toEqual(sorted);
        expect(p.opis).toMatch(new RegExp(`^${p.obwody.length} obw(ód|ody|odów)$`));
      }
  });
});
```

- [ ] **Step 2: Run the new test file**

Run: `pnpm vitest run src/data/wroclaw-config.test.ts`
Expected: PASS (6 tests). If any invariant fails, the committed config is wrong — stop and report BLOCKED with the failure (do not adjust the test to fit the data).

- [ ] **Step 3: Prove the test bites**

Temporarily break a copy in memory is not possible for fs-based tests; instead verify the guard by mutation:

```bash
python3 - <<'EOF'
import json, pathlib
p = pathlib.Path('public/data/026401.config.json')
c = json.loads(p.read_text())
c['grupy'][0]['presety'][0]['obwody'].pop()   # break the partition
p.write_text(json.dumps(c, ensure_ascii=False, indent=1) + '\n')
EOF
pnpm vitest run src/data/wroclaw-config.test.ts; git checkout -- public/data/026401.config.json
```

Expected: FAIL (partition + count tests), then the checkout restores the file. Re-run `pnpm vitest run src/data/wroclaw-config.test.ts` → PASS again.

- [ ] **Step 4: Full suite**

Run: `pnpm test`
Expected: 126 tests pass (120 existing + 6 new).

- [ ] **Step 5: Browser smoke check**

Invoke the project's `verify` skill (`/verify`). Confirm: the Wrocław gmina page and Okręg wirtualny builder load with the new config file present — no crash, no console errors from the unrecognized config shape; presets do not render (expected until the follow-up UI feature).

- [ ] **Step 6: Commit**

```bash
git add src/data/wroclaw-config.test.ts
git commit -m "test: data invariants for Wrocław borough preset config"
```
