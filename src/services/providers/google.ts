import { requestUrl } from 'obsidian';
import { MAX_OUTPUT_TOKENS, type AIProviderAdapter, type APIResponse } from './index';

export class GoogleAdapter implements AIProviderAdapter {
  async generate(apiKey: string, model: string, prompt: string): Promise<APIResponse> {
    const response = await requestUrl({
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
      throw: false,
    });

    if (response.status !== 200) {
      const errMsg = response.json?.error?.message ?? `Status ${response.status}`;
      throw new Error(`Google Gemini API: ${errMsg}`);
    }

    const text = response.json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
      throw new Error(`Google Gemini API: unexpected response shape (content blocked or empty)`);
    }

    return {
      text,
      inputTokens: response.json.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.json.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}
