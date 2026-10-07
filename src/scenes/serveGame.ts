// D4: "Servis Koşturmacası" — Bertram'ın hanında her iş günü oynanan mini oyun.
// Masalarda sipariş balonları belirir (bira, güveç, ekmek). Tezgâhtan al, süre bitmeden masaya götür.
// Müşteri yiyip gidince kirli tabak kalır; tabağı toplayıp bulaşığa bırakmadan masaya yeni müşteri oturmaz.
// Her gün daha çok masa, daha sabırsız müşteri. 0.10.0: tezgâhta çöp kutusu (yanlış alınan yiyecek atılır).
// 0.8.0: günün hedefi var (0.10.0: iş iki gün — 1. gün 6, 2. gün 8 müşteri: yemeği verilip tabağı bulaşığa konan). Bir sipariş
// zamanında verilmezse ya da kirli bir tabak kendi süresi içinde bulaşığa konmazsa oyun anında kaybedilir (tekrar dene).
// Performans (hıza göre) yalnızca Bertram'ın yorumunu değiştirir.
import Phaser from 'phaser';
import { Sound } from '../audio/audio';
import { COLORS, txt, uiIcon } from '../ui/kit';
import { NPCS } from '../data/npcs';
import { serveDifficulty, servePerf, serveOutcome, servePerfTime, discardFood, type ServeLoss } from '../core/serve';
export { serveDifficulty, servePerf };

type Food = 'beer' | 'stew' | 'bread';
type Carry = Food | 'plate';
const FOODS: Food[] = ['beer', 'stew', 'bread'];
const FOOD_NAME: Record<Food, string> = { beer: 'Bira', stew: 'Güveç', bread: 'Ekmek' };
const ICON: Record<Carry, string> = { beer: 's_beer', stew: 's_stew', bread: 's_bread', plate: 's_plate' };

interface Table {
  x: number;
  y: number;
  state: 'empty' | 'waiting' | 'eating' | 'dirty';
  order: Food | null;
  patience: number;
  maxPatience: number;
  eatT: number;
  g: Phaser.GameObjects.Graphics;
  patron: Phaser.GameObjects.Sprite | null;
  bubble: Phaser.GameObjects.Container | null;
  plate: Phaser.GameObjects.Image | null;
  /** Kirli tabağın kalan süresi (0.8.0). */
  plateT: number;
  plateRing: Phaser.GameObjects.Graphics | null;
}

export class ServeGame {
  cfg: ReturnType<typeof serveDifficulty>;
  tables: Table[] = [];
  joe: Phaser.GameObjects.Container;
  joeLayers: Phaser.GameObjects.Sprite[];
  joeShadow: Phaser.GameObjects.Ellipse;
  trayIcons: Phaser.GameObjects.Image[] = [];
  carry: Carry[] = [];
  /** Eldeki kirli tabakların kalan süreleri (bulaşığa konana kadar işler). */
  carryPlates: number[] = [];
  /** Geçen süre ve sonuç (0.8.0). */
  t = 0;
  lost: ServeLoss | null = null;
  trayRings: Phaser.GameObjects.Graphics | null = null;
  target: { x: number; y: number; act: () => void } | null = null;
  walkT = 0;
  spawnT = 1.2;
  /** A7.13: ilk müşteri (sabrı biraz uzun). */
  firstSeat = true;
  served = 0;
  failed = 0;
  platesMade = 0;
  platesCleared = 0;
  counter: { x: number; y: number };
  sink: { x: number; y: number };
  trash: { x: number; y: number };
  stockPos: Record<Food, { x: number; y: number }> = {} as any;
  hud: Phaser.GameObjects.Text;
  patrons: string[];
  floor: Phaser.GameObjects.Graphics;

