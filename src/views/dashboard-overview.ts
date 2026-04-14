import { App, Notice, setIcon } from 'obsidian';
import type { Listing, Status } from '../models/listing';
import { VaultService } from '../services/vaultService';
import { calculateStats } from '../services/statsService';
import { ExportService } from '../services/exportService';
import { formatCurrency, formatDateDE, formatPortoDisplay } from '../utils/formatting';
import { ConfirmModal } from '../modals/confirmModal';
import type { FilterStatus, OverviewState, DashboardCallbacks, DashboardActions, DropdownState } from './dashboard-types';
import { renderStatusBadge, addSectionHeader, addDetailRow, createCopyButton } from './dashboard-helpers';

function getFilteredListings(listings: Listing[], state: OverviewState): Listing[] {
  let filtered: Listing[];

  if (state.filter === 'Archiv') {
    filtered = listings.filter(l => l.status === 'Archiviert');
  } else if (state.filter === 'Alle') {
    filtered = listings.filter(l => l.status !== 'Archiviert');
  } else {
    filtered = listings.filter(l => l.status === state.filter);
  }

  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(l =>
      l.artikel.toLowerCase().includes(q) ||
      (l.anschrift ?? '').toLowerCase().includes(q)
    );
  }

  return sortListings(filtered, state);
}

