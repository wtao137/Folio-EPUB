## v95.48 — Avoid full-source srcdoc allocation and slice native tail parsing

- **Make the first iframe HTML directly from the prepared book-source prefix.** v95.47 built a complete srcdoc string first, then sliced off its trailing body. On eligible giant plain-prose chapters, v95.48 splits the sanitized cached `bodyHTML` before calling `makeChapterDocument()`, producing only the needed first-spread iframe document. No extra complete HTML document string is assembled on that path. The full renderer is unchanged for other EPUBs.
- **Cooperative, detached tail parsing in native-wrapping mode.** After the first screen is painted, for tails of at least ~384 KiB (or ~192 KiB on low-memory devices), parse about 48 KiB (24 KiB on low-memory devices) of source paragraphs at a time into a disconnected `DocumentFragment`, spending at most three batches and around 7 ms per idle callback. Smaller tails retain the faster legacy single-parse path. Mount the complete fragment **once** to avoid repeated full CSS multicolumn reflow; only then compute exact authoritative physical pages. No estimated total page count is published.
- An immediate page turn forces the original single-parse completion path. If a background chunk was already parsed, the remaining chunks are synchronously drained without losing text or changing paragraph order. Cancelling a superseded chapter continues to discard its pending fragment.
- **Conservative Knuth–Plass compatibility.** Because its progressive optimization is time-budgeted, it uses v95.47's unchunked full-tail parsing and normal cache invalidation. In the 390px, 650-paragraph Chromium test, both versions had 305 pages, 28 finally composed KP paragraphs, matching physical index, text and screenshots after the progressive job finished. The 1130px full-KP comparison exceeded the test budget and is **not** claimed to pass.
- Chromium 650-paragraph native tests at 390/1130/2100px now correctly select one-shot parsing, preserving v95.47-identical physical pages (307/95/59), text and preview/final screenshots. Immediate and artificially one-chunk-then-forced navigation at each width preserved exact pages, all source text and pixel-identical first page. The 3600-paragraph (~775k characters) stress case triggered 19 detached parse batches, with peak individual parse time 1.7–4.8 ms across the tested widths; final text and physical pages (1700/526/326) still agreed. End-to-end completion times were inconsistent and sometimes slower, so **no stable whole-chapter speedup is claimed**.
- Original SICP EPUB (including a MathML-containing chapter), original user Chinese Zen EPUB and English Zen EPUB have identical final page screenshots to v95.47. They deliberately take the full-layout fallback, so no speedup is claimed for those real chapters. Fixed-layout, notes, publisher styling, existing library format, and reader chrome are unchanged.
- No stored-book migrations. The service-worker shell cache advances to v95.48; the full PWA ZIP remains 100 entries and the update from v95.47 contains the five changed shell/docs files.

## v95.47 — Parse only the first-spread XHTML into the staged iframe

- **Move giant plain-prose staging ahead of iframe.srcdoc.** The earlier v95.45–v95.46 pipeline parsed *all* XHTML into the hidden Chromium iframe, then extracted the tail into a DocumentFragment. v95.47 checks strict source eligibility on the already-sanitized book DOM and builds a srcdoc containing only the bounded opening paragraphs. The remaining serialized text is kept outside the iframe until a painted first frame or the first navigation requiring exact pages. This avoids a first iframe DOM tree for thousands of offscreen paragraphs, as well as their initial style setup.
- Reuse the exact v95.46 1/2/3-column adaptive native preview budget and 96/64-block default Knuth–Plass policy. The source eligibility explicitly requires >=480 direct plain paragraphs, >=75,000 characters, no author CSS, inline markup, links, notes or complicated breaks, and opening at chapter fraction zero. Source metadata records the entire source's Chinese sample before any split. Unexpected width changes and insufficient preview content use actual Chromium geometry and fall back to complete mounting.
- **No permanently virtualized or estimated pages.** The tail is parsed into an isolated HTML template only after preview, restored in source order, language-font processing runs, Knuth–Plass temporary source caches are invalidated, and the browser computes the same final physical pages. Clicking, jumping or leaving the chapter while a tail is pending forces safe completion (or discards a superseded iframe).
- Original v95.46 on-load DOM-fragment staging remains as a fallback for chapters that do not have a source preparse descriptor; complex EPUB content continues to load in full. A failed experiment that moved Knuth–Plass connected-DOM font preparation into a disconnected fragment was **reverted**; v95.47 deliberately retains its original complete-document preparation order.
- Chromium A/B with 3,600 mixed Chinese/English plain paragraphs (~775k source characters), Knuth–Plass OFF, at 390/1130/2100px: first `paginateChapter()` completion times in one run 514→283, 404→252, 704→341 ms, respectively; final exact pages 1700/526/326 and full text/physical page arrays equal. These are noisy synthetic single-run numbers, not guaranteed end-to-end speedups; full layout still happens afterward.
- Frozen-first-frame test with 650 mixed prose paragraphs proves the tail was **not yet parsed** in v95.47 vs already parsed-and-detached in v95.46. At 390/1130/2100px with native wrapping, and 390/1130px with Knuth–Plass ON, initial prefix and eventual completed first-screen images match the previous version pixel-for-pixel. Complete text, physical page indices and total pages agree. Knuth–Plass's non-deterministic time-budgeted refinement may yield different numbers of later optimized paragraphs across runs, including within one version; no blanket full-book line-break equivalence is inferred from first-page parity.
- **Real-book regression:** original user SICP EPUB (including MathML), user Chinese and English Zen and the Art of Motorcycle Maintenance EPUB, 390/1130px: actual Chromium final text, physical pages and screenshots pixel-identical vs v95.46; these complex chapters safely used the full path. The source EPUB files are not distributed in the release. Late Han appearing beyond the candidate prefix remains a verified full-path fallback.
- No reader-UI changes or IndexedDB schema changes. Local TTS, dictionary, notes, fonts, saved progress and original EPUBs are untouched. The shell cache has been bumped to v95.47, the full ZIP remains <=100 entries, and an update from v95.46 touches only five files.

