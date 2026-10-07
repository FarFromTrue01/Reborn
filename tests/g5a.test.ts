// Grup 5A (0.8.0): hatalar, dünya, denge.
import { describe, it, expect } from 'vitest';
import { SysFlow } from '../src/ui/sysFlow';
import { doorGoal } from '../src/world/questGo';
import { type BuildingMeta } from '../src/world/worldgen';
import { buildMaps } from '../src/world/maps';
import { QUEST_IDS, questDef } from '../src/data/quests';
const QUESTS = QUEST_IDS.map((id) => questDef(id)!);
import buildingsJson from '../assets/gfx/buildings/buildings.json';
import terrainJson from '../assets/gfx/tiles/terrain.json';

const MAPS = buildMaps(buildingsJson as unknown as Record<string, BuildingMeta>, (terrainJson as any).floors);
const WORLD = MAPS.world;

/** Sahte zamanlayıcılı bildirim ortamı: göster/kapat animasyonları elle ilerletilir. */
function sysEnv() {
  let now = 0;
  const timers: { at: number; fn: () => void }[] = [];
  const later = (ms: number, fn: () => void) => timers.push({ at: now + ms, fn });
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const t = timers[0];
      if (!t || t.at > end) break;
      timers.shift();
      now = t.at;
      t.fn();
    }
    now = end;
  };
  const onScreen = new Set<string>();
  const flow: SysFlow<string, string> = new SysFlow<string, string>({
    show: (m) => {
      onScreen.add(m);
      later(2400, () => flow.dismiss(m)); // kendi zamanlayıcısı
      return m;
    },
    hide: (h, done) => later(200, () => { onScreen.delete(h); done(); }),
  });
  return { flow, advance, onScreen };
}

describe('A1: sistem bildirimleri takılı kalmaz', () => {
  it('kapanış sürerken gelen bildirim beklenir, sonra gösterilir ve kendi süresiyle kapanır', () => {
    const { flow, advance, onScreen } = sysEnv();
    flow.push('A');
    advance(500);
    expect(flow.dismiss()).toBe(true); // dokunuş: A kapanmaya başladı
    advance(50);
    flow.push('B'); // kapanış sürerken
    expect([...onScreen]).toEqual(['A']); // B henüz gösterilmez
    advance(200);
    expect([...onScreen]).toEqual(['B']);
    expect(flow.current).toBe('B');
    advance(20000);
    expect(onScreen.size).toBe(0);
    expect(flow.current).toBeNull();
    expect(flow.queue).toEqual([]);
  });
  it('kapanırken ikinci dokunuş ve eski zamanlayıcı yeni bildirimi erken kapatmaz', () => {
    const { flow, advance, onScreen } = sysEnv();
    flow.push('A');
    advance(2300);
    flow.dismiss(); // A'yı elle kapat (A'nın zamanlayıcısı 100 ms sonra)
    expect(flow.dismiss()).toBe(false); // kapanırken yok sayılır
    flow.push('B');
    advance(150); // A'nın zamanlayıcısı burada çalışır: B'yi kapatmamalı
    advance(100);
    expect([...onScreen]).toEqual(['B']);
    advance(2000);
    expect([...onScreen]).toEqual(['B']);
    advance(1000);
    expect(onScreen.size).toBe(0);
  });
  it('art arda üç bildirim sırayla gösterilir; hepsi kapanır', () => {
    const { flow, advance, onScreen } = sysEnv();
    const seen: string[] = [];
    flow.push('A'); flow.push('B'); flow.push('C');
    for (let i = 0; i < 100; i++) {
      advance(100);
      for (const s of onScreen) if (!seen.includes(s)) seen.push(s);
      expect(onScreen.size).toBeLessThanOrEqual(1);
    }
    expect(seen).toEqual(['A', 'B', 'C']);
    expect(onScreen.size).toBe(0);
    expect(flow.busy).toBe(false);
  });
  it('kutlama sahnesi kendi bitişini bildirir (finish), sonra sıradaki gösterilir', () => {
    const shown: string[] = [];
    const flow = new SysFlow<string, string>({ show: (m) => (shown.push(m), m), hide: (_h, done) => done() });
    flow.push('quest'); flow.push('note');
    expect(shown).toEqual(['quest']);
    flow.finish('other'); // ilgisiz
    expect(shown).toEqual(['quest']);
    flow.finish('quest');
    expect(shown).toEqual(['quest', 'note']);
  });
});

