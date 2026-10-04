// Grup 4A (0.6.0, görevler ve içerik) kuralları.
import { describe, it, expect } from 'vitest';
import { RealClock } from '../src/core/clock';
import { monsterPortraitFrame } from '../src/data/monsters';
import { CITY_NAMES, CITY_FULL_NAMES } from '../src/core/cards';
import { NPC_BY_ID } from '../src/data/npcs';
import { subRankToString } from '../src/core/ranks';
import { GUILD_HOURS } from '../src/data/shops';
import { SCHEDULES } from '../src/data/schedules';
import { MAX_BOARD_QUESTS } from '../src/data/sidequests';

import monstersMeta from '../assets/gfx/monsters/monsters.json';

/** Depodaki metin dosyaları (Vite glob; credits listeleri hariç). */
const FILES = import.meta.glob(['/src/**/*.{ts,json}', '/tools/**/*.mjs', '/*.{md,html,json}', '/tests/**/*.ts', '!/tests/g4a.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('Kutlama saati gerçek zamanla ilerler (15b)', () => {
  it('5 FPS\'te 4 saniye ≈ 4000 ms ilerler (kare deltasına bağlı değil)', () => {
    const c = new RealClock(0);
    let t = 0;
    for (let now = 200; now <= 4000; now += 200) t += c.step(now);
    expect(t).toBe(4000);
  });
  it('Uzun duraklama tek adımda en fazla 1 sn sayılır, geri giden saat sıfır', () => {
    const c = new RealClock(0);
    expect(c.step(60000)).toBe(1000);
    expect(c.step(59000)).toBe(0);
  });
});

describe('Yaratık portresi kameraya bakar (15d)', () => {
  it('Fare ve tavşan: aşağı yön satırının ilk karesi', () => {
    expect(monsterPortraitFrame((monstersMeta as any).m_rat)).toBe(2 * 4);
    expect(monsterPortraitFrame((monstersMeta as any).m_rabbit)).toBe((4 + 2) * 4);
    expect(monsterPortraitFrame((monstersMeta as any).m_rat, 3)).toBe(3);
  });
  it('Her yaratık sayfasında portre karesi sayfanın içinde', () => {
    for (const [k, m] of Object.entries<any>(monstersMeta as any)) {
      const rows = Math.max(...Object.values<any>(m.anims).map((a) => a.row + 4));
      expect(monsterPortraitFrame(m), k).toBeLessThan(rows * m.cols);
    }
  });
});

describe('Eros ve Valmont (14)', () => {
  it('Şehrin adı Eros; anahtar kayıt uyumu için capital', () => {
    expect(CITY_NAMES.capital).toBe('Eros');
    expect(CITY_FULL_NAMES.capital).toContain('Eros');
  });
  it('Depoda "Valmont" ve "kraliyet şehri" geçmez', () => {
    const hits = Object.entries(FILES).filter(([p, src]) => !p.includes('credits') && (/valmont/i.test(src) || /kraliyet şehr/i.test(src))).map(([p]) => p);
    expect(Object.keys(FILES).length).toBeGreaterThan(50);
    expect(hits).toEqual([]);
  });
  it('Kâhyanın soyadı soylu aileyle aynı değil', () => {
    expect(NPC_BY_ID.steward.creature.name).toBe('Edric Fenwick');
  });
});

describe('Dorn ve lonca (13, 9)', () => {
  it('Dorn F+', () => {
    expect(subRankToString(NPC_BY_ID.dorn.creature.guildRank!)).toBe('F+');
  });
  it('Lonca 05:00–24:00; Celeste\'nin programı aynı saatleri kullanır', () => {
    expect(GUILD_HOURS).toEqual([5, 24]);
    const work = SCHEDULES.celeste.base.find((e) => e.map === 'guild')!;
    expect([work.from, work.to]).toEqual(GUILD_HOURS);
  });
  it('Panodan aynı anda en fazla 3 görev', () => {
    expect(MAX_BOARD_QUESTS).toBe(3);
  });
});

