import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { VaultService } from './services/vaultService';
import { DashboardView, DASHBOARD_VIEW_TYPE } from './views/dashboard';
import { NewItemModal } from './modals/newItemModal';
import { PostCreationModal } from './modals/postCreationModal';
import { EditListingModal } from './modals/editListingModal';
import { SoldModal } from './modals/soldModal';
import { ShipModal } from './modals/shipModal';
import { RelistModal } from './modals/relistModal';
import { Listing, PluginSettings, DEFAULT_SETTINGS, AIProvider, migrateDescriptionStyle } from './models/listing';
import { AIService } from './services/aiService';
import { SettingsTab } from './views/settingsTab';
import { t, setLang } from './i18n';
import { formatError } from './utils/formatting';

export default class KleinanzeigenPlugin extends Plugin {
  private vaultService!: VaultService;
  settings!: PluginSettings;

  async onload() {
    await this.loadSettings();
    setLang(this.settings.language);
    this.addSettingTab(new SettingsTab(this.app, this));
    this.vaultService = new VaultService(this.app, () => this.settings.baseFolder);

    this.registerView(
      DASHBOARD_VIEW_TYPE,
      (leaf) => new DashboardView(leaf, this.vaultService, this, {
        onSold: (listing) => this.openSoldModal(listing),
        onShip: (listing) => this.openShipModal(listing),
        onRelist: (listing) => this.openRelistModal(listing),
        onNewItem: () => this.openNewItemModal(),
        onEditListing: (listing) => this.openEditListingModal(listing),
      }),
    );

    this.addRibbonIcon('shopping-cart', t('plugin.ribbonTooltip'), () => {
      this.activateDashboard();
    });

    this.addCommand({
      id: 'open-dashboard',
      name: t('plugin.cmd.openDashboard'),
      callback: () => this.activateDashboard(),
    });

    this.addCommand({
      id: 'new-item',
      name: t('plugin.cmd.newItem'),
      callback: () => this.openNewItemModal(),
    });
  }

  // Cleanup handled by DashboardView.onClose(); no plugin-level listeners to remove
  onunload() {}

  async activateDashboard() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getLeaf('tab');
      await leaf.setViewState({ type: DASHBOARD_VIEW_TYPE, active: true });
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  private openNewItemModal() {
    new NewItemModal(this.app, this, async (listing: Listing) => {
      try {
        await this.vaultService.createListing(listing);
        this.refreshDashboard();
        if (this.settings.showCopyOverview) {
          new PostCreationModal(this.app, listing).open();
        }
      } catch (e) {
        new Notice(t('notice.createError', { error: formatError(e) }));
      }
    }).open();
  }

  private openEditListingModal(listing: Listing) {
    new EditListingModal(this.app, listing, async (updated: Listing) => {
      try {
        await this.vaultService.updateListing(updated);
        this.refreshDashboard();
      } catch (e) {
        new Notice(t('notice.saveError', { error: formatError(e) }));
      }
    }).open();
  }

  private openSoldModal(listing: Listing) {
    new SoldModal(this.app, listing, async (updated: Listing) => {
      try {
        await this.vaultService.updateListing(updated);
        this.refreshDashboard();
      } catch (e) {
        new Notice(t('notice.saveError', { error: formatError(e) }));
      }
    }).open();
  }

  private openShipModal(listing: Listing) {
    new ShipModal(this.app, listing, async (updated: Listing) => {
      try {
        await this.vaultService.updateListing(updated);
        this.refreshDashboard();
      } catch (e) {
        new Notice(t('notice.saveError', { error: formatError(e) }));
      }
    }).open();
  }

  private openRelistModal(listing: Listing) {
    new RelistModal(this.app, listing, async (updated: Listing) => {
      try {
        await this.vaultService.updateListing(updated);
        this.refreshDashboard();
      } catch (e) {
        new Notice(t('notice.saveError', { error: formatError(e) }));
      }
    }).open();
  }

  refreshDashboard() {
    // Wait for Obsidian's metadata cache to process the file write, then refresh.
    // Falls back to 500ms timeout in case the event doesn't fire.
    let triggered = false;
    const doRefresh = () => {
      if (triggered) return;
      triggered = true;
      this.app.metadataCache.off('changed', onCacheChange);
      clearTimeout(fallback);
      const leaves = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
      for (const leaf of leaves) {
        if (leaf.view instanceof DashboardView) {
          leaf.view.refresh();
        }
      }
    };
    const onCacheChange = () => doRefresh();
    this.app.metadataCache.on('changed', onCacheChange);
    const fallback = setTimeout(doRefresh, 500);
  }

  async loadSettings() {
    let saved: unknown;
    try {
      saved = await this.loadData();
    } catch (e) {
      console.error('[Kleinanzeigen] Failed to load settings:', e);
      new Notice(t('notice.loadError'));
      saved = null;
    }
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    this.settings.descriptionStyle = migrateDescriptionStyle(this.settings.descriptionStyle);
    // Ensure nested objects are merged properly
    this.settings.aiProviders = Object.assign(
      {},
      DEFAULT_SETTINGS.aiProviders,
      this.settings.aiProviders,
    );
    this.settings.aiUsage = Object.assign(
      {},
      DEFAULT_SETTINGS.aiUsage,
      this.settings.aiUsage,
    );
    // Ensure arrays are preserved (not overwritten by Object.assign)
    if (!Array.isArray(this.settings.templates)) {
      this.settings.templates = [];
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  createAIService(): AIService {
    return new AIService(this.settings, (provider, model, inputTokens, outputTokens) => {
      const usage = this.settings.aiUsage[provider];
      usage.totalInputTokens += inputTokens;
      usage.totalOutputTokens += outputTokens;
      usage.totalCostUSD += AIService.calculateCost(model, inputTokens, outputTokens);
      usage.callCount += 1;
      this.saveSettings().catch(e => console.error('[Kleinanzeigen] Failed to save usage:', e));
    });
  }
}
