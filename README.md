## Folio v89 — Stable reading progress and mobile dictionary behavior (2026-11-15)

This release keeps Folio **strictly PWA-only** and compatible with v88 storage. The static reader works in Edge/Chrome without a Go server or native launcher.

- **Reading positions on sleep/background:** Finalize the current text anchor, update the progress record, and synchronously persist it on tab visibility loss, `pagehide`, and before unload. This fixes a race where a frozen PWA could miss the last scheduled animation-frame anchor or deferred write.
- **Word lookup that recovers after connection failures:** Session cache is now a 128-entry least-recently-used cache with 30-minute expiration. Only successful entries are cached; offline failures can be retried. Definitions and personal API credentials are not stored by this cache.
- **Improved dictionary popup under keyboard and zoom:** Place/clamp it to the visible `visualViewport` rather than the larger layout viewport, cap both dimensions, and restore default sizes when dismissed. Arriving network results do not cause placement flips.
- **App-shell cache:** `folio-shell-v89`, caching only HTML, web manifest and two app icons. User EPUB files stay inside IndexedDB. Online dictionary services still require internet access; no proxy or backend was introduced.

Run `python tests/reading_engine_v89.py` (Playwright Chromium) and `node tests/service_worker_v88.cjs` (generic app-shell cache unit test, updated to v89). Earlier suites remain available. Make a full-library ZIP backup before deploying updates.

## Folio v88 — Reading responsiveness and narration navigation (2026-11-14)

Folio is a **pure browser-based, installable PWA**; there is no Go server, native application, local dictionary proxy, or backend. Install or update the static site on HTTPS, retaining your existing origin to preserve locally stored EPUBs.

- **Faster narration line focus:** plain horizontal English paragraphs use fewer character-geometry queries when the TTS highlight advances to a new visual line. The safe sequential method is retained for complex inline markup, CJK and RTL text. The spoken text, visual line boundaries and EPUB DOM are unchanged.
- **Improved TTS word positioning:** sorted word offsets now use binary search, and line-only focus skips unnecessary word segmentation.
- **Home/End during narration:** jumping to the beginning/end of a chapter suspends automatic following and registers a reading-history entry. The narrator keeps playing; choose **Follow** or press **R** to return to the spoken text.
- **Safer PWA regression coverage:** v88 tests the app-shell-only offline cache logic with a simulated service worker (not a real HTTPS restart). EPUBs never enter Cache Storage.

Run `python tests/reading_engine_v88.py` for the targeted Chromium tests and `node tests/service_worker_v88.cjs` for the offline-cache unit test. Older suites are included under `tests/`. Back up your full library before any version upgrade.

## Folio v87 — Browse while listening and reliable narration following (2026-11-14)

- **Read while narration continues:** During speech, turning a page or entering a page number now suspends automatic page following so you can inspect earlier text, diagrams or references. Narration keeps playing; a compact **Follow** button in the TTS dock returns to the actual spoken position. The button appears only when needed; you can also press **R** while reading. It works from within the EPUB iframe. The preference is unchanged, and it resets with a new narration session.
- **Focus-off still follows:** Turning off visual word/line highlights no longer disables automatic page following; the speech boundary and displayed highlights are independent.
- **Skip unnecessary work:** When narration highlighting and automatic following are both off, speech boundary callbacks skip character geometry measurement.
- **Safety & compatibility:** PWA-only release, no database or backup schema changes, no native server, and no change to the core paginator. `tests/reading_engine_v87.py` verifies browsing, return, and focus-off following at 390 and 1360 CSS pixels; existing suites still apply.
- App shell cache: `folio-shell-v87` (application shell only, not EPUB files).

## Folio v86 — Faster narration in long chapters (2026-11-14)

This is a **pure browser/PWA release** based on v85, with no Go server, native launcher, or executable. The core EPUB rendering and layout algorithm has not been replaced.

- **Read aloud from distant positions:** a bounded, guarded lookup avoids scanning every narration passage's layout geometry to find the first spoken passage on the current spread of a long chapter. Complex layout falls back to the full scan.
- **Less work when restarting narration:** reuse the spoken-text/DOM-character mapping when the current chapter has not changed; text and visibility changes invalidate it. The cache is capped to avoid retaining exceptionally large maps.
- **Narration saves progress:** automatic paging triggered by word-level following now updates the saved reading position, using the existing debounced persistence mechanism.
- **Testing:** `python tests/reading_engine_v86.py` runs a 1,400-paragraph stress fixture at narrow, medium and wide screen sizes. The older tests for EPUB layout, fixed XHTML/SVG, bookmarks, library shelves, backup/restore, themes and held-button page turns are included.

The v86 app-shell service-worker cache was `folio-shell-v86`; only application shell resources are cached, not EPUB content or dictionary data. Existing library storage remains compatible and stays on your device. Real offline restart on HTTPS and browser natural voice event behavior have not been independently validated here.

---

## Folio v85 — Mixed-language narration and navigation reliability (2026-11-14)

Folio remains a **browser-only, static, installable PWA**. No server, executable, launcher, dictionary proxy, or new backend dependency is included. Upgrade in place on the same HTTPS origin to retain IndexedDB books and saved reading data.

- **More faithful narration from EPUB XHTML.** Preserve actual `<br>` line breaks in speech; omit CSS-hidden fragments, ruby pronunciation (`rt`/`rp`) and duplicate MathML annotation text. Speech offsets still map to the original rendered DOM for word/line highlighting, without rewriting the EPUB or changing pagination.
- **Better Chinese/English voice decisions.** Recognize meaningful explicitly language-tagged inline passages and split their speech chunks where appropriate. Strong script evidence overrides an inherited, book-wide `xml:lang` when the content is clearly in the other language. Manual voice selections still work.
- **Safer TTS chapter advancement.** If the next chapter fails to load, stop playback instead of re-reading the old chapter in a loop.
- **Held keyboard navigation without OS autorepeat.** A held arrow/Space/PageUp/PageDown now continues turning beyond the former subsecond timeout on systems with no native repeat events. Key release, focus, blur, visibility and panel changes still stop the timer; a 12-second no-repeat safety watchdog remains.
- **Dictionary popup stability.** Definition updates do not reposition the card. On viewport resize, any still-open lookup card is clamped inside the available window.
- **Tests.** New `tests/reading_engine_v85.py` covers mixed-language fake voices, hidden/ruby/annotation exclusions, explicit line breaks, held keys without native repeats, and popup geometry. Existing PWA/EPUB/layout/backup tests were rerun.

