const assert = require("node:assert/strict");
const { test } = require("node:test");
const { JSDOM } = require("jsdom");
const { createPopup, fixture } = require("./helpers.cjs");

async function popup(t, options) {
  const app = await createPopup(options);
  t.after(() => { assert.equal(app.errors.length, 0, app.errors[0]?.message); app.close(); });
  return app;
}

test("loads existing data without writing and repairs unsafe/duplicate IDs and colors", async (t) => {
  const stored = fixture();
  stored.groups[0].id = '\"><img id="injected">';
  stored.groups[0].color = 'red;position:fixed" onmouseover="alert(1)';
  stored.groups[1].id = stored.groups[0].links[0].id;
  const app = await popup(t, { stored });
  const result = app.snapshot();
  assert.equal(result.groups[0].color, "#6D5BD0");
  assert.match(result.groups[0].id, /^[\w-]+$/);
  assert.notEqual(result.groups[1].id, result.groups[0].links[0].id);
  assert.equal(app.query("#injected"), null);
  assert.equal(app.calls.writes.length, 0);
});

test("empty storage starts safely", async (t) => {
  const app = await popup(t, { stored: null });
  assert.equal(app.snapshot().groups.length, 0);
  assert.match(app.query(".empty-state").textContent, /No groups yet/);
});

test("malformed stored data is not overwritten and can be exported for recovery", async (t) => {
  const stored = { groups: [{ name: "Broken", links: null }] };
  const app = await popup(t, { stored });
  assert.equal(app.query("#add-group-btn").disabled, true);
  assert.equal(app.query("#export-btn").disabled, false);
  app.click("#export-btn");
  assert.equal(app.calls.downloads[0].filename, "dev-links-recovery.json");
  assert.deepEqual(app.persisted(), stored);
  assert.equal(app.calls.writes.length, 0);
});

test("storage read failure leaves editing disabled and shows an error", async (t) => {
  const app = await popup(t, { failRead: true });
  assert.equal(app.query("#add-group-btn").disabled, true);
  assert.match(app.query("#status-message").textContent, /Could not load/);
});

test("quoted and HTML-like text stays literal in forms and delete confirmation", async (t) => {
  const stored = fixture();
  const payload = '\"><img id="injected" src=x> & \'quoted\'';
  stored.groups[0].name = payload;
  stored.groups[0].links[0].name = payload;
  stored.groups[0].links[0].password = payload;
  const app = await popup(t, { stored });
  app.click('[data-action="edit-link"]');
  assert.equal(app.query("#modal-link-name").value, payload);
  assert.equal(app.query("#modal-link-password").value, payload);
  assert.equal(app.query("#injected"), null);
  app.click("#modal-cancel");
  app.click(".group-menu-btn");
  app.click('.group-menu [data-action="delete"]');
  assert.equal(app.query("#injected"), null);
  assert.equal(app.query(".modal h2").textContent, `Delete "${payload}"?`);
});

test("invalid imports are rejected before any data change", async (t) => {
  const app = await popup(t);
  for (const groups of [null, {}, [null], [{ name: "Bad", links: {} }], [{ name: "Bad", links: [{ name: "JS", url: "javascript:alert(1)" }] }], [{ name: "Bad", links: [{ name: "x", url: "https://example.com", password: {} }] }], [{ name: "Bad", links: [{ name: "x", url: "https://example.com", snippets: [null] }] }]]) {
    assert.throws(() => app.window.normalizeGroups(groups));
  }
  assert.equal(app.calls.writes.length, 0);
  assert.deepEqual(app.snapshot(), fixture());
});

test("file input is cleared even after an invalid import so the same file can be retried", async (t) => {
  const app = await popup(t);
  const input = app.query("#import-file");
  Object.defineProperty(input, "files", { value: [{ size: 5, text: async () => '{"groups":{}}' }] });
  input.dispatchEvent(new app.window.Event("change"));
  await app.settle();
  assert.match(app.query("#status-message").textContent, /Could not import/);
  assert.equal(input.value, "");
  assert.equal(app.query(".modal"), null);
  assert.equal(app.calls.writes.length, 0);
});

