import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { VaultService } from './services/vaultService';
import { DashboardView, DASHBOARD_VIEW_TYPE } from './views/dashboard';
import { NewItemModal } from './modals/newItemModal';
import { EditListingModal } from './modals/editListingModal';
import { SoldModal } from './modals/soldModal';
import { ShipModal } from './modals/shipModal';
import { RelistModal } from './modals/relistModal';
import { Listing, PluginSettings, DEFAULT_SETTINGS, AIProvider } from './models/listing';
import { AIService } from './services/aiService';

export default class KleinanzeigenPlugin extends Plugin {
  private vaultService!: VaultService;
  settings!: PluginSettings;

  async onload() {
    await this.loadSettings();
    this.vaultService = new VaultService(this.app);

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

    this.addRibbonIcon('shopping-cart', 'Kleinanzeigen Dashboard', () => {
      this.activateDashboard();
    });

    this.addCommand({
      id: 'open-dashboard',
      name: 'Dashboard öffnen',
      callback: () => this.activateDashboard(),
    });

    this.addCommand({
      id: 'new-item',
      name: 'Neuer Artikel',
      callback: () => this.openNewItemModal(),
    });
  }

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
      } catch (e: any) {
        new Notice(`Fehler beim Erstellen: ${e.message}`);
      }
    }).open();
  }

  private openEditListingModal(listing: Listing) {
    new EditListingModal(this.app, listing, async (updated: Listing) => {
      await this.vaultService.updateListing(updated);
      this.refreshDashboard();
    }).open();
  }

  private openSoldModal(listing: Listing) {
    new SoldModal(this.app, listing, async (updated: Listing) => {
      await this.vaultService.updateListing(updated);
      this.refreshDashboard();
    }).open();
  }

  private openShipModal(listing: Listing) {
    new ShipModal(this.app, listing, async (updated: Listing) => {
      await this.vaultService.updateListing(updated);
      this.refreshDashboard();
    }).open();
  }

  private openRelistModal(listing: Listing) {
    new RelistModal(this.app, listing, async (updated: Listing) => {
      await this.vaultService.updateListing(updated);
      this.refreshDashboard();
    }).open();
  }

  private refreshDashboard() {
    // Small delay to let Obsidian's metadata cache update after file write
    setTimeout(() => {
      const leaves = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
      for (const leaf of leaves) {
        if (leaf.view instanceof DashboardView) {
          leaf.view.refresh();
        }
      }
    }, 200);
  }

  async loadSettings() {
    const saved = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
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
      this.saveSettings();
    });
  }
}