The app shell service-worker cache is `folio-shell-v85` and includes **only the application shell**, never the imported books. Narration voices and online dictionary APIs still depend on browser/provider availability. Real offline restart in a deployed PWA remains unverified in the restricted test environment.

## Folio v84 — Reading engine and narration (2026-11-14)

Folio remains a **pure static installable PWA**. This release strengthens chapter position retention during later image/font reflows and restores same-chapter bookmarks without reloading the EPUB iframe. Reading anchors now have a backward-compatible v2 representation with a small text context; ambiguous matches fall back to the old relative position. Both JSON and full-library ZIP imports preserve these anchors. Previously saved v1 anchors still work.

Read aloud now has **Previous / Next passage** buttons alongside Play/Pause and Stop. These skip the next speech chunk, not an entire printed page, and only show as active during playback or pause. Speech callbacks from canceled passages cannot advance playback twice. Use **Shift+Space** to turn one page backward; holding Space or page arrow keys remains available.

The quick-start file documents update requirements. No backend, launcher, server, proxy, executable or CDN-required shell component is added. EPUBs remain in IndexedDB and the PWA shell is cached by the service worker. Offline app-shell restart has not been validated on a real HTTPS deployment in this environment.

## Folio v83 highlights

- Browser-only PWA, with per-book Back/Forward navigation for deliberate jumps to a chapter, EPUB link, page-number jump, search result, bookmark or overall position (24-entry bounded history). Page turning stays untouched.
- Searchable table of contents, Unicode-normalized matching, first 220 matching entries rendered to avoid long list jank.
- Portable local-library architecture, full ZIP backups, offline app shell and prior v82 shelves unchanged.

## Folio v82 — Custom shelves, compact library, and bounded browsing (2026-11-14)

Folio remains a **pure static PWA**: all application code and EPUBs run in the browser. No Go server, native executable, dictionary proxy, or backend is included. Deploy the static files on the **same HTTPS origin** as your existing v81 installation, or use the optional standalone HTML without PWA installation.

### New library organization

- **Custom shelves:** Use **Manage shelves** to create up to 40 named collections. Each book can belong to multiple shelves; click **Add to shelf** beneath its cover to change membership. Shelves do not alter, move, or repackage the original EPUBs. Rename shelves inline, or remove shelves without removing their books.
- **Shelf filtering:** Use the new **Every shelf** selector alongside existing search, favorites, reading status, and sorting. All filters combine. A reset clears the shelf selector as well as search/status.
- **Compact list view:** Choose **Cover grid** or **Compact list** in the library toolbar. The choice is stored in reader settings and in exported reading-data backups.
- **Paged library:** At most 36 book cards are rendered per library page, reducing cover elements and unnecessary DOM work on large collections. Previous/Next controls appear only when needed. The sidebar is limited to 14 book shortcuts. Cover object URLs from non-visible library pages are revoked to avoid unbounded accumulation.
- **Portable collection metadata:** Shelf names and memberships are included in both JSON reading-data backups and complete-library ZIPs. Library ZIP restore remaps book IDs. Imports merge collections by normalized shelf name while retaining existing local shelves. Deleted books are removed from shelf membership only after the book itself was successfully deleted.

### Unchanged reading capabilities

The GPU-transformed page-turn engine, continuous wheel/keyboard/pointer navigation, book-wide progress navigator, mixed fixed/reflowable EPUB handling, bookmarks, search, word lookup, typography, voice reading, and theme choices remain in place. No changes to EPUB binary storage or to the v1 reading position/bookmark format.

### Validation

- Chromium regression tests for v78–v81 passed at narrow/medium/wide viewports, plus the new 43-EPUB library paging test, shelf add/toggle/rename/delete, JSON+ZIP roundtrip and the restored shelf selector.
- v82 visual checks exercised the grid, compact list and shelf manager at 390px and 1280px.
- Node.js syntax check passes; ZIP entry tests and release-file checks run during packaging.
- Live service-worker activation/offline restart still requires testing on a real HTTPS deployment. The included local-only offline test skips in this sandbox; do not treat that as a pass.

## Folio v81 — Favorites, book-wide progress navigator, and library cleanup (2026-11-14)

Remains a **pure, static installable PWA**. No local server, Windows launcher, native executable, backend or dictionary proxy. Updates over v80 on the same HTTPS origin preserve IndexedDB books and the existing reader settings.

- Favorite/unfavorite books with the star control on each library card, then use the **Favorites** status filter. Favorites are saved in existing reader settings and carried through JSON reading-data backups and complete library ZIP backups; complete-library restores remap identifiers when necessary. Deleting a book clears its favorite flag. No separate database migration.
- A filtered-out library now shows **Clear filters** rather than an empty-looking shelf. Sorting and search remain usable together with favorites.
- Click the footer reading percentage, or press **G** while reading, to open a restrained whole-book progress navigator. Drag or use keyboard arrow keys to choose an approximate book position and preview the target chapter; **Go to position** commits the jump. It uses the EPUB's approximate chapter weights and thus avoids presenting a misleading printed-page number. A same-chapter jump takes the fast path without reloading the chapter. Escape/outside clicks dismiss the popover without changing position.
- The existing held-key/mouse-wheel/page-button rapid turns, typography controls, bookmarks, TTS, book search, fixed-layout handling, restore/export, and theme system are retained.

## Folio v80 — PWA-only release, continuous pointer paging, and offline status (2026-11-14)

**Folio remains a pure, installable web app.** v80 removes the optional Windows launcher, Go executable and server-side dictionary proxy introduced in v79. No executable or backend is bundled. Serve the `index.html`, `sw.js`, `manifest.webmanifest`, and `icons/` files from one HTTPS origin, then install with Edge or Chrome's **Install app** option. `file://` works for the separate standalone HTML but is not an installable PWA; the full PWA needs an HTTPS origin (a development localhost server can be used for testing, but is not part of Folio).

The reader now supports **press-and-hold on both footer and edge page arrows**, as well as its existing continuous mouse wheel and held keyboard arrows. Pointer holding begins after 320 ms, starts at a measured pace and accelerates modestly, without building an unlimited page queue; releasing or leaving the button stops the turn. A long press does not cause a second click on release. The settings panel reports whether the installed service-worker app shell is active and offers **Check for app updates**. Book bytes remain in IndexedDB; only shell assets are cached by the service worker. Dictionary lookups are made directly by the browser over HTTPS and require network access and the providers' CORS permissions.

