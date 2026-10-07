// Grup 6 (0.10.0): hata düzeltmeleri, 5 stat, denge, açlık, ansiklopedi, harita işaretleri…
import { describe, it, expect } from 'vitest';
import { DragGesture } from '../src/ui/dragGesture';

describe('ScrollList jest damgası (A1/B4)', () => {
  it('kaydırma jesti sürükleme sayılır, sonraki yeni dokunuş sayılmaz', () => {
    const g = new DragGesture();
    g.begin(1000);
    expect(g.move(3, 1000)).toBe(false);
    expect(g.move(40, 1000)).toBe(true);
    g.end();
    expect(g.wasDrag(1000)).toBe(true);
    // yeni dokunuş bir düğmede başlıyor: sahne pointerdown'ı gelmiyor (begin yok) — yine de sürükleme değil
    expect(g.wasDrag(2500)).toBe(false);
  });
  it('kısa dokunuş sürükleme değil; peş peşe iki basış', () => {
    const g = new DragGesture();
    g.begin(10);
    g.move(4, 10);
    g.end();
    expect(g.wasDrag(10)).toBe(false);
    expect(g.wasDrag(20)).toBe(false);
    expect(g.wasDrag(30)).toBe(false);
  });
  it('eski jestin hareketi yeni jesti etkilemez', () => {
    const g = new DragGesture();
    g.begin(1);
    g.move(50, 1);
    g.begin(2);
    expect(g.move(50, 1)).toBe(false);
    expect(g.wasDrag(2)).toBe(false);
  });
});

import { advanceWithDays } from '../src/core/time';
describe('advanceClock (A2)', () => {
  it('gece yarısını aşan atlama gün sayısını verir', () => {
    expect(advanceWithDays({ day: 3, minute: 22 * 60 }, 180)).toEqual({ time: { day: 4, minute: 60 }, days: 1 });
    expect(advanceWithDays({ day: 3, minute: 10 * 60 }, 240)).toEqual({ time: { day: 3, minute: 14 * 60 }, days: 0 });
    expect(advanceWithDays({ day: 1, minute: 23 * 60 + 30 }, 60 + 1440).days).toBe(2);
  });
});

import { firstHop, distToRect, BED_REACH } from '../src/world/nav';
import { buildMaps } from '../src/world/maps';
import { propBox } from '../src/data/props';
import buildingsJson from '../assets/gfx/buildings/buildings.json';
import terrainJson from '../assets/gfx/tiles/terrain.json';

const MAPS = (() => {
  const all = buildMaps(buildingsJson as any, (terrainJson as any).floors);
  return { world: all.world, ...all.interiors } as Record<string, any>;
})();

describe('haritalar arası ok (A7.2/B1/B18)', () => {
  it('her iç mekânda, hedef başka haritadaysa ok bir geçişi gösterir', () => {
    const ids = Object.keys(MAPS);
    for (const from of ids) {
      if (!MAPS[from].indoor) continue;
      for (const to of ids) {
        if (to === from) continue;
        expect(firstHop(MAPS, from, to), `${from} → ${to}`).not.toBeNull();
      }
    }
  });
  it('handa tavan arasına: merdiven; tavan arasından dışarı ya da loncaya: aşağı merdiven; dışarıdan: han kapısı', () => {
    const up = firstHop(MAPS, 'inn', 'inn_attic')!;
    expect(up.to).toBe('inn_attic');
    expect([up.x, up.y]).toEqual([13, 3]);
    const down = firstHop(MAPS, 'inn_attic', 'world')!;
    expect(down.to).toBe('inn');
    expect(firstHop(MAPS, 'inn_attic', 'guild')!.to).toBe('inn');
    expect(firstHop(MAPS, 'world', 'inn_attic')!.to).toBe('inn');
    expect(firstHop(MAPS, 'inn', 'guild')!.to).toBe('world');
  });
  it('tavan arasındaki yatak yanından ve bir kare öteden "Uyu" verir (A7.10)', () => {
    const bed = MAPS.inn_attic.props.find((p: any) => p.interact === 'bed_attic');
    const r = propBox(bed.key, bed.x, bed.y)!;
    // oyuncu: karo ortası, ayak y ≈ karo*32+22; yöne göre 14 px önü
    const reach = (tx: number, ty: number, fx: number, fy: number) => {
      const ax = tx * 32 + 16, ay = ty * 32 + 22;
      return Math.min(distToRect(ax + fx * 14, ay - 8 + fy * 14, r), distToRect(ax, ay - 8, r) + 6) < BED_REACH;
    };
    expect(reach(6, 4, 1, 0)).toBe(true);
    expect(reach(5, 4, 1, 0)).toBe(true);
    expect(reach(5, 5, 0, -1)).toBe(true);
    expect(reach(8, 4, -1, 0)).toBe(true);
    expect(reach(3, 4, 1, 0)).toBe(false);
  });
});

import { regenStep, round2 } from '../src/core/formulas';
describe('iki ondalık HP/dayanıklılık (A7.11)', () => {
  it('küçük kare artışları birikir, değer hep iki ondalıklı', () => {
    let v = 3.7, acc = 0;
    for (let i = 0; i < 1000; i++) {
      const r = regenStep(v, 10, 0.0123, acc);
      v = r.value;
      acc = r.acc;
      expect(round2(v)).toBe(v);
    }
    expect(v).toBeCloseTo(3.7 + 12.3 > 10 ? 10 : 3.7 + 12.3, 5);
  });
  it('toplam artış korunur ve tavanda durur', () => {
    let v = 1, acc = 0;
    for (let i = 0; i < 100; i++) ({ value: v, acc } = regenStep(v, 50, 0.0037, acc));
    expect(v).toBeCloseTo(1.37, 5);
    expect(regenStep(10, 10, 5, 0.5)).toEqual({ value: 10, acc: 0 });
  });
});

