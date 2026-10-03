// Ayarlar paneli (başlık ekranı ve oyun menüsü ortak kullanır).
import Phaser from 'phaser';
import { G } from '../game/G';
import { COLORS, FONT, txt, Button } from './kit';
import { Sound } from '../audio/audio';
import { MOVE_SPEED_MIN, MOVE_SPEED_MAX } from '../game/settings';

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
  y += 80;
  slider(scene, c, 0, y, col, 'Müzik', () => s.music, (v) => (s.music = v), (v) => `${Math.round(v * 100)}%`, 0, 1);
  slider(scene, c, col + 60, y, col, 'Efektler', () => s.sfx, (v) => (s.sfx = v), (v) => `${Math.round(v * 100)}%`, 0, 1);
  y += 80;
  slider(scene, c, 0, y, col, 'Konuşma sesi', () => s.voice, (v) => (s.voice = v), (v) => `${Math.round(v * 100)}%`, 0, 1);
  slider(scene, c, col + 60, y, col, 'Karakter hızı', () => s.moveSpeed, (v) => (s.moveSpeed = Math.round(v * 20) / 20), (v) => `${v.toFixed(2)}x`, MOVE_SPEED_MIN, MOVE_SPEED_MAX);
  y += 92;
  const bx0 = 150, bx1 = col + 210;
  toggle(scene, c, bx0, y, 'Otomatik ilerleme', () => s.autoAdvance, (v) => (s.autoAdvance = v)).setName('set_auto');
  toggle(scene, c, bx1, y, 'Ekran sarsıntısı', () => s.shake, (v) => (s.shake = v)).setName('set_shake');
  y += 58;
  toggle(scene, c, bx0, y, 'FPS göstergesi', () => s.showFps, (v) => (s.showFps = v)).setName('set_fps');
  cycler(scene, c, bx1, y, () => `Grafik: ${{ high: 'Yüksek', medium: 'Orta', low: 'Düşük' }[s.quality]}`, () => {
    s.quality = s.quality === 'high' ? 'medium' : s.quality === 'medium' ? 'low' : 'high';
  }).setName('set_quality');
  y += 58;
  cycler(scene, c, bx0, y, () => `Joystick: ${s.joystick === 'fixed' ? 'Sol altta sabit' : 'Dokunduğun yerde'}`, () => {
    s.joystick = s.joystick === 'fixed' ? 'float' : 'fixed';
  }).setName('set_joy');
  y += 40;
  c.add(txt(scene, 0, y, 'Arayüz boyutu değişikliği menü kapanınca uygulanır. Karakter hızı yalnızca yürüme ve koşmayı etkiler.', { size: 13, italic: true, color: COLORS.textDim, wrap: w }));
}
