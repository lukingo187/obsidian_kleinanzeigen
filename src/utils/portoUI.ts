import { Setting } from 'obsidian';
import { CARRIERS, CARRIER_SERVICES, ShippingService } from '../models/listing';
import { formatCurrency } from './formatting';
import { t } from '../i18n';

export interface PortoState {
  carrier: string;
  shippingService: string | undefined;
  shippingCost: number | undefined;
}

export interface PortoUIOptions {
  container: HTMLElement;
  state: PortoState;
  onChange?: (state: PortoState) => void;
  showTracking?: boolean;
  trackingState?: {
    trackingNumber: string;
    labelPrinted: boolean;
    onTrackingNumberChange: (v: string) => void;
    onLabelChange: (v: boolean) => void;
  };
}

function applyCarrierChange(state: PortoState, newCarrier: string, onChange?: (s: PortoState) => void): void {
  state.carrier = newCarrier;
  state.shippingService = undefined;
  state.shippingCost = undefined;
  if (newCarrier === 'Pickup') {
    state.shippingService = 'Pickup';
    state.shippingCost = 0;
  }
  onChange?.(state);
}

function renderPortoSubFields(
  container: HTMLElement,
  state: PortoState,
  presets: ShippingService[] | undefined,
  onChange?: (s: PortoState) => void,
): void {
  if (presets) {
    const portoSelect = container.createEl('select', { cls: 'dropdown' });
    for (const p of presets) {
      const label = `${p.name} (${formatCurrency(p.price)})`;
      const opt = portoSelect.createEl('option', { value: p.name, text: label });
      if (state.shippingService === p.name) opt.selected = true;
    }
    const match = presets.find(p => p.name === state.shippingService);
    if (match) {
      portoSelect.value = match.name;
      state.shippingCost = match.price;
    } else {
      state.shippingService = presets[0].name;
      state.shippingCost = presets[0].price;
    }
    portoSelect.addEventListener('change', () => {
      const matched = presets.find(p => p.name === portoSelect.value);
      if (matched) {
        state.shippingService = matched.name;
        state.shippingCost = matched.price;
        onChange?.(state);
      }
    });
  } else {
    const row = container.createDiv({ cls: 'ka-porto-inline' });
    const nameInput = row.createEl('input', {
      cls: 'ka-setting-input',
      type: 'text',
      placeholder: t('porto.namePlaceholder'),
    });
    if (state.shippingService) nameInput.value = state.shippingService;
    nameInput.addEventListener('input', () => {
      state.shippingService = nameInput.value || undefined;
      onChange?.(state);
    });

    const priceInput = row.createEl('input', {
      cls: 'ka-setting-input ka-porto-price-input',
      type: 'text',
      placeholder: t('porto.pricePlaceholder'),
    });
    if (state.shippingCost != null) priceInput.value = state.shippingCost.toString();
    priceInput.addEventListener('input', () => {
      state.shippingCost = parseFloat(priceInput.value.replace(',', '.')) || 0;
      onChange?.(state);
    });
  }
}

export function renderCarrierPortoUI(opts: PortoUIOptions): { rerender: () => void } {
  const { container, state, onChange } = opts;

  const versandSetting = new Setting(container).setName(t('porto.shipping'));
  const wrapper = versandSetting.controlEl.createDiv({ cls: 'ka-porto-settings-wrapper' });

  const carrierSelect = wrapper.createEl('select', { cls: 'dropdown' });
  for (const c of CARRIERS) {
    carrierSelect.createEl('option', { value: c, text: c });
  }
  carrierSelect.value = state.carrier;

  const portoContainer = wrapper.createDiv({ cls: 'ka-porto-sub-fields' });
  let trackingEls: HTMLElement[] = [];
  const trackingAnchor = container.createDiv();

  const updateFields = () => {
    portoContainer.empty();
    trackingEls.forEach(el => el.remove());
    trackingEls = [];
    const isPickup = state.carrier === 'Pickup';

    if (!isPickup) {
      renderPortoSubFields(portoContainer, state, CARRIER_SERVICES[state.carrier], onChange);
    }

    if (opts.showTracking && opts.trackingState && !isPickup) {
      const snSetting = new Setting(container)
        .setName(t('porto.tracking'))
        .addText(text => text
          .setPlaceholder(t('porto.trackingPlaceholder'))
          .setValue(opts.trackingState!.trackingNumber)
          .onChange(v => opts.trackingState!.onTrackingNumberChange(v)));
      container.insertBefore(snSetting.settingEl, trackingAnchor);
      trackingEls.push(snSetting.settingEl);

      const labelSetting = new Setting(container)
        .setName(t('porto.labelPrinted'))
        .addToggle(toggle => toggle
          .setValue(opts.trackingState!.labelPrinted)
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

export function renderCarrierPortoSettingsUI(
  container: HTMLElement,
  state: PortoState,
  onChange: (state: PortoState) => void,
  options?: { allowEmpty?: boolean },
): void {
  const wrapper = container.createDiv({ cls: 'ka-porto-settings-wrapper' });
  const carrierSelect = wrapper.createEl('select', { cls: 'dropdown' });
  if (options?.allowEmpty) {
    carrierSelect.createEl('option', { value: '', text: t('porto.anyOption') });
  }
  for (const c of CARRIERS) {
    const opt = carrierSelect.createEl('option', { value: c, text: c });
    if (state.carrier === c) opt.selected = true;
  }

  const portoContainer = wrapper.createDiv({ cls: 'ka-porto-sub-fields' });

  const renderSubFields = () => {
    portoContainer.empty();
    const carrier = carrierSelect.value;
    if (!carrier || carrier === 'Pickup') return;
    renderPortoSubFields(portoContainer, state, CARRIER_SERVICES[carrier], onChange);
  };

  carrierSelect.addEventListener('change', () => {
    applyCarrierChange(state, carrierSelect.value, onChange);
    renderSubFields();
  });

  renderSubFields();
}
