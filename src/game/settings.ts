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
  /** Joystick: dokunulan yerde belirir ya da sol altta sabit durur. */
  joystick: 'float' | 'fixed';
  /** Joseph'in yürüme/koşma hızı çarpanı (0.75–2.0). */
  moveSpeed: number;
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
  joystick: 'float',
  moveSpeed: 1,
};

export const MOVE_SPEED_MIN = 0.75;
export const MOVE_SPEED_MAX = 2;

/** Ayar değerlerini geçerli aralığa çeker (bozuk/eski kayıtlar için). */
export function sanitizeSettings(s: Settings): Settings {
  const r = { ...DEFAULT_SETTINGS, ...s };
  if (r.joystick !== 'fixed') r.joystick = 'float';
  if (typeof r.moveSpeed !== 'number' || !isFinite(r.moveSpeed)) r.moveSpeed = 1;
  r.moveSpeed = Math.min(MOVE_SPEED_MAX, Math.max(MOVE_SPEED_MIN, r.moveSpeed));
  return r;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return sanitizeSettings(JSON.parse(raw));
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
