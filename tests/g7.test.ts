// Grup 7 (0.11.0) — B, C, D ve v10 göçü: saf kurallar (dövüş kuralları tests/g7combat.test.ts'te).
import { describe, it, expect } from 'vitest';
import { ToastStack, TOAST_SHOW_MS, TOAST_FADE_MS, TOAST_HARD_MS } from '../src/ui/toastStack';
import { lineIcon, parseSysLine, stackLines, sysPlacement, sysTheme, SYS_THEME } from '../src/ui/sysLayout';
import { BubbleQueue } from '../src/world/bubbleQueue';
import { cardLayout, cardSections, CARD_RATIO } from '../src/ui/cardLayout';
import { spendLock, GUILD_LOCK_TITLE, GUILD_LOCK_TEXT } from '../src/core/spendLock';
import { decaySatiety, eatSatiety, hungerState, SATIETY_MAX } from '../src/core/hunger';
import { ITEMS } from '../src/data/items';
import { readTimeMs, READ_BASE_MS, READ_PER_CHAR_MS, STATUS_SCREEN_MS } from '../src/core/readTime';
import { REMOVED_SETTINGS, sanitizeSettings, SETTINGS_VERSION } from '../src/game/settings';
import { RANK_BG, RANK_EDGE, RANK_TEXT } from '../src/ui/rankPalette';
import { QUEST_OVERLAY, RANK_OVERLAY, overlayAutoDone, overlayTap } from '../src/ui/overlayRules';
import { storyGate } from '../src/story/gates';
import { PARTY_ZONES, PARTY_DOOR_LINES, leashStep, newLeash, partyDoorAllowed, zoneDistance, LEASH_EXTRA_TILES, LEASH_SECONDS } from '../src/core/partyZone';
import { buildMaps } from '../src/world/maps';
import buildingsJson from '../assets/gfx/buildings/buildings.json';
import terrainJson from '../assets/gfx/tiles/terrain.json';
import { appraisalBaseExp, appraisalKey, claimAppraisalExp, APPRAISAL_BASE_SCALE, APPRAISAL_REPEAT_MULT } from '../src/core/appraisal';
import { divineExpToNext, streakMultiplier, trainingExp, victoryDivineExp } from '../src/core/divine';
import { expToNext } from '../src/core/formulas';
import { MONSTERS } from '../src/data/monsters';
import { TRAINING_SPOTS } from '../src/data/props';
import { MINIGAME_GOAL, MISS_PENALTY_SEC, SWING_LOCK_SEC, LIFT_ZONE_FRAC, accuracy, minigameWon, runStepDelta, swingAccepted } from '../src/core/minigameRules';
import {
  codexAppraiseMonster, codexAppraisePerson, codexBadge, codexIsNew, codexKill, codexMarkSeen, codexMeet, codexNewCount, codexSorted,
  codexTotals, codexIds, codexName, newCodex, personCard, monsterCard, codexSnapshotMigrate,
} from '../src/core/codex';
import { parseSubRank } from '../src/core/ranks';
import { QUEST_POINTS, RANK_THRESHOLDS, applyReward, earnedRank, newGuildState, questPointsFor, questPointsLabel } from '../src/core/guild';
import { LOOT_BLINK_SEC, LOOT_LIFE_SEC, LOOT_FX_MAX, lootVisible } from '../src/world/lootRules';
import { MemoryStorage } from '../src/core/save';
import {
  SLOT_IDS, deleteSlot, importToSlot, lastSlot, migrateSlots, newGameNeedsConfirm, readSlot, slotLine, slotMeta, writeSlot,
} from '../src/core/slots';
import { newGameState, CURRENT_SAVE_VERSION } from '../src/core/state';
import { migrate, migrateV9toV10 } from '../src/core/save';
import { errors, logError, clearErrors, errorsText } from '../src/game/errorLog';
import { VERA_LESSON } from '../src/data/lessons';

const WORLD = buildMaps(buildingsJson as any, (terrainJson as any).floors).world;

