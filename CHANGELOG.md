# Changelog

Notable changes to Dev Links. Extension versions follow semantic versioning; the JSON backup schema remains `1.0`.

## [1.2.0] - 2026-10-21

### Added

- **Export for 1Password:** locally generated `dev-links-1password.csv` with Title, Website, Username, Password and Notes columns; no API key or new permissions.
- Group names, branches, legacy notes and numbered snippets in Notes. Bookmark-only links include their URL in Notes for Secure Note imports.
- CSV quoting that preserves Unicode, commas, quotes, password whitespace and multiline snippet contents, including links hidden by search or in locked/collapsed groups.
- An accessible export-format dialog with JSON backup and 1Password CSV options, plaintext-file warnings, keyboard navigation, cancellation and disabled CSV export when no links exist.
- Nine export regression tests, bringing the suite to 50 tests, and real Chromium checks for CSV downloads, dialog layout and keyboard focus.

### Changed

- The header Export button now opens a format chooser. JSON backup, per-group export and recovery export formats remain unchanged.
- README includes 1Password column mapping, safe migration steps and unpacked-extension update instructions. CSV export is a one-time migration, not synchronization; files are not encrypted and should not be opened in spreadsheets.

## [1.1.2] - 2026-10-20

### Fixed

- Validate stored/imported data and HTTP/HTTPS URLs, escape user-controlled HTML, support recovery exports and retain existing data when storage operations fail.
- Serialize saves; preserve password whitespace, snippet indentation/unchanged line endings and legacy notes; improve copy and password-reveal feedback.
- Restrict autofill to the saved URL's exact origin, skip unsuitable fields and use framework-friendly input events with accurate feedback. Remove broad website and `tabs` permissions.
- Apply group locks consistently to editing, moving, duplication and drag-and-drop. Support empty-group drops and preserve active search filters after changes.
- Avoid creating a group when Save Tab is canceled, handle invalid imports safely, and improve dialog errors, keyboard navigation and confirmation-button layout.

### Performance and checks

- Lazy-render collapsed groups and details, delegate events, cache search text and debounce search input.
- A 500-link synthetic jsdom benchmark improved from 1,605 ms to 195 ms per render (about 8× faster), with 79% fewer DOM nodes. These are not real-browser timing guarantees.
- Add 41 regression tests and an isolated Chromium smoke test of the real unpacked extension.

## [1.1.1] - 2026-10-02

- Improve snippet editing with a scrollable modal, simpler snippet fields and better button layout.
- Move snippets above credentials in link details and editing dialogs.
- Update release metadata and repository badges.

## [1.1.0] - 2026-04-14

- Add multiple code snippets per link with multiline editing and copy buttons.

[1.2.0]: https://github.com/raadkasem/dev-links-bookmark/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/raadkasem/dev-links-bookmark/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/raadkasem/dev-links-bookmark/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/raadkasem/dev-links-bookmark/releases/tag/v1.1.0