test("oversized imports are rejected without reading their contents", async (t) => {
  const app = await popup(t);
  let read = false;
  Object.defineProperty(app.query("#import-file"), "files", { value: [{ size: 11 * 1024 * 1024, text: async () => { read = true; return "{}"; } }] });
  app.query("#import-file").dispatchEvent(new app.window.Event("change"));
  await app.settle();
  assert.equal(read, false);
  assert.match(app.query("#status-message").textContent, /10 MB/);
});

test("append regenerates IDs and preserves flags, credentials, snippets and legacy notes", async (t) => {
  const app = await popup(t);
  const incoming = fixture().groups;
  incoming[0].locked = incoming[0].collapsed = true;
  app.window.showImportModal(app.window.normalizeGroups(incoming, true));
  app.click("#import-append");
  await app.settle();
  const groups = app.snapshot().groups;
  assert.equal(groups.length, 4);
  assert.notEqual(groups[0].id, groups[2].id);
  assert.notEqual(groups[0].links[0].id, groups[2].links[0].id);
  assert.equal(groups[2].locked, true);
  assert.equal(groups[2].collapsed, true);
  assert.equal(groups[2].links[0].note, "legacy note");
  assert.equal(groups[2].links[0].password, " secret ");
  assert.equal(groups[2].links[0].snippets[0].code, fixture().groups[0].links[0].snippets[0].code);
});

test("replace imports replace rather than append, including an empty backup", async (t) => {
  const app = await popup(t);
  app.window.showImportModal([]);
  app.click("#import-replace");
  await app.settle();
  assert.equal(app.snapshot().groups.length, 0);
  assert.equal(app.persisted().groups.length, 0);
});

test("a failed save keeps the modal open and original data intact; retry works", async (t) => {
  const app = await popup(t, { failWrite: true });
  app.click('[data-action="edit-link"]');
  app.change("#modal-link-name", "Changed");
  app.click("#modal-save");
  await app.settle();
  assert.equal(app.snapshot().groups[0].links[0].name, "Dashboard");
  assert.equal(app.persisted().groups[0].links[0].name, "Dashboard");
  assert.ok(app.query(".modal"));
  assert.equal(app.query("#modal-save").disabled, false);
  app.storage.fail = false;
  app.click("#modal-save");
  await app.settle();
  assert.equal(app.snapshot().groups[0].links[0].name, "Changed");
  assert.equal(app.query(".modal"), null);
});

test("rapid changes are serialized without stale snapshots losing links", async (t) => {
  let active = 0;
  let maximum = 0;
  const app = await popup(t, { beforeWrite: async () => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
  } });
  app.click('[data-action="duplicate-link"]');
  app.click('[data-action="duplicate-link"]');
  await app.settle();
  assert.equal(maximum, 1);
  assert.equal(app.persisted().groups[0].links.length, 3);
  assert.equal(app.snapshot().groups[0].links[1].note, "legacy note");
});

test("add and edit preserve exact passwords and snippet indentation", async (t) => {
  const app = await popup(t);
  app.click(".add-link-btn");
  app.change("#modal-link-name", "New");
  app.change("#modal-link-url", "https://example.com/new");
  app.change("#modal-link-password", "  password with spaces  ");
  app.click("#modal-add-snippet");
  app.change(".snippet-row-code", "\n  echo 'a'\n    next  ");
  app.click("#modal-save");
  await app.settle();
  const link = app.snapshot().groups[0].links[1];
  assert.equal(link.password, "  password with spaces  ");
  assert.equal(link.snippets[0].code, "\n  echo 'a'\n    next  ");
  app.window.showEditLinkModal("group-a", link.id);
  assert.equal(app.query(".snippet-row-code").value, link.snippets[0].code);
  app.click("#modal-save");
  await app.settle();
  assert.equal(app.snapshot().groups[0].links[1].password, link.password);
});

test("invalid link fields keep the modal open without writing", async (t) => {
  const app = await popup(t);
  app.click(".add-link-btn");
  app.click("#modal-save");
  assert.equal(app.query("#modal-link-name").getAttribute("aria-invalid"), "true");
  app.change("#modal-link-name", "New");
  app.change("#modal-link-url", "javascript:alert(1)");
  app.click("#modal-save");
  assert.equal(app.query("#modal-link-url").getAttribute("aria-invalid"), "true");
  assert.equal(app.calls.writes.length, 0);
});