## v95.46 — Adaptive first spread and detached font preparation

- Adaptive native-wrap first-spread prefix budget based on viewport columns, height, font and paragraph lengths (24/32/48 paragraphs in the tested long mixed-text case), checked against Chromium’s real multicolumn scroll geometry. Keep the proven 96/64-paragraph prefix for Knuth–Plass.
- Preserve the full-source Chinese text sample before staging. When Han characters start only after the candidate preview, use the complete chapter instead, fixing delayed Chinese font detection and preventing a KP performance cliff.
- With native wrapping, prepare the detached remainder’s script-font runs **before attaching** it to the live multicolumn DOM, avoiding a second scan over the already displayed prefix. Preserve the original connected-DOM mutation order for Knuth–Plass.
- Retain strict no-publisher-style eligibility, original node identities, final exact pagination, forced early navigation and progressive Knuth-Plass cache invalidation.

### v95.45 — Bounded first-spread XHTML layout, exact final pages

For very long, genuinely plain-prose XHTML, Folio now gives Chromium a **bounded first spread** rather than a full 1,000–10,000-paragraph multi-column flow before the opening page is drawn. The complete sanitized XHTML is parsed once, and all original nodes remain in memory. After a strict, whole-chapter check (at least 480 paragraphs and 75k characters; direct unstyled text-only paragraphs, optional simple opening heading; **no publisher CSS, inline formatting, links, footnotes, anchors, forced breaks, bidi or complex structures**), only the first 96 body blocks participate in the initial layout (64 on low-memory devices). After a painted frame, Folio reattaches the original DOM nodes, installs missing language-font wrappers, invalidates Knuth–Plass's temporary prefix cache and runs the same authoritative full pagination. While this is pending, page count is shown as `1 / …`, never a guessed total. An immediate page turn or jump synchronously finishes mounting before navigation; saved nonzero positions and all complex EPUBs use the unchanged full-document path.

This **defers**, but does not eliminate, the full native multicolumn layout. It is not persistent virtual pagination or a precomputed page-count approximation. It reduces the initial critical-path work for eligible prose, with possible background layout work after first paint; an unusually fast user interaction may have to complete that work synchronously. Chromium synthetic EPUB comparison against v95.44 confirms original node/text order, exact physical pages and pixel-identical first screens at 390/1130/2100px, including default-on Knuth–Plass. See the v95.45 verification JSON for timing data, tested fallback behaviors, and limitations. IndexedDB books, settings, fonts, dictionary and TTS are unchanged.

### v95.44 — Correct CSS columns from the first XHTML parse

The staged EPUB iframe now receives its actual responsive 1/2/3-column topology and reading width **inside srcdoc before its body is parsed**. Previously v95.43 still applied those variables *after iframe.onload*, which allowed Chromium to prepare the default two-column style first. The initial HTML, staged verification and final pagination now share one geometry planner; no CSS rewrite is needed for unchanged viewport and settings. Actual browser geometry, exact physical page numbers and native/KP text flow remain authoritative. No virtual pages or placeholder content have been introduced. See `UPGRADE_FROM_v95.43.md` and `CHANGELOG.md` for testing, comparison, limits and upgrading.

### v95.43 — Verified incremental chapter page indexing

For eligible very long author-styled EPUB XHTML chapters, the first page now becomes readable while Folio verifies actual occupied browser columns in short idle slices. It uses the exact same glyph/illustration-based occupancy logic as the synchronous path, without guessing final page counts or altering EPUB content. During verification the compact counter shows `1 / …`; any immediate page turn first finishes the exact index. Explicit publisher blank pages, saved middle-of-chapter locations, deferred images and unsupported structures use the existing safe path. See `UPGRADE_FROM_v95.42.md` and the independent regression package for tests and limitations.

### v95.42 — Giant XHTML startup and safe multicolumn staging

The reader now avoids unnecessary scans and per-element allocations during large XHTML preparation, and establishes the final column topology before publisher-font checks. This improves some large-chapter opening cases without inserting virtual page placeholders or altering final text layout. Same EPUB storage, default-on optional Knuth–Plass, and CJK/MathML/notes behavior. See `UPGRADE_FROM_v95.41.md` and the verification JSON in the release attachments for exact A/B evidence and limitations.

### v95.40 — Startup, library responsiveness, and allocation hygiene

Folio preserves its bundled English font resources in non-executing HTML data islands rather than compiling ~1.45 MB of font literals on every cold launch. Those fonts are still available without the network when selected. Large libraries avoid repeated favorite-list and shelf-membership work, and importing EPUBs no longer makes a redundant copy of the uploaded File. EPUB body typography and the default-on Knuth–Plass setting are unchanged.

### v95.39 — Optical alignment and reading controls

Folio's Settings switches now use a dedicated 15px circular thumb instead of inheriting the standard checkbox's two decorative checkmark borders. The center is correct in both switch states. The reader's top-right command bar, inline history icons, pagination pill and read-aloud controls use consistent SVG geometry with no baseline-dependent alignment. Settings' existing light editorial appearance and the Knuth–Plass option/description are retained. All work stays in outer UI chrome and leaves book content and local storage unchanged.

### v95.35 — Faster occupancy checks for mixed-content chapters

