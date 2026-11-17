/* Folio MathML language-spacing repair — v1.0.
 * MathML Core trims ASCII whitespace at both ends of token elements such as
 * <mtext>. In equations like <mtext>if </mtext><mi>x</mi>, that loses the
 * author's intended inter-token word space. Preserve the markup and shape,
 * supply only missing boundary spaces with native MathML <mspace> nodes.
 * No CSS letter-spacing, text rewriting, network, or per-frame layout reads.
 * Copyright (c) Folio contributors. MIT.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FolioMathSpacing=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:null),function(){
 'use strict';
 const NS='http://www.w3.org/1998/Math/MathML';
 const MATH_WORDS=/^(?:if|when|where|otherwise|else|unless|then|for|with|and|or|such\s+that|provided\s+that|if\s+and\s+only\s+if|for\s+all|in\s+which|only\s+if)$/iu;
 const NEIGHBOR_ATOM=new Set(['mi','mn','mtext','ms','msup','msub','msubsup','mfrac','msqrt','mroot','mrow','mover','munder','munderover','menclose','mfenced','mpadded']);
 const gap = el=>el?.localName==='mspace' || el?.getAttribute?.('data-folio-math-spacing')==='1';
 function neighbors(el){
  // Ignore MathML indentation and formatting text between tokens.
  let before=el.previousSibling,after=el.nextSibling;
  while(before?.nodeType===3 && !before.nodeValue.trim())before=before.previousSibling;
  while(after?.nodeType===3 && !after.nodeValue.trim())after=after.nextSibling;
  return [before?.nodeType===1?before:null,after?.nodeType===1?after:null];
 }
 function plainText(el){
  // Some EPUB equations contain nested XHTML in mtext. Leave those untouched.
  if(el.childElementCount)return null;
  return el.textContent||'';
 }
 function actualSpace(text,side){
  // U+0020 at either end is intentional author text. The MathML token
  // algorithm removes it when rendering (even under white-space: nowrap).
  // Don't treat indentation-only newlines as typographic spaces.
  return side==='before'? /^(?:[ \t\r\n]* )/u.test(text) : / (?:[ \t\r\n]*)$/u.test(text);
 }
 function textWord(text){return MATH_WORDS.test(text.trim().replace(/\s+/gu,' '));}
 function add(el,before){
  const s=el.ownerDocument.createElementNS(NS,'mspace');
  s.setAttribute('width','0.25em');
  s.setAttribute('data-folio-math-spacing','1');
  if(before)el.parentNode.insertBefore(s,el);
  else el.parentNode.insertBefore(s,el.nextSibling);
  return s;
 }
 function repair(doc){
  if(!doc?.body)return {expressions:0,words:0,inserted:0};
  const elements=doc.body.querySelectorAll('math mtext');
  let inserted=0,words=0;
  const mathFound=new Set();
  for(const el of elements){
   if(el.namespaceURI!==NS||el.hasAttribute('data-folio-math-reviewed'))continue;
   el.setAttribute('data-folio-math-reviewed','1');
   const math=el.closest('math');if(math)mathFound.add(math);
   const raw=plainText(el);
   if(!raw||!raw.trim())continue;
   words++;
   const [before,after]=neighbors(el);
   const natural=textWord(raw);
   if(before&&before.namespaceURI===NS&&!gap(before) &&
      (actualSpace(raw,'before') || (natural&&NEIGHBOR_ATOM.has(before.localName)))){
    add(el,true);inserted++;
   }
   if(after&&after.namespaceURI===NS&&!gap(after) &&
      (actualSpace(raw,'after') || (natural&&NEIGHBOR_ATOM.has(after.localName)))){
    add(el,false);inserted++;
   }
  }
  return {expressions:mathFound.size,words,inserted};
 }
 return {repair,version:'1.0.0'};
});
