import { App, Modal, Notice, Setting } from 'obsidian';
import { Listing, PaymentMethod, PAYMENT_METHODS, isPaymentMethod } from '../models/listing';
import { todayString } from '../utils/formatting';
import { t } from '../i18n';

export class SoldModal extends Modal {
  private listing: Listing;
  private isEdit: boolean;
  private soldFor: number;
  private paymentMethod: PaymentMethod;
  private paid: boolean;
  private onSubmit: (listing: Listing) => void;

  constructor(app: App, listing: Listing, onSubmit: (listing: Listing) => void) {
    super(app);
    this.listing = { ...listing };
    this.isEdit = listing.sold;
    this.soldFor = listing.sold_for ?? listing.price;
    this.paymentMethod = listing.payment_method ?? PAYMENT_METHODS[0];
    this.paid = listing.paid;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('ka-modal');

    const title = this.isEdit ? t('modal.sold.titleEdit') : t('modal.sold.titleNew');
    contentEl.createEl('h2', { text: `${title} — ${this.listing.title}` });

    new Setting(contentEl)
      .setName(t('modal.sold.field.price'))
      .setDesc(t('modal.sold.field.priceDesc', { price: this.listing.price }))
      .addText(text => text
        .setValue(this.soldFor.toString())
        .onChange(v => this.soldFor = parseFloat(v) || 0));

    new Setting(contentEl)
      .setName(t('modal.sold.field.payment'))
      .addDropdown(dd => {
        for (const m of PAYMENT_METHODS) {
          dd.addOption(m, m);
        }
        dd.setValue(this.paymentMethod);
        dd.onChange(v => { if (isPaymentMethod(v)) this.paymentMethod = v; });
      });

    new Setting(contentEl)
      .setName(t('modal.sold.field.paid'))
      .addToggle(toggle => toggle
        .setValue(this.paid)
        .onChange(v => this.paid = v));

    const btnText = this.isEdit ? t('modal.sold.submitEdit') : t('modal.sold.submitNew');
    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(btnText)
        .setCta()
        .onClick(() => {
          if (this.soldFor <= 0) { new Notice(t('notice.validation.sellPriceRequired')); return; }

          const today = todayString();
          if (!this.isEdit) {
            this.listing.status = 'sold';
            this.listing.sold = true;
            this.listing.sold_at = this.listing.sold_at ?? today;
          }
          this.listing.sold_for = this.soldFor;
          this.listing.payment_method = this.paymentMethod;
          this.listing.paid = this.paid;
          if (this.paid && !this.listing.paid_at) {
            this.listing.paid_at = today;
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
