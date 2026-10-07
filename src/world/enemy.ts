// Düşman yapay zekâsı.
import Phaser from 'phaser';
import { ATTACK_RATE_SCALE } from '../data/companions';
import { windupOffset } from './combatFx';
import { Actor, dirFromVec, type Dir } from './actor';
import { MONSTERS, type MonsterDef, type MonsterBehavior } from '../data/monsters';
import { corneredStep, newCorneredState } from '../core/combat';
import { inTelegraph, telegraphDir, telegraphShape, type TelegraphShape } from '../core/telegraph';
import { addStagger, newStagger, staggerCap, tickStagger, type StaggerState } from '../core/stagger';
import { acquire, canStrike, clearBoss, isTurn, noteStrike, release, want, type AttackQueue } from '../core/attackQueue';
import { CHASE_SPEED_MULT } from '../core/movement';
import { createMonster } from '../core/monster';
import { derive, type Derived } from '../core/creature';
import type { CreatureData } from '../core/types';
import { TILE } from './types';
import type { WorldScene } from '../scenes/WorldScene';
import { Sound } from '../audio/audio';
import type { Companion } from './companion';
import { applyStatus, statusMods, tickStatuses, type Status } from '../core/status';

/** 'circle' (0.11.0, A4): saldırı sırasını bekler, hedefin 2–3 kare çevresinde dolaşır. 'stunned' (A3): sersem. */
export type EState = 'idle' | 'wander' | 'alert' | 'chase' | 'circle' | 'windup' | 'strike' | 'recover' | 'flee' | 'return' | 'hurt' | 'dead' | 'stunned';

/** Sırasını bekleyen düşmanın hedefe uzaklığı (kare) ve dolaşma hızı (kovalama hızına oran). */
const CIRCLE_RADIUS = 2.5;
const CIRCLE_SPEED = 0.45;

let NEXT_ID = 1;

