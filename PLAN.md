# Implementation Plan

This document tracks all ideas, phases, architecture decisions, and progress for the Obsidian Kleinanzeigen plugin.

---

## Data Model

### Listing Interface

```typescript
interface Listing {
  // Core Info
  artikel: string;
  zustand: 'Neu mit Etikett' | 'Neu' | 'Sehr Gut' | 'Gut' | 'In Ordnung' | 'Defekt';
  status: 'Aktiv' | 'Verkauft' | 'Verschickt' | 'Abgeschlossen' | 'Abgelaufen';

  // Pricing
  preis: string;         // z.B. "15€ VB" oder "25€ Festpreis"
  verkauft_fuer?: string;

  // Listing History
  eingestellt_am: string;          // aktuelles Einstelldatum
  erstmals_eingestellt_am: string; // unveränderliches Erstdatum
  eingestellt_count: number;       // wie oft eingestellt (startet bei 1)

  // Sale
  verkauft: boolean;
  verkauft_am?: string;

  // Payment
  bezahlt: boolean;
  bezahlt_am?: string;
  bezahlart?: string;

  // Shipping
  porto: PortoOption;
  anschrift?: string;   // "Name\nStraße\nPLZ Ort"
  label_erstellt: boolean;
  sendungsnummer?: string;
  verschickt: boolean;
  verschickt_am?: string;
}
```

### Porto Options

| Beschreibung | Preis   |
|-------------|---------|
| Großbrief   | 1,80€   |
| Warensendung| 2,70€   |
| Maxibrief   | 2,90€   |
| Päckchen S  | 4,19€   |
| Päckchen M  | 5,19€   |
| Paket 2kg   | 6,19€   |
| Paket 5kg   | 7,69€   |
| Paket 10kg  | 10,49€  |
| Abholung    | 0,00€   |

---

## Architecture

```
src/
├── main.ts                 # Entry point, Plugin class
├── models/
│   └── listing.ts          # Listing interface, PortoOption type
├── views/
│   ├── dashboard.ts        # Main ItemView (Sidebar/Tab)
│   └── statsView.ts        # Statistics panel
├── modals/
│   ├── newItemModal.ts     # New item form (incl. Claude API button)
│   ├── soldModal.ts        # Mark as sold
│   ├── shipModal.ts        # Mark as shipped
│   └── relistModal.ts      # Relist expired item
├── services/
│   ├── vaultService.ts     # Read/write MD notes via Obsidian API
│   ├── statsService.ts     # Calculations (profit, averages)
│   └── claudeService.ts    # Claude API for description generation
└── utils/
    ├── formatting.ts       # Date/currency formatting
    └── porto.ts            # Porto options and prices
```

---

## Phases

### Phase 1 — MVP

Core functionality to start tracking items immediately.

- [x] Project scaffold (package.json, tsconfig, esbuild, manifest.json)
- [x] Data model (`src/models/listing.ts`) — incl. Preisart (VB/Festpreis)
- [x] VaultService — read/write Markdown notes with YAML frontmatter
- [x] New Item Modal — title, condition, price (VB/Festpreis), porto, description
- [x] Mark as Sold Modal — sold price, date, payment method, bezahlt toggle
- [x] Dashboard View — full-tab table with stats, filters, "+ Neuer Artikel" button
- [x] Basic stats panel (active, sold, shipped, completed counts + revenue/profit)
- [x] Obsidian commands (Neuer Artikel, Dashboard öffnen) + ribbon icon

### Phase 2 — Shipping & Filters

Full shipping workflow and better navigation.

- [x] Ship Item Modal — address, porto, tracking number, label status
- [x] Payment tracking (bezahlt checkbox, date — in Sold Modal)
- [x] Detailed item view (full info card with Inserat/Verkauf/Versand/Finanzen sections)
- [x] Edit buttons per section (✏️ opens corresponding modal with pre-filled values)
- [x] Dashboard filters (by status)
- [x] Search by title / address
- [x] Re-listing workflow (Abgelaufen → Neu einstellen)
- [x] "Abschließen" action for shipped items

### Phase 3 — Analytics & Export

Insights and data portability.

- [x] Umsatz & Gewinn im Dashboard (funktioniert jetzt korrekt)
- [x] Statistik-Tab mit Monats-/Jahresübersicht (Eingestellt, Verkauft, Umsatz, Portokosten, Gewinn)
- [x] Alle bestehenden Artikel auf Standardformat migriert

### Phase 4 — AI & Integrations

Advanced features.

- [ ] Claude API integration — "Beschreibung generieren" button in New Item Modal
  - Model: claude-haiku-4-5 (~0.001€ per description)
  - Input: article name, condition, category
  - Output: Kleinanzeigen-ready description with Haftungsausschluss
  - API key stored in plugin settings
- [ ] Auto-fetch tracking status from carrier APIs
- [ ] Generate shipping labels (DHL/Hermes integration)
- [ ] Bulk operations (mark multiple as sold)

---

## Mögliche zusätzliche Features

- Export to CSV (für Steuern)
- Templates & Presets (gespeicherte Adressen, Carrier-Defaults)
- Erinnerungen (Zahlung ausstehend, Versand ausstehend)
- Best-selling Kategorien
- Durchschnittliche Verkaufsdauer
- Versandkosten-Trends

---

## Workflows

### Simple Local Sale (no shipping)

1. **[+ Neuer Artikel]** → Enter title, price → Save
2. Buyer contacts you
3. **[Verkauft]** → Enter sold price, select "Barzahlung", check "Bezahlt"
4. **[Abschließen]** → Done

### Shipped Item

1. **[+ Neuer Artikel]** → Item appears as "Aktiv"
2. Item sells → **[Verkauft]** → Enter price, buyer, payment method
3. **[Verschicken]** → Enter address, carrier, porto, tracking number
4. Status → "Verschickt"
5. After delivery → **[Abschließen]**

### Re-listing Expired Item

1. Item expires → **[Abgelaufen]**
2. **[Neu einstellen]** appears
   - All sale/shipping fields reset
   - `eingestellt_am` → today
   - `eingestellt_count` += 1
   - `erstmals_eingestellt_am` stays unchanged
   - Optional: adjust price
3. Description shown for re-copying
4. Status → "Aktiv"

---

## UI Design Principles

1. **One-Click Actions** — Common tasks in 1–2 clicks max
2. **Progressive Disclosure** — Show details only when needed
3. **Visual Status** — Clear icons and colors for item states
4. **Smart Defaults** — Pre-fill dates, suggest prices
5. **Keyboard Friendly** — Shortcuts for power users
6. **Mobile Friendly** — Works on Obsidian mobile app

---

## Open Questions

- Track multiple photos per item?
- Buyer rating/feedback system?
- Bulk operations (mark multiple as sold)?
- Integration with inventory management?
- Support for bundles (selling multiple items together)?
- Tax calculation helpers?

---

## Notes

- Storage: Individual MD notes with YAML frontmatter (Option 1 from concept) — easier to implement, searchable, integrates with Obsidian linking
- No moment.js — native Date API is sufficient
- Build system: esbuild (same as obsidian-sample-plugin)
- Dev workflow: Symlink repo into vault + Hot Reload plugin for live updates
