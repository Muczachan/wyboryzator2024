import { describe, expect, it } from 'vitest';
import { fmt, fmtDec, fmtPct, plGlos } from './format';

const sp = (s: string) => s.replace(/[\s  ]/g, ' ');

describe('fmt', () => {
  it('groups thousands and rounds', () => {
    expect(sp(fmt(1234567))).toBe('1 234 567');
    expect(sp(fmt(999))).toBe('999');
    expect(sp(fmt(1254.6))).toBe('1255');
  });
});

describe('fmtPct', () => {
  it('one decimal, comma, percent sign', () => {
    expect(fmtPct(8.34)).toBe('8,3%');
    expect(fmtPct(12)).toBe('12,0%');
    expect(fmtPct(100)).toBe('100,0%');
  });
});

describe('fmtDec', () => {
  it('fixed decimals with comma', () => {
    expect(fmtDec(3.14159, 2)).toBe('3,14');
    expect(fmtDec(498.5, 1)).toBe('498,5');
  });
});

describe('plGlos', () => {
  it('handles Polish plural forms', () => {
    expect(plGlos(1)).toBe('głos');
    expect(plGlos(2)).toBe('głosy');
    expect(plGlos(4)).toBe('głosy');
    expect(plGlos(5)).toBe('głosów');
    expect(plGlos(12)).toBe('głosów');
    expect(plGlos(14)).toBe('głosów');
    expect(plGlos(22)).toBe('głosy');
    expect(plGlos(112)).toBe('głosów');
    expect(plGlos(122)).toBe('głosy');
  });
});
