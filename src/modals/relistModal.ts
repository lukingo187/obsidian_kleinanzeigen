import { App, Modal, Notice, Setting } from 'obsidian';
import { Listing } from '../models/listing';
import { todayString } from '../utils/formatting';

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

    contentEl.createEl('h2', { text: `Neu einstellen — ${this.listing.artikel}` });

    new Setting(contentEl)
      .setName('Preis (€)')
      .setDesc(`Zuletzt: ${this.listing.preis}€`)
      .addText(text => text
        .setValue(this.preis.toString())
        .onChange(v => this.preis = parseFloat(v) || 0));

    if (this.listing.beschreibung) {
      new Setting(contentEl)
        .setName('Beschreibung')
        .setDesc('Zum Kopieren für Kleinanzeigen');

      const descBox = contentEl.createDiv({ cls: 'ka-desc-box' });
      descBox.setText(this.listing.beschreibung);
    }

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Neu einstellen')
        .setCta()
        .onClick(() => {
          if (this.preis <= 0) { new Notice('Bitte einen gültigen Preis eingeben.'); return; }

          this.listing.status = 'Aktiv';
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
        .setButtonText('Abbrechen')
        .onClick(() => this.close()));
  }

  onClose() {
    this.contentEl.empty();
  }
}
