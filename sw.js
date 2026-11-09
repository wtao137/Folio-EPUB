// Folio app-shell cache. EPUBs remain in IndexedDB, not in Cache Storage.
const CACHE='folio-shell-v20';
const SHELL=['./index.html','./manifest.webmanifest','./icons/folio-192.png','./icons/folio-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.allSettled(SHELL.map(url=>cache.add(new Request(url,{cache:'reload'}))));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith('folio-shell-')&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return; // Online dictionary calls bypass the cache.
 if(req.mode==='navigate'){
  event.respondWith((async()=>{
   try{const response=await fetch(req);if(response.ok){const cache=await caches.open(CACHE);await cache.put('./index.html',response.clone())}return response}
   catch{return (await caches.match('./index.html'))||Response.error()}
  })());return;
 }
 if(!SHELL.some(item=>url.pathname===new URL(item,self.registration.scope).pathname))return;
 event.respondWith((async()=>{
  const cached=await caches.match(req,{ignoreSearch:true});if(cached)return cached;
  const response=await fetch(req);if(response.ok)(await caches.open(CACHE)).put(req,response.clone());return response;
 })());
});
