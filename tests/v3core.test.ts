// 0.3.0 çekirdek kuralları: dayanıklılık kilidi, EXP gösterimi, Lonca Puanı, ceza/borç/kart kaybı,
// terfi eşikleri, grup puanı, Saygınlık, uyku kuralı, giriş kartı süresi, görev durumları, kayıt göçü, ayarlar.
import { describe, it, expect } from 'vitest';
import { runStep } from '../src/core/stamina';
import { fmtExp } from '../src/ui/format';
import {
  QUEST_POINTS, RANK_THRESHOLDS, applyPenalty, applyReward, canTakeQuest, earnedRank, examRequired, groupPoints,
  levelRequirement, newGuildState, pointsToNext, reRegister, BOARD_REWARD,
} from '../src/core/guild';
import { parseSubRank } from '../src/core/ranks';
import { equipmentPrestige, npcPrestige, toneOf, regard, josephStatusOf } from '../src/core/prestige';
import { canSleep, absMinute } from '../src/core/sleep';
import { buyCard, daysLeft, hasValidCard, totalDaysLeft, CARD_DAYS, CARD_PRICE } from '../src/core/cards';
import { newQuestLog, startQuest, advance, notify, finishQuest, isActive, isDone, allObjectivesDone, visibleObjectives, expired, setProgress, type QuestDef } from '../src/core/quests';
import { questDef, MAIN_QUESTS } from '../src/data/quests';
import { migrate, MemoryStorage, writeSave, readSave } from '../src/core/save';
import { newGameState, CURRENT_SAVE_VERSION } from '../src/core/state';
import { sanitizeSettings, SETTINGS_VERSION } from '../src/game/settings';
import { ITEMS } from '../src/data/items';
import { SHOPS } from '../src/data/shops';
import { JOBS } from '../src/data/economy';

describe('A1: dayanıklılık kilidi', () => {
  it('Dayanıklılık 0 olunca kilitlenir; istek sürdükçe koşmaz', () => {
    const lock = { exhausted: false };
    expect(runStep(lock, true, 5)).toBe(true);
    expect(runStep(lock, true, 0)).toBe(false);
    expect(lock.exhausted).toBe(true);
    // dayanıklılık dolsa bile joystick sonda kaldıkça koşmaz
    expect(runStep(lock, true, 30)).toBe(false);
    expect(runStep(lock, true, 50)).toBe(false);
  });
  it('Koşu isteği bırakılınca (eşiğin altı / joystick bırakıldı / Shift bırakıldı) kilit kalkar', () => {
    const lock = { exhausted: true };
    expect(runStep(lock, false, 10)).toBe(false);
    expect(lock.exhausted).toBe(false);
    expect(runStep(lock, true, 10)).toBe(true);
  });
  it('0–1 arasında takılma yok: kilitliyken dolum bitene kadar hiç koşmaz', () => {
    const lock = { exhausted: false };
    let st = 0.5, ran = 0;
    for (let i = 0; i < 100; i++) {
      const r = runStep(lock, true, st);
      if (r) { ran++; st = Math.max(0, st - 0.2); } else st += 0.5;
      if (st <= 0) runStep(lock, true, 0);
    }
    expect(ran).toBeLessThanOrEqual(3);
  });
});

describe('B1: EXP gösterimi', () => {
  it('En fazla bir ondalık, virgül, kısaltma', () => {
    expect(fmtExp(0.5)).toBe('0,5');
    expect(fmtExp(2.5)).toBe('2,5');
    expect(fmtExp(3.3555)).toBe('3,3');
    expect(fmtExp(3)).toBe('3');
    expect(fmtExp(0)).toBe('0');
    expect(fmtExp(14.99)).toBe('14,9');
    expect(fmtExp(0.05)).toBe('0');
    expect(fmtExp(1.0000001)).toBe('1');
    expect(fmtExp(120.25)).toBe('120,2');
  });
});

