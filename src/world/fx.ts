// Görsel efektler: uçan hasar sayıları, kıvılcım, toz, yaprak, ateş böceği, iz.
import Phaser from 'phaser';
import { Display } from '../game/display';
import { FONT } from '../ui/kit';

export class FX {
  constructor(public scene: Phaser.Scene) {}

  /** Dünya koordinatında yazı (hasar sayısı vb.). Kamera zoom'una göre keskin çizilir. */
  number(x: number, y: number, text: string, kind: 'dmg' | 'crit' | 'miss' | 'hurt' | 'heal' | 'exp' | 'info' | 'sneak' | 'divine' = 'dmg') {
    const z = this.scene.cameras.main.zoom;
    const styles: Record<string, { size: number; color: string; italic?: boolean; stroke: string }> = {
      dmg: { size: 13, color: '#ffffff', stroke: '#2a1a10' },
      crit: { size: 19, color: '#ffd23a', stroke: '#5a1a00' },
      miss: { size: 11, color: '#c8d0e0', italic: true, stroke: '#1a1f2a' },
      hurt: { size: 14, color: '#ff5a4a', stroke: '#2a0505' },
      heal: { size: 13, color: '#7dff8a', stroke: '#0a2a10' },
      exp: { size: 10, color: '#bfe4ff', stroke: '#0a1a2a' },
      info: { size: 10, color: '#f0e6c8', stroke: '#1a140a' },
      sneak: { size: 12, color: '#d9a8ff', stroke: '#200a2a' },
      divine: { size: 11, color: '#ffe9a0', stroke: '#3a2a00' },
    };
    const s = styles[kind];
    const t = this.scene.add.text(x, y, text, {
      fontFamily: kind === 'miss' ? FONT.body : FONT.pixel,
      fontSize: `${s.size}px`,
      color: s.color,
      fontStyle: s.italic ? 'italic bold' : 'bold',
      stroke: s.stroke,
      strokeThickness: 3,
    });
    t.setResolution(z * (Display.dpr > 1 ? 1 : 1));
    t.setOrigin(0.5, 1).setDepth(950000);
    const dx = (Math.random() - 0.5) * 18;
    if (kind === 'crit') {
      t.setScale(0.4);
      this.scene.tweens.add({ targets: t, scale: 1.25, duration: 120, ease: 'Back.Out', yoyo: true, hold: 60, onComplete: () => t.setScale(1) });
    }
    this.scene.tweens.add({
      targets: t,
      x: x + dx,
      y: y - (kind === 'crit' ? 34 : 24),
      duration: kind === 'crit' ? 900 : 700,
      ease: 'Cubic.Out',
    });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: kind === 'crit' ? 650 : 450, duration: 300, onComplete: () => t.destroy() });
  }

  sparks(x: number, y: number, color = 0xfff2b0, n = 7, speed = 120) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      const p = this.scene.add.image(x, y, 'spark').setTint(color).setDepth(940000).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6 + Math.random() * 0.6);
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(a) * v * 0.25,
        y: y + Math.sin(a) * v * 0.25,
        alpha: 0,
        scale: 0.1,
        duration: 220 + Math.random() * 160,
        ease: 'Quad.Out',
        onComplete: () => p.destroy(),
      });
    }
  }

  slashArc(x: number, y: number, angle: number, color = 0xffffff, scale = 1) {
    const s = this.scene.add.image(x, y, 'slash').setRotation(angle).setTint(color).setDepth(930000).setAlpha(0.85).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6 * scale);
    this.scene.tweens.add({ targets: s, scale: 1.1 * scale, alpha: 0, duration: 180, ease: 'Quad.Out', onComplete: () => s.destroy() });
  }

  dust(x: number, y: number, n = 4, color = 0xd8c8a0) {
    for (let i = 0; i < n; i++) {
      const p = this.scene.add.image(x + (Math.random() - 0.5) * 10, y, 'soft').setTint(color).setAlpha(0.45).setScale(0.12 + Math.random() * 0.1).setDepth(y - 1);
      this.scene.tweens.add({
        targets: p,
        x: p.x + (Math.random() - 0.5) * 24,
        y: y - 6 - Math.random() * 10,
        alpha: 0,
        scale: p.scale * 2.2,
        duration: 420 + Math.random() * 200,
        onComplete: () => p.destroy(),
      });
    }
  }

  ring(x: number, y: number, color: number, r = 40, dur = 400) {
    const s = this.scene.add.image(x, y, 'ring').setTint(color).setDepth(935000).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2);
    this.scene.tweens.add({ targets: s, scale: r / 32, alpha: 0, duration: dur, ease: 'Cubic.Out', onComplete: () => s.destroy() });
  }

  glow(x: number, y: number, color: number, r = 60, dur = 500) {
    const s = this.scene.add.image(x, y, 'light').setTint(color).setDepth(935000).setBlendMode(Phaser.BlendModes.ADD).setScale(r / 128).setAlpha(0.9);
    this.scene.tweens.add({ targets: s, alpha: 0, scale: (r * 1.4) / 128, duration: dur, onComplete: () => s.destroy() });
  }

  /** Kaçış izi (hayalet). */
  ghost(src: Phaser.GameObjects.Container, tint = 0x9fd6ff) {
    const layers = (src as any).layers as Phaser.GameObjects.Sprite[];
    for (const l of layers) {
      const g = this.scene.add.sprite(src.x, src.y, l.texture.key, l.frame.name).setOrigin(l.originX, l.originY).setTintFill(tint).setAlpha(0.45).setDepth(src.y - 1).setScale(src.scale);
      this.scene.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
    }
  }

  pickupSparkle(x: number, y: number) {
    this.sparks(x, y - 6, 0xffe9a0, 6, 80);
  }
}