Existing v78/v79 library sorting, restore/export, reading positions, fonts, theme choices, TTS, notes, and book rendering are preserved. Apply the incremental update over v79, or extract the full PWA ZIP on the **same origin**. Do not change hosting domains or paths without exporting your full library first.

## Folio v79 — Organized library, automatic themes, and keyboard help (2026-11-14)

Built on v78, this release adds library sorting (recently opened/added, title, author, progress), reading-status filters and standalone original-EPUB export from each book card. These combine with the existing title/author search. A themed keyboard-shortcut dialog (`?`) and in-book Ctrl+F/Command+F work from both the main reader UI and the EPUB iframe; keyboard shortcuts do not interfere with text entry. Page tone now offers **System**, which follows the OS dark/light preference while leaving manual Paper, Warm and Night choices unchanged.

**PWA installation:** Host the app shell on HTTPS. For a local file without hosting, use the standalone HTML (not installable). Existing reading progress and books stay on the same browser origin.

## Folio v78 — Fixed-layout SVG and portable full-library backups (2026-11-14)

This release extends v77 rather than replacing the reader. **EPUB 3 standalone SVG spine pages** can now use an authored fixed canvas when the book declares a pre-paginated layout and the SVG provides a valid `viewBox` or numerical dimensions. The graphic is fitted to the available reading area without splitting across 1/2/3 prose columns. Reflowable SVG content retains the previous width-fitted behavior, and mixed-layout books switch between vector pages, fixed XHTML pages, and reflowable text in their ordinary spine order.

**A complete, portable library backup** is now available from **Appearance → Local storage → Back up entire library (.zip)**. It contains the original EPUB files (not rewritten), the reading positions and bookmarks, and the same appearance/voice preferences included in the smaller JSON backup. To transfer books to another browser profile, localhost origin or HTTPS installation, use **Restore library (.zip)** on the destination. Existing books are retained; duplicate books are merged by content-derived identifier and saved positions/bookmarks follow the restored books. Nothing is uploaded to a server.

The old **Export/Import reading data** JSON option remains available when only settings, positions and bookmarks need to be moved. In both restore paths, voice focus, quick-voice selection and online Chinese font weight now update their controls as well as the stored settings.

**Limits and caveats:** Full-library ZIP generation happens in browser memory and is capped at 420 MiB of source EPUB content (import archives have additional size, entry-count and expansion checks). Large collections are best backed up in smaller batches or by retaining originals separately. The ZIP is not encrypted: keep it private. Do not clear the source library until you have verified the restored books and reading positions. Fixed-layout support remains deliberately partial; complex spreads, interactive scripts, media overlays and DRM are outside scope. External word providers and cloud voices remain dependent on the browser/network.

**Validation:** Synthetic Chromium tests exercise 830/1360/2100 px viewports, fixed SVG canvas scaling, adjacent reflowable 1/2/3-column chapters, fixed XHTML navigation, Night mode, full-library ZIP export, and importing into a fresh browser session with chapter position restoration. The reproducible test is `tests/smoke.py` and uses a generated EPUB. These tests do not establish compatibility with all real-world fixed-layout publishers or browser storage policies.

## Folio v77 — Fixed-layout XHTML and technical EPUB reading

Folio now supports a **basic, intentionally conservative subset of EPUB 3 fixed-layout XHTML** in addition to its existing reflowable EPUB reading experience. When a package or spine item declares `rendition:layout=pre-paginated` and its XHTML document provides numerical viewport dimensions, Folio presents the publisher canvas as one fitted page. Absolute-positioned text and images retain their coordinates; switching themes or changing the window size does not reflow that canvas. This mode deliberately avoids overriding publisher fonts, paragraph metrics and heading styles. An EPUB lacking valid page dimensions keeps the previous reflowable behavior rather than risking an arbitrarily clipped fixed page.

Mixed books can alternate between fixed and reflowable chapters without altering the regular next/previous book order. The normal 1/2/3-column reading mode, bookmarks, search, TTS, and GPU page turns remain unchanged on reflowable chapters. Auxiliary sections and notes remain supported.

Scientific-reading improvements include proper `colspan` detection for table previews; 1200 px maximum full-table viewport on wide windows; safe copying of header IDs/`headers` and text alignment into the full-size inspection dialog; horizontal scrolling for wide block equations and preformatted code; and Shift+wheel to inspect these items without paging. Table/MathML data is copied through an allowlist rather than injecting arbitrary publisher HTML into the Folio application UI.

**Limitations:** This initial fixed-layout XHTML reader is a static scaled-canvas mode, not a complete EPUB fixed-layout engine. Some publisher-driven spreads, per-page orientation, interactive multimedia, JavaScript, custom viewport calculation, or media overlays may not work. XHTML pages lacking declared dimensions continue to reflow. SVG-only spine pages retain the prior fit-to-column renderer. DRM-protected EPUBs are not supported.

**Validation:** Chromium regression tests with synthetic EPUB fixtures and one-, two-, three-column reader viewports (840, 1360 and 2050 CSS px), and separate invalid-viewport tests. All retained v70–v76 Chromium regression suites passed on the final code. Attempts to retrieve a public-domain publisher EPUB in this environment failed; do not infer a guarantee of real-world compatibility. The implementation keeps existing book storage data and origin requirements unchanged.

## v76 — Scientific EPUBs, fallback links and robust navigation (2026-11-14)

This update extends v75's EPUB compatibility work without changing reading-data storage, the GPU page-turn engine, library layout, dictionary, typography choices, or natural-voice behavior.

- **Manifest fallback links now resolve correctly.** EPUB spine entries declaring an unsupported media type and a readable XHTML/SVG `fallback` already displayed correctly in v75, but hyperlinks and TOC entries pointing to the original manifest URL could still fail. Folio now maintains a strict, per-book alias from the original declared spine path to its explicitly resolved readable spine path. The alias applies equally to in-book clicks and TOC navigation; it does not allow links to arbitrary non-spine resources or remote content.
- **SVG fitting survives reflow.** The SVG-only chapter width rules used to be attached to the dynamic typography stylesheet, which gets replaced when changing fonts, width, or page tone. EPUB compatibility rules are now kept in their own stylesheet inside the sandboxed reader, surviving font/column/theme changes without adding work to each page turn.
- **Wide MathML equations remain inspectable.** Block-display MathML receives bounded, internal horizontal overflow rather than silently clipping the right-hand side of an unbreakable equation. Folio does not shrink mathematical notation, rewrite MathML markup, or force scrollbars for equations that fit.
- **Legacy EPUB 2 NCX heading groups.** NavPoints without their own `<content src>` now remain non-link group headings; they no longer accidentally inherit the first nested chapter's target. Children retain the correct nesting, labels and links.
- **EPUB container alternatives.** Where `META-INF/container.xml` contains more than one rootfile, Folio chooses the one identified as an OPF EPUB package instead of blindly choosing the first resource.
- **More robust navigation parsing.** Alternate, correctly declared `epub:type` namespace prefixes remain recognized even when malformed XHTML forces the book's navigation file through the HTML parser.

