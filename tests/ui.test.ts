// Grup 3 (0.5.0, arayüz) kuralları: eşya rütbeleri, saygınlık gösterimi, HUD görev kategorileri, görev EXP'si,
// terfi görevi ve kayıt göçü (v5 → v6), Appraisal metinleri.
import { describe, it, expect } from 'vitest';
import { ITEMS } from '../src/data/items';
import { prestigeLabel } from '../src/core/prestige';
import { hudQuestGroups, questCategory, questExp, newQuestLog, startQuest, type QuestKind } from '../src/core/quests';
import { MAIN_QUESTS, questDef, rankupQuest } from '../src/data/quests';
import { SIDE_QUESTS, boardForDay, BOARD_EXP } from '../src/data/sidequests';
import { MONSTERS } from '../src/data/monsters';
import { rankupQuestId, isRankupQuest, newGuildState, earnedRank, RANK_THRESHOLDS } from '../src/core/guild';
import { migrate, migrateV5toV6 } from '../src/core/save';
import { newGameState, CURRENT_SAVE_VERSION } from '../src/core/state';
import { appraisalDiffText, appraisalView } from '../src/core/appraisal';
import { LETTERS } from '../src/core/ranks';

describe('Eşya rütbeleri', () => {
  it('Kuşanılabilir her eşyada ve her malzemede rütbe var (alt kademesiz harf)', () => {
    for (const it of Object.values(ITEMS)) {
      if (it.slot || it.kind === 'weapon' || it.kind === 'armor' || it.kind === 'material') {
        expect(it.rank, it.id).toBeDefined();
        expect(LETTERS as readonly string[]).toContain(it.rank);
      }
    }
  });
  it('İksir, yemek ve görev eşyalarında rütbe gerekmez (ama varsa harftir)', () => {
    for (const it of Object.values(ITEMS)) if (it.rank) expect(it.rank).toMatch(/^[GFEDCBASX]$/);
  });
});

describe('Saygınlık gösterimi', () => {
  it('0 → +0, artı işaretli, eksi tipografik', () => {
    expect(prestigeLabel(0)).toBe('+0');
    expect(prestigeLabel(3)).toBe('+3');
    expect(prestigeLabel(-2)).toBe('−2');
  });
});

describe('HUD görev kategorileri', () => {
  const kinds: Record<string, QuestKind> = { m_a: 'main', s_b: 'side', b_c: 'board', m_d: 'main' };
  const kindOf = (id: string) => kinds[id];
  it('Pano görevleri yan görevlerle aynı kategoride', () => {
    expect(questCategory('main')).toBe('main');
    expect(questCategory('side')).toBe('side');
    expect(questCategory('board')).toBe('side');
  });
  it('Önce ana, sonra yan; sıra korunur', () => {
    expect(hudQuestGroups(['s_b', 'm_a', 'b_c', 'm_d'], kindOf, { main: true, side: true })).toEqual([
      { cat: 'main', ids: ['m_a', 'm_d'] },
      { cat: 'side', ids: ['s_b', 'b_c'] },
    ]);
  });
  it('Gizlenen ya da boş kategori hiç çıkmaz (başlığı da çizilmez)', () => {
    expect(hudQuestGroups(['s_b', 'm_a'], kindOf, { main: false, side: true })).toEqual([{ cat: 'side', ids: ['s_b'] }]);
    expect(hudQuestGroups(['m_a'], kindOf, { main: true, side: true })).toEqual([{ cat: 'main', ids: ['m_a'] }]);
    expect(hudQuestGroups(['m_a', 's_b'], kindOf, { main: false, side: false })).toEqual([]);
  });
});

describe('Görev EXP kuralı', () => {
  // Canavar avının EXP hızı (en zayıf av, Level 0): bir fare ~12 sn'de bulunup öldürülür.
  const rat = MONSTERS.rat;
  const huntPerMin = ((rat.exp[0] + rat.exp[1]) / 2) * (60 / 12);
  // En kısa yan görev bile birkaç dakika sürer (yürüme + toplama/teslim).
  const QUEST_MIN = 3;
  it('Ana görevler EXP vermez (tanımda yazsa bile)', () => {
    for (const q of MAIN_QUESTS) expect(questExp(q), q.id).toBe(0);
    expect(questExp({ ...MAIN_QUESTS[0], reward: { exp: 50 } })).toBe(0);
  });
  it('Yan görevler az EXP verir: aynı süre avlanmanın en fazla üçte ikisi (0.8.0: ödüller 2 katına çıktı)', () => {
    for (const q of SIDE_QUESTS) {
      const e = questExp(q);
      expect(e, q.id).toBeGreaterThan(0);
      expect(e, q.id).toBeLessThanOrEqual((huntPerMin * QUEST_MIN * 2) / 3);
    }
  });
  it('Pano görevleri az EXP verir', () => {
    for (let day = 1; day <= 30; day++)
      for (const q of boardForDay(day)) {
        expect(questExp(q)).toBe(BOARD_EXP[q.rank as 'G' | 'F']);
        expect(questExp(q)).toBeLessThanOrEqual((huntPerMin * QUEST_MIN) / 3);
      }
  });
});

