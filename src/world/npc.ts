// NPC kontrolcüsü: günlük program, yürüme, balonlar.
import Phaser from 'phaser';
import { Actor, dirFromVec, type Dir } from './actor';
import { scheduleAt, prestigeOf, type NpcDef, type ScheduleEntry } from '../data/npcs';
import { TILE } from './types';
import { findPath, nearestFree, pathBudget } from './path';
import type { WorldScene } from '../scenes/WorldScene';
import { derive } from '../core/creature';
import { npcPrestige } from '../core/prestige';
import { G } from '../game/G';

export type MarkerKind = 'offer' | 'turnin' | 'suspect';
export const MARKER_STYLE: Record<MarkerKind, { ch: string; color: string; stroke: string }> = {
  offer: { ch: '!', color: '#7cc8ff', stroke: '#0a1a3a' },
  turnin: { ch: '?', color: '#7cc8ff', stroke: '#0a1a3a' },
  suspect: { ch: '?', color: '#ffd75e', stroke: '#3a2410' },
};

/** Geliştirici etiketinin gösterildiği en büyük uzaklık (karo). */
const DEV_TAG_RANGE = 12;

export class Npc {
  actor: Actor;
  entry: ScheduleEntry | null = null;
  path: [number, number][] = [];
  pathT = 0;
  state: 'idle' | 'walk' | 'leaving' | 'scripted' = 'idle';
  idleT = 0;
  bubble: Phaser.GameObjects.Container | null = null;
  bubbleT = 0;
  bubbleCd = 5 + Math.random() * 15;
  nameTag: Phaser.GameObjects.Container;
  patrolIdx = 0;
  homeTile: [number, number] = [0, 0];
  scripted = false;
  leaveCb: (() => void) | null = null;
  speed: number;
  hp: number;
  /** Kast tepkileri (eğilme, yol verme) için bekleme ve poz süresi. */
  reactCd = 0;
  poseT = 0;
  prestige: number;
  /** A8: konuşma sırasında yaptığı işi bırakır, Joseph'e döner; bitince kaldığı yerden devam eder. */
  talking = false;
  /** Bu NPC'nin Saygınlık'ı (C1): konumu + kıyafeti. */
  saygınlık: number;
  devTag: Phaser.GameObjects.Text | null = null;
  /** Geliştirici etiketinin son metni/rengi ve güncelleme sayacı (yalnızca değişince, saniyede ≤4 kez). */
  private devText = '';
  private devColor = '';
  private devT = 0;
  /** Yol isteği kuyrukta bekliyor (WorldScene.pathQueue, karede bir arama). */
  pathPending = false;
  /** Haritadan kaldırıldı (yok edildi). */
  gone = false;
  /** Görüş alanının dışında: hafif güncelleme (WorldScene her kare belirler). */
  far = false;
  /**
   * Başının üstündeki görev işareti (0.6.0): mavi "!" (yan görev verebilir), mavi "?" (teslim edilebilir), sarı "?"
   * (incelenecek şüpheli). Metin dokusu yalnızca tür değişince çizilir; konum her kare (yalnızca yakındayken).
   */
  marker: Phaser.GameObjects.Text | null = null;
  markerKind: MarkerKind | '' = '';
  private markerPhase = Math.random() * Math.PI * 2;

  constructor(public w: WorldScene, public def: NpcDef, x: number, y: number) {
    this.actor = new Actor(w, x, y, [def.sheet], 'lpc');
    this.actor.enablePhysics(9);
    this.actor.body2.setImmovable(true);
    this.speed = (def.speed ?? 2.2) * TILE;
    // A10: okunur isim etiketi — koyu plaka üstünde kalın yazı, her şeyin önünde
    const t = w.add.text(0, 0, def.name, { fontFamily: 'AlegreyaSans, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#fbefcf', stroke: '#140c06', strokeThickness: 2 }).setOrigin(0.5, 1);
    t.setResolution(w.cameras.main.zoom * 1.5);
    const plate = w.add.graphics();
    plate.fillStyle(0x0c0a12, 0.72);
    plate.fillRoundedRect(-t.width / 2 - 5, -t.height - 1, t.width + 10, t.height + 2, 4);
    plate.lineStyle(1, 0x6b5426, 0.9);
    plate.strokeRoundedRect(-t.width / 2 - 5, -t.height - 1, t.width + 10, t.height + 2, 4);
    this.nameTag = w.add.container(x, y, [plate, t]).setDepth(965000).setAlpha(0);
    this.hp = derive(def.creature).maxHp;
    this.prestige = prestigeOf(def);
    this.saygınlık = npcPrestige(this.prestige, def.creature.equipment);
  }

