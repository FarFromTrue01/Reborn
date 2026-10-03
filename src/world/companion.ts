// Yoldaş sistemi (C4): Joseph'i kapılardan ve haritalardan geçerek izler, yolunu kesmez,
// uzak kalınca ya da takılınca yanına ışınlanır. Savaşta kendi başına dövüşür: yakın dövüşçü
// hedefe yanaşıp yandan sarar, okçu mesafe koruyup geri çekilerek atar. Dost ateşi yoktur.
// Yere düşen yoldaş ölmez; savaş bitince toparlanır.
import Phaser from 'phaser';
import { Actor, dirFromVec } from './actor';
import { TILE } from './types';
import { derive, type Derived } from '../core/creature';
import type { CreatureData } from '../core/types';
import { COMPANIONS, type CompanionDef } from '../data/companions';
import { NPC_BY_ID, type NpcDef } from '../data/npcs';
import { findPath, nearestFree } from './path';
import { BASE_SPEED } from './player';
import type { WorldScene } from '../scenes/WorldScene';
import type { Enemy } from './enemy';

type CState = 'follow' | 'engage' | 'windup' | 'strike' | 'recover' | 'down' | 'scripted';

export class Companion {
  id: string;
  def: NpcDef;
  cdef: CompanionDef;
  c: CreatureData;
  d: Derived;
  actor: Actor;
  hp: number;
  state: CState = 'follow';
  stateT = 0;
  cooldownT = 0.6;
  target: Enemy | null = null;
  path: [number, number][] = [];
  repathT = 0;
  stuckT = 0;
  lastPos = { x: 0, y: 0 };
  progressT = 0;
  bar: Phaser.GameObjects.Graphics;
  bubble: Phaser.GameObjects.Text | null = null;
  bubbleT = 0;
  banterT = 25 + Math.random() * 25;
  calmT = 0;
  invulnT = 0;
  /** Senaryo hızı çarpanı (ör. yaralı yürüyüş). */
  speedMult = 1;
  /** Savaşa katılır mı (yaralı eşlik sırasında hayır). */
  fights = true;
  saidNoExp = false;

  constructor(public w: WorldScene, id: string, x: number, y: number, hp?: number) {
    this.id = id;
    this.def = NPC_BY_ID[id];
    this.cdef = COMPANIONS[id];
    this.c = this.def.creature;
    this.d = derive(this.c);
    // haritalar arası geçişte yerdeki yoldaş toparlanmış olarak gelir
    this.hp = hp === undefined ? this.d.maxHp : Math.max(Math.round(this.d.maxHp * 0.35), Math.min(this.d.maxHp, hp));
    this.actor = new Actor(w, x, y, [this.def.sheet], 'lpc');
    this.actor.enablePhysics(8);
    this.actor.setDepth(y);
    this.actor.play('idle');
    this.bar = w.add.graphics().setDepth(960000);
    this.lastPos = { x, y };
  }

  get x() { return this.actor.x; }
  get y() { return this.actor.y; }
  get name() { return this.def.name; }
  get maxHp() { return this.d.maxHp; }
  get down() { return this.state === 'down'; }
  get level() { return this.c.level; }

  swung = false;

  setState(s: CState) {
    this.state = s;
    this.stateT = 0;
    this.swung = false;
  }

  destroy() {
    this.actor.destroy();
    this.bar.destroy();
    this.bubble?.destroy();
  }

  say(text: string, dur = 2.6) {
    this.bubble?.destroy();
    const t = this.w.add.text(this.x, this.y - 60, text, {
      fontFamily: 'AlegreyaSans, sans-serif', fontSize: '12px', color: '#fff6e0', stroke: '#1a0e06', strokeThickness: 3,
      fontStyle: 'bold', wordWrap: { width: 190, useAdvancedWrap: true }, align: 'center',
    }).setOrigin(0.5, 1).setDepth(970000);
    t.setResolution(this.w.cameras.main.zoom * 1.5);
    this.bubble = t;
    this.bubbleT = dur;
  }

  pick(lines: string[]) {
    return lines[Math.floor(Math.random() * lines.length)];
  }

