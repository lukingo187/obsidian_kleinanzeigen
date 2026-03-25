import { App, Modal, Notice, Setting } from 'obsidian';
import { Listing, ZUSTAND_OPTIONS, Zustand, Preisart, PORTO_OPTIONS, PortoOption, ArticleTemplate } from '../models/listing';
import { todayString } from '../utils/formatting';
import type KleinanzeigenPlugin from '../main';

export class NewItemModal extends Modal {
  private artikel = '';
  private zustand: Zustand = 'Gut';
  private preis = 0;
  private preisart: Preisart = 'VB';
  private porto: PortoOption | undefined;
  private beschreibung = '';
  private onSubmit: (listing: Listing) => void;
  private plugin: KleinanzeigenPlugin;

  // References to form elements for AI pre-fill
  private artikelInput!: HTMLInputElement;
  private zustandSelect!: HTMLSelectElement;
  private portoSelect!: HTMLSelectElement;
  private descTextArea!: HTMLTextAreaElement;
  private fieldsContainer!: HTMLElement;

  constructor(app: App, plugin: KleinanzeigenPlugin, onSubmit: (listing: Listing) => void) {
    super(app);
    this.plugin = plugin;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('ka-modal');

    contentEl.createEl('h2', { text: 'Neuer Artikel' });

    // Template section (shown only if templates exist)
    const templates = this.plugin.settings.templates;
    if (templates.length > 0) {
      this.renderTemplateSection(contentEl, templates);
      contentEl.createEl('hr', { cls: 'ka-divider' });
    }

    // AI freeform section
    this.renderAISection(contentEl);

    // Divider
    contentEl.createEl('hr', { cls: 'ka-divider' });

    // Structured fields
    this.fieldsContainer = contentEl.createDiv();
    this.renderFields(this.fieldsContainer);
  }

  private renderTemplateSection(container: HTMLElement, templates: ArticleTemplate[]) {
    const section = container.createDiv({ cls: 'ka-template-section' });
    section.createEl('p', { text: 'Template verwenden:', cls: 'ka-ai-hint' });

    const row = section.createDiv({ cls: 'ka-template-select-row' });
    const select = row.createEl('select', { cls: 'ka-setting-select' });
    select.createEl('option', { value: '', text: '— kein Template —' });
    for (const tpl of templates) {
      select.createEl('option', { value: tpl.id, text: tpl.name });
    }

    const applyBtn = row.createEl('button', { text: 'Übernehmen', cls: 'ka-ai-fill-btn' });
    applyBtn.addEventListener('click', () => {
      const selected = templates.find(t => t.id === select.value);
      if (!selected) return;

      if (selected.zustand) {
        this.zustand = selected.zustand;
        this.zustandSelect.value = selected.zustand;
      }
      if (selected.preisart) {
        this.preisart = selected.preisart;
      }
      if (selected.porto) {
        this.porto = selected.porto;
        this.portoSelect.value = selected.porto;
      }
      if (selected.beschreibungsvorlage) {
        this.beschreibung = selected.beschreibungsvorlage;
        this.descTextArea.value = selected.beschreibungsvorlage;
      }

      new Notice(`Template "${selected.name}" übernommen.`);
    });
  }

  private hasApiKey(): boolean {
    const s = this.plugin.settings;
    const config = s.aiProviders[s.aiProvider];
    return config?.apiKey?.length > 0;
  }

