import { requestUrl } from 'obsidian';
import { MAX_OUTPUT_TOKENS, type AIProviderAdapter, type APIResponse } from './index';

export class AnthropicAdapter implements AIProviderAdapter {
  async generate(apiKey: string, model: string, prompt: string): Promise<APIResponse> {
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
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
      throw: false,
    });

    if (response.status !== 200) {
      const errMsg = response.json?.error?.message ?? `Status ${response.status}`;
      throw new Error(`Anthropic API: ${errMsg}`);
    }

    const text = response.json?.content?.[0]?.text;
    if (typeof text !== 'string') {
      throw new Error(`Anthropic API: unexpected response shape (content blocked or empty)`);
    }

    return {
      text,
      inputTokens: response.json.usage?.input_tokens ?? 0,
      outputTokens: response.json.usage?.output_tokens ?? 0,
    };
  }
}
