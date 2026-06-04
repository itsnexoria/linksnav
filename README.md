# NexHub — Your Digital Command Center

A fast, beautiful personal site hub. Navigate all your favourite sites from one place.

## 📁 File Structure

```
nexhub/
├── index.html    ← Main HTML
├── style.css     ← All styles
├── app.js        ← Logic (loads sites, search, filter)
└── sites.json    ← ✏️ Edit this to add/remove sites
```

## 🚀 Hosting on GitHub Pages

1. Create a new GitHub repo (e.g. `nexhub`)
2. Push all 4 files to the `main` branch
3. Go to **Settings → Pages → Source → main branch / root**
4. Done! Your site is live at `https://yourusername.github.io/nexhub`

## ✏️ Adding or Removing Sites

Open `sites.json` — it has two arrays:

### Add a site
Add an object to the `"sites"` array:

```json
{
  "name": "My New Site",
  "url": "https://example.com",
  "description": "Short description of what it does.",
  "category": "dev-tools",
  "tags": ["free"],
  "color": "#ff6b6b"
}
```

**Fields:**
| Field | Description |
|-------|-------------|
| `name` | Display name |
| `url` | Full URL with https:// |
| `description` | 1–2 sentence description |
| `category` | Must match an `id` from the `categories` array |
| `tags` | Array of `"free"` and/or `"paid"` |
| `color` | Hex color for the accent dot and top border |

### Add a category
Add an object to the `"categories"` array:

```json
{
  "id": "my-category",
  "label": "My Category",
  "icon": "🔥"
}
```

### Remove a site
Just delete its object from the `"sites"` array in `sites.json`.

## 🔍 Features

- **Ctrl+K** to focus the search bar
- Search by name, description, or tags
- Filter by category
- Animated cards with per-site accent colors
- Free / Paid tags on each card
- Fully responsive