describe('A2: kapı hedefli "git" amaçları binaya girişte tamamlanır', () => {
  it('kapı noktası ve 1,5 karo içi kapı sayılır; uzak nokta sayılmaz', () => {
    const d = [{ x: 10, y: 20, w: 1, h: 1 }];
    expect(doorGoal({ x: 10, y: 20 }, d)).toBe(true);
    expect(doorGoal({ x: 11, y: 21 }, d)).toBe(true);
    expect(doorGoal({ x: 13, y: 20 }, d)).toBe(false);
  });
  it('Yaralılar: şifacı kapısı hedefi şifa evinin kapısıyla eşleşir', () => {
    const q = QUESTS.find((x) => x.id === 'm_wounded')!;
    const o = q.objectives.find((x) => x.type === 'go' && x.where?.point === 'door_healer')!;
    const p = WORLD.points[o.where!.point!];
    expect(doorGoal(p, WORLD.warps.filter((w) => w.to === 'healer'))).toBe(true);
    expect(doorGoal(p, WORLD.warps.filter((w) => w.to === 'inn'))).toBe(false);
  });
  it('door_* hedefli her "git" amacı dünyadaki bir kapıya denk gelir', () => {
    for (const q of QUESTS) for (const o of q.objectives) {
      if (o.type !== 'go' || !o.where?.point?.startsWith('door_')) continue;
      const p = WORLD.points[o.where.point];
      expect(p, o.where.point).toBeTruthy();
      expect(doorGoal(p, WORLD.warps.filter((w) => !!w.to)), `${q.id}: ${o.where.point}`).toBe(true);
    }
  });
});

import { serveDifficulty, serveOutcome, servePerfTime, serveGoal } from '../src/core/serve';
describe('B13: Servis Koşturmacası hedefi, kazanma ve kaybetme', () => {
  it('Hedef müşteri sayısı tempodan türetilir: 1. gün 6, 2. gün 8 (0.10.0: iş iki gün)', () => {
    const g = [1, 2].map((d) => serveDifficulty(d).goal);
    expect(g).toEqual([6, 8]);
    for (const d of [1, 2]) {
      const c = serveDifficulty(d);
      expect(c.goal).toBe(serveGoal(c.dur, c.spawnEvery));
      // hedef, o tempoda gelen müşterilerden az (ulaşılabilir) ve tabak süresi sabırdan uzun
      expect(c.goal).toBeLessThan(c.dur / c.spawnEvery);
      expect(c.plateTime).toBeGreaterThan(c.patience);
    }
  });
  it('Kazanmak: hedef sayıda müşteri (tabağı bulaşıkta); kaybetmek anında', () => {
    const base = { completed: 0, goal: 5, orderExpired: false, plateExpired: false, t: 10, limit: 150 };
    expect(serveOutcome(base)).toBeNull();
    expect(serveOutcome({ ...base, completed: 5 })).toEqual({ win: true, loss: null });
    expect(serveOutcome({ ...base, completed: 4, orderExpired: true })).toEqual({ win: false, loss: 'order' });
    expect(serveOutcome({ ...base, plateExpired: true })).toEqual({ win: false, loss: 'plate' });
    // tabak süresi dolması hedefe ulaşmadan önce gelirse kayıp
    expect(serveOutcome({ ...base, completed: 5, plateExpired: true })?.win).toBe(false);
    expect(serveOutcome({ ...base, t: 150 })).toEqual({ win: false, loss: 'time' });
  });
  it('Performans hıza göre 0..1', () => {
    expect(servePerfTime(20, 5, 5.2)).toBe(1);
    expect(servePerfTime(200, 5, 5.2)).toBeLessThan(0.3);
  });
});

import { forfeitLoot, emptyLoot, lootEmpty } from '../src/core/transactions';
import { walletTotal } from '../src/core/money';
describe('B15: savaş ganimeti ölünce gider', () => {
  const ledger = () => ({ inventory: { rat_tail: 3, bread: 1 } as Record<string, number>, wallet: { bronze: 30, silver: 0, platinum: 0, gold: 0, diamond: 0 }, equipment: {} });
  it('savaş modunda toplanan eşya ve para geri alınır (olandan fazlası değil)', () => {
    const l = ledger();
    const loot = emptyLoot();
    loot.items.rat_tail = 2;
    loot.items.wolf_pelt = 1; // envanterde yok (satılmış/kullanılmış)
    loot.money = 12;
    const r = forfeitLoot(l, loot);
    expect(r.items).toEqual([{ id: 'rat_tail', qty: 2 }]);
    expect(r.money).toBe(12);
    expect(l.inventory.rat_tail).toBe(1);
    expect(walletTotal(l.wallet)).toBe(18);
  });
  it('ganimet yoksa (savaş bittikten sonra) hiçbir şey alınmaz', () => {
    const l = ledger();
    expect(lootEmpty(emptyLoot())).toBe(true);
    expect(forfeitLoot(l, emptyLoot())).toEqual({ items: [], money: 0 });
    expect(l.inventory.rat_tail).toBe(3);
  });
});