describe('C3: Lonca Puanı ve rütbe', () => {
  it('G görevi 10, F görevi 30; her rütbede belirgin artış', () => {
    expect(QUEST_POINTS.G).toBe(10);
    expect(QUEST_POINTS.F).toBe(30);
    const order = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'X'] as const;
    for (let i = 1; i < order.length; i++) expect(QUEST_POINTS[order[i]]).toBeGreaterThanOrEqual(QUEST_POINTS[order[i - 1]] * 2);
  });
  it('Grup görevi: puanın %50\'si, aşağı yuvarlanır', () => {
    expect(groupPoints(30)).toBe(15);
    expect(groupPoints(15)).toBe(7);
    expect(groupPoints(1)).toBe(0);
  });
  it('Eşikler: G 40, G+ 100, F- 180 (ve Level 1)', () => {
    expect(RANK_THRESHOLDS[parseSubRank('G')]).toBe(40);
    expect(RANK_THRESHOLDS[parseSubRank('G+')]).toBe(100);
    expect(RANK_THRESHOLDS[parseSubRank('F-')]).toBe(180);
    expect(levelRequirement(parseSubRank('F-'))).toBe(1);
    expect(earnedRank(39, 0, 0)).toBe(0);
    expect(earnedRank(40, 0, 0)).toBe(parseSubRank('G'));
    expect(earnedRank(100, 0, 0)).toBe(parseSubRank('G+'));
    expect(earnedRank(200, 0, 0)).toBe(parseSubRank('G+')); // Level 0: F- olamaz
    expect(earnedRank(200, 0, 1)).toBe(parseSubRank('F-'));
    for (let i = 1; i < RANK_THRESHOLDS.length; i++) expect(RANK_THRESHOLDS[i]).toBeGreaterThan(RANK_THRESHOLDS[i - 1]);
  });
  it('Bölüm II hesabı: G1 + G2 + G3 = 30, ortak görev 15 → 45: tam bu görevle G', () => {
    const g = newGuildState();
    g.member = true;
    for (let i = 0; i < 3; i++) applyReward(g, QUEST_POINTS.G, 20);
    expect(g.points).toBe(30);
    expect(earnedRank(g.points, 0, 0)).toBe(0);
    applyReward(g, QUEST_POINTS.F, 40, true);
    expect(g.points).toBe(45);
    expect(earnedRank(g.points, 0, 0)).toBe(parseSubRank('G'));
    expect(pointsToNext(g.points, parseSubRank('G'))).toBe(55);
  });
  it('G, F ve E içinde terfi sınavsız; E-\'den itibaren (harf atlayan) sınavlı', () => {
    expect(examRequired(parseSubRank('G'))).toBe(false);
    expect(examRequired(parseSubRank('F-'))).toBe(false);
    expect(examRequired(parseSubRank('F+'))).toBe(false);
    expect(examRequired(parseSubRank('E-'))).toBe(true);
    expect(examRequired(parseSubRank('E'))).toBe(false);
    expect(examRequired(parseSubRank('E+'))).toBe(false);
    expect(examRequired(parseSubRank('D-'))).toBe(true);
    expect(examRequired(parseSubRank('D'))).toBe(true);
  });
  it('Kendi harfinin ve bir üstünün görevleri', () => {
    expect(canTakeQuest(0, 'G')).toBe(true);
    expect(canTakeQuest(0, 'F')).toBe(true);
    expect(canTakeQuest(0, 'E')).toBe(false);
    expect(canTakeQuest(parseSubRank('F'), 'E')).toBe(true);
  });
  it('Başarısızlık: görevin puanı ve ödülün iki katı kesilir; para yetmezse borç', () => {
    const g = newGuildState();
    g.member = true;
    g.points = 50;
    const r = applyPenalty(g, 30, 70, 100);
    expect(r.fine).toBe(140);
    expect(r.paid).toBe(100);
    expect(r.addedDebt).toBe(40);
    expect(g.debt).toBe(40);
    expect(g.points).toBe(20);
    expect(r.cardRevoked).toBe(false);
  });
  it('Borç sonraki ödüllerden düşülür', () => {
    const g = newGuildState();
    g.debt = 40;
    const a = applyReward(g, 10, 25);
    expect(a.paid).toBe(0);
    expect(a.toDebt).toBe(25);
    expect(g.debt).toBe(15);
    const b = applyReward(g, 10, 30);
    expect(b.paid).toBe(15);
    expect(g.debt).toBe(0);
  });
  it('Puan 0\'ın altına düşerse kart alınır; yeniden kayıt G- ve 0 puan', () => {
    const g = newGuildState();
    g.member = true;
    g.points = 20;
    const r = applyPenalty(g, 30, 60, 500);
    expect(r.cardRevoked).toBe(true);
    expect(g.member).toBe(false);
    expect(g.points).toBe(0);
    reRegister(g);
    expect(g.member).toBe(true);
    expect(g.points).toBe(0);
  });
  it('Pano ödülleri: G 15–40, F 60–90 bronz', () => {
    expect(BOARD_REWARD.G).toEqual([15, 40]);
    expect(BOARD_REWARD.F).toEqual([60, 90]);
  });
});

