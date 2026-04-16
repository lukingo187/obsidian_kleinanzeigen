import { ItemView, Notice, WorkspaceLeaf, setIcon } from 'obsidian';
import { Listing, Status, buildUndoListing } from '../models/listing';
import { t } from '../i18n';
import { VaultService } from '../services/vaultService';
import type KleinanzeigenPlugin from '../main';
import type { Tab, DashboardCallbacks, OverviewState, StatsState, DropdownState, DashboardActions } from './dashboard-types';
import { renderStatsView } from './dashboard-stats';
import { renderOverview } from './dashboard-overview';

export { type DashboardCallbacks } from './dashboard-types';
export const DASHBOARD_VIEW_TYPE = 'kleinanzeigen-dashboard';

export class DashboardView extends ItemView {
  private vaultService: VaultService;
  private plugin: KleinanzeigenPlugin;
  private callbacks: DashboardCallbacks;
  private listings: Listing[] = [];
  private activeTab: Tab = 'overview';
  private closed = false;

  private overviewState: OverviewState = {
    filter: 'all',
    searchQuery: '',
    expandedListing: null,
    sortColumn: 'eingestellt',
    sortDirection: 'desc',
    selectedPaths: new Set(),
  };
  private statsState: StatsState = { statsPeriod: 'monthly' };
  private dropdownState: DropdownState = { closeHandler: null };

  private actions: DashboardActions = {
    render: () => this.render(),
    refresh: () => this.refresh(),
    refreshAfterWrite: () => this.refreshAfterWrite(),
    transitionStatus: (listing, status) => this.transitionStatus(listing, status),
    undoStatus: (listing, target) => this.undoStatus(listing, target),
    updateListing: (listing) => this.vaultService.updateListing(listing),
    deleteListing: (listing) => this.deleteListing(listing),
  };

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
  getDisplayText() { return t('dashboard.title'); }
  getIcon() { return 'shopping-cart'; }

  private keyHandler = this.handleKeydown.bind(this);

  async onOpen() {
    await this.refresh();
    this.containerEl.addEventListener('keydown', this.keyHandler);
    // Make container focusable to receive key events
    this.containerEl.tabIndex = -1;
  }

  async onClose() {
    this.closed = true;
    this.containerEl.removeEventListener('keydown', this.keyHandler);
    if (this.dropdownState.closeHandler) {
      document.removeEventListener('click', this.dropdownState.closeHandler);
      this.dropdownState.closeHandler = null;
    }
  }

  private handleKeydown(e: KeyboardEvent) {
    // Skip if user is typing in an input/textarea/select
    const tag = (e.target as HTMLElement).tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

    switch (e.key) {
      case 'Escape':
        if (this.overviewState.expandedListing) {
          e.preventDefault();
          this.overviewState.expandedListing = null;
          this.render();
        }
        break;
      case 'n':
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          this.callbacks.onNewItem();
        }
        break;
      case 'r':
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          this.refresh();
        }
        break;
      case '/':
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          const searchInput = this.containerEl.querySelector('.ka-search-input') as HTMLInputElement | null;
          if (searchInput) searchInput.focus();
        }
        break;
    }
  }

  async refresh() {
    const expandedPath = this.overviewState.expandedListing?.filePath;
    try {
      this.listings = await this.vaultService.getAllListings();
    } catch (e) {
      console.error('[Kleinanzeigen]', e);
      new Notice(t('notice.refreshError'));
      this.listings = [];
    }
    if (expandedPath) {
      this.overviewState.expandedListing = this.listings.find(l => l.filePath === expandedPath) ?? null;
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
      case 'overview': renderOverview(root, this.app, this.listings, this.overviewState, this.callbacks, this.actions, this.dropdownState); break;
      case 'stats': renderStatsView(root, this.listings, this.statsState, this.plugin.settings); break;
    }
  }

  private renderHeader(root: HTMLElement) {
    const header = root.createDiv({ cls: 'ka-header' });
    header.createEl('h2', { text: t('dashboard.title') });

    const btns = header.createDiv({ cls: 'ka-header-btns' });

    const newBtn = btns.createEl('button', { text: t('dashboard.newItem'), cls: 'ka-new-btn' });
    newBtn.addEventListener('click', () => this.callbacks.onNewItem());

    const refreshBtn = btns.createEl('button', { cls: 'ka-refresh-btn', attr: { 'aria-label': t('dashboard.refresh') } });
    setIcon(refreshBtn, 'refresh-cw');
    refreshBtn.addEventListener('click', () => this.refresh());
  }

  private renderTabs(root: HTMLElement) {
    const tabs = root.createDiv({ cls: 'ka-tabs' });
    const tabOptions: [Tab, string][] = [
      ['overview', t('dashboard.tab.overview')],
      ['stats', t('dashboard.tab.stats')],
    ];

    for (const [tab, label] of tabOptions) {
      const btn = tabs.createEl('button', {
        text: label,
        cls: `ka-tab-btn ${this.activeTab === tab ? 'ka-tab-active' : ''}`,
      });
      btn.addEventListener('click', () => {
        this.activeTab = tab;
        this.overviewState.selectedPaths.clear();
        this.render();
      });
    }
  }

  private refreshAfterWrite() {
    if (this.closed) return;

    // Listen for Obsidian's metadata cache update, then refresh once.
    // Falls back to 500ms timeout in case the event doesn't fire
    // (e.g. file write with no frontmatter change).
    let triggered = false;
    const doRefresh = () => {
      if (triggered || this.closed) return;
      triggered = true;
      this.app.metadataCache.off('changed', onCacheChange);
      clearTimeout(fallback);
      this.refresh();
    };
    const onCacheChange = () => doRefresh();
    this.app.metadataCache.on('changed', onCacheChange);
    const fallback = setTimeout(doRefresh, 500);
  }

  private async transitionStatus(listing: Listing, status: Status) {
    try {
      await this.vaultService.updateListing({ ...listing, status });
      this.refreshAfterWrite();
    } catch (e) {
      new Notice(t('notice.statusError', { error: e instanceof Error ? e.message : String(e) }));
    }
  }

  private async undoStatus(listing: Listing, targetStatus: Status) {
    try {
      await this.vaultService.updateListing(buildUndoListing(listing, targetStatus));
      this.refreshAfterWrite();
    } catch (e) {
      new Notice(t('notice.undoError', { error: e instanceof Error ? e.message : String(e) }));
    }
  }

  private async deleteListing(listing: Listing) {
    await this.vaultService.deleteListing(listing);
    this.refreshAfterWrite();
  }

}
