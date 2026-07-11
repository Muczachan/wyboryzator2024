# Grouped presets UI (Dzielnice / Osiedla)

Date: 2026-07-11
Status: approved

## Goal

Render the group-first preset config (shipped 2026-07-10 for Wrocław:
`{ zrodla, grupy: [{ nazwa, opis?, presety }] }`) in the virtual okręg
builder as collapsible groups. This is the deferred UI follow-up named in
`2026-07-09-wroclaw-borough-presets-design.md`. Today `ObwodySelector`
reads the retired flat `config.presety`, so Wrocław's 52 presets render
nothing.

## Types — `src/app/App.tsx`

```ts
export interface Preset { nazwa: string; opis?: string; obwody: string[] }
export interface PresetGrupa { nazwa: string; opis?: string; presety: Preset[] }
export interface GminaConfig { grupy?: PresetGrupa[] }
```

The flat `presety?: Preset[]` field is removed with no compatibility
layer — no live config ever used it (the only flat sample lives outside
`public/data/`).

## ObwodySelector — `src/app/ObwodySelector.tsx`

- Sanitization per group, same rules as today's flat path: within each
  preset keep only obwód numbers present in `model.obwodByNr`; drop presets
  left empty; drop groups left with no presets; if no groups remain, render
  no preset section at all.
- Each group renders as `<details class="preset-group" open={...}>`:
  - `open` default: `presety.length <= 10` (Dzielnice open, Osiedla
    collapsed; rule generalizes to future groups). Uncontrolled after
    mount — the user's open/close clicks win; no state tracking.
  - `<summary>` content, in order:
    - group `nazwa` styled like the current `.presets-lbl` label,
    - `· N zestawów` (declension via new `plZestaw`),
    - `· K aktywne` only when `K > 0` (declension via new `plAktywny`) —
      a collapsed group must never hide that it holds active presets,
    - the group `opis`, when present, as the summary's `title` tooltip.
  - Body: today's pill markup and behavior verbatim — `✓/+` prefix,
    active styling, per-preset `title` (opis + obwody list + click hint),
    `onPreset(obw, active)` toggle semantics.
- The old single-row `.presets` block and its
  `Gotowe zestawy (nazwy zwyczajowe):` label are removed together with the
  flat path.

## Format helpers — `src/engine/format.ts`

Two additional declensions from the existing `pl()` factory:

```ts
export const plZestaw = pl('zestaw', 'zestawy', 'zestawów');
export const plAktywny = pl('aktywny', 'aktywne', 'aktywnych');
```

## CSS — `src/styles.css`

One `.preset-group` block next to the existing `.presets` rules:
`details` row with the current `.presets` padding and bottom border;
`summary` with `cursor: pointer`, flex layout for label/count/badge; the
pill container inside keeps the wrap-row layout (reuse `.presets` classes
for the inner container so the pills themselves need no CSS changes).

## Testing

- `format.test.ts`: `plZestaw` (1 zestaw / 2 zestawy / 5 zestawów /
  12 zestawów / 22 zestawy), `plAktywny` (1 aktywny / 2 aktywne /
  5 aktywnych / 12 aktywnych / 22 aktywne).
- Existing 132 tests stay green (the `GminaConfig` type change compiles
  everywhere; only `ObwodySelector` reads it).
- Browser pass (verify skill, base `/wyboryzator2024/`), Wrocław builder:
  - two groups render; Dzielnice open, Osiedla collapsed by default;
  - clicking a dzielnica pill selects its obwody and flips it to `✓`;
    with an osiedle preset active and its group collapsed, the summary
    shows `· 1 aktywny`;
  - expanding Osiedla shows 47 pills; group opis appears as summary
    tooltip;
  - a gmina without a config (e.g. Bolesławiec) renders no preset section
    and the builder is otherwise unchanged.

## Out of scope

Config regeneration or format changes; `GminaView`; preset toggle
semantics; persisting open/closed state.