In mixed chapters, Folio can now verify the physical page range of a single Knuth–Plass paragraph using its first and last rendered lines instead of consulting every generated line. A similarly constrained optimization applies to native paragraphs with no inline markup. This reduces layout geometry reads while retaining the original exact scanner for publisher CSS, explicit breaks, complicated nesting and uncertainty. In controlled synthetic Chromium comparisons, physical page indices, line choices, text and full screenshots remained identical at one, two and three columns. The reduction in geometry reads does **not** imply the same reduction in overall EPUB loading time. Knuth–Plass is still enabled by default and can be turned off using its existing Settings switch.

### v95.34 — Safe contiguous-prose page occupancy optimization

For long uninterrupted, publisher-unstyled plain-text chapters, Folio avoids re-scanning every rendered glyph/Knuth–Plass line to exclude blank multicolumn spreads. It first verifies source structure *before* language spans/line nodes are inserted, and then checks the actual first and last rendered glyph locations against the raw column count. Only a genuinely contiguous physical page range is accepted; complex content, authored CSS, footnotes, tables, inline markup, forced breaks and Knuth–Plass OFF continue through the original exact occupancy scan.

In a controlled 130-paragraph (~61k characters) Chromium EPUB, the full occupancy walk was skipped at both first and final pagination (2 → 0 calls), saving 13–24ms of measured occupancy scanning per chapter over those two passes. Final page counts remained 157/55/29 at 390/1130/2100px, with identical final rendered ink, text, Knuth–Plass counts and chapter-position restoration. **This does not guarantee faster overall cold loading**: a stressed run produced a much slower first-paint outlier. The first-screen-visible priority, original user-facing UI, default-on Knuth–Plass toggle, optical CJK punctuation and code scrollports are unchanged.

### v95.33 — Lower first-layout staging overhead in very long chapters

Folio now installs one scoped, short-lived CSS rule during Knuth–Plass preparation and marks eligible plain paragraphs with an attribute, instead of setting and later removing two inline declarations on each paragraph. Only the existing 800-paragraph fast-path region is scanned for eligibility, even in XHTML files containing thousands of paragraphs. The stylesheet/markers are removed on completion or if the quality setting is switched OFF. This changes neither the final Knuth–Plass line choices nor the browser fallback for complex markup.

In a controlled Chromium DOM benchmark, staging 3,200 plain paragraphs (800 eligible under the existing engine cap) took 8.9ms before vs 2.1ms after (five-run median); full multicolumn layout is not part of that number. Real EPUBs and device performance can differ. Knuth–Plass is still enabled by default for new profiles; you can disable it under the original Settings option with no extra explanation text.

### v95.32 — First-spread adaptive Knuth–Plass composition

- Long, mostly plain-text EPUB chapters no longer spend the initial Knuth–Plass pass on offscreen paragraphs just to exhaust a time budget. Before the first visible frame, Folio reads only the necessary browser fragment rectangles and composes paragraphs intersecting the actual reading spread, plus a conservative neighboring block. Remaining paragraphs retain the resumable Canvas + dynamic-programming background pipeline.
- When returning to a saved position in the middle of a qualifying long chapter, Folio locates that spread with a sparse geometry search and prioritizes nearby paragraphs. It maintains the visible logical page when the rest of the chapter finishes.
- If the browser cannot safely determine visibility, or the EPUB contains complex markup, the existing v95.31 path remains. A bounded safety cap prevents pathological paragraphs from monopolizing the main thread; this is not a promise of instant cold loading.
- Knuth–Plass is still enabled by default for new settings, switchable OFF with exactly the original description; no changes to code scrolling, original book files or IndexedDB.

### v95.31 — First-screen typography without redundant browser `pretty` calculation

- When a very large, plain-text EPUB chapter is being prepared by Knuth–Plass, Folio also applies the fast initial layout to eligible opening paragraphs; their synchronous Knuth–Plass lines can be composed before the staged frame becomes visible. During preparation Folio temporarily uses the browser's efficient normal line wrapping (`text-wrap: wrap`) for eligible *pending* prose, rather than invoking the native `pretty` line optimizer only to replace its choices with Knuth–Plass lines. The visible first spread receives the same high-quality Knuth–Plass composition whenever it can finish within the initial budget.
- Complex EPUB content retains the previous safe browser fallback, including `text-wrap: pretty` for ineligible paragraphs. On completed composition or if you turn the Knuth–Plass setting OFF, all temporary style overrides are removed immediately. The final text, paragraph alignment and page count are unchanged.
- In a controlled 61k-character mixed Chinese/English EPUB, 390/1130/2100px final pages and the first 650px of rendered text matched v95.30 exactly. The initial page also matched final text pixels in one Chromium run on all three widths.
- Knuth–Plass remains ON by default when there is no saved choice; you can turn it OFF in Settings. Its original explanatory text has not been changed.

### v95.30 — Large EPUB chapters become readable much sooner

- Chromium's first multicolumn layout can become very slow when hundreds of not-yet-composed Chinese or mixed-language paragraphs use native full justification. Folio now temporarily uses inexpensive native alignment for distant, simple prose paragraphs in qualifying long chapters while the resumable Knuth–Plass engine works.
- The beginning of the chapter retains its original typography, and **all** temporary alignment hints are removed at the final Knuth–Plass commit. Ineligible complex EPUB content, footnotes, math, code, author formatting and RTL prose stay on their original safe path. Content, reading position, page geometry and the original Knuth–Plass options are preserved.
- A 61k-character synthetic EPUB showed much shorter first-read response in Chromium at phone, two-column and three-column widths; performance on unprovided books and low-memory Android devices remains to be tested.
- The reader keeps Knuth–Plass ON by default for users without a saved choice; it remains possible to turn it OFF, without adding any new settings description.

