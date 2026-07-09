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

describe("analyze — Bolesławiec okręg 1, d'Hondt", () => {
  const { info } = run('dh');

  it('missing votes (hand-computed)', () => {
    // L16 needs its /2 quotient to outrank last (997/2). Strict threshold is 998,
    // but at 997 the quotients tie and lista 16 loses the tie (equal votes, higher nr) → 998.
    expect(info.perLista['16'].missing).toBe(998 - 783); // 215
    // L1 at 997 votes ties L5/2, but 1 < 5 so L1 wins the tie-break → 997.
    expect(info.perLista['1'].missing).toBe(997 - 621);  // 376
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

describe('firstSeatAt — Bolesławiec okręg 1 (hand-derived quotient ranks)', () => {
  it("d'Hondt", () => {
    const { info } = run('dh');
    expect(info.perLista['5'].firstSeatAt).toBe(1);   // vote leader
    expect(info.perLista['16'].firstSeatAt).toBe(2);
    expect(info.perLista['1'].firstSeatAt).toBe(3);
    expect(info.perLista['14'].firstSeatAt).toBe(4);
    expect(info.perLista['15'].firstSeatAt).toBe(9);  // seatless: > 5 mandaty
    expect(info.perLista['3'].firstSeatAt).toBe(17);
  });

  it('Sainte-Laguë: sparser divisor sequence reaches small committees sooner', () => {
    const { info } = run('sl');
    expect(info.perLista['5'].firstSeatAt).toBe(1);
    expect(info.perLista['15'].firstSeatAt).toBe(6);  // 9 under d'Hondt
    expect(info.perLista['3'].firstSeatAt).toBe(11);  // 17 under d'Hondt
  });
});

describe('firstSeatAt — tie-breaks mirror the allocator', () => {
  const v = { '1': 100, '2': 50, '3': 50 };

  it("d'Hondt: exact multiple ties, more-votes then lower-lista wins", () => {
    const info = analyze(v, allocate(v, 4, 'dh'), 'dh');
    // 100/2 ties 50/1 and wins (more total votes); L2 beats L3 at equal votes.
    expect(info.perLista['1'].firstSeatAt).toBe(1);
    expect(info.perLista['2'].firstSeatAt).toBe(3);
    expect(info.perLista['3'].firstSeatAt).toBe(4);
  });

  it('Sainte-Laguë: even multiple is not in the divisor sequence, no tie', () => {
    const info = analyze(v, allocate(v, 4, 'sl'), 'sl');
    // Divisor 2 does not exist in 1,3,5,… so 100 has no quotient tying 50.
    expect(info.perLista['2'].firstSeatAt).toBe(2);
    expect(info.perLista['3'].firstSeatAt).toBe(3);
  });
});

describe('firstSeatAt — property checks (re-run the engine)', () => {
  const fixtures: Array<Record<string, number>> = [
    votes,
    { '1': 90, '2': 59, '3': 19 },
    { '1': 1000, '2': 999, '3': 998, '4': 3 },
    { '1': 50, '2': 50, '3': 49 },
  ];

  for (const method of ['dh', 'sl'] as const) {
    for (const v of fixtures) {
      const info = analyze(v, allocate(v, 5, method), method);
      for (const l of Object.keys(v)) {
        it(`${method} ${JSON.stringify(v)} lista ${l}: first seat appears exactly at firstSeatAt`, () => {
          const r = info.perLista[l].firstSeatAt;
          expect(allocate(v, r, method).seatsBy[l]).toBeGreaterThanOrEqual(1);
          if (r > 1) {
            expect(allocate(v, r - 1, method).seatsBy[l]).toBe(0);
          }
        });
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
    expect(info.perLista['1'].firstSeatAt).toBe(1);
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
