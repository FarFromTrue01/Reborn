// Mini oyunlar (20–40 saniye): odun kesme, taş kaldırma, koşu parkuru (antrenman), hasat (Haldor'un tarlası)
// ve Servis Koşturmacası (Bertram'ın hanı, serveGame.ts).
import Phaser from 'phaser';
import { Display } from '../game/display';
import { Sound } from '../audio/audio';
import { COLORS, FONT, txt, drawFrame, Button, fullScreenRect } from '../ui/kit';
import { G } from '../game/G';
import { ServeGame, serveDifficulty } from './serveGame';
import { SERVE_LOSS_TEXT } from '../core/serve';
import { LIFT_ZONE_FRAC, MINIGAME_GOAL, MISS_PENALTY_SEC, RUN_MAX_STEP, RUN_MIN_STEP, accuracy, minigameWon, runStepDelta, swingAccepted } from '../core/minigameRules';

type Kind = 'chop' | 'lift' | 'run' | 'harvest' | 'serve';

export class MinigameScene extends Phaser.Scene {
  kind: Kind = 'chop';
  done!: (perf: number, won?: boolean) => void;
  /** C11: antrenmanda kaybedince "Bırak" da var (EXP yok); hasatta yalnızca "Tekrar dene". */
  allowQuit = false;
  /** C11: son basış (savuruş kilidi 0,4 sn). */
  lastPressAt = -9;
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
  sheaves: Phaser.GameObjects.Image[] = [];
  serve: ServeGame | null = null;
  serveDay = 1;

  constructor() {
    super('Minigame');
  }

  init(data: { kind: Kind; done: (p: number, won?: boolean) => void; day?: number; allowQuit?: boolean }) {
    this.resetState();
    this.serveDay = data.day ?? 1;
    this.kind = data.kind;
    this.done = data.done;
    this.allowQuit = !!data.allowQuit;
    this.dur = data.kind === 'chop' ? 24 : data.kind === 'lift' ? 25 : data.kind === 'harvest' ? 22 : data.kind === 'serve' ? serveDifficulty(this.serveDay).limit : 30;
  }

  /** Her mini oyun aynı sahne nesnesini kullanır: önceki oyunun sayaçları ve nesneleri burada sıfırlanır. */
  private resetState() {
    this.kind = 'chop';
    this.t = 0;
    this.dur = 25;
    this.running = false;
    this.marker = 0;
    this.markerDir = 1;
    this.zoneC = 0.5;
    this.zoneW = 0.16;
    this.logs = this.hits = this.attempts = 0;
    this.holding = false;
    this.needle = 0;
    this.vel = 0;
    this.target = 0.5;
    this.inZone = 0;
    this.lastSide = null;
    this.dist = this.speed = this.goodSteps = this.steps = 0;
    this.lastStepT = 0;
    this.joeLayers = [];
    this.prop = undefined;
    this.swingT = -1;
    this.runAnimT = 0;
    this.sheaves = [];
    this.serve = null;
    this.serveDay = 1;
    this.loseScreen = null;
    this.allowQuit = false;
    this.lastPressAt = -9;
  }

