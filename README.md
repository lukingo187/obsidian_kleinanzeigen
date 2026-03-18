# Obsidian Kleinanzeigen

An Obsidian plugin to track eBay Kleinanzeigen listings from creation to shipment completion, with integrated shipping management and profit tracking.

## Features

- **Quick Actions** — List, sell, ship, and complete items in 1–2 clicks
- **Dashboard** — Table view with status filters, inline actions, and real-time profit calculations
- **Shipping Management** — Address storage, label tracking, carrier support (DHL, Hermes, …)
- **Statistics** — Monthly revenue, profit/loss, average sale price, shipping costs
- **Claude AI** — Optional description generation via Claude API
- **Local Data** — All data stays in your vault as Markdown notes with YAML frontmatter

## Status Icons

| Icon | Status |
|------|--------|
| 🟢 | Aktiv — Currently listed |
| 💰 | Verkauft — Payment pending/received |
| ⚠️ | Zu verschicken — Needs shipping |
| 🚚 | Verschickt — In transit |
| ✅ | Abgeschlossen — Delivered & done |
| ⏳ | Abgelaufen — Expired, ready to relist |

## Data Storage

Each listing is a Markdown note with YAML frontmatter stored in a `Kleinanzeigen/` folder:

```
Kleinanzeigen/
├── Active/
│   ├── iPhone 12.md
│   └── Gaming Chair.md
├── Sold/
│   └── MacBook Pro.md
└── Completed/
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
- @anthropic-ai/sdk (optional, for AI description generation)

## License

MIT
