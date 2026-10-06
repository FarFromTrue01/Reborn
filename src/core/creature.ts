import {
  addStats, critChance, dexAttackSpeedMult, agiMoveMult, maxHP, maxMP, maxStamina, zeroStats,
  luckyMissChance, dropChanceMult, spellAreaMult, baseHP, STAT_KEYS, type Stats,
} from './formulas';
import { aggregateFx, type SkillFx } from './skills';
import { EQUIP_SLOTS, type CreatureData, type WeaponType, type EquipSlot } from './types';
import { ITEMS } from '../data/items';
import { TITLES } from '../data/titles';
import { divineStat, movementWithDivine, overflowBonuses } from './divine';

export interface DivineContext {
  level: number;
}

export interface Derived {
  stats: Stats; // toplam (level + ekipman + skill + title)
  statSources: Record<string, Partial<Stats>>;
  maxHp: number;
  maxMp: number;
  maxStamina: number;
  def: number;
  weaponDmg: [number, number];
  weaponType: WeaponType | null;
  weaponName: string;
  crit: number;
  luckyMiss: number;
  dropMult: number;
  attackSpeed: number;
  moveSpeed: number;
  dodgeWindowMult: number;
  slowmoMult: number;
  dodgeCostMult: number;
  runCostMult: number;
  detectionMult: number;
  sneakMult: number;
  healMult: number;
  regenBonus: number;
  gatherBonus: number;
  areaMult: number;
  reachMult: number;
  expMult: number;
  /** Yay menzil çarpanı (Okçuluk C-). */
  bowRangeMult: number;
  /** Bütün skill'lerin toplam pasif etkisi (0.9.0; oyun kodu yeni mekanikleri buradan okur). */
  fx: SkillFx;
  /** Silah türüne göre hasar çarpanı (skill + title). */
  damagePct: Record<string, number>;
  // Divine (sadece trait sahibi için, aksi hâlde 1)
  divPower: number;
  divEndurance: number;
  divSpeed: number;
  divLearning: number;
  divAdaptation: number;
}

