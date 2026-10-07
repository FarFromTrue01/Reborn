// 0.11.0 (A3): sendeleme barı. Vuruşlar barı doldurur; dolunca düşman sersemler (saldıramaz, yürümez, %50 fazla
// hasar alır). Phaser'sız; uygulaması world/enemy.ts ve WorldScene.hitEnemy. Testler: tests/g7combat.test.ts.

/** Yaratık türüne göre sendeleme kapasitesi (talimattaki tablo). */
export const STAGGER_CAP: Record<string, number> = {
  rat: 2,
  barn_rat: 2,
  rabbit: 2,
  field_rat: 3,
  giant_rat: 4,
  slime: 4,
  goblin_shaman: 4,
  wolf: 5,
  goblin: 5,
  goblin_chief: 12,
};

/** Tabloda olmayan yaratık için. */
export const STAGGER_CAP_DEFAULT = 4;

/** Dolum miktarları. */
export const STAGGER_FILL = {
  normal: 1,
  /** Ritmin 3. vuruşu (A5). */
  finisher: 2,
  /** Basılı tutulan ağır saldırı (A6). */
  heavy: 3,
  /** Kusursuz kaçıştan sonraki karşı vuruş (A7). */
  counter: 3,
} as const;

/**
 * Yeteneklerin dolumu (1–3): tek hedefe güçlü vuruşlar 2–3, alan ve sürekli hasar 1.
 * Tabloda olmayan teknik 1 doldurur. PLAN.md'de aynı tablo.
 */
export const SKILL_STAGGER: Record<string, number> = {
  double_slash: 2,
  piercing_thrust: 3,
  sweep: 2,
  counter: 3,
  wind_cut: 1,
  gale_dance: 2,
  sky_sunder: 3,
  spark: 1,
  fireball: 2,
  inferno_ring: 1,
  ice_shard: 1,
  glacier_spear: 3,
  frost_ring: 1,
  static_bolt: 1,
  thunder_strike: 2,
  heaven_judgement: 3,
  /** Kutsal vuruş (Divine) ve diğerleri. */
  holy: 2,
};

/** Yeteneğin dolumu (tabloda yoksa 1). */
export const skillStagger = (techId: string | undefined) => (techId ? SKILL_STAGGER[techId] ?? 1 : 1);

/** 2 sn vurulmazsa bar saniyede 1 boşalır. */
export const STAGGER_DRAIN_DELAY = 2;
export const STAGGER_DRAIN_PER_SEC = 1;
/** Sersemleme süresi (sn); boss daha kısa. */
export const STUN_SEC = 1.2;
export const STUN_SEC_BOSS = 0.8;
/** Sersemlemiş düşman bu çarpanla hasar alır. */
export const STUN_DMG_MULT = 1.5;
/** Sersemleme bittikten sonra bu kadar saniye dolum yarıya iner (kilitlemeyi önler). */
export const AFTER_STUN_SEC = 3;
export const AFTER_STUN_FILL_MULT = 0.5;

export function staggerCap(monsterId: string): number {
  return STAGGER_CAP[monsterId] ?? STAGGER_CAP_DEFAULT;
}

export interface StaggerState {
  fill: number;
  /** Son vuruştan bu yana (sn). */
  sinceHit: number;
  /** Kalan sersemleme (sn); > 0 iken sersem. */
  stunT: number;
  /** Sersemleme sonrası azaltılmış dolum süresi (sn). */
  afterT: number;
}

export function newStagger(): StaggerState {
  return { fill: 0, sinceHit: 99, stunT: 0, afterT: 0 };
}

export const isStunned = (s: StaggerState) => s.stunT > 0;

/**
 * Vuruşun dolumu: sersemken bar dolmaz (sıfırlanmıştır); sersemleme sonrası 3 sn yarıya iner.
 * Bar dolarsa sersemleme başlar (bar sıfırlanır) ve true döner.
 */
export function addStagger(s: StaggerState, amount: number, cap: number, boss: boolean): boolean {
  if (amount <= 0 || s.stunT > 0) return false;
  s.sinceHit = 0;
  s.fill += amount * (s.afterT > 0 ? AFTER_STUN_FILL_MULT : 1);
  if (s.fill + 1e-9 >= cap) {
    s.fill = 0;
    s.stunT = boss ? STUN_SEC_BOSS : STUN_SEC;
    return true;
  }
  return false;
}

/** Her kare: boşalma, sersemleme ve sonrası sayaçları. Sersemleme bu adımda bittiyse true. */
export function tickStagger(s: StaggerState, dt: number): boolean {
  let ended = false;
  if (s.stunT > 0) {
    s.stunT -= dt;
    if (s.stunT <= 0) {
      s.stunT = 0;
      s.afterT = AFTER_STUN_SEC;
      ended = true;
    }
    return ended;
  }
  if (s.afterT > 0) s.afterT = Math.max(0, s.afterT - dt);
  s.sinceHit += dt;
  if (s.fill > 0 && s.sinceHit >= STAGGER_DRAIN_DELAY) {
    // gecikmeyi aşan kısım kadar boşalır
    const over = Math.min(dt, s.sinceHit - STAGGER_DRAIN_DELAY);
    s.fill = Math.max(0, s.fill - STAGGER_DRAIN_PER_SEC * over);
  }
  return ended;
}

/** Sersemlemiş düşmana hasar çarpanı. */
export function stunDamageMult(s: StaggerState): number {
  return s.stunT > 0 ? STUN_DMG_MULT : 1;
}
