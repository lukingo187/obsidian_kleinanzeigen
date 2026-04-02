import { App, Modal, Setting } from 'obsidian';
import { Listing, DEFAULT_CARRIER } from '../models/listing';
import { todayString } from '../utils/formatting';
import { PortoState, renderCarrierPortoUI } from '../utils/portoUI';

export class ShipModal extends Modal {
  private listing: Listing;
  private anschrift = '';
  private portoState: PortoState;
  private sendungsnummer = '';
  private labelErstellt = false;
  private onSubmit: (listing: Listing) => void;

  constructor(app: App, listing: Listing, onSubmit: (listing: Listing) => void) {
    super(app);
    this.listing = { ...listing };
    this.anschrift = listing.anschrift ?? '';
    this.portoState = {
      carrier: listing.carrier ?? DEFAULT_CARRIER,
      portoName: listing.porto_name,
      portoPrice: listing.porto_price,
    };
    this.sendungsnummer = listing.sendungsnummer ?? '';
    this.labelErstellt = listing.label_erstellt;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('ka-modal');

    contentEl.createEl('h2', { text: `Verschicken — ${this.listing.artikel}` });

    new Setting(contentEl)
      .setName('Anschrift *')
      .addTextArea(ta => {
        ta.setPlaceholder('Name\nStraße Nr.\nPLZ Ort');
        ta.setValue(this.anschrift);
        ta.onChange(v => this.anschrift = v);
        ta.inputEl.rows = 3;
        ta.inputEl.addClass('ka-textarea');
      });

    renderCarrierPortoUI({
      container: contentEl,
      state: this.portoState,
      showTracking: true,
      trackingState: {
        sendungsnummer: this.sendungsnummer,
        labelErstellt: this.labelErstellt,
        onSendungsnummerChange: v => this.sendungsnummer = v,
        onLabelChange: v => this.labelErstellt = v,
      },
    });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Als verschickt markieren')
        .setCta()
        .onClick(() => {
          if (!this.anschrift.trim()) return;

          this.listing.status = 'Verschickt';
          this.listing.verschickt = true;
          this.listing.verschickt_am = todayString();
          this.listing.anschrift = this.anschrift.trim();
          this.listing.carrier = this.portoState.carrier;
          this.listing.porto_name = this.portoState.portoName;
          this.listing.porto_price = this.portoState.portoPrice;
          this.listing.sendungsnummer = this.sendungsnummer || undefined;
          this.listing.label_erstellt = this.labelErstellt;

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