describe('C1: Saygınlık', () => {
  it('Her kuşanılabilir eşyanın Saygınlık değeri var', () => {
    for (const it of Object.values(ITEMS)) if (it.slot) expect(typeof it.saygınlık, it.id).toBe('number');
  });
  it('Yırtık şortla eksi, Bertram\'ın kıyafetleriyle artı, kaliteli zırhla daha yüksek', () => {
    const naked = equipmentPrestige({ pants: 'torn_shorts' });
    const clothed = equipmentPrestige({ chest: 'linen_shirt', pants: 'linen_pants', boots: 'cloth_shoes' });
    const armored = equipmentPrestige({ chest: 'padded_armor', pants: 'sturdy_pants', boots: 'hobnail_boots', helmet: 'iron_cap', weapon: 'iron_shortsword' });
    expect(naked).toBeLessThan(0);
    expect(clothed).toBeGreaterThan(naked);
    expect(armored).toBeGreaterThan(clothed + 8);
    expect(josephStatusOf(naked, false)).toBe('naked');
    expect(josephStatusOf(clothed, false)).toBe('rootless');
    expect(josephStatusOf(clothed, true)).toBe('adventurer');
  });
  it('Toplamı matematiksel: eşya değerlerinin ve boş slot cezalarının toplamı', () => {
    const eq = { chest: 'leather_vest', pants: 'linen_pants' } as const;
    expect(equipmentPrestige(eq)).toBe(ITEMS.leather_vest.saygınlık! + ITEMS.linen_pants.saygınlık! - 1);
  });
  it('Bertram\'ın çatlak sopası dükkândaki her silahtan zayıf ve Saygınlık\'ı eksi', () => {
    const st = ITEMS.cracked_stick;
    expect(st.saygınlık!).toBeLessThan(0);
    for (const sh of Object.values(SHOPS))
      for (const id of sh.stock) {
        const w = ITEMS[id];
        if (w.kind !== 'weapon') continue;
        expect(st.dmg![0] + st.dmg![1], id).toBeLessThan(w.dmg![0] + w.dmg![1]);
      }
  });
  it('Yüksek Saygınlıklı NPC daha az etkilenir; ton küçümseme → nötr → saygı', () => {
    const lowNpc = npcPrestige(2, {}), highNpc = npcPrestige(5, { cape: 'traveler_cape', ring1: 'copper_ring' });
    // aynı artış, alçak NPC'de daha çok fark yaratır
    expect(regard(10, lowNpc) - regard(0, lowNpc)).toBeGreaterThan(regard(10, highNpc) - regard(0, highNpc));
    expect(toneOf(-8, lowNpc)).toBe('scorn');
    expect(toneOf(16, lowNpc)).toBe('respect');
    expect(toneOf(-8, highNpc)).toBe('scorn');
    expect(toneOf(2, highNpc)).not.toBe('respect');
  });
});

describe('C9: uyku', () => {
  it('20:00 sonrası ya da 8 saat uyanık kaldıysa uyunur', () => {
    const t = (d: number, h: number) => absMinute(d, h * 60);
    expect(canSleep(21 * 60, t(1, 21), t(1, 15))).toBe(true);
    expect(canSleep(2 * 60, t(2, 2), t(1, 22))).toBe(true);
    expect(canSleep(10 * 60, t(2, 10), t(2, 6))).toBe(false); // 4 saat uyanık
    expect(canSleep(15 * 60, t(2, 15), t(2, 6))).toBe(true); // 9 saat uyanık
  });
  it('Art arda uyuyarak gün atlanamaz', () => {
    // 06:00'da uyandı, hemen tekrar uyumak istiyor
    expect(canSleep(6 * 60, absMinute(3, 360), absMinute(3, 360))).toBe(false);
  });
});

describe('C8: giriş kartı', () => {
  it('3 ay = 84 gün, 10 gümüş', () => {
    expect(CARD_DAYS).toBe(84);
    expect(CARD_PRICE).toBe(1000);
    const cards: any[] = [];
    const c = buyCard(cards, 'capital', 10);
    expect(c.from).toBe(10);
    expect(c.until).toBe(93);
    expect(daysLeft(c, 10)).toBe(84);
    expect(daysLeft(c, 93)).toBe(1);
    expect(daysLeft(c, 94)).toBe(0);
    expect(hasValidCard(cards, 'capital', 50)).toBe(true);
    expect(hasValidCard(cards, 'capital', 94)).toBe(false);
  });
  it('Süresi dolmadan alınan yeni kart eskisinin bittiği günden başlar', () => {
    const cards: any[] = [];
    buyCard(cards, 'capital', 10);
    const c2 = buyCard(cards, 'capital', 60);
    expect(c2.from).toBe(94);
    expect(c2.until).toBe(94 + 83);
    expect(totalDaysLeft(cards, 'capital', 60)).toBe(34 + 84);
    // süresi dolduktan sonra alınan kart bugünden başlar
    const c3 = buyCard(cards, 'capital', 300);
    expect(c3.from).toBe(300);
  });
});

