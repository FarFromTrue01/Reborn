// Ayarlar: ayrı bir localStorage anahtarında tutulur (kayıtlardan bağımsız).

export interface Settings {
  uiScale: number; // 0.8 .. 1.4
  textSpeed: number; // harf/saniye
  autoAdvance: boolean;
  music: number; // 0..1
  sfx: number;
  voice: number;
  shake: boolean;
  quality: 'low' | 'medium' | 'high';
  showFps: boolean;
}

const KEY = 'elonth.settings';

export const DEFAULT_SETTINGS: Settings = {
  uiScale: 1,
  textSpeed: 45,
  autoAdvance: false,
  music: 0.55,
  sfx: 0.8,
  voice: 0.7,
  shake: true,
  quality: 'high',
  showFps: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* depolama dolu */
  }
}