  create() {
    // 0.8.0: mini oyun müziği; bitince (sahne kapanınca) dünya müziği kaldığı yerden döner
    Sound.pushMusic('minigame');
    this.events.once('shutdown', () => Sound.popMusic());
    this.cameras.main.setZoom(Display.uiZoom);
    this.cameras.main.setOrigin(0, 0);
    const W = Display.uiW, H = Display.uiH;
    fullScreenRect(this, 0x000000, 0.7).setInteractive();
    const serve = this.kind === 'serve';
    const pw = Math.min(serve ? 980 : 900, W - 40), ph = serve ? Math.min(680, H - 30) : 520;
    const px = (W - pw) / 2, py = (H - ph) / 2;
    const fg = this.add.graphics();
    drawFrame(fg, px, py, pw, ph);
    const titles = { chop: 'Odun Kesme Kütüğü', lift: 'Taş Kaldırma', run: 'Koşu Parkuru', harvest: 'Hasat: Haldor\'un Buğdayı', serve: `Servis Koşturmacası · Gün ${this.serveDay}` };
    const helps = {
      serve: 'Tezgâhtan bira, güveç ya da ekmek al; süre bitmeden masaya götür. Kirli tabakları topla, bulaşığa bırak.',
      harvest: `Orak işareti yeşil alandan geçerken biç! ${MINIGAME_GOAL.harvest.sec} sn'de ${MINIGAME_GOAL.harvest.count} demet. Iska süreden 1 sn yer.`,
      chop: `İbre yeşil alandan geçerken vur! ${MINIGAME_GOAL.chop.sec} sn'de ${MINIGAME_GOAL.chop.count} kütük. Iska süreden 1 sn yer.`,
      lift: `Basılı tut: taş kalkar. Bırak: iner. İbreyi altın bölgede tut (sürenin en az %${Math.round(LIFT_ZONE_FRAC * 100)}'ı).`,
      run: 'Sol ve Sağ butonlarına sırayla, düzenli bas. Çok hızlı basmak yavaşlatır! Süre bitmeden parkuru bitir.',
    };
    txt(this, W / 2, py + 26, titles[this.kind], { size: 26, font: FONT.title, color: COLORS.textGold }).setOrigin(0.5, 0);
    this.info = txt(this, W / 2, py + 70, helps[this.kind], { size: 17, color: COLORS.textDim, align: 'center', wrap: pw - 60 }).setOrigin(0.5, 0);
    this.timeT = txt(this, px + pw - 30, py + 30, '', { size: 18, color: COLORS.text, bold: true }).setOrigin(1, 0);
    this.stage = this.add.graphics();
    this.g = this.add.graphics();
    const by = py + ph - 70;
    if (serve) {
      this.info.setY(py + 64).setFontSize(15);
      const world = this.scene.get('World') as any;
      const keys: string[] = world?.player?.actor?.portraitKeys() ?? ['j_body', 'j_head'];
      this.serve = new ServeGame(this, px, py, pw, ph, this.serveDay, keys);
    } else this.buildStage();
    if (serve) {
      // dokunmalar masalara ve tezgâha
    } else if (this.kind === 'run') {
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
      const b = new Button(this, W / 2, by, this.kind === 'chop' ? 'VUR!' : this.kind === 'harvest' ? 'BİÇ!' : 'KALDIR (basılı tut)', () => {}, { w: 360, h: 84, size: 24, sound: null });
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
    const keys: string[] = world?.player?.actor?.portraitKeys() ?? ['j_body', 'j_head'];
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
    } else if (this.kind === 'harvest') {
      this.joe.setPosition(W / 2 - 120, feetY);
      shadow.setPosition(W / 2 - 120, feetY);
      if (this.textures.get('props').has('wheat'))
        for (let i = 0; i < 5; i++) this.sheaves.push(this.add.image(W / 2 - 30 + i * 70, feetY + 8, 'props', 'wheat').setOrigin(0.5, 1).setScale(0.42, 0.6));
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
    if (this.kind === 'chop' || this.kind === 'harvest') {
      if (!down) return;
      // C11: savuruş sürerken (0,4 sn) yeni basış yok sayılır — tuşa basıp durmak işe yaramaz
      const now = this.time.now / 1000;
      if (!swingAccepted(this.lastPressAt, now)) return;
      this.lastPressAt = now;
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
        this.time.delayedCall(170, () => {
          if (this.prop) this.chips(this.prop.x, this.prop.y - 40);
          if (this.kind === 'harvest' && this.sheaves.length) {
            const sh = this.sheaves[this.logs % this.sheaves.length];
            this.chips(sh.x, sh.y - 30);
            this.tweens.add({ targets: sh, scaleY: 0.2, alpha: 0.3, duration: 160, yoyo: true, hold: 600 });
          }
        });
        if (this.logs >= MINIGAME_GOAL[this.kind].count) this.time.delayedCall(250, () => this.finish());
      } else {
        // C11: ıska — kırmızı parlama ve süreden 1 sn
        Sound.sfx('miss');
        this.flash(0xff5040, 0.3);
        this.t = Math.min(this.dur, this.t + MISS_PENALTY_SEC);
        const W = Display.uiW;
        const pen = txt(this, W / 2 + 300, Display.uiH / 2 - 140, `−${MISS_PENALTY_SEC} sn`, { size: 22, bold: true, color: COLORS.textRed, stroke: true }).setOrigin(0.5).setDepth(10);
        this.tweens.add({ targets: pen, y: pen.y - 30, alpha: 0, duration: 700, onComplete: () => pen.destroy() });
      }
    } else if (this.kind === 'lift') this.holding = down;
  }

