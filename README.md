# Dev Links Bookmark

[![Latest release](https://img.shields.io/github/v/release/raadkasem/dev-links-bookmark?style=flat-square)](https://github.com/raadkasem/dev-links-bookmark/releases/latest)
![Repository views](https://komarev.com/ghpvc/?username=raadkasem-dev-links-bookmark&label=Repository+views&color=blueviolet&style=flat-square)
![GitHub Downloads](https://img.shields.io/github/downloads/raadkasem/dev-links-bookmark/total?style=flat-square)

Chrome extension to organize your developer links into groups — save, search, lock, and open them instantly.

**Latest version: [v1.1.2](https://github.com/raadkasem/dev-links-bookmark/releases/tag/v1.1.2)** · [Download extension ZIP](https://github.com/raadkasem/dev-links-bookmark/releases/download/v1.1.2/dev-links-v1.1.2.zip)

## What's new in v1.1.2

- **Safer data handling:** validated imports, escaped user content, HTTP/HTTPS-only links, and recovery export for malformed saved data.
- **Reliable saves:** failed storage writes keep previous data intact; dialogs stay open for retry and rapid changes are saved in order.
- **Credentials and snippets:** preserve password whitespace, snippet indentation and unchanged line endings; improve copy/reveal feedback and retain legacy notes when copying or importing.
- **Safer autofill:** exact-origin checks, editable login-field detection, framework-friendly input events, and accurate success/failure messages. Removed broad website and `tabs` permissions.
- **Consistent locks and navigation:** prevent locked-group edits through duplication, moving, saving tabs and drag-and-drop; support drops into empty groups and preserve search filters after changes.
- **Small UI fixes, not a redesign:** visible errors, keyboard navigation, Escape-to-close dialogs, accessible action buttons and properly wrapping delete-confirmation buttons.
- **Faster rendering:** lazy details/collapsed groups, delegated events, cached search text and debounced search. A 500-link synthetic jsdom benchmark improved from 1,605 ms to 195 ms per render (about 8× faster), with 79% fewer DOM nodes; these are not real-browser timing guarantees.
- **Regression coverage:** 41 automated tests plus an isolated Chromium smoke test of the real unpacked extension.

## Screenshots

<p align="center">
  <img src="screenshots/main.png" alt="Main view" width="200">
  <img src="screenshots/group.png" alt="Group menu" width="200">
  <img src="screenshots/add-link.png" alt="Add link" width="200">
  <img src="screenshots/import.png" alt="Import" width="200">
</p>

## Features

- Create groups with color labels (e.g., "Projects", "DevOps", "Personal")
- Add, edit, and delete links with URL validation
- Credentials per link: username/email, password (masked with reveal toggle), repo/branch
- Branch field with autocomplete suggestions (main, develop, staging, production, etc.)
- Inline credentials card — click any link to expand, with copy buttons per field
- Autofill button — fills editable login fields only on the saved URL's exact origin (protocol, host and port)
- Code snippets per link — repeater field for storing commands (Docker, CLI, etc.) with multiline support
- Each snippet has a one-click copy button
- Separate `</>` toggle icon to expand/collapse snippets independently from credentials
- Save current HTTP/HTTPS tab to an unlocked group
- Search across all groups, links, and URLs
- Open all links in a group in background tabs
- Drag and drop to reorder groups and links between groups
- Lock groups to prevent edits, deletions, link duplication and drag-and-drop changes
- Delete protection — confirm dialog for links, type "Delete" for groups with links
- Export all data or a single group as organized JSON
- Export then Delete option for safe group removal
- Validated JSON import with Append or Replace mode (up to 10 MB); preserves lock/collapse state
- Favicons auto-loaded for each link
- Collapsible groups (accordion style)
- Elegant light theme UI

## Export Format

**Security:** credentials are stored locally and exported in **plain text**, not encrypted. The password below is only an example; actual exports contain the full saved password. Treat exports as sensitive files. Group locking prevents accidental changes; it is not encryption or access control. Favicons are requested from Google's favicon service using each link's hostname.

The JSON `version` field is the export schema version (`1.0`), independent of the extension release version.

```json
{
  "exportedAt": "2026-03-30T12:00:00.000Z",
  "version": "1.0",
  "totalGroups": 1,
  "totalLinks": 1,
  "groups": [
    {
      "name": "Projects",
      "color": "#6D5BD0",
      "collapsed": false,
      "locked": false,
      "links": [
        {
          "name": "Dashboard",
          "url": "https://dashboard.project.com",
          "username": "admin@project.com",
          "password": "****",
          "branch": "main",
          "snippets": [
            { "code": "docker-compose up -d" },
            { "code": "docker logs -f app" }
          ]
        }
      ]
    }
  ]
}
```

## Install

1. Download and extract the [v1.1.2 extension ZIP](https://github.com/raadkasem/dev-links-bookmark/releases/download/v1.1.2/dev-links-v1.1.2.zip), or clone this repo
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the folder containing `manifest.json`

After updating, click **Reload** for Dev Links in `chrome://extensions`. No build step is needed. The extension uses only `storage`, `activeTab` and `scripting` permissions; it does not request access to all websites. Autofill requires opening the popup from the toolbar on the website you want to fill. Embedded cross-origin login forms and protected browser pages are not supported.

## Development and checks

Node.js 20 or newer is needed only for development; there are no runtime dependencies.

```sh
npm ci
npm test
npm run benchmark
```

The benchmark compares DOM rendering against `v1.1.1` using 500 links, three snippets per link and half the groups collapsed. Its jsdom timings are synthetic, not browser responsiveness measurements.

For an isolated, headless Chromium smoke test using the real unpacked extension:

```sh
npx playwright-core install chromium
npm run test:browser
```

The browser test uses its own temporary profile and fixture data, never your installed extension's storage. An existing Chromium-for-Testing binary can be selected with `CHROME_PATH`; set `EXTENSION_PATH` to test an extracted release ZIP instead of the working tree. Tests cover real extension storage, imports/exports, dialogs, locking and drag-and-drop. Toolbar-granted `activeTab` access and site-specific autofill should also be checked manually before publishing.

## Release workflow

- `main` tracks the latest stable, tagged release.
- Develop fixes on `fix/*` or features on `feature/*` branches.
- Prepare and validate each release on `release/<version>` (for example, `release/1.1.2`), updating `manifest.json` and this README.
- Merge the completed release into `main`, tag that commit as `v<version>`, and push `main`, the release branch and the tag.
- Publish a GitHub release with a ready-to-load ZIP containing only the extension files, README and license—not development dependencies or tests.

## License

[MIT](LICENSE)

## Author

**Raad Kasem** — [raadkasem.dev](https://raadkasem.dev) · [GitHub](https://github.com/raadkasem)
