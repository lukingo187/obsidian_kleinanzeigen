import { App, Modal, Notice, Setting } from 'obsidian';
import { Listing, clearTransactionFields } from '../models/listing';
import { todayString } from '../utils/formatting';
import { t } from '../i18n';

export class RelistModal extends Modal {
  private listing: Listing;
  private price: number;
  private onSubmit: (listing: Listing) => void;

  constructor(app: App, listing: Listing, onSubmit: (listing: Listing) => void) {
    super(app);
    this.listing = { ...listing };
    this.price = listing.price;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('ka-modal');

    contentEl.createEl('h2', { text: `${t('modal.relist.title')} — ${this.listing.title}` });

    new Setting(contentEl)
      .setName(t('modal.relist.field.price'))
      .setDesc(t('modal.relist.field.priceDesc', { price: this.listing.price }))
      .addText(text => text
        .setValue(this.price.toString())
        .onChange(v => this.price = parseFloat(v) || 0));

    if (this.listing.description) {
      new Setting(contentEl)
        .setName(t('modal.relist.field.description'))
        .setDesc(t('modal.relist.field.descriptionDesc'));

      const descBox = contentEl.createDiv({ cls: 'ka-desc-box' });
      descBox.setText(this.listing.description);
    }

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(t('modal.relist.submit'))
        .setCta()
        .onClick(() => {
          if (this.price <= 0) { new Notice(t('notice.validation.priceRequired')); return; }

          this.listing = clearTransactionFields({
            ...this.listing,
            status: 'active',
            price: this.price,
            listed_at: todayString(),
            listing_count: this.listing.listing_count + 1,
          });

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
