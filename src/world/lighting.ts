// Karanlık katmanı: gece-gündüz ve iç mekân karanlığı. Işık kaynakları karanlığı "siler",
// ek olarak renkli parıltılar ADD karışımla çizilir.
import Phaser from 'phaser';
import type { LightSource } from './mapRender';

export class Lighting {
  rt: Phaser.GameObjects.RenderTexture;
  brush: Phaser.GameObjects.Image;
  glows = new Map<LightSource, Phaser.GameObjects.Image>();
  lights: LightSource[] = [];
  darkness = 0;
  color = 0x0a0f2a;
  t = 0;
  playerLight = 0;
  quality: 'low' | 'medium' | 'high' = 'high';

  constructor(public scene: Phaser.Scene) {
    const cam = scene.cameras.main;
    this.rt = scene.add.renderTexture(0, 0, Math.ceil(cam.width / cam.zoom) + 64, Math.ceil(cam.height / cam.zoom) + 64);
    this.rt.setOrigin(0, 0).setDepth(900000).setScrollFactor(1);
    this.brush = scene.make.image({ key: 'light', add: false });
  }

  resize() {
    const cam = this.scene.cameras.main;
    this.rt.resize(Math.ceil(cam.width / cam.zoom) + 64, Math.ceil(cam.height / cam.zoom) + 64);
  }

  setLights(ls: LightSource[]) {
    for (const g of this.glows.values()) g.destroy();
    this.glows.clear();
    this.lights = ls;
    for (const l of ls) {
      const g = this.scene.add.image(l.x, l.y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(l.color).setDepth(900001);
      g.setScale((l.radius * 1.3) / 128);
      g.setAlpha(0);
      this.glows.set(l, g);
    }
  }

  /** darkness: 0 (gündüz) .. 1; nightFactor: gece ışıkları ne kadar açık. */
  update(dt: number, darkness: number, color: number, nightFactor: number, player: { x: number; y: number } | null) {
    this.t += dt;
    this.darkness = darkness;
    const cam = this.scene.cameras.main;
    const vx = cam.worldView.x - 32, vy = cam.worldView.y - 32;
    const vw = cam.worldView.width + 64, vh = cam.worldView.height + 64;
    const visible = (l: LightSource) => l.x + l.radius > vx && l.x - l.radius < vx + vw && l.y + l.radius > vy && l.y - l.radius < vy + vh;
    // parıltılar
    for (const [l, g] of this.glows) {
      const on = l.night ? nightFactor : 1;
      const f = l.flicker ? 0.85 + Math.sin(this.t * 9 + l.phase) * 0.06 + Math.sin(this.t * 23 + l.phase * 2) * 0.05 : 1;
      const a = Math.max(0, on * (0.12 + darkness * 0.42) * f);
      g.setVisible(a > 0.01 && visible(l));
      g.setAlpha(a);
      g.setScale(((l.radius * 1.3) / 128) * (0.96 + (f - 0.9) * 0.6));
    }
    if (darkness <= 0.01) {
      this.rt.setVisible(false);
      return;
    }
    this.rt.setVisible(true);
    this.rt.setPosition(Math.floor(vx), Math.floor(vy));
    this.rt.clear();
    this.rt.fill(color, darkness);
    const ox = Math.floor(vx), oy = Math.floor(vy);
    const erase = (x: number, y: number, r: number, strength: number) => {
      this.brush.setScale((r * 2) / 256);
      this.brush.setAlpha(strength);
      this.rt.erase(this.brush, x - ox, y - oy);
    };
    for (const l of this.lights) {
      if (!visible(l)) continue;
      const on = l.night ? nightFactor : 1;
      if (on <= 0.01) continue;
      const f = l.flicker ? 0.92 + Math.sin(this.t * 8 + l.phase) * 0.05 + Math.sin(this.t * 21 + l.phase) * 0.03 : 1;
      erase(l.x, l.y, l.radius * f, on);
      if (this.quality === 'high') erase(l.x, l.y, l.radius * 0.5 * f, on * 0.6);
    }
    if (player && this.playerLight > 0) erase(player.x, player.y - 20, 110, this.playerLight);
  }

  destroy() {
    for (const g of this.glows.values()) g.destroy();
    this.glows.clear();
    this.rt.destroy();
    this.brush.destroy();
  }
}
