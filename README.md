# Obsidian Kleinanzeigen

An Obsidian plugin to track eBay Kleinanzeigen listings from creation to shipment completion, with integrated shipping management and profit tracking.

## Features

- **Quick Actions** — List, sell, ship, and complete items in 1–2 clicks
- **Dashboard** — Table view with status filters, search, inline actions, and real-time profit calculations
- **Shipping Management** — Address storage, label tracking, carrier support (DHL, Hermes, …)
- **Statistics** — Monthly/yearly stats, revenue, profit/loss, average sale price/duration, shipping costs, API costs
- **AI Descriptions** — Optional AI-powered description generation via Anthropic (Claude) or OpenAI (GPT)
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

Each listing is a Markdown note with YAML frontmatter stored in a `kleinanzeigen/` folder:

```
kleinanzeigen/
├── iPhone 12.md
├── Gaming Chair.md
├── MacBook Pro.md
└── Desk Lamp.md
```

## Development

### Prerequisites

- Node.js & npm
- Obsidian with [Hot Reload](https://github.com/pjeby/hot-reload) plugin (recommended)

### Setup

```bash
npm install
npm run dev
```

### Symlink into vault (macOS)

```bash
ln -s "$(pwd)" \
  ~/Library/Mobile\ Documents/com~apple~CloudDocs/obsidian_sync/Private/.obsidian/plugins/kleinanzeigen
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
