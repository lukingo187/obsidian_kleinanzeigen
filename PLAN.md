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
│   ├── listing.ts          # Listing interface, PortoOption type
│   └── template.ts         # Template interface
├── views/
│   ├── dashboard.ts        # Main ItemView (Sidebar/Tab)
│   └── statsView.ts        # Statistics panel (embedded in dashboard)
├── modals/
│   ├── newItemModal.ts     # New item form (incl. AI button, template selection)
│   ├── editListingModal.ts # Edit existing listing
│   ├── soldModal.ts        # Mark as sold
│   ├── shipModal.ts        # Mark as shipped
│   └── relistModal.ts      # Relist expired item
├── settings/
│   └── settingsTab.ts      # Plugin settings (AI provider, API keys, themes, tax limit)
├── services/
│   ├── vaultService.ts     # Read/write MD notes via Obsidian API
│   ├── statsService.ts     # Calculations (profit, averages, sale duration)
│   ├── aiService.ts        # Provider-agnostic AI description generation
│   ├── templateService.ts  # Template CRUD (stored in plugin settings)
│   └── exportService.ts    # CSV and PDF export
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

### Phase 4 — Settings & AI-Beschreibungen

Plugin settings tab and AI-powered description generation.

- [x] **Settings Tab** — eingebettet in Dashboard (`Einstellungen`-Tab)
  - AI Provider selection (Anthropic, OpenAI)
  - API key input per provider (mit Sichtbarkeits-Toggle)
  - Model selection per provider
  - Tax threshold configuration (default: 1.000€/Jahr)
  - API-Key Test-Button
  - API-Nutzungsübersicht (Kosten, Aufrufe)
  - Beschreibungs-Footer (Privatverkauf-Disclaimer)
  - eBay-Aktivierung (Platzhalter für Phase 8)
- [x] **AI Description Generation** — Freitext-Eingabe im New Item Modal
  - Provider-agnostische Abstraktionsschicht (`src/services/aiService.ts`)
  - Unterstützte Provider: Anthropic (Claude), OpenAI (GPT)
  - Freitext-Eingabe → KI füllt Felder automatisch aus (Titel, Zustand, Porto, Beschreibung)
  - Nutzer kann generierten Text vor dem Speichern bearbeiten

### Phase 5 — Templates & Archiv

Streamlined workflows for repeat sellers and completed items.

- [x] **Artikel-Templates** (`src/services/templateService.ts`)
  - Template erstellen aus: Zustand, Porto, Preisart, Beschreibungsvorlage
  - Anwendungsfall: z.B. "PS4 Spiel" Template — gleicher Zustand, gleiches Porto, nur Titel ändern
  - Template-Verwaltung im Einstellungen-Tab (erstellen, bearbeiten, löschen)
  - "Aus Template erstellen" Auswahl im New Item Modal (erscheint wenn Templates vorhanden)
- [x] **Archiv-System**
  - Neuer Status: `Archiviert` (nach Abgeschlossen)
  - Archivieren-Button für abgeschlossene Artikel
  - Archivierte Artikel standardmäßig ausgeblendet
  - Archiv-Toggle in der Übersicht zum Ein-/Ausblenden
  - Löschen-Button (mit Bestätigung) für archivierte Artikel

### Phase 6 — Bulk-Operationen & Export

Efficient multi-item management and data export.

- [ ] **Bulk-Operationen**
  - Checkboxen in der Dashboard-Tabelle
  - "Alle auswählen" / "Keine auswählen"
  - Verfügbare Bulk-Aktionen (kontextabhängig):
    - Archivieren (für Abgeschlossene)
    - Löschen (mit Bestätigung)
    - Status ändern (z.B. Abgelaufen markieren)
    - Exportieren (Auswahl)
- [ ] **CSV-Export**
  - Alle Artikel oder aktuelle Auswahl/Filter
  - Konfigurierbare Spalten
  - Geeignet für Steuerunterlagen
- [ ] **PDF-Export**
  - Formatierte Übersicht als PDF
  - Einzelartikel oder Gesamtliste
  - Statistiken/Zusammenfassung inkl.

### Phase 7 — Erweiterte Statistiken & Steuerlimit

