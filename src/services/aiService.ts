import { AIProvider, PluginSettings, CONDITIONS, CARRIERS, CARRIER_SERVICES, MODEL_PRICING, type DescriptionStyle, type Condition, type CarrierName, isCondition, isCarrierName } from '../models/listing';
import { formatCurrency } from '../utils/formatting';
import { getAdapter } from './providers/index';
import { t } from '../i18n';

export interface ParsedListing {
  title: string;
  condition: Condition;
  carrier?: CarrierName;
  shippingService?: string;
  shippingCost?: number;
  description: string;
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
      throw new Error(t('notice.ai.noKey', { provider }));
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

Gültige Zustand-Werte: ${CONDITIONS.join(', ')}
Versanddienstleister: ${CARRIERS.join(', ')}
Porto-Optionen pro Carrier:
${Object.entries(CARRIER_SERVICES).map(([carrier, options]) =>
  `${carrier}: ${options.map(o => `${o.name} (${formatCurrency(o.price)})`).join(', ')}`
).join('\n')}

Antworte NUR mit einem JSON-Objekt (kein Markdown, kein Code-Block), mit diesen Feldern:
{
  "title": "Kurzer, prägnanter Artikelname/Titel",
  "condition": "Einer der gültigen Zustand-Werte (am besten passend)",
  "carrier": "Versanddienstleister (DHL, Hermes, Pickup, Other) falls erwähnt, sonst null",
  "shippingService": "Name der Porto-Option (z.B. Large Letter, Small Parcel) falls erwähnt, sonst null",
  "shippingCost": "Preis als Zahl (z.B. 1.80) falls erwähnt, sonst null",
  "description": "Verkaufsbeschreibung für Kleinanzeigen (${styleInstruction}, freundlich, professionell, Zustand erwähnen, kein Preis, keine Emojis)"
}

${footerInstruction}`;
  }

  private getStyleInstruction(): string {
    const styleMap: Record<Exclude<DescriptionStyle, 'custom'>, string> = {
      flowing:    '3-5 Sätze als Fließtext',
      bullets:    'als Stichpunkte/Aufzählung',
      short:      'sehr kurz, 1-2 Sätze',
      detailed:   'ausführlich, 5-8 Sätze',
    };

    const style = this.settings.descriptionStyle;
    if (style === 'custom') {
      return this.settings.customStylePrompt.trim() || styleMap['flowing'];
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
        title:           parsed.title ?? '',
        condition:       isCondition(parsed.condition) ? parsed.condition : 'ok',
        carrier:         isCarrierName(parsed.carrier) ? parsed.carrier : undefined,
        shippingService: parsed.shippingService,
        shippingCost:    parsed.shippingCost != null ? Number(parsed.shippingCost) : undefined,
        description:     parsed.description ?? '',
      };
    } catch (e) {
      console.error('AI response JSON parse failed:', e);
      throw new Error(t('notice.ai.error'));
    }
  }

  static calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) return 0;
    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  }
}
