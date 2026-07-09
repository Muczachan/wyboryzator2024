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
