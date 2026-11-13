// Folio app shell. Books live in IndexedDB and never enter Cache Storage.
const CACHE='folio-shell-v33';
const SHELL=['./index.html','./manifest.webmanifest','./icons/folio-192.png','./icons/folio-512.png'];
const HOME=new URL('./index.html',self.registration.scope).pathname;
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 // If any required file fails, don't activate a broken offline update.
 await cache.addAll(SHELL.map(url=>new Request(url,{cache:'reload'})));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith('folio-shell-')&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return;
 const isHome=url.pathname===HOME||url.pathname===new URL('./',self.registration.scope).pathname;
 if(req.mode==='navigate'){
  if(!isHome)return;
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   const saved=await cache.match('./index.html');
   if(saved)return saved; // Immediate offline launch; updates arrive via versioned SW.
   try{return await fetch(req)}catch{return Response.error()}
  })());return;
 }
 if(!SHELL.some(item=>url.pathname===new URL(item,self.registration.scope).pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const cached=await cache.match(req,{ignoreSearch:true});
  if(cached)return cached;
  const response=await fetch(req);
  if(response.ok)await cache.put(req,response.clone());
  return response;
 })());
});
