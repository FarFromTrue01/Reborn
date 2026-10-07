// A3/B2 (0.10.0): ana görev zinciri saat denetimi. Zincirdeki her geçişte (önceki görev bitti → sıradaki görevin
// ilk amacı) günün her saati için: amaç (1) hemen yapılabilir mi, (2) değilse bekleme metni ve saati var mı ve
// yatak varken uyuyarak atlanabilir mi (≤ 36 saat), (3) hiç açıklamasız kilitlenme (BLOCKED) var mı?
// Sonuç tablosu PLAN.md'de ("Zincir saat denetimi"); `CHAIN_TABLE=1 npx vitest run tests/chainTimes.test.ts` yazdırır.
import { describe, it, expect } from 'vitest';
import { questDef } from '../src/data/quests';
import { NPC_BY_ID } from '../src/data/npcs';
import { nextReach, type ReachCtx } from '../src/world/reach';
import { storyGate } from '../src/story/gates';
import { absMinute } from '../src/core/sleep';
import { buildMaps } from '../src/world/maps';
import buildingsJson from '../assets/gfx/buildings/buildings.json';
import terrainJson from '../assets/gfx/tiles/terrain.json';

const WORLD = buildMaps(buildingsJson as any, (terrainJson as any).floors).world;
const D = 5;

/** Geçişler: [önceki, sıradaki, o anki bayraklar (D = geçiş günü)]. */
const TRANSITIONS: [string, string, Record<string, unknown>][] = [
  ['(uyanış)', 'm_inn', { woke: true }],
  ['m_inn', 'm_bertram', { bertram_deal: true }],
  ['m_bertram', 'm_harvest', { bertram_deal: true, bertram_done: true }],
  ['m_harvest', 'm_register', { bertram_deal: true, bertram_done: true, farm_done: true }],
  ['m_register', 'm_weapon', { bertram_deal: true, guild_registered: true }],
  ['m_weapon', 'm_board', { bertram_deal: true, guild_registered: true }],
  ['m_board', 'g1_rats', { bertram_deal: true, guild_registered: true }],
  ['m_grank', 'm_air', { bertram_deal: true }],
  ['m_air', 'm_wounded', { bertram_deal: true }],
  ['m_wounded', 'm_vl_rest', { bertram_deal: true, vl_healed_day: D }],
  ['m_vl_rest', 'f_wolves', { bertram_deal: true, friends_vl: D }],
  ['f_wolves', 'm_celebrate', { bertram_deal: true, celebrate_day: D }],
  ['m_celebrate', 'm_next_day', { bertram_deal: true, theft_day: D + 1 }],
  ['m_next_day', 'm_theft', { bertram_deal: true }],
  ['m_theft', 'm_vl_cellar', { bertram_deal: true, cellar_offer_day: D + 1 }],
  ['m_vl_cellar', 'f_cellar', { bertram_deal: true }],
  ['f_cellar', 'm_silver', { bertram_deal: true }],
  ['m_silver', 'm_farewell', { bertram_deal: true }],
  ['m_farewell', 'm_gate', { bertram_deal: true }],
];

type Cell = { kind: 'ok' | 'wait' | 'BLOCKED'; until?: number; sleep?: boolean; text?: string };

function ctxFor(quest: string): ReachCtx {
  return {
    open: (map, hour) => {
      if (map === 'world') return true;
      if (map === 'healer' && quest === 'm_wounded') return true; // hikâye istisnası (doorOverride)
      const w = WORLD.warps.find((x) => x.to === map);
      if (!w) return false;
      if (!w.hours) return true;
      return hour >= w.hours[0] && hour < w.hours[1];
    },
  };
}