import { discardFood, serveDifficulty } from '../src/core/serve';
describe('Servis: çöp kutusu ve ilk müşteri (B12/A7.13)', () => {
  it('yiyecekler atılır, tabaklar elde kalır', () => {
    expect(discardFood(['beer', 'stew'])).toEqual({ carry: [], discarded: 2, plateWarning: false });
    expect(discardFood(['plate', 'plate'])).toEqual({ carry: ['plate', 'plate'], discarded: 0, plateWarning: true });
    expect(discardFood([])).toEqual({ carry: [], discarded: 0, plateWarning: false });
  });
  it('ilk müşteri gecikmeli gelir, ilk siparişin sabrı uzun', () => {
    const c = serveDifficulty(1);
    expect(c.firstDelay).toBeGreaterThanOrEqual(2);
    expect(c.firstPatienceMult).toBeGreaterThan(1);
  });
});

import { newQuestLog as newLog6, startQuest as start6, advance as adv6, finishQuest as fin6, questTargetOf, allObjectivesDone as allDone6, currentObjective as cur6, visibleObjectives as vis6, objectiveLabel } from '../src/core/quests';
import { questDef as qdef6 } from '../src/data/quests';
describe('G- Rütbe oku alt görevin güncel hedefinde (A7.5)', () => {
  const CEL = { map: 'guild', npc: 'celeste' };
  it('alt görevin her aşamasında m_grank hedefi = alt görevin güncel hedefi', () => {
    const log = newLog6();
    start6(log, qdef6('m_grank')!, 1);
    // ilan alınmadı: Celeste
    expect(questTargetOf(log, 'm_grank', qdef6, CEL)!.t).toEqual(CEL);
    for (const sub of ['g1_rats', 'g2_herbs', 'g3_letter']) {
      const d = qdef6(sub)!;
      start6(log, d, 1);
      for (let i = 0; i < d.objectives.length; i++) {
        const r = questTargetOf(log, 'm_grank', qdef6, CEL)!;
        expect(r.id).toBe(sub);
        expect(r.t).toEqual(d.objectives[i].where);
        adv6(log, sub, i, d.objectives[i].count ?? 1, qdef6);
      }
      fin6(log, sub, 'done', 1);
      adv6(log, 'm_grank', qdef6('m_grank')!.objectives.findIndex((o) => o.target === sub), 1, qdef6);
    }
    expect(questTargetOf(log, 'm_grank', qdef6, CEL)).toBeNull();
  });
  it('aktif ilanı olan amaç önce gelir (oyuncu otları topluyorken ok farelere gitmez)', () => {
    const log = newLog6();
    start6(log, qdef6('m_grank')!, 1);
    start6(log, qdef6('g2_herbs')!, 1);
    expect(questTargetOf(log, 'm_grank', qdef6, CEL)!.id).toBe('g2_herbs');
  });
});

describe('isteğe bağlı amaçlar (B3)', () => {
  const def: any = { id: 'x', kind: 'main', title: 'X', desc: '', reward: {}, objectives: [
    { type: 'talk', label: 'A', target: 'a' },
    { type: 'custom', label: 'Pano', target: 'b', optional: true },
    { type: 'talk', label: 'C', target: 'c', sequential: true },
  ] };
  it('görevin bitmesini engellemez, sıralı amacı tutmaz, etiketinde "(isteğe bağlı)"', () => {
    const log = newLog6();
    start6(log, def, 1);
    const st = log.quests.x;
    expect(cur6(def, st)).toBe(0);
    expect(vis6(def, st)).toEqual([0, 1]);
    adv6(log, 'x', 0, 1, () => def);
    expect(cur6(def, st)).toBe(2);
    expect(vis6(def, st)).toEqual([0, 1, 2]);
    adv6(log, 'x', 2, 1, () => def);
    expect(allDone6(def, st)).toBe(true);
    expect(objectiveLabel(def.objectives[1])).toBe('Pano (isteğe bağlı)');
  });
});

