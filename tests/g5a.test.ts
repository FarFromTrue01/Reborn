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