  constructor(public s: Phaser.Scene & { running: boolean }, public px: number, public py: number, public pw: number, public ph: number, public day: number, joeKeys: string[]) {
    this.cfg = serveDifficulty(day);
    const top = py + 124, bottom = py + ph - 24;
    // zemin: tahta döşeme
    const fl = (this.floor = s.add.graphics());
    fl.fillStyle(0x3b2616, 1);
    fl.fillRoundedRect(px + 20, top, pw - 40, bottom - top, 10);
    for (let yy = top + 18; yy < bottom; yy += 22) {
      fl.lineStyle(1, 0x2a1a0e, 0.8);
      fl.lineBetween(px + 22, yy, px + pw - 22, yy);
    }
    fl.lineStyle(2, COLORS.goldDark, 1);
    fl.strokeRoundedRect(px + 20, top, pw - 40, bottom - top, 10);
    // tezgâh (altta)
    const cy = bottom - 46;
    fl.fillStyle(0x6b4423, 1);
    fl.fillRoundedRect(px + 40, cy - 10, pw - 80, 50, 8);
    fl.fillStyle(0x8a5a30, 1);
    fl.fillRoundedRect(px + 40, cy - 10, pw - 80, 14, 6);
    this.counter = { x: px + pw / 2, y: cy - 30 };
    // tezgâhtaki yiyecekler (dokunulabilir); sağda çöp kutusu ve bulaşık (B12)
    const gap = (pw - 80) / 6;
    FOODS.forEach((f, i) => {
      const x = px + 40 + gap * (i + 1);
      this.stockPos[f] = { x, y: cy - 34 };
      const z = s.add.zone(x, cy + 12, gap * 0.9, 76).setInteractive({ useHandCursor: true });
      const ic = uiIcon(s, x, cy + 10, ICON[f], 40);
      txt(s, x, cy + 34, FOOD_NAME[f], { size: 14, bold: true, color: '#f3dc95' }).setOrigin(0.5, 0);
      z.on('pointerdown', () => this.goTo(x, cy - 34, () => this.pick(f)));
      void ic;
    });
    // çöp kutusu: elindeki yiyecekleri atar (tabaklar bulaşığa)
    const kx = px + 40 + gap * 4.1;
    this.trash = { x: kx, y: cy - 34 };
    fl.fillStyle(0x3a3f44, 1);
    fl.fillRoundedRect(kx - 20, cy - 8, 40, 38, 5);
    fl.fillStyle(0x596068, 1);
    fl.fillRoundedRect(kx - 24, cy - 14, 48, 9, 3);
    fl.lineStyle(2, 0x2a2e33, 1);
    for (const ox of [-9, 0, 9]) fl.lineBetween(kx + ox, cy - 2, kx + ox, cy + 24);
    txt(s, kx, cy + 34, 'Çöp', { size: 14, bold: true, color: '#d6d9dc' }).setOrigin(0.5, 0);
    s.add.zone(kx, cy + 12, gap * 0.9, 76).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.goTo(kx, cy - 34, () => this.discard()));
    // bulaşık (sağ)
    const sx = px + 40 + gap * 5.15;
    this.sink = { x: sx, y: cy - 34 };
    fl.fillStyle(0x4a5a66, 1);
    fl.fillRoundedRect(sx - 40, cy - 6, 80, 34, 8);
    fl.fillStyle(0x7fa8c0, 0.6);
    fl.fillRoundedRect(sx - 32, cy, 64, 20, 6);
    txt(s, sx, cy + 34, 'Bulaşık', { size: 14, bold: true, color: '#cfe2ff' }).setOrigin(0.5, 0);
    s.add.zone(sx, cy + 12, gap * 0.9, 76).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.goTo(sx, cy - 34, () => this.dropPlates()));
    // masalar
    const n = this.cfg.tables;
    const cols = n <= 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const areaTop = top + 40, areaBot = cy - 70;
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const rowCount = r === rows - 1 ? n - r * cols : cols;
      const tx = px + pw / 2 + (c - (rowCount - 1) / 2) * Math.min(250, (pw - 140) / cols);
      const ty = areaTop + (rows === 1 ? (areaBot - areaTop) / 2 : (r * (areaBot - areaTop)) / (rows - 1));
      const g = s.add.graphics();
      const t: Table = { x: tx, y: ty, state: 'empty', order: null, patience: 0, maxPatience: 1, eatT: 0, g, patron: null, bubble: null, plate: null, plateT: 0, plateRing: null };
      this.drawTable(t);
      const z = s.add.zone(tx, ty - 10, 150, 110).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.goTo(tx, ty + 34, () => this.serveTable(t)));
      this.tables.push(t);
    }
    // müşteri sprite'ları: hanın müdavimleri
    this.patrons = NPCS.filter((d) => ['commoner', 'rootless', 'burgher'].includes(d.caste) && s.textures.exists(d.sheet) && !['vera', 'lina', 'joseph'].includes(d.id)).map((d) => d.sheet);
    if (!this.patrons.length) this.patrons = NPCS.filter((d) => s.textures.exists(d.sheet)).map((d) => d.sheet);
    // Joseph
    this.joeShadow = s.add.ellipse(0, 0, 40, 12, 0x000000, 0.35);
    this.joe = s.add.container(this.counter.x, this.counter.y);
    this.joeLayers = joeKeys.filter((k) => s.textures.exists(k)).map((k) => s.add.sprite(0, 0, k, 0).setOrigin(0.5, 61 / 64));
    this.joe.add(this.joeLayers);
    this.joe.setScale(1.5);
    this.setJoeFrame(2, 0);
    this.hud = txt(s, px + pw / 2, py + 96, '', { size: 16, bold: true, color: COLORS.text }).setOrigin(0.5, 0);
    this.trayRings = s.add.graphics().setDepth(5);
    this.spawnT = this.cfg.firstDelay;
  }

  /** Çöp kutusu (B12): yiyecekleri at; tabaklar elde kalır. */
  discard() {
    const r = discardFood(this.carry);
    if (r.plateWarning) {
      this.pop(this.trash.x, this.trash.y - 60, 'Tabaklar bulaşığa!', '#ffb0a0');
      Sound.sfx('error', 0.4);
      return;
    }
    if (!r.discarded) return;
    this.carry = r.carry;
    Sound.sfx('click', 0.5);
    this.pop(this.trash.x, this.trash.y - 60, r.discarded > 1 ? `${r.discarded} yiyecek atıldı` : 'Atıldı', '#d6d9dc');
    this.refreshTray();
  }

  setJoeFrame(dirRow: number, col: number) {
    for (const l of this.joeLayers) l.setFrame((8 + dirRow) * 13 + col);
  }

  drawTable(t: Table) {
    const g = t.g;
    g.clear();
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(t.x, t.y + 22, 120, 26);
    g.fillStyle(0x7a4e2a, 1);
    g.fillRoundedRect(t.x - 56, t.y - 4, 112, 34, 8);
    g.fillStyle(0x9a6a3a, 1);
    g.fillRoundedRect(t.x - 56, t.y - 4, 112, 12, 6);
    // tabure
    g.fillStyle(0x5a3a1e, 1);
    g.fillCircle(t.x - 70, t.y + 18, 9);
    g.fillCircle(t.x + 70, t.y + 18, 9);
  }

  goTo(x: number, y: number, act: () => void) {
    if (!this.s.running) return;
    this.target = { x, y, act };
  }

  pick(f: Food) {
    if (this.carry.length >= this.cfg.tray) {
      this.pop(this.joe.x, this.joe.y - 90, 'Elin dolu!', '#ffb0a0');
      Sound.sfx('error', 0.4);
      return;
    }
    if (this.carry.includes('plate')) {
      this.pop(this.joe.x, this.joe.y - 90, 'Önce tabakları bırak!', '#ffb0a0');
      Sound.sfx('error', 0.4);
      return;
    }
    this.carry.push(f);
    Sound.sfx('click', 0.6);
    this.refreshTray();
  }

  dropPlates() {
    const n = this.carry.filter((c) => c === 'plate').length;
    if (!n) return;
    this.carry = this.carry.filter((c) => c !== 'plate');
    this.carryPlates = [];
    this.platesCleared += n;
    Sound.sfx('click', 0.6);
    this.pop(this.sink.x, this.sink.y - 60, `+${n} tabak`, '#cfe2ff');
    this.refreshTray();
  }

  serveTable(t: Table) {
    if (t.state === 'waiting' && t.order) {
      const i = this.carry.indexOf(t.order);
      if (i < 0) {
        this.pop(t.x, t.y - 90, `${FOOD_NAME[t.order]} istiyor!`, '#ffe48a');
        Sound.sfx('error', 0.3);
        return;
      }
      this.carry.splice(i, 1);
      this.refreshTray();
      t.state = 'eating';
      t.eatT = 3.5 + Math.random() * 2;
      t.order = null;
      t.bubble?.destroy();
      t.bubble = null;
      this.served++;
      Sound.sfx('coin', 0.5);
      this.popIcon(t.x, t.y - 70, 's_happy');
      return;
    }
    if (t.state === 'dirty') {
      if (this.carry.length >= this.cfg.tray || this.carry.some((c) => c !== 'plate')) {
        this.pop(t.x, t.y - 90, 'Elin dolu!', '#ffb0a0');
        Sound.sfx('error', 0.3);
        return;
      }
      this.carry.push('plate');
      this.carryPlates.push(t.plateT);
      t.plate?.destroy();
      t.plate = null;
      t.plateRing?.destroy();
      t.plateRing = null;
      t.state = 'empty';
      Sound.sfx('click', 0.5);
      this.refreshTray();
    }
  }

  refreshTray() {
    for (const i of this.trayIcons) i.destroy();
    this.trayIcons = this.carry.map((c, i) => uiIcon(this.s, 0, 0, ICON[c], 30).setDepth(4).setData('i', i));
  }

  pop(x: number, y: number, text: string, color: string) {
    const t = txt(this.s, x, y, text, { size: 16, bold: true, color, stroke: true }).setOrigin(0.5).setDepth(6);
    this.s.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  popIcon(x: number, y: number, key: string) {
    const im = uiIcon(this.s, x, y, key, 34).setDepth(6);
    this.s.tweens.add({ targets: im, y: y - 30, alpha: 0, duration: 1000, onComplete: () => im.destroy() });
  }

  seat(t: Table) {
    t.state = 'waiting';
    t.order = FOODS[Math.floor(Math.random() * FOODS.length)];
    t.maxPatience = t.patience = this.cfg.patience * (0.85 + Math.random() * 0.3) * (this.firstSeat ? this.cfg.firstPatienceMult : 1);
    this.firstSeat = false;
    const key = this.patrons[Math.floor(Math.random() * this.patrons.length)];
    t.patron?.destroy();
    t.patron = this.s.add.sprite(t.x + (Math.random() < 0.5 ? -70 : 70), t.y + 22, key, (8 + 2) * 13).setOrigin(0.5, 61 / 64).setScale(1.3);
    const b = this.s.add.container(t.x, t.y - 62).setDepth(3);
    const bg = this.s.add.graphics();
    bg.fillStyle(0xfff6e0, 0.95);
    bg.fillRoundedRect(-30, -30, 60, 52, 12);
    bg.fillTriangle(-8, 22, 8, 22, 0, 32);
    b.add(bg);
    b.add(uiIcon(this.s, 0, -4, ICON[t.order], 36));
    const ring = this.s.add.graphics();
    b.add(ring);
    b.setData('ring', ring);
    b.setScale(0.3);
    this.s.tweens.add({ targets: b, scale: 1, duration: 220, ease: 'Back.Out' });
    t.bubble = b;
    Sound.sfx('bell', 0.25);
  }

  leave(t: Table, angry: boolean) {
    t.bubble?.destroy();
    t.bubble = null;
    if (angry) {
      this.failed++;
      this.popIcon(t.x, t.y - 70, 's_angry');
      Sound.sfx('error', 0.5);
      t.state = 'empty';
    } else {
      t.state = 'dirty';
      this.platesMade++;
      t.plate = uiIcon(this.s, t.x, t.y + 4, 's_plate', 34).setDepth(2);
      t.plateT = this.cfg.plateTime;
      t.plateRing = this.s.add.graphics().setDepth(2.1);
    }
    t.order = null;
    const p = t.patron;
    t.patron = null;
    if (p) this.s.tweens.add({ targets: p, alpha: 0, y: p.y + 10, duration: 400, onComplete: () => p.destroy() });
  }

  update(dt: number) {
    const s = this.s;
    // Joseph yürür
    if (this.target && s.running) {
      const dx = this.target.x - this.joe.x, dy = this.target.y - this.joe.y;
      const d = Math.hypot(dx, dy);
      const step = this.cfg.speed * dt;
      if (d <= step) {
        this.joe.setPosition(this.target.x, this.target.y);
        const act = this.target.act;
        this.target = null;
        act();
        this.setJoeFrame(2, 0);
      } else {
        this.joe.x += (dx / d) * step;
        this.joe.y += (dy / d) * step;
        this.walkT += dt * 14;
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 3) : dy < 0 ? 0 : 2;
        this.setJoeFrame(dir, 1 + (Math.floor(this.walkT) % 8));
      }
    }
    this.joe.setDepth(this.joe.y > this.counter.y - 40 ? 2.5 : 2.5);
    this.joeShadow.setPosition(this.joe.x, this.joe.y);
    this.trayIcons.forEach((im, i) => im.setPosition(this.joe.x - 16 + i * 32, this.joe.y - 112));
    if (!s.running) return;
    this.t += dt;
    // müşteriler
    this.spawnT -= dt;
    const waiting = this.tables.filter((t) => t.state === 'waiting').length;
    if (this.spawnT <= 0) {
      this.spawnT = this.cfg.spawnEvery * (0.75 + Math.random() * 0.5);
      const free = this.tables.filter((t) => t.state === 'empty');
      if (free.length && waiting < this.cfg.maxWaiting) this.seat(free[Math.floor(Math.random() * free.length)]);
    }
    for (const t of this.tables) {
      if (t.state === 'waiting') {
        t.patience -= dt;
        const ring = t.bubble?.getData('ring') as Phaser.GameObjects.Graphics | undefined;
        if (ring) {
          const f = Math.max(0, t.patience / t.maxPatience);
          ring.clear();
          ring.lineStyle(5, f > 0.5 ? 0x5cd16a : f > 0.25 ? 0xf0c040 : 0xe04030, 1);
          ring.beginPath();
          ring.arc(0, -4, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
          ring.strokePath();
        }
        // 0.8.0: sipariş zamanında verilmezse oyun kaybedilir
        if (t.patience <= 0 && !this.lost) {
          this.lost = 'order';
          this.popIcon(t.x, t.y - 70, 's_angry');
          Sound.sfx('error', 0.6);
        }
      } else if (t.state === 'eating') {
        t.eatT -= dt;
        if (t.patron) t.patron.setFrame((8 + 2) * 13 + (Math.floor(t.eatT * 3) % 2 ? 0 : 1));
        if (t.eatT <= 0) this.leave(t, false);
      } else if (t.state === 'dirty' && t.plateRing) {
        t.plateT -= dt;
        this.ring(t.plateRing, t.x, t.y + 4, 22, t.plateT / this.cfg.plateTime);
        if (t.plateT <= 0 && !this.lost) {
          this.lost = 'plate';
          Sound.sfx('error', 0.6);
        }
      }
    }
    // eldeki kirli tabaklar: süreleri bulaşığa konana kadar işler
    this.trayRings?.clear();
    let pi = 0;
    this.carry.forEach((c, i) => {
      if (c !== 'plate') return;
      const k = pi++;
      this.carryPlates[k] -= dt;
      const im = this.trayIcons[i];
      if (im && this.trayRings) this.ring(this.trayRings, im.x, im.y, 19, this.carryPlates[k] / this.cfg.plateTime, false);
      if (this.carryPlates[k] <= 0 && !this.lost) {
        this.lost = 'plate';
        Sound.sfx('error', 0.6);
      }
    });
    this.hud.setText(`Hedef: ${this.platesCleared}/${this.cfg.goal} müşteri   ·   Servis: ${this.served}   ·   Bulaşıkta: ${this.platesCleared}`);
  }

  /** Süre halkası (yeşil → sarı → kırmızı). */
  ring(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, f: number, clear = true) {
    if (clear) g.clear();
    f = Math.max(0, Math.min(1, f));
    g.lineStyle(4, f > 0.5 ? 0x5cd16a : f > 0.25 ? 0xf0c040 : 0xe04030, 1);
    g.beginPath();
    g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
    g.strokePath();
  }

  /** Kazanıldı / kaybedildi (anında) ya da sürüyor (null). */
  result() {
    return serveOutcome({ completed: this.platesCleared, goal: this.cfg.goal, orderExpired: this.lost === 'order', plateExpired: this.lost === 'plate', t: this.t, limit: this.cfg.limit });
  }

  /** Hedef servis sayısı (hacim puanı için). */
  target_() {
    return Math.round((this.cfg.dur / this.cfg.spawnEvery) * 0.8);
  }

  perf() {
    // 0.8.0: kazanınca hıza göre (yalnızca Bertram'ın yorumu)
    return servePerfTime(this.t, this.cfg.goal, this.cfg.spawnEvery);
  }
}
