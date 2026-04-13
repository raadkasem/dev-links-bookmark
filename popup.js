const GROUP_COLORS = [
  "#6D5BD0", "#2563EB", "#0891B2", "#16A34A",
  "#D97706", "#DC2626", "#DB2777", "#7C3AED",
];

let data = { groups: [] };

document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.local.get("devlinks");
  if (stored.devlinks) data = stored.devlinks;

  render();
  setupListeners();
});

function save() {
  chrome.storage.local.set({ devlinks: data });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function showFieldError(input, msg) {
  input.style.borderColor = "var(--red)";
  input.style.boxShadow = "0 0 0 2px rgba(220,38,38,0.1)";
  let err = input.parentElement.querySelector(".field-error");
  if (!err) {
    err = document.createElement("div");
    err.className = "field-error";
    input.parentElement.appendChild(err);
  }
  err.textContent = msg;
  input.addEventListener("input", () => {
    input.style.borderColor = "";
    input.style.boxShadow = "";
    if (err) err.remove();
  }, { once: true });
}

function hasCreds(l) {
  return l.username || l.password || l.branch;
}

function hasSnippets(l) {
  return l.snippets && l.snippets.length > 0;
}

function faviconUrl(url) {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch {
    return "";
  }
}

// ── Render ──

function render(filter = "") {
  const container = document.getElementById("groups-container");
  const q = filter.toLowerCase().trim();

  if (data.groups.length === 0 && !q) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <div>No groups yet.<br>Create one to start organizing your links.</div>
      </div>`;
    return;
  }

  let html = "";
  for (const group of data.groups) {
    const filteredLinks = q
      ? group.links.filter(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            l.url.toLowerCase().includes(q)
        )
      : group.links;

    const groupMatches = group.name.toLowerCase().includes(q);

    if (q && !groupMatches && filteredLinks.length === 0) continue;

    const links = q && !groupMatches ? filteredLinks : group.links;
    const collapsed = q ? false : group.collapsed;

    html += `
      <div class="group ${collapsed ? "collapsed" : ""}" data-id="${group.id}" draggable="true">
        <div class="group-header">
          <svg class="group-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          <div class="group-color" style="background:${group.color}"></div>
          <span class="group-name">${esc(group.name)}</span>
          ${group.locked ? `<svg class="group-lock-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>` : ""}
          <span class="group-count">${group.links.length}</span>
          <div style="position:relative">
            <button class="group-menu-btn" data-id="${group.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
          </div>
        </div>
        <div class="group-body">
          <div class="links-list">
            ${links
              .map(
                (l) => `
              <div class="link-item" data-group="${group.id}" data-link="${l.id}">
                <div class="link-row" draggable="true">
                  <img class="link-favicon" src="${faviconUrl(l.url)}" alt="" onerror="this.style.display='none'">
                  <div class="link-info">
                    <div class="link-name">${esc(l.name)}</div>
                    <div class="link-url">${esc(l.url)}</div>
                  </div>
                  <div class="link-actions">
                    ${hasSnippets(l) ? `<button class="link-action-btn link-snippets-toggle" data-link="${l.id}" title="Show code snippets">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                    </button>` : ""}
                    ${hasCreds(l) ? `<button class="link-action-btn link-creds-toggle" data-link="${l.id}" title="Show credentials">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                    </button>` : ""}
                    <button class="link-action-btn link-open-btn" data-url="${esc(l.url)}" title="Open">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </button>
                    <button class="link-action-btn" data-action="duplicate-link" data-group="${group.id}" data-link="${l.id}" title="Duplicate">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                    ${!group.locked ? `<button class="link-action-btn" data-action="edit-link" data-group="${group.id}" data-link="${l.id}" title="Edit">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="link-action-btn danger" data-action="delete-link" data-group="${group.id}" data-link="${l.id}" title="Delete">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>` : ""}
                  </div>
                </div>
                ${hasSnippets(l) ? `<div class="link-snippets hidden" data-snippets-for="${l.id}">
                  ${l.snippets.map((s) => `<div class="snippet-row">
                    <pre class="snippet-code">${esc(s.code)}</pre>
                    <button class="snippet-copy" data-copy="${esc(s.code)}" title="Copy"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                  </div>`).join("")}
                </div>` : ""}
                ${hasCreds(l) ? `<div class="link-creds hidden" data-creds-for="${l.id}">
                  ${l.username ? `<div class="cred-row">
                    <span class="cred-label">User</span>
                    <span class="cred-value">${esc(l.username)}</span>
                    <button class="cred-copy" data-copy="${esc(l.username)}" title="Copy"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                  </div>` : ""}
                  ${l.password ? `<div class="cred-row">
                    <span class="cred-label">Pass</span>
                    <span class="cred-value cred-password-wrap" data-pw="${esc(l.password)}">
                      <span class="cred-pw-text">••••••••</span>
                      <button class="cred-reveal-inline" title="Reveal"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                    </span>
                    <button class="cred-copy" data-copy="${esc(l.password)}" title="Copy"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                  </div>` : ""}
                  ${l.branch ? `<div class="cred-row">
                    <span class="cred-label">Branch</span>
                    <span class="cred-value cred-branch">${esc(l.branch)}</span>
                    <button class="cred-copy" data-copy="${esc(l.branch)}" title="Copy"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                  </div>` : ""}
                  ${l.username || l.password ? `<button class="cred-autofill" data-group="${group.id}" data-link="${l.id}" title="Autofill current page">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Autofill
                  </button>` : ""}
                </div>` : ""}
              </div>`
              )
              .join("")}
          </div>
          ${!group.locked ? `<div class="add-link-row">
            <button class="add-link-btn" data-group="${group.id}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add link
            </button>
          </div>` : ""}
        </div>
      </div>`;
  }

  container.innerHTML = html || '<div class="empty-state">No results found.</div>';
  attachGroupEvents();
}

function esc(str) {
  const el = document.createElement("span");
  el.textContent = str;
  return el.innerHTML;
}

// ── Event listeners ──

function setupListeners() {
  // External links
  document.querySelectorAll("a[target='_blank']").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: link.href });
    });
  });

  // Search
  document.getElementById("search-input").addEventListener("input", (e) => {
    render(e.target.value);
  });

  // Add group
  document.getElementById("add-group-btn").addEventListener("click", () => {
    const group = {
      id: uid(),
      name: "New Group",
      color: GROUP_COLORS[data.groups.length % GROUP_COLORS.length],
      collapsed: false,
      links: [],
    };
    data.groups.push(group);
    save();
    render();

    // Auto-focus rename
    setTimeout(() => {
      const nameEl = document.querySelector(`.group[data-id="${group.id}"] .group-name`);
      if (nameEl) startRenameGroup(group.id, nameEl);
    }, 50);
  });

  // Save current tab
  document.getElementById("save-tab-btn").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    showSaveTabModal(tab.title || "", tab.url);
  });

  // Import
  document.getElementById("import-btn").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });

  document.getElementById("import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      let groups;
      if (imported.devlinks?.groups) {
        groups = imported.devlinks.groups;
      } else if (imported.groups) {
        groups = imported.groups;
      } else {
        alert("Invalid file format.");
        return;
      }
      showImportModal(groups);
    } catch {
      alert("Invalid file format.");
    }
    e.target.value = "";
  });

  // Export
  document.getElementById("export-btn").addEventListener("click", () => {
    exportData();
  });

  // Close menus on outside click
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".group-menu") && !e.target.closest(".group-menu-btn")) {
      document.querySelectorAll(".group-menu").forEach((m) => m.remove());
    }
  });
}

function attachGroupEvents() {
  // Toggle collapse
  document.querySelectorAll(".group-header").forEach((header) => {
    header.addEventListener("click", (e) => {
      if (e.target.closest(".group-menu-btn") || e.target.closest(".group-menu")) return;
      const groupEl = header.closest(".group");
      const id = groupEl.dataset.id;
      const group = data.groups.find((g) => g.id === id);
      if (!group) return;
      group.collapsed = !group.collapsed;
      groupEl.classList.toggle("collapsed");
      save();
    });
  });

  // Group menu
  document.querySelectorAll(".group-menu-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".group-menu").forEach((m) => m.remove());
      showGroupMenu(btn, btn.dataset.id);
    });
  });

  // Open link
  document.querySelectorAll(".link-open-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.tabs.create({ url: btn.dataset.url });
    });
  });

  // Edit link
  document.querySelectorAll('[data-action="edit-link"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      showEditLinkModal(btn.dataset.group, btn.dataset.link);
    });
  });

  // Duplicate link
  document.querySelectorAll('[data-action="duplicate-link"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const group = data.groups.find((g) => g.id === btn.dataset.group);
      if (!group) return;
      const link = group.links.find((l) => l.id === btn.dataset.link);
      if (!link) return;
      const clone = { id: uid(), name: link.name + " (copy)", url: link.url };
      if (link.username) clone.username = link.username;
      if (link.password) clone.password = link.password;
      if (link.branch) clone.branch = link.branch;
      if (link.snippets) clone.snippets = link.snippets.map((s) => ({ id: uid(), code: s.code }));
      const idx = group.links.findIndex((l) => l.id === btn.dataset.link);
      group.links.splice(idx + 1, 0, clone);
      save();
      render(document.getElementById("search-input").value);
    });
  });

  // Delete link
  document.querySelectorAll('[data-action="delete-link"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const group = data.groups.find((g) => g.id === btn.dataset.group);
      if (!group) return;
      const link = group.links.find((l) => l.id === btn.dataset.link);
      if (!link) return;

      const overlay = showModal(`
        <h2>Delete Link?</h2>
        <p style="font-size:12.5px;color:var(--text-secondary);line-height:1.5;margin-bottom:4px">
          Are you sure you want to delete <strong>${esc(link.name)}</strong>?
        </p>
        <div class="modal-actions">
          <button class="modal-btn secondary" id="modal-cancel">Cancel</button>
          <button class="modal-btn primary" id="modal-confirm" style="background:var(--red);box-shadow:0 1px 3px rgba(220,38,38,0.3)">Delete</button>
        </div>`);

      overlay.querySelector("#modal-cancel").addEventListener("click", () => overlay.remove());
      overlay.querySelector("#modal-confirm").addEventListener("click", () => {
        group.links = group.links.filter((l) => l.id !== btn.dataset.link);
        save();
        render(document.getElementById("search-input").value);
        overlay.remove();
      });
    });
  });

  // Add link
  document.querySelectorAll(".add-link-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      showAddLinkModal(btn.dataset.group);
    });
  });

  // Drag and drop — groups
  document.querySelectorAll(".group[draggable]").forEach((el) => {
    el.addEventListener("dragstart", (e) => {
      if (e.target.closest(".link-row")) return;
      e.dataTransfer.setData("text/group-id", el.dataset.id);
      el.style.opacity = "0.4";
    });
    el.addEventListener("dragend", () => {
      el.style.opacity = "";
    });
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (e.dataTransfer.types.includes("text/group-id")) {
        el.classList.add("drag-over");
      }
    });
    el.addEventListener("dragleave", () => {
      el.classList.remove("drag-over");
    });
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      el.classList.remove("drag-over");
      const dragId = e.dataTransfer.getData("text/group-id");
      if (!dragId || dragId === el.dataset.id) return;
      const fromIdx = data.groups.findIndex((g) => g.id === dragId);
      const toIdx = data.groups.findIndex((g) => g.id === el.dataset.id);
      if (fromIdx < 0 || toIdx < 0) return;
      const [moved] = data.groups.splice(fromIdx, 1);
      data.groups.splice(toIdx, 0, moved);
      save();
      render(document.getElementById("search-input").value);
    });
  });

  // Drag and drop — links
  document.querySelectorAll(".link-item").forEach((item) => {
    const row = item.querySelector(".link-row[draggable]");
    if (!row) return;
    const groupId = item.dataset.group;
    const linkId = item.dataset.link;

    row.addEventListener("dragstart", (e) => {
      e.stopPropagation();
      e.dataTransfer.setData("text/link-data", JSON.stringify({ groupId, linkId }));
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
    });
    item.addEventListener("dragover", (e) => {
      e.preventDefault();
    });
    item.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const raw = e.dataTransfer.getData("text/link-data");
      if (!raw) return;
      const { groupId: fromGroupId, linkId: dragLinkId } = JSON.parse(raw);

      const fromGroup = data.groups.find((g) => g.id === fromGroupId);
      const toGroup = data.groups.find((g) => g.id === groupId);
      if (!fromGroup || !toGroup) return;

      const fromIdx = fromGroup.links.findIndex((l) => l.id === dragLinkId);
      if (fromIdx < 0) return;
      const [link] = fromGroup.links.splice(fromIdx, 1);

      const toIdx = toGroup.links.findIndex((l) => l.id === linkId);
      toGroup.links.splice(toIdx >= 0 ? toIdx : toGroup.links.length, 0, link);

      save();
      render(document.getElementById("search-input").value);
    });
  });

  // Click link row to expand credentials
  document.querySelectorAll(".link-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".link-action-btn") || e.target.closest("button")) return;
      const item = row.closest(".link-item");
      if (!item) return;
      const credsEl = item.querySelector(".link-creds");
      if (credsEl) credsEl.classList.toggle("hidden");
    });
  });

  // Snippets toggle
  document.querySelectorAll(".link-snippets-toggle").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const el = document.querySelector(`.link-snippets[data-snippets-for="${btn.dataset.link}"]`);
      if (el) {
        el.classList.toggle("hidden");
        if (!el.classList.contains("hidden")) {
          setTimeout(() => {
            el.lastElementChild.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }, 50);
        }
      }
    });
  });

  // Snippets copy
  document.querySelectorAll(".snippet-copy").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      copyWithFeedback(btn, btn.dataset.copy);
    });
  });

  // Credentials toggle
  document.querySelectorAll(".link-creds-toggle").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const el = document.querySelector(`.link-creds[data-creds-for="${btn.dataset.link}"]`);
      if (el) {
        el.classList.toggle("hidden");
        if (!el.classList.contains("hidden")) {
          setTimeout(() => {
            const autofill = el.querySelector(".cred-autofill");
            (autofill || el.lastElementChild).scrollIntoView({ behavior: "smooth", block: "nearest" });
          }, 50);
        }
      }
    });
  });

  // Credentials copy
  document.querySelectorAll(".cred-copy").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      copyWithFeedback(btn, btn.dataset.copy);
    });
  });

  // Password reveal
  document.querySelectorAll(".cred-reveal-inline").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const wrap = btn.closest(".cred-password-wrap");
      if (!wrap) return;
      const textEl = wrap.querySelector(".cred-pw-text");
      const isHidden = textEl.textContent === "••••••••";
      textEl.textContent = isHidden ? wrap.dataset.pw : "••••••••";
      btn.innerHTML = isHidden
        ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });
  });

  // Autofill
  document.querySelectorAll(".cred-autofill").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      btn.classList.remove("cred-autofill-failed");
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Autofill`;
      const group = data.groups.find((g) => g.id === btn.dataset.group);
      if (!group) return;
      const link = group.links.find((l) => l.id === btn.dataset.link);
      if (!link) return;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (username, password) => {
            const userSelectors = 'input[type="email"], input[type="text"][name*="user"], input[type="text"][name*="email"], input[type="text"][name*="login"], input[name*="username"], input[autocomplete="username"], input[autocomplete="email"]';
            const passSelectors = 'input[type="password"]';

            if (username) {
              const userInput = document.querySelector(userSelectors);
              if (userInput) {
                userInput.value = username;
                userInput.dispatchEvent(new Event("input", { bubbles: true }));
                userInput.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }
            if (password) {
              const passInput = document.querySelector(passSelectors);
              if (passInput) {
                passInput.value = password;
                passInput.dispatchEvent(new Event("input", { bubbles: true }));
                passInput.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }
          },
          args: [link.username || "", link.password || ""],
        });

        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Filled`;
        setTimeout(() => {
          btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Autofill`;
        }, 1500);
      } catch {
        btn.classList.add("cred-autofill-failed");
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Failed — Try again`;
      }
    });
  });
}

function setupCredsToggle(overlay) {
  const toggle = overlay.querySelector("#modal-creds-toggle");
  const section = overlay.querySelector("#modal-creds-section");
  if (!toggle || !section) return;
  toggle.addEventListener("click", () => {
    section.classList.toggle("hidden");
    toggle.classList.toggle("open");
  });
  if (!section.classList.contains("hidden")) {
    toggle.classList.add("open");
  }

  // Password show/hide
  const pwToggle = overlay.querySelector(".password-toggle");
  const pwInput = overlay.querySelector("#modal-link-password");
  if (pwToggle && pwInput) {
    pwToggle.addEventListener("click", () => {
      const show = pwInput.type === "password";
      pwInput.type = show ? "text" : "password";
      pwToggle.innerHTML = show
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });
  }
}

function setupSnippetsToggle(overlay) {
  const toggle = overlay.querySelector("#modal-snippets-toggle");
  const section = overlay.querySelector("#modal-snippets-section");
  if (!toggle || !section) return;
  toggle.addEventListener("click", () => {
    section.classList.toggle("hidden");
    toggle.classList.toggle("open");
  });
  if (!section.classList.contains("hidden")) {
    toggle.classList.add("open");
  }

  overlay.querySelector("#modal-add-snippet").addEventListener("click", () => {
    addSnippetRow(overlay.querySelector("#snippet-repeater"));
  });
}

function addSnippetRow(container, code = "") {
  const row = document.createElement("div");
  row.className = "snippet-repeater-row";
  row.innerHTML = `
    <textarea class="snippet-row-code" placeholder="e.g. docker-compose up -d" rows="2">${esc(code)}</textarea>
    <button type="button" class="snippet-row-remove" title="Remove snippet">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
    </button>`;
  row.querySelector(".snippet-row-remove").addEventListener("click", () => row.remove());
  container.appendChild(row);
  return row;
}

function collectSnippets(overlay) {
  const rows = overlay.querySelectorAll(".snippet-repeater-row");
  const snippets = [];
  rows.forEach((row) => {
    const code = row.querySelector(".snippet-row-code").value.trim();
    if (!code) return;
    snippets.push({ id: uid(), code });
  });
  return snippets;
}

function snippetsSectionHTML(snippets) {
  return `
    <div class="modal-section-toggle" id="modal-snippets-toggle">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      Code Snippets <span style="font-weight:400;color:var(--text-tertiary)">(optional)</span>
    </div>
    <div id="modal-snippets-section" class="modal-snippets-section ${snippets && snippets.length ? "" : "hidden"}">
      <div id="snippet-repeater">
        ${(snippets || []).map((s) => `
          <div class="snippet-repeater-row" data-prefilled>
            <textarea class="snippet-row-code" placeholder="e.g. docker-compose up -d" rows="2">${esc(s.code)}</textarea>
            <button type="button" class="snippet-row-remove" title="Remove snippet">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>`).join("")}
      </div>
      <button type="button" class="snippet-add-btn" id="modal-add-snippet" title="Add snippet">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>`;
}

function wirePrefilledSnippetRemoves(overlay) {
  overlay.querySelectorAll('.snippet-repeater-row[data-prefilled] .snippet-row-remove').forEach((btn) => {
    btn.addEventListener("click", () => btn.closest(".snippet-repeater-row").remove());
  });
}

function copyWithFeedback(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    setTimeout(() => { btn.innerHTML = orig; }, 1500);
  });
}

// ── Group menu ──

function showGroupMenu(btn, groupId) {
  const group = data.groups.find((g) => g.id === groupId);
  if (!group) return;

  const isLocked = group.locked;
  const hasLinks = group.links.length > 0;

  const menu = document.createElement("div");
  menu.className = "group-menu";
  menu.innerHTML = `
    ${!isLocked ? `<button class="group-menu-item" data-action="rename">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      Rename
    </button>` : ""}
    <button class="group-menu-item" data-action="open-all">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      Open all links
    </button>
    <button class="group-menu-item" data-action="export-group">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      Export group
    </button>
    <button class="group-menu-item" data-action="duplicate">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      Duplicate group
    </button>
    <div class="group-menu-sep"></div>
    <button class="group-menu-item" data-action="toggle-lock">
      ${isLocked
        ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
      Unlock group`
        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      Lock group`}
    </button>
    ${!isLocked ? `<button class="group-menu-item danger" data-action="delete">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      Delete group
    </button>` : ""}`;

  document.body.appendChild(menu);

  const rect = btn.getBoundingClientRect();
  const menuHeight = menu.offsetHeight;
  const viewportHeight = document.documentElement.clientHeight;

  let top = rect.bottom + 4;
  if (top + menuHeight > viewportHeight) {
    top = rect.top - menuHeight - 4;
  }

  menu.style.top = top + "px";
  menu.style.right = (document.documentElement.clientWidth - rect.right) + "px";

  const renameBtn = menu.querySelector('[data-action="rename"]');
  if (renameBtn) {
    renameBtn.addEventListener("click", () => {
      menu.remove();
      const nameEl = document.querySelector(`.group[data-id="${groupId}"] .group-name`);
      if (nameEl) startRenameGroup(groupId, nameEl);
    });
  }

  menu.querySelector('[data-action="open-all"]').addEventListener("click", () => {
    menu.remove();
    group.links.forEach((l) => chrome.tabs.create({ url: l.url }));
  });

  menu.querySelector('[data-action="export-group"]').addEventListener("click", () => {
    menu.remove();
    exportGroup(group);
  });

  menu.querySelector('[data-action="duplicate"]').addEventListener("click", () => {
    menu.remove();
    const clone = {
      id: uid(),
      name: group.name + " (copy)",
      color: group.color,
      collapsed: false,
      locked: false,
      links: group.links.map((l) => {
        const o = { id: uid(), name: l.name, url: l.url };
        if (l.username) o.username = l.username;
        if (l.password) o.password = l.password;
        if (l.branch) o.branch = l.branch;
        if (l.snippets) o.snippets = l.snippets.map((s) => ({ id: uid(), code: s.code }));
        return o;
      }),
    };
    const idx = data.groups.findIndex((g) => g.id === groupId);
    data.groups.splice(idx + 1, 0, clone);
    save();
    render(document.getElementById("search-input").value);
  });

  menu.querySelector('[data-action="toggle-lock"]').addEventListener("click", () => {
    menu.remove();
    group.locked = !group.locked;
    save();
    render(document.getElementById("search-input").value);
  });

  const deleteBtn = menu.querySelector('[data-action="delete"]');
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      menu.remove();
      if (hasLinks) {
        showConfirmModal(
          `Delete "${group.name}"?`,
          `This group has ${group.links.length} link${group.links.length > 1 ? "s" : ""}. This action cannot be undone.`,
          () => {
            data.groups = data.groups.filter((g) => g.id !== groupId);
            save();
            render();
          },
          () => {
            exportGroup(group);
            data.groups = data.groups.filter((g) => g.id !== groupId);
            save();
            render();
          }
        );
      } else {
        data.groups = data.groups.filter((g) => g.id !== groupId);
        save();
        render();
      }
    });
  }
}

function startRenameGroup(groupId, nameEl) {
  const group = data.groups.find((g) => g.id === groupId);
  if (!group) return;

  const input = document.createElement("input");
  input.className = "group-name-input";
  input.value = group.name;
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  const finish = () => {
    const val = input.value.trim() || "Untitled";
    group.name = val;
    save();
    render(document.getElementById("search-input").value);
  };

  input.addEventListener("blur", finish);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") {
      input.value = group.name;
      input.blur();
    }
  });
}

// ── Modals ──

function showModal(content) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal">${content}</div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  return overlay;
}

function showConfirmModal(title, message, onConfirm, onExportDelete) {
  const overlay = showModal(`
    <h2>${title}</h2>
    <p style="font-size:12.5px;color:var(--text-secondary);line-height:1.5;margin-bottom:4px">${message}</p>
    <div class="modal-field" style="margin-top:12px">
      <label>Type <strong style="color:var(--red)">Delete</strong> to confirm</label>
      <input type="text" id="modal-confirm-input" placeholder="Delete" autocomplete="off">
    </div>
    <div class="modal-actions">
      <button class="modal-btn secondary" id="modal-cancel">Cancel</button>
      <button class="modal-btn primary" id="modal-export-delete" style="background:var(--amber);box-shadow:0 1px 3px rgba(217,119,6,0.3)" disabled>Export → Delete</button>
      <button class="modal-btn primary" id="modal-confirm" style="background:var(--red);box-shadow:0 1px 3px rgba(220,38,38,0.3)" disabled>Delete</button>
    </div>`);

  const input = overlay.querySelector("#modal-confirm-input");
  const confirmBtn = overlay.querySelector("#modal-confirm");
  const exportDeleteBtn = overlay.querySelector("#modal-export-delete");

  input.focus();
  input.addEventListener("input", () => {
    const match = input.value.trim().toLowerCase() === "delete";
    confirmBtn.disabled = !match;
    exportDeleteBtn.disabled = !match;
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !confirmBtn.disabled) confirmBtn.click();
  });

  overlay.querySelector("#modal-cancel").addEventListener("click", () => overlay.remove());
  exportDeleteBtn.addEventListener("click", () => {
    overlay.remove();
    onExportDelete();
  });
  confirmBtn.addEventListener("click", () => {
    overlay.remove();
    onConfirm();
  });
}

function showImportModal(groups) {
  const groupCount = groups.length;
  const linkCount = groups.reduce((s, g) => s + g.links.length, 0);

  const overlay = showModal(`
    <h2>Import Links</h2>
    <p style="font-size:12.5px;color:var(--text-secondary);line-height:1.5;margin-bottom:14px">
      Found <strong>${groupCount}</strong> group${groupCount !== 1 ? "s" : ""} with <strong>${linkCount}</strong> link${linkCount !== 1 ? "s" : ""}.
    </p>
    <div class="import-mode-btns">
      <button class="import-mode-btn" id="import-append">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span class="import-mode-title">Append</span>
        <span class="import-mode-desc">Add to existing data</span>
      </button>
      <button class="import-mode-btn import-mode-danger" id="import-replace">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
        <span class="import-mode-title">Replace</span>
        <span class="import-mode-desc">Overwrite all current data</span>
      </button>
    </div>
    <div class="modal-actions">
      <button class="modal-btn secondary" id="modal-cancel">Cancel</button>
    </div>`);

  overlay.querySelector("#modal-cancel").addEventListener("click", () => overlay.remove());

  overlay.querySelector("#import-append").addEventListener("click", () => { doImport("append"); });
  overlay.querySelector("#import-replace").addEventListener("click", () => { doImport("replace"); });

  function doImport(mode) {
    if (mode === "replace") {
      data.groups = groups.map((g) => ({
        id: uid(),
        name: g.name,
        color: g.color || GROUP_COLORS[0],
        collapsed: false,
        locked: false,
        links: g.links.map((l) => { const o = { id: uid(), name: l.name, url: l.url }; if (l.username) o.username = l.username; if (l.password) o.password = l.password; if (l.branch) o.branch = l.branch; if (l.snippets) o.snippets = l.snippets.map((s) => ({ id: uid(), code: s.code })); return o; }),
      }));
    } else {
      for (const g of groups) {
        data.groups.push({
          id: uid(),
          name: g.name,
          color: g.color || GROUP_COLORS[data.groups.length % GROUP_COLORS.length],
          collapsed: false,
          locked: false,
          links: g.links.map((l) => { const o = { id: uid(), name: l.name, url: l.url }; if (l.username) o.username = l.username; if (l.password) o.password = l.password; if (l.branch) o.branch = l.branch; if (l.snippets) o.snippets = l.snippets.map((s) => ({ id: uid(), code: s.code })); return o; }),
        });
      }
    }

    save();
    render();
    overlay.remove();
  }
}

function showAddLinkModal(groupId) {
  const overlay = showModal(`
    <h2>Add Link</h2>
    <div class="modal-field">
      <label>Name</label>
      <input type="text" id="modal-link-name" placeholder="e.g. Admin Dashboard">
    </div>
    <div class="modal-field">
      <label>URL</label>
      <input type="url" id="modal-link-url" placeholder="https://...">
    </div>
    ${snippetsSectionHTML()}
    <div class="modal-section-toggle" id="modal-creds-toggle">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      Credentials <span style="font-weight:400;color:var(--text-tertiary)">(optional)</span>
    </div>
    <div id="modal-creds-section" class="modal-creds-section hidden">
      <div class="modal-field">
        <label>Username / Email</label>
        <input type="text" id="modal-link-username" placeholder="admin@example.com">
      </div>
      <div class="modal-field">
        <label>Password</label>
        <div class="password-field">
          <input type="password" id="modal-link-password" placeholder="••••••••">
          <button type="button" class="password-toggle" tabindex="-1" title="Show password">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <div class="modal-field">
        <label>Repo / Branch</label>
        <input type="text" id="modal-link-branch" placeholder="e.g. develop" autocomplete="off" list="branch-suggestions">
      </div>
    </div>
    <div class="modal-actions">
      <button class="modal-btn secondary" id="modal-cancel">Cancel</button>
      <button class="modal-btn primary" id="modal-save">Add</button>
    </div>`);

  setupSnippetsToggle(overlay);
  setupCredsToggle(overlay);

  const nameInput = overlay.querySelector("#modal-link-name");
  const urlInput = overlay.querySelector("#modal-link-url");
  nameInput.focus();

  overlay.querySelector("#modal-cancel").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#modal-save").addEventListener("click", () => {
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    const username = overlay.querySelector("#modal-link-username").value.trim();
    const password = overlay.querySelector("#modal-link-password").value.trim();
    const branch = overlay.querySelector("#modal-link-branch").value.trim();
    if (!name) { showFieldError(nameInput, "Name is required"); return; }
    if (!url) { showFieldError(urlInput, "URL is required"); return; }
    if (!isValidUrl(url)) { showFieldError(urlInput, "Enter a valid URL (https://...)"); return; }
    const group = data.groups.find((g) => g.id === groupId);
    if (!group) return;
    const link = { id: uid(), name, url };
    if (username) link.username = username;
    if (password) link.password = password;
    if (branch) link.branch = branch;
    const snippets = collectSnippets(overlay);
    if (snippets.length) link.snippets = snippets;
    group.links.push(link);
    save();
    render(document.getElementById("search-input").value);
    overlay.remove();
  });

  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") overlay.querySelector("#modal-save").click();
  });
}

function showEditLinkModal(groupId, linkId) {
  const group = data.groups.find((g) => g.id === groupId);
  if (!group) return;
  const link = group.links.find((l) => l.id === linkId);
  if (!link) return;

  const overlay = showModal(`
    <h2>Edit Link</h2>
    <div class="modal-field">
      <label>Name</label>
      <input type="text" id="modal-link-name" value="${esc(link.name)}">
    </div>
    <div class="modal-field">
      <label>URL</label>
      <input type="url" id="modal-link-url" value="${esc(link.url)}">
    </div>
    ${snippetsSectionHTML(link.snippets)}
    <div class="modal-section-toggle" id="modal-creds-toggle">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      Credentials <span style="font-weight:400;color:var(--text-tertiary)">(optional)</span>
    </div>
    <div id="modal-creds-section" class="modal-creds-section ${hasCreds(link) ? "" : "hidden"}">
      <div class="modal-field">
        <label>Username / Email</label>
        <input type="text" id="modal-link-username" value="${esc(link.username || "")}">
      </div>
      <div class="modal-field">
        <label>Password</label>
        <div class="password-field">
          <input type="password" id="modal-link-password" value="${esc(link.password || "")}">
          <button type="button" class="password-toggle" tabindex="-1" title="Show password">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <div class="modal-field">
        <label>Repo / Branch</label>
        <input type="text" id="modal-link-branch" value="${esc(link.branch || "")}" list="branch-suggestions">
      </div>
    </div>
    <div class="modal-field">
      <label>Move to group</label>
      <select id="modal-link-group">
        ${data.groups.map((g) => `<option value="${g.id}" ${g.id === groupId ? "selected" : ""}>${esc(g.name)}</option>`).join("")}
      </select>
    </div>
    <div class="modal-actions">
      <button class="modal-btn secondary" id="modal-cancel">Cancel</button>
      <button class="modal-btn primary" id="modal-save">Save</button>
    </div>`);

  setupSnippetsToggle(overlay);
  wirePrefilledSnippetRemoves(overlay);
  setupCredsToggle(overlay);
  overlay.querySelector("#modal-link-name").focus();

  overlay.querySelector("#modal-cancel").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#modal-save").addEventListener("click", () => {
    const nameEl = overlay.querySelector("#modal-link-name");
    const urlEl = overlay.querySelector("#modal-link-url");
    const name = nameEl.value.trim();
    const url = urlEl.value.trim();
    const username = overlay.querySelector("#modal-link-username").value.trim();
    const password = overlay.querySelector("#modal-link-password").value.trim();
    const branch = overlay.querySelector("#modal-link-branch").value.trim();
    const newGroupId = overlay.querySelector("#modal-link-group").value;
    if (!name) { showFieldError(nameEl, "Name is required"); return; }
    if (!url) { showFieldError(urlEl, "URL is required"); return; }
    if (!isValidUrl(url)) { showFieldError(urlEl, "Enter a valid URL (https://...)"); return; }

    link.name = name;
    link.url = url;
    link.username = username || undefined;
    link.password = password || undefined;
    link.branch = branch || undefined;
    const snippets = collectSnippets(overlay);
    link.snippets = snippets.length ? snippets : undefined;

    if (newGroupId !== groupId) {
      group.links = group.links.filter((l) => l.id !== linkId);
      const target = data.groups.find((g) => g.id === newGroupId);
      if (target) target.links.push(link);
    }

    save();
    render(document.getElementById("search-input").value);
    overlay.remove();
  });
}

function showSaveTabModal(title, url) {
  if (data.groups.length === 0) {
    const group = {
      id: uid(),
      name: "Unsorted",
      color: GROUP_COLORS[0],
      collapsed: false,
      links: [],
    };
    data.groups.push(group);
    save();
  }

  const overlay = showModal(`
    <h2>Save Current Tab</h2>
    <div class="modal-field">
      <label>Name</label>
      <input type="text" id="modal-link-name" value="${esc(title)}">
    </div>
    <div class="modal-field">
      <label>URL</label>
      <input type="url" id="modal-link-url" value="${esc(url)}">
    </div>
    ${snippetsSectionHTML()}
    <div class="modal-section-toggle" id="modal-creds-toggle">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      Credentials <span style="font-weight:400;color:var(--text-tertiary)">(optional)</span>
    </div>
    <div id="modal-creds-section" class="modal-creds-section hidden">
      <div class="modal-field">
        <label>Username / Email</label>
        <input type="text" id="modal-link-username" placeholder="admin@example.com">
      </div>
      <div class="modal-field">
        <label>Password</label>
        <div class="password-field">
          <input type="password" id="modal-link-password" placeholder="••••••••">
          <button type="button" class="password-toggle" tabindex="-1" title="Show password">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <div class="modal-field">
        <label>Repo / Branch</label>
        <input type="text" id="modal-link-branch" placeholder="e.g. develop" autocomplete="off" list="branch-suggestions">
      </div>
    </div>
    <div class="modal-field">
      <label>Group</label>
      <select id="modal-link-group">
        ${data.groups.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join("")}
      </select>
    </div>
    <div class="modal-actions">
      <button class="modal-btn secondary" id="modal-cancel">Cancel</button>
      <button class="modal-btn primary" id="modal-save">Save</button>
    </div>`);

  setupSnippetsToggle(overlay);
  setupCredsToggle(overlay);
  overlay.querySelector("#modal-link-name").focus();
  overlay.querySelector("#modal-link-name").select();

  overlay.querySelector("#modal-cancel").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#modal-save").addEventListener("click", () => {
    const nameEl = overlay.querySelector("#modal-link-name");
    const urlEl = overlay.querySelector("#modal-link-url");
    const name = nameEl.value.trim();
    const linkUrl = urlEl.value.trim();
    const username = overlay.querySelector("#modal-link-username").value.trim();
    const password = overlay.querySelector("#modal-link-password").value.trim();
    const branch = overlay.querySelector("#modal-link-branch").value.trim();
    const groupId = overlay.querySelector("#modal-link-group").value;
    if (!name) { showFieldError(nameEl, "Name is required"); return; }
    if (!linkUrl) { showFieldError(urlEl, "URL is required"); return; }
    if (!isValidUrl(linkUrl)) { showFieldError(urlEl, "Enter a valid URL (https://...)"); return; }

    const group = data.groups.find((g) => g.id === groupId);
    if (!group) return;
    const link = { id: uid(), name, url: linkUrl };
    if (username) link.username = username;
    if (password) link.password = password;
    if (branch) link.branch = branch;
    const snippets = collectSnippets(overlay);
    if (snippets.length) link.snippets = snippets;
    group.links.push(link);
    save();
    render();
    overlay.remove();
  });
}

// ── Export / Import ──

function exportData() {
  const output = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    totalGroups: data.groups.length,
    totalLinks: data.groups.reduce((s, g) => s + g.links.length, 0),
    groups: data.groups.map((g) => ({
      name: g.name,
      color: g.color,
      links: g.links.map((l) => {
        const o = { name: l.name, url: l.url };
        if (l.username) o.username = l.username;
        if (l.password) o.password = l.password;
        if (l.branch) o.branch = l.branch;
        if (l.note) o.note = l.note;
        if (l.snippets && l.snippets.length) o.snippets = l.snippets.map((s) => ({ code: s.code }));
        return o;
      }),
    })),
  };

  downloadJSON(output, "dev-links-export.json");
}

function exportGroup(group) {
  const output = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    groups: [
      {
        name: group.name,
        color: group.color,
        links: group.links.map((l) => {
          const o = { name: l.name, url: l.url };
          if (l.username) o.username = l.username;
          if (l.password) o.password = l.password;
          if (l.branch) o.branch = l.branch;
          if (l.note) o.note = l.note;
          if (l.snippets && l.snippets.length) o.snippets = l.snippets.map((s) => ({ code: s.code }));
          return o;
        }),
      },
    ],
  };

  const safeName = group.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  downloadJSON(output, `dev-links-${safeName}.json`);
}

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
