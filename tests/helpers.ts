import { Listing } from '../src/models/listing';

export function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    title: 'Test Item',
    condition: 'ok',
    status: 'active',
    price: 10,
    price_type: 'negotiable',
    listed_at: '2026-03-01',
    first_listed_at: '2026-03-01',
    listing_count: 1,
    sold: false,
    paid: false,
    label_printed: false,
    shipped: false,
    ...overrides,
  };
}