**Verification:** Chromium live-reader tests on synthetic XHTML, standalone SVG, MathML, alternate-rootfile, media-type-fallback, alternate-prefix EPUB navigation, and nested EPUB 2 NCX fixtures. Tested 840/1360/2050 px (one/two/three columns), link clicks through the iframe, Paper/Warm/Night transitions, fit and scroll metrics, and full v70–v75 regression suites for image/CSS resource rewriting, narration, TOC, search, precise bookmarks, footnotes, and auxiliary content. Public EPUB retrieval was unavailable in this runtime, so no new real-publisher EPUB was tested. Fixed-layout EPUBs and DRM remain outside this release's supported scope.

## v75 — EPUB navigation, auxiliary material and vector-spine compatibility (2026-11-14)

Folio now handles more valid EPUB 3 reading-order structures, navigation labels, semantic prefixes, and standalone SVG chapters. The release is designed to retain rapid GPU page turning and prior reading data.

- **Supplementary EPUB sections:** Content declared `linear="no"` in a valid EPUB spine (such as answer keys or auxiliary appendices) is absent from sequential page turns but can be opened through a TOC entry or a normal book link. The original page and saved reading progress remain intact, and **Back to text** returns to the original page even after navigating between auxiliary sections.
- **TOC hierarchy:** EPUB 3 navigation documents with non-link `<span>` labels retain visible, non-clickable group headings. The reader selects the `toc` nav even if the same file contains preceding `page-list` or `landmarks` navs. It recognizes the EPUB namespace regardless of chosen prefix, uses image alt text for image-only TOC links, and retains nested heading depth. Legacy EPUB 2 NCX contents remain supported.
- **Standalone SVG reading-spine documents:** SVG entries are wrapped in the existing sandboxed reader and fitted to page width, without changing the general multi-column reading pipeline. SVG links using `xlink:href` now navigate like regular EPUB links; SVG paint and resource fragment references remain supported.
- **Manifest fallback:** EPUB spine entries in an unsupported foreign format can resolve to a readable XHTML (or SVG) resource when a valid `fallback` chain is provided; cycles and unreadable chains are rejected.
- **Alternate EPUB semantic prefixes:** Note references, notes, endnotes, and EPUB-marked literary passages recognize correctly namespaced `type` attributes using a prefix other than `epub`; this also holds after book XHTML is serialized into the sandboxed iframe.
- **Bookmark safety:** Temporary auxiliary chapters cannot generate invalid bookmarks against ephemeral spine indices.

**Verification:** Chromium synthetic EPUB 3.3 and EPUB 2 fixtures across one-, two-, and three-column modes (830/1360/2100 px); tested nested auxiliary links, return-page restoration, legacy NCX, SVG in the live reader, semantic namespacing, TOC headings, and manifest fallback. Re-ran the v70–v74 search, bookmark, footnote, narration, CSS, and layout regression tests. No verified live-publisher EPUB corpus was available for this round; extremely unusual/DRM-protected EPUBs remain outside coverage.

## v74 — EPUB resource compatibility and Night-mode controls (2026-11-14)

This release improves compatibility with illustrations and publisher CSS in technical or illustrated EPUBs, and removes a brief low-contrast theme-switch artifact in Appearance settings. It does not change the EPUB library schema, saved reading positions, GPU pagination, images' deferred-loading priorities, speech playback or cross-chapter navigation.

- **Publisher CSS imports:** Import resolution now supports media-qualified stylesheets, cascade-layer-qualified imports, and `supports(...)` conditions. Imported styles are inserted at the original source position, with their conditions intact. External URLs are not fetched.
- **Quoted CSS asset paths:** Rewrites local assets whose quoted filenames contain spaces or parentheses, including publisher font files and diagrams, rather than leaving them as unresolved ZIP-relative URLs.
- **SVG fragment references:** Preserves internal `url(#gradient)`/`url(#mask)` paint references without rewriting them as EPUB files. For external SVG sprites used through CSS `url(...)` and SVG `<use href="...#symbol">`, the referenced `#id` is carried through to the resolved Blob URL.
- **Responsive images:** Tokenizes `srcset` candidates instead of splitting on every comma, preserving valid inline `data:` image URLs and rewriting adjacent EPUB-local alternatives safely.
- **Night settings:** Removes the transient background-color animation on settings dropdowns, which briefly placed light text on a pale transitioning background when switching from Paper/Warm to Night.

**Verification:** Synthetic EPUB 3 with CSS `@import` variants, imported assets containing spaces, SVG paint and sprite references, and data-URI/EPUB mixed `srcset`. Chromium tests at 390/830/1360px passed. Additional responsive settings screenshots at 360/600/1360px, and inherited speech, TOC, search, footnote and bookmark regressions at the existing 1/2/3-column widths were run. Search keyboard traversal had a one-off timing failure, then passed unchanged when rerun. Real publisher EPUB coverage is necessarily wider than this fixture.

## v73 — More resilient read-aloud narration (2026-11-14)

This release improves browser speech reliability without changing the page-turning engine, reading data, or presentation of publisher EPUB content.

- **Interrupted narration recovers safely:** An unexpected Chromium `interrupted` or `canceled` utterance event may leave Folio claiming to read while silent. A one-time, per-segment retry now attempts to recover. Persistent failure stops playback with an actionable message instead of retrying indefinitely.
- **Resume near the spoken word:** On supported voices, the retry starts from the last observed word boundary rather than replaying the entire speech chunk. Highlight offsets remain tied to the original DOM text map, avoiding drift across inline tags and Chinese text.
- **No stale event double-advance:** `onstart`, `onend`, `onerror`, and word-boundary callbacks only affect the currently active utterance; old browser callbacks cannot skip a segment after a restart.
- **Pause during chapter transition:** When narration auto-advances to another chapter, pausing and resuming while the chapter loads no longer starts duplicate transitions or skips a chapter.
- **Faster speech setup:** Removed paragraph cloning used just to prefilter text. Visible spoken text is still checked through the authoritative DOM text map, excluding hidden ruby notes and other non-spoken content.
- **Accessible narration controls:** Play/Pause labels, pressed state, disabled Stop state, and theme-aware keyboard focus are kept in sync with playback; no extra permanent controls were added.

