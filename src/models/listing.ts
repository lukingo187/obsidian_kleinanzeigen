export type Preisart = 'VB' | 'Festpreis';

export type Zustand = 'Neu mit Etikett' | 'Neu' | 'Sehr Gut' | 'Gut' | 'In Ordnung' | 'Defekt';

export type Status = 'Aktiv' | 'Verkauft' | 'Verschickt' | 'Abgeschlossen' | 'Abgelaufen' | 'Archiviert';

export interface PortoEntry {
  name: string;
  price: number;
}

export type CarrierName = 'DHL/Deutsche Post' | 'Hermes' | 'Abholung' | 'Sonstiges';

export const CARRIERS: CarrierName[] = ['DHL/Deutsche Post', 'Hermes', 'Abholung', 'Sonstiges'];

export const DEFAULT_CARRIER: CarrierName = CARRIERS[0];

export const CARRIER_OPTIONS: Record<string, PortoEntry[]> = {
  'DHL/Deutsche Post': [
    { name: 'Großbrief',    price: 1.80 },
    { name: 'Warensendung', price: 2.70 },
    { name: 'Maxibrief',    price: 2.90 },
    { name: 'Päckchen S',   price: 4.19 },
    { name: 'Päckchen M',   price: 5.19 },
    { name: 'Paket 2kg',    price: 6.19 },
    { name: 'Paket 5kg',    price: 7.69 },
    { name: 'Paket 10kg',  price: 10.49 },
  ],
  'Hermes': [
    { name: 'Päckchen', price: 5.19 },
    { name: 'S-Paket',  price: 5.79 },
    { name: 'M-Paket',  price: 6.99 },
    { name: 'L-Paket',  price: 10.99 },
  ],
  'Abholung': [
    { name: 'Abholung', price: 0 },
  ],
};

export interface Listing {
  // Core
  artikel: string;
  beschreibung?: string;
  zustand: Zustand;
  status: Status;

  // Pricing
  preis: number;
  preisart: Preisart;
  verkauft_fuer?: number;

  // Listing History
  eingestellt_am: string;
  erstmals_eingestellt_am: string;
  eingestellt_count: number;

  // Sale
  verkauft: boolean;
  verkauft_am?: string;

  // Payment
  bezahlt: boolean;
  bezahlt_am?: string;
  bezahlart?: string;

  // Shipping
  carrier?: string;
  porto_name?: string;
  porto_price?: number;
  anschrift?: string;
  label_erstellt: boolean;
  sendungsnummer?: string;
  verschickt: boolean;
  verschickt_am?: string;

  // Meta
  filePath?: string;
}

export const ZUSTAND_OPTIONS: Zustand[] = [
  'Neu mit Etikett', 'Neu', 'Sehr Gut', 'Gut', 'In Ordnung', 'Defekt'
];

export const STATUS_OPTIONS: Status[] = [
  'Aktiv', 'Verkauft', 'Verschickt', 'Abgeschlossen', 'Abgelaufen', 'Archiviert'
];


// ── Templates ──

export interface ArticleTemplate {
  id: string;
  name: string;
  artikel?: string;
  preis?: number;
  zustand?: Zustand;
  preisart?: Preisart;
  carrier?: string;
  porto_name?: string;
  porto_price?: number;
  beschreibungsvorlage?: string;
}

// ── Settings ──

export type AIProvider = 'anthropic' | 'openai';

export interface AIProviderConfig {
  apiKey: string;
  model: string;
}

export const DEFAULT_MODELS: Record<AIProvider, { id: string; label: string }[]> = {
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (schnell & günstig)' },
    { id: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5' },
    { id: 'claude-sonnet-4-6-20250514', label: 'Claude Sonnet 4.6' },
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6 (bestes Modell)' },
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini (schnell & günstig)' },
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (günstigstes)' },
    { id: 'o3-mini', label: 'o3-mini (Reasoning)' },
  ],
};

export interface AIUsageRecord {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUSD: number;
  callCount: number;
}

export interface PluginSettings {
  baseFolder: string;
  aiProvider: AIProvider;
  aiProviders: Record<AIProvider, AIProviderConfig>;
  aiUsage: Record<AIProvider, AIUsageRecord>;
  descriptionFooter: string;
  ebayEnabled: boolean;
  templates: ArticleTemplate[];
  showCopyOverview: boolean;
}

// Pricing per 1M tokens in USD
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'claude-sonnet-4-5-20250514': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-6-20250514': { input: 3.00, output: 15.00 },
  'claude-opus-4-6': { input: 15.00, output: 75.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4.1': { input: 2.00, output: 8.00 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'gpt-4.1-nano': { input: 0.10, output: 0.40 },
  'o3-mini': { input: 1.10, output: 4.40 },
};

export const DEFAULT_DESCRIPTION_FOOTER = 'Dies ist ein Privatverkauf. Keine Garantie, keine Rücknahme.';

const DEFAULT_USAGE: AIUsageRecord = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCostUSD: 0,
  callCount: 0,
};

export const DEFAULT_SETTINGS: PluginSettings = {
  baseFolder: 'kleinanzeigen',
  aiProvider: 'anthropic',
  aiProviders: {
    anthropic: { apiKey: '', model: 'claude-haiku-4-5-20251001' },
    openai: { apiKey: '', model: 'gpt-4o-mini' },
  },
  aiUsage: {
    anthropic: { ...DEFAULT_USAGE },
    openai: { ...DEFAULT_USAGE },
  },
  descriptionFooter: DEFAULT_DESCRIPTION_FOOTER,
  ebayEnabled: false,
  templates: [],
  showCopyOverview: true,
};
