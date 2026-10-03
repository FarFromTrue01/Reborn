// Ayarlar: ayrı bir localStorage anahtarında tutulur (kayıtlardan bağımsız). Sürümlüdür.

export interface Settings {
  /** Ayar sürümü (göç için). */
  v: number;
  uiScale: number; // 0.8 .. 1.4
  textSpeed: number; // harf/saniye
  autoAdvance: boolean;
  music: number; // 0..1
  sfx: number;
  voice: number;
  shake: boolean;
  quality: 'low' | 'medium' | 'high';
  showFps: boolean;
  /** Joystick: sol altta sabit (dokunmatik cihazlarda varsayılan) ya da dokunulan yerde belirir. */
  joystick: 'float' | 'fixed';
  /** Oyuncu joystick modunu ayarlardan bilerek seçti mi? (Göçte seçimine dokunulmaz.) */
  joyChosen: boolean;
  /** Joseph'in yürüme/koşma hızı çarpanı (0.75–2.0). */
  moveSpeed: number;
  /** Yardımlı savaş (C5): saldırıda menzildeki en yakın düşmana dön. */
  assistCombat: boolean;
  /** Geliştirici modu (C6): başlık ekranında sürüme 7 kez dokununca açılır. */
  devMode: boolean;
}

const KEY = 'elonth.settings';
export const SETTINGS_VERSION = 2;

export const MOVE_SPEED_MIN = 0.75;
export const MOVE_SPEED_MAX = 2;

export function isTouchDevice(): boolean {
  try {
    return (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || (typeof window !== 'undefined' && 'ontouchstart' in window);
  } catch {
    return false;
  }
}

export function defaultSettings(touch = isTouchDevice()): Settings {
  return {
    v: SETTINGS_VERSION,
    uiScale: 1,
    textSpeed: 45,
    autoAdvance: false,
    music: 0.55,
    sfx: 0.8,
    voice: 0.7,
    shake: true,
    quality: 'high',
    showFps: false,
    joystick: touch ? 'fixed' : 'float',
    joyChosen: false,
    moveSpeed: 1,
    assistCombat: true,
    devMode: false,
  };
}

/** @deprecated testler ve eski kod için: dokunmatik olmayan varsayılanlar. */
export const DEFAULT_SETTINGS: Settings = defaultSettings(false);

/**
 * Ayar değerlerini geçerli aralığa çeker ve eski sürümleri taşır.
 * - Bilinmeyen joystick değeri cihazın varsayılanına döner (dokunmatikte sabit).
 * - Sürüm 1 (0.2.0) ayarlarında oyuncu bilerek seçim yapmadıysa dokunmatik cihazda bir kez 'fixed' yapılır.
 */
export function sanitizeSettings(s: Partial<Settings> & Record<string, any>, touch = isTouchDevice()): Settings {
  const def = defaultSettings(touch);
  const r: Settings = { ...def, ...s } as Settings;
  const ver = typeof s.v === 'number' ? s.v : 1;
  if (r.joystick !== 'fixed' && r.joystick !== 'float') r.joystick = def.joystick;
  if (ver < 2) {
    if (touch && !s.joyChosen) r.joystick = 'fixed';
    if (typeof s.assistCombat !== 'boolean') r.assistCombat = true;
  }
  if (typeof r.moveSpeed !== 'number' || !isFinite(r.moveSpeed)) r.moveSpeed = 1;
  r.moveSpeed = Math.min(MOVE_SPEED_MAX, Math.max(MOVE_SPEED_MIN, r.moveSpeed));
  if (!['low', 'medium', 'high'].includes(r.quality)) r.quality = 'high';
  r.joyChosen = !!r.joyChosen;
  r.assistCombat = r.assistCombat !== false;
  r.devMode = !!r.devMode;
  r.v = SETTINGS_VERSION;
  return r;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings();
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* depolama dolu */
  }
}
