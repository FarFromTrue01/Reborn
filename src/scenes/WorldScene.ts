import Phaser from 'phaser';
import { G } from '../game/G';
import { Display } from '../game/display';
import { Input } from '../game/input';
import { Sound } from '../audio/audio';
import { type BuildingMeta } from '../world/worldgen';
import { buildMaps } from '../world/maps';
import { renderMap, type RenderedMap } from '../world/mapRender';
import { Lighting } from '../world/lighting';
import { FX } from '../world/fx';
import { Player } from '../world/player';
import { Enemy } from '../world/enemy';
import { Npc } from '../world/npc';
import { Companion } from '../world/companion';
import { TILE, type MapData, type Zone, type PropPlacement } from '../world/types';
import { COMPANIONS } from '../data/companions';
import { NPCS, NPC_BY_ID, scheduleAt, CASTE_BUBBLES, TONE_LINES, type NpcDef, type JosephStatus } from '../data/npcs';
import { josephStatusOf, toneOf, type Tone } from '../core/prestige';
import { nearestFree } from '../world/path';
import { PropCollision, blockedAt } from '../world/collision';
import { daylight, hourOf, advance } from '../core/time';
import { resolvePhysical, resolveSpell } from '../world/combat';
import { monsterExp, rollDrops, splitExp } from '../core/monster';
import { usageExp, achievementExp, techniquesOf } from '../core/skills';
import { TECHNIQUES } from '../data/skills';
import { ITEMS } from '../data/items';
import { DIVINE_BY_ID } from '../data/divine';
import { LIGHT_MAX, LIGHT_ON_HIT, LIGHT_ON_PERFECT_DODGE } from '../core/divine';
import { loseMoneyPercent } from '../core/transactions';
import { walletTotal } from '../core/money';
import { appraisalBaseExp, noticesAppraisal, appraisalReady, claimAppraisalExp } from '../core/appraisal';
import { newEatState, type EatState } from '../core/eating';
import { spellPowerMult } from '../core/formulas';
import { dirFromVec, dirVec, type Dir } from '../world/actor';
import * as R from '../game/rules';
import type { UIScene } from './UIScene';
import { Director } from '../story/director';
import { Q } from '../game/questrt';
import { scheduleAt as schedAt } from '../data/npcs';

let WORLD_CACHE: MapData | null = null;
/** Kamera ölü bölgesi (dünya pikseli, yarım genişlik/yükseklik) ve dikey ofset. Tamsayı: yuvarlama tutarlı kalır. */
const CAM_DEAD_X = 18, CAM_DEAD_Y = 12, CAM_OFFSET_Y = 20;
let INTERIORS: Record<string, MapData> | null = null;
const FOG: Record<string, Uint8Array> = {};

export function getMap(scene: Phaser.Scene, id: string): MapData {
  const bmeta = scene.cache.json.get('buildingsMeta') as Record<string, BuildingMeta>;
  if (!WORLD_CACHE || !INTERIORS) {
    const all = buildMaps(bmeta, scene.cache.json.get('terrainMeta').floors);
    WORLD_CACHE = all.world;
    INTERIORS = all.interiors;
  }
  if (id === 'world') return WORLD_CACHE;
  return INTERIORS[id] ?? WORLD_CACHE;
}