// ---------------------------------------------------------------------------------------------- 0.6.0 görevler
import { newQuestLog, startQuest, finishQuest, activeQuests, type QuestLog } from '../src/core/quests';
import { questDef, MAIN_QUESTS, rankupQuest } from '../src/data/quests';
import { SIDE_QUESTS, BOARD_TEMPLATES, boardForDay } from '../src/data/sidequests';
import { ensureMainQuest, nextMainQuest, CHAIN, STEP_QUESTS, type MainlineOps } from '../src/story/mainline';
import { hourAt, whenLabel } from '../src/core/time';
import { absMinute } from '../src/core/sleep';
import { nextReach, waitText, type ReachCtx } from '../src/world/reach';
import { entryAtPost, giverMarks, SIDE_POSTS, type SideQuestView } from '../src/story/sideposts';
import { scheduleAt } from '../src/data/npcs';
import { migrate } from '../src/core/save';
import { newGameState } from '../src/core/state';

function opsFor(log: QuestLog, flags: Record<string, unknown>, rank: { v: number | null }): MainlineOps {
  return {
    status: (id) => log.quests[id]?.status ?? null,
    flag: (k) => flags[k],
    get rank() { return rank.v; },
    active: () => activeQuests(log),
    start: (id) => { startQuest(log, (log.quests[id]?.def ?? questDef(id))!, 1); },
    closeStep: (id) => { finishQuest(log, id, 'done', 1); },
  };
}

const isMain = (log: QuestLog, id: string) => (log.quests[id]?.def ?? questDef(id))?.kind === 'main';

describe('Ana görev asla boş kalmaz (1)', () => {
  it('Geliştirici araçlarıyla (görevi doğrudan bitirerek) zincir baştan sona: her adımda en az bir aktif ana görev', () => {
    const log = newQuestLog();
    const flags: Record<string, unknown> = { woke: true };
    const rank = { v: null as number | null };
    const ops = opsFor(log, flags, rank);
    const seen: string[] = [];
    for (let i = 0; i < 80; i++) {
      ensureMainQuest(ops);
      const act = activeQuests(log).filter((id) => isMain(log, id));
      if (log.quests.m_gate?.status === 'done') break;
      expect(act.length, `adım ${i}: ${seen.join(' → ')}`).toBeGreaterThan(0);
      const id = act[0];
      seen.push(id);
      // m_grank: alt görevleri de bitir; f_wolves: terfi (G)
      if (id === 'm_register') rank.v = 0;
      if (id === 'f_wolves') rank.v = 1;
      finishQuest(log, id, 'done', 1);
    }
    expect(seen).toEqual([
      'm_inn', 'm_bertram', 'm_harvest', 'm_register', 'm_weapon', 'm_board', 'm_grank', 'm_air', 'm_wounded', 'm_vl_rest', 'f_wolves',
      'm_celebrate', 'm_next_day', 'm_theft', 'm_vl_cellar', 'f_cellar', 'm_silver', 'm_farewell', 'm_gate',
    ]);
    // bölüm bitti: güvence bir şey açmaz
    expect(ensureMainQuest(ops)).toBeNull();
    for (const c of CHAIN) expect(log.quests[c]?.status, c).toBe('done');
  });

  it('Bekleme adımı, zincirin asıl görevi başlayınca sessizce kapanır (terfi görevi kapatmaz)', () => {
    const log = newQuestLog();
    const flags: Record<string, unknown> = { woke: true };
    const ops = opsFor(log, flags, { v: 1 });
    for (const id of ['m_inn', 'm_bertram', 'm_harvest', 'm_register', 'm_weapon', 'm_board', 'm_grank', 'm_air', 'm_wounded']) {
      startQuest(log, questDef(id)!, 1);
      finishQuest(log, id, 'done', 1);
    }
    expect(ensureMainQuest(ops)).toBe('m_vl_rest');
    // araya bir terfi görevi girerse adım açık kalır
    startQuest(log, rankupQuest(1), 1, true);
    ensureMainQuest(ops);
    expect(log.quests.m_vl_rest.status).toBe('active');
    // Vera'yla konuşup ilk ortak görevi alınca
    startQuest(log, questDef('f_wolves')!, 1);
    ensureMainQuest(ops);
    expect(log.quests.m_vl_rest.status).toBe('done');
  });

  it('Kutlamadan sonra G\'ye yetmeyen puan: "G Rütbesi" adımı; G olunca İlk Kadeh', () => {
    const st: Record<string, any> = { f_wolves: 'done' };
    const o = { status: (id: string) => st[id] ?? null, flag: () => false, rank: 0 };
    expect(nextMainQuest(o)).toBe('m_gpoints');
    expect(nextMainQuest({ ...o, rank: 1 })).toBe('m_celebrate');
  });

  it('Adım görevleri ana görev ve tanımlı; her ana görev amacının yönlendirmesi var', () => {
    for (const id of STEP_QUESTS) expect(questDef(id)?.kind, id).toBe('main');
  });
});

