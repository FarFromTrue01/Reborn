import Phaser from 'phaser';
import { G } from '../game/G';
import { Display } from '../game/display';
import { firstHop, warpCenterPx, distToRect, BED_REACH } from '../world/nav';
import { questSources, sourceWaitText, type SourceCtx } from '../world/sources';
import { interactBox } from '../data/props';
import { Input } from '../game/input';
import { Sound } from '../audio/audio';
import { type BuildingMeta } from '../world/worldgen';
import { buildMaps } from '../world/maps';
import { renderMap, type RenderedMap } from '../world/mapRender';
import { Lighting } from '../world/lighting';
import { FX } from '../world/fx';
import { Player } from '../world/player';
import { Enemy } from '../world/enemy';
import { Npc, MARKER_ICON, type MarkerKind } from '../world/npc';
import { Companion } from '../world/companion';
import { TILE, type MapData, type Zone, type PropPlacement } from '../world/types';
import { COMPANIONS, COMPANION_DMG_MULT } from '../data/companions';
import { NPCS, NPC_BY_ID, scheduleAt, CASTE_BUBBLES, TONE_LINES, type NpcDef, type JosephStatus } from '../data/npcs';
import { josephStatusOf, toneOf, type Tone } from '../core/prestige';
import { nearestFree } from '../world/path';
import { PropCollision, blockedAt } from '../world/collision';
import { daylight, hourOf, advance } from '../core/time';
import { resolvePhysical, resolveSpell } from '../world/combat';
import { monsterExp, rollDrops, splitExp } from '../core/monster';
import { usageExp, achievementExp, equippedTechniques, sanitizeSlots, ownedTechniques } from '../core/skills';
import { useTechnique, ownerOf, elementStatus, ELEMENT_COLOR } from '../world/techniques';
import { BURN_PER_SEC } from '../core/status';
import type { TechniqueDef } from '../core/types';
import { TECHNIQUES } from '../data/skills';
import { ITEMS } from '../data/items';
import { DIVINE_BY_ID } from '../data/divine';
import { LIGHT_MAX, LIGHT_ON_HIT, LIGHT_ON_PERFECT_DODGE, streakExpired } from '../core/divine';
import { canInterrupt, refundEvade } from '../core/combat';
import { fmtHp } from '../ui/format';
import { loseMoneyPercent, forfeitLoot, emptyLoot, lootEmpty, type BattleLoot } from '../core/transactions';
import { walletTotal } from '../core/money';
import { appraisalBaseExp, noticesAppraisal, appraisalReady, claimAppraisalExp, type AppraisalExpClock } from '../core/appraisal';
import { newEatState, type EatState } from '../core/eating';
import { spellPowerMult, applyDamage, roundDamage } from '../core/formulas';
import { dirFromVec, dirVec, type Dir } from '../world/actor';
import * as R from '../game/rules';
import type { UIScene } from './UIScene';
import { Director } from '../story/director';
import { Q } from '../game/questrt';
import { scheduleAt as schedAt } from '../data/npcs';
import { PathQueue, ArrivalQueue } from '../world/npcQueue';
import { nextReach, waitText, type ReachCtx } from '../world/reach';
import { whenLabel } from '../core/time';
import { absMinute } from '../core/sleep';
import { activeQuests, currentObjective, objectiveOpen, type QuestTarget, type QuestGuide } from '../core/quests';
import { MONSTERS } from '../data/monsters';
import { SeatBook, SEAT_RE } from '../world/seats';
import { doorGoal, gatherQty } from '../world/questGo';

/** Kapı adları (bekleme metinleri: "Lonca 05:00'te açılır"). */
const DOOR_NAMES: Record<string, string> = {
  guild: 'Lonca', healer: 'Şifa Evi', smithy: 'Demirhane', shop: 'Dükkân', bakery: 'Fırın', tailor: 'Terzi', tannery: 'Tabakhane', lodge: 'Avcı kulübesi',
};

/** Görüş alanının kenarından bu kadar karo dışarıdaki NPC'ler hafif güncellenir (oyuncu fark etmez). */
const NPC_FAR_PAD = 6;
/** Toplanabilir şeylerin parladığı yarıçap (karo). */
const GATHER_GLOW_R = 3.5;
/** "Görev saatine kadar uyu" yalnızca bu kadar dakika içindeki beklemeler için. */
const QUEST_SLEEP_MAX = 36 * 60;
/** A7.7: sol üst görev panelinin genişliği (UI birimi, kenar payıyla). */
const HUD_PANEL_W = 316;


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
interface Projectile { img: Phaser.GameObjects.Image; vx: number; vy: number; life: number; fromPlayer: boolean; comp?: Companion; enemy?: Enemy; tech?: string; power: number; radius: number; hits: Set<Enemy>; ignite?: boolean; element?: string; physical?: boolean; pierce?: boolean; skill?: string; arrow?: boolean }

export class WorldScene extends Phaser.Scene {
  mapData!: MapData;
  r!: RenderedMap;
  player!: Player;
  enemies: Enemy[] = [];
  npcs: Npc[] = [];
  /** Karede en fazla bir NPC yol araması (A*). */
  pathQueue = new PathQueue();
  /** Handaki oturma yerleri rezervasyonu (0.6.0; oturma noktası olan iç mekânlarda). */
  seatBook: SeatBook | null = null;
  /** Program gereği bu haritaya gelen NPC'ler: kapıdan teker teker, 0,3–1 sn arayla (karede en fazla bir). */
  npcArrivals = new ArrivalQueue<NpcDef>(0.3, 1);
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
  /** B15 (0.8.0): savaş modu boyunca toplanan ganimet; savaş bitmeden ölünürse kaybolur, bitince güvende. */
  battleLoot: BattleLoot = emptyLoot();
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
  /** Appraisal EXP'sinin 10 sn genel beklemesi (oturum içi, kayda yazılmaz). */
  private appraisalExpClock: AppraisalExpClock = { lastAt: null };
  /** Son öldürmeden bu yana geçen oyun saniyesi: 30 sn öldürme olmazsa Divine serisi sıfırlanır. */
  sinceKill = 0;
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

  /**
   * Oturum durumunu sıfırla. World sahnesi kayıt yüklerken ve ana menüden dönünce yeniden
   * başlatılır; alanlar eski değerini korur (ör. 'menu' dondurma nedeni, yok edilmiş oyuncu ve
   * harita nesneleri, eski saat). Yeni alan eklerken buraya da ekle (tests/sceneState.test.ts denetler).
   */
  private resetState() {
    // önceki çalıştırmanın nesneleri sahne kapanırken yok edildi; loadMap onlara dokunmasın
    this.mapData = undefined!;
    this.r = undefined!;
    this.player = undefined!;
    this.enemies = [];
    this.npcs = [];
    this.pathQueue = new PathQueue();
    this.npcArrivals = new ArrivalQueue<NpcDef>(0.3, 1);
    this.seatBook = null;
    this.cutscene = false;
    this.paused = false;
    this.frozen = false;
    this.freezeReasons = new Set<string>();
    this.darkness = 0;
    this.timeAcc = 0;
    this.pickups = [];
    this.projectiles = [];
    this.companions = [];
    this.incoming = [];
    this.bubbleGlobalCd = 0;
    this.zone = null;
    this.inBattle = false;
    this.battleT = 0;
    this.fogT = 0;
    this.ambientT = 0;
    this.appraiseEventT = 40;
    this.collider = null;
    this.propCol = null;
    this.killsThisCombat = {};
    this.battleLoot = emptyLoot();
    this.lowHpWin = false;
    this.warpCooldown = 0;
    this.lockedMsgT = 0;
    this.slowmoT = 0;
    this.rays = [];
    this.lastHour = -1;
    this.transitioning = false;
    this.zoneNameShown = '';
    this.playClock = 0;
    this.eatState = newEatState();
    this.lastAppraiseAt = null;
    this.appraisalExpClock = { lastAt: null };
    this.sinceKill = 0;
    this.autoSaveT = 0;
    this.questT = 0;
    this.assistMarkT = 0;
    this.assistLast = null;
    this.npcMarks = {};
    this.gatherDay = -1;
    this.sideMarks = {};
    this.buildingMarks = new Map();
    this.gatherGlows = new Map();
    this.camFollow = true;
    this.viewRect = new Phaser.Geom.Rectangle();
    this.camX = 0;
    this.camY = 0;
    this.casteT = 0;
    Q.clearDeferred();
  }

