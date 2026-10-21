const GROUP_COLORS = [
  "#6D5BD0", "#2563EB", "#0891B2", "#16A34A",
  "#D97706", "#DC2626", "#DB2777", "#7C3AED",
];

const ICONS = {
  chevron: '<polyline points="6 9 12 15 18 9"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  menu: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  open: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  cross: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  export: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  replace: '<path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>',
};

let data = { groups: [] };
let mutationQueue = Promise.resolve();
let searchTimer;
let dragPayload;
const feedbackTimers = new WeakMap();
const searchCache = new WeakMap();
const snippetOriginals = new WeakMap();

document.addEventListener("DOMContentLoaded", async () => {
  let stored;
  try {
    stored = await chrome.storage.local.get("devlinks");
    data = { groups: stored.devlinks == null ? [] : normalizeGroups(stored.devlinks.groups) };
    setupListeners();
    render();
  } catch {
    showStatus("Could not load your saved links. Your stored data has not been changed. Reopen the extension to retry.");
    document.querySelectorAll("button, input").forEach((el) => { el.disabled = true; });
    if (stored?.devlinks != null) {
      const button = document.getElementById("export-btn");
      button.disabled = false;
      button.title = "Export recovery JSON";
      button.setAttribute("aria-label", button.title);
      button.removeAttribute("aria-haspopup");
      button.addEventListener("click", () => downloadJSON({ devlinks: stored.devlinks }, "dev-links-recovery.json"));
    }
  }
});