**Testing:** Chromium simulation of canceled/interrupted utterances, bounded retries, stale callbacks, last-word resume, pause/resume across chapter boundaries, and 1/2/3-column layouts. Earlier speech alignment, search, bookmark, footnote, and TOC regression suites passed. Live Edge natural-voice interruptions can vary by OS/voice, so real-machine confirmation remains useful.

## v72 — Accurate read-aloud boundaries for mixed-language EPUBs (2026-11-14)

- **Speech text and highlights use the same DOM map.** The previous speech segmenter cloned and normalized each paragraph independently from the DOM-to-text map. Sentence joining could insert spaces not present in the EPUB, especially between Chinese sentences, shifting highlights and the automatic page-follow target. The new segmenter uses exact mapped UTF-16 offsets instead of estimating offsets through string searches.
- **Mixed-language passages:** Voice language is detected for each utterance chunk, rather than once for an entire paragraph. Chinese/English alternation within longer paragraphs therefore uses more appropriate available language voices without introducing artificial spaces into the text.
- **Safer long utterances:** Chunks are bounded and split preferentially after punctuation, never through Unicode surrogate pairs. Hidden inline notes and ruby pronunciation text are excluded consistently from the utterance and map.
- **More accurate word focus:** Where speech voices report `charIndex` and `charLength`, word highlighting uses their exact range. Voices that omit the length continue using the existing `Intl.Segmenter`/regex word fallback. Existing line-focus range caching, CSS Highlights, automatic page following, and GPU transforms are preserved.
- **Less duplicate work:** Paragraphs are no longer cloned just to produce a second, potentially divergent speech string. All mapping happens once when starting to read, not at each page turn.

Validation: Chromium tests of mixed Chinese/English text, embedded emphasis, hidden inline content, emoji and long passages; 1/2/3 layout widths; retained v71 section, bookmark, and footnote suites. Browser native voice boundary timing varies by voice and cannot be fully simulated. No storage format changes, and no new permanent controls.

## v71 — Section tracking, backup fidelity, and read-aloud efficiency

- **Current section in the footer and contents:** The bottom-left chapter label follows the current TOC subsection even when several sections are in one XHTML chapter. Directly jumping to a section activates it even if the same spread begins with the preceding section. Layout geometry is cached per document and invalidated on actual repagination, so page turns still require no TOC layout reads. The full section title appears on hover.
- **Long TOC keyboard navigation:** Focus an entry and use Up/Down, Home/End, and Enter. A theme-aware focus outline works in Paper, Warm, and Night. The contents panel still opens near the current location.
- **Reading-data backup corrected:** Importing a backup now preserves valid version-1 precise passage locations for progress and bookmarks, and preserves short bookmark excerpts. Old fraction-only backups continue working. Invalid or oversized anchor paths are discarded and fall back to chapter percentages rather than breaking import.
- **Read-aloud focus efficiency:** Reuse the DOM Range for a spoken visual line across word boundary events instead of probing every character repeatedly. Invalidate the tiny per-segment cache on true repagination. This does not alter Edge/browser speech voices, GPU page turning, or the original text.

No data migration or new permanent UI controls are needed. Existing books and preferences remain compatible. Tests included simulated EPUB chapters with multiple TOC sections, one/two/three-column layouts, theme checks, footnotes, bookmarks, Unicode search, and read-aloud geometry cache invalidation. Tests use Chromium and do not verify real online voice or dictionary services.

## v70 — Highlight matches and navigate results faster

Search now highlights nearby matches in the chapter with an understated page-tone color while the selected occurrence is emphasized. Press **F3** for the next result or **Shift+F3** for the previous one, including across chapter boundaries. Reopening Search retains a completed search and its selected result. Highlights are painted through the browser's CSS Highlight API without inserting extra HTML into EPUB text, so page layout and performance are preserved. Chromium tests cover 1/2/3-column reading, all core search cases, bookmarks, and footnotes. For full release notes see `CHANGELOG.md`.

## v69 — Precise in-book search

- Search results now identify the specific occurrence of a repeated word or phrase instead of relying only on approximate chapter percentages. Chinese queries, mixed-format text, and Unicode-equivalent variants (including ligatures) have more accurate result highlighting and navigation.
- Search result rows now append as scans finish, so the list is less likely to jump or lose focus. Use **Down Arrow** from the search box to enter the list; **Up/Down** and **Home/End** move between matches, and **Enter** opens the focused match.
- Text indexing happens only when a result is selected, and can be reused across selections in an unchanged chapter. Ordinary page turning remains untouched. Existing progress/bookmarks, EPUB files, fonts, and reading preferences remain compatible.

## v68 — Precise reading positions and bookmarks

- New reading positions and bookmarks record the beginning of the actual visible passage, not just its approximate page percentage. They restore more accurately if you resize, change the number of columns, adjust text size, or reopen a book later.
- Older bookmarks and progress remain supported. If the matching passage cannot be identified in a changed EPUB, Folio falls back to the saved chapter percentage.
- The Bookmarks panel shows a short two-line context preview for new marks. Each mark has separate accessible **Open** and **Remove** controls. This panel and its states follow the Paper/Warm/Night theme.
- Bookmark actions match one logical page at a time, rather than a broad percentage window. GPU-backed page turns, deferred image loading and all v67 footnote features are unchanged.

## v67 — Footnotes and endnote navigation

- Open footnote links normally; a **Back to text** control returns to the original reference even when the note appears in a different EPUB spine chapter or a detached file. Inline notes and nested notes are also supported without altering your saved position.
- Hover over a note marker, or focus it with the keyboard, to read a small non-modal preview. Clicking or pressing Enter follows the link; Escape returns from a full note view. Long notes scroll with a stationary header.
- Technical note previews now preserve constrained tables, native mathematical notation and Chinese ruby annotations, and use the correct Paper/Warm/Night colors.
- No change to EPUB storage, reading progress format, GPU pagination or the PWA hosting requirements.

## v66 — Book-style typography defaults

- Inset quotations and epigraphs have quieter, unboxed defaults with no forced vertical rule.
- Publisher CSS using semantic classes now takes precedence for quotation, epigraph, poetry, sidebar, letter and preformatted formatting.
- Short chapter headings use balanced wrapping where Chromium supports it; regular paragraphs use two-line widow/orphan limits.
- Simplified-Chinese chapters with declared `zh` language use strict CJK punctuation line breaking.
- The GPU page-turning, image queue, chapter transitions, and storage formats remain unchanged.

