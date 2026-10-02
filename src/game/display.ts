// Ekran ölçüleri. Oyun cihaz pikseli çözünürlüğünde çizilir;
// dünya kamerası TAMSAYI zoom kullanır (keskin piksel sanat),
// arayüz 720 birim yüksekliğe göre ölçeklenir.

type Listener = () => void;

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
  listeners: [] as Listener[],

  compute() {
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
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
};
