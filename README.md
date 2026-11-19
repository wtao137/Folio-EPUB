## Folio v95.10 — faster staged chapter preparation

Speculative neighbor chapters now cache resolved content without assembling unused complete iframe HTML. Identical font CSS no longer causes an extra staged style rewrite, and semantic markup discovery avoids repeated token splits in long chapters. Quality typesetting, optical punctuation, original EPUB text and fallback guards are unchanged. See [upgrade notes](UPGRADE_FROM_v95.9.md) and `tests/chapter_prep_v9510.py`.

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
