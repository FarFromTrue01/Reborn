// Grup 7 — E: hikâye kontrol noktaları (story/checkpoints), geliştirici "Tamamla" yan etkileri, hata sayacı.
import { describe, it, expect } from 'vitest';
import { buildCheckpoint, CHECKPOINTS, QUEST_EFFECTS } from '../src/story/checkpoints';
import { nextMainQuest } from '../src/story/mainline';
import { activeQuests } from '../src/core/quests';
import { walletTotal } from '../src/core/money';
import { newGameState } from '../src/core/state';
import { migrate } from '../src/core/save';
import { CURRENT_SAVE_VERSION } from '../src/core/state';
import { errorCount, logError, clearErrors } from '../src/game/errorLog';
import { buildMaps } from '../src/world/maps';
import buildingsJson from '../assets/gfx/buildings/buildings.json';
import terrainJson from '../assets/gfx/tiles/terrain.json';

const MAPS = (() => {
  const all = buildMaps(buildingsJson as any, (terrainJson as any).floors);
  return { world: all.world, ...all.interiors } as Record<string, any>;
})();
const pts = (m: string) => MAPS[m].points;

const opsOf = (s: ReturnType<typeof newGameState>) => ({
  status: (id: string) => s.quests.quests[id]?.status ?? null,
  flag: (k: string) => !!s.flags[k],
  rank: s.guild.member ? s.player.guildRank : null,
});

describe('E: kontrol noktaları', () => {
  it('her nokta kurulur, konum haritanın içinde ve sıradaki ana görev tutarlı', () => {
    for (const c of CHECKPOINTS) {
      const s = buildCheckpoint(c.id, pts);
      const map = MAPS[s.pos.map];
      expect(map, c.id).toBeTruthy();
      expect(s.pos.x, c.id).toBeGreaterThan(0);
      expect(s.pos.y, c.id).toBeGreaterThan(0);
      expect(s.pos.x).toBeLessThan(map.w);
      expect(s.pos.y).toBeLessThan(map.h);
      const act = activeQuests(s.quests);
      const next = nextMainQuest(opsOf(s));
      // ana zincirde açık görev ya da sıradaki halka var (Kapı sonrası hariç)
      expect(act.length > 0 || next !== null, c.id).toBe(true);
      if (next) expect(['active', undefined]).toContain(s.quests.quests[next]?.status);
    }
  });

  it('loncaya kayıt sonrası üye, kart elde ve pano açık; para eksiye düşmez', () => {
    const s = buildCheckpoint('registered', pts);
    expect(s.guild.member).toBe(true);
    expect(s.player.inventory.guild_card).toBe(1);
    expect(s.flags.ch2_board_open).toBeTruthy();
    expect(walletTotal(s.player.wallet)).toBeGreaterThanOrEqual(0);
    expect(activeQuests(s.quests)).toContain('m_grank');
  });

  it('İlk Kadeh noktası: G rütbesi, kutlama görevi açık, sıradaki m_celebrate', () => {
    const s = buildCheckpoint('celebrate', pts);
    expect(s.player.guildRank).toBe(1);
    expect(activeQuests(s.quests)).toContain('m_celebrate');
    expect(s.flags.friends_vl).toBeTruthy();
  });

  it('Kapı noktası: veda bitti, m_gate açık; bilinmeyen nokta hata verir', () => {
    const s = buildCheckpoint('gate', pts);
    expect(s.quests.quests.m_farewell.status).toBe('done');
    expect(activeQuests(s.quests)).toContain('m_gate');
    expect(nextMainQuest(opsOf(s))).toBe('m_gate');
    expect(() => buildCheckpoint('yok', pts)).toThrow();
  });

  it('kurulan durum kayıt göçünden geçer (v10 biçiminde)', () => {
    for (const c of CHECKPOINTS) {
      const s = buildCheckpoint(c.id, pts);
      const back = migrate(JSON.parse(JSON.stringify(s)), CURRENT_SAVE_VERSION);
      expect(back.time.day).toBe(s.time.day);
      expect(back.pos.map).toBe(s.pos.map);
    }
  });

  it('geliştirici "Tamamla": mini oyunlu adımlar bayrakları kurar (Grup 6 bilinen sorunu)', () => {
    const s = newGameState();
    QUEST_EFFECTS.m_bertram(s, 2);
    expect(s.flags.bertram_done).toBe(true);
    QUEST_EFFECTS.m_harvest(s, 3);
    expect(s.flags.farm_done).toBe(true);
    QUEST_EFFECTS.m_register(s, 3);
    expect(s.guild.member).toBe(true);
  });
});

describe('E: hata sayacı', () => {
  it('logError sayacı artırır, clearErrors sıfırlar', () => {
    clearErrors();
    expect(errorCount()).toBe(0);
    logError('test', new Error('x'));
    expect(errorCount()).toBe(1);
    clearErrors();
    expect(errorCount()).toBe(0);
  });
});
