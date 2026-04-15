import { App, Notice, setIcon } from 'obsidian';
import type { Listing, Status } from '../models/listing';
import { t } from '../i18n';
import { VaultService } from '../services/vaultService';
import { calculateStats } from '../services/statsService';
import { ExportService } from '../services/exportService';
import { formatCurrency, formatDateDE, formatPortoDisplay } from '../utils/formatting';
import { ConfirmModal } from '../modals/confirmModal';
import type { FilterStatus, OverviewState, DashboardCallbacks, DashboardActions, DropdownState } from './dashboard-types';
import { renderStatusBadge, addSectionHeader, addDetailRow, createCopyButton } from './dashboard-helpers';

function getFilteredListings(listings: Listing[], state: OverviewState): Listing[] {
  let filtered: Listing[];

  if (state.filter === 'archive') {
    filtered = listings.filter(l => l.status === 'archived');
  } else if (state.filter === 'all') {
    filtered = listings.filter(l => l.status !== 'archived');
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
    [t('status.active'), stats.activeCount.toString(), 'circle-dot', 'active'],
    [t('status.sold'), stats.soldCount.toString(), 'banknote', 'sold'],
    [t('status.shipped'), stats.shippedCount.toString(), 'truck', 'shipped'],
    [t('status.completed'), stats.completedCount.toString(), 'circle-check', 'completed'],
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
  const options: [FilterStatus, string][] = [
    ['all', t('overview.filter.all')],
    ['active', t('status.active')],
    ['sold', t('status.sold')],
    ['shipped', t('status.shipped')],
    ['completed', t('status.completed')],
    ['expired', t('status.expired')],
  ];

  for (const [opt, label] of options) {
    const btn = filtersEl.createEl('button', {
      text: label,
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
    text: t('overview.filter.archive'),
    cls: `ka-filter-btn ${state.filter === 'archive' ? 'ka-filter-active' : ''}`,
  });
  archivBtn.addEventListener('click', () => {
    state.filter = 'archive';
    state.expandedListing = null;
    state.selectedPaths.clear();
    actions.render();
  });
}

function renderSearch(root: HTMLElement, state: OverviewState, renderTableOnly: () => void) {
  const searchEl = root.createDiv({ cls: 'ka-search' });
  const input = searchEl.createEl('input', {
    type: 'text',
    placeholder: t('overview.search'),
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
  bar.createSpan({ text: t('overview.bulk.selected', { count: selected.length }) });

  const actionsEl = bar.createDiv({ cls: 'ka-bulk-actions' });

  if (selected.every(l => l.status === 'completed')) {
    const btn = actionsEl.createEl('button', { text: t('overview.bulk.archive'), cls: 'ka-action-btn ka-archive-action-btn' });
    btn.addEventListener('click', async () => {
      let failed = 0;
      for (const l of selected) {
        try { await vaultService.updateListing({ ...l, status: 'archived' }); }
        catch { failed++; }
      }
      state.selectedPaths.clear();
      if (failed > 0) new Notice(t('overview.error.archiveFailed', { failed, total: selected.length }));
      actions.refreshAfterWrite();
    });
  }

  if (selected.every(l => l.status === 'active')) {
    const btn = actionsEl.createEl('button', { text: t('overview.bulk.expire'), cls: 'ka-action-btn ka-expired-btn' });
    btn.addEventListener('click', async () => {
      let failed = 0;
      for (const l of selected) {
        try { await vaultService.updateListing({ ...l, status: 'expired' }); }
        catch { failed++; }
      }
      state.selectedPaths.clear();
      if (failed > 0) new Notice(t('overview.error.expireFailed', { failed, total: selected.length }));
      actions.refreshAfterWrite();
    });
  }

  if (selected.every(l => l.status === 'archived')) {
    const btn = actionsEl.createEl('button', { text: t('common.delete'), cls: 'ka-action-btn ka-delete-btn' });
    btn.addEventListener('click', () => {
      new ConfirmModal(app, t('overview.confirm.delete', { name: `${selected.length} items` }), async () => {
        let failed = 0;
        for (const l of selected) {
          try { await vaultService.deleteListing(l); }
          catch { failed++; }
        }
        state.selectedPaths.clear();
        if (failed > 0) new Notice(t('overview.error.deleteFailed', { failed, total: selected.length }));
        actions.refreshAfterWrite();
      }).open();
    });
  }

  const exportWrapper = actionsEl.createDiv({ cls: 'ka-export-wrapper' });
  const exportBtn = exportWrapper.createEl('button', { cls: 'ka-action-btn ka-export-btn' });
  setIcon(exportBtn.createSpan(), 'share');
  exportBtn.createSpan({ text: ` ${t('overview.bulk.export')}` });

  const dropdown = exportWrapper.createDiv({ cls: 'ka-export-dropdown' });
  const csvOption = dropdown.createEl('button', { cls: 'ka-export-dropdown-item' });
  setIcon(csvOption.createSpan({ cls: 'ka-export-dropdown-icon' }), 'file-spreadsheet');
  csvOption.createSpan({ text: t('overview.export.csv') });
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
  pdfOption.createSpan({ text: t('overview.export.pdf') });
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
    root.createDiv({ cls: 'ka-empty', text: t('overview.empty') });
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
    [t('overview.col.item'), 'artikel'],
    [t('overview.col.price'), 'preis'],
    [t('overview.col.shipping'), 'versand'],
    [t('overview.col.listed'), 'eingestellt'],
    [t('overview.col.status'), 'status'],
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
  headerRow.createEl('th', { text: t('overview.col.actions') });

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
    active: context === 'detail'
      ? [
          { label: t('overview.action.sell'),   cls: 'ka-sold-btn',    handler: () => callbacks.onSold(listing) },
          { label: t('overview.action.expire'),  cls: 'ka-expired-btn', handler: () => actions.transitionStatus(listing, 'expired') },
        ]
      : [{ label: t('overview.action.sell'), cls: 'ka-sold-btn', handler: () => callbacks.onSold(listing) }],
    sold:      [{ label: t('overview.action.ship'),     cls: 'ka-ship-btn',          handler: () => callbacks.onShip(listing) }],
    shipped:   [{ label: t('overview.action.complete'), cls: 'ka-complete-btn',      handler: () => actions.transitionStatus(listing, 'completed') }],
    completed: [{ label: t('overview.action.archive'),  cls: 'ka-archive-action-btn',handler: () => actions.transitionStatus(listing, 'archived') }],
    expired:   [{ label: t('overview.action.relist'),   cls: 'ka-relist-btn',        handler: () => callbacks.onRelist(listing) }],
  };

  const actionList = actionMap[listing.status];
  if (actionList) {
    for (const action of actionList) {
      const btn = cell.createEl('button', { text: action.label, cls: `ka-action-btn ${action.cls}` });
      btn.addEventListener('click', (e) => { e.stopPropagation(); action.handler(); });
    }
  }

  if (listing.status === 'archived') {
    const delBtn = cell.createEl('button', { text: t('common.delete'), cls: 'ka-action-btn ka-delete-btn' });
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      new ConfirmModal(app, t('overview.confirm.delete', { name: listing.artikel }), async () => {
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
      sold:      'active',
      shipped:   'sold',
      completed: 'shipped',
      expired:   'active',
      archived:  'completed',
    };
    const prev = prevStatus[listing.status];
    if (prev) {
      const undoBtn = cell.createEl('button', {
        cls: 'ka-action-btn ka-undo-btn',
        attr: { 'aria-label': t('overview.action.undoTo', { status: t(`status.${prev}`) }) },
      });
      const iconSpan = undoBtn.createSpan({ cls: 'ka-undo-icon' });
      setIcon(iconSpan, 'undo-2');
      undoBtn.createSpan({ text: t(`status.${prev}`), cls: 'ka-undo-label' });
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

  const backBtn = detail.createEl('button', { text: t('overview.back'), cls: 'ka-back-btn' });
  backBtn.addEventListener('click', () => {
    state.expandedListing = null;
    actions.render();
  });

  const titleRow = detail.createDiv({ cls: 'ka-detail-title' });
  titleRow.createEl('h3', { text: listing.artikel });
  const badge = titleRow.createSpan({ cls: `ka-badge ka-status-${listing.status.toLowerCase()}` });
  renderStatusBadge(badge, listing.status);
  createCopyButton(titleRow, t('overview.copy.title'), listing.artikel);

  const grid = detail.createDiv({ cls: 'ka-detail-grid' });

  // Listing info
  const listingSection = grid.createDiv({ cls: 'ka-detail-section' });
  addSectionHeader(listingSection, t('overview.detail.listing'), () => callbacks.onEditListing(listing));
  addDetailRow(listingSection, t('overview.detail.price'), `${formatCurrency(listing.preis)} ${listing.preisart ? t(`preisart.${listing.preisart}`) : ''}`);
  addDetailRow(listingSection, t('overview.detail.shippingCost'), formatPortoDisplay(listing.carrier, listing.porto_name, listing.porto_price));
  if (listing.eingestellt_am) {
    addDetailRow(listingSection, t('overview.detail.listedOn'), formatDateDE(listing.eingestellt_am));
  }
  if (listing.erstmals_eingestellt_am) {
    addDetailRow(listingSection, t('overview.detail.firstListed'), formatDateDE(listing.erstmals_eingestellt_am));
  }
  addDetailRow(listingSection, t('overview.detail.listingCount'), listing.eingestellt_count.toString());
  addDetailRow(listingSection, t('overview.detail.condition'), t(`zustand.${listing.zustand}`));

  // Sale info
  if (listing.verkauft) {
    const saleSection = grid.createDiv({ cls: 'ka-detail-section' });
    addSectionHeader(saleSection, t('overview.detail.sale'), () => callbacks.onSold(listing));
    if (listing.verkauft_fuer != null) addDetailRow(saleSection, t('overview.detail.soldFor'), formatCurrency(listing.verkauft_fuer));
    if (listing.verkauft_am) addDetailRow(saleSection, t('overview.detail.soldOn'), formatDateDE(listing.verkauft_am));
    if (listing.bezahlart) addDetailRow(saleSection, t('overview.detail.paymentMethod'), listing.bezahlart);
    addDetailRow(saleSection, t('overview.detail.paid'), listing.bezahlt ? t('common.yes') : t('common.no'));
    if (listing.bezahlt_am) addDetailRow(saleSection, t('overview.detail.paidOn'), formatDateDE(listing.bezahlt_am));
  }

  // Shipping info
  if (listing.verschickt || listing.anschrift) {
    const shipSection = grid.createDiv({ cls: 'ka-detail-section' });
    addSectionHeader(shipSection, t('overview.detail.shipping'), () => callbacks.onShip(listing));
    if (listing.anschrift) addDetailRow(shipSection, t('overview.detail.address'), listing.anschrift);
    if (listing.carrier) addDetailRow(shipSection, t('overview.detail.carrier'), listing.carrier);
    if (listing.porto_name) addDetailRow(shipSection, t('overview.detail.porto'), formatPortoDisplay(listing.carrier, listing.porto_name, listing.porto_price));
    if (listing.sendungsnummer) addDetailRow(shipSection, t('overview.detail.tracking'), listing.sendungsnummer);
    addDetailRow(shipSection, t('overview.detail.labelPrinted'), listing.label_erstellt ? t('common.yes') : t('common.no'));
    if (listing.verschickt_am) addDetailRow(shipSection, t('overview.detail.shippedOn'), formatDateDE(listing.verschickt_am));
  }

  // Finances
  if (listing.verkauft_fuer != null) {
    const finSection = grid.createDiv({ cls: 'ka-detail-section' });
    finSection.createEl('h4', { text: t('overview.detail.finances') });

    const revenue = listing.verkauft_fuer;
    const shippingCost = listing.porto_price ?? 0;
    const profit = revenue - shippingCost;

    addDetailRow(finSection, t('overview.detail.revenue'), formatCurrency(revenue));
    if (shippingCost > 0) addDetailRow(finSection, t('overview.detail.shippingDeducted'), `−${formatCurrency(shippingCost)}`);
    addDetailRow(finSection, t('overview.detail.profit'), profit >= 0 ? formatCurrency(profit) : `−${formatCurrency(Math.abs(profit))}`);
  }

  // Description
  if (listing.beschreibung) {
    const descSection = detail.createDiv({ cls: 'ka-detail-section' });
    const descHeader = descSection.createDiv({ cls: 'ka-desc-header' });
    descHeader.createEl('h4', { text: t('overview.detail.description') });
    createCopyButton(descHeader, t('overview.copy.desc'), listing.beschreibung!);
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
