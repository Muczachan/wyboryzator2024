import { describe, expect, it } from 'vitest';
import { allocate, divisor } from './allocate';

describe('divisor', () => {
  it("d'Hondt 1,2,3...; Sainte-Lague 1,3,5...", () => {
    expect([0, 1, 2].map(k => divisor(k, 'dh'))).toEqual([1, 2, 3]);
    expect([0, 1, 2].map(k => divisor(k, 'sl'))).toEqual([1, 3, 5]);
  });
});

describe("allocate - textbook example where methods differ", () => {
  // A=90 B=59 C=19, 5 seats.
  // d'Hondt quotients: A 90,45,30,22.5,18 | B 59,29.5,19.67 | C 19
  //   top5 = 90,59,45,30,29.5 -> A3 B2 C0, last = B/2
  // Sainte-Lague: A 90,30,18 | B 59,19.67 | C 19
  //   top5 = 90,59,30,19.67,19 -> A2 B2 C1, last = C/1
  const votes = { '1': 90, '2': 59, '3': 19 };

  it("d'Hondt", () => {
    const a = allocate(votes, 5, 'dh');
    expect(a.seatsBy).toEqual({ '1': 3, '2': 2, '3': 0 });
    expect(a.last).toEqual({ lista: '2', votes: 59, divisor: 2 });
    expect(a.winners).toHaveLength(5);
  });

  it("Sainte-Lague", () => {
    const a = allocate(votes, 5, 'sl');
    expect(a.seatsBy).toEqual({ '1': 2, '2': 2, '3': 1 });
    expect(a.last).toEqual({ lista: '3', votes: 19, divisor: 1 });
  });
});

describe("allocate - real data: Bolesławiec (020101) okręg 1, 5 mandatów, d'Hondt", () => {
  // Committee vote sums computed from public/data/020101.json okregzat 1.
  // Hand-derived quotient table:
  //   L5:  997, 498.5, 332.33...   L16: 783, 391.5   L1: 621, 310.5
  //   L14: 580, 290              L15: 303          L3: 168
  // top5 = 997, 783, 621, 580, 498.5 -> L5=2, L16=1, L1=1, L14=1; last = L5/2.
  const votes = { '1': 621, '3': 168, '5': 997, '14': 580, '15': 303, '16': 783 };

  it('matches the hand-computed allocation', () => {
    const a = allocate(votes, 5, 'dh');
    expect(a.seatsBy).toEqual({ '1': 1, '3': 0, '5': 2, '14': 1, '15': 0, '16': 1 });
    expect(a.last).toEqual({ lista: '5', votes: 997, divisor: 2 });
  });
});

describe("allocate - tie-breaks", () => {
  it("equal quotients, equal votes -> lower lista number", () => {
    // 100,100,50,50,... - 3rd seat: 50 vs 50 tie, equal totals -> lista 1
    const a = allocate({ '1': 100, '2': 100 }, 3, 'dh');
    expect(a.seatsBy).toEqual({ '1': 2, '2': 1 });
  });

  it("equal quotients -> more total votes wins", () => {
    // 200/2 = 100 ties 100/1 = 100 -> lista 1 has more total votes
    const a = allocate({ '1': 200, '2': 100 }, 2, 'dh');
    expect(a.seatsBy).toEqual({ '1': 2, '2': 0 });
  });

  it("exact integer comparison (cross-multiplied, no float noise)", () => {
    // 333/3 === 111/1 exactly; tie-break by votes -> lista 1
    const a = allocate({ '1': 333, '2': 111 }, 3, 'dh');
    expect(a.seatsBy).toEqual({ '1': 3, '2': 0 });
  });
});

describe("allocate - edge cases", () => {
  it("zero-vote lists are excluded", () => {
    const a = allocate({ '1': 100, '2': 0 }, 2, 'dh');
    expect(a.listy).toEqual(['1']);
    expect(a.seatsBy).toEqual({ '1': 2 });
  });

  it("no votes at all -> empty allocation", () => {
    const a = allocate({}, 5, 'dh');
    expect(a.seatsBy).toEqual({});
    expect(a.winners).toEqual([]);
    expect(a.last).toBeNull();
  });

  it("seats always fully assigned when any votes exist", () => {
    const a = allocate({ '1': 3 }, 10, 'dh');
    expect(a.seatsBy).toEqual({ '1': 10 });
    expect(a.winners).toHaveLength(10);
  });
});
