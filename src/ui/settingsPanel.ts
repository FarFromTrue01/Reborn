// Ayarlar paneli (başlık ekranı ve oyun menüsü ortak kullanır).
// 0.5.0: kaydırılabilir (ScrollList) ve bölümlere ayrılmış: Görüntü, Ses, Oynanış, Kontroller (+ Geliştirici).
// Başlık ekranındaki "Kapat" düğmesi kaydırma alanının dışında, sabit kalır (TitleScene).
import Phaser from 'phaser';
import { G } from '../game/G';
import { COLORS, FONT, txt, Button, uiIcon } from './kit';
import { ScrollList } from './panels';
import { Sound } from '../audio/audio';
import { MOVE_SPEED_MIN, MOVE_SPEED_MAX, isTouchDevice, FPS_CAPS } from '../game/settings';
import { goFullscreen, exitFullscreen, isFullscreen, fullscreenSupported, isStandalone } from '../game/pwa';

/** Kaydırma alanındaki bir dokunuş geçerli mi: sürükleme değil ve listenin görünen alanında. */
function tapOk(scene: Phaser.Scene, list: ScrollList) {
  return !list.wasDrag() && list.containsPointer(scene.input.activePointer);
}

function slider(scene: Phaser.Scene, list: ScrollList, x: number, y: number, w: number, label: string, get: () => number, set: (v: number) => void, fmt: (v: number) => string, min: number, max: number) {
  const c = list.inner;
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
  let active = false;
  const apply = (px: number) => {
    // kapsayıcılar iç içe (menü → liste → iç): dünya konumunu dönüşüm matrisinden al
    const lx = px - (c.getWorldTransformMatrix().tx + x);
    const f = Phaser.Math.Clamp(lx / w, 0, 1);
    set(min + f * (max - min));
    draw();
  };
  z.on('pointerdown', (p: Phaser.Input.Pointer) => {
    // maskenin dışında kalan (kaydırılmış) kaydırıcıya dokunuş sayılmaz
    if (!list.containsPointer(p)) return;
    active = true;
    list.holdPointer(p.id);
    apply(p.worldX);
  });
  z.on('drag', (p: Phaser.Input.Pointer) => {
    if (active) apply(p.worldX);
  });
  const end = () => {
    if (!active) return;
    active = false;
    G.saveSettings();
    Sound.sfx('click', 0.5);
  };
  z.on('pointerup', end);
  z.on('dragend', end);
  c.add(z);
  draw();
}

/** Tıkladıkça değer değiştiren buton. Etiket baştan doğru metinle oluşturulur. */
function cycler(scene: Phaser.Scene, list: ScrollList, x: number, y: number, w: number, label: () => string, next: () => void) {
  const b: Button = new Button(scene, x, y, label(), () => {
    if (!tapOk(scene, list)) return;
    next();
    G.saveSettings();
    b.setText(label());
  }, { w, h: 50, size: 17 });
  list.inner.add(b);
  return b;
}

function toggle(scene: Phaser.Scene, list: ScrollList, x: number, y: number, w: number, label: string, get: () => boolean, set: (v: boolean) => void) {
  return cycler(scene, list, x, y, w, () => `${label}: ${get() ? 'Açık' : 'Kapalı'}`, () => set(!get()));
}

/**
 * Ayarlar: başlık + kaydırılabilir bölümler. w: genişlik, h: başlık dahil toplam yükseklik (kaydırma alanı h − 46).
 */
