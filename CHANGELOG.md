## v92.8 — Paragraph line choices and conservative optical punctuation (2026-11-17)

- Add paragraph-level penalties for repeated discretionary hyphens, especially three or more hyphenated lines in succession. Increase the basic cost of dictionary hyphenation so intact words win when the paragraph can still be justified.
- Introduce Canvas-measured **optical right-edge alignment** for selected punctuation (Latin and Chinese commas, stops, closing quotation marks and brackets). The DP and renderer use the same capped end-glyph discount, up to roughly 0.055em (about 1.1px in these tests). Preserve the original EPUB text and inline structure.
- Use a more conservative text-width margin in Western prose, protecting complex source markup. Reject unacceptable line overflow and keep native justification as fallback. Experiments with much larger punctuation hangs caused real browser overflow and were discarded.
- Do not apply hanging inside footnote atoms, inline code or MathML. List prose, blockquotes and mixed-script safety rules remain intact. This optional feature stays disabled by default.
- Regression: SICP at 390/830/1360/2100px passes MathML and 25 footnotes; the 1000px test maintains 90 optimized prose blocks without overflow or fallback. Chinese test preserves 63 blocks. Real SICP passage now keeps *obtained* unsplit where v92.7 used `ob-tained`.
- New focused `tests/optical_punctuation_v928.py`. Performance improvement is not claimed; the extra paragraph options have a small runtime cost on some setups.

## v92.7 — Dictionary sense quality and honest quick meanings (2026-11-17)

- Fix the old **Meaning at a glance** card incorrectly treating the first returned dictionary sense as the most common meaning. Replace it with concise, labeled **Common uses** for especially ambiguous everyday words, including *make* and *good*, while preserving separate full dictionary definitions and part-of-speech labels.
- Expand and bound English dictionary normalization, de-duplicate senses, and demote archaic/obsolete/rare labels from quick summaries. Retain dictionary-specific source attribution and show multiple grammatical senses for uncurated words when appropriate.
- Look up the exact word before attempting inflection fallback; avoid misreading `goods` as `good`, `saw` as `see`, and `better` as `good`. Preserve the original clicked form in the lookup title.
- Verify with mocked English/Chinese API responses, offline quick-gloss access, cache reuse, HTML escaping, and responsive popup geometry. These tests do not claim the live third-party API responses always match their fixtures.
- Re-run real SICP EPUB MathML/footnote regression at 390/830/1360/2100 px, real Chinese EPUB typography regression at 1128–1130 px, semantic prose and service-worker cache tests. No Knuth–Plass layout changes in v92.7.
- Keep the existing EPUB library and reading positions untouched. Offline app-shell cache bumped to v92.7; no new external API or executable dependency.

## v92.6 — Safer multilingual justification and Canvas-first token preparation (2026-11-17)

- Replace per-ASCII-character token allocation with a directly segmented Western word/space/hyphen fast path. A 306-case independent equivalence regression confirms identical offsets and token types, and Unicode paragraphs still use grapheme-aware segmentation. In a focused Node benchmark the tokenization stage is substantially faster; *total* EPUB page readiness has not shown a reliable improvement.
- Cache Knuth–Plass box/glue/penalty breakpoints and width prefix sums alongside Canvas-measured tokens. Reuse the detached original source on width-only reflow rather than concatenating the rendered paragraph's text as part of cache checking.
- Allow **very small negative CJK inter-ideograph spacing** (no more than 0.025em per eligible gap), in addition to bounded positive spacing. Recompute valid breakpoints and fit with the actual rendered width; fall back to native EPUB layout rather than squeeze punctuation, Latin words, or paragraphs that fail quality checks. At a deliberately narrowed Chinese-book viewport, 62 blocks were optimized versus 59 in v92.5, with no detected line overflow.
- Raise the penalties for awkward short English discretionary hyphen fragments and consecutive hyphenated lines; avoid treating mixed-case identifiers and all-uppercase acronyms as ordinary dictionary words. Only use US-English hyphenation patterns for English/Chinese/Japanese/Korean or unspecified-language prose, not known unrelated language codes.
- Reset inherited Knuth–Plass line tracking and word spacing within inline `code`, `kbd`, `samp`, and native MathML boxes, while retaining surrounding paragraph justification. Preformatted code and display mathematics remain browser-managed.
- Browser regressions: real SICP maths and all 25 footnotes, Chinese text and punctuation preservation, list and blockquote prose, line overflow, responsive resizing, page counts, fixed layouts, image viewer, keyboard/pointer navigation, and offline app-shell behavior. A combined long-running test batch timed out after the listed completed checks; its unfinished checks are not claimed as passed.
- Default browser layout and preexisting EPUB books/storage are unchanged; enhanced Knuth–Plass remains off by default. Full and incremental PWA archives remain under 100 ZIP entries and exclude the test EPUBs.

## v92.5 — Faster occupied-page scanning and stable validation (2026-11-17)

- Measure each nonempty Knuth–Plass line box as one occupied-column unit, instead of calling `Range.getClientRects()` for all its internal CJK tracking spans, links and text fragments. Native and complex EPUB content still uses the original text-range scan; illustration-only chapters still count media rectangles.
- Use a `TreeWalker` rejection filter to skip optimized line subtrees during occupancy scanning, rather than visiting every descendant and checking `closest()` repeatedly.
- Add a lightweight preparation path for true text-only paragraphs: skip redundant descendant queries and computed-style lookups for single text runs. Styled runs, MathML, inline code, links and notes retain their original traversal and measurement.
- Batch browser overflow reads before any restoration writes, preventing repeated multi-column reflows when a group of paragraphs requires native fallback.
- Avoid rechecking *already validated*, unchanged line breaks after a tiny (<=2 CSS-pixel) width adjustment only when the same cached source/font is used and no mixed-script geometry correction is required. All new break plans and larger changes continue through browser overflow validation.
- Check the supplied SICP and Chinese EPUBs at desktop widths, preserving 64 and 16 readable pages respectively, original text and links, and first-four-page navigation; regression checks include 390px mobile layouts and actual viewport resizing. Screenshots show pixel-identical SICP rendering and unchanged Chinese reading content (only a transient notification differed).
- This is a rendering-performance and stability update, **not** a new optical-composition algorithm. Benchmarks are dependent on browser environment and should not be treated as guaranteed speedups. Knuth–Plass remains optional and disabled by default.

## v92.4 — Canvas-first incremental typography and responsive-width correction (2026-11-17)

- Precompute styled text boxes using Canvas and retain measurements across width-only repagination; separate paragraph source DOM from the visible line-box tree.
- Preserve existing line nodes when their breakpoints remain unchanged; retarget measured Western/CJK spacing in place and reuse matching line prefixes/suffixes after actual rebreaking.
- Added bounded stability for tiny width changes, avoiding unnecessary CJK/English line flicker while still enforcing the justification quality gate.
- Corrected actual inner-column sizing: an EPUB's text container may be narrower than the visible spread. Use its current content width instead of a stale spread-width offset. Fixes clipped lines after responsive resizing.
- Enabled eligible prose in lists, descriptions, quotations and captions, retaining native layout for blocks whose semantic structure or whitespace makes them unsafe.
- Tested SICP, Chinese prose, footnotes, MathML, responsive columns, image fit, native fallback, source restoration and offline PWA behavior. See typography implementation notes for limitations.

## Folio v92.1 — Better justified spacing, conservative performance improvements (2026-11-17)

- Correct a feasibility bug in the Knuth–Plass glue solver: lines exceeding the goal by a few pixels can now use bounded **negative Western word spacing** rather than being discarded before shrinkability is considered. That provides more good paragraph-wide line-break choices and reduces pressure to over-expand other lines or insert extra discretionary hyphens.
- Use a fast, equivalent ASCII grapheme path for English paragraphs and continue using `Intl.Segmenter` for Chinese, mixed, accented, emoji and complex Unicode text. Source characters and original inline markup are preserved. Use binary search to locate the original styled run when reconstructing each optimized line.
- The observed SICP section 1.1 result at 1000px: lines with >5.5px *additional* word spacing **14→5**, discretionary hyphens **30→27**, 45 optimized paragraphs, no measured overflow. This is a browser regression measurement, not a general guarantee. At 390px, more paragraphs can be handled; some added paragraphs contain additional hyphens, so quality remains subject to visual review.
- The ASCII tokenizer microbenchmark is about four times faster, but complete chapter loading **was not demonstrated faster**. In three local SICP 1000px repeats, median end-to-end time was ~1.65s for v92.0 and ~1.72s for this revision. Quality is improved at some cost; Chromium pagination still dominates elapsed time. Two Chinese 1130px candidate runs took ~0.94–0.96s, with unchanged glyph layout. Do not mistake tokenizer throughput for overall reading-performance improvement.
- Real EPUB checks preserve all 25 section-1.1 SICP footnote links and MathML spacing; the Chinese book still optimizes 63 paragraphs in the tested chapter and retains its native-layout fallback. The deliberately conservative native fallback remains for overwide/complex markup.

**Important:** This is not a fully optical TeX engine. Glyph protrusion, variable-font expansion, and global pagination optimization are not implemented. Knuth–Plass is still optional and off by default. No EPUB books are distributed.

## Folio v92.0 — Better line spacing and less synchronous layout work (2026-11-17)

- Extend TeX-pattern discretionary break candidates to English words of seven or more letters, keeping 2-character prefixes and 3-character suffixes *only* with high penalties. Optimizer chooses them when they prevent significantly worse word spacing; final lines continue to use normal ragged-last book typography.
- Add narrowly bounded per-line **microtracking** (up to 0.014em) for long Western justified lines, coordinated with the existing exact word-space fit. Avoid tracking lines containing MathML so mathematical operators, fractions and conditions keep native math spacing.
- Replace dense runs of independent Chinese character-gap elements with one precisely tracked inline span per eligible ideograph sequence. Preserve source text, inline formatting and kinsoku constraints. On the 111-paragraph Chinese EPUB regression chapter, 2,646 separate CJK spacer elements in v91.9 became 361 grouped tracking spans plus 137 individual spacers.
- Reuse the document's text-measurement canvas and separate line-break preparation from browser geometry validation. Validate after the existing multi-column layout flush, avoiding an extra forced full-chapter layout. Actual overflow still triggers native justified fallback. An overwidth paragraph is not forced through the algorithm.
- Keep publisher MathML, linked footnote superscripts, images, code blocks and fixed-layout EPUBs intact. Preserve all original DOM text and restore it when the setting is turned off. The opt-in setting remains disabled by default.
- Chromium samples from the supplied SICP EPUB show more even spacing and fewer conspicuously over-stretched lines. In three same-environment runs, median elapsed time from enabling the mode to complete pagination was approximately 1.72→1.67 seconds for SICP at 1000px and 1.08→0.88 seconds for the Chinese chapter at 1130px. These results are subject to device/font/browser variability and are not guaranteed speedups.

**Scope:** This remains a selective paragraph typesetter, not complete TeX microtype. Font expansion, glyph protrusion and page-global widow/orphan optimization are not implemented. In particular, complex mixed paragraphs still use native justification when no acceptable fit can be found.

## Folio v91.9 — Justified quality-first Knuth–Plass (2026-11-17)

- The optional Knuth–Plass mode now requests full justification for ordinary prose, including the native fallback, rather than choosing cheap ragged lines. Final lines remain ragged as in normal book typography.
- A real global line-break calculation uses TeX-pattern discretionary hyphens for longer English words (10+ Latin letters), and avoids splitting short words merely to fill a line. The demerit calculation penalizes discretionary breaks and awkward short fragments.
- Calculated word- and CJK-spacing is applied directly to each chosen line. Incompatible or unattractively spaced paragraphs use Chromium's native justified layout with CSS hyphenation rather than forced line boxes.
- For performance, the hybrid optimizer solves a single candidate graph with optional hyphens rather than fully solving non-hyphenated and hyphenated paragraphs separately. Overflow checks are grouped at the paragraph level before any fallback.
- MathML block contents, technical blocks, punctuation constraints, in-book note links, paragraph text and original DOM restoration remain guarded.
- Added regression tests with real SICP and real Chinese EPUB chapters; before/after Chromium screenshots accompany this release but are not part of the PWA zip.

**Limitations:** This is not a full TeX page builder. Some paragraphs remain native when the column is too narrow, the markup is complex or the predicted gaps are unattractive. Native browser hyphenation depends on language metadata and installed dictionaries. Comparisons shown are browser screenshots, not simulated typesetting.

