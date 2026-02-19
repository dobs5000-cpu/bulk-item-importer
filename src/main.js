import OBR, { buildImage } from "@owlbear-rodeo/sdk";

// ─── Storage helpers ─────────────────────────────────────────────────────────
const STORAGE_KEY = "bulk-item-importer:catalog";

function loadCatalog() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveCatalog(catalog) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
}

// ─── State ────────────────────────────────────────────────────────────────────
let catalog = loadCatalog(); // [{ id, name, url, width, height, tags }]
let selected = new Map(); // id → quantity
let searchQuery = "";
let activeTab = "browse"; // "browse" | "manage"
let notification = null;
let notifTimer = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function showNotif(msg, type = "success") {
  notification = { msg, type };
  render();
  clearTimeout(notifTimer);
  notifTimer = setTimeout(() => {
    notification = null;
    render();
  }, 3000);
}

function filteredCatalog() {
  const q = searchQuery.toLowerCase().trim();
  if (!q) return catalog;
  return catalog.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      (item.tags && item.tags.toLowerCase().includes(q))
  );
}

// ─── OBR Import logic ─────────────────────────────────────────────────────────
async function importSelected() {
  if (selected.size === 0) {
    showNotif("No items selected!", "error");
    return;
  }

  try {
    const viewport = await OBR.viewport.getTransform();
    const center = await OBR.viewport.transformPoint({ x: 0.5, y: 0.5 });

    // Actually compute scene center from viewport
    const viewportWidth = window.screen.width;
    const viewportHeight = window.screen.height;
    const sceneCenter = {
      x: (-viewport.position.x + viewportWidth / 2) / viewport.scale,
      y: (-viewport.position.y + viewportHeight / 2) / viewport.scale,
    };

    const items = [];
    const ITEM_SIZE = 150; // default token size in scene units
    const GAP = 10;

    let totalCount = 0;
    for (const [, qty] of selected) totalCount += qty;

    // Grid layout centered on scene center
    const cols = Math.ceil(Math.sqrt(totalCount));
    let col = 0;
    let row = 0;
    const startX = sceneCenter.x - ((cols - 1) * (ITEM_SIZE + GAP)) / 2;
    const startY = sceneCenter.y - (Math.ceil(totalCount / cols) * (ITEM_SIZE + GAP)) / 2;

    for (const [id, qty] of selected) {
      const itemDef = catalog.find((c) => c.id === id);
      if (!itemDef) continue;

      for (let i = 0; i < qty; i++) {
        const x = startX + col * (ITEM_SIZE + GAP);
        const y = startY + row * (ITEM_SIZE + GAP);

        const w = itemDef.width || ITEM_SIZE;
        const h = itemDef.height || ITEM_SIZE;

        const token = buildImage(
          {
            width: w,
            height: h,
            url: itemDef.url,
            mime: guessMime(itemDef.url),
          },
          {
            dpi: 150,
            offset: { x: w / 2, y: h / 2 },
          }
        )
          .name(itemDef.name)
          .position({ x, y })
          .layer("PROP")
          .locked(false)
          .build();

        items.push(token);

        col++;
        if (col >= cols) {
          col = 0;
          row++;
        }
      }
    }

    await OBR.scene.items.addItems(items);
    showNotif(`✓ Added ${items.length} item${items.length !== 1 ? "s" : ""} to scene`);
    selected.clear();
    render();
  } catch (err) {
    console.error(err);
    showNotif("Failed to add items: " + err.message, "error");
  }
}

function guessMime(url) {
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
  if (lower.includes(".gif")) return "image/gif";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".svg")) return "image/svg+xml";
  return "image/png";
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  const app = document.getElementById("app");
  app.innerHTML = buildHTML();
  attachEvents();
}

