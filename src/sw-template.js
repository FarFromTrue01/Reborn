// Reborn in Elonth service worker. Sürüm değişince önbellek yenilenir.
//
// Kurulumda yalnızca oyunun açılması için gerekenler önbelleğe alınır (CORE: sayfa, JS paketi,
// manifest, simgeler, yazı tipleri, başlık görselleri); en fazla 6 indirme aynı anda. Geri kalan
// her şey (karakterler, binalar, iç mekânlar, ses) ilk istendiğinde "önce önbellek" kuralıyla
// önbelleğe girer. Eskiden 147 dosyanın (~11 MB) hepsi aynı anda indiriliyordu: yavaş bağlantıda
// ağ tıkanıyor, kurulum yarıda kalıyordu.
//
// Yeni sürüm kendiliğinden devreye girmez (install içinde skipWaiting yok): sayfa uygun anda
// (oyun dışında) 'skipWaiting' mesajı gönderir; ilk kurulumda bekleme zaten yoktur.
const VERSION = '__VERSION__';
const CACHE = 'elonth-' + VERSION;
const CORE = __FILES__;
const PARALLEL = 6;

/** Sınırlı paralellikle önbelleğe ekle; biri başarısız olsa da diğerleri girsin. */
async function addAll(cache, files, parallel = PARALLEL, mode = 'reload') {
  let i = 0;
  const worker = async () => {
    while (i < files.length) {
      const f = files[i++];
      try {
        await cache.add(new Request(f, { cache: mode }));
      } catch (e) {
        /* çevrimdışı ya da eksik: ilk istekte yeniden denenir */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, files.length) }, worker));
}

/**
 * İlk ziyarette sayfa henüz bu SW'nin denetiminde değilken yüklenen görseller önbelleğe girmez.
 * Açılış bitince sayfa yüklediği adresleri gönderir; eksikler tarayıcı önbelleğinden (ağa
 * gitmeden, ikişer ikişer) kopyalanır. Böylece kurulumdan sonra çevrimdışı açılış da çalışır.
 */
async function warm(urls) {
  const c = await caches.open(CACHE);
  const missing = [];
  for (const u of urls) {
    try {
      const url = new URL(u, self.location.href);
      if (url.origin !== self.location.origin) continue;
      if (!(await c.match(url.href))) missing.push(url.href);
    } catch (e) {
      /* geçersiz adres */
    }
  }
  await addAll(c, missing, 2, 'default');
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => addAll(c, CORE)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('elonth-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  else if (e.data && e.data.type === 'warm' && Array.isArray(e.data.urls)) e.waitUntil(warm(e.data.urls));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // version.json her zaman ağdan (güncelleme kontrolü)
  if (url.pathname.endsWith('/version.json')) {
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req)));
    return;
  }
  // Sayfa: önce ağ, çevrimdışıysa önbellek
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((r) => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return r;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./')))
    );
    return;
  }
  // Diğerleri: önce önbellek, yoksa ağdan alıp önbelleğe koy
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok && r.status === 200) {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return r;
    }))
  );
});