describe('B1 bildirim ömrü', () => {
  it('kaybolma sırasında HUD yüksekliği değişse de bildirim yok olur (yeniden dizme kaybolmaya dokunmaz)', () => {
    const st = new ToastStack<string>();
    st.add('Ekmek yendi', 0);
    expect(st.tick(TOAST_SHOW_MS - 1)).toEqual([]);
    expect(st.tick(TOAST_SHOW_MS)).toEqual([{ kind: 'fade', item: 'Ekmek yendi' }]);
    // kaybolurken HUD yüksekliği değişti: dizme yalnızca konum verir, kaybolma bayrağı kalır
    expect(st.layout(220)).toEqual([{ item: 'Ekmek yendi', y: 230 }]);
    expect(st.isFading('Ekmek yendi')).toBe(true);
    const acts = st.tick(TOAST_SHOW_MS + TOAST_FADE_MS + 60);
    expect(acts).toEqual([{ kind: 'destroy', item: 'Ekmek yendi' }]);
    expect(st.items).toEqual([]);
  });
  it('kesin üst sınır: ne olursa olsun ömrü dolan bildirim yok edilir', () => {
    const st = new ToastStack<number>();
    st.add(1, 0);
    expect(st.tick(TOAST_HARD_MS)).toEqual([{ kind: 'destroy', item: 1 }]);
  });
  it('en fazla 6; yeni bildirim üstte, sıra 40 px aralıkla', () => {
    const st = new ToastStack<number>();
    let dropped: number[] = [];
    for (let i = 0; i < 8; i++) dropped = dropped.concat(st.add(i, i));
    expect(dropped).toEqual([0, 1]);
    expect(st.layout(100).map((l) => l.y)).toEqual([110, 150, 190, 230, 270, 310]);
  });
});

describe('B2 sistem bildirimi düzeni', () => {
  it('tür ve renk: seviye altın, skill mavi, Divine beyaz-altın, uyarı kırmızı, görev yeşil', () => {
    expect(sysTheme('LEVEL ATLADIN')).toBe('level');
    expect(sysTheme('SKILL GELİŞTİ')).toBe('skill');
    expect(sysTheme('DIVINE SKILL')).toBe('divine');
    expect(sysTheme('UYARI')).toBe('warn');
    expect(sysTheme('GÖREV BAŞARISIZ')).toBe('warn');
    expect(sysTheme('YENİ ANA GÖREV')).toBe('quest');
    expect(sysTheme(GUILD_LOCK_TITLE)).toBe('warn');
    for (const t of Object.values(SYS_THEME)) expect(t.icon).toBeTruthy();
  });
  it('satır simgeleri türüne göre (level, stat, SP, Max HP, skill rütbesi, yetenek, para, eşya, görev, uyarı)', () => {
    expect(lineIcon('Level: 0 → 1', 'level')).toBe('level');
    expect(lineIcon('Stat puanı: +4', 'level')).toBe('stats');
    expect(lineIcon('SP: +1', 'level')).toBe('card');
    expect(lineIcon('Max HP: 10 → 18', 'level')).toBe('hp');
    expect(lineIcon('Appraisal: G- → G', 'skill')).toBe('skills');
    expect(lineIcon('Yeni yetenek: Çift Kesik', 'skill')).toBe('skill_slot');
    expect(lineIcon('Ödül: {m:50}', 'quest')).toBe('money');
    expect(lineIcon('Envanter → Giriş Kartları', 'quest')).toBe('bag');
    expect(lineIcon('Bir şey oldu', 'warn')).toBe('risk');
  });
  it('"etiket — değer" ayrımı', () => {
    expect(parseSysLine('Max HP: 10 → 18')).toEqual({ label: 'Max HP', value: '10 → 18' });
    expect(parseSysLine('Rütbe: G-')).toEqual({ label: 'Rütbe', value: 'G-' });
    expect(parseSysLine('Max HP 10 → 18')).toEqual({ label: 'Max HP', value: '10 → 18' });
    expect(parseSysLine('Tavan arasındaki yatak. Oyun kaydedildi.').value).toBeNull();
  });
  it('satırlar ölçülen yüksekliğe göre dizilir: sarılan satır sonrakine binmez, kutu içeriğe göre büyür', () => {
    const { ys, bottom } = stackLines([22, 66, 22], 50, 7);
    expect(ys).toEqual([50, 79, 152]);
    expect(bottom).toBe(174);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1] + [22, 66, 22][i - 1]);
  });
  it('konum: sol panel ile saat kutusu arasında ortalanır; sığmazsa ikisinin altına iner', () => {
    const fit = sysPlacement({ W: 1280, boxW: 460, leftEdge: 316, rightEdge: 900, leftBottom: 178, rightBottom: 100 });
    expect(fit.inGap).toBe(true);
    expect(fit.x - 230).toBeGreaterThanOrEqual(316);
    expect(fit.x + 230).toBeLessThanOrEqual(900);
    const no = sysPlacement({ W: 960, boxW: 520, leftEdge: 316, rightEdge: 700, leftBottom: 178, rightBottom: 100 });
    expect(no.inGap).toBe(false);
    expect(no.y).toBeGreaterThanOrEqual(178);
  });
});

