const { execFileSync } = require("node:child_process");
const { performance } = require("node:perf_hooks");
const { createPopup, source } = require("./helpers.cjs");

const stored = { groups: Array.from({ length: 20 }, (_, group) => ({
  id: `group-${group}`, name: `Group ${group}`, color: "#6D5BD0", collapsed: group % 2 === 0,
  links: Array.from({ length: 25 }, (_, link) => ({
    id: `link-${group}-${link}`, name: `Dashboard ${link}`, url: `https://example.com/${group}/${link}`,
    username: "admin", password: "password", branch: "main",
    snippets: Array.from({ length: 3 }, (_, snippet) => ({ id: `snippet-${group}-${link}-${snippet}`, code: "  echo sample command\n".repeat(12) })),
  })),
})) };

(async () => {
  const baseline = execFileSync("git", ["show", "v1.1.1:popup.js"], { encoding: "utf8" });
  for (const [label, script] of [["v1.1.1", baseline], ["working tree", source]]) {
    const app = await createPopup({ stored, source: script });
    const timings = [];
    const listeners = app.calls.listeners;
    for (let run = 0; run < 3; run++) {
      const start = performance.now();
      app.window.render("");
      timings.push(performance.now() - start);
    }
    timings.sort((a, b) => a - b);
    console.log(JSON.stringify({ version: label, links: 500, collapsedGroups: 10, medianRenderMs: Math.round(timings[1]), domNodes: app.document.querySelectorAll("*").length, listenersAddedPerRender: (app.calls.listeners - listeners) / 3 }));
    app.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