import { questSources, sourceWaitText, nearestSpot, spawnAlive } from '../src/world/sources';
describe('yaratık/eşya kaynakları süzülür (B10, A7.6)', () => {
  const sp = (id: string, monster: string, x: number, count = 2) => ({ id, monster, x, y: 0, radius: 2, count, respawn: 720 });
  const spawns = [sp('a', 'rat', 0), sp('b', 'rat', 10), sp('c', 'slime', 20)];
  const gathers = [{ id: 'h1', x: 3, y: 0, item: 'herb', kind: 'herb' as const }, { id: 'h2', x: 8, y: 0, item: 'herb', kind: 'herb' as const }];
  const ctx = (respawns: Record<string, number>, gatheredIds: string[] = [], now = 1000) => ({
    spawns, gathers, respawns, now,
    droppersOf: (item: string) => (item === 'rat_tail' ? ['rat'] : []),
    gathered: (id: string) => gatheredIds.includes(id),
  });
  it('hepsi yaşıyor: bütün gruplar', () => {
    const r = questSources({ monster: 'rat' }, ctx({}));
    expect(r.live.map((s) => s.x)).toEqual([0, 10]);
    expect(r.next).toBeNull();
  });
  it('bir grup tükendi: yakın grup değişir', () => {
    const resp = { 'a#0': 1500, 'a#1': 1400 };
    expect(spawnAlive(spawns[0], resp, 1000)).toBe(false);
    const r = questSources({ monster: 'rat' }, ctx(resp));
    expect(r.live.map((s) => s.x)).toEqual([10]);
    expect(nearestSpot(r.live, 0, 0)!.x).toBe(10);
    // grupta biri dönmüşse grup yaşıyor sayılır
    expect(questSources({ monster: 'rat' }, ctx({ 'a#0': 900, 'a#1': 1400 })).live.length).toBe(2);
  });
  it('hepsi tükendi: bekleme ve en erken dönüş saati (uyunamaz)', () => {
    const resp = { 'a#0': 1500, 'a#1': 1400, 'b#0': 1300, 'b#1': 1700 };
    const r = questSources({ monster: 'rat' }, ctx(resp));
    expect(r.live).toEqual([]);
    expect(r.next).toEqual({ at: 1300, kind: 'spawn', what: 'rat' });
    expect(sourceWaitText({ monster: 'rat' }, r, 1000)).toBe('Fare kalmadı. Yeniden doğuş: bugün 21:40');
  });
  it('karışık eşya kaynağı: toplama + düşüren yaratık; ikisi de tükenince önce dönenin saati', () => {
    const all = { 'a#0': 2000, 'a#1': 2000, 'b#0': 2000, 'b#1': 2000 };
    // yaratıklar tükendi ama noktalar dolu → bekleme yok
    const g = { spawns, gathers: gathers.map((x) => ({ ...x, item: 'rat_tail' })), respawns: all, now: 1000, droppersOf: () => ['rat'], gathered: () => false };
    expect(questSources({ item: 'rat_tail' }, g).live.length).toBe(2);
    // ikisi de tükendi: noktalar ertesi gün 00:00 (1440), yaratıklar 2000 → 1440
    const r = questSources({ item: 'rat_tail' }, { ...g, gathered: () => true });
    expect(r.next).toEqual({ at: 1440, kind: 'gather', what: 'rat_tail' });
    const r2 = questSources({ item: 'rat_tail' }, { ...g, gathered: () => true, respawns: { ...all, 'b#1': 1200 } });
    expect(r2.next!.kind).toBe('spawn');
    expect(r2.next!.at).toBe(1200);
  });
  it('en yakın toplanmamış ot hedeflenir (A7.6)', () => {
    const r = questSources({ item: 'herb' }, ctx({}, ['h1']));
    expect(r.live.map((s) => s.x)).toEqual([8]);
    expect(nearestSpot(questSources({ item: 'herb' }, ctx({})).live, 0, 0)!.x).toBe(3);
    // bütün otlar toplandı: eski metin
    const done = questSources({ item: 'herb' }, ctx({}, ['h1', 'h2']));
    expect(sourceWaitText({ item: 'herb' }, done, 1000)).toBe('Bugünlük şifalı ot kalmadı — yarın yeniden toplanır');
  });
});

import { guildBar as gbar6, guildBarLabel } from '../src/core/guild';
import { parseSubRank } from '../src/core/ranks';
describe('Lonca kartı etiketi: mutlak puan / sonraki eşik (B6)', () => {
  const R = (s: string) => parseSubRank(s);
  it('örnekler; çubuğun dolum oranı aynı', () => {
    expect(guildBarLabel(0, R('G-'))).toBe('0 / 40');
    expect(guildBarLabel(39, R('G-'))).toBe('39 / 40');
    expect(guildBarLabel(40, R('G'))).toBe('40 / 100');
    expect(gbar6(40, R('G')).frac).toBe(0);
    expect(guildBarLabel(70, R('G'))).toBe('70 / 100');
    expect(gbar6(70, R('G')).frac).toBeCloseTo(0.5);
    expect(guildBarLabel(80, R('G'))).toBe('80 / 100');
    expect(gbar6(80, R('G')).frac).toBeCloseTo(2 / 3);
    expect(guildBarLabel(100, R('G+'))).toBe('100 / 180');
    expect(guildBarLabel(200, R('F-'))).toBe('200 / 300');
    expect(guildBarLabel(150000, R('X-'))).toBe('150000 / 220000');
    expect(guildBarLabel(999999, R('X'))).toBe('En yüksek rütbe');
  });
});

import { statHintText } from '../src/core/statText';
import { STAT_KEYS as SK6, STAT_RULES as SR6, maxStamina as ms6 } from '../src/core/formulas';
describe('Status ipuçları gerçek formülle uyuşur (A4/B9)', () => {
  it('her statın ipucu sabitlerdeki sayıları gösterir', () => {
    expect(statHintText('STR')).toContain('%8');
    expect(statHintText('VIT')).toContain(`dayanıklılık +${SR6.VIT.stamina}`);
    expect(statHintText('AGI')).toContain(`dayanıklılık +${SR6.AGI.stamina}`);
    expect(statHintText('AGI')).toContain('saldırı hızı +%1,5 (≤%60)');
    expect(statHintText('INT')).toContain('skill EXP +%1,5 (≤+%50)');
    expect(statHintText('LUK')).toContain('çift ürün +%1 (≤%20)');
    // ipucundaki dayanıklılık katsayıları formülle aynı
    expect(ms6(1, 0) - ms6(0, 0)).toBe(SR6.VIT.stamina);
    expect(ms6(0, 1) - ms6(0, 0)).toBe(SR6.AGI.stamina);
    for (const k of SK6) expect(statHintText(k).length).toBeGreaterThan(10);
  });
});