function icon(name, size = 13, className = "") {
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function uid() {
  return crypto.randomUUID();
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function showStatus(message) {
  const status = document.getElementById("status-message");
  status.textContent = message;
  status.hidden = false;
}

// Serialize mutations against the latest committed snapshot. Failed writes leave
// the previous data intact, and dialogs close only after storage succeeds.
function commitChange(change) {
  mutationQueue = mutationQueue.then(async () => {
    try {
      const next = structuredClone(data);
      if (change(next) === false) return false;
      await chrome.storage.local.set({ devlinks: next });
      data = next;
      document.getElementById("status-message").hidden = true;
      render();
      return true;
    } catch {
      showStatus("Could not save your changes. Your previous data is unchanged. Please try again (storage may be full).");
      return false;
    }
  });
  return mutationQueue;
}

// Validate imports AND local storage before rendering. Unsafe/missing/duplicate
// IDs are repaired; malformed records are rejected without overwriting storage.
function normalizeGroups(groups, freshIds = false) {
  if (!Array.isArray(groups)) throw new Error("Groups must be an array.");
  const ids = new Set();
  const getId = (id) => {
    if (freshIds || typeof id !== "string" || !/^[\w-]{1,128}$/.test(id) || ids.has(id)) id = uid();
    while (ids.has(id)) id = uid();
    ids.add(id);
    return id;
  };
  return groups.map((group, index) => {
    if (!group || typeof group.name !== "string" || !Array.isArray(group.links)) throw new Error("Invalid group.");
    return {
      id: getId(group.id),
      name: group.name.trim() || "Untitled",
      color: typeof group.color === "string" && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(group.color)
        ? group.color : GROUP_COLORS[index % GROUP_COLORS.length],
      collapsed: group.collapsed === true,
      locked: group.locked === true,
      links: group.links.map((link) => {
        if (!link || typeof link.name !== "string" || typeof link.url !== "string" || !isValidUrl(link.url)) {
          throw new Error("Invalid link. Only HTTP and HTTPS URLs are supported.");
        }
        const result = { id: getId(link.id), name: link.name.trim() || "Untitled", url: link.url.trim() };
        for (const key of ["username", "password", "branch", "note"]) {
          if (link[key] == null) continue;
          if (typeof link[key] !== "string") throw new Error(`Invalid ${key}.`);
          result[key] = link[key];
        }
        if (link.snippets != null) {
          if (!Array.isArray(link.snippets)) throw new Error("Invalid snippets.");
          result.snippets = link.snippets.map((snippet) => {
            if (!snippet || typeof snippet.code !== "string") throw new Error("Invalid snippet.");
            return { id: getId(snippet.id), code: snippet.code };
          });
        }
        return result;
      }),
    };
  });
}

function cloneLink(link) {
  const copy = { ...link, id: uid() };
  if (link.snippets) copy.snippets = link.snippets.map((snippet) => ({ ...snippet, id: uid() }));
  return copy;
}

function hasCreds(link) {
  return Boolean(link.username || link.password || link.branch);
}

function hasSnippets(link) {
  return Boolean(link.snippets?.length);
}

function faviconUrl(url) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}&sz=32`;
}

function searchable(record) {
  if (!searchCache.has(record)) searchCache.set(record, `${record.name}\n${record.url || ""}`.toLowerCase());
  return searchCache.get(record);
}

// ── Rendering ──

function linkButton(action, title, symbol, className = "") {
  return `<button class="link-action-btn ${className}" data-action="${action}" title="${title}" aria-label="${title}">${icon(symbol)}</button>`;
}

function renderLink(group, link, searching) {
  return `<div class="link-item" data-group="${esc(group.id)}" data-link="${esc(link.id)}">
    <div class="link-row" draggable="${!group.locked && !searching}" ${hasCreds(link) ? 'tabindex="0" role="button" aria-label="Show credentials"' : ""}>
      <img class="link-favicon" src="${esc(faviconUrl(link.url))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" draggable="false">
      <div class="link-info"><div class="link-name">${esc(link.name)}</div><div class="link-url">${esc(link.url)}</div></div>
      <div class="link-actions">
        ${hasSnippets(link) ? linkButton("snippets", "Show code snippets", "code", "link-snippets-toggle") : ""}
        ${hasCreds(link) ? linkButton("credentials", "Show credentials", "key", "link-creds-toggle") : ""}
        ${linkButton("open-link", "Open", "open", "link-open-btn")}
        ${!group.locked ? `${linkButton("duplicate-link", "Duplicate", "copy")}${linkButton("edit-link", "Edit", "edit")}${linkButton("delete-link", "Delete", "trash", "danger")}` : ""}
      </div>
    </div>
    ${hasSnippets(link) ? '<div class="link-snippets hidden"></div>' : ""}
    ${hasCreds(link) ? '<div class="link-creds hidden"></div>' : ""}
  </div>`;
}

function render(filter = document.getElementById("search-input").value) {
  clearTimeout(searchTimer);
  document.querySelectorAll(".group-menu").forEach((menu) => menu.remove());
  const container = document.getElementById("groups-container");
  const query = filter.toLowerCase().trim();
  const html = [];
  for (const group of data.groups) {
    const groupMatches = searchable(group).includes(query);
    const links = query && !groupMatches ? group.links.filter((link) => searchable(link).includes(query)) : group.links;
    if (query && !groupMatches && !links.length) continue;
    const collapsed = !query && group.collapsed;
    html.push(`<div class="group ${collapsed ? "collapsed" : ""}" data-id="${esc(group.id)}" draggable="${!group.locked && !query}">
      <div class="group-header" tabindex="0" role="button" aria-expanded="${!collapsed}">
        ${icon("chevron", 14, "group-chevron")}
        <div class="group-color" style="background:${esc(group.color)}"></div>
        <span class="group-name">${esc(group.name)}</span>
        ${group.locked ? icon("lock", 12, "group-lock-icon") : ""}
        <span class="group-count">${group.links.length}</span>
        <button class="group-menu-btn" title="Group menu" aria-label="Group menu">${icon("menu", 14)}</button>
      </div>
      <div class="group-body">
        <div class="links-list">${collapsed ? "" : links.map((link) => renderLink(group, link, Boolean(query))).join("")}</div>
        ${!group.locked ? `<div class="add-link-row"><button class="add-link-btn" data-group="${esc(group.id)}">${icon("plus", 12)} Add link</button></div>` : ""}
      </div>
    </div>`);
  }
  container.innerHTML = html.join("") || `<div class="empty-state">${query ? "No results found." : "No groups yet.<br>Create one to start organizing your links."}</div>`;
}

function togglePanel(item, link, kind) {
  const panel = item.querySelector(kind === "credentials" ? ".link-creds" : ".link-snippets");
  if (!panel) return;
  const opening = panel.classList.contains("hidden");
  if (opening) {
    // Details are built only on demand. Passwords/snippets are never duplicated
    // into data-* attributes, which also preserves quotes and line endings.
    if (kind === "snippets") {
      panel.innerHTML = link.snippets.map((snippet, index) => `<div class="snippet-row"><pre class="snippet-code">${esc(snippet.code)}</pre><button class="snippet-copy" data-index="${index}" title="Copy">${icon("copy", 11)}</button></div>`).join("");
    } else {
      panel.innerHTML = [["username", "User"], ["password", "Pass"], ["branch", "Branch"]].filter(([key]) => link[key]).map(([key, label]) => `<div class="cred-row">
        <span class="cred-label">${label}</span>
        <span class="cred-value ${key === "password" ? "cred-password-wrap" : key === "branch" ? "cred-branch" : ""}">${key === "password" ? `<span class="cred-pw-text">••••••••</span><button class="cred-reveal-inline" aria-pressed="false" title="Reveal">${icon("eye", 11)}</button>` : esc(link[key])}</span>
        <button class="cred-copy" data-field="${key}" title="Copy">${icon("copy", 11)}</button>
      </div>`).join("") + (link.username || link.password ? `<button class="cred-autofill" title="Autofill current page">${icon("edit", 12)} Autofill</button>` : "");
    }
  }
  panel.classList.toggle("hidden", !opening);
  const button = item.querySelector(`[data-action="${kind}"]`);
  button?.setAttribute("aria-expanded", String(opening));
  if (opening) requestAnimationFrame(() => {
    if (panel.isConnected && !panel.classList.contains("hidden")) panel.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  else panel.replaceChildren();
}

// ── Event delegation: constant listener count, even for large collections ──

function setupListeners() {
  document.querySelectorAll("a[target='_blank']").forEach((link) => {
    link.addEventListener("click", (event) => { event.preventDefault(); openUrl(link.href); });
  });
  document.getElementById("search-input").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => render(), 100);
  });
  document.getElementById("add-group-btn").addEventListener("click", async () => {
    const id = uid();
    if (await commitChange((next) => {
      next.groups.push({ id, name: "New Group", color: GROUP_COLORS[next.groups.length % GROUP_COLORS.length], collapsed: false, locked: false, links: [] });
    })) {
      document.getElementById("search-input").value = "";
      render();
      startRenameGroup(id, document.querySelector(`.group[data-id="${id}"] .group-name`));
    }
  });
  document.getElementById("save-tab-btn").addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !isValidUrl(tab.url)) {
        showStatus("Only HTTP and HTTPS pages can be saved. Open a website first.");
        return;
      }
      showSaveTabModal(tab.title || "", tab.url);
    } catch { showStatus("Could not read the current tab. Please try again."); }
  });
  document.getElementById("import-btn").addEventListener("click", () => document.getElementById("import-file").click());
  document.getElementById("import-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Import files must be 10 MB or smaller.");
      const imported = JSON.parse(await file.text());
      showImportModal(normalizeGroups(imported?.devlinks?.groups ?? imported?.groups, true));
    } catch (error) {
      showStatus(`Could not import this file. ${error instanceof SyntaxError ? "Invalid JSON." : error.message}`);
    } finally { event.target.value = ""; }
  });
  document.getElementById("export-btn").addEventListener("click", showExportModal);
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".group-menu, .group-menu-btn")) closeMenus();
  });
  const container = document.getElementById("groups-container");
  container.addEventListener("click", handleGroupClick);
  container.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches(".group-header, .link-row")) {
      event.preventDefault();
      event.target.click();
    }
  });
  // Image errors do not bubble, so use capture instead of a CSP-blocked inline handler.
  container.addEventListener("error", (event) => {
    if (event.target.matches(".link-favicon")) event.target.hidden = true;
  }, true);
  container.addEventListener("scroll", closeMenus, { passive: true });
  setupDragAndDrop(container);
}

function handleGroupClick(event) {
  const target = event.target;
  const groupEl = target.closest(".group");
  const group = data.groups.find((item) => item.id === groupEl?.dataset.id);
  if (!group) return;
  const menuButton = target.closest(".group-menu-btn");
  if (menuButton) { closeMenus(); showGroupMenu(menuButton, group.id); return; }
  if (target.closest(".group-header") && !target.closest("button, input")) {
    // Search temporarily expands groups; folding a search result must not change
    // the saved collapse preference or invert an already-collapsed group's state.
    if (document.getElementById("search-input").value.trim()) {
      groupEl.classList.toggle("collapsed");
      groupEl.querySelector(".group-header").setAttribute("aria-expanded", String(!groupEl.classList.contains("collapsed")));
    } else commitChange((next) => {
      const current = next.groups.find((item) => item.id === group.id);
      current.collapsed = !current.collapsed;
    });
    return;
  }
  if (target.closest(".add-link-btn")) { showAddLinkModal(group.id); return; }
  const item = target.closest(".link-item");
  const link = group.links.find((entry) => entry.id === item?.dataset.link);
  if (!link) return;
  const button = target.closest("button");
  const action = button?.dataset.action;
  if (action === "open-link") openUrl(link.url);
  else if (action === "credentials" || action === "snippets") togglePanel(item, link, action);
  else if (action === "edit-link" && !group.locked) showEditLinkModal(group.id, link.id);
  else if (action === "duplicate-link" && !group.locked) commitChange((next) => {
    const current = next.groups.find((entry) => entry.id === group.id);
    if (!current || current.locked) return false;
    const index = current.links.findIndex((entry) => entry.id === link.id);
    if (index < 0) return false;
    const copy = cloneLink(current.links[index]);
    copy.name += " (copy)";
    current.links.splice(index + 1, 0, copy);
  });
  else if (action === "delete-link" && !group.locked) {
    const overlay = showModal(`<h2>Delete Link?</h2><p>Are you sure you want to delete <strong>${esc(link.name)}</strong>?</p><div class="modal-actions"><button class="modal-btn secondary" id="modal-cancel">Cancel</button><button class="modal-btn primary danger" id="modal-confirm">Delete</button></div>`);
    overlay.querySelector("#modal-confirm").addEventListener("click", () => submitModal(overlay, () => commitChange((next) => {
      const current = next.groups.find((entry) => entry.id === group.id);
      if (!current || current.locked) return false;
      current.links = current.links.filter((entry) => entry.id !== link.id);
    })));
  } else if (button?.matches(".snippet-copy")) copyWithFeedback(button, link.snippets[Number(button.dataset.index)]?.code || "");
  else if (button?.matches(".cred-copy")) copyWithFeedback(button, link[button.dataset.field] || "");
  else if (button?.matches(".cred-reveal-inline")) {
    const reveal = button.getAttribute("aria-pressed") !== "true";
    button.closest(".cred-password-wrap").querySelector(".cred-pw-text").textContent = reveal ? link.password : "••••••••";
    button.setAttribute("aria-pressed", String(reveal));
    button.title = reveal ? "Hide password" : "Reveal";
    button.innerHTML = icon(reveal ? "eyeOff" : "eye", 11);
  } else if (button?.matches(".cred-autofill")) autofill(button, link);
  else if (!button && target.closest(".link-row")) togglePanel(item, link, "credentials");
}

function setupDragAndDrop(container) {
  container.addEventListener("dragstart", (event) => {
    const row = event.target.closest(".link-row");
    const groupEl = event.target.closest(".group");
    const group = data.groups.find((entry) => entry.id === groupEl?.dataset.id);
    if (!group || group.locked || document.getElementById("search-input").value.trim() || event.target.closest("button, input")) {
      event.preventDefault();
      return;
    }
    dragPayload = { groupId: group.id, linkId: row?.closest(".link-item").dataset.link };
    event.dataTransfer.setData("text/plain", row ? "Dev Links link" : "Dev Links group");
    event.dataTransfer.effectAllowed = "move";
    (row || groupEl).classList.add("dragging");
  });
  container.addEventListener("dragover", (event) => {
    if (!dragPayload) return;
    const groupEl = event.target.closest(".group");
    const group = data.groups.find((entry) => entry.id === groupEl?.dataset.id);
    if (!group || group.locked) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    groupEl.classList.add("drag-over");
  });
  container.addEventListener("dragleave", (event) => {
    const groupEl = event.target.closest(".group");
    if (groupEl && !groupEl.contains(event.relatedTarget)) groupEl.classList.remove("drag-over");
  });
  container.addEventListener("drop", (event) => {
    event.preventDefault();
    const payload = dragPayload;
    const groupEl = event.target.closest(".group");
    const toGroupId = groupEl?.dataset.id;
    const beforeId = event.target.closest(".link-item")?.dataset.link;
    clearDrag(container);
    if (!payload || !toGroupId || document.getElementById("search-input").value.trim()) return;
    commitChange((next) => {
      const source = next.groups.find((entry) => entry.id === payload.groupId);
      const target = next.groups.find((entry) => entry.id === toGroupId);
      if (!source || !target || source.locked || target.locked) return false;
      if (payload.linkId) {
        if (source === target && payload.linkId === beforeId) return false;
        const index = source.links.findIndex((entry) => entry.id === payload.linkId);
        if (index < 0) return false;
        const [link] = source.links.splice(index, 1);
        const targetIndex = target.links.findIndex((entry) => entry.id === beforeId);
        target.links.splice(targetIndex < 0 ? target.links.length : targetIndex, 0, link);
      } else {
        if (source === target) return false;
        const from = next.groups.indexOf(source);
        const to = next.groups.indexOf(target);
        next.groups.splice(from, 1);
        next.groups.splice(to, 0, source);
      }
    });
  });
  container.addEventListener("dragend", () => clearDrag(container));
}

function clearDrag(container) {
  dragPayload = null;
  container.querySelectorAll(".dragging, .drag-over").forEach((el) => el.classList.remove("dragging", "drag-over"));
}

async function openUrl(url) {
  try {
    if (!isValidUrl(url)) throw new Error("Invalid URL");
    await chrome.tabs.create({ url });
  } catch { showStatus("Could not open this link. Only HTTP and HTTPS URLs are supported."); }
}

function feedback(button, html, title = button.title) {
  const original = button.dataset.originalHtml || button.innerHTML;
  button.dataset.originalHtml = original;
  clearTimeout(feedbackTimers.get(button));
  button.innerHTML = html;
  button.title = title;
  feedbackTimers.set(button, setTimeout(() => {
    button.innerHTML = original;
    delete button.dataset.originalHtml;
    button.title = button.matches(".cred-autofill") ? "Autofill current page" : "Copy";
  }, 1500));
}

async function copyWithFeedback(button, text) {
  try {
    await navigator.clipboard.writeText(text);
    feedback(button, icon("check", 11), "Copied");
  } catch { showStatus("Could not copy to the clipboard. Please try again."); }
}

// This function runs in the target page's isolated world, without popup closures.
function fillLoginForm(username, password, expectedOrigin) {
  if (location.origin !== expectedOrigin) return { filled: 0, reason: "origin" };
  const visible = (input) => !input.matches(":disabled") && !input.readOnly && !input.closest("[inert]")
    && input.getClientRects().length > 0 && getComputedStyle(input).visibility !== "hidden"
    && (input.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? true);
  const passwords = Array.from(document.querySelectorAll('input[type="password"]')).filter((input) => visible(input) && input.autocomplete !== "new-password");
  const passwordInput = passwords[0];
  const candidates = Array.from((passwordInput?.form || document).querySelectorAll("input")).filter((input) =>
    ["text", "email", "tel"].includes(input.type) && visible(input) && input.autocomplete !== "new-password");
  const usernameInput = candidates.find((input) => /^(username|email)$/.test(input.autocomplete))
    || candidates.find((input) => input.type === "email" || /user|email|login/i.test(`${input.name} ${input.id}`))
    || (passwordInput?.form ? candidates.find((input) => !/search/i.test(`${input.name} ${input.id}`)) : null);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  let filled = 0;
  for (const [input, value] of [[usernameInput, username], [passwordInput, password]]) {
    if (!input || !value) continue;
    // The native setter also updates React/Vue-controlled fields correctly.
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    filled++;
  }
  return { filled };
}

async function autofill(button, link) {
  button.disabled = true;
  button.classList.remove("cred-autofill-failed");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const origin = new URL(link.url).origin;
    if (!tab?.id || !isValidUrl(tab.url) || new URL(tab.url).origin !== origin) throw new Error("Open a page on the saved link's exact origin (protocol, host and port) before autofilling.");
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: fillLoginForm,
      args: [link.username || "", link.password || "", origin],
    });
    const result = results[0]?.result;
    if (result?.reason === "origin") throw new Error("The page changed before autofill. Open the saved website and try again.");
    if (!result?.filled) throw new Error("No editable login fields were found on this page.");
    feedback(button, `${icon("check", 12)} Filled`, `Filled ${result.filled} field(s)`);
  } catch (error) {
    button.classList.add("cred-autofill-failed");
    feedback(button, `${icon("cross", 12)} Failed — Try again`, error.message);
    showStatus(error.message || "Autofill failed. This browser page may not allow extensions.");
  } finally { button.disabled = false; }
}

// ── Group menu ──

function closeMenus() {
  document.querySelectorAll(".group-menu").forEach((menu) => menu.remove());
}

function showGroupMenu(button, groupId) {
  const group = data.groups.find((entry) => entry.id === groupId);
  if (!group) return;
  const items = [
    ...(!group.locked ? [["rename", "Rename", "edit"]] : []),
    ["open-all", "Open all links", "open"], ["export-group", "Export group", "export"],
    ["duplicate", "Duplicate group", "copy"],
    ["toggle-lock", group.locked ? "Unlock group" : "Lock group", group.locked ? "unlock" : "lock"],
    ...(!group.locked ? [["delete", "Delete group", "trash"]] : []),
  ];
  const menu = document.createElement("div");
  menu.className = "group-menu";
  menu.innerHTML = items.map(([action, label, symbol]) => `${action === "toggle-lock" ? '<div class="group-menu-sep"></div>' : ""}<button class="group-menu-item ${action === "delete" ? "danger" : ""}" data-action="${action}">${icon(symbol)} ${label}</button>`).join("");
  document.body.appendChild(menu);
  const rect = button.getBoundingClientRect();
  const height = document.documentElement.clientHeight;
  const top = rect.bottom + 4 + menu.offsetHeight > height ? rect.top - menu.offsetHeight - 4 : rect.bottom + 4;
  menu.style.top = `${Math.max(4, top)}px`;
  menu.style.right = `${Math.max(4, document.documentElement.clientWidth - rect.right)}px`;
  menu.addEventListener("click", async (event) => {
    const action = event.target.closest("button")?.dataset.action;
    if (!action) return;
    menu.remove();
    if (action === "rename") startRenameGroup(groupId, document.querySelector(`.group[data-id="${groupId}"] .group-name`));
    else if (action === "export-group") exportGroup(group);
    else if (action === "open-all") {
      try { await Promise.all(group.links.map((link) => chrome.tabs.create({ url: link.url, active: false }))); }
      catch { showStatus("Some links could not be opened. Please try again."); }
    } else if (action === "duplicate") commitChange((next) => {
      const current = next.groups.find((entry) => entry.id === groupId);
      if (!current) return false;
      next.groups.splice(next.groups.indexOf(current) + 1, 0, { ...current, id: uid(), name: `${current.name} (copy)`, collapsed: false, locked: false, links: current.links.map(cloneLink) });
    });
    else if (action === "toggle-lock") commitChange((next) => {
      const current = next.groups.find((entry) => entry.id === groupId);
      if (!current) return false;
      current.locked = !current.locked;
    });
    else if (action === "delete" && !group.locked) {
      const remove = () => commitChange((next) => {
        const current = next.groups.find((entry) => entry.id === groupId);
        if (!current || current.locked) return false;
        next.groups = next.groups.filter((entry) => entry.id !== groupId);
      });
      if (!group.links.length) remove();
      else showConfirmModal(`Delete "${group.name}"?`, `This group has ${group.links.length} link(s). This action cannot be undone.`, remove, () => {
        exportGroup(group);
        return remove();
      });
    }
  });
}

function startRenameGroup(groupId, nameElement) {
  const group = data.groups.find((entry) => entry.id === groupId);
  if (!group || group.locked || !nameElement) return;
  const input = document.createElement("input");
  input.className = "group-name-input";
  input.value = group.name;
  nameElement.replaceWith(input);
  input.focus();
  input.select();
  let finished = false;
  input.addEventListener("blur", () => {
    if (finished) return;
    finished = true;
    const name = input.value.trim() || "Untitled";
    if (name === group.name) { render(); return; }
    commitChange((next) => {
      const current = next.groups.find((entry) => entry.id === groupId);
      if (!current || current.locked) return false;
      current.name = name;
    }).then((saved) => { if (!saved) render(); });
  });
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") input.blur();
    if (event.key === "Escape") { finished = true; render(); }
  });
}

// ── Modals ──

function showModal(content) {
  closeMenus();
  document.querySelectorAll(".modal-overlay").forEach((overlay) => overlay.remove());
  const previousFocus = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">${content}</div>`;
  overlay.querySelector("h2").id = "modal-title";
  document.body.appendChild(overlay);
  const close = () => {
    if (overlay.dataset.saving) return;
    overlay.remove();
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  overlay.querySelector("#modal-cancel")?.addEventListener("click", close);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    if (event.key === "Tab") {
      const controls = Array.from(overlay.querySelectorAll("button:not(:disabled), input:not(:disabled), select, textarea")).filter((el) => el.getClientRects().length && el.tabIndex !== -1);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  overlay.querySelector("input, button")?.focus();
  return overlay;
}

async function submitModal(overlay, action) {
  if (overlay.dataset.saving) return;
  overlay.dataset.saving = "true";
  const buttons = Array.from(overlay.querySelectorAll("button"));
  const states = buttons.map((button) => button.disabled);
  buttons.forEach((button) => { button.disabled = true; });
  try { if (await action() !== false) overlay.remove(); }
  catch { showStatus("This action could not be completed. Your saved data has not been deleted."); }
  finally {
    delete overlay.dataset.saving;
    buttons.forEach((button, index) => { button.disabled = states[index]; });
  }
}

function showConfirmModal(title, message, onConfirm, onExportDelete) {
  const overlay = showModal(`<h2>${esc(title)}</h2><p>${esc(message)}</p>
    <div class="modal-field" style="margin-top:12px"><label for="modal-confirm-input">Type <strong>Delete</strong> to confirm</label><input type="text" id="modal-confirm-input" placeholder="Delete" autocomplete="off"></div>
    <div class="modal-actions"><button class="modal-btn secondary" id="modal-cancel">Cancel</button><button class="modal-btn primary warning" id="modal-export-delete" disabled>Export → Delete</button><button class="modal-btn primary danger" id="modal-confirm" disabled>Delete</button></div>`);
  const input = overlay.querySelector("#modal-confirm-input");
  const confirm = overlay.querySelector("#modal-confirm");
  const exportDelete = overlay.querySelector("#modal-export-delete");
  input.addEventListener("input", () => { confirm.disabled = exportDelete.disabled = input.value.trim().toLowerCase() !== "delete"; });
  input.addEventListener("keydown", (event) => { if (event.key === "Enter" && !confirm.disabled) confirm.click(); });
  confirm.addEventListener("click", () => submitModal(overlay, onConfirm));
  exportDelete.addEventListener("click", () => submitModal(overlay, onExportDelete));
}

function showImportModal(groups) {
  const links = groups.reduce((count, group) => count + group.links.length, 0);
  const overlay = showModal(`<h2>Import Links</h2><p>Found <strong>${groups.length}</strong> group(s) with <strong>${links}</strong> link(s).</p>
    <div class="import-mode-btns"><button class="import-mode-btn" id="import-append">${icon("plus", 16)}<span class="import-mode-title">Append</span><span class="import-mode-desc">Add to existing data</span></button><button class="import-mode-btn import-mode-danger" id="import-replace">${icon("replace", 16)}<span class="import-mode-title">Replace</span><span class="import-mode-desc">Overwrite all current data</span></button></div>
    <div class="modal-actions"><button class="modal-btn secondary" id="modal-cancel">Cancel</button></div>`);
  for (const mode of ["append", "replace"]) overlay.querySelector(`#import-${mode}`).addEventListener("click", () => submitModal(overlay, () => commitChange((next) => {
    // Re-key the entire incoming batch independently of existing storage IDs.
    const incoming = normalizeGroups(groups, true);
    next.groups = mode === "replace" ? incoming : [...next.groups, ...incoming];
  })));
}

function snippetsSectionHTML(snippets = []) {
  return `<div class="modal-section-toggle ${snippets.length ? "open" : ""}" id="modal-snippets-toggle" tabindex="0" role="button" aria-expanded="${Boolean(snippets.length)}">${icon("chevron", 12)} Code Snippets <span style="font-weight:400;color:var(--text-tertiary)">(optional)</span></div>
    <div id="modal-snippets-section" class="modal-snippets-section ${snippets.length ? "" : "hidden"}"><div id="snippet-repeater"></div><button type="button" class="snippet-add-btn" id="modal-add-snippet" title="Add snippet">${icon("plus", 11)}</button></div>`;
}

function addSnippetRow(container, code = "", id = uid()) {
  const row = document.createElement("div");
  row.className = "snippet-repeater-row";
  row.innerHTML = `<textarea class="snippet-row-code" placeholder="e.g. docker-compose up -d" rows="2"></textarea><button type="button" class="snippet-row-remove" title="Remove snippet">${icon("trash", 12)}</button>`;
  row.querySelector("textarea").value = code;
  snippetOriginals.set(row, { id, code });
  row.querySelector("button").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

function collectSnippets(overlay) {
  return Array.from(overlay.querySelectorAll(".snippet-repeater-row"), (row) => {
    const code = row.querySelector("textarea").value;
    const original = snippetOriginals.get(row);
    // Textareas normalize CRLF. Keep the original bytes when the user has not
    // edited the snippet, instead of silently changing it on unrelated edits.
    return { id: original.id, code: code === original.code.replace(/\r\n?/g, "\n") ? original.code : code };
  }).filter((snippet) => snippet.code.trim());
}

function setupSectionToggle(overlay, name) {
  const toggle = overlay.querySelector(`#modal-${name}-toggle`);
  const section = overlay.querySelector(`#modal-${name}-section`);
  toggle.addEventListener("click", () => {
    section.classList.toggle("hidden");
    toggle.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(!section.classList.contains("hidden")));
  });
  toggle.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle.click(); }
  });
}

