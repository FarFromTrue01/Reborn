// Dövüş çözümü: hasar formülleri çekirdek modülden gelir, burada uygulanır.
import { physicalDamage, spellDamage, mitigatedDamage, roundDamage, CRIT_MULT } from '../core/formulas';
import type { Derived } from '../core/creature';
import { skillDamageMult } from '../core/creature';
import type { WeaponType } from '../core/types';

export interface HitResult {
  damage: number;
  crit: boolean;
  miss: boolean;
  sneak: boolean;
  raw: number;
}

function roll(min: number, max: number, rand = Math.random) {
  return min + Math.floor(rand() * (max - min + 1));
}

/** Oyuncunun (veya herhangi bir saldırganın) fiziksel vuruşu. */
export function resolvePhysical(att: { d: Derived; level: number }, def: { d: Derived; level: number; luckyMiss?: number }, opts: {
  mult?: number; weak?: boolean; sneakMult?: number; forceCrit?: boolean; weaponType?: WeaponType | null; extraTrait?: number;
} = {}): HitResult {
  const missChance = def.luckyMiss ?? def.d.luckyMiss;
  if (Math.random() < missChance) return { damage: 0, crit: false, miss: true, sneak: false, raw: 0 };
  const base = roll(att.d.weaponDmg[0], att.d.weaponDmg[1]);
  const crit = opts.forceCrit || Math.random() < att.d.crit;
  const sneak = !!opts.sneakMult;
  const raw = physicalDamage({
    weaponBase: base,
    str: att.d.stats.STR,
    skillMult: skillDamageMult(att.d, opts.weaponType ?? att.d.weaponType) * (opts.mult ?? 1),
    traitMult: att.d.divPower * (opts.extraTrait ?? 1),
    crit,
    weakPoint: false,
  }) * (opts.weak ? 1.5 : 1) * (sneak ? opts.sneakMult! : 1);
  const m = mitigatedDamage(raw, def.d.def, att.level, def.d.divEndurance);
  return { damage: roundDamage(m), crit, miss: false, sneak, raw };
}

export function resolveSpell(att: { d: Derived; level: number }, def: { d: Derived; level: number }, base: [number, number] | number, opts: { mult?: number; element?: string } = {}): HitResult {
  if (Math.random() < def.d.luckyMiss) return { damage: 0, crit: false, miss: true, sneak: false, raw: 0 };
  const b = Array.isArray(base) ? roll(base[0], base[1]) : base;
  const crit = Math.random() < att.d.crit * 0.5;
  const kind = opts.element === 'fire' || opts.element === 'ice' || opts.element === 'lightning' ? opts.element : 'spell';
  const raw = spellDamage({
    spellBase: b,
    int: att.d.stats.INT,
    mna: att.d.stats.MNA,
    skillMult: skillDamageMult(att.d, kind as any) * (opts.mult ?? 1),
    traitMult: att.d.divPower,
    crit,
  });
  // Büyü: savunma yarı etkili
  const m = mitigatedDamage(raw, def.d.def * 0.5, att.level, def.d.divEndurance);
  return { damage: roundDamage(m), crit, miss: false, sneak: false, raw };
}

export { CRIT_MULT };
