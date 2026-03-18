import { Plugin, WorkspaceLeaf } from 'obsidian';
import { VaultService } from './services/vaultService';
import { DashboardView, DASHBOARD_VIEW_TYPE } from './views/dashboard';
import { NewItemModal } from './modals/newItemModal';
import { EditListingModal } from './modals/editListingModal';
import { SoldModal } from './modals/soldModal';
import { ShipModal } from './modals/shipModal';
import { RelistModal } from './modals/relistModal';
import { Listing } from './models/listing';

export default class KleinanzeigenPlugin extends Plugin {
  private vaultService!: VaultService;

  async onload() {
    this.vaultService = new VaultService(this.app);

    this.registerView(
      DASHBOARD_VIEW_TYPE,
      (leaf) => new DashboardView(leaf, this.vaultService, {
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
    new NewItemModal(this.app, async (listing: Listing) => {
      await this.vaultService.createListing(listing);
      this.refreshDashboard();
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
}
