import { Allocation, Method, Quotient, VotesMap, divisor } from './allocate';

export interface ListaAnalytics {
  firstSeatAt: number;
  missing?: number;
  margin?: number;
  marginOver?: string;
  surplus?: number;
}

export interface Analytics {
  perLista: Record<string, ListaAnalytics>;
  wastedSum: number;
  wastedListy: string[];
  surplusSum: number;
  minMissingLista: string | null;
}

// Smallest total vote count with which `lista`, at divisor `d`, outranks
// `target` under the allocation ordering (quotient, then total votes, then
// lower lista number). Integer arithmetic throughout.
export function minVotesToBeat(target: Quotient, d: number, lista: string): number {
  const num = target.votes * d;
  const strict = Math.floor(num / target.divisor) + 1;
  if (num % target.divisor === 0) {
    const tie = num / target.divisor;
    if (tie > target.votes || (tie === target.votes && Number(lista) < Number(target.lista))) {
      return tie; // wins the tie-break at exactly-equal quotients
    }
  }
  return strict;
}

// Minimum okręg size at which `lista` wins its first seat: the rank of its
// full vote total (first quotient, divisor 1) among all quotients, under the
// allocation ordering. Closed form per rival: divisors with a strictly higher
// quotient satisfy w > v·d, i.e. d ≤ ⌊(w−1)/v⌋; an exact multiple ties and
// the rival wins by cmp's total-votes/lista-number rules.
function firstSeatAt(votes: VotesMap, lista: string, method: Method): number {
  const v = votes[lista];
  let rank = 1;
  for (const m of Object.keys(votes)) {
    const w = votes[m];
    if (m === lista || w <= 0) continue;
    const dmax = Math.floor((w - 1) / v);
    rank += method === 'dh' ? dmax : Math.floor((dmax + 1) / 2);
    if (w % v === 0) {
      const d = w / v;
      const inSeq = method === 'dh' || d % 2 === 1;
      if (inSeq && (w > v || Number(m) < Number(lista))) rank++;
    }
  }
  return rank;
}

export function analyze(votes: VotesMap, alloc: Allocation, method: Method): Analytics {
  const { last, losing, seatsBy } = alloc;
  const listy = [...alloc.listy].sort((a, b) => votes[b] - votes[a]);
  const perLista: Record<string, ListaAnalytics> = {};
  let surplusSum = 0;
  let minMissing = Infinity;
  let minMissingLista: string | null = null;

  for (const l of listy) {
    const v = votes[l];
    const sc = seatsBy[l] ?? 0;
    const rec: ListaAnalytics = { firstSeatAt: firstSeatAt(votes, l, method) };
    if (last) {
      const bestOther = losing.find(q => q.lista !== l);
      if (last.lista !== l) {
        rec.missing = Math.max(1, minVotesToBeat(last, divisor(sc, method), l) - v);
        if (rec.missing < minMissing) {
          minMissing = rec.missing;
          minMissingLista = l;
        }
      } else if (bestOther) {
        rec.margin = Math.max(0, v - minVotesToBeat(bestOther, last.divisor, l));
        rec.marginOver = bestOther.lista;
      }
      if (sc > 0) {
        rec.surplus = bestOther
          ? Math.max(0, v - minVotesToBeat(bestOther, divisor(sc - 1, method), l))
          : v - 1;
        surplusSum += rec.surplus;
      }
    }
    perLista[l] = rec;
  }

  const wastedListy = listy.filter(l => (seatsBy[l] ?? 0) === 0);
  const wastedSum = wastedListy.reduce((a, l) => a + votes[l], 0);
  return { perLista, wastedSum, wastedListy, surplusSum, minMissingLista };
}
