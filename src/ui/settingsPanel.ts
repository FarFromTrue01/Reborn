// Ayarlar paneli (başlık ekranı ve oyun menüsü ortak kullanır).
import Phaser from 'phaser';
import { G } from '../game/G';
import { COLORS, FONT, txt, Button } from './kit';
import { Sound } from '../audio/audio';
import { MOVE_SPEED_MIN, MOVE_SPEED_MAX, isTouchDevice, FPS_CAPS } from '../game/settings';
import { goFullscreen, exitFullscreen, isFullscreen, fullscreenSupported, isStandalone } from '../game/pwa';

function slider(scene: Phaser.Scene, c: Phaser.GameObjects.Container, x: number, y: number, w: number, label: string, get: () => number, set: (v: number) => void, fmt: (v: number) => string, min: number, max: number) {
  c.add(txt(scene, x, y, label, { size: 17, bold: true }));
  const valT = txt(scene, x + w, y, '', { size: 16, color: COLORS.textGold }).setOrigin(1, 0);
  c.add(valT);
  const g = scene.add.graphics();
  c.add(g);
  const by = y + 38;
  const draw = () => {
    const f = (get() - min) / (max - min);
    g.clear();
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(x, by - 5, w, 10, 5);
    g.fillStyle(COLORS.gold, 1);
    g.fillRoundedRect(x, by - 5, w * f, 10, 5);
    g.fillStyle(COLORS.goldLight, 1);
    g.fillCircle(x + w * f, by, 14);
    g.lineStyle(2, 0x3a2a10, 1);
    g.strokeCircle(x + w * f, by, 14);
    valT.setText(fmt(get()));
  };
  const z = scene.add.zone(x - 16, by - 26, w + 32, 52).setOrigin(0, 0).setInteractive({ draggable: true });
  const apply = (px: number) => {
    const lx = px - (c.x + x);
    const f = Phaser.Math.Clamp(lx / w, 0, 1);
    set(min + f * (max - min));
    draw();
  };
  z.on('pointerdown', (p: Phaser.Input.Pointer) => apply(p.worldX));
  z.on('drag', (p: Phaser.Input.Pointer) => apply(p.worldX));
  z.on('pointerup', () => {
    G.saveSettings();
    Sound.sfx('click', 0.5);
  });
  c.add(z);
  draw();
}

/** Tıkladıkça değer değiştiren buton. Etiket baştan doğru metinle oluşturulur. */
function cycler(scene: Phaser.Scene, c: Phaser.GameObjects.Container, x: number, y: number, label: () => string, next: () => void) {
  const b: Button = new Button(scene, x, y, label(), () => {
    next();
    G.saveSettings();
    b.setText(label());
  }, { w: 300, h: 50, size: 17 });
  c.add(b);
  return b;
}

function toggle(scene: Phaser.Scene, c: Phaser.GameObjects.Container, x: number, y: number, label: string, get: () => boolean, set: (v: boolean) => void) {
  return cycler(scene, c, x, y, () => `${label}: ${get() ? 'Açık' : 'Kapalı'}`, () => set(!get()));
}