## Folio v91.8 — Measured Chinese and mixed-script justification (2026-11-17)

- Bring Chinese and mixed-script paragraphs onto the same physical glue model used for English: Knuth–Plass now explicitly controls bounded inter-ideograph gaps rather than independently asking Chromium to justify reconstructed lines.
- Restrict stretchable CJK glue to boundaries between true ideographs. Do not add width around fullwidth punctuation, inside Latin words, or across math/footnote atoms; preserve strict punctuation line-breaking restrictions and add ASCII parenthesis handling.
- When a justified line contains both Han and Latin, optimize Han gap expansion together with bounded Western `word-spacing` and compare the actual costs. Protect English font/kerning and avoid excessive English word-space expansion.
- Reconcile mixed-script glyph shaping and browser `text-autospace` using one geometry correction after batched DOM insertion. Leave pure Chinese lines alone when already accurate. Invisible width-only spans preserve the book's `textContent`, inline styling, ordinary links, and reading position.
- Speed up the common pure-English and pure-CJK fit cases with analytic spacing costs instead of candidate enumeration. Skip discretionary English hyphenation search for already well-fitted paragraphs; retain conservative fallback, 300 ms pre-format budget, and a per-paragraph spacer cap to protect complex books.
- Tested original SICP EPUB, a separate real 111-paragraph/14-reference Chinese EPUB chapter (not distributed), and a four-viewport synthetic English/Chinese/mixed XHTML regression. All text remained identical after enable/disable; no recorded line overflow in eligible transformed paragraphs. The English synthetic 1360px test remains 0 spaces above 1.7× natural width versus 21 with native greedy justification.
- The result is a better measured paragraph renderer, not a full TeX engine. Complex markup, unsupported writing modes, overly long paragraphs, page-global balancing, glyph protrusion and font expansion remain delegated to the browser.

## Folio v91.7 — Pretext-inspired precision line fitting (2026-11-17)

- Rework Knuth–Plass demerits around the **actual inter-word spacing that the renderer applies**, rather than approving a breakpoint and letting browser CSS justify it differently. Western lines use per-line, bounded `word-spacing`, including modest compression where needed, while keeping publisher-defined paragraph alignment.
- Adopt stronger stretch/"river" penalties, better fitness transitions, accurate Canvas-measured visible hyphen widths and a proper feasibility check after adjustments. Fix the prior mistaken rejection of lines that only fit after their permitted glue compression and an overly permissive final-line check.
- Prefer native CJK character distribution for mixed justified lines with many ideographs. Continue conservative punctuation restrictions and native fallback for unsupported markup; no inserted source text or invisible edits to the EPUB.
- Recognize safe superscript EPUB footnote anchors as **atomic measured boxes**, keep a note attached to its preceding text, preserve its native DOM/link/ID and reference preview. Paragraphs with unrelated IDs, other superscripts, or complex content still use browser layout.
- Confirm rendered Western fitted-line widths within about 1.6 CSS pixels of the computed goal on synthetic tests at 390–2100px. The synthetic English justification test had no spaces exceeding 1.7× their natural width (versus 21 with native greedy rendering at 1360px). These are local benchmarks, not a claim of universal TeX/LaTeX equivalence.
- Validate the user-supplied SICP EPUB, including MathML, 25 note links, reading-position restoration, inline markup and multi-column pagination. Original book is never bundled. Knuth–Plass remains an opt-in setting.

## Folio v91.6 — SICP EPUB typography and rendering fixes (2026-11-17)

- Restore MathML 3 named spaces to actual numerical MathML Core widths (e.g. `thickmathspace = 5/18em`); confirmed on SICP square-root equation in Chromium. Keep original book file untouched and preserve mtext word-space handling.
- Detect Texinfo `<a class="footnote_link" href="#FOOT4"><sup>4</sup></a>` references and normalize nested superscript CSS to remove large negative publisher margins/padding/offsets. Preserve click-to-follow and hover-to-preview.
- Improve Knuth–Plass with bundled, lazily parsed TeX-derived English hyphenation patterns; compare a discretionary-hyphen plan against the non-hyphenated candidate, penalize visual hyphens and use geometry-safe fallback. Paragraphs with complicated EPUB structures keep native browser flow.
- Complete v91.5's quiet-UI cleanup: remove margin hover instructions; consolidate mouse/key/hold guidance in the shortcut guide; remove redundant PWA installation and long reader explainer text.
- Regression-verified actual `sicp.epub` section 1.1 at 390, 830, 1360, and 2100 px; no EPUB content is bundled. PWA and reader checks continue to pass.

## Folio v91.5 — Quiet interface copy and navigational help (2026-11-17)

- Removed descriptive browser tooltips from the invisible left/right reading margins; the margins retain their hand cursor, single-click and press-and-hold behavior, and accessible Previous/Next page names.
- Consolidated mouse-edge, mouse-hold and keyboard page-turn instructions in the Reading shortcuts guide (`?`).
- Removed redundant PWA/online dictionary instructions and the verbose compatibility blurb from Settings, and shortened the backup helper text. PWA installation/update buttons and accessibility status remain intact.

# v91.4 — Display-equation MathML spacing and faster paragraph analysis (2026-11-17)

- Correct missing gaps around natural-language words inside **display MathML**, especially `<mtext>if </mtext><mi>x</mi>`, where MathML drops the author's trailing ASCII space. Insert `<mspace width="0.25em">` only when a boundary gap is missing; preserve authored `<mspace>` and the original equation text. Also repair inline MathML, without splitting formulas across Knuth–Plass lines.
- Apply lightweight per-chapter repair *before pagination* (one traversal; no geometry reads). Spacing adjusts automatically with the math font size. Repeated calls are idempotent.
- Avoid inappropriate `overflow-wrap:anywhere` inside display equations, keep MathML text tokens together, and prevent Knuth–Plass from reflowing publisher display-math containers.
- Cache computed style references within a paragraph's text-run measurement pass; smooth adjacent ragged-line lengths with a bounded transition penalty and eliminate redundant optimizer tolerance retries. Keep existing width cache, batched DOM writes, and native fallback for complex math.
- Add 4-viewport MathML spacing tests, an explicit-publisher-gap no-duplication test, off/on restoration tests, and update the offline PWA cache to include the MathML helper.
- Preserve v91.3 typography settings, book storage, browser speech, and image navigation.

# v91.3 — Knuth–Plass text-quality fixes and inline MathML (2026-11-17)

- Fix normal prose: preserve the author's left/justified alignment and eliminate a 2.8% line-width shortfall that caused excessive justification. Permit carefully limited justification only when spacing is reasonable.
- Parse XHTML source newlines/tabs/repeated spaces as collapsed CSS whitespace, retaining every source character and restoring the original DOM when the option is switched off.
- Include inline MathML fractions, subscripts, and superscripts in the paragraph-wide DP optimizer as measured atomic boxes; preserve native MathML layout inside each equation. Block or unmanageably wide equations remain native.
- Budget CJK/Latin automatic spacing, validate actual shaped line widths in Chromium and automatically revert paragraphs that would overflow.
- Add Chromium regression coverage for math, mixed-script prose, publisher alignment, HTML whitespace, 390–2100px layouts, and complete restoration. The default remains off.
- Keep PWA book data, fonts, image viewer, quiet margin navigation and browser speech unchanged. Update shell cache to v91.3.

# v91.2 — Knuth–Plass multilingual typesetting (2026-11-17)

- Added a genuine TeX-style paragraph-global minimum-demerit line-break optimizer with boxes, glue, penalties, fitness classes and CJK kinsoku constraints; the feature stays optional/off by default.
- Preserved inline English/Chinese font runs and author emphasis during DOM line reconstruction; kept original nodes for exact restoration.
- Measured all paragraphs before applying any transformations to prevent expensive repeated multicolumn reflows.
- Kept links, selectable text and EPUB paragraph IDs intact; complex inline markup retains native browser layout.
- Updated PWA offline shell to include the local engine, and shipped the same engine embedded in standalone HTML.
- Added 3-viewport real-browser multilingual line-break, punctuation, overflow, fallback and restoration regression tests.
- No change to Web Speech engine, illustration-viewer modes, or margin-click page navigation.

## v91.1 — Optional native text composition, quiet margin clicks, better image inspection

- Retained the original v91 Web Speech reader and PWA data model. Experimental direct Edge WebSocket TTS is NOT reintroduced.
- Evaluated Pretext and Knuth–Plass: introduced an opt-in browser-native `text-wrap:pretty` mode with strict CJK punctuation handling and mixed-script support, rather than rewriting book text or claiming a complete Knuth–Plass algorithm.
- Removed left/right margin arrow glyphs and hover shading; preserved accessible buttons, hand cursor, single-click and press-and-hold turning. Click targets extend across the blank margin without covering the text.
- Separated illustration preview into **Fit page**, **Fit width**, and **100%**. Fit width scrolls tall images vertically instead of silently shrinking them back to page height; Fit page now fits the actual stage, not a fixed 76dvh cap.
- Preserved existing rendering settings, EPUB libraries, CJK font fallback policy, and chapter anchors. `folio-shell-v91.1` updates the offline PWA shell.
- Added `TYPOGRAPHY_EVALUATION.md` and targeted Chromium image/typography tests.

## v91 — Technical EPUB blocks and safer theme contrast

- Prevented clipped first characters and borders in preformatted source-code blocks with negative publisher margins or hanging indents.
- Long code lines now wrap within one reading column, preserving whitespace and explicit line breaks instead of disappearing inside a hidden or oversized horizontal scrollport.
- Corrected wrapping and font-size inheritance for nested `<pre><code>` (previously shrunk twice), long technical identifiers, and code blocks that fragment across pages; restored left/right keyboard page turning for wrapped technical blocks.
- Added a bounded contrast check for publisher-styled code and quotations. When their background conflicts with Paper, Warm, or Night text, Folio uses a readable theme surface; legible publisher colors are preserved.
- Clamped negative inline margins on publisher tables and figures so they cannot disappear beneath page-edge navigation masks.
- Added Chromium regression coverage at 390, 830, 1360, and 2100 CSS pixels, covering 1/2/3 columns, code edges, long lines, theme changes, quotation contrast and technical-block navigation.
- Bumped the service-worker app-shell cache to `folio-shell-v91`; EPUB storage and saved reading data are unchanged.

## v90.9 — Search focus and PWA action spacing

- Eliminated the double/mismatched focus border on the library's “Find a book or author” field. The rounded outer field now owns the focus indicator, and the inner input remains accessible without drawing a second rectangular outline.
- Applied the same compound-input treatment to in-book search, including Paper, Warm, Night, and System themes.
- Grouped the Install Folio and Check for app updates actions with a consistent 10px gap and shared button sizing, including when the Install action appears conditionally.
- Kept the existing theme system, unified local-first CJK fonts, official Google Fonts web fallback, reader engine, and PWA-only architecture unchanged.
- Updated the offline shell cache to `folio-shell-v90.9` and added browser regression checks.

## v90.8 — Full theme consistency and typography initialization

- Replaced Paper-specific sidebar labels, Contents links, button hover colors, focus outlines, loading overlay, toast and TTS controls with shared Paper/Warm/Night theme tokens.
- Synchronized the dictionary popup, note popup, PWA update notice and notifications with the active theme, including elements rendered outside the main application container.
- Fixed text contrast on the Night narration dock and on primary buttons with the light Night accent; unified disabled/hover/focus presentation.
- Improved theme consistency for book removal, warning actions, search highlights, controls and placeholder text, without changing EPUB publisher artwork or fixed-layout content.
- System theme now applies the appropriate native form-control color scheme and updates browser theme-color metadata from the actual displayed palette.
- Fixed fresh-profile and invalid saved Chinese font values incorrectly overriding the default selection, which could leave the Chinese-font dropdown blank. Existing legacy Source Han/Noto settings remain migrated normally.
- Added Chromium regression checks across 390px/1360px, Paper/Warm/Night/System and the detached notification/dictionary surfaces.
- Retained PWA-only design, automatic installed CJK font priority, and official Google Fonts fallback.

## v90.7 — Unified CJK families and themed library controls

