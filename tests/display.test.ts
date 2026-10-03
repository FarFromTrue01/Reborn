// Grafik kalitesi çözünürlüğü belirler; FPS sınırı ayarı.
import { describe, it, expect } from 'vitest';
import { qualityDprCap, Display } from '../src/game/display';
import { sanitizeSettings, defaultSettings, fpsLoopConfig, FPS_CAPS } from '../src/game/settings';

describe('qualityDprCap', () => {
  it('Yüksek 2, Orta 1,5, Düşük 1', () => {
    expect(qualityDprCap('high')).toBe(2);
    expect(qualityDprCap('medium')).toBe(1.5);
    expect(qualityDprCap('low')).toBe(1);
  });

  it('applyQuality yalnızca tavan değişince yeniden boyutlandırır', () => {
    let n = 0;
    const prev = { cap: Display.dprCap, refresh: Display.refresh };
    Display.dprCap = 2;
    Display.refresh = () => n++;
    expect(Display.applyQuality('high')).toBe(false);
    expect(n).toBe(0);
    expect(Display.applyQuality('low')).toBe(true);
    expect(Display.dprCap).toBe(1);
    expect(n).toBe(1);
    expect(Display.applyQuality('low')).toBe(false);
    expect(n).toBe(1);
    Display.dprCap = prev.cap;
    Display.refresh = prev.refresh;
  });
});

describe('FPS sınırı', () => {
  it('varsayılan 60, geçersiz değer 60\'a döner, geçerliler korunur', () => {
    expect(defaultSettings(true).fpsCap).toBe(60);
    expect(sanitizeSettings({}, true).fpsCap).toBe(60);
    expect(sanitizeSettings({ fpsCap: 75 as any }, true).fpsCap).toBe(60);
    for (const c of FPS_CAPS) expect(sanitizeSettings({ fpsCap: c }, true).fpsCap).toBe(c);
  });

  it('döngü ayarı: sınır ve hedef ayara bağlı, sınırsızda limit 0', () => {
    expect(fpsLoopConfig(60, false)).toMatchObject({ target: 60, limit: 60, smoothStep: true });
    expect(fpsLoopConfig(144, false)).toMatchObject({ target: 144, limit: 144 });
    expect(fpsLoopConfig(0, false)).toMatchObject({ target: 60, limit: 0 });
  });

  it('?qa modu eski davranışı korur (ayardan bağımsız)', () => {
    for (const c of FPS_CAPS) expect(fpsLoopConfig(c, true)).toEqual({ target: 60, limit: 0, smoothStep: false, min: 1 });
  });
});
