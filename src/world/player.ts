// Joseph'in kontrolcüsü.
import Phaser from 'phaser';
import { Actor, dirFromVec, dirVec, type Dir } from './actor';
import { G } from '../game/G';
import { Input } from '../game/input';
import { ITEMS } from '../data/items';
import { JOSEPH_LAYERS } from '../data/manifest';
import { TILE } from './types';
import { EQUIP_SLOTS } from '../core/types';
import type { WorldScene } from '../scenes/WorldScene';
import { Sound } from '../audio/audio';
import { hpRegenPerSec, mpRegenPerSec, staminaRegenPerSec } from '../core/formulas';
import { LIGHT_MAX, LIGHT_DECAY_PER_SEC } from '../core/divine';
import { runStep, RUN_THRESHOLD, type RunLock } from '../core/stamina';

export type PState = 'free' | 'attack' | 'heavy' | 'dodge' | 'hurt' | 'dead' | 'cast' | 'locked' | 'dash';

export const BASE_SPEED = 5.2; // kare/saniye (1.0x insanda)

export class Player {
  actor: Actor;
  state: PState = 'free';
  stateT = 0;
  attackHitDone = false;
  attackDur = 0.4;
  attackDir = new Phaser.Math.Vector2(0, 1);
  invulnT = 0;
  dodgeStart = -10;
  dodgeVec = new Phaser.Math.Vector2();
  counterT = 0; // mükemmel kaçış sonrası karşı saldırı penceresi
  staminaDelay = 0;
  running = false;
  /** Dayanıklılık bitince koşu kilidi (A1). */
  runLock: RunLock = { exhausted: false };
  sneaking = false;
  combatT = 99; // son savaş olayından beri geçen süre
  secondWindUsed = false;
  shield = 0;
  shieldT = 0;
  shieldFx: Phaser.GameObjects.Image | null = null;
  holyNext = false;
  skillCd: Record<string, number> = {};
  stepT = 0;
  distAcc = 0;
  heavy = false;
  t = 0;
  regenT = 0;
  buffs: { id: string; t: number; amount?: number }[] = [];

  constructor(public w: WorldScene, x: number, y: number) {
    this.actor = new Actor(w, x, y, ['j_body'], 'lpc');
    this.actor.enablePhysics(9);
    this.refreshLayers();
    this.actor.dir = (G.state.pos.facing as Dir) ?? 'down';
    this.actor.play('idle');
  }

  get d() {
    return G.d;
  }
  get dead() {
    return this.state === 'dead';
  }
  get inCombat() {
    return this.combatT < 6;
  }

  refreshLayers() {
    const eq = G.p.equipment;
    const list: { key: string; z: number }[] = [
      { key: 'j_body', z: 10 },
      { key: 'j_head', z: 100 },
    ];
    for (const s of EQUIP_SLOTS) {
      const id = eq[s];
      if (!id) continue;
      const v = ITEMS[id]?.visual;
      if (!v) continue;
      if (JOSEPH_LAYERS[v]) list.push({ key: 'j_' + v, z: JOSEPH_LAYERS[v].z });
      if (JOSEPH_LAYERS[v + '_bg']) list.push({ key: 'j_' + v + '_bg', z: JOSEPH_LAYERS[v + '_bg'].z });
    }
    list.sort((a, b) => a.z - b.z);
    this.actor.setLayers(list.map((l) => l.key));
  }

  setState(s: PState) {
    this.state = s;
    this.stateT = 0;
  }

  weaponReach(): number {
    switch (this.d.weaponType) {
      case 'spear': return 1.75 * this.d.reachMult;
      case 'sword': return 1.2;
      case 'dagger': return 1.0;
      case 'club': return 1.15;
      case 'bow': return 7;
      default: return 0.95;
    }
  }

