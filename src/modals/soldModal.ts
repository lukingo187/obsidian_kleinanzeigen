import { App, Modal, Notice, Setting } from 'obsidian';
import { Listing, Bezahlart, BEZAHLART_OPTIONS, isBezahlart } from '../models/listing';
import { todayString } from '../utils/formatting';
import { t } from '../i18n';

export class SoldModal extends Modal {
  private listing: Listing;
  private isEdit: boolean;
  private verkauftFuer: number;
  private bezahlart: Bezahlart;
  private bezahlt: boolean;
  private onSubmit: (listing: Listing) => void;

  constructor(app: App, listing: Listing, onSubmit: (listing: Listing) => void) {
    super(app);
    this.listing = { ...listing };
    this.isEdit = listing.verkauft;
    this.verkauftFuer = listing.verkauft_fuer ?? listing.preis;
    this.bezahlart = listing.bezahlart ?? BEZAHLART_OPTIONS[0];
    this.bezahlt = listing.bezahlt;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('ka-modal');

    const title = this.isEdit ? t('modal.sold.titleEdit') : t('modal.sold.titleNew');
    contentEl.createEl('h2', { text: `${title} — ${this.listing.artikel}` });

    new Setting(contentEl)
      .setName(t('modal.sold.field.price'))
      .setDesc(t('modal.sold.field.priceDesc', { price: this.listing.preis }))
      .addText(text => text
        .setValue(this.verkauftFuer.toString())
        .onChange(v => this.verkauftFuer = parseFloat(v) || 0));

    new Setting(contentEl)
      .setName(t('modal.sold.field.payment'))
      .addDropdown(dd => {
        for (const b of BEZAHLART_OPTIONS) {
          dd.addOption(b, b);
        }
        dd.setValue(this.bezahlart);
        dd.onChange(v => { if (isBezahlart(v)) this.bezahlart = v; });
      });

    new Setting(contentEl)
      .setName(t('modal.sold.field.paid'))
      .addToggle(toggle => toggle
        .setValue(this.bezahlt)
        .onChange(v => this.bezahlt = v));

    const btnText = this.isEdit ? t('modal.sold.submitEdit') : t('modal.sold.submitNew');
    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(btnText)
        .setCta()
        .onClick(() => {
          if (this.verkauftFuer <= 0) { new Notice(t('notice.validation.sellPriceRequired')); return; }

          const today = todayString();
          if (!this.isEdit) {
            this.listing.status = 'sold';
            this.listing.verkauft = true;
            this.listing.verkauft_am = this.listing.verkauft_am ?? today;
          }
          this.listing.verkauft_fuer = this.verkauftFuer;
          this.listing.bezahlart = this.bezahlart;
          this.listing.bezahlt = this.bezahlt;
          if (this.bezahlt && !this.listing.bezahlt_am) {
            this.listing.bezahlt_am = today;
          }

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