function buildHTML() {
  const items = filteredCatalog();
  const totalSelected = [...selected.values()].reduce((a, b) => a + b, 0);

  return `
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      :root {
        --bg: #1a1410;
        --bg2: #221c16;
        --bg3: #2c241c;
        --border: #3d3022;
        --gold: #c9a84c;
        --gold2: #e8c96d;
        --amber: #d4782a;
        --text: #e8dcc8;
        --text2: #a89878;
        --text3: #6b5a42;
        --red: #c0392b;
        --green: #2ecc71;
        --radius: 6px;
      }

      body {
        background: var(--bg);
        color: var(--text);
        font-family: 'Crimson Pro', Georgia, serif;
        font-size: 15px;
        min-height: 100vh;
        overflow: hidden;
      }

      .app {
        display: flex;
        flex-direction: column;
        height: 100vh;
        max-height: 600px;
        background: var(--bg);
        overflow: hidden;
      }

      /* ── Header ── */
      .header {
        background: linear-gradient(135deg, var(--bg2) 0%, #1e160f 100%);
        border-bottom: 1px solid var(--border);
        padding: 12px 14px 0;
        flex-shrink: 0;
      }

      .header-top {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
      }

      .app-title {
        font-family: 'Cinzel', serif;
        font-size: 14px;
        font-weight: 700;
        color: var(--gold);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        flex: 1;
      }

      .badge {
        background: var(--amber);
        color: #fff;
        font-family: 'Cinzel', serif;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 20px;
        letter-spacing: 0.05em;
      }
      .badge.empty { background: var(--bg3); color: var(--text3); }

      /* ── Tabs ── */
      .tabs {
        display: flex;
        gap: 0;
      }

      .tab {
        padding: 7px 16px;
        font-family: 'Cinzel', serif;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text3);
        cursor: pointer;
        border: none;
        background: none;
        border-bottom: 2px solid transparent;
        transition: all 0.15s;
      }

      .tab:hover { color: var(--text2); }
      .tab.active {
        color: var(--gold);
        border-bottom-color: var(--gold);
      }

      /* ── Search ── */
      .search-bar {
        padding: 10px 14px;
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
      }

      .search-wrap {
        position: relative;
      }

      .search-icon {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text3);
        font-size: 13px;
        pointer-events: none;
      }

      .search-input {
        width: 100%;
        background: var(--bg3);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 7px 10px 7px 32px;
        color: var(--text);
        font-family: 'Crimson Pro', serif;
        font-size: 14px;
        outline: none;
        transition: border-color 0.15s;
      }
      .search-input::placeholder { color: var(--text3); }
      .search-input:focus { border-color: var(--gold); }

      /* ── Item Grid ── */
      .scroll-area {
        flex: 1;
        overflow-y: auto;
        padding: 10px 14px;
        scrollbar-width: thin;
        scrollbar-color: var(--border) transparent;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        text-align: center;
        color: var(--text3);
        gap: 10px;
      }

      .empty-icon { font-size: 36px; }

      .empty-title {
        font-family: 'Cinzel', serif;
        font-size: 13px;
        color: var(--text2);
        letter-spacing: 0.06em;
      }

      .empty-sub { font-size: 13px; line-height: 1.5; }

      .items-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }

      .item-card {
        background: var(--bg2);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        overflow: hidden;
        cursor: pointer;
        transition: all 0.15s;
        position: relative;
      }

      .item-card:hover {
        border-color: var(--gold);
        transform: translateY(-1px);
      }

      .item-card.selected {
        border-color: var(--gold);
        background: #2a1f0e;
        box-shadow: 0 0 0 1px var(--gold), inset 0 0 20px rgba(201,168,76,0.06);
      }

      .item-img-wrap {
        aspect-ratio: 1;
        background: var(--bg3);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        position: relative;
      }

      .item-img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        padding: 6px;
      }

      .item-img-fallback {
        font-size: 28px;
        color: var(--text3);
      }

      .item-check {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 20px;
        height: 20px;
        background: var(--gold);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        color: #1a1410;
        font-weight: 700;
        opacity: 0;
        transition: opacity 0.15s;
      }

      .item-card.selected .item-check { opacity: 1; }

      .item-info {
        padding: 5px 7px 6px;
      }

      .item-name {
        font-family: 'Cinzel', serif;
        font-size: 10px;
        font-weight: 600;
        color: var(--text);
        letter-spacing: 0.04em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.3;
      }

      .item-tags {
        font-size: 10px;
        color: var(--text3);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-top: 1px;
      }

      /* ── Quantity Controls ── */
      .qty-controls {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 4px;
      }

      .qty-btn {
        width: 20px;
        height: 20px;
        background: var(--bg3);
        border: 1px solid var(--border);
        border-radius: 3px;
        color: var(--text2);
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.1s;
        flex-shrink: 0;
      }

      .qty-btn:hover {
        background: var(--gold);
        color: #1a1410;
        border-color: var(--gold);
      }

      .qty-display {
        flex: 1;
        text-align: center;
        font-family: 'Cinzel', serif;
        font-size: 11px;
        font-weight: 700;
        color: var(--gold2);
      }

      /* ── Footer ── */
      .footer {
        border-top: 1px solid var(--border);
        padding: 10px 14px;
        background: var(--bg2);
        flex-shrink: 0;
      }

      .footer-info {
        font-size: 12px;
        color: var(--text3);
        margin-bottom: 8px;
        text-align: center;
        font-style: italic;
      }

      .import-btn {
        width: 100%;
        padding: 10px;
        background: linear-gradient(135deg, #8b6914 0%, var(--gold) 50%, #8b6914 100%);
        border: none;
        border-radius: var(--radius);
        color: #1a1410;
        font-family: 'Cinzel', serif;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        cursor: pointer;
        transition: all 0.2s;
      }

      .import-btn:hover {
        filter: brightness(1.15);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(201,168,76,0.3);
      }

      .import-btn:disabled {
        background: var(--bg3);
        color: var(--text3);
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      .clear-btn {
        width: 100%;
        margin-top: 6px;
        padding: 6px;
        background: none;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--text3);
        font-family: 'Crimson Pro', serif;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .clear-btn:hover { color: var(--text2); border-color: var(--text3); }

      /* ── Manage Tab ── */
      .manage-area {
        flex: 1;
        overflow-y: auto;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .section-label {
        font-family: 'Cinzel', serif;
        font-size: 10px;
        font-weight: 700;
        color: var(--text3);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }

      .add-form {
        background: var(--bg2);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .form-row {
        display: flex;
        gap: 8px;
      }

      .form-input {
        flex: 1;
        background: var(--bg3);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 7px 10px;
        color: var(--text);
        font-family: 'Crimson Pro', serif;
        font-size: 14px;
        outline: none;
        transition: border-color 0.15s;
      }
      .form-input::placeholder { color: var(--text3); }
      .form-input:focus { border-color: var(--gold); }

      .add-btn {
        padding: 7px 14px;
        background: var(--amber);
        border: none;
        border-radius: var(--radius);
        color: #fff;
        font-family: 'Cinzel', serif;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        cursor: pointer;
        white-space: nowrap;
        transition: filter 0.15s;
        flex-shrink: 0;
      }
      .add-btn:hover { filter: brightness(1.15); }

      .catalog-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .catalog-row {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--bg2);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 6px 8px;
        transition: border-color 0.15s;
      }
      .catalog-row:hover { border-color: var(--text3); }

      .catalog-thumb {
        width: 36px;
        height: 36px;
        background: var(--bg3);
        border-radius: 4px;
        object-fit: contain;
        padding: 3px;
        flex-shrink: 0;
      }

      .catalog-thumb-fallback {
        width: 36px;
        height: 36px;
        background: var(--bg3);
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }

      .catalog-info { flex: 1; min-width: 0; }
      .catalog-name {
        font-family: 'Cinzel', serif;
        font-size: 11px;
        font-weight: 600;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .catalog-tags {
        font-size: 11px;
        color: var(--text3);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .delete-btn {
        width: 26px;
        height: 26px;
        background: none;
        border: 1px solid transparent;
        border-radius: 4px;
        color: var(--text3);
        font-size: 15px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
        flex-shrink: 0;
      }
      .delete-btn:hover { background: rgba(192,57,43,0.15); color: var(--red); border-color: var(--red); }

      /* ── Notification ── */
      .notif {
        position: fixed;
        bottom: 70px;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 18px;
        border-radius: 20px;
        font-family: 'Cinzel', serif;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        z-index: 100;
        animation: fadeUp 0.2s ease;
        white-space: nowrap;
      }
      .notif.success { background: #1a3a1a; color: var(--green); border: 1px solid var(--green); }
      .notif.error { background: #3a1a1a; color: #e74c3c; border: 1px solid #e74c3c; }

      @keyframes fadeUp {
        from { opacity: 0; transform: translateX(-50%) translateY(10px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }

      /* ── Divider ── */
      .divider {
        height: 1px;
        background: var(--border);
        margin: 4px 0;
      }
    </style>

    <div class="app">
      <!-- Header -->
      <div class="header">
        <div class="header-top">
          <span class="app-title">⚔ Item Importer</span>
          <span class="badge ${totalSelected === 0 ? "empty" : ""}">
            ${totalSelected === 0 ? "none selected" : totalSelected + " queued"}
          </span>
        </div>
        <div class="tabs">
          <button class="tab ${activeTab === "browse" ? "active" : ""}" data-tab="browse">Browse</button>
          <button class="tab ${activeTab === "manage" ? "active" : ""}" data-tab="manage">Manage Catalog</button>
        </div>
      </div>

      ${activeTab === "browse" ? renderBrowseTab(items, totalSelected) : renderManageTab()}

      ${notification ? `<div class="notif ${notification.type}">${notification.msg}</div>` : ""}
    </div>
  `;
}