### v95.29: improved long-book progress and image indexing

- Book-wide progress navigation now has efficient weighted lookup even for EPUBs containing thousands of spine entries. Chapter-boundary behavior is preserved.
- A single-spread illustrated chapter no longer measures the rectangle of every deferred image just to assign its page number; multi-page chapters use the old accurate geometry path.
- High-quality Knuth–Plass is still enabled by default when not previously configured, remains optional in settings, and keeps the original explanatory text.
- Changes are internal performance improvements; they do not migrate imported EPUB data, themes, bookmarks or reading progress.

**Current default (v95.27):** Knuth–Plass typesetting is enabled on new installations. It remains optional and can be disabled in Typography; stored preferences take precedence. Earlier version notes below describe their historical defaults.

#### v95.28 efficiency and background scheduling

- Long-running Knuth–Plass and code-scrolling geometry work now pauses when the browser tab is hidden and resumes when the tab becomes visible. Leaving the reader or switching books cancels both job types immediately rather than leaving background timers holding detached chapter documents.
- In large ordered-list chapters, the list-marker Canvas measurements are reused for the same font and marker shape during one staged-document pass. List numbering/indentation rules are unchanged. Benchmark details and limits are in `Folio-v95.28-Verification.json` in the release attachments.
- The Knuth–Plass setting still defaults to ON when no saved preference exists, remains user-switchable, and retains the original explanatory text and label.

## v95.26 — Long code listings

For very large code-heavy chapters, Folio no longer measures the scroll size of every source block before showing the first page. The first twelve blocks remain immediately keyboard accessible when needed; other overflowing code blocks receive their tab stop during browser idle time or on first pointer interaction. Inside a long code block, horizontal gestures stay within the code even at the left/right edge; vertical gestures inside a tall overflowing block are likewise contained. Press **Esc** to leave a focused block and use the normal page-turning shortcuts. Text, pagination, and publisher styles are unchanged.

### New in v95.25

**Long code blocks now scroll rather than wrap.** Preformatted EPUB source preserves physical lines and indentation. Shift+wheel/trackpad or a code-block scrollbar lets you inspect long lines; very tall examples also scroll vertically inside the block. Swipe gestures that start inside code no longer page-turn, and overflowing code blocks are keyboard-accessible. Inline code and ordinary prose retain the existing typographic rules.

Folio now delays compilation of its bundled ZIP archive engine until you actually import/open an EPUB or use library backup/recovery. This reduces initial library-screen JavaScript work without needing network access. Invisible table-expansion controls are no longer created for normal tables; table fitting and the visible experience remain compatible. Knuth–Plass, book progress, and local EPUB storage are unchanged. Refer to `CHANGELOG.md` for benchmark scope and limitations.

### New in v95.24

This release removes redundant DOM/text work in Knuth–Plass idle continuations and final commit while maintaining exact source verification. Its optical ink and CJK glue safety checks now skip irrelevant paragraphs without disabling checks where punctuation hanging or spacing corrections are possible. Chromium tests at 390/1130/2100 px show identical page content and pixels versus v95.23. Repeated-paragraph CPU timings show a small improvement, but there is no demonstrated whole-book speedup: browser multicolumn layout remains the dominant synchronous cost. Existing book data and reading progress are unchanged. See the changelog for details and known historical test failures.

### New in v95.23

**Memory-conscious typography caches:** Knuth–Plass plans, measured paragraph templates, and tokenization are now bounded by both entry count and estimated storage. Large, long chapters cannot cause these caches to retain arbitrarily many complex line plans. The Canvas measurer also persists across short idle batches, with font state explicitly reset whenever an idle task resumes. The calculation and EPUB source are unchanged.

The limits apply to specific **CPU-side caches only**, not all browser memory. Actual gains vary by book and device. In controlled Chromium tests all 260 solver equivalence cases and three realistic viewport screenshots matched v95.22; this does not establish a universal cold-load or FPS improvement.

Extract the full PWA ZIP (maximum 100 entries), or overwrite v95.22 with the smaller update ZIP. Your stored books, bookmarks and positions do not require a database reset. The normal reader still uses official Google Fonts URLs with local fallbacks.

### New in v95.22

**Cooperative Canvas measurement**: long, previously unseen paragraphs now measure their glyphs and optical punctuation in bounded token batches while the reader is idle. This complements v95.21's resumable Knuth–Plass solver, so the browser is less likely to stall even *before* the DP phase starts. The glyph geometry, line breaks and visual output are not approximated. 8 repeated Chromium cold-context trials found that the median longest refinement call decreased from 30.20ms (v95.21) to 12.35ms (v95.22) for a synthetic 1,153-character paragraph; some individual calls still exceeded 16ms.

Install the full PWA ZIP (100 archive entries), or extract the small update ZIP over your v95.21 PWA files. Previous books, bookmarks and settings continue to work without storage reset. Optical punctuation and publisher-font preferences are unchanged.

### New in v95.21

Large paragraphs no longer require one unbroken Knuth–Plass dynamic-programming solve while idle refinement runs. The solver can preserve its candidate search and resume at the next idle opportunity without changing the line-break result. This improves **responsiveness**, not necessarily total computation time. 260 synthetic cross-version line-break plans were equal; the real-browser 26-paragraph pause/resume/cancellation test passed. Bilingual Chromium screenshot comparisons at 390/1130/2100px had zero changed pixels.

Update from v95.20: overlay the small delta ZIP on the previous PWA folder, preserving existing site data. Full ZIP has 100 entries for Antigravity compatibility. A standalone HTML version and self-contained regression tests are also provided.

### New in v95.20

