import { App, Modal, Setting } from 'obsidian';
import { Listing } from '../models/listing';
import { todayString } from '../utils/formatting';

const BEZAHLART_OPTIONS = ['PayPal', 'Überweisung', 'Barzahlung', 'Sonstige'];

export class SoldModal extends Modal {
  private listing: Listing;
  private isEdit: boolean;
  private verkauftFuer: number;
  private bezahlart: string;
  private bezahlt: boolean;
  private onSubmit: (listing: Listing) => void;

  constructor(app: App, listing: Listing, onSubmit: (listing: Listing) => void) {
    super(app);
    this.listing = { ...listing };
    this.isEdit = listing.verkauft;
    this.verkauftFuer = listing.verkauft_fuer ?? listing.preis;
    this.bezahlart = listing.bezahlart ?? 'PayPal';
    this.bezahlt = listing.bezahlt;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('ka-modal');

    const title = this.isEdit ? 'Verkauf bearbeiten' : 'Verkauft';
    contentEl.createEl('h2', { text: `${title} — ${this.listing.artikel}` });

    new Setting(contentEl)
      .setName('Verkauft für (€) *')
      .setDesc(`Eingestellt für ${this.listing.preis}€`)
      .addText(text => text
        .setValue(this.verkauftFuer.toString())
        .onChange(v => this.verkauftFuer = parseFloat(v) || 0));

    new Setting(contentEl)
      .setName('Bezahlart')
      .addDropdown(dd => {
        for (const b of BEZAHLART_OPTIONS) {
          dd.addOption(b, b);
        }
        dd.setValue(this.bezahlart);
        dd.onChange(v => this.bezahlart = v);
      });

    new Setting(contentEl)
      .setName('Bezahlt')
      .addToggle(toggle => toggle
        .setValue(this.bezahlt)
        .onChange(v => this.bezahlt = v));

    const btnText = this.isEdit ? 'Speichern' : 'Als verkauft markieren';
    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(btnText)
        .setCta()
        .onClick(() => {
          if (this.verkauftFuer <= 0) return;

          const today = todayString();
          if (!this.isEdit) {
            this.listing.status = 'Verkauft';
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
        .setButtonText('Abbrechen')
        .onClick(() => this.close()));
  }

  onClose() {
    this.contentEl.empty();
  }
}