- Consolidated the separate Source Han and Noto CJK Serif/Sans choices into a single local-first Serif and a single local-first Sans setting, with official Google Fonts as fallback.
- Automatically migrate legacy `Noto Serif CJK SC` / `Noto Sans CJK SC` settings, including reading-data backups.
- Removed the obsolete manual Source Han file-import panel and related data-loading code; no font binaries are bundled.
- Replaced native library select popups with consistent themed, accessible menus. Four filters support keyboard arrows, Home/End, Enter, Escape, pointer selection and native-select change events.
- Improved theme consistency, menu focus, and narrow-window behavior. Preserved PWA-only architecture.

## v90.6 — Local-first Chinese font selection

- Prefer installed Noto CJK/Source Han Regular and Bold faces before requesting the official Google Fonts CSS2 stylesheet.
- Keep explicitly imported Source Han files ahead of automatic font choices.
- Load the Google stylesheet and required glyph subsets only when local probing fails, with a bounded timeout and reliable fallback.
- Apply the same local-first rule to dictionary UI and show whether the active font is installed, imported, or from Google Fonts.
- No third-party Google Fonts mirror or backend.

# v90.5 (2026-11-15)

- Added **Noto Serif SC** and **Noto Sans SC** as explicit Google Fonts webfont choices for Simplified Chinese, using CSS2 Regular and Bold faces. New installations default to Noto Serif SC; stored font selections remain unchanged.
- Request the official Google Fonts CSS stylesheet, then allow Chromium to fetch only the WOFF2 character subsets required by the EPUB text. This avoids trying to fetch a complete huge CJK font from an unreliable third-party CDN.
- Verify that the correct Regular face loaded in the EPUB iframe, and report its actual provider in Appearance. Corrected status refresh when a prepared chapter replaces the prior iframe.
- Preserve Source Han Serif/Sans options and user-imported local Source Han fonts. Keep system fallbacks if Google Fonts is unreachable.
- Added a standalone Google Noto SC diagnostic and a regression test that intercepts the CSS and font requests and checks actual custom glyph sources. The test uses separate in-memory CJK fixtures and does not bundle their binaries.
- Updated PWA shell cache to `folio-shell-v90-5`. No backend or native executable; no library data migration.
- **Limit:** External Google Fonts connectivity was not verified in this sandbox because outbound DNS is blocked. The browser font loading path was tested with intercepted font responses.

# v90.4 (2026-11-15)

- Added direct import of user-owned Source Han Serif/Sans Regular and optional Bold OTF/WOFF2/TTF files in Appearance.
- Stored imported fonts in browser IndexedDB when available, with an in-session fallback; no uploaded file is sent to a remote service.
- Source Han loading now tries imported files first, then HTTPS fonts, then real installed local faces. Font status reports the source.
- Added timeout and short retry cooldown for unreachable external hosts.
- Enhanced standalone font diagnostic with local Regular file pickers, not dependent on localhost.
- No font binaries included.

## v90.3 — Source Han rendering verification (2026-11-15)

- Tested the actual standalone reader rendering in Chromium using separate, independent Serif/Sans WOFF2 fixtures. DevTools confirmed the actual glyph source, and each displayed Regular Chinese text passage matched the locally installed corresponding Regular face pixel-for-pixel. **These controlled fixtures are Noto CJK SC fonts, not the genuine hosted Source Han files.**
- Verify the first four bytes of every downloaded webfont are `wOF2` before loading it. Incorrect HTTP content now triggers fallback instead of reaching FontFace.
- Show Source Han web-font load/failed/fallback state below the Chinese font selector in the Appearance panel; do not confuse computed CSS family names with proof of a loaded face.
- Add `SOURCE_HAN_FONT_CHECK.html`, a standalone, no-server diagnostic that requests the same actual Source Han Serif/Sans Regular/Bold URLs and provides side-by-side rendering with local fonts. It reports fetch and WOFF2/FontFace failures.
- Add `tests/source_han_rendered_faces_v903.py` to independently test Serif/Sans rendered glyphs (not just network request names).
- The sandbox blocks remote font downloads and local/file navigation. The real CDN font bytes and end-user Windows rendering **could not** be independently validated here; run the diagnostic on a normal network-connected Edge/Chrome installation.
- PWA cache version: `folio-shell-v90-3`. No changes to IndexedDB, EPUB data, bookmarks or reading positions. No backend or native launcher.

## v90.2 — Real web fonts and GitHub README (2026-11-15)

- Explicitly load static Source Han Serif CN and Source Han Sans CN **WOFF2 Regular/Bold** from publicly hosted webfont sources. This replaces the large Adobe OTF CDN path.
- Make the selected web font the primary CSS family, even when a local Source Han font exists; keep installed fonts as offline fallbacks.
- Use `document.fonts.load()` to initiate an actual browser request and verify that a web face loaded before applying the reader's webfont-specific layout rules.
- Keep the font request asynchronous and extend its timeout for slower first loads; do not bundle font binaries or store them in the PWA application cache.
- Replace the long version-by-version README with a concise GitHub project overview. Historical changes remain documented below.

## Folio v90.1 — Adobe static Source Han fonts (2026-11-15)

This corrective PWA update supersedes v90's experimental Source Han weight handling.

- The previous `cn-fontsource-...-sc-vf` webfont CSS used **variable** Source Han fonts. Selecting the `Regular` weight did not guarantee that a real region-specific Regular font file was rendering; unavailable webfonts could also leave the browser showing a thinner-looking fallback.
- Folio now uses the **official Adobe region-specific static CN fonts**: `SourceHanSerifCN-Regular.otf` and `SourceHanSansCN-Regular.otf`, with distinct official `*-Bold.otf` faces for actual emphasis. It makes a `@font-face` declaration for each named style instead of applying manually tuned variable-font weights.
- Prefer a matching installed local font; otherwise load the official static font file from Adobe's public repository through a versioned GitHub/jsDelivr CDN URL. The reader and dictionary use the same mechanism. When offline or blocked, platform CJK fallbacks still work.
- The fonts are only requested when Chinese text is rendered / a Chinese dictionary definition needs to be shown, not simply from opening the Library. Remote OTFs are larger than segmented variable webfonts and may be slower on the first load. They are not included in the ZIP.
- Kept v90's across-theme dropdown, scrollbar, Contents spacing and UI palette fixes intact. No changes to books, IndexedDB, bookmarks, shelves or narration logic.

The linked Adobe reference page lists Regular as a distinct design and shows regional glyph differences; its raw page CSS could not be retrieved directly in this runtime, so this update follows Adobe's official published static CN binaries and standard CSS `@font-face` practices rather than claiming a byte-for-byte copy of its web stylesheet. Browser typography can still differ from Adobe's page by text size, OS rasterization and display scale.

Verification: `python tests/source_han_static_faces_v901.py` injects a local test font at the official CDN URLs so that the browser's real font-loading logic can be exercised without network access. No test font is included in the release. Standard theme and EPUB regression suites also pass. Offline PWA restart on a deployed HTTPS origin remains to be verified.

## Folio v90 — Uniform UI palettes and spacing (2026-11-15)

A PWA-only design consistency release based on v89. No server, installer, desktop app or storage migration.

- **Themed library dropdowns:** all four Library dropdowns (status, sorting, shelf and cover/list display) now share the custom, browser-accessible picker style used in Appearance and narration controls. They inherit Paper, Warm, Night and live System colors for the closed control, open options, selected row, hover state and chevron. Native-select fallback remains available on browsers lacking `appearance: base-select` support.
- **Uniform scrollbars:** removed the legacy Warm-only thin/8px rules. Standardized the same scrollbar-width policy and 10px WebKit fallback across library, drawers, search, shortcuts, dictionary details, image/table viewers and supported select pickers. Each page tone retains its own palette.
- **Contents spacing:** the chapter-title filter sits 14px below the Contents/Bookmarks tab border, with a 15px gap to the first chapter-list area, rather than touching the tab line and leaving excessive whitespace below. Filter and chapter titles share a text alignment column; a narrow-phone variant keeps safe side margins.
- **Other palette fixes:** TTS dock background/borders, buttons and disabled/hover behavior, active TOC rows, drawer tabs, card action buttons, loading and toast surfaces, and focus outlines now derive from theme tokens rather than hard-coded Paper-green/white colors. Preserved the distinct gold favorite state and danger actions.
- **Validation:** browser-computed color and scrollbar-style checks at 390px and 1360px in Paper/Warm/Night, actual open select popover screenshots, Content drawer geometry assertions; retained library, reader, TTS, and service-worker tests. No changes to book layout, narration timing, dictionary sources, data formats, or EPUB content.

The PWA service-worker cache is `folio-shell-v90`. An actual offline restart on a deployed HTTPS origin remains unverified in this environment; the offline cache simulator passes.

## Folio v90 — Uniform UI palettes and spacing (2026-11-15)

A PWA-only design consistency release based on v89. No server, installer, desktop app or storage migration.

- **Themed library dropdowns:** all four Library dropdowns (status, sorting, shelf and cover/list display) now share the custom, browser-accessible picker style used in Appearance and narration controls. They inherit Paper, Warm, Night and live System colors for the closed control, open options, selected row, hover state and chevron. Native-select fallback remains available on browsers lacking `appearance: base-select` support.
- **Uniform scrollbars:** removed the legacy Warm-only thin/8px rules. Standardized the same scrollbar-width policy and 10px WebKit fallback across library, drawers, search, shortcuts, dictionary details, image/table viewers and supported select pickers. Each page tone retains its own palette.
- **Contents spacing:** the chapter-title filter sits 14px below the Contents/Bookmarks tab border, with a 15px gap to the first chapter-list area, rather than touching the tab line and leaving excessive whitespace below. Filter and chapter titles share a text alignment column; a narrow-phone variant keeps safe side margins.
- **Other palette fixes:** TTS dock background/borders, buttons and disabled/hover behavior, active TOC rows, drawer tabs, card action buttons, loading and toast surfaces, and focus outlines now derive from theme tokens rather than hard-coded Paper-green/white colors. Preserved the distinct gold favorite state and danger actions.
- **Validation:** browser-computed color and scrollbar-style checks at 390px and 1360px in Paper/Warm/Night, actual open select popover screenshots, Content drawer geometry assertions; retained library, reader, TTS, and service-worker tests. No changes to book layout, narration timing, dictionary sources, data formats, or EPUB content.

The PWA service-worker cache is `folio-shell-v90`. An actual offline restart on a deployed HTTPS origin remains unverified in this environment; the offline cache simulator passes.

## Folio v89 — Accurate suspend saves and more robust word lookup (2026-11-15)

Folio remains an installable, **pure static PWA**. There is no native executable, local server, launcher, proxy route or change to browser storage origins.

1. **Suspend-safe reading positions.** On visibility loss, pagehide or unload, resolve a pending text anchor **before** writing progress to localStorage. A backgrounded PWA can be frozen before its next animation frame or 350 ms debounce fires; the new synchronous final flush prevents losing the latest in-page reading location. Existing v2 anchor/backup formats are unchanged.
2. **Dictionary cache reliability.** Word definitions are held in a 128-entry, 30-minute session-only LRU. Failed/empty requests are not cached, so a later lookup can retry after the network returns. The cache is cleared when a personal dictionary key changes; no definitions or keys are persisted by the cache.
3. **Dictionary viewport safety on mobile.** The lookup panel uses `visualViewport` bounds (including offsets from pinch-zoom and the virtual keyboard), limits its actual width and height, and clamps without flipping placement on a late response. It responds to visual-viewport resize **and** scroll; sizing overrides are removed when the panel closes.
4. **PWA app-shell version.** Service worker uses `folio-shell-v89`. The offline shell still caches only the four static app-shell assets; imported EPUBs remain in IndexedDB and dictionary queries remain uncached. The service-worker unit test and local test assertions have been updated for v89.
5. **Automated coverage.** `tests/reading_engine_v89.py` exercises LRU, expiry, failure retry, narrow/offset visual viewports and a synchronous anchor save while an animation-frame update is pending at 390/1360px. The previous EPUB layout, TTS, keyboard, library, backup and fixed-layout suites remain included.

No change to the core CSS multi-column paginator, chapter-staging pipeline, narration timing, or EPUB parsing. The browser sandbox blocks localhost (`ERR_BLOCKED_BY_ADMINISTRATOR`), so a real installed-PWA offline restart is not claimed as verified; simulated service-worker tests pass.

## Folio v88 — Faster line-level TTS highlights and navigation consistency (2026-11-14)

