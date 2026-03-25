import { requestUrl } from 'obsidian';
import { AIProvider, PluginSettings, ZUSTAND_OPTIONS, PORTO_OPTIONS, MODEL_PRICING } from '../models/listing';

export interface ParsedListing {
  artikel: string;
  zustand: string;
  porto?: string;
  beschreibung: string;
}

interface APIResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
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
    const resp = await this.callProvider(provider, config.apiKey, config.model, prompt);

    if (this.onUsage) {
      this.onUsage(provider, config.model, resp.inputTokens, resp.outputTokens);
    }

    return this.extractJSON(resp.text);
  }

  async testApiKey(provider: AIProvider, apiKey: string, model: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.callProvider(provider, apiKey, model, 'Antworte nur mit "OK".');
      return { ok: true };
    } catch (e: any) {
      const msg = e?.message ?? 'Unbekannter Fehler';
      console.error('[Kleinanzeigen] API-Key Test fehlgeschlagen:', e);
      return { ok: false, error: msg };
    }
  }

  private buildParsePrompt(userText: string): string {
    const footer = this.settings.descriptionFooter;
    const footerInstruction = footer
      ? `Am Ende der Beschreibung IMMER diesen Text anfügen:\n"${footer}"`
      : 'Kein Standardtext am Ende.';

    return `Du bist ein Assistent für eBay Kleinanzeigen Verkäufer. Der Nutzer beschreibt einen Artikel, den er verkaufen möchte. Extrahiere die Informationen und erstelle einen strukturierten Eintrag.

Nutzereingabe:
"${userText}"

Gültige Zustand-Werte: ${ZUSTAND_OPTIONS.join(', ')}
Gültige Porto-Optionen: ${PORTO_OPTIONS.join(', ')}

Antworte NUR mit einem JSON-Objekt (kein Markdown, kein Code-Block), mit diesen Feldern:
{
  "artikel": "Kurzer, prägnanter Artikelname/Titel",
  "zustand": "Einer der gültigen Zustand-Werte (am besten passend)",
  "porto": "Eine der gültigen Porto-Optionen falls erwähnt, sonst null",
  "beschreibung": "Verkaufsbeschreibung für Kleinanzeigen (3-5 Sätze, freundlich, professionell, Zustand erwähnen, kein Preis, keine Emojis)"
}

${footerInstruction}`;
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
        porto: parsed.porto ?? undefined,
        beschreibung: parsed.beschreibung ?? '',
      };
    } catch {
      throw new Error('KI-Antwort konnte nicht verarbeitet werden. Bitte erneut versuchen.');
    }
  }

  private async callProvider(provider: AIProvider, apiKey: string, model: string, prompt: string): Promise<APIResponse> {
    switch (provider) {
      case 'anthropic':
        return this.callAnthropic(apiKey, model, prompt);
      case 'openai':
        return this.callOpenAI(apiKey, model, prompt);
    }
  }

  private async callAnthropic(apiKey: string, model: string, prompt: string): Promise<APIResponse> {
    const response = await requestUrl({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
      throw: false,
    });

    if (response.status !== 200) {
      const errMsg = response.json?.error?.message ?? `Status ${response.status}`;
      throw new Error(`Anthropic API: ${errMsg}`);
    }

    return {
      text: response.json.content[0].text,
      inputTokens: response.json.usage?.input_tokens ?? 0,
      outputTokens: response.json.usage?.output_tokens ?? 0,
    };
  }

  private async callOpenAI(apiKey: string, model: string, prompt: string): Promise<APIResponse> {
    const response = await requestUrl({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
      throw: false,
    });

    if (response.status !== 200) {
      const errMsg = response.json?.error?.message ?? `Status ${response.status}`;
      throw new Error(`OpenAI API: ${errMsg}`);
    }

    return {
      text: response.json.choices[0].message.content,
      inputTokens: response.json.usage?.prompt_tokens ?? 0,
      outputTokens: response.json.usage?.completion_tokens ?? 0,
    };
  }

  static calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) return 0;
    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  }
}