  update(dt: number) {
    const a = this.actor;
    this.t += dt;
    a.tickAnim(dt);
    a.tickFlash(dt);
    this.stateT += dt;
    this.invulnT -= dt;
    this.counterT -= dt;
    this.combatT += dt;
    this.staminaDelay -= dt;
    for (const k in this.skillCd) this.skillCd[k] -= dt;
    const body = a.body2;
    const p = G.p;
    const d = this.d;

    // yenilenme
    if (this.state !== 'dead') {
      const ad = d.divAdaptation * (G.state.divine.skills.includes('guardian_aura') && this.inCombat ? 1.5 : 1);
      p.hp = Math.min(d.maxHp, p.hp + hpRegenPerSec(d.maxHp, ad, this.inCombat, d.regenBonus) * dt);
      p.mp = Math.min(d.maxMp, p.mp + mpRegenPerSec(d.maxMp, d.stats.MNA, ad, this.inCombat) * dt);
      if (this.staminaDelay <= 0) p.stamina = Math.min(d.maxStamina, p.stamina + staminaRegenPerSec(d.stats.AGI, ad, this.inCombat) * dt);
      for (const b of this.buffs) {
        b.t -= dt;
        if (b.id === 'regen' && b.amount) p.hp = Math.min(d.maxHp, p.hp + b.amount * dt);
      }
      this.buffs = this.buffs.filter((b) => b.t > 0);
    }
    // Işık barı savaş dışında boşalır
    const dv = G.state.divine;
    if (!this.inCombat && dv.light > 0) dv.light = Math.max(0, dv.light - LIGHT_DECAY_PER_SEC * dt);
    // kalkan
    if (this.shieldT > 0) {
      this.shieldT -= dt;
      if (this.shieldFx) {
        this.shieldFx.setPosition(a.x, a.y - 22);
        this.shieldFx.setAlpha(0.35 + Math.sin(this.t * 10) * 0.1);
      }
      if (this.shieldT <= 0 || this.shield <= 0) this.endShield();
    }

    if (a.frozenT > 0) {
      body.setVelocity(0, 0);
      return;
    }
    // geri tepme
    if (a.kb.lengthSq() > 4) {
      body.setVelocity(a.kb.x, a.kb.y);
      a.kb.scale(Math.pow(0.0004, dt));
      a.setDepth(a.y);
      return;
    }

    const mx = Input.moveX, my = Input.moveY;
    const mlen = Math.min(1, Math.hypot(mx, my));
    switch (this.state) {
      case 'locked':
        body.setVelocity(0, 0);
        if (!this.w.cutscene && Input.consume('appraise')) this.w.appraiseNearest();
        break;
      case 'dead':
        body.setVelocity(0, 0);
        break;
      case 'free': {
        // eylemler
        if (Input.consume('dodge')) { this.tryDodge(); break; }
        if (Input.consume('attack')) { this.startAttack(false); break; }
        if (Input.consume('heavy')) { this.startAttack(true); break; }
        for (let i = 1; i <= 4; i++) if (Input.consume(('skill' + i) as any)) this.w.useSkillSlot(i - 1);
        for (let i = 1; i <= 3; i++) if (Input.consume(('div' + i) as any)) this.w.useDivineSlot(i - 1);
        if (Input.consume('interact')) this.w.interact();
        if (Input.consume('appraise')) this.w.appraiseNearest();
        if (Input.consume('eat')) this.w.eatQuick();
        // hareket
        const wantRun = (Input.run || (Input.touchMove && mlen > RUN_THRESHOLD)) && mlen > 0.2;
        this.running = runStep(this.runLock, wantRun, p.stamina);
        // Ayarlardaki "Karakter hızı" yalnızca yürüme/koşmayı çarpar (Divine Hız hesabına dokunmaz)
        let sp = BASE_SPEED * TILE * d.moveSpeed * mlen * (G.settings.moveSpeed ?? 1);
        if (this.running) {
          sp *= 1.6;
          p.stamina = Math.max(0, p.stamina - 11 * d.runCostMult * dt);
          if (p.stamina <= 0) {
            this.runLock.exhausted = true;
            this.running = false;
            this.w.fx.number(a.x, a.y - 50, 'Nefes nefese', 'miss');
          }
          this.staminaDelay = 0.5;
          this.distAcc += sp * dt;
          if (this.distAcc > TILE * 10) {
            this.distAcc = 0;
            G.count('runDistance', 10);
          }
        }
        if (mlen > 0.08) {
          body.setVelocity((mx / Math.max(mlen, 0.001)) * sp, (my / Math.max(mlen, 0.001)) * sp);
          a.face(dirFromVec(mx, my, a.dir));
          a.play(this.running ? 'run' : 'walk');
          a.animSpeed = Math.max(0.5, sp / (BASE_SPEED * TILE * 0.5) * 0.9) * (this.running ? 0.75 : 1);
          this.stepT -= dt * (this.running ? 1.6 : 1);
          if (this.stepT <= 0) {
            this.stepT = 0.32;
            Sound.sfx('step', 0.5);
            if (this.running) this.w.fx.dust(a.x, a.y, 2);
          }
        } else {
          body.setVelocity(0, 0);
          a.play('idle');
        }
        break;
      }
      case 'attack':
      case 'heavy': {
        body.setVelocity(body.velocity.x * 0.8, body.velocity.y * 0.8);
        const hitAt = this.attackDur * (this.state === 'heavy' ? 0.6 : 0.45);
        if (!this.attackHitDone && this.stateT >= hitAt) {
          this.attackHitDone = true;
          this.w.playerStrike(this.state === 'heavy', this.attackDir);
        }
        if (this.stateT >= this.attackDur) {
          this.setState('free');
          a.play('idle');
        } else if (this.stateT > this.attackDur * 0.75) {
          // geç iptal: kaçış ile
          if (Input.peek('dodge')) {
            Input.consume('dodge');
            this.setState('free');
            this.tryDodge();
          }
        }
        break;
      }
      case 'cast': {
        body.setVelocity(0, 0);
        if (this.stateT > 0.45) {
          this.setState('free');
          a.play('idle');
        }
        break;
      }
      case 'dodge':
      case 'dash': {
        const dur = this.state === 'dash' ? 0.18 : 0.32;
        const k = 1 - this.stateT / dur;
        const sp = (this.state === 'dash' ? 13 : 7.2) * TILE * (0.4 + 0.6 * k) * Math.max(0.75, Math.sqrt(d.moveSpeed));
        body.setVelocity(this.dodgeVec.x * sp, this.dodgeVec.y * sp);
        if (Math.floor(this.stateT / 0.05) !== Math.floor((this.stateT - dt) / 0.05)) this.w.fx.ghost(a, this.state === 'dash' ? 0xffe9a0 : 0x9fd6ff);
        if (this.stateT >= dur) {
          this.setState('free');
          a.play('idle');
        }
        break;
      }
      case 'hurt': {
        body.setVelocity(0, 0);
        if (this.stateT > 0.28) {
          this.setState('free');
          a.play('idle');
        }
        break;
      }
    }
    a.setDepth(a.y);
  }