function showAddLinkModal(groupId) { showLinkModal("add", groupId); }
function showEditLinkModal(groupId, linkId) { showLinkModal("edit", groupId, linkId); }
function showSaveTabModal(title, url) { showLinkModal("tab", null, null, title, url); }

function showLinkModal(mode, groupId, linkId, title = "", url = "") {
  const group = data.groups.find((entry) => entry.id === groupId);
  const link = group?.links.find((entry) => entry.id === linkId);
  if (mode !== "tab" && (!group || group.locked || (mode === "edit" && !link))) return;
  const source = link || { name: title, url };
  const creds = hasCreds(source);
  const availableGroups = data.groups.filter((entry) => !entry.locked);
  const overlay = showModal(`<h2>${mode === "edit" ? "Edit Link" : mode === "tab" ? "Save Current Tab" : "Add Link"}</h2>
    <div class="modal-field"><label for="modal-link-name">Name</label><input type="text" id="modal-link-name" placeholder="e.g. Admin Dashboard"></div>
    <div class="modal-field"><label for="modal-link-url">URL</label><input type="url" id="modal-link-url" placeholder="https://..."></div>
    ${snippetsSectionHTML(source.snippets)}
    <div class="modal-section-toggle ${creds ? "open" : ""}" id="modal-creds-toggle" tabindex="0" role="button" aria-expanded="${creds}">${icon("chevron", 12)} Credentials <span style="font-weight:400;color:var(--text-tertiary)">(optional)</span></div>
    <div id="modal-creds-section" class="modal-creds-section ${creds ? "" : "hidden"}">
      <div class="modal-field"><label for="modal-link-username">Username / Email</label><input type="text" id="modal-link-username" placeholder="admin@example.com" autocomplete="off"></div>
      <div class="modal-field"><label for="modal-link-password">Password</label><div class="password-field"><input type="password" id="modal-link-password" placeholder="••••••••" autocomplete="off"><button type="button" class="password-toggle" title="Show password">${icon("eye", 14)}</button></div></div>
      <div class="modal-field"><label for="modal-link-branch">Repo / Branch</label><input type="text" id="modal-link-branch" placeholder="e.g. develop" autocomplete="off" list="branch-suggestions"></div>
    </div>
    ${mode !== "add" ? `<div class="modal-field"><label for="modal-link-group">${mode === "edit" ? "Move to group" : "Group"}</label><select id="modal-link-group">${availableGroups.length ? availableGroups.map((entry) => `<option value="${esc(entry.id)}" ${entry.id === groupId ? "selected" : ""}>${esc(entry.name)}</option>`).join("") : '<option value="">New Unsorted group</option>'}</select></div>` : ""}
    <div class="modal-actions"><button class="modal-btn secondary" id="modal-cancel">Cancel</button><button class="modal-btn primary" id="modal-save">${mode === "add" ? "Add" : "Save"}</button></div>`);
  for (const [field, key] of [["name", "name"], ["url", "url"], ["username", "username"], ["password", "password"], ["branch", "branch"]]) overlay.querySelector(`#modal-link-${field}`).value = source[key] || "";
  for (const snippet of source.snippets || []) addSnippetRow(overlay.querySelector("#snippet-repeater"), snippet.code, snippet.id);
  setupSectionToggle(overlay, "creds");
  setupSectionToggle(overlay, "snippets");
  overlay.querySelector("#modal-add-snippet").addEventListener("click", () => addSnippetRow(overlay.querySelector("#snippet-repeater")));
  const password = overlay.querySelector("#modal-link-password");
  overlay.querySelector(".password-toggle").addEventListener("click", (event) => {
    const show = password.type === "password";
    password.type = show ? "text" : "password";
    event.currentTarget.innerHTML = icon(show ? "eyeOff" : "eye", 14);
    event.currentTarget.title = show ? "Hide password" : "Show password";
  });
  overlay.querySelector("#modal-link-name").focus();
  if (mode === "tab") overlay.querySelector("#modal-link-name").select();
  overlay.querySelector("#modal-link-url").addEventListener("keydown", (event) => {
    if (event.key === "Enter") overlay.querySelector("#modal-save").click();
  });
  overlay.querySelector("#modal-save").addEventListener("click", () => {
    const nameInput = overlay.querySelector("#modal-link-name");
    const urlInput = overlay.querySelector("#modal-link-url");
    const name = nameInput.value.trim();
    const linkUrl = urlInput.value.trim();
    if (!name) { showFieldError(nameInput, "Name is required"); return; }
    if (!isValidUrl(linkUrl)) { showFieldError(urlInput, "Enter a valid URL (https://...)"); return; }
    const fields = {
      username: overlay.querySelector("#modal-link-username").value.trim(),
      password: password.value, // Password whitespace is significant.
      branch: overlay.querySelector("#modal-link-branch").value.trim(),
    };
    const snippets = collectSnippets(overlay);
    const destinationId = mode === "add" ? groupId : overlay.querySelector("#modal-link-group").value;
    submitModal(overlay, () => commitChange((next) => {
      const original = next.groups.find((entry) => entry.id === groupId);
      let destination = next.groups.find((entry) => entry.id === destinationId);
      if (mode !== "tab" && (!original || original.locked)) return false;
      if (!destination && mode === "tab" && !destinationId) {
        destination = { id: uid(), name: "Unsorted", color: GROUP_COLORS[0], collapsed: false, locked: false, links: [] };
        next.groups.push(destination);
      }
      if (!destination || destination.locked) { showStatus("The destination group is unavailable or locked."); return false; }
      const current = mode === "edit" ? original.links.find((entry) => entry.id === linkId) : { id: uid() };
      if (!current) return false;
      current.name = name;
      current.url = linkUrl;
      for (const [key, value] of Object.entries(fields)) {
        if (value) current[key] = value;
        else delete current[key];
      }
      if (snippets.length) current.snippets = snippets;
      else delete current.snippets;
      if (mode === "edit" && original !== destination) original.links = original.links.filter((entry) => entry.id !== linkId);
      if (mode !== "edit" || original !== destination) destination.links.push(current);
      destination.collapsed = false;
    }));
  });
}