import { TREE_KEYS_FOREST, TREE_KEYS_LIGHT } from '../src/data/props';
import { HERBS_AT_FOREST_EDGE } from '../src/world/worldgen';
describe('Ormanda daha az ağaç (B8)', () => {
  it('ormandaki ağaç sayısı ~%40–45 az (268 → ~150), kenar sık orman korunur, otlar aynı', () => {
    const w = MAPS.world;
    const trees = w.props.filter((p: any) => TREE_KEYS_FOREST.includes(p.key) || TREE_KEYS_LIGHT.includes(p.key));
    const forest = trees.filter((p: any) => p.x / 32 < 56);
    expect(forest.length).toBeGreaterThanOrEqual(140);
    expect(forest.length).toBeLessThanOrEqual(170);
    const border = forest.filter((p: any) => { const x = Math.floor(p.x / 32), y = Math.floor((p.y - 30) / 32); return x < 3 || y < 2 || y > w.h - 4; });
    expect(border.length).toBeGreaterThanOrEqual(35);
    // toplam dekor artmadı (performans)
    expect(w.props.length).toBeLessThan(2573);
    expect(w.gathers.filter((g: any) => g.item === 'herb').length).toBeGreaterThanOrEqual(HERBS_AT_FOREST_EDGE);
  });
});

import { sourceWait } from '../src/world/sources';
describe('kaynak beklemesi uyunamaz (B10.4)', () => {
  it('yaratık kalmayınca bekleme metni var, until null (yan/pano görevi de olsa)', () => {
    const spawns = [{ id: 'a', monster: 'slime', x: 0, y: 0, radius: 2, count: 1, respawn: 720 }];
    const c = { spawns, gathers: [], respawns: { 'a#0': 1600 }, now: 1000, droppersOf: () => [], gathered: () => false };
    const w = sourceWait({ monster: 'slime' }, c)!;
    expect(w.until).toBeNull();
    expect(w.text).toBe('Sümüksü kalmadı. Yeniden doğuş: yarın 02:40');
    expect(sourceWait({ monster: 'slime' }, { ...c, respawns: {} })).toBeNull();
    expect(sourceWait({ map: 'world', npc: 'x' } as any, c)).toBeNull();
  });
});

import { decaySatiety, eatSatiety, hungerState, hungerMods, bestFood, SATIETY_START, FULL_AT, SHIFT_MEAL } from '../src/core/hunger';
import { ITEMS as IT6 } from '../src/data/items';
import { newGameState as ngs6 } from '../src/core/state';
import { migrateV8toV9 } from '../src/core/save';
describe('Tokluk (B13)', () => {
  it('azalma: uyanık saatte −4, uyurken −2', () => {
    expect(decaySatiety(50, 60, false)).toBe(46);
    expect(decaySatiety(50, 60, true)).toBe(48);
    expect(decaySatiety(50, 8 * 60, true)).toBe(34);
    expect(decaySatiety(2, 120, false)).toBe(0);
  });
  it('eşikler: <30 Aç (dayanıklılık yenilenmesi yarı), <10 Çok aç (HP yenilenmez, dayanıklılık −%25); öldürmez', () => {
    expect(hungerState(30)).toBe('normal');
    expect(hungerState(29.9)).toBe('hungry');
    expect(hungerState(9.9)).toBe('starving');
    expect(hungerMods(50)).toEqual({ staminaRegen: 1, hpRegen: 1, maxStamina: 1 });
    expect(hungerMods(20)).toEqual({ staminaRegen: 0.5, hpRegen: 1, maxStamina: 1 });
    expect(hungerMods(0)).toEqual({ staminaRegen: 0.5, hpRegen: 0, maxStamina: 0.75 });
  });
  it('yemek etkileri, tavan ve "Tokum"', () => {
    const want: Record<string, number> = { apple: 10, bread: 20, honey_bun: 25, cheese: 25, dried_meat: 30, hot_stew: 40, meat_pie: 50 };
    for (const [id, v] of Object.entries(want)) expect(IT6[id].satiety, id).toBe(v);
    for (const it of Object.values(IT6)) if (it.kind === 'food') expect(it.satiety, it.id).toBeGreaterThan(0);
    expect(eatSatiety(90, 50)).toEqual({ value: 100, refused: false });
    expect(eatSatiety(FULL_AT, 10)).toEqual({ value: FULL_AT, refused: true });
    expect(SHIFT_MEAL).toBe(40);
  });
  it('en uygun yiyecek: ihtiyacı aşmayan en büyük, yoksa en küçük', () => {
    const f = [{ id: 'apple', satiety: 10, price: 3 }, { id: 'stew', satiety: 40, price: 12 }, { id: 'pie', satiety: 50, price: 18 }];
    expect(bestFood(f, 40)).toBe('pie');
    expect(bestFood(f, 70)).toBe('apple');
    expect(bestFood(f, 95)).toBe('apple');
    expect(bestFood([], 10)).toBeNull();
  });
  it('yeni oyun 40 ile başlar; eski kayıtta alan yoksa 80', () => {
    expect(ngs6().satiety).toBe(SATIETY_START);
    expect(SATIETY_START).toBe(40);
    const old: any = ngs6();
    delete old.satiety;
    expect(migrateV8toV9(old).satiety).toBe(80);
  });
  it('parasız oyuncu elmayla normal Tokluğa çıkabilir (kilitlenme yok)', () => {
    const appleTrees = MAPS.world.gathers.filter((g: any) => g.item === 'apple').length;
    // günde her ağaç ≥ 3 elma (0.8.0), elma 10 Tokluk: bir günde ≥ 30 Tokluk (uyanık 16 saatte −64'e karşı ağaç sayısıyla)
    expect(appleTrees * 3 * 10).toBeGreaterThanOrEqual(64);
    expect(IT6.apple.price).toBeLessThanOrEqual(3);
  });
});