describe('Görev metinleri: saat ve bekleme (3, 10)', () => {
  it('Türkçe saat ekleri', () => {
    expect(hourAt(14)).toBe("14:00'te");
    expect(hourAt(5)).toBe("05:00'te");
    expect(hourAt(6)).toBe("06:00'da");
    expect(hourAt(8)).toBe("08:00'de");
    expect(hourAt(18)).toBe("18:00'de");
    expect(hourAt(9)).toBe("09:00'da");
  });
  it('Bugün / yarın / ileri gün', () => {
    expect(whenLabel(absMinute(3, 600), absMinute(3, 840))).toBe("14:00'te");
    expect(whenLabel(absMinute(3, 1300), absMinute(4, 360))).toBe("yarın 06:00'da");
    expect(whenLabel(absMinute(3, 600), absMinute(5, 480))).toBe("5. gün 08:00'de");
  });
});

describe('NPC hedefli amaçlar: ulaşılabilirlik (3)', () => {
  const haldor = NPC_BY_ID.haldor;
  const closed: ReachCtx = { open: (m) => m !== 'farmhouse' };
  const open: ReachCtx = { open: () => true };
  // temel programın uygulandığı bir gün bul
  const day = [1, 2, 3, 4, 5, 6, 7, 8].find((d) => scheduleAt(haldor, 15, d).to === 18)!;
  it('Tarladayken şimdi ulaşılır', () => {
    const r = nextReach(haldor, day, 8 * 60, open)!;
    expect(r.now).toBe(true);
    expect(r.entry.at).toBe('haldor_field');
  });
  it('Çiftlik evi girilemezse 12–14 arası bekle: 14:00\'te tarlada', () => {
    const r = nextReach(haldor, day, 12 * 60 + 30, closed)!;
    expect(r.now).toBe(false);
    expect(r.abs).toBe(absMinute(day, 14 * 60));
    expect(waitText(haldor, absMinute(day, 12 * 60 + 30), r)).toBe("Haldor 14:00'te tarlada olur — o saate kadar bekle");
  });
  it('Gece gizli: ertesi sabah 06:00', () => {
    const r = nextReach(haldor, day, 23 * 60, open)!;
    expect(r.abs).toBe(absMinute(day + 1, 6 * 60));
    expect(waitText(haldor, absMinute(day, 23 * 60), r)).toMatch(/^Haldor yarın 06:00'da tarlada olur/);
  });
});

describe('Yönlendirme: hiçbir görev amacı yönlendirmesiz değil (9)', () => {
  it('Ana, yan ve pano görevlerinin her amacında where var', () => {
    const all = [...MAIN_QUESTS, ...SIDE_QUESTS, rankupQuest(1), ...BOARD_TEMPLATES.map((t) => ({ id: t.key, ...t.make('x') }))];
    for (const q of all) q.objectives.forEach((o, i) => expect(o.where, `${q.id}#${i} ${o.label}`).toBeDefined());
  });
  it('Öldürme amaçları yaratığa, toplama amaçları eşyaya yönlendirir (pano)', () => {
    for (const t of BOARD_TEMPLATES)
      for (const o of t.make('x').objectives) {
        if (o.type === 'kill') expect(o.where?.monster, t.key).toBe(o.target);
        if (o.type === 'collect' && o.target !== 'herb') expect(o.where?.item, t.key).toBe(o.target);
      }
  });
  it('Günün pano ilanları da yönlendirmeli', () => {
    for (let d = 1; d < 20; d++) for (const q of boardForDay(d)) for (const o of q.objectives) expect(o.where, q.id).toBeDefined();
  });
});

describe('Yan görevler iş yerinde (8)', () => {
  const pts = (m: string) => (m === 'world' ? { manor_front: { x: 119, y: 57 }, mill_yard: { x: 67, y: 91 }, plaza: { x: 84, y: 62 }, inn_front: { x: 78, y: 54 } } : { back_1: { x: 13, y: 11 } }) as any;
  it('Her yan görev verenin iş yeri ve kendine özgü yönlendirme repliği var', () => {
    const givers = new Set(SIDE_QUESTS.map((q) => q.giver!));
    for (const g of givers) expect(SIDE_POSTS[g], g).toBeDefined();
    const lines = Object.values(SIDE_POSTS).map((p) => p.away);
    expect(new Set(lines).size).toBe(lines.length);
  });
  it('Dükkânı olanlar dükkânında ve saatinde; demirci handayken değil', () => {
    expect(entryAtPost('smith', { from: 8, to: 18, map: 'smithy', at: 'smith' }, 10, pts)).toBe(true);
    expect(entryAtPost('smith', { from: 18, to: 22, map: 'inn', at: 'seat_m1' }, 19, pts)).toBe(false);
    expect(entryAtPost('healer', { from: 9, to: 17, map: 'healer', at: 'healer' }, 17.5, pts)).toBe(false);
  });
  it('Dükkânı olmayanlar görev yerinin yakınında (Pip meydanda, Nim hanın önünde ya da arka köşede)', () => {
    expect(entryAtPost('pip', { from: 9, to: 12, map: 'world', at: 'plaza' }, 10, pts)).toBe(true);
    expect(entryAtPost('vagrant', { from: 17, to: 23, map: 'inn', at: 'back_1' }, 18, pts)).toBe(true);
    expect(entryAtPost('vagrant', { from: 12, to: 17, map: 'world', at: [138, 58] }, 13, pts)).toBe(false);
    // tüccar sabahları konağın önünde (0.6.0 programı)
    const m = NPC_BY_ID.merchant;
    const days = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((d) => entryAtPost('merchant', scheduleAt(m, 10, d), 10, pts));
    expect(days.length).toBeGreaterThan(5);
  });
  it('İşaretler: alınmamış görev "!", teslime hazır "?", reddedilen gün yok', () => {
    const st: Record<string, any> = { sq_baker_apples: 'active' };
    const v: SideQuestView = { status: (id) => st[id] ?? null, objective: (id) => (id === 'sq_baker_apples' ? 1 : -1), unlocked: true, declinedToday: (id) => id === 'sq_smith_jelly', has: () => false };
    const m = giverMarks(v);
    expect(m.baker).toBe('turnin');
    expect(m.tanner).toBe('offer');
    expect(m.smith).toBeUndefined();
    expect(giverMarks({ ...v, unlocked: false }).tanner).toBeUndefined();
  });
});

describe('Kayıt göçü v6 → v7 (0.6.0)', () => {
  it('İlk Kadeh\'in ilerleme dizisi iki amaca uzar; kayıttaki pano ilanı yönlendirme kazanır', () => {
    const s: any = newGameState();
    s.saveVersion = 6;
    s.quests.quests.m_celebrate = { id: 'm_celebrate', status: 'active', progress: [0], startedDay: 1 };
    s.quests.quests.m_inn = { id: 'm_inn', status: 'done', progress: [1], startedDay: 1 };
    const b = boardForDay(3).find((q) => q.objectives.some((o) => o.type === 'kill' || o.type === 'collect'))!;
    const old = JSON.parse(JSON.stringify(b));
    for (const o of old.objectives) delete o.where;
    s.quests.quests[b.id] = { id: b.id, status: 'active', progress: old.objectives.map(() => 0), startedDay: 3, def: old };
    const m: any = migrate(JSON.parse(JSON.stringify(s)), 6);
    expect(m.saveVersion).toBe(7);
    expect(m.quests.quests.m_celebrate.progress).toEqual([0, 0]);
    expect(m.quests.quests[b.id].def.objectives[0].where).toBeDefined();
  });
});
