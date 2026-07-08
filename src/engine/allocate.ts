export type Method = 'dh' | 'sl';
export type VotesMap = Record<string, number>;

export interface Quotient {
  lista: string;
  votes: number;
  divisor: number;
}

export interface Allocation {
  seatsBy: Record<string, number>;
  winners: Quotient[];
  last: Quotient | null;
  losing: Quotient[];
  listy: string[];
}

export const divisor = (k: number, method: Method): number =>
  method === 'dh' ? k + 1 : 2 * k + 1;

// Descending by quotient value (cross-multiplied — integers only),
// then more total votes, then lower lista number.
const cmp = (a: Quotient, b: Quotient): number =>
  b.votes * a.divisor - a.votes * b.divisor ||
  b.votes - a.votes ||
  Number(a.lista) - Number(b.lista);

export function allocate(votes: VotesMap, seats: number, method: Method): Allocation {
  const listy = Object.keys(votes).filter(l => votes[l] > 0);
  const quots: Quotient[] = [];
  for (const l of listy) {
    for (let k = 0; k < seats; k++) {
      quots.push({ lista: l, votes: votes[l], divisor: divisor(k, method) });
    }
  }
  quots.sort(cmp);
  const winners = quots.slice(0, seats);
  const seatsBy: Record<string, number> = {};
  for (const l of listy) seatsBy[l] = 0;
  for (const w of winners) seatsBy[w.lista]++;
  return {
    seatsBy,
    winners,
    last: winners[winners.length - 1] ?? null,
    losing: quots.slice(seats),
    listy,
  };
}
