// Sayfa yaşam döngüsü: başka uygulamaya geçiş, WebGL bağlam kaybı ve sekmenin atılması.
//
// Android Chrome arka plandaki sekmenin WebGL bağlamını serbest bırakabilir ya da sekmeyi
// tamamen atabilir. Amaç: en kötü durumda bile ilerleme kaybolmasın ve oyuncu "çöktü" yerine
// "bir an duraksadı" hissetsin.
// - Sayfa gizlenince: dünya durur, ses susar, otomatik kayıt alınır.
// - Bağlam kaybolunca: kayıt + "Oyun yeniden yükleniyor…" perdesi; bağlam geri gelince (ya da
//   sayfa yeniden görünür olup bağlam hâlâ yoksa) sayfa bir kez yenilenir ve son kayıttan devam edilir.
// - Sekme atılıp yeniden açılınca (document.wasDiscarded) oyun içindeyse yine son kayıttan devam.

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const RESUME_KEY = 'elonth.resume';
const IN_GAME_KEY = 'elonth.inGame';
const RELOAD_AT_KEY = 'elonth.ctxReloadAt';
/** Bağlam kaybı yüzünden iki otomatik yenileme arasında en az bu kadar süre (döngüye girmesin). */
export const RELOAD_MIN_GAP_MS = 30000;

/** Açılışta başlık ekranı otomatik olarak son kayıttan devam etsin mi? (main.ts doldurur) */
export const Lifecycle = { resumeOnTitle: false };

/** Bağlam kaybından sonra otomatik yenileme yapılabilir mi? */
export function canAutoReload(now: number, lastReloadAt: number | null, minGap = RELOAD_MIN_GAP_MS): boolean {
  return lastReloadAt === null || !isFinite(lastReloadAt) || now - lastReloadAt > minGap;
}

/** Açılışta: otomatik devam bayrağını oku ve tüket. */
export function takeResumeFlag(ss: KV | null, wasDiscarded: boolean): boolean {
  if (!ss) return false;
  const r = ss.getItem(RESUME_KEY) === '1' || (wasDiscarded && ss.getItem(IN_GAME_KEY) === '1');
  ss.removeItem(RESUME_KEY);
  return r;
}

/** Sayfa gizlenirken: oyun içindeysek kayıt al ve bunu hatırla (sekme atılırsa devam için). */
export function onPageHidden(ss: KV | null, hooks: Pick<LifecycleHooks, 'inGame' | 'snapshot'>) {
  if (hooks.inGame()) {
    hooks.snapshot();
    ss?.setItem(IN_GAME_KEY, '1');
  } else ss?.removeItem(IN_GAME_KEY);
}

/** Bağlam kaybolunca: kayıt al, yenilemeden sonra otomatik devam et. */
export function onContextLost(ss: KV | null, hooks: Pick<LifecycleHooks, 'inGame' | 'snapshot'>) {
  if (hooks.inGame()) {
    hooks.snapshot();
    ss?.setItem(RESUME_KEY, '1');
  }
}

export interface LifecycleHooks {
  canvas: HTMLCanvasElement;
  /** Oyun dünyası açık mı? */
  inGame(): boolean;
  /** Güvenliyse otomatik kayıt al (ara sahne ortasında değilse). */
  snapshot(): boolean;
  /** Dünyayı durdur / sürdür (zaman, NPC, düşman). */
  pause(): void;
  resume(): void;
  /** Sesi sustur / aç. */
  mute(): void;
  unmute(): void;
}

function session(): KV | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

let curtain: HTMLDivElement | null = null;

function showCurtain(text: string, onTap?: () => void) {
  if (!curtain) {
    curtain = document.createElement('div');
    curtain.id = 'ctxcurtain';
    curtain.style.cssText = 'position:fixed;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;'
      + 'background:radial-gradient(ellipse at center,#15121f 0%,#07060b 70%);color:#d9b45a;font-family:Cinzel,Georgia,serif;font-size:clamp(18px,3vw,30px);letter-spacing:.12em;';
    document.body.appendChild(curtain);
  }
  curtain.textContent = text;
  curtain.onclick = onTap ? () => onTap() : null;
}

export function setupLifecycle(h: LifecycleHooks) {
  const ss = session();
  let lost = false;

  const reloadOnce = () => {
    const now = Date.now();
    const last = Number(ss?.getItem(RELOAD_AT_KEY) ?? NaN);
    if (!canAutoReload(now, isFinite(last) ? last : null)) {
      // kısa sürede ikinci kez: döngüye girme, oyuncuya bırak
      showCurtain('Grafik bağlamı yeniden kayboldu. İlerlemen kaydedildi — devam etmek için dokun.', () => location.reload());
      return;
    }
    ss?.setItem(RELOAD_AT_KEY, String(now));
    location.reload();
  };

  h.canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    if (lost) return;
    lost = true;
    onContextLost(ss, h);
    h.pause();
    h.mute();
    showCurtain('Oyun yeniden yükleniyor…');
  }, false);
  h.canvas.addEventListener('webglcontextrestored', () => {
    if (lost) reloadOnce();
  }, false);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      onPageHidden(ss, h);
      h.pause();
      h.mute();
      return;
    }
    if (lost) {
      // bağlam geri gelme olayı hiç gelmeyebilir: görünür olduktan kısa süre sonra yine kayıpsa yenile
      setTimeout(() => lost && reloadOnce(), 1500);
      return;
    }
    h.resume();
    h.unmute();
  });
  // Android uygulamayı kapatırken visibilitychange gelmeyebilir; pagehide son şans
  window.addEventListener('pagehide', () => onPageHidden(ss, h));
}
