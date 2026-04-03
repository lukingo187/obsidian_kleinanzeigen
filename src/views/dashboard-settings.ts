import { App, FuzzySuggestModal, Notice, TFolder, setIcon } from 'obsidian';
import { AIProvider, DEFAULT_MODELS, ZUSTAND_OPTIONS, Zustand, Preisart } from '../models/listing';
import { renderCarrierPortoSettingsUI } from '../utils/portoUI';
import { AIService } from '../services/aiService';
import { TemplateService } from '../services/templateService';
import { ConfirmModal } from '../modals/confirmModal';
import type KleinanzeigenPlugin from '../main';
import type { SettingsState, DashboardActions } from './dashboard-types';
import { addSettingRow, addUsageCard } from './dashboard-helpers';

function renderTemplatesSettings(wrap: HTMLElement, app: App, plugin: KleinanzeigenPlugin, state: SettingsState, actions: DashboardActions) {
  const settings = plugin.settings;
  const section = wrap.createDiv({ cls: 'ka-settings-section' });
  section.createEl('h3', { text: 'Artikel-Templates' });
  section.createDiv({ cls: 'ka-settings-section-desc', text: 'Templates erleichtern das Anlegen ähnlicher Artikel (z.B. immer gleicher Zustand, Porto, Beschreibungsvorlage).' });

  if (settings.templates.length > 0) {
    const list = section.createDiv({ cls: 'ka-template-list' });
    for (const tpl of settings.templates) {
      const row = list.createDiv({ cls: 'ka-template-row' });
      const info = row.createDiv({ cls: 'ka-template-info' });
      info.createSpan({ text: tpl.name, cls: 'ka-template-name' });
      const meta: string[] = [];
      if (tpl.artikel) meta.push(tpl.artikel);
      if (tpl.preis) meta.push(`${tpl.preis}€`);
      if (tpl.zustand) meta.push(tpl.zustand);
      if (tpl.carrier) meta.push(tpl.carrier);
      if (tpl.preisart) meta.push(tpl.preisart);
      if (meta.length > 0) {
        info.createSpan({ text: meta.join(' · '), cls: 'ka-template-meta' });
      }

      const btns = row.createDiv({ cls: 'ka-template-btns' });
      const editBtn = btns.createEl('button', { cls: 'ka-section-edit-btn', attr: { 'aria-label': 'Bearbeiten' } });
      setIcon(editBtn, 'pencil');
      editBtn.addEventListener('click', () => {
        state.editingTemplate = { ...tpl };
        actions.render();
      });
      const delBtn = btns.createEl('button', { cls: 'ka-section-edit-btn', attr: { 'aria-label': 'Löschen' } });
      setIcon(delBtn, 'trash-2');
      delBtn.addEventListener('click', () => {
        new ConfirmModal(app, `Template "${tpl.name}" löschen?`, () => {
          settings.templates = TemplateService.delete(settings.templates, tpl.id);
          plugin.saveSettings();
          actions.render();
        }).open();
      });
    }
  }

  if (state.editingTemplate !== null) {
    renderTemplateForm(section, plugin, state, actions);
  } else {
    const addBtn = section.createEl('button', { text: '+ Neues Template', cls: 'ka-test-btn' });
    addBtn.addEventListener('click', () => {
      state.editingTemplate = { id: '', name: '' };
      actions.render();
    });
  }
}