test("editing can move links to an unlocked group without losing legacy data", async (t) => {
  const app = await popup(t);
  app.click('[data-action="edit-link"]');
  app.change("#modal-link-group", "group-b");
  app.click("#modal-save");
  await app.settle();
  assert.equal(app.snapshot().groups[0].links.length, 0);
  assert.equal(app.snapshot().groups[1].links[0].note, "legacy note");
  assert.equal(app.snapshot().groups[1].links[0].snippets[0].code, fixture().groups[0].links[0].snippets[0].code);
  assert.equal(app.snapshot().groups[1].links[0].snippets[0].id, "snippet-a");
});

test("an unavailable move destination cannot remove a link from its source", async (t) => {
  const app = await popup(t);
  app.click('[data-action="edit-link"]');
  app.change("#modal-link-group", "missing-group");
  app.click("#modal-save");
  await app.settle();
  assert.deepEqual(app.snapshot(), fixture());
  assert.equal(app.calls.writes.length, 0);
  assert.ok(app.query(".modal"));
  assert.match(app.query("#status-message").textContent, /destination/);
});

test("failed replace imports and deletes preserve the previous data and dialogs", async (t) => {
  const app = await popup(t, { failWrite: true });
  app.window.showImportModal([]);
  app.click("#import-replace");
  await app.settle();
  assert.deepEqual(app.snapshot(), fixture());
  assert.ok(app.query(".modal"));
  app.click("#modal-cancel");
  app.click('[data-action="delete-link"]');
  app.click("#modal-confirm");
  await app.settle();
  assert.deepEqual(app.snapshot(), fixture());
  assert.ok(app.query(".modal"));
});

