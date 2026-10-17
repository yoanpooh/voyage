// Offline support: network first; the last copy when there is no network or it takes more than 4 s.
const CACHE = 'voyage-v2';
const PAGE = './';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([PAGE, './icon-180.png'])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('voyage-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Every link (#prenom.cle, ?p=…&k=…) is the same page: one copy, always the latest.
  const key = req.mode === 'navigate' ? PAGE : req;
  // Pages are revalidated with the server each time, so an update shows up at once.
  const net = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req);
  event.waitUntil(net.then((res) => {
    if (res.ok || res.type === 'opaque') {
      const copy = res.clone();
      return caches.open(CACHE).then((cache) => cache.put(key, copy));
    }
  }).catch(() => {}));
  event.respondWith(new Promise((resolve) => {
    let done = false;
    const give = (res) => { if (res && !done) { done = true; resolve(res); } };
    const fromCache = () => caches.match(key);
    const timer = setTimeout(() => fromCache().then(give), 4000);
    net.then((res) => { clearTimeout(timer); give(res); },
             () => { clearTimeout(timer); fromCache().then((hit) => give(hit || Response.error())); });
  }));
});
