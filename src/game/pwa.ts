// PWA: service worker kaydı ve sürüm kontrolü.
// version.json her açılışta ağdan okunur; çalışan sürümden farklıysa yeni service worker indirilir.
// Yeni sürüm oyun ortasında devreye alınmaz: bekleyen sürüm oyuncu oyunda değilken (başlık ekranı)
// etkinleştirilir ve sayfa bir kez yenilenir. İlk kurulumda hiç yenileme yapılmaz.

declare const __APP_VERSION__: string;

export let updateAvailable = false;

/** controllerchange'de sayfa yenilensin mi? Yalnızca bir kontrolcü başkasıyla değiştiğinde (sürüm güncellemesi). */
export function shouldReloadOnControllerChange(hadController: boolean, alreadyReloading: boolean): boolean {
  return hadController && !alreadyReloading;
}

/** Bekleyen yeni sürüm şimdi etkinleştirilsin mi? */
export function shouldActivateWaiting(o: { waiting: boolean; controlled: boolean; inGame: boolean }): boolean {
  return o.waiting && o.controlled && !o.inGame;
}

let tryActivate: () => void = () => {};

/** Başlık ekranı çağırır: oyun dışındayken bekleyen güncellemeyi uygula. */
export function applyPendingUpdate() {
  tryActivate();
}

export function setupPWA(inGame: () => boolean = () => false) {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  let reloading = false;
  // Kontrolcü anlık izlenir: ilk kurulumda clients.claim() de controllerchange tetikler (önceden
  // kontrolcü yok → yenileme yok); sonraki gerçek sürüm değişiminde bir kez yenilenir.
  let controller = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const had = !!controller;
    controller = navigator.serviceWorker.controller;
    if (!shouldReloadOnControllerChange(had, reloading)) return;
    reloading = true;
    window.location.reload();
  });
  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      tryActivate = () => {
        const w = reg.waiting;
        if (w && shouldActivateWaiting({ waiting: true, controlled: !!navigator.serviceWorker.controller, inGame: inGame() })) w.postMessage('skipWaiting');
      };
      const check = async () => {
        try {
          const r = await fetch('./version.json', { cache: 'no-store' });
          const v = await r.json();
          if (v.full && v.full !== __APP_VERSION__) {
            updateAvailable = true;
            await reg.update();
            tryActivate();
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
          if (nw.state === 'installed') tryActivate();
        });
      });
      tryActivate();
    })
    .catch(() => {});
}

/**
 * Açılışta yüklenen görselleri service worker önbelleğine kopyalat (ilk ziyarette sayfa henüz SW
 * denetiminde olmadığı için bunlar önbelleğe girmemişti). Ağa yeniden gitmez.
 */
export function warmCache(urls: string[]) {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV || !urls.length) return;
  navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: 'warm', urls })).catch(() => {});
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

/** Tam ekrandan çık. */
export async function exitFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* */
  }
}

export function isFullscreen(): boolean {
  return !!document.fullscreenElement;
}

/** Tarayıcı tam ekranı destekliyor mu? (iPhone Safari desteklemez.) */
export function fullscreenSupported(): boolean {
  const el = document.documentElement as any;
  const ios = /iPhone|iPod/.test(navigator.userAgent) || (/iPad|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1 && !el.requestFullscreen);
  return !ios && !!(el.requestFullscreen || el.webkitRequestFullscreen) && (document as any).fullscreenEnabled !== false;
}

/** Ana ekrandan (PWA) mı açıldı? */
export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}
