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
 const OPEN = new Set(Array.from('（［｛【〔〖〈《「『“‘'));
 const CLOSE = new Set(Array.from('），。！？；：、］｝】〕〗〉》」』”’﹐﹑﹒,.!?;:%‰'));
 const NONSTART = new Set(Array.from('）］｝】〕〗〉》」』、，。！？；：”’﹐﹑﹒'));
 const JOINERS = /[\u00a0\u200b\u200d\u2060\ufeff]/u;
 const HAN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
 const CJK_PUNCT = /[，。！？；：、（）［］｛｝【】〔〕〖〗〈〉《》「」『』“”‘’﹐﹑﹒]/u;
 const WS = /^[ \t\u2000-\u200a\u202f\u205f\u3000]+$/u;
 const MAX_PARAGRAPH = 2500, MAX_TOKENS = 2100, MAX_PARAGRAPHS = 800;
 const cacheByDoc = new WeakMap();
 const metricsCache = new Map();
 const planCache = new Map();
 const HAS_SEGMENTER = typeof Intl !== 'undefined' && !!Intl.Segmenter;
 const graphemeSegmenter = HAS_SEGMENTER ? new Intl.Segmenter('und',{granularity:'grapheme'}) : null;
 const own = (item,prop) => Object.prototype.hasOwnProperty.call(item,prop);
 const inRange = (x,a,b) => x>=a && x<b;
 const isCJK = (s)=>HAN.test(s) || CJK_PUNCT.test(s);
 const first = (str)=>Array.from(str)[0] || '';
 const last = (str)=>Array.from(str).at(-1) || '';
 const cls = (str)=> WS.test(str) ? 'space' : isCJK(str) ? 'cjk' : 'western';
 function graphemes(text){
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
   if(prev && kind!=='cjk' && prev.kind===kind){
    prev.text+=unit.part;prev.end=unit.end;
   }else out.push({text:unit.part,start:unit.start,end:unit.end,kind,width:0,stretch:0,shrink:0,afterStretch:0,afterShrink:0});
  }
  return out;
 }
 function breakAfter(a,b){
  if(!a || !b || a.kind==='space' && b.kind==='space')return null;
  if(a.kind==='space')return {penalty:0,flagged:false,kind:'space'};
  if(b.kind==='space')return null;
  const x=last(a.text),y=first(b.text);
  if(JOINERS.test(x)||JOINERS.test(y)||OPEN.has(x)||CLOSE.has(y)||NONSTART.has(y))return null;
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
   }else if(possible.kind==='hyphen'){
    nodes.push({type:'penalty',width:0,penalty:possible.penalty,flagged:true,start:t.end,end:t.end});
   }
   breaks.push({i:i+1,pos:t.end,...possible});
  }
  breaks.push({i:tokens.length,pos:tokens.at(-1)?.end||0,penalty:-10000,flagged:false,kind:'end'});
  return {nodes,breaks};
 }
 function summarize(tokens){
  const w=[0],st=[0],sh=[0];
  for(const t of tokens){
   w.push(w.at(-1)+t.width);
   st.push(st.at(-1)+t.stretch+t.afterStretch);
   sh.push(sh.at(-1)+t.shrink+t.afterShrink);
  }
  return {w,st,sh};
 }
 function lineMetrics(tokens,prefix,from,to,goal,final){
  let start=from,end=to;
  while(start<end&&tokens[start].kind==='space')start++;
  while(end>start&&tokens[end-1].kind==='space')end--;
  if(start===end)return null;
  const tail=tokens[end-1];
  const width=prefix.w[end]-prefix.w[start];
  const stretch=prefix.st[end]-prefix.st[start]-tail.afterStretch;
  const shrink=prefix.sh[end]-prefix.sh[start]-tail.afterShrink;
  const missing=goal-width;
  // Trailing and leading spaces are excluded visually. Their advance and
  // stretch/shrink must also be excluded from the demerit calculation.
  const firstSpaceTrim=from<start?prefix.w[start]-prefix.w[from]:0;
  const lastSpaceTrim=to>end?prefix.w[to]-prefix.w[end]:0;
  const netWidth=width;
  if(final){
   if(netWidth>goal+1) return {ratio:-Infinity,badness:Infinity,width:netWidth,firstSpaceTrim,lastSpaceTrim};
   return {ratio:0,badness:0,width:netWidth,firstSpaceTrim,lastSpaceTrim};
  }
  if(missing<0 && (!shrink || -missing>shrink+1))return {ratio:-Infinity,badness:Infinity,width:netWidth};
  // A small virtual stretch models raggedness (not enough spaces in a CJK
  // quotation); pathological lines still receive very high badness.
  const virtualStretch=Math.max(0,goal*.09);
  const ratio=missing>=0 ? missing/Math.max(1,stretch+virtualStretch) : missing/Math.max(1,shrink);
  const badness=100*Math.pow(Math.abs(ratio),3);
  return {ratio,badness,width:netWidth};
 }
 function fitness(r){return r < -.5?0:r<=.5?1:r<=1?2:3;}
 function score(prev,line,entry,final){
  const pen=entry.penalty||0;
  const bad=Math.min(4000,line.badness);
  let d=Math.pow(1+bad+Math.max(0,pen),2);
  if(pen<0 && pen>-10000)d=Math.max(0,d-pen*pen);
  if(Math.abs(fitness(line.ratio)-prev.fit)>1)d+=1800;
  if(prev.flagged&&entry.flagged)d+=4000;
  // Favour sensible Chinese paragraph endings and avoid a lone ideograph.
  if(final&&line.width<prev.target*.16)d+=500;
  return prev.cost+d;
 }
 function optimize(tokens,width,firstIndent=0,options={}){
  if(tokens.length===0)return null;
  const {breaks}=nodesFor(tokens),prefix=summarize(tokens);
  if(breaks.length<2)return null;
  const fitGroups=4,maxBacktrack=100;
  const attempts=[3,12,1e9];
  for(const tolerance of attempts){
   const dp=Array.from({length:breaks.length},()=>[null,null,null,null]);
   dp[0][1]={cost:0,prev:-1,fit:1,flagged:false,target:width};
   for(let k=1;k<breaks.length;k++){
    const b=breaks[k],final=k===breaks.length-1;
    for(let j=k-1;j>=0&&k-j<=maxBacktrack;j--){
     const left=breaks[j];
     const segmentWidth=prefix.w[b.i]-prefix.w[left.i];
     // This is the active-node pruning step. Even maximal shrink cannot fit
     // substantial overflow; earlier breakpoints cannot become feasible.
     if(segmentWidth > width*1.16+25 && j<k-1)break;
     for(let f=0;f<fitGroups;f++){
      const previous=dp[j][f];if(!previous)continue;
      const goal=width-(j===0?firstIndent:0);
      const line=lineMetrics(tokens,prefix,left.i,b.i,goal,final);
      if(!line || !Number.isFinite(line.badness)|| (!final && (line.ratio < -1.03 || line.ratio>tolerance)))continue;
      const cost=score(previous,line,b,final);
      const nextFit=fitness(line.ratio);
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
     end:tokens[breaks[index].i-1]?.end||0,ratio:node.ratio,
     badness:node.metrics?.badness,cost:node.cost});
    const prevIndex=node.prev;
    node=dp[prevIndex][node.prevFit];index=prevIndex;
   }
   lines.reverse();
   // A paragraph containing only one achievable line needs no DOM changes.
   if(lines.length<2)return null;
   return {lines,breakpoints:breaks.length,cost:best.cost,tolerance,nodes:nodesFor(tokens).nodes.length};
  }
  return null;
 }
 function selectEligible(p,win){
  if(p.closest('[hidden],[aria-hidden="true"],[data-folio-popup-note="true"],pre,code,figure,table,svg,math,rt,ruby,button,script,style,aside,nav,[contenteditable]'))return false;
  if(p.hasAttribute('data-folio-kp')||p.querySelector('img,svg,math,ruby,rt,rp,sup,sub,br,wbr,hr,button,input,textarea,select,a[data-folio-note-ref],a[role="doc-noteref"],figure,table,pre,code,kbd,samp,[id],[contenteditable],iframe'))return false;
  if(p.querySelector('[style*="float"],[style*="position"],[style*="display"],[style*="white-space"]'))return false;
  if(p.childElementCount>45 || p.querySelector('*:not(a,em,i,strong,b,small,span,cite,abbr,dfn,q,u,s,mark,time,font)'))return false;
  const cs=win.getComputedStyle(p);
  if(cs.display==='none'||cs.visibility==='hidden'||cs.direction!=='ltr'||cs.writingMode!=='horizontal-tb'||cs.whiteSpace!=='normal'||cs.float!=='none'||cs.position==='absolute'||cs.position==='fixed')return false;
  if(!['start','left','justify','-webkit-auto'].includes(cs.textAlign))return false;
  if(cs.textTransform!=='none'||cs.textOverflow!=='clip'||cs.letterSpacing!=='normal'&&Math.abs(parseFloat(cs.letterSpacing)||0)>1)return false;
  const indent=parseFloat(cs.textIndent)||0;
  if(indent < -.1 || indent>Math.min(80,(parseFloat(cs.width)||550)*.22))return false;
  if(/[^\S ]/u.test(p.textContent||''))return false;
  const text=p.textContent||'';
  if(text.length<50||text.length>MAX_PARAGRAPH||/\p{Script=Arabic}|\p{Script=Hebrew}|[\u202a-\u202e\u2066-\u2069]/u.test(text))return false;
  return true;
 }
 function getRuns(p,win){
  const textNodes=[];let all='';
  const walk=p.ownerDocument.createTreeWalker(p,NodeFilter.SHOW_TEXT);
  while(walk.nextNode()){
   const node=walk.currentNode;
   if(!node.nodeValue)continue;
   const start=all.length;all+=node.nodeValue;
   const style=win.getComputedStyle(node.parentElement);
   // CanvasRenderingContext2D.font does not accept CSS line-height.
   // getComputedStyle().font often contains '/ 36px' and silently falls back
   // to 10px sans-serif if assigned to canvas, producing severe overflow.
   const font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
   textNodes.push({node,start,end:all.length,font,fontSize:parseFloat(style.fontSize)||20,
    letterSpacing:parseFloat(style.letterSpacing)||0,wordSpacing:parseFloat(style.wordSpacing)||0,
    kerning:style.fontKerning||'auto'});
  }
  return {text:all,runs:textNodes};
 }
 function makeMeasurer(doc,runs){
  const ctx=doc.createElement('canvas').getContext('2d');
  if(!ctx)return null;
  let lastFont='',lastKerning='';
  const measure=(t,run)=>{
   const key=`${run.font}|${run.letterSpacing}|${run.wordSpacing}|${t}`;
   const cached=metricsCache.get(key);if(cached!==undefined)return cached;
   if(lastFont!==run.font){ctx.font=run.font;lastFont=run.font;}
   if(lastKerning!==run.kerning){try{ctx.fontKerning=run.kerning}catch{}lastKerning=run.kerning;}
   const result=Math.max(0,ctx.measureText(t).width + run.letterSpacing*Math.max(0,Array.from(t).length-1)
    +run.wordSpacing*(t.match(/ /g)||[]).length);
   if(metricsCache.size>20000){let count=0;for(const k of metricsCache.keys()){metricsCache.delete(k);if(++count>=4500)break;}}
   metricsCache.set(key,result);return result;
  };
  let cursor=0;
  return (start,end)=>{
   while(cursor<runs.length-1 && runs[cursor].end<=start)cursor++;
   let at=start,idx=cursor,width=0;
   while(at<end&&idx<runs.length){
    const r=runs[idx],until=Math.min(end,r.end);
    if(until>at)width+=measure(r.node.nodeValue.slice(Math.max(0,at-r.start),until-r.start),r);
    at=until;idx++;
   }
   return width;
  };
 }
 function populateWidths(tokens,text,runs,doc){
  const measure=makeMeasurer(doc,runs);if(!measure)return false;
  const fontSize=runs[0]?.fontSize||20;
  for(let i=0;i<tokens.length;i++){
   const t=tokens[i];
   t.width=measure(t.start,t.end);
   if(t.kind==='space'){
    t.stretch=Math.max(1,t.width*.65);
    t.shrink=Math.max(.4,t.width*.32);
   }
   const next=tokens[i+1];if(!next)continue;
   const opp=breakAfter(t,next);
   if(opp?.kind==='ideographic'){
    t.afterStretch=fontSize*(t.kind!==next.kind ? .10 : .15);
    t.afterShrink=fontSize*.065;
   }
  }
  return true;
 }
 // Range.cloneContents() drops an inline ancestor when a line begins and
 // ends in one of its text nodes. That silently changes Latin words from the
 // English font to the Chinese fallback! Clone the exact *ancestor chain*
 // for each text run instead, joining adjacent runs with common ancestors.
 function cloneInlineRange(doc,p,runs,start,end){
  const fragment=doc.createDocumentFragment();
  let originalStack=[],copyStack=[];
  for(const run of runs){
   if(run.end<=start)continue;
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
    (i ? copyStack[i-1] : fragment).appendChild(cloned);
    originalStack.push(parents[i]);copyStack.push(cloned);
   }
   (copyStack.at(-1)||fragment).appendChild(doc.createTextNode(run.node.nodeValue.slice(from,to)));
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
  state.entries.clear();state.key='';state.invalid=true;
  return memory?restoreAnchor(memory)||anchor:anchor;
 }
 function fitParagraph(p,available,doc){
  const win=doc.defaultView,cs=win.getComputedStyle(p);
  const naturalWidth=Math.min(available,parseFloat(cs.width)||available);
  const width=naturalWidth - (parseFloat(cs.paddingInlineStart)||0)-(parseFloat(cs.paddingInlineEnd)||0)
   -(parseFloat(cs.borderInlineStartWidth)||0)-(parseFloat(cs.borderInlineEndWidth)||0);
  if(!Number.isFinite(width)||width<170)return null;
  const indent=parseFloat(cs.textIndent)||0;
  const {text,runs}=getRuns(p,win);
  if(!runs.length||!text.trim())return null;
  const runSignature=runs.map(r=>r.start+','+r.end+','+r.font+','+r.letterSpacing+','+r.wordSpacing).join(';');
  const planKey=width.toFixed(2)+'|'+indent.toFixed(2)+'|'+runSignature+'|'+text;
  let plan=planCache.get(planKey);
  if(plan===undefined){
   const tokens=tokenize(text);
   if(tokens.length<3||tokens.length>MAX_TOKENS)return null;
   if(!populateWidths(tokens,text,runs,doc))return null;
   // An unbreakable word larger than a column is better left to CSS hyphens.
   if(tokens.some(t=>t.kind!=='space'&&t.width>width*.94))return null;
   plan=optimize(tokens,width-Math.max(10,width*.028),indent);
   if(planCache.size>350){let count=0;for(const key of planCache.keys()){planCache.delete(key);if(++count>=80)break;}}
   planCache.set(planKey,plan);
  }
  if(!plan || plan.lines.some(line=>line.ratio>4.5 || line.ratio<-1.05))return null;
  const fragments=[];
  for(let i=0;i<plan.lines.length;i++){
   const line=plan.lines[i];
   const content=cloneInlineRange(doc,p,runs,line.start,line.end);
   if(!content)return null;
   const span=doc.createElement('span');span.className='folio-kp-line';
   span.append(content);
   if(i===0&&indent>0)span.style.paddingInlineStart=indent+'px';
   if(i===plan.lines.length-1 || line.ratio>1.4)span.classList.add('folio-kp-ragged');
   fragments.push(span);
  }
  // Preserve all characters exactly, including spaces at line boundaries.
  if(fragments.map(el=>el.textContent).join('')!==text)return null;
  return {fragments,lines:plan.lines.length,chars:text.length,breakpoints:plan.breakpoints,tolerance:plan.tolerance};
 }
 function typeset(doc,available,config={}){
  if(!doc?.body)return {enabled:false,processed:0};
  let state=cacheByDoc.get(doc);
  if(!state){state={entries:new Map(),key:'',invalid:true,stats:null};cacheByDoc.set(doc,state);}
  if(!config.enabled){const anchor=restore(doc,config.anchor);return {enabled:false,processed:0,anchor};}
  const key=[Math.round(available*64)/64,config.key||'',doc.fonts?.status||''].join('|');
  if(state.key===key&&!state.invalid)return {...state.stats,anchor:config.anchor,unchanged:true};
  const anchor=restore(doc,config.anchor);
  let anchorMemory=null;
  if(anchor?.node){
   const p=anchor.node.parentElement?.closest?.('p');
   if(p)anchorMemory=anchorInfo(anchor,p);
  }
  const win=doc.defaultView;
  const start=win.performance?.now?.()||Date.now();
  let processed=0,skipped=0,lines=0,chars=0;
  const pending=[];
  const paragraphs=Array.from(doc.body.querySelectorAll('p'));
  for(const p of paragraphs){
   if(processed>=MAX_PARAGRAPHS || (win.performance?.now?.()||Date.now())-start>300){skipped++;continue;}
   if(!selectEligible(p,win)){skipped++;continue;}
   const result=fitParagraph(p,available,doc);
   if(result){pending.push([p,result]);processed++;chars+=result.chars;lines+=result.lines;}
   else skipped++;
  }
  // All expensive style/geometry reads happen before any write. Committing
  // paragraphs in a separate batch avoids layout thrashing in multi-columns.
  for(const [p,result] of pending){
   const original=doc.createDocumentFragment();
   while(p.firstChild)original.append(p.firstChild);
   p.replaceChildren(...result.fragments);
   p.setAttribute('data-folio-kp','');
   state.entries.set(p,{original,...result});
  }
  state.key=key;state.invalid=false;
  state.stats={enabled:true,processed,skipped,lines,chars,elapsedMs:(win.performance?.now?.()||Date.now())-start};
  // When changing fonts/columns, anchors inside a reformatted paragraph are
  // resolved by character offset instead of stale text-node references.
  const remapped=anchorMemory?restoreAnchor(anchorMemory):null;
  return {...state.stats,anchor:remapped||anchor};
 }
 function invalidate(doc){const s=cacheByDoc.get(doc);if(s)s.invalid=true;metricsCache.clear();planCache.clear();}
 function stats(doc){return cacheByDoc.get(doc)?.stats||null;}
 return {typeset,restore,invalidate,stats,tokenize,breakAfter,optimize,nodesFor,populateWidths,version:'1.0.0'};
});
