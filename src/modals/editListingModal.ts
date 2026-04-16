import { App, Modal, Notice, Setting } from 'obsidian';
import { Listing, ZUSTAND_OPTIONS, Zustand, Preisart, DEFAULT_CARRIER, isZustand, isPreisart, isCarrierName } from '../models/listing';
import { PortoState, renderCarrierPortoUI } from '../utils/portoUI';
import { t, StringKey } from '../i18n';

export class EditListingModal extends Modal {
  private listing: Listing;
  private artikel: string;
  private zustand: Zustand;
  private preis: number;
  private preisart: Preisart;
  private portoState: PortoState;
  private beschreibung: string;
  private onSubmit: (listing: Listing) => void;

  constructor(app: App, listing: Listing, onSubmit: (listing: Listing) => void) {
    super(app);
    this.listing = { ...listing };
    this.artikel = listing.artikel;
    this.zustand = listing.zustand;
    this.preis = listing.preis;
    this.preisart = listing.preisart;
    this.portoState = {
      carrier: listing.carrier ?? DEFAULT_CARRIER,
      portoName: listing.porto_name,
      portoPrice: listing.porto_price,
    };
    this.beschreibung = listing.beschreibung ?? '';
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('ka-modal');

    contentEl.createEl('h2', { text: t('modal.edit.title') });

    new Setting(contentEl)
      .setName(t('modal.edit.field.name'))
      .addText(text => text
        .setValue(this.artikel)
        .onChange(v => this.artikel = v));

    new Setting(contentEl)
      .setName(t('modal.edit.field.condition'))
      .addDropdown(dd => {
        for (const z of ZUSTAND_OPTIONS) {
          dd.addOption(z, t(`zustand.${z}` as StringKey));
        }
        dd.setValue(this.zustand);
        dd.onChange(v => { if (isZustand(v)) this.zustand = v; });
      });

    new Setting(contentEl)
      .setName(t('modal.edit.field.price'))
      .addText(text => text
        .setValue(this.preis.toString())
        .onChange(v => this.preis = parseFloat(v) || 0))
      .addDropdown(dd => {
        dd.addOption('negotiable', t('preisart.negotiable'));
        dd.addOption('fixed', t('preisart.fixed'));
        dd.setValue(this.preisart);
        dd.onChange(v => { if (isPreisart(v)) this.preisart = v; });
      });

    renderCarrierPortoUI({
      container: contentEl,
      state: this.portoState,
    });

    new Setting(contentEl)
      .setName(t('modal.edit.field.description'))
      .addTextArea(ta => {
        ta.setValue(this.beschreibung);
        ta.onChange(v => this.beschreibung = v);
        ta.inputEl.rows = 4;
        ta.inputEl.addClass('ka-textarea');
      });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(t('common.save'))
        .setCta()
        .onClick(() => {
          if (!this.artikel.trim()) { new Notice(t('notice.validation.nameRequired')); return; }

          this.listing.artikel = this.artikel.trim();
          this.listing.zustand = this.zustand;
          this.listing.preis = this.preis;
          this.listing.preisart = this.preisart;
          this.listing.carrier = isCarrierName(this.portoState.carrier) ? this.portoState.carrier : undefined;
          this.listing.porto_name = this.portoState.portoName;
          this.listing.porto_price = this.portoState.portoPrice;
          this.listing.beschreibung = this.beschreibung || undefined;

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