1. **Lower-cost line highlighting during narration.** For straightforward horizontal LTR prose, determine a spoken line with bounded exponential/binary character-location probes instead of always measuring each character. Fall back to the original conservative walk for CJK, right-to-left or complex inline markup, where vertical geometry may not be monotonic. Continue using the same CSS Highlights and DOM text map; no EPUB DOM or pagination changes.
2. **Less work at speech boundaries.** Find spoken words with binary search in the sorted word-offset list. Line-only reading focus no longer constructs word tokens unless required for word focus.
3. **Home/End respects independent browsing.** Explicit jumps to the beginning/end of a chapter now enter reading Back history and suspend automatic narration following while speech continues, both in the main document and when focus is in the EPUB iframe. The existing Follow button / R shortcut can resume following.
4. **PWA cache regression coverage.** Unit-test service-worker install/activate, the offline app-shell response and exclusion of EPUB/dictionary data from Cache Storage. This is a simulated service worker and does not replace a real installed-PWA offline-restart test.
5. **Compatibility.** No changes to EPUB parsing, actual page detection, double-buffered chapter loading, local library schema, backups, dictionaries, or native integration. Increment the static app-shell cache to `folio-shell-v88`; books remain in IndexedDB only. No server, proxy, installer, or executable.

Tests: `python tests/reading_engine_v88.py` verifies sampled line boundaries against the v87 sequential reference at 390/1360px on English, CJK, RTL and mixed inline markup, checks reduced geometry operations in eligible passages, and tests Home/End with mocked active TTS. `node tests/service_worker_v88.cjs` tests cache behavior. The v78–v87 browser regressions are retained. Real deployed-HTTPS service-worker restart and actual natural-voice boundary timing remain to be tested.

## Folio v87 — Independent page browsing during narration (2026-11-14)

1. Manual page turning, page-number jumps, and deliberate in-chapter anchor jumps can temporarily suspend TTS auto-follow without pausing or canceling speech. An on-demand **Follow** action (or **R** shortcut) returns to the current spoken character, with a safe passage-start fallback. Natural transitions between spoken passages do not cancel independent browsing.
2. Decouple speech highlighting from the page-following logic. Turning Reading focus Off no longer accidentally prevents narration-driven page changes.
3. Avoid character layout/geometry reads on speech boundaries when both highlight and automatic follow are off.
4. Reset the temporary browsing state when narration stops or restarts; no new persistent settings or changes to data/backup formats.
5. Add Chromium regression tests for 390px and 1360px layouts; preserve the v86 pagination, TTS mapping, bookmarks, search and PWA-only architecture. Bump shell cache to `folio-shell-v87`.

## Folio v86 — Long-chapter narration and progress reliability (2026-11-14)

1. Reduce read-aloud starting-position lookup in long, ordinary reflowable chapters from a full sequence of rendered passage-geometry reads to a bounded monotonic spread search, with local checks and a fallback for complicated publisher layouts. Spoken text, page layout, and word/line highlight ranges are unchanged.
2. Reuse a document's speech text-map on subsequent narration starts when its content and accessibility-relevant attributes are unchanged. Observe text and visibility changes to invalidate; do not invalidate merely because the reader transforms the body during a page turn. Bound retained maps to 350,000 characters to avoid additional long-lived memory overhead on huge chapters; old iframe maps are weakly held.
3. Persist page changes caused by automatic word-boundary narration-following. A user closing the tab during spoken reading now has the updated page recorded even without a manual turn. Progress storage remains debounced and uses the existing data schema.
4. Add synthetic long-chapter regression tests at 390px, 1360px and 2100px for speech starting near the selected content, multi-column layouts, live text invalidation and JavaScript safety. Retain all previous EPUB, bookmark, backup, library, rapid navigation and theme tests.
5. Keep the exact v85 EPUB layout and paginator, including content-based anchors, image handling and staged chapter transitions. A more aggressive bulk page-detection shortcut was benchmarked but deliberately **not adopted** after it incorrectly identified blank layout space as readable content in a complex fixture.
6. Bump static service-worker shell cache to `folio-shell-v86`. IndexedDB and all persisted settings remain compatible. No native server, local dictionary proxy, or executable is included.

Limitations: The regression tests use synthetic EPUBs and a mocked SpeechSynthesis engine; precise natural voice boundary callbacks and offline HTTPS service-worker launch must be checked in actual Edge/Chrome deployments.

## Folio v85 — Speech fidelity, keyboard hold, and popup stability (2026-11-14)

1. Rework TTS DOM extraction to keep `<br>` boundaries, ignore CSS-hidden content, and exclude ruby phonetic annotations and duplicate MathML annotation nodes. Retain original UTF-16 character-to-DOM mapping for speech highlights.
2. Respect substantial inline `lang`/`xml:lang` changes in per-utterance speech segmentation; prefer strong Han/Latin script evidence over inherited document language, and avoid fragmenting at short acronyms.
3. Stop auto-advance narration if a requested next chapter did not actually load. Retain stale callback cancellation and previous/next spoken passage controls.
4. Support held arrow/Space/PageUp/PageDown when native repeat events are disabled by extending the no-repeat watchdog, while keeping keyup, blur, visibility and panel cancellation behavior.
5. Clamp an open dictionary card to a resized viewport without moving it as definitions load. Normal repagination may close the card to avoid detaching it from its word.
6. Add regression `tests/reading_engine_v85.py`; update static PWA/offline smoke version assertions. Bump shell cache to `folio-shell-v85`.
7. No changes to IndexedDB storage, bookmarks, chapter anchors, EPUB binaries, dictionary network dependencies, or existing PWA/standalone formats. No native or Go components.

## Folio v84 — Reading position stability, instant bookmarks, and narration control (2026-11-14)

1. Save exact chapter positions with **v2 content witnesses**, retaining the bounded child-node path and a small before/after text context. When a publisher's rendered DOM changes harmlessly, a bounded, unique-text fallback recovers the passage. Ambiguous or missing witnesses fall back to the original chapter fraction. Legacy v1 anchors remain valid.
2. Capture the visible reading anchor **before layout measurement and CSS column changes** on font/image/viewport reflows. The real passage takes priority over the old page fraction, minimizing jumps during late font and image loading.
3. **Instant same-chapter bookmarks** restore the reading anchor in the existing iframe instead of rebuilding and reloading a chapter. Cross-chapter bookmarks still use the double-buffered chapter loader.
4. Add **Previous / Next spoken passage** to the TTS dock. Preserve pause/play state, cancel stale utterance callbacks, and follow the selected spoken passage without rebuilding chapter or speech text maps. Word and line highlighting remains driven by actual speech boundaries.
5. **Shift+Space** turns backward, matching common e-reader conventions. The held-key navigation timer no longer resubmits an in-flight chapter-edge transition.
6. JSON and ZIP backup validation now preserves both v1 and v2 content anchors, with bounded text witness fields. The overall backup schema, EPUB binary storage, book IDs, settings, custom shelves, and PWA-only architecture remain unchanged.
7. Added `tests/reading_engine_v84.py` covering 390/1360/2100 px reading, bookmark navigation without restaging, JSON backup of v2 anchors, and mock SpeechSynthesis skip/pause/stale-callback behavior. Other browser regression suites continue to run. The app-shell cache is `folio-shell-v84` and contains no book data. Live deployed HTTPS/offline restart still requires external verification.

## Folio v83 — Jump history and searchable contents (2026-11-14)

- In-memory Back/Forward buttons for deliberate jumps made through the table of contents, bookmarks, book search, explicit EPUB links, page-number jumps and whole-book progress slider. Positions retain content-based anchors where available; regular page turns and footnote returns do not pollute this history. History resets on book changes and does not alter saved positions or backups.
- Search within the table of contents, including normalized Chinese and Unicode text matching. Counts all matches but caps rendered entries at 220 to keep large TOCs responsive. Keyboard Down focuses the first result; Escape clears a nonempty filter.
- Small accessible footer actions and responsive layout polish; no server/native dependency, no change to the GPU page engine or EPUB storage format.
- Shell-cache namespace is now `folio-shell-v83` (only app assets; never book data). All existing features retained.

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

## v81 (2026-11-14)
- Browser/PWA-only release on v80. Library favorites persisted with existing settings and restored in backups; favorite filter and clear-filters action.
- Approximate whole-book progress navigator with chapter preview, explicit commit, and G shortcut; intra-chapter jumps avoid re-staging.
- Updated cache namespace to folio-shell-v81. No native executable, proxy, or server.

## v80 — PWA-only rollback and hold-to-turn navigation (2026-11-14)

1. **Revert the v79 optional native launcher entirely.** No Go executable, Go source, Windows CMD launcher, local HTTP server, or `/__folio` dictionary proxy remains in the PWA package. Folio stays a static HTTPS-hosted PWA and standalone HTML.
2. Add continuous **press-and-hold navigation** to all four previous/next controls, while preserving single-click behavior and held keyboard/wheel navigation. Holding pauses through chapter transitions; pointer cancellation, movement, blur, tab hiding, or opening another panel stops it. A long press suppresses the redundant release click.
3. Add unobtrusive browser PWA diagnostics and a manual app-update check in Appearance & data. Report actual active service-worker shell status, installation display mode and online/offline status without claiming a page is installable on `file://` or a non-secure origin.
4. Bump the service-worker application-shell cache to v80; only app shell resources are cached, never EPUBs, definitions or external dictionary responses. Books and progress remain in local IndexedDB/localStorage, with portable full-library backup support.
5. Retain v79 library sorting/status filters, System theme, shortucts and EPUB downloads. No changes to book IDs, bookmark format, page geometry, or voice implementation.

## v79 — Library organization, original EPUB export, and keyboard help (2026-11-14)

1. Sort the library by recently opened, recently added, title, author, or reading progress. An independent status filter shows all, not started, in progress, or finished titles; combines with the existing bilingual title/author search. Preferences persist in the existing settings and portable backups.
2. Add a **System** page-tone option that follows the operating system’s dark/light preference, including the reader iframe and fixed-layout backdrop. Manual Paper/Warm/Night choices retain their existing behavior and saved values.
3. Download any book’s **original EPUB bytes** directly from its shelf card without re-encoding the EPUB or modifying the copy in local storage. Destructive Remove and nondestructive Download remain separate, keyboard accessible actions.
4. Add a keyboard shortcut reference under Appearance & data, accessible with `?`, with Escape, keyboard focus containment, and a themed dialog. Ctrl+F/Command+F now targets Folio’s full-book search while reading, or library filter when on the shelf. Browser find is unchanged in text fields; outside Folio, browser controls are unaffected.
5. (Reverted in v80) The optional local Windows server experiment was removed; only direct-browser dictionary sources and static PWA hosting remain.
6. Library controls adapt to narrow windows and all base color themes. No changes to book IDs, EPUB rendering, pagination, voices, dictionary sources, service-worker offline behavior, or the full-library backup archive schema.
7. Expanded synthetic Chromium tests cover sorting, filtering, original EPUB-byte download, saved preferences, shortcut dialog and book navigation, plus v78 EPUB layout and backup/restore regressions.

## v78 — Full-library ZIP roundtrip and EPUB fixed SVG pages (2026-11-14)

1. Render pre-paginated EPUB 3 SVG spine pages at an authored `viewBox` or numeric width/height on a fitted single-page canvas. Preserve SVG-only reflowable behavior and ordinary mixed-layout chapter navigation.
2. Add a portable full-library ZIP archive containing untouched EPUB bytes, all saved bookmarks, positions and supported reading/voice/appearance settings. Import and merge locally, re-deriving IDs on the destination and remapping progress/bookmarks to each restored book.
3. Preserve the small reading-data-only JSON import/export option. Add archive entry/size/uncompressed-size validation and a 420 MiB full-library export cap to reduce runaway browser memory usage. The archive is unencrypted; no remote upload is used.
4. Fix reading-data restore controls for word/line speech focus, quick voice and Chinese online font weight, keeping visible controls synchronized with the imported settings.
5. Bump PWA offline shell cache to `folio-shell-v78`. Add a reproducible `tests/smoke.py` synthetic Chromium suite for fixed SVG, mixed reflowable/fixed XHTML chapters, adaptive columns, Night mode and cross-session EPUB ZIP roundtrip with position restoration at 830/1360/2100 CSS px.
6. Limitations: fixed-layout interactivity/spreads and DRM remain outside scope; synthetic tests do not replace a real-world EPUB corpus; exporting many very large EPUBs can still tax browser memory. No major change to the wheel/held-key GPU turning pipeline or dictionary popup behavior.

## v77 — Fixed-layout XHTML and technical reading (2026-11-14)

