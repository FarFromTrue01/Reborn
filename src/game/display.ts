// Ekran ölçüleri. Oyun cihaz pikseli çözünürlüğünde çizilir (en fazla grafik kalitesinin izin
// verdiği oranda); dünya kamerası TAMSAYI zoom kullanır (keskin piksel sanat),
// arayüz 720 birim yüksekliğe göre ölçeklenir.

type Listener = () => void;

/**
 * Grafik kalitesine göre çizim çözünürlüğü tavanı (cihaz pikseli / CSS pikseli).
 * dpr 3 olan bir tablette tam çözünürlük 9 kat piksel demek; Yüksek'te bile 2 ile sınırlı.
 */
export function qualityDprCap(q: 'low' | 'medium' | 'high'): number {
  return q === 'low' ? 1 : q === 'medium' ? 1.5 : 2;
}

export const Display = {
  dpr: 1,
  cssW: 960,
  cssH: 640,
  w: 960,
  h: 640,
  worldZoom: 2,
  uiZoom: 1,
  uiW: 960,
  uiH: 640,
  uiScaleSetting: 1,
  /** Çözünürlük tavanı (qualityDprCap). */
  dprCap: 2,
  listeners: [] as Listener[],
  /** main.ts kurar: compute + canvas yeniden boyutlandırma + emit. */
  refresh: null as (() => void) | null,

  compute() {
    this.dpr = Math.min(this.dprCap, window.devicePixelRatio || 1);
    this.cssW = Math.max(320, window.innerWidth);
    this.cssH = Math.max(240, window.innerHeight);
    this.w = Math.round(this.cssW * this.dpr);
    this.h = Math.round(this.cssH * this.dpr);
    this.worldZoom = Math.max(1, Math.round(this.h / 480));
    this.uiZoom = (this.h / 720) * this.uiScaleSetting;
    this.uiW = this.w / this.uiZoom;
    this.uiH = this.h / this.uiZoom;
  },

  onResize(fn: Listener) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  },

  emit() {
    for (const l of [...this.listeners]) l();
  },

  /**
   * Kalite ayarı çözünürlük tavanını değiştirdiyse canvas'ı yeniden boyutlandırır ve sahneleri
   * yeniden kurar (Ayarlar kapanınca çağrılır). Değişiklik yaptıysa true.
   */
  applyQuality(q: 'low' | 'medium' | 'high'): boolean {
    const cap = qualityDprCap(q);
    if (cap === this.dprCap) return false;
    this.dprCap = cap;
    if (this.refresh) this.refresh();
    else this.compute();
    return true;
  },
};
