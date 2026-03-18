import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Listing, Status } from '../models/listing';
import { VaultService } from '../services/vaultService';
import { calculateStats, calculateMonthlyStats, calculateYearlyStats, PeriodStats } from '../services/statsService';
import { formatCurrency, formatDateDE, parsePortoPrice } from '../utils/formatting';

export const DASHBOARD_VIEW_TYPE = 'kleinanzeigen-dashboard';

type FilterStatus = 'Alle' | Status;
type Tab = 'overview' | 'stats';
type StatsPeriod = 'monthly' | 'yearly';

interface DashboardCallbacks {
  onSold: (listing: Listing) => void;
  onShip: (listing: Listing) => void;
  onRelist: (listing: Listing) => void;
  onNewItem: () => void;
  onEditListing: (listing: Listing) => void;
}

export class DashboardView extends ItemView {
  private vaultService: VaultService;
  private callbacks: DashboardCallbacks;
  private listings: Listing[] = [];
  private filter: FilterStatus = 'Alle';
  private searchQuery = '';
  private expandedListing: Listing | null = null;
  private activeTab: Tab = 'overview';
  private statsPeriod: StatsPeriod = 'monthly';

  constructor(
    leaf: WorkspaceLeaf,
    vaultService: VaultService,
    callbacks: DashboardCallbacks,
  ) {
    super(leaf);
    this.vaultService = vaultService;
    this.callbacks = callbacks;
  }

  getViewType() { return DASHBOARD_VIEW_TYPE; }
  getDisplayText() { return 'Kleinanzeigen'; }
  getIcon() { return 'shopping-cart'; }

  async onOpen() {
    await this.refresh();
  }

  async refresh() {
    try {
      this.listings = await this.vaultService.getAllListings();
    } catch (e) {
      console.error('[Kleinanzeigen]', e);
      this.listings = [];
    }
    this.render();
  }

  private render() {
    const container = this.containerEl.children[1];
    container.empty();

    const root = container.createDiv({ cls: 'ka-dashboard' });

    this.renderHeader(root);
    this.renderTabs(root);

    if (this.activeTab === 'overview') {
      this.renderOverview(root);
    } else {
      this.renderStatsView(root);
    }
  }

  private renderHeader(root: HTMLElement) {
    const header = root.createDiv({ cls: 'ka-header' });
    header.createEl('h2', { text: 'Kleinanzeigen Tracker' });
    const headerBtns = header.createDiv({ cls: 'ka-header-btns' });
    const newBtn = headerBtns.createEl('button', { text: '+ Neuer Artikel', cls: 'ka-new-btn' });
    newBtn.addEventListener('click', () => this.callbacks.onNewItem());
    const refreshBtn = headerBtns.createEl('button', { text: '↻', cls: 'ka-refresh-btn' });
    refreshBtn.addEventListener('click', () => this.refresh());
  }

  private renderTabs(root: HTMLElement) {
    const tabs = root.createDiv({ cls: 'ka-tabs' });
    const tabOptions: [Tab, string][] = [['overview', 'Übersicht'], ['stats', 'Statistik']];

    for (const [tab, label] of tabOptions) {
      const btn = tabs.createEl('button', {
        text: label,
        cls: `ka-tab-btn ${this.activeTab === tab ? 'ka-tab-active' : ''}`,
      });
      btn.addEventListener('click', () => {
        this.activeTab = tab;
        this.render();
      });
    }
  }

  // ── Overview Tab ──

  private renderOverview(root: HTMLElement) {
    this.renderSummaryStats(root);
    this.renderFilters(root);
    this.renderSearch(root);

    if (this.expandedListing) {
      this.renderDetail(root, this.expandedListing);
    } else {
      this.renderTable(root);
    }
  }

  private renderSummaryStats(root: HTMLElement) {
    const stats = calculateStats(this.listings);
    const statsEl = root.createDiv({ cls: 'ka-stats' });

    const items: [string, string][] = [
      ['Aktiv', stats.activeCount.toString()],
      ['Verkauft', stats.soldCount.toString()],
      ['Verschickt', stats.shippedCount.toString()],
      ['Abgeschlossen', stats.completedCount.toString()],
      ['Umsatz', formatCurrency(stats.totalRevenue)],
      ['Gewinn', formatCurrency(stats.totalProfit)],
    ];

    for (const [label, value] of items) {
      const card = statsEl.createDiv({ cls: 'ka-stat-card' });
      card.createDiv({ cls: 'ka-stat-value', text: value });
      card.createDiv({ cls: 'ka-stat-label', text: label });
    }
  }

