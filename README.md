# Kleinanzeigen Tracker

An Obsidian plugin to track your Kleinanzeigen listings from creation to shipment, with integrated shipping management and profit tracking.

> **Beta** — this plugin is in active development. Feedback welcome!

## Features

- **AI Descriptions** — Generate listing descriptions with one click via Anthropic (Claude) or OpenAI (GPT)
- **Quick Actions** — List, sell, ship, and complete items in 1–2 clicks
- **Dashboard** — Table view with status filters, search, inline actions, and real-time profit calculations
- **Shipping Management** — Address storage, label tracking, carrier support (DHL, Hermes, …)
- **Statistics** — Monthly/yearly stats, revenue, profit/loss, average sale price/duration, shipping costs, API costs
- **Templates** — Reusable article templates with pre-filled name, price, condition, shipping, and description
- **Archive** — Archive completed items and review/delete them later
- **Local Data** — All data stays in your vault as Markdown notes with YAML frontmatter

## Status Icons

| Icon | Status |
|------|--------|
| 🟢 | Aktiv — Currently listed |
| 💰 | Verkauft — Payment pending/received |
| 🚚 | Verschickt — In transit |
| ✅ | Abgeschlossen — Delivered & done |
| ⏳ | Abgelaufen — Expired, ready to relist |
| 📦 | Archiviert — Completed & archived |

## Data Storage

Each listing is a Markdown note with YAML frontmatter stored in a `kleinanzeigen/` folder inside your vault:

```
kleinanzeigen/
├── iPhone 12.md
├── Gaming Chair.md
└── Desk Lamp.md
```

## Beta Installation

This plugin is not yet in the Obsidian community plugin list. Install it via **BRAT**:

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Obsidian's Community Plugins
2. Open BRAT settings → **Add Beta Plugin**
3. Enter: `lukingo187/obsidian_kleinanzeigen`
4. Enable the plugin in Settings → Community Plugins

BRAT will notify you when updates are available.

## Development

### Prerequisites

- Node.js & npm
- Obsidian with [Hot Reload](https://github.com/pjeby/hot-reload) plugin (recommended)

### Setup

```bash
git clone https://github.com/lukingo187/obsidian_kleinanzeigen.git
cd obsidian_kleinanzeigen
npm install
npm run dev
```

Symlink into your vault's plugin folder:

```bash
ln -s "$(pwd)" /path/to/your/vault/.obsidian/plugins/kleinanzeigen
```

Then enable the plugin in Obsidian → Settings → Community Plugins.

### Build

```bash
npm run build
```

## Tech Stack

- TypeScript + esbuild (based on obsidian-sample-plugin)
- Obsidian API (no extra UI frameworks)
- AI via `requestUrl` — Anthropic (Claude) and OpenAI (GPT), no external SDKs

## License

MIT