export function buildSettings(scene: Phaser.Scene, c: Phaser.GameObjects.Container, w: number, h: number) {
  const s = G.settings;
  c.add(uiIcon(scene, 16, 16, 'settings', 28));
  c.add(txt(scene, 38, 0, 'Ayarlar', { size: 24, font: FONT.title, color: COLORS.textGold }));
  const list = new ScrollList(scene, 0, 46, w, h - 46);
  c.add(list);
  list.updateMask();
  const inner = list.inner;
  const W = w - 18; // sağda kaydırma çubuğu payı
  const col = (W - 50) / 2;
  const x1 = col + 50;
  const bw = Math.min(320, col);
  const bx0 = bw / 2, bx1 = x1 + bw / 2;
  let y = 4;
  const section = (title: string, icon: string) => {
    if (y > 4) y += 10;
    inner.add(uiIcon(scene, 12, y + 12, icon, 22));
    const t = txt(scene, 30, y, title.toUpperCase(), { size: 16, bold: true, font: FONT.title, color: COLORS.textGold });
    inner.add(t);
    const g = scene.add.graphics();
    g.lineStyle(1, COLORS.gold, 0.35);
    g.lineBetween(30 + t.width + 14, y + 12, W, y + 12);
    inner.add(g);
    y += 34;
  };
  const SL = 78; // kaydırıcı satırı
  const BR = 60; // düğme satırı

  // ------------------------------------------------------------ Görüntü
  section('Görüntü', 'fullscreen');
  slider(scene, list, 0, y, col, 'Arayüz boyutu', () => s.uiScale, (v) => (s.uiScale = Math.round(v * 20) / 20), (v) => `${Math.round(v * 100)}%`, 0.8, 1.4);
  y += SL;
  y += 4;
  cycler(scene, list, bx0, y + 25, bw, () => `Grafik: ${{ high: 'Yüksek', medium: 'Orta', low: 'Düşük' }[s.quality]}`, () => {
    s.quality = s.quality === 'high' ? 'medium' : s.quality === 'medium' ? 'low' : 'high';
  }).setName('set_quality');
  cycler(scene, list, bx1, y + 25, bw, () => `FPS sınırı: ${s.fpsCap ? s.fpsCap : 'Sınırsız'}`, () => {
    s.fpsCap = FPS_CAPS[(FPS_CAPS.indexOf(s.fpsCap) + 1) % FPS_CAPS.length];
  }).setName('set_fpscap');
  y += BR;
  toggle(scene, list, bx0, y + 25, bw, 'FPS göstergesi', () => s.showFps, (v) => (s.showFps = v)).setName('set_fps');
  toggle(scene, list, bx1, y + 25, bw, 'Ekran sarsıntısı', () => s.shake, (v) => (s.shake = v)).setName('set_shake');
  y += BR;
  // Tam ekran: iPhone tarayıcısı desteklemez → ipucu
  if (fullscreenSupported()) {
    const b: Button = new Button(scene, bx0, y + 25, isFullscreen() ? 'Tam ekrandan çık' : 'Tam ekran', async () => {
      if (!tapOk(scene, list)) return;
      if (isFullscreen()) await exitFullscreen();
      else await goFullscreen();
      setTimeout(() => b.setText(isFullscreen() ? 'Tam ekrandan çık' : 'Tam ekran'), 300);
    }, { w: bw, h: 50, size: 17 });
    b.setName('set_fullscreen');
    inner.add(b);
    y += BR;
  } else if (!isStandalone()) {
    inner.add(txt(scene, 0, y, 'Tam ekran için oyunu ana ekrana ekle: Paylaş → "Ana Ekrana Ekle".', { size: 15, color: COLORS.textGold, wrap: W }).setName('set_fs_hint'));
    y += 30;
  }
  inner.add(txt(scene, 0, y, 'Grafik kalitesi çözünürlüğü de belirler (Düşük 1x, Orta 1,5x, Yüksek 2x). Arayüz boyutu ve kalite menü kapanınca uygulanır.', { size: 13, italic: true, color: COLORS.textDim, wrap: W }));
  y += 40;

  // ------------------------------------------------------------ Ses
  section('Ses', 'sound');
  slider(scene, list, 0, y, col, 'Müzik', () => s.music, (v) => (s.music = v), (v) => `${Math.round(v * 100)}%`, 0, 1);
  slider(scene, list, x1, y, col, 'Efektler', () => s.sfx, (v) => (s.sfx = v), (v) => `${Math.round(v * 100)}%`, 0, 1);
  y += SL;
  slider(scene, list, 0, y, col, 'Konuşma sesi', () => s.voice, (v) => (s.voice = v), (v) => `${Math.round(v * 100)}%`, 0, 1);
  y += SL;

  // ------------------------------------------------------------ Oynanış
  section('Oynanış', 'gameplay');
  slider(scene, list, 0, y, col, 'Metin hızı', () => s.textSpeed, (v) => (s.textSpeed = Math.round(v)), (v) => `${Math.round(v)} harf/sn`, 15, 120);
  slider(scene, list, x1, y, col, 'Karakter hızı', () => s.moveSpeed, (v) => (s.moveSpeed = Math.round(v * 20) / 20), (v) => `${v.toFixed(2)}x`, MOVE_SPEED_MIN, MOVE_SPEED_MAX);
  y += SL + 4;
  toggle(scene, list, bx0, y + 25, bw, 'Otomatik ilerleme', () => s.autoAdvance, (v) => (s.autoAdvance = v)).setName('set_auto');
  toggle(scene, list, bx1, y + 25, bw, 'Yardımlı savaş', () => s.assistCombat, (v) => (s.assistCombat = v)).setName('set_assist');
  y += BR;
  toggle(scene, list, bx0, y + 25, bw, 'Silahı sırta koy', () => s.sheathWeapon, (v) => (s.sheathWeapon = v)).setName('set_sheath');
  y += BR;
  if (!isTouchDevice()) {
    inner.add(txt(scene, 0, y, 'Yardımlı savaş: saldırınca menzildeki en yakın düşmana döner.', { size: 13, italic: true, color: COLORS.textDim, wrap: W }));
    y += 26;
  }
  inner.add(txt(scene, 0, y, 'Silahı sırta koy: savaş dışında silah sırtta/belde durur, savaşta ya da ilk saldırıda çekilir.', { size: 13, italic: true, color: COLORS.textDim, wrap: W }));
  y += 26;

  // ------------------------------------------------------------ Kontroller
  section('Kontroller', 'joystick');
  cycler(scene, list, bx0, y + 25, bw, () => `Joystick: ${s.joystick === 'fixed' ? 'Sol altta sabit' : 'Hareketli'}`, () => {
    s.joystick = s.joystick === 'fixed' ? 'float' : 'fixed';
    s.joyChosen = true;
  }).setName('set_joy');
  y += BR;

  // ------------------------------------------------------------ Geliştirici
  if (G.settings.devMode) {
    section('Geliştirici', 'dev');
    toggle(scene, list, bx0, y + 25, bw, 'Geliştirici modu', () => s.devMode, (v) => (s.devMode = v)).setName('set_dev');
    y += BR;
  }
  list.setContentHeight(y + 10);
  return list;
}