import { sellRange, sellOffer, closeness, lootKindLabel, baseSellValue } from '../src/core/selling';
import { ITEMS } from '../src/data/items';
import { SHOPS } from '../src/data/shops';
describe('B16: satış aralığı ve dükkân ilişkisi', () => {
  it('aralık: alt ≈ değer × 0,8, üst ≈ değer × 1,5', () => {
    expect(sellRange({ kind: 'material', price: 25, sell: 10 })).toEqual([8, 15]);
    expect(sellRange({ kind: 'food', price: 4, sell: 0 })).toEqual([0, 0]);
    for (const [id, it] of Object.entries(ITEMS)) {
      const [lo, hi] = sellRange(it);
      const v = baseSellValue(it);
      if (v <= 0) continue;
      expect(lo, id).toBeLessThanOrEqual(v);
      expect(hi, id).toBeGreaterThanOrEqual(v);
    }
  });
  it('konum = 0,5 × uzmanlık + 0,5 × yakınlık; almadığı eşya satılamaz', () => {
    const it = ITEMS.wolf_pelt;
    const [lo, hi] = sellRange(it);
    const tan = sellOffer(SHOPS.tannery, 'wolf_pelt', it, 10); // uzman, en yakın
    expect(tan.price).toBe(hi);
    const smithFar = sellOffer(SHOPS.smith, 'wolf_pelt', it, -5); // uzman değil, en uzak
    expect(smithFar.price).toBe(lo);
    const tan0 = sellOffer(SHOPS.tannery, 'wolf_pelt', it, -5);
    expect(tan0.price).toBe(Math.round(lo + (hi - lo) * 0.5));
    expect(sellOffer(SHOPS.bakery, 'wolf_pelt', it, 10).price).toBe(0); // fırın post almaz
    expect(closeness(0)).toBeCloseTo(1 / 3, 5);
  });
  it('drop türü etiketi', () => {
    expect(lootKindLabel('material')).toBe('Malzeme');
    expect(lootKindLabel('armor')).toBe('Ekipman');
    expect(lootKindLabel('food')).toBe('Yiyecek');
    expect(lootKindLabel('junk')).toBe('Diğer');
  });
});

import { gatherQty } from '../src/world/questGo';
import { questNeededItems, newQuestLog, startQuest } from '../src/core/quests';
import { NPCS, scheduleAt } from '../src/data/npcs';
import { BARRIER_X } from '../src/world/worldgen';
describe('B1–B3: elmalar, köprü yolu, görev malzemeleri', () => {
  it('her elma ağacı 3 elma verir: bir günde 6 elma toplanabilir', () => {
    const apples = WORLD.gathers.filter((g) => g.item === 'apple');
    expect(gatherQty('apple')).toBe(3);
    expect(gatherQty('herb')).toBe(1);
    expect(apples.length * gatherQty('apple')).toBeGreaterThanOrEqual(6);
    // görev oku: tek bir ağaç bile 3 verir, en yakın iki ağaçla 6
    expect(apples.length).toBeGreaterThanOrEqual(2);
  });
  it('köprü yolundaki apple3 ağacı ve toplama noktası kalktı (Köksüz Nim\'in yeri açık)', () => {
    expect(WORLD.gathers.some((g) => g.id === 'apple3')).toBe(false);
    const rb = WORLD.points.riverbank;
    const covering = WORLD.props.filter((p) => /^tree_/.test(p.key) && Math.abs(p.x / 32 - (rb.x + 0.5)) < 2 && p.y / 32 > rb.y && p.y / 32 < rb.y + 4);
    expect(covering.map((p) => p.key + '@' + p.x + ',' + p.y)).toEqual([]);
  });
  it('aktif görevin toplama amacındaki eşya teslim edilene kadar gereklidir', () => {
    const log = newQuestLog();
    const def = questDef('sq_baker_apples')!;
    startQuest(log, def, 1);
    expect(questNeededItems(log, questDef).has('apple')).toBe(true);
    // toplama tamam ama teslim edilmedi: hâlâ gerekli
    log.quests.sq_baker_apples.progress[0] = 6;
    expect(questNeededItems(log, questDef).has('apple')).toBe(true);
    // teslim (sonraki amaç bitti): artık yenebilir
    log.quests.sq_baker_apples.progress = log.quests.sq_baker_apples.progress.map(() => 99);
    expect(questNeededItems(log, questDef).has('apple')).toBe(false);
  });
});

