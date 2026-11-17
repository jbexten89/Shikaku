// Shikaku offline support: keeps the app working with no connection.
// Page: network first (so updates arrive), falls back to the saved copy.
// Icons, fonts and other files: served from the saved copy, refreshed in the background.
const CACHE='shikaku-v7';
const CORE=['./','./index.html','./manifest.json','./icons/apple-touch-icon.png','./icons/favicon-32.png','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

function timeout(ms){return new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms))}

self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  const isPage=req.mode==='navigate'||(url.origin===location.origin&&url.pathname.endsWith('.html'));
  if(isPage){
    e.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try{
        const res=await Promise.race([fetch(req,{cache:'no-cache'}),timeout(4000)]);
        if(res&&res.ok)cache.put('./index.html',res.clone());
        return res;
      }catch(err){
        return (await cache.match('./index.html'))||(await cache.match('./'))||Response.error();
      }
    })());
    return;
  }
  const sameOrigin=url.origin===location.origin;
  const isFont=url.host==='fonts.googleapis.com'||url.host==='fonts.gstatic.com';
  if(!sameOrigin&&!isFont)return;
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const hit=await cache.match(req);
    const net=fetch(req,isFont?{}:{cache:'no-cache'}).then(res=>{if(res&&(res.ok||res.type==='opaque'))cache.put(req,res.clone());return res}).catch(()=>null);
    if(hit){e.waitUntil(net);return hit}
    return (await net)||Response.error();
  })());
});
