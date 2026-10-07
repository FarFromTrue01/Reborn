// 0.3.0 Bölüm II: görev verisinin tutarlılığı, pano ilanları, yan görevler, Servis Koşturmacası puanı,
// yoldaş EXP kuralı ve ekonomi hesabı.
import { describe, it, expect } from 'vitest';
import { type BuildingMeta } from '../src/world/worldgen';
import { buildMaps } from '../src/world/maps';
import { MAIN_QUESTS, questDef } from '../src/data/quests';
import { SIDE_QUESTS, SIDE_SCRIPTS, BOARD_TEMPLATES, boardForDay } from '../src/data/sidequests';
import { NPC_BY_ID } from '../src/data/npcs';
import { ITEMS } from '../src/data/items';
import { MONSTERS } from '../src/data/monsters';
import { COMPANIONS } from '../src/data/companions';
import { BOARD_REWARD, QUEST_POINTS, applyReward, applyPenalty, newGuildState, groupPoints, earnedRank, RANK_THRESHOLDS } from '../src/core/guild';
import { splitExp } from '../src/core/monster';
import { serveDifficulty, servePerf } from '../src/core/serve';
import { JOBS } from '../src/data/economy';
import { CARD_PRICE } from '../src/core/cards';
import type { QuestDef } from '../src/core/quests';
import buildingsJson from '../assets/gfx/buildings/buildings.json';
import terrainJson from '../assets/gfx/tiles/terrain.json';

const bmeta = buildingsJson as unknown as Record<string, BuildingMeta>;
const { world, interiors } = buildMaps(bmeta, (terrainJson as any).floors);
const maps: Record<string, any> = { world, ...interiors };

function checkQuest(q: QuestDef) {
  if (q.giver) expect(NPC_BY_ID[q.giver], `${q.id} veren`).toBeTruthy();
  for (const o of q.objectives) {
    const where = `${q.id}: ${o.label}`;
    if (o.type === 'talk' || o.type === 'deliver') expect(NPC_BY_ID[o.target!], where).toBeTruthy();
    if (o.type === 'collect') expect(ITEMS[o.target!], where).toBeTruthy();
    if (o.type === 'kill') expect(MONSTERS[o.target!], where).toBeTruthy();
    if (o.where) {
      expect(maps[o.where.map], where + ' harita').toBeTruthy();
      if (o.where.point) expect(maps[o.where.map].points[o.where.point], where + ' nokta ' + o.where.point).toBeTruthy();
      if (o.where.npc) expect(NPC_BY_ID[o.where.npc], where).toBeTruthy();
    }
  }
  for (const it of q.reward.items ?? []) expect(ITEMS[it.id], q.id).toBeTruthy();
}

describe('Bölüm II görev verisi', () => {
  it('Ana görevler: hedefler (NPC, eşya, canavar, nokta) mevcut', () => {
    for (const q of MAIN_QUESTS) checkQuest(q);
  });
  it('Yan görevler: 8–10 elle yazılmış görev, her birinin metni var', () => {
    expect(SIDE_QUESTS.length).toBeGreaterThanOrEqual(8);
    expect(SIDE_QUESTS.length).toBeLessThanOrEqual(10);
    for (const q of SIDE_QUESTS) {
      checkQuest(q);
      expect(q.kind).toBe('side');
      expect(SIDE_SCRIPTS[q.id], q.id).toBeTruthy();
      expect(questDef(q.id)).toBe(q);
    }
  });
  it('G görevleri 10 puan; ilk F ortak görevleri grup (yarım puan)', () => {
    for (const id of ['g1_rats', 'g2_herbs', 'g3_letter']) expect(questDef(id)!.reward.points).toBe(QUEST_POINTS.G);
    for (const id of ['f_wolves', 'f_cellar']) {
      const q = questDef(id)!;
      expect(q.group).toBe(true);
      expect(groupPoints(q.reward.points!)).toBe(15);
    }
    // ödüller: kişi başı 40 ve 30 bronz (toplam 120 ve 90, üçe eşit)
    expect(questDef('f_wolves')!.reward.money).toBe(40);
    expect(questDef('f_cellar')!.reward.money).toBe(30);
  });
  it('30 (G×3) + 15 (kurtlar) = 45 puan → G rütbesi (40)', () => {
    const g = newGuildState();
    g.member = true;
    for (let i = 0; i < 3; i++) applyReward(g, QUEST_POINTS.G, 20);
    applyReward(g, 30, 40, true);
    expect(g.points).toBe(45);
    expect(earnedRank(g.points, 0, 0)).toBe(1); // G
    expect(RANK_THRESHOLDS[1]).toBe(40);
  });
  it('Bodrum ve yeni canavarlar', () => {
    expect(interiors.mill_cellar).toBeTruthy();
    expect(MONSTERS.barn_rat).toBeTruthy();
    expect(MONSTERS.giant_rat).toBeTruthy();
    const mill = world.buildings.find((b) => b.id === 'mill')!;
    expect(mill.enter?.map).toBe('mill_cellar');
  });
  it('Şehir kapısı tetikleyicisi var', () => {
    expect(world.triggers.some((t) => t.id === 'city_gate')).toBe(true);
  });
});