/** Beş köşeli yıldız (sersemleme). */
function starPoints(x: number, y: number, ro: number, ri: number): Phaser.Math.Vector2[] {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? ri : ro;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * r, y + Math.sin(a) * r));
  }
  return pts;
}

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
  /** 0.11.0 (A3): sendeleme barı (core/stagger). */
  stagger: StaggerState = newStagger();
  /** A2: hazırlık başında kilitlenen saldırı şekli (kırmızı alan = hasar alanı). */
  shape: TelegraphShape | null = null;
  /** A4: elinde saldırı hakkı olan sıra (hedefin sırası). */
  token: AttackQueue | null = null;
  /** Dolaşırken yön (+1 / −1) ve açı. */
  orbitDir = Math.random() < 0.5 ? 1 : -1;
  orbitAng: number | null = null;
  /** Dolu bar parlaması (sn). */
  staggerFlashT = 0;
  /** Ürkek hayvanın köşeye sıkışma sayacı (def.cornered). */
  corner = newCorneredState();
  heavyAttack = false;
  lastSeenT = 0;
  strikeHit = false;
  approachCounted = false;
  slowT = 0;
  lunge = new Phaser.Math.Vector2();
  hitThisSwing = false;
  /** C4: saldırdığı yoldaş (null = Joseph). */
  foe: Companion | null = null;
  foeT = 0;
  /** Joseph'in bu düşmana son vuruşu (sahne zamanı, sn): yoldaşlar onun hedefini bitirmeyi tercih etmez (0.8.0). */
  josephHitAt = -99;
  /** Durum etkileri (0.9.0, core/status): yanma, yavaşlatma, dondurma, sendeleme, felç, korku, kışkırtma. */
  statuses: Status[] = [];
  /** Yanma hasarının birikimi (saniyede bir sayı olarak gösterilir). */
  burnAcc = 0;
  /** Oyuncuyu kesintisiz gördüğü süre (Gizlilik B-: geç fark etme). */
  seeT = 0;
  statusIcon: Phaser.GameObjects.Image | null = null;

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
    if (this.state === 'windup' && s !== 'windup') this.lean(0);
    // A4: hak hazırlık başında alınır; saldırı bitince (recover sonu), ölünce, kaçınca ya da sersemleyince bırakılır.
    // Saldırısını bitiren sıranın sonuna geçer; ölen/kaçan/eve dönen sıradan çıkar.
    if (this.token && s !== 'windup' && s !== 'strike' && s !== 'recover') {
      release(this.token, this.uid, this.w.nowSec(), s === 'chase' || s === 'circle');
      this.token = null;
    }
    if (s !== 'windup' && s !== 'strike') this.shape = null;
    if (s === 'dead' || s === 'return' || s === 'idle') this.w.leaveQueues(this);
    this.state = s;
    this.stateT = 0;
  }

  /** Durum etkisi uygula (boss/level kuralları core/status'ta). Uygulandıysa true. */
  addStatus(st: Status, userLevel: number): boolean {
    const r = applyStatus(this.statuses, st, { boss: !!this.def.boss, level: this.level }, userLevel);
    if (!r.applied) return false;
    this.statuses = r.list;
    if (r.applied.kind === 'freeze' || r.applied.kind === 'stagger' || r.applied.kind === 'paralyze') {
      // hazırlanan saldırı bozulur
      if (this.state === 'windup') this.cancelWindup('hurt');
    }
    if (r.applied.kind === 'taunt') this.foe = null;
    if (r.applied.kind === 'fear' && this.state !== 'dead') this.setState('flee');
    return true;
  }

  /** Hazırlığı boz (sersemleme ya da durum etkisi): kırmızı alan kalkar, hak bırakılır. */
  cancelWindup(next: EState) {
    this.telegraph.clear();
    this.actor.tint(null);
    this.icon.setText('');
    this.setState(next);
  }

  /** A3: bar doldu — sersemle (saldıramaz, yürümez; hazırlıktaysa saldırısı iptal). */
  onStunned() {
    if (this.state === 'windup' || this.state === 'strike') this.cancelWindup('stunned');
    else this.setState('stunned');
    this.actor.body2.setVelocity(0, 0);
    this.staggerFlashT = 0.25;
    this.actor.flash(0xffe066, 0.18);
  }

  /** Vuruşun sendeleme dolumu. Sersemlediyse true. */
  addStaggerHit(amount: number): boolean {
    if (!this.alive) return false;
    if (!addStagger(this.stagger, amount, staggerCap(this.def.id), !!this.def.boss)) return false;
    this.onStunned();
    return true;
  }

  get stunned(): boolean {
    return this.stagger.stunT > 0;
  }

  get frozenNow(): boolean {
    return this.statuses.some((s) => s.kind === 'freeze' && s.t > 0);
  }

  destroy() {
    this.statusIcon?.destroy();
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
    this.staggerFlashT -= dt;
    const body = a.body2;
    if (this.state === 'dead') {
      body.setVelocity(0, 0);
      return;
    }
    // A3: sendeleme barı boşalır; sersemleme: saldıramaz, yürümez, hafifçe yalpalar
    if (tickStagger(this.stagger, dt)) {
      a.setAngle(0);
      if (this.state === 'stunned') this.setState(this.aware ? 'chase' : 'idle');
    }
    if (this.state === 'stunned' || this.stunned) {
      if (this.state !== 'stunned') this.setState('stunned');
      body.setVelocity(0, 0);
      a.play('idle');
      a.setAngle(Math.sin(this.stateT * 9) * 7);
      this.drawUI();
      return;
    }
    const p = this.w.player;
    const pd = p.actor;
    // durum etkileri: yanma hasarı, hız, hareket edememe, kaçma, kışkırtma
    let mods = statusMods(this.statuses);
    if (this.statuses.length) {
      const r = tickStatuses(this.statuses, dt);
      this.statuses = r.list;
      if (r.burn > 0) {
        this.burnAcc += r.burn;
        if (this.burnAcc >= 1 || !this.statuses.some((s) => s.kind === 'burn')) {
          this.w.statusDamage(this, this.burnAcc);
          this.burnAcc = 0;
          if ((this.state as EState) === 'dead') return;
        }
      }
      mods = statusMods(this.statuses);
    }
    this.drawStatus(mods);
    const speed = this.def.speed * TILE * (this.slowT > 0 ? 0.5 : 1) * mods.speed;
    // A8: kovalama hızı def.speed × 0,75 (atılma ve ürkek hayvanın kaçışı değişmez)
    const chaseSpeed = speed * CHASE_SPEED_MULT;
    this.slowT -= dt;
    if (!mods.canAct) {
      body.setVelocity(0, 0);
      a.play('idle');
      this.drawUI();
      return;
    }
    if (mods.taunted) this.foe = null;
    // Geri tepme ve vuruş donması (hit-stop) yalnızca hareketi ezer; YZ (hazırlık sayacı, savurma, kovalama) sürer.
    // Böylece iptal beklemesi (core/combat canInterrupt) sırasında gelen vuruşlar düşmanı itip dondursa da saldırısını
    // durduramaz: saldırı hızı ne kadar yüksek olursa olsun sık vurarak kilitlenemez.
    const knocked = a.kb.lengthSq() > 1;
    const frozen = a.frozenT > 0;

    const playerOk = !p.dead && !this.w.cutscene;
    const vis = playerOk && !p.hidden ? this.canSee(pd.x, pd.y, p.d.detectionMult * (p.running ? 1.35 : 1) * (p.sneaking ? 0.7 : 1)) : { see: false, dist: 99, behind: false };

    // Farkındalık göstergesi
    if (vis.see) this.seeT += dt;
    else this.seeT = 0;
    if (!this.aware && this.behavior !== 'flee') {
      if (vis.see && this.seeT >= (p.d.fx.noticeDelay ?? 0)) {
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
      if (this.foeT <= 0 && this.state !== 'windup' && this.state !== 'strike' && this.state !== 'recover') {
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
      case 'chase':
      case 'circle': {
        if ((!playerOk && !this.foe) || (!this.foe && this.lastSeenT > 4 && distP > 6) || Math.hypot(this.x - this.home.x, this.y - this.home.y) > 16 * TILE) {
          this.aware = false;
          this.awareness = 0.3;
          this.setState('return');
          break;
        }
        // A4: saldırı sırası — sırası gelmeyen hedefin çevresinde dolaşır, hedefe dönük durur
        const q = this.w.attackQueue(this.foe);
        const boss = !!this.def.boss;
        const now = this.w.nowSec();
        want(q, this.uid, distP, now);
        const turn = isTurn(q, this.uid, this.w.queueLimit(), now, boss);
        if (!turn) {
          if (this.state !== 'circle') this.setState('circle');
          this.circleAround(fp, toP, distP, chaseSpeed, dt);
          break;
        }
        if (this.state === 'circle') this.setState('chase');
        if (this.def.behavior === 'caster') {
          // mesafeyi koru
          if (distP < 2.8) {
            const away = toP.clone().normalize().scale(-chaseSpeed);
            body.setVelocity(away.x, away.y);
            a.face(dirFromVec(toP.x, toP.y));
            a.play('walk');
          } else if (distP > this.def.attackRange) {
            this.moveTo({ x: fp.x, y: fp.y }, chaseSpeed, dt);
          } else {
            body.setVelocity(0, 0);
            a.face(dirFromVec(toP.x, toP.y));
            a.play('idle');
          }
          if (distP <= this.def.attackRange + 0.5 && this.cooldownT <= 0 && acquire(q, this.uid, this.w.queueLimit(), now, boss)) this.startWindup(q);
          break;
        }
        if (distP <= this.def.attackRange + 0.25 && this.cooldownT <= 0 && acquire(q, this.uid, this.w.queueLimit(), now, boss)) {
          this.startWindup(q);
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
        } else this.moveTo(tgt, chaseSpeed * (distP > 3 ? 1 : 0.85), dt, this.def.id === 'wolf' && distP > 3 ? 'run' : 'walk');
        break;
      }
      case 'windup': {
        body.setVelocity(0, 0);
        const wt = this.def.windup * (this.heavyAttack ? 1.5 : 1);
        // uyarı: parlama
        const pulse = Math.sin(this.stateT * 30) > 0;
        a.tint(pulse ? 0xff6050 : null);
        this.drawTelegraph(Math.min(1, this.stateT / wt));
        // B23: geri çekilme pozu (saldırmadan önce yaylanır)
        this.lean(windupOffset(Math.min(1, this.stateT / wt)));
        // A4: aynı hedefe başka bir düşman 0,5 sn içinde vurduysa hazırlık biraz uzar (saldırılar okunabilir kalsın)
        if (this.stateT >= wt && (!this.token || canStrike(this.token, this.uid, this.w.nowSec()))) {
          if (this.token) noteStrike(this.token, this.uid, this.w.nowSec());
          a.tint(null);
          this.lean(0);
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
          this.cooldownT = (this.def.cooldown / ATTACK_RATE_SCALE) * (0.85 + Math.random() * 0.3);
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
        if (mods.fleeing) break;
        if (this.stateT > (this.behavior === 'flee' ? 4 : 3) || distP > 9) {
          if (this.behavior === 'flee') {
            this.aware = false;
            this.setState('idle');
          } else this.setState('chase');
        }
        break;
      }
      case 'return': {
        clearBoss(this.w.attackQueue(this.foe), this.uid);
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
    if (frozen) body.setVelocity(0, 0);
    else if (knocked) {
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
      this.cooldownT = Math.max(this.cooldownT, 0.5 / ATTACK_RATE_SCALE);
      this.setState('chase');
      this.w.enterCombat();
    }
    if (alertPack && (this.def.behavior === 'pack' || this.def.id.startsWith('goblin'))) {
      for (const e of this.w.enemies) if (e !== this && e.alive && e.spawnId.slice(0, 3) === this.spawnId.slice(0, 3) && Math.hypot(e.x - this.x, e.y - this.y) < 9 * TILE) e.becomeAware(false);
    }
  }

  /** A2: hazırlık başında saldırının yönü ve şekli kilitlenir (hedefin o anki konumuna doğru). A4: hak alınmıştır. */
  startWindup(q: AttackQueue | null = null) {
    this.setState('windup');
    this.token = q;
    this.attackCount++;
    this.heavyAttack = this.def.behavior === 'boss' && this.attackCount % 3 === 0;
    const pd = this.foePos();
    this.shape = telegraphShape({
      x: this.x, y: this.y, tx: pd.x, ty: pd.y, attackRange: this.def.attackRange, heavy: this.heavyAttack, attack: this.def.attack, tile: TILE,
    });
    this.actor.face(dirFromVec(pd.x - this.x, pd.y - this.y));
    this.actor.play('idle');
    this.icon.setText('!').setColor('#ff3020');
    Sound.sfx('windup', 0.5);
    if (!this.foe) this.w.registerIncoming(this, this.def.windup * (this.heavyAttack ? 1.5 : 1));
  }

  /** Saldırı: hedefe yeniden dönmez; atılma ve mermi hazırlık başında kilitlenen yönde. */
  strike() {
    this.setState('strike');
    this.hitThisSwing = false;
    const dv = this.shape ? telegraphDir(this.shape) : { x: this.facingVec()[0], y: this.facingVec()[1] };
    const v = new Phaser.Math.Vector2(dv.x, dv.y);
    if (this.shape?.kind !== 'circle') this.actor.face(dirFromVec(v.x, v.y));
    if (this.def.attack === 'bolt') {
      this.actor.play('cast', { loop: false, speed: 1.4 });
      this.w.spawnBolt(this, v);
      this.icon.setText('');
      return;
    }
    this.lunge.copy(v).scale(TILE * (this.heavyAttack ? 1.5 : 2.4));
    if (this.shape?.kind === 'circle') this.lunge.set(0, 0);
    this.actor.play(this.actor.kind === 'lpc' ? 'slash' : 'attack', { loop: false, speed: 1.6, restart: true });
    Sound.sfx(this.def.id === 'wolf' || this.def.id === 'rat' ? 'bite' : 'swing', 0.6);
    this.icon.setText('');
  }

  /** A2: hasar alanı kırmızı alanla aynı saf fonksiyon (Joseph/yoldaşın ayaklarındaki gövde merkezi). */
  strikeHits(p: { x: number; y: number }): boolean {
    return !!this.shape && inTelegraph(this.shape, p);
  }

  /** A4: sırasını beklerken hedefin 2–3 kare çevresinde yavaşça dolaş, hedefe dönük dur, araya girme. */
  circleAround(fp: { x: number; y: number }, toP: Phaser.Math.Vector2, distP: number, chaseSpeed: number, dt: number) {
    const body = this.actor.body2;
    const ang = Math.atan2(this.y - fp.y, this.x - fp.x);
    if (this.orbitAng === null) this.orbitAng = ang;
    // yavaşça yan yan: açı saniyede ~0,25 rad ilerler; yarıçap 2–3 kare
    this.orbitAng += this.orbitDir * 0.25 * dt;
    if (Math.abs(Phaser.Math.Angle.Wrap(this.orbitAng - ang)) > 0.8) this.orbitAng = ang + this.orbitDir * 0.3;
    const r = CIRCLE_RADIUS * TILE;
    const tx = fp.x + Math.cos(this.orbitAng) * r, ty = fp.y + Math.sin(this.orbitAng) * r;
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    const sp = chaseSpeed * CIRCLE_SPEED * (distP < 2 ? 1.4 : 1);
    if (d > 4) {
      // ayrışma (moveTo ile aynı): diğer düşmanlara girmesin
      let sx = 0, sy = 0;
      for (const e of this.w.enemies) {
        if (e === this || !e.alive) continue;
        const ex = this.x - e.x, ey = this.y - e.y;
        const ed = Math.hypot(ex, ey);
        if (ed < 26 && ed > 0.1) {
          sx += (ex / ed) * (26 - ed) * 3;
          sy += (ey / ed) * (26 - ed) * 3;
        }
      }
      body.setVelocity((dx / d) * sp + sx, (dy / d) * sp + sy);
      this.actor.play('walk');
      this.actor.animSpeed = 0.7;
    } else {
      body.setVelocity(0, 0);
      this.actor.play('idle');
    }
    this.actor.face(dirFromVec(toP.x, toP.y));
    // ara ara yön değiştir
    if (Math.random() < dt * 0.15) this.orbitDir *= -1;
  }

  /** B23: görselleri bakış yönünün tersine kaydır (hazırlıkta geri çekilme); 0: yerine. */
  lean(px: number) {
    const [fx, fy] = this.facingVec();
    for (const l of this.actor.layers) {
      (l as any).__bx ??= l.x;
      (l as any).__by ??= l.y;
      l.x = (l as any).__bx + fx * px;
      l.y = (l as any).__by + fy * px;
    }
  }

  /** A2: kırmızı alan hazırlık başındaki şekil (dönmez); hasar testi aynı şekli kullanır. */
  drawTelegraph(t: number) {
    const g = this.telegraph;
    g.clear();
    const sh = this.shape;
    if (!sh) return;
    // B23: vuracağı alan belirgin — dolgu, kenar çizgisi ve dolan çizgi
    g.fillStyle(0xff2a1a, 0.18 + 0.27 * t);
    if (sh.kind === 'circle') {
      g.fillCircle(sh.x, sh.y, sh.r);
      g.lineStyle(2, 0xff5040, 0.8);
      g.strokeCircle(sh.x, sh.y, sh.r * t);
    } else if (sh.kind === 'line') {
      g.lineStyle(2, 0xffa040, 0.3 + 0.5 * t);
      g.lineBetween(sh.x, sh.y - 20, sh.x + Math.cos(sh.angle) * sh.len, sh.y - 20 + Math.sin(sh.angle) * sh.len);
    } else {
      const a = sh.angle;
      g.slice(sh.x, sh.y, sh.r, a - sh.half, a + sh.half, false);
      g.fillPath();
      g.lineStyle(1.5, 0xff3020, 0.55 + 0.4 * t);
      g.slice(sh.x, sh.y, sh.r, a - sh.half, a + sh.half, false);
      g.strokePath();
      g.lineStyle(2.5, 0xff8060, 0.85);
      g.beginPath();
      g.arc(sh.x, sh.y, sh.r * t, a - sh.half, a + sh.half);
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

  /** Durum görünümü: donmuşta buz mavisi, başın üstünde etki simgesi (en önemlisi). */
  drawStatus(m: { frozen: boolean }) {
    const a = this.actor;
    const order: Status['kind'][] = ['freeze', 'paralyze', 'stagger', 'fear', 'burn', 'slow', 'taunt'];
    const top = order.find((k) => this.statuses.some((s) => s.kind === k));
    if (m.frozen) a.tint(0x7fb4ff);
    else if ((a as any).__statusTint) a.tint(null);
    (a as any).__statusTint = m.frozen;
    if (!top || this.state === 'dead') {
      this.statusIcon?.setVisible(false);
      return;
    }
    const key = top === 'freeze' ? 'st_freeze' : 'st_' + top;
    if (!this.statusIcon) this.statusIcon = this.w.add.image(0, 0, 'uiicons', key).setScale(14 / 72).setDepth(960002);
    this.statusIcon.setFrame(key).setVisible(true);
    const ttop = a.y - (a.kind === 'lpc' ? 58 : 34) * (this.def.scale ?? 1);
    this.statusIcon.setPosition(a.x + 18, ttop - 4);
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
      // A3: can barının altında ince sarı sendeleme çizgisi (dolu barda kısa parlama)
      const st = this.stagger;
      const sf = this.stunned ? 1 : Math.min(1, st.fill / staggerCap(this.def.id));
      g.fillStyle(0x000000, 0.6);
      g.fillRect(a.x - w / 2 - 1, top + h + 1, w + 2, 2 + 1);
      g.fillStyle(this.staggerFlashT > 0 ? 0xffffff : this.stunned ? 0xffc030 : 0xf5d442, 1);
      g.fillRect(a.x - w / 2, top + h + 1.5, w * sf, 1.5);
    }
    // A3: sersemlemede başın üstünde dönen yıldızlar
    if (this.stunned && this.state !== 'dead') {
      const cx = a.x, cy = top - 10;
      for (let i = 0; i < 3; i++) {
        const an = this.stateT * 5 + (i * Math.PI * 2) / 3;
        const sx = cx + Math.cos(an) * 10, sy = cy + Math.sin(an) * 3.5;
        g.fillStyle(0xffe066, 1);
        g.fillPoints(starPoints(sx, sy, 3.6, 1.5), true);
      }
    }
    if (this.state === 'dead') {
      g.clear();
      this.icon.setText('');
    }
  }
}