import { startQuest as sq6 } from '../src/core/quests';
import { migrate as mig6 } from '../src/core/save';
describe('Kayıt göçü v8 → v9 (B9/B12)', () => {
  const v8 = (workDays: number, extra: Record<string, any> = {}) => {
    const s: any = ngs6();
    s.saveVersion = 8;
    s.flags = { woke: true, inn_met: true, bertram_deal: true, ...extra };
    s.counters = { workDays };
    sq6(s.quests, qdef6('m_inn')!, 1);
    s.quests.quests.m_inn.status = 'done';
    s.quests.quests.m_inn.progress = [1];
    sq6(s.quests, qdef6('m_bertram')!, 1);
    s.quests.quests.m_bertram.progress = [workDays];
    s.player.level = 3;
    s.player.alloc = { STR: 6, VIT: 4, AGI: 2, DEX: 3, MNA: 1, INT: 1, LUK: 1 };
    s.player.unspent = 0;
    delete s.satiety;
    return s;
  };
  it('Bertram 1/3 → 1/2; 2/3 → iş bitti, ücret sahnesi bekliyor (ödeme bir kez)', () => {
    const a = mig6(v8(1), 8);
    expect(a.quests.quests.m_bertram.progress).toEqual([1]);
    expect(a.flags.bertram_pay_pending).toBeUndefined();
    const b = mig6(v8(2), 8);
    expect(b.quests.quests.m_bertram.progress).toEqual([2]);
    expect(b.flags.bertram_pay_pending).toBe(true);
    expect(b.quests.quests.m_bertram.status).toBe('active');
    const c = mig6(v8(2, { bertram_done: true }), 8);
    expect(c.flags.bertram_pay_pending).toBeUndefined();
  });
  it('statlar sıfırlanır: 4 × level dağıtılmamış puan, DEX/MNA yok, bildirim bayrağı', () => {
    const m = mig6(v8(0), 8);
    expect(m.player.alloc).toEqual({ STR: 0, VIT: 0, AGI: 0, INT: 0, LUK: 0 });
    expect(m.player.unspent).toBe(12);
    expect(m.flags.stat_reset_notice).toBe(true);
    // yeni amaç eklenen görevin ilerlemesi tanımla eşit
    expect(m.quests.quests.m_inn.progress).toEqual([1, 1]);
    expect(m.satiety).toBe(80);
  });
});

import { REMOVED_BOOKS } from '../src/core/save';
import { MONSTERS as MON6 } from '../src/data/monsters';
const SRC6 = import.meta.glob(['/src/**/*.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
describe('Skill öğrenmenin tek yolu SP (B17)', () => {
  it('kaynakta Sistem Teklifi dışında learnSkill çağrısı yok', () => {
    const calls: string[] = [];
    for (const [f, src] of Object.entries(SRC6)) {
      for (const m of src.matchAll(/learnSkill\(([^)]*)\)/g)) {
        if (/export function learnSkill/.test(src.slice(Math.max(0, m.index! - 20), m.index! + 12))) continue;
        calls.push(`${f}: ${m[1]}`);
      }
    }
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c, c).toMatch(/'Sistem Teklifi'/);
  });
  it('öğretmen, kitap, gizli keşif ve skill veren ganimet kalmadı', () => {
    const all = Object.entries(SRC6).filter(([f]) => !f.endsWith('/core/save.ts')).map(([, v]) => v).join('\n');
    expect(all).not.toMatch(/HIDDEN_DISCOVERIES|pendingDiscoveries|checkDiscoveries|LESSONS\./);
    for (const id of Object.keys(REMOVED_BOOKS)) expect(IT6[id], id).toBeUndefined();
    for (const m of Object.values(MON6)) for (const d of [...m.drops, m.special]) expect(IT6[d.id], `${m.id}: ${d.id}`).toBeDefined();
  });
  it('eski kayıttaki kitaplar silinir, değeri bronz olarak iade edilir (bir kez bildirilir)', () => {
    const s: any = ngs6();
    s.saveVersion = 8;
    s.player.inventory = { book_fire: 1, book_firstaid: 2, bread: 1 };
    s.pendingDiscoveries = ['stealth'];
    s.flags = { declined_stealth: true, postponed_archery: 3, woke: true };
    const m: any = mig6(s, 8);
    expect(m.player.inventory).toEqual({ bread: 1 });
    expect(m.player.wallet.bronze + m.player.wallet.silver * 100).toBe(450 + 120);
    expect(m.flags.books_refund).toBe(570);
    expect(m.pendingDiscoveries).toBeUndefined();
    expect(m.flags.declined_stealth).toBeUndefined();
    expect(m.flags.postponed_archery).toBeUndefined();
  });
});

