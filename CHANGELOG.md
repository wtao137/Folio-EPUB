# Changelog

## v29 — Faster asset loading and clearer navigation (2026-11-13)

- Prepare illustration-heavy chapters with at most six concurrent EPUB asset inflations and a bounded queue of HTML rewrite jobs. Identical asset requests share a single in-flight decode, and results from a book closed mid-load are discarded.
- Improve table previews by retaining safe inline emphasis, code, superscript and subscript tags, without copying publisher scripts, styles, or arbitrary HTML into the application UI.
- Correct Contents highlighting when multiple subsection anchors share the same visible spread: use the first visible text position as well as page geometry.
- When opening Contents in a long book, scroll the list to the active entry without an animated jump.
- Refine the expanded table typography for scientific notation.
- Regression-test image-heavy chapters, long numbered lists, same-page TOC subsections, responsive 1–3 column layouts, and a Chinese EPUB.

## v28 — Non-destructive pagination and detail views (2026-11-10)

- Preserve EPUB publisher-defined inline table widths and `!important` priorities when fitting oversized tables; restore the originals on responsive repagination.
- Add an optional expanded-table view for cramped/oversized tables. It reconstructs text/cell spans safely without injecting arbitrary EPUB HTML into the application document.
- Add Fit / Actual size controls for EPUB illustrations and enable scrolling within the image preview without adding scrolling to the reading area.
- Improve keyboard navigation within the image viewer and adjust preview controls for narrow screens.
- Test viewport transitions, long ordered lists, responsive table layouts, image detail viewing, and navigation in a Chinese EPUB.

## v27 — Reading-engine and interface refinement (2026-11-10)

- Fixed a cached stylesheet mutation that accumulated duplicate search-highlight CSS after repeated chapter navigation.
- Added accessible, non-obstructive image previews with book captions, Escape/click-away dismissal and unchanged reading position.
- Measured overly wide tables against their actual single-column width, forcing cell wrapping only when necessary rather than letting content bleed across columns.
- Simplified footer metadata and refined narrow mobile navigation spacing.
- Regression-tested search, Settings, EPUB import, footnotes, and 1–3 column layouts in Chromium.


## v26

- Preserve first-visible-text position during CSS repagination, instead of relying on chapter percentage alone.
- Add safe touch-swipe page navigation and suppress the synthetic word-lookup click after a swipe.
- Improve figure/caption pagination, embedded image sizing, table-cell wrapping, mobile navigation, and reduced-motion handling.
- Retain all v25 storage and preferences without migration.

## v25 — Reliability and portability (2026-11-10)

- Added reading-data export and restore (settings, progress and bookmarks) without copying EPUB files.
- Added an optional request for persistent browser storage where available.
- Improved keyboard navigation and drawer accessibility: focus management, Escape to close, and no hidden page turns.
- Added per-archive case-insensitive ZIP-path indexing for faster resolution of publisher assets.
- Added import limits for unusually large or excessively expanded EPUB archives.
- Fixed stale cover URLs when reimporting an existing book.
- Made clearing all data stop safely if the underlying IndexedDB deletion fails.
- Updated PWA caching for quicker offline reopening, atomic shell installation and visible update notification.

## v24 — Font override control

- Added the option to override publisher-specified fonts while retaining respect for EPUB typography by default.

## v23 — Publisher typography

- Respected explicitly specified EPUB font families, including Chinese sans-serif passages.

## Earlier releases

v1–v22 introduced the paginated reader, responsive columns, mixed-script typography, Edge/Chrome read-aloud, bilingual dictionary, footnote navigation, library management, search, PWA installation, and UI improvements.
