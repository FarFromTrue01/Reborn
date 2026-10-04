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