/** Bir canlının tüm statlarını kaynaklarından matematiksel olarak hesaplar. */
export function derive(c: CreatureData, divine?: DivineContext | null): Derived {
  const sources: Record<string, Partial<Stats>> = { Level: { ...c.alloc } };
  let stats = { ...c.alloc };
  let def = c.naturalDef ?? 0;
  let hpFlat = c.hpMod?.flat ?? 0;
  let hpPct = 0;
  let staminaFlat = 0;
  const dmgPct: Record<string, number> = {};
  let dodgeWin = 0, dodgeCost = 0, runCost = 0, detect = 0, sneak = 1.5, heal = 0, regen = 0, gather = 0, area = 0, reach = 0, expPct = 0;

  // Ekipman
  const eqStats = zeroStats();
  for (const slot of EQUIP_SLOTS) {
    const id = c.equipment[slot];
    if (!id) continue;
    const it = ITEMS[id];
    if (!it) continue;
    def += it.def ?? 0;
    hpFlat += it.hpFlat ?? 0;
    if (it.stats) for (const k of STAT_KEYS) eqStats[k] += it.stats[k] ?? 0;
  }
  if (STAT_KEYS.some((k) => eqStats[k])) sources['Ekipman'] = eqStats;
  stats = addStats(stats, eqStats);

  // Skill pasifleri (0.9.0: alan alan birleşmiş tablolar, ara kademe ilerlemesi; core/skills aggregateFx)
  const fx = aggregateFx(c.skills);
  const skStats = zeroStats();
  if (fx.stats) for (const k of STAT_KEYS) skStats[k] += fx.stats[k] ?? 0;
  for (const [key, v] of Object.entries(fx.dmg ?? {})) dmgPct[key] = (dmgPct[key] ?? 0) + (v ?? 0);
  staminaFlat += fx.staminaFlat ?? 0;
  hpPct += fx.hpPct ?? 0;
  dodgeWin += fx.dodgeWindowPct ?? 0;
  dodgeCost += fx.dodgeCostPct ?? 0;
  runCost += fx.runCostPct ?? 0;
  detect += fx.detectionPct ?? 0;
  if (fx.sneakMult) sneak = Math.max(sneak, fx.sneakMult);
  heal += fx.healPct ?? 0;
  regen += fx.regenPct ?? 0;
  gather += fx.gatherBonus ?? 0;
  area += fx.areaPct ?? 0;
  reach += fx.range?.spear ?? 0;
  if (STAT_KEYS.some((k) => skStats[k])) sources['Skill'] = skStats;
  stats = addStats(stats, skStats);

  // Title'lar
  const tiStats = zeroStats();
  for (const id of c.titles) {
    const t = TITLES[id];
    if (!t) continue;
    if (t.bonus.stats) for (const k of STAT_KEYS) tiStats[k] += t.bonus.stats[k] ?? 0;
    hpPct += t.bonus.hpPct ?? 0;
    if (t.bonus.damagePct) dmgPct.any = (dmgPct.any ?? 0) + t.bonus.damagePct;
    expPct += t.bonus.expPct ?? 0;
  }
  if (STAT_KEYS.some((k) => tiStats[k])) sources['Title'] = tiStats;
  stats = addStats(stats, tiStats);

  // Divine
  const hasDivine = !!divine && c.traits.includes('divine_paladin');
  const dl = hasDivine ? divine!.level : 0;
  const divPower = hasDivine ? divineStat('power', dl) : 1;
  const divEndurance = hasDivine ? divineStat('endurance', dl) : 1;
  const divSpeed = hasDivine ? divineStat('speed', dl) : 1;
  const divLearning = hasDivine ? divineStat('learning', dl) : 1;
  const divAdaptation = hasDivine ? divineStat('adaptation', dl) : 1;

  const mv = movementWithDivine(agiMoveMult(stats.AGI), divSpeed);
  const ov = overflowBonuses(mv.overflow);

  // Silah
  const wid = c.equipment.weapon;
  const w = wid ? ITEMS[wid] : null;
  const weaponDmg: [number, number] = w?.dmg ?? c.natural?.dmg ?? [1, 1];
  const weaponName = w?.name ?? c.natural?.name ?? 'Yumruk';
  const wt = w?.weaponType ?? null;
  const wCrit = (fx.crit?.any ?? 0) + (wt ? fx.crit?.[wt] ?? 0 : 0);
  const wSpd = 1 + (fx.atkSpd?.any ?? 0) + (wt ? fx.atkSpd?.[wt] ?? 0 : 0);

  return {
    stats,
    statSources: sources,
    maxHp: c.hpMod
      ? Math.max(1, Math.round((baseHP(c.level, stats.VIT) + hpFlat) * c.hpMod.mult * (1 + hpPct)))
      : maxHP(c.level, stats.VIT, { hpFlat, hpPct }),
    maxMp: maxMP(c.level, stats.MNA),
    maxStamina: maxStamina(stats.VIT, stats.AGI, { staminaFlat }),
    def,
    weaponDmg,
    weaponType: w?.weaponType ?? null,
    weaponName,
    crit: critChance(stats.DEX, stats.LUK, wCrit),
    luckyMiss: luckyMissChance(stats.LUK),
    dropMult: dropChanceMult(stats.LUK),
    attackSpeed: dexAttackSpeedMult(stats.DEX) * divSpeed * wSpd,
    moveSpeed: mv.move,
    dodgeWindowMult: (1 + dodgeWin) * ov.windowMult,
    slowmoMult: ov.slowmoMult,
    dodgeCostMult: 1 + dodgeCost,
    runCostMult: 1 + runCost,
    detectionMult: 1 + detect,
    sneakMult: sneak,
    healMult: 1 + heal,
    regenBonus: regen,
    gatherBonus: gather,
    areaMult: spellAreaMult(stats.INT) * (1 + area),
    reachMult: 1 + reach,
    expMult: 1 + expPct,
    bowRangeMult: 1 + (fx.range?.bow ?? 0),
    fx,
    damagePct: dmgPct,
    divPower,
    divEndurance,
    divSpeed,
    divLearning,
    divAdaptation,
  };
}

/** Bir saldırı türü için skill+title hasar çarpanı. */
export function skillDamageMult(d: Derived, kind: WeaponType | 'fire' | 'spell' | 'ice' | 'lightning' | null): number {
  let m = 1 + (d.damagePct.any ?? 0);
  if (kind) m += d.damagePct[kind] ?? 0;
  // element büyüleri genel "büyü hasarı" bonusunu da alır
  if (kind === 'fire' || kind === 'ice' || kind === 'lightning') m += d.damagePct.spell ?? 0;
  return m;
}

export function slotFor(itemSlot: string, c: CreatureData): EquipSlot {
  if (itemSlot === 'ring') return c.equipment.ring1 ? (c.equipment.ring2 ? 'ring1' : 'ring2') : 'ring1';
  return itemSlot as EquipSlot;
}
