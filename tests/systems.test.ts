import { describe, it, expect } from 'vitest';
import { parseSubRank, subRankToString, skillThreshold } from '../src/core/ranks';
import { addSkillExp, techniquesOf, usageExp, canLearnThisWeek, rollOffer, currentPassive } from '../src/core/skills';
import { appraisalView, noticesAppraisal } from '../src/core/appraisal';
import { createMonster, monsterExp, rollDrops, splitExp } from '../src/core/monster';
import { MONSTERS } from '../src/data/monsters';
import { derive } from '../src/core/creature';
import { MemoryStorage, readSave, writeSave, latestSlot, migrate } from '../src/core/save';
import { newGameState, CURRENT_SAVE_VERSION } from '../src/core/state';
import { advance, nextMorning, clockLabel } from '../src/core/time';

describe('Rütbeler', () => {
  it('Alt kademe dönüşümleri', () => {
    expect(subRankToString(0)).toBe('G-');
    expect(subRankToString(1)).toBe('G');
    expect(subRankToString(2)).toBe('G+');
    expect(subRankToString(3)).toBe('F-');
    expect(subRankToString(24)).toBe('X-');
    expect(subRankToString(25)).toBe('X');
    expect(parseSubRank('D-')).toBe(9);
    expect(parseSubRank('S+')).toBe(23);
    expect(() => parseSubRank('X+')).toThrow();
  });
  it('Skill EXP eşikleri', () => {
    expect(skillThreshold(parseSubRank('G-'))).toBe(15);
    expect(skillThreshold(parseSubRank('G+'))).toBe(15);
    expect(skillThreshold(parseSubRank('F-'))).toBe(40);
    expect(skillThreshold(parseSubRank('X-'))).toBe(1_000_000);
  });
});

describe('Skill gelişimi', () => {
  it('Eşik dolunca kademe atlar, artan devreder', () => {
    const r = addSkillExp({ id: 'fire_magic', rank: 0, exp: 10 }, 25);
    expect(r.state.rank).toBe(2);
    expect(r.state.exp).toBe(5);
    expect(r.rankUps).toEqual([1, 2]);
  });
  it('Ateş Büyüsü F-\'de alev püskürtmesi açılır, D-\'de Ateş Topu', () => {
    const r = addSkillExp({ id: 'fire_magic', rank: 2, exp: 0 }, 15);
    expect(subRankToString(r.state.rank)).toBe('F-');
    expect(r.unlocked.map((t) => t.technique)).toContain('flame_spray');
    expect(techniquesOf({ id: 'fire_magic', rank: parseSubRank('D-'), exp: 0 })).toEqual(['spark', 'flame_spray', 'fireball']);
  });
  it('Kılıç Ustalığı E\'ye kadar bonus vermez, C-\'de +%15', () => {
    expect(currentPassive({ id: 'sword_mastery', rank: parseSubRank('E+'), exp: 0 }).damagePct).toBeUndefined();
    expect(currentPassive({ id: 'sword_mastery', rank: parseSubRank('C-'), exp: 0 }).damagePct?.pct).toBe(0.15);
  });
  it('Kullanım EXP: boşa kullanım 0, zayıf hedef az, güçlü hedef çok', () => {
    expect(usageExp(1, null, 0)).toBe(0);
    expect(usageExp(1, 0, 5)).toBeLessThan(0.1);
    expect(usageExp(1, 2, 0)).toBeGreaterThan(usageExp(1, 0, 0));
    expect(usageExp(1, 0, 0, 0.5)).toBe(0.5);
  });
  it('Haftada en fazla 1 yeni skill', () => {
    expect(canLearnThisWeek(null, 1)).toBe(true);
    expect(canLearnThisWeek(0, 7)).toBe(false);
    expect(canLearnThisWeek(0, 8)).toBe(true);
  });
  it('Sistem teklifi en fazla 3 farklı, sahip olunmayan skill', () => {
    const o = rollOffer('common', ['stealth']);
    expect(o.length).toBe(3);
    expect(new Set(o.map((s) => s.id)).size).toBe(3);
    expect(o.every((s) => s.rarity === 'common' && s.id !== 'stealth')).toBe(true);
  });
});

