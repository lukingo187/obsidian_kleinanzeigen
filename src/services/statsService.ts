import { Listing } from '../models/listing';
import { parsePortoPrice } from '../utils/formatting';

export interface ExtendedStats {
  avgSaleDurationDays: number | null;  // null if not enough data
  avgSalePrice: number | null;
  totalShippingCost: number;
  currentYearRevenue: number;
}

export interface Stats {
  activeCount: number;
  soldCount: number;
  shippedCount: number;
  completedCount: number;
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

export function calculateStats(listings: Listing[]): Stats {
  let activeCount = 0;
  let soldCount = 0;
  let shippedCount = 0;
  let completedCount = 0;
  let totalRevenue = 0;
  let totalShippingCost = 0;

  for (const l of listings) {
    switch (l.status) {
      case 'Aktiv': activeCount++; break;
      case 'Verkauft': soldCount++; break;
      case 'Verschickt': shippedCount++; break;
      case 'Abgeschlossen': completedCount++; break;
    }

    if (l.verkauft_fuer != null && typeof l.verkauft_fuer === 'number') {
      totalRevenue += l.verkauft_fuer;
    }

    if (l.porto && l.verkauft) {
      totalShippingCost += parsePortoPrice(l.porto);
    }
  }

  return {
    activeCount,
    soldCount,
    shippedCount,
    completedCount,
    totalRevenue,
    totalShippingCost,
    totalProfit: totalRevenue - totalShippingCost,
  };
}

export function calculateExtendedStats(listings: Listing[]): ExtendedStats {
  const currentYear = new Date().getFullYear().toString();

  // Avg sale duration: days from eingestellt_am to verkauft_am
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

  // Avg sale price
  const salePrices = listings
    .filter(l => l.verkauft && l.verkauft_fuer != null)
    .map(l => l.verkauft_fuer as number);
  const avgSalePrice = salePrices.length > 0
    ? salePrices.reduce((a, b) => a + b, 0) / salePrices.length
    : null;

  // Total shipping costs (only for sold items)
  let totalShippingCost = 0;
  for (const l of listings) {
    if (l.verkauft && l.porto) {
      totalShippingCost += parsePortoPrice(l.porto);
    }
  }

  // Current year revenue (for tax limit)
  let currentYearRevenue = 0;
  for (const l of listings) {
    if (l.verkauft_fuer != null && l.verkauft_am && l.verkauft_am.startsWith(currentYear)) {
      currentYearRevenue += l.verkauft_fuer;
    }
  }

  return { avgSaleDurationDays, avgSalePrice, totalShippingCost, currentYearRevenue };
}

export function calculateMonthlyStats(listings: Listing[]): PeriodStats[] {
  const months = new Map<string, { eingestellt: Listing[]; verkauft: Listing[] }>();

  for (const l of listings) {
    // Count by eingestellt_am
    if (l.eingestellt_am) {
      const key = l.eingestellt_am.slice(0, 7); // "2026-03"
      if (!months.has(key)) months.set(key, { eingestellt: [], verkauft: [] });
      months.get(key)!.eingestellt.push(l);
    }

    // Count by verkauft_am
    if (l.verkauft && l.verkauft_am) {
      const key = l.verkauft_am.slice(0, 7);
      if (!months.has(key)) months.set(key, { eingestellt: [], verkauft: [] });
      months.get(key)!.verkauft.push(l);
    }
  }

  // Sort by month descending (newest first)
  const sorted = [...months.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return sorted.map(([monthKey, data]) => {
    const [year, month] = monthKey.split('-');
    const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const label = `${monthNames[parseInt(month) - 1]} ${year}`;

    let umsatz = 0;
    let portokosten = 0;
    for (const l of data.verkauft) {
      if (l.verkauft_fuer != null && typeof l.verkauft_fuer === 'number') {
        umsatz += l.verkauft_fuer;
      }
      if (l.porto) {
        portokosten += parsePortoPrice(l.porto);
      }
    }

    return {
      label,
      eingestellt: data.eingestellt.length,
      verkauft: data.verkauft.length,
      umsatz,
      portokosten,
      gewinn: umsatz - portokosten,
    };
  });
}

export function calculateYearlyStats(listings: Listing[]): PeriodStats[] {
  const years = new Map<string, { eingestellt: Listing[]; verkauft: Listing[] }>();

  for (const l of listings) {
    if (l.eingestellt_am) {
      const key = l.eingestellt_am.slice(0, 4);
      if (!years.has(key)) years.set(key, { eingestellt: [], verkauft: [] });
      years.get(key)!.eingestellt.push(l);
    }

    if (l.verkauft && l.verkauft_am) {
      const key = l.verkauft_am.slice(0, 4);
      if (!years.has(key)) years.set(key, { eingestellt: [], verkauft: [] });
      years.get(key)!.verkauft.push(l);
    }
  }

  const sorted = [...years.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return sorted.map(([year, data]) => {
    let umsatz = 0;
    let portokosten = 0;
    for (const l of data.verkauft) {
      if (l.verkauft_fuer != null && typeof l.verkauft_fuer === 'number') {
        umsatz += l.verkauft_fuer;
      }
      if (l.porto) {
        portokosten += parsePortoPrice(l.porto);
      }
    }

    return {
      label: year,
      eingestellt: data.eingestellt.length,
      verkauft: data.verkauft.length,
      umsatz,
      portokosten,
      gewinn: umsatz - portokosten,
    };
  });
}
