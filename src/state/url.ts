import { Method } from '../engine/allocate';

export type View = 'picker' | 'gmina' | 'builder';

export interface AppState {
  view: View;
  teryt: string | null;
  sel: string[];
  mandatyOverride: number | null;
  method: Method;
  compare: boolean;
}

const numAsc = (a: string, b: string) => Number(a) - Number(b);

export function parseHash(hash: string): AppState {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const g = p.get('g') ?? '';
  const teryt = /^\d{6}$/.test(g) ? g : null;
  const v = p.get('v');
  const view: View = teryt ? (v === 'builder' ? 'builder' : 'gmina') : 'picker';
  const m = parseInt(p.get('m') ?? '', 10);
  const sel = [...new Set((p.get('o') ?? '').split('.').filter(s => /^\d+$/.test(s)))].sort(numAsc);
  return {
    view,
    teryt,
    sel,
    mandatyOverride: Number.isInteger(m) ? Math.min(60, Math.max(1, m)) : null,
    method: p.get('met') === 'sl' ? 'sl' : 'dh',
    compare: p.get('cmp') === '1',
  };
}

export function toHash(s: AppState): string {
  const p = new URLSearchParams();
  if (s.teryt) {
    p.set('g', s.teryt);
    p.set('v', s.view);
  }
  if (s.sel.length) p.set('o', s.sel.join('.'));
  if (s.mandatyOverride != null) p.set('m', String(s.mandatyOverride));
  if (s.method === 'sl') p.set('met', 'sl');
  if (s.compare) p.set('cmp', '1');
  return p.toString();
}
