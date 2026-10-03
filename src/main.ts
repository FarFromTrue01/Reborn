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
import * as R from './game/rules';

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
  setupPWA();
  await loadFonts();
  Display.uiScaleSetting = G.settings.uiScale;
  Display.compute();
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
    // ?qa: başsız tarayıcıda (QA) kare süresi kırpılmasın; oyun zamanı gerçek zamana yakın aksın
    fps: QA ? { target: 60, smoothStep: false, min: 1 } : { target: 60, smoothStep: true },
    render: { powerPreference: 'high-performance', maxLights: 24 } as any,
    scene: [BootScene, TitleScene, PrologueScene, WorldScene, UIScene, MenuScene, MinigameScene, CreditsScene],
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  });
  (window as any).__game = game;
  (window as any).__R = R;
  (window as any).Phaser = Phaser;
  const onResize = () => {
    Display.compute();
    game.scale.setZoom(1 / Display.dpr);
    game.scale.resize(Display.w, Display.h);
    Display.emit();
  };
  window.addEventListener('resize', () => setTimeout(onResize, 60));
  window.addEventListener('orientationchange', () => setTimeout(onResize, 250));
}

start();
