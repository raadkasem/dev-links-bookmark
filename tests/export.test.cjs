const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createPopup, fixture, parseCSV } = require("./helpers.cjs");

async function popup(t, options) {
  const app = await createPopup(options);
  t.after(() => { assert.equal(app.errors.length, 0, app.errors[0]?.message); app.close(); });
  return app;
}

const header = ["Title", "Website", "Username", "Password", "Notes"];

test("export chooser warns about plaintext, downloads only after selection, and can be canceled", async (t) => {
  const app = await popup(t);
  app.query("#export-btn").focus();
  app.click("#export-btn");
  assert.equal(app.query('[role="dialog"] h2').textContent, "Export Links");
  assert.match(app.query("#export-1password").textContent, /Export for 1Password/);
  assert.match(app.query(".export-warning").textContent, /Unencrypted.*passwords/);
  assert.match(app.query(".export-warning").textContent, /not a spreadsheet/);
  assert.equal(app.query(".modal").textContent.includes(" secret "), false);
  assert.equal(app.calls.downloads.length, 0);
  app.click("#modal-cancel");
  assert.equal(app.query(".modal"), null);
  assert.equal(app.document.activeElement.id, "export-btn");
  assert.equal(app.calls.downloads.length, 0);
  assert.equal(app.calls.writes.length, 0);
});

test("1Password CSV maps login fields and preserves group, branch, legacy note and every snippet", async (t) => {
  const stored = fixture();
  stored.groups[0].links[0].snippets.push({ id: "snippet-b", code: "\n  second snippet\n" });
  const app = await popup(t, { stored });
  const csv = app.window.onePasswordCSV(app.window.__getData().groups);
  assert.deepEqual(parseCSV(csv), [header, [
    "Dashboard", "https://example.com/login", "admin", " secret ",
    'Group: Projects\n\nBranch: main\n\nNotes:\nlegacy note\n\nSnippet 1:\n  echo "hello"\r\nnext  \n\nSnippet 2:\n\n  second snippet\n',
  ]]);
  assert.ok(csv.endsWith("\r\n"));
  assert.equal(csv.includes("snippet-a"), false);
});

test("CSV quoting roundtrips commas, quotes, Unicode and all newline styles without trimming", async (t) => {
  const stored = fixture();
  const link = stored.groups[0].links[0];
  stored.groups[0].name = 'مواقع, "Work"';
  link.name = 'Dashboard, "开发"';
  link.url = "https://example.com/login?values=a,b";
  link.username = ' user,"name"\r\nnext ';
  link.password = ' \t=secret,"quoted"\r\nline\nother\rlast  ';
  link.branch = 'feature/"csv",test';
  link.note = "line one\rline two\nline three\r\nfinal";
  link.snippets[0].code = '\r\n  echo "a,b"\r\n\t=command\n';
  const app = await popup(t, { stored });
  const csv = app.window.onePasswordCSV(app.window.__getData().groups);
  const rows = parseCSV(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].length, 5);
  assert.deepEqual(rows[1].slice(0, 4), [link.name, link.url, link.username, link.password]);
  for (const value of [stored.groups[0].name, link.branch, link.note, link.snippets[0].code]) assert.ok(rows[1][4].includes(value));
  assert.ok(csv.includes('"Dashboard, ""开发"""'));
});

test("formula-like credentials remain exact rather than acquiring spreadsheet escape prefixes", async (t) => {
  const app = await popup(t);
  for (const value of ['=HYPERLINK("https://example.com")', "+secret", "-secret", "@secret", "\tsecret", "\rsecret"]) {
    const groups = fixture().groups;
    groups[0].links[0].username = groups[0].links[0].password = value;
    const row = parseCSV(app.window.onePasswordCSV(groups))[1];
    assert.equal(row[2], value);
    assert.equal(row[3], value);
  }
});

