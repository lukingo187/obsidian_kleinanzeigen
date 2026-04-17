import { App, Modal, Notice, Setting } from 'obsidian';
import { Listing, DEFAULT_CARRIER, isCarrierName } from '../models/listing';
import { todayString } from '../utils/formatting';
import { PortoState, renderCarrierPortoUI } from '../utils/portoUI';
import { t } from '../i18n';

export class ShipModal extends Modal {
  private listing: Listing;
  private address = '';
  private portoState: PortoState;
  private trackingNumber = '';
  private labelPrinted = false;
  private onSubmit: (listing: Listing) => void;

  constructor(app: App, listing: Listing, onSubmit: (listing: Listing) => void) {
    super(app);
    this.listing = { ...listing };
    this.address = listing.shipping_address ?? '';
    this.portoState = {
      carrier: listing.carrier ?? DEFAULT_CARRIER,
      shippingService: listing.shipping_service,
      shippingCost: listing.shipping_cost,
    };
    this.trackingNumber = listing.tracking_number ?? '';
    this.labelPrinted = listing.label_printed;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('ka-modal');

    contentEl.createEl('h2', { text: `${t('modal.ship.title')} — ${this.listing.title}` });

    const addrContainer = contentEl.createDiv();
    new Setting(addrContainer)
      .setName(t('modal.ship.field.address'))
      .addTextArea(ta => {
        ta.setPlaceholder(t('modal.ship.field.addressPlaceholder'));
        ta.setValue(this.address);
        ta.onChange(v => this.address = v);
        ta.inputEl.rows = 3;
        ta.inputEl.addClass('ka-textarea');
      });

    const isPickup = () => this.portoState.carrier === 'Pickup';
    const updateAddrVisibility = () => {
      addrContainer.style.display = isPickup() ? 'none' : '';
    };

    renderCarrierPortoUI({
      container: contentEl,
      state: this.portoState,
      onChange: () => updateAddrVisibility(),
      showTracking: true,
      trackingState: {
        trackingNumber: this.trackingNumber,
        labelPrinted: this.labelPrinted,
        onTrackingNumberChange: v => this.trackingNumber = v,
        onLabelChange: v => this.labelPrinted = v,
      },
    });

    updateAddrVisibility();

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(t('modal.ship.submit'))
        .setCta()
        .onClick(() => {
          if (!isPickup() && !this.address.trim()) { new Notice(t('notice.validation.addressRequired')); return; }

          this.listing.status = 'shipped';
          this.listing.shipped = true;
          this.listing.shipped_at = todayString();
          this.listing.shipping_address = this.address.trim();
          this.listing.carrier = isCarrierName(this.portoState.carrier) ? this.portoState.carrier : undefined;
          this.listing.shipping_service = this.portoState.shippingService;
          this.listing.shipping_cost = this.portoState.shippingCost;
          this.listing.tracking_number = this.trackingNumber || undefined;
          this.listing.label_printed = this.labelPrinted;

          this.onSubmit(this.listing);
          this.close();
        }))
      .addButton(btn => btn
        .setButtonText(t('common.cancel'))
        .onClick(() => this.close()));
  }

  onClose() {
    this.contentEl.empty();
  }
}
