import { App, Modal, Setting } from 'obsidian';
import { Listing, ZUSTAND_OPTIONS, Zustand, Preisart, PORTO_OPTIONS, PortoOption } from '../models/listing';

export class EditListingModal extends Modal {
  private listing: Listing;
  private artikel: string;
  private zustand: Zustand;
  private preis: number;
  private preisart: Preisart;
  private porto: PortoOption | undefined;
  private beschreibung: string;
  private onSubmit: (listing: Listing) => void;

  constructor(app: App, listing: Listing, onSubmit: (listing: Listing) => void) {
    super(app);
    this.listing = { ...listing };
    this.artikel = listing.artikel;
    this.zustand = listing.zustand;
    this.preis = listing.preis;
    this.preisart = listing.preisart;
    this.porto = listing.porto;
    this.beschreibung = listing.beschreibung ?? '';
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('ka-modal');

    contentEl.createEl('h2', { text: 'Inserat bearbeiten' });

    new Setting(contentEl)
      .setName('Artikel')
      .addText(text => text
        .setValue(this.artikel)
        .onChange(v => this.artikel = v));

    new Setting(contentEl)
      .setName('Zustand')
      .addDropdown(dd => {
        for (const z of ZUSTAND_OPTIONS) {
          dd.addOption(z, z);
        }
        dd.setValue(this.zustand);
        dd.onChange(v => this.zustand = v as Zustand);
      });

    new Setting(contentEl)
      .setName('Preis (€)')
      .addText(text => text
        .setValue(this.preis.toString())
        .onChange(v => this.preis = parseFloat(v) || 0))
      .addDropdown(dd => {
        dd.addOption('VB', 'VB');
        dd.addOption('Festpreis', 'Festpreis');
        dd.setValue(this.preisart);
        dd.onChange(v => this.preisart = v as Preisart);
      });

    new Setting(contentEl)
      .setName('Versand')
      .addDropdown(dd => {
        dd.addOption('', '— kein Versand —');
        for (const p of PORTO_OPTIONS) {
          dd.addOption(p, p);
        }
        dd.setValue(this.porto ?? '');
        dd.onChange(v => this.porto = v ? v as PortoOption : undefined);
      });

    new Setting(contentEl)
      .setName('Beschreibung')
      .addTextArea(ta => {
        ta.setValue(this.beschreibung);
        ta.onChange(v => this.beschreibung = v);
        ta.inputEl.rows = 4;
        ta.inputEl.addClass('ka-textarea');
      });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Speichern')
        .setCta()
        .onClick(() => {
          if (!this.artikel.trim()) return;

          this.listing.artikel = this.artikel.trim();
          this.listing.zustand = this.zustand;
          this.listing.preis = this.preis;
          this.listing.preisart = this.preisart;
          this.listing.porto = this.porto;
          this.listing.beschreibung = this.beschreibung || undefined;

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
