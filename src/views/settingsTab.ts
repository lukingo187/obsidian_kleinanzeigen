import { App, FuzzySuggestModal, Notice, PluginSettingTab, Setting, TFolder, setIcon } from 'obsidian';
import { AIProvider, DEFAULT_MODELS, DEFAULT_USAGE, ZUSTAND_OPTIONS, Zustand, Preisart, ArticleTemplate, DESCRIPTION_STYLES, DescriptionStyle } from '../models/listing';
import { addUsageCard } from './dashboard-helpers';
import { renderCarrierPortoSettingsUI } from '../utils/portoUI';
import { AIService } from '../services/aiService';
import { TemplateService } from '../services/templateService';
import { ConfirmModal } from '../modals/confirmModal';
import type KleinanzeigenPlugin from '../main';

class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
  private folders: TFolder[];
  private onChooseCallback: (folder: TFolder) => void;

  constructor(app: App, onChoose: (folder: TFolder) => void) {
    super(app);
    this.onChooseCallback = onChoose;
    this.folders = this.getAllFolders();
    this.setPlaceholder('Ordner suchen…');
  }

  private getAllFolders(): TFolder[] {
    const folders: TFolder[] = [];
    const collect = (folder: TFolder) => {
      folders.push(folder);
      for (const child of folder.children) {
        if (child instanceof TFolder) collect(child);
      }
    };
    collect(this.app.vault.getRoot());
    return folders;
  }

  getItems(): TFolder[] { return this.folders; }
  getItemText(folder: TFolder): string { return folder.path === '/' ? '/ (Vault-Root)' : folder.path; }
  onChooseItem(folder: TFolder): void { this.onChooseCallback(folder); }
}

export class SettingsTab extends PluginSettingTab {
  plugin: KleinanzeigenPlugin;
  private editingTemplate: ArticleTemplate | null = null;

  constructor(app: App, plugin: KleinanzeigenPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.renderGeneralSection(containerEl);
    this.renderAISection(containerEl);
    this.renderDescriptionStyleSection(containerEl);
    this.renderAIUsageSection(containerEl);
    this.renderDescriptionFooterSection(containerEl);
    this.renderTemplatesSection(containerEl);
    this.renderPlatformsSection(containerEl);
  }

  // ── General ──────────────────────────────────────────────

  private renderGeneralSection(containerEl: HTMLElement): void {
    const settings = this.plugin.settings;

    containerEl.createEl('h3', { text: 'Allgemein' });

    new Setting(containerEl)
      .setName('Ordner')
      .setDesc('Ordner im Vault, in dem Artikel gespeichert werden.')
      .addButton(btn => btn
        .setButtonText(settings.baseFolder)
        .onClick(() => {
          new FolderSuggestModal(this.app, (folder) => {
            const path = folder.path === '/' ? 'kleinanzeigen' : folder.path;
            settings.baseFolder = path;
            this.plugin.saveSettings();
            this.display();
          }).open();
        }));

    new Setting(containerEl)
      .setName('Übersicht nach Einstellen')
      .setDesc('Nach dem Erstellen eines Artikels Kopier-Buttons für Titel und Beschreibung anzeigen.')
      .addToggle(toggle => toggle
        .setValue(settings.showCopyOverview)
        .onChange(async (value) => {
          settings.showCopyOverview = value;
          await this.plugin.saveSettings();
        }));
  }

  // ── AI Configuration ─────────────────────────────────────