Long chapters now reserve more of the main thread for first-page interaction. Knuth–Plass optimizes a bounded initial portion, then finishes remaining paragraphs in idle slices and commits once while preserving the reading anchor. Simple Han-and-Latin text tokenizes without expensive per-character Unicode segmentation, while complex Unicode still uses the full grapheme algorithm. Font measurement and prepared-text caches are tied to the EPUB document to avoid both cross-book font collisions and stale book text.

A 70-paragraph unique-Chinese-content Chromium benchmark observed an initial typesetting median of 302.95ms in v95.19 versus 125.10ms in v95.20. Full optical completion occurs later during idle; total start-to-finished typesetting is not claimed to be 59% faster. Three viewport screenshot comparisons remained pixel-identical. See `CHANGELOG.md` for tests and caveats.

Upgrade: overlay the delta ZIP on v95.19, keeping existing site data intact. The full PWA ZIP has 100 entries; the regression test scripts are distributed separately.

### New in v95.19

**More consistent Chinese optical text edges:** A Han character at the end of a line was correctly positioned; the following comma and quotation-mark lines visually ended too far inside. Chinese-compatible Knuth–Plass now adjusts *painted punctuation ink*, not the Han text or selected line breaks, and checks that every visible mark stays inside its safe viewport/column margin. Browser screenshots are included separately.

**Faster repeated styled paragraphs:** An EPUB-scoped LRU caches measured Knuth–Plass geometry for identical paragraphs, with a strict 48-entry / 1500-character bound and invalidation on reflow. Repetitive synthetic Chinese and English stress tests improved by 27% and 35% respectively without changing page count. Do not assume the same savings on novels with almost all unique paragraphs.

**Upgrade from v95.18:** Overlay the changed files from the delta ZIP, including the PWA `sw.js` cache version and revised KP engine, then reload once. Do not clear IndexedDB or reimport EPUBs. Full PWA ZIP is capped at 100 entries; a separate test archive includes the current optical regression suite. Details and limitations are in `CHANGELOG.md`.

### New in v95.18

**Faster image-heavy EPUB navigation** — Graphic novels, illustrated science books and large image-only XHTML chapters now use a lazy, page-indexed media anchor cache rather than walking every illustration on each page turn. A text occupancy set from the existing paginator also avoids expensive browser caret hit-tests on pages known to contain no text. These indexes are temporary, weakly referenced, automatically invalidated on repagination and never stored with a book. Knuth–Plass avoids redundant identical glue candidates without changing any tested line break.

**Upgrade from v95.17:** Overlay the five changed files (`index.html`, `folio-knuth-plass.js`, `sw.js`, `README.md`, `CHANGELOG.md`) from the incremental ZIP and reload the reader. Do **not** clear IndexedDB or reimport EPUBs. The full PWA ZIP retains 100 entries for Antigravity. The standalone file includes the updated engines inline.

**Evidence:** In a controlled 360-image/181-page Chromium EPUB at 1130×860, 45 consecutive media anchor queries took 134.8ms (v95.17) vs 22.8ms (v95.18), with identical anchor targets; this is a *microbenchmark for image-only pages*, not a general page-turn or cold-start percentage. Three viewport screenshot regressions show 0 changed pixels. See `CHANGELOG.md` for QA details and limitations.

### New in v95.17

For navigation-heavy EPUBs, page changes no longer require scanning the complete list of in-chapter table-of-contents anchors. A document-weak page-group index selects the current section efficiently without sacrificing same-page anchor correctness. Simple prose uses fewer exact text-range geometry scans during first pagination, and large EPUB CSS URL/import transformations avoid a redundant regular-expression pass. No permanent cache, IndexedDB change or EPUB conversion is involved.

**Upgrade from v95.16:** Overlay the updated `index.html`, `sw.js`, `README.md`, and `CHANGELOG.md` from the incremental ZIP, and reload the site. Do not clear site data or reimport books. The full PWA ZIP is capped at 100 entries for Antigravity. The standalone HTML is a one-file alternative with the existing local/library limitations.

In six controlled Chromium runs of a synthetic 420-heading / 105-page chapter, first pagination median was 39.0ms (v95.16) vs 28.6ms (v95.17), and 2,200 indexed section lookups took 198.5ms vs 2.6ms. This is not a prediction for other EPUBs or all devices. See `CHANGELOG.md` for detailed tests and known limitations.

### New in v95.16

Folio now reuses one recently read book's prepared chapters and already resolved illustration assets for a bounded 45-second interval after returning to the library. A byte-aware chapter LRU prevents large EPUBs from multiplying retained HTML memory, while oversized neighboring chapters are not speculatively prepared. Low-memory devices get stricter budgets. Very large CSS files now resolve external references through eight bounded asynchronous workers. Cancelling a superseded book opening no longer lets stale work overwrite newer navigation.

In two independent 20-open Chromium benchmarks of a 12-chapter / 2,400-entry TOC synthetic EPUB, the median fell from 39.70ms to 36.25ms and from 40.30ms to 33.10ms, respectively, with repeat chapter parses eliminated. Performance depends strongly on the EPUB, available RAM, fonts and page geometry. Book data, reading positions, bookmarks, dictionary data and typographic layout remain compatible with v95.15; no migration is required.

### New in v95.15

Faster reopening and more predictable mobile quality typography: Folio builds its long contents list only when the drawer is opened, avoids rebuilding invisible book cards while reading, and preserves a 12px gap between adjacent one-column pages so that next-page glyphs never intrude into the intended punctuation-hanging gutter. Neither line wrapping nor font choices are changed by the gap fix. Existing EPUBs, bookmarks, preferences and library backups remain compatible.