describe('B3 balon sırası', () => {
  it('aynı karakterin balonları sırayla; farklı karakterler bekleşmez; aynı metin yinelenmez', () => {
    const q = new BubbleQueue<string>();
    q.push('joseph', { text: 'Daha güçlü hissediyorum…', dur: 4, think: true });
    q.push('joseph', { text: 'İçimdeki ışık büyüdü…', dur: 4, think: true });
    q.push('joseph', { text: 'İçimdeki ışık büyüdü…', dur: 4, think: true });
    q.push('vera', { text: 'Yürü!', dur: 2, think: false });
    let acts = q.tick(0.01);
    expect(acts.filter((a) => a.kind === 'show').map((a) => a.key)).toEqual(['joseph', 'vera']);
    expect(q.showing('joseph')!.text).toBe('Daha güçlü hissediyorum…');
    expect(q.pending('joseph')).toBe(1);
    for (let i = 0; i < 450; i++) acts = acts.concat(q.tick(0.01));
    expect(q.showing('joseph')!.text).toBe('İçimdeki ışık büyüdü…');
    expect(q.pending('joseph')).toBe(0);
  });
});

describe('B8/C12 kart paneli düzeni', () => {
  for (const [W, H] of [[960, 640], [1079, 720], [1600, 720], [1280, 854]] as [number, number][]) {
    for (const n of [1, 2, 3]) {
      it(`${W}×${H}, ${n} kart: 2:3 kartlar ekrana sığar; başlık üstte, Vazgeç altta, binme yok`, () => {
        const L = cardLayout(W, H, n, true);
        expect(L.ch / L.cw).toBeCloseTo(CARD_RATIO, 1);
        expect(L.x0).toBeGreaterThanOrEqual(0);
        expect(L.x0 + n * L.cw + (n - 1) * L.gap).toBeLessThanOrEqual(W);
        expect(L.titleY + 16).toBeLessThanOrEqual(L.cardsY);
        expect(L.cancelY - 26).toBeGreaterThanOrEqual(L.cardsY + L.ch);
        expect(L.cancelY + 26).toBeLessThanOrEqual(H);
        const S = cardSections(L.ch, { icon: true, titleH: 22, tag: true, tableH: 40, footerH: 16 });
        expect(S.descY + S.descH).toBeLessThanOrEqual(S.tableY);
        expect(S.footerY + 16).toBeLessThanOrEqual(S.buttonY - S.buttonH / 2);
        expect(S.buttonY + S.buttonH / 2).toBeLessThanOrEqual(L.ch);
      });
    }
  }
});

describe('C1 harcama kilidi ve ziyafet', () => {
  it('lonca kaydına kadar harcama yok; kayıt ücreti serbest; kayıtla kilit kalkar; eski kayıtta açık', () => {
    const base = { member: false, exempt: false, storyLock: false };
    expect(spendLock(base, 'Han yatağı')).toBe('guild');
    expect(spendLock(base, 'Dükkân')).toBe('guild');
    expect(spendLock(base, 'Lonca kaydı')).toBeNull();
    expect(spendLock({ ...base, member: true }, 'Han yatağı')).toBeNull();
    expect(spendLock({ ...base, exempt: true }, 'Han yatağı')).toBeNull();
    expect(spendLock({ ...base, member: true, storyLock: true }, 'Han yatağı')).toBe('story');
    expect(GUILD_LOCK_TEXT).toBe("Maceracılar Loncası'na kaydolana kadar paranı harcayamazsın. Kayıt ücreti bir gümüş.");
  });
  it('kayda kadar aç kalınmaz: ziyafet (100), Haldor\'un ekmeği ve elmalarla Tokluk normale çıkar', () => {
    // ücret gecesi 21:00 ziyafet → uyku → hasat günü (Haldor'un ekmeği, iki ağaçtan 6 elma) → uyku → kayıt günü
    let s = SATIETY_MAX;
    s = decaySatiety(s, 9 * 60, true); // 21:00 → 06:00 uyku
    s = decaySatiety(s, 8 * 60, false); // hasat
    s = eatSatiety(s, ITEMS.bread.satiety!).value; // Haldor'un ekmeği
    s = decaySatiety(s, 6 * 60, false);
    for (let i = 0; i < 6; i++) s = eatSatiety(s, ITEMS.apple.satiety!).value; // elmalar
    expect(hungerState(s)).toBe('normal');
    s = decaySatiety(s, 8 * 60, false);
    s = decaySatiety(s, 9 * 60, true);
    // kayıt sabahı: 3 elma daha (yeni gün)
    for (let i = 0; i < 3; i++) s = eatSatiety(s, ITEMS.apple.satiety!).value;
    expect(hungerState(s)).toBe('normal');
  });
});

