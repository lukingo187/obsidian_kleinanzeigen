import { describe, it, expect } from 'vitest';
import { formatDate, formatDateDE, formatCurrency, parsePortoPrice } from '../src/utils/formatting';

describe('formatDate', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(formatDate(new Date(2026, 2, 15))).toBe('2026-03-15');
  });

  it('pads single-digit month and day', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('formatDateDE', () => {
  it('converts YYYY-MM-DD to DD.MM.YYYY', () => {
    expect(formatDateDE('2026-03-15')).toBe('15.03.2026');
  });

  it('returns empty string for empty input', () => {
    expect(formatDateDE('')).toBe('');
  });

  it('returns input unchanged if not a valid date format', () => {
    expect(formatDateDE('invalid')).toBe('invalid');
  });
});

describe('formatCurrency', () => {
  it('formats a number as German currency', () => {
    expect(formatCurrency(12.5)).toBe('12,50€');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('0,00€');
  });

  it('handles NaN-like input gracefully', () => {
    expect(formatCurrency(NaN)).toBe('0,00€');
  });

  it('formats whole numbers with decimals', () => {
    expect(formatCurrency(100)).toBe('100,00€');
  });
});

describe('parsePortoPrice', () => {
  it('extracts price from porto string', () => {
    expect(parsePortoPrice('Paket 2kg (6,19€)')).toBe(6.19);
  });

  it('handles Abholung', () => {
    expect(parsePortoPrice('Abholung (0,00€)')).toBe(0);
  });

  it('returns 0 for unrecognized format', () => {
    expect(parsePortoPrice('Selbstabholung')).toBe(0);
  });

  it('extracts price from Großbrief', () => {
    expect(parsePortoPrice('Großbrief (1,80€)')).toBe(1.8);
  });
});