import { boardDaysLeft, deadlineLabel, deadlineNotice, penaltyOf } from '../src/core/guild';
describe('Pano süre uyarısı (B14)', () => {
  it('kalan gün: başarısızlık kuralıyla aynı (day > startedDay + days)', () => {
    expect(boardDaysLeft(5, 3, 5)).toBe(4);
    expect(boardDaysLeft(5, 3, 8)).toBe(1);
    expect(boardDaysLeft(5, 3, 9)).toBe(0);
    expect(deadlineLabel(3)).toBe('3 gün kaldı');
    expect(deadlineLabel(1)).toBe('Son gün!');
  });
  it('uyarı zamanı: son günün sabahı bir kez, 18:00 sonrası bir kez', () => {
    expect(deadlineNotice(2, 7, {})).toBeNull();
    expect(deadlineNotice(1, 6, {})).toBe('morning');
    expect(deadlineNotice(1, 12, { morning: true })).toBeNull();
    expect(deadlineNotice(1, 18, { morning: true })).toBe('evening');
    expect(deadlineNotice(1, 20, { morning: true, evening: true })).toBeNull();
    // 18:00'den sonra yüklenen oyun: önce sabah bildirimi
    expect(deadlineNotice(1, 19, {})).toBe('morning');
  });
  it('ceza tutarları gerçek: −puan, ödülün iki katı bronz', () => {
    expect(penaltyOf(30, 75)).toEqual({ points: 30, fine: 150 });
  });
});

import { mapMarkers } from '../src/world/mapMarkers';
import { RESPAWN_MINUTES } from '../src/world/worldgen';
describe('Harita işaretleri + 12 saat yeniden doğma (B16)', () => {
  it('bütün doğma grupları 720 dakika', () => {
    expect(RESPAWN_MINUTES).toBe(720);
    for (const s of MAPS.world.spawns) expect(s.respawn, s.id).toBe(720);
  });
  const base = (o: Partial<Parameters<typeof mapMarkers>[0]> = {}) => mapMarkers({
    spawns: [{ id: 'a', monster: 'rat', x: 10, y: 10, radius: 2, count: 2, respawn: 720 }, { id: 'b', monster: 'slime', x: 50, y: 50, radius: 2, count: 1, respawn: 720 }],
    gathers: [{ id: 'h1', x: 5, y: 5, item: 'herb', kind: 'herb' }, { id: 'h2', x: 7, y: 5, item: 'herb', kind: 'herb' }, { id: 'ap', x: 30, y: 30, item: 'apple', kind: 'apple' }],
    seen: (x) => x < 40, gathered: () => false, respawns: {}, now: 600,
    monsterKnown: (id) => id === 'rat', monsterName: (id) => (id === 'rat' ? 'Fare' : 'Sümüksü'),
    plantKnown: (id) => id === 'herb', plantName: (id) => (id === 'herb' ? 'Şifalı Ot' : 'Elma Ağacı'), plantOf: (g) => g.item,
    quest: null, ...o,
  });
  it('yalnızca keşfedilmiş alanlar; yakın otlar tek işaret; bilinmeyen "?"', () => {
    const m = base();
    expect(m.some((x) => x.ref === 'slime')).toBe(false);
    const herb = m.find((x) => x.ref === 'herb')!;
    expect(herb.count).toBe(2);
    expect(herb.label).toBe('Şifalı Ot');
    expect(m.find((x) => x.ref === 'apple')!.label).toBe('?');
    expect(m.find((x) => x.ref === 'rat')!.label).toBe('Fare');
  });
  it('tükenmişlik: toplanmış küme soluk "yarın"; boş yaratık bölgesi soluk + dönüş saati; görev hedefi', () => {
    const m = base({ gathered: (id) => id !== 'ap', respawns: { 'a#0': 700, 'a#1': 900 }, quest: { x: 3, y: 4, label: 'G- Rütbe' } });
    const herb = m.find((x) => x.ref === 'herb')!;
    expect(herb.faded).toBe(true);
    expect(herb.note).toBe('yarın');
    const rat = m.find((x) => x.ref === 'rat')!;
    expect(rat.faded).toBe(true);
    expect(rat.note).toBe('dönüş 11:40');
    expect(m.find((x) => x.kind === 'quest')).toMatchObject({ x: 3, y: 4, label: 'G- Rütbe' });
  });
});

