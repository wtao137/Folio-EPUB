# Folio

A clean, installable EPUB reader for Edge and Chrome. Folio runs entirely in the browser: no account, backend, or desktop executable.

![Folio reader preview](docs/reader-preview.png)

## Features

- **v92.4:** Canvas-first paragraph preparation, width-only reflow without unnecessary DOM replacement, faster stable line-spacing updates, and a fix for EPUB text containers narrower than the outer page. Eligible list/quotation prose is supported; native-layout fallback remains. See [typography implementation](TYPOGRAPHY_IMPLEMENTATION.md).

- **v92.0:** Better-justified English lines using bounded microtracking and expanded, conservatively penalized TeX hyphenation opportunities; compressed CJK spacing markup; deferred line validation after pagination geometry is available. Actual Chromium before/after samples are provided separately.

- **v91.9:** User-opted full justification of prose, restrained English hyphenation with Knuth–Plass breaks, quality-controlled native justification fallback, and improved single-pass paragraph planning.
- **v91.8:** Knuth–Plass now explicitly distributes measured CJK character gaps and English word spacing within justified mixed-language lines, with a final browser-shaping correction and bounded performance.

- **v91.4:** Repair trimmed word spaces in native display and inline MathML (such as piecewise “if x” conditions). Correct spacing using native `<mspace>` elements and preserve original text.

- Optional **Knuth–Plass paragraph typesetting** with Pretext-demo-inspired spacing penalties, exact word-space fitting, TeX-style hyphenation, multilingual punctuation handling, atomic inline MathML and safe superscript footnote references. Complex EPUB markup retains native layout. See [typography implementation](TYPOGRAPHY_IMPLEMENTATION.md).

- Distraction-free paginated reading, adaptive 1–3 columns, click-or-hold margin turning, and a concise shortcut guide.
- English and Chinese fonts, Paper/Warm/Night/System themes, publisher-font override, and optional paragraph optimization with English TeX hyphenation.
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

Chinese typography offers two unified choices: **Source Han / Noto Serif** and **Source Han / Noto Sans**. Folio first checks installed Source Han or Noto CJK Regular fonts, then requests the official **Noto SC** Regular/Bold webfonts from `fonts.googleapis.com` and `fonts.gstatic.com` only when needed. Other installed fonts remain available from the font menu. No manual font upload is required and no font files are bundled.

Books, reading positions, and shelves remain in your browser's storage. The PWA caches application files for offline use, not imported EPUBs or dictionary requests. Export a ZIP backup before changing browsers or hosting origins.

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

## v91.1 update

A new **Improved line breaking** switch is available in Settings → Typography (off by default). Image previews now have **Fit page / Fit width / 100%** modes. Clicking blank margins turns pages without hover arrows; holding continues fast turning. For the Pretext and Knuth–Plass assessment, see [TYPOGRAPHY_EVALUATION.md](TYPOGRAPHY_EVALUATION.md). The original v91 Web Speech engine is retained.

## SICP and other mathematical EPUBs

MathML 3 named <mspace> sizes such as `thickmathspace` are converted to numeric MathML Core dimensions in the in-browser chapter DOM. The EPUB archive is not changed. Footnote links written as `footnote_link` or `#FOOT4` receive the reader's semantic-footnote treatment, with conflicting publisher superscript margins and offsets neutralized. Note hover previews and link navigation are preserved.

English TeX-pattern hyphenation is optional. Folio's quality mode compares a non-hyphenated Knuth–Plass plan with a hyphenated plan, penalizes unnecessary breaks, and restores the safe browser layout when geometry verification fails. This does not provide full TeX microtypography, multi-page paragraph optimization or breakpoints inside MathML.

Run `python tests/sicp_real_epub_v916.py` with `SICP_EPUB=/path/to/sicp.epub` to reproduce book-specific tests (the user's EPUB is **not** packaged).

See `HYPHENATION_LICENSE.txt` for the freely redistributable en-US hyphenation pattern notice.