describe('C2: görev durumları', () => {
  const def: QuestDef = {
    id: 't_q', kind: 'side', title: 'Test', desc: '', reward: { money: 5 },
    objectives: [{ type: 'kill', label: 'Fare', target: 'rat', count: 3 }, { type: 'talk', label: 'Konuş', target: 'oswin', sequential: true }],
  };
  const lookup = (id: string) => (id === def.id ? def : questDef(id));
  it('Başlat, olaylarla ilerle, sıralı amaç, bitir', () => {
    const log = newQuestLog();
    expect(startQuest(log, def, 1)).toBe(true);
    expect(startQuest(log, def, 1)).toBe(false);
    expect(isActive(log, 't_q')).toBe(true);
    expect(visibleObjectives(def, log.quests.t_q)).toEqual([0]);
    expect(advance(log, 't_q', 1, 1, lookup)).toBe(false); // sıralı: önce fareler
    notify(log, 'kill', 'rat', 1, lookup);
    notify(log, 'kill', 'rat', 5, lookup);
    expect(log.quests.t_q.progress[0]).toBe(3);
    expect(visibleObjectives(def, log.quests.t_q)).toEqual([0, 1]);
    notify(log, 'talk', 'oswin', 1, lookup);
    expect(allObjectivesDone(def, log.quests.t_q)).toBe(true);
    expect(finishQuest(log, 't_q', 'done', 2)).toBe(true);
    expect(isDone(log, 't_q')).toBe(true);
    expect(finishQuest(log, 't_q', 'failed', 2)).toBe(false);
  });
  it('Yeni ana görev otomatik takip edilir', () => {
    const log = newQuestLog();
    startQuest(log, def, 1);
    expect(log.tracked).toBe('t_q');
    startQuest(log, questDef('m_inn')!, 1);
    expect(log.tracked).toBe('m_inn');
    finishQuest(log, 'm_inn', 'done', 1);
    expect(log.tracked).toBe('t_q');
  });
  it('Süreli görevlerin süresi dolar', () => {
    const log = newQuestLog();
    startQuest(log, { ...def, id: 'tt', days: 2 }, 5, true);
    expect(expired(log, 6, lookup)).toEqual([]);
    expect(expired(log, 7, lookup)).toEqual(['tt']);
    expect(setProgress(log, 'tt', 0, 9, lookup)).toBe(true);
    expect(log.quests.tt.progress[0]).toBe(3);
  });
  it('Tüm ana görevlerin amaçları ve başlıkları dolu; kimlikler benzersiz', () => {
    const ids = new Set<string>();
    for (const q of MAIN_QUESTS) {
      expect(ids.has(q.id)).toBe(false);
      ids.add(q.id);
      expect(q.objectives.length, q.id).toBeGreaterThan(0);
      expect(q.title.length).toBeGreaterThan(2);
      if (q.guild) expect(q.rank, q.id).toBeTruthy();
    }
  });
});