function renderTemplateForm(container: HTMLElement, plugin: KleinanzeigenPlugin, state: SettingsState, actions: DashboardActions) {
  const settings = plugin.settings;
  const tpl = state.editingTemplate!;
  const isNew = tpl.id === '';

  const form = container.createDiv({ cls: 'ka-template-form' });
  form.createEl('h4', { text: isNew ? 'Neues Template' : 'Template bearbeiten' });

  addSettingRow(form, 'Template-Name *', el => {
    const input = el.createEl('input', { type: 'text', cls: 'ka-setting-input', placeholder: 'z.B. PS4 Spiel' });
    input.value = tpl.name;
    input.addEventListener('input', () => { tpl.name = input.value; });
  });

  addSettingRow(form, 'Artikelname', el => {
    const input = el.createEl('input', { type: 'text', cls: 'ka-setting-input', placeholder: 'Vordefinierter Artikelname' });
    input.value = tpl.artikel ?? '';
    input.addEventListener('input', () => { tpl.artikel = input.value || undefined; });
  });

  addSettingRow(form, 'Preis (€)', el => {
    const input = el.createEl('input', { type: 'number', cls: 'ka-setting-input', placeholder: '0.00' });
    input.value = tpl.preis?.toString() ?? '';
    input.addEventListener('input', () => {
      const val = parseFloat(input.value);
      tpl.preis = !isNaN(val) && val > 0 ? val : undefined;
    });
  });

  addSettingRow(form, 'Zustand', el => {
    const select = el.createEl('select', { cls: 'dropdown' });
    select.createEl('option', { value: '', text: '— beliebig —' });
    for (const z of ZUSTAND_OPTIONS) {
      const opt = select.createEl('option', { value: z, text: z });
      if (tpl.zustand === z) opt.selected = true;
    }
    select.addEventListener('change', () => {
      tpl.zustand = select.value ? select.value as Zustand : undefined;
    });
  });

  addSettingRow(form, 'Preisart', el => {
    const select = el.createEl('select', { cls: 'dropdown' });
    select.createEl('option', { value: '', text: '— beliebig —' });
    for (const p of ['VB', 'Festpreis'] as Preisart[]) {
      const opt = select.createEl('option', { value: p, text: p });
      if (tpl.preisart === p) opt.selected = true;
    }
    select.addEventListener('change', () => {
      tpl.preisart = select.value ? select.value as Preisart : undefined;
    });
  });

  addSettingRow(form, 'Versand', el => {
    renderCarrierPortoSettingsUI(
      el,
      { carrier: tpl.carrier ?? '', portoName: tpl.porto_name, portoPrice: tpl.porto_price },
      (state) => {
        tpl.carrier = state.carrier || undefined;
        tpl.porto_name = state.portoName;
        tpl.porto_price = state.portoPrice;
      },
      { allowEmpty: true },
    );
  });

  const descRow = form.createDiv({ cls: 'ka-setting-item ka-setting-item-vertical' });
  descRow.createEl('label', { text: 'Beschreibungsvorlage' });
  const descArea = descRow.createEl('textarea', { cls: 'ka-setting-textarea', placeholder: 'Optionaler Vorlagentext für die Beschreibung...' });
  descArea.rows = 3;
  descArea.value = tpl.beschreibungsvorlage ?? '';
  descArea.addEventListener('input', () => { tpl.beschreibungsvorlage = descArea.value || undefined; });

  const btnRow = form.createDiv({ cls: 'ka-template-form-btns' });
  const saveBtn = btnRow.createEl('button', { text: 'Speichern', cls: 'ka-new-btn' });
  saveBtn.addEventListener('click', () => {
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
    plugin.saveSettings();
    state.editingTemplate = null;
    actions.render();
  });

  const cancelBtn = btnRow.createEl('button', { text: 'Abbrechen', cls: 'ka-filter-btn' });
  cancelBtn.addEventListener('click', () => {
    state.editingTemplate = null;
    actions.render();
  });
}

