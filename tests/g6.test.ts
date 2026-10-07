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
