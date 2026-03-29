# Dev Links Bookmark

![Visitors](https://komarev.com/ghpvc/?username=raadkasem&repo=dev-links-bookmark&color=blueviolet&style=flat-square)

Chrome extension to organize your developer links into groups — save, search, lock, and open them instantly.

## Features

- Create groups with color labels (e.g., "GenioMD", "DevOps", "Personal")
- Add, edit, and delete links with URL validation
- Optional notes per link — great for storing credentials, instructions, or context
- Notes expand/collapse inline with a one-click copy button
- Save current tab to any group with one click
- Search across all groups, links, and URLs
- Open all links in a group at once
- Drag and drop to reorder groups and links between groups
- Lock groups to prevent accidental edits or deletions
- Delete protection — type "Delete" to confirm removing groups with links
- Export & Delete option — export a group backup before deleting
- Import with Append or Replace mode
- Export all data or a single group as organized JSON
- Favicons auto-loaded for each link
- Collapsible groups (accordion style)
- Elegant light theme UI

## Screenshot

<!-- Add a screenshot here -->

## Export Format

```json
{
  "exportedAt": "2026-03-30T12:00:00.000Z",
  "version": "1.0",
  "totalGroups": 2,
  "totalLinks": 5,
  "groups": [
    {
      "name": "GenioMD",
      "color": "#6D5BD0",
      "links": [
        {
          "name": "Website",
          "url": "https://geniomd.com"
        },
        {
          "name": "Admin Dashboard",
          "url": "https://admin.geniomd.com",
          "note": "user: admin / pass: ****"
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

## License

[MIT](LICENSE)

## Author

**Raad Kasem** — [raadkasem.dev](https://raadkasem.dev) · [GitHub](https://github.com/raadkasem)
