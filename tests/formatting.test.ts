import { describe, it, expect } from 'vitest';
import { formatDate, formatDateDE, formatCurrency, formatPortoDisplay } from '../src/utils/formatting';

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

describe('formatPortoDisplay', () => {
  it('formats a carrier preset with name and price', () => {
    expect(formatPortoDisplay('DHL/Deutsche Post', 'Großbrief', 1.80)).toBe('Großbrief (1,80€)');
  });

  it('formats Abholung', () => {
    expect(formatPortoDisplay('Abholung', 'Abholung', 0)).toBe('Abholung');
  });

  it('formats Sonstiges with name', () => {
    expect(formatPortoDisplay('Sonstiges', 'GLS Express', 4.50)).toBe('GLS Express (4,50€)');
  });

  it('formats Sonstiges without name', () => {
    expect(formatPortoDisplay('Sonstiges', '', 3.00)).toBe('Sonstiges (3,00€)');
  });

  it('returns dash when no carrier is set', () => {
    expect(formatPortoDisplay(undefined, undefined, undefined)).toBe('—');
  });
});