  /** Bir soylu geçerken eğil. */
  bow(target: Npc, line: string | null) {
    if (this.reactCd > 0 || this.scripted) return false;
    this.reactCd = 30;
    this.stopWalking();
    if (this.state === 'walk') this.state = 'idle';
    this.actor.body2.setVelocity(0, 0);
    this.actor.face(dirFromVec(target.x - this.x, target.y - this.y));
    this.actor.play('bow', { loop: false, restart: true });
    this.poseT = 1.8;
    if (line && this.w.canBubble()) this.say(line, 2.4);
    return true;
  }

  /** Üst kasttan biri yaklaşırken yolun kenarına çekil. */
  yieldTo(target: Npc, line: string | null) {
    if (this.reactCd > 0 || this.scripted || this.state === 'leaving') return false;
    this.reactCd = 14;
    const v = target.actor.body2.velocity;
    let px = -v.y, py = v.x;
    const l = Math.hypot(px, py);
    if (l < 1) { px = 1; py = 0; } else { px /= l; py /= l; }
    // hangi yana: hedefin uzağına
    const side = (this.x - target.x) * px + (this.y - target.y) * py >= 0 ? 1 : -1;
    const [tx, ty] = this.tile();
    this.walkTo(tx + Math.round(px * side * 2), ty + Math.round(py * side * 2));
    this.idleT = -4; // kenarda biraz bekle
    if (line && this.w.canBubble()) this.say(line, 2.2);
    return true;
  }

  get x() { return this.actor.x; }
  get y() { return this.actor.y; }

  tile(): [number, number] {
    return [Math.floor(this.x / TILE), Math.floor(this.y / TILE)];
  }

  setMarker(kind: MarkerKind | '') {
    if (kind === this.markerKind) return;
    this.markerKind = kind;
    this.marker?.destroy();
    this.marker = null;
    if (!kind) return;
    const st = MARKER_STYLE[kind];
    const t = this.w.add.text(this.x, this.y - 74, st.ch, {
      fontFamily: 'Cinzel, serif', fontSize: '22px', fontStyle: 'bold', color: st.color, stroke: st.stroke, strokeThickness: 4,
    }).setOrigin(0.5, 1).setDepth(968000);
    t.setResolution(this.w.cameras.main.zoom * 1.5);
    this.marker = t;
  }

  /** İşaretin konumu: yukarı aşağı hafif salınım. */
  private placeMarker() {
    const m = this.marker;
    if (!m) return;
    const k = Math.sin(this.w.time.now / 260 + this.markerPhase);
    m.setPosition(this.actor.x, this.actor.y - 70 - (this.bubble ? 26 : 0) + k * 3);
  }

  destroy() {
    this.gone = true;
    this.w.seatBook?.release(this.def.id);
    this.marker?.destroy();
    this.w.pathQueue?.cancel(this);
    this.actor.destroy();
    this.nameTag.destroy();
    this.devTag?.destroy();
    this.bubble?.destroy();
  }

  /** Programdaki hedefin bu haritadaki karosu. */
  resolveAt(at: ScheduleEntry['at']): [number, number] | null {
    if (Array.isArray(at)) return at;
    const p = this.w.mapData.points[at];
    return p ? [p.x, p.y] : null;
  }

