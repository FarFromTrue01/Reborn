// Grup 4B (0.7.0, silahlar ve animasyon) kuralları.
import { describe, it, expect } from 'vitest';
import { attackPlan, attackFrameAt, impactTime, windupEnd, ANIM_FRAMES } from '../src/world/attackPlan';
import { ITEMS } from '../src/data/items';
import { JOSEPH_BIG, JOSEPH_LAYERS, WEAPON_VISUALS, WEAPON_ITEM_IMAGES, CARRY_Z } from '../src/data/manifest';
import { sanitizeSettings, SETTINGS_VERSION, defaultSettings } from '../src/game/settings';
import type { WeaponType } from '../src/core/types';

import weaponsMeta from '../assets/gfx/chars/joseph/weapons.json';

/** Joseph'in katman PNG'leri (data URL); boyut başlıktan okunur. */
const PNGS = import.meta.glob('/assets/gfx/chars/joseph/*.png', { query: '?inline', import: 'default', eager: true }) as Record<string, string>;
const pngSize = (rel: string): [number, number] => {
  const url = PNGS['/' + rel];
  if (!url) throw new Error('yok: ' + rel);
  const bin = atob(url.slice(url.indexOf(',') + 1, url.indexOf(',') + 1 + 44));
  const u32 = (o: number) => ((bin.charCodeAt(o) << 24) | (bin.charCodeAt(o + 1) << 16) | (bin.charCodeAt(o + 2) << 8) | bin.charCodeAt(o + 3)) >>> 0;
  return [u32(16), u32(20)];
};

const TYPES: (WeaponType | null)[] = ['sword', 'club', 'dagger', 'spear', 'bow', null];

describe('Saldırı zaman çizelgesi: hasar darbe karesinde (3)', () => {
  it('Yumruk eski vuruş anını korur (normal %45, ağır %60)', () => {
    expect(impactTime(attackPlan(null, false), 1)).toBeCloseTo(0.45, 5);
    expect(impactTime(attackPlan(null, true), 1)).toBeCloseTo(0.6, 5);
  });
  it('Darbe anı, gösterilen karenin darbe karesi olduğu an; hazırlanmadan sonra', () => {
    for (const wt of TYPES) {
      for (const heavy of [false, true]) {
        const p = attackPlan(wt, heavy);
        const D = 0.7;
        const ti = impactTime(p, D);
        expect(ti).toBeGreaterThanOrEqual(windupEnd(p, D));
        expect(ti).toBeLessThan(D);
        // darbe anında gösterilen kare darbe karesidir
        expect(attackFrameAt(p, ti + 1e-6, D).frame).toBe(Math.floor(p.impact));
        expect(p.frames).toBe(ANIM_FRAMES[p.anim]);
      }
    }
  });
  it('Kareler 0..frames-1 içinde ve zamanla geri gitmez', () => {
    for (const wt of TYPES) {
      for (const heavy of [false, true]) {
        const p = attackPlan(wt, heavy);
        let last = -1;
        for (let t = 0; t <= 1; t += 0.01) {
          const f = attackFrameAt(p, t, 1).frame;
          expect(f).toBeGreaterThanOrEqual(0);
          expect(f).toBeLessThan(p.frames);
          expect(f).toBeGreaterThanOrEqual(last);
          last = f;
        }
        expect(attackFrameAt(p, 0.999, 1).frame).toBe(p.frames - 1);
      }
    }
  });
  it('Silaha göre animasyon: yay → shoot, mızrak → thrust, kılıç/sopa/hançer → slash; ağır hançer → saplama', () => {
    expect(attackPlan('bow', false).anim).toBe('shoot');
    expect(attackPlan('spear', false).anim).toBe('thrust');
    for (const wt of ['sword', 'club', 'dagger'] as const) expect(attackPlan(wt, false).anim).toBe('slash');
    expect(attackPlan('dagger', true).anim).toBe('thrust');
  });
  it('Ağır vuruş normalden ayırt edilir: yumruk hariç her silahta hazırlanma (kaçışla iptal penceresi) var', () => {
    for (const wt of ['sword', 'club', 'dagger', 'spear', 'bow'] as const) {
      const n = attackPlan(wt, false), h = attackPlan(wt, true);
      expect(n.hold).toBe(0);
      expect(h.hold).toBeGreaterThan(0);
    }
    expect(attackPlan('sword', true).trail).toBe(true);
    expect(attackPlan('club', true).trail).toBe(true);
    expect(attackPlan('spear', true).lunge).toBeGreaterThan(attackPlan('dagger', true).lunge);
    expect(attackPlan('bow', true).release).toBe(true);
    expect(attackPlan('spear', true).hold).toBeGreaterThan(attackPlan('dagger', true).hold);
  });
});