describe('B11: doğu suru ve geçit', () => {
  it('sur haritanın sağ kenarı boyunca, geçit yolda; saray silüeti yok', () => {
    expect(WORLD.props.some((p) => p.key === '__city')).toBe(false);
    const segs = WORLD.props.filter((p) => p.key === '__east_wall');
    const gate = WORLD.props.find((p) => p.key === '__east_gate')!;
    expect(gate).toBeTruthy();
    // kapsama: 8 karoluk parçalar + 16 karoluk geçit haritanın tamamını örter
    const rows = new Set<number>();
    for (const s of segs) for (let y = s.y / 32 - 8; y < s.y / 32; y++) rows.add(y);
    for (let y = gate.y / 32 - 16; y < gate.y / 32; y++) rows.add(y);
    for (let y = 0; y < WORLD.h; y++) expect(rows.has(y), 'satır ' + y).toBe(true);
    // geçit yolun (y=57) hizasında, sur BARRIER_X'in doğusunda (batı yüzü yarım karo taşar)
    expect(gate.y / 32 - 16).toBeLessThan(57);
    expect(gate.y / 32).toBeGreaterThan(57);
    for (const s of segs) expect(s.x - 40).toBe(BARRIER_X * 32 - 16);
  });
  it('geçitte en az 4 şövalye gece gündüz nöbette', () => {
    const at = (h: number) => NPCS.filter((n) => n.id.startsWith('gate_knight') && scheduleAt(n, h, 3).map === 'world').map((n) => scheduleAt(n, h, 3).at);
    for (const h of [3, 12, 22]) {
      const pts = at(h).map((a) => WORLD.points[a as string]);
      expect(pts.length).toBeGreaterThanOrEqual(4);
      for (const p of pts) expect(Math.hypot(p.x - BARRIER_X, p.y - 57)).toBeLessThan(8);
    }
  });
});

import { naturalWalk, walkSetting, BASE_SPEED, RUN_MULT, JOSEPH_WALK_MULT } from '../src/core/movement';
import { derive } from '../src/core/creature';
import { newJoseph } from '../src/core/state';
import { MONSTERS } from '../src/data/monsters';
import { sanitizeSettings, defaultSettings } from '../src/game/settings';
describe('C1–C3: Joseph\'in hızı, hareket hızı ayarı, dayanıklılık', () => {
  it('L0 Joseph: yürüme eski hızın yarısı (0,75 × ⅔), koşu tavşandan hızlı; BASE_SPEED aynı', () => {
    const d = derive(newJoseph(), { level: 0 });
    expect(BASE_SPEED).toBe(5.2);
    expect(JOSEPH_WALK_MULT).toBeCloseTo(2 / 3, 10);
    expect(d.divSpeed).toBe(0.75);
    expect(d.divEndurance).toBe(0.75);
    expect(naturalWalk(d.moveSpeed)).toBeCloseTo(BASE_SPEED / 2, 10);
    expect(naturalWalk(d.moveSpeed) * RUN_MULT).toBeGreaterThan(MONSTERS.rabbit.speed);
    // 0.10.0 (B10): tavşan 3,5 → 2,8 — yürüyen Joseph'ten biraz hızlı (2,6), koşudan belirgin yavaş (≈4,2)
    expect(MONSTERS.rabbit.speed).toBe(2.8);
    expect(MONSTERS.rabbit.speed).toBeGreaterThan(naturalWalk(d.moveSpeed));
    expect(naturalWalk(d.moveSpeed) * RUN_MULT - MONSTERS.rabbit.speed).toBeGreaterThan(1);
    expect(MONSTERS.rabbit.cornered).toBeTruthy();
  });
  it('hareket hızı ayarı: max = doğal hız, en az %40, max\'ı geçen max\'a sabitlenir, asla hızlandırmaz', () => {
    const nat = 2.6;
    expect(walkSetting(nat, null)).toMatchObject({ max: 2.6, min: 1, value: 2.6, mult: 1, isMax: true });
    expect(walkSetting(nat, 9).value).toBe(2.6);
    expect(walkSetting(nat, 9).mult).toBeLessThanOrEqual(1);
    expect(walkSetting(nat, 0.2).value).toBe(1);
    expect(walkSetting(nat, 1.3).mult).toBeCloseTo(0.5, 5);
    for (let v = 0; v < 6; v += 0.1) expect(walkSetting(nat, v).mult).toBeLessThanOrEqual(1);
  });
  it('ayar göçü (v3 → v4): eski "Karakter hızı" kalkar, Hareket hızı "Max" olur', () => {
    const s = sanitizeSettings({ v: 3, moveSpeed: 2 } as any, true);
    expect(s.walkSpeed).toBeNull();
    expect('moveSpeed' in s).toBe(false);
    expect(defaultSettings(true).walkSpeed).toBeNull();
    expect(sanitizeSettings({ v: 4, walkSpeed: 1.5 } as any, true).walkSpeed).toBe(1.5);
  });
});

