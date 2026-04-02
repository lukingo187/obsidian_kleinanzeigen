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
  eingestellt: number;
  verkauft: number;
  umsatz: number;
  portokosten: number;
  gewinn: number;
}

function sumFinancials(listings: Listing[]): { umsatz: number; portokosten: number } {
  let umsatz = 0;
  let portokosten = 0;
  for (const l of listings) {
    if (l.verkauft_fuer != null) umsatz += l.verkauft_fuer;
    if (l.porto_price != null) portokosten += l.porto_price;
  }
  return { umsatz, portokosten };
}

function calculatePeriodStats(
  listings: Listing[],
  keyLength: number,
  labelFn: (key: string) => string,
): PeriodStats[] {
  const periods = new Map<string, { eingestellt: number; verkauft: Listing[] }>();

  for (const l of listings) {
    if (l.eingestellt_am) {
      const key = l.eingestellt_am.slice(0, keyLength);
      if (!periods.has(key)) periods.set(key, { eingestellt: 0, verkauft: [] });
      periods.get(key)!.eingestellt++;
    }
    if (l.verkauft && l.verkauft_am) {
      const key = l.verkauft_am.slice(0, keyLength);
      if (!periods.has(key)) periods.set(key, { eingestellt: 0, verkauft: [] });
      periods.get(key)!.verkauft.push(l);
    }
  }

  const sorted = [...periods.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return sorted.map(([key, data]) => {
    const { umsatz, portokosten } = sumFinancials(data.verkauft);
    return {
      label: labelFn(key),
      eingestellt: data.eingestellt,
      verkauft: data.verkauft.length,
      umsatz,
      portokosten,
      gewinn: umsatz - portokosten,
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
      case 'Aktiv': activeCount++; break;
      case 'Verkauft': soldCount++; break;
      case 'Verschickt': shippedCount++; break;
      case 'Abgeschlossen': completedCount++; break;
    }

    if (l.verkauft) totalSoldCount++;

    if (l.verkauft_fuer != null) {
      totalRevenue += l.verkauft_fuer;
    }

    if (l.porto_price != null && l.verkauft) {
      totalShippingCost += l.porto_price;
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
    if (l.verkauft && l.eingestellt_am && l.verkauft_am) {
      const start = new Date(l.eingestellt_am).getTime();
      const end = new Date(l.verkauft_am).getTime();
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
    .filter(l => l.verkauft && l.verkauft_fuer != null)
    .map(l => l.verkauft_fuer as number);
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