  create() {
    this.resetState();
    G.inGame = true;
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
    // iksir/sargı iyileşmesi: İlk Yardım S- (Saha Hekimi) payı yoldaşlara
    const onHealed = (amt: number) => this.shareHeal(amt, 0);
    G.events.on('healed', onHealed);
    this.events.once('shutdown', () => G.events.off('healed', onHealed));
    Q.waitOf = (id) => this.questWait(id)?.text ?? null;
    Q.guidesOf = (id) => this.director.questGuides(id);
    this.events.once('shutdown', () => {
      Q.waitOf = null;
      Q.guidesOf = null;
    });
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
    const prevMap = this.mapData?.id ?? null;
    // temizle
    for (const e of this.enemies) e.destroy();
    for (const n of this.npcs) n.destroy();
    for (const c of this.companions) c.destroy();
    this.companions = [];
    for (const p of this.pickups) p.img.destroy();
    for (const p of this.projectiles) p.img.destroy();
    for (const r of this.rays) r.destroy();
    for (const t of this.buildingMarks.values()) t.destroy();
    this.buildingMarks.clear();
    for (const gl of this.gatherGlows.values()) gl.destroy();
    this.gatherGlows.clear();
    this.enemies = [];
    this.npcs = [];
    this.pathQueue.clear();
    this.npcArrivals.clear();
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
    this.seatBook = this.makeSeatBook(m);
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
    this.applyGatherVisuals();
    // ortam
    if (!m.indoor) this.makeRays();
    this.zone = null;
    this.updateZone(true);
    this.warpCooldown = 0.6;
    this.ui?.onMapChanged?.();
    if (!first) {
      // sahne ya da ışınlanmayla girilen binalar için de (A2)
      if (prevMap && prevMap !== id) this.completeDoorGoals(prevMap, id);
      this.director.onEnterMap(id);
    }
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
    // 0.8.0 (C6): yoldaş hasarı ×0,15 (yardım eder, işi yapmaz)
    const res = resolvePhysical({ d: c.d, level: c.level }, { d: e.d, level: e.level }, { mult: mult * COMPANION_DMG_MULT * (1 + (c.rallyT > 0 ? c.rallyDmg : 0)) });
    e.aware || e.becomeAware(true);
    e.barShowT = 3;
    if (res.miss) {
      this.fx.number(e.x, e.y - 40, 'Iska!', 'miss');
      return;
    }
    e.c.hp = applyDamage(e.c.hp, res.damage);
    e.damageBy[c.id] = (e.damageBy[c.id] ?? 0) + res.damage;
    e.actor.kb.set(dir.x, dir.y).scale(110 * (e.def.boss ? 0.3 : 1));
    e.actor.flash(0xffffff, 0.06);
    this.fx.sparks(e.x, e.y - 18, 0xd8f0ff, 5);
    this.fx.number(e.x, e.y - 40, fmtHp(res.damage) + (res.crit ? '!' : ''), 'info');
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
  /**
   * Sayfa gizlenirken / bağlam kaybolurken otomatik kayıt. Ara sahne, diyalog, harita geçişi ya da
   * ölüm ortasında kaydetmez (yarım kalmış durum yazılmasın); o zaman son otomatik kayıt geçerli.
   */
  snapshotSave(): boolean {
    if (!this.player || this.cutscene || this.ui?.dialogueOpen() || this.transitioning || this.player.dead || this.director?.isBusy) return false;
    const ok = G.save('auto');
    if (ok) this.autoSaveT = 0;
    return ok;
  }

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
        if (!objectiveOpen(def, log.quests[id], i)) return;
        if (o.type === 'go' && o.where && o.where.map === this.mapData.id) {
          const p = this.goPoint(o.where);
          if (p && Math.hypot(a.x - (p.x * TILE + 16), a.y - (p.y * TILE + 16)) < (o.where.radius ?? 1.5) * TILE) this.reachGo(id, i);
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

  /** "Git" amacının hedef karosu (adlandırılmış nokta ya da koordinat). */
  goPoint(w: QuestTarget): { x: number; y: number } | null {
    return w.point ? getMap(this, w.map).points[w.point] ?? null : w.x !== undefined ? { x: w.x, y: w.y! } : null;
  }

  private reachGo(id: string, i: number) {
    if (this.director.onQuestGo(id, i) !== false) Q.advance(id, i);
  }

  /**
   * A2 (0.8.0): hedefi bir binanın kapısı olan "git" amaçları, o binaya girilince de tamamlanır. Görev
   * denetimi yarım saniyede bir çalıştığından kapının önünden hızla geçen oyuncu amacı atlayabiliyordu.
   * `from`: kapının bulunduğu harita (dünya), `to`: girilen bina.
   */
  completeDoorGoals(from: string, to: string) {
    if (!to || from === to) return;
    const doors = getMap(this, from).warps.filter((w) => w.to === to);
    if (!doors.length) return;
    const log = G.state.quests;
    for (const id of Object.keys(log.quests)) {
      if (log.quests[id].status !== 'active') continue;
      const def = Q.def(id);
      if (!def) continue;
      def.objectives.forEach((o, i) => {
        if (o.type !== 'go' || !o.where || o.where.map !== from || Q.objDone(id, i)) return;
        if (!objectiveOpen(def, log.quests[id], i)) return;
        const p = this.goPoint(o.where);
        if (p && doorGoal(p, doors)) this.reachGo(id, i);
      });
    }
  }

  // ================================================================= görev hedefleri ve beklemeler (0.6.0)
  /** Bir haritanın adlandırılmış noktaları (yüklü olmasa da). */
  pointsOf(map: string): Record<string, { x: number; y: number }> {
    return getMap(this, map).points;
  }

  /** Bir kapı bu saatte açık mı? (Hikâye istisnaları: ör. yaralılar görevi sırasında şifa evi.) */
  warpOpen(w: MapData['warps'][number], hour: number): boolean {
    if (!w.to) return false;
    const ov = this.director.doorOverride(w);
    if (ov !== undefined) return ov;
    if (!w.hours) return true;
    return hour >= w.hours[0] && hour < w.hours[1];
  }

  /** Dünyadan bu iç mekâna bu saatte girilebilir mi? (NPC'ye ulaşılabilirlik) */
  reachCtx(): ReachCtx {
    const warps = getMap(this, 'world').warps;
    return {
      open: (map, hour) => {
        if (map === 'world') return true;
        const w = warps.find((x) => x.to === map);
        return w ? this.warpOpen(w, hour) : false;
      },
    };
  }

  /**
   * Görevin şu anki amacı beklemede mi? Hikâye kapısı (ertesi gün, akşam), kapalı bina ya da hedef NPC'ye şu an
   * ulaşılamıyor. Beklemedeyken yön oku gösterilmez; metin HUD'da ve görev sekmesinde görünür, uyku menüsü
   * "Görev saatine kadar uyu" sunar.
   */
  questWait(id: string): { text: string; until: number | null } | null {
    const w = this.questWaitRaw(id);
    // A7.4: uyunabilir bekleme (görev saatine kadar uyu menüde) ve yatak varsa metin bunu söyler
    if (w && w.until !== null && this.director.hasBed()) {
      const now = this.absMinute();
      if (w.until > now && w.until - now <= QUEST_SLEEP_MAX) return { text: `${w.text.replace(/ — o saate kadar bekle$/, '')} — yatakta uyuyarak atlayabilirsin`, until: w.until };
    }
    return w;
  }

  private questWaitRaw(id: string): { text: string; until: number | null } | null {
    // A7.5: alt göreve bağlı amaç (m_grank → g1_rats): bekleme alt görevden
    const sub = Q.targetOf(id);
    if (sub && sub.id !== id) return this.questWaitRaw(sub.id);
    const def = Q.def(id);
    const st = G.state.quests.quests[id];
    if (!def || !st || st.status !== 'active') return null;
    const i = currentObjective(def, st);
    if (i < 0) return null;
    const story = this.director.ch2.objectiveWait(id, i);
    if (story) return story;
    const o = def.objectives[i];
    const t0 = this.director.ch2.targetOverride(id) ?? o.where;
    if (!t0) return null;
    const t = this.withItem(t0, o);
    const now = this.absMinute();
    // B10: kaynakların hepsi tükendi — toplama noktaları bugün toplandı ve/veya o yaratıktan kimse kalmadı.
    // Bu bekleme uyuyarak atlanmaz (until: null); dönüş saati metinde.
    if ((t.item || t.monster) && !t.npc) {
      const src = questSources(t, this.sourceCtx());
      if (src.any && !src.live.length) return { text: sourceWaitText(t, src, now), until: null };
    }
    const hour = G.state.time.minute / 60;
    if (t.map !== 'world' && t.map !== this.mapData.id) {
      const w = getMap(this, 'world').warps.find((x) => x.to === t.map);
      if (w && w.hours && !this.warpOpen(w, hour)) {
        const day = G.state.time.day + (hour >= w.hours[0] ? 1 : 0);
        const until = absMinute(day, w.hours[0] * 60);
        return { text: `${DOOR_NAMES[t.map] ?? w.label ?? 'Kapı'} ${whenLabel(now, until)} açılır`, until };
      }
    }
    if (t.npc) {
      if (this.npc(t.npc) || this.companion(t.npc)) return null;
      const forced = this.director.npcPlacement(t.npc, t.map);
      if (Array.isArray(forced)) return null;
      const nd = this.npcDef(t.npc);
      if (!nd) return null;
      const r = nextReach(nd, G.state.time.day, G.state.time.minute, this.reachCtx());
      if (r?.now) return null;
      return { text: waitText(nd, now, r), until: r?.abs ?? null };
    }
    return null;
  }

  /** Görev işaretleri (yarım saniyede bir): NPC başları; yan görev işaretleri haritalara da yansır. */
  npcMarks: Record<string, MarkerKind> = {};
  sideMarks: Record<string, 'offer' | 'turnin'> = {};
  /** Dünyada, içinde görev veren biri olan binaların üstündeki işaretler. */
  buildingMarks = new Map<string, Phaser.GameObjects.Image>();

  /**
   * Yan görev işaretlerinin haritadaki yerleri (mini harita ve tam harita): kişi dünyadaysa kendisi (ya da
   * programındaki yer), bir binadaysa o bina (dünya karosu; building: bina kimliği).
   */
  sideMarkSpots(): { id: string; kind: 'offer' | 'turnin'; x: number; y: number; building?: string }[] {
    const out: { id: string; kind: 'offer' | 'turnin'; x: number; y: number; building?: string }[] = [];
    const wm = getMap(this, 'world');
    const bmeta = this.cache.json.get('buildingsMeta');
    const hour = G.state.time.minute / 60;
    for (const [id, kind] of Object.entries(this.sideMarks)) {
      const def = NPC_BY_ID[id];
      if (!def) continue;
      const e = scheduleAt(def, hour, G.state.time.day);
      if (e.map === 'world') {
        const n = this.mapData.id === 'world' ? this.npc(id) : null;
        const p = n ? { x: n.x / TILE, y: n.y / TILE } : Array.isArray(e.at) ? { x: e.at[0], y: e.at[1] } : wm.points[e.at];
        if (p) out.push({ id, kind, x: p.x, y: p.y });
      } else {
        const b = wm.buildings.find((b) => b.enter?.map === e.map);
        if (b && bmeta[b.id]) out.push({ id, kind, x: b.tx + bmeta[b.id].w / TILE / 2, y: b.tyBottom - 2.5, building: b.id });
      }
    }
    return out;
  }

  /** Dünyada bina üstü işaretleri: içeride görev verebilecek biri varsa binanın çatısında mavi "!" ya da "?". */
  updateBuildingMarks() {
    const want = new Map<string, 'offer' | 'turnin'>();
    if (this.mapData.id === 'world') for (const s of this.sideMarkSpots()) if (s.building && (want.get(s.building) !== 'turnin')) want.set(s.building, s.kind);
    for (const [b, t] of this.buildingMarks) {
      if (want.get(b) === (t as any).kind) continue;
      this.tweens.killTweensOf(t);
      t.destroy();
      this.buildingMarks.delete(b);
    }
    if (!want.size) return;
    const bmeta = this.cache.json.get('buildingsMeta');
    for (const [bid, kind] of want) {
      if (this.buildingMarks.has(bid)) continue;
      const b = this.mapData.buildings.find((x) => x.id === bid);
      if (!b || !bmeta[bid]) continue;
      // cephenin üst yarısında: çatının tepesi ekran dışında kalsa da görünür
      const x = b.tx * TILE + bmeta[bid].w / 2, y = b.tyBottom * TILE - bmeta[bid].h * 0.42;
      const t = this.add.image(x, y, 'uiicons', MARKER_ICON[kind]).setOrigin(0.5, 1).setDepth(967000).setScale(36 / 72);
      (t as any).kind = kind;
      this.tweens.add({ targets: t, y: y - 6, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
      this.buildingMarks.set(bid, t);
    }
  }
  updateMarkers() {
    if (this.gatherDay !== G.state.time.day) this.applyGatherVisuals();
    const side = this.director.sideMarks();
    this.sideMarks = side;
    const marks: Record<string, MarkerKind> = { ...side, ...this.director.ch2.npcMarkers() };
    this.npcMarks = marks;
    // başın üstündeki işaret: yan görevde kişi gerçekten iş yerindeyken (yola çıkmışken değil)
    for (const n of this.npcs) {
      const k = marks[n.def.id];
      n.setMarker(k && (k === 'suspect' || this.director.ch2.atPost(n)) ? k : '');
    }
    this.updateBuildingMarks();
  }

  /** Aktif ana (yoksa takip edilen) görevlerin en yakın bekleme saati: uyku menüsü için. */
  questWaitSoonest(): { until: number; text: string } | null {
    const log = G.state.quests;
    const ids = activeQuests(log);
    const order = [...(log.tracked ? [log.tracked] : []), ...ids.filter((id) => Q.def(id)?.kind === 'main')];
    const now = this.absMinute();
    let best: { until: number; text: string } | null = null;
    for (const id of order) {
      const w = this.questWait(id);
      if (!w || w.until === null || w.until <= now || w.until - now > QUEST_SLEEP_MAX) continue;
      if (!best || w.until < best.until) best = { until: w.until, text: w.text };
    }
    return best;
  }

  /** Kaynak süzme bağlamı (B10): dünya doğma grupları, toplama noktaları, ölüm/dönüş zamanları. */
  sourceCtx(): SourceCtx {
    const wm = getMap(this, 'world');
    return {
      spawns: wm.spawns,
      gathers: wm.gathers,
      respawns: G.state.respawns,
      now: this.absMinute(),
      droppersOf: (item) => Object.values(MONSTERS).filter((md) => md.drops.some((d) => d.id === item)).map((md) => md.id),
      gathered: (id) => this.gatheredNow(id),
      regrowAt: (id) => {
        const at = G.state.gatheredAt?.[id];
        const tomorrow = G.state.time.day * 1440;
        return G.d.fx.regrowHalf && at !== undefined ? Math.min(tomorrow, at + 12 * 60) : tomorrow;
      },
    };
  }

  /**
   * Bir eşyanın ya da yaratığın dünyadaki **dolu** kaynakları (B10): içinde yaşayan yaratık olan doğma grupları ve
   * bugün toplanmamış noktalar. Ok, bunların oyuncuya en yakınını gösterir.
   */
  sourcesOf(t: QuestTarget): { x: number; y: number }[] {
    return questSources(t, this.sourceCtx()).live;
  }

  /**
   * A7.6: toplama amacında (eşya belirtilmemişse) hedef eşya amaçtan gelir — ok, bölge noktasına değil en yakın
   * toplanmamış kaynağa yönelir (bölge noktası yalnızca yedek).
   */
  withItem(t: QuestTarget, o?: { type: string; target?: string }): QuestTarget {
    if (t.item || t.npc || t.monster || o?.type !== 'collect' || !o.target) return t;
    const wm = getMap(this, 'world');
    const has = wm.gathers.some((g) => g.item === o.target) || Object.values(MONSTERS).some((md) => md.drops.some((d) => d.id === o.target));
    return has ? { ...t, item: o.target } : t;
  }

  /**
   * Takip edilen görevin bu haritadaki hedefi (piksel). Amaç beklemedeyse görevin alt amacı (ör. "Yukarı çık ve
   * uyu": yatak) hedef olur. Hedef başka bir haritadaysa o haritaya giden kapı ya da merdiven (A7.2/B18).
   */
  questTargetPx(): { x: number; y: number; r: number } | null {
    const tg = Q.target();
    if (!tg) return null;
    const guides = Q.guides(G.state.quests.tracked ?? '').filter((g) => g.target);
    const lead = guides.find((g) => g.lead);
    let t: QuestTarget;
    if (lead) t = lead.target!;
    else if (this.questWait(tg.id)) {
      if (!guides.length) return null;
      t = guides[0].target!;
    } else t = this.withItem(this.director.ch2.targetOverride(tg.id) ?? tg.t, tg.def.objectives[tg.idx]);
    return this.targetPx(t);
  }

  /** Haritalar (geçiş grafiği için). */
  navMaps(): Record<string, MapData> {
    getMap(this, 'world');
    return { world: WORLD_CACHE!, ...INTERIORS! };
  }

  /** Bir görev hedefinin bu haritadaki karşılığı (piksel): kendisi, en yakın kaynağı ya da oraya giden geçiş. */
  targetPx(t: QuestTarget): { x: number; y: number; r: number } | null {
    const m = this.mapData;
    const r = (t.radius ?? 1.5) * TILE;
    if (t.npc) {
      const n = this.npc(t.npc);
      if (n) return { x: n.x, y: n.y - 10, r: 1.6 * TILE };
    }
    const doorOf = (map: string) => {
      const b = m.buildings.find((b) => b.enter?.map === map) ?? m.buildings.find((b) => map === 'mill_cellar' && b.id === 'mill');
      const d = b && m.points['door_' + b.id];
      return d ? { x: d.x * TILE + 16, y: d.y * TILE + 16, r: 1.2 * TILE } : null;
    };
    let map = t.map;
    // NPC hedefinde sabit nokta kullanılmaz: kişi gün içinde yer değiştirir (programdan bulunur)
    let pt: { x: number; y: number } | null = t.map !== m.id || t.npc ? null : t.point ? m.points[t.point] ?? null : t.x !== undefined && t.y !== undefined ? { x: t.x, y: t.y } : null;
    // NPC haritada değilse: programındaki (ulaşılabilir) yer
    if (t.npc && !pt) {
      const def = this.npcDef(t.npc);
      const rr = def ? nextReach(def, G.state.time.day, G.state.time.minute, this.reachCtx()) : null;
      if (rr?.now) {
        map = rr.entry.map;
        if (map === m.id) pt = Array.isArray(rr.entry.at) ? { x: rr.entry.at[0], y: rr.entry.at[1] } : m.points[rr.entry.at] ?? null;
      }
    }
    // yaratık / eşya: oyuncuya en yakın kaynak (bölge noktası yedek)
    if ((t.monster || t.item) && !t.npc) {
      const src = this.sourcesOf(t);
      if (src.length) {
        map = 'world';
        if (m.id === 'world') {
          const a = this.player.actor;
          let bd = Infinity, best: { x: number; y: number } | null = null;
          for (const s of src) {
            const d = Math.hypot(s.x * TILE - a.x, s.y * TILE - a.y);
            if (d < bd) { bd = d; best = s; }
          }
          return { x: best!.x * TILE + 16, y: best!.y * TILE + 16, r: (t.item ? 1.2 : 4) * TILE };
        }
      }
    }
    if (map === m.id && pt) return { x: pt.x * TILE + 16, y: pt.y * TILE + 16, r };
    if (map === m.id) return null;
    // başka harita: oraya giden ilk geçiş (kapı ya da merdiven; dışarıda binanın kapısı)
    const hop = firstHop(this.navMaps(), m.id, map);
    if (!m.indoor) {
      const d = doorOf(hop?.to ?? map);
      if (d) return d;
    }
    if (hop) {
      const c = warpCenterPx(hop, TILE);
      return { x: c.x, y: c.y, r: 1.2 * TILE };
    }
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
    let bx = W < vw ? (W - vw) / 2 : 0;
    const by = H < vh ? (H - vh) / 2 : 0;
    let bw = Math.max(W, vw);
    // A7.7: iç mekânda sol üstteki görev paneli haritanın köşesini (ör. handa Bertram'ın tezgâhı) örtmesin —
    // kamera sola panel genişliği kadar fazla kayabilir; harita ekrandan küçükse panelin sağında ortalanır
    if (m.indoor) {
      const padL = (HUD_PANEL_W * Display.uiZoom) / cam.zoom;
      if (W + padL <= vw) {
        bx = -(padL + (vw - padL - W) / 2);
        bw = vw;
      } else {
        bx = -padL;
        bw = W + padL;
      }
    }
    cam.setBounds(bx, by, bw, Math.max(H, vh));
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
      if (this.seatBook) t = this.seatBook.claim(def.id, t);
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
    if (this.paused || this.frozen) {
      // menü, dükkân, Appraisal, mini oyun: kimse yürür pozda donmasın
      this.player?.holdStill();
      for (const c of this.companions) c.holdStill();
      return;
    }
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
    this.sinceKill += dt;
    if (G.state.divine.streak > 0 && streakExpired(this.sinceKill)) R.resetStreak();
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
    this.updateNpcs(dt, hour);
    this.updateCaste(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateCombatState(dt);
    this.updateAmbient(dt);
    this.updateGatherGlow();
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
      // ara sahnede sessiz biten görevlerin bitiş animasyonları: sahne ve diyalog kapandıktan sonra sırayla
      if (!this.ui.dialogueOpen() && !this.director.isBusy) Q.flushDeferred();
      this.updateMarkers();
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
    } else {
      // joystick basılı kaldıysa (etkileşim boyunca da) yürüme kaldığı yerden sürer
      Input.moveX = Input.touchX;
      Input.moveY = Input.touchY;
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

  /**
   * Saat değişince program gereği bu haritaya gelecek NPC'leri sıraya koy. Hepsi aynı karede
   * eklenmez: updateNpcs() kare başına en fazla birini, aralarında 0,3–1 sn ile kapıdan sokar.
   */
  refreshNpcPresence() {
    for (const def of NPCS) {
      if (this.npcs.some((n) => n.def.id === def.id)) continue;
      if (this.npcArrivals.some((d) => d.id === def.id)) continue;
      if (this.arrivalTarget(def)) this.npcArrivals.push(def);
    }
  }

  /** Bu NPC şu an program gereği bu haritada olmalı mı? Öyleyse giriş noktası ve hedef karo. */
  arrivalTarget(def: NpcDef): { start: { x: number; y: number }; at: [number, number] } | null {
    const hour = hourOf(G.state.time);
    if (this.director.npcOverride(def.id) === false) return null;
    const forced = this.director.npcPlacement(def.id, this.mapData.id);
    if (forced === null || forced) return null;
    const e = scheduleAt(def, hour, G.state.time.day);
    if (e.map !== this.mapData.id) return null;
    // Kapıdan / girişten gelir
    let start: { x: number; y: number } | null = null;
    if (this.mapData.indoor) start = this.mapData.points.exit ?? null;
    else start = this.mapData.points['door_' + this.homeBuildingOf(def)] ?? null;
    const t = Array.isArray(e.at) ? e.at : this.mapData.points[e.at] ? [this.mapData.points[e.at].x, this.mapData.points[e.at].y] as [number, number] : null;
    if (!t) return null;
    return { start: start ?? { x: t[0], y: t[1] }, at: t as [number, number] };
  }

  /**
   * NPC güncellemesi. Diziyi her kare kopyalamaz: removeNpc() yeni bir dizi atar, yinelenen
   * eski dizi bozulmaz; kaldırılanlar `gone` ile atlanır. Görüş alanının dışındakiler (kenardan
   * 6 karo pay ile) hafif güncellenir (5b). Yol kuyruğu ve kapı girişleri de burada ilerler.
   */
  updateNpcs(dt: number, hour: number) {
    const day = G.state.time.day;
    const v = this.viewRect;
    const pad = NPC_FAR_PAD * TILE;
    const haveView = v.width > 0 && !this.cutscene;
    const list = this.npcs;
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (n.gone) continue;
      n.far = haveView && (n.x < v.x - pad || n.x > v.right + pad || n.y < v.y - pad || n.y > v.bottom + pad);
      if (n.far) n.updateFar(dt, hour, day);
      else n.update(dt, hour, day);
    }
    // kapıdan giriş: kare başına en fazla bir NPC
    const def = this.cutscene ? null : this.npcArrivals.tick(dt);
    if (def && !this.npcs.some((n) => n.def.id === def.id)) {
      const a = this.arrivalTarget(def);
      if (a) {
        const n = this.addNpc(def, a.start.x, a.start.y);
        // oturma yeri o anda ayrılır: dolu ise başka bir boş yer ya da ayakta bekleme yeri
        const at = this.seatBook ? this.seatBook.claim(def.id, a.at) : a.at;
        n.homeTile = at;
        n.walkTo(at[0], at[1]);
      }
    }
    // karede en fazla bir yol araması
    this.pathQueue.tick(1);
  }

  /** Oturma noktası olan iç mekân (han) için rezervasyon defteri; yoksa null. */
  makeSeatBook(m: MapData): SeatBook | null {
    if (!m.indoor) return null;
    const seats = Object.entries(m.points).filter(([k]) => SEAT_RE.test(k)).map(([name, p]) => ({ name, x: p.x, y: p.y }));
    if (seats.length < 3) return null;
    const skip = new Set(['exit', 'entrance', 'bar_front', 'bertram', 'stage', 'counter_front'].map((k) => m.points[k]).filter(Boolean).map((p) => `${p.x},${p.y}`));
    const kitchenX = m.points.kitchen ? 14 : m.w; // handa mutfak bölmesinin (x=14) sağı müşteriye kapalı
    const floor: [number, number][] = [];
    for (let y = 3; y < m.h - 2; y++)
      for (let x = 1; x < Math.min(m.w - 1, kitchenX); x++) if (!m.solid[y * m.w + x] && !skip.has(`${x},${y}`)) floor.push([x, y]);
    return new SeatBook(seats, floor, 1.5);
  }

  homeBuildingOf(def: NpcDef) {
    const map: Record<string, string> = {
      bertram: 'inn', smith: 'smithy', shopkeeper: 'shop', healer: 'healer', celeste: 'guild', innmaid: 'inn', vagrant: 'inn',
      baker: 'bakery', tailor: 'tailor', tanner: 'tannery', hunter: 'lodge', haldor: 'farmhouse', apprentice: 'smithy',
      merchant: 'manor', merc_guard: 'manor', headman: 'house_f', headwife: 'house_f', farmer_m3: 'farmhouse2', farmer_f3: 'farmhouse2',
      gerda: 'farmhouse2', shepherd: 'stable', milkmaid: 'barn', woodcutter: 'house_g', washer: 'house_c', child_girl: 'house_h', child_boy: 'house_e',
      carpenter: 'house_a', bard: 'inn', guard_pell: 'guardhouse', guard_hob: 'guardhouse', guard_wil: 'guardhouse', adv_thorne: 'inn', adv_kael: 'house_c',
      steward: 'checkpoint', knight: 'checkpoint', gate_knight_1: 'checkpoint', gate_knight_2: 'checkpoint', gate_knight_3: 'checkpoint', gate_knight_4: 'checkpoint',
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
      if (!this.warpOpen(w, h)) {
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
    // A2: geçişten hemen önce görev amaçları (yarım saniyelik denetimi beklemeden); kapı hedefliler girişte biter
    this.questTick();
    this.completeDoorGoals(this.mapData.id, w.to);
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
    // A7.10: çok karelik dekor ve geçişlerde uzaklık görselin/karonun kenarına (merkeze değil) ölçülür
    const considerRect = (r: { x: number; y: number; w: number; h: number }, label: string, kind: string, ref: any, range: number) => {
      const d = Math.min(distToRect(px, py, r), distToRect(a.x, a.y - 8, r) + 6);
      if (d < range && (!best || d < best.d)) best = { label, kind, ref, d };
    };
    for (const n of this.npcs) consider(n.x, n.y - 10, 'Konuş', 'npc', n, 40);
    for (const p of this.r.propImages) {
      if (!p.p.interact || !this.director.propAvailable(p.p.interact)) continue;
      const box = interactBox(p.p);
      if (box) considerRect(box, this.interactLabel(p.p.interact), 'prop', p.p, p.p.interact.startsWith('bed') ? BED_REACH : 18);
      else consider(p.p.x, p.p.y - 8, this.interactLabel(p.p.interact), 'prop', p.p, p.p.interact === 'sit_table' ? 52 : 38);
    }
    for (const g of this.mapData.gathers) {
      const avail = !this.gatheredNow(g.id);
      // görseli olmayan toplama noktası olmaz (bire bir: worldgen prop.gather)
      if (avail && this.gatherImg(g.id)) consider(g.x * TILE + 16, g.y * TILE + 16, 'Topla', 'gather', g, 30);
    }
    for (const w of this.mapData.warps) {
      const bottomExit = this.mapData.indoor && w.y === this.mapData.h - 1;
      const label = w.to ? (bottomExit ? 'Çık' : 'Gir') : 'Kapı';
      // iç mekân merdiveni: geçiş karosu + üstündeki merdiven
      if (this.mapData.indoor && !bottomExit) considerRect({ x: w.x * TILE, y: (w.y - 1) * TILE, w: w.w * TILE, h: (w.h + 1) * TILE }, label, 'warp', w, 16);
      else consider(w.x * TILE + 16, w.y * TILE + 8, label, 'warp', w, 30);
    }
    const b = best as any;
    return b ? { label: b.label, kind: b.kind, ref: b.ref } : null;
  }

  interactLabel(id: string) {
    if (id.startsWith('train')) return 'Antrenman';
    if (id.startsWith('bed')) return 'Uyu';
    if (id === 'sit_table') return 'Otur';
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

  /**
   * Toplama noktası bugün toplandı mı? Kaynaklar ertesi gün yeniden doğar; Toplayıcılık X- (Bereket) ile yarı sürede
   * (toplandıktan 12 oyun saati sonra).
   */
  gatheredNow(id: string): boolean {
    if ((G.state.gathered[id] ?? 0) !== G.state.time.day) return false;
    const at = G.state.gatheredAt?.[id];
    return !(G.d.fx.regrowHalf && at !== undefined && this.absMinute() - at >= 12 * 60);
  }

  gather(g: MapData['gathers'][number]) {
    if (this.gatheredNow(g.id)) return;
    G.state.gathered[g.id] = G.state.time.day;
    (G.state.gatheredAt ??= {})[g.id] = this.absMinute();
    // elma ağacı bir toplamada 3 elma verir (0.8.0); Toplayıcılık: ek ürün şansı (B-'den kesin +1), A- %30 ile +2,
    // D-'den nadir malzeme (şifalı otta Gümüş Yapraklı Ot)
    const fx = G.d.fx;
    let qty = gatherQty(g.kind);
    const bonus = G.d.gatherBonus;
    qty += Math.floor(bonus) + (Math.random() < bonus - Math.floor(bonus) ? 1 : 0);
    if (Math.random() < (fx.gatherExtra2 ?? 0)) qty++;
    // B9: LUK — toplamada çift ürün
    const lucky = Math.random() < G.d.gatherDouble;
    if (lucky) {
      qty *= 2;
      this.time.delayedCall(200, () => this.fx.luck(g.x * TILE + 16, g.y * TILE - 4, 'Şans! Çift ürün'));
    }
    if (g.kind === 'herb' && Math.random() < (fx.rareGatherPct ?? 0)) {
      R.giveItems([{ id: 'silver_herb', qty: 1 }], 'Toplama');
      this.ui.toastInfo('Nadir bir ot buldun!');
    }
    // toplarken durur ve otu koparır (kısa 'cast' durumu: hareket yok, bitince idle)
    const pl = this.player;
    if (pl.state === 'free') {
      pl.setState('cast');
      pl.actor.body2.setVelocity(0, 0);
      pl.actor.face(dirFromVec(g.x * TILE + 16 - pl.actor.x, g.y * TILE + 20 - pl.actor.y, pl.actor.dir));
    }
    pl.actor.play('thrust', { loop: false, restart: true, speed: 1.2 });
    R.giveItems([{ id: g.item, qty }], 'Toplama');
    Sound.sfx('pickup');
    this.fx.pickupSparkle(g.x * TILE + 16, g.y * TILE + 20);
    if (g.kind === 'herb') {
      R.gainSkillExp('gathering', usageExp(1.5, 0, 0));
      G.count('gathered');
      R.checkDiscoveries();
    }
    this.applyGatherVisuals();
  }

  /**
   * B4 (0.8.0): yakındaki toplanabilir her şey (bugün toplanmamış ot, elması olan ağaç) hafifçe parlar —
   * herkes için, skill gerektirmez. Işıltı görselin üstünde toplanabilir kısma oturur ve nabız gibi atar.
   */
  gatherGlows = new Map<string, Phaser.GameObjects.Image>();
  updateGatherGlow() {
    if (!this.r || !this.player) return;
    const a = this.player.actor;
    const day = G.state.time.day;
    const R2 = GATHER_GLOW_R * TILE;
    const t = this.time.now / 1000;
    const seen = new Set<string>();
    if (!this.cutscene) {
      for (const g of this.mapData.gathers) {
        const gx = g.x * TILE + 16, gy = g.y * TILE + 16;
        if (Math.abs(gx - a.x) > R2 || Math.abs(gy - a.y) > R2) continue;
        const d = Math.hypot(gx - a.x, gy - a.y);
        if (d > R2 || this.gatheredNow(g.id)) continue;
        const img = this.gatherImg(g.id);
        if (!img || !img.visible) continue;
        seen.add(g.id);
        let glow = this.gatherGlows.get(g.id);
        if (!glow) {
          glow = this.add.image(0, 0, 'soft').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0a8);
          this.gatherGlows.set(g.id, glow);
        }
        // ağaçta tepeye, otta bitkinin ortasına
        const tree = img.displayHeight > 48;
        const cy = tree ? img.y - img.displayHeight * 0.62 : img.y - img.displayHeight * 0.5;
        const size = tree ? 0.9 : 0.55;
        const fade = Math.min(1, (R2 - d) / (TILE * 0.8));
        const pulse = 0.5 + 0.5 * Math.sin(t * 3.2 + g.x * 0.7 + g.y);
        glow.setPosition(img.x, cy).setScale(size + pulse * 0.08).setAlpha((0.22 + pulse * 0.2) * fade).setDepth(img.depth + 0.5);
      }
    }
    for (const [id, glow] of this.gatherGlows) {
      if (seen.has(id)) continue;
      glow.destroy();
      this.gatherGlows.delete(id);
    }
  }

  /** Toplama noktasının görseli (prop.gather). */
  gatherImg(id: string): Phaser.GameObjects.Image | null {
    return this.r?.propImages.find((p) => p.p.gather === id)?.img ?? null;
  }

  /** "Bugün toplandı" durumu görsele: toplanan ot soluk; yeni günde ve harita her yüklendiğinde yeniden uygulanır. */
  private gatherDay = -1;
  applyGatherVisuals() {
    if (!this.r) return;
    const day = G.state.time.day;
    this.gatherDay = day;
    for (const p of this.r.propImages) {
      if (!p.p.gather || p.p.key !== 'herb_plant') continue;
      p.img.setAlpha(this.gatheredNow(p.p.gather) ? 0.25 : 1);
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
    // görev için toplanan yiyecekler (ör. elma) en sona: başka yiyecek varsa o yenir; yoksa uyarı çıkar (B3)
    const need = R.questNeeded();
    const food = (id: string) => ITEMS[id]?.kind === 'food' && inv[id] > 0;
    if (q && food(q) && !need.has(q)) return q;
    return Object.keys(inv).find((id) => food(id) && !need.has(id)) ?? (q && food(q) ? q : null) ?? Object.keys(inv).find(food) ?? null;
  }

  /** Bir eşyayı tüket (yiyecekler bekleme kurallarına uyar). */
  consume(id: string): boolean {
    const r = R.consumeItem(id, { state: this.eatState, now: this.playClock }, (b) => this.player.buffs.push(b));
    if (!r.ok) {
      Sound.sfx('error', 0.5);
      this.fx.number(this.player.actor.x, this.player.actor.y - 50, r.reason?.startsWith('Henüz') ? 'Henüz değil' : r.reason === R.QUEST_ITEM_REASON ? 'Görev için lazım' : 'Yok', 'miss');
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
    const key = (npcDef?.id ?? 'm_' + (ref as Enemy).uid) as string;
    // EXP: hedef başına günde bir; ayrıca son EXP'den 10 sn geçmeden hiçbir hedef EXP vermez (panel yine açılır)
    if (claimAppraisalExp(G.state.appraised, key, G.state.time.day, this.appraisalExpClock, this.time.now)) {
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
    const highs = this.npcs.filter((n) => n.prestige >= 4 && !n.scripted && !n.far);
    if (!highs.length) return;
    for (const h of highs) {
      const moving = h.state === 'walk' || Math.hypot(h.actor.body2.velocity.x, h.actor.body2.velocity.y) > 5;
      for (const b of this.npcs) {
        if (b === h || b.prestige > 2 || b.scripted || b.far) continue;
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
    this.player.drawForCombat();
  }

  /**
   * Silahın sırtta durması gereken durum: 'scene' (hikâye sahnesi, diyalog — hemen sırta),
   * 'safe' (iç mekân, köyün güvenli bölgesi — kısa süre sonra sırta), null (açık alan: 6 sn kuralı).
   */
  weaponCalm(): 'scene' | 'safe' | null {
    if (this.cutscene || this.ui?.dialogueOpen() || this.director?.isBusy) return 'scene';
    if (this.mapData?.indoor || this.zone?.safe) return 'safe';
    return null;
  }

  updateCombatState(dt: number) {
    const anyAware = this.enemies.some((e) => e.alive && e.aware && e.behavior !== 'flee' && Math.hypot(e.x - this.player.actor.x, e.y - this.player.actor.y) < 14 * TILE);
    if (anyAware) {
      this.player.combatT = Math.min(this.player.combatT, 0.5);
      this.battleT = 0;
      if (!this.inBattle) {
        this.inBattle = true;
        this.updateMusic();
        // düşman fark etti: silah sırttaysa çekilir
        this.player.drawForCombat();
      }
    } else if (this.inBattle) {
      this.battleT += dt;
      if (this.battleT > 3) {
        this.inBattle = false;
        this.player.secondWindUsed = false;
        this.killsThisCombat = {};
        // savaş bitti: ganimet güvende
        if (!lootEmpty(this.battleLoot)) this.ui.toastInfo('Savaş bitti. Ganimet güvende.');
        this.battleLoot = emptyLoot();
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
    // Kılıç Ustalığı A- (Kılıç Ustası): ardışık üçüncü normal vuruş kombonun son vuruşu ×1,5
    pl.combo = !heavy && pl.t - pl.comboAt < 1.3 ? pl.combo + 1 : 1;
    pl.comboAt = pl.t;
    const finisher = d.weaponType === 'sword' && !heavy && pl.combo % 3 === 0 ? d.fx.comboFinisher ?? 1 : 1;
    if (finisher > 1) this.fx.number(a.x, a.y - 56, 'Kombo!', 'divine');
    // Fırtına Tanrısı (Fırtına Kılıcı X-): her kılıç vuruşu bir rüzgâr dalgası
    if (d.weaponType === 'sword' && d.fx.windOnHit) this.spawnSpellProjectile(dir.clone(), 'wind_cut', 0.6, 8, ELEMENT_COLOR.wind, false, 'wind', 4, true, { skill: 'storm_blade' });
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
      this.hitEnemy(e, { heavy, dir, physical: true, mult: finisher > 1 ? finisher : undefined });
    }
    // çalı yakma/kesme yok; boşa vuruş
    if (!hitAny) Sound.sfx('miss', 0.3);
  }

  hitEnemy(e: Enemy, o: { heavy?: boolean; dir: Phaser.Math.Vector2; physical?: boolean; spell?: { base: number; element?: string; skill?: string }; mult?: number; skill?: string; knock?: number }) {
    const pl = this.player;
    const sneak = !e.aware && e.behavior !== 'flee';
    const counter = pl.counterT > 0;
    let res;
    const att = { d: G.d, level: G.p.level };
    const def = { d: e.d, level: e.level };
    const holy = pl.holyNext && o.physical;
    // 0.9.0: donmuş düşmana ×2 (Buz X-), mükemmel kaçıştan sonraki ilk vuruş kesin kritik (Kaçınma A-)
    const frozenMult = e.frozenNow ? G.d.fx.frozenDmgMult ?? 1 : 1;
    const forceCrit = pl.critNext && !!o.physical;
    if (forceCrit) pl.critNext = false;
    if (o.spell) res = resolveSpell(att, def, o.spell.base, { element: o.spell.element, mult: (o.mult ?? 1) * frozenMult });
    else
      res = resolvePhysical(att, def, {
        mult: (o.heavy ? 1.8 : 1) * (o.mult ?? 1) * (holy ? 2.5 : 1) * frozenMult,
        weak: counter,
        sneakMult: sneak ? G.d.sneakMult : undefined,
        forceCrit,
      });
    if (holy) {
      pl.holyNext = false;
      this.fx.ring(e.x, e.y - 10, 0xffe28a, 60, 500);
      Sound.sfx('holy');
      for (const o2 of this.enemies) if (o2 !== e && o2.alive && Math.hypot(o2.x - e.x, o2.y - e.y) < 2.2 * TILE) this.hitEnemy(o2, { dir: o.dir, spell: { base: 4 }, mult: 1 });
    }
    if (counter) pl.counterT = 0;
    // Gizlilik X- (Hayalet): gizli saldırı sürüyü uyandırmaz, öldürünce gizlilik (Gölge) bozulmaz
    const ghost = !!G.d.fx.ghost && sneak;
    const wasHidden = pl.hidden || pl.hiddenBroke;
    e.aware || e.becomeAware(!ghost);
    e.barShowT = 3;
    this.enterCombat();
    if (res.miss) {
      this.fx.number(e.x, e.y - 40, 'Iska!', 'miss');
      Sound.sfx('miss');
      return;
    }
    e.c.hp = applyDamage(e.c.hp, res.damage);
    e.damageBy.joseph = (e.damageBy.joseph ?? 0) + res.damage;
    e.josephHitAt = this.time.now / 1000;
    // hissiyat (vuruş donması, flaş, kıvılcım). 0.8.0 (C5): Joseph'in vuruşları (normal, ağır, yetenek) düşmanı geri
    // savurmaz — vur-kaç için düşman yerinde kalır. Joseph'e vurulunca onun savrulması sürer.
    e.actor.flash(0xffffff, 0.08);
    const stop = res.crit ? 0.1 : o.heavy ? 0.08 : 0.05;
    e.actor.frozenT = stop;
    pl.actor.frozenT = stop * 0.8;
    if (G.settings.shake) this.cameras.main.shake(res.crit ? 140 : o.heavy ? 110 : 70, (res.crit ? 0.006 : 0.003) * (4 / Display.worldZoom));
    this.fx.sparks(e.x, e.y - 18, res.crit ? 0xffd040 : 0xfff2c0, res.crit ? 12 : 7);
    const label = fmtHp(res.damage) + (res.crit ? '!' : '');
    this.fx.number(e.x, e.y - 40, label, res.crit ? 'crit' : 'dmg');
    if (res.luck === 'crit') this.fx.luck(e.x, e.y - 64, 'Şans! Kritik');
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
    if (e.c.hp <= 0) {
      this.killEnemy(e, o.skill ?? weaponSkill);
      if (ghost && wasHidden) pl.hidden = true;
    }
    else if (canInterrupt({ state: e.state, heavy: !!o.heavy, boss: !!e.def.boss, sinceInterrupt: e.sinceInterrupt })) {
      // Vuruş hazırlıktaki saldırıyı keser (boss yalnızca ağır vuruşla); ardından 1,2 sn yeniden kesilemez.
      e.sinceInterrupt = 0;
      e.telegraph.clear();
      e.actor.tint(null);
      e.icon.setText('');
      e.setState('hurt');
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
    this.sinceKill = 0;
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
    for (const it of drops.items) this.dropPickup(e.x, e.y, it.id, it.qty, 0, i++, it.special, it.luck);
    if (drops.money) this.dropPickup(e.x, e.y, '', 0, drops.money, i++);
    // yeniden doğma zamanı
    const spawn = this.mapData.spawns.find((s) => e.spawnId.startsWith(s.id + '#'));
    if (spawn) G.state.respawns[e.spawnId] = this.absMinute() + spawn.respawn;
    G.scheduleSave();
  }

  dropPickup(x: number, y: number, id: string, qty: number, money: number, i: number, special = false, luck = false) {
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
    // B9: yalnızca LUK sayesinde düştü — eşyanın üstünde yonca parıltısı
    if (luck) {
      this.time.delayedCall(250, () => {
        this.fx.glow(tx, ty - 12, 0x7dff6a, 30, 900);
        this.fx.luck(tx, ty - 26);
      });
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
        // savaş modundayken toplanan ganimet ayrıca tutulur (ölünce kaybolur)
        if (p.money) {
          if (R.giveMoney(p.money, 'Ganimet') && this.inBattle) this.battleLoot.money += p.money;
        } else if (R.giveItems([{ id: p.id, qty: p.qty }], 'Ganimet') && this.inBattle) this.battleLoot.items[p.id] = (this.battleLoot.items[p.id] ?? 0) + p.qty;
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

  resolveIncoming(e: Enemy | null, calc: () => { damage: number; crit: boolean; miss: boolean; luck?: 'miss' | 'crit' }, dir: Phaser.Math.Vector2) {
    const pl = this.player;
    if (pl.dead || this.cutscene) return;
    // Karşı Saldırı (Kılıç Ustalığı B-): duruşta gelen darbe engellenir ve otomatik karşılık verilir
    if (pl.parryT > 0) {
      pl.parryT = 0;
      Sound.sfx('perfect');
      this.fx.number(pl.actor.x, pl.actor.y - 52, 'Savuşturdu!', 'divine');
      this.fx.glow(pl.actor.x, pl.actor.y - 20, 0xbfe4ff, 50, 300);
      pl.invulnT = Math.max(pl.invulnT, 0.25);
      if (e && e.alive && Math.hypot(e.x - pl.actor.x, e.y - pl.actor.y) < (pl.weaponReach() + 1.5) * TILE) {
        const v = new Phaser.Math.Vector2(e.x - pl.actor.x, e.y - pl.actor.y).normalize();
        pl.actor.face(dirFromVec(v.x, v.y, pl.actor.dir));
        pl.actor.play('slash', { loop: false, restart: true, speed: 2 });
        this.fx.slashArc(pl.actor.x + v.x * 16, pl.actor.y - 14 + v.y * 16, v.angle(), 0xbfe4ff, 1.2);
        this.hitEnemy(e, { dir: v, physical: true, mult: pl.parryPower, skill: 'sword_mastery' });
      }
      return;
    }
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
      // B9: Joseph'in LUK'u (şans eseri ıskalatma)
      if (res.luck === 'miss') this.fx.luck(pl.actor.x, pl.actor.y - 50, 'Şans! Iska');
      else this.fx.number(pl.actor.x, pl.actor.y - 50, 'Iska!', 'miss');
      Sound.sfx('miss');
      return;
    }
    this.hurtPlayer(res.damage, dir, res.crit, e);
  }

  perfectDodge(e: Enemy | null) {
    const pl = this.player;
    // Mükemmel kaçış bedava: bu kaçışın/atılmanın peşin bedeli iade edilir, dayanıklılık beklemesi sıfırlanır.
    const back = refundEvade(pl.evadePaid);
    if (back.stamina > 0) G.p.stamina = Math.min(G.d.maxStamina, G.p.stamina + back.stamina);
    if (back.light > 0) G.state.divine.light = Math.min(LIGHT_MAX, G.state.divine.light + back.light);
    pl.staminaDelay = 0;
    Sound.sfx('perfect');
    this.slowmoT = 0.45 * G.d.slowmoMult * (G.state.divine.skills.includes('swift_grace') ? 1.5 : 1);
    pl.counterT = 1.6;
    pl.invulnT = Math.max(pl.invulnT, 0.3);
    // Kaçınma C-: max dayanıklılığın %5'i geri; A-: sonraki ilk vuruş kesin kritik
    if (G.d.fx.perfectDodgeStamina) G.p.stamina = Math.min(G.d.maxStamina, G.p.stamina + G.d.maxStamina * G.d.fx.perfectDodgeStamina);
    if (G.d.fx.critAfterPerfect) pl.critNext = true;
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
    if (G.state.divine.skills.includes('guardian_aura')) d = roundDamage(d * 0.9);
    const ironSkin = pl.buffs.find((b) => b.id === 'iron_skin');
    if (ironSkin) d = roundDamage(d * 0.5);
    // Demir Beden S- (Çelik Ruh): alınan hasar -%20
    if (G.d.fx.dmgTakenPct) d = roundDamage(d * (1 + G.d.fx.dmgTakenPct));
    if (pl.shield > 0) {
      const ab = Math.min(pl.shield, d);
      pl.shield = applyDamage(pl.shield, ab);
      d = applyDamage(d, ab);
      this.fx.number(pl.actor.x, pl.actor.y - 50, `Kalkan -${fmtHp(ab)}`, 'divine');
      if (d <= 0) return;
    }
    this.enterCombat();
    if (applyDamage(p.hp, d) <= 0 && G.state.divine.skills.includes('second_wind') && !pl.secondWindUsed) {
      pl.secondWindUsed = true;
      p.hp = 1;
      pl.invulnT = 1.2;
      this.fx.glow(pl.actor.x, pl.actor.y - 20, 0xffe28a, 90, 900);
      Sound.sfx('holy');
      R.sysmsg('İKİNCİ NEFES', ['Öldürücü darbeyi ışık karşıladı. 1 HP ile ayaktasın.'], { sound: 'system' });
      return;
    }
    // Günde bir kez: Ölümsüz Kale (Demir Beden X-) ölümcül darbe yerine 3 sn yenilmezlik; İkinci Nefes (İlk Yardım X-) 1 HP
    if (applyDamage(p.hp, d) <= 0) {
      const day = G.state.time.day;
      const once = (G.state.onceADay ??= {});
      if (G.d.fx.deathGuard && once.deathGuard !== day) {
        once.deathGuard = day;
        pl.invulnT = 3;
        this.fx.glow(pl.actor.x, pl.actor.y - 20, 0xd0d8e8, 90, 1200);
        Sound.sfx('holy');
        R.sysmsg('ÖLÜMSÜZ KALE', ['Ölümcül darbe bedenine işlemedi. 3 sn yenilmezsin.'], { sound: 'system' });
        return;
      }
      if (G.d.fx.secondWind && once.secondWind !== day) {
        once.secondWind = day;
        p.hp = 1;
        pl.invulnT = 1.2;
        this.fx.glow(pl.actor.x, pl.actor.y - 20, 0x9fffa0, 90, 900);
        R.sysmsg('İKİNCİ NEFES', ['Ölümcül darbede 1 HP ile ayakta kaldın.'], { sound: 'system' });
        return;
      }
    }
    p.hp = applyDamage(p.hp, d);
    pl.actor.flash(0xff4030, 0.12);
    pl.actor.kb.set(dir.x, dir.y).scale(170);
    pl.invulnT = 0.45;
    this.fx.number(pl.actor.x, pl.actor.y - 50, `-${fmtHp(d)}`, 'hurt');
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
    // Okçuluk: E- oklar daha hızlı, C- menzil, S- (Keskin Göz) hareketsizken +%20
    const fx = G.d.fx;
    const sp = 11 * TILE * (1 + (fx.arrowSpeedPct ?? 0));
    const still = Math.hypot(Input.moveX, Input.moveY) < 0.08;
    const m = mult * (still ? 1 + (fx.stillBowPct ?? 0) : 1);
    this.projectiles.push({ img, vx: dir.x * sp, vy: dir.y * sp, life: (0.75 * G.d.bowRangeMult * 11 * TILE) / sp, fromPlayer: true, power: m, radius: 10, hits: new Set(), physical: true, arrow: true });
  }

  spawnSpellProjectile(dir: Phaser.Math.Vector2, techId: string, power: number, radius: number, color: number, ignite: boolean, element: string, range: number, physical = false, o: { pierce?: boolean; skill?: string } = {}) {
    const a = this.player.actor;
    const big = techId === 'glacier_spear' || techId === 'fireball';
    const img = this.add.image(a.x + dir.x * 12, a.y - 22 + dir.y * 8, physical ? 'slash' : 'bolt').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(930000).setScale(physical ? 0.5 : big ? 2 : 1.3).setRotation(dir.angle());
    if (techId === 'glacier_spear') img.setScale(2.6, 1.1);
    const sp = 8 * TILE;
    this.projectiles.push({ img, vx: dir.x * sp, vy: dir.y * sp, life: range / 8, fromPlayer: true, tech: techId, power, radius, hits: new Set(), ignite, element, physical, pierce: o.pierce, skill: o.skill });
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
            const skill = p.skill ?? (p.tech ? this.techSkill(p.tech) : undefined);
            if (p.physical) this.hitEnemy(e, { dir, physical: true, mult: p.power, skill: p.tech ? skill : undefined });
            else this.hitEnemy(e, { dir, spell: { base: p.power, element: p.element }, skill, knock: 0.5 });
            if (p.tech && !p.physical) elementStatus(this, e, p.element, p.power, p.tech);
            // Ateş Topu: çarptığı yerde 1,5 kare yarıçapta patlar (doğrudan vurulan hariç)
            if (p.tech === 'fireball') this.explode(p.img.x, p.img.y, 1.5 * TILE * G.d.areaMult, p.power, p.tech, e);
            // Statik Ok: zincirlenir (G- 1, F- 2 hedef)
            if (p.tech === 'static_bolt') this.chainLightning(e, p.power, Math.max(1, Math.round(G.d.fx.chain ?? 1)), skill, new Set([e]));
            if (!p.pierce) dead = true;
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
        if (!dead && Math.hypot(a.x - p.img.x, a.y - 18 - p.img.y) < p.radius + 8 && !p.hits.has(a as any)) {
          const e = p.enemy!;
          const dir = new Phaser.Math.Vector2(p.vx, p.vy).normalize();
          // Rüzgâr Zırhı (Fırtına Kılıcı B-): gelen mermilerin %25'i sapar
          if (Math.random() < (G.d.fx.deflect ?? 0)) {
            p.hits.add(a as any);
            const vx = p.vx;
            p.vx = -p.vy;
            p.vy = vx;
            this.fx.number(a.x, a.y - 50, 'Saptı', 'miss');
            this.fx.sparks(p.img.x, p.img.y, 0xd8fff0, 5);
          } else {
            dead = true;
            const hpBefore = G.p.hp;
            this.resolveIncoming(e, () => resolveSpell({ d: e.d, level: e.level }, { d: G.d, level: G.p.level }, e.def.natural.dmg, { element: 'fire' }), dir);
            // şaman ateşi yakar (0.9.0, S6): 2 sn, taban hasarın %20'si/sn
            if (G.p.hp < hpBefore && G.p.hp > 0) this.player.addStatus({ kind: 'burn', t: 2, power: ((e.def.natural.dmg[0] + e.def.natural.dmg[1]) / 2) * BURN_PER_SEC });
          }
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
    return ownerOf(tech)?.id;
  }

  explode(x: number, y: number, r: number, power: number, tech?: string, except?: Enemy) {
    this.fx.ring(x, y, 0xff8a30, r, 400);
    this.fx.glow(x, y, 0xff7a20, r, 500);
    Sound.sfx('fire');
    for (const e of [...this.enemies]) {
      if (!e.alive || e === except || Math.hypot(e.x - x, e.y - y) >= r) continue;
      this.hitEnemy(e, { dir: new Phaser.Math.Vector2(e.x - x, e.y - y).normalize(), spell: { base: power, element: 'fire' }, skill: tech ? this.techSkill(tech) : undefined });
      elementStatus(this, e, 'fire', power, tech);
    }
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

  // ================================================================= teknikler (0.9.0: src/world/techniques.ts)
  /** Takılı (kullanılabilir) yetenekler: yetenek slotları (S5). Divine yetenekleri bu sistemin dışında. */
  equippedTechniques(): string[] {
    return equippedTechniques(sanitizeSlots(G.state.skillSlots, ownedTechniques(G.p.skills)));
  }

  useSkillSlot(i: number) {
    const id = this.equippedTechniques()[i];
    if (id) useTechnique(this, id);
  }

  /** Alan yeteneği (Cehennem Çemberi, Donduran Halka, Gök Gürültüsü, Göğün Hükmü, Gök Yaran). */
  areaBlast(x: number, y: number, r: number, t: TechniqueDef, power: number, skill?: string) {
    const col = ELEMENT_COLOR[t.element ?? ''] ?? 0xffffff;
    this.fx.ring(x, y, col, r, 450);
    this.fx.glow(x, y, col, r, 500);
    Sound.sfx(t.element === 'fire' ? 'fire' : t.element === 'lightning' ? 'holy' : t.element === 'ice' ? 'heal' : 'heavy', 0.8);
    if (t.element === 'lightning') {
      const bolt = this.add.rectangle(x, y - 200, 6, 220, 0xe6f6ff, 0.95).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(930000);
      this.tweens.add({ targets: bolt, alpha: 0, scaleX: 3, duration: 260, onComplete: () => bolt.destroy() });
    }
    if (t.ignites) this.tryIgnite(x, y);
    const fx = G.d.fx;
    for (const e of [...this.enemies]) {
      if (!e.alive || Math.hypot(e.x - x, e.y - y) > r + e.actor.bodyR) continue;
      const dir = new Phaser.Math.Vector2(e.x - x, e.y - y).normalize();
      if (t.physical) this.hitEnemy(e, { dir, physical: true, mult: power, skill });
      else this.hitEnemy(e, { dir, spell: { base: power, element: t.element }, skill });
      if (t.id === 'frost_ring' && e.alive) e.addStatus({ kind: 'freeze', t: fx.freezeDur ?? 1.5 }, G.p.level);
      // Yıldırımın Kendisi (X-): tüm yıldırım büyüleri zincirlenir
      if (t.element === 'lightning' && fx.chainAll && e.alive) this.chainLightning(e, power * 0.5, 1, skill, new Set([e]));
    }
  }

  /** Statik Ok zinciri: vurulan düşmandan en yakın vurulmamış düşmana (3 kare) n kez sıçrar. */
  chainLightning(from: Enemy, power: number, n: number, skill: string | undefined, hit: Set<Enemy>) {
    let cur = from;
    for (let k = 0; k < n; k++) {
      let best: Enemy | null = null, bd = 3 * TILE;
      for (const e of this.enemies) {
        if (!e.alive || hit.has(e)) continue;
        const d = Math.hypot(e.x - cur.x, e.y - cur.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) return;
      hit.add(best);
      const g = this.add.graphics().setDepth(930000).setBlendMode(Phaser.BlendModes.ADD);
      g.lineStyle(2, 0xcfeaff, 1);
      g.beginPath();
      g.moveTo(cur.x, cur.y - 18);
      const mx = (cur.x + best.x) / 2 + (Math.random() - 0.5) * 16, my = (cur.y + best.y) / 2 - 18 + (Math.random() - 0.5) * 16;
      g.lineTo(mx, my);
      g.lineTo(best.x, best.y - 18);
      g.strokePath();
      this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
      this.hitEnemy(best, { dir: new Phaser.Math.Vector2(best.x - cur.x, best.y - cur.y).normalize(), spell: { base: power, element: 'lightning' }, skill });
      cur = best;
    }
  }

  /**
   * Nara (Savaş Narası): yarıçaptaki, kullanıcıdan düşük ya da eşit leveldeki düşmanlar sendeler (bosslara ve yüksek
   * leveldekilere hiçbir rütbede işlemez); Korkutan Ses: 3+ level düşükler kaçar; yoldaşlara hasar/savunma;
   * Savaş Lordu: kendine saldırı hızı.
   */
  warShout(t: TechniqueDef, own: { allyDmgBuff?: number; allyDefBuff?: number; shoutRadiusPct?: number }) {
    const pl = this.player;
    const fx = G.d.fx;
    const r = (t.radius ?? 3) * TILE * (1 + (own.shoutRadiusPct ?? fx.shoutRadiusPct ?? 0));
    pl.setState('cast');
    pl.actor.play('cast', { loop: false, restart: true, speed: 1.4 });
    this.fx.ring(pl.actor.x, pl.actor.y - 14, 0xffb070, r, 450);
    this.fx.ring(pl.actor.x, pl.actor.y - 14, 0xffe0b0, r * 0.7, 350);
    if (G.settings.shake) this.cameras.main.shake(160, 0.004 * (4 / Display.worldZoom));
    Sound.sfx('alert', 1);
    for (const e of this.enemies) {
      if (!e.alive || Math.hypot(e.x - pl.actor.x, e.y - pl.actor.y) > r + e.actor.bodyR) continue;
      if (e.def.boss || e.level > G.p.level) {
        this.fx.number(e.x, e.y - 40, 'Etkisiz', 'miss');
        continue;
      }
      if (fx.fearLow && e.level <= G.p.level - 3) e.addStatus({ kind: 'fear', t: 4 }, G.p.level);
      else e.addStatus({ kind: 'stagger', t: fx.staggerDur ?? 0.5 }, G.p.level);
      e.aware || e.becomeAware(false);
      this.fx.number(e.x, e.y - 40, fx.fearLow && e.level <= G.p.level - 3 ? 'Korku!' : 'Sendeledi', 'miss');
    }
    const ad = own.allyDmgBuff ?? 0, df = own.allyDefBuff ?? 0;
    if (ad || df) for (const c of this.companions) if (!c.down) c.rally(ad, df, 8);
    if (fx.shoutAtkSpd) {
      pl.buffs = pl.buffs.filter((b) => b.id !== 'shout_haste');
      pl.buffs.push({ id: 'shout_haste', t: 6, amount: fx.shoutAtkSpd });
    }
  }

  /** Joseph'i iyileştir (yetenek): İlk Yardım S- (Saha Hekimi) ve Şifa A- (Kutsal Işık) yoldaşlara yansır. */
  healJoseph(amt: number, party = false) {
    const pl = this.player;
    G.p.hp = Math.min(G.d.maxHp, G.p.hp + amt);
    this.fx.number(pl.actor.x, pl.actor.y - 50, `+${fmtHp(amt)}`, 'heal');
    this.fx.glow(pl.actor.x, pl.actor.y - 20, 0x9fffa0, 50);
    Sound.sfx('heal');
    this.shareHeal(amt, party ? 1 : 0);
  }

  /** Yakındaki yoldaşlara iyileşme payı (oran: Kutsal Işık 1, Saha Hekimi 0,5). */
  shareHeal(amt: number, ratio = 0) {
    const r = Math.max(ratio, G.d.fx.healShare ?? 0);
    if (r <= 0) return;
    const a = this.player.actor;
    for (const c of this.companions) {
      if (c.down || Math.hypot(c.x - a.x, c.y - a.y) > 5 * TILE) continue;
      c.hp = Math.min(c.maxHp, c.hp + amt * r);
      this.fx.number(c.x, c.y - 46, `+${fmtHp(Math.round(amt * r * 10) / 10)}`, 'heal');
    }
  }

  /** Durum etkisinin hasarı (yanma): vuruş hissiyatı yok, yalnızca sayı. */
  statusDamage(e: Enemy, dmg: number) {
    if (!e.alive || dmg <= 0) return;
    const d = roundDamage(dmg);
    e.c.hp = applyDamage(e.c.hp, d);
    e.damageBy.joseph = (e.damageBy.joseph ?? 0) + d;
    e.barShowT = 2;
    this.fx.number(e.x, e.y - 34, fmtHp(d), 'dmg');
    if (e.c.hp <= 0) this.killEnemy(e, 'fire_magic');
  }

  /** Joseph'in yanması (şaman ateşi). */
  burnPlayer(dmg: number) {
    const pl = this.player;
    if (pl.dead || this.cutscene) return;
    const d = roundDamage(dmg);
    G.p.hp = applyDamage(G.p.hp, d);
    this.fx.number(pl.actor.x, pl.actor.y - 44, `-${fmtHp(d)}`, 'hurt');
    if (G.p.hp <= 0) this.playerDeath();
    G.events.emit('stats');
  }

  /** Delici Hamle: atılma sırasında değen her düşmana bir kez. */
  lungeContact(pl: Player) {
    const L = pl.lungeHit;
    if (!L) return;
    const reach = pl.weaponReach() * TILE * 0.9;
    for (const e of this.enemies) {
      if (!e.alive || L.hits.has(e)) continue;
      if (Math.hypot(e.x - pl.actor.x, e.y - pl.actor.y) - e.actor.bodyR > reach) continue;
      L.hits.add(e);
      this.hitEnemy(e, { dir: pl.dodgeVec.clone(), physical: true, mult: L.power, skill: L.skill });
    }
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
        pl.lightDash(def.light);
        break;
      case 'holy_strike':
        pl.holyNext = true;
        this.fx.glow(pl.actor.x, pl.actor.y - 20, 0xffe28a, 40);
        Sound.sfx('holy');
        break;
      case 'purify': {
        const amt = Math.round(G.d.maxHp * 0.2);
        G.p.hp = Math.min(G.d.maxHp, G.p.hp + amt);
        this.fx.number(pl.actor.x, pl.actor.y - 50, `+${fmtHp(amt)}`, 'heal');
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
        // savaş bitmeden ölündü: o savaşta toplanan ganimet kaybolur (ceza bundan sonra kalan paraya)
        const lostLoot = forfeitLoot(G.p as any, this.battleLoot);
        this.battleLoot = emptyLoot();
        const lost = loseMoneyPercent(G.p as any, 0.1);
        const lostExp = R.loseTodayExp();
        await this.ui.deathScreen(lost, lostExp, lostLoot);
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
