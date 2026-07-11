# Grouped Presets UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the group-first preset config (Wrocław: Dzielnice 5 / Osiedla 47) as collapsible groups in the virtual okręg builder's obwód selector.

**Architecture:** `GminaConfig` is retyped to the group-first shape (`grupy: PresetGrupa[]`, flat `presety` removed — nothing live uses it); `ObwodySelector` sanitizes per group and renders each as an uncontrolled `<details class="preset-group">` (open when ≤10 presets) whose summary shows name, count, and active-count so collapsed groups never hide selection state; pill markup/behavior inside is unchanged. Spec: `docs/superpowers/specs/2026-07-11-grouped-presets-ui-design.md`.

**Tech Stack:** TypeScript, Preact (`class=`, not `className=`), Vitest, pnpm.

## Global Constraints

- Polish copy verbatim: summary shows `· N zestawów` and, only when K > 0, `· K aktywnych` — declensions via `plZestaw` (`zestaw`/`zestawy`/`zestawów`) and `plAktywny` (`aktywny`/`aktywne`/`aktywnych`).
- `open` default rule: `presety.length <= 10`; `<details>` is uncontrolled after mount (no state tracking).
- Sanitization identical to today's flat path: keep only obwody in `model.obwodByNr`, drop empty presets, drop empty groups, no section when nothing remains.
- Pill markup, `title`, `✓/+` prefix, and `onPreset(obw, active)` semantics unchanged.
- Files touched: exactly `src/engine/format.ts` (+test), `src/app/App.tsx` (types only), `src/app/ObwodySelector.tsx`, `src/styles.css`. `GminaView`, engine allocation files, configs untouched.
- Current suite: 132 tests; expect 133 after Task 1.
- pnpm for everything; `pnpm test`, `pnpm build`.

---

### Task 1: `plZestaw` / `plAktywny` helpers

**Files:**
- Modify: `src/engine/format.ts`
- Test: `src/engine/format.test.ts`

**Interfaces:**
- Consumes: existing internal `pl(one, few, many)` factory in `format.ts`.
- Produces: `plZestaw(n: number): string`, `plAktywny(n: number): string`, both exported from `src/engine/format.ts`. Task 2 imports them.

- [ ] **Step 1: Write the failing test**

In `src/engine/format.test.ts`, add `plAktywny, plZestaw` to the import from `./format`, and append:

```ts
describe('plZestaw / plAktywny', () => {
  it('handles Polish plural forms', () => {
    expect(plZestaw(1)).toBe('zestaw');
    expect(plZestaw(2)).toBe('zestawy');
    expect(plZestaw(5)).toBe('zestawów');
    expect(plZestaw(12)).toBe('zestawów');
    expect(plZestaw(22)).toBe('zestawy');
    expect(plAktywny(1)).toBe('aktywny');
    expect(plAktywny(2)).toBe('aktywne');
    expect(plAktywny(5)).toBe('aktywnych');
    expect(plAktywny(12)).toBe('aktywnych');
    expect(plAktywny(22)).toBe('aktywne');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/engine/format.test.ts`
Expected: FAIL — `plZestaw`/`plAktywny` not exported.

- [ ] **Step 3: Implement**

In `src/engine/format.ts`, after the existing `plMandat` export, append:

```ts
export const plZestaw = pl('zestaw', 'zestawy', 'zestawów');
export const plAktywny = pl('aktywny', 'aktywne', 'aktywnych');
```

- [ ] **Step 4: Run the full suite**