  /**
   * Bir karoya yürü. Yol hemen aranmaz: istek WorldScene.pathQueue'ya girer ve karede en fazla
   * bir A* araması yapılır (akşam hana 20+ NPC aynı anda girince oyun donuyordu). Yol gelene
   * kadar NPC yerinde bekler.
   */
  walkTo(tx: number, ty: number) {
    this.path = [];
    this.state = 'walk';
    const q = this.w.pathQueue;
    if (!q) {
      this.computePath(tx, ty);
      return;
    }
    this.pathPending = true;
    q.request(this, () => this.computePath(tx, ty));
  }

  /** Yürümeyi bırak (bekleyen yol isteği de iptal). */
  stopWalking() {
    this.path = [];
    this.pathPending = false;
    this.w.pathQueue?.cancel(this);
  }

  private computePath(tx: number, ty: number) {
    this.pathPending = false;
    if (this.gone) return;
    const m = this.w.mapData;
    const [sx, sy] = nearestFree(m.solid, m.w, m.h, ...this.tile());
    const [gx, gy] = nearestFree(m.solid, m.w, m.h, tx, ty);
    const p = findPath(m.solid, m.w, m.h, sx, sy, gx, gy, pathBudget(m.w, m.h, !!m.indoor));
    this.path = p ?? [];
    if (!this.path.length && this.state === 'walk') this.state = 'idle';
  }

  /**
   * Görüş alanının dışındaki NPC (5b): program ve yol takibi sürer, ama animasyon, isim etiketi,
   * balon, kast tepkisi ve geliştirici etiketi atlanır.
   */
  updateFar(dt: number, hour: number, day?: number) {
    const a = this.actor;
    const body = a.body2;
    this.reactCd -= dt;
    this.bubbleCd -= dt;
    if (this.devTag) {
      this.devTag.destroy();
      this.devTag = null;
      this.devText = this.devColor = '';
    }
    if (this.bubble) {
      this.bubbleT -= dt;
      if (this.bubbleT <= 0) {
        this.bubble.destroy();
        this.bubble = null;
      }
    }
    if (this.talking) {
      body.setVelocity(0, 0);
      return;
    }
    if (this.poseT > 0) {
      this.poseT -= dt;
      body.setVelocity(0, 0);
      return;
    }
    if (this.scripted) {
      if (this.state === 'walk') this.followPath(dt, body, true);
      else body.setVelocity(0, 0);
      return;
    }
    const e = scheduleAt(this.def, hour, day);
    if (e !== this.entry) {
      this.entry = e;
      this.onEntry(e);
    }
    if (this.state === 'walk' || this.state === 'leaving') this.followPath(dt, body, true);
    else {
      body.setVelocity(0, 0);
      this.idleT += dt;
      // devriye konumu önemli (muhafızlar); rastgele dolaşma görünmediği için atlanır
      if (e.act === 'patrol' && e.patrol && this.idleT > 2) {
        this.patrolIdx = (this.patrolIdx + 1) % e.patrol.length;
        const [px, py] = e.patrol[this.patrolIdx];
        this.walkTo(px, py);
        this.idleT = 0;
      }
    }
  }

