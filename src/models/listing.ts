export type PriceType = 'negotiable' | 'fixed';

export type Condition = 'new_with_tag' | 'new' | 'like_new' | 'ok' | 'alright' | 'defect';

export type Status = 'active' | 'sold' | 'shipped' | 'completed' | 'expired' | 'archived';

export interface ShippingService {
  name: string;
  price: number;
}

export type CarrierName = 'DHL' | 'Hermes' | 'Pickup' | 'Other';

export const CARRIERS: CarrierName[] = ['DHL', 'Hermes', 'Pickup', 'Other'];

export const DEFAULT_CARRIER: CarrierName = CARRIERS[0];

export const CARRIER_SERVICES: Record<string, ShippingService[]> = {
  'DHL': [
    { name: 'Large Letter',  price: 1.80 },
    { name: 'Small Parcel',  price: 2.70 },
    { name: 'Maxi Letter',   price: 2.90 },
    { name: 'Package S',     price: 4.19 },
    { name: 'Package M',     price: 5.19 },
    { name: 'Parcel 2kg',    price: 6.19 },
    { name: 'Parcel 5kg',    price: 7.69 },
    { name: 'Parcel 10kg',  price: 10.49 },
  ],
  'Hermes': [
    { name: 'Parcel',   price: 5.19 },
    { name: 'S Parcel', price: 5.79 },
    { name: 'M Parcel', price: 6.99 },
    { name: 'L Parcel', price: 10.99 },
  ],
  'Pickup': [
    { name: 'Pickup', price: 0 },
  ],
};

export interface Listing {
  // Core
  title: string;
  description?: string;
  condition: Condition;
  status: Status;

  // Pricing
  price: number;
  price_type: PriceType;
  sold_for?: number;

  // Listing History
  listed_at: string;
  first_listed_at: string;
  listing_count: number;

  // Sale
  sold: boolean;
  sold_at?: string;

  // Payment
  paid: boolean;
  paid_at?: string;
  payment_method?: PaymentMethod;

  // Shipping
  carrier?: CarrierName;
  shipping_service?: string;
  shipping_cost?: number;
  shipping_address?: string;
  label_printed: boolean;
  tracking_number?: string;
  shipped: boolean;
  shipped_at?: string;

  // Meta
  filePath?: string;
}

export const CONDITIONS: Condition[] = [
  'new_with_tag', 'new', 'like_new', 'ok', 'alright', 'defect',
];

export const STATUS_OPTIONS: Status[] = [
  'active', 'sold', 'shipped', 'completed', 'expired', 'archived',
];

export type PaymentMethod = 'PayPal' | 'Bank Transfer' | 'Cash' | 'Other';

export const PAYMENT_METHODS: PaymentMethod[] = ['PayPal', 'Bank Transfer', 'Cash', 'Other'];

export function isCondition(v: unknown): v is Condition {
  return typeof v === 'string' && (CONDITIONS as readonly string[]).includes(v);
}

export function isPriceType(v: unknown): v is PriceType {
  return v === 'negotiable' || v === 'fixed';
}

export function isStatus(v: unknown): v is Status {
  return typeof v === 'string' && (STATUS_OPTIONS as readonly string[]).includes(v);
}

export function isCarrierName(v: unknown): v is CarrierName {
  return typeof v === 'string' && (CARRIERS as readonly string[]).includes(v);
}

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === 'string' && (PAYMENT_METHODS as readonly string[]).includes(v);
}


export function clearTransactionFields(listing: Listing): Listing {
  return {
    ...listing,
    sold: false, sold_at: undefined, sold_for: undefined,
    paid: false, paid_at: undefined, payment_method: undefined,
    shipped: false, shipped_at: undefined, shipping_address: undefined,
    tracking_number: undefined, label_printed: false,
  };
}

// Precondition: targetStatus must be the logical predecessor of listing.status
// (e.g. shipped→sold, sold→active). Caller is responsible for correct pairing.
export function buildUndoListing(listing: Listing, targetStatus: Status): Listing {
  const base: Listing = { ...listing, status: targetStatus };
  if (listing.status === 'sold') {
    return clearTransactionFields(base);
  }
  if (listing.status === 'shipped') {
    return { ...base, shipped: false, shipped_at: undefined, shipping_address: undefined,
      tracking_number: undefined, label_printed: false };
  }
  return base;
}


