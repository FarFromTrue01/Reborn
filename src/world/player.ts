// Joseph'in kontrolcüsü.
import Phaser from 'phaser';
import { dodgeReady } from '../core/combat';
import { BASE_SPEED as MV_BASE, JOSEPH_WALK_MULT, RUN_MULT, naturalWalk, walkSetting } from '../core/movement';
import { MOVE_SPEED_CAP } from '../core/divine';
import { Actor, dirFromVec, dirVec, type Dir } from './actor';
import { G } from '../game/G';
import { Input } from '../game/input';
import { ITEMS } from '../data/items';
import { JOSEPH_BIG, JOSEPH_LAYERS, WEAPON_ROT, WEAPON_VISUALS } from '../data/manifest';
import type { LayerDef } from './actor';
import { attackFrameAt, attackPlan, impactTime, windupEnd, type AttackPlan } from './attackPlan';
import { TILE } from './types';
import { EQUIP_SLOTS } from '../core/types';
import type { WorldScene } from '../scenes/WorldScene';
import { Sound } from '../audio/audio';
import { hpRegenPerSec, mpRegenPerSec, staminaRegenPerSec } from '../core/formulas';
import { LIGHT_MAX, LIGHT_DECAY_PER_SEC } from '../core/divine';
import { runStep, RUN_THRESHOLD, type RunLock } from '../core/stamina';
import type { EvadeCost } from '../core/combat';
import { applyStatus, statusMods, tickStatuses, scaledDuration, type Status } from '../core/status';

export type PState = 'free' | 'attack' | 'heavy' | 'dodge' | 'hurt' | 'dead' | 'cast' | 'locked' | 'dash' | 'draw';

// kare/saniye (1.0x insanda); yoldaşlar da kullanır. Joseph'in ⅔ yürüme çarpanı core/movement'ta (0.8.0).
export { BASE_SPEED } from '../core/movement';

/** Savaş/saldırı olmadan silahın sırta konmasına kadar geçen süre (sn); güvenli yerde daha kısa. */
export const SHEATHE_AFTER = 6;
export const SHEATHE_AFTER_SAFE = 1.5;
/** Sırta koyma, çekme ve saldırıya bağlı hızlı çekme süreleri (sn). */
export const STOW_DUR = 0.35;
export const DRAW_DUR = 0.25;
export const QUICK_DRAW_DUR = 0.17;

/** Elde tutulan silahın (64 px karede) tutma noktası ve uç yönü (derece, ekran) — havada süzülme animasyonu için. */
const HAND_POSE: Record<Dir, { x: number; y: number; a: number }> = {
  down: { x: 42, y: 45, a: 80 },
  up: { x: 22, y: 45, a: 100 },
  left: { x: 27, y: 45, a: 125 },
  right: { x: 37, y: 45, a: 55 },
};

/** Elden sırta giden yolun kontrol noktası (karesel Bezier): omzun üstünden / sırt kenarından geçer, yüzün önünden değil. */
const CARRY_PATH_CTRL: Record<Dir, { x: number; y: number }> = {
  down: { x: 50, y: 20 },
  up: { x: 14, y: 22 },
  left: { x: 48, y: 38 },
  right: { x: 16, y: 38 },
};

/** Ortasından tutulan uzun silahlar: sırta giderken yay çizmez (0.8.0). */
const LONG_WEAPONS = new Set(['w_bow', 'w_spear']);
/** Havada süzülürken ölçek: yay iri görünüyordu (0.8.0 D6). */
const FLOAT_SCALE: Record<string, number> = { w_bow: 0.75 };

interface CarryMeta {
  item: { px: number; py: number; a: number };
  carry: Record<Dir, { x: number; y: number; a: number; front: boolean; flip?: boolean }>;
}