describe('Terfi görevi (guild.pending kalktı)', () => {
  it('Yeni lonca durumunda bekleyen terfi alanı yok', () => {
    expect('pending' in newGuildState()).toBe(false);
  });
  it('Terfi görevi: ana görev, Celeste ile konuş, kimlik hedef kademeye göre', () => {
    const d = rankupQuest(1);
    expect(d.id).toBe(rankupQuestId(1));
    expect(isRankupQuest(d.id)).toBe(true);
    expect(isRankupQuest('m_promotion')).toBe(false);
    expect(d.kind).toBe('main');
    expect(d.title).toBe('Terfi');
    expect(d.objectives).toEqual([expect.objectContaining({ type: 'talk', target: 'celeste', label: 'Celeste ile rütben hakkında konuş' })]);
    expect(questExp(d)).toBe(0);
  });
  it('Eşik geçilince ulaşılan kademe (Level şartıyla)', () => {
    expect(earnedRank(RANK_THRESHOLDS[1], 0, 0)).toBe(1);
    expect(earnedRank(RANK_THRESHOLDS[3], 2, 0)).toBe(2); // F- için Level 1 gerekir
    expect(earnedRank(RANK_THRESHOLDS[3], 2, 1)).toBe(3);
  });
  it('Kayıt göçü v5 → v6: bekleyen terfi Terfi görevine dönüşür, kaybolmaz', () => {
    const s: any = newGameState();
    s.saveVersion = 5;
    s.guild = { member: true, points: 45, debt: 0, pending: { rank: 1, day: 9 }, revoked: 0 };
    s.player.guildRank = 0;
    s.time.day = 8;
    const m: any = migrate(JSON.parse(JSON.stringify(s)), 5);
    expect(m.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect('pending' in m.guild).toBe(false);
    const id = rankupQuestId(1);
    expect(m.quests.quests[id]?.status).toBe('active');
    expect(m.quests.quests[id].def.title).toBe('Terfi');
    expect(m.quests.tracked).toBe(id);
  });
  it('Kayıt göçü v5 → v6: terfi zaten işlendiyse görev açılmaz', () => {
    const d: any = { guild: { member: true, points: 45, debt: 0, pending: { rank: 1, day: 9 }, revoked: 0 }, player: { guildRank: 1 }, quests: newQuestLog(), time: { day: 9 } };
    migrateV5toV6(d);
    expect(d.guild.pending).toBeUndefined();
    expect(Object.keys(d.quests.quests)).toEqual([]);
  });
  it('Aynı terfi görevi ikinci kez açılmaz', () => {
    const log = newQuestLog();
    expect(startQuest(log, rankupQuest(2), 1, true)).toBe(true);
    expect(startQuest(log, rankupQuest(2), 1, true)).toBe(false);
  });
  it('Eski "Kayıtlar Yarın İşlenir" görevi eski kayıtlar için duruyor ama artık bekletmiyor', () => {
    const d = questDef('m_promotion')!;
    expect(d.title).toBe('Terfi');
    expect(JSON.stringify(d)).not.toMatch(/yarın/i);
  });
});

describe('Appraisal metinleri', () => {
  it('Sağ üst metin "direnç" değil "Appraisal" der', () => {
    for (const diff of [3, 2, 1, 0, -1, -2, -5]) {
      const t = appraisalDiffText(diff);
      expect(t).toMatch(/Appraisal/);
      expect(t).not.toMatch(/diren/i);
    }
    expect(appraisalDiffText(1)).toBe('Hedefin Appraisal\'ı seninkinden bir harf yüksek.');
    expect(appraisalDiffText(0, true)).toBe('Kendine bakıyorsun.');
  });
  it('Görünürlük kademelerinde envanter yok', () => {
    expect(Object.keys(appraisalView(0, 0)).sort()).toEqual(['diff', 'identity', 'skillExp', 'skills', 'stats', 'title', 'traits']);
  });
});