function showFieldError(input, message) {
  input.setAttribute("aria-invalid", "true");
  let error = input.parentElement.querySelector(".field-error");
  if (!error) {
    error = document.createElement("div");
    error.className = "field-error";
    input.parentElement.appendChild(error);
    input.addEventListener("input", () => { input.removeAttribute("aria-invalid"); error.remove(); }, { once: true });
  }
  error.textContent = message;
  input.focus();
}

// ── Export / Import ──

function showExportModal() {
  const count = data.groups.reduce((sum, group) => sum + group.links.length, 0);
  const overlay = showModal(`<h2>Export Links</h2>
    <p>${count ? `Export all <strong>${count}</strong> saved link(s), including locked groups and links hidden by search.` : "There are no links to export. You can still download a JSON backup."}</p>
    <div class="export-formats">
      <button class="export-format" id="export-json">${icon("export", 18)}<span><span class="export-format-title">JSON backup</span><span class="export-format-desc">Restore your Dev Links groups and settings.</span></span></button>
      <button class="export-format" id="export-1password" ${count ? "" : "disabled"}>${icon("key", 18)}<span><span class="export-format-title">Export for 1Password</span><span class="export-format-desc">CSV with credentials, group names, branches and snippets.</span></span></button>
    </div>
    <p class="export-warning"><strong>Unencrypted files contain saved passwords.</strong> Import the CSV directly into 1Password, not a spreadsheet. Delete it after verifying the import.</p>
    <p>In 1Password.com, choose your name → Import data → CSV File, then label the columns.</p>
    <div class="modal-actions"><button class="modal-btn secondary" id="modal-cancel">Cancel</button></div>`);
  overlay.querySelector("#export-json").addEventListener("click", () => submitModal(overlay, exportData));
  overlay.querySelector("#export-1password").addEventListener("click", () => submitModal(overlay, exportFor1Password));
}