  step(side: 'L' | 'R') {
    if (!this.running) return;
    const now = this.time.now / 1000;
    this.steps++;
    // C11: ritimsiz (çok hızlı) basış hızı artırmaz, düşürür
    const interval = now - this.lastStepT;
    const delta = runStepDelta(side === this.lastSide, interval);
    if (side !== this.lastSide && interval >= RUN_MIN_STEP && interval <= RUN_MAX_STEP) this.goodSteps++;
    this.speed = Phaser.Math.Clamp(this.speed + delta, 0, 1);
    Sound.sfx(delta > 0 ? 'step' : 'error', delta > 0 ? 0.8 : 0.3);
    this.lastSide = side;
    this.lastStepT = now;
  }

  flash(color: number, alpha = 0.15) {
    const r = fullScreenRect(this, color, alpha);
    this.tweens.add({ targets: r, alpha: 0, duration: 250, onComplete: () => r.destroy() });
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    const W = Display.uiW, H = Display.uiH;
    const g = this.g;
    g.clear();
    const bx = W / 2 - 330, bw = 660, by = this.kind === 'chop' || this.kind === 'harvest' ? H / 2 - 95 : H / 2 - 40;
    if (this.serve) {
      // 0.8.0: süre yerine günün hedefi; kazanma/kaybetme anında
      if (this.running) this.t += dt;
      this.serve.update(dt);
      this.timeT.setText(`Hedef ${this.serve.platesCleared}/${this.serve.cfg.goal}`);
      const r = this.running ? this.serve.result() : null;
      if (r) this.finishServe(r.win, r.loss);
      return;
    }
    if (this.running) {
      this.t += dt;
      if (this.t >= this.dur) this.finish();
    }
    this.timeT.setText(`${Math.max(0, Math.ceil(this.dur - this.t))} sn`);
    if (this.kind === 'chop' || this.kind === 'harvest') {
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
      this.info.setText(this.kind === 'harvest' ? `Demet: ${this.logs} / ${MINIGAME_GOAL.harvest.count}` : `Kütük: ${this.logs} / ${MINIGAME_GOAL.chop.count}`);
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
      this.info.setText(`Bölgede: ${this.inZone.toFixed(1)} / ${(this.dur * LIFT_ZONE_FRAC).toFixed(0)} sn`);
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

  /** Servis: kazandın (ücret ve hikâye sürer) ya da kaybettin (tekrar dene; ücret yalnızca kazanınca). */
  finishServe(win: boolean, loss: keyof typeof SERVE_LOSS_TEXT | null) {
    if (!this.running || !this.serve) return;
    this.running = false;
    const W = Display.uiW, H = Display.uiH;
    if (win) {
      const perf = Phaser.Math.Clamp(this.serve.perf(), 0, 1);
      Sound.sfx('levelup', 0.6);
      const t = txt(this, W / 2, H / 2 - 10, 'Kazandın!', { size: 40, font: FONT.title, color: COLORS.textGold, stroke: true }).setOrigin(0.5).setDepth(20);
      const t2 = txt(this, W / 2, H / 2 + 40, `${this.serve.cfg.goal} müşteri doydu, tabaklar bulaşıkta.`, { size: 20, color: COLORS.text, stroke: true }).setOrigin(0.5).setDepth(20);
      t.setScale(0.5);
      this.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.Out' });
      void t2;
      this.time.delayedCall(1900, () => {
        this.scene.stop();
        this.done(perf);
      });
      return;
    }
    Sound.sfx('error', 0.7);
    const pw = 520, ph = 250;
    const px = (W - pw) / 2, py = (H - ph) / 2;
    const c = this.add.container(0, 0).setDepth(30);
    const dim = fullScreenRect(this, 0x000000, 0.55).setInteractive();
    const fg = this.add.graphics();
    drawFrame(fg, px, py, pw, ph);
    c.add([dim, fg]);
    c.add(txt(this, W / 2, py + 28, 'Kaybettin', { size: 36, font: FONT.title, color: COLORS.textRed }).setOrigin(0.5, 0));
    c.add(txt(this, W / 2, py + 90, SERVE_LOSS_TEXT[loss ?? 'time'], { size: 18, color: COLORS.text, align: 'center', wrap: pw - 60 }).setOrigin(0.5, 0));
    c.add(txt(this, W / 2, py + 124, 'Ücret yalnızca servis başarıyla bitince.', { size: 15, color: COLORS.textDim, align: 'center' }).setOrigin(0.5, 0));
    const day = this.serveDay, done = this.done;
    const b = new Button(this, W / 2, py + ph - 48, 'Tekrar dene', () => this.scene.restart({ kind: 'serve', day, done }), { w: 240, h: 60, size: 22 });
    b.setDepth(31);
    this.loseScreen = c;
  }

  /** Kaybettin ekranı (QA ve testler için). */
  loseScreen: Phaser.GameObjects.Container | null = null;

  finish() {
    if (!this.running) return;
    this.running = false;
    let perf = 0;
    if (this.serve) perf = this.serve.perf();
    else if (this.kind === 'chop' || this.kind === 'harvest') perf = Math.min(1, this.hits / 12) * (0.4 + 0.6 * accuracy(this.logs, this.attempts));
    else if (this.kind === 'lift') perf = Math.min(1, this.inZone / (this.dur * 0.85));
    else perf = Math.min(1, this.dist) * 0.6 + (this.steps ? (this.goodSteps / this.steps) * 0.4 : 0);
    perf = Phaser.Math.Clamp(perf, 0, 1);
    const won = minigameWon(this.kind, { count: this.logs, inZone: this.inZone, dur: this.dur, dist: this.dist });
    const W = Display.uiW, H = Display.uiH;
    if (!won) {
      this.showLose();
      return;
    }
    Sound.sfx(perf > 0.6 ? 'levelup' : 'skillup', 0.6);
    const t = txt(this, W / 2, H / 2 + 100, `Başardın! Performans: %${Math.round(perf * 100)}`, { size: 30, font: FONT.title, color: COLORS.textGold, stroke: true }).setOrigin(0.5);
    t.setScale(0.5);
    this.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.Out' });
    this.time.delayedCall(1700, () => {
      this.scene.stop();
      this.done(perf, true);
    });
  }

  /** C11: hedefe ulaşılamadı — "Kaybettin", "Tekrar dene" (antrenmanda ayrıca "Bırak": EXP yok, seans sayılmaz). */
  private showLose() {
    Sound.sfx('error', 0.7);
    const W = Display.uiW, H = Display.uiH;
    const pw = 540, ph = 260;
    const px = (W - pw) / 2, py = (H - ph) / 2;
    const c = this.add.container(0, 0).setDepth(30);
    const dim = fullScreenRect(this, 0x000000, 0.55).setInteractive();
    const fg = this.add.graphics();
    drawFrame(fg, px, py, pw, ph);
    c.add([dim, fg]);
    c.add(txt(this, W / 2, py + 26, 'Kaybettin', { size: 36, font: FONT.title, color: COLORS.textRed }).setOrigin(0.5, 0));
    const why = this.kind === 'harvest' ? `Süre bitti: ${this.logs} / ${MINIGAME_GOAL.harvest.count} demet.`
      : this.kind === 'chop' ? `Süre bitti: ${this.logs} / ${MINIGAME_GOAL.chop.count} kütük.`
      : this.kind === 'lift' ? `Taş bölgede ${this.inZone.toFixed(1)} sn kaldı; en az ${(this.dur * LIFT_ZONE_FRAC).toFixed(0)} sn gerekir.`
      : `Süre bitti: parkurun %${Math.round(Math.min(1, this.dist) * 100)}'i.`;
    c.add(txt(this, W / 2, py + 88, why, { size: 18, color: COLORS.text, align: 'center', wrap: pw - 60 }).setOrigin(0.5, 0));
    c.add(txt(this, W / 2, py + 122, this.kind === 'harvest' ? 'Haldor ücreti ancak iş bitince öder.' : 'Antrenman yalnızca başarıda sayılır.', { size: 15, color: COLORS.textDim, align: 'center' }).setOrigin(0.5, 0));
    const kind = this.kind, done = this.done, allowQuit = this.allowQuit, day = this.serveDay;
    const retry = new Button(this, allowQuit ? W / 2 - 130 : W / 2, py + ph - 50, 'Tekrar dene', () => this.scene.restart({ kind, day, done, allowQuit }), { w: 230, h: 60, size: 22 });
    retry.setName('mg_retry');
    c.add(retry);
    if (allowQuit) {
      const quit = new Button(this, W / 2 + 130, py + ph - 50, 'Bırak', () => {
        this.scene.stop();
        done(0, false);
      }, { w: 200, h: 60, size: 22, style: 'ghost' });
      quit.setName('mg_quit');
      c.add(quit);
    }
    this.loseScreen = c;
  }
}