import { dodgeReady, DODGE_COST, DODGE_COOLDOWN } from '../src/core/combat';
describe('C5: vur-kaç', () => {
  it('kaçış bedeli 7,5 (× çarpan), iki kaçış arasında 0,8 sn', () => {
    expect(DODGE_COST).toBe(7.5);
    expect(DODGE_COOLDOWN).toBe(0.8);
    expect(dodgeReady(10, -10, 50)).toEqual({ ok: true, cost: 7.5, reason: null });
    expect(dodgeReady(10.5, 10, 50).reason).toBe('cooldown');
    expect(dodgeReady(10.8, 10, 50).ok).toBe(true);
    expect(dodgeReady(20, 10, 7).reason).toBe('stamina');
    expect(dodgeReady(20, 10, 50, 1.5).cost).toBeCloseTo(11.25);
  });
});

import { STAT_POINTS_PER_LEVEL } from '../src/core/formulas';
describe('C8 → B9 (0.10.0): NPC statları = 4 × level', () => {
  it('her NPC\'nin temel stat toplamı 4 × level (ekipman, unvan ve skill hariç)', () => {
    expect(STAT_POINTS_PER_LEVEL).toBe(4);
    for (const n of NPCS) {
      const sum = Object.values(n.creature.alloc).reduce((a, b) => a + b, 0);
      expect(sum, `${n.id} (L${n.creature.level})`).toBe(STAT_POINTS_PER_LEVEL * n.creature.level);
    }
  });
  it('büyü kullanan NPC\'lerde INT var (MNA INT\'e birleşti)', () => {
    for (const n of NPCS) if (n.creature.skills.some((s) => /magic/.test(s.id))) expect(n.creature.alloc.INT, n.id).toBeGreaterThan(0);
  });
});

import { WEAPON_VISUALS, JOSEPH_BIG } from '../src/data/manifest';
const JPNG = import.meta.glob('/assets/gfx/chars/joseph/*.png', { query: '?inline', import: 'default', eager: true }) as Record<string, string>;
const jsize = (rel: string): [number, number] => {
  const url = JPNG['/' + rel];
  if (!url) throw new Error('yok: ' + rel);
  const bin = atob(url.slice(url.indexOf(',') + 1, url.indexOf(',') + 1 + 44));
  const u32 = (o: number) => ((bin.charCodeAt(o) << 24) | (bin.charCodeAt(o + 1) << 16) | (bin.charCodeAt(o + 2) << 8) | bin.charCodeAt(o + 3)) >>> 0;
  return [u32(16), u32(20)];
};
describe('D2: mızrak ve yay savaşta elde yürür', () => {
  it('büyük kare yürüme katmanları var (128 px, 9 sütun, 4 yön); sırttaki görünüme düşmez', () => {
    for (const w of ['w_spear', 'w_bow']) {
      const v = WEAPON_VISUALS[w];
      expect(v.walkCarried, w).toBeFalsy();
      const walks = (v.big ?? []).filter((b) => b.anim === 'walk').map((b) => b.key);
      expect(walks.sort(), w).toEqual([w + '_walk', w + '_walk_bg']);
      for (const k of walks) {
        expect(JOSEPH_BIG[k].size).toBe(128);
        expect(jsize(JOSEPH_BIG[k].file)).toEqual([128 * 9, 128 * 4]);
      }
    }
  });
});