function renderAISettings(wrap: HTMLElement, plugin: KleinanzeigenPlugin, actions: DashboardActions) {
  const settings = plugin.settings;
  const section = wrap.createDiv({ cls: 'ka-settings-section' });
  section.createEl('h3', { text: 'KI-Konfiguration' });
  section.createDiv({ cls: 'ka-settings-section-desc', text: 'Wähle einen KI-Anbieter und hinterlege deinen API-Key für automatische Beschreibungen.' });

  addSettingRow(section, 'Anbieter', el => {
    const select = el.createEl('select', { cls: 'dropdown' });
    const providers: [AIProvider, string][] = [
      ['anthropic', 'Anthropic (Claude)'],
      ['openai', 'OpenAI (GPT)'],
    ];
    for (const [value, label] of providers) {
      const opt = select.createEl('option', { text: label, value });
      if (settings.aiProvider === value) opt.selected = true;
    }
    select.addEventListener('change', () => {
      settings.aiProvider = select.value as AIProvider;
      plugin.saveSettings();
      actions.render();
    });
  });

  addSettingRow(section, 'Modell', el => {
    const select = el.createEl('select', { cls: 'dropdown' });
    for (const model of DEFAULT_MODELS[settings.aiProvider]) {
      const opt = select.createEl('option', { text: model.label, value: model.id });
      if (settings.aiProviders[settings.aiProvider].model === model.id) opt.selected = true;
    }
    select.addEventListener('change', () => {
      settings.aiProviders[settings.aiProvider].model = select.value;
      plugin.saveSettings();
    });
  });

  addSettingRow(section, 'API-Key', el => {
    const keyInput = el.createEl('input', {
      type: 'password',
      cls: 'ka-setting-input',
      placeholder: settings.aiProvider === 'anthropic' ? 'sk-ant-...' : 'sk-...',
    });
    keyInput.value = settings.aiProviders[settings.aiProvider].apiKey;
    keyInput.addEventListener('change', () => {
      settings.aiProviders[settings.aiProvider].apiKey = keyInput.value.trim();
      plugin.saveSettings();
    });

    const toggleVis = el.createEl('button', { cls: 'ka-key-toggle', attr: { 'aria-label': 'API-Key anzeigen' } });
    setIcon(toggleVis, 'eye');
    toggleVis.addEventListener('click', () => {
      const isPassword = keyInput.type === 'password';
      keyInput.type = isPassword ? 'text' : 'password';
      toggleVis.empty();
      setIcon(toggleVis, isPassword ? 'eye-off' : 'eye');
    });
  });

  addSettingRow(section, '', el => {
    const testBtn = el.createEl('button', { text: 'API-Key prüfen', cls: 'ka-test-btn' });
    const testResult = el.createSpan({ cls: 'ka-test-result' });

    testBtn.addEventListener('click', async () => {
      const config = settings.aiProviders[settings.aiProvider];
      if (!config.apiKey) {
        testResult.setText('Kein API-Key eingegeben.');
        testResult.className = 'ka-test-result ka-test-fail';
        return;
      }

      testBtn.textContent = 'Teste...';
      testBtn.disabled = true;
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
        testBtn.textContent = 'API-Key prüfen';
        testBtn.disabled = false;
      }
    });
  });
}

function renderAIUsage(wrap: HTMLElement, plugin: KleinanzeigenPlugin, actions: DashboardActions) {
  const settings = plugin.settings;
  const section = wrap.createDiv({ cls: 'ka-settings-section' });
  section.createEl('h3', { text: 'API-Nutzung' });
  section.createDiv({ cls: 'ka-settings-section-desc', text: 'Übersicht über deine bisherige API-Nutzung und anfallende Kosten.' });

  const anthropicUsage = settings.aiUsage.anthropic;
  const openaiUsage = settings.aiUsage.openai;
  const totalCost = anthropicUsage.totalCostUSD + openaiUsage.totalCostUSD;
  const totalCalls = anthropicUsage.callCount + openaiUsage.callCount;

  const grid = section.createDiv({ cls: 'ka-usage-grid' });

  addUsageCard(grid, `$${totalCost.toFixed(4)}`, 'Gesamtkosten');
  addUsageCard(grid, totalCalls.toString(), 'API-Aufrufe');

  if (anthropicUsage.callCount > 0) {
    addUsageCard(grid, `$${anthropicUsage.totalCostUSD.toFixed(4)}`, `Anthropic (${anthropicUsage.callCount})`);
  }
  if (openaiUsage.callCount > 0) {
    addUsageCard(grid, `$${openaiUsage.totalCostUSD.toFixed(4)}`, `OpenAI (${openaiUsage.callCount})`);
  }

  if (totalCalls > 0) {
    const resetBtn = section.createEl('button', { text: 'Nutzung zurücksetzen', cls: 'ka-test-btn ka-reset-btn' });
    resetBtn.addEventListener('click', () => {
      settings.aiUsage = {
        anthropic: { totalInputTokens: 0, totalOutputTokens: 0, totalCostUSD: 0, callCount: 0 },
        openai: { totalInputTokens: 0, totalOutputTokens: 0, totalCostUSD: 0, callCount: 0 },
      };
      plugin.saveSettings();
      actions.render();
    });
  }
}

