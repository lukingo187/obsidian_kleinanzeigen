import { setIcon } from 'obsidian';
import type { Listing, PluginSettings } from '../models/listing';
import { t } from '../i18n';
import { calculateStats, calculateMonthlyStats, calculateYearlyStats, calculateExtendedStats } from '../services/statsService';
import { formatCurrency } from '../utils/formatting';
import type { StatsState, StatsPeriod } from './dashboard-types';

function renderPeriodTable(container: HTMLElement, listings: Listing[], state: StatsState) {
  container.empty();

  const periodData = state.statsPeriod === 'monthly'
    ? calculateMonthlyStats(listings)
    : calculateYearlyStats(listings);

  if (periodData.length === 0) {
    container.createDiv({ cls: 'ka-empty', text: t('stats.empty') });
    return;
  }

  const table = container.createEl('table', { cls: 'ka-table' });
  const thead = table.createEl('thead');
  const headerRow = thead.createEl('tr');
  for (const col of [t('stats.col.period'), t('stats.col.listed'), t('stats.col.sold'), t('stats.col.revenue'), t('stats.col.shipping'), t('stats.col.profit')]) {
    headerRow.createEl('th', { text: col });
  }

  const tbody = table.createEl('tbody');
  for (const row of periodData) {
    const tr = tbody.createEl('tr');
    tr.createEl('td', { text: row.label, cls: 'ka-font-bold' });
    tr.createEl('td', { text: row.listed.toString() });
    tr.createEl('td', { text: row.sold.toString() });
    tr.createEl('td', { text: formatCurrency(row.revenue) });
    tr.createEl('td', { text: formatCurrency(row.shippingCost) });

    const profitCell = tr.createEl('td');
    const cls = row.profit >= 0 ? 'ka-profit-positive' : 'ka-profit-negative';
    profitCell.createSpan({ text: formatCurrency(row.profit), cls });
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
    [listings.length.toString(), t('stats.card.totalListed'), 'package', 'stats-listed'],
    [totalStats.totalSoldCount.toString(), t('stats.card.totalSold'), 'shopping-cart', 'stats-sold'],
    [formatCurrency(totalStats.totalRevenue), t('stats.card.totalRevenue'), 'trending-up', 'stats-revenue'],
    [formatCurrency(totalStats.totalProfit), t('stats.card.totalProfit'), 'wallet', 'stats-profit'],
    [extStats.avgSaleDurationDays !== null ? t('stats.durationDays', { days: extStats.avgSaleDurationDays }) : '—', t('stats.card.avgDuration'), 'clock', 'stats-duration'],
    [extStats.avgSalePrice !== null ? formatCurrency(extStats.avgSalePrice) : '—', t('stats.card.avgPrice'), 'tag', 'stats-avgprice'],
    [formatCurrency(totalStats.totalShippingCost), t('stats.card.totalShipping'), 'truck', 'stats-shipping'],
    [`$${aiCost.toFixed(4)}`, t('stats.card.apiCost'), 'cpu', 'stats-ai'],
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

  const toggle = root.createDiv({ cls: 'ka-filters' });
  const periodContainer = root.createDiv({ cls: 'ka-period-container' });
  const periods: [StatsPeriod, string][] = [['monthly', t('stats.period.monthly')], ['yearly', t('stats.period.yearly')]];
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