  /** Joseph'in yanında, biraz arkasında durulacak nokta. */
  followPoint(): { x: number; y: number } {
    const pa = this.w.player.actor;
    const v = this.w.player.actor.body2?.velocity;
    let fx = 0, fy = 1;
    if (v && Math.hypot(v.x, v.y) > 10) {
      const l = Math.hypot(v.x, v.y);
      fx = v.x / l;
      fy = v.y / l;
    } else {
      const d = pa.dir;
      fx = d === 'left' ? -1 : d === 'right' ? 1 : 0;
      fy = d === 'up' ? -1 : d === 'down' ? 1 : 0;
    }
    // arkada ve yanda: −yön × 1.4 kare + dik × 1 kare
    const side = this.cdef.side;
    return { x: pa.x - fx * 1.4 * TILE + -fy * side * 1.0 * TILE, y: pa.y - fy * 1.4 * TILE + fx * side * 1.0 * TILE };
  }

  /** Joseph'in yakınında yürünebilir bir yere ışınlan. */
  teleportNear() {
    const m = this.w.mapData;
    const fp = this.followPoint();
    const [tx, ty] = nearestFree(m.solid, m.w, m.h, Math.floor(fp.x / TILE), Math.floor(fp.y / TILE));
    const b = this.actor.body2;
    this.actor.setPosition(tx * TILE + 16, ty * TILE + 22);
    b.reset(this.actor.x, this.actor.y);
    this.path = [];
    this.stuckT = 0;
    this.progressT = 0;
    this.lastPos = { x: this.x, y: this.y };
    this.w.fx.dust(this.x, this.y, 4);
  }

  moveToward(tx: number, ty: number, speed: number, run: boolean) {
    const b = this.actor.body2;
    // takılınca A* ile yol bul ve noktaları izle
    let gx = tx, gy = ty;
    if (this.path.length) {
      const [px, py] = this.path[0];
      gx = px * TILE + 16;
      gy = py * TILE + 22;
      if (Math.hypot(gx - this.x, gy - this.y) < 10) this.path.shift();
    }
    const dx = gx - this.x, dy = gy - this.y;
    const d = Math.hypot(dx, dy) || 1;
    b.setVelocity((dx / d) * speed, (dy / d) * speed);
    this.actor.face(dirFromVec(dx, dy));
    this.actor.play(run ? 'run' : 'walk');
    this.actor.animSpeed = Math.max(0.6, speed / (BASE_SPEED * TILE * 0.5) * 0.9) * (run ? 0.75 : 1);
    if (b.blocked.left || b.blocked.right || b.blocked.up || b.blocked.down) this.stuckT += 1 / 60;
    else this.stuckT = Math.max(0, this.stuckT - 1 / 60);
    if (this.stuckT > 0.4 && !this.path.length && this.repathT <= 0) {
      this.repathT = 1;
      const m = this.w.mapData;
      const [sx, sy] = nearestFree(m.solid, m.w, m.h, Math.floor(this.x / TILE), Math.floor((this.y - 6) / TILE));
      const [ex, ey] = nearestFree(m.solid, m.w, m.h, Math.floor(tx / TILE), Math.floor((ty - 6) / TILE));
      this.path = findPath(m.solid, m.w, m.h, sx, sy, ex, ey, 5000) ?? [];
    }
  }

  stop() {
    this.actor.body2.setVelocity(0, 0);
    this.actor.play('idle');
  }