1. **Basic EPUB 3 fixed-layout pages:** Read package `rendition:layout=pre-paginated` and per-spine `rendition:layout-pre-paginated`/`rendition:layout-reflowable` properties; require valid authored XHTML viewport dimensions. Display each valid fixed XHTML page on its own scaled, centered canvas, preserving absolute positions and publisher CSS. Never apply the normal prose column and typography overrides to these pages.
2. **Mixed-layout books:** Reflowable spine items in the same EPUB still use Folio's existing one/two/three-column, GPU-accelerated page turning. Fixed pages remain a single logical page, and next/previous continues through the same spine navigation.
3. **Safe fallback:** Missing or invalid fixed-layout viewport metadata uses the existing reflowable XHTML path, not guessed viewport dimensions. No changes to DRM handling or scripts sandbox policy.
4. **Reflow and theme handling:** On fixed pages, window resizing recalculates the fitting transform without rewriting the document layout; theme changes update the canvas backdrop without overriding publisher typography.
5. **More useful scientific tables:** Detect effective column count using `colspan`, not only the number of cells. Expanded table viewer supports wider technical tables and retains safe text alignment, header IDs, and `headers` relationships as well as caption, row groups, MathML, and ruby. Author CSS and scripts are not imported into the top-level document.
6. **Scientific content:** Keep long code and block mathematical expressions inspectable through bounded horizontal overflow. Shift+wheel over a horizontally overflowing `pre`/block MathML scrolls the content without turning the reader page. Preserve table header/footer and row break boundaries when feasible.
7. **Verification:** Three viewport sizes (840, 1360, 2050 CSS px) with fixed–reflowable–fixed chapters, source positions, tables with 26 rows and merged headers, horizontal formula scrolling, theme/font/viewport changes, and a malformed-viewport fallback; reran v70–v76 search, EPUB asset, TOC, narration, bookmark, and footnote suites. Public publisher EPUB download was unavailable, so validation remains synthetic. Basic fixed XHTML support does **not** imply full compliance with all EPUB fixed-layout, two-page-spread, media-overlay, or interactive-content features.

## v76 — Compatibility and scientific-content fixes (2026-11-14)

1. Resolve TOC and reader links targeting a manifested foreign-format spine item to the declared readable fallback, without expanding the reading order or loading arbitrary assets.
2. Separate durable EPUB compatibility CSS from the dynamic reader layout style so SVG-only page fitting survives all settings changes.
3. Allow horizontal inspection of wide block MathML within its own bounds; retain native MathML structure and readable symbol sizing.
4. Treat EPUB 2 NCX navPoints with no direct `<content>` as non-navigable hierarchy headings; prevent inheritance of descendant targets/labels.
5. Choose the OPF-typed EPUB package rootfile when container metadata contains several resources.
6. Use namespaced EPUB navigation semantics in strict XML and HTML-parsed fallback cases, including alternate prefixes.
7. Run new real-browser synthetic EPUBs in one/two/three-column layouts and all three themes; rerun the v70–v75 bookmark, footnote, search, read-aloud, TOC, CSS and EPUB-interoperability test suites.

## v75 — EPUB 3 navigation and auxiliary-content interoperability (2026-11-14)

1. Keep EPUB `linear="no"` documents outside sequential reading; permit temporary navigation through in-book and TOC links, preserving progress and a return destination across nested auxiliary navigation.
2. Preserve non-clickable table-of-contents group headings, hierarchy and accessible image-alt labels, and select the actual `toc` nav instead of an unrelated first `page-list` or `landmarks` nav.
3. Render EPUB standalone SVG spine entries in the existing sandboxed multi-column iframe; preserve native gradients, fit vector width, and route `xlink:href` hyperlink navigation correctly.
4. Resolve declared foreign-format manifest fallback chains to browser-readable EPUB content documents, detecting cycles and missing entries.
5. Recognize EPUB namespace `type` semantics with alternate prefixes, including after XHTML-to-HTML iframe serialization, for notes and typographic sections.
6. Prevent saving a bookmark against a temporary auxiliary reading-spine index. No persistent library/progress/bookmark schema change.
7. Verify EPUB 3.3 and EPUB 2 NCX synthetic fixtures, return-to-page behavior across 1/2/3 columns, CSS asset and search, footnote, bookmark, TOC and speech regressions.

## v74 — EPUB asset references, publisher CSS, and theme-switch consistency (2026-11-14)

1. Respect media, layer and supports conditions for CSS `@import` in publisher styles, resolving local ZIP assets without changing cascade order.
2. Handle quoted CSS `url(...)` filenames with spaces or parentheses and reject external URLs as before.
3. Keep local CSS SVG paint references such as `url(#gradient)` untouched and retain fragments on resolved external SVG references in CSS and SVG/HTML attributes.
4. Parse `srcset` using candidate tokenization rather than naive comma splitting, preserving data URI fallback images.
5. Remove the low-contrast transient when switching to Night: settings-select background color no longer animates independently of its immediately updated text color.
6. Keep data schemas and GPU pagination unchanged; replay the v68–v73 search, bookmark, footnote, TOC and speech regression suites.

## v73 — Read-aloud resilience and accessibility (2026-11-14)

1. Recover once from unexpectedly interrupted/canceled browser utterances instead of silently leaving the reader in a non-speaking Play state.
2. Resume from the last reported word boundary with DOM-accurate offsets. Guard stale utterance events and prevent duplicate chunk advancement.
3. Handle Pause/Resume during automatic cross-chapter transitions without skipping or restarting the chapter transition.
4. Remove duplicate paragraph DOM cloning at narration startup while keeping hidden text and ruby exclusions.
5. Synchronize the toolbar's accessible Play/Pause name, pressed state, disabled Stop state, and theme-matched focus outline.
6. Preserve the existing PWA storage schema, fast GPU pagination, wheel and held-key navigation, image decoding, dictionary and visual themes.

## v72 — Read-aloud alignment and mixed-language handling (2026-11-14)

1. Eliminate the separate cloned-text/DOM-map mismatch in speech segmentation. Use one whitespace-normalized DOM index for utterance text, UTF-16 offsets, and CSS highlight ranges.
2. Preserve natural source sentence spacing (especially Chinese punctuation and inline spans); segment within roughly 230 UTF-16 code units without splitting surrogate pairs.
3. Detect voice language per utterance rather than assuming one language per paragraph.
4. Use `SpeechSynthesisEvent.charLength` along with `charIndex` for exact word focus when supported, otherwise retain `Intl.Segmenter` fallback.
5. Keep read-aloud line geometry cache, existing continuous page turning, fonts, lookup, book storage and chapter staging unchanged. Regression-tested with v71 contents, bookmarks and footnotes in all three column widths.

## v71 — Contents, portable progress and read-aloud line focus (2026-11-14)

1. Fix export/import fidelity: backup validator had silently discarded the content-relative `location` fields introduced in v68 as well as bookmark `excerpt` text. Retain sanitized bounded anchors and excerpts while preserving the exact existing v1 backup format and old percentage fallback.
2. TOC highlight and footer label track active in-chapter sections. Geometry uses a WeakMap per EPUB iframe, with invalidation on real pagination, and runs only after the deferred reading-position sample. Direct TOC jumps select the intended subsection on shared spreads. The label is refreshed when layout changes without a new anchor request.
3. Add ArrowUp, ArrowDown, Home and End navigation when a TOC entry is focused, plus a theme-aware focus outline. No new persistent controls.
4. Cache read-aloud line Ranges per utterance segment. On the synthetic test paragraph, the first word needed 66–83 character rectangle probes, subsequent words on the same line needed one, and a true repagination invalidated the cache correctly. The original CSS Highlight API, speech events, and GPU transform are unchanged.
5. Chromium checks passed at 830, 1360 and 2100 px for TOC sections, deliberate TOC jumps, theme styling, resizing, backup validation and TTS focus, with existing v68–v70 bookmark, footnote and search tests rerun. No JavaScript runtime errors were observed in those tests.

## v70 — Search highlighting and result navigation (2026-11-14)

- A selected search result now highlights up to 160 surrounding occurrences with understated, theme-matched CSS Highlight API paint, while the selected occurrence receives a stronger highlight. No EPUB DOM text is wrapped or mutated, preserving CSS columns, bookmarks, text-to-speech, and page-turning speed.
- **F3** moves to the next book-search result and **Shift+F3** to the previous one, including from within the reading iframe. The navigation wraps from last to first and between chapters, reusing v69's accurate occurrence matching.
- The selected result is now distinguished in the right-hand Search panel, including an accessible current-result state. Closing and reopening a completed search retains results and selection rather than scanning again; interrupted searches resume correctly.
- Cached chapter hit offsets avoid repeatedly scanning chapter text while moving between results. Highlights are capped to 161 total ranges and only built on result selection, not during ordinary page turns. When a chapter is re-rendered, its selected search result's paint-only highlights are restored without moving the reading position.
- Search-result buttons retain native button semantics instead of overriding their accessibility role with listitem. Search highlight CSS now comes from the current reading theme rather than a fixed gold declaration, and old highlights clear when the query changes.
- Chromium regressions: repeated English results, Chinese across inline tags, NFKC ligatures/full-width variants, F3 and Shift+F3 in both parent document and iframe, search reopening, bookmark location restoration, and inline/spine/detached footnotes. One-, two-, and three-column modes passed with no JavaScript page errors.

## v69 — More accurate search matches and keyboard navigation (2026-11-14)

- Correct a long-standing search-navigation weakness: the search worker used only a chapter fraction to identify matches, which could select the wrong occurrence when words or phrases repeat frequently. The worker now returns the occurrence number plus a bounded before/after text witness. The reader ranks actual rendered matches using those signals and retains the previous fractional position as a last-resort signal.
- Search across inline spans and emphasis tags without losing the exact selection range. Canonicalize Unicode (NFKC) for both worker matching and rendered text, including ligatures and full-width characters, and map the selected location back to the original text nodes for accurate highlighting. Also correctly highlight Unicode-equivalent matches in search-result snippets.
- Cache the normalized rendered-text index per chapter document, built only when a result is clicked. Invalidate the cached index on actual text/element mutations; ordinary CSS reflow, image-source changes, and GPU page turns do not require another scan. Never cache an exceptionally large index over one million characters.
- Append incremental worker result batches without repeatedly rebuilding all rows, preserving keyboard focus and scroll position. In the right-hand search panel, Down Arrow from the input focuses the first result; Up/Down and Home/End navigate hits, while Enter/Space retain native button behavior.
- Clear stale search highlights when the term changes or a book closes. No changes to normal reader pagination, GPU transforms, background image scheduling, TTS, book metadata, or persistent storage format.
- Chromium tests: 1/2/3 columns, 108 repeated phrases in a chapter, exact match across formatting nodes, Chinese multi-node matches, NFKC ligatures and full-width characters, cross-chapter search, accessible keyboard traversal, v68 bookmarks and position restoration, v67 inline/spine/detached footnotes and MathML. No JavaScript errors were observed in these scenarios.

## v68 — Exact reading positions, more useful bookmarks, and navigation reliability (2026-11-14)

- Add a bounded, content-based text/element locator to newly saved reading positions and bookmarks. The reader records the exact visible passage asynchronously, then restores that passage after reopening a book or changing its font/layout instead of relying only on a chapter percentage. Locators remain local to the EPUB; no changes to book files or network services.
- Continue supporting all older fraction-only progress records and bookmarks. If publisher markup changes or a content locator cannot be validated, safely fall back to the stored chapter percentage. Notes retain their temporary-navigation behavior and do not replace ordinary reading progress.
- Correct page calculation for an anchored element when the chapter body is already GPU-translated. Subtract the body's current measured origin to avoid sending a saved anchor to page 1 when restoring from a later spread.
- Replace the bookmarks panel's nested pseudo-button structure with two proper sibling buttons: open saved location and remove bookmark. New bookmarks show a restrained two-line passage preview, with matching Paper, Warm and Night colors; existing marks remain clean and usable.
- Make bookmark selection page-accurate: use half a logical page rather than a hard-coded 2.5% chapter window, which could accidentally remove a different bookmark in long chapters.
- Preserve fast wheel/key page turning and GPU transforms. Serialize locator data on the existing deferred-anchor path; a direct scan is only required when the reader explicitly saves a bookmark. No changes to EPUB formats or JavaScript dependencies.
- Chromium tests: 1/2/3 columns, font change and exact bookmark restore, reopen from saved location, older percentage-only bookmark fallback, invalid locator fallback, semantic bookmark buttons, Paper/Warm/Night previews, and v67 inline/spine/detached/nested footnote regressions. These used representative synthetic EPUBs.

