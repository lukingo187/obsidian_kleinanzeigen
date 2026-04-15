import { App, FuzzySuggestModal, Modal, Notice, PluginSettingTab, Setting, TFolder, setIcon } from 'obsidian';
import { AIProvider, DEFAULT_MODELS, DEFAULT_USAGE, ZUSTAND_OPTIONS, Zustand, Preisart, ArticleTemplate, DESCRIPTION_STYLES, DescriptionStyle } from '../models/listing';
import { addUsageCard } from './dashboard-helpers';
import { renderCarrierPortoSettingsUI } from '../utils/portoUI';
import { AIService } from '../services/aiService';
import { TemplateService } from '../services/templateService';
import { ConfirmModal } from '../modals/confirmModal';
import { t, setLang, type Lang } from '../i18n';
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

class TemplateFormModal extends Modal {
  private tpl: ArticleTemplate;

  constructor(
    app: App,
    initialTpl: ArticleTemplate,
    private onSave: (tpl: ArticleTemplate) => Promise<void>,
  ) {
    super(app);
    this.tpl = { ...initialTpl };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('ka-modal');
    const isNew = this.tpl.id === '';

    contentEl.createEl('h2', {
      text: isNew ? t('settings.templates.createTitle') : t('settings.templates.editTitle'),
    });

    new Setting(contentEl)
      .setName(t('settings.templates.field.name'))
      .addText(text => {
        text.setPlaceholder('z.B. PS4 Spiel');
        text.setValue(this.tpl.name);
        text.onChange(v => { this.tpl.name = v; });
      });

    new Setting(contentEl)
      .setName(t('settings.templates.field.item'))
      .addText(text => {
        text.setPlaceholder(t('settings.templates.field.itemPlaceholder'));
        text.setValue(this.tpl.artikel ?? '');
        text.onChange(v => { this.tpl.artikel = v || undefined; });
      });

    new Setting(contentEl)
      .setName(t('settings.templates.field.price'))
      .addText(text => {
        text.setPlaceholder('0.00');
        text.setValue(this.tpl.preis?.toString() ?? '');
        text.onChange(v => {
          const val = parseFloat(v);
          this.tpl.preis = !isNaN(val) && val > 0 ? val : undefined;
        });
        text.inputEl.type = 'number';
      });

    new Setting(contentEl)
      .setName(t('settings.templates.field.condition'))
      .addDropdown(dd => {
        dd.addOption('', t('common.any'));
        for (const z of ZUSTAND_OPTIONS) {
          dd.addOption(z, t(`zustand.${z}` as any));
        }
        dd.setValue(this.tpl.zustand ?? '');
        dd.onChange(v => { this.tpl.zustand = v ? v as Zustand : undefined; });
      });

    new Setting(contentEl)
      .setName(t('settings.templates.field.preisart'))
      .addDropdown(dd => {
        dd.addOption('', t('common.any'));
        dd.addOption('negotiable', t('preisart.negotiable'));
        dd.addOption('fixed', t('preisart.fixed'));
        dd.setValue(this.tpl.preisart ?? '');
        dd.onChange(v => { this.tpl.preisart = v ? v as Preisart : undefined; });
      });

    const portoSetting = new Setting(contentEl).setName(t('settings.templates.field.shipping'));
    const portoContainer = portoSetting.controlEl.createDiv();
    renderCarrierPortoSettingsUI(
      portoContainer,
      { carrier: this.tpl.carrier ?? '', portoName: this.tpl.porto_name, portoPrice: this.tpl.porto_price },
      (state) => {
        this.tpl.carrier = state.carrier || undefined;
        this.tpl.porto_name = state.portoName;
        this.tpl.porto_price = state.portoPrice;
      },
      { allowEmpty: true },
    );

    new Setting(contentEl)
      .setName(t('settings.templates.field.description'))
      .addTextArea(ta => {
        ta.setPlaceholder(t('settings.templates.field.descPlaceholder'));
        ta.setValue(this.tpl.beschreibungsvorlage ?? '');
        ta.onChange(v => { this.tpl.beschreibungsvorlage = v || undefined; });
        ta.inputEl.rows = 4;
      });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(t('common.save'))
        .setCta()
        .onClick(async () => {
          if (!this.tpl.name.trim()) {
            new Notice(t('settings.templates.nameRequired'));
            return;
          }
          await this.onSave({ ...this.tpl, name: this.tpl.name.trim() });
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

export class SettingsTab extends PluginSettingTab {
  plugin: KleinanzeigenPlugin;

  constructor(app: App, plugin: KleinanzeigenPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('ka-settings');

    this.renderLanguageSection(containerEl);
    this.renderGeneralSection(containerEl);
    this.renderAISection(containerEl);
    this.renderDescriptionSection(containerEl);
    this.renderAIUsageSection(containerEl);
    this.renderTemplatesSection(containerEl);
    this.renderPlatformsSection(containerEl);
  }

  // ── Section header helper ────────────────────────────────

  private sectionHeader(container: HTMLElement, icon: string, title: string) {
    const header = container.createDiv({ cls: 'ka-settings-section-header' });
    const iconEl = header.createSpan({ cls: 'ka-section-icon' });
    setIcon(iconEl, icon);
    header.createSpan({ text: title });
  }

  // ── Language ──────────────────────────────────────────────

  private renderLanguageSection(containerEl: HTMLElement): void {
    const settings = this.plugin.settings;
    this.sectionHeader(containerEl, 'languages', t('settings.section.language'));

    new Setting(containerEl)
      .setName(t('settings.language.label'))
      .setDesc(t('settings.language.desc'))
      .addDropdown(dd => {
        dd.addOption('de', 'Deutsch');
        dd.addOption('en', 'English');
        dd.setValue(settings.language);
        dd.onChange(async (value) => {
          settings.language = value as Lang;
          setLang(value as Lang);
          await this.plugin.saveSettings();
          this.display();
          this.plugin.refreshDashboard();
        });
      });
  }

  // ── General ──────────────────────────────────────────────

  private renderGeneralSection(containerEl: HTMLElement): void {
    const settings = this.plugin.settings;
    this.sectionHeader(containerEl, 'settings', t('settings.section.general'));

    new Setting(containerEl)
      .setName(t('settings.general.folder'))
      .setDesc(t('settings.general.folderDesc'))
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
      .setName(t('settings.general.copyOverview'))
      .setDesc(t('settings.general.copyOverviewDesc'))
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
    this.sectionHeader(containerEl, 'bot', t('settings.section.ai'));

    const providerLabels: Record<AIProvider, string> = {
      google: 'Google (Gemini)',
      anthropic: 'Anthropic (Claude)',
      openai: 'OpenAI (GPT)',
    };

    new Setting(containerEl)
      .setName(t('settings.ai.provider'))
      .setDesc(t('settings.ai.providerDesc'))
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
      .setName(t('settings.ai.model'))
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

    const apiKeyLinks: Record<AIProvider, { url: string; text: string }> = {
      google: { url: 'https://aistudio.google.com/app/apikey', text: 'Google AI Studio' },
      anthropic: { url: 'https://console.anthropic.com/settings/keys', text: 'Anthropic Console' },
      openai: { url: 'https://platform.openai.com/api-keys', text: 'OpenAI Platform' },
    };
    const link = apiKeyLinks[settings.aiProvider];

    const apiKeySetting = new Setting(containerEl)
      .setName(t('settings.ai.key'))
      .setDesc(createFragment(f => {
        f.appendText('→ ');
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
      attr: { 'aria-label': t('settings.ai.keyToggle') },
    });
    setIcon(toggleVis, 'eye');
    toggleVis.addEventListener('click', () => {
      const isPassword = keyInput.type === 'password';
      keyInput.type = isPassword ? 'text' : 'password';
      toggleVis.empty();
      setIcon(toggleVis, isPassword ? 'eye-off' : 'eye');
    });

    // Warning + test on one row
    const keyMeta = containerEl.createDiv({ cls: 'ka-api-key-meta' });
    keyMeta.createDiv({ cls: 'ka-api-key-warning', text: t('settings.ai.keyWarning') });

    const testRow = keyMeta.createDiv({ cls: 'ka-api-test-row' });
    const testBtn = testRow.createEl('button', { text: t('settings.ai.test'), cls: 'ka-test-btn' });
    const testResult = testRow.createSpan({ cls: 'ka-test-result' });

    testBtn.addEventListener('click', async () => {
      const config = settings.aiProviders[settings.aiProvider];
      if (!config.apiKey) {
        testResult.setText(t('settings.ai.noKey'));
        testResult.className = 'ka-test-result ka-test-fail';
        return;
      }
      testBtn.textContent = t('settings.ai.testing');
      testBtn.disabled = true;
      testResult.setText('');
      try {
        const aiService = new AIService(settings);
        const result = await aiService.testApiKey(settings.aiProvider, config.apiKey, config.model);
        testResult.setText(result.ok ? t('settings.ai.testOk') : (result.error ?? t('settings.ai.testFail')));
        testResult.className = `ka-test-result ${result.ok ? 'ka-test-ok' : 'ka-test-fail'}`;
      } catch (e) {
        testResult.setText(e instanceof Error ? e.message : t('settings.ai.testFail'));
        testResult.className = 'ka-test-result ka-test-fail';
      } finally {
        testBtn.textContent = t('settings.ai.test');
        testBtn.disabled = false;
      }
    });
  }

  private getApiKeyPlaceholder(): string {
    const placeholders: Record<AIProvider, string> = {
      google: 'AIza...',
      anthropic: 'sk-ant-...',
      openai: 'sk-...',
    };
    return placeholders[this.plugin.settings.aiProvider];
  }

  // ── Description (style + footer combined) ────────────────

  private renderDescriptionSection(containerEl: HTMLElement): void {
    const settings = this.plugin.settings;
    this.sectionHeader(containerEl, 'text', t('settings.section.style'));

    new Setting(containerEl)
      .setName(t('settings.style.label'))
      .setDesc(t('settings.style.desc'))
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
        .setName(t('settings.style.custom'))
        .setDesc(t('settings.style.customDesc'))
        .addTextArea(ta => {
          ta.setPlaceholder(t('settings.style.customPlaceholder'));
          ta.setValue(settings.customStylePrompt);
          ta.onChange(async (value) => {
            settings.customStylePrompt = value;
            await this.plugin.saveSettings();
          });
          ta.inputEl.rows = 3;
        });
    }

    new Setting(containerEl)
      .setName(t('settings.footer.label'))
      .setDesc(t('settings.footer.desc'))
      .addTextArea(ta => {
        ta.setPlaceholder(t('settings.footer.placeholder'));
        ta.setValue(settings.descriptionFooter);
        ta.onChange(async (value) => {
          settings.descriptionFooter = value;
          await this.plugin.saveSettings();
        });
        ta.inputEl.rows = 3;
      });
  }

  // ── AI Usage ─────────────────────────────────────────────

  private renderAIUsageSection(containerEl: HTMLElement): void {
    const settings = this.plugin.settings;
    this.sectionHeader(containerEl, 'activity', t('settings.section.usage'));

    const googleUsage = settings.aiUsage.google;
    const anthropicUsage = settings.aiUsage.anthropic;
    const openaiUsage = settings.aiUsage.openai;
    const totalCost = googleUsage.totalCostUSD + anthropicUsage.totalCostUSD + openaiUsage.totalCostUSD;
    const totalCalls = googleUsage.callCount + anthropicUsage.callCount + openaiUsage.callCount;

    const grid = containerEl.createDiv({ cls: 'ka-usage-grid' });
    addUsageCard(grid, `$${totalCost.toFixed(4)}`, t('settings.usage.totalCost'));
    addUsageCard(grid, totalCalls.toString(), t('settings.usage.apiCalls'));

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
      const resetRow = containerEl.createDiv({ cls: 'ka-settings-btn-row' });
      const resetBtn = resetRow.createEl('button', {
        text: t('settings.usage.reset'),
        cls: 'ka-settings-btn-danger',
      });
      resetBtn.addEventListener('click', async () => {
        settings.aiUsage = {
          google: { ...DEFAULT_USAGE },
          anthropic: { ...DEFAULT_USAGE },
          openai: { ...DEFAULT_USAGE },
        };
        await this.plugin.saveSettings();
        this.display();
      });
    }
  }

  // ── Templates ────────────────────────────────────────────

  private renderTemplatesSection(containerEl: HTMLElement): void {
    const settings = this.plugin.settings;
    this.sectionHeader(containerEl, 'layout-template', t('settings.section.templates'));

    containerEl.createEl('p', {
      text: t('settings.templates.desc'),
      cls: 'ka-settings-section-desc',
    });

    for (const tpl of settings.templates) {
      const meta: string[] = [];
      if (tpl.artikel) meta.push(tpl.artikel);
      if (tpl.preis) meta.push(`${tpl.preis}€`);
      if (tpl.zustand) meta.push(t(`zustand.${tpl.zustand}` as any));
      if (tpl.carrier) meta.push(tpl.carrier);
      if (tpl.preisart) meta.push(t(`preisart.${tpl.preisart}` as any));

      new Setting(containerEl)
        .setName(tpl.name)
        .setDesc(meta.join(' · '))
        .addExtraButton(btn => {
          btn.setIcon('pencil');
          btn.setTooltip(t('common.edit'));
          btn.onClick(() => this.openTemplateModal(tpl));
        })
        .addExtraButton(btn => {
          btn.setIcon('trash-2');
          btn.setTooltip(t('common.delete'));
          btn.onClick(() => {
            new ConfirmModal(this.app, t('settings.templates.deleteConfirm', { name: tpl.name }), async () => {
              settings.templates = TemplateService.delete(settings.templates, tpl.id);
              await this.plugin.saveSettings();
              this.display();
            }).open();
          });
        });
    }

    const newRow = containerEl.createDiv({ cls: 'ka-settings-btn-row' });
    newRow.createEl('button', {
      text: t('settings.templates.new'),
      cls: 'ka-settings-btn',
    }).addEventListener('click', () => this.openTemplateModal({ id: '', name: '' }));
  }

  private openTemplateModal(initialTpl: ArticleTemplate) {
    const settings = this.plugin.settings;
    const isNew = initialTpl.id === '';

    new TemplateFormModal(this.app, initialTpl, async (saved) => {
      if (isNew) {
        settings.templates = TemplateService.create(settings.templates, {
          name: saved.name,
          artikel: saved.artikel,
          preis: saved.preis,
          zustand: saved.zustand,
          preisart: saved.preisart,
          carrier: saved.carrier,
          porto_name: saved.porto_name,
          porto_price: saved.porto_price,
          beschreibungsvorlage: saved.beschreibungsvorlage,
        });
      } else {
        settings.templates = TemplateService.update(settings.templates, saved);
      }
      await this.plugin.saveSettings();
      this.display();
    }).open();
  }

  // ── Platforms ─────────────────────────────────────────────

  private renderPlatformsSection(containerEl: HTMLElement): void {
    this.sectionHeader(containerEl, 'store', t('settings.section.platforms'));

    new Setting(containerEl)
      .setName(t('settings.platforms.ebay'))
      .setDesc(t('settings.platforms.ebayDesc'))
      .addToggle(toggle => toggle
        .setValue(false)
        .setDisabled(true));
  }
}
