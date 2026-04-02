import { Setting } from 'obsidian';
import { CARRIERS, CARRIER_OPTIONS, PortoEntry } from '../models/listing';
import { formatCurrency } from './formatting';

export interface PortoState {
  carrier: string;
  portoName: string | undefined;
  portoPrice: number | undefined;
}

export interface PortoUIOptions {
  container: HTMLElement;
  state: PortoState;
  onChange?: (state: PortoState) => void;
  showTracking?: boolean;
  trackingState?: {
    sendungsnummer: string;
    labelErstellt: boolean;
    onSendungsnummerChange: (v: string) => void;
    onLabelChange: (v: boolean) => void;
  };
}

/** Handle carrier change: reset porto fields, special-case Abholung. */
function applyCarrierChange(state: PortoState, newCarrier: string, onChange?: (s: PortoState) => void): void {
  state.carrier = newCarrier;
  state.portoName = undefined;
  state.portoPrice = undefined;
  if (newCarrier === 'Abholung') {
    state.portoName = 'Abholung';
    state.portoPrice = 0;
  }
  onChange?.(state);
}

/** Render preset porto dropdown or free-text inputs for "Sonstiges". */
function renderPortoSubFields(
  container: HTMLElement,
  state: PortoState,
  presets: PortoEntry[] | undefined,
  onChange?: (s: PortoState) => void,
): void {
  if (presets) {
    const portoSelect = container.createEl('select', { cls: 'dropdown' });
    for (const p of presets) {
      const label = `${p.name} (${formatCurrency(p.price)})`;
      const opt = portoSelect.createEl('option', { value: p.name, text: label });
      if (state.portoName === p.name) opt.selected = true;
    }
    const match = presets.find(p => p.name === state.portoName);
    if (match) {
      portoSelect.value = match.name;
      state.portoPrice = match.price;
    } else {
      state.portoName = presets[0].name;
      state.portoPrice = presets[0].price;
    }
    portoSelect.addEventListener('change', () => {
      const matched = presets.find(p => p.name === portoSelect.value);
      if (matched) {
        state.portoName = matched.name;
        state.portoPrice = matched.price;
        onChange?.(state);
      }
    });
  } else {
    const row = container.createDiv({ cls: 'ka-porto-inline' });
    const nameInput = row.createEl('input', {
      cls: 'ka-setting-input',
      type: 'text',
      placeholder: 'Bezeichnung',
    });
    if (state.portoName) nameInput.value = state.portoName;
    nameInput.addEventListener('input', () => {
      state.portoName = nameInput.value || undefined;
      onChange?.(state);
    });

    const priceInput = row.createEl('input', {
      cls: 'ka-setting-input ka-porto-price-input',
      type: 'text',
      placeholder: 'Preis (€)',
    });
    if (state.portoPrice != null) priceInput.value = state.portoPrice.toString();
    priceInput.addEventListener('input', () => {
      state.portoPrice = parseFloat(priceInput.value.replace(',', '.')) || 0;
      onChange?.(state);
    });
  }
}

/**
 * Renders carrier + porto selection UI into a container.
 * Used by NewItemModal, EditListingModal, ShipModal.
 * State is mutated in-place; onChange is optional notification.
 */
export function renderCarrierPortoUI(opts: PortoUIOptions): { rerender: () => void } {
  const { container, state, onChange } = opts;

  const versandSetting = new Setting(container).setName('Versand');
  const wrapper = versandSetting.controlEl.createDiv({ cls: 'ka-porto-settings-wrapper' });

  const carrierSelect = wrapper.createEl('select', { cls: 'dropdown' });
  for (const c of CARRIERS) {
    carrierSelect.createEl('option', { value: c, text: c });
  }
  carrierSelect.value = state.carrier;

  const portoContainer = wrapper.createDiv({ cls: 'ka-porto-sub-fields' });
  let trackingEls: HTMLElement[] = [];
  // Anchor element: tracking settings are inserted before this so they stay
  // above any elements added to the container after renderCarrierPortoUI returns (e.g. buttons).
  const trackingAnchor = container.createDiv();

  const updateFields = () => {
    portoContainer.empty();
    trackingEls.forEach(el => el.remove());
    trackingEls = [];
    const isAbholung = state.carrier === 'Abholung';

    if (!isAbholung) {
      renderPortoSubFields(portoContainer, state, CARRIER_OPTIONS[state.carrier], onChange);
    }

    if (opts.showTracking && opts.trackingState && !isAbholung) {
      const snSetting = new Setting(container)
        .setName('Sendungsnummer')
        .addText(text => text
          .setPlaceholder('Tracking-Nummer')
          .setValue(opts.trackingState!.sendungsnummer)
          .onChange(v => opts.trackingState!.onSendungsnummerChange(v)));
      container.insertBefore(snSetting.settingEl, trackingAnchor);
      trackingEls.push(snSetting.settingEl);

      const labelSetting = new Setting(container)
        .setName('Label gedruckt')
        .addToggle(toggle => toggle
          .setValue(opts.trackingState!.labelErstellt)
          .onChange(v => opts.trackingState!.onLabelChange(v)));
      container.insertBefore(labelSetting.settingEl, trackingAnchor);
      trackingEls.push(labelSetting.settingEl);
    }
  };

  carrierSelect.addEventListener('change', () => {
    applyCarrierChange(state, carrierSelect.value, onChange);
    updateFields();
  });

  updateFields();

  return {
    rerender: () => {
      carrierSelect.value = state.carrier;
      updateFields();
    },
  };
}

/**
 * Renders carrier + porto selection for the settings template editor.
 */
export function renderCarrierPortoSettingsUI(
  container: HTMLElement,
  state: PortoState,
  onChange: (state: PortoState) => void,
  options?: { allowEmpty?: boolean },
): void {
  const wrapper = container.createDiv({ cls: 'ka-porto-settings-wrapper' });
  const carrierSelect = wrapper.createEl('select', { cls: 'dropdown' });
  if (options?.allowEmpty) {
    carrierSelect.createEl('option', { value: '', text: '— beliebig —' });
  }
  for (const c of CARRIERS) {
    const opt = carrierSelect.createEl('option', { value: c, text: c });
    if (state.carrier === c) opt.selected = true;
  }

  const portoContainer = wrapper.createDiv({ cls: 'ka-porto-sub-fields' });

  const renderSubFields = () => {
    portoContainer.empty();
    const carrier = carrierSelect.value;
    if (!carrier || carrier === 'Abholung') return;
    renderPortoSubFields(portoContainer, state, CARRIER_OPTIONS[carrier], onChange);
  };

  carrierSelect.addEventListener('change', () => {
    applyCarrierChange(state, carrierSelect.value, onChange);
    renderSubFields();
  });

  renderSubFields();
}