function sortListings(listings: Listing[], state: OverviewState): Listing[] {
  const dir = state.sortDirection === 'asc' ? 1 : -1;
  return [...listings].sort((a, b) => {
    let cmp = 0;
    switch (state.sortColumn) {
      case 'artikel':
        cmp = a.artikel.localeCompare(b.artikel, 'de');
        break;
      case 'preis':
        cmp = a.preis - b.preis;
        break;
      case 'versand':
        cmp = (a.porto_price ?? 0) - (b.porto_price ?? 0);
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

function renderSummaryStats(root: HTMLElement, listings: Listing[]) {
  const stats = calculateStats(listings);
  const statsEl = root.createDiv({ cls: 'ka-stats' });

  const items: [string, string, string, string][] = [
    ['Aktiv', stats.activeCount.toString(), 'circle-dot', 'aktiv'],
    ['Verkauft', stats.soldCount.toString(), 'banknote', 'verkauft'],
    ['Verschickt', stats.shippedCount.toString(), 'truck', 'verschickt'],
    ['Abgeschlossen', stats.completedCount.toString(), 'circle-check', 'abgeschlossen'],
    ['Umsatz', formatCurrency(stats.totalRevenue), 'trending-up', 'umsatz'],
    ['Gewinn', formatCurrency(stats.totalProfit), 'wallet', 'gewinn'],
  ];

  for (const [label, value, icon, accent] of items) {
    const card = statsEl.createDiv({ cls: `ka-stat-card ka-accent-${accent}` });
    const iconEl = card.createDiv({ cls: 'ka-stat-icon' });
    setIcon(iconEl, icon);
    card.createDiv({ cls: 'ka-stat-value', text: value });
    card.createDiv({ cls: 'ka-stat-label', text: label });
  }
}

function renderFilters(root: HTMLElement, state: OverviewState, actions: DashboardActions) {
  const filtersEl = root.createDiv({ cls: 'ka-filters' });
  const options: FilterStatus[] = ['Alle', 'Aktiv', 'Verkauft', 'Verschickt', 'Abgeschlossen', 'Abgelaufen'];

  for (const opt of options) {
    const btn = filtersEl.createEl('button', {
      text: opt,
      cls: `ka-filter-btn ${state.filter === opt ? 'ka-filter-active' : ''}`,
    });
    btn.addEventListener('click', () => {
      state.filter = opt;
      state.expandedListing = null;
      state.selectedPaths.clear();
      actions.render();
    });
  }

  filtersEl.createDiv({ cls: 'ka-filter-spacer' });
  const archivBtn = filtersEl.createEl('button', {
    text: 'Archiv',
    cls: `ka-filter-btn ${state.filter === 'Archiv' ? 'ka-filter-active' : ''}`,
  });
  archivBtn.addEventListener('click', () => {
    state.filter = 'Archiv';
    state.expandedListing = null;
    state.selectedPaths.clear();
    actions.render();
  });
}

function renderSearch(root: HTMLElement, state: OverviewState, renderTableOnly: () => void) {
  const searchEl = root.createDiv({ cls: 'ka-search' });
  const input = searchEl.createEl('input', {
    type: 'text',
    placeholder: 'Suche nach Artikel...',
    cls: 'ka-search-input',
  });
  input.value = state.searchQuery;
  input.addEventListener('input', (e) => {
    state.searchQuery = (e.target as HTMLInputElement).value;
    state.expandedListing = null;
    state.selectedPaths.clear();
    renderTableOnly();
  });
}

function renderBulkBar(
  root: HTMLElement,
  app: App,
  listings: Listing[],
  state: OverviewState,
  actions: DashboardActions,
  vaultService: VaultService,
  dropdownState: DropdownState,
  renderTableOnly: () => void,
) {
  if (state.selectedPaths.size === 0) return;

  const filtered = getFilteredListings(listings, state);
  const selected = filtered.filter(l => l.filePath && state.selectedPaths.has(l.filePath));
  if (selected.length === 0) return;

  const bar = root.createDiv({ cls: 'ka-bulk-bar' });
  bar.createSpan({ text: `${selected.length} Artikel ausgewählt` });

  const actionsEl = bar.createDiv({ cls: 'ka-bulk-actions' });

  if (selected.every(l => l.status === 'Abgeschlossen')) {
    const btn = actionsEl.createEl('button', { text: 'Archivieren', cls: 'ka-action-btn ka-archive-action-btn' });
    btn.addEventListener('click', async () => {
      let failed = 0;
      for (const l of selected) {
        try { await vaultService.updateListing({ ...l, status: 'Archiviert' }); }
        catch { failed++; }
      }
      state.selectedPaths.clear();
      if (failed > 0) new Notice(`${failed} von ${selected.length} Artikeln konnten nicht archiviert werden.`);
      actions.refreshAfterWrite();
    });
  }

  if (selected.every(l => l.status === 'Aktiv')) {
    const btn = actionsEl.createEl('button', { text: 'Abgelaufen', cls: 'ka-action-btn ka-expired-btn' });
    btn.addEventListener('click', async () => {
      let failed = 0;
      for (const l of selected) {
        try { await vaultService.updateListing({ ...l, status: 'Abgelaufen' }); }
        catch { failed++; }
      }
      state.selectedPaths.clear();
      if (failed > 0) new Notice(`${failed} von ${selected.length} Artikeln konnten nicht aktualisiert werden.`);
      actions.refreshAfterWrite();
    });
  }

  if (selected.every(l => l.status === 'Archiviert')) {
    const btn = actionsEl.createEl('button', { text: 'Löschen', cls: 'ka-action-btn ka-delete-btn' });
    btn.addEventListener('click', () => {
      new ConfirmModal(app, `${selected.length} Artikel wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`, async () => {
        let failed = 0;
        for (const l of selected) {
          try { await vaultService.deleteListing(l); }
          catch { failed++; }
        }
        state.selectedPaths.clear();
        if (failed > 0) new Notice(`${failed} von ${selected.length} Artikeln konnten nicht gelöscht werden.`);
        actions.refreshAfterWrite();
      }).open();
    });
  }

  const exportWrapper = actionsEl.createDiv({ cls: 'ka-export-wrapper' });
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
      if (dropdownState.closeHandler) {
        document.removeEventListener('click', dropdownState.closeHandler);
      }
      dropdownState.closeHandler = () => {
        closeDropdown();
        if (dropdownState.closeHandler) {
          document.removeEventListener('click', dropdownState.closeHandler);
          dropdownState.closeHandler = null;
        }
      };
      document.addEventListener('click', dropdownState.closeHandler);
    } else {
      closeDropdown();
    }
  });
}

function renderTable(
  root: HTMLElement,
  app: App,
  listings: Listing[],
  state: OverviewState,
  callbacks: DashboardCallbacks,
  actions: DashboardActions,
  vaultService: VaultService,
  renderTableOnly: () => void,
) {
  const filtered = getFilteredListings(listings, state);

  if (filtered.length === 0) {
    root.createDiv({ cls: 'ka-empty', text: 'Keine Artikel gefunden.' });
    return;
  }

  const table = root.createEl('table', { cls: 'ka-table' });

  const thead = table.createEl('thead');
  const headerRow = thead.createEl('tr');

  const selectAllTh = headerRow.createEl('th');
  const selectAllCb = selectAllTh.createEl('input', { type: 'checkbox', cls: 'ka-checkbox' }) as HTMLInputElement;
  const selectedCount = filtered.filter(l => l.filePath && state.selectedPaths.has(l.filePath)).length;
  selectAllCb.checked = selectedCount === filtered.length && filtered.length > 0;
  selectAllCb.indeterminate = selectedCount > 0 && selectedCount < filtered.length;
  selectAllCb.addEventListener('change', () => {
    if (selectAllCb.checked) {
      for (const l of filtered) if (l.filePath) state.selectedPaths.add(l.filePath);
    } else {
      for (const l of filtered) if (l.filePath) state.selectedPaths.delete(l.filePath);
    }
    renderTableOnly();
  });

  type SortKey = OverviewState['sortColumn'];
  const sortableColumns: [string, SortKey][] = [
    ['Artikel', 'artikel'], ['Preis', 'preis'], ['Versand', 'versand'], ['Eingestellt', 'eingestellt'], ['Status', 'status'],
  ];
  for (const [label, key] of sortableColumns) {
    const th = headerRow.createEl('th', { cls: 'ka-th-sortable' });
    th.setText(label);
    if (state.sortColumn === key) {
      th.createSpan({ cls: 'ka-sort-indicator ka-sort-active', text: state.sortDirection === 'asc' ? ' ▲' : ' ▼' });
    } else {
      th.createSpan({ cls: 'ka-sort-indicator', text: ' ▲▼' });
    }
    th.addEventListener('click', () => {
      if (state.sortColumn === key) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortColumn = key;
        state.sortDirection = key === 'eingestellt' ? 'desc' : 'asc';
      }
      renderTableOnly();
    });
  }
  headerRow.createEl('th', { text: 'Aktionen' });

  const tbody = table.createEl('tbody');
  for (let i = 0; i < filtered.length; i++) {
    const listing = filtered[i];
    const row = tbody.createEl('tr', { cls: 'ka-row ka-row-enter' });
    row.dataset.status = listing.status.toLowerCase();
    row.style.animationDelay = `${i * 25}ms`;

    const cbCell = row.createEl('td');
    const cb = cbCell.createEl('input', { type: 'checkbox', cls: 'ka-checkbox' }) as HTMLInputElement;
    cb.checked = !!listing.filePath && state.selectedPaths.has(listing.filePath);
    cb.addEventListener('click', (e) => e.stopPropagation());
    cb.addEventListener('change', () => {
      if (!listing.filePath) return;
      if (cb.checked) state.selectedPaths.add(listing.filePath);
      else state.selectedPaths.delete(listing.filePath);
      renderTableOnly();
    });

    row.createEl('td', { text: listing.artikel });
    row.createEl('td', { text: `${formatCurrency(listing.preis)} ${listing.preisart ?? ''}`.trim() });
    row.createEl('td', { text: formatPortoDisplay(listing.carrier, listing.porto_name, listing.porto_price) });
    row.createEl('td', { text: listing.eingestellt_am ? formatDateDE(listing.eingestellt_am) : '' });

    const statusCell = row.createEl('td');
    const badge = statusCell.createSpan({ cls: `ka-badge ka-status-${listing.status.toLowerCase()}` });
    renderStatusBadge(badge, listing.status);

    const actionsCell = row.createEl('td', { cls: 'ka-actions' });
    renderActions(actionsCell, app, listing, callbacks, actions, vaultService, state);

    row.addEventListener('click', (e) => {
      if (['BUTTON', 'INPUT'].includes((e.target as HTMLElement).tagName)) return;
      state.expandedListing = listing;
      actions.render();
    });
  }
}

