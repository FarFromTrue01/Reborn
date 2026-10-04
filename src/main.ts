import Phaser from 'phaser';
import { Display } from './game/display';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { PrologueScene } from './scenes/PrologueScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';
import { MenuScene } from './scenes/MenuScene';
import { MinigameScene } from './scenes/MinigameScene';
import { CreditsScene } from './scenes/CreditsScene';
import { G } from './game/G';
import { setupPWA } from './game/pwa';
import { setupLifecycle, takeResumeFlag, Lifecycle } from './game/lifecycle';
import { Sound } from './audio/audio';
import * as R from './game/rules';
import { fpsLoopConfig } from './game/settings';
import { qualityDprCap } from './game/display';
import { createMonster } from './core/monster';
import { NPC_BY_ID } from './data/npcs';

declare const __APP_VERSION__: string;
export const APP_VERSION = __APP_VERSION__;

function cssFonts() {
  const style = document.createElement('style');
  const f = (name: string, file: string, extra = '') =>
    `@font-face{font-family:'${name}';src:url('./assets/fonts/${file}') format('truetype');font-display:block;${extra}}`;
  style.textContent = [
    f('Cinzel', 'Cinzel.ttf', 'font-weight:400 900;'),
    f('Alegreya', 'Alegreya.ttf', 'font-weight:400 900;'),
    f('Alegreya', 'Alegreya-Italic.ttf', 'font-weight:400 900;font-style:italic;'),
    f('AlegreyaSans', 'AlegreyaSans-Regular.ttf', 'font-weight:400;'),
    f('AlegreyaSans', 'AlegreyaSans-Bold.ttf', 'font-weight:700;'),
    f('AlegreyaSans', 'AlegreyaSans-Italic.ttf', 'font-weight:400;font-style:italic;'),
    f('Pixelify', 'PixelifySans.ttf', 'font-weight:400 700;'),
  ].join('\n');
  document.head.appendChild(style);
}

async function loadFonts() {
  const fams = ['400 20px Cinzel', '700 20px Cinzel', '400 20px Alegreya', 'italic 400 20px Alegreya', '400 20px AlegreyaSans', '700 20px AlegreyaSans', 'italic 400 20px AlegreyaSans', '400 20px Pixelify', '700 20px Pixelify'];
  try {
    await Promise.race([Promise.all(fams.map((f) => document.fonts.load(f, 'ĞğŞşİıÇçÖöÜü'))), new Promise((r) => setTimeout(r, 6000))]);
  } catch {
    /* yazı tipi yüklenemezse sistem yazı tipi kullanılır */
  }
}

const QA = new URLSearchParams(location.search).has('qa');

async function start() {
  cssFonts();
  setupPWA(() => G.inGame);
  // Bağlam kaybı sonrası yenileme ya da atılmış sekme: başlık ekranı son kayıttan otomatik devam eder
  try {
    Lifecycle.resumeOnTitle = takeResumeFlag(window.sessionStorage, !!(document as any).wasDiscarded);
  } catch {
    /* sessionStorage yok */
  }
  await loadFonts();
  Display.uiScaleSetting = G.settings.uiScale;
  Display.dprCap = qualityDprCap(G.settings.quality);
  Display.compute();
  const fps = fpsLoopConfig(G.settings.fpsCap, QA);
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    width: Display.w,
    height: Display.h,
    backgroundColor: '#07060b',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / Display.dpr },
    input: { activePointers: 4 },
    // ?qa: başsız tarayıcıda (QA) kare süresi kırpılmasın; oyun zamanı gerçek zamana yakın aksın.
    // Diğer durumlarda Ayarlar → FPS sınırı (applyFpsCap çalışırken de uygular).
    fps: fps,
    render: { powerPreference: 'high-performance', maxLights: 24 } as any,
    scene: [BootScene, TitleScene, PrologueScene, WorldScene, UIScene, MenuScene, MinigameScene, CreditsScene],
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  });
  (window as any).__game = game;
  const world = () => {
    const w = game.scene.getScene('World') as WorldScene | null;
    return w && w.sys.isActive() ? w : null;
  };
  setupLifecycle({
    canvas: game.canvas,
    inGame: () => G.inGame && !!world(),
    snapshot: () => world()?.snapshotSave() ?? false,
    pause: () => world()?.freeze('hidden'),
    resume: () => world()?.unfreeze('hidden'),
    mute: () => Sound.suspend(),
    unmute: () => Sound.resume(),
  });
  (window as any).__R = R;
  (window as any).__Display = Display;
  // QA betikleri (tools/qa) için
  (window as any).__createMonster = createMonster;
  (window as any).__NPC_BY_ID = NPC_BY_ID;
  (window as any).Phaser = Phaser;
  const onResize = () => {
    Display.compute();
    // Önce boyut, sonra zoom: setZoom CSS boyutunu o anki tampon boyutuyla yazar; resize() ise
    // zoom 1 iken CSS boyutuna hiç dokunmaz (Düşük kaliteye geçince canvas eski boyutta kalıyordu).
    game.scale.resize(Display.w, Display.h);
    game.scale.setZoom(1 / Display.dpr);
    Display.emit();
  };
  Display.refresh = onResize;
  window.addEventListener('resize', () => setTimeout(onResize, 60));
  // FPS sınırı: Phaser'ın sınırlayıcısı adım işlevini start/wake'te bağlar; değişince uyut-uyandır.
  // Sınır 1 ms toleranslı: 60 Hz ekranda 60 sınırı, rAF titremesi yüzünden kare atlamasın.
  const applyFpsCap = (force = false) => {
    if (QA) return;
    const c = fpsLoopConfig(G.settings.fpsCap, false);
    const loop = game.loop as any;
    if (!force && loop.fpsLimit === c.limit && loop.targetFps === c.target) return;
    loop.targetFps = c.target;
    loop._target = 1000 / c.target;
    loop.fpsLimit = c.limit;
    loop.hasFpsLimit = c.limit > 0;
    loop._limitRate = c.limit > 0 ? 1000 / c.limit - 1 : 0;
    if (loop.running) {
      loop.sleep();
      loop.wake(true);
    }
  };
  game.events.once('ready', () => applyFpsCap(true));
  G.events.on('settings', () => applyFpsCap());
  window.addEventListener('orientationchange', () => setTimeout(onResize, 250));
}

start();