  update(dt: number, hour: number, day?: number) {
    const a = this.actor;
    this.reactCd -= dt;
    a.tickAnim(dt);
    a.tickFlash(dt);
    const body = a.body2;
    // isim etiketi: oyuncu yakınsa
    const pd = this.w.player.actor;
    const dist = Math.hypot(pd.x - this.x, pd.y - this.y) / TILE;
    this.nameTag.setPosition(a.x, a.y - 58);
    // C6: geliştirici modunda NPC'lerin Saygınlık değeri başlarının üstünde.
    // setText/setColor metni ölçüp dokuyu yeniden çizer ve GPU'ya yükler: yalnızca yakındaki
    // (12 karo) NPC'lerde, saniyede en fazla 4 kez ve yalnızca değer değişince.
    if (G.settings.devMode && dist < DEV_TAG_RANGE) {
      if (!this.devTag) {
        this.devTag = this.w.add.text(a.x, a.y, '', { fontFamily: 'AlegreyaSans, sans-serif', fontSize: '9px', fontStyle: 'bold', color: '#9fe08a', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5, 1).setDepth(965500);
        this.devTag.setResolution(this.w.cameras.main.zoom * 1.5);
        this.devText = this.devColor = '';
        this.devT = 0;
      }
      this.devT -= dt;
      if (this.devT <= 0) {
        this.devT = 0.25;
        const tone = this.w.toneFor(this);
        const text = `S ${this.saygınlık} · ${tone === 'scorn' ? 'küçümser' : tone === 'respect' ? 'saygılı' : 'nötr'}`;
        const color = tone === 'scorn' ? '#ff8a7a' : tone === 'respect' ? '#9fe08a' : '#e8dcc0';
        if (text !== this.devText) this.devTag.setText((this.devText = text));
        if (color !== this.devColor) this.devTag.setColor((this.devColor = color));
      }
      this.devTag.setPosition(a.x, a.y - 72);
    } else if (this.devTag) {
      this.devTag.destroy();
      this.devTag = null;
      this.devText = this.devColor = '';
    }
    this.nameTag.setAlpha(Phaser.Math.Clamp((4 - dist) / 2, 0, 1) * (this.bubble ? 0 : 1));
    this.placeMarker();
    // balon
    if (this.bubble) {
      this.bubbleT -= dt;
      this.bubble.setPosition(a.x, a.y - 62);
      if (this.bubbleT <= 0) {
        const b = this.bubble;
        this.bubble = null;
        this.w.tweens.add({ targets: b, alpha: 0, y: b.y - 6, duration: 250, onComplete: () => b.destroy() });
      }
    }
    if (this.talking) {
      body.setVelocity(0, 0);
      if (a.anim !== 'idle') a.play('idle');
      a.face(dirFromVec(pd.x - this.x, pd.y - this.y));
      a.setDepth(a.y);
      return;
    }
    if (this.scripted) {
      a.setDepth(a.y);
      if (this.state === 'walk') this.followPath(dt, body);
      else body.setVelocity(0, 0);
      return;
    }
    // eğilme pozu
    if (this.poseT > 0) {
      this.poseT -= dt;
      body.setVelocity(0, 0);
      if (this.poseT <= 0) a.play('idle');
      a.setDepth(a.y);
      return;
    }
    // program
    const e = scheduleAt(this.def, hour, day);
    if (e !== this.entry) {
      this.entry = e;
      this.onEntry(e);
    }
    if (this.state === 'walk' || this.state === 'leaving') this.followPath(dt, body);
    else {
      body.setVelocity(0, 0);
      a.play('idle');
      this.idleT += dt;
      if (e.act === 'patrol' && e.patrol && this.idleT > 2) {
        this.patrolIdx = (this.patrolIdx + 1) % e.patrol.length;
        const [px, py] = e.patrol[this.patrolIdx];
        this.walkTo(px, py);
        this.idleT = 0;
      } else if ((e.wander ?? 0) > 0 && this.idleT > 4 + Math.random() * 6) {
        const [hx, hy] = this.homeTile;
        const r = e.wander!;
        this.walkTo(hx + Math.round((Math.random() * 2 - 1) * r), hy + Math.round((Math.random() * 2 - 1) * r));
        this.idleT = 0;
      } else if (this.idleT > 3 && Math.random() < dt * 0.3) {
        a.face((['down', 'left', 'right', 'down'] as Dir[])[Math.floor(Math.random() * 4)]);
      }
      // oyuncuya dön (yakınsa)
      if (dist < 2.2) a.face(dirFromVec(pd.x - this.x, pd.y - this.y));
    }
    // dünya balonu
    this.bubbleCd -= dt;
    if (this.bubbleCd <= 0 && dist < 5.5 && !this.bubble && this.w.canBubble()) {
      const line = this.w.pickBubble(this.def);
      if (line) this.say(line, 3.4);
      this.bubbleCd = 18 + Math.random() * 25;
    }
    a.setDepth(a.y);
  }

  onEntry(e: ScheduleEntry) {
    const mapId = this.w.mapData.id;
    if (e.map === mapId) {
      let t = this.resolveAt(e.at);
      // handa oturma yeri rezervasyonlu (0.6.0): dolu ise başka boş yer ya da ayakta bekleme yeri
      if (t && this.w.seatBook) t = this.w.seatBook.claim(this.def.id, t);
      if (t) {
        this.homeTile = t;
        this.walkTo(t[0], t[1]);
      }
    } else {
      this.w.seatBook?.release(this.def.id);
      // Başka bir yere gidiyor: bu haritadan ayrıl (kapıya/çıkışa yürü, sonra kaybol)
      let door: { x: number; y: number } | null = null;
      if (mapId === 'world') {
        const target = e.map === 'hidden' ? this.w.homeBuildingOf(this.def) : e.map === 'inn_attic' ? 'inn' : e.map;
        const b = this.w.mapData.points['door_' + target];
        if (b) door = b;
      } else door = this.w.mapData.points.exit ?? null;
      if (door && e.map !== 'hidden') {
        this.walkTo(door.x, door.y);
        this.state = 'leaving';
      } else if (door && e.map === 'hidden') {
        this.walkTo(door.x, door.y);
        this.state = 'leaving';
      } else {
        this.state = 'leaving';
        this.path = [];
      }
    }
  }

  followPath(dt: number, body: Phaser.Physics.Arcade.Body, far = false) {
    const a = this.actor;
    if (this.pathPending) {
      // yol kuyrukta: sırası gelene kadar yerinde bekle
      body.setVelocity(0, 0);
      if (!far) a.play('idle');
      return;
    }
    if (!this.path.length) {
      body.setVelocity(0, 0);
      if (!far) a.play('idle');
      if (this.state === 'leaving') {
        this.w.removeNpc(this);
        return;
      }
      this.state = 'idle';
      if (this.leaveCb) {
        const cb = this.leaveCb;
        this.leaveCb = null;
        cb();
      }
      return;
    }
    const [tx, ty] = this.path[0];
    const gx = tx * TILE + TILE / 2, gy = ty * TILE + TILE / 2 + 6;
    const dx = gx - a.x, dy = gy - a.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) {
      this.path.shift();
      return;
    }
    body.setVelocity((dx / d) * this.speed, (dy / d) * this.speed);
    if (!far) {
      a.face(dirFromVec(dx, dy));
      a.play('walk');
      a.animSpeed = this.speed / (2.2 * TILE);
    }
    this.pathT += dt;
    if (this.pathT > 0.6) {
      this.pathT = 0;
      // takıldıysa ışınla
      if (Math.abs(body.velocity.x) + Math.abs(body.velocity.y) < 5) a.setPosition(gx, gy);
    }
  }

