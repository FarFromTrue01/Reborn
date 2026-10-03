// Haritadaki canlılar için temel sınıf: LPC katmanlı sprite'lar veya canavar sayfaları,
// elle sürülen kare animasyonları, gölge, vuruş parlaması.
import Phaser from 'phaser';
import { LPC_ROWS, DIR_INDEX } from '../data/manifest';

export type Dir = 'up' | 'left' | 'down' | 'right';
export type AnimName = 'idle' | 'walk' | 'run' | 'slash' | 'thrust' | 'shoot' | 'hurt' | 'die' | 'cast' | 'attack' | 'bow';

export interface MonsterSheetMeta {
  frameW: number;
  frameH: number;
  cols: number;
  anims: Record<string, { row: number; frames: number; fps: number }>;
}

const LPC_COLS = 13;

export function dirFromVec(x: number, y: number, fallback: Dir = 'down'): Dir {
  if (Math.abs(x) < 0.001 && Math.abs(y) < 0.001) return fallback;
  if (Math.abs(x) > Math.abs(y)) return x < 0 ? 'left' : 'right';
  return y < 0 ? 'up' : 'down';
}

export function dirVec(d: Dir): [number, number] {
  return d === 'up' ? [0, -1] : d === 'down' ? [0, 1] : d === 'left' ? [-1, 0] : [1, 0];
}

export class Actor extends Phaser.GameObjects.Container {
  kind: 'lpc' | 'monster';
  layers: Phaser.GameObjects.Sprite[] = [];
  shadow: Phaser.GameObjects.Image;
  dir: Dir = 'down';
  anim: AnimName = 'idle';
  animT = 0;
  animSpeed = 1;
  animLoop = true;
  animDone: (() => void) | null = null;
  animHold = false; // son karede kal
  frameCol = 0;
  mmeta: MonsterSheetMeta | null = null;
  sheetKey: string;
  radius = 9;
  flashT = 0;
  kb = new Phaser.Math.Vector2();
  frozenT = 0; // vuruş donması
  dead = false;
  baseScale = 1;
  bodyR = 9;
  bob = 0;
  facingLocked = false;

  constructor(scene: Phaser.Scene, x: number, y: number, sheets: string[], kind: 'lpc' | 'monster' = 'lpc', mmeta?: MonsterSheetMeta) {
    super(scene, x, y);
    this.kind = kind;
    this.sheetKey = sheets[0];
    this.mmeta = mmeta ?? null;
    this.shadow = scene.add.image(0, 0, 'shadow').setScale(kind === 'lpc' ? 1 : 1.1);
    this.add(this.shadow);
    for (const s of sheets) this.addLayer(s);
    scene.add.existing(this);
    this.applyFrame();
  }

  addLayer(key: string, index?: number) {
    const sp = this.scene.add.sprite(0, 0, key, 0);
    if (this.kind === 'lpc') sp.setOrigin(0.5, 61 / 64);
    else sp.setOrigin(0.5, (this.mmeta!.frameH - 6) / this.mmeta!.frameH);
    if (index === undefined) {
      this.layers.push(sp);
      this.add(sp);
    } else {
      this.layers.splice(index, 0, sp);
      this.addAt(sp, index + 1);
    }
    return sp;
  }

  setLayers(keys: string[]) {
    for (const l of this.layers) l.destroy();
    this.layers = [];
    for (const k of keys) this.addLayer(k);
    this.applyFrame();
  }

  play(a: AnimName, opts: { loop?: boolean; speed?: number; onDone?: () => void; hold?: boolean; restart?: boolean } = {}) {
    if (this.anim === a && !opts.restart && this.animLoop) {
      if (opts.speed) this.animSpeed = opts.speed;
      return;
    }
    this.anim = a;
    this.animT = 0;
    this.animLoop = opts.loop ?? (a === 'walk' || a === 'idle' || a === 'run');
    this.animSpeed = opts.speed ?? 1;
    this.animDone = opts.onDone ?? null;
    this.animHold = opts.hold ?? false;
    this.applyFrame();
  }

