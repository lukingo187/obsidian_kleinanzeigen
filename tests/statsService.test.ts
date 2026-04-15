import { describe, it, expect } from 'vitest';
import { calculateStats, calculateExtendedStats, calculateMonthlyStats, calculateYearlyStats } from '../src/services/statsService';
import { makeListing } from './helpers';

describe('calculateStats', () => {
  it('returns zeros for empty array', () => {
    const stats = calculateStats([]);
    expect(stats.activeCount).toBe(0);
    expect(stats.totalRevenue).toBe(0);
    expect(stats.totalProfit).toBe(0);
  });

  it('counts statuses correctly', () => {
    const listings = [
      makeListing({ status: 'active' }),
      makeListing({ status: 'active' }),
      makeListing({ status: 'sold', verkauft: true, verkauft_fuer: 25 }),
      makeListing({ status: 'shipped', verkauft: true, verkauft_fuer: 15 }),
      makeListing({ status: 'completed', verkauft: true, verkauft_fuer: 30 }),
    ];
    const stats = calculateStats(listings);
    expect(stats.activeCount).toBe(2);
    expect(stats.soldCount).toBe(1);
    expect(stats.shippedCount).toBe(1);
    expect(stats.completedCount).toBe(1);
    expect(stats.totalSoldCount).toBe(3);
  });

  it('sums revenue from verkauft_fuer', () => {
    const listings = [
      makeListing({ verkauft: true, verkauft_fuer: 25 }),
      makeListing({ verkauft: true, verkauft_fuer: 15.50 }),
      makeListing({ verkauft: false }),
    ];
    const stats = calculateStats(listings);
    expect(stats.totalRevenue).toBeCloseTo(40.50);
  });

  it('calculates shipping costs and profit', () => {
    const listings = [
      makeListing({ verkauft: true, verkauft_fuer: 50, porto_price: 6.19, carrier: 'DHL/Deutsche Post' }),
      makeListing({ verkauft: true, verkauft_fuer: 20, porto_price: 1.80, carrier: 'DHL/Deutsche Post' }),
    ];
    const stats = calculateStats(listings);
    expect(stats.totalRevenue).toBeCloseTo(70);
    expect(stats.totalShippingCost).toBeCloseTo(7.99);
    expect(stats.totalProfit).toBeCloseTo(62.01);
  });

  it('ignores porto for unsold items', () => {
    const listings = [
      makeListing({ verkauft: false, porto_price: 6.19 }),
    ];
    const stats = calculateStats(listings);
    expect(stats.totalShippingCost).toBe(0);
  });
});

describe('calculateExtendedStats', () => {
  it('returns nulls for empty array', () => {
    const stats = calculateExtendedStats([]);
    expect(stats.avgSaleDurationDays).toBeNull();
    expect(stats.avgSalePrice).toBeNull();
  });

  it('calculates average sale duration in days', () => {
    const listings = [
      makeListing({ verkauft: true, eingestellt_am: '2026-03-01', verkauft_am: '2026-03-11' }),
      makeListing({ verkauft: true, eingestellt_am: '2026-03-01', verkauft_am: '2026-03-05' }),
    ];
    const stats = calculateExtendedStats(listings);
    // (10 + 4) / 2 = 7
    expect(stats.avgSaleDurationDays).toBe(7);
  });

  it('calculates average sale price', () => {
    const listings = [
      makeListing({ verkauft: true, verkauft_fuer: 20 }),
      makeListing({ verkauft: true, verkauft_fuer: 40 }),
      makeListing({ verkauft: false }),
    ];
    const stats = calculateExtendedStats(listings);
    expect(stats.avgSalePrice).toBe(30);
  });
});

describe('calculateMonthlyStats', () => {
  it('returns empty array for no listings', () => {
    expect(calculateMonthlyStats([])).toEqual([]);
  });

  it('groups listings by month', () => {
    const listings = [
      makeListing({ eingestellt_am: '2026-03-01' }),
      makeListing({ eingestellt_am: '2026-03-15' }),
      makeListing({ eingestellt_am: '2026-02-10' }),
    ];
    const stats = calculateMonthlyStats(listings);
    expect(stats).toHaveLength(2);
    // Newest first
    expect(stats[0].label).toBe('Mär 2026');
    expect(stats[0].eingestellt).toBe(2);
    expect(stats[1].label).toBe('Feb 2026');
    expect(stats[1].eingestellt).toBe(1);
  });

  it('calculates revenue and shipping per month', () => {
    const listings = [
      makeListing({
        eingestellt_am: '2026-03-01',
        verkauft: true,
        verkauft_am: '2026-03-10',
        verkauft_fuer: 50,
        porto_price: 6.19,
      }),
    ];
    const stats = calculateMonthlyStats(listings);
    expect(stats[0].umsatz).toBeCloseTo(50);
    expect(stats[0].portokosten).toBeCloseTo(6.19);
    expect(stats[0].gewinn).toBeCloseTo(43.81);
  });
});

describe('calculateYearlyStats', () => {
  it('groups listings by year', () => {
    const listings = [
      makeListing({ eingestellt_am: '2026-03-01' }),
      makeListing({ eingestellt_am: '2025-11-15' }),
    ];
    const stats = calculateYearlyStats(listings);
    expect(stats).toHaveLength(2);
    expect(stats[0].label).toBe('2026');
    expect(stats[1].label).toBe('2025');
  });
});
