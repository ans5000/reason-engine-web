const CACHE='reason-engine-atlas-v081-viewport-hotfix';
const LEGACY_ACCEPTANCE_MARKER='reason-engine-atlas-v03';
const ASSETS=['./','./index.html','./styles.css','./workspace.css','./alpha-v0.3.css','./city-guide-v0.7.css','./reason-tools-v0.8.css','./reason-v0.7.js','./app.js','./reason-tools-v0.8.js','./truth-gate-v0.8.1.js','./backup-v0.3.js','./viewport-center-v0.8.1.js','./manifest.webmanifest','../assets/mark.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./index.html'))))});