describe('C2 okuma süresi', () => {
  it('~2,2 sn + harf başına 45 ms; Status ~8 sn', () => {
    expect(READ_BASE_MS).toBe(2200);
    expect(READ_PER_CHAR_MS).toBe(45);
    expect(readTimeMs('ÖLDÜN.')).toBe(2200 + 6 * 45);
    expect(STATUS_SCREEN_MS).toBe(8000);
  });
});

describe('C3 kalkan ayarlar', () => {
  it('sürüm 5; eski değerler yok sayılır', () => {
    expect(SETTINGS_VERSION).toBe(5);
    const s = sanitizeSettings({ v: 4, assistCombat: false, shake: false, sheathWeapon: false } as any, false);
    for (const k of REMOVED_SETTINGS) expect(k in s).toBe(false);
  });
});

describe('C4 rütbe paleti', () => {
  it('9 rütbe ayrı renk ailesi (S ≠ A, E ≠ D, C ≠ B)', () => {
    for (const T of [RANK_BG, RANK_EDGE]) {
      const vals = 'GFEDCBASX'.split('').map((L) => T[L]);
      expect(new Set(vals).size).toBe(9);
      const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
      const dist = (a: number, b: number) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
      expect(dist(T.S, T.A)).toBeGreaterThan(60);
      expect(dist(T.E, T.D)).toBeGreaterThan(60);
      expect(dist(T.C, T.B)).toBeGreaterThan(60);
    }
    expect(Object.keys(RANK_TEXT)).toHaveLength(9);
  });
});

describe('C5 terfi animasyonu atlanamaz', () => {
  it('terfi: sırasında dokunuş yok sayılır, bitince ancak dokununca kapanır; görev bitişi eskisi gibi', () => {
    expect(overlayTap(RANK_OVERLAY, 500, 2600)).toBe('ignore');
    expect(overlayTap(RANK_OVERLAY, 2600, 2600)).toBe('close');
    expect(overlayAutoDone(RANK_OVERLAY, 99999, 2600, 2600)).toBe(false);
    expect(RANK_OVERLAY.hint).toBe('Kapatmak için dokun');
    expect(overlayTap(QUEST_OVERLAY, 500, 2600)).toBe('skip');
    expect(overlayAutoDone(QUEST_OVERLAY, 4400, 2600, 1800)).toBe(true);
  });
});

describe('C6 İlk Kadeh ve hırsızlık saat beklemesi', () => {
  it('kapı yok (her saat)', () => {
    for (let h = 0; h < 24; h++) {
      expect(storyGate('m_celebrate', 0, { day: 5, minute: h * 60, flag: () => 5 })).toBeNull();
      expect(storyGate('m_next_day', 0, { day: 5, minute: h * 60, flag: () => 5 })).toBeNull();
    }
  });
});

describe('C8 yoldaşlarla görev bölgesi', () => {
  const pts = WORLD.points as Record<string, { x: number; y: number }>;
  it('veri: her yoldaşlı görevin rotası ve hedef alanları haritada var', () => {
    for (const [id, z] of Object.entries(PARTY_ZONES)) {
      for (const p of z.route) expect(pts[p], `${id}:${p}`).toBeTruthy();
      for (const a of z.areas) expect(pts[a.at], `${id}:${a.at}`).toBeTruthy();
    }
    expect(PARTY_DOOR_LINES.length).toBeGreaterThanOrEqual(2);
  });
  it('rotada ve hedefte içeride; uzakta dışarıda ve en yakın nokta bölgede', () => {
    const z = PARTY_ZONES.f_wolves;
    expect(zoneDistance(z, pts, pts.pasture).dist).toBe(0);
    expect(zoneDistance(z, pts, pts.plaza).dist).toBe(0);
    const far = zoneDistance(z, pts, { x: 20, y: 20 });
    expect(far.dist).toBeGreaterThan(10);
    expect(zoneDistance(z, pts, far.nearest).dist).toBe(0);
  });
  it('kapılar: yalnızca görevin istediği iç mekâna girilir; çıkış serbest', () => {
    expect(partyDoorAllowed(PARTY_ZONES.f_wolves, 'world', 'shop')).toBe(false);
    expect(partyDoorAllowed(PARTY_ZONES.f_wolves, 'world', 'guild')).toBe(true);
    expect(partyDoorAllowed(PARTY_ZONES.f_cellar, 'world', 'mill_cellar')).toBe(true);
    expect(partyDoorAllowed(PARTY_ZONES.m_wounded, 'world', 'healer')).toBe(true);
    expect(partyDoorAllowed(PARTY_ZONES.f_wolves, 'shop', 'world')).toBe(true);
    expect(partyDoorAllowed(null, 'world', 'shop')).toBe(true);
  });
  it('dışarı çıkınca uyarı; ~8 kare daha ya da 10 sn → geri dönüş; içeri dönünce sıfırlanır', () => {
    const s = newLeash();
    expect(leashStep(s, 2, 0.5)).toBe('warn');
    expect(leashStep(s, 4, 0.5)).toBe('none');
    expect(leashStep(s, 2 + LEASH_EXTRA_TILES, 0.5)).toBe('return');
    const t = newLeash();
    leashStep(t, 2, 0.5);
    let r = 'none';
    for (let i = 0; i < LEASH_SECONDS * 2 + 1 && r === 'none'; i++) r = leashStep(t, 3, 0.5);
    expect(r).toBe('return');
    const u = newLeash();
    leashStep(u, 2, 0.5);
    expect(leashStep(u, 0, 0.5)).toBe('none');
    expect(leashStep(u, 2, 0.5)).toBe('warn');
  });
});

