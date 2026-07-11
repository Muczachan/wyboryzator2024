import { VotesMap, allocate } from './allocate';

export interface RawKandydat { name: string; glosy: number }
export interface RawObwod {
  okreg: number;
  wyborcy: number;
  wyborcy_glosujacy: number;
  kandydaci: Record<string, Record<string, RawKandydat>>;
}
export interface RawOkreg {
  mandaty: number;
  listy: number;
  wyborcy: number;
  granice: string;
  kandydaci: Record<string, { komitet: string }>;
  obwody: Record<string, RawObwod>;
}
export interface RawGmina {
  wojewodztwo: string;
  powiat: string;
  gmina: string;
  organ: string;
  siedziba: string;
  okregi: Record<string, RawOkreg>;
}

export interface ObwodInfo { nr: string; okreg: string; wyborcy: number; glosy: number; votes: VotesMap }
export interface OkregModel {
  nr: string;
  mandaty: number;
  listy: number;
  wyborcy: number;
  granice: string;
  obwodNrs: string[];
  votes: VotesMap;
  totalVotes: number;
  realSeats: Record<string, number>;
}
export interface GminaModel {
  teryt: string;
  nazwa: string;
  organ: string;
  powiat: string;
  wojewodztwo: string;
  siedziba: string;
  okregNrs: string[];
  okregi: Record<string, OkregModel>;
  komitetName: Record<string, string>;
  obwodByNr: Record<string, ObwodInfo>;
  obwodNrs: string[];
  wyborcyGmina: number;
  mandatyGmina: number;
  votesGmina: VotesMap;
  glosyGmina: number;
}

const numAsc = (a: string, b: string) => Number(a) - Number(b);

function addVotes(into: VotesMap, from: VotesMap): void {
  for (const l of Object.keys(from)) into[l] = (into[l] ?? 0) + from[l];
}

export function deriveGmina(teryt: string, raw: RawGmina): GminaModel {
  const okregNrs = Object.keys(raw.okregi).sort(numAsc);
  const komitetName: Record<string, string> = {};
  const obwodByNr: Record<string, ObwodInfo> = {};
  const okregi: Record<string, OkregModel> = {};
  let wyborcyGmina = 0;
  let mandatyGmina = 0;
  const votesGmina: VotesMap = {};

  for (const nr of okregNrs) {
    const ok = raw.okregi[nr];
    wyborcyGmina += ok.wyborcy;
    mandatyGmina += ok.mandaty;
    for (const l of Object.keys(ok.kandydaci ?? {})) {
      if (ok.kandydaci[l].komitet) komitetName[l] = ok.kandydaci[l].komitet;
    }
    const obwodNrs = Object.keys(ok.obwody ?? {}).sort(numAsc);
    const votes: VotesMap = {};
    for (const onr of obwodNrs) {
      const ob = ok.obwody[onr];
      const obVotes: VotesMap = {};
      for (const l of Object.keys(ob.kandydaci ?? {})) {
        let s = 0;
        for (const pos of Object.keys(ob.kandydaci[l])) s += ob.kandydaci[l][pos].glosy ?? 0;
        obVotes[l] = s;
      }
      obwodByNr[onr] = {
        nr: onr,
        okreg: nr,
        wyborcy: ob.wyborcy,
        glosy: Object.values(obVotes).reduce((a, b) => a + b, 0),
        votes: obVotes,
      };
      addVotes(votes, obVotes);
    }
    okregi[nr] = {
      nr,
      mandaty: ok.mandaty,
      listy: ok.listy,
      wyborcy: ok.wyborcy,
      granice: ok.granice || '—',
      obwodNrs,
      votes,
      totalVotes: Object.values(votes).reduce((a, b) => a + b, 0),
      realSeats: allocate(votes, ok.mandaty, 'dh').seatsBy,
    };
    addVotes(votesGmina, votes);
  }

  const glosyGmina = Object.values(votesGmina).reduce((a, b) => a + b, 0);

  return {
    teryt,
    nazwa: raw.gmina,
    organ: raw.organ,
    powiat: raw.powiat,
    wojewodztwo: raw.wojewodztwo,
    siedziba: raw.siedziba,
    okregNrs,
    okregi,
    komitetName,
    obwodByNr,
    obwodNrs: Object.keys(obwodByNr).sort(numAsc),
    wyborcyGmina,
    mandatyGmina,
    votesGmina,
    glosyGmina,
  };
}

export const nameOf = (m: GminaModel, lista: string): string =>
  m.komitetName[lista] ?? 'Lista nr ' + lista;

// Statutory 5% threshold (art. 416 Kodeksu wyborczego): a committee takes
// part in seat division iff it won at least 5% of valid votes gmina-wide.
// Integer arithmetic: v/total ≥ 1/20 ⟺ 20·v ≥ total.
export const overProg = (m: GminaModel, lista: string): boolean =>
  20 * (m.votesGmina[lista] ?? 0) >= m.glosyGmina;

export function votesOfSelection(model: GminaModel, sel: string[]): VotesMap {
  const v: VotesMap = {};
  for (const nr of sel) {
    const ob = model.obwodByNr[nr];
    if (ob) addVotes(v, ob.votes);
  }
  return v;
}

export const sumVotes = (v: VotesMap): number =>
  Object.values(v).reduce((a, b) => a + b, 0);

export function defaultMandaty(model: GminaModel, selWyborcy: number): number {
  return Math.max(1, Math.round((model.mandatyGmina * selWyborcy) / model.wyborcyGmina));
}

export const clampMandaty = (n: number): number => Math.min(60, Math.max(1, n));