function renderActions(
  cell: HTMLElement,
  app: App,
  listing: Listing,
  callbacks: DashboardCallbacks,
  actions: DashboardActions,
  vaultService: VaultService,
  state: OverviewState,
  context: 'table' | 'detail' = 'table',
) {
  const actionMap: Partial<Record<Status, { label: string; cls: string; handler: () => void }[]>> = {
    'Aktiv': context === 'detail'
      ? [
          { label: 'Verkauft', cls: 'ka-sold-btn', handler: () => callbacks.onSold(listing) },
          { label: 'Abgelaufen', cls: 'ka-expired-btn', handler: () => actions.transitionStatus(listing, 'Abgelaufen') },
        ]
      : [{ label: 'Verkauft', cls: 'ka-sold-btn', handler: () => callbacks.onSold(listing) }],
    'Verkauft': [{ label: 'Verschicken', cls: 'ka-ship-btn', handler: () => callbacks.onShip(listing) }],
    'Verschickt': [{ label: 'Abschließen', cls: 'ka-complete-btn', handler: () => actions.transitionStatus(listing, 'Abgeschlossen') }],
    'Abgeschlossen': [{ label: 'Archivieren', cls: 'ka-archive-action-btn', handler: () => actions.transitionStatus(listing, 'Archiviert') }],
    'Abgelaufen': [{ label: 'Neu einstellen', cls: 'ka-relist-btn', handler: () => callbacks.onRelist(listing) }],
  };

  const actionList = actionMap[listing.status];
  if (actionList) {
    for (const action of actionList) {
      const btn = cell.createEl('button', { text: action.label, cls: `ka-action-btn ${action.cls}` });
      btn.addEventListener('click', (e) => { e.stopPropagation(); action.handler(); });
    }
  }

  if (listing.status === 'Archiviert') {
    const delBtn = cell.createEl('button', { text: 'Löschen', cls: 'ka-action-btn ka-delete-btn' });
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      new ConfirmModal(app, `"${listing.artikel}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`, async () => {
        await vaultService.deleteListing(listing);
        if (state.expandedListing?.filePath === listing.filePath) {
          state.expandedListing = null;
        }
        actions.refreshAfterWrite();
      }).open();
    });
  }

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
      const undoBtn = cell.createEl('button', {
        cls: 'ka-action-btn ka-undo-btn',
        attr: { 'aria-label': `Zurück zu ${prev}` },
      });
      const iconSpan = undoBtn.createSpan({ cls: 'ka-undo-icon' });
      setIcon(iconSpan, 'undo-2');
      undoBtn.createSpan({ text: prev, cls: 'ka-undo-label' });
      undoBtn.addEventListener('click', (e) => { e.stopPropagation(); actions.undoStatus(listing, prev); });
    }
  }
}