  /** Savaşa katılacak düşman: Joseph'in yakınındaki farkında düşmanlardan en yakını. */
  chooseTarget(): Enemy | null {
    const pa = this.w.player.actor;
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of this.w.enemies) {
      if (!e.alive || (!e.aware && !e.damageBy.joseph) || e.def.behavior === 'flee') continue;
      const dp = Math.hypot(e.x - pa.x, e.y - pa.y) / TILE;
      if (dp > 11) continue;
      const dm = Math.hypot(e.x - this.x, e.y - this.y) / TILE;
      // kendisine saldırana öncelik
      const score = dm + (e.foe === this ? -2 : 0);
      if (score < bd) {
        bd = score;
        best = e;
      }
    }
    return best;
  }

  update(dt: number) {
    const a = this.actor;
    a.tickAnim(dt);
    a.tickFlash(dt);
    this.stateT += dt;
    this.cooldownT -= dt;
    this.repathT -= dt;
    this.invulnT -= dt;
    const b = a.body2;
    const w = this.w;
    const pa = w.player.actor;
    const distP = Math.hypot(pa.x - this.x, pa.y - this.y) / TILE;
    const walk = BASE_SPEED * TILE * Math.max(0.8, this.d.moveSpeed) * this.speedMult;

    // geri tepme
    if (a.kb.lengthSq() > 1) {
      b.setVelocity(a.kb.x, a.kb.y);
      a.kb.scale(Math.pow(0.0005, dt));
      this.post(dt);
      return;
    }

    if (this.state === 'scripted') {
      this.post(dt);
      return;
    }

    if (this.state === 'down') {
      b.setVelocity(0, 0);
      // savaş bitince toparlan
      if (!w.inBattle) {
        this.calmT += dt;
        if (this.calmT > 2.5) {
          this.hp = Math.max(1, Math.round(this.maxHp * 0.35));
          this.calmT = 0;
          a.setAlphaAll(1);
          a.play('idle');
          this.setState('follow');
          this.say(this.pick(this.cdef.up));
        }
      } else this.calmT = 0;
      this.post(dt);
      return;
    }

    if (w.cutscene) {
      b.setVelocity(0, 0);
      if (a.anim === 'walk' || a.anim === 'run') a.play('idle');
      this.post(dt);
      return;
    }

    // uzak kaldıysa ışınlan
    if (distP > 14) {
      this.teleportNear();
      this.setState('follow');
    }
    // savaş dışında yavaşça iyileş
    if (!w.inBattle && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.03 * dt);

    switch (this.state) {
      case 'follow': {
        if (this.fights && this.cooldownT <= 0) {
          const t = this.chooseTarget();
          if (t) {
            this.target = t;
            this.setState('engage');
            if (Math.random() < 0.5) this.say(this.pick(this.cdef.engage), 1.6);
            break;
          }
        }
        const fp = this.followPoint();
        const df = Math.hypot(fp.x - this.x, fp.y - this.y) / TILE;
        if (df > 0.7 && distP > 1.2) {
          const run = df > 3.5 || w.player.running;
          this.moveToward(fp.x, fp.y, walk * (run ? 1.65 : 1.05) * (df > 6 ? 1.15 : 1), run);
          // ilerleme yoksa ışınlan (kapı önü, dar geçit)
          this.progressT += dt;
          if (this.progressT > 1.5) {
            const moved = Math.hypot(this.x - this.lastPos.x, this.y - this.lastPos.y) / TILE;
            if (moved < 0.5 && df > 3) this.teleportNear();
            this.progressT = 0;
            this.lastPos = { x: this.x, y: this.y };
          }
        } else {
          this.stop();
          this.path = [];
          this.progressT = 0;
          a.face(dirFromVec(pa.x - this.x, pa.y - this.y, a.dir));
          // laf at
          this.banterT -= dt;
          if (this.banterT <= 0 && !w.inBattle && w.canBubble?.()) {
            this.banterT = 35 + Math.random() * 40;
            this.say(this.pick(this.cdef.banter), 3.2);
            w.noteBubble?.();
          }
        }
        break;
      }
      case 'engage': {
        const e = this.target;
        if (!e || !e.alive || !this.fights) {
          this.target = null;
          this.setState('follow');
          break;
        }
        // Joseph'ten çok uzaklaşma
        if (distP > 12) {
          this.target = null;
          this.setState('follow');
          break;
        }
        const de = Math.hypot(e.x - this.x, e.y - this.y) / TILE;
        if (this.cdef.role === 'melee') {
          const reach = 1.15 + e.actor.bodyR / TILE;
          if (de <= reach && this.cooldownT <= 0) {
            this.stop();
            a.face(dirFromVec(e.x - this.x, e.y - this.y));
            this.setState('windup');
            break;
          }
          // yandan sar: Joseph'in karşısına değil, yanına geç
          const vx = e.x - pa.x, vy = e.y - pa.y;
          const l = Math.hypot(vx, vy) || 1;
          const side = this.cdef.side;
          const ox = (-vy / l) * side * 0.9 * TILE, oy = (vx / l) * side * 0.9 * TILE;
          const gx = e.x + ox, gy = e.y + oy;
          if (de > reach * 0.85) this.moveToward(gx, gy, walk * (de > 3 ? 1.5 : 1.1), de > 3);
          else {
            this.stop();
            a.face(dirFromVec(e.x - this.x, e.y - this.y));
          }
        } else {
          // okçu: 3.5–6 kare arası
          if (de < 3.2) {
            // geri çekil (Joseph'e doğru kaçmaya çalış)
            let ax = this.x - e.x, ay = this.y - e.y;
            const l = Math.hypot(ax, ay) || 1;
            ax /= l;
            ay /= l;
            const tx = this.x + ax * 2 * TILE + (pa.x - this.x) * 0.2, ty = this.y + ay * 2 * TILE + (pa.y - this.y) * 0.2;
            this.moveToward(tx, ty, walk * 1.2, true);
            if (this.cooldownT <= -0.6 && de > 1.8) {
              this.stop();
              this.setState('windup');
            }
          } else if (de > 6.2) this.moveToward(e.x, e.y, walk * 1.2, de > 8);
          else if (this.cooldownT <= 0) {
            this.stop();
            this.setState('windup');
          } else {
            this.stop();
            a.face(dirFromVec(e.x - this.x, e.y - this.y));
          }
        }
        break;
      }
      case 'windup': {
        b.setVelocity(0, 0);
        const e = this.target;
        if (!e || !e.alive) {
          this.setState('follow');
          break;
        }
        a.face(dirFromVec(e.x - this.x, e.y - this.y));
        const wt = this.cdef.role === 'melee' ? 0.28 : 0.4;
        if (!this.swung) {
          this.swung = true;
          a.play(this.cdef.role === 'melee' ? 'slash' : 'shoot', { loop: false, restart: true, speed: this.cdef.role === 'melee' ? 1.2 : 1.6 });
        }
        if (this.stateT >= wt) this.strike(e);
        break;
      }
      case 'strike':
      case 'recover': {
        b.setVelocity(0, 0);
        if (this.stateT > 0.3) {
          a.play('idle');
          this.setState(this.target?.alive ? 'engage' : 'follow');
        }
        break;
      }
    }
    this.post(dt);
  }

  strike(e: Enemy) {
    this.setState('strike');
    this.cooldownT = this.cdef.role === 'melee' ? 1.15 + Math.random() * 0.35 : 1.5 + Math.random() * 0.4;
    const v = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
    if (this.cdef.role === 'melee') {
      this.w.fx.slashArc(this.x + v.x * 16, this.y - 14 + v.y * 16, v.angle(), 0xffe0c0, 0.9);
      const de = Math.hypot(e.x - this.x, e.y - this.y) / TILE;
      if (de <= 1.5 + e.actor.bodyR / TILE) this.w.companionHit(this, e, v);
    } else this.w.spawnCompanionArrow(this, e, v);
  }

  /** Düşmandan darbe. */
  hurt(dmg: number, dir: Phaser.Math.Vector2) {
    if (this.down || this.invulnT > 0) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.invulnT = 0.35;
    this.actor.flash(0xff4030, 0.12);
    this.actor.kb.set(dir.x, dir.y).scale(140);
    this.w.fx.number(this.x, this.y - 50, `-${dmg}`, 'hurt');
    if (this.hp <= 0) this.goDown(false);
  }

  goDown(silent: boolean) {
    this.hp = 0;
    this.target = null;
    this.setState('down');
    this.actor.body2.setVelocity(0, 0);
    this.actor.kb.set(0, 0);
    this.actor.play('die', { loop: false, hold: true });
    if (!silent) this.say(this.pick(this.cdef.down), 2.2);
  }

  post(dt: number) {
    const a = this.actor;
    a.setDepth(a.y);
    if (this.bubble) {
      this.bubbleT -= dt;
      this.bubble.setPosition(a.x, a.y - 60);
      this.bubble.setAlpha(Math.min(1, this.bubbleT / 0.4));
      if (this.bubbleT <= 0) {
        this.bubble.destroy();
        this.bubble = null;
      }
    }
    const g = this.bar;
    g.clear();
    if (this.hp < this.maxHp || this.down) {
      const bw = 24, top = a.y - 56;
      const f = Math.max(0, this.hp / this.maxHp);
      g.fillStyle(0x000000, 0.7);
      g.fillRect(a.x - bw / 2 - 1, top - 1, bw + 2, 5);
      g.fillStyle(0x0d2a12, 1);
      g.fillRect(a.x - bw / 2, top, bw, 3);
      g.fillStyle(this.down ? 0x777777 : 0x5cd16a, 1);
      g.fillRect(a.x - bw / 2, top, bw * f, 3);
    }
  }
}