function classify(next: string, flags: Record<string, unknown>, hour: number): Cell {
  const def = questDef(next)!;
  const o = def.objectives[0];
  const minute = hour * 60;
  const now = absMinute(D, minute);
  const bed = !!flags.bertram_deal;
  const story = storyGate(next, 0, { day: D, minute, flag: (k) => flags[k] });
  if (story) return { kind: 'wait', until: story.until, sleep: bed && story.until - now <= 36 * 60, text: story.text };
  const t = o.where!;
  const ctx = ctxFor(next);
  if (t.npc) {
    const npc = NPC_BY_ID[t.npc];
    const r = nextReach(npc, D, minute, ctx);
    if (!r) return { kind: 'BLOCKED', text: `${t.npc} 48 saat içinde ulaşılamaz` };
    if (r.now) return { kind: 'ok' };
    return { kind: 'wait', until: r.abs, sleep: bed && r.abs - now <= 36 * 60 };
  }
  if (t.map !== 'world') {
    if (ctx.open(t.map, hour)) return { kind: 'ok' };
    const w = WORLD.warps.find((x) => x.to === t.map);
    if (!w?.hours) return { kind: 'BLOCKED', text: `${t.map} kapalı` };
    const until = absMinute(D + (hour >= w.hours[0] ? 1 : 0), w.hours[0] * 60);
    return { kind: 'wait', until, sleep: bed && until - now <= 36 * 60 };
  }
  return { kind: 'ok' };
}

/** "06–15 hemen · 15–06 bekle+uyku" */
function summarize(cells: Cell[]): string {
  const lab = (c: Cell) => (c.kind === 'ok' ? 'hemen' : c.kind === 'BLOCKED' ? 'KİLİT' : c.sleep ? 'bekle (uyku)' : 'bekle');
  const out: string[] = [];
  let s = 0;
  for (let h = 1; h <= 24; h++) {
    if (h === 24 || lab(cells[h]) !== lab(cells[s])) {
      out.push(`${String(s).padStart(2, '0')}–${String(h % 24).padStart(2, '0')} ${lab(cells[s])}`);
      s = h;
    }
  }
  return out.join(' · ');
}

describe('Zincir saat denetimi (A3/B2)', () => {
  const table: string[] = [];
  for (const [prev, next, flags] of TRANSITIONS) {
    it(`${prev} → ${next}: her saatte ya hemen yapılabilir ya da bekleme metni ve saati var`, () => {
      const cells = Array.from({ length: 24 }, (_, h) => classify(next, flags, h));
      table.push(`| ${prev} → ${next} | ${questDef(next)!.objectives[0].label} | ${summarize(cells)} |`);
      for (let h = 0; h < 24; h++) {
        const c = cells[h];
        expect(c.kind, `${next} ${h}:00 ${c.text ?? ''}`).not.toBe('BLOCKED');
        if (c.kind === 'wait') {
          expect(c.until, `${next} ${h}:00`).toBeGreaterThan(absMinute(D, h * 60));
          // yatak varken (Bertram'la anlaşmadan sonra) bütün beklemeler uyuyarak atlanabilir
          if (flags.bertram_deal) expect(c.sleep, `${next} ${h}:00 uyku`).toBe(true);
        }
      }
    });
  }
  it('tablo', () => {
    if ((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.CHAIN_TABLE) console.log(['| Geçiş | İlk amaç | Günün saatleri |', '|---|---|---|', ...table].join('\n'));
    expect(table.length).toBe(TRANSITIONS.length);
  });
});

describe('İlk Kadeh daveti (A3.2)', () => {
  const f = (k: string) => ({ celebrate_day: D } as Record<string, unknown>)[k];
  it('davet günü 18:00 öncesi bekler; akşam açık; ertesi gün yine 18:00 (uyuyunca kaymaz, kaçırılırsa ertesi akşam)', () => {
    expect(storyGate('m_celebrate', 0, { day: D, minute: 10 * 60, flag: f })!.until).toBe(absMinute(D, 18 * 60));
    expect(storyGate('m_celebrate', 0, { day: D, minute: 19 * 60, flag: f })).toBeNull();
    expect(storyGate('m_celebrate', 0, { day: D + 1, minute: 60, flag: f })).toBeNull();
    expect(storyGate('m_celebrate', 0, { day: D + 1, minute: 9 * 60, flag: f })!.until).toBe(absMinute(D + 1, 18 * 60));
  });
});