function renderBrowseTab(items, totalSelected) {
  return `
    <div class="search-bar">
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input
          class="search-input"
          type="text"
          placeholder="Search items, e.g. sword, boots…"
          value="${escHtml(searchQuery)}"
          id="search-input"
          autocomplete="off"
        />
      </div>
    </div>

    <div class="scroll-area">
      ${catalog.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🗡️</div>
          <div class="empty-title">No Items in Catalog</div>
          <div class="empty-sub">Switch to the <strong>Manage Catalog</strong> tab to add your first items. Paste the URL of any image already uploaded to OBR.</div>
        </div>
      ` : items.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">No Results</div>
          <div class="empty-sub">No items match "<em>${escHtml(searchQuery)}</em>"</div>
        </div>
      ` : `
        <div class="items-grid">
          ${items.map((item) => renderItemCard(item)).join("")}
        </div>
      `}
    </div>

    <div class="footer">
      ${totalSelected > 0 ? `
        <div class="footer-info">${totalSelected} token${totalSelected !== 1 ? "s" : ""} will be placed at scene center</div>
      ` : `<div class="footer-info">Select items above, then click Import</div>`}
      <button
        class="import-btn"
        id="import-btn"
        ${totalSelected === 0 ? "disabled" : ""}
      >
        ✦ Import to Scene ✦
      </button>
      ${totalSelected > 0 ? `<button class="clear-btn" id="clear-btn">Clear Selection</button>` : ""}
    </div>
  `;
}