export function fogOf(m: MapData): Uint8Array {
  if (!FOG[m.id]) {
    const saved = G.state.fog[m.id];
    const arr = new Uint8Array(m.w * m.h);
    if (saved) {
      try {
        const bin = atob(saved);
        for (let i = 0; i < arr.length; i++) arr[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
      } catch { /* bozuk */ }
    }
    FOG[m.id] = arr;
  }
  return FOG[m.id];
}

export function clearFogCache() {
  for (const k of Object.keys(FOG)) delete FOG[k];
}

function encodeFog(arr: Uint8Array) {
  const bytes = new Uint8Array(Math.ceil(arr.length / 8));
  for (let i = 0; i < arr.length; i++) if (arr[i]) bytes[i >> 3] |= 1 << (i & 7);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

interface Pickup { img: Phaser.GameObjects.Image; id: string; qty: number; money: number; x: number; y: number; t: number }
interface Projectile { img: Phaser.GameObjects.Image; vx: number; vy: number; life: number; fromPlayer: boolean; comp?: Companion; enemy?: Enemy; tech?: string; power: number; radius: number; hits: Set<Enemy>; ignite?: boolean; element?: string; physical?: boolean }

export class WorldScene extends Phaser.Scene {
  mapData!: MapData;
  r!: RenderedMap;
  player!: Player;
  enemies: Enemy[] = [];
  npcs: Npc[] = [];
  fx!: FX;
  lighting!: Lighting;
  ui!: UIScene;
  director!: Director;
  cutscene = false;
  paused = false;
  /** A4: menü / Appraisal açıkken dünya tamamen durur (zaman, NPC, düşman, zamanlayıcı, tween). Müzik sürer. */
  frozen = false;
  private freezeReasons = new Set<string>();
  darkness = 0;
  timeAcc = 0;
  pickups: Pickup[] = [];
  projectiles: Projectile[] = [];
  /** C4: haritadaki yoldaşlar (G.state.party'den kurulur). */
  companions: Companion[] = [];
  incoming: { e: Enemy; at: number }[] = [];
  bubbleGlobalCd = 0;
  zone: Zone | null = null;
  inBattle = false;
  battleT = 0;
  fogT = 0;
  ambientT = 0;
  appraiseEventT = 40;
  collider: Phaser.Physics.Arcade.Collider | null = null;
  /** Dekorların piksel çarpışma kutuları (bu harita). */
  propCol: PropCollision | null = null;
  killsThisCombat: Record<string, number> = {};
  lowHpWin = false;
  warpCooldown = 0;
  lockedMsgT = 0;
  slowmoT = 0;
  rays: Phaser.GameObjects.Image[] = [];
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  lastHour = -1;
  transitioning = false;
  private zoneNameShown = '';
  /** Oyun açıkken (duraklatılmamış) geçen gerçek saniye: yemek beklemeleri için. */
  playClock = 0;
  eatState: EatState = newEatState();
  private lastAppraiseAt: number | null = null;
  /** C7: otomatik kayıt sayacı (gerçek saniye, oyun açıkken). */
  autoSaveT = 0;
  private questT = 0;
  questArrow!: Phaser.GameObjects.Graphics;
  assistMark!: Phaser.GameObjects.Graphics;
  assistMarkT = 0;
  assistLast: Enemy | null = null;

  constructor() {
    super('World');
  }

  init(data: { map?: string; x?: number; y?: number; facing?: string }) {
    if (data.map) {
      G.state.pos.map = data.map;
      if (data.x !== undefined) G.state.pos.x = data.x;
      if (data.y !== undefined) G.state.pos.y = data.y;
      if (data.facing) G.state.pos.facing = data.facing;
    }
  }

  create() {
    G.inGame = true;
    // önceki oturumdan kalan durdurma/gizleme durumlarını sıfırla
    this.freezeReasons.clear();
    this.frozen = false;
    this.paused = false;
    this.time.paused = false;
    this.sys.setVisible(true);
    this.fx = new FX(this);
    this.cameras.main.setZoom(Display.worldZoom);
    this.cameras.main.setBackgroundColor('#07060b');
    // roundPixels açık: Phaser hem kaydırmayı hem sprite konumunu dünya pikseline yuvarlar (floor).
    // Kamerayı Joseph'e TAMSAYI bir ofsetle bağladığımızda iki yuvarlama hep aynı sonucu verir (A2).
    this.cameras.main.setRoundPixels(true);
    // Fizik adımı ekran yenileme hızıyla uyumlu: sabit 60 Hz adım 120 Hz ekranda takılma yapıyordu (A2).
    this.physics.world.fixedStep = false;
    // Dekor kutuları: her fizik adımından sonra dairesel gövdeleri dışarı it
    this.physics.world.on('worldstep', () => this.resolvePropCollisions());
    // Kamera, fizik gövdeleri sprite'lara aktarıldıktan SONRA güncellenir (bir kare gecikme yok).
    this.events.on('postupdate', () => {
      if (!this.paused && !this.frozen) this.updateCamera();
      this.snapActors();
      this.drawQuestArrow();
      this.drawAssistMark();
      // kaydırmadan (worldView bir kare geride kalabilir) görünen alanı hesapla
      const cam = this.cameras.main, z = cam.zoom;
      const b = cam.getBounds();
      const vw = cam.width / z, vh = cam.height / z;
      const vx = Phaser.Math.Clamp(cam.scrollX + cam.width / 2 - vw / 2, b.x, Math.max(b.x, b.right - vw));
      const vy = Phaser.Math.Clamp(cam.scrollY + cam.height / 2 - vh / 2, b.y, Math.max(b.y, b.bottom - vh));
      this.viewRect.setTo(vx, vy, vw, vh);
      this.r?.culler?.update(this.viewRect);
    });
    this.lighting = new Lighting(this);
    this.lighting.quality = G.settings.quality;
    this.setupKeys();
    if (!this.scene.isActive('UI')) this.scene.launch('UI');
    this.ui = this.scene.get('UI') as UIScene;
    this.director = new Director(this);
    this.loadMap(G.state.pos.map, G.state.pos.x, G.state.pos.y, G.state.pos.facing, true);
    const off = Display.onResize(() => this.onResize());
    this.events.once('shutdown', () => {
      off();
      G.inGame = false;
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      Sound.unlock();
      if (p.wasTouch || this.cutscene) return;
      if (p.rightButtonDown()) Input.press('dodge');
      else if (p.leftButtonDown()) {
        // Fareyle bir NPC'ye tıklamak: Appraisal (saldırı değil)
        const t = this.creatureAtScreen(p.x, p.y);
        if (t && (t.kind === 'npc' || t.kind === 'self')) {
          this.tapAppraise(t);
          return;
        }
        Input.aim = { x: p.worldX, y: p.worldY };
        Input.press('attack');
      }
    });
    this.input.mouse?.disableContextMenu();
    const onSettings = () => (this.lighting.quality = G.settings.quality);
    G.events.on('settings', onSettings);
    this.events.once('shutdown', () => G.events.off('settings', onSettings));
    this.questArrow = this.add.graphics().setDepth(966000);
    this.assistMark = this.add.graphics().setDepth(-40500);
    this.time.delayedCall(50, () => this.director.onWorldReady());
  }

  onResize() {
    this.cameras.main.setSize(Display.w, Display.h);
    this.cameras.main.setZoom(Display.worldZoom);
    this.lighting.resize();
    this.updateCameraBounds();
  }

  setupKeys() {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({
      w: K.W, a: K.A, s: K.S, d: K.D, up: K.UP, left: K.LEFT, down: K.DOWN, right: K.RIGHT,
      shift: K.SHIFT, space: K.SPACE, j: K.J, k: K.K, e: K.E, q: K.Q, esc: K.ESC, tab: K.TAB, m: K.M,
      one: K.ONE, two: K.TWO, three: K.THREE, four: K.FOUR, z: K.Z, x: K.X, c: K.C, f: K.F, ctrl: K.CTRL,
    }) as any;
    kb.on('keydown', (ev: KeyboardEvent) => {
      Sound.unlock();
      if (this.cutscene && ev.code !== 'Escape') {
        if (ev.code === 'Space' || ev.code === 'Enter' || ev.code === 'KeyE') this.ui.advanceDialogue();
        return;
      }
      if (this.ui.dialogueOpen()) {
        if (ev.code === 'Space' || ev.code === 'Enter' || ev.code === 'KeyE') this.ui.advanceDialogue();
        return;
      }
      switch (ev.code) {
        case 'Space': Input.press('dodge'); break;
        case 'KeyJ': Input.aim = null; Input.press('attack'); break;
        case 'KeyK': Input.press('heavy'); break;
        case 'KeyE': case 'Enter': Input.press('interact'); break;
        case 'KeyQ': Input.press('appraise'); break;
        case 'KeyF': Input.press('eat'); break;
        case 'Digit1': Input.press('skill1'); break;
        case 'Digit2': Input.press('skill2'); break;
        case 'Digit3': Input.press('skill3'); break;
        case 'Digit4': Input.press('skill4'); break;
        case 'KeyZ': Input.press('div1'); break;
        case 'KeyX': Input.press('div2'); break;
        case 'KeyC': Input.press('div3'); break;
        case 'Escape': case 'Tab': ev.preventDefault?.(); this.ui.openMenu(); break;
        case 'KeyM': this.ui.openMenu('map'); break;
      }
    });
  }

  // ================================================================= harita
  loadMap(id: string, tx: number, ty: number, facing: string, first = false) {
    // temizle
    for (const e of this.enemies) e.destroy();
    for (const n of this.npcs) n.destroy();
    for (const c of this.companions) c.destroy();
    this.companions = [];
    for (const p of this.pickups) p.img.destroy();
    for (const p of this.projectiles) p.img.destroy();
    for (const r of this.rays) r.destroy();
    this.enemies = [];
    this.npcs = [];
    this.pickups = [];
    this.projectiles = [];
    this.rays = [];
    if (this.r) {
      for (const o of this.r.objects) {
        this.tweens.killTweensOf(o);
        o.destroy();
      }
      this.r.map.destroy();
    }
    if (this.collider) this.collider.destroy();
    if (this.player) {
      this.player.endShield();
      this.player.actor.destroy();
    }
    this.mapData = getMap(this, id);
    const m = this.mapData;
    this.r = renderMap(this, m, this.cache.json.get('terrainMeta'), this.cache.json.get('buildingsMeta'));
    this.physics.world.setBounds(0, 0, m.w * TILE, m.h * TILE);
    this.propCol = new PropCollision(m.colliders, m.w);
    // oyuncu
    if (!tx && !ty && m.points.wake) {
      tx = m.points.wake.x;
      ty = m.points.wake.y;
    }
    G.state.pos = { map: id, x: tx, y: ty, facing };
    this.player = new Player(this, tx * TILE + TILE / 2, ty * TILE + TILE / 2 + 6);
    this.player.actor.face(facing as Dir);
    this.collider = this.physics.add.collider(this.player.actor, this.r.collide);
    this.updateCameraBounds();
    this.camFollow = true;
    this.camX = this.player.actor.x;
    this.camY = this.player.actor.y - CAM_OFFSET_Y;
    this.applyCamera();
    this.lighting.setLights(this.r.lights);
    // düşmanlar ve NPC'ler
    this.spawnEnemies();
    this.spawnNpcs();
    this.spawnCompanions();
    // ortam
    if (!m.indoor) this.makeRays();
    this.zone = null;
    this.updateZone(true);
    this.warpCooldown = 0.6;
    this.ui?.onMapChanged?.();
    if (!first) this.director.onEnterMap(id);
  }

  /**
   * Kamera takibi (A2): küçük bir ölü bölge + ekran pikseline hizalı kaydırma.
   * Joseph ölü bölgenin içindeyken kamera hiç oynamaz; kenara dayanınca onunla birlikte,
   * aynı ofsetle kayar. Kaydırma 1/zoom adımına yuvarlandığı için sprite ile kamera
   * aynı yönde yuvarlanır ve yavaş yürüyüşte 1 piksellik ileri-geri titreme oluşmaz.
   */
  camFollow = true;
  viewRect = new Phaser.Geom.Rectangle();
  camX = 0;
  camY = 0;
  updateCamera() {
    if (!this.camFollow || !this.player) return;
    const a = this.player.actor;
    const tx = a.x, ty = a.y - CAM_OFFSET_Y;
    if (tx > this.camX + CAM_DEAD_X) this.camX = tx - CAM_DEAD_X;
    else if (tx < this.camX - CAM_DEAD_X) this.camX = tx + CAM_DEAD_X;
    if (ty > this.camY + CAM_DEAD_Y) this.camY = ty - CAM_DEAD_Y;
    else if (ty < this.camY - CAM_DEAD_Y) this.camY = ty + CAM_DEAD_Y;
    this.applyCamera();
  }

  applyCamera() {
    const cam = this.cameras.main;
    // scroll = hedef − tamsayı: kesirli kısmı Joseph'inkiyle aynı kalır, floor() tutarlı olur.
    // Sınırlar Phaser tarafından (floor sonrası) uygulanır.
    cam.setScroll(this.camX - Math.floor(cam.width / 2), this.camY - Math.floor(cam.height / 2));
  }

  snapActors() {
    if (!this.player) return;
    this.player.actor.snap();
    for (const n of this.npcs) n.actor.snap();
    for (const e of this.enemies) e.actor.snap();
    for (const a of this.extraActors()) a.snap();
  }

  /** Yoldaşlar gibi ek aktörler. */
  extraActors(): import('../world/actor').Actor[] {
    return this.companions.map((c) => c.actor);
  }

  // ================================================================= yoldaşlar (C4)
  /** Yoldaşları Joseph'in arkasına diz (harita değişince onunla gelirler). */
  spawnCompanions() {
    const party = G.state.party ?? [];
    for (const id of party) {
      if (!NPC_BY_ID[id] || !COMPANIONS[id]) continue;
      this.makeCompanion(id);
    }
  }

  makeCompanion(id: string) {
    const pa = this.player.actor;
    const c = new Companion(this, id, pa.x, pa.y, G.state.partyHp?.[id]);
    this.physics.add.collider(c.actor, this.r.collide);
    this.companions.push(c);
    c.teleportNear();
    return c;
  }

  /** Gruba katıl (hikâye). Haritadaki NPC kopyası kaldırılır. */
  addCompanion(id: string) {
    if (!G.state.party.includes(id)) G.state.party.push(id);
    const n = this.npc(id);
    let c = this.companion(id);
    if (!c) {
      c = this.makeCompanion(id);
      if (n) {
        c.actor.setPosition(n.x, n.y);
        c.actor.body2.reset(n.x, n.y);
        c.actor.face(n.actor.dir);
      }
    }
    if (n) this.removeNpc(n);
    G.events.emit('party');
    return c;
  }

  /** Gruptan ayrıl: yerinde bir NPC olarak kalır (senaryo yerleştirmesi isterse). */
  removeCompanion(id: string, leaveNpc = false) {
    G.state.party = G.state.party.filter((x) => x !== id);
    const c = this.companion(id);
    if (c) {
      if (leaveNpc) {
        const def = NPC_BY_ID[id];
        if (def) {
          const n = this.addNpc(def, Math.floor(c.x / TILE), Math.floor((c.y - 6) / TILE), true);
          n.actor.face(c.actor.dir);
        }
      }
      c.destroy();
      this.companions = this.companions.filter((x) => x !== c);
    }
    delete G.state.partyHp?.[id];
    G.events.emit('party');
  }

  companion(id: string) {
    return this.companions.find((c) => c.id === id) ?? null;
  }

  updateCompanions(dt: number) {
    for (const c of this.companions) c.update(dt);
    if (this.companions.length) {
      G.state.partyHp ??= {};
      for (const c of this.companions) G.state.partyHp[c.id] = Math.round(c.hp);
    }
  }

  /** Yoldaşın yakın dövüş vuruşu. Dost ateşi yok: yalnızca düşmanlar. */
  companionHit(c: Companion, e: Enemy, dir: Phaser.Math.Vector2, mult = 1) {
    if (!e.alive) return;
    const res = resolvePhysical({ d: c.d, level: c.level }, { d: e.d, level: e.level }, { mult });
    e.aware || e.becomeAware(true);
    e.barShowT = 3;
    if (res.miss) {
      this.fx.number(e.x, e.y - 40, 'Iska!', 'miss');
      return;
    }
    e.c.hp -= res.damage;
    e.damageBy[c.id] = (e.damageBy[c.id] ?? 0) + res.damage;
    e.actor.kb.set(dir.x, dir.y).scale(110 * (e.def.boss ? 0.3 : 1));
    e.actor.flash(0xffffff, 0.06);
    this.fx.sparks(e.x, e.y - 18, 0xd8f0ff, 5);
    this.fx.number(e.x, e.y - 40, String(res.damage) + (res.crit ? '!' : ''), 'info');
    Sound.sfx('hit', 0.6);
    if (e.c.hp <= 0) {
      this.killEnemy(e, null);
      if (Math.random() < 0.6) c.say(c.pick(c.cdef.kill), 1.6);
      if (!e.damageBy.joseph && !c.saidNoExp) {
        c.saidNoExp = true;
        c.say(c.pick(c.cdef.noExp), 2.6);
      }
    }
  }

  spawnCompanionArrow(c: Companion, e: Enemy, dir: Phaser.Math.Vector2) {
    // hedefin hareketine biraz önden nişan
    const v = e.actor.body2?.velocity;
    const lead = 0.2;
    const tx = e.x + (v?.x ?? 0) * lead, ty = e.y + (v?.y ?? 0) * lead;
    const d = new Phaser.Math.Vector2(tx - c.x, ty - c.y).normalize();
    void dir;
    const img = this.add.image(c.x + d.x * 12, c.y - 22 + d.y * 8, 'arrow').setRotation(d.angle()).setDepth(930000);
    this.projectiles.push({ img, vx: d.x * 11 * TILE, vy: d.y * 11 * TILE, life: 0.8, fromPlayer: true, comp: c, power: 1, radius: 10, hits: new Set(), physical: true });
    Sound.sfx('swing', 0.3);
  }

  /** C7: savaşta, ara sahnede, diyalogda, menüde ve mini oyunda değilken her 3 dakikada bir kayıt. */
  tickAutoSave(dt: number) {
    this.autoSaveT += dt;
    if (this.autoSaveT < 180) return;
    if (this.inBattle || this.cutscene || this.ui.dialogueOpen() || this.ui.menuOpen() || this.paused || this.frozen || this.transitioning || this.player.dead) return;
    this.autoSaveT = 0;
    if (G.save('auto')) G.events.emit('saved');
  }

  /** Görev amaçlarının otomatik denetimi: git (yakınlık), topla (envanter), para hedefleri. */
  questTick() {
    const log = G.state.quests;
    const a = this.player.actor;
    const total = walletTotal(G.p.wallet);
    for (const id of Object.keys(log.quests)) {
      const st = log.quests[id];
      if (st.status !== 'active') continue;
      const def = Q.def(id);
      if (!def) continue;
      def.objectives.forEach((o, i) => {
        if (Q.objDone(id, i) && o.type !== 'collect') return;
        if (o.sequential && i > 0 && !Q.objDone(id, i - 1)) return;
        if (o.type === 'go' && o.where && o.where.map === this.mapData.id) {
          const p = o.where.point ? this.mapData.points[o.where.point] : o.where.x !== undefined ? { x: o.where.x, y: o.where.y! } : null;
          if (p && Math.hypot(a.x - (p.x * TILE + 16), a.y - (p.y * TILE + 16)) < (o.where.radius ?? 1.5) * TILE) {
            if (this.director.onQuestGo(id, i) !== false) Q.advance(id, i);
          }
        } else if (o.type === 'collect' && o.target) {
          // teslim edildikten sonra (sonraki amaç bitince) toplama ilerlemesi geri düşmez
          if (def.objectives.some((_, j) => j > i && Q.objDone(id, j))) return;
          Q.set(id, i, G.p.inventory[o.target] ?? 0);
        }
        else if (o.type === 'custom' && o.target === 'silver') Q.set(id, i, total >= 100 ? 1 : 0);
        else if (o.type === 'custom' && o.target === 'silver10') Q.set(id, i, Math.min(1000, total));
      });
    }
  }

  /** Takip edilen görevin bu haritadaki hedefi (piksel). İç mekânda yalnızca hedef aynı mekândaysa. */
  questTargetPx(): { x: number; y: number; r: number } | null {
    const tg = Q.target();
    if (!tg) return null;
    const t = tg.t;
    const m = this.mapData;
    const r = (t.radius ?? 1.5) * TILE;
    if (t.npc) {
      const n = this.npc(t.npc);
      if (n) return { x: n.x, y: n.y - 10, r: 1.6 * TILE };
    }
    const doorOf = (map: string) => {
      const b = m.buildings.find((b) => b.enter?.map === map || (map === 'inn_attic' && b.id === 'inn') || (map === 'mill_cellar' && b.id === 'mill'));
      const d = b && m.points['door_' + b.id];
      return d ? { x: d.x * TILE + 16, y: d.y * TILE + 16, r: 1.2 * TILE } : null;
    };
    let map = t.map;
    let pt: { x: number; y: number } | null = t.map !== m.id ? null : t.point ? m.points[t.point] ?? null : t.x !== undefined && t.y !== undefined ? { x: t.x, y: t.y } : null;
    // NPC haritada değilse: programındaki yer
    if (t.npc && !pt) {
      const def = this.npcDef(t.npc);
      if (def) {
        const e = schedAt(def, G.state.time.minute / 60, G.state.time.day);
        if (e.map !== 'hidden') {
          map = e.map;
          if (e.map === m.id) pt = Array.isArray(e.at) ? { x: e.at[0], y: e.at[1] } : m.points[e.at] ?? null;
        }
      }
    }
    if (map === m.id && pt) return { x: pt.x * TILE + 16, y: pt.y * TILE + 16, r };
    if (!m.indoor && map !== 'world') return doorOf(map);
    return null;
  }

  /** Dünya haritasındaki adlandırılmış nokta (geliştirici ışınlanması, hikâye). */
  getWorldPoint(name: string): { x: number; y: number } | null {
    return getMap(this, 'world').points[name] ?? null;
  }

  npcDef(id: string) {
    return NPCS.find((n) => n.id === id) ?? null;
  }

  /** C5: hedeflenen (ya da menzildeki en yakın) düşmanın altında küçük bir işaret. */
  drawAssistMark() {
    const g = this.assistMark;
    if (!g || !this.player) return;
    g.clear();
    if (!G.settings.assistCombat || this.cutscene || this.frozen) return;
    this.assistMarkT -= this.game.loop.delta / 1000;
    let t: Enemy | null = this.assistMarkT > 0 && this.assistLast?.alive ? this.assistLast : null;
    if (!t && this.player.inCombat) t = this.assistTarget(this.player.weaponReach());
    if (!t) return;
    const k = 0.6 + Math.sin(this.time.now / 120) * 0.25;
    const rw = (t.actor.bodyR + 7) * (t.def.scale ?? 1);
    g.lineStyle(2, 0xff5a3c, 0.55 + 0.35 * k);
    g.strokeEllipse(Math.floor(t.x), Math.floor(t.y + 2), rw * 2, rw * 0.9);
    g.fillStyle(0xff5a3c, 0.75);
    for (const sx of [-1, 1]) g.fillTriangle(t.x + sx * (rw + 6), t.y + 2, t.x + sx * (rw + 1), t.y - 1, t.x + sx * (rw + 1), t.y + 5);
  }

  drawQuestArrow() {
    const g = this.questArrow;
    if (!g || !this.player) return;
    g.clear();
    if (this.cutscene || this.frozen) return;
    const tp = this.questTargetPx();
    if (!tp) return;
    const a = this.player.actor;
    const dx = tp.x - a.x, dy = tp.y - (a.y - 20);
    const d = Math.hypot(dx, dy);
    if (d < tp.r) {
      // hedefte: küçük nabız halkası
      const k = 0.5 + Math.sin(this.time.now / 180) * 0.5;
      g.lineStyle(2, 0xffd75e, 0.5 + 0.4 * k);
      g.strokeCircle(tp.x, tp.y + 6, 10 + 4 * k);
      return;
    }
    const ang = Math.atan2(dy, dx);
    const R0 = 46 + Math.sin(this.time.now / 220) * 3;
    const cx = Math.floor(a.x + Math.cos(ang) * R0), cy = Math.floor(a.y - 20 + Math.sin(ang) * R0);
    const p = (r: number, da: number) => [cx + Math.cos(ang + da) * r, cy + Math.sin(ang + da) * r] as [number, number];
    const tip = p(11, 0), l = p(9, 2.4), rr = p(9, -2.4), back = p(4, Math.PI);
    g.fillStyle(0x1a0e06, 0.75);
    g.fillTriangle(tip[0] + 1, tip[1] + 2, l[0] + 1, l[1] + 2, rr[0] + 1, rr[1] + 2);
    g.fillStyle(0xffd75e, 0.95);
    g.fillTriangle(tip[0], tip[1], l[0], l[1], back[0], back[1]);
    g.fillStyle(0xf0a830, 0.95);
    g.fillTriangle(tip[0], tip[1], rr[0], rr[1], back[0], back[1]);
    g.lineStyle(1, 0x3a2410, 0.9);
    g.strokeTriangle(tip[0], tip[1], l[0], l[1], rr[0], rr[1]);
  }

  /** Kamerayı (ör. bir sahne sonrası) yeniden Joseph'e bağla. */
  followPlayer() {
    this.camFollow = true;
    const cam = this.cameras.main;
    this.camX = cam.midPoint.x;
    this.camY = cam.midPoint.y;
  }

  updateCameraBounds() {
    const m = this.mapData;
    const cam = this.cameras.main;
    const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
    const W = m.w * TILE, H = m.h * TILE;
    const bx = W < vw ? (W - vw) / 2 : 0;
    const by = H < vh ? (H - vh) / 2 : 0;
    cam.setBounds(bx, by, Math.max(W, vw), Math.max(H, vh));
  }

  /** Kararıp başka haritaya geç. */
  warpTo(map: string, tx: number, ty: number, facing: string, cb?: () => void) {
    if (this.transitioning) return;
    this.transitioning = true;
    Input.clear();
    Sound.sfx('door', 0.7);
    this.cameras.main.fadeOut(260, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.loadMap(map, tx, ty, facing);
      this.cameras.main.fadeIn(320, 0, 0, 0);
      this.transitioning = false;
      G.save('auto');
      cb?.();
    });
  }

  spawnEnemies() {
    const m = this.mapData;
    const now = this.absMinute();
    for (const s of m.spawns) {
      for (let i = 0; i < s.count; i++) {
        const key = s.id + '#' + i;
        const until = G.state.respawns[key] ?? 0;
        if (until > now) continue;
        const [x, y] = this.spawnTile(s.x, s.y, s.radius);
        const e = new Enemy(this, s.monster, x * TILE + 16, y * TILE + 22, key, s.level);
        this.physics.add.collider(e.actor, this.r.collide);
        this.enemies.push(e);
      }
    }
  }

  /** Belirli bir yerde düşman doğur (senaryolar ve geliştirici modu). */
  spawnAt(monster: string, tx: number, ty: number, count = 1, radius = 2, key = 'script'): Enemy[] {
    const out: Enemy[] = [];
    for (let i = 0; i < count; i++) {
      const [x, y] = this.spawnTile(tx, ty, radius);
      const e = new Enemy(this, monster, x * TILE + 16, y * TILE + 22, `${key}#${i}`);
      this.physics.add.collider(e.actor, this.r.collide);
      this.enemies.push(e);
      out.push(e);
    }
    return out;
  }

  /** Yürünebilir, ağaç gövdesi/tepesi altında olmayan bir doğma karosu seçer. */
  spawnTile(cx: number, cy: number, radius: number): [number, number] {
    const m = this.mapData;
    const ok = (x: number, y: number) => {
      if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) return false;
      if (m.solid[y * m.w + x]) return false;
      // gövdeye yapışık olmasın: alttaki ve yanlardaki karolar da boş olsun
      if (m.solid[(y + 1) * m.w + x] || m.solid[y * m.w + x - 1] || m.solid[y * m.w + x + 1]) return false;
      return !this.r.occluders.covers(x * TILE + 16, y * TILE + 22, 6) && !this.r.occluders.covers(x * TILE + 16, y * TILE - 4, 6);
    };
    for (let i = 0; i < 40; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rr = Math.random() * (radius + i / 10);
      const x = Math.round(cx + Math.cos(ang) * rr), y = Math.round(cy + Math.sin(ang) * rr);
      if (ok(x, y)) return [x, y];
    }
    // Spiral arama
    for (let r = 1; r < 12; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && ok(cx + dx, cy + dy)) return [cx + dx, cy + dy];
    return [cx, cy];
  }

  /** Hareket eden aktörleri dekor kutularından dışarı iter (worldstep). */
  resolvePropCollisions() {
    const pc = this.propCol;
    if (!pc || !this.player) return;
    const pb = this.player.actor.body2;
    if (pb) pc.resolve(pb);
    for (const e of this.enemies) if (e.alive && e.actor.body2) pc.resolve(e.actor.body2);
    for (const n of this.npcs) {
      const b = n.actor.body2;
      if (b && (b.velocity.x !== 0 || b.velocity.y !== 0)) pc.resolve(b);
    }
    for (const c of this.companionBodies()) pc.resolve(c);
  }

  /** Yoldaşların gövdeleri. */
  companionBodies(): Phaser.Physics.Arcade.Body[] {
    return this.companions.filter((c) => !c.down).map((c) => c.actor.body2);
  }

  freeze(reason: string) {
    if (!this.freezeReasons.size) {
      this.physics.pause();
      this.tweens.pauseAll();
      this.time.paused = true;
      Input.clear();
    }
    this.freezeReasons.add(reason);
    this.frozen = true;
  }

  unfreeze(reason: string) {
    if (!this.freezeReasons.delete(reason) || this.freezeReasons.size) return;
    this.physics.resume();
    this.tweens.resumeAll();
    this.time.paused = false;
    this.frozen = false;
  }

  isFrozen(reason?: string) {
    return reason ? this.freezeReasons.has(reason) : this.frozen;
  }

  absMinute() {
    return (G.state.time.day - 1) * 1440 + G.state.time.minute;
  }

  spawnNpcs() {
    const hour = hourOf(G.state.time);
    for (const def of NPCS) {
      if (G.state.party?.includes(def.id)) continue;
      if (this.director.npcOverride(def.id) === false) continue;
      const e = scheduleAt(def, hour, G.state.time.day);
      const forced = this.director.npcPlacement(def.id, this.mapData.id);
      if (forced === null) continue;
      if (!forced && e.map !== this.mapData.id) continue;
      let t: [number, number] | null = null;
      if (forced) t = forced;
      else if (Array.isArray(e.at)) t = e.at;
      else if (this.mapData.points[e.at]) t = [this.mapData.points[e.at].x, this.mapData.points[e.at].y];
      if (!t) continue;
      this.addNpc(def, t[0], t[1], !!forced);
    }
  }

  addNpc(def: NpcDef, tx: number, ty: number, scripted = false) {
    const m = this.mapData;
    [tx, ty] = nearestFree(m.solid, m.w, m.h, tx, ty);
    const n = new Npc(this, def, tx * TILE + 16, ty * TILE + 22);
    n.homeTile = [tx, ty];
    n.entry = scripted ? null : scheduleAt(def, hourOf(G.state.time), G.state.time.day);
    n.scripted = scripted;
    this.physics.add.collider(n.actor, this.r.collide);
    this.npcs.push(n);
    return n;
  }

  removeNpc(n: Npc) {
    n.destroy();
    this.npcs = this.npcs.filter((x) => x !== n);
  }

  npc(id: string) {
    return this.npcs.find((n) => n.def.id === id) ?? null;
  }

  // ================================================================= ana döngü
  update(_time: number, deltaMs: number) {
    let dt = Math.min(0.05, deltaMs / 1000);
    if (this.paused || this.frozen) return;
    this.playClock += dt;
    // ağır çekim
    if (this.slowmoT > 0) {
      this.slowmoT -= dt;
      dt *= 0.35;
      this.physics.world.timeScale = 1 / 0.35;
    } else this.physics.world.timeScale = 1;
    this.readKeyboard();
    // zaman
    if (!this.cutscene && !this.ui.dialogueOpen()) {
      this.timeAcc += dt;
      while (this.timeAcc >= 1) {
        this.timeAcc -= 1;
        this.tickMinute();
      }
    }
    this.player.update(dt);
    for (const e of this.enemies) {
      const far = Math.abs(e.x - this.player.actor.x) > 34 * TILE || Math.abs(e.y - this.player.actor.y) > 24 * TILE;
      if (far && !e.aware) {
        e.actor.body2.setVelocity(0, 0);
        continue;
      }
      if (this.cutscene && e.state !== 'dead') {
        e.actor.body2.setVelocity(0, 0);
        e.actor.tickAnim(dt);
        continue;
      }
      e.update(dt);
    }
    this.updateCompanions(dt);
    const hour = G.state.time.minute / 60;
    for (const n of [...this.npcs]) n.update(dt, hour, G.state.time.day);
    this.updateCaste(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateCombatState(dt);
    this.updateAmbient(dt);
    this.updateOcclusion(dt);
    if (!this.cutscene) {
      this.checkWarpsAndTriggers(dt);
      this.updateZone(false);
      this.updateFog(dt);
      {
        const it = this.findInteractable();
        this.ui.setContext(it?.label ?? null, it?.kind ?? null);
      }
      this.randomAppraisalEvent(dt);
      this.director.checkEncounters(dt);
    }
    this.bubbleGlobalCd -= dt;
    this.tickAutoSave(dt);
    this.questT -= dt;
    if (this.questT <= 0 && !this.cutscene) {
      this.questT = 0.5;
      this.questTick();
    }
    // ışık
    this.updateLighting(dt);
    // konum kaydı
    const a = this.player.actor;
    G.state.pos.x = Math.floor(a.x / TILE);
    G.state.pos.y = Math.floor((a.y - 6) / TILE);
    G.state.pos.facing = a.dir;
  }

  readKeyboard() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.a.isDown || k.left.isDown) x -= 1;
    if (k.d.isDown || k.right.isDown) x += 1;
    if (k.w.isDown || k.up.isDown) y -= 1;
    if (k.s.isDown || k.down.isDown) y += 1;
    if (!Input.touchMove) {
      const l = Math.hypot(x, y) || 1;
      Input.moveX = x / l;
      Input.moveY = y / l;
      Input.run = k.shift.isDown;
    }
    this.player.sneaking = k.ctrl.isDown;
    if (this.cutscene || this.ui.dialogueOpen() || this.ui.menuOpen()) {
      Input.moveX = 0;
      Input.moveY = 0;
    }
  }

  tickMinute() {
    const before = G.state.time;
    G.state.time = advance(before, 1);
    if (G.state.time.day !== before.day) {
      R.onNewDay();
      this.director.onNewDay();
    }
    const h = hourOf(G.state.time);
    if (h !== this.lastHour) {
      this.lastHour = h;
      this.director.onHour(h);
      // Saat değişince, bu haritaya program gereği gelecek NPC'ler
      this.refreshNpcPresence();
    }
    G.events.emit('time');
  }

  refreshNpcPresence() {
    const hour = hourOf(G.state.time);
    for (const def of NPCS) {
      if (this.npcs.some((n) => n.def.id === def.id)) continue;
      if (this.director.npcOverride(def.id) === false) continue;
      const forced = this.director.npcPlacement(def.id, this.mapData.id);
      if (forced === null || forced) continue;
      const e = scheduleAt(def, hour, G.state.time.day);
      if (e.map !== this.mapData.id) continue;
      // Kapıdan / girişten gelir
      let start: { x: number; y: number } | null = null;
      if (this.mapData.indoor) start = this.mapData.points.exit ?? null;
      else start = this.mapData.points['door_' + this.homeBuildingOf(def)] ?? null;
      const t = Array.isArray(e.at) ? e.at : this.mapData.points[e.at] ? [this.mapData.points[e.at].x, this.mapData.points[e.at].y] as [number, number] : null;
      if (!t) continue;
      const s = start ?? { x: t[0], y: t[1] };
      const n = this.addNpc(def, s.x, s.y);
      n.homeTile = t as [number, number];
      n.walkTo(t[0], t[1]);
    }
  }

  homeBuildingOf(def: NpcDef) {
    const map: Record<string, string> = {
      bertram: 'inn', smith: 'smithy', shopkeeper: 'shop', healer: 'healer', celeste: 'guild', innmaid: 'inn', vagrant: 'inn',
      baker: 'bakery', tailor: 'tailor', tanner: 'tannery', hunter: 'lodge', haldor: 'farmhouse', apprentice: 'smithy',
      merchant: 'manor', merc_guard: 'manor', headman: 'house_f', headwife: 'house_f', farmer_m3: 'farmhouse2', farmer_f3: 'farmhouse2',
      gerda: 'farmhouse2', shepherd: 'stable', milkmaid: 'barn', woodcutter: 'house_g', washer: 'house_c', child_girl: 'house_h', child_boy: 'house_e',
      carpenter: 'house_a', bard: 'inn', guard_pell: 'guardhouse', guard_hob: 'guardhouse', guard_wil: 'guardhouse', adv_thorne: 'inn', adv_kael: 'house_c',
      steward: 'checkpoint', knight: 'checkpoint',
    };
    if (map[def.id]) return map[def.id];
    const houses = ['house_a', 'house_b', 'house_c', 'house_d', 'house_e'];
    return houses[def.id.length % houses.length];
  }

  /** Ağaç tepeleri ve çatılar: arkasında oyuncu veya düşman varsa yarı saydam. */
  updateOcclusion(dt: number) {
    const a = this.player.actor;
    const list: { x: number; y: number; h: number }[] = [{ x: a.x, y: a.y, h: 48 }];
    const v = this.cameras.main.worldView;
    for (const e of this.enemies) {
      if (!e.alive || e.x < v.x - 64 || e.x > v.right + 64 || e.y < v.y - 64 || e.y > v.bottom + 200) continue;
      list.push({ x: e.x, y: e.y, h: e.actor.kind === 'lpc' ? 48 : 30 });
    }
    this.r.occluders.update(dt, list);
  }

  // ================================================================= ışık ve ortam
  updateLighting(dt: number) {
    const m = this.mapData;
    const dl = daylight(G.state.time);
    let dark = 0, color = 0x0a0f2a, night = 1 - dl;
    if (m.indoor) {
      dark = (m.ambientDark ?? 0.3) + (1 - dl) * 0.25;
      color = 0x120804;
      night = 1;
    } else {
      dark = (1 - dl) * 0.7;
      const h = G.state.time.minute / 60;
      if ((h > 17 && h < 21) || (h > 4.5 && h < 7.5)) color = 0x2a1438;
      if (this.zone?.id?.startsWith('forest')) dark = Math.min(0.85, dark + 0.08);
    }
    this.darkness = dark;
    this.lighting.playerLight = m.indoor ? 0.35 : Math.max(0, (1 - dl) * 0.5);
    this.lighting.update(dt, dark, color, night, this.player.actor);
  }

  makeRays() {
    // yaprak arasından süzülen ışık huzmeleri (orman, gündüz)
    for (let i = 0; i < 7; i++) {
      const r = this.add.image(0, 0, 'ray').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff2c0).setAlpha(0).setDepth(899000).setAngle(-28).setScale(1.2, 1.6);
      (r as any).seed = Math.random() * 1000;
      this.rays.push(r);
    }
  }

  updateAmbient(dt: number) {
    const t = this.time.now / 1000;
    const cam = this.cameras.main;
    const v = cam.worldView;
    // rüzgâr salınımı (sadece görünürler)
    const wind = Math.sin(t * 0.37) * 0.5 + 0.8;
    for (const s of this.r.swayers) {
      const im = s.img;
      if (im.x < v.x - 100 || im.x > v.right + 100 || im.y < v.y - 40 || im.y > v.bottom + 220) continue;
      im.setAngle(Math.sin(t * 1.4 + s.phase) * s.amp * wind);
    }
    for (const ap of this.r.animProps) {
      ap.t += dt;
      ap.img.setFrame(ap.frames[Math.floor(ap.t * 8) % ap.frames.length]);
    }
    if (this.r.sails) this.r.sails.rotation += dt * 0.5;
    // huzmeler
    const dl = daylight(G.state.time);
    const inForest = this.zone?.id?.startsWith('forest') ?? false;
    for (let i = 0; i < this.rays.length; i++) {
      const r = this.rays[i];
      const seed = (r as any).seed;
      const target = inForest && G.settings.quality !== 'low' ? 0.07 * dl * (0.6 + 0.4 * Math.sin(t * 0.3 + seed)) : 0;
      r.setAlpha(Phaser.Math.Linear(r.alpha, target, dt * 2));
      if (r.alpha > 0.005) {
        const px = v.x + ((seed * 97 + i * 160) % (v.width + 200)) - 100;
        r.setPosition(px + Math.sin(t * 0.1 + seed) * 20, v.y + v.height * 0.45);
      }
    }
    // parçacıklar
    this.ambientT -= dt;
    if (this.ambientT <= 0 && G.settings.quality !== 'low') {
      this.ambientT = G.settings.quality === 'high' ? 0.12 : 0.3;
      const m = this.mapData;
      const night = 1 - dl;
      if (m.indoor) {
        if (Math.random() < 0.4) this.mote(v.x + Math.random() * v.width, v.y + Math.random() * v.height, 0xffe0a0, 0.25);
      } else if (inForest) {
        if (Math.random() < 0.35) this.leaf(v.x + Math.random() * v.width, v.y - 10);
        if (night > 0.5 && Math.random() < 0.6) this.firefly(v.x + Math.random() * v.width, v.y + Math.random() * v.height);
        if (dl > 0.5 && Math.random() < 0.3) this.mote(v.x + Math.random() * v.width, v.y + Math.random() * v.height, 0xfff4c0, 0.3);
      } else {
        if (Math.random() < 0.12) this.leaf(v.x + Math.random() * v.width, v.y - 10, true);
        if (night > 0.6 && Math.random() < 0.25) this.firefly(v.x + Math.random() * v.width, v.y + Math.random() * v.height);
        if (Math.random() < 0.2) this.mote(v.x + Math.random() * v.width, v.y + Math.random() * v.height, 0xffffff, 0.15);
      }
      // baca dumanı
      if (!m.indoor && Math.random() < 0.5) {
        const bm = this.cache.json.get('buildingsMeta');
        for (const b of m.buildings) {
          if (!['inn', 'smithy', 'healer', 'guild', 'house_a', 'house_d'].includes(b.id)) continue;
          const x = b.tx * TILE, y = b.tyBottom * TILE - bm[b.id].h;
          if (x < v.x - 100 || x > v.right + 100 || y < v.y - 200 || y > v.bottom) continue;
          if (Math.random() < 0.3) this.smoke(x + bm[b.id].w * (b.id === 'inn' ? 0.79 : b.id === 'guild' ? 0.16 : b.id === 'smithy' ? 0.67 : b.id === 'healer' ? 0.14 : 0.66), y + 4);
        }
      }
      // kamp ateşi kıvılcımı
      for (const ap of this.r.animProps) if (Math.random() < 0.5 && Math.abs(ap.img.x - v.centerX) < v.width) this.ember(ap.img.x + (Math.random() - 0.5) * 10, ap.img.y - 20);
    }
  }

  leaf(x: number, y: number, light = false) {
    const im = this.add.image(x, y, Math.random() < 0.5 || light ? 'leaf' : 'leaf2').setDepth(899500).setAlpha(0.9);
    const dur = 5000 + Math.random() * 4000;
    this.tweens.add({ targets: im, y: y + 260 + Math.random() * 120, x: x + 60 + Math.random() * 80, angle: 360 * (Math.random() < 0.5 ? 1 : -1), duration: dur, onComplete: () => im.destroy() });
    this.tweens.add({ targets: im, alpha: 0, delay: dur - 800, duration: 800 });
  }

  firefly(x: number, y: number) {
    const im = this.add.image(x, y, 'soft').setTint(0xd8ff7a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.12).setAlpha(0).setDepth(901000);
    this.tweens.add({ targets: im, alpha: { from: 0, to: 0.9 }, yoyo: true, duration: 1200 + Math.random() * 800, onComplete: () => im.destroy() });
    this.tweens.add({ targets: im, x: x + (Math.random() - 0.5) * 50, y: y + (Math.random() - 0.5) * 40, duration: 2400 });
  }

  mote(x: number, y: number, color: number, a: number) {
    const im = this.add.image(x, y, 'dot').setTint(color).setAlpha(0).setDepth(899600).setScale(0.5);
    this.tweens.add({ targets: im, alpha: a, yoyo: true, duration: 1500, onComplete: () => im.destroy() });
    this.tweens.add({ targets: im, x: x + 20, y: y - 10, duration: 3000 });
  }

  smoke(x: number, y: number) {
    const im = this.add.image(x, y, 'soft').setTint(0x9a9aa8).setAlpha(0.35).setScale(0.15).setDepth(899700);
    this.tweens.add({ targets: im, y: y - 50 - Math.random() * 30, x: x + 20 + Math.random() * 20, scale: 0.6, alpha: 0, duration: 3000, onComplete: () => im.destroy() });
  }

  ember(x: number, y: number) {
    const im = this.add.image(x, y, 'dot').setTint(0xffa040).setBlendMode(Phaser.BlendModes.ADD).setDepth(940000).setScale(0.6);
    this.tweens.add({ targets: im, y: y - 30 - Math.random() * 30, x: x + (Math.random() - 0.5) * 20, alpha: 0, duration: 900 + Math.random() * 500, onComplete: () => im.destroy() });
  }

  // ================================================================= bölge, sis, tetikleyiciler
  updateZone(force: boolean) {
    const a = this.player.actor;
    const tx = a.x / TILE, ty = a.y / TILE;
    // en küçük kapsayan bölge
    let best: Zone | null = null;
    for (const z of this.mapData.zones) {
      if (tx >= z.x && tx < z.x + z.w && ty >= z.y && ty < z.y + z.h) {
        if (!best || z.w * z.h < best.w * best.h) best = z;
      }
    }
    if (best !== this.zone || force) {
      const prev = this.zone;
      this.zone = best;
      if (best?.safe && !prev?.safe) R.resetStreak();
      if (best?.name && best.name !== this.zoneNameShown && !force) {
        this.zoneNameShown = best.name;
        this.ui.showZone(best.name);
      }
      if (force && best?.name) this.zoneNameShown = best.name;
      this.updateMusic();
    }
  }

  updateMusic() {
    if (this.director.musicOverride) return;
    if (this.inBattle) {
      Sound.play('battle');
      return;
    }
    const m = this.mapData;
    if (m.indoor) {
      Sound.play(m.music as any);
      return;
    }
    const night = daylight(G.state.time) < 0.3;
    const z = this.zone;
    if (z?.music === 'village' || z?.id === 'training' || z?.safe) Sound.play(night ? 'night' : 'village');
    else Sound.play(night ? 'night' : 'forest');
  }

  updateFog(dt: number) {
    this.fogT -= dt;
    if (this.fogT > 0) return;
    this.fogT = 0.4;
    const m = this.mapData;
    const f = fogOf(m);
    const a = this.player.actor;
    const cx = Math.floor(a.x / TILE), cy = Math.floor(a.y / TILE);
    const R2 = m.indoor ? 30 : 8;
    let changed = false;
    for (let y = cy - R2; y <= cy + R2; y++)
      for (let x = cx - R2; x <= cx + R2; x++) {
        if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 > R2 * R2) continue;
        const i = y * m.w + x;
        if (!f[i]) {
          f[i] = 1;
          changed = true;
        }
      }
    if (changed) {
      G.state.fog[m.id] = encodeFog(f);
      G.events.emit('fog');
      if (m.id === 'world' && !G.p.titles.includes('forest_walker') && Math.random() < 0.1) this.checkForestExplored(f);
    }
  }

  revealArea(mapId: string, x0: number, y0: number, x1: number, y1: number) {
    const m = getMap(this, mapId);
    const f = fogOf(m);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < m.w && y < m.h) f[y * m.w + x] = 1;
    G.state.fog[m.id] = encodeFog(f);
    G.events.emit('fog');
  }

  checkForestExplored(f: Uint8Array) {
    const m = this.mapData;
    let tot = 0, seen = 0;
    for (let y = 2; y < m.h - 2; y += 2)
      for (let x = 2; x < 54; x += 2) {
        tot++;
        if (f[y * m.w + x]) seen++;
      }
    if (seen / tot > 0.9) R.grantTitle('forest_walker');
  }

  checkWarpsAndTriggers(dt: number) {
    this.warpCooldown -= dt;
    this.lockedMsgT -= dt;
    const a = this.player.actor;
    const tx = Math.floor(a.x / TILE), ty = Math.floor((a.y - 4) / TILE);
    if (this.warpCooldown <= 0 && this.player.state === 'free') {
      for (const w of this.mapData.warps) {
        if (tx >= w.x && tx < w.x + w.w && ty >= w.y && ty < w.y + w.h) {
          const bottomExit = this.mapData.indoor && w.y === this.mapData.h - 1;
          const into = bottomExit ? Input.moveY > 0.3 : Input.moveY < -0.3;
          if (!into) continue;
          this.tryWarp(w);
          break;
        }
      }
    }
    for (const t of this.mapData.triggers) {
      if (tx >= t.x && tx < t.x + t.w && ty >= t.y && ty < t.y + t.h) this.director.onTrigger(t.id);
    }
  }

  tryWarp(w: MapData['warps'][number]) {
    if (!w.to) {
      if (this.lockedMsgT <= 0) {
        this.ui.toastInfo(w.closedMsg ?? 'Kapı kilitli.');
        this.lockedMsgT = 3;
        Sound.sfx('error', 0.4);
      }
      this.warpCooldown = 0.8;
      return;
    }
    if (w.hours) {
      const h = G.state.time.minute / 60;
      if (h < w.hours[0] || h >= w.hours[1]) {
        if (this.lockedMsgT <= 0) {
          this.ui.toastInfo(`${w.label ?? 'Burası'} kapalı. (${w.hours[0]}:00–${w.hours[1]}:00)`);
          this.lockedMsgT = 3;
        }
        this.warpCooldown = 0.8;
        return;
      }
    }
    if (this.director.beforeWarp(w) === false) {
      this.warpCooldown = 1;
      return;
    }
    this.warpTo(w.to, w.tx, w.ty, w.facing);
  }

  // ================================================================= etkileşim
  findInteractable(): { label: string; kind: string; ref: any } | null {
    const a = this.player.actor;
    const [fx, fy] = dirVec(a.dir);
    const px = a.x + fx * 14, py = a.y - 8 + fy * 14;
    let best: { label: string; kind: string; ref: any; d: number } | null = null;
    const consider = (x: number, y: number, label: string, kind: string, ref: any, range = 34) => {
      const d = Math.hypot(x - px, y - py);
      if (d < range && (!best || d < best.d)) best = { label, kind, ref, d };
    };
    for (const n of this.npcs) consider(n.x, n.y - 10, 'Konuş', 'npc', n, 40);
    for (const p of this.r.propImages) if (p.p.interact) consider(p.p.x, p.p.y - 8, this.interactLabel(p.p.interact), 'prop', p.p, 38);
    for (const g of this.mapData.gathers) {
      const avail = (G.state.gathered[g.id] ?? 0) !== G.state.time.day;
      if (avail) consider(g.x * TILE + 16, g.y * TILE + 16, 'Topla', 'gather', g, 30);
    }
    for (const w of this.mapData.warps) consider(w.x * TILE + 16, w.y * TILE + 8, w.to ? (this.mapData.indoor && w.y === this.mapData.h - 1 ? 'Çık' : 'Gir') : 'Kapı', 'warp', w, 30);
    const b = best as any;
    return b ? { label: b.label, kind: b.kind, ref: b.ref } : null;
  }

  interactLabel(id: string) {
    if (id.startsWith('train')) return 'Antrenman';
    if (id.startsWith('bed')) return 'Uyu';
    if (id === 'quest_board' || id === 'rank_table' || id === 'archery_target') return 'İncele';
    if (id === 'appraisal_stone') return 'İncele';
    return 'Etkileşim';
  }

  interact() {
    const it = this.findInteractable();
    if (!it) return;
    if (it.kind === 'npc') {
      const n = it.ref as Npc;
      n.actor.face(dirFromVec(this.player.actor.x - n.x, this.player.actor.y - n.y));
      this.director.talk(n);
    } else if (it.kind === 'prop') this.director.interactProp((it.ref as PropPlacement).interact!, it.ref);
    else if (it.kind === 'gather') this.gather(it.ref);
    else if (it.kind === 'warp') this.tryWarp(it.ref);
  }

  gather(g: MapData['gathers'][number]) {
    if ((G.state.gathered[g.id] ?? 0) === G.state.time.day) return;
    G.state.gathered[g.id] = G.state.time.day;
    let qty = 1;
    if (Math.random() < G.d.gatherBonus) qty++;
    this.player.actor.play('thrust', { loop: false, restart: true, speed: 1.2, onDone: () => this.player.actor.play('idle') });
    R.giveItems([{ id: g.item, qty }], 'Toplama');
    Sound.sfx('pickup');
    this.fx.pickupSparkle(g.x * TILE + 16, g.y * TILE + 20);
    if (g.kind === 'herb') {
      R.gainSkillExp('gathering', usageExp(1.5, 0, 0));
      G.count('gathered');
      R.checkDiscoveries();
      // otu haritadan gizle (gün boyu)
      for (const p of this.r.propImages) if (p.p.key === 'herb_plant' && Math.abs(p.p.x - (g.x * TILE + 16)) < 2 && Math.abs(p.p.y - (g.y * TILE + 28)) < 2) p.img.setAlpha(0.25);
    }
  }

  // ================================================================= Appraisal
  /** Ekran koordinatındaki (piksel) NPC ya da canavar. */
  creatureAtScreen(sx: number, sy: number): { kind: 'npc' | 'enemy' | 'self'; ref: any } | null {
    if (!this.player) return null;
    const wp = this.cameras.main.getWorldPoint(sx, sy);
    let best: { kind: 'npc' | 'enemy' | 'self'; ref: any; d: number } | null = null;
    const test = (x: number, y: number, h: number, kind: 'npc' | 'enemy' | 'self', ref: any) => {
      if (wp.x < x - 16 || wp.x > x + 16 || wp.y < y - h || wp.y > y + 6) return;
      const d = Math.hypot(wp.x - x, wp.y - (y - h / 2));
      if (!best || d < best.d) best = { kind, ref, d };
    };
    for (const n of this.npcs) test(n.x, n.y, 52, 'npc', n);
    for (const e of this.enemies) if (e.alive) test(e.x, e.y, e.actor.kind === 'lpc' ? 52 : 34, 'enemy', e);
    // Kendine Appraisal: Joseph'e dokunmak (yalnızca başka kimse yoksa)
    if (!best) test(this.player.actor.x, this.player.actor.y, 52, 'self', this.player);
    const b = best as any;
    return b ? { kind: b.kind, ref: b.ref } : null;
  }

  /** Kendine Appraisal: kendi bilgilerini gösterir, EXP vermez. */
  appraiseSelf() {
    if (!appraisalReady(this.time.now, this.lastAppraiseAt, !!this.ui.appraisalWin)) return;
    this.lastAppraiseAt = this.time.now;
    Sound.sfx('appraise');
    const c = { ...G.p, alloc: G.p.alloc, hp: G.p.hp, mp: G.p.mp, guildRank: G.state.guild.member ? G.p.guildRank : null };
    this.fx.glow(this.player.actor.x, this.player.actor.y - 24, 0x7cc8ff, 30, 400);
    this.ui.showAppraisal(c, null, true);
  }

  /** Dokunarak Appraisal. */
  tapAppraise(t: { kind: 'npc' | 'enemy' | 'self'; ref: any }) {
    if (t.kind === 'self') {
      this.appraiseSelf();
      return;
    }
    if (t.kind === 'npc') {
      const n = t.ref as Npc;
      this.appraise(n.def.creature, n.def, n);
    } else {
      const e = t.ref as Enemy;
      this.appraise(e.c, null, e);
    }
  }

  // ================================================================= hızlı yemek
  /** Hızlı yemek yuvasındaki yiyecek: atanmış olan ya da envanterdeki ilk yiyecek. */
  quickFoodId(): string | null {
    const inv = G.p.inventory;
    const q = G.state.quickFood;
    if (q && inv[q] && ITEMS[q]?.kind === 'food') return q;
    return Object.keys(inv).find((id) => ITEMS[id]?.kind === 'food' && inv[id] > 0) ?? null;
  }

  /** Bir eşyayı tüket (yiyecekler bekleme kurallarına uyar). */
  consume(id: string): boolean {
    const r = R.consumeItem(id, { state: this.eatState, now: this.playClock }, (b) => this.player.buffs.push(b));
    if (!r.ok) {
      Sound.sfx('error', 0.5);
      this.fx.number(this.player.actor.x, this.player.actor.y - 50, r.reason?.startsWith('Henüz') ? 'Henüz değil' : 'Yok', 'miss');
      if (r.reason) R.toast(r.reason, 'warn');
      return false;
    }
    if (r.eatState) this.eatState = r.eatState;
    const it = ITEMS[id];
    Sound.sfx(it.kind === 'food' ? 'pickup' : 'heal');
    this.fx.glow(this.player.actor.x, this.player.actor.y - 20, 0x9fffa0, 30, 400);
    R.toast(`${it.name} ${it.kind === 'food' ? 'yendi' : 'kullanıldı'}.`, 'info', it.icon);
    return true;
  }

  eatQuick() {
    const id = this.quickFoodId();
    if (!id) {
      Sound.sfx('error', 0.4);
      this.ui.toastInfo('Hızlı yemek: elinde yiyecek yok.');
      return;
    }
    this.consume(id);
  }

  appraiseNearest() {
    const a = this.player.actor;
    const [fx, fy] = dirVec(a.dir);
    let best: { kind: 'npc' | 'enemy'; ref: any; score: number } | null = null;
    const cand = (x: number, y: number, kind: 'npc' | 'enemy', ref: any) => {
      const dx = x - a.x, dy = y - a.y;
      const d = Math.hypot(dx, dy) / TILE;
      if (d > 7) return;
      const dot = (dx * fx + dy * fy) / (Math.hypot(dx, dy) || 1);
      const score = d - dot * 2;
      if (!best || score < best.score) best = { kind, ref, score };
    };
    for (const n of this.npcs) cand(n.x, n.y, 'npc', n);
    for (const e of this.enemies) if (e.alive) cand(e.x, e.y, 'enemy', e);
    const b = best as any;
    if (!b) {
      this.ui.toastInfo('Appraisal: menzilde kimse yok.');
      return;
    }
    this.appraise(b.kind === 'npc' ? (b.ref as Npc).def.creature : (b.ref as Enemy).c, b.kind === 'npc' ? (b.ref as Npc).def : null, b.ref);
  }

  appraise(c: any, npcDef: NpcDef | null, ref: any, force = false) {
    // Spam koruması: panel açıkken yeni panel yok, ~1.5 sn bekleme
    if (!force && !appraisalReady(this.time.now, this.lastAppraiseAt, !!this.ui.appraisalWin)) return;
    this.lastAppraiseAt = this.time.now;
    Sound.sfx('appraise');
    const mine = G.p.skills.find((s) => s.id === 'appraisal')!.rank;
    const theirs = (c.skills.find((s: any) => s.id === 'appraisal')?.rank ?? 0) as number;
    // EXP: aynı hedef günde bir kez
    const key = (npcDef?.id ?? 'm_' + (ref as Enemy).uid) as string;
    if (claimAppraisalExp(G.state.appraised, key, G.state.time.day)) {
      R.gainSkillExp('appraisal', appraisalBaseExp(mine, theirs, c.level, G.p.level));
    }
    const actor = ref.actor;
    if (actor) this.fx.glow(actor.x, actor.y - 24, 0x7cc8ff, 30, 400);
    this.ui.showAppraisal(c, npcDef);
    this.director.onAppraise(npcDef?.id ?? c.id);
  }

  randomAppraisalEvent(dt: number) {
    this.appraiseEventT -= dt;
    if (this.appraiseEventT > 0) return;
    this.appraiseEventT = 50 + Math.random() * 60;
    const mine = G.p.skills.find((s) => s.id === 'appraisal')!.rank;
    const near = this.npcs.filter((n) => Math.hypot(n.x - this.player.actor.x, n.y - this.player.actor.y) < 6 * TILE && ['gossip', 'proud', 'wise', 'shy'].includes(n.def.personality));
    if (!near.length) return;
    const n = near[Math.floor(Math.random() * near.length)];
    const theirs = n.def.creature.skills.find((s) => s.id === 'appraisal')!.rank;
    if (noticesAppraisal(mine, theirs)) {
      R.sysmsg('UYARI', [`Biri seni appraise etti. (${n.def.name})`], { sound: 'alert' });
    }
  }

  /** Fark edilmeden düşmana yaklaşma (gizli keşif: Gizlilik). */
  onSneakApproach() {
    G.count('sneakApproach');
    R.gainSkillExp('stealth', 0.6);
    R.checkDiscoveries();
  }

  // ================================================================= kast: eğilme ve yol verme
  private casteT = 0;
  updateCaste(dt: number) {
    this.casteT -= dt;
    if (this.casteT > 0 || this.cutscene) return;
    this.casteT = 0.3;
    const highs = this.npcs.filter((n) => n.prestige >= 4 && !n.scripted);
    if (!highs.length) return;
    for (const h of highs) {
      const moving = h.state === 'walk' || Math.hypot(h.actor.body2.velocity.x, h.actor.body2.velocity.y) > 5;
      for (const b of this.npcs) {
        if (b === h || b.prestige > 2 || b.scripted) continue;
        const d = Math.hypot(b.x - h.x, b.y - h.y) / TILE;
        if (h.prestige >= 5 && d < 4.5) {
          const rude = b.def.personality === 'rude';
          const lines = b.prestige <= 1 ? ['(Yere kapanıyor.)', 'Efendim... Bağışlayın.'] : rude ? ['(Dişlerinin arasından) ...Efendim.'] : ['Hoş geldiniz, efendim!', 'Efendim.', '(Başını eğiyor.)', 'Baronun ışığı üstünüze, efendim.'];
          b.bow(h, lines[Math.floor(Math.random() * lines.length)]);
        } else if (moving && d < 1.9) {
          const lines = ['Buyrun efendim, geçin.', '(Kenara çekiliyor.)', 'Pardon, efendim!', 'Yol verin, Thorne Efendi geçiyor!'].filter((l) => !l.includes('Thorne') || h.def.id === 'adv_thorne');
          b.yieldTo(h, Math.random() < 0.6 ? lines[Math.floor(Math.random() * lines.length)] : null);
        }
      }
    }
  }

  // ================================================================= durum / balon
  /** Joseph'in toplumdaki görünümü: Saygınlık (kıyafet) ve lonca kaydı birlikte (C1). */
  josephStatus(): JosephStatus {
    return josephStatusOf(R.josephPrestige(), G.state.guild.member || !!G.p.inventory.guild_card);
  }

  /** Bir NPC'nin Joseph'e tonu: Saygınlık karşılaştırması. */
  toneFor(n: Npc): Tone {
    return toneOf(R.josephPrestige(), n.saygınlık);
  }

  canBubble() {
    return this.bubbleGlobalCd <= 0 && !this.cutscene && !this.ui.dialogueOpen();
  }

  noteBubble() {
    this.bubbleGlobalCd = 3.5;
  }

  pickBubble(def: NpcDef): string | null {
    // E4: Vera ve Lina dostluktan sonra başka konuşur
    const ov = this.director.ch2.bubbleFor(def.id);
    if (ov) return ov;
    const st = this.josephStatus();
    const h = G.state.time.minute / 60;
    const night = h >= 21 || h < 5;
    const pool = [...(night && def.bubbles.night ? def.bubbles.night : []), ...(def.bubbles[st] ?? []), ...(def.bubbles.any ?? [])];
    // Kasta göre ek tepkiler: kendi replikleri azsa ya da arada bir
    const caste = CASTE_BUBBLES[def.caste]?.[st] ?? [];
    // C1: Saygınlık tonu hafifçe kaydırır
    const n = this.npc(def.id);
    const tone = n ? this.toneFor(n) : 'neutral';
    if (tone !== 'neutral' && st !== 'naked' && Math.random() < 0.3) {
      const tl = TONE_LINES[def.caste]?.[tone]?.bubble ?? [];
      if (tl.length) return tl[Math.floor(Math.random() * tl.length)];
    }
    if (caste.length && (pool.length < 2 || Math.random() < 0.25)) return caste[Math.floor(Math.random() * caste.length)];
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  bubbleAt(actor: any, text: string, dur = 2, think = false) {
    const t = this.add.text(actor.x, actor.y - 60, text, {
      fontFamily: 'AlegreyaSans, sans-serif', fontSize: '12px', color: think ? '#cfe2ff' : '#fff6e0', stroke: '#1a0e06', strokeThickness: 3,
      fontStyle: think ? 'italic bold' : 'bold', wordWrap: { width: 180, useAdvancedWrap: true }, align: 'center',
    }).setOrigin(0.5, 1).setDepth(970000);
    t.setResolution(this.cameras.main.zoom * 1.5);
    this.tweens.add({ targets: t, y: t.y - 10, alpha: 0, delay: dur * 700, duration: dur * 300, onComplete: () => t.destroy() });
  }

  /** HUD'daki yoldaş çubukları için. */
  partyStatus(): { name: string; hp: number; max: number; down: boolean }[] {
    return this.companions.map((c) => ({ name: c.name, hp: c.hp, max: c.maxHp, down: c.down }));
  }

  // ================================================================= dövüş
  enterCombat() {
    this.player.combatT = 0;
  }

  updateCombatState(dt: number) {
    const anyAware = this.enemies.some((e) => e.alive && e.aware && e.def.behavior !== 'flee' && Math.hypot(e.x - this.player.actor.x, e.y - this.player.actor.y) < 14 * TILE);
    if (anyAware) {
      this.player.combatT = Math.min(this.player.combatT, 0.5);
      this.battleT = 0;
      if (!this.inBattle) {
        this.inBattle = true;
        this.updateMusic();
      }
    } else if (this.inBattle) {
      this.battleT += dt;
      if (this.battleT > 3) {
        this.inBattle = false;
        this.player.secondWindUsed = false;
        this.killsThisCombat = {};
        this.updateMusic();
      }
    }
    this.incoming = this.incoming.filter((i) => i.e.alive && i.e.state === 'windup');
  }

  registerIncoming(e: Enemy, windup: number) {
    this.incoming.push({ e, at: this.time.now / 1000 + windup });
  }

  /** Hedef yardımı: saldırı yönünü yakındaki düşmana ~20° düzeltir. */
  /** C5: yardımlı savaşta hedeflenecek düşman: menzildeki en yakın (tüm yönler). */
  assistTarget(reach: number): Enemy | null {
    const a = this.player.actor;
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - a.x, e.y - a.y) / TILE;
      if (d > reach + 1.2) continue;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  aimAssist(reach: number): Phaser.Math.Vector2 {
    const a = this.player.actor;
    // C5: Yardımlı savaş açıkken en yakın düşmana dön ve ona vur (sırtı dönük olsa bile)
    if (G.settings.assistCombat) {
      const t = this.assistTarget(reach);
      if (t) {
        Input.aim = null;
        this.assistMarkT = 0.8;
        this.assistLast = t;
        return new Phaser.Math.Vector2(t.x - a.x, t.y - 10 - (a.y - 14)).normalize();
      }
    }
    let base: Phaser.Math.Vector2;
    if (Input.aim) {
      base = new Phaser.Math.Vector2(Input.aim.x - a.x, Input.aim.y - (a.y - 16)).normalize();
      Input.aim = null;
    } else if (Math.hypot(Input.moveX, Input.moveY) > 0.3) base = new Phaser.Math.Vector2(Input.moveX, Input.moveY).normalize();
    else {
      const [fx, fy] = dirVec(a.dir);
      base = new Phaser.Math.Vector2(fx, fy);
    }
    let best: Enemy | null = null;
    let bestScore = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const v = new Phaser.Math.Vector2(e.x - a.x, e.y - a.y);
      const d = v.length() / TILE;
      if (d > reach + 1.2) continue;
      const ang = Math.abs(Phaser.Math.Angle.Wrap(v.angle() - base.angle()));
      if (ang > Phaser.Math.DegToRad(60)) continue;
      const score = d + ang * 2;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    if (best) {
      const v = new Phaser.Math.Vector2(best.x - a.x, best.y - a.y);
      const diff = Phaser.Math.Angle.Wrap(v.angle() - base.angle());
      const lim = Phaser.Math.DegToRad(20);
      base.rotate(Phaser.Math.Clamp(diff, -lim, lim));
    }
    return base;
  }

  playerStrike(heavy: boolean, dir: Phaser.Math.Vector2) {
    const pl = this.player;
    const a = pl.actor;
    const d = G.d;
    if (d.weaponType === 'bow') {
      this.spawnArrow(dir, heavy ? 1.6 : 1);
      return;
    }
    const reach = pl.weaponReach() * TILE + (heavy ? 8 : 0);
    const arc = Phaser.Math.DegToRad(heavy ? 140 : 110) / 2;
    const ox = a.x, oy = a.y - 14;
    this.fx.slashArc(ox + dir.x * 16, oy + dir.y * 16, dir.angle(), heavy ? 0xffd27a : 0xffffff, heavy ? 1.3 : 1);
    let hitAny = false;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const v = new Phaser.Math.Vector2(e.x - ox, e.y - 10 - oy);
      const dist = v.length() - e.actor.bodyR;
      if (dist > reach) continue;
      if (Math.abs(Phaser.Math.Angle.Wrap(v.angle() - dir.angle())) > arc && v.length() > 18) continue;
      hitAny = true;
      this.hitEnemy(e, { heavy, dir, physical: true });
    }
    // çalı yakma/kesme yok; boşa vuruş
    if (!hitAny) Sound.sfx('miss', 0.3);
  }

  hitEnemy(e: Enemy, o: { heavy?: boolean; dir: Phaser.Math.Vector2; physical?: boolean; spell?: { base: number; element?: string; skill?: string }; mult?: number; skill?: string; knock?: number }) {
    const pl = this.player;
    const sneak = !e.aware && e.def.behavior !== 'flee';
    const counter = pl.counterT > 0;
    let res;
    const att = { d: G.d, level: G.p.level };
    const def = { d: e.d, level: e.level };
    const holy = pl.holyNext && o.physical;
    if (o.spell) res = resolveSpell(att, def, o.spell.base, { element: o.spell.element, mult: o.mult });
    else
      res = resolvePhysical(att, def, {
        mult: (o.heavy ? 1.8 : 1) * (o.mult ?? 1) * (holy ? 2.5 : 1),
        weak: counter,
        sneakMult: sneak ? G.d.sneakMult : undefined,
        forceCrit: false,
      });
    if (holy) {
      pl.holyNext = false;
      this.fx.ring(e.x, e.y - 10, 0xffe28a, 60, 500);
      Sound.sfx('holy');
      for (const o2 of this.enemies) if (o2 !== e && o2.alive && Math.hypot(o2.x - e.x, o2.y - e.y) < 2.2 * TILE) this.hitEnemy(o2, { dir: o.dir, spell: { base: 4 }, mult: 1 });
    }
    if (counter) pl.counterT = 0;
    e.aware || e.becomeAware(true);
    e.barShowT = 3;
    this.enterCombat();
    if (res.miss) {
      this.fx.number(e.x, e.y - 40, 'Iska!', 'miss');
      Sound.sfx('miss');
      return;
    }
    e.c.hp -= res.damage;
    e.damageBy.joseph = (e.damageBy.joseph ?? 0) + res.damage;
    // hissiyat
    const kbMul = (o.knock ?? 1) * (o.heavy ? 2 : 1) * (e.def.boss ? 0.3 : 1);
    e.actor.kb.set(o.dir.x, o.dir.y).scale(160 * kbMul);
    e.actor.flash(0xffffff, 0.08);
    const stop = res.crit ? 0.1 : o.heavy ? 0.08 : 0.05;
    e.actor.frozenT = stop;
    pl.actor.frozenT = stop * 0.8;
    if (G.settings.shake) this.cameras.main.shake(res.crit ? 140 : o.heavy ? 110 : 70, (res.crit ? 0.006 : 0.003) * (4 / Display.worldZoom));
    this.fx.sparks(e.x, e.y - 18, res.crit ? 0xffd040 : 0xfff2c0, res.crit ? 12 : 7);
    const label = String(res.damage) + (res.crit ? '!' : '');
    this.fx.number(e.x, e.y - 40, label, res.crit ? 'crit' : 'dmg');
    if (res.sneak) this.fx.number(e.x, e.y - 58, 'Gizli Saldırı!', 'sneak');
    if (counter) this.fx.number(e.x, e.y - 58, 'Karşı Saldırı!', 'divine');
    Sound.sfx(res.crit ? 'crit' : 'hit');
    // Işık barı
    if (G.state.divine.skills.length) G.state.divine.light = Math.min(LIGHT_MAX, G.state.divine.light + LIGHT_ON_HIT * (o.heavy ? 1.5 : 1));
    // skill EXP (kullanım)
    const wt = G.d.weaponType;
    const weaponSkill = wt === 'sword' ? 'sword_mastery' : wt === 'spear' ? 'spear_mastery' : wt === 'bow' ? 'archery' : null;
    if (o.skill) R.gainSkillExp(o.skill, usageExp(1.2, e.level, G.p.level));
    else if (weaponSkill && o.physical) R.gainSkillExp(weaponSkill, usageExp(1, e.level, G.p.level));
    if (wt === 'sword' && o.physical) R.gainSkillExp('storm_blade', usageExp(0.8, e.level, G.p.level));
    if (res.sneak) R.gainSkillExp('stealth', usageExp(1.5, e.level, G.p.level));
    if (wt === 'bow' && o.physical) {
      G.count('bowHits');
      R.checkDiscoveries();
    }
    if (e.c.hp <= 0) this.killEnemy(e, o.skill ?? weaponSkill);
    else if (e.state !== 'windup' || o.heavy || res.crit) {
      if (e.state === 'windup' && (o.heavy || res.crit) && !e.def.boss) {
        e.telegraph.clear();
        e.actor.tint(null);
        e.setState('hurt');
      }
    }
  }

  killEnemy(e: Enemy, skill: string | null) {
    e.setState('dead');
    e.c.hp = 0;
    e.telegraph.clear();
    e.icon.setText('');
    const a = e.actor;
    a.body2.setVelocity(0, 0);
    a.body2.enable = false;
    Sound.sfx('die', 0.7);
    if (a.kind === 'lpc') a.play('die', { loop: false, hold: true });
    else if (e.def.id === 'wolf') a.play('die', { loop: false });
    this.tweens.add({ targets: a, alpha: 0, delay: 900, duration: 700, onComplete: () => { e.destroy(); this.enemies = this.enemies.filter((x) => x !== e); } });
    if (a.kind !== 'lpc' && e.def.id !== 'wolf') this.tweens.add({ targets: a, scaleY: 0.3, scaleX: 1.3, duration: 400, ease: 'Quad.In' });
    // ödüller
    const exp = monsterExp(e.def, e.level);
    const share = splitExp(exp, e.damageBy);
    // C4: Joseph yalnızca kendi vurduğu düşmandan EXP alır
    if (share.joseph) {
      R.gainExp(share.joseph);
      this.fx.number(e.x, e.y - 52, `+${share.joseph} EXP`, 'exp');
    }
    R.divineVictory(e.level, !!e.def.boss);
    G.state.killed[e.def.id] = (G.state.killed[e.def.id] ?? 0) + 1;
    Q.notify('kill', e.def.id);
    this.director.onKill(e);
    // başarı EXP'si
    if (skill) {
      const ach = achievementExp(e.level, G.p.level, 1, !!e.def.boss);
      if (ach > 0) R.gainSkillExp(skill, ach);
    }
    // title kontrolleri
    const pl = G.p;
    if (pl.hp / G.d.maxHp < 0.15 && e.level > pl.level) R.grantTitle('unyielding');
    this.killsThisCombat[e.def.id] = (this.killsThisCombat[e.def.id] ?? 0) + 1;
    if (e.def.id === 'wolf' && this.killsThisCombat.wolf >= 3) R.grantTitle('pack_hunter');
    if (e.def.id === 'goblin_chief') {
      R.grantTitle('camp_breaker');
      this.director.onBossKilled();
    }
    // drop
    const drops = rollDrops(e.def, G.d.dropMult);
    let i = 0;
    for (const it of drops.items) this.dropPickup(e.x, e.y, it.id, it.qty, 0, i++, it.special);
    if (drops.money) this.dropPickup(e.x, e.y, '', 0, drops.money, i++);
    // yeniden doğma zamanı
    const spawn = this.mapData.spawns.find((s) => e.spawnId.startsWith(s.id + '#'));
    if (spawn) G.state.respawns[e.spawnId] = this.absMinute() + spawn.respawn;
    G.scheduleSave();
  }

  dropPickup(x: number, y: number, id: string, qty: number, money: number, i: number, special = false) {
    const icon = id ? ITEMS[id].icon : 'coin_bronze';
    const img = this.add.image(x, y - 10, 'icons', this.textures.get('icons').has(icon) ? icon : 'stone').setScale(0.42).setDepth(y + 1);
    const ang = (i / 4) * Math.PI * 2 + Math.random();
    const tx = x + Math.cos(ang) * 18, ty = y + Math.sin(ang) * 10;
    this.tweens.add({ targets: img, x: tx, duration: 400 });
    this.tweens.add({ targets: img, y: { from: y - 10, to: ty - 22 }, duration: 200, yoyo: true, ease: 'Quad.Out', onComplete: () => img.setY(ty) });
    if (special) {
      this.fx.glow(x, y - 10, 0xffd040, 40, 1200);
      this.ui.toastInfo('Nadir bir şey düştü!');
    }
    this.pickups.push({ img, id, qty, money, x: tx, y: ty, t: 0 });
  }

  updatePickups(dt: number) {
    const a = this.player.actor;
    for (const p of [...this.pickups]) {
      p.t += dt;
      p.img.setY(p.y - 4 - Math.sin(p.t * 4) * 2);
      if (p.t < 0.6) continue;
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d < 48) {
        p.x += ((a.x - p.x) / d) * 260 * dt;
        p.y += ((a.y - p.y) / d) * 260 * dt;
        p.img.setX(p.x);
      }
      if (d < 14) {
        if (p.money) R.giveMoney(p.money, 'Ganimet');
        else R.giveItems([{ id: p.id, qty: p.qty }], 'Ganimet');
        Sound.sfx(p.money ? 'coin' : 'pickup');
        p.img.destroy();
        this.pickups = this.pickups.filter((x) => x !== p);
      }
      if (p.t > 120) {
        p.img.destroy();
        this.pickups = this.pickups.filter((x) => x !== p);
      }
    }
  }

  /** Düşmanın yakın dövüş vuruşu oyuncuya isabet ediyor mu? */
  enemyMeleeHit(e: Enemy) {
    if (e.foe) {
      const c = e.foe;
      const range = (e.def.attackRange + 0.35) * TILE * (e.heavyAttack ? 1.7 : 1) + 6;
      const v = new Phaser.Math.Vector2(c.x - e.x, c.y - e.y);
      if (v.length() > range || c.down) return;
      const res = resolvePhysical({ d: e.d, level: e.level }, { d: c.d, level: c.level }, { mult: e.heavyAttack ? 1.6 : 1 });
      if (res.miss) this.fx.number(c.x, c.y - 50, 'Iska!', 'miss');
      else c.hurt(res.damage, v.normalize());
      return;
    }
    const pl = this.player;
    const a = pl.actor;
    const range = (e.def.attackRange + 0.35) * TILE * (e.heavyAttack ? 1.7 : 1) + 6;
    const v = new Phaser.Math.Vector2(a.x - e.x, a.y - e.y);
    const [fx, fy] = e.facingVec();
    const ang = Math.abs(Phaser.Math.Angle.Wrap(v.angle() - Math.atan2(fy, fx)));
    if (v.length() > range || (!e.heavyAttack && ang > 1.15 && v.length() > 14)) return;
    this.resolveIncoming(e, () => {
      const res = resolvePhysical({ d: e.d, level: e.level }, { d: G.d, level: G.p.level }, { mult: e.heavyAttack ? 1.6 : 1 });
      return res;
    }, v.normalize());
  }

  resolveIncoming(e: Enemy | null, calc: () => { damage: number; crit: boolean; miss: boolean }, dir: Phaser.Math.Vector2) {
    const pl = this.player;
    if (pl.dead || this.cutscene) return;
    if (pl.invulnT > 0) {
      // Mükemmel kaçış?
      const sinceDodge = pl.t - pl.dodgeStart;
      const win = 0.2 * G.d.dodgeWindowMult;
      if ((pl.state === 'dodge' || pl.state === 'dash') && sinceDodge <= win + 0.08) this.perfectDodge(e);
      else this.fx.number(pl.actor.x, pl.actor.y - 50, 'Kaçtın', 'miss');
      return;
    }
    const res = calc();
    if (res.miss) {
      this.fx.number(pl.actor.x, pl.actor.y - 50, 'Iska!', 'miss');
      Sound.sfx('miss');
      return;
    }
    this.hurtPlayer(res.damage, dir, res.crit, e);
  }

  perfectDodge(e: Enemy | null) {
    const pl = this.player;
    Sound.sfx('perfect');
    this.slowmoT = 0.45 * G.d.slowmoMult * (G.state.divine.skills.includes('swift_grace') ? 1.5 : 1);
    pl.counterT = 1.6;
    pl.invulnT = Math.max(pl.invulnT, 0.3);
    this.fx.number(pl.actor.x, pl.actor.y - 52, 'Mükemmel!', 'divine');
    this.fx.glow(pl.actor.x, pl.actor.y - 20, 0x9fd6ff, 70, 500);
    if (G.state.divine.skills.length) G.state.divine.light = Math.min(LIGHT_MAX, G.state.divine.light + LIGHT_ON_PERFECT_DODGE * (G.state.divine.skills.includes('swift_grace') ? 2 : 1));
    G.count('perfectDodge');
    R.gainSkillExp('evasion', usageExp(2, e?.level ?? 0, G.p.level));
    R.checkDiscoveries();
  }

  hurtPlayer(dmg: number, dir: Phaser.Math.Vector2, crit: boolean, e: Enemy | null) {
    const pl = this.player;
    const p = G.p;
    let d = dmg;
    if (G.state.divine.skills.includes('guardian_aura')) d = Math.max(1, Math.round(d * 0.9));
    const ironSkin = pl.buffs.find((b) => b.id === 'iron_skin');
    if (ironSkin) d = Math.max(1, Math.round(d * 0.5));
    if (pl.shield > 0) {
      const ab = Math.min(pl.shield, d);
      pl.shield -= ab;
      d -= ab;
      this.fx.number(pl.actor.x, pl.actor.y - 50, `Kalkan -${ab}`, 'divine');
      if (d <= 0) return;
    }
    this.enterCombat();
    if (p.hp - d <= 0 && G.state.divine.skills.includes('second_wind') && !pl.secondWindUsed) {
      pl.secondWindUsed = true;
      p.hp = 1;
      pl.invulnT = 1.2;
      this.fx.glow(pl.actor.x, pl.actor.y - 20, 0xffe28a, 90, 900);
      Sound.sfx('holy');
      R.sysmsg('İKİNCİ NEFES', ['Öldürücü darbeyi ışık karşıladı. 1 HP ile ayaktasın.'], { sound: 'system' });
      return;
    }
    p.hp = Math.max(0, p.hp - d);
    pl.actor.flash(0xff4030, 0.12);
    pl.actor.kb.set(dir.x, dir.y).scale(170);
    pl.invulnT = 0.45;
    this.fx.number(pl.actor.x, pl.actor.y - 50, `-${d}`, 'hurt');
    Sound.sfx('hurt');
    if (G.settings.shake) this.cameras.main.shake(120, 0.008 * (4 / Display.worldZoom));
    this.ui.flashDamage();
    if (p.hp <= 0) {
      this.playerDeath();
      return;
    }
    if (pl.state === 'free' || pl.state === 'attack') {
      pl.setState('hurt');
      pl.actor.play('hurt', { loop: false });
    }
    G.events.emit('stats');
  }

  spawnBolt(e: Enemy, dir: Phaser.Math.Vector2) {
    const img = this.add.image(e.x + dir.x * 10, e.y - 20 + dir.y * 10, 'bolt').setBlendMode(Phaser.BlendModes.ADD).setDepth(930000).setScale(1.2);
    this.projectiles.push({ img, vx: dir.x * 4.2 * TILE, vy: dir.y * 4.2 * TILE, life: 2, fromPlayer: false, enemy: e, power: 0, radius: 8, hits: new Set(), element: 'fire' });
    Sound.sfx('fire', 0.5);
  }

  spawnArrow(dir: Phaser.Math.Vector2, mult: number) {
    const a = this.player.actor;
    const img = this.add.image(a.x + dir.x * 12, a.y - 22 + dir.y * 8, 'arrow').setRotation(dir.angle()).setDepth(930000);
    this.projectiles.push({ img, vx: dir.x * 11 * TILE, vy: dir.y * 11 * TILE, life: 0.75, fromPlayer: true, power: mult, radius: 10, hits: new Set(), physical: true });
  }

  spawnSpellProjectile(dir: Phaser.Math.Vector2, techId: string, power: number, radius: number, color: number, ignite: boolean, element: string, range: number, physical = false) {
    const a = this.player.actor;
    const img = this.add.image(a.x + dir.x * 12, a.y - 22 + dir.y * 8, physical ? 'slash' : 'bolt').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(930000).setScale(physical ? 0.5 : 1.3).setRotation(dir.angle());
    const sp = 8 * TILE;
    this.projectiles.push({ img, vx: dir.x * sp, vy: dir.y * sp, life: range / 8, fromPlayer: true, tech: techId, power, radius, hits: new Set(), ignite, element, physical });
  }

  updateProjectiles(dt: number) {
    const m = this.mapData;
    for (const p of [...this.projectiles]) {
      p.life -= dt;
      p.img.x += p.vx * dt;
      p.img.y += p.vy * dt;
      const tx = Math.floor(p.img.x / TILE), ty = Math.floor((p.img.y + 16) / TILE);
      let dead = p.life <= 0 || (tx >= 0 && ty >= 0 && tx < m.w && ty < m.h && m.terrain[ty * m.w + tx] !== 8 && blockedAt(m, this.propCol, p.img.x, p.img.y + 16));
      if (p.ignite) this.tryIgnite(p.img.x, p.img.y + 16);
      if (p.fromPlayer) {
        for (const e of this.enemies) {
          if (!e.alive || p.hits.has(e)) continue;
          if (Math.hypot(e.x - p.img.x, e.y - 18 - p.img.y) < p.radius + e.actor.bodyR) {
            p.hits.add(e);
            const dir = new Phaser.Math.Vector2(p.vx, p.vy).normalize();
            if (p.comp) {
              this.companionHit(p.comp, e, dir, p.power);
              dead = true;
              break;
            }
            if (p.physical) this.hitEnemy(e, { dir, physical: true, mult: p.power, skill: p.tech ? this.techSkill(p.tech) : undefined });
            else this.hitEnemy(e, { dir, spell: { base: p.power, element: p.element }, skill: p.tech ? this.techSkill(p.tech) : undefined, knock: 0.5 });
            if (p.tech === 'fireball') this.explode(p.img.x, p.img.y, 1.5 * TILE * G.d.areaMult, p.power * 0.6, p.tech);
            if (p.tech !== 'static_bolt') dead = true;
          }
        }
      } else {
        const a = this.player.actor;
        for (const c of this.companions) {
          if (c.down || dead) continue;
          if (Math.hypot(c.x - p.img.x, c.y - 18 - p.img.y) < p.radius + 8) {
            dead = true;
            const e = p.enemy!;
            const res = resolveSpell({ d: e.d, level: e.level }, { d: c.d, level: c.level }, e.def.natural.dmg, { element: 'fire' });
            if (!res.miss) c.hurt(res.damage, new Phaser.Math.Vector2(p.vx, p.vy).normalize());
          }
        }
        if (!dead && Math.hypot(a.x - p.img.x, a.y - 18 - p.img.y) < p.radius + 8) {
          dead = true;
          const e = p.enemy!;
          const dir = new Phaser.Math.Vector2(p.vx, p.vy).normalize();
          this.resolveIncoming(e, () => resolveSpell({ d: e.d, level: e.level }, { d: G.d, level: G.p.level }, e.def.natural.dmg, { element: 'fire' }), dir);
        }
      }
      if (dead) {
        if (!p.fromPlayer || p.element) this.fx.sparks(p.img.x, p.img.y, p.element === 'fire' ? 0xff9a40 : 0x9fd6ff, 6);
        p.img.destroy();
        this.projectiles = this.projectiles.filter((x) => x !== p);
      }
    }
  }

  techSkill(tech: string): string | undefined {
    for (const s of G.p.skills) if (techniquesOf(s).includes(tech)) return s.id;
    return undefined;
  }

  explode(x: number, y: number, r: number, power: number, tech?: string) {
    this.fx.ring(x, y, 0xff8a30, r, 400);
    this.fx.glow(x, y, 0xff7a20, r, 500);
    Sound.sfx('fire');
    for (const e of this.enemies) if (e.alive && Math.hypot(e.x - x, e.y - y) < r) this.hitEnemy(e, { dir: new Phaser.Math.Vector2(e.x - x, e.y - y).normalize(), spell: { base: power, element: 'fire' }, skill: tech ? this.techSkill(tech) : undefined });
  }

  tryIgnite(x: number, y: number) {
    for (const p of this.r.propImages) {
      if (!['bush_s1', 'bush_s2', 'bush_s3', 'shrub', 'hay_pile', 'hay_roll', 'fern'].includes(p.p.key)) continue;
      if ((p as any).burnt) continue;
      if (Math.hypot(p.p.x - x, p.p.y - 8 - y) < 18) {
        (p as any).burnt = true;
        const img = p.img;
        this.r.lights.push({ x: p.p.x, y: p.p.y - 10, radius: 80, color: 0xff8a30, flicker: true, phase: 0 });
        this.lighting.setLights(this.r.lights);
        for (let i = 0; i < 10; i++) this.time.delayedCall(i * 120, () => this.ember(p.p.x + (Math.random() - 0.5) * 16, p.p.y - 8));
        this.r.culler?.hidden.add(img);
        this.tweens.add({ targets: img, alpha: 0, tint: 0x301000, duration: 1600, onComplete: () => img.setVisible(false) });
        // engeli kaldır
        const tx = Math.floor(p.p.x / TILE), ty = Math.floor(p.p.y / TILE);
        this.mapData.solid[ty * this.mapData.w + tx] = 0;
        this.propCol?.disableNear(p.p.x, p.p.y - 4, 6);
        Sound.sfx('fire');
      }
    }
  }

  // ================================================================= teknikler
  equippedTechniques(): string[] {
    const out: string[] = [];
    for (const s of G.p.skills) for (const t of techniquesOf(s)) if (!out.includes(t)) out.push(t);
    return out.slice(0, 4);
  }

  useSkillSlot(i: number) {
    const techs = this.equippedTechniques();
    const id = techs[i];
    if (!id) return;
    const t = TECHNIQUES[id];
    const pl = this.player;
    if ((pl.skillCd[id] ?? 0) > 0) {
      Sound.sfx('error', 0.4);
      return;
    }
    if (G.p.mp < t.mp) {
      this.fx.number(pl.actor.x, pl.actor.y - 50, 'MP yetersiz', 'miss');
      Sound.sfx('error', 0.4);
      return;
    }
    if (t.weapon && t.weapon !== G.d.weaponType) {
      this.fx.number(pl.actor.x, pl.actor.y - 50, 'Uygun silah yok', 'miss');
      Sound.sfx('error', 0.4);
      return;
    }
    G.p.mp -= t.mp;
    pl.skillCd[id] = t.cooldown;
    const dir = this.aimAssist(t.range ?? 2);
    pl.actor.face(dirFromVec(dir.x, dir.y, pl.actor.dir));
    const skill = this.techSkill(id);
    const color = t.element === 'fire' ? 0xff8a30 : t.element === 'lightning' ? 0xbfe4ff : t.element === 'wind' ? 0xd8fff0 : t.element === 'heal' ? 0x9fffa0 : 0xffffff;
    switch (t.kind) {
      case 'projectile': {
        pl.setState('cast');
        pl.actor.play(t.weapon === 'bow' ? 'shoot' : 'cast', { loop: false, restart: true, speed: 1.6 });
        const hits = t.hits ?? 1;
        for (let k = 0; k < hits; k++) {
          const dd = dir.clone().rotate((k - (hits - 1) / 2) * 0.12);
          this.time.delayedCall(k * 60, () => this.spawnSpellProjectile(dd, id, t.power, t.radius ? 8 : 8, color, !!t.ignites, t.element ?? 'physical', t.range ?? 5, t.weapon === 'bow' || t.element === 'wind'));
        }
        Sound.sfx(t.element === 'fire' ? 'fire' : 'swing', 0.6);
        break;
      }
      case 'cone': {
        pl.setState('cast');
        pl.actor.play('cast', { loop: false, restart: true, speed: 1.6 });
        const r = (t.range ?? 2) * TILE * G.d.areaMult;
        for (let k = 0; k < 14; k++) {
          const dd = dir.clone().rotate((Math.random() - 0.5) * 1.0);
          const im = this.add.image(pl.actor.x, pl.actor.y - 18, 'bolt').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(930000);
          this.tweens.add({ targets: im, x: im.x + dd.x * r, y: im.y + dd.y * r, alpha: 0, scale: 2, duration: 350, onComplete: () => im.destroy() });
        }
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const v = new Phaser.Math.Vector2(e.x - pl.actor.x, e.y - pl.actor.y);
          if (v.length() < r && Math.abs(Phaser.Math.Angle.Wrap(v.angle() - dir.angle())) < 0.6) this.hitEnemy(e, { dir, spell: { base: t.power, element: t.element }, skill });
        }
        this.tryIgnite(pl.actor.x + dir.x * 24, pl.actor.y + dir.y * 24);
        Sound.sfx('fire');
        break;
      }
      case 'melee_multi': {
        const n = t.hits ?? 1;
        for (let k = 0; k < n; k++) {
          this.time.delayedCall(k * 140, () => {
            pl.actor.play(G.d.weaponType === 'spear' ? 'thrust' : 'slash', { loop: false, restart: true, speed: 2.2 });
            Sound.sfx('swing');
            const reach = pl.weaponReach() * TILE * (t.range ? t.range / 1.5 : 1);
            this.fx.slashArc(pl.actor.x + dir.x * 16, pl.actor.y - 14 + dir.y * 16, dir.angle() + (k % 2 ? 0.6 : -0.6), 0xbfe4ff);
            for (const e of this.enemies) {
              if (!e.alive) continue;
              const v = new Phaser.Math.Vector2(e.x - pl.actor.x, e.y - pl.actor.y);
              if (v.length() - e.actor.bodyR < reach && Math.abs(Phaser.Math.Angle.Wrap(v.angle() - dir.angle())) < 1.0) this.hitEnemy(e, { dir, physical: true, mult: t.power, skill });
            }
          });
        }
        pl.setState('attack');
        pl.attackHitDone = true;
        pl.attackDur = n * 0.14 + 0.25;
        break;
      }
      case 'heal': {
        const amt = Math.round(t.power * spellPowerMult(G.d.stats.INT, G.d.stats.MNA) * G.d.healMult);
        G.p.hp = Math.min(G.d.maxHp, G.p.hp + amt);
        this.fx.number(pl.actor.x, pl.actor.y - 50, `+${amt}`, 'heal');
        this.fx.glow(pl.actor.x, pl.actor.y - 20, 0x9fffa0, 50);
        Sound.sfx('heal');
        if (skill && G.p.hp < G.d.maxHp) R.gainSkillExp(skill, 0.8);
        pl.setState('cast');
        pl.actor.play('cast', { loop: false, restart: true, speed: 1.6 });
        break;
      }
      case 'buff': {
        pl.buffs.push({ id: id === 'regeneration' ? 'regen' : id, t: t.duration ?? 5, amount: t.power });
        this.fx.glow(pl.actor.x, pl.actor.y - 20, color, 50);
        Sound.sfx('heal');
        break;
      }
      case 'aoe':
      case 'wall':
      case 'counter': {
        this.explode(pl.actor.x + dir.x * 40, pl.actor.y + dir.y * 40, (t.radius ?? 2) * TILE * G.d.areaMult, t.power, id);
        break;
      }
    }
    G.events.emit('stats');
  }

  ownedDivineActives(): string[] {
    return G.state.divine.skills.filter((s) => DIVINE_BY_ID[s]?.kind === 'active');
  }

  useDivineSlot(i: number) {
    const id = this.ownedDivineActives()[i];
    if (!id) return;
    const def = DIVINE_BY_ID[id];
    const dv = G.state.divine;
    const pl = this.player;
    if ((pl.skillCd['dv_' + id] ?? 0) > 0) return;
    if (dv.light < def.light) {
      this.fx.number(pl.actor.x, pl.actor.y - 50, 'Işık yetersiz', 'miss');
      Sound.sfx('error', 0.4);
      return;
    }
    dv.light -= def.light;
    pl.skillCd['dv_' + id] = def.cooldown;
    const power = G.d.divPower;
    switch (id) {
      case 'holy_shield':
        pl.startShield(Math.round(4 + G.d.maxHp * 0.3 * G.d.divEndurance), 5);
        Sound.sfx('holy');
        this.fx.ring(pl.actor.x, pl.actor.y - 20, 0xffe28a, 40);
        break;
      case 'light_step':
        pl.lightDash();
        break;
      case 'holy_strike':
        pl.holyNext = true;
        this.fx.glow(pl.actor.x, pl.actor.y - 20, 0xffe28a, 40);
        Sound.sfx('holy');
        break;
      case 'purify': {
        const amt = Math.round(G.d.maxHp * 0.2);
        G.p.hp = Math.min(G.d.maxHp, G.p.hp + amt);
        this.fx.number(pl.actor.x, pl.actor.y - 50, `+${amt}`, 'heal');
        Sound.sfx('heal');
        break;
      }
      case 'judgement': {
        const dir = this.aimAssist(6);
        const len = 7 * TILE;
        const beam = this.add.rectangle(pl.actor.x, pl.actor.y - 18, len, 10, 0xfff2b0, 0.9).setOrigin(0, 0.5).setRotation(dir.angle()).setBlendMode(Phaser.BlendModes.ADD).setDepth(930000);
        this.tweens.add({ targets: beam, alpha: 0, scaleY: 3, duration: 400, onComplete: () => beam.destroy() });
        Sound.sfx('holy');
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const v = new Phaser.Math.Vector2(e.x - pl.actor.x, e.y - pl.actor.y);
          const along = v.dot(dir);
          const perp = Math.abs(v.x * dir.y - v.y * dir.x);
          if (along > 0 && along < len && perp < 20) this.hitEnemy(e, { dir, spell: { base: 6 * power }, mult: 1 });
        }
        break;
      }
      case 'radiance':
        this.fx.ring(pl.actor.x, pl.actor.y - 10, 0xffe28a, 100, 500);
        Sound.sfx('holy');
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const v = new Phaser.Math.Vector2(e.x - pl.actor.x, e.y - pl.actor.y);
          if (v.length() < 3 * TILE) {
            this.hitEnemy(e, { dir: v.normalize(), spell: { base: 3 * power }, knock: 2.5 });
            e.stunT = 1.2;
          }
        }
        break;
    }
    G.events.emit('stats');
  }

  // ================================================================= ölüm
  playerDeath() {
    const pl = this.player;
    pl.setState('dead');
    pl.actor.play('die', { loop: false, hold: true });
    pl.actor.body2.setVelocity(0, 0);
    this.cutscene = true;
    Sound.sfx('die');
    Sound.play('none');
    this.slowmoT = 1;
    this.time.delayedCall(1100, () => {
      this.cameras.main.fadeOut(900, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', async () => {
        const lost = loseMoneyPercent(G.p as any, 0.1);
        const lostExp = R.loseTodayExp();
        await this.ui.deathScreen(lost, lostExp);
        // yeniden doğ
        const sp = G.state.spawn;
        const p = G.p;
        p.hp = G.d.maxHp;
        p.stamina = G.d.maxStamina;
        p.mp = G.d.maxMp;
        R.resetStreak();
        G.state.divine.light = 0;
        this.inBattle = false;
        this.cutscene = false;
        const pt = sp.map === 'world' && !sp.x ? getMap(this, 'world').points.wake : { x: sp.x, y: sp.y };
        this.loadMap(sp.map, pt.x, pt.y, 'down');
        this.cameras.main.fadeIn(800);
        G.save('auto');
        this.director.onRespawn();
      });
    });
  }

  /** Uyku: sabaha atla, kaydet. */
  sleep(spawn: { map: string; x: number; y: number }) {
    G.state.spawn = { ...spawn };
    R.resetStreak();
    this.director.onSleep();
  }
}
