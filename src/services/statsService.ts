import { Listing } from '../models/listing';

export interface ExtendedStats {
  avgSaleDurationDays: number | null;
  avgSalePrice: number | null;
}

export interface Stats {
  activeCount: number;
  soldCount: number;
  shippedCount: number;
  completedCount: number;
  totalSoldCount: number;
  totalRevenue: number;
  totalShippingCost: number;
  totalProfit: number;
}

export interface PeriodStats {
  label: string;
  listed: number;
  sold: number;
  revenue: number;
  shippingCost: number;
  profit: number;
}

function sumFinancials(listings: Listing[]): { revenue: number; shippingCost: number } {
  let revenue = 0;
  let shippingCost = 0;
  for (const l of listings) {
    if (l.sold_for != null) revenue += l.sold_for;
    if (l.shipping_cost != null) shippingCost += l.shipping_cost;
  }
  return { revenue, shippingCost };
}

function calculatePeriodStats(
  listings: Listing[],
  keyLength: number,
  labelFn: (key: string) => string,
): PeriodStats[] {
  const periods = new Map<string, { listed: number; sold: Listing[] }>();

  for (const l of listings) {
    if (l.listed_at) {
      const key = l.listed_at.slice(0, keyLength);
      if (!periods.has(key)) periods.set(key, { listed: 0, sold: [] });
      periods.get(key)!.listed++;
    }
    if (l.sold && l.sold_at) {
      const key = l.sold_at.slice(0, keyLength);
      if (!periods.has(key)) periods.set(key, { listed: 0, sold: [] });
      periods.get(key)!.sold.push(l);
    }
  }

  const sorted = [...periods.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return sorted.map(([key, data]) => {
    const { revenue, shippingCost } = sumFinancials(data.sold);
    return {
      label: labelFn(key),
      listed: data.listed,
      sold: data.sold.length,
      revenue,
      shippingCost,
      profit: revenue - shippingCost,
    };
  });
}

export function calculateStats(listings: Listing[]): Stats {
  let activeCount = 0;
  let soldCount = 0;
  let shippedCount = 0;
  let completedCount = 0;
  let totalSoldCount = 0;
  let totalRevenue = 0;
  let totalShippingCost = 0;

  for (const l of listings) {
    switch (l.status) {
      case 'active': activeCount++; break;
      case 'sold': soldCount++; break;
      case 'shipped': shippedCount++; break;
      case 'completed': completedCount++; break;
      case 'expired':
      case 'archived':
        break;
    }

    if (l.sold) totalSoldCount++;

    if (l.sold_for != null) {
      totalRevenue += l.sold_for;
    }

    if (l.shipping_cost != null && l.sold) {
      totalShippingCost += l.shipping_cost;
    }
  }

  return {
    activeCount,
    soldCount,
    shippedCount,
    completedCount,
    totalSoldCount,
    totalRevenue,
    totalShippingCost,
    totalProfit: totalRevenue - totalShippingCost,
  };
}

export function calculateExtendedStats(listings: Listing[]): ExtendedStats {
  const durations: number[] = [];
  for (const l of listings) {
    if (l.sold && l.listed_at && l.sold_at) {
      const start = new Date(l.listed_at).getTime();
      const end = new Date(l.sold_at).getTime();
      const days = (end - start) / (1000 * 60 * 60 * 24);
      if (!isNaN(days) && days >= 0) {
        durations.push(days);
      }
    }
  }
  const avgSaleDurationDays = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  const salePrices = listings
    .filter(l => l.sold && l.sold_for != null)
    .map(l => l.sold_for!);
  const avgSalePrice = salePrices.length > 0
    ? salePrices.reduce((a, b) => a + b, 0) / salePrices.length
    : null;

  return { avgSaleDurationDays, avgSalePrice };
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export function calculateMonthlyStats(listings: Listing[]): PeriodStats[] {
  return calculatePeriodStats(listings, 7, key => {
    const [year, month] = key.split('-');
    return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
  });
}

export function calculateYearlyStats(listings: Listing[]): PeriodStats[] {
  return calculatePeriodStats(listings, 4, key => key);
}
