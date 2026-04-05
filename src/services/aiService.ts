import { AIProvider, PluginSettings, ZUSTAND_OPTIONS, CARRIERS, CARRIER_OPTIONS, MODEL_PRICING, type DescriptionStyle } from '../models/listing';
import { formatCurrency } from '../utils/formatting';
import { getAdapter } from './providers/index';

export interface ParsedListing {
  artikel: string;
  zustand: string;
  carrier?: string;
  porto_name?: string;
  porto_price?: number;
  beschreibung: string;
}

export class AIService {
  private onUsage?: (provider: AIProvider, model: string, inputTokens: number, outputTokens: number) => void;

  constructor(
    private settings: PluginSettings,
    onUsage?: (provider: AIProvider, model: string, inputTokens: number, outputTokens: number) => void,
  ) {
    this.onUsage = onUsage;
  }

  async parseFreeformInput(userText: string): Promise<ParsedListing> {
    const provider = this.settings.aiProvider;
    const config = this.settings.aiProviders[provider];

    if (!config.apiKey) {
      throw new Error(`Kein API-Key für ${provider} hinterlegt. Bitte in den Einstellungen konfigurieren.`);
    }

    const prompt = this.buildParsePrompt(userText);
    const adapter = getAdapter(provider);
    const resp = await adapter.generate(config.apiKey, config.model, prompt);

    if (this.onUsage) {
      this.onUsage(provider, config.model, resp.inputTokens, resp.outputTokens);
    }

    return this.extractJSON(resp.text);
  }

  async testApiKey(provider: AIProvider, apiKey: string, model: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const adapter = getAdapter(provider);
      await adapter.generate(apiKey, model, 'Antworte nur mit "OK".');
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
      console.error('[Kleinanzeigen] API-Key Test fehlgeschlagen:', e);
      return { ok: false, error: msg };
    }
  }

  private buildParsePrompt(userText: string): string {
    const footer = this.settings.descriptionFooter;
    const footerInstruction = footer
      ? `Am Ende der Beschreibung IMMER diesen Text anfügen:\n"${footer}"`
      : 'Kein Standardtext am Ende.';

    const styleInstruction = this.getStyleInstruction();

    return `Du bist ein Assistent für eBay Kleinanzeigen Verkäufer. Der Nutzer beschreibt einen Artikel, den er verkaufen möchte. Extrahiere die Informationen und erstelle einen strukturierten Eintrag.

Nutzereingabe:
"${userText}"

Gültige Zustand-Werte: ${ZUSTAND_OPTIONS.join(', ')}
Versanddienstleister: ${CARRIERS.join(', ')}
Porto-Optionen pro Carrier:
${Object.entries(CARRIER_OPTIONS).map(([carrier, options]) =>
  `${carrier}: ${options.map(o => `${o.name} (${formatCurrency(o.price)})`).join(', ')}`
).join('\n')}

Antworte NUR mit einem JSON-Objekt (kein Markdown, kein Code-Block), mit diesen Feldern:
{
  "artikel": "Kurzer, prägnanter Artikelname/Titel",
  "zustand": "Einer der gültigen Zustand-Werte (am besten passend)",
  "carrier": "Versanddienstleister (DHL/Deutsche Post, Hermes, Abholung, Sonstiges) falls erwähnt, sonst null",
  "porto_name": "Name der Porto-Option (z.B. Großbrief, Päckchen S) falls erwähnt, sonst null",
  "porto_price": "Preis als Zahl (z.B. 1.80) falls erwähnt, sonst null",
  "beschreibung": "Verkaufsbeschreibung für Kleinanzeigen (${styleInstruction}, freundlich, professionell, Zustand erwähnen, kein Preis, keine Emojis)"
}

${footerInstruction}`;
  }

  private getStyleInstruction(): string {
    const styleMap: Record<Exclude<DescriptionStyle, 'custom'>, string> = {
      fliesstext: '3-5 Sätze als Fließtext',
      stichpunkte: 'als Stichpunkte/Aufzählung',
      kurz: 'sehr kurz, 1-2 Sätze',
      ausfuehrlich: 'ausführlich, 5-8 Sätze',
    };

    const style = this.settings.descriptionStyle;
    if (style === 'custom') {
      return this.settings.customStylePrompt.trim() || styleMap['fliesstext'];
    }
    return styleMap[style];
  }

  private extractJSON(raw: string): ParsedListing {
    let jsonStr = raw.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return {
        artikel: parsed.artikel ?? '',
        zustand: parsed.zustand ?? 'Gut',
        carrier: parsed.carrier,
        porto_name: parsed.porto_name,
        porto_price: parsed.porto_price != null ? Number(parsed.porto_price) : undefined,
        beschreibung: parsed.beschreibung ?? '',
      };
    } catch {
      throw new Error('KI-Antwort konnte nicht verarbeitet werden. Bitte erneut versuchen.');
    }
  }

  static calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) return 0;
    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  }
}
