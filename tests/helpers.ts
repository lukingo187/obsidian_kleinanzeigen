import { Listing } from '../src/models/listing';

export function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    artikel: 'Test Artikel',
    zustand: 'Gut',
    status: 'Aktiv',
    preis: 10,
    preisart: 'VB',
    eingestellt_am: '2026-03-01',
    erstmals_eingestellt_am: '2026-03-01',
    eingestellt_count: 1,
    verkauft: false,
    bezahlt: false,
    label_erstellt: false,
    verschickt: false,
    ...overrides,
  };
}
