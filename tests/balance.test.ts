// Grup 2 (0.4.0) denge tablosu: yaratık HP/hasar/rütbe, silah hasarları, ilk dövüşlerin vuruş sayıları.
import { describe, it, expect } from 'vitest';
import { MONSTERS, monsterRank } from '../src/data/monsters';
import { createMonster, dropTable } from '../src/core/monster';
import { derive } from '../src/core/creature';
import { newJoseph } from '../src/core/state';
import { ITEMS } from '../src/data/items';
import {
  UNARMED_DAMAGE, WEAPON_DAMAGE_BY_RANK, physicalDamage, mitigatedDamage, roundDamage, applyDamage, STAT_POINTS_PER_LEVEL, SP_PER_LEVEL,
} from '../src/core/formulas';
import { subRankToString } from '../src/core/ranks';
import { skillDamageMult, type Derived } from '../src/core/creature';
import { questDef } from '../src/data/quests';

/** Rastgeleliksiz vuruş: verilen taban hasarla (aralıktan seçilmiş) kritik/ıskasız. */
function hit(att: Derived, attLevel: number, def: Derived, base: number): number {
  const raw = physicalDamage({ weaponBase: base, str: att.stats.STR, skillMult: skillDamageMult(att, att.weaponType), traitMult: att.divPower });
  return roundDamage(mitigatedDamage(raw, def.def, attLevel, def.divEndurance));
}

const TABLE: [id: string, level: number, hp: number, dmg: [number, number], rank: string][] = [
  ['rat', 0, 1, [1, 1], 'G-'],
  ['barn_rat', 0, 1, [1, 1], 'G-'],
  ['rabbit', 0, 1, [1, 1], 'G-'],
  ['slime', 0, 2, [1, 1], 'G-'],
  ['slime', 1, 3, [1, 1], 'G-'],
  ['field_rat', 0, 2, [1, 2], 'G'],
  ['giant_rat', 1, 3, [1, 2], 'G'],
  ['wolf', 1, 6, [1, 2], 'G+'],
  ['wolf', 2, 9, [1, 2], 'G+'],
  ['goblin', 1, 5, [1, 3], 'G+'],
  ['goblin', 2, 7, [1, 3], 'G+'],
  ['goblin_shaman', 2, 4, [2, 3], 'F-'],
  ['goblin_chief', 3, 15, [2, 5], 'F+'],
];

describe('Yaratık tablosu (hedef değerler)', () => {
  for (const [id, lv, hp, dmg, rank] of TABLE) {
    it(`${MONSTERS[id].name} Lv${lv}: ${hp} HP, ${dmg[0]}–${dmg[1]} hasar, ${rank}`, () => {
      const c = createMonster(id, Math.random, lv);
      expect(derive(c).maxHp).toBe(hp);
      expect(c.hp).toBe(hp);
      expect(MONSTERS[id].natural.dmg).toEqual(dmg);
      expect(subRankToString(monsterRank(MONSTERS[id]))).toBe(rank);
      // Appraisal direnci rütbeyle aynı
      expect(c.skills.find((s) => s.id === 'appraisal')!.rank).toBe(monsterRank(MONSTERS[id]));
    });
  }
  it('Tablo tüm yaratıkları ve level aralıklarını kapsıyor', () => {
    for (const m of Object.values(MONSTERS))
      for (let lv = m.levels[0]; lv <= m.levels[1]; lv++) expect(TABLE.some(([id, l]) => id === m.id && l === lv), `${m.id} Lv${lv}`).toBe(true);
  });
  it('Kimse son canda kaçmıyor (fleeAt yok); tavşan ürkek ama köşeye sıkışınca döner', () => {
    for (const m of Object.values(MONSTERS)) expect((m as any).fleeAt, m.id).toBeUndefined();
    expect(MONSTERS.rabbit.behavior).toBe('flee');
    expect(MONSTERS.rabbit.cornered).toEqual({ after: 8, range: 3, calm: 5, calmRange: 5 });
    expect(MONSTERS.rabbit.natural.dmg).toEqual([1, 1]);
  });
  it('Tarla Faresi: Lv0, m_rat ×1,2, saldırgan, sürü değil; kuyruk yüksek, taş düşük şans', () => {
    const f = MONSTERS.field_rat;
    expect(f.levels).toEqual([0, 0]);
    expect(f.sprite).toBe('m_rat');
    expect(f.scale).toBe(1.2);
    expect(f.behavior).toBe('aggressive');
    const tail = f.drops.find((d) => d.id === 'rat_tail')!;
    const stone = f.drops.find((d) => d.id === 'small_stone')!;
    expect(tail.chance).toBeGreaterThanOrEqual(0.7);
    expect(stone.chance).toBeLessThanOrEqual(0.1);
  });
  it('Drop tablosu LUK çarpanıyla, en fazla %100', () => {
    const t = dropTable(MONSTERS.rat, 2);
    expect(t.find((l) => l.id === 'rat_tail')!.chance).toBe(1);
    expect(t.find((l) => l.special)!.id).toBe('gnawed_ring');
  });
  it('f_wolves görevi artık 5 tarla faresi (kurtlar dünyada kalıyor)', () => {
    const q = questDef('f_wolves')!;
    const kill = q.objectives.find((o) => o.type === 'kill')!;
    expect(kill.target).toBe('field_rat');
    expect(kill.count).toBe(5);
    expect(MONSTERS.wolf).toBeTruthy();
  });
});

