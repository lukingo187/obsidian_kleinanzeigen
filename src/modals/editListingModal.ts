import { App, Modal, Notice, Setting } from 'obsidian';
import { Listing, CONDITIONS, Condition, PriceType, DEFAULT_CARRIER, isCondition, isPriceType, isCarrierName } from '../models/listing';
import { PortoState, renderCarrierPortoUI } from '../utils/portoUI';
import { t, StringKey } from '../i18n';

export class EditListingModal extends Modal {
  private listing: Listing;
  private title: string;
  private condition: Condition;
  private price: number;
  private priceType: PriceType;
  private portoState: PortoState;
  private description: string;
  private onSubmit: (listing: Listing) => void;

  constructor(app: App, listing: Listing, onSubmit: (listing: Listing) => void) {
    super(app);
    this.listing = { ...listing };
    this.title = listing.title;
    this.condition = listing.condition;
    this.price = listing.price;
    this.priceType = listing.price_type;
    this.portoState = {
      carrier: listing.carrier ?? DEFAULT_CARRIER,
      shippingService: listing.shipping_service,
      shippingCost: listing.shipping_cost,
    };
    this.description = listing.description ?? '';
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('ka-modal');

    contentEl.createEl('h2', { text: t('modal.edit.title') });

    new Setting(contentEl)
      .setName(t('modal.edit.field.name'))
      .addText(text => text
        .setValue(this.title)
        .onChange(v => this.title = v));

    new Setting(contentEl)
      .setName(t('modal.edit.field.condition'))
      .addDropdown(dd => {
        for (const z of CONDITIONS) {
          dd.addOption(z, t(`condition.${z}` as StringKey));
        }
        dd.setValue(this.condition);
        dd.onChange(v => { if (isCondition(v)) this.condition = v; });
      });

    new Setting(contentEl)
      .setName(t('modal.edit.field.price'))
      .addText(text => text
        .setValue(this.price.toString())
        .onChange(v => this.price = parseFloat(v) || 0))
      .addDropdown(dd => {
        dd.addOption('negotiable', t('price_type.negotiable'));
        dd.addOption('fixed', t('price_type.fixed'));
        dd.setValue(this.priceType);
        dd.onChange(v => { if (isPriceType(v)) this.priceType = v; });
      });

    renderCarrierPortoUI({
      container: contentEl,
      state: this.portoState,
    });

    new Setting(contentEl)
      .setName(t('modal.edit.field.description'))
      .addTextArea(ta => {
        ta.setValue(this.description);
        ta.onChange(v => this.description = v);
        ta.inputEl.rows = 4;
        ta.inputEl.addClass('ka-textarea');
      });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(t('common.save'))
        .setCta()
        .onClick(() => {
          if (!this.title.trim()) { new Notice(t('notice.validation.nameRequired')); return; }

          this.listing.title = this.title.trim();
          this.listing.condition = this.condition;
          this.listing.price = this.price;
          this.listing.price_type = this.priceType;
          this.listing.carrier = isCarrierName(this.portoState.carrier) ? this.portoState.carrier : undefined;
          this.listing.shipping_service = this.portoState.shippingService;
          this.listing.shipping_cost = this.portoState.shippingCost;
          this.listing.description = this.description || undefined;

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