describe('Kayıt göçü v3 (0.2.0) → v4 (0.3.0)', () => {
  const v3 = (flags: Record<string, any>, workDays = 0, extra: any = {}) => {
    const s: any = newGameState();
    for (const k of ['guild', 'quests', 'cards', 'awakeSince', 'party', 'board']) delete s[k];
    s.saveVersion = 3;
    s.flags = flags;
    s.counters = { workDays };
    s.pos = { map: 'world', x: 172, y: 74, facing: 'down' };
    return Object.assign(s, extra);
  };
  it('Sürüm 7', () => expect(CURRENT_SAVE_VERSION).toBe(7));
  it('Bertram\'ın işinin ortasında: 3/4 vardiya → 2/3 (son vardiyada ödeme alır), görev aktif', () => {
    const d = migrate(v3({ woke: true, inn_met: true, bertram_deal: true }, 3), 3);
    expect(d.counters.workDays).toBe(2);
    expect(d.quests.quests.m_bertram.status).toBe('active');
    expect(d.quests.quests.m_bertram.progress[0]).toBe(2);
    expect(d.quests.quests.m_inn.status).toBe('done');
    expect(d.quests.tracked).toBe('m_bertram');
    expect(JOBS.bertramShifts).toBe(3);
  });
  it('1/4 vardiya → 1/3', () => {
    const d = migrate(v3({ woke: true, inn_met: true, bertram_deal: true }, 1), 3);
    expect(d.counters.workDays).toBe(1);
    expect(d.quests.quests.m_bertram.progress[0]).toBe(1);
  });
  it('Hasat aşaması ve lonca kaydı aşaması', () => {
    const a = migrate(v3({ woke: true, inn_met: true, bertram_deal: true, bertram_done: true, farm_offered: true }, 4), 3);
    expect(a.quests.quests.m_harvest.status).toBe('active');
    expect(a.quests.quests.m_harvest.progress).toEqual([1, 0]);
    const b = migrate(v3({ woke: true, inn_met: true, bertram_deal: true, bertram_done: true, farm_done: true }, 4), 3);
    expect(b.quests.quests.m_register.status).toBe('active');
  });
  it('Lonca kaydı bitmiş (bitiş kartı görülmüş): Bölüm II başlar', () => {
    const d = migrate(v3({ woke: true, inn_met: true, bertram_deal: true, bertram_done: true, farm_done: true, guild_registered: true, ending_shown: true }, 4), 3);
    expect(d.guild.member).toBe(true);
    expect(d.quests.quests.m_weapon.status).toBe('active');
    expect(d.flags.ending_shown).toBeUndefined();
    expect(d.flags.ch2_start_day).toBe(1);
  });
  it('Hana gitmemiş yeni oyuncu: "Hana git" aktif ve takipte', () => {
    const d = migrate(v3({ woke: true }), 3);
    expect(d.quests.tracked).toBe('m_inn');
  });
  it('Köydeki konum yeni meydana taşınır; ormandaki konum korunur', () => {
    const a = migrate(v3({ woke: true }), 3);
    expect(a.pos.x).toBe(84);
    const b = migrate(v3({ woke: true }, 0, { pos: { map: 'world', x: 30, y: 60, facing: 'down' } }), 3);
    expect(b.pos.x).toBe(30);
  });
  it('Kaydet/oku tam tur (v1 kaydı da zincirle göç eder)', () => {
    const st = new MemoryStorage();
    const s = newGameState();
    writeSave(st, 'auto', s);
    expect(readSave(st, 'auto')!.saveVersion).toBe(7);
    st.setItem('elonth.save.manual1', JSON.stringify({ v: 1, savedAt: 1, summary: 'x', data: { ...v3({ woke: true }), saveVersion: 1 } }));
    const r = readSave(st, 'manual1')!;
    expect(r.saveVersion).toBe(7);
    expect(r.guild).toBeTruthy();
    expect(r.quests.tracked).toBe('m_inn');
  });
});

describe('B2: ayarlar', () => {
  it('Dokunmatikte varsayılan joystick sabit; bilinmeyen değer cihaz varsayılanına döner', () => {
    expect(sanitizeSettings({}, true).joystick).toBe('fixed');
    expect(sanitizeSettings({}, false).joystick).toBe('float');
    expect(sanitizeSettings({ v: 2, joystick: 'xyz' as any }, true).joystick).toBe('fixed');
  });
  it('Eski (v1) ayarlarda bilerek seçim yoksa dokunmatikte bir kez sabit yapılır', () => {
    expect(sanitizeSettings({ joystick: 'float' } as any, true).joystick).toBe('fixed');
    expect(sanitizeSettings({ joystick: 'float', joyChosen: true } as any, true).joystick).toBe('float');
    // sürüm 2'de oyuncunun seçimine dokunulmaz
    expect(sanitizeSettings({ v: 2, joystick: 'float', joyChosen: true }, true).joystick).toBe('float');
    expect(sanitizeSettings({}, true).v).toBe(SETTINGS_VERSION);
  });
  it('Yardımlı savaş varsayılan açık, geliştirici modu kapalı', () => {
    const s = sanitizeSettings({}, true);
    expect(s.assistCombat).toBe(true);
    expect(s.devMode).toBe(false);
  });
});

describe('Kayıt göçü v4 (0.3.x) → v5 (0.4.0)', () => {
  it('Level başına stat puanı farkı (6−4) verilir, cüzdan normalize', () => {
    const s: any = newGameState();
    s.saveVersion = 4;
    s.player.level = 3;
    s.player.unspent = 1;
    s.player.wallet = { bronze: 250, silver: 1, platinum: 0, gold: 0, diamond: 0 };
    const m = migrate(s, 4);
    expect(m.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(m.player.unspent).toBe(1 + 2 * 3);
    expect(m.player.wallet).toEqual({ bronze: 50, silver: 3, platinum: 0, gold: 0, diamond: 0 });
  });
  it('Level 0 kaydı değişmez', () => {
    const s: any = newGameState();
    s.saveVersion = 4;
    expect(migrate(s, 4).player.unspent).toBe(0);
  });
});