function renderDescriptionFooter(wrap: HTMLElement, plugin: KleinanzeigenPlugin) {
  const settings = plugin.settings;
  const section = wrap.createDiv({ cls: 'ka-settings-section' });
  section.createEl('h3', { text: 'Beschreibungsvorlage' });
  section.createDiv({ cls: 'ka-settings-section-desc', text: 'Dieser Text wird automatisch an jede KI-generierte Beschreibung angehängt.' });

  const group = section.createDiv({ cls: 'ka-setting-item ka-setting-item-vertical' });
  group.createEl('label', { text: 'Standardtext am Ende jeder Beschreibung' });

  const textarea = group.createEl('textarea', {
    cls: 'ka-setting-textarea',
    placeholder: 'z.B. Dies ist ein Privatverkauf. Keine Garantie, keine Rücknahme.',
  });
  textarea.rows = 3;
  textarea.value = settings.descriptionFooter;
  textarea.addEventListener('change', () => {
    settings.descriptionFooter = textarea.value;
    plugin.saveSettings();
  });
}

class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
  private folders: TFolder[];
  private onChoose: (folder: TFolder) => void;

  constructor(app: App, onChoose: (folder: TFolder) => void) {
    super(app);
    this.onChoose = onChoose;
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

  onChooseItem(folder: TFolder): void {
    this.onChoose(folder);
  }
}

function renderGeneralSettings(wrap: HTMLElement, app: App, plugin: KleinanzeigenPlugin, actions: DashboardActions) {
  const settings = plugin.settings;
  const section = wrap.createDiv({ cls: 'ka-settings-section' });
  section.createEl('h3', { text: 'Allgemein' });
  section.createDiv({ cls: 'ka-settings-section-desc', text: 'Grundlegende Einstellungen für das Plugin.' });

  addSettingRow(section, 'Ordner', el => {
    const display = el.createSpan({ text: settings.baseFolder, cls: 'ka-folder-display' });

    const browseBtn = el.createEl('button', { text: 'Ändern', cls: 'ka-test-btn' });
    browseBtn.addEventListener('click', () => {
      new FolderSuggestModal(app, (folder) => {
        const path = folder.path === '/' ? 'kleinanzeigen' : folder.path;
        settings.baseFolder = path;
        plugin.saveSettings();
        display.setText(path);
        actions.refresh();
      }).open();
    });

    el.createDiv({ cls: 'ka-setting-hint', text: 'Ordner im Vault, in dem Artikel gespeichert werden.' });
  });

  addSettingRow(section, 'Übersicht nach Einstellen', el => {
    const toggleBtn = el.createEl('button', {
      cls: `ka-toggle-switch${settings.showCopyOverview ? ' is-enabled' : ''}`,
      attr: { role: 'switch', 'aria-checked': String(settings.showCopyOverview) },
    });
    toggleBtn.addEventListener('click', () => {
      settings.showCopyOverview = !settings.showCopyOverview;
      toggleBtn.classList.toggle('is-enabled', settings.showCopyOverview);
      toggleBtn.setAttribute('aria-checked', String(settings.showCopyOverview));
      plugin.saveSettings();
    });
    el.createDiv({ cls: 'ka-setting-hint', text: 'Nach dem Erstellen eines Artikels Kopier-Buttons für Titel und Beschreibung anzeigen.' });
  });
}

function renderPlatformSettings(wrap: HTMLElement) {
  const section = wrap.createDiv({ cls: 'ka-settings-section' });
  section.createEl('h3', { text: 'Plattformen' });
  section.createDiv({ cls: 'ka-settings-section-desc', text: 'Zusätzliche Verkaufsplattformen neben Kleinanzeigen.' });

  const group = section.createDiv({ cls: 'ka-setting-item ka-setting-toggle' });
  group.createEl('label', { text: 'eBay aktivieren' });

  const toggleBtn = group.createEl('button', { cls: 'ka-toggle-switch', attr: { role: 'switch', 'aria-checked': 'false' } });
  toggleBtn.disabled = true;

  section.createDiv({ cls: 'ka-setting-hint', text: 'Kommt in einem zukünftigen Update.' });
}

export function renderSettingsView(root: HTMLElement, app: App, plugin: KleinanzeigenPlugin, state: SettingsState, actions: DashboardActions) {
  const wrap = root.createDiv({ cls: 'ka-settings' });

  renderGeneralSettings(wrap, app, plugin, actions);
  renderAISettings(wrap, plugin, actions);
  renderAIUsage(wrap, plugin, actions);
  renderDescriptionFooter(wrap, plugin);
  renderTemplatesSettings(wrap, app, plugin, state, actions);
  renderPlatformSettings(wrap);
}