describe('B5/C9 Appraisal EXP', () => {
  it('yaratıkta anahtar tür kimliği, kişide NPC kimliği', () => {
    expect(appraisalKey(null, 'rat')).toBe('m_rat');
    expect(appraisalKey('vera', 'x')).toBe('vera');
  });
  it('taban ×0,5; eski hedef 1/5', () => {
    expect(APPRAISAL_BASE_SCALE).toBe(0.5);
    expect(APPRAISAL_REPEAT_MULT).toBe(0.2);
    expect(appraisalBaseExp(0, 0, 0, 0)).toBeCloseTo(0.75);
  });
  it('yeni hedef beklemesiz: 10 fare tek hedef, ardı ardına yeni kişiler tam EXP', () => {
    const rec: Record<string, number> = {};
    const clock = { lastAt: null as number | null };
    expect(claimAppraisalExp(rec, appraisalKey(null, 'rat'), 1, clock, 0)).toBe(1);
    for (let i = 1; i < 10; i++) expect(claimAppraisalExp(rec, appraisalKey(null, 'rat'), 1, clock, i * 100)).toBe(0);
    for (const id of ['vera', 'lina', 'celeste', 'bertram']) expect(claimAppraisalExp(rec, id, 1, clock, 500)).toBe(1);
    expect(clock.lastAt).toBeNull();
  });
});

describe('C10 Divine EXP', () => {
  it('seri bonusu en fazla ×1,5; antrenman [4, 10]', () => {
    expect(streakMultiplier(99)).toBe(1.5);
    for (const s of Object.values(TRAINING_SPOTS)) expect(s.divineExp).toEqual([4, 10]);
  });
  it('kaba simülasyon: tipik başlangıçta Divine 1\'e normal level ≈ 3 (2,5–3,5) civarında ulaşılır', () => {
    // her gün: o anki levele uygun yaratıktan 20 öldürme (serili), 3 antrenman (ortalama performans), görevlerden 20 EXP
    let L = 0, E = 0, DL = 0, DE = 0;
    let at: number | null = null;
    const pick = (l: number): [string, number] => (l === 0 ? ['rat', 0] : l === 1 ? ['giant_rat', 1] : l === 2 ? ['wolf', 2] : ['goblin', 2]);
    const step = () => {
      while (E >= expToNext(L)) { E -= expToNext(L); L++; }
      while (DE >= divineExpToNext(DL)) {
        DE -= divineExpToNext(DL);
        DL++;
        if (DL === 1 && at === null) at = L + E / expToNext(L);
      }
    };
    for (let day = 0; day < 30 && at === null; day++) {
      const [id, ml] = pick(L);
      for (let k = 0; k < 20; k++) {
        E += (MONSTERS[id].exp[0] + MONSTERS[id].exp[1]) / 2;
        DE += victoryDivineExp(ml, L, DL, false, k % 5);
        step();
      }
      DE += 3 * trainingExp([4, 10], 0.6);
      E += 20;
      step();
    }
    expect(at).not.toBeNull();
    expect(at!).toBeGreaterThanOrEqual(2.5);
    expect(at!).toBeLessThanOrEqual(3.5);
  });
});

