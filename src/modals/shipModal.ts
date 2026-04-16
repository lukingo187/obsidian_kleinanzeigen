import { App, Modal, Notice, Setting } from 'obsidian';
import { Listing, DEFAULT_CARRIER, isCarrierName } from '../models/listing';
import { todayString } from '../utils/formatting';
import { PortoState, renderCarrierPortoUI } from '../utils/portoUI';
import { t } from '../i18n';

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

    contentEl.createEl('h2', { text: `${t('modal.ship.title')} — ${this.listing.artikel}` });

    const addrContainer = contentEl.createDiv();
    new Setting(addrContainer)
      .setName(t('modal.ship.field.address'))
      .addTextArea(ta => {
        ta.setPlaceholder(t('modal.ship.field.addressPlaceholder'));
        ta.setValue(this.anschrift);
        ta.onChange(v => this.anschrift = v);
        ta.inputEl.rows = 3;
        ta.inputEl.addClass('ka-textarea');
      });

    const isAbholung = () => this.portoState.carrier === 'Abholung';
    const updateAddrVisibility = () => {
      addrContainer.style.display = isAbholung() ? 'none' : '';
    };

    renderCarrierPortoUI({
      container: contentEl,
      state: this.portoState,
      onChange: () => updateAddrVisibility(),
      showTracking: true,
      trackingState: {
        sendungsnummer: this.sendungsnummer,
        labelErstellt: this.labelErstellt,
        onSendungsnummerChange: v => this.sendungsnummer = v,
        onLabelChange: v => this.labelErstellt = v,
      },
    });

    updateAddrVisibility();

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(t('modal.ship.submit'))
        .setCta()
        .onClick(() => {
          if (!isAbholung() && !this.anschrift.trim()) { new Notice(t('notice.validation.addressRequired')); return; }

          this.listing.status = 'shipped';
          this.listing.verschickt = true;
          this.listing.verschickt_am = todayString();
          this.listing.anschrift = this.anschrift.trim();
          this.listing.carrier = isCarrierName(this.portoState.carrier) ? this.portoState.carrier : undefined;
          this.listing.porto_name = this.portoState.portoName;
          this.listing.porto_price = this.portoState.portoPrice;
          this.listing.sendungsnummer = this.sendungsnummer || undefined;
          this.listing.label_erstellt = this.labelErstellt;

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
