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
      makeListing({ status: 'sold', sold: true, sold_for: 25 }),
      makeListing({ status: 'shipped', sold: true, sold_for: 15 }),
      makeListing({ status: 'completed', sold: true, sold_for: 30 }),
    ];
    const stats = calculateStats(listings);
    expect(stats.activeCount).toBe(2);
    expect(stats.soldCount).toBe(1);
    expect(stats.shippedCount).toBe(1);
    expect(stats.completedCount).toBe(1);
    expect(stats.totalSoldCount).toBe(3);
  });

  it('sums revenue from sold_for', () => {
    const listings = [
      makeListing({ sold: true, sold_for: 25 }),
      makeListing({ sold: true, sold_for: 15.50 }),
      makeListing({ sold: false }),
    ];
    const stats = calculateStats(listings);
    expect(stats.totalRevenue).toBeCloseTo(40.50);
  });

  it('calculates shipping costs and profit', () => {
    const listings = [
      makeListing({ sold: true, sold_for: 50, shipping_cost: 6.19, carrier: 'DHL' }),
      makeListing({ sold: true, sold_for: 20, shipping_cost: 1.80, carrier: 'DHL' }),
    ];
    const stats = calculateStats(listings);
    expect(stats.totalRevenue).toBeCloseTo(70);
    expect(stats.totalShippingCost).toBeCloseTo(7.99);
    expect(stats.totalProfit).toBeCloseTo(62.01);
  });

  it('ignores shipping cost for unsold items', () => {
    const listings = [
      makeListing({ sold: false, shipping_cost: 6.19 }),
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
      makeListing({ sold: true, listed_at: '2026-03-01', sold_at: '2026-03-11' }),
      makeListing({ sold: true, listed_at: '2026-03-01', sold_at: '2026-03-05' }),
    ];
    const stats = calculateExtendedStats(listings);
    // (10 + 4) / 2 = 7
    expect(stats.avgSaleDurationDays).toBe(7);
  });

  it('calculates average sale price', () => {
    const listings = [
      makeListing({ sold: true, sold_for: 20 }),
      makeListing({ sold: true, sold_for: 40 }),
      makeListing({ sold: false }),
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
      makeListing({ listed_at: '2026-03-01' }),
      makeListing({ listed_at: '2026-03-15' }),
      makeListing({ listed_at: '2026-02-10' }),
    ];
    const stats = calculateMonthlyStats(listings);
    expect(stats).toHaveLength(2);
    // Newest first
    expect(stats[0].label).toBe('Mar 2026');
    expect(stats[0].listed).toBe(2);
    expect(stats[1].label).toBe('Feb 2026');
    expect(stats[1].listed).toBe(1);
  });

  it('calculates revenue and shipping per month', () => {
    const listings = [
      makeListing({
        listed_at: '2026-03-01',
        sold: true,
        sold_at: '2026-03-10',
        sold_for: 50,
        shipping_cost: 6.19,
      }),
    ];
    const stats = calculateMonthlyStats(listings);
    expect(stats[0].revenue).toBeCloseTo(50);
    expect(stats[0].shippingCost).toBeCloseTo(6.19);
    expect(stats[0].profit).toBeCloseTo(43.81);
  });
});

describe('calculateYearlyStats', () => {
  it('groups listings by year', () => {
    const listings = [
      makeListing({ listed_at: '2026-03-01' }),
      makeListing({ listed_at: '2025-11-15' }),
    ];
    const stats = calculateYearlyStats(listings);
    expect(stats).toHaveLength(2);
    expect(stats[0].label).toBe('2026');
    expect(stats[1].label).toBe('2025');
  });
});
