const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright-core");
const { fixture } = require("./helpers.cjs");

const root = path.resolve(__dirname, "..");

(async () => {
  const tempRoot = path.join(os.tmpdir(), "opencode");
  await fs.mkdir(tempRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(tempRoot, "dev-links-test-"));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      // Use full Chromium with its new headless mode, not headless-shell (which
      // does not implement extensions or chrome://extensions).
      executablePath: process.env.CHROME_PATH || chromium.executablePath(),
      headless: true, viewport: { width: 400, height: 580 }, acceptDownloads: true,
      ignoreDefaultArgs: ["--disable-extensions"],
      args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
    });
    // No fixture URLs or favicon hostnames are sent to external websites.
    await context.route(/^https?:/, (route) => route.abort());
    const page = context.pages()[0];
    await page.goto("chrome://extensions/");
    await page.waitForFunction(() => {
      const list = document.querySelector("extensions-manager")?.shadowRoot?.querySelector("extensions-item-list")?.shadowRoot;
      return Array.from(list?.querySelectorAll("extensions-item") || []).some((item) => item.data?.name === "Dev Links");
    });
    const id = await page.evaluate(() => Array.from(document.querySelector("extensions-manager").shadowRoot.querySelector("extensions-item-list").shadowRoot.querySelectorAll("extensions-item")).find((item) => item.data.name === "Dev Links").id);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && /Content Security Policy|Uncaught|TypeError/.test(message.text())) errors.push(message.text());
    });
    await page.goto(`chrome-extension://${id}/popup.html`);
    await page.waitForSelector(".empty-state");
    await page.evaluate((stored) => chrome.storage.local.set({ devlinks: stored }), fixture());
    await page.reload();
    await page.waitForSelector(".link-row");
    const permissions = await page.evaluate(() => chrome.permissions.getAll());
    assert.deepEqual(permissions.permissions.sort(), ["activeTab", "scripting", "storage"]);
    assert.deepEqual(permissions.origins, []);
    assert.equal(await page.locator(".cred-row, .snippet-code").count(), 0);

    await page.locator(".link-row").hover();
    await page.locator('[data-action="credentials"]').click();
    await page.locator(".cred-reveal-inline").click();
    assert.equal(await page.locator(".cred-pw-text").textContent(), " secret ");
    await page.locator('[data-action="edit-link"]').click();
    assert.equal(await page.locator("#modal-link-password").inputValue(), " secret ");
    await page.locator("#modal-link-name").fill('Dashboard "edited"');
    await page.locator("#modal-save").click();
    await page.waitForSelector(".modal", { state: "detached" });
    const saved = await page.evaluate(async () => (await chrome.storage.local.get("devlinks")).devlinks);
    assert.equal(saved.groups[0].links[0].password, " secret ");
    assert.equal(saved.groups[0].links[0].snippets[0].code, fixture().groups[0].links[0].snippets[0].code);

    await page.locator(".group-menu-btn").first().click();
    await page.locator('.group-menu [data-action="toggle-lock"]').click();
    await page.waitForSelector(".group-lock-icon");
    assert.equal(await page.locator('[data-action="duplicate-link"]').count(), 0);
    await page.evaluate(() => showSaveTabModal("Example", "https://example.com"));
    assert.equal(await page.locator('#modal-link-group option[value="group-a"]').count(), 0);
    await page.keyboard.press("Escape");
    await page.locator(".group-menu-btn").first().click();
    await page.locator('.group-menu [data-action="toggle-lock"]').click();
    await page.waitForSelector(".group-lock-icon", { state: "detached" });

    await page.locator(".link-row").dragTo(page.locator('.group[data-id="group-b"] .group-header'));
    await page.waitForFunction(async () => (await chrome.storage.local.get("devlinks")).devlinks.groups[1].links.length === 1);
    assert.equal(await page.locator('.group[data-id="group-a"] .link-row').count(), 0);

    await page.locator("#add-group-btn").click();
    await page.locator(".group-name-input").fill("Browser-created group");
    await page.keyboard.press("Enter");
    await page.waitForFunction(async () => (await chrome.storage.local.get("devlinks")).devlinks.groups.some((group) => group.name === "Browser-created group"));

    await page.locator("#import-file").setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ groups: [{ name: "Bad", links: [{ name: "bad", url: "javascript:alert(1)" }] }] })) });
    await page.waitForSelector("#status-message:not([hidden])");
    assert.equal(await page.locator(".modal").count(), 0);
    assert.equal(await page.evaluate(async () => (await chrome.storage.local.get("devlinks")).devlinks.groups.length), 3);

    const downloadPromise = page.waitForEvent("download");
    await page.locator("#export-btn").click();
    const download = await downloadPromise;
    const exported = JSON.parse(await fs.readFile(await download.path(), "utf8"));
    assert.equal(exported.groups.length, 3);
    assert.equal(exported.groups[1].links[0].password, " secret ");
    assert.equal(exported.groups[1].links[0].snippets[0].code, fixture().groups[0].links[0].snippets[0].code);

    await page.locator("#import-file").setInputFiles({ name: "roundtrip.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(exported)) });
    await page.locator("#import-replace").click();
    await page.waitForSelector(".modal", { state: "detached" });
    await page.locator(".group-menu-btn").nth(1).click();
    await page.locator('.group-menu [data-action="delete"]').click();
    const fits = await page.locator(".modal").evaluate((modal) => {
      const box = modal.getBoundingClientRect();
      return Array.from(modal.querySelectorAll(".modal-actions button")).every((button) => {
        const bounds = button.getBoundingClientRect();
        return bounds.left >= box.left && bounds.right <= box.right;
      });
    });
    assert.equal(fits, true, "Delete confirmation buttons must fit the popup");
    await page.locator("#modal-confirm-input").fill("Delete");
    await page.locator("#modal-confirm").click();
    await page.waitForSelector(".modal", { state: "detached" });
    assert.equal(await page.evaluate(async () => (await chrome.storage.local.get("devlinks")).devlinks.groups.length), 2);
    assert.deepEqual(errors, []);
    if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH });
    console.log("Chromium smoke passed: real MV3 storage/permissions, CRUD, locking, native drag-and-drop, import/export and dialog layout. No page or CSP errors.");
  } finally {
    await context?.close();
    // Only the disposable profile created by this test is removed.
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