describe('Silah görünümleri (1, 2)', () => {
  const weapons = Object.values(ITEMS).filter((i) => i.slot === 'weapon');
  it('Her silahın görünümü WEAPON_VISUALS içinde; kılıçlar artık hançer değil', () => {
    for (const w of weapons) expect(WEAPON_VISUALS[w.visual!], w.id).toBeTruthy();
    for (const w of weapons.filter((w) => w.weaponType === 'sword')) expect(w.visual).not.toBe('w_dagger');
    expect(ITEMS.rusty_shortsword.visual).toBe('w_arming_rusty');
    expect(ITEMS.iron_shortsword.visual).toBe('w_arming_steel');
    expect(ITEMS.goblin_cleaver.visual).toBe('w_cleaver');
    expect(ITEMS.hunting_knife.visual).toBe('w_dagger');
  });
  it('Sopalar ahşap (w_stick) ve ikisi farklı görünür; w_club (metal topuz) yerinde duruyor', () => {
    expect(ITEMS.wooden_club.visual).toBe('w_stick');
    expect(ITEMS.cracked_stick.visual).toBe('w_stick_cracked');
    expect(JOSEPH_LAYERS.w_club).toBeTruthy();
  });
  it('Kılıç ve sopaların saldırı karesi büyük kare katmanıyla görünür (slash)', () => {
    for (const w of weapons.filter((w) => w.weaponType === 'sword' || w.weaponType === 'club')) {
      expect(WEAPON_VISUALS[w.visual!].big?.some((b) => b.anim === 'slash'), w.id).toBe(true);
    }
  });
  it('Katman dosyaları var ve boyutları doğru (64 px: 832×1344; büyük kare: 4 yön satırı)', () => {
    for (const [k, v] of Object.entries(WEAPON_VISUALS)) {
      for (const h of v.hand) {
        expect(JOSEPH_LAYERS[h], k + ' ' + h).toBeTruthy();
        expect(pngSize(JOSEPH_LAYERS[h].file)).toEqual([832, 1344]);
      }
      for (const b of v.big ?? []) {
        const sh = JOSEPH_BIG[b.key];
        expect(sh, b.key).toBeTruthy();
        const [w, h] = pngSize(sh.file);
        expect(h).toBe(sh.size * 4);
        expect(w % sh.size).toBe(0);
        expect(w / sh.size).toBeGreaterThanOrEqual(b.anim === 'slash' ? 6 : 9);
      }
    }
  });
  it('Yeni silah eklemek yalnızca veri: taşıma katmanları ve görüntü adları anahtardan türetilir', () => {
    for (const [k, v] of Object.entries(WEAPON_VISUALS)) {
      if (!v.carry) continue;
      expect(JOSEPH_LAYERS[k + '_carry'].z).toBe(CARRY_Z.fg);
      expect(JOSEPH_LAYERS[k + '_carry_bg'].z).toBe(CARRY_Z.bg);
      expect(pngSize(JOSEPH_LAYERS[k + '_carry'].file)).toEqual([832, 1344]);
      expect(PNGS['/' + WEAPON_ITEM_IMAGES[k]], k).toBeTruthy();
      const m = (weaponsMeta as any)[k];
      expect(m, k).toBeTruthy();
      for (const d of ['up', 'left', 'down', 'right']) expect(m.carry[d]).toBeTruthy();
    }
  });
});

describe('Taşıma katmanları pelerinle (4b)', () => {
  it('Sırtı dönükken (yukarı) silah pelerinin üstünde, yüzü dönükken gövdenin arkasında', () => {
    expect(CARRY_Z.fg).toBeGreaterThan(JOSEPH_LAYERS.a_cape.z);
    expect(CARRY_Z.fg).toBeLessThan(JOSEPH_LAYERS.head.z);
    expect(CARRY_Z.bg).toBeLessThan(JOSEPH_LAYERS.body.z);
    expect(CARRY_Z.bg).toBeGreaterThan(JOSEPH_LAYERS.a_cape_bg.z);
    for (const [k, m] of Object.entries(weaponsMeta as any) as [string, any][]) {
      expect(m.carry.up.front, k).toBe(true);
      // hançer belde (önden görünür); diğerleri sırtta
      if (k !== 'w_dagger') expect(m.carry.down.front, k).toBe(false);
    }
  });
});

describe('Ayar: Silahı sırta koy (4d)', () => {
  it('Varsayılan açık; sürüm 3', () => {
    expect(SETTINGS_VERSION).toBe(3);
    expect(defaultSettings(true).sheathWeapon).toBe(true);
    expect(defaultSettings(false).sheathWeapon).toBe(true);
  });
  it('Eski (v2) ayarlar açık olarak göçer; seçim korunur', () => {
    const old = sanitizeSettings({ v: 2, joystick: 'fixed', joyChosen: true } as any, true);
    expect(old.sheathWeapon).toBe(true);
    expect(old.v).toBe(3);
    expect(sanitizeSettings({ v: 3, sheathWeapon: false } as any, true).sheathWeapon).toBe(false);
    expect(sanitizeSettings({ v: 3, sheathWeapon: 'x' } as any, true).sheathWeapon).toBe(true);
  });
});