// ── Templates ──

export interface ListingTemplate {
  id: string;
  name: string;
  title?: string;
  price?: number;
  condition?: Condition;
  price_type?: PriceType;
  carrier?: CarrierName;
  shipping_service?: string;
  shipping_cost?: number;
  description_template?: string;
}

// ── Settings ──

export type AIProvider = 'anthropic' | 'openai' | 'google';

export type DescriptionStyle = 'flowing' | 'bullets' | 'short' | 'detailed' | 'custom';

export const AI_PROVIDERS: AIProvider[] = ['anthropic', 'openai', 'google'];

export function isAIProvider(v: unknown): v is AIProvider {
  return typeof v === 'string' && (AI_PROVIDERS as readonly string[]).includes(v);
}

export const DESCRIPTION_STYLES: { id: DescriptionStyle; label: string }[] = [
  { id: 'flowing',   label: 'Fließtext (Standard)' },
  { id: 'bullets',   label: 'Stichpunkte' },
  { id: 'short',     label: 'Kurz & knapp' },
  { id: 'detailed',  label: 'Ausführlich' },
  { id: 'custom',    label: 'Benutzerdefiniert' },
];

export function isDescriptionStyle(v: unknown): v is DescriptionStyle {
  return typeof v === 'string' && DESCRIPTION_STYLES.some(s => s.id === v);
}

// Maps legacy German DescriptionStyle values to current English values.
export function migrateDescriptionStyle(v: unknown): DescriptionStyle {
  if (isDescriptionStyle(v)) return v;
  const map: Record<string, DescriptionStyle> = {
    'fliesstext':  'flowing',
    'stichpunkte': 'bullets',
    'kurz':        'short',
    'ausfuehrlich':'detailed',
  };
  return (typeof v === 'string' && map[v]) ? map[v] : 'flowing';
}

export interface AIProviderConfig {
  apiKey: string;
  model: string;
}

export const DEFAULT_MODELS: Record<AIProvider, { id: string; label: string }[]> = {
  google: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (schnell & kostenlos)' },
    { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
  ],
  anthropic: [
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (schnell & günstig)' },
    { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
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
  language: 'de' | 'en';
  aiProvider: AIProvider;
  aiProviders: Record<AIProvider, AIProviderConfig>;
  aiUsage: Record<AIProvider, AIUsageRecord>;
  descriptionStyle: DescriptionStyle;
  customStylePrompt: string;
  descriptionFooter: string;
  ebayEnabled: boolean;
  templates: ListingTemplate[];
  showCopyOverview: boolean;
}

// Pricing per 1M tokens in USD
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 0.80, output: 4.00 },
  'claude-sonnet-4-5': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-opus-4-6': { input: 15.00, output: 75.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4.1': { input: 2.00, output: 8.00 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'gpt-4.1-nano': { input: 0.10, output: 0.40 },
  'o3-mini': { input: 1.10, output: 4.40 },
  'gemini-2.0-flash': { input: 0, output: 0 },
  'gemini-2.0-flash-lite': { input: 0, output: 0 },
};

export const DEFAULT_DESCRIPTION_FOOTER = 'Dies ist ein Privatverkauf. Keine Garantie, keine Rücknahme.';

export const DEFAULT_USAGE: AIUsageRecord = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCostUSD: 0,
  callCount: 0,
};

export const DEFAULT_SETTINGS: PluginSettings = {
  baseFolder: 'kleinanzeigen',
  language: 'de',
  aiProvider: 'google',
  aiProviders: {
    google: { apiKey: '', model: 'gemini-2.0-flash' },
    anthropic: { apiKey: '', model: 'claude-haiku-4-5' },
    openai: { apiKey: '', model: 'gpt-4o-mini' },
  },
  aiUsage: {
    google: { ...DEFAULT_USAGE },
    anthropic: { ...DEFAULT_USAGE },
    openai: { ...DEFAULT_USAGE },
  },
  descriptionStyle: 'flowing',
  customStylePrompt: '',
  descriptionFooter: DEFAULT_DESCRIPTION_FOOTER,
  ebayEnabled: false,
  templates: [],
  showCopyOverview: true,
};
