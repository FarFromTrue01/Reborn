// PWA kurulumu: kurulumda yalnızca çekirdek dosyalar; ilk kurulumda yenileme yok, oyun ortasında güncelleme yok.
import { describe, it, expect } from 'vitest';
import { precacheList, isCoreFile, isNeverCached } from '../src/pwa/precache';
import { shouldReloadOnControllerChange, shouldActivateWaiting } from '../src/game/pwa';
import manifest from '../public/manifest.webmanifest?raw';

const DIST = [
  'index.html', 'manifest.webmanifest', 'art-index.json', 'version.json', 'sw.js', 'CREDITS.md',
  'build/index-abc123.js', 'build/index-abc123.js.map',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'assets/fonts/Cinzel.ttf', 'assets/fonts/Alegreya.ttf', 'assets/fonts/OFL-cinzel.txt',
  'assets/licenses/credits.txt', 'assets/licenses/LPC_Tile_Atlas_Attribution.txt',
  'assets/art/cg/README.md', 'assets/art/cg/title.png', 'assets/art/cg/forest_wake.png',
  'assets/gfx/chars/guard.png', 'assets/gfx/buildings/inn.png', 'assets/gfx/props.png', 'assets/credits.json',
];

describe('service worker çekirdek önbellek listesi', () => {
  const list = precacheList(DIST);

  it('sayfa, JS paketi, manifest, simgeler, yazı tipleri ve başlık görseli kurulumda', () => {
    for (const f of ['./', './index.html', './build/index-abc123.js', './manifest.webmanifest', './icons/icon-192.png', './assets/fonts/Cinzel.ttf', './assets/art/cg/title.png']) {
      expect(list).toContain(f);
    }
  });

  it('karakterler, binalar ve diğer sahne görselleri ilk istekte (kurulumda değil)', () => {
    for (const f of ['./assets/gfx/chars/guard.png', './assets/gfx/buildings/inn.png', './assets/gfx/props.png', './assets/art/cg/forest_wake.png']) {
      expect(list).not.toContain(f);
    }
  });

  it('CREDITS.md, lisanslar, .map ve metin dosyaları hiç önbelleğe alınmaz', () => {
    for (const f of ['CREDITS.md', 'assets/licenses/credits.txt', 'build/index-abc123.js.map', 'assets/fonts/OFL-cinzel.txt', 'sw.js', 'version.json', 'assets/art/cg/README.md']) {
      expect(isNeverCached(f)).toBe(true);
      expect(isCoreFile(f)).toBe(false);
    }
  });

  it('liste küçük kalır', () => {
    expect(list.length).toBeLessThan(DIST.length / 2);
  });
});

describe('güncelleme ve yenileme', () => {
  it('ilk kurulumda (önceden kontrolcü yokken) clients.claim() sayfayı yenilemez', () => {
    expect(shouldReloadOnControllerChange(false, false)).toBe(false);
  });

  it('gerçek sürüm değişiminde yalnızca bir kez yenilenir', () => {
    expect(shouldReloadOnControllerChange(true, false)).toBe(true);
    expect(shouldReloadOnControllerChange(true, true)).toBe(false);
  });

  it('bekleyen sürüm oyun ortasında devreye girmez', () => {
    expect(shouldActivateWaiting({ waiting: true, controlled: true, inGame: true })).toBe(false);
    expect(shouldActivateWaiting({ waiting: true, controlled: true, inGame: false })).toBe(true);
    expect(shouldActivateWaiting({ waiting: false, controlled: true, inGame: false })).toBe(false);
    expect(shouldActivateWaiting({ waiting: true, controlled: false, inGame: false })).toBe(false);
  });
});

describe('manifest', () => {
  const m = JSON.parse(manifest);
  it('standalone açılır; tam ekranı oyun kendisi ister (display_override fullscreen yok)', () => {
    expect(m.display).toBe('standalone');
    expect(m.display_override ?? []).not.toContain('fullscreen');
  });
});
