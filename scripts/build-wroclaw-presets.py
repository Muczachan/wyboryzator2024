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
    s = re.sub(r'^(ul|ulica|pl|plac|al|aleja|bulw|bulwar|wyb|wybrzeże'
               r'|park|rondo|skwer)\.?\s+', '', s)
    return re.sub(r'\s+', ' ', s)


def norm_num(s: str) -> str:
    return re.sub(r'\s+', '', (s or '')).upper()


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
            nr = norm_num(vals[idx[1]])
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
            street = exact.get(ul, {})
            # (a) full posesja, whitespace-stripped — catches EMUiA range
            # entries like '2-24'; (b) first number token (plain addresses).
            osiedle = street.get(norm_num(r['Numer posesji']))
            if osiedle is None:
                num_m = re.search(r'\d+[A-Za-z]?', r['Numer posesji'] or '')
                num = num_m.group(0).upper() if num_m else ''
                osiedle = street.get(num)
            if osiedle is None:
                c = freq.get(ul)
                if not c:
                    fail(f"obwód {nr}: siedziba '{r['Ulica']} {r['Numer posesji']}'"
                         f' not found in EMUiA — add to OVERRIDES')
                osiedle = c.most_common(1)[0][0]
                fallbacks.append((nr, r['Ulica'], r['Numer posesji'], osiedle,
                                  len(c) > 1))
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
    for nr, ul, num, osiedle, risky in fallbacks:
        tag = ' WARNING: street spans multiple osiedla' if risky else ''
        print(f'  fallback: obwód {nr} ({ul} {num}) -> {osiedle}{tag}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