## v67 — More reliable footnotes, cross-chapter returns and themed previews (2026-11-14)

- Treat every EPUB note link as temporary reading navigation, whether its target is an inline hidden note, a regular chapter in the spine, or a detached non-linear endnote. The **Back to text** action now works consistently and stored reading progress remains at the original chapter while visiting notes.
- Restore to the actual source note reference on return where possible, rather than relying only on the old chapter percentage. Preserve that original return destination when following a nested footnote. A same-chapter return does not rebuild the chapter needlessly.
- Make non-modal note previews available from keyboard focus as well as mouse hover. Enter/click still follows the EPUB link, Escape can return from a full note view, and the preview close button restores keyboard focus to the note reference. Remove misleading `aria-haspopup=dialog` on note links that navigate instead of opening a modal.
- Preserve safe semantic markup in previews (including XHTML ruby, headings, definitions, restrained tables with header/caption, and native whitelisted MathML); continue excluding executable markup and arbitrary external image URLs. Use a sticky note header for long scrollable notes.
- Improve side-aware note preview placement, keeping the source marker visible when sufficient room exists. Fix note popup Paper/Warm/Night theme tokens because the popup is mounted outside the app container.
- Preserve GPU-accelerated page turning, bounded image decoding, dictionary services, navigation scheduling, and existing storage formats. No new network requests or permanent controls.
- Chromium integration tests cover spine/inline/detached/nested notes, actual source-reference return deep in a chapter, 1/2/3 columns, MathML/ruby/tables, keyboard previews, and all three themes. Tests use representative synthetic EPUBs; unusual publisher structures may still require case-specific fixes.

## v66 — Publisher-friendly typography and column-break polish (2026-11-14)

- Reduce overly assertive Folio defaults for semantic quotations, epigraphs, letters, poetry, sidebars and preformatted passages. Unstyled quotations now use a simple book-style inset instead of a shaded panel/left border, while epigraphs no longer gain a vertical line.
- Apply these semantic defaults using low-specificity `:where()` selectors and without `!important`, allowing explicit publisher class-based formatting to win in the EPUB cascade. Protective column-width and note layout rules stay intact.
- Use balanced wrapping for short headings, two-line widow/orphan rules for standard paragraphs and blockquotes, and strict CJK punctuation line breaking only for chapters explicitly marked `zh`.
- No changes to GPU pagination transforms, chapter staging, image decoding, dictionary, TTS, or saved reading data.

## v64 — Visible-page image priority and quieter placeholders (2026-11-14)

- Reserve one of three deferred-image requests for the currently visible page, limiting speculative image requests to two. Rapid navigation no longer starts three distant requests before an illustration on the active spread can begin loading.
- When a background image becomes visible, promote only its queued ZIP operation. This reuses the existing Blob URL promise without starting another decompression or promoting unrelated queued assets.
- The scheduler continues using its logical-page index, directional prefetch, six-slot ZIP pool, and two-background-slot ZIP policy. No DOM measurement or new work is added to ordinary text-only page turns.
- Give transparent reserved images a subtle theme-aware neutral background while loading; dimensions and layout remain untouched, with no animation or permanent decoration.
- Preserved storage, content-aware pagination, GPU `translate3d` page turns, continuous keyboard/wheel navigation, and double-buffered chapter transitions.
- Chromium tests cover concurrency priorities, targeted promotion, page changes while requests are in flight, page-turn navigation, and Paper/Warm/Night appearance.

## v63 — Direction-aware illustration preloading and themed typography controls (2026-11-14)

- Deferred illustrations now preload the **currently visible page first**, followed by the next two pages in the direction of fast wheel/keyboard navigation. Backward reading reverses the priority; ordinary navigation still warms adjacent pages conservatively.
- Reuse logical page indexing and binary search. No extra DOM geometry reads occur on ordinary page turns, and no more than three deferred image jobs are scheduled at once.
- Distinguish foreground visible-page ZIP decompression from low-priority near-page prefetch, reusing v57's six-slot/two-background-slot scheduler. Old jobs may finish when skipping rapidly, but new speculative work follows the latest page.
- Improve settings slider tracks, thumbs, and focus outlines across Paper, Warm, and Night; preserve native keyboard semantics and compact layout.
- No change to EPUB data, stored reading progress, GPU page turns, font selection, or chapter transitions.

## v62 — Defer large offscreen illustrations safely (2026-11-14)

- Decompress large *later* raster illustrations when their logical pages are near the current reading position, instead of waiting for every image in a long chapter before the first page can display. This is deliberately conservative: the chapter must contain at least 10 images, the first four remain eager, and only large PNG/JPEG/GIF/WebP/AVIF images with explicit numeric width and height are eligible.
- Reserve exactly the declared intrinsic dimensions with inert transparent SVG placeholders in the staged iframe, so pagination can count images even before their ZIP bytes are decompressed. Complex images without reliable dimensions, `srcset`/`picture` responsive images, tables, notes, and SVG/illustrations not meeting the safety checks keep the previous eager-loading behavior.
- Build a logical spread index after real pagination; each page turn uses a bounded nearby-image lookup rather than scanning every media node. At most three deferred image assets are scheduled simultaneously; subsequent requests follow the *latest* reading page, not obsolete fast-wheel positions.
- Preserve live Blob URLs during memory reclamation, even though the cached chapter source still contains placeholders. Chapter navigation, GPU `translate3d` turns, TTS, font loading, dictionary, and the double-buffered transition are unchanged.
- Chromium synthetic 15-image EPUB checks in 1-, 2-, and 3-column layouts: first-page extraction of only four images (six in 3 columns after near-page hydration), preserved page counts after later image loading, bounded outstanding requests, safe Blob cleanup, rapid navigation and no runtime errors. Publisher CSS ordering, chapter switching, media event batching, and syntax checks also passed.
- Scope: intentionally does not defer images with unspecified dimensions. Actual chapter-opening acceleration depends on the book, compression, image sizes, and device; image contents are still loaded when the reader approaches them, so very rapid turning can briefly expose a blank reserved image box.

## v61 — Early illustration decoding and bounded media-driven pagination (2026-11-14)

- Begin decoding at most two illustrations near the start of the hidden staged chapter before its font readiness wait. This is non-blocking: navigation never waits for decoding to finish, and the GPU page transform and double-buffered chapter swap remain intact.
- Constrain early decode by preceding text length, examined DOM nodes and known pixel area. Skip missing, broken and hidden images, and safely ignore decode failures. This avoids decoding distant or oversized pictures merely because they exist somewhere in the chapter.
- Batch image-load, image-error and font-loadingdone repagination notifications with a maximum 180 ms burst window, rather than continually resetting the timer while many assets finish. Preserve the existing 65 ms core pagination scheduling and reading-position anchors.
- Ignore stale media callbacks after another chapter replaces the document; no additional persistent memory or background cache is introduced.
- Chromium regression at 830, 1350 and 2100 px: one/two/three columns, publisher CSS order, chapter switching and iframe cleanup passed; simulated 40 media notifications produced three scheduled repagination requests and did not starve the first update. No JavaScript runtime errors observed in these fixtures.
- These tests validate scheduling and browser integration, not a guaranteed improvement in chapter-opening time on a particular EPUB or device.

## v60 — Correct publisher CSS cascade and faster stylesheet preparation (2026-11-14)

- Preserve the original interleaved document order of inline `<style>` blocks and linked EPUB stylesheets. Previous releases assembled all inline CSS before all linked CSS, which could change the intended appearance of paragraphs, captions and other book content.
- Resolve independent EPUB stylesheets in parallel and reassemble the results in their original order using `Promise.all`. Maintain each stylesheet's own `@import` processing and the existing bounded ZIP resource scheduler.
- Respect `<style media="...">` and `<link rel="stylesheet" media="...">` instead of applying print-only styles unconditionally. Do not apply `<link rel="alternate stylesheet">` unless the publisher explicitly selects it (Folio currently does not expose alternate stylesheet sets).
- Preserve concurrent image/media processing, GPU page turning, rapid wheel/held-key navigation, double-buffered chapter switching, progress data, fonts and the dictionary.
- Chromium synthetic CSS stress test (40 ms delay for each of ten linked stylesheets): v59 ~410 ms, v60 ~47 ms. This is a controlled latency test, not a guaranteed speedup for ordinary EPUBs.
- Chromium complete-reader regression at 830/1350/2100 px (1/2/3 columns): cascade test, images and captions, 2-chapter navigation and iframe cleanup passed, with no JavaScript errors.

## v59 — Bounded chapter font preparation and unobtrusive loading state (2026-11-14)

- Replace two sequential font-readiness waits (previously up to 220 + 160 ms) with one bounded, combined wait: up to 260 ms for chapters containing CJK text when a remote CJK font is selected, or 160 ms otherwise. Publisher styling and GPU-backed page turning are unchanged.
- A remote font arriving after the deadline can still trigger the established font-ready repagination; the current chapter remains displayed while the next is staged.
- Show a small theme-colored loading indicator beside the chapter label only when chapter preparation exceeds 260 ms. Clear it after success or failure, and do not let an outdated request clear a newer request's state. Respect the operating-system reduced-motion setting.
- Keep the prior staged-frame transition and bound ZIP decompression. No changes to persisted EPUBs, bookmarks, reading locations, theme preferences, dictionary services, or TTS.
- In-memory Chromium checks: one/two/three columns at 830/1350/2100 px; 390 ms synthetic slow chapter preparation; indicator appeared after the delay and cleared on completion; 750 ms simulated font readiness resolved the foreground wait in about 260 ms; rapid chapter reversal left a single active iframe and no stuck indicator; no JavaScript errors. Test environment blocks localhost navigation, so these checks used an in-memory HTML fixture and simulated font timing rather than a live CDN.

## v58 — Parallel CSS/media preparation and redundant-work removal (2026-11-14)

- **Overlap independent chapter preparation:** Publisher CSS files and EPUB image/media resources now resolve concurrently rather than forcing the media pipeline to wait until all CSS parsing, imports, and background assets finish. Publisher stylesheets still resolve in their original cascade order; the bounded ZIP worker pool remains unchanged.
- **Preserve stylesheet references before rewriting the EPUB DOM:** The CSS pipeline snapshots link paths before the image resource pass can change DOM attributes. This avoids a race that could otherwise skip later publisher stylesheets when the two pipelines run in parallel.
- **Eliminate duplicate ZIP work:** EPUB `<link>` stylesheet files are not inflated again as generic Blob `href` resources. Their contents are already processed by the stylesheet pipeline and are not copied into the final chapter DOM.
- **No changes to column pagination, GPU page turns, font selection, EPUB content storage, search, read aloud, or dictionary behavior.** Existing reading positions and bookmarks remain compatible.
- **Chromium tests:** A two-chapter EPUB with five publisher stylesheets, nested `@import` files, background images, and 24 inline illustrations per chapter retained all CSS in the authored order, successfully displayed each image, switched chapters with one active iframe, and showed no JavaScript errors in one-, two-, or three-column layouts. Page-tone changes and held-key navigation were also checked.
- **Performance:** In a synthetic per-asset-delay test (32 ms simulated delay per CSS/image ZIP read; three runs each), first-chapter display medians were approximately 959 ms in v57 and 729 ms in v58. With no simulated delays, gains were small and variable; real EPUB speedups depend on asset mix, device, and browser caches. These figures are not guarantees for user books.

## v57 — Foreground-first chapter preparation (2026-11-14)

- Fix competition between background chapter prefetch and a user-requested chapter: EPUB asset decompression uses a six-slot priority-aware queue with no more than two slots devoted to speculative background work. Foreground requests can immediately occupy the remaining slots, avoiding needless waits behind dozens of images in another chapter.
- When a prefetched chapter is opened, queued assets are promoted to foreground priority. In-flight resources and prepared HTML continue to be shared rather than inflated or parsed twice.
- Give the prefetch scheduler a cancellation generation so an outdated neighbor sequence cannot continue launching speculative loads after the user navigates elsewhere. Work already needed by the requested chapter is not discarded.
- No change to the EPUB file format, local book storage, reading progress, text rendering, font weights, existing themes, GPU-backed page transforms, or wheel/key repeat speeds.
- Chromium tests: priority limits (6 total/2 background), foreground dispatch under backlog, promotion, shared-resource handoff (24 images inflated once), illustrated chapter switching in 1/2/3 columns, single active reader iframe, no JavaScript errors. Synthetic delay tests verify scheduling rather than end-to-end chapter-load speed on a particular device.