export function buildSettings(scene: Phaser.Scene, c: Phaser.GameObjects.Container, w: number) {
  const s = G.settings;
  const col = w / 2 - 30;
  let y = 0;
  c.add(txt(scene, 0, y, 'Ayarlar', { size: 24, font: FONT.title, color: COLORS.textGold }));
  y += 46;
  slider(scene, c, 0, y, col, 'Arayüz boyutu', () => s.uiScale, (v) => (s.uiScale = Math.round(v * 20) / 20), (v) => `${Math.round(v * 100)}%`, 0.8, 1.4);
  slider(scene, c, col + 60, y, col, 'Metin hızı', () => s.textSpeed, (v) => (s.textSpeed = Math.round(v)), (v) => `${Math.round(v)} harf/sn`, 15, 120);
  y += 74;
  slider(scene, c, 0, y, col, 'Müzik', () => s.music, (v) => (s.music = v), (v) => `${Math.round(v * 100)}%`, 0, 1);
  slider(scene, c, col + 60, y, col, 'Efektler', () => s.sfx, (v) => (s.sfx = v), (v) => `${Math.round(v * 100)}%`, 0, 1);
  y += 74;
  slider(scene, c, 0, y, col, 'Konuşma sesi', () => s.voice, (v) => (s.voice = v), (v) => `${Math.round(v * 100)}%`, 0, 1);
  slider(scene, c, col + 60, y, col, 'Karakter hızı', () => s.moveSpeed, (v) => (s.moveSpeed = Math.round(v * 20) / 20), (v) => `${v.toFixed(2)}x`, MOVE_SPEED_MIN, MOVE_SPEED_MAX);
  y += 86;
  const bx0 = 150, bx1 = col + 210;
  const row = 55;
  toggle(scene, c, bx0, y, 'Otomatik ilerleme', () => s.autoAdvance, (v) => (s.autoAdvance = v)).setName('set_auto');
  toggle(scene, c, bx1, y, 'Ekran sarsıntısı', () => s.shake, (v) => (s.shake = v)).setName('set_shake');
  y += row;
  toggle(scene, c, bx0, y, 'FPS göstergesi', () => s.showFps, (v) => (s.showFps = v)).setName('set_fps');
  cycler(scene, c, bx1, y, () => `Grafik: ${{ high: 'Yüksek', medium: 'Orta', low: 'Düşük' }[s.quality]}`, () => {
    s.quality = s.quality === 'high' ? 'medium' : s.quality === 'medium' ? 'low' : 'high';
  }).setName('set_quality');
  y += row;
  cycler(scene, c, bx0, y, () => `Joystick: ${s.joystick === 'fixed' ? 'Sol altta sabit' : 'Hareketli'}`, () => {
    s.joystick = s.joystick === 'fixed' ? 'float' : 'fixed';
    s.joyChosen = true;
  }).setName('set_joy');
  toggle(scene, c, bx1, y, 'Yardımlı savaş', () => s.assistCombat, (v) => (s.assistCombat = v)).setName('set_assist');
  y += row;
  // Tam ekran: iPhone tarayıcısı desteklemez → ipucu
  if (fullscreenSupported()) {
    const b: Button = new Button(scene, bx0, y, isFullscreen() ? 'Tam ekrandan çık' : 'Tam ekran', async () => {
      if (isFullscreen()) await exitFullscreen();
      else await goFullscreen();
      setTimeout(() => b.setText(isFullscreen() ? 'Tam ekrandan çık' : 'Tam ekran'), 300);
    }, { w: 300, h: 50, size: 17 });
    b.setName('set_fullscreen');
    c.add(b);
  } else if (!isStandalone()) {
    c.add(txt(scene, 0, y - 18, 'Tam ekran için oyunu ana ekrana ekle: Paylaş → "Ana Ekrana Ekle".', { size: 15, color: COLORS.textGold, wrap: col + 40 }).setName('set_fs_hint'));
  }
  cycler(scene, c, bx1, y, () => `FPS sınırı: ${s.fpsCap ? s.fpsCap : 'Sınırsız'}`, () => {
    s.fpsCap = FPS_CAPS[(FPS_CAPS.indexOf(s.fpsCap) + 1) % FPS_CAPS.length];
  }).setName('set_fpscap');
  if (G.settings.devMode) {
    y += row;
    toggle(scene, c, bx0, y, 'Geliştirici modu', () => s.devMode, (v) => (s.devMode = v)).setName('set_dev');
  }
  y += 38;
  c.add(txt(scene, 0, y, `Grafik kalitesi çözünürlüğü de belirler (Düşük 1x, Orta 1,5x, Yüksek 2x); arayüz boyutu ve kalite menü kapanınca uygulanır. Yüksek FPS sınırı daha akıcı ama pili hızlı tüketir. Karakter hızı yalnızca yürüme ve koşmayı etkiler.${isTouchDevice() ? '' : ' Yardımlı savaş: saldırınca menzildeki en yakın düşmana döner.'}`, { size: 13, italic: true, color: COLORS.textDim, wrap: w }));
}
