// Dövüş kuralları (saf): saldırı iptali, mükemmel kaçış iadesi, köşeye sıkışan hayvan.
// Uygulaması: WorldScene.hitEnemy / perfectDodge, world/enemy.ts. Testler: tests/combat.test.ts.

/** Bir düşmanın saldırısı iptal edildikten sonra yeniden iptal edilemeyeceği süre (sn). */
export const INTERRUPT_LOCKOUT_SEC = 1.2;

export interface InterruptCheck {
  /** Düşmanın o anki durumu: yalnızca 'windup' (hazırlık) iptal edilir, 'strike' (savurma) edilmez. */
  state: string;
  heavy: boolean;
  boss: boolean;
  /** Son iptalden bu yana geçen süre (sn). */
  sinceInterrupt: number;
}

/**
 * Vuruş düşmanın saldırısını keser mi?
 * - Yalnızca hazırlık (windup) sırasında.
 * - Boss'lar yalnızca ağır vuruşla.
 * - İptalden sonra 1,2 sn sersemleme beklemesi: o pencerede vuruş hasar ve geri tepme verir ama saldırı sürer.
 *   (hurt 0,25 sn sürdüğü için bu olmasa yüksek saldırı hızıyla düşman sonsuza kadar kilitlenirdi.)
 */
export function canInterrupt(c: InterruptCheck): boolean {
  if (c.state !== 'windup') return false;
  if (c.boss && !c.heavy) return false;
  return c.sinceInterrupt >= INTERRUPT_LOCKOUT_SEC;
}

/** Bir kaçış/atılmanın peşin ödenen bedeli; mükemmel kaçışta iade edilir. */
export interface EvadeCost {
  stamina: number;
  light: number;
}

/**
 * Mükemmel kaçış iadesi: ödenen bedel geri döner (en fazla bir kez) ve bekleyen bedel sıfırlanır.
 * Dönen değer iade edilecek miktardır.
 */
export function refundEvade(paid: EvadeCost): EvadeCost {
  const r = { stamina: paid.stamina, light: paid.light };
  paid.stamina = 0;
  paid.light = 0;
  return r;
}

export interface CorneredConfig {
  /** Bu kadar saniye kesintisiz kovalanınca döner. */
  after: number;
  /** Kovalama sayılan mesafe (karo). */
  range: number;
  /** Oyuncu bu kadar saniye uzak kalınca yeniden ürkekleşir. */
  calm: number;
  /** "Uzak" sayılan mesafe (karo). */
  calmRange: number;
}

export interface CorneredState {
  cornered: boolean;
  chaseT: number;
  calmT: number;
}

export function newCorneredState(): CorneredState {
  return { cornered: false, chaseT: 0, calmT: 0 };
}

/**
 * Köşeye sıkışma sayacı: ürkek hayvan `range` karo içinde `after` sn kesintisiz kovalanırsa saldırgana döner;
 * oyuncu `calmRange` karodan uzakta `calm` sn kalınca yeniden kaçmaya başlar. Durum değiştiyse true döner.
 */
export function corneredStep(s: CorneredState, cfg: CorneredConfig, distTiles: number, dt: number): boolean {
  if (!s.cornered) {
    s.chaseT = distTiles <= cfg.range ? s.chaseT + dt : 0;
    if (s.chaseT >= cfg.after) {
      s.cornered = true;
      s.chaseT = 0;
      s.calmT = 0;
      return true;
    }
    return false;
  }
  s.calmT = distTiles > cfg.calmRange ? s.calmT + dt : 0;
  if (s.calmT >= cfg.calm) {
    s.cornered = false;
    s.chaseT = 0;
    s.calmT = 0;
    return true;
  }
  return false;
}

/** 0.8.0 (C5): kaçışın dayanıklılık bedeli (dodgeCostMult yine uygulanır; eskiden 20). */
export const DODGE_COST = 7.5;
/** İki kaçış arasında en az bu kadar saniye (mükemmel kaçış penceresini etkilemez). */
export const DODGE_COOLDOWN = 0.8;

/** Kaçış yapılabilir mi: bekleme bitti ve dayanıklılık yeterli. */
export function dodgeReady(now: number, lastDodge: number, stamina: number, costMult = 1): { ok: boolean; cost: number; reason: 'cooldown' | 'stamina' | null } {
  const cost = DODGE_COST * costMult;
  if (now - lastDodge < DODGE_COOLDOWN) return { ok: false, cost, reason: 'cooldown' };
  if (stamina < cost) return { ok: false, cost, reason: 'stamina' };
  return { ok: true, cost, reason: null };
}
