// PWA: service worker kaydı ve sürüm kontrolü.
// version.json her açılışta ağdan okunur; çalışan sürümden farklıysa
// yeni service worker devreye alınır ve sayfa bir kez yenilenir.

declare const __APP_VERSION__: string;

export let updateAvailable = false;

export function setupPWA() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  let reloading = false;
  // İlk kurulumda (önceden kontrolcü yokken) yenileme yapma; sadece sürüm güncellemesinde yenile.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    reloading = true;
    window.location.reload();
  });
  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      const check = async () => {
        try {
          const r = await fetch('./version.json', { cache: 'no-store' });
          const v = await r.json();
          if (v.full && v.full !== __APP_VERSION__) {
            updateAvailable = true;
            await reg.update();
            if (reg.waiting) reg.waiting.postMessage('skipWaiting');
          }
        } catch {
          /* çevrimdışı */
        }
      };
      check();
      setInterval(check, 10 * 60 * 1000);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) nw.postMessage('skipWaiting');
        });
      });
    })
    .catch(() => {});
}

/** Tam ekran ve yatay kilit (dokunuşla çağrılmalı). */
export async function goFullscreen() {
  try {
    const el = document.documentElement as any;
    if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    const so = (screen as any).orientation;
    if (so?.lock) await so.lock('landscape').catch(() => {});
  } catch {
    /* desteklenmiyor */
  }
}