  /** Animasyon tanımı: satır, kare sayısı, fps, ilk kare. */
  private animDef(): { row: number; frames: number; fps: number; start: number; perDir: boolean } {
    if (this.kind === 'lpc') {
      switch (this.anim) {
        case 'idle': return { row: LPC_ROWS.walk.row, frames: 1, fps: 1, start: 0, perDir: true };
        case 'walk': return { row: LPC_ROWS.walk.row, frames: 8, fps: 11, start: 1, perDir: true };
        case 'run': return { row: LPC_ROWS.walk.row, frames: 8, fps: 17, start: 1, perDir: true };
        case 'slash':
        case 'attack': return { row: LPC_ROWS.slash.row, frames: 6, fps: 16, start: 0, perDir: true };
        case 'thrust': return { row: LPC_ROWS.thrust.row, frames: 8, fps: 18, start: 0, perDir: true };
        case 'shoot': return { row: LPC_ROWS.shoot.row, frames: 13, fps: 24, start: 0, perDir: true };
        case 'cast': return { row: LPC_ROWS.spellcast.row, frames: 7, fps: 14, start: 0, perDir: true };
        case 'hurt': return { row: LPC_ROWS.hurt.row, frames: 3, fps: 14, start: 0, perDir: false };
        case 'die': return { row: LPC_ROWS.hurt.row, frames: 6, fps: 9, start: 0, perDir: false };
        case 'bow': return { row: LPC_ROWS.hurt.row, frames: 3, fps: 8, start: 0, perDir: false };
      }
    }
    const m = this.mmeta!;
    const pick = (n: string) => m.anims[n];
    let a = pick(this.anim === 'run' ? 'run' : this.anim);
    if (!a) {
      if (this.anim === 'idle') a = m.anims.idle ?? m.anims.walk;
      else if (this.anim === 'run') a = m.anims.walk;
      else if (this.anim === 'attack' || this.anim === 'slash') a = m.anims.attack ?? m.anims.walk;
      else a = m.anims.walk;
    }
    const isIdleFromWalk = this.anim === 'idle' && !m.anims.idle;
    return { row: a.row, frames: isIdleFromWalk ? 1 : a.frames, fps: a.fps, start: 0, perDir: true };
  }

  tickAnim(dt: number) {
    if (this.frozenT > 0) {
      this.frozenT -= dt;
      return;
    }
    const d = this.animDef();
    this.animT += dt * this.animSpeed;
    let f = Math.floor(this.animT * d.fps);
    if (f >= d.frames) {
      if (this.animLoop) f = f % d.frames;
      else {
        f = d.frames - 1;
        if (this.animDone) {
          const cb = this.animDone;
          this.animDone = null;
          cb();
        }
      }
    }
    if (f !== this.frameCol) {
      this.frameCol = f;
      this.applyFrame();
    }
  }

  /** Mevcut animasyonun kaçıncı karesinde olduğumuz (0..1). */
  animProgress() {
    const d = this.animDef();
    return Math.min(1, (this.animT * d.fps) / d.frames);
  }

  applyFrame() {
    const d = this.animDef();
    const col = d.start + Math.min(this.frameCol, d.frames - 1);
    if (this.kind === 'lpc') {
      const row = d.row + (d.perDir ? DIR_INDEX[this.dir] : 0);
      const idx = row * LPC_COLS + col;
      for (const l of this.layers) l.setFrame(idx);
    } else {
      const m = this.mmeta!;
      const row = d.row + (d.perDir ? DIR_INDEX[this.dir] : 0);
      const idx = row * m.cols + Math.min(col, m.cols - 1);
      for (const l of this.layers) l.setFrame(idx);
    }
  }

  face(d: Dir) {
    if (this.facingLocked) return;
    if (d !== this.dir) {
      this.dir = d;
      this.applyFrame();
    }
  }

  flash(color = 0xffffff, t = 0.08) {
    this.flashT = t;
    for (const l of this.layers) l.setTintFill(color);
  }

  tint(color: number | null) {
    for (const l of this.layers) {
      if (color === null) l.clearTint();
      else l.setTint(color);
    }
  }

  tickFlash(dt: number) {
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) for (const l of this.layers) l.clearTint();
    }
  }

  /**
   * A2: çizim konumunu dünya pikseline hizala (fizik konumu kesirli kalır).
   * Kamera da dünya pikseline yuvarlandığı için ikisi aynı adımda hareket eder; titreme olmaz.
   */
  snap() {
    const ox = Math.floor(this.x) - this.x, oy = Math.floor(this.y) - this.y;
    this.shadow.setPosition(ox, oy);
    for (const l of this.layers) l.setPosition(ox, oy);
  }

  setAlphaAll(a: number) {
    for (const l of this.layers) l.setAlpha(a);
  }

  get body2(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  enablePhysics(r: number) {
    this.bodyR = r;
    this.scene.physics.add.existing(this);
    const b = this.body2;
    b.setCircle(r);
    b.setOffset(-r, -r);
    b.setCollideWorldBounds(true);
  }
}
