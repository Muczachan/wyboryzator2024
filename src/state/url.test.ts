import { describe, expect, it } from 'vitest';
import { AppState, parseHash, toHash } from './url';

const st = (p: Partial<AppState> = {}): AppState => ({
  view: 'picker', teryt: null, sel: [], mandatyOverride: null, method: 'dh', compare: false, prog: true, ...p,
});

describe('round-trips', () => {
  const cases: AppState[] = [
    st(),
    st({ view: 'gmina', teryt: '020101' }),
    st({ view: 'builder', teryt: '020101', sel: ['1', '2', '14'], mandatyOverride: 5, method: 'sl', compare: true }),
    st({ view: 'builder', teryt: '020101', sel: ['3'] }),
    st({ view: 'builder', teryt: '020101', sel: ['3'], prog: false }),
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