  private renderFilters(root: HTMLElement) {
    const filtersEl = root.createDiv({ cls: 'ka-filters' });
    const options: FilterStatus[] = ['Alle', 'Aktiv', 'Verkauft', 'Verschickt', 'Abgeschlossen', 'Abgelaufen'];

    for (const opt of options) {
      const btn = filtersEl.createEl('button', {
        text: opt,
        cls: `ka-filter-btn ${this.filter === opt ? 'ka-filter-active' : ''}`,
      });
      btn.addEventListener('click', () => {
        this.filter = opt;
        this.expandedListing = null;
        this.render();
      });
    }
  }

  private renderSearch(root: HTMLElement) {
    const searchEl = root.createDiv({ cls: 'ka-search' });
    const input = searchEl.createEl('input', {
      type: 'text',
      placeholder: 'Suche nach Artikel...',
      cls: 'ka-search-input',
    });
    input.value = this.searchQuery;
    input.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.expandedListing = null;
      this.renderTableOnly();
    });
  }

  private renderTableOnly() {
    const container = this.containerEl.children[1];
    const dashboard = container.querySelector('.ka-dashboard');
    if (!dashboard) return;

    dashboard.querySelector('.ka-table')?.remove();
    dashboard.querySelector('.ka-empty')?.remove();

    this.renderTable(dashboard as HTMLElement);
  }

  private getFilteredListings(): Listing[] {
    let filtered = this.filter === 'Alle'
      ? this.listings
      : this.listings.filter(l => l.status === this.filter);

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(l =>
        l.artikel.toLowerCase().includes(q) ||
        (l.anschrift ?? '').toLowerCase().includes(q)
      );
    }

    return filtered;
  }

  private renderTable(root: HTMLElement) {
    const filtered = this.getFilteredListings();

    if (filtered.length === 0) {
      root.createDiv({ cls: 'ka-empty', text: 'Keine Artikel gefunden.' });
      return;
    }

    const table = root.createEl('table', { cls: 'ka-table' });

    const thead = table.createEl('thead');
    const headerRow = thead.createEl('tr');
    for (const col of ['Artikel', 'Zustand', 'Preis', 'Versand', 'Eingestellt', 'Status', 'Aktionen']) {
      headerRow.createEl('th', { text: col });
    }

    const tbody = table.createEl('tbody');
    for (const listing of filtered) {
      const row = tbody.createEl('tr', { cls: 'ka-row' });

      row.createEl('td', { text: listing.artikel });
      row.createEl('td', { text: listing.zustand });
      row.createEl('td', { text: `${formatCurrency(listing.preis)} ${listing.preisart ?? ''}`.trim() });
      row.createEl('td', { text: listing.porto ?? '—' });
      row.createEl('td', { text: listing.eingestellt_am ? formatDateDE(listing.eingestellt_am) : '' });

      const statusCell = row.createEl('td');
      const badge = statusCell.createSpan({ cls: `ka-badge ka-status-${listing.status.toLowerCase()}` });
      badge.setText(this.statusIcon(listing.status) + ' ' + listing.status);

      const actionsCell = row.createEl('td', { cls: 'ka-actions' });
      this.renderActions(actionsCell, listing);

      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName === 'BUTTON') return;
        this.expandedListing = listing;
        this.render();
      });
    }
  }

  private renderActions(cell: HTMLElement, listing: Listing) {
    switch (listing.status) {
      case 'Aktiv': {
        const btn = cell.createEl('button', { text: 'Verkauft', cls: 'ka-action-btn ka-sold-btn' });
        btn.addEventListener('click', (e) => { e.stopPropagation(); this.callbacks.onSold(listing); });
        break;
      }
      case 'Verkauft': {
        const btn = cell.createEl('button', { text: 'Verschicken', cls: 'ka-action-btn ka-ship-btn' });
        btn.addEventListener('click', (e) => { e.stopPropagation(); this.callbacks.onShip(listing); });
        break;
      }
      case 'Verschickt': {
        const btn = cell.createEl('button', { text: 'Abschließen', cls: 'ka-action-btn ka-complete-btn' });
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          listing.status = 'Abgeschlossen';
          await this.vaultService.updateListing(listing);
          setTimeout(() => this.refresh(), 200);
        });
        break;
      }
      case 'Abgelaufen': {
        const btn = cell.createEl('button', { text: 'Neu einstellen', cls: 'ka-action-btn ka-relist-btn' });
        btn.addEventListener('click', (e) => { e.stopPropagation(); this.callbacks.onRelist(listing); });
        break;
      }
    }
  }

  // ── Detail View ──

  private renderDetail(root: HTMLElement, listing: Listing) {
    const detail = root.createDiv({ cls: 'ka-detail' });

    const backBtn = detail.createEl('button', { text: '← Zurück zur Liste', cls: 'ka-back-btn' });
    backBtn.addEventListener('click', () => {
      this.expandedListing = null;
      this.render();
    });

    const titleRow = detail.createDiv({ cls: 'ka-detail-title' });
    titleRow.createEl('h3', { text: listing.artikel });
    const badge = titleRow.createSpan({ cls: `ka-badge ka-status-${listing.status.toLowerCase()}` });
    badge.setText(this.statusIcon(listing.status) + ' ' + listing.status);

    const grid = detail.createDiv({ cls: 'ka-detail-grid' });

    // Listing info
    const listingSection = grid.createDiv({ cls: 'ka-detail-section' });
    this.addSectionHeader(listingSection, 'Inserat', () => this.callbacks.onEditListing(listing));
    this.addDetailRow(listingSection, 'Zustand', listing.zustand);
    this.addDetailRow(listingSection, 'Preis', `${formatCurrency(listing.preis)} ${listing.preisart ?? ''}`);
    this.addDetailRow(listingSection, 'Versand', listing.porto ?? '—');
    if (listing.eingestellt_am) {
      this.addDetailRow(listingSection, 'Eingestellt am', formatDateDE(listing.eingestellt_am));
    }
    if (listing.erstmals_eingestellt_am && listing.eingestellt_count > 1) {
      this.addDetailRow(listingSection, 'Erstmals eingestellt', formatDateDE(listing.erstmals_eingestellt_am));
      this.addDetailRow(listingSection, 'Anzahl Einstellungen', listing.eingestellt_count.toString());
    }

    // Sale info
    if (listing.verkauft) {
      const saleSection = grid.createDiv({ cls: 'ka-detail-section' });
      this.addSectionHeader(saleSection, 'Verkauf', () => this.callbacks.onSold(listing));
      if (listing.verkauft_fuer != null) {
        this.addDetailRow(saleSection, 'Verkauft für', formatCurrency(listing.verkauft_fuer));
      }
      if (listing.verkauft_am) {
        this.addDetailRow(saleSection, 'Verkauft am', formatDateDE(listing.verkauft_am));
      }
      if (listing.bezahlart) {
        this.addDetailRow(saleSection, 'Bezahlart', listing.bezahlart);
      }
      this.addDetailRow(saleSection, 'Bezahlt', listing.bezahlt ? '✓ Ja' : '✗ Nein');
      if (listing.bezahlt_am) {
        this.addDetailRow(saleSection, 'Bezahlt am', formatDateDE(listing.bezahlt_am));
      }
    }

    // Shipping info
    if (listing.verschickt || listing.anschrift) {
      const shipSection = grid.createDiv({ cls: 'ka-detail-section' });
      this.addSectionHeader(shipSection, 'Versand', () => this.callbacks.onShip(listing));
      if (listing.anschrift) {
        this.addDetailRow(shipSection, 'Anschrift', listing.anschrift);
      }
      if (listing.porto) {
        this.addDetailRow(shipSection, 'Porto', listing.porto);
      }
      if (listing.sendungsnummer) {
        this.addDetailRow(shipSection, 'Sendungsnummer', listing.sendungsnummer);
      }
      this.addDetailRow(shipSection, 'Label gedruckt', listing.label_erstellt ? '✓ Ja' : '✗ Nein');
      if (listing.verschickt_am) {
        this.addDetailRow(shipSection, 'Verschickt am', formatDateDE(listing.verschickt_am));
      }
    }

    // Financials
    if (listing.verkauft_fuer != null) {
      const finSection = grid.createDiv({ cls: 'ka-detail-section' });
      finSection.createEl('h4', { text: 'Finanzen' });

      const revenue = listing.verkauft_fuer;
      const shippingCost = listing.porto ? parsePortoPrice(listing.porto) : 0;
      const profit = revenue - shippingCost;

      this.addDetailRow(finSection, 'Einnahmen', formatCurrency(revenue));
      if (shippingCost > 0) {
        this.addDetailRow(finSection, 'Portokosten', `−${formatCurrency(shippingCost)}`);
      }
      const profitStr = profit >= 0
        ? formatCurrency(profit)
        : `−${formatCurrency(Math.abs(profit))}`;
      this.addDetailRow(finSection, 'Gewinn', profitStr);
    }

    // Description
    if (listing.beschreibung) {
      const descSection = detail.createDiv({ cls: 'ka-detail-section' });
      descSection.createEl('h4', { text: 'Beschreibung' });
      descSection.createDiv({ cls: 'ka-desc-box', text: listing.beschreibung });
    }

    // Actions
    const actionsEl = detail.createDiv({ cls: 'ka-detail-actions' });
    this.renderActions(actionsEl, listing);
  }

  // ── Stats Tab ──

  private renderStatsView(root: HTMLElement) {
    // Period toggle
    const toggle = root.createDiv({ cls: 'ka-filters' });
    const periods: [StatsPeriod, string][] = [['monthly', 'Monatlich'], ['yearly', 'Jährlich']];
    for (const [period, label] of periods) {
      const btn = toggle.createEl('button', {
        text: label,
        cls: `ka-filter-btn ${this.statsPeriod === period ? 'ka-filter-active' : ''}`,
      });
      btn.addEventListener('click', () => {
        this.statsPeriod = period;
        this.render();
      });
    }

    // Gesamt-Zusammenfassung
    const allSold = this.listings.filter(l => l.verkauft);
    const totalStats = calculateStats(this.listings);
    const summaryEl = root.createDiv({ cls: 'ka-stats' });
    const summaryItems: [string, string][] = [
      ['Gesamt eingestellt', this.listings.length.toString()],
      ['Gesamt verkauft', allSold.length.toString()],
      ['Gesamt Umsatz', formatCurrency(totalStats.totalRevenue)],
      ['Gesamt Gewinn', formatCurrency(totalStats.totalProfit)],
    ];
    for (const [label, value] of summaryItems) {
      const card = summaryEl.createDiv({ cls: 'ka-stat-card' });
      card.createDiv({ cls: 'ka-stat-value', text: value });
      card.createDiv({ cls: 'ka-stat-label', text: label });
    }

    // Period table
    const periodData = this.statsPeriod === 'monthly'
      ? calculateMonthlyStats(this.listings)
      : calculateYearlyStats(this.listings);

    if (periodData.length === 0) {
      root.createDiv({ cls: 'ka-empty', text: 'Noch keine Daten vorhanden.' });
      return;
    }

    const table = root.createEl('table', { cls: 'ka-table' });
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

  // ── Helpers ──

  private addSectionHeader(container: HTMLElement, title: string, onEdit: () => void) {
    const header = container.createDiv({ cls: 'ka-section-header' });
    header.createEl('h4', { text: title });
    const editBtn = header.createEl('button', { text: '✏️', cls: 'ka-section-edit-btn', attr: { 'aria-label': 'Bearbeiten' } });
    editBtn.addEventListener('click', () => onEdit());
  }

  private addDetailRow(container: HTMLElement, label: string, value: string) {
    const row = container.createDiv({ cls: 'ka-detail-row' });
    row.createSpan({ cls: 'ka-detail-label', text: label });
    row.createSpan({ cls: 'ka-detail-value', text: value });
  }

  private statusIcon(status: Status): string {
    switch (status) {
      case 'Aktiv': return '🟢';
      case 'Verkauft': return '💰';
      case 'Verschickt': return '🚚';
      case 'Abgeschlossen': return '✅';
      case 'Abgelaufen': return '⏳';
    }
  }
}