**v64:** Visible illustrations reserve a loading slot during fast page turns, and queued image requests are promoted individually without redundant decompression. A subtle neutral background distinguishes reserved image boxes while content loads.

**v63:** Direction-aware illustration preloading prioritizes the current spread and the next spreads in the direction of wheel/held-key reading, while retaining the three-job cap and using low-priority ZIP slots for look-ahead. The appearance panel also gains compact theme-matched typography sliders. No data migration needed.

**v62:** Large offscreen illustrations in image-heavy chapters now load near their logical pages instead of all being decompressed upfront. This only applies when the EPUB supplies reliable intrinsic image dimensions; the earliest images, tables, notes and ambiguous layouts remain eager. This reduces avoidable ZIP work and initial memory usage while keeping the page geometry, reading progress, fast GPU page turning and smooth chapter transitions intact. In very fast navigation a reserved image area may briefly be blank while its asset finishes loading.

**v61:** Improves illustrated-chapter readiness and responsiveness. Folio starts decoding a couple of likely first-visible illustrations while staging a chapter, without adding a mandatory image-loading delay. Image/font completion notifications are coalesced with a bounded wait so a long series of loading events cannot indefinitely postpone repagination. The existing fast wheel/key navigation, GPU transforms, double-buffered chapter transitions, page anchors and publisher CSS formatting remain unchanged.

**v60:** Preserves the publisher's actual inline/linked stylesheet order and media rules, and prepares independent CSS files concurrently. This corrects a layout-styling bug and can make stylesheet-heavy EPUB chapters open faster. All existing pagination, GPU page-turning, chapter transitions, progress, fonts, and dictionary functionality remain unchanged.

**v59:** Uses one bounded font-readiness window during chapter switching rather than two sequential waits. A subtle, theme-aware loading cue appears only for slow transitions and is removed on completion or cancellation. All GPU pagination, navigation controls, book data and EPUB CSS behavior are unchanged.

**v58:** Prepares EPUB publisher CSS and image/media assets concurrently, keeps stylesheet ordering intact, and avoids decompressing stylesheet files twice. This reduces latency for resource-heavy chapters without changing GPU page turning, pagination, themes, or reading data.

**v57:** Prioritizes the requested chapter over speculative background resource decompression. Background image inflation is limited to two of six slots; a chapter promoted from prefetch to foreground reuses and expedites pending work. Cancels superseded prefetch sequences on navigation without aborting resources already in use. Pagination and GPU page turning are unchanged.

**v56:** Fast continuous page turning by scrolling the mouse wheel/trackpad or holding the Left/Right arrow keys (also PageUp/PageDown/Space). Input is paced to stay responsive, with bounded wheel accumulation, automatic release/blur safeguards, and smooth chapter boundaries. Nearby chapters are prepared earlier during idle periods. All existing typography, page transitions, and reading data are preserved.

**v55:** Faster GPU page turning, coalesced progress writes with lifecycle flush, efficient progress calculations, and Home/End keys to jump within the current chapter. Exact reading anchors are retained on reflow.

**v54:** Figures with short captions reserve only the actual caption height; exceptionally long captions and multi-image figures can flow across columns instead of creating unnecessary empty pages. This adapts to changes in font size and column count.

**v52:** Dictionary lookup now uses independently updated English and Chinese definition sections, accurate loading states, safer close/audio cleanup, and adaptive popup placement that avoids covering the clicked word on wide viewports when above/below space is insufficient. No additional dictionary services, persistence, or caches were introduced.

**v51:** Reclaims unreferenced image/resource Blob URLs between chapters to control memory growth in illustrated EPUBs, while protecting visible and cached content. Library cards show subtle reading progress, covers lazy-load, and UI transitions respect reduced-motion preferences. No change to EPUB storage or settings.

**v48:** Fixed duplicate chapter loads on rapid Next/Previous presses, cancelled pending book-opening work when returning to the library, and cleaned up scheduled neighbor prefetch. GPU pagination, stored EPUBs, and reading progress are unchanged.

**v47:** Correct Source Han SC font priority (installed Source Han → Source Han SC webfont → Noto fallback), verify online fonts before applying optical weights, and remove inherited low-level weight-axis overrides. Adds an online-only font-weight control and lazy dictionary font loading, without changing installed font rendering.

**v46:** Online Source Han SC fonts receive stronger, separate Serif/Sans weights (including real bold), explicit variable axis selection, and verified font-file loading. Installed fonts remain unchanged.

**v45:** Source Han Serif/Sans SC webfonts use slightly heavier, separately balanced variable weights for body text, headings, and real bold, without changing installed fonts. The reader detects installed fonts before requesting online stylesheets.

**v44:** Source Han Serif, Source Han Sans and LXGW WenKai use unified local-first / webfont-second loading in the reader and lookup card. Web fonts require network connectivity on their first use.

# Folio

**A quiet, local-first EPUB reader for the browser.**

Folio is a lightweight, paginated reading application for Microsoft Edge and Chrome. It combines multi-column typography, natural text-to-speech, bilingual word lookup, footnote navigation, and a private book library. You can use it as a standalone HTML file or install it as a Progressive Web App (PWA).

![Folio reading view](docs/reader-preview.png)


For recent improvements and release history, see the [changelog](CHANGELOG.md).

## Features