describe('C11 mini oyunlar', () => {
  it('savuruş kilidi 0,4 sn; ıska 1 sn; hedefler', () => {
    expect(SWING_LOCK_SEC).toBe(0.4);
    expect(MISS_PENALTY_SEC).toBe(1);
    expect(swingAccepted(1, 1.39)).toBe(false);
    expect(swingAccepted(1, 1.41)).toBe(true);
    expect(MINIGAME_GOAL.harvest).toEqual({ count: 10, sec: 22 });
    expect(MINIGAME_GOAL.chop).toEqual({ count: 10, sec: 24 });
  });
  it('tuşa basıp durmak işe yaramaz: 22 sn boyunca her kare basmak ≤ 55 savuruş', () => {
    let last = -9, swings = 0;
    for (let t = 0; t < 22; t += 1 / 60) if (swingAccepted(last, t)) { last = t; swings++; }
    expect(swings).toBeLessThanOrEqual(56);
  });
  it('başarı: hasat 10 demet, taş %60 bölgede, koşu bitiş', () => {
    expect(minigameWon('harvest', { count: 9 })).toBe(false);
    expect(minigameWon('harvest', { count: 10 })).toBe(true);
    expect(minigameWon('lift', { inZone: 14.9, dur: 25 })).toBe(false);
    expect(minigameWon('lift', { inZone: 25 * LIFT_ZONE_FRAC, dur: 25 })).toBe(true);
    expect(minigameWon('run', { dist: 0.99 })).toBe(false);
    expect(minigameWon('run', { dist: 1 })).toBe(true);
    expect(accuracy(5, 10)).toBe(0.5);
  });
  it('koşu: ritimsiz basış hızı düşürür', () => {
    expect(runStepDelta(false, 0.05)).toBeLessThan(0);
    expect(runStepDelta(false, 0.3)).toBeGreaterThan(0);
    expect(runStepDelta(true, 0.3)).toBeLessThan(0);
  });
});

describe('C13 Ansiklopedi', () => {
  it('yeni keşif "!": bilinen ve dokunulmamış; dokununca kalkar; sayı', () => {
    const c = newCodex();
    expect(codexNewCount(c)).toBe(0);
    codexAppraiseMonster(c, 'rat', 0, null, 1, 0);
    codexMeet(c, 'bertram', null, 1);
    expect(codexIsNew(c, 'monsters', 'rat')).toBe(true);
    expect(codexNewCount(c)).toBe(2);
    expect(codexNewCount(c, 'people')).toBe(1);
    codexMarkSeen(c, 'monsters', 'rat');
    expect(codexIsNew(c, 'monsters', 'rat')).toBe(false);
    expect(codexNewCount(c)).toBe(1);
  });
  it('rozet: yaratık rütbesi, kişide lonca rütbesi / "???" / yok, bitkide eşya rütbesi; bilinmeyende yok', () => {
    const c = newCodex();
    expect(codexBadge(c, 'monsters', 'wolf')).toBeNull();
    codexAppraiseMonster(c, 'wolf', 1, null, 1, 0);
    expect(codexBadge(c, 'monsters', 'wolf')).toEqual({ sub: parseSubRank(MONSTERS.wolf.rank) });
    codexMeet(c, 'vera', null, 1);
    expect(codexBadge(c, 'people', 'vera')).toBe('unknown');
    codexAppraisePerson(c, 'vera', null, 2, 26);
    const b = codexBadge(c, 'people', 'vera');
    expect(b && typeof b === 'object' && 'sub' in b).toBe(true);
  });
  it('Appraisal anlık kaydı: Appraisal yükselse de kart eski kaydı gösterir; yeniden incelenince güncellenir', () => {
    const c = newCodex();
    codexAppraisePerson(c, 'celeste', null, 5, 0); // G- ile: Celeste okunmaz
    const a = personCard(c, 'celeste', { affinity: 0, flags: {} });
    expect(a.rows.find((r) => r[0] === 'Level')![1]).toBe('???');
    expect(a.rows.some((r) => r[0] === 'Trait')).toBe(false); // C14
    expect(a.footer).toBe('Appraisal: G- ile incelendi · 5. gün');
    codexAppraisePerson(c, 'celeste', null, 9, 26);
    const b = personCard(c, 'celeste', { affinity: 0, flags: {} });
    expect(b.rows.find((r) => r[0] === 'Level')![1]).not.toBe('???');
    expect(b.footer).toBe('Appraisal: X+ ile incelendi · 9. gün');
    const m = newCodex();
    codexAppraiseMonster(m, 'rat', 0, null, 3, 1);
    expect(monsterCard(m, 'rat').footer).toBe('Appraisal: G ile incelendi · 3. gün');
  });
  it('sayaçlar ve sıralama (bilinenler önce, alfabetik)', () => {
    const c = newCodex();
    codexAppraiseMonster(c, 'wolf', 1, null, 1);
    codexAppraiseMonster(c, 'rat', 0, null, 1);
    codexKill(c, 'slime', 0, null); // öldürmek tek başına açmaz
    expect(codexTotals(c, 'monsters')).toEqual({ known: 2, total: codexIds('monsters').length });
    const sorted = codexSorted(c, 'monsters', codexIds('monsters'));
    expect(sorted.slice(0, 2)).toEqual(['rat', 'wolf'].sort((a, b) => codexName('monsters', a).localeCompare(codexName('monsters', b), 'tr')));
  });
  it('göç: Appraisal geçmişi olan kişiye kayıt bir kez; bilinenler görülmüş sayılır', () => {
    const c = newCodex();
    c.people.vera = { met: 2, appraised: 2, places: [] };
    c.monsters.rat = { firstDay: 1, levels: [0, 0], kills: 3, drops: [], places: [] };
    delete c.seen;
    codexSnapshotMigrate(c, 3, 7);
    expect(c.people.vera.snap?.by).toBe(3);
    expect(c.monsters.rat.snap).toEqual({ by: 3, day: 1 });
    expect(codexNewCount(c)).toBe(0);
  });
});

