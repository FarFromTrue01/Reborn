// Divine Paladin açıklaması (B19/B21): prologdaki çarkın sonucu ve Status → Traits'e dokununca aynı metin (gerçek veri).
import Phaser from 'phaser';
import { Display } from '../game/display';
import { COLORS, FONT, txt, fullScreenRect } from './kit';
import { divineDescription, pctLabel, TRAIT_ODDS } from '../core/traitWheel';
import { Sound } from '../audio/audio';

/** Açıklama bloğu (başlık hariç): her satır madde işaretiyle; genişliği w. */
export function divineInfoBlock(scene: Phaser.Scene, w: number, size = 15): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  let y = 0;
  for (const l of divineDescription().lines) {
    const t = txt(scene, 0, y, '• ' + l, { size, color: '#f3e6c0', wrap: w, lineSpacing: 2 });
    c.add(t);
    y += t.height + 6;
  }
  (c as any).blockH = y;
  return c;
}

/** Status → Traits: dokununca açılan pencere. Dokununca kapanır. */
export function showDivineInfo(scene: Phaser.Scene): Promise<void> {
  return new Promise((resolve) => {
    const W = Display.uiW, H = Display.uiH;
    const root = scene.add.container(0, 0).setDepth(300);
    const dim = fullScreenRect(scene, 0x000000, 0.72).setInteractive();
    root.add(dim);
    const pw = Math.min(760, W - 40);
    const block = divineInfoBlock(scene, pw - 60, 15);
    const ph = Math.min(H - 40, 150 + (block as any).blockH);
    const x0 = (W - pw) / 2, y0 = (H - ph) / 2;
    const g = scene.add.graphics();
    g.fillStyle(0x1a1206, 0.97);
    g.fillRoundedRect(x0, y0, pw, ph, 12);
    g.lineStyle(2.5, 0xffd56a, 1);
    g.strokeRoundedRect(x0, y0, pw, ph, 12);
    root.add(g);
    const X = TRAIT_ODDS.find(([r]) => r === 'X')![1];
    root.add(txt(scene, W / 2, y0 + 18, divineDescription().title, { size: 28, bold: true, font: FONT.title, color: '#ffe9a0', stroke: true }).setOrigin(0.5, 0));
    root.add(txt(scene, W / 2, y0 + 58, `Olasılık: ${pctLabel(X)} · Elonth'ta bu trait'e sahip başka biri kayıtlı değil.`, { size: 14, italic: true, color: '#d8c890', align: 'center', wrap: pw - 40 }).setOrigin(0.5, 0));
    block.setPosition(x0 + 30, y0 + 96);
    root.add(block);
    root.add(txt(scene, W / 2, y0 + ph - 26, 'Kapatmak için dokun', { size: 13, color: COLORS.textDim }).setOrigin(0.5));
    root.setAlpha(0);
    scene.tweens.add({ targets: root, alpha: 1, duration: 200 });
    Sound.sfx('open', 0.6);
    dim.once('pointerup', () => {
      scene.tweens.add({ targets: root, alpha: 0, duration: 180, onComplete: () => root.destroy() });
      resolve();
    });
  });
}