- **Page-based reading:** automatic one-, two-, or three-column spreads based on available width, with keyboard, mouse wheel, and margin-click navigation. No vertical page scrolling.
- **Typography:** independent Chinese and English font selection, including Libertinus Serif, EB Garamond, Microsoft YaHei, Sitka, and source Han / Noto CJK families. Includes bundled English web fonts and optional Chinese online font fallbacks.
- **Semantic typography:** consistent, understated presentation for quotations, epigraphs, poetry, sidebars, letters, code, and definition lists. Applies to recognizable EPUB/HTML semantics while deferring to deliberately styled publisher elements.
- **Read aloud and focus:** uses voices exposed by Edge or Chrome, with separate Chinese/English choices, speed, remembered voices and automatic page following. Optional word highlighting and subtle line focus are painted without altering EPUB text or pagination. Word timing follows the browser's speech boundary events when provided; some online voices do not provide these events.
- **Efficient repagination:** Reuses unchanged chapter layouts and avoids unnecessary rescans after duplicate resize/font events; single-spread chapters skip content scanning.
- **Fast chapter preparation:** Embedded resources are loaded using a bounded queue, shared assets are decompressed once, and adjacent chapters are prefetched when idle.
- **EPUB search:** a dedicated worker searches chapter text progressively, with chapter-wide or entire-book scope, snippets, and jump-to-result. Search is initialized only when needed, bounded to the first 260 matches and approximately 8 MB of cached extracted text. No extra WASM dependency or permanent full-text index.
- **Footnotes:** preview existing EPUB footnotes on hover, navigate on click, and return to the previous reading position. Script-aware, colored superscript marks replace the old background badges.
- **Dictionary:** English definitions with pronunciation options and Chinese meanings from browser-accessible online providers when available. Word-form fallback handles common plural and verb endings. A reserved-size dictionary popup stays in place while online results arrive; no additional dictionary caching is introduced.
- **Library and privacy:** import DRM-free EPUBs locally, filter the bookshelf instantly by title or author (including Chinese), resume reading, manage bookmarks, remove individual books and associated data, or clear all saved data. The library homepage has a single import action and direct access to **Appearance & data**.
- **Installable PWA:** a versioned service worker caches the application shell for quick offline reopening and displays a reload prompt after updates. Imported books remain in browser storage.
- **Portable full-library backup:** export all EPUB files with bookmarks, reading positions and appearance/voice settings to a ZIP, then restore it into another browser origin. A separate small JSON option backs up only reading data (without EPUBs).
- **Keyboard accessibility:** dialog focus is contained within the active drawer; Escape closes it, and page shortcuts do not turn pages behind open menus.

## Quick start

### Standalone HTML

Download `Folio-EPUB-Reader-v80-Standalone.html` and open it in Edge or Chrome. Import a DRM-free EPUB from the library view. The reader itself can function offline; dictionary lookups and some web fonts require an internet connection. Direct `file://` browsing cannot be installed as a PWA, and its storage is separate from an HTTPS-hosted copy.

### Install as a PWA

1. Put `index.html`, `manifest.webmanifest`, `sw.js`, `icons/`, and `docs/` on a static website over **HTTPS**, or serve the folder from **localhost**.
2. Open the site's `index.html` in Microsoft Edge or Google Chrome.
3. Use the browser's **Install app** option (or the in-page Install control when available).

For local development, any static HTTP server works. For example, from the project directory, run `python -m http.server 8765` and open `http://127.0.0.1:8765/`. A server is **not required** for the standalone HTML version.

**Important:** Browser storage belongs to its origin. Books stored under `file://`, `http://127.0.0.1:8765`, and your HTTPS domain do not automatically transfer between them.

## Using Folio

| Action | Control |
| --- | --- |
| Return to library | **Library** in the header |
| Browse the table of contents | **Contents** (left edge of the reading interface) |
| Search the current EPUB | Magnifying glass or **Ctrl+F** / **Cmd+F** |
| Change typography or appearance | **Appearance** |
| Turn pages | On-screen arrows, Left/Right, Page Up/Page Down, scroll wheel, swipes or outer reading margins |
| Enlarge an illustration | Click an unlinked illustration, then use **Actual size** to inspect details; Escape closes the preview |
| Inspect a dense table | Select **View table** beneath an oversized or cramped table; Tab to focus the table, then arrow keys to scroll |
| Preview an existing EPUB footnote | Hover over its reference |
| Navigate to an EPUB footnote | Click its reference, then use **Back to text** |
| Look up an English word | Click it in the reading text |
| Start read-aloud | **Read aloud**; it starts at the visible page |

## Special-element typography

Folio styles semantic HTML elements (for example, `<blockquote>`, `<pre>`, and `<dl>`), selected EPUB 3 `epub:type` values, ARIA document roles, and common class names such as `epigraph`, `poem`, and `sidebar`. Quotations use a subtle leading rule and inset; epigraphs and poetry are distinguished primarily by whitespace; sidebars and preformatted blocks use a light, theme-aware surface. Unlike blanket CSS overrides, the reader avoids adding decorations to elements with their own explicitly authored decorative styling.

The page clipping masks and reading iframe now share the same exact paper color, removing mismatched edge shading. The styles are designed for fixed-height column pagination and use logical-direction properties suitable for both English and Chinese text. They do not inject quote characters, change the contents of the EPUB, or force a specific serif/sans-serif family.

## How search works

Folio intentionally avoids a large always-on search index. When you first search in a book, an isolated **Web Worker** opens the EPUB ZIP and extracts readable text one chapter at a time. It returns batches of results as they are found, keeping page rendering interactive. A small least-recently-used cache holds up to approximately four million UTF-16 text units (about 8 MB). The UI debounces input, cancels obsolete search runs and limits the result set to avoid overwhelming the interface for common search terms.

Search is **literal, case-insensitive and Unicode-normalized**; it is not semantic or fuzzy search. Certain EPUB constructs (for example, text inside SVG images or complex ruby annotations) may not be searchable. EPUB navigation jumps to the closest matching occurrence after chapter layout.

## Storage and privacy

EPUB files are imported into the browser's **IndexedDB**. Preferences, reading progress and bookmarks use browser local storage. Local reading does not require an account or uploading an EPUB to a server. Online dictionary requests submit the looked-up word to the corresponding external provider; online voice services may transmit spoken text according to your browser's voice provider. The PWA cache contains the application shell, not your EPUB files.

To remove one book, use its delete control in Library. To erase all data, use the storage controls in Appearance. Browser eviction or manual site-data clearing can remove locally saved books: regularly create a **full-library ZIP backup** or retain the original EPUB files.

### Back up and transfer reading data

Open **Appearance → Local storage** and select **Export reading data** to download `folio-reading-YYYY-MM-DD.json`. The small JSON includes reading positions, bookmarks, selected fonts, themes and voice preferences. **Import reading data** merges bookmarks and positions and restores preferences; existing books and their EPUB files remain untouched. Book IDs are based on the imported EPUB contents, so reimporting identical files lets Folio match them to saved positions.

**The reading-data JSON does not contain EPUBs.** For a one-step library transfer, select **Back up entire library (.zip)** instead. The resulting `folio-library-YYYY-MM-DD.zip` contains the EPUB files and reading data. At the destination, open **Appearance → Local storage → Restore library (.zip)**, select the ZIP, and confirm the merge. Your existing books are not deliberately removed. Book IDs and reading locations are remapped when their IDs differ between installations. The ZIP is unencrypted and not uploaded to Folio servers; protect it like any other copy of your books and notes. For browser-memory safety, Folio caps a full export at 420 MiB of EPUB content; very large libraries may need smaller batches or separate storage outside the browser.