function renderDetail(
  root: HTMLElement,
  app: App,
  listing: Listing,
  callbacks: DashboardCallbacks,
  actions: DashboardActions,
  vaultService: VaultService,
  state: OverviewState,
) {
  const detail = root.createDiv({ cls: 'ka-detail' });

  const backBtn = detail.createEl('button', { text: '← Zurück zur Liste', cls: 'ka-back-btn' });
  backBtn.addEventListener('click', () => {
    state.expandedListing = null;
    actions.render();
  });

  const titleRow = detail.createDiv({ cls: 'ka-detail-title' });
  titleRow.createEl('h3', { text: listing.artikel });
  const badge = titleRow.createSpan({ cls: `ka-badge ka-status-${listing.status.toLowerCase()}` });
  renderStatusBadge(badge, listing.status);
  createCopyButton(titleRow, 'Titel kopieren', listing.artikel);

  const grid = detail.createDiv({ cls: 'ka-detail-grid' });

  // Inserat
  const listingSection = grid.createDiv({ cls: 'ka-detail-section' });
  addSectionHeader(listingSection, 'Inserat', () => callbacks.onEditListing(listing));
  addDetailRow(listingSection, 'Preis', `${formatCurrency(listing.preis)} ${listing.preisart ?? ''}`);
  addDetailRow(listingSection, 'Versand', formatPortoDisplay(listing.carrier, listing.porto_name, listing.porto_price));
  if (listing.eingestellt_am) {
    addDetailRow(listingSection, 'Eingestellt am', formatDateDE(listing.eingestellt_am));
  }
  if (listing.erstmals_eingestellt_am) {
    addDetailRow(listingSection, 'Erstmals eingestellt', formatDateDE(listing.erstmals_eingestellt_am));
  }
  addDetailRow(listingSection, 'Anzahl Einstellungen', listing.eingestellt_count.toString());
  addDetailRow(listingSection, 'Zustand', listing.zustand);

  // Verkauf
  if (listing.verkauft) {
    const saleSection = grid.createDiv({ cls: 'ka-detail-section' });
    addSectionHeader(saleSection, 'Verkauf', () => callbacks.onSold(listing));
    if (listing.verkauft_fuer != null) addDetailRow(saleSection, 'Verkauft für', formatCurrency(listing.verkauft_fuer));
    if (listing.verkauft_am) addDetailRow(saleSection, 'Verkauft am', formatDateDE(listing.verkauft_am));
    if (listing.bezahlart) addDetailRow(saleSection, 'Bezahlart', listing.bezahlart);
    addDetailRow(saleSection, 'Bezahlt', listing.bezahlt ? '✓ Ja' : '✗ Nein');
    if (listing.bezahlt_am) addDetailRow(saleSection, 'Bezahlt am', formatDateDE(listing.bezahlt_am));
  }

  // Versand
  if (listing.verschickt || listing.anschrift) {
    const shipSection = grid.createDiv({ cls: 'ka-detail-section' });
    addSectionHeader(shipSection, 'Versand', () => callbacks.onShip(listing));
    if (listing.anschrift) addDetailRow(shipSection, 'Anschrift', listing.anschrift);
    if (listing.carrier) addDetailRow(shipSection, 'Carrier', listing.carrier);
    if (listing.porto_name) addDetailRow(shipSection, 'Porto', formatPortoDisplay(listing.carrier, listing.porto_name, listing.porto_price));
    if (listing.sendungsnummer) addDetailRow(shipSection, 'Sendungsnummer', listing.sendungsnummer);
    addDetailRow(shipSection, 'Label gedruckt', listing.label_erstellt ? '✓ Ja' : '✗ Nein');
    if (listing.verschickt_am) addDetailRow(shipSection, 'Verschickt am', formatDateDE(listing.verschickt_am));
  }

  // Finanzen
  if (listing.verkauft_fuer != null) {
    const finSection = grid.createDiv({ cls: 'ka-detail-section' });
    finSection.createEl('h4', { text: 'Finanzen' });

    const revenue = listing.verkauft_fuer;
    const shippingCost = listing.porto_price ?? 0;
    const profit = revenue - shippingCost;

    addDetailRow(finSection, 'Einnahmen', formatCurrency(revenue));
    if (shippingCost > 0) addDetailRow(finSection, 'Portokosten', `−${formatCurrency(shippingCost)}`);
    addDetailRow(finSection, 'Gewinn', profit >= 0 ? formatCurrency(profit) : `−${formatCurrency(Math.abs(profit))}`);
  }

  // Beschreibung
  if (listing.beschreibung) {
    const descSection = detail.createDiv({ cls: 'ka-detail-section' });
    const descHeader = descSection.createDiv({ cls: 'ka-desc-header' });
    descHeader.createEl('h4', { text: 'Beschreibung' });
    createCopyButton(descHeader, 'Kopieren', listing.beschreibung!);
    descSection.createDiv({ cls: 'ka-desc-box', text: listing.beschreibung });
  }

  // Aktionen
  const actionsEl = detail.createDiv({ cls: 'ka-detail-actions' });
  renderActions(actionsEl, app, listing, callbacks, actions, vaultService, state, 'detail');
}

export function renderOverview(
  root: HTMLElement,
  app: App,
  listings: Listing[],
  state: OverviewState,
  callbacks: DashboardCallbacks,
  actions: DashboardActions,
  vaultService: VaultService,
  dropdownState: DropdownState,
) {
  // Closure for partial re-render (search/sort updates only table + bulk bar)
  const doRenderTableOnly = () => {
    root.querySelector('.ka-bulk-bar')?.remove();
    root.querySelector('.ka-table')?.remove();
    root.querySelector('.ka-empty')?.remove();
    renderBulkBar(root, app, listings, state, actions, vaultService, dropdownState, doRenderTableOnly);
    renderTable(root, app, listings, state, callbacks, actions, vaultService, doRenderTableOnly);
  };

  renderSummaryStats(root, listings);

  if (state.expandedListing) {
    renderDetail(root, app, state.expandedListing, callbacks, actions, vaultService, state);
  } else {
    renderFilters(root, state, actions);
    renderSearch(root, state, doRenderTableOnly);
    renderBulkBar(root, app, listings, state, actions, vaultService, dropdownState, doRenderTableOnly);
    renderTable(root, app, listings, state, callbacks, actions, vaultService, doRenderTableOnly);
  }
}
