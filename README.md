# Folio EPUB Reader v15 · PWA

## Installable PWA

Host the contents of this folder together on an HTTPS static website, with `index.html` at the root of the chosen folder. Or serve this folder at `http://localhost:PORT/` for local testing.

Open the page in Microsoft Edge or Chrome. The browser's "Install app" menu (or the Install app button when available) can install Folio. The service worker caches the app shell, including the single HTML reader and app icons, for offline relaunch. Imported EPUBs remain in IndexedDB.

IMPORTANT: `file://` (double-clicking index.html) is NOT eligible for PWA installation. The standalone HTML remains readable without hosting. Use HTTPS or localhost for PWA installation. The installed PWA is associated with the origin and path, and its library does not automatically migrate from a file:// or different-host copy.

## Faster chapter opening

- Shared stylesheet Blob URL: bundled English fonts aren't embedded into every chapter iframe.
- Small LRU cache of prepared chapter XHTML (6 entries).
- Idle-time pre-preparation for the next, previous and next-next chapters.
- Cached EPUB stylesheet rewriting (bounded to 24 entries).
- No EPUB is uploaded. The dictionary still needs internet access.

## Offline limitations

Book files, reading progress, narration with locally installed voices and bundled font resources can work offline. Online dictionaries and online natural voices require connectivity. For reliable installs from a local machine, keep using the same host/port or deploy to HTTPS hosting.