Run: `pnpm test`
Expected: 133 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/format.ts src/engine/format.test.ts
git commit -m "feat: plZestaw and plAktywny declension helpers"
```

---

### Task 2: Group-first types + collapsible groups in ObwodySelector

**Files:**
- Modify: `src/app/App.tsx:9-10` (types only)
- Modify: `src/app/ObwodySelector.tsx`
- Modify: `src/styles.css` (one block next to the existing `.presets` rules)

**Interfaces:**
- Consumes (Task 1): `plZestaw(n: number): string`, `plAktywny(n: number): string` from `src/engine/format.ts`.
- Produces: UI only. No component test harness; verification = suite + build + browser pass (Step 5).

- [ ] **Step 1: Retype the config**

In `src/app/App.tsx`, replace lines 9–10:

```ts
export interface Preset { nazwa: string; opis?: string; obwody: string[] }
export interface GminaConfig { presety?: Preset[] }
```

with:

```ts
export interface Preset { nazwa: string; opis?: string; obwody: string[] }
export interface PresetGrupa { nazwa: string; opis?: string; presety: Preset[] }
export interface GminaConfig { grupy?: PresetGrupa[] }
```

- [ ] **Step 2: Rework ObwodySelector's preset rendering**

In `src/app/ObwodySelector.tsx`:

1. Extend the format import:

```tsx
import { fmt, plAktywny, plZestaw } from '../engine/format';
```

2. Replace the `const presety = ...` computation (lines 16–21) with:

```tsx
  const grupy = (config?.grupy ?? [])
    .map(g => ({
      nazwa: g.nazwa,
      opis: g.opis,
      presety: (g.presety ?? [])
        .map(p => {
          const obw = (p.obwody ?? []).map(String).filter(nr => model.obwodByNr[nr]);
          return { nazwa: p.nazwa, opis: p.opis, obw, active: obw.length > 0 && obw.every(nr => selSet.has(nr)) };
        })
        .filter(p => p.obw.length > 0),
    }))
    .filter(g => g.presety.length > 0);
```

3. Replace the whole `{presety.length > 0 && ( <div class="presets"> ... </div> )}` block with:

```tsx
      {grupy.map(g => {
        const act = g.presety.filter(p => p.active).length;
        return (
          <details key={g.nazwa} class="preset-group" open={g.presety.length <= 10}>
            <summary title={g.opis}>
              <span class="presets-lbl">{g.nazwa}</span>
              <span class="preset-count">· {g.presety.length} {plZestaw(g.presety.length)}</span>
              {act > 0 && <span class="preset-active">· {act} {plAktywny(act)}</span>}
            </summary>
            <div class="presets">
              {g.presety.map(p => (
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
          </details>
        );
      })}
```

(The inner pill `<span>` is today's markup verbatim; only the wrapper changed. The `Gotowe zestawy (nazwy zwyczajowe):` label is gone with the flat path.)

- [ ] **Step 3: CSS**

In `src/styles.css`, directly after the `.preset.on` rule, add:

```css
.preset-group { border-bottom: 1px solid var(--line-soft); }
.preset-group summary { display: flex; align-items: center; gap: 8px; padding: 10px 20px; cursor: pointer; }
.preset-group .presets { border-bottom: none; padding-top: 0; }
.preset-count { font-size: 12px; color: var(--dim); }
.preset-active { font-size: 12px; font-weight: 600; color: var(--crimson); }
```

- [ ] **Step 4: Full suite + build**

Run: `pnpm test && pnpm build`
Expected: 133 tests pass; `tsc --noEmit` + `vite build` succeed. If tsc reports any other file referencing `GminaConfig.presety`, that's an unexpected consumer — stop and report it, don't patch it silently.

- [ ] **Step 5: Browser verification**

Invoke the project's `verify` skill (`/verify`). Base path `/wyboryzator2024/`; deep links need full page loads (hop through `about:blank`). Confirm in Wrocław (`#g=026401&v=builder`):
- Two `details.preset-group` render: „Dzielnice" open (5 pills), „Osiedla" collapsed, summaries read `· 5 zestawów` / `· 47 zestawów`;
- Clicking „+ Krzyki" selects its 83 obwody (pill flips to `✓ Krzyki`, results appear); clicking again deselects;
- Expand „Osiedla", activate one osiedle preset, collapse the group — its summary shows `· 1 aktywny`;
- The Osiedla summary carries the group opis as `title` (przybliżenie — obwód liczony do osiedla, w którym mieści się siedziba komisji);
- Bolesławiec (`#g=020101&v=builder`) renders no preset section (no config) and the builder is otherwise unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/app/App.tsx src/app/ObwodySelector.tsx src/styles.css
git commit -m "feat: collapsible grouped presets in obwód selector"
```
