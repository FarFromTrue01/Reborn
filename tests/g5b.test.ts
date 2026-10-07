// Grup 5B (0.9.0): arayüz yardımcıları ve skill sistemi kuralları.
import { describe, it, expect } from 'vitest';
import { guildBar, guildBarSegments, RANK_THRESHOLDS } from '../src/core/guild';

describe('lonca puan barı (Kısım 1, madde 6)', () => {
  it('bar mevcut rütbenin başından bir sonrakinin puanına', () => {
    const b = guildBar(54, 0);
    expect(b.lo).toBe(0);
    expect(b.hi).toBe(60);
    expect(b.frac).toBeCloseTo(0.9);
    const c = guildBar(105, 1);
    expect(c).toMatchObject({ lo: 60, hi: 150 });
    expect(c.frac).toBeCloseTo(0.5);
  });
  it('en yüksek rütbede bar dolu', () => {
    const top = RANK_THRESHOLDS.length - 1;
    expect(guildBar(999999, top)).toEqual({ lo: RANK_THRESHOLDS[top], hi: null, frac: 1 });
  });
  it('eşik geçilmezse tek dilim, önceki puandan yenisine', () => {
    const s = guildBarSegments(15, 45, 0);
    expect(s).toHaveLength(1);
    expect(s[0].from).toBeCloseTo(0.25);
    expect(s[0].to).toBeCloseTo(0.75);
  });
  it('eşik geçilince bar dolar ve yeni aralıkta baştan başlar', () => {
    const s = guildBarSegments(45, 75, 0);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ rank: 0, lo: 0, hi: 60, to: 1 });
    expect(s[1]).toMatchObject({ rank: 1, lo: 60, hi: 150, from: 0 });
    expect(s[1].to).toBeCloseTo(15 / 90);
  });
  it('terfisi yapılmamış (puanı zaten eşiğin üstünde) oyuncuda bar önce dolar', () => {
    const s = guildBarSegments(65, 70, 0);
    expect(s[0]).toMatchObject({ from: 1, to: 1 });
    expect(s[1].from).toBeCloseTo(5 / 90);
  });
});

import { plusOffsets, statParts } from '../src/core/statParts';

describe('statlarda renkli artılar (madde 10)', () => {
  it('dikey yerleşim: tek ortada, iki üst-orta/orta-alt arası, üç üst-orta-alt', () => {
    expect(plusOffsets(1)).toEqual([0]);
    expect(plusOffsets(2)).toEqual([-1 / 6, 1 / 6]);
    expect(plusOffsets(3)).toEqual([-1 / 3, 0, 1 / 3]);
  });
  it('sıra yeşil → sarı → mor; görünmeyen kaynağın artısı yok, temel stat kalır', () => {
    const src = { Level: { STR: 5 }, Skill: { STR: 2 }, Title: { STR: 3 }, Ekipman: { STR: 1 } };
    const all = statParts(src, 'STR');
    expect(all.base).toBe(5);
    expect(all.plus.map((p) => p.v)).toEqual([1, 3, 2]);
    expect(all.plus.map((p) => p.color)).toEqual(['#7ee07a', '#ffd75e', '#c99aff']);
    const onlyTitle = statParts(src, 'STR', { Ekipman: false, Title: true, Skill: false });
    expect(onlyTitle).toEqual({ base: 5, plus: [{ v: 3, color: '#ffd75e' }] });
  });
});

import { sortItems, nextSortKey, avgSellPrice } from '../src/core/itemSort';
import { ITEMS } from '../src/data/items';