describe('C15 lonca puanı', () => {
  it('rütbenin altındaki görevler: bir harf %25, iki ve daha fazla 0; grupta önce %50', () => {
    const F = parseSubRank('F'), E = parseSubRank('E-');
    expect(questPointsFor(10, 'G', parseSubRank('G-'))).toEqual({ points: 10, below: 0 });
    expect(questPointsFor(10, 'G', F)).toEqual({ points: 2, below: 1 });
    expect(questPointsFor(10, 'G', E)).toEqual({ points: 0, below: 2 });
    expect(questPointsFor(30, 'F', E, true)).toEqual({ points: 3, below: 1 });
    expect(questPointsLabel({ points: 2, below: 1 })).toBe('+2 Lonca Puanı (rütbenin altında)');
    expect(questPointsLabel({ points: 0, below: 2 })).toContain('0 puan');
  });
  it('yeni eşikler', () => {
    expect(RANK_THRESHOLDS).toEqual([0, 60, 150, 300, 500, 750, 1200, 1700, 2300, 3200, 4300, 5600, 7500, 9800, 12500, 16000, 21000, 27000, 35000, 45000, 58000, 75000, 97000, 125000, 170000, 250000]);
  });
  it('G görevleriyle F\'den sonra ilerlenemiyor (E- için 1.200 puan gerekir, F\'de G görevi 2 puan)', () => {
    const g = newGuildState();
    g.member = true;
    let rank = parseSubRank('F');
    g.points = RANK_THRESHOLDS[rank];
    for (let i = 0; i < 1000; i++) {
      applyReward(g, QUEST_POINTS.G, 20, false, 'G', rank);
      rank = Math.max(rank, earnedRank(g.points, rank, 20));
    }
    expect(rank).toBeLessThan(parseSubRank('E-'));
    // E-'de G görevi hiç puan vermez
    expect(questPointsFor(QUEST_POINTS.G, 'G', parseSubRank('E-')).points).toBe(0);
  });
});

describe('C16 ganimet', () => {
  it('120 sn; son 15 sn yanıp söner; en fazla 20 efekt', () => {
    expect(LOOT_LIFE_SEC).toBe(120);
    expect(LOOT_BLINK_SEC).toBe(15);
    expect(LOOT_FX_MAX).toBe(20);
    expect(lootVisible(50)).toBe(true);
    const seen = new Set<boolean>();
    for (let t = 106; t < 120; t += 0.05) seen.add(lootVisible(t));
    expect(seen.has(true) && seen.has(false)).toBe(true);
  });
});

