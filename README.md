# Dev Links Bookmark

![Repository views](https://komarev.com/ghpvc/?username=raadkasem-dev-links-bookmark&label=Repository+views&color=blueviolet&style=flat-square)
![GitHub Downloads](https://img.shields.io/github/downloads/raadkasem/dev-links-bookmark/total?style=flat-square)

Chrome extension to organize your developer links into groups — save, search, lock, and open them instantly.

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

```json
{
  "exportedAt": "2026-03-30T12:00:00.000Z",
  "version": "1.0",
  "totalGroups": 2,
  "totalLinks": 5,
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

1. Clone or download this repo
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the project folder

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

The browser test uses its own temporary profile and fixture data, never your installed extension's storage. An existing Chromium-for-Testing binary can be selected with `CHROME_PATH`. Tests cover real extension storage, imports/exports, dialogs, locking and drag-and-drop. Toolbar-granted `activeTab` access and site-specific autofill should also be checked manually before publishing.

## License

[MIT](LICENSE)

## Author

**Raad Kasem** — [raadkasem.dev](https://raadkasem.dev) · [GitHub](https://github.com/raadkasem)