Dictionary API credentials are not exported. When the browser supports it, **Protect local book storage** requests persistent storage; it reduces the risk of automatic eviction, but is not a substitute for a backup.

## Supported formats and limitations

- Designed for **DRM-free EPUB 2 / EPUB 3**, including reflowable XHTML and a basic subset of EPUB 3 fixed-layout XHTML/SVG pages.
- The basic fixed-layout mode requires a declared pre-paginated page with usable canvas dimensions. Advanced fixed spreads, interactions, publisher JavaScript/media overlays and DRM are not supported. Some unusual mathematical notation or very dense tables may still require the original EPUB layout to be readable. The expanded table view preserves headings, captions, selected cell formatting, small images and native MathML, while omitting scripts, external links and unsafe styling.
- Footnote previews require actual note references in the EPUB. Folio does not fabricate missing source links.
- Recorded dictionary audio and some Chinese web fonts depend on network access and provider availability. Browser Natural voice availability varies by Edge/Chrome version and operating system.
- Search does not read words baked into images or scanned pages.

## Project files

```text
folio/
├── index.html                 # Self-contained reader, including bundled JS and English fonts
├── LICENSE                    # MIT license for Folio source code
├── manifest.webmanifest       # PWA metadata
├── sw.js                      # Offline app-shell cache
├── icons/
│   ├── folio-192.png
│   └── folio-512.png
├── docs/
│   └── reader-preview.png
├── tests/
│   └── smoke.py                 # Chromium regression smoke test; requires Playwright
├── README.md
└── CHANGELOG.md
```

The separately distributed `Folio-EPUB-Reader-v79-Standalone.html` contains the reader but no installable PWA resources.

For release history, see [CHANGELOG.md](CHANGELOG.md).

## Reliability and resource usage

Folio limits excessively large or suspicious EPUB archives before import, uses a one-time case-insensitive ZIP-path index to avoid repeated archive scans for publisher assets, and prepares neighboring chapters lazily. It does not build a permanent search index or upload EPUBs to a remote service.

The PWA uses a versioned, cache-first shell for fast offline startup. It requires that all essential shell resources be cached successfully before activating an updated service worker. When an update takes control, the current tab shows a discreet reload option.

## Development and contributing

Run the synthetic Chromium smoke test from the extracted PWA folder using `python tests/smoke.py` after installing Playwright and Chromium (`python -m pip install playwright`, `python -m playwright install chromium`). A system Chromium binary is also supported through `FOLIO_CHROMIUM`. The test does not depend on online dictionary access or a real publisher EPUB. 

Folio currently uses browser-native HTML/CSS/JavaScript, **JSZip** for EPUB ZIP parsing, Web Workers for background search, IndexedDB, Speech Synthesis and CSS multicolumn layout. No build step is needed for the distributed `index.html`.

Contributions and bug reports are welcome. A useful issue includes the browser/version, viewport width, relevant reader settings, steps to reproduce, and a small **shareable** EPUB that demonstrates the problem (avoid uploading copyrighted books without permission).

## Credits and licensing

Folio includes JSZip and selected bundled English fonts. Their upstream licenses and copyright notices are retained in the HTML distribution, including the embedded font notices. EPUB books remain the property of their respective authors and publishers.

**Folio's original source code is licensed under the [MIT License](LICENSE).** See `LICENSE` for the full terms. Third-party libraries, embedded fonts and their associated assets retain their own licenses and copyright notices; the MIT license for Folio does not relicense those dependencies.


### Publisher typography

Folio uses your selected Chinese and English fonts for ordinary prose while retaining font families explicitly assigned by an EPUB. This includes sans-serif headings, styled quotations, and character voices. If a book explicitly chooses a sans-serif typeface for its entire body, Folio retains that publisher-provided family and fallback order.


### Font overrides

Appearance → Typography → **Override book fonts** lets readers choose whether to keep EPUB-defined fonts or use the Chinese and English typefaces selected in Folio throughout the book. This setting is disabled by default, preserving publisher formatting. It is stored locally and does not modify the EPUB file. Switching modes repaginates the current chapter.


### v38 adjustments
Reading-focus spacing, a simpler storage panel and Night-mode control contrast have been refined.

### LXGW WenKai and other remote Chinese fonts

If LXGW WenKai is installed on your device, Folio prefers that local installation. Otherwise, it downloads the font on demand from the font provider when selected. An internet connection is required for first use without a locally installed copy; offline usage falls back to an available Chinese font. The same applies to the lookup-popup typography. After a remote font loads, Folio recalculates page positions so text does not become misaligned.

### Chinese online font quality

Folio v43 keeps GPU-accelerated chapter paging. Installed Source Han/Noto CJK fonts take priority; otherwise the Chinese serif/sans options load subsetted Source Han SC variable web fonts over jsDelivr. The browser caches loaded subsets. An internet connection is needed to fetch missing subsets. Actual text antialiasing remains browser/OS dependent.

### v51 page jump

Click the current page number in the bottom navigation to enter a page number, press Enter to jump or Escape to cancel. This uses the visible (logical) pages; skipped publisher blank spreads are not counted.

### v51 reading-position preservation

When the first visible material is a figure, diagram or large table, Folio now remembers that item as the current reading anchor while the layout changes. Ordinary text pages continue to use a character anchor. No new controls or saved-data format are introduced.

### v65 image display improvements
Deferred illustrations near the current page use bounded bitmap decode-ahead where supported. This does not affect book storage, page-turn transforms or EPUB layout.

### v79 library tools and shortcuts

Use the search box, reading-status filter, and sort menu above your shelf. The status filter classifies a book as Not started (0%), In progress (greater than 0% and less than 99.5%), or Finished (at least 99.5%). The two menus are saved in appearance preferences and included in full-library or reading-data backups. Book cards have a separate Download original EPUB button beside Remove. Download never modifies the stored book.

Press `?` while reading for a list of keyboard shortcuts; use Ctrl+F (Command+F on macOS) to search the current book and on the library landing page to focus the library search. Browser find in editable text fields retains its usual behavior.

The **System** page tone follows your device dark/light preference in the library, reading view, note previews, and fixed-layout pages; selecting Paper, Warm, or Night locks that explicit theme instead.

**Migration from v79:** delete the experimental `server/` folder and `Run Folio (Windows).cmd` launcher from any old extracted directory. These are not part of v80. Keep the same PWA URL/origin to retain IndexedDB books and preferences.
