// Hält die App offline bereit. Importierte Bilder und Fortschritt liegen in
// IndexedDB und werden hier nie angefasst.

const CACHE = 'fischtrainer-app-v3';
const WARTEZEIT_MS = 3000;
const DATEIEN = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'fische.json',
  'bildnachweise.json',
  'js/app.js',
  'js/logik.js',
  'js/speicher.js',
  'js/zip.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(DATEIEN.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen
      .filter((name) => name.startsWith('fischtrainer-app-') && name !== CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

// Online kommt immer die neueste Fassung, auch von fische.json. Ohne Netz oder
// bei sehr langsamem Netz antwortet der Zwischenspeicher.
async function antworten(request) {
  const cache = await caches.open(CACHE);
  const gespeichert = await cache.match(request, { ignoreSearch: true })
    ?? (request.mode === 'navigate' ? await cache.match('index.html') : undefined);

  // no-cache fragt beim Server nach, statt dem HTTP-Speicher des Browsers zu glauben.
  const netz = fetch(request.url, { cache: 'no-cache' }).then(async (antwort) => {
    if (antwort.ok && antwort.type === 'basic') await cache.put(request, antwort.clone());
    return antwort;
  });

  if (!gespeichert) return netz;

  const zeitlimit = new Promise((ok) => { setTimeout(() => ok(gespeichert), WARTEZEIT_MS); });
  return Promise.race([netz.catch(() => gespeichert), zeitlimit]);
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(antworten(event.request));
});