function renderItemCard(item) {
  const qty = selected.get(item.id) || 0;
  const isSelected = qty > 0;

  return `
    <div class="item-card ${isSelected ? "selected" : ""}" data-id="${item.id}">
      <div class="item-img-wrap">
        <img
          class="item-img"
          src="${escHtml(item.url)}"
          alt="${escHtml(item.name)}"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div class="item-img-fallback" style="display:none;">🖼️</div>
        <div class="item-check">✓</div>
      </div>
      <div class="item-info">
        <div class="item-name" title="${escHtml(item.name)}">${escHtml(item.name)}</div>
        ${item.tags ? `<div class="item-tags">${escHtml(item.tags)}</div>` : ""}
        ${isSelected ? `
          <div class="qty-controls" onclick="event.stopPropagation()">
            <button class="qty-btn" data-action="dec" data-id="${item.id}">−</button>
            <span class="qty-display">${qty}</span>
            <button class="qty-btn" data-action="inc" data-id="${item.id}">+</button>
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

function renderManageTab() {
  return `
    <div class="manage-area">
      <div>
        <div class="section-label">Add New Item</div>
        <div class="add-form">
          <div class="form-row">
            <input class="form-input" id="add-name" type="text" placeholder="Item name (e.g. Iron Sword)" />
          </div>
          <div class="form-row">
            <input class="form-input" id="add-url" type="text" placeholder="Image URL from OBR…" />
          </div>
          <div class="form-row">
            <input class="form-input" id="add-tags" type="text" placeholder="Tags (e.g. weapon, melee, rare)" style="flex: 1" />
            <button class="add-btn" id="add-item-btn">Add</button>
          </div>
          <div style="font-size:12px; color: var(--text3); font-style: italic; line-height: 1.5;">
            Tip: Right-click any image in OBR's dock → "Copy image address" to get its URL.
          </div>
        </div>
      </div>

      <div>
        <div class="section-label">Your Catalog (${catalog.length} item${catalog.length !== 1 ? "s" : ""})</div>
        ${catalog.length === 0 ? `
          <div class="empty-state" style="padding: 20px 0">
            <div class="empty-sub">No items yet. Add some above!</div>
          </div>
        ` : `
          <div class="catalog-list">
            ${catalog.map((item) => `
              <div class="catalog-row">
                <img
                  class="catalog-thumb"
                  src="${escHtml(item.url)}"
                  alt="${escHtml(item.name)}"
                  onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                />
                <div class="catalog-thumb-fallback" style="display:none;">🖼️</div>
                <div class="catalog-info">
                  <div class="catalog-name">${escHtml(item.name)}</div>
                  ${item.tags ? `<div class="catalog-tags">🏷 ${escHtml(item.tags)}</div>` : ""}
                </div>
                <button class="delete-btn" data-delete="${item.id}" title="Remove from catalog">✕</button>
              </div>
            `).join("")}
          </div>
        `}
      </div>
    </div>
  `;
}

// ─── Event Wiring ─────────────────────────────────────────────────────────────
function attachEvents() {
  // Tabs
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.tab;
      render();
    });
  });

  // Search
  const searchEl = document.getElementById("search-input");
  if (searchEl) {
    searchEl.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      render();
    });
    // Keep focus after re-render
    searchEl.focus();
    searchEl.setSelectionRange(searchEl.value.length, searchEl.value.length);
  }

  // Item card clicks (toggle select)
  document.querySelectorAll(".item-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".qty-controls")) return;
      const id = card.dataset.id;
      if (selected.has(id)) {
        selected.delete(id);
      } else {
        selected.set(id, 1);
      }
      render();
    });
  });

  // Quantity buttons
  document.querySelectorAll(".qty-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const current = selected.get(id) || 1;
      if (action === "inc") {
        selected.set(id, Math.min(current + 1, 99));
      } else {
        if (current <= 1) {
          selected.delete(id);
        } else {
          selected.set(id, current - 1);
        }
      }
      render();
    });
  });

  // Import button
  const importBtn = document.getElementById("import-btn");
  if (importBtn) {
    importBtn.addEventListener("click", importSelected);
  }

  // Clear button
  const clearBtn = document.getElementById("clear-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      selected.clear();
      render();
    });
  }

  // Add item form
  const addBtn = document.getElementById("add-item-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const name = document.getElementById("add-name").value.trim();
      const url = document.getElementById("add-url").value.trim();
      const tags = document.getElementById("add-tags").value.trim();

      if (!name) { showNotif("Please enter an item name", "error"); return; }
      if (!url) { showNotif("Please enter an image URL", "error"); return; }

      catalog.push({ id: uid(), name, url, tags });
      saveCatalog(catalog);
      showNotif(`✓ "${name}" added to catalog`);
      render();
    });
  }

  // Delete from catalog
  document.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.delete;
      const item = catalog.find((c) => c.id === id);
      catalog = catalog.filter((c) => c.id !== id);
      selected.delete(id);
      saveCatalog(catalog);
      showNotif(`Removed "${item?.name || "item"}" from catalog`);
      render();
    });
  });
}

// ─── Escape HTML ──────────────────────────────────────────────────────────────
function escHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Init ─────────────────────────────────────────────────────────────────────
OBR.onReady(() => {
  render();
});