interface SheathAnim {
  kind: 'draw' | 'stow';
  t: number;
  dur: number;
  then: (() => void) | null;
  float: Phaser.GameObjects.Image | null;
  shown: boolean;
}

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
  /** Son kaçışın/atılmanın peşin bedeli; mükemmel kaçışta iade edilir (core/combat refundEvade). */
  evadePaid: EvadeCost = { stamina: 0, light: 0 };
  staminaDelay = 0;
  running = false;
  /** E3: yük (yaralı taşırken yavaşlar, koşamaz). 1 = yok. */
  burden = 1;
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
  /** Saldırı zaman çizelgesi (beceri saldırılarında null: eski davranış). */
  plan: AttackPlan | null = null;
  swingStarted = false;
  /** Eldeki silahın görünümü (WEAPON_VISUALS anahtarı). */
  weaponVisual: string | null = null;
  /** Silah sırtta/belde mi? */
  sheathed = false;
  /** Son saldırıdan beri geçen süre (sırta koyma için). */
  sinceAttack = 99;
  sheath: SheathAnim | null = null;
  /** Sırta koyma/çekme sırasında gövde elle sürülen thrust karelerinde (kol omza uzanır). */
  posing = false;
  // ---------------------------------------------------------------- 0.9.0 (skill sistemi)
  /** Joseph'in durum etkileri (goblin şamanının ateşi yakar; Arındırma siler). */
  statuses: Status[] = [];
  burnAcc = 0;
  /** Karşı Saldırı duruşu (Kılıç Ustalığı B-): kalan süre ve karşılık gücü. Divine'ın counterT'sinden ayrı. */
  parryT = 0;
  parryPower = 2;
  /** Hareketsiz geçen süre (Gizlilik S-: Gölge). */
  stillT = 0;
  /** Gölge: saldırana kadar görünmez. */
  hidden = false;
  /** Son saldırı Gölge'yi bozdu mu (Gizlilik X-: öldürünce geri gelir). */
  hiddenBroke = false;
  /** Mükemmel kaçıştan sonraki ilk vuruş kesin kritik (Kaçınma A-). */
  critNext = false;
  /** Son bedava kaçış (Kaçınma S-: 6 sn'de bir). */
  freeDodgeAt = -99;
  /** Kılıç kombosu: ardışık normal vuruş sayısı ve son vuruşun zamanı (Kılıç Ustalığı A-). */
  combo = 0;
  comboAt = -9;
  /** Savaştan çıkınca hızlı yenilenme (İlk Yardım C-). */
  afterCombatT = 0;
  private wasInCombat = false;
  /** Delici Hamle: atılma sırasında değen düşmanlara vuruş. */
  lungeHit: { power: number; hits: Set<any>; skill?: string } | null = null;

  constructor(public w: WorldScene, x: number, y: number) {
    this.actor = new Actor(w, x, y, ['j_body'], 'lpc');
    this.actor.enablePhysics(9);
    this.refreshLayers();
    // oyun açılışında savaş yoktur: silah sırtta başlar
    this.sheathed = this.canSheathe();
    this.applyWeaponMode();
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
    const list: { def: LayerDef; z: number }[] = [
      { def: { key: 'j_body' }, z: 10 },
      { def: { key: 'j_head' }, z: 100 },
    ];
    this.weaponVisual = null;
    for (const s of EQUIP_SLOTS) {
      const id = eq[s];
      if (!id) continue;
      const v = ITEMS[id]?.visual;
      if (!v) continue;
      const wv = WEAPON_VISUALS[v];
      if (wv) {
        this.weaponVisual = v;
        for (const h of wv.hand) if (JOSEPH_LAYERS[h]) list.push({ def: { key: 'j_' + h, role: 'hand' }, z: JOSEPH_LAYERS[h].z });
        for (const b of wv.big ?? []) {
          const sh = JOSEPH_BIG[b.key];
          if (sh) list.push({ def: { key: 'j_' + b.key, role: 'hand', big: { size: sh.size, anim: b.anim, reverse: b.reverse } }, z: b.z });
        }
        if (wv.carry) {
          list.push({ def: { key: 'j_' + v + '_carry', role: 'carry' }, z: JOSEPH_LAYERS[v + '_carry'].z });
          list.push({ def: { key: 'j_' + v + '_carry_bg', role: 'carry' }, z: JOSEPH_LAYERS[v + '_carry_bg'].z });
        }
        continue;
      }
      if (JOSEPH_LAYERS[v]) list.push({ def: { key: 'j_' + v }, z: JOSEPH_LAYERS[v].z });
      if (JOSEPH_LAYERS[v + '_bg']) list.push({ def: { key: 'j_' + v + '_bg' }, z: JOSEPH_LAYERS[v + '_bg'].z });
    }
    list.sort((a, b) => a.z - b.z);
    const wv = this.weaponVisual ? WEAPON_VISUALS[this.weaponVisual] : null;
    this.actor.walkCarried = !!wv?.walkCarried;
    this.actor.slashReverse = !!wv?.big?.some((b) => b.reverse);
    this.cancelSheath();
    this.actor.setLayers(list.map((l) => l.def));
    if (!this.canSheathe()) this.sheathed = false;
    this.applyWeaponMode();
  }

  // ================================================================= silahı sırta koyma / çekme
  canSheathe(): boolean {
    return G.settings.sheathWeapon !== false && !!this.weaponVisual && this.actor.hasCarry();
  }

  applyWeaponMode() {
    this.actor.weaponMode = this.sheath ? 'none' : this.sheathed ? 'carry' : 'hand';
    this.actor.applyFrame();
  }

  private carryMeta(): CarryMeta | null {
    const all = this.w.cache.json.get('weaponsMeta') as Record<string, CarryMeta> | undefined;
    return (this.weaponVisual && all?.[this.weaponVisual]) || null;
  }

  /** Animasyonsuz: silahı hemen sırta koy / ele al. */
  setSheathed(on: boolean) {
    this.cancelSheath();
    this.sheathed = on && this.canSheathe();
    this.applyWeaponMode();
  }

  private cancelSheath() {
    if (!this.sheath) return;
    this.sheath.float?.destroy();
    this.sheath = null;
    this.endPose();
  }

  private endPose() {
    if (this.posing) {
      this.posing = false;
      if (this.actor.manualFrame !== null) this.actor.play('idle');
    }
  }

  /** Sırta koyma ya da çekme animasyonunu başlat. `then`: bitince (hızlı çekmede saldırı). */
  beginSheath(kind: 'draw' | 'stow', fast = false, then: (() => void) | null = null) {
    this.cancelSheath();
    const meta = this.carryMeta();
    const key = 'j_' + this.weaponVisual + '_item';
    if (!meta || !this.w.textures.exists(key)) {
      this.sheathed = kind === 'stow';
      this.applyWeaponMode();
      then?.();
      return;
    }
    // önceden döndürülmüş sayfa: tutma noktası karenin ortasında
    const img = this.w.add.image(this.actor.x, this.actor.y, key, 0).setOrigin(0.5, 0.5).setVisible(false);
    this.sheath = { kind, t: 0, dur: kind === 'stow' ? STOW_DUR : fast ? QUICK_DRAW_DUR : DRAW_DUR, then, float: img, shown: false };
    if (kind === 'draw') this.sheathed = false;
    this.applyWeaponMode();
    Sound.sfx(kind === 'stow' ? 'sheathe' : 'draw', kind === 'stow' ? 0.45 : 0.6);
  }

  /** Savaş başlayınca: silah sırttaysa çek (animasyonlu, oyuncuyu durdurmaz). */
  drawForCombat() {
    if (!this.canSheathe() || this.state === 'locked' || this.state === 'dead' || this.w.cutscene) return;
    if (this.sheath?.kind === 'draw') return;
    if (this.sheathed || this.sheath?.kind === 'stow') this.beginSheath('draw');
  }

  /** Beceri saldırısı: silah hemen elde. */
  drawNow() {
    if (this.sheathed || this.sheath) this.setSheathed(false);
    this.sinceAttack = 0;
  }

  /** Her kare: süzülen silahı ilerlet, otomatik sırta koymayı denetle. `still`: oyuncu duruyor. */
  private tickSheath(dt: number, still: boolean) {
    if (!this.canSheathe()) {
      if (this.sheathed || this.sheath) this.setSheathed(false);
      return;
    }
    const sh = this.sheath;
    if (sh) {
      sh.t += dt;
      this.updateFloat(sh, still);
      if (sh.t >= sh.dur) {
        sh.float?.destroy();
        this.sheath = null;
        this.sheathed = sh.kind === 'stow';
        this.applyWeaponMode();
        this.endPose();
        sh.then?.();
      }
      return;
    }
    if (this.sheathed) return;
    const calm = this.w.weaponCalm();
    if (calm === 'scene') {
      // hikâye sahnesi / diyalog: silah sırtta dursun
      this.setSheathed(true);
      return;
    }
    const limit = calm === 'safe' ? SHEATHE_AFTER_SAFE : SHEATHE_AFTER;
    if (this.state === 'free' && Math.min(this.sinceAttack, this.combatT) >= limit) this.beginSheath('stow');
  }

  /** Süzülen silah: elden sırta (ya da tersi) yay çizerek; durarken gövde spellcast kareleriyle kolu kaldırır. */
  private updateFloat(sh: SheathAnim, still: boolean) {
    const a = this.actor;
    const meta = this.carryMeta()!;
    const k = Math.min(1, sh.t / sh.dur);
    const hand = HAND_POSE[a.dir];
    const back = meta.carry[a.dir];
    // yolculuk k ∈ [0.1, 0.75]
    const u = Math.max(0, Math.min(1, (k - 0.1) / 0.65));
    const e = u * u * (3 - 2 * u);
    const p = sh.kind === 'stow' ? e : 1 - e;
    // sırt: omzun üstünden / sırt kenarından; bel (hançer) ve uzun silahlar (yay, mızrak; 0.8.0 D6): elden düz —
    // yay ortasından tutulduğu için yay çizerse başın üstünden geçiyor, aşağı bakarken elden kopuk görünüyordu
    const long = LONG_WEAPONS.has(this.weaponVisual ?? '');
    const c = back.y >= 40 || long ? { x: (hand.x + back.x) / 2, y: (hand.y + back.y) / 2 } : CARRY_PATH_CTRL[a.dir];
    const x = (1 - p) * (1 - p) * hand.x + 2 * (1 - p) * p * c.x + p * p * back.x;
    const y = (1 - p) * (1 - p) * hand.y + 2 * (1 - p) * p * c.y + p * p * back.y;
    let da = back.a - hand.a;
    da = ((da + 540) % 360) - 180;
    const tip = hand.a + da * p;
    const f = sh.float;
    const arrived = k >= 0.75;
    if (f) {
      f.setVisible(!arrived);
      f.setPosition(Math.floor(a.x) + x - 32, Math.floor(a.y) + y - 61 - a.liftY);
      // sırttaki görüntü aynalanmışsa (yay, sağ yön) yolun ikinci yarısında süzülen silah da aynalanır
      const flip = !!back.flip && p > 0.5;
      const deg = flip ? 180 - tip : tip;
      const step = 360 / WEAPON_ROT.steps;
      f.setFrame(((Math.round(deg / step) % WEAPON_ROT.steps) + WEAPON_ROT.steps) % WEAPON_ROT.steps);
      f.setFlipX(flip);
      f.setScale(FLOAT_SCALE[this.weaponVisual ?? ''] ?? 1);
      // elden çıkınca gövdenin arkasından geçer (sırtı dönükken sırtın üstünde): yüzün önünden geçmez
      // uzun silah yukarı bakarken başın arkasından geçer (kiriş başın üstünden geçmesin)
      const front = long && a.dir === 'up' ? false : p < 0.15 ? a.dir !== 'up' : back.front;
      f.setDepth(a.depth + (front ? 0.5 : -0.5));
    }
    if (arrived && !sh.shown) {
      sh.shown = true;
      if (sh.kind === 'stow') this.sheathed = true;
      // görünüm: sırtta (stow) ya da elde (draw)
      a.weaponMode = sh.kind === 'stow' ? 'carry' : 'hand';
      a.applyFrame();
      if (sh.kind === 'draw') {
        this.w.fx.glint(Math.floor(a.x) + hand.x - 32, Math.floor(a.y) + hand.y - 64);
        this.endPose();
      }
    }
    // gövde: yalnızca dururken (yürürken bacaklar yürümeye devam eder). Thrust 1–3: kol omza/sırta uzanır.
    if (still && !(sh.kind === 'draw' && arrived) && (this.state === 'free' || this.state === 'draw')) {
      const seq = sh.kind === 'stow' ? (k < 0.2 ? 1 : k < 0.45 ? 2 : k < 0.8 ? 3 : 1) : (k < 0.3 ? 3 : k < 0.55 ? 2 : 1);
      if (!this.posing || a.anim !== 'thrust') a.play('thrust', { loop: false });
      this.posing = true;
      a.setManualFrame(seq);
    } else if (!still && this.posing) this.posing = false;
  }

  /** Dünya duraklatılmışken (menü, Appraisal, dükkân): hız sıfır, yürüme yerine idle. */
  holdStill() {
    const a = this.actor;
    a.body2?.setVelocity(0, 0);
    if ((this.state === 'free' || this.state === 'locked') && (a.anim === 'walk' || a.anim === 'run')) a.play('idle');
  }

  setState(s: PState) {
    this.state = s;
    this.stateT = 0;
    if (s !== 'attack' && s !== 'heavy') this.plan = null;
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

    this.parryT -= dt;
    // savaştan çıkınca 5 sn hızlı yenilenme (İlk Yardım C-)
    if (this.wasInCombat && !this.inCombat && d.fx.afterCombatRegen) this.afterCombatT = 5;
    this.wasInCombat = this.inCombat;
    this.afterCombatT -= dt;
    // durum etkileri (yanma hasarı saniyede bir yazılır)
    if (this.statuses.length && this.state !== 'dead') {
      const r = tickStatuses(this.statuses, dt);
      this.statuses = r.list;
      this.burnAcc += r.burn;
      if (this.burnAcc >= 0.5 || (this.burnAcc > 0 && !this.statuses.some((x) => x.kind === 'burn'))) {
        this.w.burnPlayer(this.burnAcc);
        this.burnAcc = 0;
      }
    }
    // Gölge (Gizlilik S-): 3 sn hareketsiz kalınca saldırana kadar görünmez
    const movingNow = Math.hypot(Input.moveX, Input.moveY) > 0.08 && this.state === 'free';
    this.stillT = movingNow || this.state !== 'free' ? 0 : this.stillT + dt;
    const hide = !!d.fx.shadow && this.stillT >= 3;
    if (hide && !this.hidden) {
      this.hidden = true;
      this.w.fx.glow(this.actor.x, this.actor.y - 20, 0x6a4aa0, 40, 400);
    }
    this.actor.setAlpha(this.hidden ? 0.45 : 1);
    // yenilenme
    if (this.state !== 'dead') {
      const ad = d.divAdaptation * (G.state.divine.skills.includes('guardian_aura') && this.inCombat ? 1.5 : 1);
      const fast = this.afterCombatT > 0 ? 3 : 1;
      p.hp = Math.min(d.maxHp, p.hp + hpRegenPerSec(d.maxHp, ad, this.inCombat, d.regenBonus) * fast * dt);
      p.mp = Math.min(d.maxMp, p.mp + mpRegenPerSec(d.maxMp, d.stats.MNA, ad, this.inCombat) * dt);
      if (this.staminaDelay <= 0) p.stamina = Math.min(d.maxStamina, p.stamina + staminaRegenPerSec(d.stats.AGI, ad, this.inCombat) * (1 + (d.fx.staminaRegenPct ?? 0)) * dt);
      for (const b of this.buffs) {
        b.t -= dt;
        if (b.id === 'regen' && b.amount) p.hp = Math.min(d.maxHp, p.hp + b.amount * d.healMult * dt);
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

    this.sinceAttack += dt;
    {
      const moving = Math.hypot(Input.moveX, Input.moveY) > 0.08 && (this.state === 'free');
      if (this.state !== 'dead') this.tickSheath(dt, !moving);
      else if (this.sheath) this.cancelSheath();
    }

    if (a.frozenT > 0) {
      body.setVelocity(0, 0);
      return;
    }
    // geri tepme (Demir Beden B-: Taş Kök — savrulmaz)
    if (d.fx.noKnockback) a.kb.set(0, 0);
    if (a.kb.lengthSq() > 4) {
      body.setVelocity(a.kb.x, a.kb.y);
      a.kb.scale(Math.pow(0.0004, dt));
      a.setDepth(a.y);
      return;
    }

    const mx = Input.moveX, my = Input.moveY;
    const mlen = Math.min(1, Math.hypot(mx, my));
    switch (this.state) {
      case 'locked': {
        // diyalog/ara sahne: yerinde yürümesin. Senaryo Joseph'i yürütürken hızı her kare kendisi verir
        // (director.walk / followUntilNear zamanlayıcıları bu güncellemeden önce çalışır).
        const scripted = body.velocity.lengthSq() > 1;
        body.setVelocity(0, 0);
        if (!scripted && (a.anim === 'walk' || a.anim === 'run')) a.play('idle');
        if (!this.w.cutscene && Input.consume('appraise')) this.w.appraiseNearest();
        break;
      }
      case 'dead':
        body.setVelocity(0, 0);
        break;
      case 'free': {
        // eylemler
        if (Input.consume('dodge')) { this.tryDodge(); break; }
        if (Input.consume('attack')) { this.attackPressed(false); break; }
        if (Input.consume('heavy')) { this.attackPressed(true); break; }
        for (let i = 1; i <= 4; i++) if (Input.consume(('skill' + i) as any)) this.w.useSkillSlot(i - 1);
        for (let i = 1; i <= 3; i++) if (Input.consume(('div' + i) as any)) this.w.useDivineSlot(i - 1);
        if (Input.consume('interact')) this.w.interact();
        if (Input.consume('appraise')) this.w.appraiseNearest();
        if (Input.consume('eat')) this.w.eatQuick();
        // hareket
        const wantRun = (Input.run || (Input.touchMove && mlen > RUN_THRESHOLD)) && mlen > 0.2 && this.burden >= 1;
        // Kilit, istek bırakılınca ya da dayanıklılık tamamen dolunca kalkar (joystick sonda kalırsa yeniden koşar).
        this.running = runStep(this.runLock, wantRun, p.stamina, d.maxStamina);
        // 0.8.0: yalnızca Joseph'e ⅔ yürüme çarpanı; Ayarlar → Hareket hızı yalnızca yavaşlatabilir (çarpan ≤ 1)
        const walk = walkSetting(naturalWalk(d.moveSpeed), G.settings.walkSpeed);
        let sp = MV_BASE * TILE * d.moveSpeed * JOSEPH_WALK_MULT * mlen * walk.mult * this.burden * statusMods(this.statuses).speed;
        if (this.running) {
          sp *= RUN_MULT;
          // Atletizm S- (Sonsuz Adım): savaş dışında koşmak dayanıklılık harcamaz
          if (!(d.fx.freeRun && !this.inCombat)) p.stamina = Math.max(0, p.stamina - 11 * d.runCostMult * dt);
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
          a.animSpeed = Math.max(0.5, sp / (MV_BASE * TILE * JOSEPH_WALK_MULT * 0.5) * 0.9) * (this.running ? 0.75 : 1);
          this.stepT -= dt * (this.running ? 1.6 : 1);
          if (this.stepT <= 0) {
            this.stepT = 0.32;
            Sound.sfx('step', 0.5);
            if (this.running) this.w.fx.dust(a.x, a.y, 2);
          }
        } else {
          body.setVelocity(0, 0);
          // sırta koyma/çekme sırasında gövde spellcast karelerini oynatır (tickSheath)
          if (!(this.sheath && this.posing)) a.play('idle');
        }
        break;
      }
      case 'draw': {
        // saldırı tuşuyla hızlı çekme: bitince saldırı hemen gelir (tickSheath → then)
        body.setVelocity(body.velocity.x * 0.7, body.velocity.y * 0.7);
        if (Input.consume('dodge')) {
          this.setSheathed(false);
          this.setState('free');
          this.tryDodge();
        } else if (!this.sheath) this.setState('free');
        break;
      }
      case 'attack':
      case 'heavy': {
        if (this.plan) {
          this.updateAttack(dt);
          break;
        }
        // beceri saldırıları (zaman çizelgesiz): eski davranış
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
        // Karşı Saldırı duruşu sürerken yerinde kalır; kaçış duruşu bozar
        if (this.parryT > 0 && Input.consume('dodge')) {
          this.parryT = 0;
          this.setState('free');
          this.tryDodge();
          break;
        }
        if (this.stateT > 0.45 && this.parryT <= 0) {
          this.setState('free');
          a.play('idle');
        }
        break;
      }
      case 'dodge':
      case 'dash': {
        const dur = this.state === 'dash' ? 0.18 : 0.32;
        const k = 1 - this.stateT / dur;
        // kaçış mesafesi 0.8.0'daki hız düşüşünden etkilenmez: Divine Hız'ın eski tabanıyla (1) hesaplanır
        const dodgeMove = Math.min(MOVE_SPEED_CAP, (d.moveSpeed / Math.max(0.01, d.divSpeed)) * Math.max(1, d.divSpeed));
        const sp = (this.state === 'dash' ? 13 : 7.2) * TILE * (0.4 + 0.6 * k) * Math.max(0.75, Math.sqrt(dodgeMove));
        body.setVelocity(this.dodgeVec.x * sp, this.dodgeVec.y * sp);
        if (Math.floor(this.stateT / 0.05) !== Math.floor((this.stateT - dt) / 0.05)) this.w.fx.ghost(a, this.lungeHit ? 0xbfe4ff : this.state === 'dash' ? 0xffe9a0 : 0x9fd6ff);
        if (this.lungeHit) this.w.lungeContact(this);
        if (this.stateT >= dur) {
          this.lungeHit = null;
          this.setState('free');
          a.play('idle');
        }
        break;
      }
      case 'hurt': {
        body.setVelocity(0, 0);
        if (this.stateT > 0.28 * (1 + (d.fx.stunDurPct ?? 0))) {
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
    // Kaçınma S- (Rüzgâr Gibi): 6 sn'de bir kaçış bedava ve 0,8 sn beklemeyi yok sayar
    const free = !!this.d.fx.freeDodge && this.t - this.freeDodgeAt >= 6;
    // 0.8.0: bedel 7,5 (× dodgeCostMult), iki kaçış arasında 0,8 sn bekleme
    const r = free ? { ok: true, cost: 0, reason: undefined } : dodgeReady(this.t, this.dodgeStart, p.stamina, this.d.dodgeCostMult);
    const cost = r.cost;
    if (free) this.freeDodgeAt = this.t;
    if (r.reason === 'cooldown') return;
    if (!r.ok) {
      this.w.fx.number(this.actor.x, this.actor.y - 50, 'Yorgun!', 'miss');
      Sound.sfx('error', 0.4);
      return;
    }
    p.stamina -= cost;
    this.evadePaid = { stamina: cost, light: 0 };
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

  /** Joseph'e durum etkisi (İlk Yardım B-: olumsuz etkiler kısa sürer). */
  addStatus(st: Status) {
    const r = applyStatus(this.statuses, { ...st, t: scaledDuration(st.t, this.d.fx.debuffDurPct ?? 0) }, { level: G.p.level }, 999);
    this.statuses = r.list;
  }

  /** Yetenekle atılma (Delici Hamle, Yıldırım Adımı): dash durumu, yön verilir. */
  techDash(dir: { x: number; y: number }, lunge: { power: number; skill?: string } | null) {
    this.dodgeVec.set(dir.x, dir.y).normalize();
    this.lungeHit = lunge ? { ...lunge, hits: new Set() } : null;
    this.setState('dash');
    this.invulnT = 0.22;
  }

  lightDash(lightCost = 0) {
    this.evadePaid = { stamina: 0, light: lightCost };
    const [fx, fy] = dirVec(this.actor.dir);
    const mx = Input.moveX, my = Input.moveY;
    if (Math.hypot(mx, my) > 0.2) this.dodgeVec.set(mx, my).normalize();
    else this.dodgeVec.set(fx, fy);
    this.setState('dash');
    this.invulnT = 0.25;
    Sound.sfx('holy', 0.6);
    this.w.fx.glow(this.actor.x, this.actor.y - 20, 0xffe9a0, 50);
  }

  /** Saldırı tuşu: silah sırttaysa önce hızlıca çek, saldırı hemen arkasından. */
  attackPressed(heavy: boolean) {
    const sh = this.sheath;
    if (sh?.kind === 'stow' && !sh.shown) {
      // sırta koyarken: silah henüz elden çıkmadı, doğrudan saldır
      this.setSheathed(false);
    } else if (this.sheathed || sh) {
      if (sh?.kind !== 'draw') this.beginSheath('draw', true);
      else sh.dur = Math.min(sh.dur, Math.max(sh.t + 0.05, QUICK_DRAW_DUR));
      if (this.sheath) {
        this.sheath.then = () => {
          if (this.state === 'draw') this.setState('free');
          if (this.state === 'free') this.startAttack(heavy);
        };
        this.setState('draw');
        this.sinceAttack = 0;
        return;
      }
    }
    this.startAttack(heavy);
  }

  startAttack(heavy: boolean) {
    const p = G.p;
    if (heavy) {
      // Kılıç Ustalığı G-: kılıçla saldırıların dayanıklılık maliyeti -%10
      const wt = this.d.weaponType;
      const cost = 18 * (1 + (this.d.fx.atkStamina?.any ?? 0) + (wt ? this.d.fx.atkStamina?.[wt] ?? 0 : 0));
      if (p.stamina < cost) {
        this.w.fx.number(this.actor.x, this.actor.y - 50, 'Yorgun!', 'miss');
        return;
      }
      p.stamina -= cost;
      this.staminaDelay = 0.8;
    }
    if (this.sheathed || this.sheath) this.setSheathed(false);
    const aim = this.w.aimAssist(this.weaponReach());
    this.attackDir.copy(aim);
    this.actor.face(dirFromVec(aim.x, aim.y, this.actor.dir));
    const base = this.d.weaponType === 'bow' ? 0.55 : this.d.weaponType === 'spear' ? 0.48 : 0.42;
    // Savaş Lordu (Savaş Narası B-): naradan sonra saldırı hızı
    const haste = this.buffs.find((b) => b.id === 'shout_haste')?.amount ?? 0;
    this.attackDur = (base / (this.d.attackSpeed * (1 + haste))) * (heavy ? 1.7 : 1);
    // saldırınca Gölge bozulur (Hayalet: öldürürse geri gelir)
    this.hiddenBroke = this.hidden;
    this.hidden = false;
    this.stillT = 0;
    this.attackHitDone = false;
    this.setState(heavy ? 'heavy' : 'attack');
    this.plan = attackPlan(this.d.weaponType, heavy);
    this.swingStarted = false;
    this.sinceAttack = 0;
    this.actor.play(this.plan.anim, { loop: false, restart: true });
    this.actor.setManualFrame(0);
    if (this.plan.hold > 0 && this.plan.anim !== 'shoot') Sound.sfx('windup', 0.35);
  }

  /** Saldırı zaman çizelgesi: kareler, hazırlanma (kaçışla iptal), savuruş/atılma, darbe karesinde hasar. */
  private updateAttack(_dt: number) {
    const p = this.plan!;
    const a = this.actor;
    const body = a.body2;
    const D = this.attackDur, t = this.stateT;
    const heavy = this.state === 'heavy';
    const fr = attackFrameAt(p, t, D);
    a.setManualFrame(fr.frame);
    const dir = this.attackDir;
    if (fr.phase !== 'swing') {
      // hazırlanma: silahı geriye çekerken hafifçe geri kayar; kaçış iptal eder
      const wd = Math.max(0.05, windupEnd(p, D));
      const back = fr.phase === 'hold' ? p.pullBack / wd : 0;
      body.setVelocity(-dir.x * back, -dir.y * back);
      if (fr.phase === 'hold' && Input.peek('dodge')) {
        Input.consume('dodge');
        this.plan = null;
        this.setState('free');
        a.play('idle');
        this.tryDodge();
      }
      return;
    }
    if (!this.swingStarted) {
      this.swingStarted = true;
      if (p.anim !== 'shoot') Sound.sfx(heavy ? 'heavy' : 'swing', 0.7);
      if (p.trail) {
        const reach = this.weaponReach() * TILE;
        const thrust = p.anim === 'thrust';
        this.w.fx.swingTrail(a.x + dir.x * (thrust ? 10 : 2), a.y - 16 + dir.y * (thrust ? 10 : 2), dir.angle(), 0xffe2a0,
          thrust ? reach * 0.85 : Math.max(26, reach * 0.9), thrust ? 0.35 : 2.6, thrust ? 110 : 150);
      }
    }
    // öne adım / atılma: savuruşun başında hızlı, sonra azalır
    const wEnd = windupEnd(p, D);
    const k = Math.min(1, (t - wEnd) / Math.max(0.05, D - wEnd));
    if (p.lunge > 0 && k < 0.6) {
      const v = p.lunge * TILE * (1 - k / 0.6);
      body.setVelocity(dir.x * v, dir.y * v);
      if (heavy && Math.floor(t / 0.05) !== Math.floor((t - _dt) / 0.05)) this.w.fx.dust(a.x, a.y, 1);
    } else body.setVelocity(body.velocity.x * 0.75, body.velocity.y * 0.75);
    if (!this.attackHitDone && t >= impactTime(p, D)) {
      this.attackHitDone = true;
      this.w.playerStrike(heavy, dir);
      if (p.release) {
        Sound.sfx('bowstring', heavy ? 0.9 : 0.6);
        this.w.fx.bowRelease(a.x + dir.x * 14, a.y - 24 + dir.y * 10, dir.angle(), heavy);
      }
    }
    if (p.release && heavy && this.attackHitDone) {
      // güçlü atışın geri tepmesi
      const r = 70 * Math.max(0, 1 - (t - impactTime(p, D)) / 0.2);
      body.setVelocity(-dir.x * r, -dir.y * r);
    }
    if (t >= D) {
      this.plan = null;
      this.setState('free');
      a.play('idle');
    } else if (t > D * 0.75 && Input.peek('dodge')) {
      // geç iptal: kaçış ile
      Input.consume('dodge');
      this.plan = null;
      this.setState('free');
      this.tryDodge();
    }
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
