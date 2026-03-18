import { App, Modal, Setting } from 'obsidian';
import { Listing, ZUSTAND_OPTIONS, Zustand, Preisart, PORTO_OPTIONS, PortoOption } from '../models/listing';
import { todayString } from '../utils/formatting';

export class NewItemModal extends Modal {
  private artikel = '';
  private zustand: Zustand = 'Gut';
  private preis = 0;
  private preisart: Preisart = 'VB';
  private porto: PortoOption | undefined;
  private beschreibung = '';
  private onSubmit: (listing: Listing) => void;

  constructor(app: App, onSubmit: (listing: Listing) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('ka-modal');

    contentEl.createEl('h2', { text: 'Neuer Artikel' });

    new Setting(contentEl)
      .setName('Artikel *')
      .addText(text => text
        .setPlaceholder('z.B. MacBook Pro 2020')
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
      .setName('Preis (€) *')
      .addText(text => text
        .setPlaceholder('25.00')
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
        dd.onChange(v => this.porto = v ? v as PortoOption : undefined);
      });

    new Setting(contentEl)
      .setName('Beschreibung')
      .addTextArea(ta => {
        ta.setPlaceholder('Artikelbeschreibung...');
        ta.onChange(v => this.beschreibung = v);
        ta.inputEl.rows = 4;
        ta.inputEl.addClass('ka-textarea');
      });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Einstellen')
        .setCta()
        .onClick(() => {
          if (!this.artikel.trim()) return;
          if (this.preis <= 0) return;

          const today = todayString();
          const listing: Listing = {
            artikel: this.artikel.trim(),
            beschreibung: this.beschreibung || undefined,
            zustand: this.zustand,
            status: 'Aktiv',
            preis: this.preis,
            preisart: this.preisart,
            porto: this.porto,
            eingestellt_am: today,
            erstmals_eingestellt_am: today,
            eingestellt_count: 1,
            verkauft: false,
            bezahlt: false,
            label_erstellt: false,
            verschickt: false,
          };

          this.onSubmit(listing);
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
