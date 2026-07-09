# Wrocław borough presets — 026401.config.json

Date: 2026-07-09
Status: approved

## Goal

Ship the first live obwody preset config: `public/data/026401.config.json`
for Wrocław, with two preset groups — the 5 former dzielnice (exact) and
osiedla (approximated by polling-station address) — in a redesigned,
group-first config format that can later hold other groupings (geographic,
customary names).

**Deliverable is the JSON format, the generated config, the generator, and
data-invariant tests only.** UI/code changes (reading the new format,
grouped rendering) are explicitly deferred to a follow-up, per user
decision. Until then the app ignores the new config shape: `ObwodySelector`
reads `config?.presety ?? []`, which is absent in the new format, so no
presets render for Wrocław — accepted breakage, not a crash.

## Data sources (both official)

1. **PKW obwody CSV** —
   `https://samorzad2024.pkw.gov.pl/samorzad2024/data/csv/obwody_glosowania_csv.zip`
   → `obwody_glosowania_utf8.csv` (`;`-separated, UTF-8 BOM). Rows with
   `TERYT gminy == 026401` (330 rows). Fields used: `Numer`, `Typ obwodu`,
   `Opis granic`, `Ulica`, `Numer posesji`.
2. **EMUiA address registry (Wrocław BIP/geoportal)** —
   `https://geoportal.wroclaw.pl/www/emuia/Adresy.zip` →
   `Adresy_StanNa<YYYYMMDD>.xlsx` (single sheet, inline strings, no
   sharedStrings). Columns used: `ULICA_NAZWA`, `NUMER_ADR`,
   `RMWROC_OSIEDLE`, `GUS_TERC_DELEGATURA`. Updated daily; provenance
   (snapshot filename + generation date) is recorded in a top-level
   `"zrodla"` string in the config, which the app ignores (`GminaConfig`
   reads only `presety`). Note: the server's TLS chain fails strict
   verification —
   download requires `curl -k` (documented in the script header).

Downloads are NOT committed (12.6 MB + 2.6 MB); the generator reads local
copies whose paths are passed as arguments.

## Assignment rules (locked)

- **Scope**: only `Typ obwodu == "stały"` — obwody 1–301. The 29
  institutional obwody (302–330: hospitals, care homes, detention) are
  non-territorial and excluded from all presets.
- **Dzielnica** (exact): the first `Wrocław-(Stare Miasto|Śródmieście|
  Krzyki|Fabryczna|Psie Pole)` tag in `Opis granic`. All 301 stałe obwody
  carry a tag; expected counts: Stare Miasto 27, Śródmieście 49,
  Fabryczna 93, Psie Pole 49, Krzyki 83. Six obwody list streets from two
  dzielnice; the first tag (the dzielnica the official description leads
  with) wins.
- **Osiedle** (approximation, per user decision): the osiedle of the
  polling station's address — match PKW `Ulica` + first number token of
  `Numer posesji` against EMUiA (`ULICA_NAZWA`, `NUMER_ADR`,
  `RMWROC_OSIEDLE`). Street names normalized on both sides (lowercase,
  strip `ul./pl./al./bulw./wyb./park/rondo/skwer` prefixes, collapse
  whitespace). If the exact house number is absent from EMUiA, fall back
  to the most frequent osiedle among that street's address points. If a
  siedziba still cannot be resolved, generation FAILS (the script then
  gets a hand-curated override entry — no silent guesses).
- Only osiedla that receive ≥1 obwód get a preset; the siedziba heuristic
  means small osiedla may get none, so fewer than 48 presets is expected
  and correct.

## Config format (redesigned, group-first)

The config's unit of organization is a **group** of presets. Groups carry
their own name and method note, so per-preset descriptions stay short and
future groupings (geographic, customary names) slot in as new group
entries.

`public/data/026401.config.json` (committed) shape:

