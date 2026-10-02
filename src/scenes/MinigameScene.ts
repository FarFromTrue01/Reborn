// Antrenman mini oyunları (20–40 saniye): odun kesme, taş kaldırma, koşu parkuru.
import Phaser from 'phaser';
import { Display } from '../game/display';
import { Sound } from '../audio/audio';
import { COLORS, FONT, txt, drawFrame, Button } from '../ui/kit';

type Kind = 'chop' | 'lift' | 'run';

export class MinigameScene extends Phaser.Scene {
  kind: Kind = 'chop';
  done!: (perf: number) => void;
  g!: Phaser.GameObjects.Graphics;
  info!: Phaser.GameObjects.Text;
  timeT!: Phaser.GameObjects.Text;
  t = 0;
  dur = 25;
  running = false;
  // chop
  marker = 0;
  markerDir = 1;
  zoneC = 0.5;
  zoneW = 0.16;
  logs = 0;
  hits = 0;
  attempts = 0;
  // lift
  holding = false;
  needle = 0;
  vel = 0;
  target = 0.5;
  inZone = 0;
  // run
  lastSide: 'L' | 'R' | null = null;
  speed = 0;
  dist = 0;
  goodSteps = 0;
  steps = 0;
  lastStepT = 0;
  // görsel sahne
  joe!: Phaser.GameObjects.Container;
  joeLayers: Phaser.GameObjects.Sprite[] = [];
  prop?: Phaser.GameObjects.Image;
  swingT = -1;
  runAnimT = 0;
  stage!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Minigame');
  }

  init(data: { kind: Kind; done: (p: number) => void }) {
    this.kind = data.kind;
    this.done = data.done;
    this.t = 0;
    this.running = false;
    this.logs = this.hits = this.attempts = 0;
    this.inZone = 0;
    this.dist = this.speed = this.goodSteps = this.steps = 0;
    this.needle = 0;
    this.vel = 0;
    this.lastSide = null;
    this.swingT = -1;
    this.runAnimT = 0;
    this.dur = data.kind === 'chop' ? 24 : data.kind === 'lift' ? 25 : 30;
  }

  create() {
    this.cameras.main.setZoom(Display.uiZoom);
    this.cameras.main.setOrigin(0, 0);
    const W = Display.uiW, H = Display.uiH;
    this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0, 0).setInteractive();
    const pw = Math.min(900, W - 40), ph = 520;
    const px = (W - pw) / 2, py = (H - ph) / 2;
    const fg = this.add.graphics();
    drawFrame(fg, px, py, pw, ph);
    const titles = { chop: 'Odun Kesme Kütüğü', lift: 'Taş Kaldırma', run: 'Koşu Parkuru' };
    const helps = {
      chop: 'İbre yeşil alandan geçerken vur! Tam ortası en iyisi.',
      lift: 'Basılı tut: taş kalkar. Bırak: iner. İbreyi altın bölgede tut.',
      run: 'Sol ve Sağ butonlarına sırayla, düzenli bas. Ritmi koru!',
    };
    txt(this, W / 2, py + 26, titles[this.kind], { size: 26, font: FONT.title, color: COLORS.textGold }).setOrigin(0.5, 0);
    this.info = txt(this, W / 2, py + 70, helps[this.kind], { size: 17, color: COLORS.textDim, align: 'center', wrap: pw - 60 }).setOrigin(0.5, 0);
    this.timeT = txt(this, px + pw - 30, py + 30, '', { size: 18, color: COLORS.text, bold: true }).setOrigin(1, 0);
    this.stage = this.add.graphics();
    this.g = this.add.graphics();
    this.buildStage();
    const by = py + ph - 70;
    if (this.kind === 'run') {
      const l = new Button(this, W / 2 - 150, by, 'SOL', () => this.step('L'), { w: 220, h: 80, size: 24, sound: null });
      const r = new Button(this, W / 2 + 150, by, 'SAĞ', () => this.step('R'), { w: 220, h: 80, size: 24, sound: null });
      l.on('pointerdown', () => this.step('L'));
      r.on('pointerdown', () => this.step('R'));
      l.removeAllListeners('pointerup');
      r.removeAllListeners('pointerup');
      this.input.keyboard?.on('keydown-LEFT', () => this.step('L'));
      this.input.keyboard?.on('keydown-A', () => this.step('L'));
      this.input.keyboard?.on('keydown-RIGHT', () => this.step('R'));
      this.input.keyboard?.on('keydown-D', () => this.step('R'));
    } else {
      const b = new Button(this, W / 2, by, this.kind === 'chop' ? 'VUR!' : 'KALDIR (basılı tut)', () => {}, { w: 360, h: 84, size: 24, sound: null });
      b.removeAllListeners('pointerup');
      b.on('pointerdown', () => this.press(true));
      b.on('pointerup', () => this.press(false));
      b.on('pointerout', () => this.press(false));
      this.input.keyboard?.on('keydown-SPACE', () => this.press(true));
      this.input.keyboard?.on('keyup-SPACE', () => this.press(false));
    }
    // geri sayım
    const cd = txt(this, W / 2, H / 2, '3', { size: 64, font: FONT.title, color: COLORS.textGold, stroke: true }).setOrigin(0.5).setDepth(5);
    let n = 3;
    this.time.addEvent({
      delay: 600, repeat: 3, callback: () => {
        n--;
        if (n > 0) cd.setText(String(n));
        else if (n === 0) {
          cd.setText('Başla!');
          this.running = true;
          Sound.sfx('bell', 0.5);
        } else cd.destroy();
      },
    });
  }

  /** Joseph'in o anki giysi katmanlarıyla küçük bir sahne. */
  buildStage() {
    const W = Display.uiW, H = Display.uiH;
    const world = this.scene.get('World') as any;
    const keys: string[] = world?.player?.actor?.layers?.map((l: Phaser.GameObjects.Sprite) => l.texture.key) ?? ['j_body', 'j_head'];
    this.joe = this.add.container(0, 0);
    this.joeLayers = keys.filter((k) => this.textures.exists(k)).map((k) => this.add.sprite(0, 0, k, 0).setOrigin(0.5, 61 / 64));
    this.joe.add(this.joeLayers);
    this.joe.setScale(2.4);
    const shadow = this.add.ellipse(0, 0, 70, 18, 0x000000, 0.35);
    const feetY = H / 2 + 150;
    if (this.kind === 'chop') {
      this.joe.setPosition(W / 2 - 50, feetY);
      shadow.setPosition(W / 2 - 50, feetY);
      if (this.textures.get('props').has('chop_block')) this.prop = this.add.image(W / 2 + 40, feetY + 6, 'props', 'chop_block').setOrigin(0.5, 1).setScale(2.4);
      this.setJoeFrame(12 + 3, 0);
    } else if (this.kind === 'lift') {
      this.joe.setPosition(W / 2 + 190, feetY - 20);
      shadow.setPosition(W / 2 + 190, feetY - 20);
      if (this.textures.get('props').has('boulder2')) this.prop = this.add.image(W / 2 + 190, feetY - 60, 'props', 'boulder2').setOrigin(0.5, 1).setScale(2);
      this.setJoeFrame(2, 0);
    } else {
      this.joe.setPosition(W / 2 - 330, H / 2 - 40);
      shadow.setVisible(false);
      this.joe.setScale(1.6);
      this.setJoeFrame(8 + 3, 0);
    }
    this.children.moveBelow(shadow, this.joe);
  }

  setJoeFrame(row: number, col: number) {
    for (const l of this.joeLayers) l.setFrame(row * 13 + col);
  }

  chips(x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      const c = this.add.rectangle(x, y, 6, 4, i % 2 ? 0xc89a5a : 0x8a5a2a);
      this.tweens.add({ targets: c, x: x + (Math.random() - 0.5) * 120, y: y - 20 - Math.random() * 60, angle: Math.random() * 360, duration: 260, ease: 'Quad.Out', yoyo: false, onComplete: () => this.tweens.add({ targets: c, y: y + 30, alpha: 0, duration: 300, onComplete: () => c.destroy() }) });
    }
  }

  press(down: boolean) {
    if (!this.running) return;
    if (this.kind === 'chop') {
      if (!down) return;
      this.attempts++;
      this.swingT = 0;
      const d = Math.abs(this.marker - this.zoneC);
      if (d < this.zoneW / 2) {
        const q = 1 - d / (this.zoneW / 2);
        this.hits += 0.6 + q * 0.4;
        this.logs++;
        Sound.sfx('chop');
        this.cameras.main.shake(80, 0.004);
        this.zoneC = 0.2 + Math.random() * 0.6;
        this.zoneW = Math.max(0.08, 0.16 - this.logs * 0.006);
        this.flash(0x9fe08a);
        this.time.delayedCall(170, () => this.prop && this.chips(this.prop.x, this.prop.y - 40));
      } else {
        Sound.sfx('miss');
        this.flash(0xff5040);
      }
    } else if (this.kind === 'lift') this.holding = down;
  }

  step(side: 'L' | 'R') {
    if (!this.running) return;
    const now = this.time.now / 1000;
    this.steps++;
    if (side !== this.lastSide) {
      const dt = now - this.lastStepT;
      const good = dt > 0.12 && dt < 0.45;
      if (good) this.goodSteps++;
      this.speed = Math.min(1, this.speed + (good ? 0.12 : 0.05));
      Sound.sfx('step', 0.8);
    } else {
      this.speed = Math.max(0, this.speed - 0.15);
      Sound.sfx('error', 0.3);
    }
    this.lastSide = side;
    this.lastStepT = now;
  }

  flash(color: number) {
    const W = Display.uiW, H = Display.uiH;
    const r = this.add.rectangle(0, 0, W, H, color, 0.15).setOrigin(0, 0);
    this.tweens.add({ targets: r, alpha: 0, duration: 250, onComplete: () => r.destroy() });
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    const W = Display.uiW, H = Display.uiH;
    const g = this.g;
    g.clear();
    const bx = W / 2 - 330, bw = 660, by = this.kind === 'chop' ? H / 2 - 95 : H / 2 - 40;
    if (this.running) {
      this.t += dt;
      if (this.t >= this.dur) this.finish();
    }
    this.timeT.setText(`${Math.max(0, Math.ceil(this.dur - this.t))} sn`);
    if (this.kind === 'chop') {
      if (this.running) {
        this.marker += this.markerDir * dt * (0.9 + this.logs * 0.06);
        if (this.marker > 1) { this.marker = 1; this.markerDir = -1; }
        if (this.marker < 0) { this.marker = 0; this.markerDir = 1; }
      }
      g.fillStyle(0x000000, 0.6);
      g.fillRoundedRect(bx, by, bw, 40, 8);
      g.fillStyle(0x6fbf4a, 0.9);
      g.fillRect(bx + (this.zoneC - this.zoneW / 2) * bw, by, this.zoneW * bw, 40);
      g.fillStyle(0xf3dc95, 1);
      g.fillRect(bx + this.zoneC * bw - 2, by, 4, 40);
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(bx + this.marker * bw - 10, by - 14, bx + this.marker * bw + 10, by - 14, bx + this.marker * bw, by + 2);
      g.fillRect(bx + this.marker * bw - 2, by, 4, 40);
      this.info.setText(`Kesilen kütük: ${this.logs}`);
      if (this.swingT >= 0) {
        this.swingT += dt;
        const f = Math.min(5, Math.floor(this.swingT / 0.05));
        this.setJoeFrame(12 + 3, f);
        if (this.swingT > 0.32) {
          this.swingT = -1;
          this.setJoeFrame(12 + 3, 0);
        }
      }
    } else if (this.kind === 'lift') {
      if (this.running) {
        this.vel += (this.holding ? 1.6 : -1.8) * dt;
        this.vel *= 0.92;
        this.needle = Phaser.Math.Clamp(this.needle + this.vel * dt * 2.2, 0, 1);
        this.target = 0.5 + Math.sin(this.t * 0.9) * 0.3 + Math.sin(this.t * 2.3) * 0.08;
        if (Math.abs(this.needle - this.target) < 0.1) this.inZone += dt;
      }
      const vx = W / 2 - 30, vy = H / 2 - 170, vh = 300;
      g.fillStyle(0x000000, 0.6);
      g.fillRoundedRect(vx, vy, 60, vh, 8);
      g.fillStyle(0xd9b45a, 0.6);
      g.fillRect(vx, vy + (1 - this.target - 0.1) * vh, 60, 0.2 * vh);
      g.fillStyle(0xffffff, 1);
      g.fillRect(vx - 14, vy + (1 - this.needle) * vh - 3, 88, 6);
      // taş: Joseph kaldırdıkça başının üstüne çıkar
      const feet = this.joe.y;
      if (this.prop) this.prop.setY(feet - 40 - this.needle * 110 + Math.sin(this.t * 30) * (this.holding ? 1.5 : 0));
      this.setJoeFrame(2, Math.min(6, 1 + Math.round(this.needle * 5)));
      this.info.setText(`Bölgede: ${this.inZone.toFixed(1)} sn`);
    } else {
      if (this.running) {
        this.speed = Math.max(0, this.speed - dt * 0.35);
        this.dist += this.speed * dt * 0.06;
        if (this.dist >= 1) this.finish();
      }
      g.fillStyle(0x3a2a1a, 1);
      g.fillRoundedRect(bx, by, bw, 26, 8);
      g.fillStyle(0xd9b45a, 1);
      g.fillRoundedRect(bx, by, bw * Math.min(1, this.dist), 26, 8);
      g.fillStyle(0x000000, 0.6);
      g.fillRoundedRect(bx, by + 50, bw, 14, 6);
      g.fillStyle(0x6fbf4a, 1);
      g.fillRoundedRect(bx, by + 50, bw * this.speed, 14, 6);
      // koşucu
      this.runAnimT += dt * (2 + this.speed * 14);
      this.joe.setPosition(bx + bw * Math.min(1, this.dist), by - 2 - Math.abs(Math.sin(this.runAnimT * 1.5)) * 3 * this.speed);
      this.setJoeFrame(8 + 3, this.speed > 0.05 ? 1 + (Math.floor(this.runAnimT) % 8) : 0);
      this.info.setText(`Mesafe: %${Math.round(Math.min(1, this.dist) * 100)} · Ritim: ${this.steps ? Math.round((this.goodSteps / this.steps) * 100) : 0}%`);
    }
  }

  finish() {
    if (!this.running) return;
    this.running = false;
    let perf = 0;
    if (this.kind === 'chop') perf = Math.min(1, this.hits / 14) * (this.attempts ? Math.min(1, 0.5 + this.logs / this.attempts / 2) : 0);
    else if (this.kind === 'lift') perf = Math.min(1, this.inZone / (this.dur * 0.75));
    else perf = Math.min(1, this.dist) * 0.6 + (this.steps ? (this.goodSteps / this.steps) * 0.4 : 0);
    perf = Phaser.Math.Clamp(perf, 0, 1);
    Sound.sfx(perf > 0.6 ? 'levelup' : 'skillup', 0.6);
    const W = Display.uiW, H = Display.uiH;
    const t = txt(this, W / 2, H / 2 + 100, `Performans: %${Math.round(perf * 100)}`, { size: 30, font: FONT.title, color: COLORS.textGold, stroke: true }).setOrigin(0.5);
    t.setScale(0.5);
    this.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.Out' });
    this.time.delayedCall(1700, () => {
      this.scene.stop();
      this.done(perf);
    });
  }
}