In a reproducible Chromium test (synthetic 12-chapter, 2,400-entry TOC), 16 repeated book openings had a median of 40.40ms versus 48.75ms with v95.14. Device, book and cache conditions can change these timings substantially. The known right-edge fragment issue from v95.14 is resolved in the tested 390px Chinese/English quality-wrap scenario. Refer to `CHANGELOG.md` for test coverage and limitations.

### New in v95.14

Faster reopening of previously imported EPUBs: Folio reuses validated stored EPUB navigation/package metadata, temporarily reuses one small ZIP directory in RAM (up to 24 MiB, 2-minute idle expiry), and does not wait for the book-history database update before showing the first page. These optimizations do **not** change the typography or the book data.

The old library, existing reading progress and portable full-library ZIP backups work without any manual migration. On the first opening of an older saved EPUB, the metadata is rebuilt and saved for subsequent opens. Detailed measurements and limitations are in `CHANGELOG.md`.

### New in v95.13

Chapter font selection now reuses a small per-document Han text sample. This avoids repeated whole-chapter text flattening during initial font readiness and status checks, especially for very long EPUB chapters. No changes were made to line breaking, punctuation hanging, and stored reading data. See the v95.13 section of `CHANGELOG.md` for details and benchmarking limits.

## Folio v95.13 — stable large-book contents, cheaper page-turn highlighting

Long tables of contents are now indexed once per parsed book, and the 220-item
contents panel is preserved when the book, search filter and entries are unchanged.
Page turns only update the previously active and newly active TOC button instead
of walking and toggling every entry. A single delegated click listener replaces
one per button. Bookmarks similarly keep their DOM nodes unless displayed data
changes, without sacrificing in-place add/remove support. This avoids unnecessary
DOM churn, preserves panel scroll/focus, and keeps navigation responsive in books
with thousands of headings. Neither typography nor EPUB source content changes.
See [upgrade notes](UPGRADE_FROM_v95.11.md) and `tests/toc_dom_reuse_v9512.py`.

## Folio v95.11 — faster EPUB resource discovery and indexed SVG spine detection

Large chapters now resolve image and media URLs by visiting only elements with resource-related attributes, instead of all prose elements. The selector deliberately uses `[*|href]` to retain SVG `xlink:href` as well as ordinary EPUB links, and keeps the original resource-job order and rewrite logic. SVG spine media types are indexed once when the book opens, instead of re-scanning the entire OPF manifest on each chapter or speculative prefetch. Existing layout, typography, PWA storage, fallback and page navigation are untouched. See [upgrade notes](UPGRADE_FROM_v95.10.md), `tests/resource_scan_v9511.py`, and `tests/epub_resources_v9511.py`.

## Folio v95.10 — faster staged chapter preparation

Speculative neighbor chapters now cache resolved content without assembling unused complete iframe HTML. Identical font CSS no longer causes an extra staged style rewrite, and semantic markup discovery avoids repeated token splits in long chapters. Quality typesetting, optical punctuation, original EPUB text and fallback guards are unchanged. See `CHANGELOG.md` and `tests/chapter_prep_v9510.py`.

Folio v95.9 — lower-cost occupied-page detection for Knuth–Plass text, with unchanged glyph geometry, line breaks and safety fallback. See `UPGRADE_FROM_v95.8.md` for the browser benchmarks and compatibility notes.

Folio v95.8 — less work during optical punctuation validation, reusable mixed-script geometry Range and exact reading anchors at paragraph ends. The existing Knuth–Plass visual layout and ink safety limits remain unchanged; see `UPGRADE_FROM_v95.7.md`. The full PWA release contains 100 ZIP entries and restores the previously omitted synthetic punctuation test fixture.

Folio v95.7 — eliminate phantom line-end CJK tracking: preserve natural glyph spacing while avoiding unnecessary post-layout compressions. The 390px/24px Noto Sans SC real-book regression now requires 0 instead of 28 positive-gap repairs, with unchanged line breaks and no new native fallbacks. See `UPGRADE_FROM_v95.6.md`.

Folio v95.6 — retain two previously unnecessary native fallback paragraphs in narrow, large-font Chinese prose without weakening glyph visibility checks; see `UPGRADE_FROM_v95.5.md`.

Folio v95.5 — coalesce duplicate late-font reflows and revalidate glyph metrics after font readiness; restore the MathML/optical-hanging test without weakening visual ink checks. See `UPGRADE_FROM_v95.4.md`.

Folio v95.4 — preserve visible hanging punctuation through external reader masks, reduce avoidable staged-column CSS invalidations, and add reproducible cold-layout/resize diagnostics. See `UPGRADE_FROM_v95.3.md`.

Folio v95.3 — faster Knuth–Plass solver hot paths, typed prefix geometry and per-document ink-metric caching; identical typography to v95.2. See `UPGRADE_FROM_v95.2.md` for tests and limitations.

Folio v95.2 — smoother paragraph-wide justification rhythm for wider reading columns, with original mobile layout and punctuation safety preserved. See `UPGRADE_FROM_v95.1.md`.

Folio v95.1 — more comfortable CJK adjacent punctuation and airy final lines; see UPGRADE_FROM_v95.0.md.

Folio v95.0 — balanced Chinese pause punctuation spacing; see UPGRADE_FROM_v94.9.md.

Folio v94.9 — adjust the optical position of the compact U+3001 dunhao in CJK sans text. Original glyphs remain intact; see UPGRADE_FROM_v94.8.md.

Folio v94.8 — prevent optical punctuation ink from being clipped at paginated reading boundaries. See UPGRADE_FROM_v94.7.md.

Folio v94.6 — clipping-safe optical punctuation and improved browser evidence. See UPGRADE_FROM_v94.5.md.