```json
{
  "zrodla": "PKW obwody_glosowania_utf8.csv (samorzad2024) + EMUiA Adresy_StanNa20260709.xlsx; wygenerowano 2026-07-09",
  "grupy": [
    {
      "nazwa": "Dzielnice",
      "opis": "podział administracyjny do 1990 r. — przypisanie dokładne, wg opisów granic obwodów PKW",
      "presety": [
        { "nazwa": "Fabryczna", "opis": "93 obwody", "obwody": ["…"] }
      ]
    },
    {
      "nazwa": "Osiedla",
      "opis": "przybliżenie — obwód liczony do osiedla, w którym mieści się siedziba komisji",
      "presety": [
        { "nazwa": "Biskupin-Sępolno-Dąbie-Bartoszowice", "opis": "8 obwodów", "obwody": ["…"] }
      ]
    }
  ]
}
```

- Schema: top-level `grupy: Grupa[]` where
  `Grupa = { nazwa: string; opis?: string; presety: Preset[] }` and
  `Preset = { nazwa: string; opis?: string; obwody: string[] }` (unchanged
  shape). The legacy flat top-level `presety` is retired — groups are the
  only format; the old Jelenia Góra sample in `PKW_2024_wirtualne_okręgi/`
  is not migrated (it isn't live).
- Group order as listed (Dzielnice, then Osiedla); presets alphabetical
  (pl locale) within each group. `nazwa` values come verbatim from the
  source data (EMUiA `RMWROC_OSIEDLE` for osiedla; the granice tag for
  dzielnice).
- Preset `opis` = obwód count with correct Polish declension (same rules
  as `plGlos`); the assignment-method note lives once in the group `opis`.
- Obwody arrays are numerically sorted strings.

## UI / code changes: deferred

None in this feature, per user decision. `GminaConfig` in App.tsx still
types the old flat format and `ObwodySelector` reads `config?.presety`,
so the new config is fetched but silently unused (no crash — verified:
missing `presety` yields an empty list). Wiring the group format into the
UI (typed `Grupa`, one labeled preset row per group) is a follow-up
feature with its own spec/plan.

## Generator

`scripts/build-wroclaw-presets.py` — committed, Python 3 stdlib only
(`csv`, `zipfile`, `xml.etree`, `json`, `collections`; the XLSX uses
inline strings, parseable without third-party deps; adding an xlsx npm dep
to the app for a one-off would be worse).

- Usage: `python3 scripts/build-wroclaw-presets.py <obwody_csv> <adresy_xlsx>`
- Writes `public/data/026401.config.json` and prints a validation report:
  per-dzielnica and per-osiedle obwód counts, the fallback-matched and
  hand-overridden siedziby, and the partition checks below.
- Contains an (initially empty) `OVERRIDES: dict[str, str]` for obwody
  whose siedziba can't be resolved automatically.

## Validation (hard failures in the generator; mirrored in a vitest)

1. Dzielnica presets partition {1..301}: every stały obwód in exactly one
   preset; exactly 5 presets; counts = Stare Miasto 27, Śródmieście 49,
   Fabryczna 93, Psie Pole 49, Krzyki 83.
2. Osiedle presets also partition {1..301} (every stały obwód assigned to
   exactly one osiedle).
3. Every preset obwód number exists in `public/data/026401.json`
   (`okregi.*.obwody` keys) — guards against PKW-numbering mismatches.
4. No preset or group is empty; exactly two groups, named `Dzielnice` and
   `Osiedla`, in that order.

The vitest (`src/data/wroclaw-config.test.ts`, node fs reads of the two
committed JSON files) re-asserts 1–4 so regressions in hand-edits are
caught without re-running the generator.

## Testing beyond data invariants

- Existing unit-test suite must stay green (no app code changes).
- Browser smoke check (project `verify` skill): Wrocław loads and the
  builder works with the new config present — no crash, no console error
  from the unrecognized shape; presets simply don't render yet.

## Out of scope

- UI/code changes for the group format (deferred follow-up feature);
  presets for any other city; changes to preset toggle behavior; committing
  source downloads; GIS-precise osiedle boundaries (explicitly traded away
  for the siedziba heuristic by user decision).
