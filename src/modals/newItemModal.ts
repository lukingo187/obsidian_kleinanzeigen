import { App, Modal, Notice, Setting } from 'obsidian';
import { Listing, CONDITIONS, Condition, PriceType, DEFAULT_CARRIER, isCondition, isPriceType, isCarrierName } from '../models/listing';
import { t } from '../i18n';
import { todayString } from '../utils/formatting';
import { PortoState, renderCarrierPortoUI } from '../utils/portoUI';
import type KleinanzeigenPlugin from '../main';

type Mode = 'manual' | 'ai' | 'template';

export class NewItemModal extends Modal {
  private title = '';
  private condition: Condition = 'ok';
  private price = 0;
  private priceType: PriceType = 'negotiable';
  private portoState: PortoState = { carrier: DEFAULT_CARRIER, shippingService: undefined, shippingCost: undefined };
  private description = '';
  private mode: Mode;
  private onSubmit: (listing: Listing) => void;
  private plugin: KleinanzeigenPlugin;

  private fieldsContainer!: HTMLElement;
  private titleInput!: HTMLInputElement;
  private priceInput!: HTMLInputElement;
  private conditionSelect!: HTMLSelectElement;
  private priceTypeSelect!: HTMLSelectElement;
  private portoRerender!: () => void;
  private descTextArea!: HTMLTextAreaElement;

  constructor(app: App, plugin: KleinanzeigenPlugin, onSubmit: (listing: Listing) => void) {
    super(app);
    this.plugin = plugin;
    this.onSubmit = onSubmit;
    this.mode = this.defaultMode();
  }

  private hasApiKey(): boolean {
    const s = this.plugin.settings;
    return s.aiProviders?.[s.aiProvider]?.apiKey?.length > 0;
  }

  private defaultMode(): Mode {
    if (this.hasApiKey()) return 'ai';
    if (this.plugin.settings.templates?.length > 0) return 'template';
    return 'manual';
  }

  onOpen() {
    this.render(this.contentEl);
  }

  private render(contentEl: HTMLElement) {
    contentEl.empty();
    contentEl.addClass('ka-modal');
    contentEl.createEl('h2', { text: t('modal.newItem.title') });

    this.renderModeToggle(contentEl);

    if (this.mode === 'ai') {
      this.renderAISection(contentEl);
    } else if (this.mode === 'template') {
      this.renderTemplateSection(contentEl);
    }

    this.fieldsContainer = contentEl.createDiv({ cls: 'ka-new-item-fields' });

    if (this.mode === 'ai') {
      this.fieldsContainer.style.display = 'none';
    }

    this.renderFields(this.fieldsContainer);
  }

  private renderModeToggle(container: HTMLElement) {
    const toggleRow = container.createDiv({ cls: 'ka-mode-toggle' });
    const templates = this.plugin.settings.templates ?? [];

    const modes: Array<{ id: Mode; label: string }> = [
      { id: 'manual', label: t('modal.newItem.mode.manual') },
      { id: 'ai', label: t('modal.newItem.mode.ai') },
      ...(templates.length > 0 ? [{ id: 'template' as Mode, label: t('modal.newItem.mode.template') }] : []),
    ];

    for (const m of modes) {
      const btn = toggleRow.createEl('button', {
        text: m.label,
        cls: `ka-mode-btn${this.mode === m.id ? ' ka-mode-btn-active' : ''}`,
      });
      btn.addEventListener('click', () => {
        this.mode = m.id;
        this.render(this.contentEl);
      });
    }
  }

