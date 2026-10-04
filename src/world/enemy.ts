// Düşman yapay zekâsı.
import Phaser from 'phaser';
import { Actor, dirFromVec, type Dir } from './actor';
import { MONSTERS, type MonsterDef, type MonsterBehavior } from '../data/monsters';
import { corneredStep, newCorneredState } from '../core/combat';
import { createMonster } from '../core/monster';
import { derive, type Derived } from '../core/creature';
import type { CreatureData } from '../core/types';
import { TILE } from './types';
import type { WorldScene } from '../scenes/WorldScene';
import { Sound } from '../audio/audio';
import type { Companion } from './companion';

export type EState = 'idle' | 'wander' | 'alert' | 'chase' | 'windup' | 'strike' | 'recover' | 'flee' | 'return' | 'hurt' | 'dead' | 'stunned';

let NEXT_ID = 1;

export class Enemy {
  uid = NEXT_ID++;
  def: MonsterDef;
  c: CreatureData;
  d: Derived;
  actor: Actor;
  state: EState = 'idle';
  stateT = 0;
  awareness = 0;
  aware = false;
  home: { x: number; y: number };
  target: { x: number; y: number } | null = null;
  damageBy: Record<string, number> = {};
  spawnId: string;
  hpBar: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Text;
  telegraph: Phaser.GameObjects.Graphics;
  barShowT = 0;
  cooldownT = 0;
  attackCount = 0;
  /** Son saldırı iptalinden bu yana geçen süre (sn); core/combat canInterrupt. */
  sinceInterrupt = 99;
  /** Ürkek hayvanın köşeye sıkışma sayacı (def.cornered). */
  corner = newCorneredState();
  heavyAttack = false;
  lastSeenT = 0;
  strikeHit = false;
  approachCounted = false;
  stunT = 0;
  slowT = 0;
  lunge = new Phaser.Math.Vector2();
  hitThisSwing = false;
  /** C4: saldırdığı yoldaş (null = Joseph). */
  foe: Companion | null = null;
  foeT = 0;

  constructor(public w: WorldScene, monsterId: string, x: number, y: number, spawnId: string, level?: number) {
    this.def = MONSTERS[monsterId];
    this.c = createMonster(monsterId, Math.random, level);
    this.d = derive(this.c);
    this.spawnId = spawnId;
    this.home = { x, y };
    const humanoid = this.def.sprite.startsWith('m_goblin');
    if (humanoid) {
      const key = this.def.sprite.slice(2);
      this.actor = new Actor(w, x, y, [key], 'lpc');
    } else {
      const meta = w.cache.json.get('monstersMeta')[this.def.sprite];
      this.actor = new Actor(w, x, y, [this.def.sprite], 'monster', meta);
    }
    this.actor.setScale(this.def.scale ?? 1);
    this.actor.enablePhysics(Math.max(6, this.def.radius * TILE * 0.8));
    this.actor.setDepth(y);
    this.hpBar = w.add.graphics().setDepth(960000);
    this.icon = w.add.text(x, y, '', { fontFamily: 'Pixelify, monospace', fontSize: '14px', color: '#ffe066', stroke: '#2a1a00', strokeThickness: 3, fontStyle: 'bold' }).setOrigin(0.5, 1).setDepth(960001);
    this.icon.setResolution(w.cameras.main.zoom);
    this.telegraph = w.add.graphics().setDepth(-40000);
    this.actor.dir = (['down', 'left', 'right', 'up'] as Dir[])[Math.floor(Math.random() * 4)];
    this.actor.play('idle');
  }

  get x() { return this.actor.x; }
  get y() { return this.actor.y; }
  get alive() { return this.state !== 'dead'; }
  get level() { return this.c.level; }
  /** O anki davranış: köşeye sıkışmış ürkek hayvan saldırgana döner. */
  get behavior(): MonsterBehavior { return this.corner.cornered ? 'aggressive' : this.def.behavior; }

  setState(s: EState) {
    this.state = s;
    this.stateT = 0;
  }

  destroy() {
    this.actor.destroy();
    this.hpBar.destroy();
    this.icon.destroy();
    this.telegraph.destroy();
  }

