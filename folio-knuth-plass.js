/* Folio paragraph typesetting — Knuth–Plass active-node / demerit optimization.
 * This module is intentionally self-contained; no CDN, build step or EPUB mutation.
 * Copyright (c) Folio contributors; MIT License.
 * It typesets eligible horizontal prose paragraphs and yields to the browser for
 * complex EPUB constructs. Original nodes are held in-memory and are restorable.
 */
(function(root, factory){
 'use strict';
 const api = factory();
 if(typeof module === 'object' && module.exports) module.exports = api;
 if(root) root.FolioKnuthPlass = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function(){
 'use strict';
 const OPEN = new Set(Array.from('（［｛【〔〖〈《「『“‘([{'));
 const CLOSE = new Set(Array.from('），。！？；：、］｝】〕〗〉》」』”’﹐﹑﹒,.!?;:%‰)]}'));
 const NONSTART = new Set(Array.from('）］｝】〕〗〉》」』、，。！？；：”’﹐﹑﹒)]}'));
 const JOINERS = /[\u00a0\u200b\u200d\u2060\ufeff]/u;
 const HAN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
 const IDEOGRAPH = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u;
 const isIdeographToken = t=>t?.kind==='cjk'&&IDEOGRAPH.test(t.text);
 // Optical margin alignment. These caps are deliberately conservative:
 // punctuation ink can extend a little beyond the justified text measure,
 // without moving glyphs inside the line, touching MathML, or changing text.
 // Fractions are of the actual Canvas-measured glyph advance, not of em.
 const OPTICAL_END=new Map([
  ['.',.42],[',',.38],[';',.24],[':',.22],['!',.18],['?',.20],
  ['’',.24],['”',.27],
  ['。',.42],['，',.40],['、',.36],['！',.26],['？',.26],
  ['；',.26],['：',.26],['」',.25],['』',.25],['》',.22],['）',.20],
  ['】',.18],['〉',.22],['〕',.18]
 ]);

 const CJK_PUNCT = /[，。！？；：、（）［］｛｝【】〔〕〖〗〈〉《》「」『』“”‘’﹐﹑﹒]/u;

 // v94.5: Optical *ink* alignment, separate from ordinary empty-bearing trim.
 // CLReq §6.1.3 treats hanging as optional, mainly for simplified Chinese
 // pause/stop marks. These limits are Folio's publication-style choice, NOT
 // standard-mandated fixed fractions. Canvas metrics always bound the effect.
 // Only a SINGLE mark at a non-final line end may use this extra projection.
 const HANG_END_INK = new Map([
  ['，',.13],['、',.08],['。',.13],['﹐',.11],['﹑',.11],['﹒',.11],
  ['：',.17],['；',.12],['？',.10],['！',.10],
  ['”',.07],['’',.07],['」',.055],['』',.055],
  ['）',.055],['》',.055],['〉',.055],['】',.045],['〕',.045],
  ['］',.045],['｝',.045],['〗',.045]
 ]);
 // Open punctuation belongs at line start, never at line end. Follow CLReq
 // §6.3.2.3's half-em leading space trim, plus a tiny measured ink overhang.
 // Actual visible projection is strictly capped (not a full-width hang).
 const HANG_START_INK = new Map([
  ['“',.075],['‘',.075],['「',.060],['『',.060],
  ['（',.060],['《',.065],['〈',.065],['【',.050],
  ['〔',.050],['［',.050],['｛',.050],['〖',.050]
 ]);

 // CLReq-inspired horizontal Chinese punctuation composition. A paired
 // punctuation reduction is deterministic and measured from actual Canvas
 // glyph ink boxes. No letter is scaled or transformed; the ink itself is
 // never allowed to overlap, and the DOM representation uses the same amount.
 const PUNCT_OPEN = new Set(Array.from('（［｛【〔〖〈《「『“‘'));
 const PUNCT_CLOSE = new Set(Array.from('）］｝】〕〗〉》」』”’'));
 const PUNCT_STOP = new Set(Array.from('，。！？；：、﹐﹑﹒'));
 const isZhPunctuation=ch=>PUNCT_OPEN.has(ch)||PUNCT_CLOSE.has(ch)||PUNCT_STOP.has(ch);
 // Ink clearance is categorical: an open bracket following a close bracket
 // needs slightly more breathing room than a comma followed by an opening
 // quotation mark. Caps remain measured from the actual font's side bearings.
 const PUNCT_INK_SAFETY=.085;
 function punctuationClearance(a,b){
  if(PUNCT_CLOSE.has(a)&&PUNCT_OPEN.has(b))return .115;
  if(PUNCT_OPEN.has(a)&&PUNCT_OPEN.has(b))return .10;
  if(PUNCT_CLOSE.has(a)&&PUNCT_CLOSE.has(b))return .10;
  if(PUNCT_STOP.has(a)&&PUNCT_OPEN.has(b))return .115;
  return PUNCT_INK_SAFETY;
 }
 // Keep measured empty-side-bearing clearance: v95.1 retains more visible
 // white space around paired punctuation instead of pushing both ink shapes
 // to within a single pixel. CLReq uses roughly 0.5em as a conventional
 // reduction for two adjacent fullwidth marks, not an obligation to squeeze.
 // Desired contraction is a soft line-breaking cost, NEVER a mandatory trim.
 // In a paragraph containing multiple punctuation categories, the average
 // of their measured elastic capacities guides the candidate line geometry.
 // This avoids both overcompressing repeated strong stops and leaving a
 // close/open quote pair visibly loose on a comfortably fitting line.
 function punctuationPreference(a,b){
  if(PUNCT_STOP.has(a)&&PUNCT_STOP.has(b))return .52;
  if(PUNCT_CLOSE.has(a)&&PUNCT_OPEN.has(b))return .88;
  if(PUNCT_OPEN.has(a)&&PUNCT_OPEN.has(b))return .79;
  if(PUNCT_CLOSE.has(a)&&PUNCT_CLOSE.has(b))return .74;
  if(PUNCT_CLOSE.has(a)&&PUNCT_STOP.has(b))return .70;
  if(PUNCT_STOP.has(a)&&PUNCT_OPEN.has(b))return .74;
  return .70;
 }
 // Outside brackets are not as tight as two punctuation marks. Trim only
 // clearly empty ink-side bearings *before opening* / *after closing* marks,
 // retaining a larger, 0.13em clearance next to full-sized Han glyphs.
 const BRACKET_TEXT_CAP=.115, BRACKET_TEXT_CLEARANCE=.13;
 // A STOP→OPEN pair must be compact even on a loose line. CLReq's normal
 // reduction is about half an ideograph; v93.8 sometimes used just .16em.
 // The fixed portion is bounded by the REAL pair's whitespace and never
 // touches non-punctuation text or spaces explicitly present in the EPUB.
 const STOP_OPEN_BASE=.50; // em; CLReq-inspired reduction of 2em punctuation toward 1.5em

 // Not every run of punctuation should be compressed equally: nested quotation
 // or bracket edges have large blank bearings, while two strong sentence marks
 // should retain enough air to express their emphasis. CLReq permits several
 // composition styles; Folio uses bounded, font-specific optical contraction.
 function punctuationPairCap(a,b){
  const ao=PUNCT_OPEN.has(a),ac=PUNCT_CLOSE.has(a),as=PUNCT_STOP.has(a);
  const bo=PUNCT_OPEN.has(b),bc=PUNCT_CLOSE.has(b),bs=PUNCT_STOP.has(b);
  if(as&&bs)return .19;       // !! / ？！: don't blur a double pause into one.
  if(ac&&bo)return .42;       // Closing quote followed by an opening quote.
  if(ao&&bo)return .40;       // Nested opening quotes or brackets.
  if(ac&&bc)return .32;       // Nested closing punctuation.
  if(as&&bo)return .63;       // Stop + opening quote: limit total contraction to a readable ~0.63em.
  if(ac&&bs)return .35;       // Closing quote and trailing comma/period.
  if(ao&&bc)return .34;       // Empty quoted pair, keep ink separated.
  if(ao&&bs)return .23;       // Unusual mark sequence: avoid over-tightening.
  return .30;
 }


 const WS = /^[ \t\n\r\f\u2000-\u200a\u202f\u205f\u3000]+$/u;
 const ATOM='\uFFFC'; // One native MathML box.
 const CODE_ATOM='\uFFF8'; // Inline code/keyboard/samp is an indivisible native-styled box.
 const NOTE_ATOM='\uFFF9'; // One intact superscript noteref, attached to its preceding word.
 const MIXED_CJK_RATIOS=[.15,.3,.45,.6,.75,.9,1];
 const MAX_PARAGRAPH = 2500, MAX_TOKENS = 2100, MAX_PARAGRAPHS = 800, MAX_CJK_SPACERS = 850;
 // Keep at most three previously validated line compositions per paragraph.
 // Snapshots are created *on departure* from a width, so a cold chapter load
 // incurs no template-cloning cost. The stored DOM is detached and bounded.
 const MAX_SAVED_LAYOUTS=3, MAX_SAVED_LAYOUT_CHARS=2400;
 const cacheByDoc = new WeakMap();
 // Canvas metrics belong to a live EPUB document, not a global font-family
 // name. Two books may both declare 'BookSerif' with different @font-face.
 const metricsCacheByDoc = new WeakMap();
 const inkMetricsCacheByDoc = new WeakMap();
 const measureContexts = new WeakMap();
 // Reuse font-ink measurement across validated resizes of one EPUB document.
 // A WeakMap prevents retaining closed chapters, and invalidate() drops the
 // entries when the font/publisher styling changes.
 const paintMeasureByDoc = new WeakMap();
 // Plans contain font-dependent token objects; never reuse across EPUB
 // documents which can resolve the same family to different embedded fonts.
 const planCachesByDoc = new WeakMap();
 // Long technical chapters can contain hundreds of different multi-line
 // layouts. Limiting the cache by entry COUNT alone retained megabytes of
 // token arrays and full paragraph strings, even if almost never reused.
 // The estimate is intentionally conservative (JS objects are engine-specific)
 // and the cache is an optimization only: eviction cannot change line breaks.
 const MAX_PLAN_CACHE_BYTES = 4 * 1024 * 1024;
 const MAX_PLAN_CACHE_ENTRIES = 128;
 class BoundedPlanCache extends Map {
  constructor(){super();this.bytes=0;this.weights=new Map();this.evictions=0;}
  static estimate(key,choice){
   const plan=choice?.best;
   return Math.max(128, 2 * key.length +
    (plan?._tokens?.length||0)*224 + (plan?.lines?.length||0)*320 +
    (plan?.breakpoints?.length||0)*16 + 256);
  }
  get(key){
   const value=super.get(key);
   if(value!==undefined){super.delete(key);super.set(key,value);}
   return value;
  }
  delete(key){
   const bytes=this.weights.get(key);
   if(bytes!==undefined){this.bytes-=bytes;this.weights.delete(key);}
   return super.delete(key);
  }
  clear(){super.clear();this.weights.clear();this.bytes=0;}
  set(key,value){
   if(super.has(key))this.delete(key);
   const weight=BoundedPlanCache.estimate(key,value);
   if(weight>MAX_PLAN_CACHE_BYTES)return this;
   super.set(key,value);this.weights.set(key,weight);this.bytes+=weight;
   while(this.size>MAX_PLAN_CACHE_ENTRIES || this.bytes>MAX_PLAN_CACHE_BYTES){
    this.delete(super.keys().next().value);this.evictions++;
   }
   return this;
  }
 }
 // Pretext-inspired two-stage pipeline: tokenize / locate legal word breaks
 // once per *text*, independently of fonts and column widths. All actual glyph
 // widths remain measured with the browser's font engine at layout time.
 // A prepared paragraph is independent of the current column width. Its
 // styled runs and Canvas-measured boxes are retained across width-only
 // repagination; no DOM measurement is performed by the Knuth-Plass DP.
 let measuredParagraphCache = new WeakMap();
 let eligibilityCache = new WeakMap();
 // Reuse measured token geometry between identical, independently styled
 // paragraphs *within the same EPUB document*. The weak document key avoids
 // cross-book @font-face collisions; the small bounded map avoids retaining
 // large books. Styled DOM run nodes are NEVER shared between paragraphs.
 const measuredTemplatesByDoc = new WeakMap();
 const MAX_MEASURED_TEMPLATES=48, MAX_MEASURED_TEMPLATE_CHARS=1500;
 const MAX_TEMPLATE_CACHE_BYTES=2*1024*1024;
 // Preserve tokenization results only while the owning chapter is alive.
 // This prevents a closed copyrighted chapter lingering in a global LRU.
 const preparedTextCachesByDoc = new WeakMap();
 const MAX_PREPARED_TEXT = 256;
 const MAX_PREPARED_TEXT_BYTES=3*1024*1024;
 // Entry-count bounds alone do not prevent an EPUB with many distinct, very
 // long paragraphs from retaining tens of megabytes of duplicated token
 // objects. This cache tracks a conservative per-entry cost and evicts the
 // least recently used items; no retained entry affects layout correctness.
 class BoundedReusableCache extends Map {
  constructor(maxEntries,maxBytes,estimate){super();this.maxEntries=maxEntries;
   this.maxBytes=maxBytes;this.estimate=estimate;this.bytes=0;this.weights=new Map();this.evictions=0;}
  get(key){const value=super.get(key);
   if(value!==undefined){super.delete(key);super.set(key,value);}
   return value;}
  delete(key){const weight=this.weights.get(key);
   if(weight!==undefined){this.bytes-=weight;this.weights.delete(key);}
   return super.delete(key);}
  clear(){super.clear();this.weights.clear();this.bytes=0;}
  set(key,value){if(super.has(key))this.delete(key);
   const weight=this.estimate(key,value);
   if(weight>this.maxBytes)return this;
   super.set(key,value);this.weights.set(key,weight);this.bytes+=weight;
   while(this.size>this.maxEntries||this.bytes>this.maxBytes){
    this.delete(super.keys().next().value);this.evictions++;}
   return this;}
 }
 // Every character in this deliberately narrow BMP repertoire is a single
 // grapheme. If a paragraph includes supplementary Han, combining marks,
 // emoji, ZWJ or arbitrary scripts, retain Intl.Segmenter's exact behavior.
 const FAST_SIMPLE_HAN = /^[\u3400-\u9fff\uf900-\ufaff\x20-\x7e\t\n\r\f，。、…！？；：‘’“”（）《》【】「」『』—·﹐﹑﹒]+$/u;
 const HAS_SEGMENTER = typeof Intl !== 'undefined' && !!Intl.Segmenter;
 const graphemeSegmenter = HAS_SEGMENTER ? new Intl.Segmenter('und',{granularity:'grapheme'}) : null;
 const own = (item,prop) => Object.prototype.hasOwnProperty.call(item,prop);
 const inRange = (x,a,b) => x>=a && x<b;
 const isCJK = (s)=>HAN.test(s) || CJK_PUNCT.test(s);
 // Fast code-point edges: avoid materializing whole Western words into arrays.
 const first = str => str ? String.fromCodePoint(str.codePointAt(0)) : '';
 const last = str => {
  if(!str)return '';
  const i=str.length-1, c=str.charCodeAt(i);
  return c>=0xdc00 && c<=0xdfff && i>0 ? str.slice(i-1) : str.slice(i);
 };
 const glyphLength = str => /^[\x00-\x7f]*$/.test(str) ? str.length : [...str].length;
 const cls = (str)=> str===ATOM ? 'math' : str===CODE_ATOM ? 'code' : str===NOTE_ATOM ? 'note' : WS.test(str) ? 'space' : isCJK(str) ? 'cjk' : 'western';
 function graphemes(text){
  // ASCII-only paragraphs are common in English EPUBs. Running Intl.Segmenter
  // over every one-byte character is unnecessary; ASCII has no multi-codepoint
  // grapheme clusters. Retain the full grapheme algorithm for all other text.
  if(!/[^\x00-\x7F]/.test(text)){
   const result=new Array(text.length);
   for(let i=0;i<text.length;i++)result[i]={part:text[i],start:i,end:i+1};
   return result;
  }
  if(graphemeSegmenter)return Array.from(graphemeSegmenter.segment(text),part=>({part:part.segment,start:part.index,end:part.index+part.segment.length}));
  let offset=0;return Array.from(text,ch=>{const item={part:ch,start:offset,end:offset+ch.length};offset+=ch.length;return item});
 }
 function tokenize(text){
  // Pretext-style direct tokenization of plain Latin runs. This avoids
  // allocating an object for every ASCII codepoint only to concatenate it
  // immediately into a word. The Unicode path remains grapheme-aware.
  if(!/[^\x00-\x7f]/.test(text)){
   const result=[];
   const pattern=/[ \t\n\r\f]+|-|[^ \t\n\r\f-]+/g;
   let match;
   while((match=pattern.exec(text))!==null){
    const part=match[0],start=match.index;
    result.push({text:part,start,end:start+part.length,
     kind:/^[ \t\n\r\f]+$/.test(part)?'space':'western',
     width:0,stretch:0,shrink:0,afterStretch:0,afterShrink:0});
   }
   return result;
  }
  // The Latin-only tokenizer above is already linear. For ordinary BMP
  // Han plus Latin prose, the grapheme iterator needlessly creates hundreds
  // of SegmentData objects; a simple code-unit walk is exactly equivalent.
  const out=[];
  if(FAST_SIMPLE_HAN.test(text)){
   for(let i=0;i<text.length;i++){
    const part=text[i],kind=cls(part),prev=out[out.length-1];
    if(prev && kind==='western' && prev.kind==='western' && /[-‐‑–]$/u.test(prev.text) && part!=='-'){
     out.push({text:part,start:i,end:i+1,kind,width:0,stretch:0,shrink:0,afterStretch:0,afterShrink:0});continue;
    }
    if(prev && kind!=='cjk' && kind!=='math' && prev.kind===kind && !(/[-‐‑–]$/u.test(part))){
     prev.text+=part;prev.end=i+1;
    }else out.push({text:part,start:i,end:i+1,kind,width:0,stretch:0,shrink:0,afterStretch:0,afterShrink:0});
   }
   return out;
  }
  for(const unit of graphemes(text)){
   let kind=cls(unit.part);
   // Never expose a soft-hyphen or joiner as an independent CJK line boundary.
   if(JOINERS.test(unit.part))kind='western';
   const prev=out[out.length-1];
   // Preserve line opportunities at hyphens; old tokenizer swallowed every
   // hyphen into a single unbreakable Western run.
   if(prev && kind==='western' && prev.kind==='western' && /[-‐‑–]$/u.test(prev.text) && unit.part!=='-' ) {out.push({text:unit.part,start:unit.start,end:unit.end,kind,width:0,stretch:0,shrink:0,afterStretch:0,afterShrink:0});continue;}
   if(prev && kind!=='cjk' && kind!=='math' && prev.kind===kind && !(/[-‐‑–]$/u.test(unit.part))){
    prev.text+=unit.part;prev.end=unit.end;
   }else out.push({text:unit.part,start:unit.start,end:unit.end,kind,width:0,stretch:0,shrink:0,afterStretch:0,afterShrink:0});
  }
  return out;
 }
 function preparedTokens(text,hyphenator,doc){
  let preparedTextCache=preparedTextCachesByDoc.get(doc);
  if(!preparedTextCache){preparedTextCache=new BoundedReusableCache(
   MAX_PREPARED_TEXT,MAX_PREPARED_TEXT_BYTES,(k,v)=>2*k.length+152*v.length+128);
   preparedTextCachesByDoc.set(doc,preparedTextCache);}
  const hasHyphenator=!!hyphenator?.points;
  const key=(hasHyphenator?'hyphen|':'plain|')+text;
  let prepared=preparedTextCache.get(key);
  if(!prepared){
   const base=tokenize(text);
   prepared=hasHyphenator?discretionaryTokens(base,hyphenator):base;
   preparedTextCache.set(key,prepared);
  }
  // Reflow can mutate computed widths and glue; never mutate cached tokens.
  return prepared.map(t=>({...t,width:0,stretch:0,shrink:0,afterStretch:0,afterShrink:0,afterAuto:0,punctKern:0,punctBase:0,edgeKern:0,punctStart:0,hyphenWidth:0}));
 }
 function discretionaryTokens(tokens,hyphenator){
  if(!hyphenator?.points)return tokens;
  const result=[];
  for(const t of tokens){
   // Keep technical identifiers, acronyms and mixed-case proper names intact;
   // en-US word patterns are not intended for JavaScript / OpenAI / LHC-style
   // identifiers even when the surrounding paragraph is English prose.
   if(t.kind!=='western'||!(/^[a-zA-Z]{7,}$/).test(t.text) ||
      /[a-z][A-Z]/.test(t.text) || /^[A-Z]{2,}$/.test(t.text)){
    result.push(t);continue;
   }
   const points=hyphenator.points(t.text).filter(point=>point>=2 && t.text.length-point>=3);if(!points.length){result.push(t);continue;}
   let prev=0;
   for(const point of points){
    result.push({...t,text:t.text.slice(prev,point),start:t.start+prev,end:t.start+point,
     hyphenBreak:true,hyphenPenalty:(point===2||t.text.length-point===3)?720:(point===3||t.text.length-point===4)?425:(point===4)?335:175,hyphenWidth:0,width:0});prev=point;
   }
   result.push({...t,text:t.text.slice(prev),start:t.start+prev,end:t.end,
    hyphenBreak:false,hyphenWidth:0,width:0});
  }
  return result;
 }
 function breakAfter(a,b){
  if(!a || !b || a.kind==='space' && b.kind==='space')return null;
  if(a.kind==='space')return {penalty:0,flagged:false,kind:'space'};
  if(b.kind==='note')return null; // Don't orphan a reference number at the start of a line.
  if(a.kind==='note')return {penalty:10,flagged:false,kind:'note'};
  if(a.hyphenBreak)return {penalty:a.hyphenPenalty||145,flagged:true,kind:'discretionary'};
  if(b.kind==='space')return null;
  const x=last(a.text),y=first(b.text);
  if(JOINERS.test(x)||JOINERS.test(y)||OPEN.has(x)||CLOSE.has(y)||NONSTART.has(y))return null;
  // MathML is an atomic inline box, positioned and shaped by Chromium.
  // Never detach a following punctuation mark or start a new line after a
  // short Latin prefix such as E= when an equation is attached to it.
  if(a.kind==='math'||b.kind==='math'||a.kind==='code'||b.kind==='code'){
   if(a.kind==='cjk'||b.kind==='cjk')return {penalty:30,flagged:false,kind:'atom'};
   return {penalty:180,flagged:false,kind:'atom'};
  }
  // Keep ASCII comma/dot/colon bound to adjacent Western text, including
  // abbreviations, decimals, dates and formula-like fragments.
  if(a.kind==='cjk'||b.kind==='cjk')return {penalty:a.kind!==b.kind?18:0,flagged:false,kind:'ideographic'};
  if(/[-‐‑–]$/u.test(x)&&!/^[0-9]/.test(y))return {penalty:65,flagged:true,kind:'hyphen'};
  return null;
 }
 function nodesFor(tokens){
  // TeX's box/glue/penalty vocabulary is represented explicitly. A whitespace
  // glue may end a line; an ideographic glue has zero natural width but can
  // stretch/shrink when the browser justifies Chinese text.
  const nodes=[];
  const breaks=[{i:0,penalty:0,flagged:false,kind:'start'}];
  for(let i=0;i<tokens.length;i++){
   const t=tokens[i];
   if(t.kind==='space') nodes.push({type:'glue',width:t.width,stretch:t.stretch,shrink:t.shrink,start:t.start,end:t.end});
   else nodes.push({type:'box',width:t.width,start:t.start,end:t.end});
   if(i===tokens.length-1)break;
   const possible=breakAfter(t,tokens[i+1]);
   if(!possible)continue;
   if(possible.kind==='ideographic'){
    nodes.push({type:'glue',width:0,stretch:t.afterStretch,shrink:t.afterShrink,start:t.end,end:t.end});
   }else if(possible.kind==='hyphen'||possible.kind==='discretionary'){
    nodes.push({type:'penalty',width:0,penalty:possible.penalty,flagged:true,start:t.end,end:t.end});
   }
   breaks.push({i:i+1,pos:t.end,...possible});
  }
  breaks.push({i:tokens.length,pos:tokens.at(-1)?.end||0,penalty:-10000,flagged:false,kind:'end'});
  return {nodes,breaks};
 }
 // Allocate contiguous, numerically typed prefix columns. The DP performs
 // random prefix subtraction repeatedly; Float64 preserves subpixel math,
 // while UInt32 is sufficient for token/glyph counts (< 2500 per paragraph).
 // This avoids array growth, .at(-1) lookup and short-lived number boxing.
 function summarize(tokens){
  const n=tokens.length,size=n+1;
  const w=new Float64Array(size),st=new Float64Array(size),sh=new Float64Array(size);
  const spaces=new Uint32Array(size),spaceWidth=new Float64Array(size);
  const cjkGaps=new Uint32Array(size),cjkCap=new Float64Array(size);
  const letters=new Uint32Array(size),punctCap=new Float64Array(size);
  const punctFixed=new Float64Array(size),punctAim=new Float64Array(size),edgeCap=new Float64Array(size);
  for(let i=0;i<n;i++){
   const t=tokens[i],k=i+1,space=t.kind==='space';
   w[k]=w[i]+t.width+(t.afterAuto||0);
   punctCap[k]=punctCap[i]+Math.max(0,(t.punctKern||0)-(t.punctBase||0));
   punctFixed[k]=punctFixed[i]+(t.punctBase||0);
   punctAim[k]=punctAim[i]+(t.punctAim||0);
   edgeCap[k]=edgeCap[i]+(t.edgeKern||0);
   st[k]=st[i]+(t.stretch||0)+(t.afterStretch||0);
   sh[k]=sh[i]+(t.shrink||0)+(t.afterShrink||0);
   spaces[k]=spaces[i]+(space?1:0);
   spaceWidth[k]=spaceWidth[i]+(space?t.width:0);
   cjkGaps[k]=cjkGaps[i]+(t.afterStretch>0?1:0);
   cjkCap[k]=cjkCap[i]+(t.afterStretch||0);
   letters[k]=letters[i]+(space?1:glyphLength(t.text));
  }
  return {w,st,sh,spaces,spaceWidth,cjkGaps,cjkCap,letters,punctCap,punctFixed,punctAim,edgeCap};
 }
 // Use one coherent physical glue model in the DP and in the renderer.
 // Western spaces may shrink/stretch; Han--Han gaps may only expand. Compare
 // the actual cost of distributing a line's shortfall between both classes.
 function fitMixedGlue(missing,spaces,naturalSpace,cjkGaps,cjkCapacity){
  if(!Number.isFinite(missing))return null;
  const fontEm=cjkGaps?cjkCapacity/(cjkGaps*.145):0;
  const maxCJK=cjkCapacity*.985;
  // 0.025em is a conservative optical adjustment between fullwidth Han
  // glyphs, well below the amount at which letters appear crushed. It also
  // lets a nearly-full line survive a one/two-pixel viewport reduction.
  const maxCJKCompress=cjkGaps*fontEm*.025;
  const maxStretch=spaces*naturalSpace*.92;
  const maxShrink=spaces*naturalSpace*.23;
  if(missing>maxCJK+maxStretch+.35 || missing < -maxShrink-maxCJKCompress-.35)return null;
  // Most Chinese lines have no Latin spaces, and most English lines have no
  // ideographic gaps. Solve those cases analytically (no allocations/loops).
  if(!spaces){
   if(missing < -maxCJKCompress-.35 || missing>maxCJK+.35)return null;
   const stretch=missing;
   const ratio=stretch>=0 ? (maxCJK?stretch/maxCJK:0) :
    (maxCJKCompress?Math.abs(stretch)/maxCJKCompress:0);
   return {justify:Math.abs(stretch)>.035,justifyMode:Math.abs(stretch)>.035?'mixed':'none',
    wordSpacing:0,cjkSpacing:cjkGaps?stretch/cjkGaps:0,
    ratio,badness:(stretch<0?300:165)*ratio**3};
  }
  if(!cjkGaps){
   const wr=missing/(spaces*naturalSpace);
   if(wr<-.23-.001||wr>.92+.001)return null;
   const abs=Math.abs(wr);
   let cost=960*abs**3*(wr<0?1.6:1);
   if(wr>.42)cost+=260+9500*(wr-.42)**2;
   if(wr<-.16)cost+=100+6000*(Math.abs(wr)-.16)**2;
   return {justify:true,justifyMode:'spaces',wordSpacing:missing/spaces,
    cjkSpacing:0,ratio:abs,badness:cost};
  }
  // The candidates are a fixed handful of optical CJK glue ratios. Avoid
  // creating a Set and its iterator in every (break-start, break-end) DP
  // candidate. Duplicate ratios are harmless because a strict < chooses the
  // first minimum, exactly as Set's insertion order did.
  const clamped=Math.max(-maxCJKCompress,Math.min(maxCJK,missing));
  const preferred=Math.min(maxCJK,Math.max(0,missing-spaces*naturalSpace*.16));
  let best=null;
  for(let i=0;i<14;i++){
   let stretch;
   if(i===0)stretch=0;
   else if(i===1)stretch=clamped;
   else if(i>=2 && i<=5){
    if(missing>=0)continue;
    stretch=-maxCJKCompress*(i-1)*.25;
   }else if(i>=6 && i<=12){
    stretch=Math.min(maxCJK,cjkGaps*fontEm*.145*MIXED_CJK_RATIOS[i-6]);
   }else stretch=preferred;
   const western=missing-stretch;
   const perSpace=western/spaces;
   const wr=naturalSpace>0?perSpace/naturalSpace:0;
   if(wr<-.23-.001 || wr>.92+.001)continue;
   const cr=stretch>=0 ? (cjkCapacity>0?stretch/cjkCapacity:0) :
    (maxCJKCompress>0?Math.abs(stretch)/maxCJKCompress:0);
   const abs=Math.abs(wr);
   const westBad=960*abs**3*(wr<0?1.6:1);
   const river=wr>.42?260+9500*(wr-.42)**2:0;
   const squeezed=wr<-.16?100+6000*(Math.abs(wr)-.16)**2:0;
   const cjkBad=(stretch<0?300:165)*cr**3;
   const cost=westBad+river+squeezed+cjkBad;
   if(best===null||cost<best.badness){
    best={justify:true,justifyMode:Math.abs(stretch)>.035?'mixed':'spaces',
     wordSpacing:perSpace,cjkSpacing:stretch/cjkGaps,
     ratio:Math.max(abs,cr),badness:cost};
   }
  }
  return best;
 }
 // The same safe punctuation capacities participate in both the dynamic
 // program and the DOM renderer. Only the selected fraction of each pair is
 // applied; mark shapes and semantic text are never scaled or substituted.
 function lineMetrics(tokens,prefix,from,to,goal,final,alignment,fontSize=20,allowTracking=true,paragraphIndent=0){
  let start=from,end=to;
  while(start<end&&tokens[start].kind==='space')start++;
  while(end>start&&tokens[end-1].kind==='space')end--;
  if(start>=end)return null;
  const tail=tokens[end-1];
  const leadingOpen=PUNCT_OPEN.has(first(tokens[start]?.text||''));
  // When the EPUB indents the first line, a small optical hang can sit
  // safely *inside that indent* even when the chosen font has almost no
  // empty leading side-bearing. Ordinary unindented column starts never
  // receive this synthetic protrusion.
  const punctStart=(tokens[start]?.punctStart||0) ||
   (paragraphIndent>8 && start===0 && leadingOpen?Math.min(fontSize*.055,paragraphIndent*.09):0);
  // CLReq §6.1.3: do not apply line-end hanging to punctuation that
  // immediately follows another punctuation mark. A run such as 。” or ？！”
  // should be composed as one cluster, not protrude its final closing mark.
  const previousToken=tokens[end-2];
  const adjacentPunctuation=!!(previousToken && previousToken.end===tail.start &&
    isZhPunctuation(last(previousToken.text)) && isZhPunctuation(last(tail.text)));
  // An optical ink hang is allowed only for a single mark on a sufficiently
  // full, non-final line. It is not a second punctuation-pair compression;
  // tight quote clusters and ragged paragraph ends remain untouched.
  const basicEnd=!final&&!tail.hyphenBreak&&!adjacentPunctuation?(tail.opticalEnd||0):0;
  // Do not compress a punctuation pair across a chosen line break: the
  // trailing token's capacity belongs exclusively to the next line.
  const punctCapacity=Math.max(0,prefix.punctCap[end]-prefix.punctCap[start]-Math.max(0,(tail.punctKern||0)-(tail.punctBase||0)));
  const punctFixed=Math.max(0,prefix.punctFixed[end]-prefix.punctFixed[start]-(tail.punctBase||0));
  const punctAim=Math.max(0,prefix.punctAim[end]-prefix.punctAim[start]-(tail.punctAim||0));
  const preferredRatio=punctCapacity>.001?Math.max(.48,Math.min(.90,punctAim/punctCapacity)):.70;
  const bracketCapacity=Math.max(0,prefix.edgeCap[end]-prefix.edgeCap[start]-(tail.edgeKern||0));
  const coreWidth=prefix.w[end]-prefix.w[start]-(tail.afterAuto||0)-punctStart-punctFixed+
    (!final&&tail.hyphenBreak?(tail.hyphenWidth||0):0)-basicEnd;
  const additionalInkHang=basicEnd>0 && tail.opticalExtra>0 && coreWidth>=goal-fontSize*.34
    ?tail.opticalExtra:0;
  const opticalEnd=basicEnd+additionalInkHang;
  // Optical *ink* alignment, not advance-box alignment. The last mark's
  // ink may remain well inside the justified margin after hanging its blank
  // bearing: visually a normal Han ideograph then appears to protrude.
  // Paint only the remaining empty bearing toward the edge, never stretch or
  // shift the Han glyph, and cap to 0.32em for a natural pause-mark gap.
  // Relative positioning changes paint but not Knuth-Plass line measures.
  const paintShift=opticalEnd>0 && tail.opticalInkRight>opticalEnd
   ?Math.min(fontSize*.32,Math.max(0,tail.opticalInkRight-opticalEnd-fontSize*.075)):0;
  const opticalChar=opticalEnd>.02?(tail.opticalChar||''):'';
  const naturalWidth=coreWidth-additionalInkHang;
  // Even maximum measured punctuation contraction cannot make this line fit.
  // Reject it BEFORE trying up to four expensive glue distributions. The
  // .35px tolerance matches the final candidate admission below.
  // Western word spaces and (bounded) Han glue can still shrink to fit a
  // natural line that would otherwise be slightly too long. Do not prune
  // until those legal shrink budgets are accounted for.
  const shrinkAllowance=prefix.sh[end]-prefix.sh[start]-(tail.afterShrink||0);
  if(naturalWidth-punctCapacity-bracketCapacity-shrinkAllowance>goal+.35)return null;
  const spaces=prefix.spaces[end]-prefix.spaces[start];
  const gapWidth=prefix.spaceWidth[end]-prefix.spaceWidth[start];
  const naturalSpace=gapWidth/Math.max(1,spaces);
  const cjkGaps=prefix.cjkGaps[end]-prefix.cjkGaps[start]-(tail.afterStretch>0?1:0);
  const cjkCapacity=prefix.cjkCap[end]-prefix.cjkCap[start]-(tail.afterStretch||0);
  const glyphCount=prefix.letters[end]-prefix.letters[start];
  const propose=(ratio)=>{
   // Han-to-bracket empty bearings are a *reserve*, not normal punctuation
   // spacing. Use them only when the high-contraction candidates win.
   const edgeRatio=Math.max(0,Math.min(1,(ratio-.80)/.20));
   const compression=punctCapacity*ratio+bracketCapacity*edgeRatio;
   const width=naturalWidth-compression;
   const missing=goal-width;
   const relativeShortfall=Math.max(0,missing)/Math.max(1,goal);
   let tracking=0;
   let properties={justify:false,justifyMode:'none',wordSpacing:0,cjkSpacing:0,
    ratio:relativeShortfall,badness:0};
   if(final){
    if(missing<-.35)return null;
    properties.badness=width<goal*.16?17000:width<goal*.30?6500:width<goal*.44?1100:0;
   }else if(alignment!=='justify'){
    if(missing<-.35)return null;
    properties.badness=2300*relativeShortfall**2;
   }else if(cjkGaps>0){
    const fit=fitMixedGlue(missing,spaces,naturalSpace,cjkGaps,cjkCapacity);
    if(fit)properties=fit;
    else if(missing>=-.35 && spaces>0){const q=missing/(spaces*naturalSpace);properties={justify:true,justifyMode:'spaces',wordSpacing:missing/spaces,cjkSpacing:0,ratio:q,badness:3800+6000*Math.max(0,q-.92)**2};}
    else if(missing>=-.35 && cjkGaps>0){const q=missing/Math.max(1,cjkCapacity);properties={justify:true,justifyMode:'mixed',wordSpacing:0,cjkSpacing:missing/cjkGaps,ratio:q,badness:3800+2000*Math.max(0,q-.985)**2};}
    else return null;
   }else if(spaces>0 && naturalSpace>0){
    if(allowTracking && glyphCount>=28 && missing>spaces*naturalSpace*.24)
     tracking=Math.min(fontSize*.014,(missing-spaces*naturalSpace*.24)/glyphCount);
    const fit=fitMixedGlue(missing-tracking*glyphCount,spaces,naturalSpace,0,0);
    if(fit)properties={...fit,badness:fit.badness+3500*(tracking/fontSize)**2};
    else if(missing>=-.35){tracking=0;const q=missing/(spaces*naturalSpace);properties={justify:true,justifyMode:'spaces',wordSpacing:missing/spaces,cjkSpacing:0,ratio:q,badness:3800+6000*Math.max(0,q-.92)**2};}
    else return null;
   }else if(missing>=-.35){properties.badness=50000+20000*relativeShortfall**2;}
   else return null;
   // Mild optical contraction is preferable to leaving two enormous side
   // bearings, but strongly compressed pairs should not distort the rhythm
   // merely to accommodate a poorly chosen line break. A sentence's paired
   // marks share a proportional factor while retaining category caps.
   if(bracketCapacity>.03 && edgeRatio>0)
    properties.badness+=Math.min(420,260+bracketCapacity*5)*edgeRatio*edgeRatio;
   if(punctCapacity>.03){
    const target=preferredRatio;
    properties.badness+=Math.min(155,24+punctCapacity*7)*Math.pow(ratio-target,2);
    if(ratio>.77)properties.badness+=125*Math.pow((ratio-.77)/.23,2);
   }
   return {...properties,tracking,glyphCount,width,missing,spaces,naturalSpace,
    cjkGaps,goal,opticalEnd,paintShift,opticalChar,punctStart,
    punctStartChar:punctStart>0?first(tokens[start].text):'',fontSize,
    punctRatio:ratio,punctCompression:punctFixed+punctCapacity*ratio,punctCapacity,
    bracketRatio:edgeRatio,bracketCompression:bracketCapacity*edgeRatio,bracketCapacity};
  };
  if(punctCapacity+bracketCapacity<.035)return propose(0);
  // A tiny bounded candidate set avoids introducing any browser measurements
  // or another optimization pass. The minimum-fit candidate permits the
  // punctuation to save a near-overfull line only when needed.
  const needed=Math.max(0,naturalWidth-goal-.35);
  const required=needed<=.80*punctCapacity
   ?needed/Math.max(.001,punctCapacity)
   :(needed+4*bracketCapacity)/Math.max(.001,punctCapacity+5*bracketCapacity);
  const boundedRequired=Math.max(0,Math.min(1,required));
  // Retain a modest baseline contraction for typographic rhythm. Letting
  // every pair reach zero in this multi-column browser layout can expose
  // inaccurate advance predictions for styled links and inline atoms.
  // From that baseline to the measured maximum, each line is elastic.
  const requiredRatio=Math.max(.48,boundedRequired);
  // Avoid allocating candidates and evaluating the same ratio twice. This
  // is a hot path: KP explores many candidate breaks per long Han paragraph.
  let best=null;
  // Without any compressible punctuation the four trial ratios produce
  // identical glyph widths, glue, demerits and break decisions. In long
  // prose this occurs for the majority of candidate lines: evaluate the
  // full mixed-script glue model only once instead of four times. Keep
  // all four trials whenever either kind of punctuation contraction exists.
  const ratioTrials=punctCapacity<=0 && bracketCapacity<=0 ? 1 : 4;
  for(let i=0;i<ratioTrials;i++){
   // A ragged final line has no obligation to pack punctuation tightly.
   // Try an airy setting before the normal pair compression; retain the
   // tighter option only if the natural ink widths cannot fit the column.
   const loose=final?.28:.48, preferred=final?Math.max(.32,preferredRatio*.75):preferredRatio;
   const r=i===0?loose:i===1?preferred:i===2?1:requiredRatio;
   if(i===3 && (Math.abs(r-loose)<.0001 || Math.abs(r-preferred)<.0001 || Math.abs(r-1)<.0001))continue;
   const chosen=propose(r);
   if(chosen && (!best||chosen.badness<best.badness))best=chosen;
  }
  return best;
 }
 function fitness(line){
  if(!line.justify)return line.missing>line.goal*.2?3:1;
  if(line.ratio<-.12)return 0;
  if(line.ratio<=.15)return 1;
  if(line.ratio<=.42)return 2;
  return 3;
 }
 function score(prev,line,entry,final){
  let cost=prev.cost+12+Math.min(100000,line.badness);
  if(entry.kind==='discretionary')cost+=230;
  else if(entry.kind==='hyphen')cost+=45;
  else if(entry.penalty>0)cost+=entry.penalty*.30;
  if(Math.abs(fitness(line)-prev.fit)>1)cost+=115;
  if(prev.flagged && entry.flagged)cost+=390;
  // Paragraph-level rhythm: a third or fourth consecutive hyphenated line
  // reads like a broken word ladder. Penalize runs beyond two rather than
  // prohibiting a syllabically valid break when the column is very narrow.
  const hyphenStreak=entry.flagged?(prev.hyphenStreak||0)+1:0;
  if(hyphenStreak>=3)cost+=270*(hyphenStreak-1)**2;
  if(final && prev.flagged)cost+=145;
  // Gentle final-line cadence for long CJK paragraphs. An isolated short
  // ending should be discouraged without forcing new lines or harming short
  // dialogue. The hard fitting and safety rules remain completely unchanged.
  if(final && prev.metrics?.cjkGaps>0 && line.goal>320 && line.width>0){
   const fill=line.width/line.goal;
   if(fill<.68 && fill>.29)cost+=Math.min(820,4300*(.68-fill)**2);
  }
  // Cross-line optical rhythm: the old ratio compares unlike elastic models
  // (Latin word spaces against Han tracking) and loses the *direction* of a
  // correction. The ink-safe physical spacing already solved for each line
  // makes a better, bounded tie-breaker. This is only a soft demerit: it must
  // never invalidate a legal line or force extra letter-spacing.
  if(!final && prev.metrics && prev.metrics.justify && line.justify){
   const prior=prev.metrics;
   const delta=Math.abs((prior.ratio||0)-(line.ratio||0));
   if(delta>.42)cost+=140*(delta-.42)**2;
   if(line.goal>=400){
   // Compare adjacent Han runs only when both lines contain enough gaps to
   // represent prose rather than a single punctuation cluster. The floor
   // ignores normal antialiasing / rounding noise below ~0.6px at 20px.
   if(prior.cjkGaps>=4 && line.cjkGaps>=4){
    const em=Math.max(12,line.fontSize||20);
    const shift=Math.abs(prior.cjkSpacing-line.cjkSpacing)/em;
    if(shift>.033)cost+=Math.min(240,42000*(shift-.033)**2);
    if(prior.cjkSpacing*line.cjkSpacing<-.00016*em*em && shift>.045)
     cost+=Math.min(80,1900*(shift-.045));
   }
   // English/mixed prose: suppress isolated large word-space jumps, but do
   // not punish genuine Han/Latin transitions with different glue types.
   if(prior.spaces>=3 && line.spaces>=3 && prior.naturalSpace>0 && line.naturalSpace>0){
    const a=prior.wordSpacing/prior.naturalSpace;
    const b=line.wordSpacing/line.naturalSpace;
    const variation=Math.abs(a-b);
    if(variation>.32)cost+=Math.min(180,430*(variation-.32)**2);
   }
   }
  }
  if(!final&&prev.metrics&&!prev.metrics.justify&&!line.justify){
   const delta=Math.abs((prev.metrics.missing||0)-line.missing)/Math.max(1,line.goal);
   cost+=Math.min(150,200*delta*delta);
  }
  return cost;
 }
 // Resumable Knuth–Plass solver. The pure DP owns no DOM nodes; it may be
 // paused between candidate breaks and continued on later idle callbacks.
 // Its traversal order, fitness classes, pruning and tie breaking exactly
 // match the previous synchronous optimizer. Each job is scoped to one EPUB
 // document and discarded on typography, font, or chapter invalidation.
 function beginOptimization(tokens,width,firstIndent=0,options={}){
  if(!tokens.length)return null;
  const decomposition=options.geometry?.decomposition||nodesFor(tokens);
  const {breaks}=decomposition,prefix=options.geometry?.prefix||summarize(tokens);
  if(breaks.length<2)return null;
  const dp=Array.from({length:breaks.length},()=>[null,null,null,null]);
  const live=new Uint8Array(breaks.length);live[0]=1;
  dp[0][1]={cost:0,prev:-1,fit:1,flagged:false,target:width};
  return {tokens,width,firstIndent,options,decomposition,breaks,prefix,dp,live,
   k:1,j:0,steps:0,slices:0,startedAt:Date.now()};
 }
 function finishOptimization(task){
  const {tokens,decomposition,breaks,dp}=task;
   const finalIndex=breaks.length-1;
   const best=dp[finalIndex].filter(Boolean).sort((a,b)=>a.cost-b.cost)[0];
   if(!best)return null;
   const lines=[];let index=finalIndex,node=best;
   while(index>0){
    if(!node||node.prev<0)return null;
    lines.push({from:breaks[node.prev].i,to:breaks[index].i,
     start:breaks[node.prev].i?tokens[breaks[node.prev].i]?.start:0,
     end:tokens[breaks[index].i-1]?.end||0,ratio:node.ratio,justify:node.metrics?.justify||false,
     width:node.metrics?.width,goal:node.metrics?.goal,spaceCount:node.metrics?.spaces||0,naturalSpace:node.metrics?.naturalSpace||0,badness:node.metrics?.badness,cost:node.cost,
     justifyMode:node.metrics?.justifyMode||'none',wordSpacing:node.metrics?.wordSpacing||0,
     cjkSpacing:node.metrics?.cjkSpacing||0,tracking:node.metrics?.tracking||0,glyphCount:node.metrics?.glyphCount||0,opticalEnd:node.metrics?.opticalEnd||0,paintShift:node.metrics?.paintShift||0,opticalChar:node.metrics?.opticalChar||'',punctStart:node.metrics?.punctStart||0,punctStartChar:node.metrics?.punctStartChar||'',punctRatio:node.metrics?.punctRatio||0,punctCompression:node.metrics?.punctCompression||0,bracketRatio:node.metrics?.bracketRatio||0,bracketCompression:node.metrics?.bracketCompression||0,
     hyphenate:index!==finalIndex && !!tokens[breaks[index].i-1]?.hyphenBreak});
    const prevIndex=node.prev;
    node=dp[prevIndex][node.prevFit];index=prevIndex;
   }
   lines.reverse();
   // A paragraph containing only one achievable line needs no DOM changes.
   if(lines.length<2)return null;
   return {lines,breakpoints:breaks.length,cost:best.cost,tolerance:3,nodes:decomposition.nodes.length,_tokens:tokens};

 }
 function advanceOptimization(task,budgetMs=8){
  if(!task)return {finished:true,plan:null};
  const {tokens,width,firstIndent,options,breaks,prefix,dp,live}=task;
  const clock=typeof performance!=='undefined'&&performance.now?()=>performance.now():()=>Date.now();
  const deadline=clock()+Math.max(.5,budgetMs);
  let examined=0;
  while(task.k<breaks.length){
   const k=task.k,b=breaks[k],final=k===breaks.length-1;
   for(let j=task.j;j>=0&&k-j<=144;j--){
    task.j=j-1; // checkpoint AFTER this candidate, never score it twice
    const left=breaks[j];
    const rawWidth=prefix.w[b.i]-prefix.w[left.i];
    if(rawWidth>width*1.22+35 && j<k-1){
     const contraction=(prefix.punctCap[b.i]-prefix.punctCap[left.i])+
      (prefix.punctFixed[b.i]-prefix.punctFixed[left.i])+
      (prefix.edgeCap[b.i]-prefix.edgeCap[left.i])+
      (prefix.sh[b.i]-prefix.sh[left.i]);
     if(rawWidth-contraction>width*1.22+35){task.j=-1;break;}
    }
    if(live[j]){
     const reachable=dp[j];
     const goal=width-(j===0?firstIndent:0);
     const line=lineMetrics(tokens,prefix,left.i,b.i,goal,final,options.align||'start',options.fontSize||20,options.allowTracking!==false,j===0?firstIndent:0);
     if(line && Number.isFinite(line.badness) && (final || !line.justify || line.ratio<=3)){
      const nextFit=fitness(line);
      for(let f=0;f<4;f++){
       const previous=reachable[f];if(!previous)continue;
       const cost=score(previous,line,b,final);
       const existing=dp[k][nextFit];
       if(!existing||cost<existing.cost){
        dp[k][nextFit]={cost,prev:j,prevFit:f,fit:nextFit,flagged:b.flagged,
         hyphenStreak:b.flagged?(previous.hyphenStreak||0)+1:0,
         target:width,ratio:line.ratio,metrics:line};live[k]=1;
       }
      }
     }
    }
    task.steps++;examined++;
    // Check time inside one long break-node, not only at its boundary.
    // Always complete >= one candidate per call, so tiny idle deadlines
    // cannot starve a partially solved paragraph.
    if((examined&15)===0 && clock()>=deadline){
     task.slices++;
     return {finished:false,task,examined};
    }
   }
   task.k++;task.j=task.k-1;
  }
  task.slices++;
  return {finished:true,plan:finishOptimization(task),examined};
 }
 function optimize(tokens,width,firstIndent=0,options={}){
  const task=beginOptimization(tokens,width,firstIndent,options);
  if(!task)return null;
  // Preserve the former deadline policy for the initial synchronous pass:
  // an unfinished paragraph stays in native CSS text until idle refinement.
  const response=advanceOptimization(task,Math.max(20,options.timeBudgetMs??48));
  return response.finished?response.plan:null;
 }
 function refitExistingBreaks(tokens,previous,width,indent,options){
  // A few CSS pixels of width change usually do not justify rearranging
  // every Chinese line and rebuilding its DOM. Pretext-like metric reuse:
  // recompute glue for the previous breaks in O(number of tokens), no DP.
  // Constrain stable breaks to within six pixels of the original solution,
  // then require the same strict per-line justification and badness checks.
  // Wider changes still run the full DP.
  if(!previous?.optimizedLines?.length ||
     Math.abs(width-(previous.planOriginWidth??previous.fitWidth??0))>6)return null;
  // Width-only resizing retains the exact same measured glyph/token prefix.
  // This avoids O(paragraph length) reconstruction on every minor resize.
  const prefix=options.geometry?.prefix||summarize(tokens),old=previous.optimizedLines;
  const lines=[];
  for(let i=0;i<old.length;i++){
   const prior=old[i],final=i===old.length-1;
   const goal=width-(i===0?indent:0);
   const metrics=lineMetrics(tokens,prefix,prior.from,prior.to,goal,final,'justify',
    options.fontSize,options.allowTracking,i===0?indent:0);
   const rendered=metrics&&(metrics.width + (metrics.spaces||0)*(metrics.wordSpacing||0) +
    (metrics.glyphCount||0)*(metrics.tracking||0) + (metrics.cjkGaps||0)*(metrics.cjkSpacing||0));
   if(!metrics || (i<old.length-1 && !metrics.justify) ||
      (!final && metrics.badness>3500) || rendered>goal+1)return null;
   lines.push({...prior,ratio:metrics.ratio,justify:metrics.justify,width:metrics.width,goal,
    spaceCount:metrics.spaces,naturalSpace:metrics.naturalSpace,badness:metrics.badness,
    justifyMode:metrics.justifyMode,wordSpacing:metrics.wordSpacing,
    cjkSpacing:metrics.cjkSpacing,tracking:metrics.tracking,glyphCount:metrics.glyphCount,opticalEnd:metrics.opticalEnd||0,paintShift:metrics.paintShift||0,opticalChar:metrics.opticalChar||'',punctStart:metrics.punctStart||0,punctStartChar:metrics.punctStartChar||'',punctRatio:metrics.punctRatio||0,punctCompression:metrics.punctCompression||0,bracketRatio:metrics.bracketRatio||0,bracketCompression:metrics.bracketCompression||0});
  }
  return {lines,breakpoints:previous.breakpoints||0,tolerance:3,
   _tokens:tokens,stable:true};
 }
  function clipsPaint(style){
   return style.overflowX!=='visible'||style.overflowY!=='visible'||
    (style.clipPath&&style.clipPath!=='none')||
    (style.maskImage&&style.maskImage!=='none')||
    (style.webkitMaskImage&&style.webkitMaskImage!=='none')||
    (style.clip&&style.clip!=='auto')||
    /\b(?:paint|content|strict)\b/u.test(style.contain||'');
  }
 function selectEligible(p,win){
  const tag=p.localName;
  const isProseBlock=tag==='p'||tag==='li'||tag==='dd'||tag==='blockquote'||tag==='figcaption';
  if(!isProseBlock)return false;
  if(p.closest('[hidden],[aria-hidden="true"],[data-folio-popup-note="true"],pre,code,kbd,samp,table,svg,math,rt,ruby,button,script,style,aside,nav,[contenteditable]'))return false;
  // A caption may be under a figure, but a free-standing paragraph within
  // an image/figure group still belongs to the publisher's figure layout.
  if(tag!=='figcaption'&&p.closest('figure'))return false;
  // Reject short/oversized/unsupported-script blocks *before* querying any
  // computed styles or walking inline markup. Headings, short list items,
  // SICP code labels and note fragments often account for half the chapter.
  const text=p.textContent||'';
  const minimum=tag==='p'?50:tag==='li'?65:75;
  if(text.length<minimum||text.length>MAX_PARAGRAPH||/[\u2028\u2029]/u.test(text)||
     /\p{Script=Arabic}|\p{Script=Hebrew}|[\u202a-\u202e\u2066-\u2069]/u.test(text))return false;
  const textOnly=p.childElementCount===0;
  if(p.hasAttribute('data-folio-kp')||(!textOnly && p.querySelector('img,svg:not(math svg),ruby,rt,rp,br,wbr,hr,button,input,textarea,select,figure,table,pre,[id]:not(a[data-folio-note-ref]),[contenteditable],iframe')))return false;
  if(!textOnly && p.querySelector('math[display="block"],math[id],math [id],math maction,math annotation-xml,.math-display,.displaymath,.equation,.katex-display,.MathJax_Display,mjx-container'))return false;
  if(!textOnly && p.querySelector('[style*="float"],[style*="position"],[style*="display"],[style*="white-space"]'))return false;
  // Only the deepest prose block is reflowed. In particular, a list's own
  // marker and nested list semantics remain entirely browser-controlled.
  if(!textOnly && tag!=='p' && p.querySelector('p,li,dd,blockquote,figcaption,ol,ul,dl,div,section'))return false;
  if(p.childElementCount>45)return false;
  for(const el of textOnly?[]:p.querySelectorAll('*')){
   if(el.closest('math') || (el.matches('sup,sub')&&el.closest('a[data-folio-note-ref]')))continue;
   if(!el.matches('a,em,i,strong,b,small,span,cite,abbr,dfn,q,u,s,mark,time,font,var,code,kbd,samp'))return false;
   const inlineStyle=win.getComputedStyle(el);
   if(clipsPaint(inlineStyle))return false;
   if(el.matches('code,kbd,samp') && (el.querySelector('math,svg,img,br') || inlineStyle.display!=='inline'))return false;
  }
  const cs=win.getComputedStyle(p);
  if(cs.display==='none'||cs.visibility==='hidden'||cs.direction!=='ltr'||cs.writingMode!=='horizontal-tb'||cs.whiteSpace!=='normal'||cs.float!=='none'||cs.position==='absolute'||cs.position==='fixed')return false;
  // Optical margins are only valid when *painted ink*, not merely the
  // layout box, can escape. overflow:visible is insufficient when the source
  // uses clip-path, CSS masking or paint containment. Preserve publisher
  // content by using Chromium's native layout instead of defeating masks.
  if(clipsPaint(cs))return false;
  // Only examine ancestors inside BODY; BODY/HTML clip whole page spreads
  // intentionally. A paint mask or clipping on a containing section is
  // dangerous even when the paragraph itself reports overflow:visible.
  for(let parent=p.parentElement;parent&&parent!==p.ownerDocument.body;parent=parent.parentElement){
   if(clipsPaint(win.getComputedStyle(parent)))return false;
  }
  if(tag==='li' && (cs.display!=='list-item'||cs.listStylePosition==='inside'))return false;
  if(tag==='figcaption' && cs.display!=='block')return false;
  if(!['start','left','justify','-webkit-auto'].includes(cs.textAlign))return false;
  if(cs.textTransform!=='none'||cs.textOverflow!=='clip'||cs.letterSpacing!=='normal'&&Math.abs(parseFloat(cs.letterSpacing)||0)>1)return false;
  const indent=parseFloat(cs.textIndent)||0;
  if(indent < -.1 || indent>Math.min(80,(parseFloat(cs.width)||550)*.22))return false;
  return true;
 }
 function eligibleWithCache(p,win,key,available){
  // Avoid repeating structural querySelectorAll and descendant style checks
  // on pure column-width changes. This cache contains *no measured geometry*.
  const original=eligibilityCache.get(p);
  if(original?.key===key && original.first===p.firstChild &&
     original.elements===p.childElementCount && original.text===p.textContent &&
     !p.hasAttribute('data-folio-kp'))return original.yes;
  const yes=selectEligible(p,win);
  let measure=null;
  if(yes){
   const cs=win.getComputedStyle(p);
   const cssWidth=parseFloat(cs.width)||available;
   measure={widthOffset:Math.max(0,available-cssWidth),padding:(parseFloat(cs.paddingInlineStart)||0)+(parseFloat(cs.paddingInlineEnd)||0),
    border:(parseFloat(cs.borderInlineStartWidth)||0)+(parseFloat(cs.borderInlineEndWidth)||0),
    indent:parseFloat(cs.textIndent)||0,autoSpace:cs.textAutospace==='normal'};
  }
  eligibilityCache.set(p,{key,yes,measure,first:p.firstChild,elements:p.childElementCount,text:p.textContent});
  return yes;
 }
 function getRuns(p,win){
  // Plain-text paragraphs dominate novels. Avoid walking a DOM subtree or
  // querying each text node's parent style when there is only one text run.
  if(p.childNodes.length===1 && p.firstChild.nodeType===3){
   const node=p.firstChild,text=node.nodeValue;
   if(!text)return {text:'',runs:[]};
   const cs=win.getComputedStyle(p);
   return {text,runs:[{node,type:'text',start:0,end:text.length,
    font:`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
    fontSize:parseFloat(cs.fontSize)||20,
    letterSpacing:parseFloat(cs.letterSpacing)||0,
    wordSpacing:parseFloat(cs.wordSpacing)||0,
    kerning:cs.fontKerning||'auto',display:cs.display,width:0}]};
  }
  const runs=[];let all='';
  const styleMemo=new WeakMap();
  const append=(node,type)=>{
   const target=(type==='math'||type==='note'||type==='code')?node:node.parentElement;
   let style=styleMemo.get(target);
   if(!style){style=win.getComputedStyle(target);styleMemo.set(target,style);}
   const font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
   const content=type==='math'?ATOM:type==='note'?NOTE_ATOM:type==='code'?CODE_ATOM:node.nodeValue;
   if(!content)return;
   const start=all.length;all+=content;
   runs.push({node,type,start,end:all.length,font,fontSize:parseFloat(style.fontSize)||20,
    letterSpacing:parseFloat(style.letterSpacing)||0,wordSpacing:parseFloat(style.wordSpacing)||0,
    kerning:style.fontKerning||'auto',display:style.display,width:(type==='math'||type==='note'||type==='code')?node.getBoundingClientRect().width:0});
  };
  const visit=(element)=>{
   for(const child of element.childNodes){
    if(child.nodeType===3)append(child,'text');
    else if(child.nodeType===1){
     if(child.localName==='math')append(child,'math');
     else if(child.localName==='a'&&child.hasAttribute('data-folio-note-ref'))append(child,'note');
     else if(['code','kbd','samp'].includes(child.localName))append(child,'code');
     else visit(child);
    }
   }
  };
  visit(p);
  return {text:all,runs};
 }
 function makeMeasurer(doc,runs){
  let metricsCache=metricsCacheByDoc.get(doc);
  if(!metricsCache){metricsCache=new Map();metricsCacheByDoc.set(doc,metricsCache);}
  let inkMetricsCache=inkMetricsCacheByDoc.get(doc);
  if(!inkMetricsCache){inkMetricsCache=new Map();inkMetricsCacheByDoc.set(doc,inkMetricsCache);}
  let ctx=measureContexts.get(doc);
  if(!ctx){
   // OffscreenCanvas does not insert even a detached element into the DOM.
   if(typeof OffscreenCanvas!=='undefined')try{ctx=new OffscreenCanvas(1,1).getContext('2d')}catch{}
   if(!ctx)ctx=doc.createElement('canvas').getContext('2d');
   if(ctx)measureContexts.set(doc,ctx);
  }
  if(!ctx)return null;
  let lastFont='',lastKerning='';
  // When measurement resumes after an idle yield, another paragraph may
  // have used this document's Canvas context. Force font/kerning rebind on
  // each slice, even if this measurer remembers the previous run's font.
  const reset=()=>{lastFont='';lastKerning='';};
  const measure=(t,run)=>{
   const key=`${run.font}|${run.kerning}|${run.letterSpacing}|${run.wordSpacing}|${t}`;
   const cached=metricsCache.get(key);if(cached!==undefined)return cached;
   if(lastFont!==run.font){ctx.font=run.font;lastFont=run.font;}
   if(lastKerning!==run.kerning){try{ctx.fontKerning=run.kerning}catch{}lastKerning=run.kerning;}
   const result=Math.max(0,ctx.measureText(t).width + (run.letterSpacing?run.letterSpacing*Math.max(0,glyphLength(t)-1):0)
    +(run.wordSpacing && t.includes(' ')?run.wordSpacing*(t.match(/ /g)||[]).length:0));
   if(metricsCache.size>20000){let count=0;for(const k of metricsCache.keys()){metricsCache.delete(k);if(++count>=4500)break;}}
   metricsCache.set(key,result);return result;
  };
  let cursor=0;
  const get=(start,end,collapsedSpace=false)=>{
   while(cursor<runs.length-1 && runs[cursor].end<=start)cursor++;
   if(collapsedSpace)return measure(' ',runs[cursor]);
   let at=start,idx=cursor,width=0;
   while(at<end&&idx<runs.length){
    const r=runs[idx],until=Math.min(end,r.end);
    if(until>at)width+=(r.type==='math'||r.type==='note'||r.type==='code') ? r.width : measure(r.node.nodeValue.slice(Math.max(0,at-r.start),until-r.start),r);
    at=until;idx++;
   }
   return width;
  };
  get.reset=reset;
  get.ink=(offset,letter)=>{
   let lo=0,hi=runs.length;
   while(lo<hi){const mid=(lo+hi)>>1;if(runs[mid].end<=offset)lo=mid+1;else hi=mid;}
   const run=runs[Math.min(lo,runs.length-1)];
   if(run?.type!=='text')return null;
   const inkKey=run.font+'|'+run.kerning+'|'+run.letterSpacing+'|'+letter;
   if(inkMetricsCache.has(inkKey))return inkMetricsCache.get(inkKey);
   if(lastFont!==run.font){ctx.font=run.font;lastFont=run.font;}
   if(lastKerning!==run.kerning){try{ctx.fontKerning=run.kerning}catch{}lastKerning=run.kerning;}
   const m=ctx.measureText(letter);
   if(!Number.isFinite(m.actualBoundingBoxRight)||!Number.isFinite(m.actualBoundingBoxLeft))return null;
   // Canvas TextMetrics.actualBoundingBoxLeft is a *signed distance* from
   // the alignment point to the ink's left edge, not the glyph's leading
   // whitespace. A negative value (common for “ and 《) means the ink begins
   // to the RIGHT of the origin. Previously treating positive values as the
   // leading bearing silently disabled correct opening-quote alignment.
   // Reuse the width already returned by this Canvas call; punctuation is
   // a single grapheme, so letter/word spacing does not change its advance.
   const advance=m.width;
   const ink={advance,
    left:Math.max(0,Math.min(advance,-m.actualBoundingBoxLeft)),
    right:Math.max(0,Math.min(advance,advance-m.actualBoundingBoxRight)),
    fontSize:run.fontSize||20};
   if(inkMetricsCache.size>4096)inkMetricsCache.clear();
   inkMetricsCache.set(inkKey,ink);
   return ink;
  };
  get.glyph=(offset,letter)=>{
   // Thousands of hyphenation and punctuation measurements may occur in
   // heavily marked-up books. Resolve the styled run in O(log n), with no
   // repeated linear scan of all emphasized/linked fragments.
   let lo=0,hi=runs.length;
   while(lo<hi){const mid=(lo+hi)>>1;if(runs[mid].end<=offset)lo=mid+1;else hi=mid;}
   return measure(letter,runs[Math.min(lo,runs.length-1)]);
  };
  return get;
 }
 function populateWidths(tokens,text,runs,doc,autoSpace=false,language='',startToken=0,endToken=tokens.length,session=null){
  const measure=session?.measure||makeMeasurer(doc,runs);if(!measure)return false;
  // The same OffscreenCanvas may be used by another paragraph between idle
  // batches. Rebind its font on the first cache miss of each resumed batch.
  if(session)measure.reset();
  const fontSize=runs[0]?.fontSize||20;
  const traditionalChinese=session?session.traditionalChinese:
   /^zh[-_]?(?:Hant|TW|HK|MO)(?:[-_]|$)/i.test(language);
  const chinesePunctuation=session?session.chinesePunctuation:
   !/^(?:ja|ko)(?:[-_]|$)/i.test(language) &&
   (/^zh(?:[-_]|$)/i.test(language)||/\p{Script=Han}/u.test(text));
  let activeFontRun=0;
  // Each token's Canvas/ink geometry depends only on its run and immediate
  // neighbour, so measuring [startToken,endToken) is identical to the full
  // pass. This lets idle refinement yield *before* the DP stage as well.
  for(let i=startToken;i<Math.min(endToken,tokens.length);i++){
   const t=tokens[i];
   while(activeFontRun<runs.length-1 && runs[activeFontRun].end<=t.start)activeFontRun++;
   // A source sequence of spaces/tabs/newlines is one rendered space in
   // white-space:normal, not the sum of its original character advances.
   t.width=measure(t.start,t.end,t.kind==='space' && /^[ \t\n\r\f]+$/u.test(t.text));
   if(t.hyphenBreak){t.hyphenWidth=measure.glyph(t.end-1,'‐');}
   // Only source text may protrude. Inline math/code/noterefs are opaque boxes.
   // A chosen line-ending punctuation is wrapped *once* at rendering time;
   // Canvas supplies the width discount already here, without DOM reads.
   const edge=last(t.text),fraction=OPTICAL_END.get(edge)||0;
   if(fraction && !t.hyphenBreak && !(traditionalChinese && isZhPunctuation(edge)) && (t.kind==='western'||t.kind==='cjk')){
    // Optical alignment removes only provable *empty* trailing advance,
    // never the ink itself. Halfwidth ASCII punctuation retains the earlier
    // tiny trim. A fullwidth Chinese stop/comma typically contains ~0.5em
    // of blank right bearing; allowing a bounded fraction of that space
    // brings the visible mark substantially closer to the column edge.
    // Reserve at least 0.09em of whitespace to absorb Canvas/DOM variation.
    const ink=chinesePunctuation && isZhPunctuation(edge)?measure.ink(t.end-edge.length,edge):null;
    const localEm=ink?.fontSize||fontSize;
    const outerLimit=ink ? localEm*(PUNCT_STOP.has(edge)?.36:.27) : fontSize*.055;
    const emptyBearing=ink?Math.max(0,ink.right-localEm*.09):outerLimit;
    t.opticalEnd=Math.max(0,Math.min(outerLimit,emptyBearing,
     (ink?.advance||measure.glyph(t.end-edge.length,edge))*fraction));
    t.opticalChar=edge;
    // Move the margin *past* otherwise unused glyph bearings so the final
    // Han character can approach the common text edge. Only a small, capped
    // part of actual punctuation ink may project outside the measure. Closing
    // brackets/quotes get much less allowance than commas and periods.
    // Do not scale/reposition glyphs or apply this to Western punctuation.
    // Keep the actual trailing ink bearing for optical edge alignment.
    // A fullwidth comma's ink can stop 10-15px short of its advance edge;
    // layout-margin trimming alone cannot make its visible ink align.
    t.opticalInkRight=ink&&!traditionalChinese?ink.right:0;
    const inkHang=ink&&!traditionalChinese?HANG_END_INK.get(edge)||0:0;
    const maxTotal=inkHang>0?Math.min(ink.advance*.92,
      ink.right+localEm*inkHang,localEm*.91):t.opticalEnd;
    t.opticalExtra=Math.max(0,maxTotal-t.opticalEnd);
   }else {t.opticalEnd=0;t.opticalExtra=0;t.opticalInkRight=0;}

   if(t.kind==='space'){
    t.stretch=Math.max(1,t.width*.65);
    t.shrink=Math.max(.4,t.width*.32);
   }
   // Opening marks may have leading side bearings. Trim those from a line
   // start only; the same source mark retains its normal advance internally.
   const opening=first(t.text);
   if(chinesePunctuation && t.kind==='cjk' && t.text===opening && PUNCT_OPEN.has(opening)){
    const ink=measure.ink(t.start,opening);
    // Trim leading empty side-bearing, allowing only a tiny optically useful
    // projection of actual ink. The paragraph's first-line indent is kept;
    // on continuation lines the projection is limited to a few CSS pixels.
    // Traditional Chinese horizontal glyphs retain a conservative ink limit.
    const protrusion=(HANG_START_INK.get(opening)||0)*(traditionalChinese?.45:1);
    t.punctStart=ink?Math.max(0,Math.min(ink.advance*.68,
      ink.left+ink.fontSize*protrusion,ink.fontSize*.62)):0;
   }
   const next=tokens[i+1];if(!next)continue;
   if(chinesePunctuation && t.kind==='cjk' && next.kind==='cjk' &&
      t.text===edge && next.text===first(next.text) && t.end===next.start){
    const punctPair=isZhPunctuation(edge)&&isZhPunctuation(next.text);
    const hanToOpen=isIdeographToken(t)&&PUNCT_OPEN.has(next.text);
    const closeToHan=PUNCT_CLOSE.has(edge)&&isIdeographToken(next);
    if(punctPair||hanToOpen||closeToHan){
     const a=measure.ink(t.start,edge),b=measure.ink(next.start,next.text);
     if(a&&b){
      const localEm=Math.min(a.fontSize,b.fontSize);
      if(punctPair){
       // Two punctuation marks: move unused ink-side bearings together,
       // within a category-sensitive cap. Neither glyph is distorted.
       const safe=a.right+b.left-localEm*punctuationClearance(edge,next.text);
       t.punctKern=Math.max(0,Math.min(localEm*punctuationPairCap(edge,next.text),safe));
       // An opening quote after ，/。/、 should never retain its full
       // double side-bearing merely because the line has room to spare.
       // Keep the rest of the compression elastic and font-sensitive.
       if(PUNCT_STOP.has(edge)&&PUNCT_OPEN.has(next.text))
        t.punctBase=Math.min(t.punctKern,localEm*STOP_OPEN_BASE);
       t.punctAim=Math.max(0,t.punctKern-(t.punctBase||0))*punctuationPreference(edge,next.text);
      }else{
       // Han《book》Han: very lightly shorten the outer *empty* bracket
       // side-bearing, not the mark's inner side beside its quoted content.
       // These boundaries are optional and cheaper than changing Han spacing.
       const emptySide=hanToOpen?b.left:a.right;
       const hanSide=hanToOpen?a.right:b.left;
       const safe=emptySide+hanSide-localEm*BRACKET_TEXT_CLEARANCE;
       t.edgeKern=Math.max(0,Math.min(localEm*BRACKET_TEXT_CAP,safe));
      }
     }
    }
   }
   // CSS Text 4 text-autospace:normal inserts 1/8-em inter-script spacing
   // between Han and adjacent Latin/digit runs. This is visible in Chromium
   // Range geometry but absent from Canvas per-token advances. The older
   // 1/4-em estimate systematically over-counted mixed-script line widths.
   if(autoSpace && t.kind!=='space' && next.kind!=='space' &&
      ((HAN.test(last(t.text)) && /^[A-Za-z0-9]/u.test(first(next.text))) ||
       (/^[A-Za-z0-9]$/u.test(last(t.text)) && HAN.test(first(next.text))))){
    t.afterAuto=(runs[activeFontRun]?.fontSize||fontSize)*.125;
   }
   const opp=breakAfter(t,next);
   if(opp?.kind==='ideographic' && isIdeographToken(t) && isIdeographToken(next)){
    // Full-width CJK glyphs have no natural inter-ideograph glue. Only add
    // bounded *positive* spacing between true ideographs. Never distribute
    // the extra gap before punctuation or across Latin characters.
    t.afterStretch=fontSize*.145;
    t.afterShrink=fontSize*.025;
   }
  }
  return true;
 }
 // The initial Canvas measurement of a long paragraph used to run as one
 // uninterrupted task even after v95.21 made its DP phase cooperative.
 // Measure at most a small contiguous token batch before checking time. The
 // same populateWidths() function is used by both the normal and the sliced
 // paths; punctuation optical geometry and original source stay identical.
 function advanceMeasurement(task,budgetMs=6){
  // Build the measuring closure once per paragraph rather than once for each
  // 32-token idle batch. The closure keeps run boundaries and per-document
  // glyph maps; all source-dependent geometry remains exactly measured.
  if(!task.session){
   const measure=makeMeasurer(task.doc,task.runs);
   if(!measure)return {finished:true,failed:true};
   task.session={measure,
    traditionalChinese:/^zh[-_]?(?:Hant|TW|HK|MO)(?:[-_]|$)/i.test(task.language),
    chinesePunctuation:!/^(?:ja|ko)(?:[-_]|$)/i.test(task.language) &&
      (/^zh(?:[-_]|$)/i.test(task.language)||/\p{Script=Han}/u.test(task.text))};
  }
  const clock=typeof performance!=='undefined'&&performance.now?()=>performance.now():()=>Date.now();
  const deadline=clock()+Math.max(.5,Number(budgetMs)||6);
  const {tokens,text,runs,doc,autoSpace,language}=task;
  let blocks=0;
  while(task.cursor<tokens.length){
   const end=Math.min(tokens.length,task.cursor+32);
   if(!populateWidths(tokens,text,runs,doc,autoSpace,language,task.cursor,end,task.session))
    return {finished:true,failed:true};
   task.cursor=end;blocks++;
   // Do not schedule a redundant idle turn after the final batch.
   if(task.cursor>=tokens.length)break;
   // The token loop is deterministic. Complete a full 32-token batch before
   // yielding; never return without making progress even on a busy main thread.
   if(clock()>=deadline){task.slices++;return {finished:false,measured:task.cursor};}
  }
  task.slices++;
  return {finished:true,measured:task.cursor};
 }
 // Range.cloneContents() drops an inline ancestor when a line begins and
 // ends in one of its text nodes. That silently changes Latin words from the
 // English font to the Chinese fallback! Clone the exact *ancestor chain*
 // for each text run instead, joining adjacent runs with common ancestors.
 function cloneInlineRange(doc,p,runs,start,end,gaps=[]){
  const fragment=doc.createDocumentFragment();
  let originalStack=[],copyStack=[],gapIndex=0;
  const appendGap=(pos)=>{
   if(pos<=start||pos>=end)return;
   const gap=gaps[gapIndex];if(!gap||gap.pos!==pos)return;
   // Native inline box: geometry is exact, no visible or textual Unicode
   // space is introduced. Selection, textContent and dict lookup survive.
   const spacer=doc.createElement('span');
   spacer.className=gap.kind==='punct'?'folio-kp-punct-kern':gap.kind==='edge'?'folio-kp-punct-kern folio-kp-bracket-edge':'folio-kp-ideograph-glue';
   spacer.setAttribute('aria-hidden','true');
   spacer.style.width=Math.max(0,gap.width).toFixed(4)+'px';
   if(gap.width<0)spacer.style.marginInlineStart=gap.width.toFixed(4)+'px';
   (copyStack.at(-1)||fragment).appendChild(spacer);
   gapIndex++;
  };
  // Find the first intersecting original styled run in O(log n), rather than
  // rescanning all earlier runs for every output line.
  let lo=0,hi=runs.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(runs[mid].end<=start)lo=mid+1;else hi=mid;}
  for(let runIndex=lo;runIndex<runs.length;runIndex++){
   const run=runs[runIndex];
   if(run.start>=end)break;
   const from=Math.max(start,run.start)-run.start;
   const to=Math.min(end,run.end)-run.start;
   if(to<=from)continue;
   let parents=[],el=run.node.parentElement;
   while(el && el!==p){parents.push(el);el=el.parentElement;}
   if(el!==p)return null;
   parents.reverse();
   let same=0;
   while(same<parents.length&&same<originalStack.length&&parents[same]===originalStack[same])same++;
   originalStack.length=same;copyStack.length=same;
   for(let i=same;i<parents.length;i++){
    const cloned=parents[i].cloneNode(false);
    (i?copyStack[i-1]:fragment).appendChild(cloned);
    originalStack.push(parents[i]);copyStack.push(cloned);
   }
   const target=copyStack.at(-1)||fragment;
   if(run.type==='math'||run.type==='note'||run.type==='code'){
    target.appendChild(run.node.cloneNode(true));
    continue;
   }
   const source=run.node.nodeValue;
   let at=from;
   while(gapIndex<gaps.length && gaps[gapIndex].pos<=run.start+to){
    const local=gaps[gapIndex].pos-run.start;
    if(local<at){gapIndex++;continue;}
    // Dense Chinese text can have many sequential ideographic glue nodes.
    // Represent a stretch of them with ONE tracked inline span. The negative
    // terminal margin cancels letter-spacing after its final glyph, leaving
    // precisely the same N-1 adjustable gaps with far fewer DOM children.
    // Confine this to BMP ideographs in a single original text node: nested
    // emphasis, supplementary graphemes and punctuation keep atomic spans.
    let count=0;
    const width=gaps[gapIndex].width;
    if(gaps[gapIndex].kind!=='punct' && local>at && local<to && local>=1 &&
       IDEOGRAPH.test(source[local-1]) && IDEOGRAPH.test(source[local])){
     let boundary=local, idx=gapIndex;
     while(idx<gaps.length && boundary<to &&
       gaps[idx].pos===run.start+boundary &&
       Math.abs(gaps[idx].width-width)<.002 &&
       IDEOGRAPH.test(source[boundary-1]) && IDEOGRAPH.test(source[boundary])){
      count++;boundary++;idx++;
     }
     if(count>=3 && Math.abs(run.letterSpacing||0)<.001){
      const begin=local-1;
      if(begin>at)target.appendChild(doc.createTextNode(source.slice(at,begin)));
      const cluster=doc.createElement('span');cluster.className='folio-kp-cjk-track';
      // A tracked inline span with N ideographs paints an unwanted EXTRA
      // letter-spacing after glyph N. Chromium includes that invisible final
      // advance in scrollWidth even if margin-inline-end cancels line layout.
      // Track only the first N-1 glyphs, letting their *last* spacing form
      // the genuine gap before an ordinary final glyph. Same visual positions
      // and N-1 elastic spaces, but no phantom terminal overflow or repair.
      cluster.style.letterSpacing=width.toFixed(4)+'px';
      cluster.textContent=source.slice(begin,boundary-1);
      target.appendChild(cluster);
      target.appendChild(doc.createTextNode(source.slice(boundary-1,boundary)));
      at=boundary;gapIndex+=count;continue;
     }
    }
    if(local>at)target.appendChild(doc.createTextNode(source.slice(at,local)));
    appendGap(gaps[gapIndex].pos);
    at=local;
   }
   if(to>at)target.appendChild(doc.createTextNode(source.slice(at,to)));
  }
  return fragment;
 }
 function anchorInfo(anchor,p){
  if(!anchor?.node || !p.contains(anchor.node))return null;
  try{
   const r=p.ownerDocument.createRange();r.selectNodeContents(p);
   r.setEnd(anchor.node,anchor.kind==='element'?0:Math.min(anchor.offset||0,anchor.node.length||0));
   return {paragraph:p,offset:r.toString().length,kind:anchor.kind};
  }catch{return null;}
 }
 function restoreAnchor(remembered){
  if(!remembered?.paragraph?.isConnected)return null;
  const p=remembered.paragraph;
  const walk=p.ownerDocument.createTreeWalker(p,NodeFilter.SHOW_TEXT);
  let remaining=remembered.offset,tail=null;
  while(walk.nextNode()){
   const n=walk.currentNode;
   if(n.length>remaining)return {doc:p.ownerDocument,node:n,offset:remaining};
   remaining-=n.length;tail=n;
  }
  // A caret exactly after the paragraph's last grapheme is a valid DOM
  // position. Returning length-1 quietly moves reading/search anchors one
  // UTF-16 unit backward (or into a surrogate pair) after a quality toggle.
  return tail?{doc:p.ownerDocument,node:tail,offset:tail.length}:null;
 }
 function restore(doc,anchor){
  const state=cacheByDoc.get(doc);
  if(!state||!state.entries.size)return anchor;
  let memory=null;
  for(const [p,record] of state.entries){
   if(anchor?.node && p.contains(anchor.node))memory=anchorInfo(anchor,p);
   p.replaceChildren(...record.original.childNodes);
   p.removeAttribute('data-folio-kp');
   p.style.removeProperty('--folio-kp-indent');
  }
  state.entries.clear();state.deferredPending=[];state.refinement=null;state.key='';state.invalid=true;
  return memory?restoreAnchor(memory)||anchor:anchor;
 }
 function prepareMeasuredParagraph(p,doc,preparationKey,autoSpace,sourceRoot=null,cooperative=null){
  const old=measuredParagraphCache.get(p);
  // The original text nodes are reattached by restore(). A missing first
  // original node means an external EPUB mutation invalidated this entry.
  // On width-only reflow original source nodes remain in a detached element.
  const sourceStable=!!sourceRoot && old?.runs?.length && sourceRoot.contains(old.runs[0].node);
  if(old && old.key===preparationKey && old.autoSpace===autoSpace &&
      (sourceStable || (old.sourceText===p.textContent &&
       (!old.runs.length || p.contains(old.runs[0].node))))){
   return {...old,cached:true};
  }
  const awaiting=cooperative?.pending?.kind==='measurement'?
   cooperative.pending.task:null;
  // The page-layout key is checked by the idle coordinator before continuing.
  // Also check paragraph identity and preparation key here so a stale
  // continuation cannot be resumed after a different font/run is selected.
  const resumed=awaiting?.paragraph===p && awaiting.preparationKey===preparationKey &&
   awaiting.autoSpace===autoSpace && awaiting.sourceText===p.textContent ? awaiting:null;
  if(resumed){
   const progress=advanceMeasurement(resumed,cooperative.budgetMs);
   if(!progress.finished)return {preparationPending:true,
    continuation:{kind:'measurement',task:resumed}};
   if(progress.failed)return null;
   const geometry={decomposition:nodesFor(resumed.tokens),prefix:summarize(resumed.tokens)};
   const prepared={key:preparationKey,autoSpace,text:resumed.text,runs:resumed.runs,
    tokens:resumed.tokens,geometry,signature:resumed.signature,sourceText:resumed.sourceText};
   measuredParagraphCache.set(p,prepared);
   if(resumed.templateKey){
    const templates=resumed.templates;
    templates.set(resumed.templateKey,{tokens:resumed.tokens,geometry});
   }
   return {...prepared,cached:false,templateReused:false};
  }
  const {text,runs}=getRuns(p,doc.defaultView);
  if(!runs.length || !text.trim())return null;
  const language=(p.closest('[lang]')?.getAttribute('lang')||
   doc.documentElement.getAttribute('lang')||doc.documentElement.getAttribute('xml:lang')||'').trim();
  const englishPatterns=!language || /^(en|zh|ja|ko)(?:[-_]|$)/i.test(language);
  const hyphenator=englishPatterns && typeof window!=='undefined'?window.FolioHyphenation:null;
  // Every measured width depends on the exact styled-run sequence, its
  // kerning, and atomic MathML/code/noteref dimensions. Key *all* of them.
  // A chapter-specific document cache is essential because EPUBs may embed
  // unrelated fonts with the same CSS family string.
  const signature=language+'|'+runs.map(r=>r.start+','+r.end+','+r.font+','+
   r.letterSpacing+','+r.wordSpacing+','+r.kerning+','+
   (r.type!=='text'?r.type+':'+r.width:'')).join(';');
  let templates=measuredTemplatesByDoc.get(doc);
  if(!templates){templates=new BoundedReusableCache(MAX_MEASURED_TEMPLATES,
   MAX_TEMPLATE_CACHE_BYTES,(k,v)=>2*k.length+280*(v.tokens?.length||0)+256);
   measuredTemplatesByDoc.set(doc,templates);}
  const templateKey=text.length<=MAX_MEASURED_TEMPLATE_CHARS?
   JSON.stringify([preparationKey,autoSpace,signature,!!hyphenator?.points,text]):null;
  if(templateKey){
   const template=templates.get(templateKey);
   if(template){
    // Refresh insertion order to make the bounded cache genuinely LRU.
    templates.delete(templateKey);templates.set(templateKey,template);
    const prepared={key:preparationKey,autoSpace,text,runs,tokens:template.tokens,
     geometry:template.geometry,signature,sourceText:p.textContent};
    measuredParagraphCache.set(p,prepared);
    return {...prepared,cached:true,templateReused:true};
   }
  }
  const tokens=preparedTokens(text,hyphenator,doc);
  if(tokens.length<3||tokens.length>MAX_TOKENS)return null;
  // A long paragraph should yield even before DP: Canvas text/ink
  // measurements are the other significant uninterruptible workload.
  // Small paragraphs continue through the old immediate path, without
  // adding background scheduling overhead.
  if(cooperative && tokens.length>=160){
   const task={kind:'measurement',paragraph:p,preparationKey,autoSpace,
    doc,text,sourceText:p.textContent,runs,tokens,language,signature,templates,templateKey,
    cursor:0,slices:0};
   const progress=advanceMeasurement(task,cooperative.budgetMs);
   if(!progress.finished)return {preparationPending:true,
    continuation:{kind:'measurement',task}};
   if(progress.failed)return null;
  }else if(!populateWidths(tokens,text,runs,doc,autoSpace,language))return null;
  const geometry={decomposition:nodesFor(tokens),prefix:summarize(tokens)};
  const prepared={key:preparationKey,autoSpace,text,runs,tokens,geometry,signature,sourceText:p.textContent};
  measuredParagraphCache.set(p,prepared);
  if(templateKey){
   templates.set(templateKey,{tokens,geometry});
  }
  return {...prepared,cached:false,templateReused:false};
 }
 function hangLastGlyph(doc,line,ch,amount,paintShift=0){
  // The cloned text may be nested in <em>, <span> or a footnote-free link.
  // Descend into the final text node without touching original source nodes.
  const walker=doc.createTreeWalker(line,4); // NodeFilter.SHOW_TEXT
  let node,tail=null,at=-1;
  while((node=walker.nextNode())){
   // The source can include line-breaking spaces after punctuation. They
   // collapse visually but must remain in the original text and in links.
   const match=/\S(?=\s*$)/u.exec(node.nodeValue||'');
   if(match){tail=node;at=match.index;}
  }
  if(!tail || tail.nodeValue.slice(at,at+ch.length)!==ch)return false;
  // Split *after* the punctuation first to leave trailing whitespace intact.
  if(at+ch.length<tail.nodeValue.length)tail.splitText(at+ch.length);
  const glyph=at>0?tail.splitText(at):tail;
  const wrapper=doc.createElement('span');
  wrapper.className='folio-kp-optical-end';
  wrapper.style.setProperty('margin-inline-end',(-amount).toFixed(4)+'px','important');
  // Inline transforms are ignored by CSS; position:relative translates the
  // punctuation's *ink* without changing its measured advance or text order.
  if(paintShift>.01){
   wrapper.style.setProperty('position','relative','important');
   wrapper.style.setProperty('inset-inline-start',paintShift.toFixed(4)+'px','important');
  }
  // Keep the original glyph's painted position. In v94.9, an additional
  // left paint-offset crowded the pause mark into the preceding Han text.
  // Its measured line-end bearing already provides a clean optical margin;
  // a restrained (~0.08 em) ink projection is sufficient without paint nudges.
  glyph.replaceWith(wrapper);wrapper.appendChild(glyph);
  return true;
 }
 function trimFirstGlyph(doc,line,ch,amount){
  if(!amount)return true;
  const walker=doc.createTreeWalker(line,4);
  let node;
  while((node=walker.nextNode())){
   const src=node.nodeValue||'';
   const offset=src.search(/\S/u);
   if(offset<0)continue;
   if(src.slice(offset,offset+ch.length)!==ch)return false;
   if(offset>0)node=node.splitText(offset);
   if(ch.length<node.nodeValue.length)node.splitText(ch.length);
   const marked=node;
   const wrapper=doc.createElement('span');wrapper.className='folio-kp-punct-start';
   wrapper.style.setProperty('margin-inline-start',(-amount).toFixed(4)+'px','important');
   marked.replaceWith(wrapper);wrapper.appendChild(marked);
   return true;
  }
  return false;
 }
 function fitParagraph(p,available,doc,preparationKey,previous=null,cooperative=null){
  const win=doc.defaultView,style=eligibilityCache.get(p)?.measure;
  // The reader spread and a publisher's inner text container do NOT always
  // scale together. SICP, for instance, retains a ~626px inner text box when
  // the spread grows from 848px to 860px. Reusing (spread - text) as a fixed
  // offset makes a resized line 12px too long and clips it. The reader already
  // flushed geometry before calling typeset(): batch clientWidth reads for
  // candidate blocks *before* any writes, never in the dynamic program.
  // clientWidth is the inline content+padding width, independent of a
  // multi-column element's potentially fragmented bounding rectangle.
  const physicalWidth=p.clientWidth || parseFloat(win.getComputedStyle(p).width)||available;
  const width=style?Math.min(available,physicalWidth)-style.padding:Math.min(available,physicalWidth);
  if(!Number.isFinite(width)||width<170)return null;
  const indent=style?.indent||0;
  const optimizeWidth=width-(HAN.test(previous?.sourceText||p.textContent)?.35:1.7);
  // DOM-last optical tolerance. A previously validated line still fits if
  // its available measure grows by at most 0.35% (capped at 2px). Keep the same
  // precise justification rather than mutate dozens of line spans simply
  // to distribute a visually imperceptible fractional-pixel surplus.
  // Never do this on a shrink, after a font/style change, or after a failed
  // validation. Retain the ORIGINAL checked width across repeated resizes:
  // small increments must never accumulate into a large unjustified gap.
  if(previous?.validatedSafe && previous.prepKey===preparationKey &&
     Number.isFinite(previous.fitWidth) &&
     optimizeWidth>=previous.fitWidth-0.03 &&
     optimizeWidth-previous.fitWidth<=Math.min(2.05,previous.fitWidth*.0035) &&
     previous.optimizedLines?.length>=2 && previous.layoutSignature &&
     !previous.optimizedLines.some(l=>l.punctCapacity>.02)){
    return {reuse:true,cachedPreparation:true,retainedOpticalFit:true,
     layoutSignature:previous.layoutSignature,lines:previous.lines,chars:previous.chars,
     optimizedLines:previous.optimizedLines,breakpoints:previous.breakpoints,
     fastSafe:previous.fastSafe};
  }
  // An EPUB page often revisits an exact earlier column width (settings
  // panel, window snapping, switching 1/2/3 columns). Reuse its *validated*
  // rendered layout, including nested HTML/MathML/footnote nodes, rather than
  // rerunning Knuth-Plass and cloning every styled text run.
  const saved=previous?.prepKey===preparationKey?
   previous.layoutCache?.get(optimizeWidth.toFixed(2)):null;
  if(saved && saved.fragments?.length && saved.prepKey===preparationKey){
   // Consume the detached, previously checked DOM nodes. They can be
   // snapshotted again on the next departure; never keep a live rendering
   // simultaneously in the cache, where later spacing retargeting could
   // mutate its stored styles.
   previous.layoutCache.delete(optimizeWidth.toFixed(2));
   return {...saved.data,fragments:saved.fragments,
    baselineFragments:null,cachedPreparation:true,restoredLayout:true,
    fitWidth:optimizeWidth,validatedSafe:true,validatedWidth:optimizeWidth};
  }
  const prepared=prepareMeasuredParagraph(p,doc,preparationKey,style?.autoSpace||false,previous?.original||null,cooperative);
  if(prepared?.preparationPending)return {optimizationPending:true,
   continuation:prepared.continuation,measurementPending:true};
  if(!prepared)return null;
  const {text,runs,tokens:measuredTokens,geometry}=prepared;
  const inlineMath=runs.filter(r=>r.type==='math'||r.type==='code');
  if(inlineMath.some(r=>!Number.isFinite(r.width)||r.width<1||r.width>width*.88||r.display?.includes('block')))return null;
  const runSignature=prepared.signature;
  const alignment='justify'; // Opt-in quality mode requests fully justified prose.
  const planKey=width.toFixed(2)+'|'+indent.toFixed(2)+'|'+alignment+'|'+(style?.autoSpace?'normal':'none')+'|'+runSignature+'|'+text;
  let planCache=planCachesByDoc.get(doc);
  if(!planCache){planCache=new BoundedPlanCache();planCachesByDoc.set(doc,planCache);}
  const solverOptions={align:alignment,fontSize:runs[0]?.fontSize||20,
   allowTracking:!inlineMath.length,geometry};
  let stabilized=false;
  let choice=null;
  // Stable single-pixel reflow is solved algebraically from existing line
  // boundaries; never incur a full DP or DOM rebuilding if spacing still fits.
  if(previous?.optimizedLines && previous.prepKey===preparationKey){
   const stable=refitExistingBreaks(measuredTokens,previous,optimizeWidth,indent,solverOptions);
   if(stable){choice={best:stable,baseline:null};stabilized=true;}
  }
  if(!choice){
   choice=planCache.get(planKey);
   if(choice===undefined){
    const tokens=measuredTokens;
    if(tokens.some(t=>t.kind!=='space'&&t.width>width*.94)){return null;}
    let plan;
    if(cooperative){
     const previousTask=cooperative.pending?.key===planKey?cooperative.pending.task:null;
     const task=previousTask||beginOptimization(tokens,optimizeWidth,indent,solverOptions);
     const response=advanceOptimization(task,cooperative.budgetMs??6);
     if(!response.finished)return {optimizationPending:true,
      continuation:{kind:'solver',key:planKey,task},chars:text.length};
     plan=response.plan;
    }else plan=optimize(tokens,optimizeWidth,indent,{...solverOptions});
    choice={best:plan,baseline:null};
    // BoundedPlanCache uses size-aware true LRU eviction. A big paragraph
    // cannot displace the entire chapter's useful short plans.
    // Never poison the cache with a timeout. An idle continuation is allowed
    // to revisit the same paragraph, even if its initial pass ran out of time.
    if(plan || cooperative)planCache.set(planKey,choice);
   }
  }
  // The prefix sum was already built for the DP. Reuse it here instead
  // of allocating a fresh token slice and filter for every candidate line.
  const gapPrefix=geometry.prefix.cjkGaps;
  const lineGlueCount=line=>gapPrefix[Math.max(line.from,line.to-1)]-gapPrefix[line.from];
  const overfull=plan=>plan?.lines.some(line=>line.width+(line.spaceCount||0)*(line.wordSpacing||0)+(line.glyphCount||0)*(line.tracking||0)+
   lineGlueCount(line)*(line.cjkSpacing||0)>line.goal+.8);
  if(!choice?.best||overfull(choice.best)){return null;}
  // An optimized paragraph must never contain mid-paragraph ragged lines.
  // If its natural glue cannot be fitted attractively, Chromium's native
  // justified layout is preferable to isolated words and large rivers.
  const poorLine=choice.best.lines.slice(0,-1).some(line=>
   !line.justify ||
   (line.spaceCount>0 && (line.wordSpacing>Math.max(6.5,(line.naturalSpace||4)*2.0) ||
     line.wordSpacing< -Math.max(1.4,(line.naturalSpace||4)*.27))) ||
   (Math.abs(line.cjkSpacing)>Math.max(5.5,(runs[0]?.fontSize||20)*.28) ||
    line.cjkSpacing<-(runs[0]?.fontSize||20)*.026));
  if(poorLine)return null;
  // Treat a paragraph's line layout as immutable data. Do not reconstruct
  // existing line DOM when this fingerprint is unchanged. This is the crucial
  // DOM-last optimization; resizing may leave most paragraphs untouched.
  const lineSignatures=choice.best.lines.map(l=>[
   l.start,l.end,l.hyphenate?1:0,l.justify?1:0,
   l.wordSpacing.toFixed(3),l.cjkSpacing.toFixed(3),l.tracking.toFixed(4),Number(l.opticalEnd||0).toFixed(3),Number(l.paintShift||0).toFixed(3),Number(l.punctStart||0).toFixed(3),Number(l.punctRatio||0).toFixed(3),Number(l.bracketRatio||0).toFixed(3)
  ].join(':'));
  const layoutSignature=lineSignatures.join('|');
  const lineLayout=choice.best.lines.map(l=>({start:l.start,end:l.end,
   hyphenate:l.hyphenate,justify:l.justify,justifyMode:l.justifyMode,
   wordSpacing:l.wordSpacing,cjkSpacing:l.cjkSpacing,tracking:l.tracking,opticalEnd:l.opticalEnd||0,paintShift:l.paintShift||0,opticalChar:l.opticalChar||'',punctStart:l.punctStart||0,punctStartChar:l.punctStartChar||'',punctRatio:l.punctRatio||0,punctCompression:l.punctCompression||0,bracketRatio:l.bracketRatio||0,bracketCompression:l.bracketCompression||0}));
  if(previous && previous.layoutSignature===layoutSignature){
   return {reuse:true,cachedPreparation:prepared.cached,layoutSignature,lineSignatures,lineLayout,
    optimizedLines:choice.best.lines,fitWidth:optimizeWidth,
    planOriginWidth:stabilized?(previous.planOriginWidth??previous.fitWidth):optimizeWidth,
    keptBreakPlan:stabilized,breakpoints:choice.best.breakpoints,
    lines:previous.lines,chars:previous.chars,fastSafe:previous.fastSafe};
  }
  // If every break stays in the same place, geometry alone can change. Avoid
  // cloning and replacing line contents; retarget only CSS spacing properties.
  // Keep the old renderer when a CJK glue run appears or disappears.
  if(previous?.lineLayout?.length===lineLayout.length && lineLayout.every((l,i)=>{
   const old=previous.lineLayout[i];
   return old.start===l.start && old.end===l.end && old.hyphenate===l.hyphenate &&
    old.justify===l.justify && old.justifyMode===l.justifyMode &&
    Math.abs((old.opticalEnd||0)-(l.opticalEnd||0))<.002 &&
    Math.abs((old.paintShift||0)-(l.paintShift||0))<.002 &&
    Math.abs((old.punctStart||0)-(l.punctStart||0))<.002 &&
    Math.abs((old.punctRatio||0)-(l.punctRatio||0))<.002 &&
    Math.abs((old.bracketRatio||0)-(l.bracketRatio||0))<.002 &&
    (Math.abs(old.cjkSpacing)>.035)===(Math.abs(l.cjkSpacing)>.035) &&
    Math.sign(old.cjkSpacing)===Math.sign(l.cjkSpacing);
  })){
   return {retarget:true,cachedPreparation:prepared.cached,layoutSignature,lineSignatures,lineLayout,
    optimizedLines:choice.best.lines,fitWidth:optimizeWidth,
    planOriginWidth:stabilized?(previous.planOriginWidth??previous.fitWidth):optimizeWidth,
    keptBreakPlan:stabilized,breakpoints:choice.best.breakpoints,
    lines:lineLayout.length,chars:text.length,fastSafe:previous.fastSafe};
  }
  function fragmentsFor(plan){
   if(!plan||overfull(plan))return null;
   const fragments=[];
   const spacerBudget=plan.lines.reduce((sum,line)=>sum+(Math.abs(line.cjkSpacing)>.035?
    lineGlueCount(line):0),0);
   if(spacerBudget>MAX_CJK_SPACERS)return null;
   for(let i=0;i<plan.lines.length;i++){
    const line=plan.lines[i];
    // Render measured ideographic glue explicitly, never via the browser's
    // independent text-align:justify algorithm. This is essential for mixed
    // Chinese-English lines: Latin words retain their own natural kerning.
    const gaps=[];
    const tok=plan._tokens;
    for(let k=line.from;k<line.to-1;k++){
     const t=tok[k];
     if(t.end<=line.start || t.end>=line.end)continue;
     const pairedTrim=(t.punctBase||0)+Math.max(0,t.punctKern-(t.punctBase||0))*(line.punctRatio||0);
     if(pairedTrim>.025)
      gaps.push({pos:t.end,width:-pairedTrim,kind:'punct'});
     else if(t.edgeKern*(line.bracketRatio||0)>.025)
      gaps.push({pos:t.end,width:-t.edgeKern*line.bracketRatio,kind:'edge'});
     else if(Math.abs(line.cjkSpacing)>.035 && t.afterStretch>0)
      gaps.push({pos:t.end,width:line.cjkSpacing,kind:'cjk'});
    }
    const content=cloneInlineRange(doc,previous?.original||p,runs,line.start,line.end,gaps);
    if(!content)return null;
    const span=doc.createElement('span');span.className='folio-kp-line';
    span.append(content);
    if(line.punctStart>.02){
     if(!trimFirstGlyph(doc,span,line.punctStartChar,line.punctStart))return null;
     span.classList.add('folio-kp-punct-start-line');
    }
    if(line.opticalEnd>.02){
     // A margin on the *last glyph*, not a negative margin on the whole
     // block: preserves the publisher's nested italic/bold elements and
     // allows real ink to protrude while consuming less layout width.
     const ch=line.opticalChar;
     if(!ch || !hangLastGlyph(doc,span,ch,line.opticalEnd,line.paintShift||0))return null;
     span.classList.add('folio-kp-optical-line');
    }
    if(i===0&&indent>0)span.style.paddingInlineStart=indent+'px';
    if(line.hyphenate)span.classList.add('folio-kp-hyphenated');
    // The plan and renderer must use identical glue: Western word spacing is
    // applied explicitly, rather than asking the browser to choose a different
    // justification strategy after the Knuth–Plass optimization.
    if(line.justify){
     if(Math.abs(line.tracking)>.005){
      span.classList.add('folio-kp-microtrack');
      span.style.setProperty('letter-spacing',line.tracking.toFixed(4)+'px','important');
     }
     if(Math.abs(line.wordSpacing)>.01){
      span.classList.add('folio-kp-space-fit');
      span.style.setProperty('word-spacing',line.wordSpacing.toFixed(4)+'px','important');
     }
     if(Math.abs(line.cjkSpacing)>.035){
      span.classList.add('folio-kp-cjk-fit');
      // Pure Han widths are already reliable; only cross-script lines need
      // an extra browser geometry read to reconcile text-autospace.
      // A bounded index walk avoids another copied token array per line.
      for(let k=line.from;k<line.to;k++)if(plan._tokens[k].kind==='western'){
       span.classList.add('folio-kp-mixed-fit');break;
      }
     }
     if(line.justifyMode==='none')span.classList.add('folio-kp-natural-fit');
    }else span.classList.add('folio-kp-ragged');
    fragments.push(span);
   }
   const exact=fragments.map(el=>el.textContent).join('');
   return exact===prepared.sourceText && exact===p.textContent?fragments:null;
  }
  const fragments=fragmentsFor(choice.best);
  if(!fragments){return null;}
  const baselineFragments=choice.baseline?fragmentsFor(choice.baseline):null;
  return {fragments,baselineFragments,baselineLines:choice.baseline?.lines.length||0,
   cachedPreparation:prepared.cached,layoutSignature,lineSignatures,lineLayout,
   // v95.24: fragmentsFor has already checked the complete byte-exact source.
   // Retain that immutable string until commit; detached DOM textContent scans
   // on EVERY idle slice and AGAIN at commit only duplicate the same work.
   sourceText:prepared.sourceText,
   hasOpticalMarks:choice.best.lines.some(l=>l.opticalEnd>.02||l.punctStart>.02),
   needsPositiveGlueReview:choice.best.lines.some(l=>l.cjkSpacing>.15),
   optimizedLines:choice.best.lines,fitWidth:optimizeWidth,
   planOriginWidth:stabilized?(previous?.planOriginWidth??previous?.fitWidth):optimizeWidth,
   keptBreakPlan:stabilized,
   fastSafe:runs.every(r=>r.type==='text'&&r.font===runs[0].font&&
    r.letterSpacing===0&&r.wordSpacing===0) &&
    (!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text) || !/[a-zA-Z0-9]/u.test(text)) &&
    !choice.best.lines.some(l=>l.spaceCount===0&&l.justify),
   lines:choice.best.lines.length,chars:text.length,breakpoints:choice.best.breakpoints,tolerance:choice.best.tolerance};
 }
 function retargetLineSpacing(p,previous,result){
  const old=previous.lineLayout,newLayout=result.lineLayout;
  let count=0;
  for(let i=0;i<newLayout.length;i++){
   const line=p.children[i],now=newLayout[i],was=old[i];
   if(!line?.classList.contains('folio-kp-line'))return false;
   // Only properties explicitly modeled by the DP change; all source nodes,
   // noteref anchors, MathML and inline styles remain in place.
   if(Math.abs(now.wordSpacing-was.wordSpacing)>.002){
    if(Math.abs(now.wordSpacing)>.01)line.style.setProperty('word-spacing',now.wordSpacing.toFixed(4)+'px','important');
    else line.style.removeProperty('word-spacing');count++;
   }
   if(Math.abs(now.tracking-was.tracking)>.002){
    if(Math.abs(now.tracking)>.005)line.style.setProperty('letter-spacing',now.tracking.toFixed(4)+'px','important');
    else line.style.removeProperty('letter-spacing');count++;
   }
   // Reset previously applied CJK glue when the new optimal adjustment is
   // zero. Old logic only updated nonzero glue, leaving stale spacing on
   // otherwise correctly reused lines after a width change.
   if(Math.abs(now.cjkSpacing-was.cjkSpacing)>.002){
    const gaps=line.querySelectorAll('.folio-kp-ideograph-glue');
    for(const gap of gaps){
     gap.style.width=Math.max(0,now.cjkSpacing).toFixed(4)+'px';
     gap.style.marginInlineStart=Math.min(0,now.cjkSpacing).toFixed(4)+'px';
    }
    for(const track of line.querySelectorAll('.folio-kp-cjk-track')){
     track.style.letterSpacing=now.cjkSpacing.toFixed(4)+'px';
     track.style.marginInlineEnd='0px';
    }
    count++;
   }
  }
  result.spacingUpdates=count;
  return true;
 }
 function spliceReusedLines(previous,result){
  if(!previous?.lineSignatures||!result?.lineSignatures)return;
  const prior=previous.lineSignatures,next=result.lineSignatures;
  const existing=previous.fragments,newLines=result.fragments;
  if(!existing || !newLines)return;
  const rebuilt=newLines.slice();
  // Reuse only aligned prefixes and suffixes. The middle may have gained/lost
  // lines; matching its indices would risk changing the reading order.
  let head=0;
  while(head<prior.length&&head<next.length&&prior[head]===next[head]){
   newLines[head]=existing[head];head++;
  }
  let tail=0;
  while(tail<prior.length-head&&tail<next.length-head&&
        prior[prior.length-1-tail]===next[next.length-1-tail]){
   newLines[next.length-1-tail]=existing[prior.length-1-tail];tail++;
  }
  // A cached alternate layout may share old line nodes with a later one.
  // Never trust a signature alone: the source text must remain byte-exact.
  // Revert to the freshly built lines if an EPUB's inline markup has changed
  // how adjacent text runs are represented.
  const expected=previous.original?.textContent;
  if(expected!==undefined && newLines.map(n=>n.textContent).join('')!==expected){
   newLines.splice(0,newLines.length,...rebuilt);
   result.reusedLines=0;
  }else result.reusedLines=head+tail;
 }
 // Snapshot only when leaving a previously checked width. Cloning here is
 // cheaper than rebuilding the marked-up text on every later return, and
 // avoids burdening one-time cold reading. Even if prefix/suffix nodes are
 // reused in a new layout, these saved templates stay independent.
 function snapshotDepartingLayout(p,previous,prepKey){
  if(!previous?.validatedSafe || previous.prepKey!==prepKey ||
     !Number.isFinite(previous.fitWidth) ||
     (previous.chars||0)>MAX_SAVED_LAYOUT_CHARS)return;
  const cache=previous.layoutCache||(previous.layoutCache=new Map());
  const key=previous.fitWidth.toFixed(2);
  if(cache.has(key))return;
  const lines=[...p.children];
  if(lines.length!==previous.lines ||
     !lines.every(l=>l.classList.contains('folio-kp-line')))return;
  const {original,fragments,baselineFragments,layoutCache,
   validatedSafe,validatedWidth,...data}=previous;
  cache.set(key,{prepKey,data,fragments:lines.map(n=>n.cloneNode(true))});
  while(cache.size>MAX_SAVED_LAYOUTS)cache.delete(cache.keys().next().value);
 }
 // This visibility rule is owned by the opt-in quality engine rather than
 // the 2MB reader shell. One tiny stylesheet is installed per EPUB document;
 // an ordinary chapter never enters the optical path or changes its CSS.
 function ensureOpticalVisibilityStyle(doc){
  const id='folio-kp-optical-visibility';
  if(doc.getElementById(id))return;
  const css=doc.createElement('style');css.id=id;
  css.textContent='body :is(p,li,dd,blockquote,figcaption)[data-folio-kp],'+
   'body :is(p,li,dd,blockquote,figcaption)[data-folio-kp]>span.folio-kp-line,'+
   'body :is(p,li,dd,blockquote,figcaption)[data-folio-kp] .folio-kp-optical-end'+
   '{overflow:visible!important}';
  (doc.head||doc.documentElement).appendChild(css);
 }
 // The initial ~300ms budget is a FIRST-PAINT budget, not a permanent limit.
 // Prepare the remaining paragraphs in idle slices, without mutating the
 // active chapter on every slice. A final batched commit avoids repeated
 // Chromium multicolumn pagination and preserves native DOM until ready.
 function typeset(doc,available,config={}){
  if(!doc?.body)return {enabled:false,processed:0};
  let state=cacheByDoc.get(doc);
  if(!state){state={entries:new Map(),key:'',invalid:true,stats:null,preparationKey:''};cacheByDoc.set(doc,state);}
  if(!config.enabled){const anchor=restore(doc,config.anchor);return {enabled:false,processed:0,anchor};}
  ensureOpticalVisibilityStyle(doc);
  const key=[Math.round(available*64)/64,config.key||'',doc.fonts?.status||''].join('|');
  if(state.key===key&&!state.invalid)return {...state.stats,anchor:config.anchor,unchanged:true};
  const preparationKey=(config.prepKey||config.key||'')+'|'+(doc.fonts?.status||'');
  const canReuse=!!(state.entries.size && !state.invalid && state.preparationKey===preparationKey);
  // A real font or source-style change must restore the author's source
  // before remeasuring. A width-only change does NOT touch existing DOM.
  let anchor=config.anchor;
  if(!canReuse)anchor=restore(doc,anchor);
  let anchorMemory=null;
  if(anchor?.node){
   const p=anchor.node.parentElement?.closest?.('p,li,dd,blockquote,figcaption');
   if(p)anchorMemory=anchorInfo(anchor,p);
  }
  const win=doc.defaultView;
  const start=win.performance?.now?.()||Date.now();
  let processed=0,skipped=0,lines=0,chars=0,fastSafe=0,reusedPreparations=0,newPreparations=0;
  let unchangedParagraphs=0,updatedParagraphs=0,reusedLineNodes=0,restoredParagraphs=0;
  let retargetedParagraphs=0,spacingUpdates=0,stabilizedParagraphs=0,retainedOpticalFits=0,restoredLayouts=0;
  const pending=[],toNative=[],toRetarget=[];
  const timestamps={};
  const paragraphs=Array.from(doc.body.querySelectorAll('p,li,dd,blockquote,figcaption'));
  // A single large XHTML chapter should not monopolize an entire 300ms
  // animation frame. The existing idle pipeline finishes the remaining
  // paragraphs off the first-interaction path, then commits once with the
  // reader's preserved text anchor. Small chapters retain the old budget.
  // An explicit budget (tests / caller policy) always wins.
  const defaultBudget=paragraphs.length>=48?120:paragraphs.length>=28?190:300;
  const initialBudget=Number.isFinite(config.budgetMs)?Math.max(0,config.budgetMs):defaultBudget;
  let budgetStopped=false;
  const remaining=[];
  for(const p of paragraphs){
   const previous=canReuse?state.entries.get(p):null;
   if(processed>=MAX_PARAGRAPHS || budgetStopped ||
      (win.performance?.now?.()||Date.now())-start>initialBudget){
    if(!budgetStopped && processed<MAX_PARAGRAPHS)budgetStopped=true;
    if(budgetStopped && processed<MAX_PARAGRAPHS)remaining.push(p);
    if(previous)toNative.push([p,previous]);skipped++;continue;
   }
   // Already prepared paragraphs have proven eligible. Re-running DOM-based
   // eligibility would read cloned line markup, not the original EPUB source.
   if(!previous && !eligibleWithCache(p,win,preparationKey,available)){skipped++;continue;}
   const result=fitParagraph(p,available,doc,preparationKey,previous);
   if(!result){if(previous)toNative.push([p,previous]);skipped++;continue;}
   if(result.restoredLayout)restoredLayouts++;
   if(result.keptBreakPlan)stabilizedParagraphs++;
   if(result.retainedOpticalFit)retainedOpticalFits++;
   if(result.fastSafe)fastSafe++;
   if(result.cachedPreparation)reusedPreparations++;else newPreparations++;
   processed++;chars+=result.chars;lines+=result.lines;
   if(result.reuse){unchangedParagraphs++;continue;}
   if(result.retarget && previous){toRetarget.push([p,result,previous]);retargetedParagraphs++;reusedLineNodes+=result.lines;continue;}
   if(previous)spliceReusedLines(previous,result);
   reusedLineNodes+=result.reusedLines||0;
   pending.push([p,result,previous]);updatedParagraphs++;
  }
  timestamps.solve=(win.performance?.now?.()||Date.now())-start;
  // ONE mutation batch: restore ineligible originals and replace only the
  // modified paragraphs. Detached source roots preserve the original nodes,
  // footnote targets, data, and exact byte-for-byte source text.
  for(const [p,previous] of toNative){
   p.replaceChildren(...previous.original.childNodes);
   p.removeAttribute('data-folio-kp');
   state.entries.delete(p);restoredParagraphs++;
  }
  for(const [p,result,previous] of toRetarget){
   snapshotDepartingLayout(p,previous,preparationKey);
   if(retargetLineSpacing(p,previous,result)){
    spacingUpdates+=result.spacingUpdates||0;
    state.entries.set(p,{...previous,...result,original:previous.original,fragments:previous.fragments});
   }else{
    // Unexpected EPUB mutation: retain native source instead of risking wrong
    // spacing on a partially changed line tree.
    p.replaceChildren(...previous.original.childNodes);
    p.removeAttribute('data-folio-kp');state.entries.delete(p);restoredParagraphs++;
    processed--;skipped++;lines-=result.lines;chars-=result.chars;
   }
  }
  for(const [p,result,previous] of pending){
   snapshotDepartingLayout(p,previous,preparationKey);
   const original=previous?.original||doc.createElement(p.localName);
   if(!previous)while(p.firstChild)original.appendChild(p.firstChild);
   p.replaceChildren(...result.fragments);
   p.setAttribute('data-folio-kp','');
   state.entries.set(p,{...result,original,prepKey:preparationKey,
    layoutCache:previous?.layoutCache||new Map()});
  }
  // A previously validated paragraph whose line breaks are unchanged does
  // not require another expensive multicolumn scrollWidth/layout pass for a
  // sub-2px glue adjustment.  Keep the browser check for new breakpoints,
  // mixed Han/Latin geometry and changes beyond that narrow stable window.
  const validation=[];
  let trustedSpacingUpdates=0;
  for(const [p,result] of pending){
   if(result.restoredLayout){
    const saved=state.entries.get(p);
    if(saved){saved.validatedSafe=true;saved.validatedWidth=result.fitWidth;}
   }else validation.push([p,result]);
  }
  for(const [p,result,previous] of toRetarget){
   const hasMixed=!!p.querySelector('.folio-kp-mixed-fit');
   const hasPunctAdjustment=!!p.querySelector('.folio-kp-punct-kern,.folio-kp-punct-start');
   const smallDelta=Math.abs((result.fitWidth||0)-(previous.validatedWidth||0))<=2;
   if(previous.validatedSafe && smallDelta && !hasMixed && !hasPunctAdjustment &&
      result.keptBreakPlan && result.lines===previous.lines){
    const saved=state.entries.get(p);
    if(saved){saved.validatedSafe=true;saved.validatedWidth=result.fitWidth;}
    trustedSpacingUpdates++;
   }else validation.push([p,result]);
  }
  state.deferredPending=validation;
  state.refinement=remaining.length?{
   key,preparationKey,available,remaining,cursor:0,results:[],
   elapsedMs:0,attempted:0,eligible:0,startedAt:Date.now()
  }:null;
  state.key=key;state.invalid=false;state.preparationKey=preparationKey;
  state.stats={enabled:true,processed,skipped,lines,chars,fastSafe,
   reusedPreparations,newPreparations,unchangedParagraphs,updatedParagraphs,
   reusedLineNodes,restoredParagraphs,retargetedParagraphs,spacingUpdates,stabilizedParagraphs,trustedSpacingUpdates,retainedOpticalFits,restoredLayouts,
   elapsedMs:(win.performance?.now?.()||Date.now())-start,timestamps,
   firstPaintBudgetMs:initialBudget,
   progressiveRemaining:remaining.length,progressivePrepared:0,
   progressiveCommitted:0,progressiveElapsedMs:0};
  if(!config.deferValidation)validate(doc);
  const remapped=anchorMemory?restoreAnchor(anchorMemory):null;
  return {...state.stats,anchor:remapped||anchor};
 }
 // Idle preparation does not mutate active EPUB DOM. Every slice checks the
 // exact document/layout generation; font and width changes invalidate the
 // pending job. The final commit happens once, after ALL candidates have been
 // processed, avoiding a repagination per paragraph (and visible flicker).
 function refine(doc,config={}){
  const state=cacheByDoc.get(doc),job=state?.refinement;
  if(!job || state.invalid || job.key!==state.key ||
     job.preparationKey!==state.preparationKey)
   return {done:true,stale:true,ready:false};
  const win=doc.defaultView,now=()=>win.performance?.now?.()||Date.now();
  const start=now(),limit=Math.max(1,Math.min(35,Number(config.budgetMs)||12));
  let attempted=0,eligible=0,continuationEligibilitySkips=0;
  while(job.cursor<job.remaining.length && (attempted===0 || now()-start<limit)){
   if((state.stats?.processed||0)+job.results.length>=MAX_PARAGRAPHS){
    job.cursor=job.remaining.length;break;
   }
   const p=job.remaining[job.cursor];
   if(!p.isConnected||!doc.body.contains(p)||state.entries.has(p)){
    job.pendingOptimization=null;job.cursor++;continue;
   }
   attempted++;job.attempted++;
   // A pending measurement/DP task has already passed structural eligibility.
   // All work remains detached; do a final source identity check at commit.
   // This avoids repeatedly traversing the whole DOM to re-run the same
   // eligibility checks after every 32-token measurement slice.
   if(job.pendingOptimization)continuationEligibilitySkips++;
   if(!job.pendingOptimization && !eligibleWithCache(p,win,job.preparationKey,job.available)){
    job.pendingOptimization=null;job.cursor++;continue;
   }
   // Stop the DP at a safe candidate boundary when the idle budget expires.
   // The continuation retains only measured tokens and DP tables, never
   // live DOM subtrees. A subsequent call resumes at exactly the next break.
   const budgetLeft=Math.max(1,limit-(now()-start));
   const result=fitParagraph(p,job.available,doc,job.preparationKey,null,
    {budgetMs:budgetLeft,pending:job.pendingOptimization});
   if(result?.optimizationPending){
    job.pendingOptimization=result.continuation;
    break;
   }
   job.pendingOptimization=null;job.cursor++;
   if(!result || result.reuse || result.retarget || !result.fragments)continue;
   // An EPUB's author content must remain unchanged throughout the operation.
   if(result.sourceText!==p.textContent)continue;
   job.results.push([p,result]);eligible++;job.eligible++;
  }
  job.elapsedMs+=now()-start;
  const ready=job.cursor>=job.remaining.length;
  if(state.stats){
   state.stats.progressiveRemaining=job.remaining.length-job.cursor;
   state.stats.progressivePrepared=job.results.length;
   state.stats.progressiveElapsedMs=job.elapsedMs;
   state.stats.eligibilityContinuationSkips=(state.stats.eligibilityContinuationSkips||0)+continuationEligibilitySkips;
  }
  return {done:ready,ready,stale:false,attempted,eligible,
   remaining:job.remaining.length-job.cursor,prepared:job.results.length,
   elapsedMs:now()-start,
   optimizationInProgress:!!job.pendingOptimization,
   measurementInProgress:job.pendingOptimization?.kind==='measurement',
   optimizationSlices:job.pendingOptimization?.task?.slices||0};
 }
 function commitRefinement(doc,anchor=null){
  const state=cacheByDoc.get(doc),job=state?.refinement;
  if(!job||job.cursor<job.remaining.length||state.invalid||
     job.key!==state.key||job.preparationKey!==state.preparationKey)
   return {committed:0,stale:true,anchor};
  let remembered=null,committed=0,lines=0,chars=0;
  const validation=[];
  for(const [p,result] of job.results){
   if(!p.isConnected||state.entries.has(p)||!doc.body.contains(p)||
      result.sourceText!==p.textContent)continue;
   if(anchor?.node&&p.contains(anchor.node))remembered=anchorInfo(anchor,p);
   const original=doc.createElement(p.localName);
   while(p.firstChild)original.appendChild(p.firstChild);
   p.replaceChildren(...result.fragments);
   p.setAttribute('data-folio-kp','');
   state.entries.set(p,{...result,original,prepKey:job.preparationKey,
    layoutCache:new Map()});
   validation.push([p,result]);committed++;lines+=result.lines;chars+=result.chars;
  }
  if(state.stats){
   state.stats.processed+=committed;
   state.stats.newPreparations+=committed;
   state.stats.updatedParagraphs+=committed;
   state.stats.skipped=Math.max(0,state.stats.skipped-committed);
   state.stats.lines+=lines;state.stats.chars+=chars;
   state.stats.progressivePrepared=job.results.length;
   state.stats.progressiveCommitted=committed;
   state.stats.progressiveElapsedMs=job.elapsedMs;
   state.stats.progressiveRemaining=0;
  }
  if(validation.length)state.deferredPending.push(...validation);
  state.refinement=null;
  return {committed,stale:false,anchor:remembered?restoreAnchor(remembered)||anchor:anchor};
 }
 // v94.8: Glyph ink, rather than scrollWidth, determines whether an optical
 // mark can be painted. The reader deliberately clips off-page columns and
 // publishers can add masks. If the whole mark cannot be painted inside its
 // own column's safe ink gutter, the entire optimized paragraph is restored.
 // This pass runs ONLY after a real composition, never inside Knuth-Plass DP.
 function opticalPaintBoundaries(doc,pending){
  const win=doc.defaultView,body=doc.body,br=body.getBoundingClientRect();
  const style=win.getComputedStyle(body),columns=Math.max(1,parseInt(style.columnCount,10)||1);
  const gap=Math.max(0,parseFloat(style.columnGap)||0);
  const colWidth=(br.width-gap*(columns-1))/columns;
  if(!(colWidth>80))return {checked:0,unsafe:new Set()};
  const step=colWidth+gap;
  // Each spread has real external page margins; its inner columns have a
  // separate inter-column gutter. Do not mistake a zero column-gap in the
  // single-column reading mode for zero *paintable* page margin.
  const viewportWidth=doc.documentElement.clientWidth||win.innerWidth;
  const outerLeft=Math.max(0,br.left),outerRight=Math.max(0,viewportWidth-br.right);
  const innerGutter=Math.min(12,Math.max(0,gap*.38));
  const outerLeftGutter=Math.min(16,outerLeft),outerRightGutter=Math.min(16,outerRight);
  let record=paintMeasureByDoc.get(doc);
  if(!record){
   const canvas=doc.createElement('canvas'),ctx=canvas.getContext('2d');
   if(!ctx)return {checked:0,unsafe:new Set(),measurements:0,cacheHits:0};
   record={ctx,inkCache:new Map()};paintMeasureByDoc.set(doc,record);
  }
  const {ctx,inkCache}=record;
  const unsafe=new Set(),paintAdjustments=[];let checked=0,measurements=0,cacheHits=0;
  let inspectedParagraphs=0,inspectedLines=0;
  for(const [p,result] of pending){
   if(!p.isConnected || result?.hasOpticalMarks===false)continue;
   // One descendant query per paragraph, instead of one query per visual
   // line. Long Chinese chapters routinely contain hundreds of mostly
   // unmarked lines, so the old loop repeatedly walked empty subtrees.
   const marks=p.querySelectorAll('.folio-kp-optical-end,.folio-kp-punct-start');
   if(!marks.length)continue;
   inspectedParagraphs++;
   let activeLine=null,safeColumnLeft=0,safeColumnRight=0,columnRight=0,lr=null;
   for(const mark of marks){
    const line=mark.closest('.folio-kp-line');
    // Only direct, optimized line children belong to this paragraph. A
    // publisher's nested content must not borrow the parent line's budget.
    if(!line || line.parentElement!==p)continue;
    if(line!==activeLine){
     activeLine=line;inspectedLines++;
     lr=line.getBoundingClientRect();
     const idx=Math.max(0,Math.floor((lr.left-br.left+Math.min(colWidth*.10,12))/step));
     const left=br.left+idx*step,right=left+colWidth;
     columnRight=right;
     const slot=idx%columns;
     safeColumnLeft=left-(slot===0?outerLeftGutter:innerGutter);
     safeColumnRight=right+(slot===columns-1?outerRightGutter:innerGutter);
    }
    const opening=mark.classList.contains('folio-kp-punct-start');
    const content=mark.textContent.trim(),ch=opening?first(content):last(content);
    if(!ch)continue;
    const cs=win.getComputedStyle(mark),r=mark.getBoundingClientRect();
    const font=cs.font||`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    let box=inkCache.get(font+'\0'+ch);
    if(!box){ctx.font=font;try{ctx.fontKerning='auto'}catch{}const m=ctx.measureText(ch);measurements++;
     box={left:m.actualBoundingBoxLeft,right:m.actualBoundingBoxRight};
     if(inkCache.size>4096)inkCache.clear();
     inkCache.set(font+'\0'+ch,box);}
    else cacheHits++;
    checked++;
    if(!Number.isFinite(box.left)||!Number.isFinite(box.right)){
     unsafe.add(p);break;
    }
    const inkLeft=r.left-box.left,inkRight=r.left+box.right;
    const inView=lr.left>=-0.5&&lr.right<=viewportWidth+0.5&&
     lr.top<win.innerHeight&&lr.bottom>0;
    const safeLeft=Math.max(safeColumnLeft,inView?1.5:-Infinity);
    const safeRight=Math.min(safeColumnRight,inView?viewportWidth-1.5:Infinity);
    // The KP plan measures glyph *advances*, but browser painting of a
    // proportional quoted mark can end further inside the edge than the
    // plan predicts. One post-layout, ink-aware calibration (read-only here)
    // brings the final ink to within ~0.08em of its real column measure.
    // This affects only a single hangable mark, never following text,
    // never changes a line break, and never lets ink cross the safe gutter.
    let paintDelta=0;
    if(!opening && HANG_END_INK.has(ch) && inkRight<columnRight-1.3 &&
       inkLeft>=safeLeft && inkRight<=safeRight){
     const fontSize=parseFloat(cs.fontSize)||20;
     const prior=parseFloat(mark.style.insetInlineStart)||0;
     const desiredRight=Math.min(columnRight-fontSize*.075,safeRight-1);
     paintDelta=Math.max(0,Math.min(fontSize*.33-prior,desiredRight-inkRight));
     if(paintDelta>.35){paintAdjustments.push([mark,prior+paintDelta]);}
     else paintDelta=0;
    }
    if(inkLeft<safeLeft-0.01||inkRight+paintDelta>safeRight-0.01){unsafe.add(p);break;}
   }
  }
  return {checked,unsafe,paintAdjustments,measurements,cacheHits,inspectedParagraphs,inspectedLines};
 }
 // Call after the pagination engine has already measured the column spread.
 // Otherwise scrollWidth on each paragraph forces an early whole-chapter layout.
 // Native fallback is still retained for any actual browser overflow.
 function validate(doc){
  const state=cacheByDoc.get(doc);
  if(!state?.deferredPending?.length)return {changed:false,checked:0};
  const pending=state.deferredPending;
  state.deferredPending=[];
  const win=doc.defaultView;
  const started=win.performance?.now?.()||Date.now();
  const calibration=[];
  // Reuse one DOM Range across the mixed-script lines. Range allocation is
  // unnecessary for successive read-only geometry checks in the same doc.
  let calibrationRange=null;
  for(const [p] of pending){
   for(const line of p.children){
    if(!line.classList.contains('folio-kp-mixed-fit'))continue;
    const gaps=line.querySelectorAll('.folio-kp-ideograph-glue');
    if(gaps.length<2)continue;
    let hasNegativeGlue=false;
    for(const gap of gaps)if(parseFloat(gap.style.marginInlineStart)<0){hasNegativeGlue=true;break;}
    if(hasNegativeGlue)continue;
    if(!calibrationRange)calibrationRange=doc.createRange();
    calibrationRange.selectNodeContents(line);
    const rendered=calibrationRange.getBoundingClientRect().width;
    const goal=line.getBoundingClientRect().width-(parseFloat(win.getComputedStyle(line).paddingInlineStart)||0);
    const delta=goal-rendered;
    if(Math.abs(delta)<.8)continue;
    const size=parseFloat(win.getComputedStyle(line).fontSize)||20;
    const adjustment=Math.max(-size*.075,Math.min(size*.095,delta/gaps.length));
    if(Math.abs(adjustment)<.02)continue;
    for(const gap of gaps){
     const prior=parseFloat(gap.style.width)||0;
     const next=Math.max(0,Math.min(size*.195,prior+adjustment));
     if(Math.abs(next-prior)>.01)calibration.push([gap,next]);
    }
   }
  }
  for(const [gap,width] of calibration)gap.style.width=width.toFixed(4)+'px';
  let checked=0,removed=0,changed=calibration.length>0;
  let keptRepairLines=0,keptRepairParagraphs=0;
  // A font's ink-side bearing, fractional CJK glue, and Chromium's rounded
  // scrollWidth sometimes disagree by a few pixels on narrow columns. Avoid
  // discarding a whole carefully composed paragraph when a tiny, legal local
  // reduction of *positive* Han glue is enough to make the physical line fit.
  // The correction is deliberately bounded: no punctuation or actual glyph
  // advances are altered, negative glue is never made more negative, and each
  // repaired paragraph undergoes a fresh browser overflow read below.
  const repairs=[];
  const repairsByParagraph=new Map();
  for(const [p,result] of pending){
   if(!p.isConnected || result.fastSafe || result.needsPositiveGlueReview===false ||
      p.scrollWidth<=p.clientWidth+2)continue;
   const children=p.children,lines=result.optimizedLines||[];
   for(let i=0;i<lines.length&&i<children.length;i++){
    const line=children[i],metric=lines[i];
    if(!line.classList.contains('folio-kp-line') || !(metric.cjkSpacing>.15))continue;
    // scrollWidth's excess must be repaired on its *own* (trailing) edge.
    // A legal opening-quote trim belongs to the opposite edge and cannot
    // excuse a 3px overrun caused by positive Han spacing on the first line.
    // Subtract only the actual end-glyph optical allowance, then let the
    // existing bounded positive-glue repair resolve minor physical overflow.
    const optical=Math.max(0,(metric.opticalEnd||0)+(metric.paintShift||0));
    const excess=line.scrollWidth-line.clientWidth-optical;
    if(!(excess>1.5))continue;
    const glues=[];
    let count=0;
    for(const el of line.querySelectorAll('.folio-kp-cjk-track,.folio-kp-ideograph-glue')){
     if(el.classList.contains('folio-kp-cjk-track')){
      // A compact track deliberately excludes the final glyph of its
      // run. Its last letter-spacing is the genuine gap before that
      // untracked glyph, not a phantom trailing advance.
      const n=el.textContent.length;
      if(n){glues.push([el,n,true]);count+=n;}
     }else{
      glues.push([el,1,false]);count++;
     }
    }
    if(!count)continue;
    const step=Math.min(metric.cjkSpacing*.78,(excess+.45)/count);
    if(step<.035)continue;
    const correction={p,line,index:i,newValue:metric.cjkSpacing-step,glues};
    repairs.push(correction);
    if(!repairsByParagraph.has(p))repairsByParagraph.set(p,[]);
    repairsByParagraph.get(p).push(correction);
   }
  }
  // Do all writes together. Reading the corrected geometry afterward is one
  // layout flush, not an O(paragraphs) sequence of forced synchronous reflows.
  for(const repair of repairs){
   const spacing=repair.newValue;
   for(const [node,,track] of repair.glues){
    if(track){node.style.letterSpacing=spacing.toFixed(4)+'px';node.style.marginInlineEnd='0px';}
    else{node.style.width=Math.max(0,spacing).toFixed(4)+'px';node.style.marginInlineStart=Math.min(0,spacing).toFixed(4)+'px';}
   }
  }
  // Read all overflow geometry together, BEFORE restoring any paragraph.
  // A write/read cycle for each failing paragraph forces repeated whole-
  // chapter multicolumn layout, even if there are only a few failures.
  const paint=opticalPaintBoundaries(doc,pending);
  // Batch every paint correction after all geometry reads. A per-mark
  // relative-position write inside opticalPaintBoundaries would force
  // quadratic Chromium reflows on image-heavy or punctuation-heavy EPUBs.
  for(const [mark,shift] of paint.paintAdjustments||[]){
   mark.style.setProperty('position','relative','important');
   mark.style.setProperty('inset-inline-start',shift.toFixed(4)+'px','important');
  }
  if(paint.paintAdjustments?.length)changed=true;
  const overflow=[];
  for(const [p,result] of pending){
   if(!p.isConnected)continue;
   const saved=state.entries.get(p);
   if(result.fastSafe){
    if(saved){saved.validatedSafe=true;saved.validatedWidth=result.fitWidth;}
    continue;
   }
   checked++;
   const excess=p.scrollWidth-p.clientWidth;
   let safe=excess<=2 && !paint.unsafe.has(p);
   if(!safe && !paint.unsafe.has(p)){
    // A negative start margin exposes the *empty* left bearing of an
    // opening punctuation outside the inline box. Chromium counts that
    // invisible margin in the parent's scrollWidth even when the glyph's
    // ink is safely inside the text edge. Validate the actual individual
    // line boxes before calling this a genuine overflow; permit only the
    // precise measured leading trim plus a 2px browser rounding margin.
    let edgeAllowance=0;
    for(const [i,line] of (result.optimizedLines||[]).entries()){
     const lastMark=p.children[i]?.querySelector('.folio-kp-optical-end');
     const actualShift=lastMark?(parseFloat(lastMark.style.insetInlineStart)||0):(line.paintShift||0);
     edgeAllowance=Math.max(edgeAllowance,line.punctStart||0,(line.opticalEnd||0)+actualShift);
    }
    if(edgeAllowance>.02 && excess<=edgeAllowance+2.1){
     safe=true;
     let i=0;
     for(const line of p.children){
      const measured=result.optimizedLines[i++];
      // The line scroll rect still includes the *empty* glyph advance
      // eliminated by a negative end margin. We only disregard an excess
      // bounded by that exact glyph's font-ink-limited optical trim.
      const mark=line.querySelector('.folio-kp-optical-end');
      const actualShift=mark?(parseFloat(mark.style.insetInlineStart)||0):(measured?.paintShift||0);
      if(line.scrollWidth-line.clientWidth>(measured?.opticalEnd||0)+actualShift+2.1){safe=false;break;}
     }
    }
   }
   if(safe){
    if(saved){saved.validatedSafe=true;saved.validatedWidth=result.fitWidth;}
    // Keep the optimizer's retained plan synchronized with the actually
    // rendered spacing; otherwise an incremental reflow could compare against
    // stale CJK glue values and reintroduce the same overflow.
    const retainedCorrections=repairsByParagraph.get(p)||[];
    if(retainedCorrections.length){keptRepairParagraphs++;keptRepairLines+=retainedCorrections.length;}
    for(const repair of retainedCorrections){
     if(result.optimizedLines?.[repair.index])result.optimizedLines[repair.index].cjkSpacing=repair.newValue;
     if(result.lineLayout?.[repair.index])result.lineLayout[repair.index].cjkSpacing=repair.newValue;
     if(saved?.optimizedLines?.[repair.index])saved.optimizedLines[repair.index].cjkSpacing=repair.newValue;
     if(saved?.lineLayout?.[repair.index])saved.lineLayout[repair.index].cjkSpacing=repair.newValue;
    }
   }else overflow.push([p,result,saved]);
  }
  const baseline=[];
  for(const [p,result,saved] of overflow){
   if(result.baselineFragments && !paint.unsafe.has(p)){
    p.replaceChildren(...result.baselineFragments);
    baseline.push([p,result,saved]);
   }
  }
  // One read phase for any attempted baseline alternatives.
  const toRestore=overflow.filter(([,result])=>!result.baselineFragments);
  for(const [p,result,saved] of baseline){
   if(p.scrollWidth<=p.clientWidth+2){
    state.stats.lines+=result.baselineLines-result.lines;
    if(saved){saved.lines=result.baselineLines;saved.validatedSafe=true;saved.validatedWidth=result.fitWidth;}
    changed=true;
   }else toRestore.push([p,result,saved]);
  }
  // One final write phase for all genuinely invalid paragraphs.
  for(const [p,result,saved] of toRestore){
   if(saved?.original)p.replaceChildren(...saved.original.childNodes);
   p.removeAttribute('data-folio-kp');
   state.entries.delete(p);
   state.stats.processed--;state.stats.skipped++;state.stats.lines-=result.lines;state.stats.chars-=result.chars;
   removed++;changed=true;
  }
  changed=changed||keptRepairLines>0;
  state.stats.validationMs=(win.performance?.now?.()||Date.now())-started;
  state.stats.validationChecked=checked;
  state.stats.validationInkChecked=paint.checked;
  state.stats.validationInkMeasurements=paint.measurements;
  state.stats.validationInkCacheHits=paint.cacheHits;
  state.stats.validationInkFallbacks=paint.unsafe.size;
  state.stats.validationInkParagraphs=paint.inspectedParagraphs||0;
  state.stats.validationInkLines=paint.inspectedLines||0;
  // Incremental chapters may validate multiple batches. Per-batch counters
  // cannot be compared across builds because scheduler timing varies; retain
  // cumulative glyph/paragraph/line counts for reproducible diagnostics.
  state.stats.validationInkCheckedTotal=(state.stats.validationInkCheckedTotal||0)+paint.checked;
  state.stats.validationInkLinesTotal=(state.stats.validationInkLinesTotal||0)+(paint.inspectedLines||0);
  state.stats.validationInkParagraphsTotal=(state.stats.validationInkParagraphsTotal||0)+(paint.inspectedParagraphs||0);
  state.stats.validationInkMeasurementsTotal=(state.stats.validationInkMeasurementsTotal||0)+paint.measurements;
  state.stats.validationInkCacheHitsTotal=(state.stats.validationInkCacheHitsTotal||0)+paint.cacheHits;
  // The progressive compositor may validate several batches. Preserve
  // per-batch fields for compatibility and add cumulative counters so a
  // later clean batch cannot hide an earlier unsafe paragraph restoration.
  state.stats.validationFallbacks=removed;
  state.stats.validationFallbacksTotal=(state.stats.validationFallbacksTotal||0)+removed;
  state.stats.validationCheckedTotal=(state.stats.validationCheckedTotal||0)+checked;
  state.stats.validationRepairLinesTotal=(state.stats.validationRepairLinesTotal||0)+keptRepairLines;
  state.stats.validationRepairLines=keptRepairLines;
  state.stats.validationRepairParagraphs=keptRepairParagraphs;
  return {changed,checked,removed};
 }
 function invalidate(doc){const s=cacheByDoc.get(doc);if(s){s.invalid=true;s.refinement=null;}measuredParagraphCache=new WeakMap();eligibilityCache=new WeakMap();metricsCacheByDoc.delete(doc);inkMetricsCacheByDoc.delete(doc);preparedTextCachesByDoc.delete(doc);paintMeasureByDoc.delete(doc);measuredTemplatesByDoc.delete(doc);planCachesByDoc.delete(doc);}
 function stats(doc){return cacheByDoc.get(doc)?.stats||null;}
 // Diagnostics contain counts/estimated bytes only, never text or font data.
 function cacheStats(doc){const plans=planCachesByDoc.get(doc);return {
  plans:plans?.size||0,estimatedPlanBytes:plans?.bytes||0,
  planEvictions:plans?.evictions||0,planByteBudget:MAX_PLAN_CACHE_BYTES,
  planEntryBudget:MAX_PLAN_CACHE_ENTRIES,
  measuredTemplates:measuredTemplatesByDoc.get(doc)?.size||0,
  estimatedTemplateBytes:measuredTemplatesByDoc.get(doc)?.bytes||0,
  templateByteBudget:MAX_TEMPLATE_CACHE_BYTES,
  preparedTexts:preparedTextCachesByDoc.get(doc)?.size||0,
  estimatedPreparedTextBytes:preparedTextCachesByDoc.get(doc)?.bytes||0,
  preparedTextByteBudget:MAX_PREPARED_TEXT_BYTES,
  glyphWidths:metricsCacheByDoc.get(doc)?.size||0
 };}
 return {typeset,refine,commitRefinement,validate,restore,invalidate,stats,cacheStats,tokenize,discretionaryTokens,breakAfter,optimize,nodesFor,populateWidths,version:'1.50.0'};
});
