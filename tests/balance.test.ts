// Grup 2 (0.4.0) denge tablosu: yaratık HP/hasar/rütbe, silah hasarları, ilk dövüşlerin vuruş sayıları.
// 0.10.0 (B5/B9/B11): yaratık HP'leri ×1,5 ve level başına doğrudan (hpByLevel), Joseph 10 HP, 4 stat puanı/level,
// yaratık ve yoldaş saldırı sıklığı ×0,75.
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
import { skillDamageMult, damageStat, type Derived } from '../src/core/creature';
import { questDef } from '../src/data/quests';
import { ATTACK_RATE_SCALE, COMPANION_COOLDOWN, COMPANION_WINDUP, COMPANION_DMG_MULT } from '../src/data/companions';
import { NPC_BY_ID } from '../src/data/npcs';

/** Rastgeleliksiz vuruş: verilen taban hasarla (aralıktan seçilmiş) kritik/ıskasız. */
function hit(att: Derived, attLevel: number, def: Derived, base: number): number {
  const raw = physicalDamage({ weaponBase: base, str: damageStat(att), skillMult: skillDamageMult(att, att.weaponType), traitMult: att.divPower });
  return roundDamage(mitigatedDamage(raw, def.def, attLevel, def.divEndurance));
}

const TABLE: [id: string, level: number, hp: number, dmg: [number, number], rank: string][] = [
  ['rat', 0, 1.5, [1, 1], 'G-'],
  ['barn_rat', 0, 1.5, [1, 1], 'G-'],
  ['rabbit', 0, 1.5, [1, 1], 'G-'],
  ['slime', 0, 3, [1, 1], 'G-'],
  ['slime', 1, 4.5, [1, 1], 'G-'],
  ['field_rat', 0, 3, [1, 2], 'G'],
  ['giant_rat', 1, 4.5, [1, 2], 'G'],
  ['wolf', 1, 9, [1, 2], 'G+'],
  ['wolf', 2, 13.5, [1, 2], 'G+'],
  ['goblin', 1, 7.5, [1, 3], 'G+'],
  ['goblin', 2, 10.5, [1, 3], 'G+'],
  ['goblin_shaman', 2, 6, [2, 3], 'F-'],
  ['goblin_chief', 3, 22.5, [2, 5], 'F+'],
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
  it('Her yaratığın her level\'ı için hpByLevel tanımlı (B9)', () => {
    for (const m of Object.values(MONSTERS))
      for (let lv = m.levels[0]; lv <= m.levels[1]; lv++) expect(m.hpByLevel[lv], `${m.id} Lv${lv}`).toBeGreaterThan(0);
  });
  it('Yaratık HP\'si 0.9.0 değerlerinin 1,5 katı (B5)', () => {
    const OLD: Record<string, number> = { 'rat/0': 1, 'slime/0': 2, 'slime/1': 3, 'field_rat/0': 2, 'giant_rat/1': 3, 'wolf/1': 6, 'wolf/2': 9, 'goblin/1': 5, 'goblin/2': 7, 'goblin_shaman/2': 4, 'goblin_chief/3': 15 };
    for (const [k, v] of Object.entries(OLD)) {
      const [id, lv] = k.split('/');
      expect(MONSTERS[id].hpByLevel[Number(lv)], k).toBeCloseTo(v * 1.5);
    }
  });
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
  it('Fare (1,5 HP) yumrukla 3, çatlak sopayla 2 vuruşta ölür (0.10.0)', () => {
    const rat = derive(createMonster('rat', Math.random, 0));
    expect(rat.maxHp).toBe(1.5);
    const j = newJoseph();
    expect(hitsToKill(rat.maxHp, hit(derive(j, { level: 0 }), 0, rat, 1))).toBe(3);
    j.equipment.weapon = 'cracked_stick';
    expect(hitsToKill(rat.maxHp, hit(derive(j, { level: 0 }), 0, rat, 2))).toBe(2);
  });
  it('Joseph 10 HP: fare 8 ısırıkta (eski 4), dev fare 4–7 ısırıkta öldürür', () => {
    const j = joseph();
    expect(j.maxHp).toBe(10);
    const rat = derive(createMonster('rat', Math.random, 0));
    expect(hitsToKill(j.maxHp, hit(rat, 0, j, 1))).toBe(8);
    const gr = derive(createMonster('giant_rat', Math.random, 1));
    expect(hitsToKill(j.maxHp, hit(gr, 1, j, 2))).toBe(4);
    expect(hitsToKill(j.maxHp, hit(gr, 1, j, 1))).toBe(7);
  });
  it('Erken dövüş adil (B5 + B11): sopayla fare sürüsü yenilir; çıplak yumrukla tek fare yenilir, sürü zor', () => {
    // basit süre modeli: Joseph'in saldırı süresi (0,42 sn / saldırı hızı) × vuruş sayısı;
    // fare: hazırlık + bekleme / ATTACK_RATE_SCALE (ortalama) her ısırıkta
    const rat = derive(createMonster('rat', Math.random, 0));
    const ratBite = MONSTERS.rat.windup + MONSTERS.rat.cooldown / ATTACK_RATE_SCALE;
    const jo = (weapon?: string) => {
      const j = newJoseph();
      if (weapon) j.equipment.weapon = weapon;
      return derive(j, { level: 0 });
    };
    const ttk = (d: Derived, base: number, n: number) => n * hitsToKill(rat.maxHp, hit(d, 0, rat, base)) * (0.42 / d.attackSpeed);
    const die = (n: number) => (hitsToKill(jo().maxHp, hit(rat, 0, jo(), 1)) / n) * ratBite;
    expect(ttk(jo(), 1, 1)).toBeLessThan(die(1));
    expect(ttk(jo('cracked_stick'), 2, 3)).toBeLessThan(die(3));
    // çıplak yumrukla üç fare: Joseph yine kazanır ama pay dar (en fazla 2 kat)
    expect(ttk(jo(), 1, 3)).toBeLessThan(die(3));
    expect(die(3) / ttk(jo(), 1, 3)).toBeLessThan(2.5);
  });
  it('Saldırı sıklığı ×0,75 (B11): yoldaş beklemesi [2,93, 3,73] sn, hazırlık aynı', () => {
    expect(ATTACK_RATE_SCALE).toBe(0.75);
    expect(COMPANION_COOLDOWN[0]).toBeCloseTo(2.933, 2);
    expect(COMPANION_COOLDOWN[1]).toBeCloseTo(3.733, 2);
    expect(COMPANION_WINDUP).toBe(0.4);
  });
  it('Yoldaşlar erken dövüşte hâlâ işe yarar: Vera ve Lina bir fareyi en çok iki vuruşta, dev fareyi birkaç vuruşta yener', () => {
    const vera = derive(NPC_BY_ID.vera.creature);
    const lina = derive(NPC_BY_ID.lina.creature);
    const rat = derive(createMonster('rat', Math.random, 0));
    const gr = derive(createMonster('giant_rat', Math.random, 1));
    for (const c of [vera, lina]) {
      const lo = hit(c, 3, rat, c.weaponDmg[0]) * COMPANION_DMG_MULT;
      expect(hitsToKill(rat.maxHp, roundDamage(lo))).toBeLessThanOrEqual(2);
      const avg = roundDamage(hit(c, 3, gr, (c.weaponDmg[0] + c.weaponDmg[1]) / 2) * COMPANION_DMG_MULT);
      expect(hitsToKill(gr.maxHp, avg)).toBeLessThanOrEqual(6);
    }
    // yaralı sahnesi: %25 can
    expect(Math.round(vera.maxHp * 0.25)).toBeGreaterThan(0);
  });
  it('Level başına 4 stat puanı (0.10.0), 1 SP', () => {
    expect(STAT_POINTS_PER_LEVEL).toBe(4);
    expect(SP_PER_LEVEL).toBe(1);
  });
});