Folio v94.5: optional CLReq-informed line-edge optical punctuation alignment; see UPGRADE_FROM_v94.4.md.

**v94.4:** Bounded optical hanging of dense lines ending in a fullwidth Chinese colon, to preserve natural Han spacing. See `CJK_PUNCTUATION.md` and `UPGRADE_FROM_v94.3.md`.

**v94.3:** Browser-validated local CJK spacing repair now preserves significantly more quality-typeset paragraphs in large-font narrow-screen Chinese prose. See `CJK_PUNCTUATION.md` and `UPGRADE_FROM_v94.2.md`. The real test EPUB is not distributed.

**Folio v94.2.** Quality typesetting now includes a gentle, wide-column CJK final-line cadence preference and lower-overhead Knuth–Plass state checks. See `CJK_PUNCTUATION.md`, `CHANGELOG.md` and `UPGRADE_FROM_v94.1.md`. A real literary EPUB can be tested locally with `tests/real_literature_v942.py`, but the book itself is deliberately not included.

# Folio v94.1 — punctuation clusters, optical alignment, mixed-script geometry

**What changed** (v94.0 → v94.1):

- **Pair-specific soft contraction goals.** Closing–opening quotes/brackets, nested openers/closers, stop–opening, and repeated strong stops no longer all compete for one global 72% target. The Knuth–Plass solver evaluates four bounded candidate ratios and uses a width-weighted optical preference. It never inserts an unconditional new trim at these boundaries.
- **More accurate ink clearance.** Closing–opening quotations retain a little more visible breathing room, based on each font's Canvas side-bearing measurements. Existing strong comma–opening contraction stays intact, as do literal spaces in the EPUB.
- **Correct line-edge behavior.** Following W3C CLReq §6.1.3, a cluster such as `。”` does not receive extra single-mark end hanging. Horizontal `zh-Hant`/`zh-TW`/`zh-HK` also avoids simplified-Chinese end hanging, while still permitting intra-line punctuation squeezing.
- **Mixed-script accuracy.** Chromium's CSS `text-autospace: normal` produces approximately `1/8em` per Han/Latin transition; the previous `1/4em` assumption overestimated those boundaries. We now use per-run font size and an O(1) advancing run index instead of scanning styled runs repeatedly.
- **Safer pruning of candidate lines.** Punctuation-rich candidate lines are only rejected early after accounting for available measured punctuation, bracket and glue contraction. This prevents a crude fullwidth-advance bound from discarding potentially legal breaks.

**Safety:** Original EPUB content and inline markup are unchanged. Changes apply only with the optional quality typesetting setting. Complex paragraphs still fall back to the browser. Font metrics caches invalidate when reader fonts change. CSS-only/native layout is not changed.

**Verified with Chromium:** 390, 830, 1130 and 1360px viewports; Noto Serif CJK SC and Noto Sans CJK SC; simplified and traditional Chinese language tags; a separate 16px narrow viewport; preserved links/code/source text; no forbidden starts, no visual-overflow reports or additional paragraph fallbacks compared with v94.0. The historical pre-93.7 tests that count intentional optical hanging as overflow fail on both old and new engines and are not counted as successful regression results.

**Performance:** Candidate line geometry still uses O(1) prefix sums, four ratio candidates, and cached Canvas ink measurements. No new geometry reads inside Knuth–Plass; `1/8em` cross-script width accounting avoids excess line estimates. End-to-end time improvements are not asserted without repeated controlled measurements.

