# Folio

A clean, installable EPUB reader for Edge and Chrome. Folio runs entirely in the browser: no account, backend, or desktop executable.

![Folio reader preview](docs/reader-preview.png)

## Features

- Distraction-free, paginated reading with adaptive 1–3 column layouts and fast keyboard, wheel, and touch navigation.
- English and Chinese fonts, Paper/Warm/Night/System themes, and publisher-font override.
- Read aloud with available browser voices, bilingual support, and word/line tracking.
- Word lookup, bookmarks, chapter search, reading history, and a searchable table of contents.
- Local EPUB library with shelves, favorites, reading progress, and ZIP backup/restore.
- Installable PWA with an offline app shell. EPUB files are stored locally in IndexedDB.

## Use Folio

1. Deploy the contents of the PWA release ZIP to any HTTPS static site (such as GitHub Pages), or open the optional standalone HTML file directly in Edge/Chrome.
2. Open Folio, import an EPUB, and select a book.
3. To install the PWA, use the browser's **Install app** option when available.

> Keep the same site origin when updating: browser storage is origin-specific. Export a full-library ZIP before moving or upgrading.

## Fonts and privacy

Folio defaults to **Noto Serif SC** and offers **Noto Sans SC**. It first uses installed Noto CJK or Source Han fonts, then loads the corresponding Google Fonts webfont only when no local match exists. Google Fonts provides Simplified Chinese Regular and Bold faces through CSS2 with character-subset downloads. Select either in **Appearance → Chinese font**. They require access to `fonts.googleapis.com` and `fonts.gstatic.com`; the browser automatically requests additional character subsets as necessary.

Adobe **Source Han Serif/Sans CN** remain separate font choices. If those hosts cannot be reached, download the fonts from the [Adobe Serif](https://github.com/adobe-fonts/source-han-serif) or [Adobe Sans](https://github.com/adobe-fonts/source-han-sans) repositories and use **Appearance → Use your own Source Han files**. Uploaded font files stay in browser storage and are not sent to a server. Folio does not ship font binaries.

The reader and diagnostic clearly identify remote, user-imported, installed, and system fallback states. EPUBs and reading progress stay in browser storage. The PWA caches its application shell, but not books or external dictionary responses.

## Development

The PWA is a static HTML/CSS/JavaScript app with no build step. Regression tests are in `tests/` (Python + Playwright, and a Node.js service-worker test).

```bash
python -m pip install playwright
python -m playwright install chromium
python tests/smoke.py
node tests/service_worker_v88.cjs
```

See [CHANGELOG.md](CHANGELOG.md) for version history and [QUICK_START_PWA.md](QUICK_START_PWA.md) for deployment details.

## License

[MIT](LICENSE)