describe('envanter ve dükkân sıralaması (madde 13–14)', () => {
  const ids = ['apple', 'iron_spear', 'herb', 'rusty_shortsword', 'linen_shirt'].filter((id) => ITEMS[id]);
  it('fiyata göre (ortalama satış fiyatı) azalan ve artan', () => {
    const d = sortItems(ids, ITEMS, { key: 'price', desc: true });
    for (let i = 1; i < d.length; i++) expect(avgSellPrice(ITEMS[d[i - 1]])).toBeGreaterThanOrEqual(avgSellPrice(ITEMS[d[i]]));
    const a = sortItems(ids, ITEMS, { key: 'price', desc: false });
    for (let i = 1; i < a.length; i++) expect(avgSellPrice(ITEMS[a[i - 1]])).toBeLessThanOrEqual(avgSellPrice(ITEMS[a[i]]));
  });
  it('ada göre Türkçe alfabe', () => {
    const r = sortItems(ids, ITEMS, { key: 'name', desc: false }).map((id) => ITEMS[id].name);
    expect(r).toEqual([...r].sort((x, y) => x.localeCompare(y, 'tr')));
  });
  it('rütbe: rütbesizler her iki yönde de sonda', () => {
    const withNone = [...ids, 'guild_letter'].filter((id) => ITEMS[id]);
    for (const desc of [true, false]) {
      const r = sortItems(withNone, ITEMS, { key: 'rank', desc });
      const firstNone = r.findIndex((id) => !ITEMS[id].rank);
      if (firstNone >= 0) expect(r.slice(firstNone).every((id) => !ITEMS[id].rank)).toBe(true);
    }
  });
  it('tür sırası: silah, zırh, ..., malzeme', () => {
    const r = sortItems(ids, ITEMS, { key: 'kind', desc: false });
    expect(ITEMS[r[0]].kind).toBe('weapon');
  });
  it('sırasız: eklenme sırası; düğme döngüsü', () => {
    expect(sortItems(ids, ITEMS, { key: null, desc: true })).toEqual(ids);
    expect([nextSortKey(null), nextSortKey('price'), nextSortKey('rank'), nextSortKey('kind'), nextSortKey('name')]).toEqual(['price', 'rank', 'kind', 'name', null]);
  });
});

// ============================================================================ KISIM 2 — skill sistemi
import {
  mergedPassive, techniquePower, techniqueMp, techniqueCost, rollOfferCards, rollRarity, OFFER_ODDS, OFFER_RARITIES,
  normalizeSkillExp, aggregateFx, sanitizeSlots, equippedTechniques, ownedTechniques, techniqueCooldown, type OfferSp,
} from '../src/core/skills';
import { SKILLS, TECHNIQUES } from '../src/data/skills';
import { SKILL_EXP_THRESHOLDS, parseSubRank as pr } from '../src/core/ranks';
import { mpRegenPerSec, maxMP } from '../src/core/formulas';
import { applyStatus, tickStatuses, statusMods, cleanseStatuses } from '../src/core/status';

