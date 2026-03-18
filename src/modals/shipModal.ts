import { App, Modal, Setting } from 'obsidian';
import { Listing, PORTO_OPTIONS, PortoOption } from '../models/listing';
import { todayString } from '../utils/formatting';

export class ShipModal extends Modal {
  private listing: Listing;
  private anschrift = '';
  private porto: PortoOption;
  private sendungsnummer = '';
  private labelErstellt = false;
  private onSubmit: (listing: Listing) => void;

  constructor(app: App, listing: Listing, onSubmit: (listing: Listing) => void) {
    super(app);
    this.listing = listing;
    this.anschrift = listing.anschrift ?? '';
    this.porto = listing.porto ?? PORTO_OPTIONS[0];
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

    new Setting(contentEl)
      .setName('Porto')
      .addDropdown(dd => {
        for (const p of PORTO_OPTIONS) {
          dd.addOption(p, p);
        }
        dd.setValue(this.porto);
        dd.onChange(v => this.porto = v as PortoOption);
      });

    new Setting(contentEl)
      .setName('Sendungsnummer')
      .addText(text => text
        .setPlaceholder('Tracking-Nummer')
        .setValue(this.sendungsnummer)
        .onChange(v => this.sendungsnummer = v));

    new Setting(contentEl)
      .setName('Label gedruckt')
      .addToggle(toggle => toggle
        .setValue(this.labelErstellt)
        .onChange(v => this.labelErstellt = v));

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
          this.listing.porto = this.porto;
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