import { newCodex, codexPages, codexAppraiseMonster, codexKill, codexDrop, codexMeet, codexAppraisePerson, codexGather, monsterCard, personCard, plantCard, codexFromSave, relationText, CODEX_REGIONS } from '../src/core/codex';
describe('Ansiklopedi (B15)', () => {
  it('yaratık: bilinmeyen "???"; Appraisal ile açılır, yalnızca alınan ganimet görünür', () => {
    const c = newCodex();
    expect(monsterCard(c, 'rat')).toMatchObject({ known: false, title: '???' });
    codexKill(c, 'rat', 0, 'Ormanın Kenarı');
    expect(monsterCard(c, 'rat').known).toBe(false);
    expect(codexAppraiseMonster(c, 'rat', 0, 'Ormanın Kenarı', 3)).toBe(true);
    expect(codexAppraiseMonster(c, 'rat', 0, 'Ormanın Kenarı', 4)).toBe(false);
    codexDrop(c, 'rat', 'rat_tail');
    const card = monsterCard(c, 'rat');
    expect(card.title).toBe('Fare');
    const row = (k: string) => card.rows.find((r) => r[0] === k)![1];
    expect(row('Ganimet')).toBe('Fare Kuyruğu, ???, ???');
    expect(row('Öldürülen')).toBe('1');
    expect(row('Yeniden doğma')).toBe('12 saat');
    expect(row('İlk inceleme')).toBe('3. gün');
  });
  it('karakter: konuşunca ad açılır; Appraisal bilgileri görünürlüğe göre; ilişki sözle', () => {
    const c = newCodex();
    expect(personCard(c, 'bertram', { affinity: 0, flags: {} }).known).toBe(false);
    expect(codexMeet(c, 'bertram', 'Han · sabah', 1)).toBe(true);
    const a = personCard(c, 'bertram', { affinity: 3, flags: { bertram_deal: true } });
    expect(a.title).toBe('Bertram');
    expect(a.rows.find((r) => r[0] === 'Level')![1]).toBe('???');
    expect(a.rows.find((r) => r[0] === 'İlişki')![1]).toBe('Sana ısınıyor');
    expect(a.notes).toContain('Sana iş, yatak ve bir gömlek verdi.');
    expect(a.rows.some((r) => r[0] === 'Satar')).toBe(true);
    codexAppraisePerson(c, 'bertram', 'Han · akşam', 2);
    const b = personCard(c, 'bertram', { affinity: 0, flags: {}, appraisalVisible: () => ({ rank: 'E (emekli)', level: '9', title: 'Kurt Sürüsü Avcısı', trait: '???' }) });
    expect(b.rows.find((r) => r[0] === 'Level')![1]).toBe('9');
    expect(relationText(-4)).toBe('Senden hoşlanmıyor');
  });
  it('bitki: ilk toplamada açılır, sayaç ve yerler', () => {
    const c = newCodex();
    expect(plantCard(c, 'herb').known).toBe(false);
    expect(codexGather(c, 'herb', 'Ormanın Kenarı', 2)).toBe(true);
    expect(codexGather(c, 'herb', 'Ormanın Kenarı', 2)).toBe(false);
    const p = plantCard(c, 'herb');
    expect(p.rows.find((r) => r[0] === 'Topladığın')![1]).toBe('2');
    expect(codexGather(c, 'rat_tail', 'x', 1)).toBe(false);
  });
  it('bölge sayfalaması: Brindlewood dolu, Eros kilitli; "Bilinen x/y"', () => {
    const c = newCodex();
    codexAppraiseMonster(c, 'slime', 1, null, 1);
    const pages = codexPages(c, 'monsters');
    expect(pages.map((p) => p.region.id)).toEqual(CODEX_REGIONS.map((r) => r.id));
    expect(pages[0]).toMatchObject({ locked: false, known: 1 });
    expect(pages[0].total).toBeGreaterThan(5);
    expect(pages[1].locked).toBe(true);
    expect(codexPages(c, 'people')[0].total).toBeGreaterThan(40);
    expect(codexPages(c, 'plants')[0].total).toBe(3);
  });
  it('göç: Appraisal geçmişi, öldürme ve toplama sayaçları, tanışma bayrakları', () => {
    const c = codexFromSave({ appraised: { vera: 2, m_17: 3 }, killed: { rat: 4 }, gathered: { herb3: 2, apple1: 2 }, counters: { gathered: 5 }, flags: { inn_met: true, farm_offered: true }, time: { day: 6 } });
    expect(c.people.vera.appraised).toBe(2);
    expect(c.people.bertram).toBeTruthy();
    expect(c.people.haldor).toBeTruthy();
    expect(c.monsters.rat.kills).toBe(4);
    expect(monsterCard(c, 'rat').known).toBe(true);
    expect(c.plants.herb.count).toBe(5);
    expect(c.plants.apple).toBeTruthy();
    const s: any = ngs6();
    s.saveVersion = 8;
    delete s.codex;
    s.killed = { slime: 1 };
    expect(mig6(s, 8).codex.monsters.slime.kills).toBe(1);
  });
});

import { runStaminaCost, RUN_STAMINA_PER_SEC } from '../src/core/stamina';
import { SKILLS as SK_6 } from '../src/data/skills';
describe('Koşmak dayanıklılık harcamaz (B22)', () => {
  it('koşu bedeli 0; oyuncu kodunda koşu bedeli, kilit ve koşu maliyeti çarpanı yok', () => {
    expect(RUN_STAMINA_PER_SEC).toBe(0);
    expect(runStaminaCost(60)).toBe(0);
    const player = SRC6['/src/world/player.ts'];
    expect(player).not.toMatch(/runStep|runLock|runCostMult|Nefes nefese/);
    const all = Object.values(SRC6).join('\n');
    expect(all).not.toMatch(/runCostPct|freeRun/);
  });
  it('Atletizm koşu maliyeti yerine koşu hızı ve yenilenme verir', () => {
    const at = SK_6.athletics;
    expect(at.tiers.some((t: any) => t.passive?.runSpeedPct > 0)).toBe(true);
    for (const t of at.tiers) expect(t.note).not.toMatch(/koşu maliyeti|koşu -%|harcamaz/);
  });
});