  private revealFields(fieldsContainer: HTMLElement, statusText: string) {
    const divider = fieldsContainer.createDiv({ cls: 'ka-ai-filled-divider' });
    divider.createSpan({ text: statusText });
    fieldsContainer.style.display = '';
    fieldsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  private renderAISection(container: HTMLElement) {
    const section = container.createDiv({ cls: 'ka-ai-section' });

    if (!this.hasApiKey()) {
      section.createDiv({ cls: 'ka-ai-no-key', text: t('modal.newItem.ai.noKey') });
      return;
    }

    section.createEl('p', { text: t('modal.newItem.ai.hint'), cls: 'ka-ai-hint' });

    const freeformArea = section.createEl('textarea', {
      cls: 'ka-textarea ka-freeform-input',
      placeholder: t('modal.newItem.ai.placeholder'),
    });
    freeformArea.rows = 3;

    const btnRow = section.createDiv({ cls: 'ka-ai-btn-row' });
    const aiBtn = btnRow.createEl('button', { text: t('modal.newItem.ai.button'), cls: 'ka-ai-fill-btn' });

    aiBtn.addEventListener('click', async () => {
      const text = freeformArea.value.trim();
      if (!text) {
        new Notice(t('notice.ai.describeFirst'));
        return;
      }

      aiBtn.textContent = t('modal.newItem.ai.loading');
      aiBtn.disabled = true;

      try {
        const aiService = this.plugin.createAIService();
        const parsed = await aiService.parseFreeformInput(text);

        this.title = parsed.title;
        this.titleInput.value = parsed.title;

        const matchedCondition = CONDITIONS.find(c => c === parsed.condition);
        if (matchedCondition) {
          this.condition = matchedCondition;
          this.conditionSelect.value = matchedCondition;
        }

        if (parsed.carrier) {
          this.portoState.carrier = parsed.carrier;
          this.portoState.shippingService = parsed.shippingService;
          this.portoState.shippingCost = parsed.shippingCost;
          this.portoRerender();
        }

        this.description = parsed.description;
        this.descTextArea.value = parsed.description;

        if (this.fieldsContainer.style.display === 'none') {
          this.revealFields(this.fieldsContainer, t('modal.newItem.ai.filled'));
        }
      } catch (e) {
        new Notice(e instanceof Error ? e.message : t('notice.ai.error'));
      } finally {
        aiBtn.textContent = t('modal.newItem.ai.button');
        aiBtn.disabled = false;
      }
    });
  }

  private renderTemplateSection(container: HTMLElement) {
    const templates = this.plugin.settings.templates ?? [];
    const section = container.createDiv({ cls: 'ka-template-section' });

    if (templates.length === 0) {
      section.createEl('p', { text: t('modal.newItem.template.none'), cls: 'ka-ai-hint' });
      return;
    }

    section.createEl('p', { text: t('modal.newItem.template.hint'), cls: 'ka-ai-hint' });

    const row = section.createDiv({ cls: 'ka-template-select-row' });
    const select = row.createEl('select', { cls: 'dropdown' });
    select.createEl('option', { value: '', text: t('modal.newItem.template.empty') });
    for (const tpl of templates) {
      select.createEl('option', { value: tpl.id, text: tpl.name });
    }

    const applyBtn = row.createEl('button', { text: t('modal.newItem.template.apply'), cls: 'ka-ai-fill-btn' });
    applyBtn.addEventListener('click', () => {
      const selected = templates.find(t => t.id === select.value);
      if (!selected) return;

      if (selected.title) { this.title = selected.title; this.titleInput.value = selected.title; }
      if (selected.price) { this.price = selected.price; this.priceInput.value = selected.price.toString(); }
      if (selected.condition) { this.condition = selected.condition; this.conditionSelect.value = selected.condition; }
      if (selected.price_type) { this.priceType = selected.price_type; this.priceTypeSelect.value = selected.price_type; }
      if (selected.carrier) {
        this.portoState.carrier = selected.carrier;
        this.portoState.shippingService = selected.shipping_service;
        this.portoState.shippingCost = selected.shipping_cost;
        this.portoRerender();
      }
      if (selected.description_template) {
        this.description = selected.description_template;
        this.descTextArea.value = selected.description_template;
      }

      new Notice(t('modal.newItem.template.applied', { name: selected.name }));
    });
  }

  private renderFields(container: HTMLElement) {
    new Setting(container)
      .setName(t('modal.newItem.field.name'))
      .addText(text => {
        text.setPlaceholder(t('modal.newItem.field.namePlaceholder'));
        text.setValue(this.title);
        text.onChange(v => this.title = v);
        text.inputEl.addClass('ka-artikel-input');
        this.titleInput = text.inputEl;
      });

    new Setting(container)
      .setName(t('modal.newItem.field.price'))
      .addText(text => {
        text.setPlaceholder(t('modal.newItem.field.pricePlaceholder'));
        text.setValue(this.price > 0 ? this.price.toString() : '');
        text.onChange(v => this.price = parseFloat(v) || 0);
        this.priceInput = text.inputEl;
      })
      .addDropdown(dd => {
        dd.addOption('negotiable', t('price_type.negotiable'));
        dd.addOption('fixed', t('price_type.fixed'));
        dd.setValue(this.priceType);
        dd.onChange(v => { if (isPriceType(v)) this.priceType = v; });
        this.priceTypeSelect = dd.selectEl;
      });

    new Setting(container)
      .setName(t('modal.newItem.field.condition'))
      .addDropdown(dd => {
        for (const c of CONDITIONS) dd.addOption(c, t(`condition.${c}` as import('../i18n').StringKey));
        dd.setValue(this.condition);
        dd.onChange(v => { if (isCondition(v)) this.condition = v; });
        this.conditionSelect = dd.selectEl;
      });

    const { rerender } = renderCarrierPortoUI({ container, state: this.portoState });
    this.portoRerender = rerender;

    new Setting(container)
      .setName(t('modal.newItem.field.description'))
      .addTextArea(ta => {
        ta.setPlaceholder(t('modal.newItem.field.descPlaceholder'));
        ta.setValue(this.description);
        ta.onChange(v => this.description = v);
        ta.inputEl.rows = 4;
        ta.inputEl.addClass('ka-textarea');
        this.descTextArea = ta.inputEl;
      });

    new Setting(container)
      .addButton(btn => btn
        .setButtonText(t('modal.newItem.submit'))
        .setCta()
        .onClick(() => {
          if (!this.title.trim()) { new Notice(t('notice.validation.nameRequired')); return; }
          if (this.price <= 0) { new Notice(t('notice.validation.priceRequired')); return; }

          const today = todayString();
          const listing: Listing = {
            title:            this.title.trim(),
            description:      this.description || undefined,
            condition:        this.condition,
            status:           'active',
            price:            this.price,
            price_type:       this.priceType,
            carrier:          isCarrierName(this.portoState.carrier) ? this.portoState.carrier : undefined,
            shipping_service: this.portoState.shippingService,
            shipping_cost:    this.portoState.shippingCost,
            listed_at:        today,
            first_listed_at:  today,
            listing_count:    1,
            sold:             false,
            paid:             false,
            label_printed:    false,
            shipped:          false,
          };

          this.onSubmit(listing);
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