test("bookmark-only and partial logins are included with empty credentials and a Secure Note URL", async (t) => {
  const stored = fixture();
  const link = stored.groups[0].links[0];
  delete link.username;
  delete link.password;
  stored.groups[1].links.push({ id: "username-only", name: "Username only", url: "https://example.com/user", username: "admin" });
  stored.groups[1].links.push({ id: "password-only", name: "Password only", url: "https://example.com/pass", password: " secret " });
  const app = await popup(t, { stored });
  const rows = parseCSV(app.window.onePasswordCSV(app.window.__getData().groups));
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[1].slice(2, 4), ["", ""]);
  assert.ok(rows[1][4].includes(`Website: ${link.url}`));
  assert.deepEqual(rows[2].slice(2, 4), ["admin", ""]);
  assert.deepEqual(rows[3].slice(2, 4), ["", " secret "]);
});

test("CSV download includes locked, collapsed and searched-out links without changing saved data", async (t) => {
  const stored = fixture();
  stored.groups[0].locked = stored.groups[0].collapsed = true;
  stored.groups[1].links.push({ id: "bookmark", name: "Bookmark", url: "https://example.com/bookmark" });
  const app = await popup(t, { stored });
  app.change("#search-input", "nothing matches");
  app.window.render();
  app.click("#export-btn");
  app.click("#export-1password");
  await app.settle();
  assert.equal(app.calls.downloads[0].filename, "dev-links-1password.csv");
  assert.equal(app.calls.blobs[0].type, "text/csv;charset=utf-8");
  const rows = parseCSV(await app.downloadText());
  assert.deepEqual(rows[0], header);
  assert.equal(rows.length, 3);
  assert.equal(rows[1][3], " secret ");
  assert.equal(rows[2][0], "Bookmark");
  assert.equal(app.query(".modal"), null);
  assert.equal(app.query("a[download]"), null);
  assert.equal(app.calls.revocations.length, 0);
  assert.equal(app.calls.writes.length, 0);
  assert.deepEqual(app.snapshot(), stored);
  assert.deepEqual(app.persisted(), stored);
});

test("empty data disables 1Password export while keeping an empty JSON backup available", async (t) => {
  const app = await popup(t, { stored: { groups: [] } });
  app.click("#export-btn");
  assert.equal(app.query("#export-1password").disabled, true);
  assert.match(app.query(".modal p").textContent, /no links/);
  app.click("#export-1password");
  assert.equal(app.calls.downloads.length, 0);
  assert.equal(app.window.exportFor1Password(), false);
  assert.equal(app.calls.downloads.length, 0);
  app.click("#export-json");
  await app.settle();
  const exported = JSON.parse(await app.downloadText());
  assert.deepEqual(exported.groups, []);
  assert.equal(exported.totalLinks, 0);
});

test("JSON backup and per-group export retain the existing schema and exact credential values", async (t) => {
  const app = await popup(t);
  app.click("#export-btn");
  app.click("#export-json");
  await app.settle();
  const exported = JSON.parse(await app.downloadText());
  assert.equal(exported.version, "1.0");
  assert.equal(exported.groups.length, 2);
  assert.equal(exported.groups[0].links[0].password, " secret ");
  assert.equal(exported.groups[0].links[0].snippets[0].code, fixture().groups[0].links[0].snippets[0].code);
  app.click(".group-menu-btn");
  app.click('.group-menu [data-action="export-group"]');
  assert.equal(app.calls.downloads[1].filename, "dev-links-projects.json");
  assert.equal(JSON.parse(await app.downloadText(1)).groups.length, 1);
  assert.equal(app.calls.writes.length, 0);
});

test("a failed CSV download keeps the dialog and saved data intact for retry", async (t) => {
  const app = await popup(t);
  const click = app.window.HTMLAnchorElement.prototype.click;
  app.window.HTMLAnchorElement.prototype.click = () => { throw new Error("Download unavailable"); };
  app.click("#export-btn");
  app.click("#export-1password");
  await app.settle();
  assert.ok(app.query(".modal"));
  assert.equal(app.query("#export-1password").disabled, false);
  assert.match(app.query("#status-message").textContent, /could not be completed/);
  assert.equal(app.query("a[download]"), null);
  app.window.HTMLAnchorElement.prototype.click = click;
  app.click("#export-1password");
  await app.settle();
  assert.equal(app.query(".modal"), null);
  assert.equal(app.calls.downloads[0].filename, "dev-links-1password.csv");
  assert.deepEqual(app.persisted(), fixture());
  assert.equal(app.calls.writes.length, 0);
});