**References:** W3C [Requirements for Chinese Text Layout](https://www.w3.org/TR/clreq/) sections 6.1.3 and 6.3.2; [CSS Text Level 4](https://www.w3.org/TR/css-text-4/) section 8.4.

# Folio v93.6 — 可分配的中文标点挤压与行边光学对齐

这是 v93.5 基础上的中文标点排版更新；**Knuth–Plass 仍默认关闭**，不修改 EPUB 源文件。

- **整段断行共同决定标点挤压**：每对标点的 Canvas 墨迹测量只确定安全上限。优化器按行从 48% 的基础挤压到允许的最大值之间选择，而不是对整段都先使用最大挤压。每行最终采用的比例原样写入 DOM，与断行求解共用同一几何模型。
- **行首光学对齐**：仅当字体具有适当的空白时裁减起始开引号、括号的空白；如果段落有实际首行缩进，允许额外最多约 `0.055em` 的微小悬挂，且仍留在缩进内部。无缩进的正文列边不会强行悬挂字形。
- **行末光学对齐**：句读号和结束括号按真实右侧空白有限地悬挂；句读号的最大额外空间不超过 `0.120em`，其他常见闭合标点不超过 `0.085em`。额外允许的距离不等于实际移动距离：后者取决于具体字体的墨迹边界。
- **正确复用排版**：缓存指纹包含每行实际标点挤压系数。视口变化使弹性挤压不同的行不再错误复用旧标点间距。
- **继续保留安全回退**：复杂行、无法精确拟合的内容保留浏览器原生排版；英文技术内容、MathML、行内代码、脚注与原文恢复保持不变。

测试：`tests/cjk_elastic_v936.py`、`tests/cjk_punctuation_v934.py`、`tests/cjk_punctuation_v935.py`，以及真实中文文学 EPUB、SICP EPUB 的 Chromium 回归。测试用的 EPUB 不包含在发行包里。

规范参考：[W3C《中文排版需求》](https://www.w3.org/TR/clreq/) 与 [CSS Text Level 4](https://www.w3.org/TR/css-text-4/)。本实现针对横排中文，是一种保守的浏览器兼容处理；不是全套 CLReq 的实现，也不是对所有字体均适用的纸质印刷级悬挂标点。

---

# Folio v93.5 — 更精细的中文标点排版

Nuanced punctuation pairing distinguishes strong repeated sentence marks from nested brackets/quotes; line-end adjustment is now bounded by actual unused glyph ink space, and all caps respect individual inline font sizes. Knuth–Plass remains optional. See `CJK_PUNCTUATION.md` and `UPGRADE_FROM_v93.4.md`.

# Folio v93.4 — 中文标点精排

Opt-in Knuth–Plass mode now performs CLReq-inspired adjacent punctuation squeezing using actual glyph ink-bearing measurements (maximum 0.34 em), measured opening-mark trim and conservative line-end optical hanging. Unlike a CSS-only approximation, the solver and browser rendering apply the **same** contraction. The native layout remains unchanged when this option is off. This is a restrained subset of Chinese typography requirements, not full CLReq compliance. See `CJK_PUNCTUATION.md` and `UPGRADE_FROM_v93.3.md`.

# Folio v93.3

Cold loading and first-time reflow optimization: the hidden staging iframe can
skip its unnecessary initial paint/layout work, and the pagination engine uses
an **analytical initial container width** to select the column count without
first laying out the entire chapter. Chromium still supplies the exact column
width *after* that selection and before Knuth–Plass composition, preserving
accurate justified lines, footnotes, MathML and native EPUB fallback.

Measured locally with actual EPUBs (2 trials each, Chromium): SICP chapter
click-to-ready median **3.92 → 3.41 s** and Chinese chapter **1.62 → 1.45 s**.
These are indicative local measurements, not device-independent guarantees.
See `UPGRADE_FROM_v93.1.md`, `TYPOGRAPHY_IMPLEMENTATION.md`, and
`tests/first_layout_geometry_v932.py`.

# Folio v93.1

Improves **first-time chapter preparation** by scanning only CSS-defined potentially unsafe indents, and starts the first optional Knuth–Plass reflow without an extra debounce. Typography and original EPUB content remain unchanged in the tested books. Complex code blocks and unsafe publisher styles retain conservative checks. The quality setting remains optional and disabled by default.

See `UPGRADE_FROM_v93.0.md`, `TYPOGRAPHY_IMPLEMENTATION.md`, and `tests/cold_path_v931.py` for the details.

# Folio v92.9

This release is a performance update to v92.8 with a conservative safe-width reflow fast path, grouped page-occupancy measurements, and a CJK spacing-reset correction. The Knuth–Plass option remains opt-in and the original EPUB documents are retained in the browser library. The rendered English and Chinese test pages are identical to v92.8 at the measured original reading widths. See `UPGRADE_FROM_v92.8.md` and `TYPOGRAPHY_IMPLEMENTATION.md`.

# Folio

A clean, installable EPUB reader for Edge and Chrome. Folio runs entirely in the browser: no account, backend, or desktop executable.

![Folio reader preview](docs/reader-preview.png)

## Features

- **v92.8:** Improved paragraph-wide hyphenation decisions and subtle Canvas-measured optical alignment of suitable punctuation, with real EPUB browser tests. The standard layout and offline dictionary remain unchanged; see [typography notes](TYPOGRAPHY_IMPLEMENTATION.md).

- **v92.7:** More reliable word lookup: brief, clearly labeled common uses for ambiguous everyday words; better handling of rare or obsolete dictionary senses; exact-word-first lookup; and improved distinction between a general meaning and a sentence-specific interpretation. See [dictionary quality notes](DICTIONARY_QUALITY.md).

- **v92.6:** Faster Canvas-first Western token preparation, safer English hyphenation, modest Chinese gap compression for tiny resizes, reuse of premeasured break structures, and isolation of MathML/inline code spacing. The standard visual layout is unchanged; the optional algorithm remains off by default. See [the implementation notes](TYPOGRAPHY_IMPLEMENTATION.md).

- **v92.5:** Faster EPUB page counting using already composed Knuth–Plass lines instead of repeatedly measuring every text fragment; lightweight plain-prose preparation; and batched overflow validation with conservative reuse of previously validated small-width adjustments. Text and page geometry are unchanged in tested EPUBs.

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


### v93.3 — Progressive Knuth–Plass completion

The optional Knuth–Plass engine still performs at most its original 300 ms
initial typesetting pass. If that budget runs out, Folio now prepares the
remaining eligible prose during browser idle slices (typically up to 12 ms per
slice) and commits the completed layout **once**, followed by one anchor-aware
repagination. English, Chinese and mixed-script prose, including eligible list
items, are supported; complex code/math/table constructs retain native layout.
Work is cancelled when the EPUB, font/layout key, chapter, or viewport changes,
and paused while speaking, navigating continuously, or using an overlay.
The engine is still opt-in and disabled by default. The design improves
coverage under constrained startup budgets; it does not promise a general
cold-loading speed improvement or remove Chromium's final layout cost.

### v94.7 visual safety and reproducible timings

For paragraphs with EPUB-defined clipping or masking, Folio avoids optical overhang and uses native layout. For ordinary prose, Chinese optical punctuation alignment continues as before. To benchmark on your own machine, install Playwright and Chromium and run `FOLIO_CHINESE_EPUB=/path/to/book.epub python tests/benchmark_visibility_v947.py` from the extracted PWA directory. Run the same script in an extracted v94.6 for an A/B baseline; compare median `solveMs` and `validateMs`, not isolated wall timings.


### v95.41 resource-pipeline changes
Shared publisher CSS imports now reuse bounded decompression work. Illustrated chapters defer later dimensioned images until their page approaches; publisher fonts and complex/undimensioned images still use the original safe path. The initial font readiness check also avoids no-op waits on already loaded, non-remote fonts.