describe('Silah hasarları', () => {
  it('Yumruk [1,1] kalıyor; rütbe aralıkları ikiye katlandı', () => {
    expect(UNARMED_DAMAGE).toEqual([1, 1]);
    expect(WEAPON_DAMAGE_BY_RANK).toEqual({
      G: [2, 4], F: [4, 10], E: [10, 20], D: [20, 40], C: [40, 80], B: [80, 150], A: [150, 300], S: [300, 600], X: [600, 1200],
    });
  });
  it('Her silah kendi rütbesinin aralığında; Çatlak Sopa [2,2]', () => {
    expect(ITEMS.cracked_stick.dmg).toEqual([2, 2]);
    for (const it of Object.values(ITEMS)) {
      if (!it.dmg) continue;
      const [lo, hi] = WEAPON_DAMAGE_BY_RANK[it.rank!];
      expect(it.dmg[0], it.id).toBeGreaterThanOrEqual(lo);
      expect(it.dmg[1], it.id).toBeLessThanOrEqual(hi);
    }
  });
  it('L0 Joseph (Divine Güç ×0,5): yumruk 0,5 · sopa 1,0 · G 1,0–2,0 · F 2,0–5,0', () => {
    const rat = derive(createMonster('rat', Math.random, 0));
    const withWeapon = (id?: string) => {
      const j = newJoseph();
      if (id) j.equipment.weapon = id;
      return derive(j, { level: 0 });
    };
    expect(hit(withWeapon(), 0, rat, 1)).toBe(0.5);
    expect(hit(withWeapon('cracked_stick'), 0, rat, 2)).toBe(1);
    expect(hit(withWeapon('rusty_shortsword'), 0, rat, 2)).toBe(1);
    expect(hit(withWeapon('rusty_shortsword'), 0, rat, 4)).toBe(2);
    expect(hit(withWeapon('iron_shortsword'), 0, rat, 4)).toBe(2);
    expect(hit(withWeapon('iron_shortsword'), 0, rat, 10)).toBe(5);
  });
});

describe('İlk dövüşler', () => {
  const joseph = () => derive(newJoseph(), { level: 0 });
  const hitsToKill = (hp: number, dmg: number) => {
    let n = 0;
    while (hp > 0) {
      hp = applyDamage(hp, dmg);
      n++;
    }
    return n;
  };
  it('Fare yumrukla 2, sopayla 1 vuruşta ölür', () => {
    const rat = derive(createMonster('rat', Math.random, 0));
    const j = newJoseph();
    expect(hitsToKill(rat.maxHp, hit(derive(j, { level: 0 }), 0, rat, 1))).toBe(2);
    j.equipment.weapon = 'cracked_stick';
    expect(hitsToKill(rat.maxHp, hit(derive(j, { level: 0 }), 0, rat, 2))).toBe(1);
  });
  it('Joseph 5 HP: fare 5 ısırıkta, dev fare 3–5 ısırıkta öldürür', () => {
    const j = joseph();
    expect(j.maxHp).toBe(5);
    const rat = derive(createMonster('rat', Math.random, 0));
    expect(hitsToKill(j.maxHp, hit(rat, 0, j, 1))).toBe(5);
    const gr = derive(createMonster('giant_rat', Math.random, 1));
    expect(hitsToKill(j.maxHp, hit(gr, 1, j, 2))).toBe(3);
    expect(hitsToKill(j.maxHp, hit(gr, 1, j, 1))).toBe(5);
  });
  it('Level başına 6 stat puanı, 1 SP', () => {
    expect(STAT_POINTS_PER_LEVEL).toBe(6);
    expect(SP_PER_LEVEL).toBe(1);
  });
});