test("pending modal submissions cannot be double-saved or dismissed mid-write", async (t) => {
  let finish;
  const app = await popup(t, { beforeWrite: () => new Promise((resolve) => { finish = resolve; }) });
  app.click(".add-link-btn");
  app.change("#modal-link-name", "Added once");
  app.change("#modal-link-url", "https://example.com/new");
  app.click("#modal-save");
  app.click("#modal-save");
  app.query("#modal-link-name").dispatchEvent(new app.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  app.click(".modal-overlay");
  assert.ok(app.query(".modal"));
  await new Promise(setImmediate);
  finish();
  await app.settle();
  assert.equal(app.snapshot().groups[0].links.length, 2);
  assert.equal(app.calls.writes.length, 1);
  assert.equal(app.query(".modal"), null);
});

test("duplicating groups preserves legacy content but assigns independent IDs", async (t) => {
  const app = await popup(t);
  app.click(".group-menu-btn");
  app.click('.group-menu [data-action="duplicate"]');
  await app.settle();
  const [original, copy] = app.snapshot().groups;
  assert.notEqual(copy.id, original.id);
  assert.notEqual(copy.links[0].id, original.links[0].id);
  assert.notEqual(copy.links[0].snippets[0].id, original.links[0].snippets[0].id);
  assert.equal(copy.links[0].note, original.links[0].note);
  assert.equal(copy.links[0].snippets[0].code, original.links[0].snippets[0].code);
});

test("renaming a group commits once and new groups remain visible under a search", async (t) => {
  const app = await popup(t);
  app.click(".group-menu-btn");
  app.click('.group-menu [data-action="rename"]');
  app.change(".group-name-input", "Renamed");
  app.query(".group-name-input").dispatchEvent(new app.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await app.settle();
  assert.equal(app.snapshot().groups[0].name, "Renamed");
  assert.equal(app.calls.writes.length, 1);
  app.change("#search-input", "nothing matches");
  app.window.render();
  app.click("#add-group-btn");
  await app.settle();
  assert.ok(app.query(".group-name-input"));
  assert.equal(app.query("#search-input").value, "");
  assert.equal(app.snapshot().groups.length, 3);
});

test("locked groups cannot be edited, duplicated into, or used as move destinations", async (t) => {
  const stored = fixture();
  stored.groups[0].locked = true;
  const app = await popup(t, { stored });
  assert.equal(app.query('[data-action="duplicate-link"]'), null);
  assert.equal(app.query('[data-action="edit-link"]'), null);
  assert.equal(app.query('.group[data-id="group-a"] .add-link-btn'), null);
  assert.equal(app.query('.group[data-id="group-a"]').draggable, false);
  app.window.showAddLinkModal("group-a");
  assert.equal(app.query(".modal"), null);
  app.window.showSaveTabModal("Example", "https://example.com");
  assert.equal(app.query('#modal-link-group option[value="group-a"]'), null);
  assert.equal(app.query('#modal-link-group option[value="group-b"]').selected, true);
});

test("saving a tab creates Unsorted only after save, including when every group is locked", async (t) => {
  const stored = fixture();
  stored.groups.forEach((group) => { group.locked = true; });
  const app = await popup(t, { stored });
  app.window.showSaveTabModal("Example", "https://example.com");
  app.click("#modal-cancel");
  assert.equal(app.snapshot().groups.length, 2);
  assert.equal(app.calls.writes.length, 0);
  app.window.showSaveTabModal("Example", "https://example.com");
  app.click("#modal-save");
  await app.settle();
  assert.equal(app.snapshot().groups.length, 3);
  assert.equal(app.snapshot().groups[2].name, "Unsorted");
  assert.equal(app.snapshot().groups[2].links.length, 1);
});

test("unsupported current tabs and tab query errors are reported without mutation", async (t) => {
  const app = await popup(t, { tab: { id: 1, url: "chrome://extensions" } });
  app.click("#save-tab-btn");
  await app.settle();
  assert.match(app.query("#status-message").textContent, /Only HTTP and HTTPS/);
  assert.equal(app.query(".modal"), null);
  assert.equal(app.calls.writes.length, 0);
  const failed = await popup(t, { failTabQuery: true });
  failed.click("#save-tab-btn");
  await failed.settle();
  assert.match(failed.query("#status-message").textContent, /Could not read/);
});

test("links can be dragged into empty groups; dropping onto self is a no-op", async (t) => {
  const app = await popup(t);
  await app.drag(".link-row", ".link-item");
  assert.equal(app.calls.writes.length, 0);
  await app.drag(".link-row", '.group[data-id="group-b"] .links-list');
  assert.equal(app.snapshot().groups[0].links.length, 0);
  assert.equal(app.snapshot().groups[1].links[0].id, "link-a");
});

test("drag and drop cannot move links out of or into locked groups", async (t) => {
  const stored = fixture();
  stored.groups[1].locked = true;
  const app = await popup(t, { stored });
  await app.drag(".link-row", '.group[data-id="group-b"]');
  assert.equal(app.calls.writes.length, 0);
  stored.groups[0].locked = true;
  stored.groups[1].locked = false;
  const other = await popup(t, { stored });
  await other.drag(".link-row", '.group[data-id="group-b"]');
  assert.equal(other.calls.writes.length, 0);
});

test("group drag reorders groups and external drops are ignored", async (t) => {
  const app = await popup(t);
  await app.drag('.group[data-id="group-a"] .group-header', '.group[data-id="group-b"]');
  assert.deepEqual(app.snapshot().groups.map((group) => group.id), ["group-b", "group-a"]);
  const event = new app.window.Event("drop", { bubbles: true, cancelable: true });
  app.query(".links-list").dispatchEvent(event);
  await app.settle();
  assert.equal(app.calls.writes.length, 1);
});

test("renders no hidden credentials/snippet contents or collapsed link rows", async (t) => {
  const stored = fixture();
  stored.groups[0].collapsed = true;
  const app = await popup(t, { stored });
  assert.equal(app.query(".link-row"), null);
  app.click(".group-header");
  await app.settle();
  assert.ok(app.query(".link-row"));
  assert.equal(app.query(".cred-row"), null);
  assert.equal(app.query(".snippet-code"), null);
  assert.equal(app.query("[data-copy]"), null);
  app.click('[data-action="snippets"]');
  assert.ok(app.query(".snippet-code"));
  app.click('[data-action="snippets"]');
  assert.equal(app.query(".snippet-code"), null);
});

test("search preserves filter after mutations, expands collapsed results, and does not save search folding", async (t) => {
  const stored = fixture();
  stored.groups[0].collapsed = true;
  const app = await popup(t, { stored });
  app.change("#search-input", "Dashboard");
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.ok(app.query(".link-row"));
  assert.equal(app.query(".group").classList.contains("collapsed"), false);
  app.click(".group-header");
  assert.equal(app.query(".group").classList.contains("collapsed"), true);
  assert.equal(app.calls.writes.length, 0);
  app.click(".group-header");
  app.click('[data-action="duplicate-link"]');
  await app.settle();
  assert.equal(app.document.querySelectorAll(".group").length, 1);
  assert.equal(app.query("#search-input").value, "Dashboard");
  app.change("#search-input", "");
  app.window.render();
  assert.equal(app.query(".group").classList.contains("collapsed"), true);
});

test("rerendering does not register per-link event listeners", async (t) => {
  const app = await popup(t);
  const before = app.calls.listeners;
  for (let index = 0; index < 5; index++) app.window.render();
  assert.equal(app.calls.listeners, before);
  app.click('[data-action="duplicate-link"]');
  await app.settle();
  assert.equal(app.snapshot().groups[0].links.length, 2);
});

test("copy reads exact model values; password masking does not depend on password text", async (t) => {
  const stored = fixture();
  stored.groups[0].links[0].password = "••••••••";
  const app = await popup(t, { stored });
  app.click('[data-action="snippets"]');
  app.click(".snippet-copy");
  await app.settle();
  assert.equal(app.calls.copies[0], stored.groups[0].links[0].snippets[0].code);
  app.click('[data-action="credentials"]');
  app.click(".cred-reveal-inline");
  assert.equal(app.query(".cred-reveal-inline").getAttribute("aria-pressed"), "true");
  app.click(".cred-reveal-inline");
  assert.equal(app.query(".cred-reveal-inline").getAttribute("aria-pressed"), "false");
  assert.equal(app.query("[data-pw]"), null);
});

test("clipboard rejection is shown rather than producing an unhandled rejection", async (t) => {
  const app = await popup(t, { failCopy: true });
  app.click('[data-action="credentials"]');
  app.click(".cred-copy");
  await app.settle();
  assert.match(app.query("#status-message").textContent, /clipboard/);
});

test("repeated copy feedback restores the original icon rather than a stuck checkmark", async (t) => {
  const app = await popup(t);
  app.click('[data-action="credentials"]');
  const button = app.query(".cred-copy");
  const original = button.innerHTML;
  button.click();
  await app.settle();
  button.click();
  await app.settle();
  assert.notEqual(button.innerHTML, original);
  await new Promise((resolve) => setTimeout(resolve, 1550));
  assert.equal(button.innerHTML, original);
});

test("favicon errors are handled without CSP-blocked inline handlers", async (t) => {
  const app = await popup(t);
  const image = app.query(".link-favicon");
  assert.equal(image.hasAttribute("onerror"), false);
  image.dispatchEvent(new app.window.Event("error"));
  assert.equal(image.hidden, true);
});

test("autofill refuses other origins, including subdomains, ports and HTTP downgrade", async (t) => {
  for (const url of ["https://evil.example/", "https://sub.example.com", "https://example.com:8443", "http://example.com"]) {
    const app = await popup(t, { tab: { id: 1, url } });
    app.click('[data-action="credentials"]');
    app.click(".cred-autofill");
    await app.settle();
    assert.equal(app.calls.scripts.length, 0);
    assert.match(app.query("#status-message").textContent, /exact origin/);
  }
});

test("autofill succeeds only when script results report filled fields", async (t) => {
  const app = await popup(t);
  app.click('[data-action="credentials"]');
  app.click(".cred-autofill");
  await app.settle();
  assert.match(app.query(".cred-autofill").textContent, /Filled/);
  assert.equal(app.calls.scripts[0].args[1], " secret ");
  assert.equal(app.calls.scripts[0].args[2], "https://example.com");
  const empty = await popup(t, { scriptResults: [{ result: { filled: 0 } }] });
  empty.click('[data-action="credentials"]');
  empty.click(".cred-autofill");
  await empty.settle();
  assert.match(empty.query(".cred-autofill").textContent, /Failed/);
  assert.match(empty.query("#status-message").textContent, /No editable/);
});

test("autofill handles tab API failure and a navigation race", async (t) => {
  const app = await popup(t, { failTabQuery: true });
  app.click('[data-action="credentials"]');
  app.click(".cred-autofill");
  await app.settle();
  assert.match(app.query(".cred-autofill").textContent, /Failed/);
  const changed = await popup(t, { scriptResults: [{ result: { filled: 0, reason: "origin" } }] });
  changed.click('[data-action="credentials"]');
  changed.click(".cred-autofill");
  await changed.settle();
  assert.match(changed.query("#status-message").textContent, /page changed/);
});

test("injected autofill skips hidden, disabled and signup fields, uses native setters and fires events", async (t) => {
  const app = await popup(t);
  const dom = new JSDOM('<input type="email" name="newsletter"><form><input name="username" style="display:none"><fieldset disabled><input type="password"></fieldset><div inert><input name="username"></div><input id="user"><input type="password" autocomplete="new-password"><input type="password" readonly><input type="password" id="pass"></form>', { url: "https://example.com/login", runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const { window } = dom;
  window.HTMLElement.prototype.getClientRects = function () { return this.style.display === "none" ? [] : [{}]; };
  let controlledSetterCalls = 0;
  const user = window.document.querySelector("#user");
  Object.defineProperty(user, "value", { configurable: true, get() { return Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").get.call(this); }, set() { controlledSetterCalls++; } });
  let events = 0;
  user.addEventListener("input", () => events++);
  user.addEventListener("change", () => events++);
  const fill = window.eval(`(${app.window.fillLoginForm.toString()})`);
  assert.equal(fill("admin", " secret ", "https://example.com").filled, 2);
  assert.equal(user.value, "admin");
  assert.equal(window.document.querySelector("#pass").value, " secret ");
  assert.equal(window.document.querySelector('[autocomplete="new-password"]').value, "");
  assert.equal(window.document.querySelector('[name="newsletter"]').value, "");
  assert.equal(controlledSetterCalls, 0);
  assert.equal(events, 2);
  assert.equal(fill("wrong", "wrong", "https://other.example").reason, "origin");
  assert.equal(user.value, "admin");
});

test("export/import roundtrip preserves lock and collapse state and exact values", async (t) => {
  const stored = fixture();
  stored.groups[0].locked = stored.groups[0].collapsed = true;
  const app = await popup(t, { stored });
  const exported = app.window.exportableGroup(app.window.__getData().groups[0]);
  const imported = app.window.normalizeGroups([exported], true)[0];
  assert.equal(imported.locked, true);
  assert.equal(imported.collapsed, true);
  assert.equal(imported.links[0].password, " secret ");
  assert.equal(imported.links[0].note, "legacy note");
  assert.equal(imported.links[0].snippets[0].code, stored.groups[0].links[0].snippets[0].code);
});

test("download URLs stay alive until the download can start", async (t) => {
  const app = await popup(t);
  app.click("#export-btn");
  assert.equal(app.calls.downloads[0].filename, "dev-links-export.json");
  assert.equal(app.calls.revocations.length, 0);
  assert.equal(app.query("a[download]"), null);
});

test("opening all links uses background tabs so the popup survives the batch", async (t) => {
  const app = await popup(t);
  app.click(".group-menu-btn");
  app.click('.group-menu [data-action="open-all"]');
  await app.settle();
  assert.equal(app.calls.tabs.length, 1);
  assert.equal(app.calls.tabs[0].active, false);
});

test("Escape cancels modals and rename without saving", async (t) => {
  const app = await popup(t);
  app.click(".add-link-btn");
  app.query("#modal-link-name").dispatchEvent(new app.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(app.query(".modal"), null);
  app.click(".group-menu-btn");
  app.click('.group-menu [data-action="rename"]');
  app.change(".group-name-input", "Changed");
  app.query(".group-name-input").dispatchEvent(new app.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await app.settle();
  assert.equal(app.snapshot().groups[0].name, "Projects");
  assert.equal(app.calls.writes.length, 0);
});