  say(text: string, dur = 3.2) {
    this.bubble?.destroy();
    const c = this.w.add.container(this.actor.x, this.actor.y - 62).setDepth(970000);
    const t = this.w.add.text(0, 0, text, {
      fontFamily: 'AlegreyaSans, sans-serif', fontSize: '11px', color: '#2a1d10',
      wordWrap: { width: 140, useAdvancedWrap: true }, align: 'center',
    }).setOrigin(0.5, 1);
    t.setResolution(this.w.cameras.main.zoom * 1.5);
    const bw = t.width + 10, bh = t.height + 6;
    const g = this.w.add.graphics();
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(-bw / 2 + 1, -bh - 4 + 2, bw, bh, 4);
    g.fillStyle(0xfff6e0, 0.97);
    g.fillRoundedRect(-bw / 2, -bh - 4, bw, bh, 4);
    g.fillTriangle(-4, -5, 4, -5, 0, 1);
    g.lineStyle(1, 0x6b5426, 1);
    g.strokeRoundedRect(-bw / 2, -bh - 4, bw, bh, 4);
    t.setPosition(0, -6);
    c.add([g, t]);
    c.setScale(0.6);
    this.w.tweens.add({ targets: c, scale: 1, duration: 160, ease: 'Back.Out' });
    this.bubble = c;
    this.bubbleT = dur;
    this.w.noteBubble();
  }
}