  private renderAISection(container: HTMLElement) {
    const section = container.createDiv({ cls: 'ka-ai-section' });
    section.createEl('p', {
      text: 'Beschreibe den Artikel in deinen eigenen Worten — die KI füllt die Felder automatisch aus.',
      cls: 'ka-ai-hint',
    });

    if (!this.hasApiKey()) {
      const noKeyHint = section.createDiv({ cls: 'ka-ai-no-key' });
      noKeyHint.setText('Kein API-Key konfiguriert. Bitte unter Einstellungen → KI-Konfiguration hinterlegen.');
      return;
    }

    const freeformArea = section.createEl('textarea', {
      cls: 'ka-textarea ka-freeform-input',
      placeholder: 'z.B. "PS4 Spiel Spider-Man, kaum gespielt, kleiner Kratzer auf der Hülle, Großbrief reicht"',
    });
    freeformArea.rows = 3;

    const btnRow = section.createDiv({ cls: 'ka-ai-btn-row' });
    const aiBtn = btnRow.createEl('button', {
      text: 'KI ausfüllen',
      cls: 'ka-ai-fill-btn',
    });

    aiBtn.addEventListener('click', async () => {
      const text = freeformArea.value.trim();
      if (!text) {
        new Notice('Bitte beschreibe den Artikel zuerst.');
        return;
      }

      aiBtn.textContent = 'Wird analysiert...';
      aiBtn.disabled = true;

      try {
        const aiService = this.plugin.createAIService();
        const parsed = await aiService.parseFreeformInput(text);

        // Pre-fill fields
        this.artikel = parsed.artikel;
        this.artikelInput.value = parsed.artikel;

        // Match zustand
        const matchedZustand = ZUSTAND_OPTIONS.find(z => z === parsed.zustand);
        if (matchedZustand) {
          this.zustand = matchedZustand;
          this.zustandSelect.value = matchedZustand;
        }

        // Match porto
        if (parsed.porto) {
          const matchedPorto = PORTO_OPTIONS.find(p => p === parsed.porto);
          if (matchedPorto) {
            this.porto = matchedPorto;
            this.portoSelect.value = matchedPorto;
          }
        }

        // Fill description
        this.beschreibung = parsed.beschreibung;
        this.descTextArea.value = parsed.beschreibung;

        new Notice('Felder wurden ausgefüllt. Bitte prüfen und ergänzen.');
      } catch (e: any) {
        new Notice(e.message ?? 'Fehler bei der KI-Analyse.');
      } finally {
        aiBtn.textContent = 'KI ausfüllen';
        aiBtn.disabled = false;
      }
    });
  }

  private renderFields(container: HTMLElement) {
    const artikelSetting = new Setting(container)
      .setName('Artikel *')
      .addText(text => {
        text.setPlaceholder('z.B. MacBook Pro 2020');
        text.onChange(v => this.artikel = v);
        this.artikelInput = text.inputEl;
      });

    new Setting(container)
      .setName('Zustand')
      .addDropdown(dd => {
        for (const z of ZUSTAND_OPTIONS) {
          dd.addOption(z, z);
        }
        dd.setValue(this.zustand);
        dd.onChange(v => this.zustand = v as Zustand);
        this.zustandSelect = dd.selectEl;
      });

    new Setting(container)
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

    new Setting(container)
      .setName('Versand')
      .addDropdown(dd => {
        dd.addOption('', '— kein Versand —');
        for (const p of PORTO_OPTIONS) {
          dd.addOption(p, p);
        }
        dd.onChange(v => this.porto = v ? v as PortoOption : undefined);
        this.portoSelect = dd.selectEl;
      });

    new Setting(container)
      .setName('Beschreibung')
      .addTextArea(ta => {
        ta.setPlaceholder('Artikelbeschreibung...');
        ta.onChange(v => this.beschreibung = v);
        ta.inputEl.rows = 4;
        ta.inputEl.addClass('ka-textarea');
        this.descTextArea = ta.inputEl;
      });

    new Setting(container)
      .addButton(btn => btn
        .setButtonText('Einstellen')
        .setCta()
        .onClick(() => {
          if (!this.artikel.trim()) {
            new Notice('Bitte einen Artikelnamen eingeben.');
            return;
          }
          if (this.preis <= 0) {
            new Notice('Bitte einen gültigen Preis eingeben.');
            return;
          }

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
