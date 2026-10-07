import { zeroStats, addStats, luckOutcome } from './formulas';
import { MONSTERS, monsterRank, type MonsterDef } from '../data/monsters';
import type { CreatureData } from './types';
import { derive } from './creature';

export function monsterDef(id: string): MonsterDef {
  const m = MONSTERS[id];
  if (!m) throw new Error('Bilinmeyen canavar: ' + id);
  return m;
}

export function randInt(min: number, max: number, rand: () => number = Math.random): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/** Bir canavar örneği oluşturur; HP level tablosundan (hpByLevel), MP formülden. */
export function createMonster(id: string, rand: () => number = Math.random, forceLevel?: number): CreatureData {
  const d = monsterDef(id);
  const level = forceLevel ?? randInt(d.levels[0], d.levels[1], rand);
  const alloc = addStats(zeroStats(), d.statsByLevel[level] ?? {});
  const c: CreatureData = {
    id: d.id,
    name: d.name,
    race: 'Canavar',
    gender: d.gender ?? '—',
    age: null,
    level,
    exp: 0,
    alloc,
    unspent: 0,
    sp: 0,
    hp: 1,
    mp: 0,
    skills: [{ id: 'appraisal', rank: monsterRank(d), exp: 0 }],
    traits: [],
    titles: d.title ? [d.title] : [],
    equipment: {},
    inventory: {},
    guildRank: null,
    hpFixed: d.hpByLevel[level],
    natural: d.natural,
    naturalDef: d.naturalDef,
  };
  const dv = derive(c);
  c.hp = dv.maxHp;
  c.mp = dv.maxMp;
  return c;
}

/** Level aralığı içinde EXP: düşük level → aralığın alt kısmı. */
export function monsterExp(d: MonsterDef, level: number, rand: () => number = Math.random): number {
  const span = d.levels[1] - d.levels[0];
  const t = span === 0 ? 0.5 : (level - d.levels[0]) / span;
  const lo = d.exp[0] + (d.exp[1] - d.exp[0]) * Math.max(0, t - 0.35);
  const hi = d.exp[0] + (d.exp[1] - d.exp[0]) * Math.min(1, t + 0.35);
  return Math.round(lo + (hi - lo) * rand());
}

export interface DropResult {
  /** luck: yalnızca LUK çarpanı sayesinde düştü (B9 "Şans!"). */
  items: { id: string; qty: number; special?: boolean; luck?: boolean }[];
  money: number;
}

export interface DropLine {
  id: string;
  /** LUK çarpanı uygulanmış düşme şansı (0..1). */
  chance: number;
  special: boolean;
}

/** Appraisal için drop tablosu: rollDrops ile aynı oranlar (LUK dahil, en fazla %100). */
export function dropTable(d: MonsterDef, dropMult: number): DropLine[] {
  const out: DropLine[] = d.drops.map((dr) => ({ id: dr.id, chance: Math.min(1, dr.chance * dropMult), special: false }));
  out.push({ id: d.special.id, chance: Math.min(1, d.special.chance * dropMult), special: true });
  return out;
}

export function rollDrops(d: MonsterDef, dropMult: number, rand: () => number = Math.random): DropResult {
  const items: DropResult['items'] = [];
  for (const dr of d.drops) {
    const r = luckOutcome(rand(), dr.chance, dr.chance * dropMult);
    if (r !== 'miss') {
      const q = dr.qty ? randInt(dr.qty[0], dr.qty[1], rand) : 1;
      items.push({ id: dr.id, qty: q, ...(r === 'luck' ? { luck: true } : {}) });
    }
  }
  const sr = luckOutcome(rand(), d.special.chance, d.special.chance * dropMult);
  if (sr !== 'miss') items.push({ id: d.special.id, qty: 1, special: true, ...(sr === 'luck' ? { luck: true } : {}) });
  let money = 0;
  if (d.money && rand() < d.money[2]) money = randInt(d.money[0], d.money[1], rand);
  return { items, money };
}

/**
 * EXP dağıtımı: çoğu en çok hasarı verene gider.
 * damageBy: saldırgan id → verdiği hasar. En çok vuran %70 + kalan payı orantılı.
 */
export function splitExp(total: number, damageBy: Record<string, number>): Record<string, number> {
  const ids = Object.keys(damageBy).filter((k) => damageBy[k] > 0);
  const out: Record<string, number> = {};
  if (ids.length === 0) return out;
  if (ids.length === 1) {
    out[ids[0]] = total;
    return out;
  }
  const sum = ids.reduce((a, k) => a + damageBy[k], 0);
  const top = ids.reduce((a, k) => (damageBy[k] > damageBy[a] ? k : a), ids[0]);
  const bonus = Math.round(total * 0.4);
  let given = 0;
  for (const k of ids) {
    const share = Math.floor(((total - bonus) * damageBy[k]) / sum);
    out[k] = share;
    given += share;
  }
  out[top] += total - given;
  return out;
}
