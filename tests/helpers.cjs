const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "popup.html"), "utf8");
const source = fs.readFileSync(path.join(root, "popup.js"), "utf8");

function fixture() {
  return { groups: [{
    id: "group-a", name: "Projects", color: "#6D5BD0", collapsed: false, locked: false,
    links: [{ id: "link-a", name: "Dashboard", url: "https://example.com/login", username: "admin", password: " secret ", branch: "main", note: "legacy note", snippets: [{ id: "snippet-a", code: "  echo \"hello\"\r\nnext  " }] }],
  }, { id: "group-b", name: "Other", color: "#2563EB", collapsed: false, locked: false, links: [] }] };
}

async function createPopup(options = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error));
  const dom = new JSDOM(options.html || html, { url: "https://extension.test/popup.html", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole });
  const { window } = dom;
  let persisted = options.stored === undefined ? fixture() : options.stored;
  const calls = { writes: [], tabs: [], scripts: [], copies: [], downloads: [], revocations: [], listeners: 0 };
  const storage = { fail: options.failWrite || false };
  window.structuredClone = structuredClone;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const addEventListener = window.EventTarget.prototype.addEventListener;
  window.EventTarget.prototype.addEventListener = function (...args) {
    calls.listeners++;
    return addEventListener.apply(this, args);
  };
  Object.defineProperty(window.navigator, "clipboard", { value: { writeText: async (text) => {
    if (options.failCopy) throw new Error("Clipboard denied");
    calls.copies.push(text);
  } } });
  window.URL.createObjectURL = () => "blob:test";
  window.URL.revokeObjectURL = (url) => calls.revocations.push(url);
  window.HTMLAnchorElement.prototype.click = function () { calls.downloads.push({ filename: this.download, url: this.href }); };
  window.chrome = {
    storage: { local: {
      get: async () => {
        if (options.failRead) throw new Error("Storage unavailable");
        return { devlinks: persisted == null ? persisted : structuredClone(persisted) };
      },
      set: async (value) => {
        calls.writes.push(structuredClone(value.devlinks));
        if (options.beforeWrite) await options.beforeWrite(value);
        if (storage.fail) throw new Error("Quota exceeded");
        persisted = structuredClone(value.devlinks);
      },
    } },
    tabs: {
      query: async () => {
        if (options.failTabQuery) throw new Error("Tab unavailable");
        return [options.tab || { id: 1, title: "Example", url: "https://example.com/other" }];
      },
      create: async (tab) => { calls.tabs.push(tab); },
    },
    scripting: { executeScript: async (args) => {
      calls.scripts.push(args);
      return options.scriptResults || [{ result: { filled: 2 } }];
    } },
  };
  window.eval(`${options.source || source}\nwindow.__getData = () => data; window.__wait = () => typeof mutationQueue === 'undefined' ? Promise.resolve() : mutationQueue;`);
  await new Promise((resolve) => window.document.addEventListener("DOMContentLoaded", () => setImmediate(resolve), { once: true }));
  const query = (selector) => window.document.querySelector(selector);
  const click = (selector) => {
    const element = query(selector);
    if (!element) throw new Error(`Missing element: ${selector}`);
    element.click();
    return element;
  };
  const change = (selector, value) => {
    const element = query(selector);
    element.value = value;
    element.dispatchEvent(new window.Event("input", { bubbles: true }));
    return element;
  };
  const settle = async () => { await window.__wait(); await new Promise(setImmediate); };
  const drag = async (from, to) => {
    const transfer = { setData() {}, getData() { return ""; }, types: [] };
    for (const [type, selector] of [["dragstart", from], ["drop", to]]) {
      const event = new window.Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", { value: transfer });
      query(selector).dispatchEvent(event);
    }
    await settle();
  };
  return { window, document: window.document, query, click, change, settle, drag, calls, errors, storage,
    snapshot: () => structuredClone(window.__getData()), persisted: () => structuredClone(persisted),
    close: () => window.close() };
}

module.exports = { createPopup, fixture, source, html };
