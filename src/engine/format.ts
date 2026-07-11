export const fmt = (n: number): string => Math.round(n).toLocaleString('pl-PL');

export const fmtPct = (x: number): string =>
  x.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

export const fmtDec = (x: number, digits: number): string =>
  x.toLocaleString('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const pl = (one: string, few: string, many: string) => (n: number): string => {
  const a = Math.abs(n) % 100;
  const b = Math.abs(n) % 10;
  if (n === 1) return one;
  if (b >= 2 && b <= 4 && (a < 12 || a > 14)) return few;
  return many;
};

export const plGlos = pl('głos', 'głosy', 'głosów');
export const plMandat = pl('mandat', 'mandaty', 'mandatów');
export const plZestaw = pl('zestaw', 'zestawy', 'zestawów');
export const plAktywny = pl('aktywny', 'aktywne', 'aktywnych');