  /** Oyuncuyu görebiliyor mu (mesafe + görüş açısı)? */
  canSee(px: number, py: number, mult: number): { see: boolean; dist: number; behind: boolean } {
    const dx = px - this.x, dy = py - this.y;
    const dist = Math.hypot(dx, dy) / TILE;
    const range = this.def.sight * mult * (this.w.darkness > 0.5 ? 0.75 : 1);
    const [fx, fy] = this.facingVec();
    const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dy * fy) / (Math.hypot(dx, dy) || 1)))) * (180 / Math.PI);
    const inCone = ang <= this.def.fov / 2;
    const behind = ang > 110;
    const close = dist < 1.2 * mult; // çok yakında her yönden fark edilir
    return { see: dist <= range && (inCone || close), dist, behind };
  }

  facingVec(): [number, number] {
    const d = this.actor.dir;
    return d === 'up' ? [0, -1] : d === 'down' ? [0, 1] : d === 'left' ? [-1, 0] : [1, 0];
  }

  update(dt: number) {
    const a = this.actor;
    a.tickAnim(dt);
    a.tickFlash(dt);
    this.stateT += dt;
    this.cooldownT -= dt;
    this.sinceInterrupt += dt;
    const body = a.body2;
    if (this.state === 'dead') {
      body.setVelocity(0, 0);
      return;
    }
    const p = this.w.player;
    const pd = p.actor;
    const speed = this.def.speed * TILE * (this.slowT > 0 ? 0.5 : 1);
    this.slowT -= dt;
    // Geri tepme yalnızca hareketi ezer; YZ (hazırlık sayacı, savurma, kovalama) sürer. Böylece iptal beklemesi
    // (core/combat canInterrupt) sırasında gelen vuruşlar düşmanı itse de saldırısını durduramaz: sık vurarak kilitlenemez.
    const knocked = a.kb.lengthSq() > 1;
    if (a.frozenT > 0) {
      body.setVelocity(0, 0);
      this.drawUI();
      return;
    }
    if (this.stunT > 0) {
      this.stunT -= dt;
      body.setVelocity(0, 0);
      this.drawUI();
      return;
    }

    const playerOk = !p.dead && !this.w.cutscene;
    const vis = playerOk ? this.canSee(pd.x, pd.y, p.d.detectionMult * (p.running ? 1.35 : 1) * (p.sneaking ? 0.7 : 1)) : { see: false, dist: 99, behind: false };

    // Farkındalık göstergesi
    if (!this.aware && this.behavior !== 'flee') {
      if (vis.see) {
        const rate = (1.6 / Math.max(0.6, vis.dist)) * (p.running ? 1.8 : 1) * (vis.dist < 1.5 ? 4 : 1);
        this.awareness = Math.min(1, this.awareness + rate * dt);
        // Gizli yaklaşma sayacı (hidden discovery)
        if (vis.dist < 2 && vis.behind && !this.approachCounted) {
          this.approachCounted = true;
          this.w.onSneakApproach();
        }
      } else this.awareness = Math.max(0, this.awareness - 0.25 * dt);
      if (this.awareness >= 1) this.becomeAware(true);
    } else if (!this.aware && this.behavior === 'flee' && vis.see && vis.dist < this.def.sight) {
      this.aware = true;
      this.setState('flee');
    }
    if (!this.aware && vis.see === false && vis.dist < 2 && !this.approachCounted && playerOk) {
      // arkadan, görmeden yakına gelindi
      this.approachCounted = true;
      this.w.onSneakApproach();
    }

    // C4: hedef seçimi — Joseph ya da yakındaki bir yoldaş (Joseph'e hafif öncelik)
    if (this.aware) {
      this.foeT -= dt;
      if (this.foeT <= 0 && this.state !== 'windup' && this.state !== 'strike') {
        this.foeT = 0.6;
        this.pickFoe(playerOk);
      }
    }
    if (this.foe && (this.foe.down || !this.w.companions.includes(this.foe))) this.foe = null;
    const fp = this.foe ? this.foe.actor : pd;
    const toP = new Phaser.Math.Vector2(fp.x - this.x, fp.y - this.y);
    const distP = toP.length() / TILE;
    if (vis.see) this.lastSeenT = 0;
    else this.lastSeenT += dt;

    // Köşeye sıkışma (Orman Tavşanı): uzun süre yakından kovalanırsa dönüp saldırır, uzaklaşınca yine kaçar.
    if (this.def.cornered && playerOk) this.updateCornered(Math.hypot(pd.x - this.x, pd.y - this.y) / TILE, dt);

    switch (this.state) {
      case 'idle':
      case 'wander': {
        if (this.aware && playerOk) {
          this.setState(this.behavior === 'flee' ? 'flee' : 'chase');
          break;
        }
        if (this.state === 'idle') {
          body.setVelocity(0, 0);
          a.play('idle');
          if (this.stateT > 1.5 + Math.random() * 3) {
            const r = (this.def.id === 'goblin_chief' ? 1.5 : 3) * TILE;
            this.target = { x: this.home.x + (Math.random() * 2 - 1) * r, y: this.home.y + (Math.random() * 2 - 1) * r };
            this.setState('wander');
          }
        } else {
          if (this.moveTo(this.target!, speed * 0.45, dt) || this.stateT > 5) this.setState('idle');
        }
        break;
      }
      case 'chase': {
        if ((!playerOk && !this.foe) || (!this.foe && this.lastSeenT > 4 && distP > 6) || Math.hypot(this.x - this.home.x, this.y - this.home.y) > 16 * TILE) {
          this.aware = false;
          this.awareness = 0.3;
          this.setState('return');
          break;
        }
        if (this.def.behavior === 'caster') {
          // mesafeyi koru
          if (distP < 2.8) {
            const away = toP.clone().normalize().scale(-speed);
            body.setVelocity(away.x, away.y);
            a.face(dirFromVec(toP.x, toP.y));
            a.play('walk');
          } else if (distP > this.def.attackRange) {
            this.moveTo({ x: fp.x, y: fp.y }, speed, dt);
          } else {
            body.setVelocity(0, 0);
            a.face(dirFromVec(toP.x, toP.y));
            a.play('idle');
          }
          if (distP <= this.def.attackRange + 0.5 && this.cooldownT <= 0) this.startWindup();
          break;
        }
        if (distP <= this.def.attackRange + 0.25 && this.cooldownT <= 0) {
          this.startWindup();
          break;
        }
        // Sürü: hafif yanlara açıl
        const tgt = { x: fp.x, y: fp.y };
        if (this.def.behavior === 'pack') {
          const ang = (this.uid % 3 - 1) * 0.7;
          const v = toP.clone().rotate(ang).normalize().scale(-0.9 * TILE);
          tgt.x += v.x;
          tgt.y += v.y;
        }
        if (distP <= this.def.attackRange && this.cooldownT > 0) {
          body.setVelocity(0, 0);
          a.face(dirFromVec(toP.x, toP.y));
          a.play('idle');
        } else this.moveTo(tgt, speed * (distP > 3 ? 1 : 0.85), dt, this.def.id === 'wolf' && distP > 3 ? 'run' : 'walk');
        break;
      }
      case 'windup': {
        body.setVelocity(0, 0);
        const wt = this.def.windup * (this.heavyAttack ? 1.5 : 1);
        // uyarı: parlama
        const pulse = Math.sin(this.stateT * 30) > 0;
        a.tint(pulse ? 0xff6050 : null);
        this.drawTelegraph(this.stateT / wt);
        if (this.stateT >= wt) {
          a.tint(null);
          this.telegraph.clear();
          this.strike();
        }
        break;
      }
      case 'strike': {
        const dur = 0.22;
        if (this.def.attack === 'melee') {
          body.setVelocity(this.lunge.x, this.lunge.y);
          if (!this.hitThisSwing && this.stateT > dur * 0.4) {
            this.hitThisSwing = true;
            this.w.enemyMeleeHit(this);
          }
        } else body.setVelocity(0, 0);
        if (this.stateT >= dur) {
          this.setState('recover');
          this.cooldownT = this.def.cooldown * (0.85 + Math.random() * 0.3);
        }
        break;
      }
      case 'recover': {
        body.setVelocity(0, 0);
        if (this.stateT > 0.35) {
          a.play('idle');
          this.setState('chase');
        }
        break;
      }
      case 'flee': {
        const away = toP.clone().normalize().scale(-speed * (this.behavior === 'flee' ? 1 : 0.9));
        body.setVelocity(away.x, away.y);
        a.face(dirFromVec(away.x, away.y));
        a.play(this.def.id === 'wolf' ? 'run' : 'walk');
        a.animSpeed = 1.3;
        if (this.stateT > (this.behavior === 'flee' ? 4 : 3) || distP > 9) {
          if (this.behavior === 'flee') {
            this.aware = false;
            this.setState('idle');
          } else this.setState('chase');
        }
        break;
      }
      case 'return': {
        if (this.moveTo(this.home, speed * 0.7, dt) || this.stateT > 12) {
          this.setState('idle');
          // eve dönünce iyileş
          this.c.hp = this.d.maxHp;
        }
        if (this.aware && playerOk && vis.see) this.setState('chase');
        break;
      }
      case 'hurt': {
        body.setVelocity(0, 0);
        if (this.stateT > 0.25) this.setState(this.aware ? 'chase' : 'idle');
        break;
      }
    }
    if (knocked) {
      body.setVelocity(a.kb.x, a.kb.y);
      a.kb.scale(Math.pow(0.0005, dt));
    }
    a.setDepth(a.y);
    this.drawUI();
  }

  pickFoe(playerOk: boolean) {
    const pd = this.w.player.actor;
    let best: Companion | null = null;
    let bd = playerOk ? Math.hypot(pd.x - this.x, pd.y - this.y) / TILE : Infinity;
    for (const c of this.w.companions) {
      if (c.down || !c.fights) continue;
      const d = Math.hypot(c.x - this.x, c.y - this.y) / TILE + 0.8;
      if (d < bd && d < 10) {
        bd = d;
        best = c;
      }
    }
    this.foe = best;
  }

  /** Saldırı hedefinin konumu. */
  foePos(): { x: number; y: number } {
    return this.foe ? this.foe.actor : this.w.player.actor;
  }

  /** Köşeye sıkışma sayacını ilerletir; durum değişince davranışı çevirir. */
  updateCornered(distTiles: number, dt: number) {
    if (this.state === 'windup' || this.state === 'strike') return;
    if (!corneredStep(this.corner, this.def.cornered!, distTiles, dt)) return;
    if (this.corner.cornered) {
      // Kaçamıyor: olduğu yerde dönüp tekme atar (kaçarken evinden uzaklaştı; geri dönmeye kalkmasın).
      this.home = { x: this.x, y: this.y };
      this.aware = false;
      this.becomeAware(false);
      this.w.bubbleAt(this.actor, '!', 1);
    } else {
      // Oyuncu uzaklaştı: yine ürkek.
      this.icon.setText('');
      this.aware = false;
      this.awareness = 0;
      this.setState('idle');
    }
  }

  becomeAware(alertPack: boolean) {
    if (this.aware) return;
    this.aware = true;
    this.awareness = 1;
    if (this.behavior !== 'flee') {
      this.icon.setText('!').setColor('#ff5040');
      this.w.tweens.add({ targets: this.icon, scale: { from: 1.6, to: 1 }, duration: 200 });
      Sound.sfx('alert', 0.6);
      this.cooldownT = Math.max(this.cooldownT, 0.5);
      this.setState('chase');
      this.w.enterCombat();
    }
    if (alertPack && (this.def.behavior === 'pack' || this.def.id.startsWith('goblin'))) {
      for (const e of this.w.enemies) if (e !== this && e.alive && e.spawnId.slice(0, 3) === this.spawnId.slice(0, 3) && Math.hypot(e.x - this.x, e.y - this.y) < 9 * TILE) e.becomeAware(false);
    }
  }

  startWindup() {
    this.setState('windup');
    this.attackCount++;
    this.heavyAttack = this.def.behavior === 'boss' && this.attackCount % 3 === 0;
    const pd = this.foePos();
    this.actor.face(dirFromVec(pd.x - this.x, pd.y - this.y));
    this.actor.play('idle');
    this.icon.setText('!').setColor('#ff3020');
    Sound.sfx('windup', 0.5);
    if (!this.foe) this.w.registerIncoming(this, this.def.windup * (this.heavyAttack ? 1.5 : 1));
  }

  strike() {
    this.setState('strike');
    this.hitThisSwing = false;
    const pd = this.foePos();
    const v = new Phaser.Math.Vector2(pd.x - this.x, pd.y - this.y).normalize();
    this.actor.face(dirFromVec(v.x, v.y));
    if (this.def.attack === 'bolt') {
      this.actor.play('cast', { loop: false, speed: 1.4 });
      this.w.spawnBolt(this, v);
      this.icon.setText('');
      return;
    }
    this.lunge.copy(v).scale(TILE * (this.heavyAttack ? 1.5 : 2.4));
    this.actor.play(this.actor.kind === 'lpc' ? 'slash' : 'attack', { loop: false, speed: 1.6, restart: true });
    Sound.sfx(this.def.id === 'wolf' || this.def.id === 'rat' ? 'bite' : 'swing', 0.6);
    this.icon.setText('');
  }

  drawTelegraph(t: number) {
    const g = this.telegraph;
    g.clear();
    const [fx, fy] = this.facingVec();
    const r = (this.def.attackRange + 0.4) * TILE * (this.heavyAttack ? 1.7 : 1);
    const a = Math.atan2(fy, fx);
    g.fillStyle(0xff2a1a, 0.12 + 0.2 * t);
    if (this.heavyAttack) {
      g.fillCircle(this.x, this.y, r);
      g.lineStyle(2, 0xff5040, 0.8);
      g.strokeCircle(this.x, this.y, r * t);
    } else if (this.def.attack === 'bolt') {
      const pd = this.foePos();
      g.lineStyle(2, 0xffa040, 0.3 + 0.5 * t);
      g.lineBetween(this.x, this.y - 20, pd.x, pd.y - 16);
    } else {
      g.slice(this.x, this.y, r, a - 0.9, a + 0.9, false);
      g.fillPath();
      g.lineStyle(1.5, 0xff6050, 0.7);
      g.beginPath();
      g.arc(this.x, this.y, r * t, a - 0.9, a + 0.9);
      g.strokePath();
    }
  }

  moveTo(t: { x: number; y: number }, speed: number, dt: number, anim: 'walk' | 'run' = 'walk'): boolean {
    const dx = t.x - this.x, dy = t.y - this.y;
    const d = Math.hypot(dx, dy);
    const body = this.actor.body2;
    if (d < 6) {
      body.setVelocity(0, 0);
      this.actor.play('idle');
      return true;
    }
    // ayrışma
    let sx = 0, sy = 0;
    for (const e of this.w.enemies) {
      if (e === this || !e.alive) continue;
      const ex = this.x - e.x, ey = this.y - e.y;
      const ed = Math.hypot(ex, ey);
      if (ed < 22 && ed > 0.1) {
        sx += (ex / ed) * (22 - ed) * 4;
        sy += (ey / ed) * (22 - ed) * 4;
      }
    }
    body.setVelocity((dx / d) * speed + sx, (dy / d) * speed + sy);
    this.actor.face(dirFromVec(dx, dy));
    this.actor.play(anim);
    this.actor.animSpeed = Math.max(0.6, speed / (this.def.speed * TILE));
    // takılma: duvara çarptıysa rastgele kay
    if (body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down) {
      body.setVelocity(body.velocity.x + (Math.random() - 0.5) * speed, body.velocity.y + (Math.random() - 0.5) * speed);
    }
    return false;
  }

  drawUI() {
    const g = this.hpBar;
    g.clear();
    const a = this.actor;
    const top = a.y - (a.kind === 'lpc' ? 58 : 34) * (this.def.scale ?? 1);
    this.icon.setPosition(a.x, top - 4);
    if (!this.aware && this.awareness > 0.05 && this.state !== 'dead') {
      this.icon.setText('?').setColor('#ffe066');
      this.icon.setAlpha(0.4 + this.awareness * 0.6);
      // dolum yayı
      g.lineStyle(2, 0x000000, 0.5);
      g.strokeCircle(a.x, top - 12, 7);
      g.lineStyle(2, 0xffd040, 1);
      g.beginPath();
      g.arc(a.x, top - 12, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.awareness);
      g.strokePath();
    } else if (this.aware && this.state !== 'windup' && this.icon.text === '?') this.icon.setText('');
    if (this.barShowT > 0 || (this.aware && this.c.hp < this.d.maxHp)) {
      this.barShowT -= 1 / 60;
      const w = 26, h = 3;
      const f = Math.max(0, this.c.hp / this.d.maxHp);
      g.fillStyle(0x000000, 0.7);
      g.fillRect(a.x - w / 2 - 1, top - 1, w + 2, h + 2);
      g.fillStyle(0x3a0a0a, 1);
      g.fillRect(a.x - w / 2, top, w, h);
      g.fillStyle(this.def.boss ? 0xff8a20 : 0xe03030, 1);
      g.fillRect(a.x - w / 2, top, w * f, h);
    }
    if (this.state === 'dead') {
      g.clear();
      this.icon.setText('');
    }
  }
}
