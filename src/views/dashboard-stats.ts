import { setIcon } from 'obsidian';
import type { Listing, PluginSettings } from '../models/listing';
import { calculateStats, calculateMonthlyStats, calculateYearlyStats, calculateExtendedStats } from '../services/statsService';
import { formatCurrency } from '../utils/formatting';
import type { StatsState, StatsPeriod } from './dashboard-types';

function renderPeriodTable(container: HTMLElement, listings: Listing[], state: StatsState) {
  container.empty();

  const periodData = state.statsPeriod === 'monthly'
    ? calculateMonthlyStats(listings)
    : calculateYearlyStats(listings);

  if (periodData.length === 0) {
    container.createDiv({ cls: 'ka-empty', text: 'Noch keine Daten vorhanden.' });
    return;
  }

  const table = container.createEl('table', { cls: 'ka-table' });
  const thead = table.createEl('thead');
  const headerRow = thead.createEl('tr');
  for (const col of ['Zeitraum', 'Eingestellt', 'Verkauft', 'Umsatz', 'Portokosten', 'Gewinn']) {
    headerRow.createEl('th', { text: col });
  }

  const tbody = table.createEl('tbody');
  for (const row of periodData) {
    const tr = tbody.createEl('tr');
    tr.createEl('td', { text: row.label, cls: 'ka-font-bold' });
    tr.createEl('td', { text: row.eingestellt.toString() });
    tr.createEl('td', { text: row.verkauft.toString() });
    tr.createEl('td', { text: formatCurrency(row.umsatz) });
    tr.createEl('td', { text: formatCurrency(row.portokosten) });

    const gewinnCell = tr.createEl('td');
    const cls = row.gewinn >= 0 ? 'ka-profit-positive' : 'ka-profit-negative';
    gewinnCell.createSpan({ text: formatCurrency(row.gewinn), cls });
  }
}

export function renderStatsView(root: HTMLElement, listings: Listing[], state: StatsState, settings: PluginSettings) {
  const totalStats = calculateStats(listings);
  const extStats = calculateExtendedStats(listings);
  const aiCost = settings.aiUsage.google.totalCostUSD
    + settings.aiUsage.anthropic.totalCostUSD
    + settings.aiUsage.openai.totalCostUSD;

  const statsGrid = root.createDiv({ cls: 'ka-stats-grid' });
  const cards: [string, string, string, string][] = [
    [listings.length.toString(), 'Gesamt eingestellt', 'package', 'stats-listed'],
    [totalStats.totalSoldCount.toString(), 'Gesamt verkauft', 'shopping-cart', 'stats-sold'],
    [formatCurrency(totalStats.totalRevenue), 'Gesamt Umsatz', 'trending-up', 'stats-revenue'],
    [formatCurrency(totalStats.totalProfit), 'Gesamt Gewinn', 'wallet', 'stats-profit'],
    [extStats.avgSaleDurationDays !== null ? `${extStats.avgSaleDurationDays}d` : '—', 'Ø Verkaufsdauer', 'clock', 'stats-duration'],
    [extStats.avgSalePrice !== null ? formatCurrency(extStats.avgSalePrice) : '—', 'Ø Verkaufspreis', 'tag', 'stats-avgprice'],
    [formatCurrency(totalStats.totalShippingCost), 'Gesamtporto', 'truck', 'stats-shipping'],
    [`$${aiCost.toFixed(4)}`, 'API-Kosten', 'cpu', 'stats-ai'],
  ];
  for (let i = 0; i < cards.length; i++) {
    const [value, label, icon, accent] = cards[i];
    const card = statsGrid.createDiv({ cls: `ka-stat-card ka-${accent}` });
    card.style.animationDelay = `${i * 40}ms`;
    const iconEl = card.createDiv({ cls: 'ka-stat-icon' });
    setIcon(iconEl, icon);
    card.createDiv({ cls: 'ka-stat-value', text: value });
    card.createDiv({ cls: 'ka-stat-label', text: label });
  }

  // Zeitraum-Toggle
  const toggle = root.createDiv({ cls: 'ka-filters' });
  const periodContainer = root.createDiv({ cls: 'ka-period-container' });
  const periods: [StatsPeriod, string][] = [['monthly', 'Monatlich'], ['yearly', 'Jährlich']];
  for (const [period, label] of periods) {
    const btn = toggle.createEl('button', {
      text: label,
      cls: `ka-filter-btn ${state.statsPeriod === period ? 'ka-filter-active' : ''}`,
    });
    btn.addEventListener('click', () => {
      state.statsPeriod = period;
      renderPeriodTable(periodContainer, listings, state);
      toggle.querySelectorAll('.ka-filter-btn').forEach((b, i) => {
        b.toggleClass('ka-filter-active', periods[i][0] === period);
      });
    });
  }

  renderPeriodTable(periodContainer, listings, state);
}