describe('Pano ilanları', () => {
  it('En az 15 şablon; ödüller G 15–40, F 60–90 aralığında', () => {
    expect(BOARD_TEMPLATES.length).toBeGreaterThanOrEqual(15);
    for (const t of BOARD_TEMPLATES) {
      const [lo, hi] = BOARD_REWARD[t.rank]!;
      expect(t.reward[0], t.key).toBeGreaterThanOrEqual(lo);
      expect(t.reward[1], t.key).toBeLessThanOrEqual(hi);
    }
  });
  it('Her gün 3–4 ilan, en az 2 G; aynı gün aynı ilanlar; günden güne değişir', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 30; d++) {
      const a = boardForDay(d), b = boardForDay(d);
      expect(a.length).toBeGreaterThanOrEqual(3);
      expect(a.length).toBeLessThanOrEqual(4);
      expect(a.filter((q) => q.rank === 'G').length).toBeGreaterThanOrEqual(2);
      expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
      expect(new Set(a.map((q) => q.id)).size).toBe(a.length);
      for (const q of a) {
        checkQuest(q);
        const [lo, hi] = BOARD_REWARD[q.rank!]!;
        expect(q.reward.money!).toBeGreaterThanOrEqual(lo);
        expect(q.reward.money!).toBeLessThanOrEqual(hi);
        expect(q.kind).toBe('board');
        expect(q.guild).toBe(true);
        seen.add(q.title);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(10);
  });
  it('F ilanı riskli: başarısızlıkta −30 puan ve ödülün iki katı', () => {
    const g = newGuildState();
    g.points = 45;
    const r = applyPenalty(g, QUEST_POINTS.F, 80, 50);
    expect(g.points).toBe(15);
    expect(r.fine).toBe(160);
    expect(r.paid).toBe(50);
    expect(g.debt).toBe(110);
  });
});

describe('D4: Servis Koşturmacası', () => {
  it('Günden güne zorlaşır', () => {
    // 0.10.0 (B12): iş iki gün; eski 1. gün (4 masa) kalktı
    const d1 = serveDifficulty(1), d2 = serveDifficulty(2);
    expect(d1.tables).toBe(5);
    expect(d2.tables).toBe(6);
    expect(d2.patience).toBeLessThan(d1.patience);
    expect(d2.spawnEvery).toBeLessThan(d1.spawnEvery);
    expect(serveDifficulty(3)).toEqual(d2);
    expect(JOBS.bertramShifts).toBe(2);
    expect(JOBS.bertramPay).toBe(50);
  });
  it('Performans 0..1; kaçan müşteri ve kirli tabak düşürür', () => {
    const best = servePerf(10, 0, 9, 9, 8);
    const worse = servePerf(10, 4, 9, 9, 8);
    const dirty = servePerf(10, 0, 2, 9, 8);
    expect(best).toBeLessThanOrEqual(1);
    expect(worse).toBeLessThan(best);
    expect(dirty).toBeLessThan(best);
    expect(servePerf(0, 0, 0, 0, 8)).toBeGreaterThanOrEqual(0);
  });
});

describe('C4: yoldaşlar', () => {
  it('Vera yakın dövüş, Lina okçu; NPC verisi var', () => {
    expect(COMPANIONS.vera.role).toBe('melee');
    expect(COMPANIONS.lina.role).toBe('archer');
    for (const id of Object.keys(COMPANIONS)) expect(NPC_BY_ID[id].creature).toBeTruthy();
  });
  it('Joseph yalnızca vurduğu düşmandan EXP alır', () => {
    expect(splitExp(10, { vera: 5, lina: 3 }).joseph).toBeUndefined();
    const s = splitExp(10, { vera: 5, joseph: 1 });
    expect(s.joseph).toBeGreaterThanOrEqual(0);
    expect(s.vera).toBeGreaterThan(s.joseph);
  });
});

describe('E7: ekonomi', () => {
  it('10 gümüş birkaç oyun haftası sürer (G ilanlarıyla ~2 hafta+)', () => {
    // Bölüm II'de m_silver başladığında eldeki para (README hesabı): ~115 bronz
    const start = 40 + 40 + 5 + 30;
    const side = SIDE_QUESTS.reduce((s, q) => s + (q.reward.money ?? 0), 0);
    // günlük: iki G ilanı (ortalama ödül) − yemek (güveç + ekmek)
    const gAvg = BOARD_TEMPLATES.filter((t) => t.rank === 'G').reduce((s, t) => s + (t.reward[0] + t.reward[1]) / 2, 0) / BOARD_TEMPLATES.filter((t) => t.rank === 'G').length;
    const daily = 2 * gAvg - 16;
    const days = Math.ceil((CARD_PRICE - start - side) / daily);
    expect(side).toBeGreaterThan(200);
    expect(side).toBeLessThan(500);
    expect(days).toBeGreaterThanOrEqual(10);
    expect(days).toBeLessThanOrEqual(28);
  });
});
