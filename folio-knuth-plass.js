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
 const CJK_PUNCT = /[，。！？；：、（）［］｛｝【】〔〕〖〗〈〉《》「」『』“”‘’﹐﹑﹒]/u;
 const WS = /^[ \t\n\r\f\u2000-\u200a\u202f\u205f\u3000]+$/u;
 const ATOM='\uFFFC'; // One native MathML box.
 const CODE_ATOM='\uFFF8'; // Inline code/keyboard/samp is an indivisible native-styled box.
 const NOTE_ATOM='\uFFF9'; // One intact superscript noteref, attached to its preceding word.
 const MAX_PARAGRAPH = 2500, MAX_TOKENS = 2100, MAX_PARAGRAPHS = 800, MAX_CJK_SPACERS = 850;
 const cacheByDoc = new WeakMap();
 const metricsCache = new Map();
 const measureContexts = new WeakMap();
 const planCache = new Map();
 // Pretext-inspired two-stage pipeline: tokenize / locate legal word breaks
 // once per *text*, independently of fonts and column widths. All actual glyph
 // widths remain measured with the browser's font engine at layout time.
 // A prepared paragraph is independent of the current column width. Its
 // styled runs and Canvas-measured boxes are retained across width-only
 // repagination; no DOM measurement is performed by the Knuth-Plass DP.
 let measuredParagraphCache = new WeakMap();
 let eligibilityCache = new WeakMap();
 const preparedTextCache = new Map();
 const MAX_PREPARED_TEXT = 440;
 const HAS_SEGMENTER = typeof Intl !== 'undefined' && !!Intl.Segmenter;
 const graphemeSegmenter = HAS_SEGMENTER ? new Intl.Segmenter('und',{granularity:'grapheme'}) : null;
 const own = (item,prop) => Object.prototype.hasOwnProperty.call(item,prop);
 const inRange = (x,a,b) => x>=a && x<b;
 const isCJK = (s)=>HAN.test(s) || CJK_PUNCT.test(s);
 const first = (str)=>Array.from(str)[0] || '';
 const last = (str)=>Array.from(str).at(-1) || '';
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
  const out=[];
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
 function preparedTokens(text,hyphenator){
  const hasHyphenator=!!hyphenator?.points;
  const key=(hasHyphenator?'hyphen|':'plain|')+text;
  let prepared=preparedTextCache.get(key);
  if(!prepared){
   const base=tokenize(text);
   prepared=hasHyphenator?discretionaryTokens(base,hyphenator):base;
   if(preparedTextCache.size>=MAX_PREPARED_TEXT){
    // Bounded insertion-order cache; no persistent stored book content.
    const firstKey=preparedTextCache.keys().next().value;preparedTextCache.delete(firstKey);
   }
   preparedTextCache.set(key,prepared);
  }
  // Reflow can mutate computed widths and glue; never mutate cached tokens.
  return prepared.map(t=>({...t,width:0,stretch:0,shrink:0,afterStretch:0,afterShrink:0,afterAuto:0,hyphenWidth:0}));
 }
 function discretionaryTokens(tokens,hyphenator){
  if(!hyphenator?.points)return tokens;
  const result=[];
  for(const t of tokens){
   if(t.kind!=='western'||!(/^[a-zA-Z]{7,}$/).test(t.text)){
    result.push(t);continue;
   }
   const points=hyphenator.points(t.text).filter(point=>point>=2 && t.text.length-point>=3);if(!points.length){result.push(t);continue;}
   let prev=0;
   for(const point of points){
    result.push({...t,text:t.text.slice(prev,point),start:t.start+prev,end:t.start+point,
     hyphenBreak:true,hyphenPenalty:(point===2||t.text.length-point===3)?620:(point===3||point===4||t.text.length-point===4)?280:155,hyphenWidth:0,width:0});prev=point;
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
 function summarize(tokens){
  // Prefix sums make evaluation of a break O(1) instead of remeasuring it.
  const w=[0],st=[0],sh=[0],spaces=[0],spaceWidth=[0],cjkGaps=[0],cjkCap=[0],letters=[0];
  for(const t of tokens){
   w.push(w.at(-1)+t.width+(t.afterAuto||0));
   st.push(st.at(-1)+(t.stretch||0)+(t.afterStretch||0));
   sh.push(sh.at(-1)+(t.shrink||0)+(t.afterShrink||0));
   spaces.push(spaces.at(-1)+(t.kind==='space'?1:0));
   spaceWidth.push(spaceWidth.at(-1)+(t.kind==='space'?t.width:0));
   cjkGaps.push(cjkGaps.at(-1)+(t.afterStretch>0?1:0));
   cjkCap.push(cjkCap.at(-1)+(t.afterStretch||0));
   letters.push(letters.at(-1)+(t.kind==='space'?1:Array.from(t.text).length));
  }
  return {w,st,sh,spaces,spaceWidth,cjkGaps,cjkCap,letters};
 }
 // Use one coherent physical glue model in the DP and in the renderer.
 // Western spaces may shrink/stretch; Han--Han gaps may only expand. Compare
 // the actual cost of distributing a line's shortfall between both classes.
 function fitMixedGlue(missing,spaces,naturalSpace,cjkGaps,cjkCapacity){
  if(!Number.isFinite(missing))return null;
  const fontEm=cjkGaps?cjkCapacity/(cjkGaps*.145):0;
  const maxCJK=cjkCapacity*.985;
  const maxStretch=spaces*naturalSpace*.92;
  const maxShrink=spaces*naturalSpace*.23;
  if(missing>maxCJK+maxStretch+.35 || missing < -maxShrink-.35)return null;
  // Most Chinese lines have no Latin spaces, and most English lines have no
  // ideographic gaps. Solve those cases analytically (no allocations/loops).
  if(!spaces){
   if(missing<-.35 || missing>maxCJK+.35)return null;
   const stretch=Math.max(0,missing),ratio=maxCJK?stretch/maxCJK:0;
   return {justify:stretch>.035,justifyMode:stretch>.035?'mixed':'none',
    wordSpacing:0,cjkSpacing:cjkGaps?stretch/cjkGaps:0,
    ratio,badness:165*ratio**3};
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
  const candidates=new Set([0,Math.min(maxCJK,Math.max(0,missing))]);
  if(cjkGaps){
   for(const r of [.15,.3,.45,.6,.75,.9,1]){
    candidates.add(Math.min(maxCJK,cjkGaps*fontEm*.145*r));
   }
   // Prefer the mild character spacing that is typical of polished Chinese.
   candidates.add(Math.min(maxCJK,Math.max(0,missing-spaces*naturalSpace*.16)));
  }
  let best=null;
  for(const stretch of candidates){
   const western=missing-stretch;
   if(!spaces && Math.abs(western)>.4)continue;
   const perSpace=spaces?western/spaces:0;
   const wr=naturalSpace>0?perSpace/naturalSpace:0;
   if(wr<-.23-.001 || wr>.92+.001)continue;
   const cr=cjkCapacity>0?stretch/cjkCapacity:0;
   const abs=Math.abs(wr);
   const westBad=spaces?960*abs**3*(wr<0?1.6:1):0;
   const river=wr>.42?260+9500*(wr-.42)**2:0;
   const squeezed=wr<-.16?100+6000*(Math.abs(wr)-.16)**2:0;
   const cjkBad=cjkGaps?165*cr**3:0;
   const cost=westBad+river+squeezed+cjkBad;
   if(best===null||cost<best.badness){
    best={justify:true,justifyMode:stretch>.035?'mixed':(spaces?'spaces':'none'),
     wordSpacing:perSpace,cjkSpacing:cjkGaps?stretch/cjkGaps:0,
     ratio:Math.max(abs,cr),badness:cost};
   }
  }
  return best;
 }
 function lineMetrics(tokens,prefix,from,to,goal,final,alignment,fontSize=20,allowTracking=true){
  let start=from,end=to;
  while(start<end&&tokens[start].kind==='space')start++;
  while(end>start&&tokens[end-1].kind==='space')end--;
  if(start>=end)return null;
  const tail=tokens[end-1];
  const width=prefix.w[end]-prefix.w[start]-(tail.afterAuto||0)+
    (!final&&tail.hyphenBreak?(tail.hyphenWidth||0):0);
  const missing=goal-width;
  const spaces=prefix.spaces[end]-prefix.spaces[start];
  const gapWidth=prefix.spaceWidth[end]-prefix.spaceWidth[start];
  const naturalSpace=gapWidth/Math.max(1,spaces);
  const cjkGaps=prefix.cjkGaps[end]-prefix.cjkGaps[start]-(tail.afterStretch>0?1:0);
  const cjkCapacity=prefix.cjkCap[end]-prefix.cjkCap[start]-(tail.afterStretch||0);
  const relativeShortfall=Math.max(0,missing)/Math.max(1,goal);
  const glyphCount=prefix.letters[end]-prefix.letters[start];
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
   else if(missing>=-.35 && spaces>0){const ratio=missing/(spaces*naturalSpace);properties={justify:true,justifyMode:'spaces',wordSpacing:missing/spaces,cjkSpacing:0,ratio,badness:3800+6000*Math.max(0,ratio-.92)**2};}
   else if(missing>=-.35 && cjkGaps>0){const ratio=missing/Math.max(1,cjkCapacity);properties={justify:true,justifyMode:'mixed',wordSpacing:0,cjkSpacing:missing/cjkGaps,ratio,badness:3800+2000*Math.max(0,ratio-.985)**2};}
   else return null;
  }else if(spaces>0 && naturalSpace>0){
   // Microtracking distributes a *tiny* amount of surplus over glyphs,
   // preventing rivers without noticeably distorting individual words.
   // TeX uses font expansion; CSS variable-font widths aren't universal, so
   // a rigorously bounded letter-spacing is the cross-font fallback here.
   // Never apply tracking inside inline mathematical constructs.
   if(allowTracking && glyphCount>=28 && missing>spaces*naturalSpace*.24){
    tracking=Math.min(fontSize*.014, (missing-spaces*naturalSpace*.24)/glyphCount);
   }
   const fit=fitMixedGlue(missing-tracking*glyphCount,spaces,naturalSpace,0,0);
   if(fit)properties={...fit,badness:fit.badness+3500*(tracking/fontSize)**2};
   else if(missing>=-.35){tracking=0;const ratio=missing/(spaces*naturalSpace);properties={justify:true,justifyMode:'spaces',wordSpacing:missing/spaces,cjkSpacing:0,ratio,badness:3800+6000*Math.max(0,ratio-.92)**2};}
   else return null;
  }else if(missing>=-.35){
   properties.badness=50000+20000*relativeShortfall**2;
  }else return null;
  return {...properties,tracking,glyphCount,width,missing,spaces,naturalSpace,cjkGaps,goal};
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
  if(entry.kind==='discretionary')cost+=75;
  else if(entry.kind==='hyphen')cost+=45;
  else if(entry.penalty>0)cost+=entry.penalty*.30;
  if(Math.abs(fitness(line)-prev.fit)>1)cost+=115;
  if(prev.flagged && entry.flagged)cost+=200;
  if(final && prev.flagged)cost+=145;
  // Avoid alternation between very stretched and very tight lines.
  if(!final&&prev.metrics&&prev.metrics.justify&&line.justify){
   const delta=Math.abs((prev.metrics.ratio||0)-(line.ratio||0));
   if(delta>.42)cost+=140*(delta-.42)**2;
  }
  if(!final&&prev.metrics&&!prev.metrics.justify&&!line.justify){
   const delta=Math.abs((prev.metrics.missing||0)-line.missing)/Math.max(1,line.goal);
   cost+=Math.min(150,200*delta*delta);
  }
  return cost;
 }
 function optimize(tokens,width,firstIndent=0,options={}){
  if(tokens.length===0)return null;
  const decomposition=nodesFor(tokens),{breaks}=decomposition,prefix=summarize(tokens);
  if(breaks.length<2)return null;
  const fitGroups=4,maxBacktrack=144;
  // Guard against one pathological paragraph monopolizing the chapter budget.
  // The deadline is consulted only between DP nodes (pure computation, no DOM).
  // The native CSS-justified paragraph remains readable if this budget expires.
  const clock=typeof performance!=='undefined'&&performance.now?()=>performance.now():()=>Date.now();
  const deadline=clock()+Math.max(20,options.timeBudgetMs??48);
  // Justification is only considered for ratios <= 1.55, so a tolerance
  // of 3 already admits every eligible line. Retrying with 12/infinity
  // repeated identical DP work for paragraphs that could not be typeset.
  const attempts=[3];
  for(const tolerance of attempts){
   const dp=Array.from({length:breaks.length},()=>[null,null,null,null]);
   dp[0][1]={cost:0,prev:-1,fit:1,flagged:false,target:width};
   for(let k=1;k<breaks.length;k++){
    if((k&7)===0 && clock()>deadline)return null;
    const b=breaks[k],final=k===breaks.length-1;
    for(let j=k-1;j>=0&&k-j<=maxBacktrack;j--){
     const left=breaks[j];
     // Width is pruned using the actual trimmed line metrics below. A
     // pre-trim calculation incorrectly rejected a valid break after spaces.
     if(prefix.w[b.i]-prefix.w[left.i] > width*1.22+35 && j<k-1)break;
     const goal=width-(j===0?firstIndent:0);
     const line=lineMetrics(tokens,prefix,left.i,b.i,goal,final,options.align||'start',options.fontSize||20,options.allowTracking!==false);
     if(!line || !Number.isFinite(line.badness))continue;
     if(!final && line.justify && line.ratio>tolerance)continue;
     for(let f=0;f<fitGroups;f++){
      const previous=dp[j][f];if(!previous)continue;
      const cost=score(previous,line,b,final);
      const nextFit=fitness(line);
      const existing=dp[k][nextFit];
      if(!existing || cost<existing.cost)dp[k][nextFit]={cost,prev:j,prevFit:f,fit:nextFit,flagged:b.flagged,target:width,ratio:line.ratio,metrics:line};
     }
    }
   }
   const finalIndex=breaks.length-1;
   const best=dp[finalIndex].filter(Boolean).sort((a,b)=>a.cost-b.cost)[0];
   if(!best)continue;
   const lines=[];let index=finalIndex,node=best;
   while(index>0){
    if(!node||node.prev<0)return null;
    lines.push({from:breaks[node.prev].i,to:breaks[index].i,
     start:breaks[node.prev].i?tokens[breaks[node.prev].i]?.start:0,
     end:tokens[breaks[index].i-1]?.end||0,ratio:node.ratio,justify:node.metrics?.justify||false,
     width:node.metrics?.width,goal:node.metrics?.goal,spaceCount:node.metrics?.spaces||0,naturalSpace:node.metrics?.naturalSpace||0,badness:node.metrics?.badness,cost:node.cost,
     justifyMode:node.metrics?.justifyMode||'none',wordSpacing:node.metrics?.wordSpacing||0,
     cjkSpacing:node.metrics?.cjkSpacing||0,tracking:node.metrics?.tracking||0,glyphCount:node.metrics?.glyphCount||0,
     hyphenate:index!==finalIndex && !!tokens[breaks[index].i-1]?.hyphenBreak});
    const prevIndex=node.prev;
    node=dp[prevIndex][node.prevFit];index=prevIndex;
   }
   lines.reverse();
   // A paragraph containing only one achievable line needs no DOM changes.
   if(lines.length<2)return null;
   return {lines,breakpoints:breaks.length,cost:best.cost,tolerance,nodes:decomposition.nodes.length,_tokens:tokens};
  }
  return null;
 }
 function refitExistingBreaks(tokens,previous,width,indent,options){
  // A one- or two-pixel viewport change usually does not justify rearranging
  // every Chinese line and rebuilding its DOM. Pretext-like metric reuse:
  // recompute glue for the previous breaks in O(number of tokens), no DP.
  // Never stabilize across more than 2 CSS pixels from the source solution.
  if(!previous?.optimizedLines?.length ||
     Math.abs(width-(previous.planOriginWidth??previous.fitWidth??0))>2)return null;
  const prefix=summarize(tokens),old=previous.optimizedLines;
  const lines=[];
  for(let i=0;i<old.length;i++){
   const prior=old[i],final=i===old.length-1;
   const goal=width-(i===0?indent:0);
   const metrics=lineMetrics(tokens,prefix,prior.from,prior.to,goal,final,'justify',
    options.fontSize,options.allowTracking);
   if(!metrics || (i<old.length-1 && !metrics.justify) ||
      (!final && metrics.badness>3500) || metrics.width>goal+1)return null;
   lines.push({...prior,ratio:metrics.ratio,justify:metrics.justify,width:metrics.width,goal,
    spaceCount:metrics.spaces,naturalSpace:metrics.naturalSpace,badness:metrics.badness,
    justifyMode:metrics.justifyMode,wordSpacing:metrics.wordSpacing,
    cjkSpacing:metrics.cjkSpacing,tracking:metrics.tracking,glyphCount:metrics.glyphCount});
  }
  return {lines,breakpoints:previous.breakpoints||0,tolerance:3,
   _tokens:tokens,stable:true};
 }
 function selectEligible(p,win){
  const tag=p.localName;
  const isProseBlock=tag==='p'||tag==='li'||tag==='dd'||tag==='blockquote'||tag==='figcaption';
  if(!isProseBlock)return false;
  if(p.closest('[hidden],[aria-hidden="true"],[data-folio-popup-note="true"],pre,code,kbd,samp,table,svg,math,rt,ruby,button,script,style,aside,nav,[contenteditable]'))return false;
  // A caption may be under a figure, but a free-standing paragraph within
  // an image/figure group still belongs to the publisher's figure layout.
  if(tag!=='figcaption'&&p.closest('figure'))return false;
  if(p.hasAttribute('data-folio-kp')||p.querySelector('img,svg:not(math svg),ruby,rt,rp,br,wbr,hr,button,input,textarea,select,figure,table,pre,[id]:not(a[data-folio-note-ref]),[contenteditable],iframe'))return false;
  if(p.querySelector('math[display="block"],math[id],math [id],math maction,math annotation-xml,.math-display,.displaymath,.equation,.katex-display,.MathJax_Display,mjx-container'))return false;
  if(p.querySelector('[style*="float"],[style*="position"],[style*="display"],[style*="white-space"]'))return false;
  // Only the deepest prose block is reflowed. In particular, a list's own
  // marker and nested list semantics remain entirely browser-controlled.
  if(tag!=='p' && p.querySelector('p,li,dd,blockquote,figcaption,ol,ul,dl,div,section'))return false;
  if(p.childElementCount>45)return false;
  for(const el of p.querySelectorAll('*')){
   if(el.closest('math') || (el.matches('sup,sub')&&el.closest('a[data-folio-note-ref]')))continue;
   if(!el.matches('a,em,i,strong,b,small,span,cite,abbr,dfn,q,u,s,mark,time,font,var,code,kbd,samp'))return false;
   if(el.matches('code,kbd,samp') && (el.querySelector('math,svg,img,br') || win.getComputedStyle(el).display!=='inline'))return false;
  }
  const cs=win.getComputedStyle(p);
  if(cs.display==='none'||cs.visibility==='hidden'||cs.direction!=='ltr'||cs.writingMode!=='horizontal-tb'||cs.whiteSpace!=='normal'||cs.float!=='none'||cs.position==='absolute'||cs.position==='fixed')return false;
  if(tag==='li' && (cs.display!=='list-item'||cs.listStylePosition==='inside'))return false;
  if(tag==='figcaption' && cs.display!=='block')return false;
  if(!['start','left','justify','-webkit-auto'].includes(cs.textAlign))return false;
  if(cs.textTransform!=='none'||cs.textOverflow!=='clip'||cs.letterSpacing!=='normal'&&Math.abs(parseFloat(cs.letterSpacing)||0)>1)return false;
  const indent=parseFloat(cs.textIndent)||0;
  if(indent < -.1 || indent>Math.min(80,(parseFloat(cs.width)||550)*.22))return false;
  if(/[\u2028\u2029]/u.test(p.textContent||''))return false;
  const text=p.textContent||'';
  const minimum=tag==='p'?50:tag==='li'?65:75;
  if(text.length<minimum||text.length>MAX_PARAGRAPH||/\p{Script=Arabic}|\p{Script=Hebrew}|[\u202a-\u202e\u2066-\u2069]/u.test(text))return false;
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
  let ctx=measureContexts.get(doc);
  if(!ctx){
   // OffscreenCanvas does not insert even a detached element into the DOM.
   if(typeof OffscreenCanvas!=='undefined')try{ctx=new OffscreenCanvas(1,1).getContext('2d')}catch{}
   if(!ctx)ctx=doc.createElement('canvas').getContext('2d');
   if(ctx)measureContexts.set(doc,ctx);
  }
  if(!ctx)return null;
  let lastFont='',lastKerning='';
  const measure=(t,run)=>{
   const key=`${run.font}|${run.kerning}|${run.letterSpacing}|${run.wordSpacing}|${t}`;
   const cached=metricsCache.get(key);if(cached!==undefined)return cached;
   if(lastFont!==run.font){ctx.font=run.font;lastFont=run.font;}
   if(lastKerning!==run.kerning){try{ctx.fontKerning=run.kerning}catch{}lastKerning=run.kerning;}
   const result=Math.max(0,ctx.measureText(t).width + run.letterSpacing*Math.max(0,Array.from(t).length-1)
    +run.wordSpacing*(t.match(/ /g)||[]).length);
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
  get.glyph=(offset,letter)=>{
   const r=runs.find(x=>x.start<=offset&&offset<x.end)||runs[0];
   return measure(letter,r);
  };
  return get;
 }
 function populateWidths(tokens,text,runs,doc,autoSpace=false){
  const measure=makeMeasurer(doc,runs);if(!measure)return false;
  const fontSize=runs[0]?.fontSize||20;
  for(let i=0;i<tokens.length;i++){
   const t=tokens[i];
   // A source sequence of spaces/tabs/newlines is one rendered space in
   // white-space:normal, not the sum of its original character advances.
   t.width=measure(t.start,t.end,t.kind==='space' && /^[ \t\n\r\f]+$/u.test(t.text));
   if(t.hyphenBreak){t.hyphenWidth=measure.glyph(t.end-1,'‐');}
   if(t.kind==='space'){
    t.stretch=Math.max(1,t.width*.65);
    t.shrink=Math.max(.4,t.width*.32);
   }
   const next=tokens[i+1];if(!next)continue;
   // Chromium text-autospace:normal inserts optical spacing between Han
   // and adjacent Latin/digit runs, even without an explicit space node.
   // Canvas.measureText() cannot account for this cross-token spacing.
   if(autoSpace && t.kind!=='space' && next.kind!=='space' &&
      ((HAN.test(last(t.text)) && /^[A-Za-z0-9]/u.test(first(next.text))) ||
       (/^[A-Za-z0-9]$/u.test(last(t.text)) && HAN.test(first(next.text))))){
    t.afterAuto=fontSize*.25;
   }
   const opp=breakAfter(t,next);
   if(opp?.kind==='ideographic' && isIdeographToken(t) && isIdeographToken(next)){
    // Full-width CJK glyphs have no natural inter-ideograph glue. Only add
    // bounded *positive* spacing between true ideographs. Never distribute
    // the extra gap before punctuation or across Latin characters.
    t.afterStretch=fontSize*.145;
    t.afterShrink=0;
   }
  }
  return true;
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
   spacer.className='folio-kp-ideograph-glue';
   spacer.setAttribute('aria-hidden','true');
   spacer.style.width=gap.width.toFixed(4)+'px';
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
    if(local>at && local<to && local>=1 &&
       IDEOGRAPH.test(source[local-1]) && IDEOGRAPH.test(source[local])){
     let boundary=local, idx=gapIndex;
     while(idx<gaps.length && boundary<to &&
       gaps[idx].pos===run.start+boundary &&
       Math.abs(gaps[idx].width-width)<.002 &&
       IDEOGRAPH.test(source[boundary-1]) && IDEOGRAPH.test(source[boundary])){
      count++;boundary++;idx++;
     }
     if(count>=3){
      const begin=local-1;
      if(begin>at)target.appendChild(doc.createTextNode(source.slice(at,begin)));
      const cluster=doc.createElement('span');cluster.className='folio-kp-cjk-track';
      cluster.style.letterSpacing=width.toFixed(4)+'px';
      cluster.style.marginInlineEnd=(-width).toFixed(4)+'px';
      cluster.textContent=source.slice(begin,boundary);
      target.appendChild(cluster);
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
  return tail?{doc:p.ownerDocument,node:tail,offset:Math.max(0,tail.length-1)}:null;
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
  state.entries.clear();state.deferredPending=[];state.key='';state.invalid=true;
  return memory?restoreAnchor(memory)||anchor:anchor;
 }
 function prepareMeasuredParagraph(p,doc,preparationKey,autoSpace,sourceRoot=null){
  const old=measuredParagraphCache.get(p);
  // The original text nodes are reattached by restore(). A missing first
  // original node means an external EPUB mutation invalidated this entry.
  if(old && old.key===preparationKey && old.autoSpace===autoSpace && old.sourceText===p.textContent &&
      (!old.runs.length || p.contains(old.runs[0].node) || sourceRoot?.contains(old.runs[0].node))){
   return {...old,cached:true};
  }
  const {text,runs}=getRuns(p,doc.defaultView);
  if(!runs.length || !text.trim())return null;
  const hyphenator=(typeof window!=='undefined'?window.FolioHyphenation:null);
  const tokens=preparedTokens(text,hyphenator);
  if(tokens.length<3||tokens.length>MAX_TOKENS)return null;
  if(!populateWidths(tokens,text,runs,doc,autoSpace))return null;
  const signature=runs.map(r=>r.start+','+r.end+','+r.font+','+
   r.letterSpacing+','+r.wordSpacing+','+(r.type!=='text'?r.width:'')).join(';');
  const prepared={key:preparationKey,autoSpace,text,runs,tokens,signature,sourceText:p.textContent};
  measuredParagraphCache.set(p,prepared);
  return {...prepared,cached:false};
 }
 function fitParagraph(p,available,doc,preparationKey,previous=null){
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
  const prepared=prepareMeasuredParagraph(p,doc,preparationKey,style?.autoSpace||false,previous?.original||null);
  if(!prepared)return null;
  const {text,runs,tokens:measuredTokens}=prepared;
  const inlineMath=runs.filter(r=>r.type==='math'||r.type==='code');
  if(inlineMath.some(r=>!Number.isFinite(r.width)||r.width<1||r.width>width*.88||r.display?.includes('block')))return null;
  const runSignature=prepared.signature;
  const alignment='justify'; // Opt-in quality mode requests fully justified prose.
  const planKey=width.toFixed(2)+'|'+indent.toFixed(2)+'|'+alignment+'|'+(style?.autoSpace?'normal':'none')+'|'+runSignature+'|'+text;
  const optimizeWidth=width-.35;
  const solverOptions={align:alignment,fontSize:runs[0]?.fontSize||20,allowTracking:!inlineMath.length};
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
    const plan=optimize(tokens,optimizeWidth,indent,{...solverOptions});
    choice={best:plan,baseline:null};
    if(planCache.size>350){let count=0;for(const key of planCache.keys()){planCache.delete(key);if(++count>=80)break;}}
    planCache.set(planKey,choice);
   }
  }
  const overfull=plan=>plan?.lines.some(line=>line.width+(line.spaceCount||0)*(line.wordSpacing||0)+(line.glyphCount||0)*(line.tracking||0)+
   (plan._tokens.slice(line.from,line.to-1).filter(t=>t.afterStretch>0).length)*(line.cjkSpacing||0)>line.goal+.8);
  if(!choice?.best||overfull(choice.best)){return null;}
  // An optimized paragraph must never contain mid-paragraph ragged lines.
  // If its natural glue cannot be fitted attractively, Chromium's native
  // justified layout is preferable to isolated words and large rivers.
  const poorLine=choice.best.lines.slice(0,-1).some(line=>
   !line.justify ||
   (line.spaceCount>0 && (line.wordSpacing>Math.max(6.5,(line.naturalSpace||4)*2.0) ||
     line.wordSpacing< -Math.max(1.4,(line.naturalSpace||4)*.27))) ||
   (line.cjkSpacing>0 && line.cjkSpacing>Math.max(5.5,(runs[0]?.fontSize||20)*.28)));
  if(poorLine)return null;
  // Treat a paragraph's line layout as immutable data. Do not reconstruct
  // existing line DOM when this fingerprint is unchanged. This is the crucial
  // DOM-last optimization; resizing may leave most paragraphs untouched.
  const lineSignatures=choice.best.lines.map(l=>[
   l.start,l.end,l.hyphenate?1:0,l.justify?1:0,
   l.wordSpacing.toFixed(3),l.cjkSpacing.toFixed(3),l.tracking.toFixed(4)
  ].join(':'));
  const layoutSignature=lineSignatures.join('|');
  const lineLayout=choice.best.lines.map(l=>({start:l.start,end:l.end,
   hyphenate:l.hyphenate,justify:l.justify,justifyMode:l.justifyMode,
   wordSpacing:l.wordSpacing,cjkSpacing:l.cjkSpacing,tracking:l.tracking}));
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
    (old.cjkSpacing>.035)===(l.cjkSpacing>.035);
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
   const spacerBudget=plan.lines.reduce((sum,line)=>sum+(line.cjkSpacing>.035?
    plan._tokens.slice(line.from,line.to-1).filter(t=>t.afterStretch>0).length:0),0);
   if(spacerBudget>MAX_CJK_SPACERS)return null;
   for(let i=0;i<plan.lines.length;i++){
    const line=plan.lines[i];
    // Render measured ideographic glue explicitly, never via the browser's
    // independent text-align:justify algorithm. This is essential for mixed
    // Chinese-English lines: Latin words retain their own natural kerning.
    const gaps=[];
    if(line.cjkSpacing>.035){
     const tok=plan._tokens;
     for(let k=line.from;k<line.to-1;k++){
      const t=tok[k];
      if(t.afterStretch>0 && t.end>line.start && t.end<line.end)
       gaps.push({pos:t.end,width:line.cjkSpacing});
     }
    }
    const content=cloneInlineRange(doc,previous?.original||p,runs,line.start,line.end,gaps);
    if(!content)return null;
    const span=doc.createElement('span');span.className='folio-kp-line';
    span.append(content);
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
     if(line.cjkSpacing>.035){
      span.classList.add('folio-kp-cjk-fit');
      // Pure Han widths are already reliable; only cross-script lines need
      // an extra browser geometry read to reconcile text-autospace.
      if(plan._tokens.slice(line.from,line.to).some(t=>t.kind==='western'))
       span.classList.add('folio-kp-mixed-fit');
     }
     if(line.justifyMode==='none')span.classList.add('folio-kp-natural-fit');
    }else span.classList.add('folio-kp-ragged');
    fragments.push(span);
   }
   return fragments.map(el=>el.textContent).join('')===p.textContent?fragments:null;
  }
  const fragments=fragmentsFor(choice.best);
  if(!fragments){return null;}
  const baselineFragments=choice.baseline?fragmentsFor(choice.baseline):null;
  return {fragments,baselineFragments,baselineLines:choice.baseline?.lines.length||0,
   cachedPreparation:prepared.cached,layoutSignature,lineSignatures,lineLayout,
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
   if(now.cjkSpacing>.035 && Math.abs(now.cjkSpacing-was.cjkSpacing)>.002){
    const gaps=line.querySelectorAll('.folio-kp-ideograph-glue');
    for(const gap of gaps)gap.style.width=now.cjkSpacing.toFixed(4)+'px';
    for(const track of line.querySelectorAll('.folio-kp-cjk-track')){
     track.style.letterSpacing=now.cjkSpacing.toFixed(4)+'px';
     track.style.marginInlineEnd=(-now.cjkSpacing).toFixed(4)+'px';
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
  result.reusedLines=head+tail;
 }
 function typeset(doc,available,config={}){
  if(!doc?.body)return {enabled:false,processed:0};
  let state=cacheByDoc.get(doc);
  if(!state){state={entries:new Map(),key:'',invalid:true,stats:null,preparationKey:''};cacheByDoc.set(doc,state);}
  if(!config.enabled){const anchor=restore(doc,config.anchor);return {enabled:false,processed:0,anchor};}
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
  let retargetedParagraphs=0,spacingUpdates=0,stabilizedParagraphs=0;
  const pending=[],toNative=[],toRetarget=[];
  const timestamps={};
  const paragraphs=Array.from(doc.body.querySelectorAll('p,li,dd,blockquote,figcaption'));
  for(const p of paragraphs){
   const previous=canReuse?state.entries.get(p):null;
   if(processed>=MAX_PARAGRAPHS || (win.performance?.now?.()||Date.now())-start>300){
    if(previous)toNative.push([p,previous]);skipped++;continue;
   }
   // Already prepared paragraphs have proven eligible. Re-running DOM-based
   // eligibility would read cloned line markup, not the original EPUB source.
   if(!previous && !eligibleWithCache(p,win,preparationKey,available)){skipped++;continue;}
   const result=fitParagraph(p,available,doc,preparationKey,previous);
   if(!result){if(previous)toNative.push([p,previous]);skipped++;continue;}
   if(result.keptBreakPlan)stabilizedParagraphs++;
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
   const original=previous?.original||doc.createElement(p.localName);
   if(!previous)while(p.firstChild)original.appendChild(p.firstChild);
   p.replaceChildren(...result.fragments);
   p.setAttribute('data-folio-kp','');
   state.entries.set(p,{...result,original,prepKey:preparationKey});
  }
  state.deferredPending=[...pending,...toRetarget].map(([p,result])=>[p,result]);
  state.key=key;state.invalid=false;state.preparationKey=preparationKey;
  state.stats={enabled:true,processed,skipped,lines,chars,fastSafe,
   reusedPreparations,newPreparations,unchangedParagraphs,updatedParagraphs,
   reusedLineNodes,restoredParagraphs,retargetedParagraphs,spacingUpdates,stabilizedParagraphs,
   elapsedMs:(win.performance?.now?.()||Date.now())-start,timestamps};
  if(!config.deferValidation)validate(doc);
  const remapped=anchorMemory?restoreAnchor(anchorMemory):null;
  return {...state.stats,anchor:remapped||anchor};
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
  for(const [p] of pending){
   for(const line of p.children){
    if(!line.classList.contains('folio-kp-mixed-fit'))continue;
    const gaps=line.querySelectorAll('.folio-kp-ideograph-glue');
    if(gaps.length<2)continue;
    const range=doc.createRange();range.selectNodeContents(line);
    const rendered=range.getBoundingClientRect().width;
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
  for(const [p,result] of pending){
   if(!p.isConnected||result.fastSafe)continue;
   checked++;
   if(p.scrollWidth<=p.clientWidth+2)continue;
   const saved=state.entries.get(p);
   if(result.baselineFragments){
    p.replaceChildren(...result.baselineFragments);
    if(p.scrollWidth<=p.clientWidth+2){
     state.stats.lines+=result.baselineLines-result.lines;
     saved.lines=result.baselineLines;changed=true;continue;
    }
   }
   if(saved?.original)p.replaceChildren(...saved.original.childNodes);
   p.removeAttribute('data-folio-kp');
   state.entries.delete(p);
   state.stats.processed--;state.stats.skipped++;state.stats.lines-=result.lines;state.stats.chars-=result.chars;
   removed++;changed=true;
  }
  state.stats.validationMs=(win.performance?.now?.()||Date.now())-started;
  state.stats.validationChecked=checked;
  state.stats.validationFallbacks=removed;
  return {changed,checked,removed};
 }
 function invalidate(doc){const s=cacheByDoc.get(doc);if(s)s.invalid=true;measuredParagraphCache=new WeakMap();eligibilityCache=new WeakMap();metricsCache.clear();planCache.clear();}
 function stats(doc){return cacheByDoc.get(doc)?.stats||null;}
 return {typeset,validate,restore,invalidate,stats,tokenize,discretionaryTokens,breakAfter,optimize,nodesFor,populateWidths,version:'1.13.3'};
});