  private renderAISection(containerEl: HTMLElement): void {
    const settings = this.plugin.settings;

    containerEl.createEl('h3', { text: 'KI-Konfiguration' });

    const providerLabels: Record<AIProvider, string> = {
      google: 'Google (Gemini)',
      anthropic: 'Anthropic (Claude)',
      openai: 'OpenAI (GPT)',
    };

    new Setting(containerEl)
      .setName('Anbieter')
      .setDesc('Google Gemini bietet einen kostenlosen API-Zugang.')
      .addDropdown(dd => {
        for (const [value, label] of Object.entries(providerLabels)) {
          dd.addOption(value, label);
        }
        dd.setValue(settings.aiProvider);
        dd.onChange(async (value) => {
          settings.aiProvider = value as AIProvider;
          await this.plugin.saveSettings();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName('Modell')
      .addDropdown(dd => {
        for (const model of DEFAULT_MODELS[settings.aiProvider]) {
          dd.addOption(model.id, model.label);
        }
        dd.setValue(settings.aiProviders[settings.aiProvider].model);
        dd.onChange(async (value) => {
          settings.aiProviders[settings.aiProvider].model = value;
          await this.plugin.saveSettings();
        });
      });

    // API Key help link
    const apiKeyLinks: Record<AIProvider, { url: string; text: string }> = {
      google: { url: 'https://aistudio.google.com/app/apikey', text: 'Kostenlosen API-Key bei Google AI Studio erstellen' },
      anthropic: { url: 'https://console.anthropic.com/settings/keys', text: 'API-Key in der Anthropic Console erstellen' },
      openai: { url: 'https://platform.openai.com/api-keys', text: 'API-Key bei OpenAI erstellen' },
    };
    const link = apiKeyLinks[settings.aiProvider];

    // API Key with visibility toggle
    const apiKeySetting = new Setting(containerEl)
      .setName('API-Key')
      .setDesc(createFragment(f => {
        const a = f.createEl('a', { text: link.text, href: link.url });
        a.setAttr('target', '_blank');
      }));

    const keyInput = apiKeySetting.controlEl.createEl('input', {
      type: 'password',
      cls: 'ka-setting-input',
      placeholder: this.getApiKeyPlaceholder(),
    });
    keyInput.value = settings.aiProviders[settings.aiProvider].apiKey;
    keyInput.addEventListener('change', async () => {
      settings.aiProviders[settings.aiProvider].apiKey = keyInput.value.trim();
      await this.plugin.saveSettings();
    });

    const toggleVis = apiKeySetting.controlEl.createEl('button', {
      cls: 'ka-key-toggle',
      attr: { 'aria-label': 'API-Key anzeigen' },
    });
    setIcon(toggleVis, 'eye');
    toggleVis.addEventListener('click', () => {
      const isPassword = keyInput.type === 'password';
      keyInput.type = isPassword ? 'text' : 'password';
      toggleVis.empty();
      setIcon(toggleVis, isPassword ? 'eye-off' : 'eye');
    });

    // API Key sync warning
    const warningEl = containerEl.createDiv({ cls: 'setting-item-description ka-api-key-warning' });
    warningEl.createSpan({ text: '⚠ API-Keys werden in der Plugin-Konfigurationsdatei im Vault gespeichert. Bei Vault-Synchronisation (iCloud, Dropbox, Git) werden Keys mitübertragen.' });

    // Test button
    const testSetting = new Setting(containerEl);
    let testResult: HTMLSpanElement;
    testSetting.addButton(btn => {
      btn.setButtonText('API-Key prüfen');
      btn.onClick(async () => {
        const config = settings.aiProviders[settings.aiProvider];
        if (!config.apiKey) {
          testResult.setText('Kein API-Key eingegeben.');
          testResult.className = 'ka-test-result ka-test-fail';
          return;
        }
        btn.setButtonText('Teste...');
        btn.setDisabled(true);
        testResult.setText('');
        try {
          const aiService = new AIService(settings);
          const result = await aiService.testApiKey(settings.aiProvider, config.apiKey, config.model);
          testResult.setText(result.ok ? 'Verbindung erfolgreich!' : (result.error ?? 'Verbindung fehlgeschlagen.'));
          testResult.className = `ka-test-result ${result.ok ? 'ka-test-ok' : 'ka-test-fail'}`;
        } catch (e) {
          testResult.setText(e instanceof Error ? e.message : 'Verbindung fehlgeschlagen.');
          testResult.className = 'ka-test-result ka-test-fail';
        } finally {
          btn.setButtonText('API-Key prüfen');
          btn.setDisabled(false);
        }
      });
    });
    testResult = testSetting.controlEl.createSpan({ cls: 'ka-test-result' });
  }

  private getApiKeyPlaceholder(): string {
    const placeholders: Record<AIProvider, string> = {
      google: 'AIza...',
      anthropic: 'sk-ant-...',
      openai: 'sk-...',
    };
    return placeholders[this.plugin.settings.aiProvider];
  }

  // ── Description Style ────────────────────────────────────

  private renderDescriptionStyleSection(containerEl: HTMLElement): void {
    const settings = this.plugin.settings;

    containerEl.createEl('h3', { text: 'Beschreibungsstil' });

    new Setting(containerEl)
      .setName('Stil')
      .setDesc('Stil der KI-generierten Artikelbeschreibung.')
      .addDropdown(dd => {
        for (const style of DESCRIPTION_STYLES) {
          dd.addOption(style.id, style.label);
        }
        dd.setValue(settings.descriptionStyle);
        dd.onChange(async (value) => {
          settings.descriptionStyle = value as DescriptionStyle;
          await this.plugin.saveSettings();
          this.display();
        });
      });

    if (settings.descriptionStyle === 'custom') {
      new Setting(containerEl)
        .setName('Eigener Stil')
        .setDesc('Beschreibe den gewünschten Stil, z.B. "lockerer Ton, mit Humor, maximal 3 Sätze"')
        .addTextArea(ta => {
          ta.setPlaceholder('Beschreibe deinen gewünschten Beschreibungsstil...');
          ta.setValue(settings.customStylePrompt);
          ta.onChange(async (value) => {
            settings.customStylePrompt = value;
            await this.plugin.saveSettings();
          });
          ta.inputEl.rows = 3;
        });
    }
  }

  // ── AI Usage ─────────────────────────────────────────────

  private renderAIUsageSection(containerEl: HTMLElement): void {
    const settings = this.plugin.settings;

    containerEl.createEl('h3', { text: 'API-Nutzung' });

    const googleUsage = settings.aiUsage.google;
    const anthropicUsage = settings.aiUsage.anthropic;
    const openaiUsage = settings.aiUsage.openai;
    const totalCost = googleUsage.totalCostUSD + anthropicUsage.totalCostUSD + openaiUsage.totalCostUSD;
    const totalCalls = googleUsage.callCount + anthropicUsage.callCount + openaiUsage.callCount;

    const grid = containerEl.createDiv({ cls: 'ka-usage-grid' });
    addUsageCard(grid, `$${totalCost.toFixed(4)}`, 'Gesamtkosten');
    addUsageCard(grid, totalCalls.toString(), 'API-Aufrufe');

    if (googleUsage.callCount > 0) {
      addUsageCard(grid, `$${googleUsage.totalCostUSD.toFixed(4)}`, `Google (${googleUsage.callCount})`);
    }
    if (anthropicUsage.callCount > 0) {
      addUsageCard(grid, `$${anthropicUsage.totalCostUSD.toFixed(4)}`, `Anthropic (${anthropicUsage.callCount})`);
    }
    if (openaiUsage.callCount > 0) {
      addUsageCard(grid, `$${openaiUsage.totalCostUSD.toFixed(4)}`, `OpenAI (${openaiUsage.callCount})`);
    }

    if (totalCalls > 0) {
      new Setting(containerEl)
        .addButton(btn => btn
          .setButtonText('Nutzung zurücksetzen')
          .onClick(async () => {
            settings.aiUsage = {
              google: { ...DEFAULT_USAGE },
              anthropic: { ...DEFAULT_USAGE },
              openai: { ...DEFAULT_USAGE },
            };
            await this.plugin.saveSettings();
            this.display();
          }));
    }
  }

  // ── Description Footer ───────────────────────────────────

  private renderDescriptionFooterSection(containerEl: HTMLElement): void {
    const settings = this.plugin.settings;

    containerEl.createEl('h3', { text: 'Beschreibungsvorlage' });

    new Setting(containerEl)
      .setName('Standardtext')
      .setDesc('Wird automatisch an jede KI-generierte Beschreibung angehängt.')
      .addTextArea(ta => {
        ta.setPlaceholder('z.B. Dies ist ein Privatverkauf. Keine Garantie, keine Rücknahme.');
        ta.setValue(settings.descriptionFooter);
        ta.onChange(async (value) => {
          settings.descriptionFooter = value;
          await this.plugin.saveSettings();
        });
        ta.inputEl.rows = 3;
      });
  }

  // ── Templates ────────────────────────────────────────────

  private renderTemplatesSection(containerEl: HTMLElement): void {
    const settings = this.plugin.settings;

    containerEl.createEl('h3', { text: 'Artikel-Templates' });
    containerEl.createEl('p', {
      text: 'Templates erleichtern das Anlegen ähnlicher Artikel (z.B. immer gleicher Zustand, Porto, Beschreibungsvorlage).',
      cls: 'setting-item-description',
    });

    // Template list
    for (const tpl of settings.templates) {
      const meta: string[] = [];
      if (tpl.artikel) meta.push(tpl.artikel);
      if (tpl.preis) meta.push(`${tpl.preis}€`);
      if (tpl.zustand) meta.push(tpl.zustand);
      if (tpl.carrier) meta.push(tpl.carrier);
      if (tpl.preisart) meta.push(tpl.preisart);

      new Setting(containerEl)
        .setName(tpl.name)
        .setDesc(meta.join(' · '))
        .addExtraButton(btn => {
          btn.setIcon('pencil');
          btn.setTooltip('Bearbeiten');
          btn.onClick(() => {
            this.editingTemplate = { ...tpl };
            this.display();
          });
        })
        .addExtraButton(btn => {
          btn.setIcon('trash-2');
          btn.setTooltip('Löschen');
          btn.onClick(() => {
            new ConfirmModal(this.app, `Template "${tpl.name}" löschen?`, async () => {
              settings.templates = TemplateService.delete(settings.templates, tpl.id);
              await this.plugin.saveSettings();
              this.display();
            }).open();
          });
        });
    }

    // Template form (editing or creating)
    if (this.editingTemplate !== null) {
      this.renderTemplateForm(containerEl);
    } else {
      new Setting(containerEl)
        .addButton(btn => btn
          .setButtonText('+ Neues Template')
          .onClick(() => {
            this.editingTemplate = { id: '', name: '' };
            this.display();
          }));
    }
  }

  private renderTemplateForm(containerEl: HTMLElement): void {
    const settings = this.plugin.settings;
    const tpl = this.editingTemplate!;
    const isNew = tpl.id === '';

    const formContainer = containerEl.createDiv({ cls: 'ka-template-form' });
    formContainer.createEl('h4', { text: isNew ? 'Neues Template' : 'Template bearbeiten' });

    new Setting(formContainer)
      .setName('Template-Name *')
      .addText(text => {
        text.setPlaceholder('z.B. PS4 Spiel');
        text.setValue(tpl.name);
        text.onChange(value => { tpl.name = value; });
      });

    new Setting(formContainer)
      .setName('Artikelname')
      .addText(text => {
        text.setPlaceholder('Vordefinierter Artikelname');
        text.setValue(tpl.artikel ?? '');
        text.onChange(value => { tpl.artikel = value || undefined; });
      });

    new Setting(formContainer)
      .setName('Preis (€)')
      .addText(text => {
        text.setPlaceholder('0.00');
        text.setValue(tpl.preis?.toString() ?? '');
        text.onChange(value => {
          const val = parseFloat(value);
          tpl.preis = !isNaN(val) && val > 0 ? val : undefined;
        });
        text.inputEl.type = 'number';
      });

    new Setting(formContainer)
      .setName('Zustand')
      .addDropdown(dd => {
        dd.addOption('', '— beliebig —');
        for (const z of ZUSTAND_OPTIONS) {
          dd.addOption(z, z);
        }
        dd.setValue(tpl.zustand ?? '');
        dd.onChange(value => { tpl.zustand = value ? value as Zustand : undefined; });
      });

    new Setting(formContainer)
      .setName('Preisart')
      .addDropdown(dd => {
        dd.addOption('', '— beliebig —');
        dd.addOption('VB', 'VB');
        dd.addOption('Festpreis', 'Festpreis');
        dd.setValue(tpl.preisart ?? '');
        dd.onChange(value => { tpl.preisart = value ? value as Preisart : undefined; });
      });

    // Carrier/Porto
    const portoSetting = new Setting(formContainer).setName('Versand');
    const portoContainer = portoSetting.controlEl.createDiv();
    renderCarrierPortoSettingsUI(
      portoContainer,
      { carrier: tpl.carrier ?? '', portoName: tpl.porto_name, portoPrice: tpl.porto_price },
      (state) => {
        tpl.carrier = state.carrier || undefined;
        tpl.porto_name = state.portoName;
        tpl.porto_price = state.portoPrice;
      },
      { allowEmpty: true },
    );

    new Setting(formContainer)
      .setName('Beschreibungsvorlage')
      .addTextArea(ta => {
        ta.setPlaceholder('Optionaler Vorlagentext für die Beschreibung...');
        ta.setValue(tpl.beschreibungsvorlage ?? '');
        ta.onChange(value => { tpl.beschreibungsvorlage = value || undefined; });
        ta.inputEl.rows = 3;
      });

    // Save / Cancel
    new Setting(formContainer)
      .addButton(btn => btn
        .setButtonText('Speichern')
        .setCta()
        .onClick(async () => {
          if (!tpl.name.trim()) {
            new Notice('Bitte einen Namen für das Template eingeben.');
            return;
          }
          if (isNew) {
            settings.templates = TemplateService.create(settings.templates, {
              name: tpl.name.trim(),
              artikel: tpl.artikel,
              preis: tpl.preis,
              zustand: tpl.zustand,
              preisart: tpl.preisart,
              carrier: tpl.carrier,
              porto_name: tpl.porto_name,
              porto_price: tpl.porto_price,
              beschreibungsvorlage: tpl.beschreibungsvorlage,
            });
          } else {
            settings.templates = TemplateService.update(settings.templates, { ...tpl, name: tpl.name.trim() });
          }
          await this.plugin.saveSettings();
          this.editingTemplate = null;
          this.display();
        }))
      .addButton(btn => btn
        .setButtonText('Abbrechen')
        .onClick(() => {
          this.editingTemplate = null;
          this.display();
        }));
  }

  // ── Platforms ─────────────────────────────────────────────

  private renderPlatformsSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Plattformen' });

    new Setting(containerEl)
      .setName('eBay aktivieren')
      .setDesc('Kommt in einem zukünftigen Update.')
      .addToggle(toggle => toggle
        .setValue(false)
        .setDisabled(true));
  }
}
