import { requestUrl } from 'obsidian';
import { MAX_OUTPUT_TOKENS, type AIProviderAdapter, type APIResponse } from './index';

export class OpenAIAdapter implements AIProviderAdapter {
  async generate(apiKey: string, model: string, prompt: string): Promise<APIResponse> {
    const response = await requestUrl({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
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
      throw new Error(`OpenAI API: ${errMsg}`);
    }

    return {
      text: response.json.choices[0].message.content,
      inputTokens: response.json.usage?.prompt_tokens ?? 0,
      outputTokens: response.json.usage?.completion_tokens ?? 0,
    };
  }
}