import { hitstopFor, hitNumberKind, materialOf, hurtEdgeAlpha, isLowHp, windupOffset, PERFECT_DODGE_SLOWMO, NUMBER_STYLE, NUMBER_POOL, MATERIAL_FX } from '../src/world/combatFx';
describe('Dövüş geri bildirimi (B23)', () => {
  it('vuruş donması: isabet 0,05, kritik 0,09; ayar kapalıysa yok', () => {
    expect(hitstopFor(false, true)).toBe(0.05);
    expect(hitstopFor(true, true)).toBe(0.09);
    expect(hitstopFor(true, false)).toBe(0);
    expect(PERFECT_DODGE_SLOWMO).toBe(0.2);
  });
  it('hasar sayısı türleri ve renkleri', () => {
    expect(hitNumberKind(2, 2, false)).toBe('dmg');
    expect(hitNumberKind(2, 2, true)).toBe('crit');
    expect(hitNumberKind(0.4, 2, false)).toBe('low');
    expect(NUMBER_STYLE.crit.size).toBeGreaterThan(NUMBER_STYLE.dmg.size);
    expect(NUMBER_STYLE.crit.color).toBe('#ffd23a');
    expect(NUMBER_STYLE.hurt.color).toBe('#ff5a4a');
    expect(NUMBER_STYLE.dmg.color).toBe('#ffffff');
    expect(NUMBER_POOL).toBeGreaterThan(0);
  });
  it('malzeme (et, sümük, zırh), kenar kızarması, düşük can, hazırlıkta geri çekilme', () => {
    expect(materialOf('slime')).toBe('slime');
    expect(materialOf('rat')).toBe('flesh');
    expect(materialOf('goblin_chief')).toBe('armor');
    for (const m of Object.values(MATERIAL_FX)) expect(m.sound).toMatch(/^impact_/);
    expect(hurtEdgeAlpha(0.1, 10)).toBeCloseTo(0.126);
    expect(hurtEdgeAlpha(10, 10)).toBe(0.6);
    expect(isLowHp(2, 10)).toBe(true);
    expect(isLowHp(2.5, 10)).toBe(false);
    expect(isLowHp(0, 10)).toBe(false);
    expect(windupOffset(0)).toBeCloseTo(0);
    expect(windupOffset(1)).toBe(-4);
  });
  it('titreşim (haptik) eklenmedi', () => {
    expect(Object.values(SRC6).join('\n')).not.toMatch(/navigator\.vibrate/);
  });
});

import { TRAIT_ODDS, wheelReel, WHEEL_RESULT, divineDescription, pctLabel, awakenDue } from '../src/core/traitWheel';
import { TRAIT_NAMES as TN6 } from '../src/data/titles';
describe('Trait çarkı ve uyanış (B19/B20)', () => {
  it('olasılık tablosu tam %100; X %0,0001', () => {
    const sum = TRAIT_ODDS.reduce((a, [, p]) => a + p, 0);
    expect(Math.abs(sum - 100)).toBeLessThan(1e-9);
    expect(TRAIT_ODDS.map(([r]) => r)).toEqual(['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'X']);
    expect(pctLabel(TRAIT_ODDS[8][1])).toBe('%0,0001');
  });
  it('sonuç her zaman Divine Paladin; makarada X yalnızca sonuncu, S/A az kalsın kartları önce', () => {
    for (let seed = 0; seed < 50; seed++) {
      let x = seed * 9301 + 49297;
      const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
      const r = wheelReel(30, rnd);
      expect(r.length).toBe(30);
      expect(r[r.length - 1]).toBe(WHEEL_RESULT);
      expect(r.slice(0, -1).every((id) => TN6[id].rank !== 'X')).toBe(true);
      expect(['S', 'A']).toContain(TN6[r[r.length - 2]].rank);
    }
    expect(Object.keys(TN6).length).toBeGreaterThanOrEqual(20);
  });
  it('açıklama gerçek veriden: beş Divine stat, Işık, uyanış, görünmezlik', () => {
    const d = divineDescription();
    expect(d.title).toBe('X — DIVINE PALADIN');
    const all = d.lines.join(' ');
    for (const k of ['Güç 0,50x', 'Dayanıklılık 0,75x', 'Öğrenme 0,50x', 'Işık', 'Uyanış', 'görünmez', '×1,20', '×1,32']) expect(all).toContain(k);
  });
  it('uyanış: yeni oyunda ilk yürüyüşte bir kez; eski kayıtta oynamaz', () => {
    expect(awakenDue({ woke: true }, true, true, 0.8)).toBe(true);
    expect(awakenDue({ woke: true }, true, true, 0.1)).toBe(false);
    expect(awakenDue({ woke: true, dp_awaken: true }, true, true, 0.8)).toBe(false);
    expect(awakenDue({ woke: true }, true, false, 0.8)).toBe(false);
    const s: any = ngs6();
    s.saveVersion = 8;
    s.flags = { woke: true, inn_met: true };
    expect(mig6(s, 8).flags.dp_awaken).toBe(true);
    const fresh: any = ngs6();
    fresh.saveVersion = 8;
    expect(mig6(fresh, 8).flags.dp_awaken).toBeUndefined();
  });
});
