// Grup 5B (0.9.0): arayüz yardımcıları ve skill sistemi kuralları.
import { describe, it, expect } from 'vitest';
import { guildBar, guildBarSegments, RANK_THRESHOLDS } from '../src/core/guild';

describe('lonca puan barı (Kısım 1, madde 6)', () => {
  it('bar mevcut rütbenin başından bir sonrakinin puanına', () => {
    const b = guildBar(36, 0);
    expect(b.lo).toBe(0);
    expect(b.hi).toBe(40);
    expect(b.frac).toBeCloseTo(0.9);
    const c = guildBar(70, 1);
    expect(c).toMatchObject({ lo: 40, hi: 100 });
    expect(c.frac).toBeCloseTo(0.5);
  });
  it('en yüksek rütbede bar dolu', () => {
    const top = RANK_THRESHOLDS.length - 1;
    expect(guildBar(999999, top)).toEqual({ lo: RANK_THRESHOLDS[top], hi: null, frac: 1 });
  });
  it('eşik geçilmezse tek dilim, önceki puandan yenisine', () => {
    const s = guildBarSegments(10, 30, 0);
    expect(s).toHaveLength(1);
    expect(s[0].from).toBeCloseTo(0.25);
    expect(s[0].to).toBeCloseTo(0.75);
  });
  it('eşik geçilince bar dolar ve yeni aralıkta baştan başlar', () => {
    const s = guildBarSegments(30, 55, 0);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ rank: 0, lo: 0, hi: 40, to: 1 });
    expect(s[1]).toMatchObject({ rank: 1, lo: 40, hi: 100, from: 0 });
    expect(s[1].to).toBeCloseTo(15 / 60);
  });
  it('terfisi yapılmamış (puanı zaten eşiğin üstünde) oyuncuda bar önce dolar', () => {
    const s = guildBarSegments(45, 50, 0);
    expect(s[0]).toMatchObject({ from: 1, to: 1 });
    expect(s[1].from).toBeCloseTo(5 / 60);
  });
});

import { plusOffsets, statParts } from '../src/core/statParts';

describe('statlarda renkli artılar (madde 10)', () => {
  it('dikey yerleşim: tek ortada, iki üst-orta/orta-alt arası, üç üst-orta-alt', () => {
    expect(plusOffsets(1)).toEqual([0]);
    expect(plusOffsets(2)).toEqual([-1 / 6, 1 / 6]);
    expect(plusOffsets(3)).toEqual([-1 / 3, 0, 1 / 3]);
  });
  it('sıra yeşil → sarı → mor; görünmeyen kaynağın artısı yok, temel stat kalır', () => {
    const src = { Level: { STR: 5 }, Skill: { STR: 2 }, Title: { STR: 3 }, Ekipman: { STR: 1 } };
    const all = statParts(src, 'STR');
    expect(all.base).toBe(5);
    expect(all.plus.map((p) => p.v)).toEqual([1, 3, 2]);
    expect(all.plus.map((p) => p.color)).toEqual(['#7ee07a', '#ffd75e', '#c99aff']);
    const onlyTitle = statParts(src, 'STR', { Ekipman: false, Title: true, Skill: false });
    expect(onlyTitle).toEqual({ base: 5, plus: [{ v: 3, color: '#ffd75e' }] });
  });
});