/** Tekrarlanabilir rastgele (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('S1 nadirlikler', () => {
  it('dört nadirlik; epik skill\'ler (Buz, Nara) eksiksiz', () => {
    const by = (r: string) => Object.values(SKILLS).filter((s) => s.rarity === r).map((s) => s.id).sort();
    expect(by('common')).toEqual(['archery', 'athletics', 'evasion', 'first_aid', 'gathering', 'stealth']);
    expect(by('rare')).toEqual(['fire_magic', 'healing_magic', 'spear_mastery', 'sword_mastery']);
    expect(by('epic')).toEqual(['ice_magic', 'war_cry']);
    expect(by('legendary')).toEqual(['iron_body', 'storm_blade', 'thunder_magic']);
    for (const id of ['ice_magic', 'war_cry']) {
      expect(SKILLS[id].icon).toBeTruthy();
      expect(SKILLS[id].desc.length).toBeGreaterThan(10);
    }
  });
  it('awakening kademeleri nadirliğe göre: sıradan S-,X- · nadir A-… · epik B-… · efsanevi C-…', () => {
    const first: Record<string, string> = { common: 'S-', rare: 'A-', epic: 'B-', legendary: 'C-' };
    for (const s of Object.values(SKILLS)) {
      if (s.rarity === 'innate') continue;
      const aw = s.tiers.filter((t) => t.awakening).map((t) => t.at);
      expect(aw[0], s.id).toBe(first[s.rarity]);
      expect(aw[aw.length - 1], s.id).toBe('X-');
      // her harfin "-" kademesinde bir tablo (G- → X-)
      expect(s.tiers.map((t) => t.at), s.id).toEqual(['G-', 'F-', 'E-', 'D-', 'C-', 'B-', 'A-', 'S-', 'X-']);
    }
  });
  it('sıradan skill\'lerde aktif yetenek yok; kaldırılan teknikler yok', () => {
    for (const s of Object.values(SKILLS).filter((x) => x.rarity === 'common')) expect(s.tiers.some((t) => t.technique), s.id).toBe(false);
    for (const id of ['double_shot', 'flame_spray', 'flame_wall']) expect(TECHNIQUES[id]).toBeUndefined();
  });
});

describe('S2 kademe kuralları', () => {
  it('EXP eğrisi: harf başına ×2,5', () => {
    expect(SKILL_EXP_THRESHOLDS).toEqual({ G: 15, F: 40, E: 100, D: 250, C: 600, B: 1500, A: 4000, S: 10000, X: 25000 });
  });
  it('teknik gücü her alt kademede +%5: G- ×1,0 → X- ×2,2', () => {
    expect(techniquePower(pr('G-'))).toBe(1);
    expect(techniquePower(pr('G'))).toBe(1.05);
    expect(techniquePower(pr('D-'))).toBe(1.45);
    expect(techniquePower(pr('X-'))).toBe(2.2);
  });
  it('pasif birleştirme: önceki tablonun alanı sonraki tabloda anılmasa da korunur', () => {
    const c = mergedPassive({ id: 'sword_mastery', rank: pr('C-'), exp: 0 });
    expect(c.atkStamina?.sword).toBe(-0.1); // G-'den
    expect(c.crit?.sword).toBe(0.03); // E-'den
    expect(c.dmg?.sword).toBe(0.15); // C- (F-'deki %5'in yerine)
    const x = mergedPassive({ id: 'sword_mastery', rank: pr('X-'), exp: 0 });
    expect(x.comboFinisher).toBe(1.5);
    expect(x.atkSpd?.sword).toBe(0.15);
    expect(x.dmg?.sword).toBe(0.6);
  });
  it('ara kademe: bir sonraki kilometre taşına doğru üçte bir', () => {
    expect(mergedPassive({ id: 'stealth', rank: pr('G-'), exp: 0 }).detectionPct).toBeCloseTo(-0.1);
    expect(mergedPassive({ id: 'stealth', rank: pr('G'), exp: 0 }).detectionPct).toBeCloseTo(-0.1333, 3);
    expect(mergedPassive({ id: 'stealth', rank: pr('G+'), exp: 0 }).detectionPct).toBeCloseTo(-0.1667, 3);
    // yeni alan nötr değerden ilerler: gizli saldırı ×1,5 → ×1,75
    expect(mergedPassive({ id: 'stealth', rank: pr('F'), exp: 0 }).sneakMult).toBeCloseTo(1.5833, 3);
    // statlar tamsayı
    expect(mergedPassive({ id: 'iron_body', rank: pr('G+'), exp: 0 }).stats?.VIT).toBe(2);
    expect(mergedPassive({ id: 'iron_body', rank: pr('G+'), exp: 0 }).hpPct).toBeCloseTo(0.0833, 3);
    // bayraklar ilerlemez
    expect(mergedPassive({ id: 'evasion', rank: pr('S'), exp: 0 }).freeDodge).toBe(true);
    expect(mergedPassive({ id: 'evasion', rank: pr('A+'), exp: 0 }).freeDodge).toBeUndefined();
  });
  it('toplam etki: birden çok skill toplanır', () => {
    const fx = aggregateFx([{ id: 'sword_mastery', rank: pr('C-'), exp: 0 }, { id: 'storm_blade', rank: pr('E-'), exp: 0 }]);
    expect(fx.dmg?.sword).toBeCloseTo(0.25);
    expect(fx.stats?.AGI).toBe(2);
  });
  it('birikmiş EXP yeni eşiklere göre rütbe atlatır (göç)', () => {
    // eski D eşiği 500'dü, yenisi 250: D-'de birikmiş 480 EXP → D (230 devreder)
    const s = normalizeSkillExp({ id: 'sword_mastery', rank: pr('D-'), exp: 480 });
    expect(s.rank).toBe(pr('D'));
    expect(s.exp).toBeCloseTo(230);
    // eski C eşiği 2500: C-'de 1300 → C+ (100)
    expect(normalizeSkillExp({ id: 'fire_magic', rank: pr('C-'), exp: 1300 })).toMatchObject({ rank: pr('C+'), exp: 100 });
  });
});

describe('S3 Sistem Teklifi', () => {
  it('oranlar: çok sayıda çekişte tabloya yakın (±%1,5)', () => {
    for (const sp of [1, 2, 3] as OfferSp[]) {
      const r = rng(sp * 77);
      const n = 40000;
      const cnt = [0, 0, 0, 0];
      for (let i = 0; i < n; i++) cnt[OFFER_RARITIES.indexOf(rollRarity(sp, r))]++;
      OFFER_ODDS[sp].forEach((p, i) => expect(Math.abs(cnt[i] / n - p), `${sp} SP ${OFFER_RARITIES[i]}`).toBeLessThan(0.015));
    }
  });
  it('kart sayısı = harcanan SP; aynı teklifte aynı skill iki kez çıkmaz', () => {
    const r = rng(5);
    for (let i = 0; i < 500; i++) {
      for (const sp of [1, 2, 3] as OfferSp[]) {
        const o = rollOfferCards(sp, ['appraisal'], r);
        expect(o.cards).toHaveLength(sp);
        const ids = o.cards.filter(Boolean).map((c) => c!.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });
  it('boş havuz yukarı kaymaz: bir alt nadirlikten çekilir', () => {
    // bütün efsanevi ve epikler öğrenilmiş: efsanevi çekilen kart nadirden gelir, asla efsanevi değil
    const owned = Object.values(SKILLS).filter((s) => s.rarity === 'legendary' || s.rarity === 'epic').map((s) => s.id);
    const always = () => 0.999; // her kart en üst nadirliği çeker
    const o = rollOfferCards(3, owned, always);
    expect(o.rolled.every((x) => x === 'legendary')).toBe(true);
    expect(o.cards.every((c) => c && c.rarity === 'rare')).toBe(true);
    // yalnızca sıradanlar kaldıysa: nadir çekilse bile sıradan gelir; sıradan kalmadıysa üst nadirlik açık olsa da kaymaz
    const allButEpic = Object.values(SKILLS).filter((s) => s.rarity !== 'epic').map((s) => s.id);
    const low = () => 0.001; // hep sıradan
    const e = rollOfferCards(2, allButEpic, low);
    expect(e.cards).toEqual([null, null]);
    expect(e.refund).toBe(2);
  });
  it('sıradan da bitince kart boş gelir ve SP iade edilir', () => {
    const owned = Object.values(SKILLS).filter((s) => s.rarity === 'common').map((s) => s.id).slice(0, 5); // 1 sıradan kaldı
    const o = rollOfferCards(3, owned, () => 0.001);
    expect(o.cards.filter(Boolean)).toHaveLength(1);
    expect(o.refund).toBe(2);
  });
});

describe('S4 MP', () => {
  const cases: [string, number][] = [
    ['double_slash', 20], ['counter', 45], ['spark', 10], ['fireball', 40], ['inferno_ring', 140],
    ['ice_shard', 16], ['glacier_spear', 224], ['war_shout', 8], ['static_bolt', 24], ['heaven_judgement', 528],
  ];
  for (const [id, mp] of cases) it(`${TECHNIQUES[id].name}: ${mp} MP`, () => {
    expect(techniqueMp(id)).toBe(mp);
    expect(TECHNIQUES[id].mp).toBe(mp);
  });
  it('skill\'in "MP -%x" pasifi formülün üstüne uygulanır', () => {
    expect(techniqueCost('fireball', { id: 'fire_magic', rank: pr('X-'), exp: 0 })).toBe(28);
    expect(techniqueCost('minor_heal', { id: 'healing_magic', rank: pr('F-'), exp: 0 })).toBe(9);
  });
  it('bekleme yarıya (Kılıç Azizi)', () => {
    expect(techniqueCooldown('double_slash', { id: 'sword_mastery', rank: pr('X-'), exp: 0 })).toBe(2.5);
  });
  it('MP yenilenmesi: 0,02 + max MP × 0,005; MNA +%3; savaşta ×0,3', () => {
    expect(mpRegenPerSec(100, 0, 1, false)).toBeCloseTo(0.52);
    expect(mpRegenPerSec(100, 10, 1, false)).toBeCloseTo(0.52 * 1.3);
    expect(mpRegenPerSec(100, 0, 1, true)).toBeCloseTo(0.52 * 0.3);
    expect(mpRegenPerSec(100, 0, 0.75, false)).toBeCloseTo(0.39);
    expect(maxMP(5, 4)).toBe(17); // level + 3 × MNA değişmedi
  });
});

describe('S5 yetenek slotu', () => {
  it('1 açık slot; 2. slot kilitli; sahip olunmayan/kaldırılan teknik düşer', () => {
    const owned = ownedTechniques([{ id: 'sword_mastery', rank: pr('D-'), exp: 0 }, { id: 'fire_magic', rank: 0, exp: 0 }]);
    expect(owned).toEqual(['double_slash', 'spark']);
    expect(sanitizeSlots(['spark', 'double_slash'], owned)).toEqual(['spark', null]);
    expect(sanitizeSlots(['flame_spray', null], owned)).toEqual([null, null]);
    expect(equippedTechniques(['spark', 'double_slash'])).toEqual(['spark']);
  });
});

describe('S6 durum etkileri', () => {
  const mob = { boss: false, level: 2 };
  const boss = { boss: true, level: 5 };
  it('yanma: saniyede taban hasarın %20\'si', () => {
    const { list } = applyStatus([], { kind: 'burn', t: 3, power: 8 * 0.2 }, mob, 2);
    let l = list, total = 0;
    for (let i = 0; i < 40; i++) { const r = tickStatuses(l, 0.1); l = r.list; total += r.burn; }
    expect(total).toBeCloseTo(8 * 0.2 * 3, 5);
    expect(l).toHaveLength(0);
  });
  it('dondurma: bosslarda %50 yavaşlatmaya dönüşür', () => {
    expect(statusMods(applyStatus([], { kind: 'freeze', t: 1.5 }, mob, 2).list)).toMatchObject({ canAct: false, frozen: true });
    const b = statusMods(applyStatus([], { kind: 'freeze', t: 1.5 }, boss, 9).list);
    expect(b.canAct).toBe(true);
    expect(b.speed).toBeCloseTo(0.5);
  });
  it('sendeleme bosslara ve yüksek leveldekilere işlemez', () => {
    expect(applyStatus([], { kind: 'stagger', t: 0.5 }, boss, 9).applied).toBeNull();
    expect(applyStatus([], { kind: 'stagger', t: 0.5 }, { level: 4 }, 3).applied).toBeNull();
    expect(applyStatus([], { kind: 'stagger', t: 0.5 }, { level: 3 }, 3).applied).not.toBeNull();
  });
  it('aynı etki üst üste binmez (büyük süre/güç); Arındırma lanet dışını siler', () => {
    let l = applyStatus([], { kind: 'slow', t: 2, power: 0.2 }, mob, 2).list;
    l = applyStatus(l, { kind: 'slow', t: 1, power: 0.3 }, mob, 2).list;
    expect(l).toEqual([{ kind: 'slow', t: 2, power: 0.3 }]);
    l = applyStatus(l, { kind: 'burn', t: 9999, power: 1, curse: true }, mob, 2).list;
    expect(cleanseStatuses(l).map((s) => s.kind)).toEqual(['burn']);
    expect(cleanseStatuses(l, true)).toEqual([]);
  });
});

import { migrateV7toV8, migrate } from '../src/core/save';
import { newGameState, CURRENT_SAVE_VERSION as CSV } from '../src/core/state';

describe('kayıt göçü v7 → v8', () => {
  it('yeni alanlar, EXP eşikleri, slot (ilk sıradaki aktif yetenek), kaldırılan teknikler', () => {
    const d: any = JSON.parse(JSON.stringify(newGameState()));
    d.saveVersion = 7;
    delete d.skillSlots;
    delete d.onceADay;
    d.player.skills = [
      { id: 'appraisal', rank: 0, exp: 3 },
      { id: 'sword_mastery', rank: pr('D-'), exp: 480 },
      { id: 'fire_magic', rank: pr('F-'), exp: 10 },
    ];
    const m = migrateV7toV8(d);
    expect(m.saveVersion).toBe(8);
    expect(m.onceADay).toEqual({});
    expect(m.player.skills[1]).toMatchObject({ rank: pr('D'), exp: 230 });
    expect(m.skillSlots).toEqual(['double_slash', null]);
  });
  it('takılı kaldırılmış teknik düşer; tam göç zinciri v7\'den güncele', () => {
    const d: any = JSON.parse(JSON.stringify(newGameState()));
    d.saveVersion = 7;
    d.skillSlots = ['flame_spray', null];
    d.player.skills = [{ id: 'fire_magic', rank: pr('F-'), exp: 0 }];
    const m = migrate(d, 7);
    expect(m.saveVersion).toBe(CSV);
    expect(m.skillSlots).toEqual(['spark', null]);
  });
});