describe('Appraisal', () => {
  const G = parseSubRank('G-');
  it('2+ harf yüksek: sadece Title', () => {
    const v = appraisalView(G, parseSubRank('E-'));
    expect(v.identity).toBe(false);
    expect(v.stats).toBe(false);
  });
  it('1 harf yüksek: kimlik ve level', () => {
    const v = appraisalView(G, parseSubRank('F'));
    expect(v.identity).toBe(true);
    expect(v.stats).toBe(false);
  });
  it('Aynı harf: statlar', () => {
    const v = appraisalView(G, parseSubRank('G+'));
    expect(v.stats).toBe(true);
    expect(v.skills).toBe(false);
  });
  it('1 harf düşük: skill ve envanter; 2+: EXP ilerlemesi', () => {
    expect(appraisalView(parseSubRank('F-'), G).skills).toBe(true);
    expect(appraisalView(parseSubRank('F-'), G).skillExp).toBe(false);
    expect(appraisalView(parseSubRank('E-'), G).skillExp).toBe(true);
  });
  it('Trait asla görünmez', () => {
    expect(appraisalView(parseSubRank('X'), G).traits).toBe(false);
  });
  it('Senin Appraisal\'ın yüksekse fark edersin', () => {
    expect(noticesAppraisal(parseSubRank('E-'), G)).toBe(true);
    expect(noticesAppraisal(G, parseSubRank('E-'))).toBe(false);
  });
});

describe('Canavarlar (belgedeki değerler)', () => {
  const hp = (id: string, lv: number) => derive(createMonster(id, Math.random, lv)).maxHp;
  it('Fare Lv0 HP 3', () => expect(hp('rat', 0)).toBe(3));
  it('Sümüksü Lv0–1 HP 4–6', () => {
    expect(hp('slime', 0)).toBeGreaterThanOrEqual(4);
    expect(hp('slime', 1)).toBeLessThanOrEqual(6);
  });
  it('Goblin Lv0–2 HP 2–10', () => {
    expect(hp('goblin', 0)).toBeGreaterThanOrEqual(2);
    expect(hp('goblin', 2)).toBeLessThanOrEqual(10);
  });
  it('EXP aralıkları', () => {
    for (const m of Object.values(MONSTERS)) {
      for (let lv = m.levels[0]; lv <= m.levels[1]; lv++) {
        for (const r of [0, 0.5, 0.999]) {
          const e = monsterExp(m, lv, () => r);
          expect(e).toBeGreaterThanOrEqual(m.exp[0]);
          expect(e).toBeLessThanOrEqual(m.exp[1]);
        }
      }
    }
  });
  it('Her canavarın özel dropu var', () => {
    for (const m of Object.values(MONSTERS)) expect(m.special.chance).toBeGreaterThan(0);
  });
  it('Drop LUK ile artar', () => {
    const d = rollDrops(MONSTERS.rat, 100, () => 0.5);
    expect(d.items.some((i) => i.special)).toBe(true);
  });
  it('EXP en çok vurana', () => {
    expect(splitExp(10, { a: 5 })).toEqual({ a: 10 });
    const s = splitExp(100, { a: 8, b: 2 });
    expect(s.a + s.b).toBe(100);
    expect(s.a).toBeGreaterThan(80);
  });
});

describe('Kayıt', () => {
  it('Yaz / oku', () => {
    const st = new MemoryStorage();
    const g = newGameState();
    g.player.wallet.bronze = 42;
    writeSave(st, 'manual1', g);
    const r = readSave(st, 'manual1')!;
    expect(r.player.wallet.bronze).toBe(42);
    expect(latestSlot(st)).toBe('manual1');
  });
  it('v1 kaydı göç eder', () => {
    const g: any = newGameState();
    delete g.gathered;
    delete g.respawns;
    g.saveVersion = 1;
    const m = migrate(JSON.parse(JSON.stringify(g)), 1);
    expect(m.gathered).toEqual({});
    expect(m.saveVersion).toBe(CURRENT_SAVE_VERSION);
  });
  it('Bozuk kayıt null döner', () => {
    const st = new MemoryStorage();
    st.setItem('elonth.save.auto', '{bozuk');
    expect(readSave(st, 'auto')).toBeNull();
  });
});