## v56 — Rapid wheel navigation and held-key paging (2026-11-14)

- Replace the former 400 ms wheel cooldown with a bounded 64 ms turn scheduler. Trackpad micro-deltas accumulate; a single large wheel event never skips several pages, and the queue caps at five to prevent uncontrolled inertial scrolling.
- Support continuous ArrowLeft/ArrowRight, PageUp/PageDown, and Space paging while a key is held. The first page turns immediately, then controlled repetition begins after 270 ms at roughly 72 ms per page. Native key repeats refresh the hold state without causing duplicate turns.
- Keep a small wheel queue through chapter boundaries instead of repeatedly restarting the same pending chapter. Discard stale input and clear it on a book change, library return, blur, hidden tab, interactive dialog, or direction reversal.
- Preserve keyboard focus across staged chapter swaps only when a held navigation key originated in the old iframe, so keyboard release remains discoverable. No new page animation or permanent controls.
- Start adjacent-chapter background prefetch slightly earlier (175 ms vs. 280 ms), keeping it idle and cancellable; reduce the idle timeout from 2400 ms to 1100 ms to make the next chapter more likely to be ready under load.
- GPU-backed `translate3d()` paging, reading-position anchors, consolidated progress writes, EPUB/figure rendering, dictionary behavior, and all persisted data remain unchanged.
- Chromium regressions with synthetic two-chapter EPUBs at 830/1350/2100 px: 1/2/3 columns, rapid forward and reverse wheels, held-key release, crossing chapter boundaries, single active iframe, and no JavaScript errors.

## v55 — Faster page turning and responsive progress (2026-11-14)

- Move reading-anchor DOM hit testing off the immediate GPU page-transform path. Consecutive turns coalesce to one anchor capture after the first paint. Pending anchors are synchronously secured before any real reflow.
- Coalesce progress serialization during quick turns (350 ms), while updating in-memory progress/UI immediately; flush on tab hidden, pagehide, unload, and library return.
- Cache chapter-weight prefix sums for constant-time overall-progress calculations; reuse bookmark lookup in the control state.
- Add Home and End keyboard navigation for the first/last page in the current chapter (without interfering with form fields).
- No change to `translate3d()` paging, EPUB fonts, rendering/sanitization, or persisted storage format.

## v54 — Figure and caption pagination (2026-11-14)

- Caption-aware illustration sizing: fit single-image figures to the actual available column height minus their measured caption height and margins, replacing the fixed 8.5em caption reservation.
- Long captions and multi-image figures can now fragment across columns rather than being held together as oversized unbreakable blocks. Images themselves remain unsplittable, with a per-column height limit.
- All adaptive values are recalculated on genuine viewport/font changes without altering publisher EPUB markup. Ordinary text, link behavior, and the GPU page transform are unchanged.
- No new settings or dependencies; PWA cache version advanced to v54.

## v53 — Fidelity for technical EPUB tables and notes (2026-11-14)

- Expanded table view now preserves EPUB table captions, thead/tbody/tfoot row groups, scoped headers, structured cell paragraphs and lists, ruby annotations, small inline images, and native MathML equations. All preview content is rebuilt from a strict, non-executable whitelist; EPUB scripts, links, event handlers and arbitrary styles are never imported into the top-level UI.
- MathML expressions also remain visible in quick footnote previews, where they were previously dropped entirely.
- Native keyboard scrolling: the expanded table contents are now focusable. Tab alternates between the Close button and the scrollable table; Escape still dismisses the dialog and restores focus.
- The reader no longer incorrectly assigns preformatted `white-space:pre-wrap` to entire tables. This avoids unwanted whitespace and mis-wrapping inside ordinary cells; genuine `<pre>` blocks are unchanged.
- No change to GPU-backed pagination, dictionary services, data storage, or chapter double buffering.

## v52 — Dictionary stability and positioning

- Keep the dictionary popup at a fixed size and position while results arrive. When vertical space is insufficient, use right/left placement on wide screens to leave the clicked word visible.
- Update English and Chinese meanings independently instead of rewriting the whole definition panel for each network response. Preserve Chinese reading position when English arrives late.
- Show loading messages until all attempts (including Datamuse fallback and inflection candidates) finish; do not show a misleading early unavailability message.
- Ignore late UAPI replies after closing or changing words. Revoke temporary pronunciation Blob URLs when dismissing the lookup popup.
- Keep existing sources, session lookup cache, external font handling, and GPU pagination unchanged.

## v51 — Preserve illustrations across changes to the reading layout (2026-11-14)

- **Semantic position anchors for image-led pages:** Detect the first visible image, SVG, table, preformatted text, or horizontal rule when no text appears near the top of the page. Previously such pages often had no anchor; font-size and viewport changes could restore them by an imprecise chapter percentage.
- **Keep text anchoring fast:** Continue using the existing first-visible-text offset on ordinary pages; inspect media only when the first readable text starts significantly below the top or none is found.
- **Restore non-text anchors correctly:** Keep the same semantic anchor across successive one-, two-, or three-column reflows, even when an image moves from the first to a later column of the new spread. Explicit page turns still update the anchor. Respect the existing blank-spread filter and GPU-backed transform.
- **No change to EPUB storage or progress/bookmarks:** These anchors are ephemeral references inside the current chapter and never write DOM nodes into saved reading data.
- Preserve the v41 double-buffered chapter rendering, three-column blank-page fix, font loading, memory cleanup, and read-aloud controls.

### Validation

- Chromium regression EPUB containing full-column illustrations plus text: image-led page anchored, reflow across column counts preserves its location, and text-led pages still use text offsets.
- Chapter navigation, themes, repeated reflow, and basic reader operation checked without console errors.
- Performance avoids additional DOM geometry walks on pages where first visible text starts near the top.

## v50 — Compact page jump and stale-pagination protection (2026-11-14)

- **Jump directly to a page** by clicking or keyboard-activating the current page number in the bottom navigation. The small, themed one-line editor accepts logical page numbers; Enter navigates, Escape cancels, and invalid values never move the reader. No new permanent toolbar space is used.
- **Prevent stale pagination jobs** from overwriting newer work: a request sequence invalidates obsolete timer/animation-frame callbacks, and late font/image/resize callbacks use the current reading position instead of a fraction captured before the user turned pages.
- **Preserve the existing pagination behavior:** occupied-page scanning remains exact. A faster-looking block-rectangle shortcut was benchmarked and rejected because it was slower and risks reintroducing blank pages from publisher padding.
- **Unchanged:** `translate3d()` page turning, v41 staged chapter rendering, image/Blob memory cleanup, font handling, offline storage, existing progress and bookmarks.

### Validation

- Chromium regression tests on a synthetic multi-chapter, multi-page EPUB for one-, two-, and three-column layouts; Paper, Warm and Night, keyboard page jumping, input validation, resizing, staged chapter navigation, and no new console errors.
- Stale-schedule test: multiple schedule requests coalesce and a page change before the delayed frame is honored.
- The v49 occupied-spread scanner was measured at approximately 7–46 ms on representative 800–4,500-paragraph synthetic chapters; alternative block-rect scans were 12–83 ms, so the original scanner was intentionally retained.

## v49 — Bounded EPUB asset memory and library polish (2026-11-14)

- **Conservative image/resource cleanup:** After chapter preparation settles, inspect Blob URLs referenced by the visible iframe, the six-entry prepared-chapter cache, and open illustration/table/note previews. Unreferenced EPUB asset URLs are revoked and their byte-accounting entries removed. The book's original EPUB remains in IndexedDB and in the loaded ZIP; navigating back can re-inflate released resources.
- **Cache budget:** Skip cleanup work for normal text-only or small books. Run a sweep when resource Blob data reaches approximately 24 MiB or 72 entries. For particularly large books (over 96 MiB of tracked asset bytes), reduce the prepared-chapter cache from six to four entries, while retaining the active and immediately adjacent chapters. These thresholds are triggers, not hard caps: visible and cached content remains protected.
- **More informative library cards:** A thin reading-progress mark inside the cover and a percentage beneath the author make it easier to recognize partially read books. No additional line appears for unread books.
- **Lighter initial library rendering:** Cover images now use native lazy loading and asynchronous decoding, reducing offscreen image work without changing EPUB pagination.
- **Reduced-motion support:** Minimize UI transitions when the operating system requests reduced motion; standard GPU-backed page turning and the existing double-buffered chapter transition remain unchanged.
- **No data migration:** IndexedDB book storage, local progress/bookmarks, typography, lookups, and page controls retain the v48 schema.

### Validation

- Chromium smoke tests with the sample EPUB for one/three-column layouts at various widths and JavaScript-syntax checks.
- 14-chapter, 70-image illustrated-EPUB test (~41 MB file). Resource Blob accounting decreased from ~25 MiB to ~17 MiB when obsolete resources were reclaimed in a representative navigation sequence. Returning to earlier chapters yielded zero broken images and no JavaScript errors. This is *not* a precise browser memory measurement; decoded image/GPU memory depends on Chromium.
- Resource reachability tests confirmed that 120 unreferenced URLs were released while three URLs referenced by the visible document, a cached chapter, and an illustration preview were preserved.
- Library progress and all three themes checked in Chromium.

## v48 — Chapter navigation reliability and resource cleanup (2026-11-14)

- **Deduplicate rapid chapter-boundary clicks.** Repeated Next/Previous requests for the same chapter reuse the pending chapter render rather than restarting the staged iframe preparation. A different navigation target can still supersede it.
- **Cancel pending book opens when returning to the library.** Increment the open token and dismiss the load overlay on Library, so an async EPUB parse cannot unexpectedly reopen a book after the user has left it.
- **Cancel background prefetch timers and idle callbacks** when leaving the reader, opening a different book, or scheduling new neighbor preparation. Already-running ZIP inflation cannot be forcibly interrupted, but it checks the book identity and discards stale results.
- **Preserved:** the double-buffered chapter switch, existing three-column blank-page handling, GPU-backed page turning, theme/font loading, library database, reading progress and preferences.

### Regression checks

- 12 rapid Next clicks at a chapter boundary produced one render request in the Chromium test.
- Artificially delayed book-open requests were cancelled correctly on Return to Library (v47 reproduced the undesired reopen; v48 remained in the library).
- Chromium checks confirmed 1/2/3 columns at 720/1180/1920 px with one active reader iframe and no JavaScript errors; the built-in sample EPUB opened.

## v47 — More reliable Chinese webfont rendering (2026-11-14)

- **Fix the font choice:** Noto Serif/Sans CJK SC is no longer treated as the same locally installed face as Source Han Serif/Sans SC. When Source Han is selected, the correct Source Han SC installation wins; otherwise load the actual Source Han SC webfont, using Noto only as the fallback if that fails.
- **Eliminate incorrect inherited variation axes:** Use CSS `font-weight`, not a global inherited `font-variation-settings: "wght"` that can override the English font and the EPUB's other font-weight rules. Retain the established v46 online-only baseline weights for Serif and Sans, including bold.
- **Apply online ink weight only after actual font success:** Verify the loaded font face before activating online-only optical weight rules in EPUB chapters and dictionary definitions. Unavailable font files retain normal fallback weight without extra artificial emboldening.
- **Optional online-only fine tuning:** A small adjustable online-font weight control (-50 to +120 units, default 0) appears when Source Han Serif/Sans is selected but not installed. Saved in reader preferences; locally installed fonts and LXGW WenKai remain unchanged. Recalculate the chapter when the slider is released, not on every drag frame.
- **Less loading work:** Don't download online Chinese font CSS for a dictionary popup until a Chinese definition is shown; limit sample extraction to the first 12 consecutive Chinese characters instead of allocating a match for every character in a long chapter.
- Preserve the accelerated `translate3d()` pagination, staged chapter transitions, PWA/book-storage origin and reading data.
- Browser tests used an isolated in-memory Chromium page and simulated font response. Exact visual output of the live CDN webfonts on Windows/Edge remains device-dependent.

## v46 — Stronger online Source Han typography (2026-11-13)

