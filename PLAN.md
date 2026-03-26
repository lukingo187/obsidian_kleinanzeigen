# Implementation Plan

This document tracks all ideas, phases, architecture decisions, and progress for the Obsidian Kleinanzeigen plugin.

---

## Data Model

### Listing Interface

```typescript
interface Listing {
  // Core Info
  artikel: string;
  beschreibung?: string;
  zustand: 'Neu mit Etikett' | 'Neu' | 'Sehr Gut' | 'Gut' | 'In Ordnung' | 'Defekt';
  status: 'Aktiv' | 'Verkauft' | 'Verschickt' | 'Abgeschlossen' | 'Abgelaufen' | 'Archiviert';

  // Pricing
  preis: number;
  preisart: 'VB' | 'Festpreis';
  verkauft_fuer?: number;

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
  porto?: PortoOption;
  anschrift?: string;   // "Name\nStraße\nPLZ Ort"
  label_erstellt: boolean;
  sendungsnummer?: string;
  verschickt: boolean;
  verschickt_am?: string;

  // Meta
  filePath?: string;
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
├── main.ts                 # Entry point, Plugin class, modal orchestration
├── models/
│   └── listing.ts          # Listing, ArticleTemplate, PluginSettings, type definitions
├── views/
│   └── dashboard.ts        # Main ItemView (Overview, Stats, Settings tabs)
├── modals/
│   ├── newItemModal.ts     # New item form (AI button, template selection)
│   ├── editListingModal.ts # Edit existing listing
│   ├── soldModal.ts        # Mark as sold
│   ├── shipModal.ts        # Mark as shipped
│   └── relistModal.ts      # Relist expired item
├── services/
│   ├── vaultService.ts     # Read/write MD notes via Obsidian API
│   ├── statsService.ts     # Calculations (profit, averages, sale duration)
│   ├── aiService.ts        # Provider-agnostic AI description generation (Anthropic, OpenAI)
│   ├── exportService.ts    # CSV and PDF export (jsPDF + jspdf-autotable)
│   └── templateService.ts  # Template CRUD (stored in plugin settings)
└── utils/
    └── formatting.ts       # Date/currency/porto formatting
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
- [x] Edit buttons per section (Lucide pencil icon, opens corresponding modal with pre-filled values)
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
  - Template erstellen aus: Artikelname, Preis, Zustand, Porto, Preisart, Beschreibungsvorlage
  - Anwendungsfall: z.B. "PS4 Spiel" Template — gleicher Zustand, gleiches Porto, nur Titel ändern
  - Template-Verwaltung im Einstellungen-Tab (erstellen, bearbeiten, löschen)
  - "Aus Template erstellen" Auswahl im New Item Modal (erscheint wenn Templates vorhanden)
- [x] **Archiv-System**
  - Neuer Status: `Archiviert` (nach Abgeschlossen)
  - Archivieren-Button für abgeschlossene Artikel
  - Archivierte Artikel standardmäßig ausgeblendet
  - Archiv-Filter-Button in der Filter-Leiste (rechts, abgesetzt durch Spacer)
  - Löschen-Button (mit Bestätigung) für archivierte Artikel
- [x] **Abgelaufen-Aktion**
  - Aktive Artikel können direkt als "Abgelaufen" markiert werden

### Phase 6 — Bulk-Operationen, Export & UI Polish

Efficient multi-item management, data export, and polished UI.

- [x] **Sortierbare Tabelle** — Spalten: Artikel, Preis, Versand, Eingestellt, Status (▲▼ Indikatoren)
- [x] **Bulk-Operationen**
  - Checkboxen in der Dashboard-Tabelle mit "Alle auswählen"
  - Kontextabhängige Bulk-Aktionen: Archivieren, Löschen, Abgelaufen
  - Export-Dropdown (Exportieren-Button mit Share-Icon → CSV/PDF)
- [x] **CSV-Export** (`src/services/exportService.ts`) — Semikolon-getrennt, BOM für Excel
- [x] **PDF-Export** — via jsPDF + jspdf-autotable
- [x] **Status-Undo** — In Detailansicht: Status rückgängig machen (mit Feld-Reset)
- [x] **UI Design Polish** (siehe `DESIGN.md`)
  - Border-Radius System normalisiert (16px Pill / 12px Sections / 8px Inputs)
  - Alle Emojis durch Lucide Icons ersetzt (`setIcon()`)
  - Einstellungen komplett überarbeitet (Section Descriptions, Toggle-Switch, größere Inputs)
  - Modals: Abgerundete Inputs/Buttons, konsistentes Spacing
  - Export-Dropdown mit Animation (fade-in + arrow pointer)
  - Transitions auf allen interaktiven Elementen
  - Suchleiste/Filter in Detailansicht ausgeblendet

### Phase 7 — Erweiterte Statistiken

Better insights into sales performance.

- [x] **Erweiterte Statistiken** im Statistik-Tab
  - Einheitliches Stats-Grid (4 Spalten, 8 Karten): Gesamt eingestellt, Gesamt verkauft, Umsatz, Gewinn, Ø Verkaufsdauer, Ø Verkaufspreis, Gesamtporto, API-Kosten
  - Durchschnittliche Verkaufsdauer (Eingestellt → Verkauft) in Tagen
  - Durchschnittlicher Verkaufspreis
  - Gesamtportokosten-Übersicht
  - API-Kostenübersicht (Anthropic + OpenAI)

### Phase 8 — Foto-basierte KI-Beschreibungen

AI description generation from photos — user takes a picture, AI generates title, condition, and description.

- [ ] **Foto-Upload im New Item Modal**
  - Datei-Auswahl über Obsidian File-Picker (Vault-Dateien) oder Drag & Drop
  - Vorschau der ausgewählten Bilder (Thumbnail-Leiste)
  - Mehrere Fotos gleichzeitig möglich (max. 4)
- [ ] **Multimodal API-Aufrufe** (`src/services/aiService.ts`)
  - Bilder als Base64-Content-Blocks an Anthropic/OpenAI senden
  - Anthropic: `content: [{ type: 'image', source: { type: 'base64', ... } }, { type: 'text', text: prompt }]`
  - OpenAI: `content: [{ type: 'image_url', image_url: { url: 'data:image/...' } }, { type: 'text', text: prompt }]`
  - Prompt-Anpassung: KI soll aus den Fotos Artikel, Zustand, Porto-Schätzung und Beschreibung ableiten
- [ ] **Kombinierter Modus**: Fotos + optionaler Freitext (z.B. "Nintendo Switch, kaum benutzt")
  - Wenn nur Fotos → KI beschreibt was sie sieht
  - Wenn Fotos + Text → KI nutzt beides für bessere Ergebnisse
- [ ] **Token-Kosten beachten**: Bilder verbrauchen deutlich mehr Tokens — Kostenanzeige in API-Nutzung anpassen

### Phase 9 — eBay-Integration (Zukunft)

Extend the plugin to also track eBay listings alongside Kleinanzeigen.

- [ ] **eBay aktivieren** — Toggle in Einstellungen
  - Aktivierung ändert Tab-Leiste: Übersicht wird plattformübergreifend, separate Kleinanzeigen/eBay Tabs erscheinen
  - Archiv wird über Filter/Toggle in den Tabs erreichbar (statt eigenem Tab)
- [ ] `plattform: 'Kleinanzeigen' | 'eBay'` Feld im Listing-Model
- [ ] eBay-spezifische Felder (Gebühren, Auktions- vs. Sofortkauf, etc.)

---

## Mögliche zusätzliche Features

### UI/UX Verbesserungen
- [x] Keyboard-Shortcuts: `n` → Neuer Artikel, `Esc` → Zurück zur Liste, `r` → Aktualisieren, `/` → Suche fokussieren
- [x] Stat-Cards: Farbige linke Border-Akzente pro Status + farbige Werte (Grün/Amber/Blau etc.)
- [x] Animierte Tabellenzeilen: Staggered slide-in Animation beim Laden + farbige Status-Indikatoren am linken Rand
- [x] Undo-Button Redesign: Lucide `undo-2` Icon + Label, gestrichelte Border, abgesetzt vom Hauptaktion-Button, dezent mit hover-reveal

### Funktionale Features
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

- **Übersicht** — Aktive Artikel-Tabelle mit Filtern (inkl. Archiv), Suche, Aktionen
- **Statistiken** — Stats-Grid, Monats-/Jahresübersicht, Verkaufsdauer, API-Kosten
- **Einstellungen** — AI-Provider, API-Keys, Templates, Beschreibungs-Footer, eBay aktivieren

### Erweiterte Tabs (eBay aktiviert in Einstellungen)

```
[ Übersicht ]  [ Kleinanzeigen ]  [ eBay ]  [ Statistiken ]  [ Einstellungen ]
```

- **Übersicht** — Alle Artikel plattformübergreifend (Kleinanzeigen + eBay zusammen)
- **Kleinanzeigen** — Nur Kleinanzeigen-Artikel
- **eBay** — Nur eBay-Artikel
- **Statistiken** — Plattform-Filter, kombiniertes Steuerlimit
- **Einstellungen** — wie oben

### Archiv-Filter

Archiv ist kein eigener Tab, sondern ein Filter-Button in der Übersicht (rechts abgesetzt in der Filter-Leiste). Standardmäßig zeigt "Alle" nur aktive/laufende Artikel. Klick auf "Archiv" zeigt archivierte Artikel (mit Löschen-Option).

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
