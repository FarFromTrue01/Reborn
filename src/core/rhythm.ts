// 0.11.0 (A5, A6, A7): Joseph'in vuruş ritmi, basılı tutulan ağır saldırı ve karşı saldırı. Phaser'sız;
// uygulaması world/player.ts ve WorldScene.hitEnemy. Testler: tests/g7combat.test.ts.

// ----------------------------------------------------------------------------- A5: 3 vuruşluk ritim

/** Ritmin adımlarına göre saldırı süresi, hasar ve sendeleme çarpanları (1., 2., 3. vuruş). */
export const RHYTHM_STEPS = [
  { dur: 0.85, dmg: 1, stagger: 1 },
  { dur: 0.85, dmg: 1, stagger: 1 },
  { dur: 1.35, dmg: 1.4, stagger: 2 },
] as const;

/** Bir sonraki basış, savuruşun bu oranından itibaren kabul edilir (öncekiler yok sayılır). */
export const CHAIN_OPEN = 0.55;
/** Savuruş bittikten sonra bu kadar saniye daha kabul edilir. */
export const CHAIN_GRACE = 0.35;
/** 3. vuruştan sonra toparlanma: yalnızca kaçış. */
export const FINISHER_RECOVERY = 0.3;

export interface RhythmState {
  /** Sıradaki vuruşun adımı (0, 1, 2). */
  next: number;
  /** Devam eden savuruş: adımı, başlangıcı ve süresi; yoksa null. */
  swing: { step: number; start: number; dur: number } | null;
  /** Son savuruşun bitişi. */
  lastEnd: number;
  /** Pencerede basıldı: savuruş bitince sıradaki vuruş hemen çıkar. */
  buffered: boolean;
  /** 3. vuruştan sonraki toparlanmanın bitişi. */
  recoverUntil: number;
}

export function newRhythm(): RhythmState {
  return { next: 0, swing: null, lastEnd: -99, buffered: false, recoverUntil: -99 };
}

export type PressResult = 'start' | 'buffered' | 'ignored';

/**
 * Saldırı basışı. Savuruş sürerken: %55'ten önce yok sayılır, sonra tamponlanır. Savuruş yokken: toparlanmadaysa
 * yok sayılır, değilse sıradaki vuruş başlar (pencere kaçtıysa zincir 1. vuruşa döner).
 */
export function pressAttack(s: RhythmState, now: number): PressResult {
  if (s.swing) {
    const k = (now - s.swing.start) / s.swing.dur;
    if (k < CHAIN_OPEN) return 'ignored';
    s.buffered = true;
    return 'buffered';
  }
  if (now < s.recoverUntil) return 'ignored';
  if (now - s.lastEnd > CHAIN_GRACE) s.next = 0;
  return 'start';
}

/** Savuruş başladı: adımı döner (süre çarpanı RHYTHM_STEPS[adım].dur ile uygulanmış süre verilir). */
export function beginSwing(s: RhythmState, now: number, dur: number): number {
  const step = s.next;
  s.swing = { step, start: now, dur };
  s.buffered = false;
  s.next = (step + 1) % 3;
  return step;
}

/**
 * Savuruş bitti. Dönen değer: tamponda basış varsa 'chain' (sıradaki vuruş hemen başlamalı), yoksa 'idle'.
 * 3. vuruştan sonra tampon silinir ve toparlanma başlar.
 */
export function endSwing(s: RhythmState, now: number): 'chain' | 'idle' {
  const sw = s.swing;
  s.swing = null;
  s.lastEnd = now;
  if (sw && sw.step === 2) {
    s.buffered = false;
    s.recoverUntil = now + FINISHER_RECOVERY;
    s.next = 0;
    return 'idle';
  }
  if (s.buffered) {
    s.buffered = false;
    return 'chain';
  }
  return 'idle';
}

/** Savuruş iptal (kaçış, vurulma, ağır saldırı): zincir sıfırlanır. */
export function breakRhythm(s: RhythmState): void {
  s.swing = null;
  s.buffered = false;
  s.next = 0;
}

/** Toparlanmada mı (yalnızca kaçış kullanılabilir)? */
export const recovering = (s: RhythmState, now: number) => now < s.recoverUntil;

// ----------------------------------------------------------------------------- A6: ağır saldırı (basılı tut)

/** Şarjın dolma süresi (sn). */
export const CHARGE_TIME = 0.5;
/** Şarj sırasında hareket çarpanı. */
export const CHARGE_MOVE_MULT = 0.4;
/** Ağır saldırının dayanıklılık bedeli (mevcut indirimlerle çarpılır). */
export const HEAVY_STAMINA = 18;
/** Ağır saldırının hasar çarpanı. */
export const HEAVY_DMG_MULT = 1.8;

export interface ChargeState {
  active: boolean;
  t: number;
}

export function newCharge(): ChargeState {
  return { active: false, t: 0 };
}

export const chargeFull = (c: ChargeState) => c.active && c.t >= CHARGE_TIME;
export const chargeRatio = (c: ChargeState) => (c.active ? Math.min(1, c.t / CHARGE_TIME) : 0);

/**
 * Her kare: `held` basılıyken şarj dolar. Bırakınca: doluysa 'fire' (ağır saldırı, bedel o anda ödenir), dolmadıysa
 * 'fizzle' (hiçbir şey olmaz, bedel yok). Şarj yokken basılınca başlar.
 */
export function chargeStep(c: ChargeState, held: boolean, dt: number): 'none' | 'fire' | 'fizzle' {
  if (held) {
    if (!c.active) {
      c.active = true;
      c.t = 0;
    } else c.t += dt;
    return 'none';
  }
  if (!c.active) return 'none';
  const full = c.t >= CHARGE_TIME;
  c.active = false;
  c.t = 0;
  return full ? 'fire' : 'fizzle';
}

/** Vurulma ya da kaçış şarjı iptal eder (bedel ödenmez). */
export function cancelCharge(c: ChargeState): void {
  c.active = false;
  c.t = 0;
}

// ----------------------------------------------------------------------------- A7: kusursuz kaçış → karşı saldırı

/** Kusursuz kaçıştan sonraki karşı saldırı penceresi (sn). */
export const COUNTER_WINDOW = 0.6;
/** Kaçınma A- ile pencere ve karşı vuruş hasarı. */
export const COUNTER_WINDOW_SKILLED = 1.0;
export const COUNTER_DMG_SKILLED = 1.3;

export function counterWindow(skilled: boolean): number {
  return skilled ? COUNTER_WINDOW_SKILLED : COUNTER_WINDOW;
}
