import { App, Modal, Notice, Setting } from 'obsidian';
import { Listing, ZUSTAND_OPTIONS, Zustand, Preisart, DEFAULT_CARRIER } from '../models/listing';
import { t } from '../i18n';
import { todayString } from '../utils/formatting';
import { PortoState, renderCarrierPortoUI } from '../utils/portoUI';
import type KleinanzeigenPlugin from '../main';

type Mode = 'manual' | 'ai' | 'template';

export class NewItemModal extends Modal {
  private artikel = '';
  private zustand: Zustand = 'good';
  private preis = 0;
  private preisart: Preisart = 'negotiable';
  private portoState: PortoState = { carrier: DEFAULT_CARRIER, portoName: undefined, portoPrice: undefined };
  private beschreibung = '';
  private mode: Mode;
  private onSubmit: (listing: Listing) => void;
  private plugin: KleinanzeigenPlugin;

  // References to form elements for AI/template pre-fill
  private fieldsContainer!: HTMLElement;
  private artikelInput!: HTMLInputElement;
  private preisInput!: HTMLInputElement;
  private zustandSelect!: HTMLSelectElement;
  private preisartSelect!: HTMLSelectElement;
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
        new Notice('Bitte beschreibe den Artikel zuerst.');
        return;
      }

      aiBtn.textContent = t('modal.newItem.ai.loading');
      aiBtn.disabled = true;

      try {
        const aiService = this.plugin.createAIService();
        const parsed = await aiService.parseFreeformInput(text);

        this.artikel = parsed.artikel;
        this.artikelInput.value = parsed.artikel;

        const matchedZustand = ZUSTAND_OPTIONS.find(z => z === parsed.zustand);
        if (matchedZustand) {
          this.zustand = matchedZustand;
          this.zustandSelect.value = matchedZustand;
        }

        if (parsed.carrier) {
          this.portoState.carrier = parsed.carrier;
          this.portoState.portoName = parsed.porto_name;
          this.portoState.portoPrice = parsed.porto_price;
          this.portoRerender();
        }

        this.beschreibung = parsed.beschreibung;
        this.descTextArea.value = parsed.beschreibung;

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

      if (selected.artikel) { this.artikel = selected.artikel; this.artikelInput.value = selected.artikel; }
      if (selected.preis) { this.preis = selected.preis; this.preisInput.value = selected.preis.toString(); }
      if (selected.zustand) { this.zustand = selected.zustand; this.zustandSelect.value = selected.zustand; }
      if (selected.preisart) { this.preisart = selected.preisart; this.preisartSelect.value = selected.preisart; }
      if (selected.carrier) {
        this.portoState.carrier = selected.carrier;
        this.portoState.portoName = selected.porto_name;
        this.portoState.portoPrice = selected.porto_price;
        this.portoRerender();
      }
      if (selected.beschreibungsvorlage) {
        this.beschreibung = selected.beschreibungsvorlage;
        this.descTextArea.value = selected.beschreibungsvorlage;
      }

      new Notice(t('modal.newItem.template.applied', { name: selected.name }));
    });
  }

  private renderFields(container: HTMLElement) {
    new Setting(container)
      .setName(t('modal.newItem.field.name'))
      .addText(text => {
        text.setPlaceholder(t('modal.newItem.field.namePlaceholder'));
        text.setValue(this.artikel);
        text.onChange(v => this.artikel = v);
        text.inputEl.addClass('ka-artikel-input');
        this.artikelInput = text.inputEl;
      });

    new Setting(container)
      .setName(t('modal.newItem.field.price'))
      .addText(text => {
        text.setPlaceholder(t('modal.newItem.field.pricePlaceholder'));
        text.setValue(this.preis > 0 ? this.preis.toString() : '');
        text.onChange(v => this.preis = parseFloat(v) || 0);
        this.preisInput = text.inputEl;
      })
      .addDropdown(dd => {
        dd.addOption('negotiable', t('preisart.negotiable'));
        dd.addOption('fixed', t('preisart.fixed'));
        dd.setValue(this.preisart);
        dd.onChange(v => this.preisart = v as Preisart);
        this.preisartSelect = dd.selectEl;
      });

    new Setting(container)
      .setName(t('modal.newItem.field.condition'))
      .addDropdown(dd => {
        for (const z of ZUSTAND_OPTIONS) dd.addOption(z, t(`zustand.${z}`));
        dd.setValue(this.zustand);
        dd.onChange(v => this.zustand = v as Zustand);
        this.zustandSelect = dd.selectEl;
      });

    const { rerender } = renderCarrierPortoUI({ container, state: this.portoState });
    this.portoRerender = rerender;

    new Setting(container)
      .setName(t('modal.newItem.field.description'))
      .addTextArea(ta => {
        ta.setPlaceholder(t('modal.newItem.field.descPlaceholder'));
        ta.setValue(this.beschreibung);
        ta.onChange(v => this.beschreibung = v);
        ta.inputEl.rows = 4;
        ta.inputEl.addClass('ka-textarea');
        this.descTextArea = ta.inputEl;
      });

    new Setting(container)
      .addButton(btn => btn
        .setButtonText(t('modal.newItem.submit'))
        .setCta()
        .onClick(() => {
          if (!this.artikel.trim()) { new Notice(t('notice.validation.nameRequired')); return; }
          if (this.preis <= 0) { new Notice(t('notice.validation.priceRequired')); return; }

          const today = todayString();
          const listing: Listing = {
            artikel: this.artikel.trim(),
            beschreibung: this.beschreibung || undefined,
            zustand: this.zustand,
            status: 'active',
            preis: this.preis,
            preisart: this.preisart,
            carrier: this.portoState.carrier,
            porto_name: this.portoState.portoName,
            porto_price: this.portoState.portoPrice,
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
