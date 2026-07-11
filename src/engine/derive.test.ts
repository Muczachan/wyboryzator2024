import { describe, expect, it } from 'vitest';
import {
  RawGmina, clampMandaty, defaultMandaty, deriveGmina, nameOf, overProg, sumVotes, votesOfSelection,
} from './derive';
import { allocate } from './allocate';

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

  it('per-okręg aggregates and real d\'Hondt seats', () => {
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