describe('D kayıt yuvaları', () => {
  const env = (s: any) => JSON.stringify({ v: CURRENT_SAVE_VERSION, savedAt: s.savedAt, summary: 'x', data: s });
  it('göç: auto → Yuva 1, manual1 → 2, manual2 → 3, manual3 → Eski kayıt; eski anahtarlar silinmez', () => {
    const st = new MemoryStorage();
    const mk = (lv: number, t: number) => {
      const s = newGameState();
      s.player.level = lv;
      s.savedAt = t;
      return s;
    };
    st.setItem('elonth.save.auto', env(mk(3, 300)));
    st.setItem('elonth.save.manual1', env(mk(1, 100)));
    st.setItem('elonth.save.manual3', env(mk(7, 50)));
    expect(migrateSlots(st)).toBe(true);
    expect(slotMeta(st, 1)!.level).toBe(3);
    expect(slotMeta(st, 2)!.level).toBe(1);
    expect(slotMeta(st, 3)).toBeNull();
    expect(slotMeta(st, 'legacy')!.level).toBe(7);
    expect(st.getItem('elonth.save.auto')).not.toBeNull();
    expect(lastSlot(st)).toBe(1);
    expect(migrateSlots(st)).toBe(false); // bir kez
  });
  it('otomatik kayıt oynanan yuvaya; Devam = son oynanan', () => {
    const st = new MemoryStorage();
    const a = newGameState();
    writeSlot(st, 2, a);
    expect(lastSlot(st)).toBe(2);
    a.player.level = 5;
    writeSlot(st, 2, a);
    expect(readSlot(st, 2)!.player.level).toBe(5);
    expect(slotMeta(st, 1)).toBeNull();
    writeSlot(st, 3, newGameState());
    expect(lastSlot(st)).toBe(3);
  });
  it('yeni oyun: boş yuvada onay yok, dolu yuvada onay sorusu', () => {
    const st = new MemoryStorage();
    expect(newGameNeedsConfirm(st, 1)).toBeNull();
    writeSlot(st, 2, newGameState());
    expect(newGameNeedsConfirm(st, 2)).toBe("Yuva 2'deki kayıt silinecek ve yerine yeni oyun yazılacak. Emin misin?");
    writeSlot(st, 3, newGameState());
    expect(newGameNeedsConfirm(st, 3)).toContain("Yuva 3'teki");
    expect(slotLine(null)).toBe('Boş');
    expect(slotLine(slotMeta(st, 2))).toContain('Level 0 · Rütbesiz · 1. gün');
    expect(SLOT_IDS).toEqual([1, 2, 3]);
    deleteSlot(st, 2);
    expect(slotMeta(st, 2)).toBeNull();
  });
  it('dışa aktarılan JSON bir yuvaya yüklenir (zarf ya da çıplak durum)', () => {
    const st = new MemoryStorage();
    const s = newGameState();
    s.player.level = 4;
    expect(importToSlot(st, 1, JSON.stringify(s))).toBe(true);
    expect(readSlot(st, 1)!.player.level).toBe(4);
    expect(importToSlot(st, 2, env(s))).toBe(true);
    expect(importToSlot(st, 3, '{bozuk')).toBe(false);
  });
});

describe('v10 göçü', () => {
  it('Appraisal örnek anahtarları silinir, bilinen yaratık türleri; kayıtsızda harcama kilidi açık; Ansiklopedi kaydı', () => {
    const d: any = newGameState();
    d.saveVersion = 9;
    d.appraised = { m_12: 3, m_40: 3, vera: 2 };
    d.codex.monsters.rat = { firstDay: 2, levels: [0, 0], kills: 1, drops: [], places: [] };
    d.codex.people.vera = { met: 1, appraised: 2, places: [] };
    delete d.codex.seen;
    d.guild.member = false;
    const m = migrate(d, 9);
    expect(m.saveVersion).toBe(10);
    expect(m.appraised).toEqual({ vera: 2, m_rat: 2 });
    expect(m.flags.spend_free).toBe(true);
    expect(m.codex.people.vera.snap).toBeTruthy();
    expect(m.codex.seen!['monsters:rat']).toBe(true);
    const reg: any = newGameState();
    reg.guild.member = true;
    expect(migrateV9toV10(reg).flags.spend_free).toBeUndefined();
  });
});

describe('E hata kaydı', () => {
  it('kayıt, liste, metin', () => {
    clearErrors();
    logError('Director.scene', new Error('reading x'), '3. gün 18:00');
    expect(errors()).toHaveLength(1);
    expect(errors()[0]).toMatchObject({ source: 'Director.scene', message: 'reading x', game: '3. gün 18:00' });
    expect(errorsText()).toContain('Director.scene');
    clearErrors();
  });
});

describe('A12 Vera\'nın dersi dünya içi', () => {
  it('replikler tuş/buton demez; dört konu', () => {
    expect(VERA_LESSON).toHaveLength(4);
    for (const [, line] of VERA_LESSON) expect(line).not.toMatch(/tuş|buton|düğme/i);
    const all = VERA_LESSON.map((l) => l[1]).join(' ');
    expect(all).toMatch(/kızar/); // kırmızı alan
    expect(all).toMatch(/son anda/);
    expect(all).toMatch(/üç/i);
    expect(all).toMatch(/sersem/);
  });
});
