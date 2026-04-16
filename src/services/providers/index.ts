import type { AIProvider } from '../../models/listing';
import { AnthropicAdapter } from './anthropic';
import { OpenAIAdapter } from './openai';
import { GoogleAdapter } from './google';

export const MAX_OUTPUT_TOKENS = 500;

export interface APIResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export class APIError extends Error {
  constructor(public readonly provider: string, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

export interface AIProviderAdapter {
  generate(apiKey: string, model: string, prompt: string): Promise<APIResponse>;
}

const adapters: Record<AIProvider, AIProviderAdapter> = {
  anthropic: new AnthropicAdapter(),
  openai: new OpenAIAdapter(),
  google: new GoogleAdapter(),
};

export function getAdapter(provider: AIProvider): AIProviderAdapter {
  return adapters[provider];
}