- Increase the optical weight of **online-only** Source Han Serif SC (regular 570, headings 745, bold 780) and Source Han Sans SC (regular 535, headings 725, bold 755). Chosen as more readable starting points relative to LXGW WenKai, while respecting the different serif/sans stroke designs.
- Explicitly select the `wght` variable-font axis as well as `font-weight` in the chapter renderer and Chinese dictionary definitions; some CDN stylesheets register a default face even when the font supports variable weights.
- Preserve all locally installed Source Han, Noto CJK and LXGW WenKai weights unchanged; keep the Source Han SC webfont sources, not Google Noto SC webfonts.
- Do not apply Chinese weight adjustments to Latin spans rendered in the chosen English font.
- Verify that a CSS load actually resolves a usable font face for Chinese text; restore fallback weights if the WOFF2 file fails, rather than treating a loaded CSS response as proof.
- Preserve GPU `translate3d()` pagination, the staged chapter transition, reading position, and PWA data formats. No font files are bundled.
- These weights are not a calibrated comparison against the user's Windows device: final perceived darkness depends on display scaling, font rasterization and the external font files.

## v45 — Readable web-only Source Han weights (2026-11-13)

- Source Han Serif SC online: slightly stronger body weight (480), true variable bold 720, balanced headings (685).
- Source Han Sans SC online: lighter compensation (body 445), true variable bold 700, headings (670).
- Keep every locally installed Source Han/Noto Serif/Sans weight unchanged, and retain the GPU-translated column reader.
- Check installed-font availability using FontFace with local() rather than assuming the CDN is necessary; skip remote CSS requests when installed.
- Apply web-only optical weight corrections to Chinese text in EPUB chapters and lookup definitions, leaving Folio's English reading font at its original weight.
- Gracefully restore normal fallback weight if the remote stylesheet fails; guard against stale async responses after font/chapter changes.
- No new font assets bundled; CDN is required for non-installed Source Han fonts.

## v44 — Unified Chinese font loading (2026-11-13)

- Use a single source of truth for the three optional Chinese web fonts: Source Han Serif, Source Han Sans, and LXGW WenKai.
- Prefer locally installed equivalents through explicit local-only CSS aliases, falling back to their corresponding subset webfont family and then to a system font.
- Apply the same configuration in the EPUB iframe and the dictionary lookup card; all three use the same asynchronous stylesheet loader and font-ready repagination.
- Keep CSS multi-column GPU transforms, book storage, chapter transitions, and other reader behavior unchanged.
- Use the existing segmented WOFF2 CDN stylesheets, with no bundled Chinese fonts or new application dependencies.
- Update service-worker version so existing PWA installations receive the fix.

## v43 — Sharper online Source Han font path (2026-11-13)

- Keep GPU-backed `translate3d()` pagination unchanged for fast page turns.
- Prefer installed Source Han / Noto CJK fonts when present. Use segmented Source Han variable WOFF2 webfont stylesheets rather than Google Fonts Noto SC web deliveries when they are not installed.
- Preserve the v42 preference keys while updating the displayed labels to the actual online font source.
- The online fonts download just the glyph subsets needed by a chapter and can be cached by the browser; no full CJK font is bundled in the PWA or standalone HTML.
- Both the chapter iframe and lookup popup use the same font source and family stack.
- Network fonts still require internet access; if the CDN is unreachable, the existing system-font fallback remains available. Rendering quality can differ by Windows/Chromium version and display configuration.

## v42 — Restore reliable LXGW WenKai loading (2026-11-13)

- Restore remote Chinese webfont stylesheet injection when preparing an EPUB chapter; the deferred font loader was accidentally never invoked, leaving only installed-system-font and fallback behavior.
- Attach the selected font stylesheet while the previous chapter stays visible, with a bounded delay to maintain v41's flicker-free chapter switching; repaginate when an asynchronously loaded font changes text metrics.
- Apply the selected Chinese webfont to the lookup popup, which lives outside the EPUB chapter iframe.
- Refresh the active font when Typography settings change; reuse an unchanged stylesheet instead of repeatedly reloading it.
- Keep locally installed LXGW WenKai as the first choice. Without the font installed, loading from jsDelivr requires internet access. No EPUB or reading-data migration is necessary.

## v41 — Flicker-free chapter switching

- Build the next EPUB chapter in a second, invisible iframe, then atomically replace the visible one after layout and pagination are ready.
- Prepare fonts and normalize publisher markup before presentation, reducing the momentary default-layout flash in three-column mode.
- Retain the existing chapter on screen during slow loads and keep it visible if a new chapter fails.
- Cancel stale chapter loads when switching rapidly or returning to the library, avoiding orphaned frames.
- Preserve one-/two-/three-column responsive choices and all existing pagination, search, note, and TTS features.
- Refresh PWA service-worker cache to `folio-shell-v41`.

## v40 — Avoid needless repagination (2026-11-13)

- Cache the pagination result **per chapter document and exact viewport/layout settings**. Unchanged resize callbacks and redundant font-ready notifications can reuse the previous page coordinates without rerunning CSS layout or scanning text nodes.
- Invalidate the cache when the reader theme or typography changes, or when a chapter image or web font loads, or when footnote content is revealed/hidden. Reader width/height changes automatically invalidate via the cache key.
- Skip the occupied-spread text scan for chapters that already fit within one physical spread; retain the v39 content-aware scan whenever multiple spreads are possible.
- Preserve book files, progress format, themes, bookmarks, and read-aloud controls.

## v39 — Skip blank spreads caused by EPUB layout space (2026-11-13)

- Count pages from visible text, illustrations, and horizontal rules rather than total `scrollWidth`, which includes trailing publisher padding, fixed-height containers, and forced breaks.
- Skip empty physical spreads in the 1-, 2-, and 3-column modes without changing the underlying EPUB DOM or book layout; text and media remain in their original CSS flow positions.
- Keep table-of-contents jumps, search navigation, read-aloud following, bookmarks, and progress in sync by converting between physical column offsets and logical (occupied) pages.
- Preserve previously saved positions and preferences; update only `index.html` / `sw.js` for PWA installations.

## v38 (2026-11-13)

- Keep the read-aloud voice selector at a steady 37 px height, with a rounded pill shape and a single-line ellipsis for long voice names.
- Show complete voice names in a wider, compact scrollable dropdown menu, and in the closed selector's tooltip.
- Correct the voice picker content after browser voice lists update, preserving keyboard and screen-reader selection.
- Theme the playback-speed slider, improve stop/close hover and focus states, and fix the mobile divider.
- Refine 681–800 px toolbar layout; no changes to books, dictionary, progress, or playback semantics.

## v37 (2026-11-13)

- Apply Folio Paper, Warm and Night theme styling to the inline read-aloud voice selector, using the compact settings dropdown treatment and improved chevron spacing.
- Use compact, accessible 32px voice-option rows in Chromium/Edge's base-select picker, with native fallback on other browsers.
- Give every checkbox (including reading preferences and search scope) consistent themed unchecked, checked, hover, and keyboard-focus states.
- Respect active theme for native form controls and avoid OS dark-mode mismatches.
- Refresh PWA shell cache without touching user data.

## v36 (2026-11-13)

- Match the Warm theme's scrollbars to its beige track and brown thumb in scrolling library, panels, settings dropdowns and dictionary popup.
- Use the light native color scheme for Warm mode to avoid dark system scrollbars when the operating system is set to dark mode.
- Style scrollbars inside embedded EPUB pages for independently scrolling tables and figures while leaving Paper and Night unchanged.
- Retain narrow, accessible scrollbars and native browser behavior, including Firefox and WebKit fallbacks.
- Advance PWA service-worker cache to v36.

## v35 (2026-11-13)

- Dictionary lookup now inherits the Paper, Warm and Night theme palette; fix the popup's previously unthemed white background.
- Harmonize popup header, definitions, pronunciation controls, footer links, enhanced lookup inputs and feedback with theme-appropriate contrast and focus/hover states.
- Use the selected English font for headwords and English meanings (including the bundled Libertinus and EB Garamond faces) and the selected Chinese font stack for Chinese definitions; update on typography setting changes.
- Preserve the bounded popup size, stable positioning, dictionary endpoints, phonetic/audio behavior and local data.
- Bump the service-worker shell cache to v35 for PWA updates.

## v34 (2026-11-13)

- Add breathing room between settings dropdown labels and their chevrons, with a 17 px right inset.
- Harmonize settings dropdowns with Folio surface, border, hover and focus styles in light, warm and night themes.
- Use the CSS base-select picker in supported browsers for compact 32 px option rows, matching selected states, responsive viewport limits and keyboard support. Keep native option menu as a fallback.
- Update PWA shell cache without changing saved books or preferences.

## v33 (2026-11-13)

- Move in-book Search drawer to the right, matching Appearance & data.
- Preserve left-hand Contents/bookmarks drawer, search functionality, and responsive animations.
- Bump offline PWA shell version without modifying local reading data.

## v32 (2026-11-13)

- More vertical space between Reading focus and Show read-aloud controls.
- Removed redundant local-storage explanation.
- Improved Night mode text, icon, select, button, and hover contrast.
- Bumped offline PWA shell cache; kept local data and settings compatible.

# Changelog

## v31 — Library controls and reading focus (2026-11-13)

- Replace the library homepage hamburger menu with a single in-page Import book button; retain Contents and Library navigation while reading.
- Rename the general settings panel **Appearance & data**, and give the Page tone “Aa / 字” preview more balanced spacing.
- Add an instant, case-insensitive library filter for EPUB titles and authors, with a clear no-results state. Search is performed only against existing metadata, without a new index or background task.
- Add optional Read aloud focus modes: **Word and line** (default), **Word only**, **Line only**, and **Off**. Use the CSS Custom Highlight API and DOM text ranges instead of inserting word spans into the EPUB. Chinese words are segmented with `Intl.Segmenter` when available.
- Preserve the v30.2 stable dictionary popup and existing providers without adding caching.
- Highlight exact word boundaries only when the selected browser voice supplies speech boundary events. Use initial line focus as a graceful fallback; actual Edge Natural voice boundary support varies.
- Refresh the PWA cache version without modifying stored books, bookmarks, or preferences.

## v30.2 — Stable dictionary popup (2026-11-13)

- Keep the dictionary popup at a consistent height while online dictionary results load, preventing it from flipping from below the clicked word to above it.
- Determine popup position once per word click, using the final reserved size and viewport bounds, and scroll long definitions within the popup.
- Preserve the visible scroll offset when supplementary definitions arrive; keep optional enhanced settings inside the same fixed panel.
- No new caching, dictionary providers, or other reader UI changes.
- Refresh the PWA shell cache version for installed readers.

## v30.1 — Off-canvas shadow correction (2026-11-13)

- Remove off-screen box shadows from the hidden Contents, Search, and Settings drawers. Their shadows were visible along the edges of the reading canvas even when the drawers were closed.
- Remove the hidden library rail's mobile shadow; preserve the existing shadows when a drawer or rail is visible.
- Update the PWA cache key so previously installed readers receive the fix.

## v30 — Semantic typography (2026-11-13)

- Introduced a consistent, restrained typographic treatment for quotations, pull quotes, epigraphs, poetry, stanzas, sidebars, letters, code blocks, and definition lists.
- Matched iframe and page-mask background colors across light, sepia, and dark modes to remove subtle asymmetric edge shading.
- Replaced footnote reference badges with cleaner colored superscripts, script-sensitive optical spacing, and subtle hover underlines.
- Style these using HTML elements, EPUB semantic `epub:type`, ARIA roles and well-known class tokens; no changes to the original EPUB files.
- Use logical-direction spacing and `em` units for Chinese/English and responsive page columns, with muted, theme-sensitive separators and surfaces.
- Avoid adding Folio decorations when an element already has authored decorative styling.
- Maintain default font and publisher-font override behaviors, with no new settings or runtime search dependencies.

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

## v65 — Bitmap decode-ahead for deferred illustrations

- After a deferred image's compressed bytes are extracted, Folio optionally warms the browser bitmap with `Image.decode()` before swapping out the neutral placeholder. The current page and one likely next page receive priority; the actual page turn never waits for this work.
- Bound decoding to at most two concurrent jobs, one speculative job, images up to 4 megapixels/7 MB, and a 110–170 ms display deadline (in-flight decodes remain counted until they finish). Large images, animated GIFs, SVG and unknown formats keep the previous path.
- Prevent duplicate resource requests while a decoded image is awaiting assignment, and discard results from cancelled chapter transitions. Resource decompression concurrency, figure geometry, and GPU page turning are unchanged.
- The visual effect can vary across Chromium versions and devices; the browser may evict decoded bitmaps under memory pressure.
