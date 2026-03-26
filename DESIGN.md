# Design Guidelines

Richtlinien für ein konsistentes, minimalistisches UI im Kleinanzeigen Plugin.

---

## Grundprinzipien

- **Minimalistisch** — Nur das Nötigste zeigen, progressive disclosure
- **Abgerundet** — Weiche Formen, keine scharfen Kanten
- **Konsistent** — Gleiche Elemente sehen überall gleich aus
- **Obsidian-nativ** — CSS-Variablen, Lucide Icons, kein eigenes Farbschema

---

## Border-Radius System

| Typ | Radius | Verwendung |
|---|---|---|
| Pill | `16px` | Buttons (Filter, Action, CTA, Test, AI-Fill, New) |
| Section | `12px` | Settings-Sections, Template-Form, Badges |
| Input | `8px` | Text-Inputs, Selects, Textareas, Stat-Cards, Search, Back-Button, Desc-Box, Template-Row, Dropdown-Items |

**Regel:** Kein `4px` oder `6px` verwenden. Neue Elemente orientieren sich an diesen drei Stufen.

---

## Farben

Immer Obsidian CSS-Variablen verwenden:

| Variable | Verwendung |
|---|---|
| `--background-primary` | Input-Hintergrund, Cards |
| `--background-secondary` | Sections, Stat-Cards, Bulk-Bar |
| `--background-modifier-border` | Borders |
| `--background-modifier-hover` | Hover-States |
| `--interactive-accent` | Active-States, Toggle, Focus |
| `--text-normal` | Standard-Text |
| `--text-muted` | Labels, Hints, Sekundärtext |
| `--text-on-accent` | Text auf Accent-Hintergrund |

**Status-Farben** (einzige Ausnahme — hardcoded für semantische Bedeutung):

| Status | Farbe | Verwendung |
|---|---|---|
| Aktiv | `#00c853` | Badge, Button-Border |
| Verkauft | `#ffc107` | Badge, Button-Border |
| Verschickt | `#2196f3` | Badge, Button-Border |
| Abgeschlossen | `#4caf50` | Badge, Button-Border, Profit+ |
| Abgelaufen | `#9e9e9e` | Badge, Button-Border |
| Archiviert | `#888` | Badge, Button-Border |
| Fehler/Löschen | `#f44336` | Delete-Button, Profit-, Test-Fail |

Badge-Hintergrund: immer `rgba(farbe, 0.15)` für dezenten Farbton.

---

## Buttons

### Pill-Buttons (Standard)
```css
border-radius: 16px;
border: 1px solid var(--background-modifier-border);
background: var(--background-primary);
transition: background 100ms ease;
```

### CTA-Buttons (Primär)
```css
border-radius: 16px;
background: var(--interactive-accent);
color: var(--text-on-accent);
font-weight: 600;
```

### Keine Emojis in Buttons
Immer Obsidian Lucide Icons via `setIcon()` verwenden. Verfügbare Icons: `pencil`, `trash-2`, `eye`, `eye-off`, `share`, `file-spreadsheet`, `file-text`, `refresh-cw`.

---

## Transitions

Jedes interaktive Element braucht eine `transition` Property:

```css
transition: background 100ms ease;           /* Buttons */
transition: border-color 150ms ease;         /* Inputs, Cards */
transition: opacity 100ms ease;              /* Icon-Buttons */
transition: color 100ms ease;                /* Tabs */
```

---

## Inputs

```css
padding: 8px 12px;              /* Text-Inputs */
padding: 6px 30px 6px 12px;    /* Selects (Platz für Pfeil) */
padding: 10px 12px;            /* Textareas */
border-radius: 8px;
border: 1px solid var(--background-modifier-border);
background: var(--background-primary);
font-size: 0.9em;
```

Focus-State: `border-color: var(--interactive-accent); outline: none;`

---

## Settings-Sections

```css
border-radius: 12px;
padding: 20px 24px;
background: var(--background-secondary);
border: 1px solid var(--background-modifier-border);
```

- **h3**: Normal case (kein uppercase), `font-weight: 600`, `color: var(--text-normal)`
- **Description**: Direkt unter h3, `font-size: 0.85em`, `color: var(--text-muted)`
- **Labels**: `min-width: 140px`, `font-weight: 500`

---

## Modals

- Klasse `ka-modal` auf `contentEl`
- `.setting-item`: `border-top: none`, `padding: 12px 0`
- Alle Inputs/Selects im Modal: `border-radius: 8px`
- CTA-Button: `border-radius: 16px`, `padding: 8px 20px`
- Cancel-Button: `border-radius: 16px`

---

## Toggle-Switch

Für Boolean-Settings (statt Checkbox):

```css
width: 42px; height: 24px; border-radius: 12px;
```

- Inaktiv: `background: var(--background-modifier-border)`
- Aktiv: `background: var(--interactive-accent)`
- Knopf: 18px weißer Kreis mit `box-shadow`
- Accessibility: `role="switch"`, `aria-checked`

---

## Dropdowns/Popovers

- `border-radius: 8px`
- `background: var(--background-secondary)`
- `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)`
- Animation: `opacity 0→1` + `translateY(4px→0)` in 150ms
- Zwei-Klassen-System: `-open` (display) + `-visible` (animation)
- Arrow-Pointer via `::after` Pseudo-Element

---

## Typografie

| Element | Größe | Gewicht |
|---|---|---|
| Dashboard-Titel | Standard h2 | — |
| Section-Header (Settings) | `1.05em` | 600 |
| Section-Header (Detail) | `0.85em` uppercase | — |
| Labels | `0.9em` | 500 |
| Body/Values | `0.9em` | 500 |
| Hints | `0.8–0.85em` | normal |
| Stat-Values | `1.4em` | 600 |
| Artikel-Input (Modal) | `1.2em` | — |
