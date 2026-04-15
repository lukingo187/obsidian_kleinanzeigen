import { App, Modal, Notice, Setting } from 'obsidian';
import { Listing } from '../models/listing';
import { todayString } from '../utils/formatting';
import { t } from '../i18n';

export class RelistModal extends Modal {
  private listing: Listing;
  private preis: number;
  private onSubmit: (listing: Listing) => void;

  constructor(app: App, listing: Listing, onSubmit: (listing: Listing) => void) {
    super(app);
    this.listing = { ...listing };
    this.preis = listing.preis;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('ka-modal');

    contentEl.createEl('h2', { text: `${t('modal.relist.title')} — ${this.listing.artikel}` });

    new Setting(contentEl)
      .setName(t('modal.relist.field.price'))
      .setDesc(t('modal.relist.field.priceDesc', { price: this.listing.preis }))
      .addText(text => text
        .setValue(this.preis.toString())
        .onChange(v => this.preis = parseFloat(v) || 0));

    if (this.listing.beschreibung) {
      new Setting(contentEl)
        .setName(t('modal.relist.field.description'))
        .setDesc(t('modal.relist.field.descriptionDesc'));

      const descBox = contentEl.createDiv({ cls: 'ka-desc-box' });
      descBox.setText(this.listing.beschreibung);
    }

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(t('modal.relist.submit'))
        .setCta()
        .onClick(() => {
          if (this.preis <= 0) { new Notice(t('notice.validation.priceRequired')); return; }

          this.listing.status = 'active';
          this.listing.preis = this.preis;
          this.listing.eingestellt_am = todayString();
          this.listing.eingestellt_count += 1;

          // Reset sale/shipping fields
          this.listing.verkauft = false;
          this.listing.verkauft_am = undefined;
          this.listing.verkauft_fuer = undefined;
          this.listing.bezahlt = false;
          this.listing.bezahlt_am = undefined;
          this.listing.bezahlart = undefined;
          this.listing.verschickt = false;
          this.listing.verschickt_am = undefined;
          this.listing.anschrift = undefined;
          this.listing.sendungsnummer = undefined;
          this.listing.label_erstellt = false;

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