  tryDodge() {
    const p = G.p;
    const cost = 20 * this.d.dodgeCostMult;
    if (p.stamina < cost) {
      this.w.fx.number(this.actor.x, this.actor.y - 50, 'Yorgun!', 'miss');
      Sound.sfx('error', 0.4);
      return;
    }
    p.stamina -= cost;
    this.staminaDelay = 0.7;
    const mx = Input.moveX, my = Input.moveY;
    if (Math.hypot(mx, my) > 0.2) this.dodgeVec.set(mx, my).normalize();
    else {
      const [fx, fy] = dirVec(this.actor.dir);
      this.dodgeVec.set(-fx, -fy);
    }
    this.setState('dodge');
    this.dodgeStart = this.t;
    this.invulnT = 0.26;
    this.actor.play('walk', { speed: 2.5 });
    Sound.sfx('dodge');
    this.w.fx.dust(this.actor.x, this.actor.y, 4);
    G.state.divine.light = Math.min(LIGHT_MAX, G.state.divine.light + (this.inCombat ? 3 : 0));
  }

  lightDash() {
    const [fx, fy] = dirVec(this.actor.dir);
    const mx = Input.moveX, my = Input.moveY;
    if (Math.hypot(mx, my) > 0.2) this.dodgeVec.set(mx, my).normalize();
    else this.dodgeVec.set(fx, fy);
    this.setState('dash');
    this.invulnT = 0.25;
    Sound.sfx('holy', 0.6);
    this.w.fx.glow(this.actor.x, this.actor.y - 20, 0xffe9a0, 50);
  }

  startAttack(heavy: boolean) {
    const p = G.p;
    if (heavy) {
      if (p.stamina < 18) {
        this.w.fx.number(this.actor.x, this.actor.y - 50, 'Yorgun!', 'miss');
        return;
      }
      p.stamina -= 18;
      this.staminaDelay = 0.8;
    }
    const aim = this.w.aimAssist(this.weaponReach());
    this.attackDir.copy(aim);
    this.actor.face(dirFromVec(aim.x, aim.y, this.actor.dir));
    const base = this.d.weaponType === 'bow' ? 0.55 : this.d.weaponType === 'spear' ? 0.48 : 0.42;
    this.attackDur = (base / this.d.attackSpeed) * (heavy ? 1.7 : 1);
    this.attackHitDone = false;
    this.setState(heavy ? 'heavy' : 'attack');
    const wt = this.d.weaponType;
    const anim = wt === 'bow' ? 'shoot' : wt === 'spear' ? 'thrust' : 'slash';
    const frames = anim === 'shoot' ? 13 : anim === 'thrust' ? 8 : 6;
    const fps = anim === 'shoot' ? 24 : anim === 'thrust' ? 18 : 16;
    this.actor.play(anim, { loop: false, restart: true, speed: frames / fps / this.attackDur });
    Sound.sfx(heavy ? 'heavy' : 'swing', 0.7);
  }

  startShield(amount: number, dur: number) {
    this.shield = amount;
    this.shieldT = dur;
    if (!this.shieldFx) {
      this.shieldFx = this.w.add.image(this.actor.x, this.actor.y - 22, 'light').setTint(0xffe28a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.45).setDepth(940000);
    }
  }

  endShield() {
    this.shield = 0;
    this.shieldT = 0;
    this.shieldFx?.destroy();
    this.shieldFx = null;
  }
}

export { dirVec };