describe('Zaman', () => {
  it('Gün atlama ve sabah', () => {
    expect(advance({ day: 1, minute: 1430 }, 20)).toEqual({ day: 2, minute: 10 });
    expect(nextMorning({ day: 1, minute: 22 * 60 })).toEqual({ day: 2, minute: 360 });
    expect(nextMorning({ day: 2, minute: 60 })).toEqual({ day: 2, minute: 360 });
    expect(clockLabel({ day: 1, minute: 7 * 60 + 5 })).toBe('07:05');
  });
});

import { appraisalReady, claimAppraisalExp, APPRAISAL_COOLDOWN_MS } from '../src/core/appraisal';

describe('Appraisal spam koruması', () => {
  it('Aynı hedef için skill EXP günde bir kez', () => {
    const rec: Record<string, number> = {};
    expect(claimAppraisalExp(rec, 'vera', 3)).toBe(true);
    for (let i = 0; i < 20; i++) expect(claimAppraisalExp(rec, 'vera', 3)).toBe(false);
    expect(claimAppraisalExp(rec, 'lina', 3)).toBe(true);
    expect(claimAppraisalExp(rec, 'vera', 4)).toBe(true);
    expect(claimAppraisalExp(rec, 'vera', 4)).toBe(false);
  });
  it('~1.5 sn bekleme ve panel açıkken yeni panel yok', () => {
    expect(APPRAISAL_COOLDOWN_MS).toBe(1500);
    expect(appraisalReady(0, null, false)).toBe(true);
    expect(appraisalReady(1000, 0, false)).toBe(false);
    expect(appraisalReady(1500, 0, false)).toBe(true);
    expect(appraisalReady(99999, 0, true)).toBe(false);
  });
});

import { remapFog, NEW_WORLD_W, NEW_WORLD_H } from '../src/core/save';
import { WORLD_W, WORLD_H } from '../src/world/worldgen';

describe('Kayıt göçü v2 → v3', () => {
  it('Yeni dünya boyutu göç sabitleriyle aynı', () => {
    expect(NEW_WORLD_W).toBe(WORLD_W);
    expect(NEW_WORLD_H).toBe(WORLD_H);
  });
  it('Sis haritası aynı koordinatlarda kalır', () => {
    const oldW = 150, oldH = 110;
    const bits = new Uint8Array(Math.ceil((oldW * oldH) / 8));
    const set = (x: number, y: number) => { const i = y * oldW + x; bits[i >> 3] |= 1 << (i & 7); };
    set(95, 58); set(0, 0); set(149, 109);
    let s = '';
    for (const b of bits) s += String.fromCharCode(b);
    const out = atob(remapFog(btoa(s), oldW, oldH, NEW_WORLD_W, NEW_WORLD_H));
    const get = (x: number, y: number) => { const i = y * NEW_WORLD_W + x; return (out.charCodeAt(i >> 3) >> (i & 7)) & 1; };
    expect(get(95, 58)).toBe(1);
    expect(get(0, 0)).toBe(1);
    expect(get(149, 109)).toBe(1);
    expect(get(96, 58)).toBe(0);
  });
  it('Eski kayıt göç eder; lonca kaydı olan oyuncu yeni işleri bitirmiş sayılır', () => {
    const old: any = newGameState();
    old.saveVersion = 2;
    delete old.quickFood;
    old.flags = { guild_registered: true };
    const m = migrate(old, 2);
    expect(m.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(m.quickFood).toBeNull();
    expect(m.flags.bertram_done).toBe(true);
    expect(m.flags.farm_done).toBe(true);
  });
});
