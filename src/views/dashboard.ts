import { ItemView, Notice, WorkspaceLeaf, setIcon } from 'obsidian';
import { Listing, Status, AIProvider, DEFAULT_MODELS, ArticleTemplate, ZUSTAND_OPTIONS, Zustand, PORTO_OPTIONS, PortoOption, Preisart } from '../models/listing';
import { VaultService } from '../services/vaultService';
import { AIService } from '../services/aiService';
import { calculateStats, calculateMonthlyStats, calculateYearlyStats, calculateExtendedStats } from '../services/statsService';
import { formatCurrency, formatDateDE, parsePortoPrice } from '../utils/formatting';
import { TemplateService } from '../services/templateService';
import { ExportService } from '../services/exportService';
import type KleinanzeigenPlugin from '../main';

export const DASHBOARD_VIEW_TYPE = 'kleinanzeigen-dashboard';

type FilterStatus = 'Alle' | 'Archiv' | Status;
type Tab = 'overview' | 'stats' | 'settings';
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
  private plugin: KleinanzeigenPlugin;
  private callbacks: DashboardCallbacks;
  private listings: Listing[] = [];
  private filter: FilterStatus = 'Alle';
  private searchQuery = '';
  private expandedListing: Listing | null = null;
  private activeTab: Tab = 'overview';
  private statsPeriod: StatsPeriod = 'monthly';
  private sortColumn: 'artikel' | 'preis' | 'versand' | 'eingestellt' | 'status' = 'eingestellt';
  private sortDirection: 'asc' | 'desc' = 'desc';
  private selectedPaths: Set<string> = new Set();
  private editingTemplate: ArticleTemplate | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    vaultService: VaultService,
    plugin: KleinanzeigenPlugin,
    callbacks: DashboardCallbacks,
  ) {
    super(leaf);
    this.vaultService = vaultService;
    this.plugin = plugin;
    this.callbacks = callbacks;
  }

  getViewType() { return DASHBOARD_VIEW_TYPE; }
  getDisplayText() { return 'Kleinanzeigen'; }
  getIcon() { return 'shopping-cart'; }

  async onOpen() {
    await this.refresh();
  }

  async refresh() {
    const expandedPath = this.expandedListing?.filePath;
    try {
      this.listings = await this.vaultService.getAllListings();
    } catch (e) {
      console.error('[Kleinanzeigen]', e);
      this.listings = [];
    }
    if (expandedPath) {
      this.expandedListing = this.listings.find(l => l.filePath === expandedPath) ?? null;
    }
    this.render();
  }

  // ── Layout ──

  private render() {
    const container = this.containerEl.children[1];
    container.empty();

    const root = container.createDiv({ cls: 'ka-dashboard' });

    this.renderHeader(root);
    this.renderTabs(root);

    switch (this.activeTab) {
      case 'overview': this.renderOverview(root); break;
      case 'stats': this.renderStatsView(root); break;
      case 'settings': this.renderSettingsView(root); break;
    }
  }

  private renderHeader(root: HTMLElement) {
    const header = root.createDiv({ cls: 'ka-header' });
    header.createEl('h2', { text: 'Kleinanzeigen Tracker' });

    const btns = header.createDiv({ cls: 'ka-header-btns' });

    const newBtn = btns.createEl('button', { text: '+ Neuer Artikel', cls: 'ka-new-btn' });
    newBtn.addEventListener('click', () => this.callbacks.onNewItem());

    const refreshBtn = btns.createEl('button', { cls: 'ka-refresh-btn', attr: { 'aria-label': 'Aktualisieren' } });
    setIcon(refreshBtn, 'refresh-cw');
    refreshBtn.addEventListener('click', () => this.refresh());
  }

  private renderTabs(root: HTMLElement) {
    const tabs = root.createDiv({ cls: 'ka-tabs' });
    const tabOptions: [Tab, string][] = [
      ['overview', 'Übersicht'],
      ['stats', 'Statistiken'],
      ['settings', 'Einstellungen'],
    ];

    for (const [tab, label] of tabOptions) {
      const btn = tabs.createEl('button', {
        text: label,
        cls: `ka-tab-btn ${this.activeTab === tab ? 'ka-tab-active' : ''}`,
      });
      btn.addEventListener('click', () => {
        this.activeTab = tab;
        this.selectedPaths.clear();
        this.render();
      });
    }
  }

  private async transitionStatus(listing: Listing, status: Status) {
    await this.vaultService.updateListing({ ...listing, status });
    setTimeout(() => this.refresh(), 200);
  }

  private async undoStatus(listing: Listing, targetStatus: Status) {
    const updated: Listing = { ...listing, status: targetStatus };

    // Reset sale + payment fields when reverting from Verkauft
    if (listing.status === 'Verkauft') {
      updated.verkauft = false;
      updated.verkauft_am = undefined;
      updated.verkauft_fuer = undefined;
      updated.bezahlt = false;
      updated.bezahlt_am = undefined;
      updated.bezahlart = undefined;
    }

    // Reset shipping fields when reverting from Verschickt
    if (listing.status === 'Verschickt') {
      updated.verschickt = false;
      updated.verschickt_am = undefined;
      updated.anschrift = undefined;
      updated.sendungsnummer = undefined;
      updated.label_erstellt = false;
    }

    await this.vaultService.updateListing(updated);
    setTimeout(() => this.refresh(), 200);
  }

  // ── Overview Tab ──

  private renderOverview(root: HTMLElement) {
    this.renderSummaryStats(root);

    if (this.expandedListing) {
      this.renderDetail(root, this.expandedListing);
    } else {
      this.renderFilters(root);
      this.renderSearch(root);
      this.renderBulkBar(root);
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
        this.selectedPaths.clear();
        this.render();
      });
    }

    filtersEl.createDiv({ cls: 'ka-filter-spacer' });
    const archivBtn = filtersEl.createEl('button', {
      text: 'Archiv',
      cls: `ka-filter-btn ${this.filter === 'Archiv' ? 'ka-filter-active' : ''}`,
    });
    archivBtn.addEventListener('click', () => {
      this.filter = 'Archiv';
      this.expandedListing = null;
      this.selectedPaths.clear();
      this.render();
    });
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
      this.selectedPaths.clear();
      this.renderTableOnly();
    });
  }

  private renderTableOnly() {
    const dashboard = this.containerEl.children[1].querySelector('.ka-dashboard');
    if (!dashboard) return;

    dashboard.querySelector('.ka-bulk-bar')?.remove();
    dashboard.querySelector('.ka-table')?.remove();
    dashboard.querySelector('.ka-empty')?.remove();
    this.renderBulkBar(dashboard as HTMLElement);
    this.renderTable(dashboard as HTMLElement);
  }

  private getFilteredListings(): Listing[] {
    let filtered: Listing[];

    if (this.filter === 'Archiv') {
      filtered = this.listings.filter(l => l.status === 'Archiviert');
    } else if (this.filter === 'Alle') {
      filtered = this.listings.filter(l => l.status !== 'Archiviert');
    } else {
      filtered = this.listings.filter(l => l.status === this.filter);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(l =>
        l.artikel.toLowerCase().includes(q) ||
        (l.anschrift ?? '').toLowerCase().includes(q)
      );
    }

    return this.sortListings(filtered);
  }

  private sortListings(listings: Listing[]): Listing[] {
    const dir = this.sortDirection === 'asc' ? 1 : -1;
    return [...listings].sort((a, b) => {
      let cmp = 0;
      switch (this.sortColumn) {
        case 'artikel':
          cmp = a.artikel.localeCompare(b.artikel, 'de');
          break;
        case 'preis':
          cmp = a.preis - b.preis;
          break;
        case 'versand':
          cmp = parsePortoPrice(a.porto ?? '') - parsePortoPrice(b.porto ?? '');
          break;
        case 'eingestellt':
          cmp = (a.eingestellt_am ?? '').localeCompare(b.eingestellt_am ?? '');
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status, 'de');
          break;
      }
      return cmp * dir;
    });
  }

  private renderBulkBar(root: HTMLElement) {
    if (this.selectedPaths.size === 0) return;

    const filtered = this.getFilteredListings();
    const selected = filtered.filter(l => l.filePath && this.selectedPaths.has(l.filePath));
    if (selected.length === 0) return;

    const bar = root.createDiv({ cls: 'ka-bulk-bar' });
    bar.createSpan({ text: `${selected.length} Artikel ausgewählt` });

    const actions = bar.createDiv({ cls: 'ka-bulk-actions' });

    if (selected.every(l => l.status === 'Abgeschlossen')) {
      const btn = actions.createEl('button', { text: 'Archivieren', cls: 'ka-action-btn ka-archive-action-btn' });
      btn.addEventListener('click', async () => {
        for (const l of selected) await this.vaultService.updateListing({ ...l, status: 'Archiviert' });
        this.selectedPaths.clear();
        setTimeout(() => this.refresh(), 200);
      });
    }

    if (selected.every(l => l.status === 'Aktiv')) {
      const btn = actions.createEl('button', { text: 'Abgelaufen', cls: 'ka-action-btn ka-expired-btn' });
      btn.addEventListener('click', async () => {
        for (const l of selected) await this.vaultService.updateListing({ ...l, status: 'Abgelaufen' });
        this.selectedPaths.clear();
        setTimeout(() => this.refresh(), 200);
      });
    }

    if (selected.every(l => l.status === 'Archiviert')) {
      const btn = actions.createEl('button', { text: 'Löschen', cls: 'ka-action-btn ka-delete-btn' });
      btn.addEventListener('click', async () => {
        if (!confirm(`${selected.length} Artikel wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
        for (const l of selected) await this.vaultService.deleteListing(l);
        this.selectedPaths.clear();
        setTimeout(() => this.refresh(), 200);
      });
    }

    const exportWrapper = actions.createDiv({ cls: 'ka-export-wrapper' });
    const exportBtn = exportWrapper.createEl('button', { cls: 'ka-action-btn ka-export-btn' });
    setIcon(exportBtn.createSpan(), 'share');
    exportBtn.createSpan({ text: ' Exportieren' });

    const dropdown = exportWrapper.createDiv({ cls: 'ka-export-dropdown' });
    const csvOption = dropdown.createEl('button', { cls: 'ka-export-dropdown-item' });
    setIcon(csvOption.createSpan({ cls: 'ka-export-dropdown-icon' }), 'file-spreadsheet');
    csvOption.createSpan({ text: 'CSV exportieren' });
    const closeDropdown = () => {
      dropdown.removeClass('ka-export-dropdown-visible');
      setTimeout(() => dropdown.removeClass('ka-export-dropdown-open'), 150);
    };

    csvOption.addEventListener('click', () => {
      ExportService.exportCSV(selected);
      closeDropdown();
    });
    const pdfOption = dropdown.createEl('button', { cls: 'ka-export-dropdown-item' });
    setIcon(pdfOption.createSpan({ cls: 'ka-export-dropdown-icon' }), 'file-text');
    pdfOption.createSpan({ text: 'PDF exportieren' });
    pdfOption.addEventListener('click', () => {
      ExportService.exportPDF(selected);
      closeDropdown();
    });

    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.hasClass('ka-export-dropdown-open');
      if (!isOpen) {
        dropdown.addClass('ka-export-dropdown-open');
        requestAnimationFrame(() => dropdown.addClass('ka-export-dropdown-visible'));
        const close = () => { closeDropdown(); document.removeEventListener('click', close); };
        document.addEventListener('click', close);
      } else {
        closeDropdown();
      }
    });
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

    // Select-all checkbox
    const selectAllTh = headerRow.createEl('th');
    const selectAllCb = selectAllTh.createEl('input', { type: 'checkbox', cls: 'ka-checkbox' }) as HTMLInputElement;
    const selectedCount = filtered.filter(l => l.filePath && this.selectedPaths.has(l.filePath)).length;
    selectAllCb.checked = selectedCount === filtered.length && filtered.length > 0;
    selectAllCb.indeterminate = selectedCount > 0 && selectedCount < filtered.length;
    selectAllCb.addEventListener('change', () => {
      if (selectAllCb.checked) {
        for (const l of filtered) if (l.filePath) this.selectedPaths.add(l.filePath);
      } else {
        for (const l of filtered) if (l.filePath) this.selectedPaths.delete(l.filePath);
      }
      this.renderTableOnly();
    });

    type SortKey = typeof this.sortColumn;
    const sortableColumns: [string, SortKey][] = [
      ['Artikel', 'artikel'], ['Preis', 'preis'], ['Versand', 'versand'], ['Eingestellt', 'eingestellt'], ['Status', 'status'],
    ];
    for (const [label, key] of sortableColumns) {
      const th = headerRow.createEl('th', { cls: 'ka-th-sortable' });
      th.setText(label);
      if (this.sortColumn === key) {
        th.createSpan({ cls: 'ka-sort-indicator ka-sort-active', text: this.sortDirection === 'asc' ? ' ▲' : ' ▼' });
      } else {
        th.createSpan({ cls: 'ka-sort-indicator', text: ' ▲▼' });
      }
      th.addEventListener('click', () => {
        if (this.sortColumn === key) {
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortColumn = key;
          this.sortDirection = key === 'eingestellt' ? 'desc' : 'asc';
        }
        this.renderTableOnly();
      });
    }
    headerRow.createEl('th', { text: 'Aktionen' });

    const tbody = table.createEl('tbody');
    for (const listing of filtered) {
      const row = tbody.createEl('tr', { cls: 'ka-row' });

      // Row checkbox
      const cbCell = row.createEl('td');
      const cb = cbCell.createEl('input', { type: 'checkbox', cls: 'ka-checkbox' }) as HTMLInputElement;
      cb.checked = !!listing.filePath && this.selectedPaths.has(listing.filePath);
      cb.addEventListener('click', (e) => e.stopPropagation());
      cb.addEventListener('change', () => {
        if (!listing.filePath) return;
        if (cb.checked) this.selectedPaths.add(listing.filePath);
        else this.selectedPaths.delete(listing.filePath);
        this.renderTableOnly();
      });

      row.createEl('td', { text: listing.artikel });
      row.createEl('td', { text: `${formatCurrency(listing.preis)} ${listing.preisart ?? ''}`.trim() });
      row.createEl('td', { text: listing.porto ?? '—' });
      row.createEl('td', { text: listing.eingestellt_am ? formatDateDE(listing.eingestellt_am) : '' });

      const statusCell = row.createEl('td');
      const badge = statusCell.createSpan({ cls: `ka-badge ka-status-${listing.status.toLowerCase()}` });
      badge.setText(this.statusIcon(listing.status) + ' ' + listing.status);

      const actionsCell = row.createEl('td', { cls: 'ka-actions' });
      this.renderActions(actionsCell, listing);

      row.addEventListener('click', (e) => {
        if (['BUTTON', 'INPUT'].includes((e.target as HTMLElement).tagName)) return;
        this.expandedListing = listing;
        this.render();
      });
    }
  }

  private renderActions(cell: HTMLElement, listing: Listing, context: 'table' | 'detail' = 'table') {
    const actionMap: Partial<Record<Status, { label: string; cls: string; handler: () => void }[]>> = {
      'Aktiv': context === 'detail'
        ? [
            { label: 'Verkauft', cls: 'ka-sold-btn', handler: () => this.callbacks.onSold(listing) },
            { label: 'Abgelaufen', cls: 'ka-expired-btn', handler: () => this.transitionStatus(listing, 'Abgelaufen') },
          ]
        : [{ label: 'Verkauft', cls: 'ka-sold-btn', handler: () => this.callbacks.onSold(listing) }],
      'Verkauft': [{ label: 'Verschicken', cls: 'ka-ship-btn', handler: () => this.callbacks.onShip(listing) }],
      'Verschickt': [{ label: 'Abschließen', cls: 'ka-complete-btn', handler: () => this.transitionStatus(listing, 'Abgeschlossen') }],
      'Abgeschlossen': [{ label: 'Archivieren', cls: 'ka-archive-action-btn', handler: () => this.transitionStatus(listing, 'Archiviert') }],
      'Abgelaufen': [{ label: 'Neu einstellen', cls: 'ka-relist-btn', handler: () => this.callbacks.onRelist(listing) }],
    };

    const actions = actionMap[listing.status];
    if (actions) {
      for (const action of actions) {
        const btn = cell.createEl('button', { text: action.label, cls: `ka-action-btn ${action.cls}` });
        btn.addEventListener('click', (e) => { e.stopPropagation(); action.handler(); });
      }
    }

    // Delete button for archived items
    if (listing.status === 'Archiviert') {
      const delBtn = cell.createEl('button', { text: 'Löschen', cls: 'ka-action-btn ka-delete-btn' });
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`"${listing.artikel}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
          await this.vaultService.deleteListing(listing);
          if (this.expandedListing?.filePath === listing.filePath) {
            this.expandedListing = null;
          }
          setTimeout(() => this.refresh(), 200);
        }
      });
    }

    // Undo button in detail view
    if (context === 'detail') {
      const prevStatus: Partial<Record<Status, Status>> = {
        'Verkauft': 'Aktiv',
        'Verschickt': 'Verkauft',
        'Abgeschlossen': 'Verschickt',
        'Abgelaufen': 'Aktiv',
        'Archiviert': 'Abgeschlossen',
      };
      const prev = prevStatus[listing.status];
      if (prev) {
        const undoBtn = cell.createEl('button', { text: `← ${prev}`, cls: 'ka-action-btn ka-undo-btn' });
        undoBtn.addEventListener('click', (e) => { e.stopPropagation(); this.undoStatus(listing, prev); });
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

    // Inserat
    const listingSection = grid.createDiv({ cls: 'ka-detail-section' });
    this.addSectionHeader(listingSection, 'Inserat', () => this.callbacks.onEditListing(listing));
    this.addDetailRow(listingSection, 'Preis', `${formatCurrency(listing.preis)} ${listing.preisart ?? ''}`);
    this.addDetailRow(listingSection, 'Versand', listing.porto ?? '—');
    if (listing.eingestellt_am) {
      this.addDetailRow(listingSection, 'Eingestellt am', formatDateDE(listing.eingestellt_am));
    }
    if (listing.erstmals_eingestellt_am) {
      this.addDetailRow(listingSection, 'Erstmals eingestellt', formatDateDE(listing.erstmals_eingestellt_am));
    }
    this.addDetailRow(listingSection, 'Anzahl Einstellungen', listing.eingestellt_count.toString());
    this.addDetailRow(listingSection, 'Zustand', listing.zustand);

    // Verkauf
    if (listing.verkauft) {
      const saleSection = grid.createDiv({ cls: 'ka-detail-section' });
      this.addSectionHeader(saleSection, 'Verkauf', () => this.callbacks.onSold(listing));
      if (listing.verkauft_fuer != null) this.addDetailRow(saleSection, 'Verkauft für', formatCurrency(listing.verkauft_fuer));
      if (listing.verkauft_am) this.addDetailRow(saleSection, 'Verkauft am', formatDateDE(listing.verkauft_am));
      if (listing.bezahlart) this.addDetailRow(saleSection, 'Bezahlart', listing.bezahlart);
      this.addDetailRow(saleSection, 'Bezahlt', listing.bezahlt ? '✓ Ja' : '✗ Nein');
      if (listing.bezahlt_am) this.addDetailRow(saleSection, 'Bezahlt am', formatDateDE(listing.bezahlt_am));
    }

    // Versand
    if (listing.verschickt || listing.anschrift) {
      const shipSection = grid.createDiv({ cls: 'ka-detail-section' });
      this.addSectionHeader(shipSection, 'Versand', () => this.callbacks.onShip(listing));
      if (listing.anschrift) this.addDetailRow(shipSection, 'Anschrift', listing.anschrift);
      if (listing.porto) this.addDetailRow(shipSection, 'Porto', listing.porto);
      if (listing.sendungsnummer) this.addDetailRow(shipSection, 'Sendungsnummer', listing.sendungsnummer);
      this.addDetailRow(shipSection, 'Label gedruckt', listing.label_erstellt ? '✓ Ja' : '✗ Nein');
      if (listing.verschickt_am) this.addDetailRow(shipSection, 'Verschickt am', formatDateDE(listing.verschickt_am));
    }

    // Finanzen
    if (listing.verkauft_fuer != null) {
      const finSection = grid.createDiv({ cls: 'ka-detail-section' });
      finSection.createEl('h4', { text: 'Finanzen' });

      const revenue = listing.verkauft_fuer;
      const shippingCost = listing.porto ? parsePortoPrice(listing.porto) : 0;
      const profit = revenue - shippingCost;

      this.addDetailRow(finSection, 'Einnahmen', formatCurrency(revenue));
      if (shippingCost > 0) this.addDetailRow(finSection, 'Portokosten', `−${formatCurrency(shippingCost)}`);
      this.addDetailRow(finSection, 'Gewinn', profit >= 0 ? formatCurrency(profit) : `−${formatCurrency(Math.abs(profit))}`);
    }

    // Beschreibung
    if (listing.beschreibung) {
      const descSection = detail.createDiv({ cls: 'ka-detail-section' });
      descSection.createEl('h4', { text: 'Beschreibung' });
      descSection.createDiv({ cls: 'ka-desc-box', text: listing.beschreibung });
    }

    // Aktionen
    const actionsEl = detail.createDiv({ cls: 'ka-detail-actions' });
    this.renderActions(actionsEl, listing, 'detail');
  }

  // ── Stats Tab ──

  private renderStatsView(root: HTMLElement) {
    const totalStats = calculateStats(this.listings);
    const extStats = calculateExtendedStats(this.listings);
    const aiCost = this.plugin.settings.aiUsage.anthropic.totalCostUSD
      + this.plugin.settings.aiUsage.openai.totalCostUSD;

    // Unified stats grid (8 cards, 4 per row)
    const statsGrid = root.createDiv({ cls: 'ka-stats-grid' });
    const cards: [string, string][] = [
      [this.listings.length.toString(), 'Gesamt eingestellt'],
      [totalStats.totalSoldCount.toString(), 'Gesamt verkauft'],
      [formatCurrency(totalStats.totalRevenue), 'Gesamt Umsatz'],
      [formatCurrency(totalStats.totalProfit), 'Gesamt Gewinn'],
      [extStats.avgSaleDurationDays !== null ? `${extStats.avgSaleDurationDays}d` : '—', 'Ø Verkaufsdauer'],
      [extStats.avgSalePrice !== null ? formatCurrency(extStats.avgSalePrice) : '—', 'Ø Verkaufspreis'],
      [formatCurrency(totalStats.totalShippingCost), 'Gesamtporto'],
      [`$${aiCost.toFixed(4)}`, 'API-Kosten'],
    ];
    for (const [value, label] of cards) {
      const card = statsGrid.createDiv({ cls: 'ka-stat-card' });
      card.createDiv({ cls: 'ka-stat-value', text: value });
      card.createDiv({ cls: 'ka-stat-label', text: label });
    }

    // Zeitraum-Toggle
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

    // Perioden-Tabelle
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

  // ── Settings Tab ──

  private renderSettingsView(root: HTMLElement) {
    const settings = this.plugin.settings;
    const wrap = root.createDiv({ cls: 'ka-settings' });

    this.renderAISettings(wrap, settings);
    this.renderAIUsage(wrap, settings);
    this.renderDescriptionFooter(wrap, settings);
    this.renderTemplatesSettings(wrap, settings);
    this.renderPlatformSettings(wrap, settings);
  }

  private renderTemplatesSettings(wrap: HTMLElement, settings: typeof this.plugin.settings) {
    const section = wrap.createDiv({ cls: 'ka-settings-section' });
    section.createEl('h3', { text: 'Artikel-Templates' });
    section.createDiv({ cls: 'ka-settings-section-desc', text: 'Templates erleichtern das Anlegen ähnlicher Artikel (z.B. immer gleicher Zustand, Porto, Beschreibungsvorlage).' });

    // List existing templates
    if (settings.templates.length > 0) {
      const list = section.createDiv({ cls: 'ka-template-list' });
      for (const tpl of settings.templates) {
        const row = list.createDiv({ cls: 'ka-template-row' });
        const info = row.createDiv({ cls: 'ka-template-info' });
        info.createSpan({ text: tpl.name, cls: 'ka-template-name' });
        const meta: string[] = [];
        if (tpl.artikel) meta.push(tpl.artikel);
        if (tpl.preis) meta.push(`${tpl.preis}€`);
        if (tpl.zustand) meta.push(tpl.zustand);
        if (tpl.porto) meta.push(tpl.porto);
        if (tpl.preisart) meta.push(tpl.preisart);
        if (meta.length > 0) {
          info.createSpan({ text: meta.join(' · '), cls: 'ka-template-meta' });
        }

        const btns = row.createDiv({ cls: 'ka-template-btns' });
        const editBtn = btns.createEl('button', { cls: 'ka-section-edit-btn', attr: { 'aria-label': 'Bearbeiten' } });
        setIcon(editBtn, 'pencil');
        editBtn.addEventListener('click', () => {
          this.editingTemplate = { ...tpl };
          this.render();
        });
        const delBtn = btns.createEl('button', { cls: 'ka-section-edit-btn', attr: { 'aria-label': 'Löschen' } });
        setIcon(delBtn, 'trash-2');
        delBtn.addEventListener('click', () => {
          if (confirm(`Template "${tpl.name}" löschen?`)) {
            settings.templates = TemplateService.delete(settings.templates, tpl.id);
            this.plugin.saveSettings();
            this.render();
          }
        });
      }
    }

    // Edit form (for new or existing template)
    if (this.editingTemplate !== null) {
      this.renderTemplateForm(section, settings);
    } else {
      const addBtn = section.createEl('button', { text: '+ Neues Template', cls: 'ka-test-btn' });
      addBtn.addEventListener('click', () => {
        this.editingTemplate = { id: '', name: '' };
        this.render();
      });
    }
  }

  private renderTemplateForm(container: HTMLElement, settings: typeof this.plugin.settings) {
    const tpl = this.editingTemplate!;
    const isNew = tpl.id === '';

    const form = container.createDiv({ cls: 'ka-template-form' });
    form.createEl('h4', { text: isNew ? 'Neues Template' : 'Template bearbeiten' });

    // Name
    this.addSettingRow(form, 'Template-Name *', el => {
      const input = el.createEl('input', { type: 'text', cls: 'ka-setting-input', placeholder: 'z.B. PS4 Spiel' });
      input.value = tpl.name;
      input.addEventListener('input', () => { tpl.name = input.value; });
    });

    // Artikel
    this.addSettingRow(form, 'Artikelname', el => {
      const input = el.createEl('input', { type: 'text', cls: 'ka-setting-input', placeholder: 'Vordefinierter Artikelname' });
      input.value = tpl.artikel ?? '';
      input.addEventListener('input', () => { tpl.artikel = input.value || undefined; });
    });

    // Preis
    this.addSettingRow(form, 'Preis (€)', el => {
      const input = el.createEl('input', { type: 'number', cls: 'ka-setting-input', placeholder: '0.00' });
      input.value = tpl.preis?.toString() ?? '';
      input.addEventListener('input', () => {
        const val = parseFloat(input.value);
        tpl.preis = !isNaN(val) && val > 0 ? val : undefined;
      });
    });

    // Zustand
    this.addSettingRow(form, 'Zustand', el => {
      const select = el.createEl('select', { cls: 'ka-setting-select' });
      select.createEl('option', { value: '', text: '— beliebig —' });
      for (const z of ZUSTAND_OPTIONS) {
        const opt = select.createEl('option', { value: z, text: z });
        if (tpl.zustand === z) opt.selected = true;
      }
      select.addEventListener('change', () => {
        tpl.zustand = select.value ? select.value as Zustand : undefined;
      });
    });

    // Preisart
    this.addSettingRow(form, 'Preisart', el => {
      const select = el.createEl('select', { cls: 'ka-setting-select' });
      select.createEl('option', { value: '', text: '— beliebig —' });
      for (const p of ['VB', 'Festpreis'] as Preisart[]) {
        const opt = select.createEl('option', { value: p, text: p });
        if (tpl.preisart === p) opt.selected = true;
      }
      select.addEventListener('change', () => {
        tpl.preisart = select.value ? select.value as Preisart : undefined;
      });
    });

    // Porto
    this.addSettingRow(form, 'Versand', el => {
      const select = el.createEl('select', { cls: 'ka-setting-select' });
      select.createEl('option', { value: '', text: '— beliebig —' });
      for (const p of PORTO_OPTIONS) {
        const opt = select.createEl('option', { value: p, text: p });
        if (tpl.porto === p) opt.selected = true;
      }
      select.addEventListener('change', () => {
        tpl.porto = select.value ? select.value as PortoOption : undefined;
      });
    });

    // Beschreibungsvorlage
    const descRow = form.createDiv({ cls: 'ka-setting-item ka-setting-item-vertical' });
    descRow.createEl('label', { text: 'Beschreibungsvorlage' });
    const descArea = descRow.createEl('textarea', { cls: 'ka-setting-textarea', placeholder: 'Optionaler Vorlagentext für die Beschreibung...' });
    descArea.rows = 3;
    descArea.value = tpl.beschreibungsvorlage ?? '';
    descArea.addEventListener('input', () => { tpl.beschreibungsvorlage = descArea.value || undefined; });

    // Buttons
    const btnRow = form.createDiv({ cls: 'ka-template-form-btns' });
    const saveBtn = btnRow.createEl('button', { text: 'Speichern', cls: 'ka-new-btn' });
    saveBtn.addEventListener('click', () => {
      if (!tpl.name.trim()) {
        new Notice('Bitte einen Namen für das Template eingeben.');
        return;
      }
      if (isNew) {
        settings.templates = TemplateService.create(settings.templates, {
          name: tpl.name.trim(),
          artikel: tpl.artikel,
          preis: tpl.preis,
          zustand: tpl.zustand,
          preisart: tpl.preisart,
          porto: tpl.porto,
          beschreibungsvorlage: tpl.beschreibungsvorlage,
        });
      } else {
        settings.templates = TemplateService.update(settings.templates, { ...tpl, name: tpl.name.trim() });
      }
      this.plugin.saveSettings();
      this.editingTemplate = null;
      this.render();
    });

    const cancelBtn = btnRow.createEl('button', { text: 'Abbrechen', cls: 'ka-filter-btn' });
    cancelBtn.addEventListener('click', () => {
      this.editingTemplate = null;
      this.render();
    });
  }

  private renderAISettings(wrap: HTMLElement, settings: typeof this.plugin.settings) {
    const section = wrap.createDiv({ cls: 'ka-settings-section' });
    section.createEl('h3', { text: 'KI-Konfiguration' });
    section.createDiv({ cls: 'ka-settings-section-desc', text: 'Wähle einen KI-Anbieter und hinterlege deinen API-Key für automatische Beschreibungen.' });

    // Anbieter
    this.addSettingRow(section, 'Anbieter', el => {
      const select = el.createEl('select', { cls: 'ka-setting-select' });
      const providers: [AIProvider, string][] = [
        ['anthropic', 'Anthropic (Claude)'],
        ['openai', 'OpenAI (GPT)'],
      ];
      for (const [value, label] of providers) {
        const opt = select.createEl('option', { text: label, value });
        if (settings.aiProvider === value) opt.selected = true;
      }
      select.addEventListener('change', () => {
        settings.aiProvider = select.value as AIProvider;
        this.plugin.saveSettings();
        this.render();
      });
    });

    // Modell
    this.addSettingRow(section, 'Modell', el => {
      const select = el.createEl('select', { cls: 'ka-setting-select' });
      for (const model of DEFAULT_MODELS[settings.aiProvider]) {
        const opt = select.createEl('option', { text: model.label, value: model.id });
        if (settings.aiProviders[settings.aiProvider].model === model.id) opt.selected = true;
      }
      select.addEventListener('change', () => {
        settings.aiProviders[settings.aiProvider].model = select.value;
        this.plugin.saveSettings();
      });
    });

    // API-Key
    this.addSettingRow(section, 'API-Key', el => {
      const keyInput = el.createEl('input', {
        type: 'password',
        cls: 'ka-setting-input',
        placeholder: settings.aiProvider === 'anthropic' ? 'sk-ant-...' : 'sk-...',
      });
      keyInput.value = settings.aiProviders[settings.aiProvider].apiKey;
      keyInput.addEventListener('change', () => {
        settings.aiProviders[settings.aiProvider].apiKey = keyInput.value.trim();
        this.plugin.saveSettings();
      });

      const toggleVis = el.createEl('button', { cls: 'ka-key-toggle', attr: { 'aria-label': 'API-Key anzeigen' } });
      setIcon(toggleVis, 'eye');
      toggleVis.addEventListener('click', () => {
        const isPassword = keyInput.type === 'password';
        keyInput.type = isPassword ? 'text' : 'password';
        toggleVis.empty();
        setIcon(toggleVis, isPassword ? 'eye-off' : 'eye');
      });
    });

    // API-Key testen
    this.addSettingRow(section, '', el => {
      const testBtn = el.createEl('button', { text: 'API-Key prüfen', cls: 'ka-test-btn' });
      const testResult = el.createSpan({ cls: 'ka-test-result' });

      testBtn.addEventListener('click', async () => {
        const config = settings.aiProviders[settings.aiProvider];
        if (!config.apiKey) {
          testResult.setText('Kein API-Key eingegeben.');
          testResult.className = 'ka-test-result ka-test-fail';
          return;
        }

        testBtn.textContent = 'Teste...';
        testBtn.disabled = true;
        testResult.setText('');

        try {
          const aiService = new AIService(settings);
          const result = await aiService.testApiKey(settings.aiProvider, config.apiKey, config.model);
          testResult.setText(result.ok ? 'Verbindung erfolgreich!' : (result.error ?? 'Verbindung fehlgeschlagen.'));
          testResult.className = `ka-test-result ${result.ok ? 'ka-test-ok' : 'ka-test-fail'}`;
        } catch (e: any) {
          testResult.setText(e?.message ?? 'Verbindung fehlgeschlagen.');
          testResult.className = 'ka-test-result ka-test-fail';
        } finally {
          testBtn.textContent = 'API-Key prüfen';
          testBtn.disabled = false;
        }
      });
    });
  }

  private renderAIUsage(wrap: HTMLElement, settings: typeof this.plugin.settings) {
    const section = wrap.createDiv({ cls: 'ka-settings-section' });
    section.createEl('h3', { text: 'API-Nutzung' });
    section.createDiv({ cls: 'ka-settings-section-desc', text: 'Übersicht über deine bisherige API-Nutzung und anfallende Kosten.' });

    const anthropicUsage = settings.aiUsage.anthropic;
    const openaiUsage = settings.aiUsage.openai;
    const totalCost = anthropicUsage.totalCostUSD + openaiUsage.totalCostUSD;
    const totalCalls = anthropicUsage.callCount + openaiUsage.callCount;

    const grid = section.createDiv({ cls: 'ka-usage-grid' });

    this.addUsageCard(grid, `$${totalCost.toFixed(4)}`, 'Gesamtkosten');
    this.addUsageCard(grid, totalCalls.toString(), 'API-Aufrufe');

    if (anthropicUsage.callCount > 0) {
      this.addUsageCard(grid, `$${anthropicUsage.totalCostUSD.toFixed(4)}`, `Anthropic (${anthropicUsage.callCount})`);
    }
    if (openaiUsage.callCount > 0) {
      this.addUsageCard(grid, `$${openaiUsage.totalCostUSD.toFixed(4)}`, `OpenAI (${openaiUsage.callCount})`);
    }

    if (totalCalls > 0) {
      const resetBtn = section.createEl('button', { text: 'Nutzung zurücksetzen', cls: 'ka-test-btn ka-reset-btn' });
      resetBtn.addEventListener('click', () => {
        settings.aiUsage = {
          anthropic: { totalInputTokens: 0, totalOutputTokens: 0, totalCostUSD: 0, callCount: 0 },
          openai: { totalInputTokens: 0, totalOutputTokens: 0, totalCostUSD: 0, callCount: 0 },
        };
        this.plugin.saveSettings();
        this.render();
      });
    }
  }

  private renderDescriptionFooter(wrap: HTMLElement, settings: typeof this.plugin.settings) {
    const section = wrap.createDiv({ cls: 'ka-settings-section' });
    section.createEl('h3', { text: 'Beschreibungsvorlage' });
    section.createDiv({ cls: 'ka-settings-section-desc', text: 'Dieser Text wird automatisch an jede KI-generierte Beschreibung angehängt.' });

    const group = section.createDiv({ cls: 'ka-setting-item ka-setting-item-vertical' });
    group.createEl('label', { text: 'Standardtext am Ende jeder Beschreibung' });

    const textarea = group.createEl('textarea', {
      cls: 'ka-setting-textarea',
      placeholder: 'z.B. Dies ist ein Privatverkauf. Keine Garantie, keine Rücknahme.',
    });
    textarea.rows = 3;
    textarea.value = settings.descriptionFooter;
    textarea.addEventListener('change', () => {
      settings.descriptionFooter = textarea.value;
      this.plugin.saveSettings();
    });

  }

  private renderPlatformSettings(wrap: HTMLElement, settings: typeof this.plugin.settings) {
    const section = wrap.createDiv({ cls: 'ka-settings-section' });
    section.createEl('h3', { text: 'Plattformen' });
    section.createDiv({ cls: 'ka-settings-section-desc', text: 'Zusätzliche Verkaufsplattformen neben Kleinanzeigen.' });

    const group = section.createDiv({ cls: 'ka-setting-item ka-setting-toggle' });
    group.createEl('label', { text: 'eBay aktivieren' });

    const toggleBtn = group.createEl('button', { cls: 'ka-toggle-switch', attr: { role: 'switch', 'aria-checked': String(settings.ebayEnabled) } });
    if (settings.ebayEnabled) toggleBtn.addClass('is-active');
    toggleBtn.disabled = true;
    toggleBtn.addEventListener('click', () => {
      settings.ebayEnabled = !settings.ebayEnabled;
      toggleBtn.toggleClass('is-active', settings.ebayEnabled);
      toggleBtn.setAttribute('aria-checked', String(settings.ebayEnabled));
      this.plugin.saveSettings();
    });

    section.createDiv({ cls: 'ka-setting-hint', text: 'Kommt in einem zukünftigen Update.' });
  }

  // ── Helpers ──

  private addSettingRow(container: HTMLElement, label: string, render: (el: HTMLElement) => void) {
    const row = container.createDiv({ cls: 'ka-setting-item' });
    row.createEl('label', { text: label });
    render(row);
  }

  private addUsageCard(container: HTMLElement, value: string, label: string) {
    const card = container.createDiv({ cls: 'ka-usage-card' });
    card.createDiv({ cls: 'ka-usage-value', text: value });
    card.createDiv({ cls: 'ka-usage-label', text: label });
  }

  private addSectionHeader(container: HTMLElement, title: string, onEdit: () => void) {
    const header = container.createDiv({ cls: 'ka-section-header' });
    header.createEl('h4', { text: title });
    const editBtn = header.createEl('button', { cls: 'ka-section-edit-btn', attr: { 'aria-label': 'Bearbeiten' } });
    setIcon(editBtn, 'pencil');
    editBtn.addEventListener('click', () => onEdit());
  }

  private addDetailRow(container: HTMLElement, label: string, value: string) {
    const row = container.createDiv({ cls: 'ka-detail-row' });
    row.createSpan({ cls: 'ka-detail-label', text: label });
    row.createSpan({ cls: 'ka-detail-value', text: value });
  }

  private statusIcon(status: Status): string {
    const icons: Record<Status, string> = {
      'Aktiv': '🟢',
      'Verkauft': '💰',
      'Verschickt': '🚚',
      'Abgeschlossen': '✅',
      'Abgelaufen': '⏳',
      'Archiviert': '📦',
    };
    return icons[status];
  }
}