function onePasswordCSV(groups) {
  const rows = [["Title", "Website", "Username", "Password", "Notes"]];
  for (const group of groups) {
    for (const link of group.links) {
      const notes = [`Group: ${group.name}`];
      // Bookmark-only rows can be imported as Secure Notes without losing the URL.
      if (!link.username && !link.password) notes.push(`Website: ${link.url}`);
      if (link.branch) notes.push(`Branch: ${link.branch}`);
      if (link.note) notes.push(`Notes:\n${link.note}`);
      for (const [index, snippet] of (link.snippets || []).entries()) notes.push(`Snippet ${index + 1}:\n${snippet.code}`);
      rows.push([link.name, link.url, link.username ?? "", link.password ?? "", notes.join("\n\n")]);
    }
  }
  // Quote every field, escape embedded quotes and retain exact credential/code
  // bytes. Spreadsheet formula prefixes must not be added to saved passwords.
  return rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\r\n") + "\r\n";
}

function exportFor1Password() {
  if (!data.groups.some((group) => group.links.length)) {
    showStatus("There are no links to export for 1Password.");
    return false;
  }
  downloadFile(onePasswordCSV(data.groups), "dev-links-1password.csv", "text/csv;charset=utf-8");
}

function exportableGroup(group) {
  return {
    name: group.name, color: group.color, collapsed: group.collapsed, locked: group.locked,
    links: group.links.map((link) => {
      const result = { name: link.name, url: link.url };
      for (const key of ["username", "password", "branch", "note"]) if (link[key]) result[key] = link[key];
      if (link.snippets?.length) result.snippets = link.snippets.map((snippet) => ({ code: snippet.code }));
      return result;
    }),
  };
}

function exportData() {
  downloadJSON({
    exportedAt: new Date().toISOString(), version: "1.0",
    totalGroups: data.groups.length, totalLinks: data.groups.reduce((sum, group) => sum + group.links.length, 0),
    groups: data.groups.map(exportableGroup),
  }, "dev-links-export.json");
}

function exportGroup(group) {
  const safeName = group.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "group";
  downloadJSON({ exportedAt: new Date().toISOString(), version: "1.0", groups: [exportableGroup(group)] }, `dev-links-${safeName}.json`);
}

function downloadJSON(object, filename) {
  downloadFile(JSON.stringify(object, null, 2), filename, "application/json");
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try { anchor.click(); }
  finally {
    anchor.remove();
    // Revoking synchronously can cancel a download before Chrome consumes it.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