Better insights and tax compliance awareness.

- [x] **Erweiterte Statistiken** im Statistik-Tab
  - Durchschnittliche Verkaufsdauer (Eingestellt → Verkauft) in Tagen
  - Durchschnittlicher Verkaufspreis
  - Gesamtportokosten-Übersicht
- [x] **Steuerlimit-Anzeige**
  - Privatverkäufer-Freigrenze: 1.000€/Jahr (konfigurierbar in Settings)
  - Fortschrittsbalken im Statistik-Tab: "XXX€ / 1.000€ Freigrenze"
  - Warnung ab 80% (gelb), Überschreitung rot hervorgehoben
  - Bezieht sich auf Gesamteinnahmen (verkauft_fuer) im laufenden Kalenderjahr

### Phase 8 — eBay-Integration (Zukunft)

Extend the plugin to also track eBay listings alongside Kleinanzeigen.

- [ ] **eBay aktivieren** — Toggle in Einstellungen
  - Aktivierung ändert Tab-Leiste: Übersicht wird plattformübergreifend, separate Kleinanzeigen/eBay Tabs erscheinen
  - Archiv wird über Filter/Toggle in den Tabs erreichbar (statt eigenem Tab)
- [ ] `plattform: 'Kleinanzeigen' | 'eBay'` Feld im Listing-Model
- [ ] eBay-spezifische Felder (Gebühren, Auktions- vs. Sofortkauf, etc.)
- [ ] Steuerlimit berücksichtigt beide Plattformen zusammen

---

## Mögliche zusätzliche Features

- Erinnerungen (Zahlung ausstehend, Versand ausstehend) — Obsidian hat keine nativen Push-Notifications, aber in-App `Notice` ist möglich (wird angezeigt wenn Obsidian offen ist)
- Support für Bundles (mehrere Artikel zusammen verkaufen)
- Fotos pro Artikel tracken

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

## Dashboard Navigation

Ein Ribbon-Icon, ein Dashboard, Tab-basierte Navigation.

### Standard-Tabs (ohne eBay)

```
[ Übersicht ]  [ Statistiken ]  [ Einstellungen ]
```

- **Übersicht** — Aktive Artikel-Tabelle mit Filtern, Suche, Aktionen + Archiv-Toggle
- **Statistiken** — Monats-/Jahresübersicht, Verkaufsdauer, Steuerlimit
- **Einstellungen** — AI-Provider, API-Keys, Templates, Steuerlimit, eBay aktivieren

### Erweiterte Tabs (eBay aktiviert in Einstellungen)

```
[ Übersicht ]  [ Kleinanzeigen ]  [ eBay ]  [ Statistiken ]  [ Einstellungen ]
```

- **Übersicht** — Alle Artikel plattformübergreifend (Kleinanzeigen + eBay zusammen)
- **Kleinanzeigen** — Nur Kleinanzeigen-Artikel
- **eBay** — Nur eBay-Artikel
- **Statistiken** — Plattform-Filter, kombiniertes Steuerlimit
- **Einstellungen** — wie oben

### Archiv-Toggle

Archiv ist kein eigener Tab, sondern ein Toggle/Checkbox in jeder Artikelliste (Übersicht, Kleinanzeigen, eBay). Standardmäßig aus — zeigt nur aktive/laufende Artikel. Eingeschaltet zeigt archivierte Artikel (mit Löschen-Option).

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
- Support for bundles (selling multiple items together)?
- Support for bundles (selling multiple items together)?

---

## Notes

- Storage: Individual MD notes with YAML frontmatter — easier to implement, searchable, integrates with Obsidian linking
- No moment.js — native Date API is sufficient
- Build system: esbuild (same as obsidian-sample-plugin)
- Dev workflow: Symlink repo into vault + Hot Reload plugin for live updates
- Reminders: Obsidian hat keine System-Notifications, aber `new Notice()` zeigt In-App-Meldungen (nur sichtbar wenn Obsidian offen ist)
- Shipping label generation & auto-tracking: Nicht umsetzbar — DHL/Hermes APIs erfordern Geschäftskundenvertrag
- PDF Export: Benötigt eine Bibliothek wie jsPDF (als dependency)
