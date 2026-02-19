# ⚔ Bulk Item Importer — Owlbear Rodeo Extension

Search your image catalog and bulk-insert items into the scene with quantities — no more dragging one at a time.

---

## Features

- 🔍 **Search by name or tags** — instantly filter your catalog
- ✅ **Multi-select with checkboxes** — pick as many items as you like
- 🔢 **Set quantities** — e.g. 3× swords, 2× shields, 1× boots
- 📍 **Auto-placed at scene center** — items drop in a neat grid
- 💾 **Persistent catalog** — your item list is saved between sessions

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Run locally
```bash
npm run dev
```
This starts the dev server at `http://localhost:3000`.

### 3. Install in Owlbear Rodeo
1. Go to your OBR **Profile → Extensions → Add Extension**
2. Enter: `http://localhost:3000/manifest.json`
3. Create or open a Room, enable the extension
4. The **⚔ icon** will appear in the action bar (top left)

### 4. Deploy for permanent use
```bash
npm run build
```
Upload the `dist/` folder to any static host (Netlify, Vercel, GitHub Pages).  
Then update the install URL to your hosted `manifest.json`.

---

## Usage

### Adding items to your catalog
1. Open the extension panel and click **Manage Catalog**
2. For the image URL: in OBR, right-click any image in the dock → **"Copy image address"**
3. Paste the URL, give it a name and optional tags (e.g. `weapon, sword, rare`)
4. Click **Add** — it saves locally and persists between sessions

### Importing items into the scene
1. Click **Browse** tab
2. Search or scroll to find items
3. Click an item to select it (checkmark appears)
4. Use **−/+** buttons to set quantity
5. Click **✦ Import to Scene ✦**
6. All items appear in a grid at the center of your current viewport

---

## File Structure

```
bulk-item-importer/
├── public/
│   ├── manifest.json    ← OBR extension manifest
│   └── icon.svg         ← Toolbar icon
├── src/
│   └── main.js          ← All extension logic + UI
├── index.html           ← Entry point
├── vite.config.js
└── package.json
```

---

## Tips

- **Tags** make searching powerful: tag items as `armor`, `weapon`, `consumable`, `rare`, etc.
- Items are placed on the **PROP** layer by default — ideal for loot/objects
- The grid spacing adjusts automatically based on how many items you import
- Your catalog is stored in `localStorage` — it survives page refreshes but is per-browser

---

## Tech Stack

- [Owlbear Rodeo SDK](https://docs.owlbear.rodeo/extensions/)
- [Vite](https://vitejs.dev/) — build tool
- Vanilla JS — no framework needed
