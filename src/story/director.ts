// Hikâye yönetmeni: tetikleyiciler, sahneler ve NPC konuşmaları.
import { Q } from '../game/questrt';
import { fullScreenRect, uiIcon, txt, FONT } from '../ui/kit';
import Phaser from 'phaser';
import { G } from '../game/G';
import { Input } from '../game/input';
import { Sound } from '../audio/audio';
import type { WorldScene } from '../scenes/WorldScene';
import type { Npc } from '../world/npc';
import type { PropPlacement, Warp } from '../world/types';
import { TILE } from '../world/types';
import { NPC_BY_ID, TONE_LINES } from '../data/npcs';
import { SHOPS, shopOpen, GUILD_HOURS } from '../data/shops';
import { FEES, JOBS } from '../data/economy';
import { TRAINING_SPOTS, type TrainingSpot } from '../data/props';
import * as R from '../game/rules';
import { transact, equip } from '../core/transactions';
import { walletTotal, emptyWallet, formatPrice } from '../core/money';
import { nextMorning, hourOf, clockLabel, fromAbsMinute, advanceWithDays } from '../core/time';
import { canSleep, absMinute } from '../core/sleep';
import { SHIFT_MEAL } from '../core/hunger';
import { codexMeet } from '../core/codex';
import { awakenDue } from '../core/traitWheel';
import { activeQuests, type QuestGuide, type QuestTarget } from '../core/quests';
import { boardRewardRanges, MAX_BOARD_QUESTS } from '../data/sidequests';
import { dirFromVec } from '../world/actor';
import { nearestFree, findPath, pathBudget } from '../world/path';
import { openShop } from '../ui/shop';
import { DIVINE_BY_ID, divineOffer } from '../data/divine';
import { panelChoice } from '../ui/panels';
import { fmtHp } from '../ui/format';
import { STAT_KEYS } from '../core/formulas';
import { divineStat, DIVINE_STATS, DIVINE_STAT_NAMES } from '../core/divine';
import { ensureCG } from '../ui/portraits';
import { Display } from '../game/display';
import { Chapter2 } from './chapter2';

const wait = (scene: Phaser.Scene, ms: number) => new Promise<void>((r) => scene.time.delayedCall(ms, r));

// A3.4 (0.10.0): eski "pano yarın açılıyor" bahaneleri kalktı (0.6.0'dan beri pano kayıt + silahla aynı gün açılır).
// Kaydı olmayana Celeste'nin söyledikleri:
const BOARD_EXCUSES = [
  'Pano kayıtlı maceracılar için. Kayıt bir gümüş.',
  'İlanları lonca kartı olanlara veririm. Kartın yok.',
  'Önce kaydol, sonra panoya bakarsın. Bir gümüş, pazarlık yok.',
]

/** ensureActors sonucu: karakterler (yoldaşsa null) ve sahneye sonradan getirilenler. */
export interface Cast {
  npcs: Record<string, Npc | null>;
  added: Npc[];
}

/** Aktörü senaryoya bağla (Actor.driven); dönen fonksiyon bırakır. */
function drive(actor: any): () => void {
  actor.driven = (actor.driven ?? 0) + 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    actor.driven = Math.max(0, (actor.driven ?? 1) - 1);
  };
}

/**
 * Ara noktaya varış yarıçapı (px): bir karede alınan yoldan büyük olmalı. Yavaş karelerde (düşük FPS) aktör ara
 * noktanın üstünden atlayıp çevresinde gidip geliyordu; sahne süresi dolunca da hedefe ışınlanıyordu (0.8.0).
 */
function arriveR(scene: Phaser.Scene, pxPerSec: number, min: number): number {
  return Math.min(TILE, Math.max(min, pxPerSec * (scene.game.loop.delta / 1000) * 1.2));
}

export class Director {
  musicOverride = false;
  /** Bölüm II akışı. */
  ch2 = new Chapter2(this);
  private busy = false;
  /** Bir hikâye sahnesi sürüyor mu? (kayıt için güvenli an değil) */
  get isBusy() {
    return this.busy;
  }
  private appraiseWaiter: ((id: string) => void) | null = null;
  private pendingCheck = 0;

  constructor(public w: WorldScene) {
    G.events.on('awakening', () => this.tryPending());
    // Terfinin Level şartı sonradan sağlanabilir: level atlayınca Terfi görevi açılır mı bak
    const onLevel = () => {
      Q.checkPromotion();
      // B21: ilk level atlamada iç ses
      if (!G.flag('thought_level')) {
        G.setFlag('thought_level');
        this.w.time.delayedCall(2500, () => this.w.bubbleAt(this.w.player.actor, 'Daha güçlü hissediyorum. Ama bu... sadece bedenim. Trait\'im ayrı büyüyor.', 4, true));
      }
    };
    const onDivine = () => {
      if (!G.flag('thought_divine')) {
        G.setFlag('thought_divine');
        this.w.time.delayedCall(2500, () => this.w.bubbleAt(this.w.player.actor, 'İçimdeki ışık büyüdü. Divine Paladin... beni değiştiriyor.', 4, true));
      }
    };
    G.events.on('levelup', onLevel);
    G.events.on('divineLevel', onDivine);
    w.events.once('shutdown', () => {
      G.events.off('awakening');
      G.events.off('levelup', onLevel);
      G.events.off('divineLevel', onDivine);
    });
    w.time.addEvent({ delay: 1500, loop: true, callback: () => this.tryPending() });
  }

  get ui() {
    return this.w.ui;
  }

  // ============================================================ yardımcılar
  lock() {
    this.w.cutscene = true;
    this.w.player.setState('locked');
    this.w.player.actor.body2.setVelocity(0, 0);
    this.w.player.actor.play('idle');
    Input.clear();
  }

  unlock() {
    this.ui.closeDialogue();
    this.w.cutscene = false;
    if (this.w.player.state === 'locked') this.w.player.setState('free');
    Input.clear();
  }

  async scene(fn: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    this.lock();
    try {
      await fn();
    } catch (e) {
      console.error(e);
    }
    this.releaseAutoCast();
    this.unlock();
    this.busy = false;
  }

  /** Bir aktörü karoya yürüt. */
  walk(actor: any, tx: number, ty: number, speed = 2.4): Promise<void> {
    const release = drive(actor);
    return new Promise<void>((resolve) => {
      const gx = tx * TILE + 16, gy = ty * TILE + 22;
      const step = () => {
        const dx = gx - actor.x, dy = gy - actor.y;
        const d = Math.hypot(dx, dy);
        if (d < arriveR(this.w, speed * TILE, 3)) {
          actor.setPosition(gx, gy);
          actor.body2?.reset(gx, gy);
          actor.body2?.setVelocity(0, 0);
          actor.play('idle');
          ev.remove();
          resolve();
          return;
        }
        const v = speed * TILE;
        actor.body2?.setVelocity((dx / d) * v, (dy / d) * v);
        actor.face(dirFromVec(dx, dy));
        actor.play('walk');
      };
      const ev = this.w.time.addEvent({ delay: 16, loop: true, callback: step });
      this.w.time.delayedCall(6000, () => {
        if (ev.getProgress() < 1 && !ev.hasDispatched) {
          ev.remove();
          actor.setPosition(gx, gy);
          actor.body2?.setVelocity(0, 0);
          resolve();
        }
      });
    }).finally(release);
  }

  /**
   * Bir aktörü yol bularak (A*, dekor ve binaların etrafından) bir karoya yürüt. Süre uzaklığa göre; takılırsa
   * süre sonunda hedefe yerleştirilir.
   */
  walkPath(actor: any, tx: number, ty: number, speed = 3): Promise<void> {
    const release = drive(actor);
    const m = this.w.mapData;
    const [sx, sy] = nearestFree(m.solid, m.w, m.h, Math.floor(actor.x / TILE), Math.floor((actor.y - 6) / TILE));
    const [gx, gy] = nearestFree(m.solid, m.w, m.h, tx, ty);
    const path = findPath(m.solid, m.w, m.h, sx, sy, gx, gy, pathBudget(m.w, m.h, !!m.indoor)) ?? [[gx, gy]];
    const limit = 2500 + (path.length / speed) * 1600;
    return new Promise<void>((resolve) => {
      const t0 = this.w.time.now;
      // takılma denetimi (0.8.0): 0,7 sn boyunca ilerleyemezse sıradaki ara noktaya geçer (sahne kilitlenmez)
      let lastX = actor.x, lastY = actor.y, stuckT = 0, lastT = t0;
      const ev = this.w.time.addEvent({
        delay: 16, loop: true, callback: () => {
          if (!actor.active || !path.length || this.w.time.now - t0 > limit) {
            ev.remove();
            if (path.length && actor.active) actor.setPosition(gx * TILE + 16, gy * TILE + 22);
            actor.body2?.setVelocity(0, 0);
            if (actor.active) actor.play('idle');
            resolve();
            return;
          }
          const now = this.w.time.now;
          const dt = (now - lastT) / 1000;
          lastT = now;
          if (Math.hypot(actor.x - lastX, actor.y - lastY) < 0.4 * speed * TILE * dt) stuckT += dt;
          else stuckT = 0;
          lastX = actor.x;
          lastY = actor.y;
          const [px, py] = path[0];
          const wx = px * TILE + 16, wy = py * TILE + 22;
          if (stuckT > 0.7) {
            // köşeye takıldı: ara noktaya geç (bir karo; göze batmaz)
            actor.setPosition(wx, wy);
            actor.body2?.reset(wx, wy);
            stuckT = 0;
            path.shift();
            return;
          }
          const dx = wx - actor.x, dy = wy - actor.y;
          const d = Math.hypot(dx, dy);
          if (d < arriveR(this.w, speed * TILE, 5)) {
            path.shift();
            return;
          }
          actor.body2?.setVelocity((dx / d) * speed * TILE, (dy / d) * speed * TILE);
          actor.face(dirFromVec(dx, dy));
          if (actor.anim !== 'walk') actor.play('walk');
        },
      });
    }).finally(release);
  }

  /**
   * Bir aktörü (ör. Joseph) yürüyen bir hedefin peşinden götür (yol bularak). `until` bitince ve aktör hedefin
   * `near` karo yakınına varınca biter. Hız mesafeyle artar (geride kalmaz, üstüne binmez); takılırsa süre sonunda
   * hedefin yanına geçer.
   */
  followUntilNear(actor: any, target: any, near = 1.5, until: Promise<unknown> = Promise.resolve(), timeoutMs = 30000): Promise<void> {
    return new Promise((resolve) => {
      const t0 = this.w.time.now;
      let arrived = false;
      until.then(() => (arrived = true));
      let path: [number, number][] = [];
      let repathT = 0;
      const m = this.w.mapData;
      const done = () => {
        ev.remove();
        actor.body2?.setVelocity(0, 0);
        actor.play('idle');
        resolve();
      };
      const ev = this.w.time.addEvent({
        delay: 16, loop: true, callback: () => {
          const d = Math.hypot(target.x - actor.x, target.y - actor.y);
          if (d <= near * TILE) {
            actor.body2?.setVelocity(0, 0);
            if (actor.anim !== 'idle') actor.play('idle');
            path = [];
            if (arrived) done();
            return;
          }
          if (this.w.time.now - t0 > timeoutMs) {
            const [fx, fy] = nearestFree(m.solid, m.w, m.h, Math.floor(target.x / TILE) + 1, Math.floor(target.y / TILE));
            actor.setPosition(fx * TILE + 16, fy * TILE + 22);
            actor.body2?.reset(actor.x, actor.y);
            done();
            return;
          }
          repathT -= 16;
          if (repathT <= 0 || !path.length) {
            repathT = 500;
            const [sx, sy] = nearestFree(m.solid, m.w, m.h, Math.floor(actor.x / TILE), Math.floor((actor.y - 6) / TILE));
            const [gx, gy] = nearestFree(m.solid, m.w, m.h, Math.floor(target.x / TILE), Math.floor((target.y - 6) / TILE));
            path = findPath(m.solid, m.w, m.h, sx, sy, gx, gy, 6000) ?? [[gx, gy]];
            if (path.length > 1) path.shift();
          }
          const [px, py] = path[0];
          const wx = px * TILE + 16, wy = py * TILE + 22;
          const dx = wx - actor.x, dy = wy - actor.y;
          const dd = Math.hypot(dx, dy);
          if (dd < arriveR(this.w, 3.6 * TILE, 5)) {
            path.shift();
            return;
          }
          const sp = Math.min(3.6, 1.6 + (d / TILE - near) * 0.6) * TILE;
          actor.body2?.setVelocity((dx / dd) * sp, (dy / dd) * sp);
          actor.face(dirFromVec(dx, dy));
          if (actor.anim !== 'walk') actor.play('walk');
          actor.animSpeed = sp / (2.4 * TILE);
        },
      });
    });
  }

  face(actor: any, target: any) {
    actor.face(dirFromVec(target.x - actor.x, target.y - actor.y));
  }

  pan(x: number, y: number, ms: number): Promise<void> {
    return new Promise((resolve) => {
      const cam = this.w.cameras.main;
      this.w.camFollow = false;
      cam.pan(x, y, ms, 'Sine.easeInOut', false, (_c: any, p: number) => {
        if (p >= 1) resolve();
      });
    });
  }

  follow() {
    this.w.followPlayer();
  }

  say(id: string, text: string, expr?: any) {
    this.ensureSpeaker(id);
    return this.ui.say(id, text, { expr });
  }

  // ============================================================ sahnedeki karakterler (0.6.0)
  /** Bu sahne için sonradan sahneye getirilen NPC'ler: sahne bitince programlarına dönerler. */
  private autoCast: Npc[] = [];

  /** Bu karakter şu an haritada mı (NPC ya da yoldaş)? */
  present(id: string): { actor: any } | null {
    return this.w.npc(id) ?? this.w.companion(id) ?? null;
  }

  /** Oyuncunun yanındaki boş bir karo (sahneye getirilen karakterler için). */
  private spotNearPlayer(i = 0): [number, number] {
    const a = this.w.player.actor;
    const ax = Math.floor(a.x / TILE), ay = Math.floor((a.y - 6) / TILE);
    const offs: [number, number][] = [[2, 0], [-2, 0], [1, 2], [-1, 2], [2, 1], [-2, 1], [0, -2]];
    const [ox, oy] = offs[i % offs.length];
    const m = this.w.mapData;
    return nearestFree(m.solid, m.w, m.h, Math.max(1, Math.min(m.w - 2, ax + ox)), Math.max(1, Math.min(m.h - 2, ay + oy)));
  }

  /**
   * Konuşan karakter sahnede değilse diyalog havaya oynamasın: ara sahne sürerken konuşmacı haritada yoksa
   * yanına getirilir (sahne bitince programına döner). Joseph ve anlatıcı hariç.
   */
  ensureSpeaker(id: string) {
    if (id === 'joseph' || !this.busy || !NPC_BY_ID[id] || this.present(id)) return;
    const [x, y] = this.spotNearPlayer(this.autoCast.length);
    const n = this.w.addNpc(NPC_BY_ID[id], x, y, true);
    this.face(n.actor, this.w.player.actor);
    this.w.fx.dust(n.x, n.y, 3);
    this.autoCast.push(n);
  }

  /**
   * Sahne başında gerekli karakterleri garanti et: haritada değillerse kapıdan girip yerlerine yürürler (iç mekân)
   * ya da Joseph'in yanına gelirler. Hepsi sahne boyunca senaryoya bağlı (scripted). releaseActors ile bırakılır.
   */
  async ensureActors(ids: string[], o: { from?: 'door' | 'near'; at?: Record<string, [number, number]> } = {}): Promise<Cast> {
    const out: Record<string, Npc | null> = {};
    const added: Npc[] = [];
    const walks: Promise<void>[] = [];
    const m = this.w.mapData;
    ids.forEach((id, i) => {
      if (this.w.companion(id)) {
        out[id] = null;
        return;
      }
      let n = this.w.npc(id);
      if (n) {
        n.scripted = true;
        n.stopWalking();
        out[id] = n;
        return;
      }
      const pt = o.at?.[id] ?? (m.points[id] ? [m.points[id].x, m.points[id].y] as [number, number] : this.spotNearPlayer(i));
      const door = m.indoor ? m.points.exit ?? m.points.entrance : null;
      if (o.from === 'door' && door) {
        n = this.w.addNpc(NPC_BY_ID[id], door.x, Math.max(1, door.y - 1), true);
        walks.push(this.walk(n.actor, pt[0], pt[1], 3.2));
      } else n = this.w.addNpc(NPC_BY_ID[id], pt[0], pt[1], true);
      added.push(n);
      out[id] = n;
    });
    if (walks.length) await Promise.all(walks);
    return { npcs: out, added };
  }

  /** ensureActors ile alınan karakterleri bırak: sonradan gelenler programlarına (gerekirse kapıdan çıkarak) döner. */
  releaseActors(cast: Cast) {
    for (const n of Object.values(cast.npcs)) {
      if (!n || n.gone) continue;
      n.scripted = false;
      if (cast.added.includes(n)) n.entry = null;
    }
  }

  private releaseAutoCast() {
    for (const n of this.autoCast) {
      if (n.gone) continue;
      n.scripted = false;
      n.entry = null;
    }
    this.autoCast = [];
  }

  think(text: string) {
    return this.ui.think(text);
  }

  // ============================================================ yerleşim kontrolü
  /** false: bu NPC hiç doğmasın. */
  npcOverride(_id: string): boolean | undefined {
    return undefined;
  }

  /** Yan görev işaretleri (iş yerindeki verenler). */
  sideMarks() {
    return this.ch2.sideMarks();
  }

  /** Kapı saat istisnası (hikâye): true/false zorla, undefined normal saatler. */
  doorOverride(w: Warp): boolean | undefined {
    return this.ch2.doorOverride(w);
  }

  /** Zorunlu yerleşim: [x,y] veya null (bu haritada olmasın) veya undefined (programa göre). */
  npcPlacement(id: string, map: string): [number, number] | null | undefined {
    const c2 = this.ch2.npcPlacement(id, map);
    if (c2 !== undefined) return c2;
    if (!G.flag('inn_met') && map === 'inn' && (id === 'vera' || id === 'lina')) {
      const p = this.w.pointsOf(map)[id === 'vera' ? 'table_vera' : 'table_lina'];
      return [p.x, p.y];
    }
    if (!G.flag('inn_met') && (id === 'vera' || id === 'lina') && map !== 'inn') return null;
    if (this.registering && map === 'guild' && (id === 'vera' || id === 'lina' || id === 'dorn')) {
      const p = this.w.pointsOf(map)[id === 'dorn' ? 'adv1' : id];
      return [p.x, p.y];
    }
    if (map === 'inn' && id === 'bertram') {
      const p = this.w.pointsOf(map).bertram;
      return hourOf(G.state.time) >= 5 ? [p.x, p.y] : null;
    }
    if (map === 'guild' && id === 'celeste') {
      const h = hourOf(G.state.time);
      const p = this.w.pointsOf(map).celeste;
      return h >= GUILD_HOURS[0] && h < GUILD_HOURS[1] ? [p.x, p.y] : null;
    }
    return undefined;
  }

  private registering = false;
  private goodTableWarnAt = 0;

  // ============================================================ olaylar
  onWorldReady() {
    this.ch2.applyEscort();
    // A7.9: han sahnesinin Appraisal adımında kaydedilip yeniden yüklendiyse "Hana Git" kapanır (sahne tekrar oynamaz)
    if (G.flag('inn_met') && Q.active('m_inn')) Q.complete('m_inn', { quiet: true });
    // B17: skill kitapları kalktı — iade (bir kez)
    if (G.flag('books_refund')) {
      const n = Number(G.flag('books_refund'));
      delete G.state.flags.books_refund;
      this.w.time.delayedCall(2500, () => R.sysmsg('KİTAPLAR', [`Skill kitapları artık öğretmiyor (yeni skill yalnızca Sistem Teklifi ile). Envanterindekiler için {m:${n}} iade edildi.`], { sound: 'coin' }));
    }
    // B9: 0.9.0 kaydından gelindi — statlar sıfırlandı (bir kez)
    if (G.flag('stat_reset_notice')) {
      delete G.state.flags.stat_reset_notice;
      this.w.time.delayedCall(1500, () => R.sysmsg('STAT SİSTEMİ DEĞİŞTİ', [`Stat sistemi değişti, puanlarını yeniden dağıt (${G.p.unspent} puan · Menü → Status).`], { sound: 'system' }));
    }
    if (G.flag('woke')) this.w.time.delayedCall(3000, () => this.ch2.checkDeadlines());
    if (!G.flag('woke')) this.wakeScene();
    else this.ui.showZone(this.w.zone?.name ?? this.w.mapData.name);
    this.w.updateMusic();
  }

  onEnterMap(id: string) {
    this.ch2.onEnterMap(id);
    if (id === 'inn' && !G.flag('inn_met')) this.innScene();
    if (id === 'guild' && !G.flag('guild_seen')) {
      G.setFlag('guild_seen');
      this.scene(async () => {
        await this.think('Maceracılar Loncası. Tahtalarda ilanlar, köşede bir taş... İçerisi ter ve demir kokuyor.');
        if (!G.flag('bertram_deal')) await this.think('Burada iş yok gibi. En azından benim gibi biri için.');
      });
    }
  }

  /** Joseph'in uyuyabileceği bir yatağı var mı? (Bertram'la anlaşma ya da bugün kiralanan yatak.) */
  hasBed(): boolean {
    return !!G.flag('bertram_deal') || G.flag('room_day') === G.state.time.day;
  }

  /**
   * Görevin altındaki dinamik alt amaçlar (0.10.0). Yalnızca ilk aktif ana görevin altında (HUD sırası):
   * - B3 pano öğreticisi: yan görevler açıldıktan sonra pano bir kez açılana kadar;
   * - B1/B3 uyku: görev bir saati bekliyor (uyunabilir) ve yatak varsa yatağa yönlendirme — m_bertram'da
   *   "Yukarı çık ve uyu", ilk kez başka bir beklemede uyku öğreticisi, sonra kısa "uyuyarak bekle".
   */
  questGuides(id: string): QuestGuide[] {
    const def = Q.def(id);
    if (!def || def.kind !== 'main') return [];
    const host = activeQuests(G.state.quests).find((q) => Q.def(q)?.kind === 'main');
    if (host !== id) return [];
    const out: QuestGuide[] = [];
    if (G.flag('side_unlocked') && !G.flag('tut_board')) {
      const rr = boardRewardRanges();
      const ranges = Object.entries(rr).map(([k, [a, b]]) => `${k} ${a}–${b}`).join(' / ');
      out.push({ key: 'tut_board', label: `Lonca panosundan ilan al — her sabah yeni ilanlar, ${ranges} bronz, aynı anda en fazla ${MAX_BOARD_QUESTS}`, optional: true, target: { map: 'guild', point: 'board', radius: 1.5 } });
    }
    const w = this.w.questWait(id);
    const now = absMinute(G.state.time.day, G.state.time.minute);
    if (w && w.until !== null && w.until > now && w.until - now <= 36 * 60 && this.hasBed()) {
      const bed: QuestTarget = { map: 'inn_attic', point: 'bed', radius: 1.2 };
      const here = this.w.mapData.id;
      const step = here === 'inn_attic' ? 'yatağa yat' : here === 'inn' ? 'merdivenden tavan arasına çık' : 'hana dön, merdivenden tavan arasına çık';
      if (id === 'm_bertram') out.push({ key: 'sleep', label: `Yukarı çık ve uyu: ${step}`, target: bed });
      else if (!G.flag('tut_sleep')) out.push({ key: 'tut_sleep', label: `Beklemeyi uyuyarak atla: yatakta "Görev saatine kadar uyu" (${step})`, optional: true, target: bed });
      else out.push({ key: 'sleep', label: `Uyuyarak bekle: ${step}`, optional: true, target: bed });
    }
    return out;
  }

  /**
   * Elle zaman atlaması (hasat, antrenman, ders…): gece yarısı aşılırsa normal saatteki gibi her gün için
   * R.onNewDay() + director.onNewDay() (terfi, pano süreleri, worked_today…).
   */
  advanceClock(minutes: number) {
    const { time, days } = advanceWithDays(G.state.time, minutes);
    G.state.time = time;
    R.passHunger(minutes);
    for (let i = 0; i < days; i++) {
      R.onNewDay();
      this.onNewDay();
    }
    G.events.emit('time');
  }

  onNewDay() {
    G.setFlag('worked_today', 0);
    // C3: terfi hakkı varsa Terfi görevi açılır (terfiyi Celeste o anda işler)
    Q.checkPromotion();
    this.ch2.onNewDay();
  }

  onHour(_h: number) {
    this.w.updateMusic();
    this.ch2.checkDeadlines();
  }

  onRespawn() {
    this.scene(async () => {
      await wait(this.w, 400);
      if (G.state.spawn.x) await this.think('...Başım. Yine yatağımdayım. Ne oldu?');
      else await this.think('...Yine bu ağaçlar. Yine bu toprak. Ölmek bu kadar kolay mı?');
    });
  }

  onSleep() {}

  /** Bir "git" amacına varıldı. false: amacı şimdilik ilerletme (sahne kendisi yönetir). */
  onQuestGo(id: string, idx: number): boolean | void {
    return this.ch2.onQuestGo(id, idx);
  }

  onKill(e: any) {
    this.ch2.onKill(e);
  }

  onBossKilled() {
    this.scene(async () => {
      await wait(this.w, 800);
      await this.think('Şefi devirdim... Ellerim titriyor. Ama ayaktayım.');
      if (G.p.inventory.map_forest_deep) await this.think('Üstünden kaba bir harita çıktı. Ormanın derinliklerini gösteriyor.');
    });
  }

  onAppraise(id: string) {
    if (this.appraiseWaiter) this.appraiseWaiter(id);
    this.ch2.onAppraise(id);
  }

  beforeWarp(w: Warp): boolean {
    if (!this.ch2.beforeWarp(w)) return false;
    if (w.to === 'inn_attic' && !G.flag('bertram_deal') && G.flag('room_day') !== G.state.time.day) {
      this.scene(async () => {
        await this.say('bertram', 'Hey! Yukarısı boş gezenlere değil. Yatak istiyorsan kırk bronz.', 'kizgin');
      });
      return false;
    }
    return true;
  }

  // ============================================================ tetikleyiciler
  onTrigger(id: string) {
    if (this.busy) return;
    if (this.ch2.onTrigger(id)) return;
    if (id === 'village_enter' && !G.flag('village_entered')) {
      G.setFlag('village_entered');
      if (this.w.josephStatus() === 'naked') this.villageReaction();
    }
    if (id === 'checkpoint_near' && !G.flag('checkpoint_seen')) {
      G.setFlag('checkpoint_seen');
      this.scene(async () => {
        await this.pan(this.w.mapData.points.city.x * TILE, this.w.mapData.points.city.y * TILE, 1600);
        await this.think('Yol bir kontrol noktasında, taş bir surun kapısında bitiyor. Ötesi... Eros. Elonth\'un şehirlerinden biri, ama buradan bakınca dünyanın kendisi gibi.');
        await this.think('Muhafızlar yolu tutmuş. Öyle elini kolunu sallayarak geçilecek gibi değil.');
        await this.pan(this.w.player.actor.x, this.w.player.actor.y, 900);
        this.follow();
      });
    }
    if (id === 'inn_good_tables' && this.w.time.now > this.goodTableWarnAt) {
      this.goodTableWarnAt = this.w.time.now + 45000;
      const warner = this.w.npc('innmaid') ?? this.w.npc('bertram');
      const elite = this.w.npcs.find((n) => n.prestige >= 4);
      if (warner) warner.say(elite ? `Oralar ${elite.def.name.split(' ').pop()} Efendi gibilere ayrılır! Sen arkaya, mutfak kapısının yanına.` : 'O masalar efendilerin. Boş olsa bile. Sen arkaya otur, köksüz.', 3.6);
    }
    if (id === 'camp_near' && !G.flag('camp_seen')) {
      G.setFlag('camp_seen');
      this.scene(async () => {
        await this.think('Duman... çadırlar... ve gırtlaktan gelen gülüşmeler. Bir kamp. Goblinler.');
        await this.think('Bu hâlimle buraya girmek intihar olur. Ya da... çok dikkatli olmalıyım.');
      });
    }
  }

  // ============================================================ sahne: uyanış
  wakeScene() {
    this.scene(async () => {
      G.setFlag('woke');
      const a = this.w.player.actor;
      a.play('die', { loop: false, hold: true });
      a.animT = 10;
      a.applyFrame();
      this.w.cameras.main.fadeIn(2500, 0, 0, 0);
      Sound.play('forest');
      const cg = await ensureCG(this.ui, 'forest_wake');
      let cgImg: Phaser.GameObjects.Image | null = null;
      if (cg) {
        cgImg = this.ui.add.image(Display.uiW / 2, Display.uiH / 2, cg).setDepth(80).setAlpha(0);
        cgImg.setScale(Math.max(Display.uiW / cgImg.width, Display.uiH / cgImg.height));
        this.ui.tweens.add({ targets: cgImg, alpha: 1, duration: 1200 });
      }
      await wait(this.w, 1800);
      await this.think('...');
      await this.think('Kuş sesleri. Toprak kokusu. Rüzgâr...');
      if (cgImg) this.ui.tweens.add({ targets: cgImg, alpha: 0, duration: 1000, onComplete: () => cgImg!.destroy() });
      a.play('idle');
      this.w.tweens.add({ targets: a, y: a.y - 2, yoyo: true, duration: 200 });
      Sound.sfx('step');
      await this.think('Kalkabiliyorum. Ama bu beden... benim değil gibi. Çok hafif. Ve çok... zayıf.');
      await this.think('Üstümde yırtık bir şorttan başka hiçbir şey yok.');
      // Status penceresi kısa süre
      R.sysmsg('STATUS', ['Joseph · İnsan · Level 0', `HP ${fmtHp(G.d.maxHp)}/${fmtHp(G.d.maxHp)} · MP 0/0`, STAT_KEYS.map((k) => `${k} ${G.d.stats[k]}`).join(' · '), 'Skill: Appraisal (G-)'], { sound: 'system' });
      await wait(this.w, 2600);
      await this.think('Gerçekten oradaymış. O mavi pencere... Rüya değil.');
      // Manzara
      const village = this.w.mapData.points.plaza;
      const vv = await ensureCG(this.ui, 'village_view');
      await this.pan(village.x * TILE, village.y * TILE - 60, 2600);
      let vImg: Phaser.GameObjects.Image | null = null;
      if (vv) {
        vImg = this.ui.add.image(Display.uiW / 2, Display.uiH / 2, vv).setDepth(80).setAlpha(0);
        vImg.setScale(Math.max(Display.uiW / vImg.width, Display.uiH / vImg.height));
        this.ui.tweens.add({ targets: vImg, alpha: 1, duration: 900 });
      }
      await this.think('Ağaçların arasından... bir köy görünüyor. Çatılardan duman yükseliyor.');
      await this.pan(this.w.mapData.points.city.x * TILE, this.w.mapData.points.city.y * TILE, 2200);
      await this.think('Ve çok uzakta, doğuda, köyü boydan boya kesen taş bir sur. Ardında koca bir şehir olmalı.');
      if (vImg) this.ui.tweens.add({ targets: vImg, alpha: 0, duration: 800, onComplete: () => vImg!.destroy() });
      await this.pan(a.x, a.y, 1800);
      this.follow();
      await this.think('Önce bir şeyler giymem lazım. Sonra... yemek. Bir de bu dünyanın ne olduğunu anlamam.');
      const touch = navigator.maxTouchPoints > 0;
      this.ui.hintBottom(touch ? 'Sol tarafı sürükle: yürü · kenara it: koş' : 'WASD: yürü · Shift: koş · Esc: menü');
      this.w.time.delayedCall(3000, () => this.ui.toastInfo(touch ? 'Sağdaki butonlar: saldırı, kaçış, etkileşim' : 'J: saldırı · Boşluk: kaçış · E: etkileşim · Q: Appraisal'));
      Q.start('m_inn');
      G.save('auto');
    });
  }

  /**
   * B20 (0.10.0): ilk adımda tökezleme — Joseph bir adım atar, tek dizinin üstüne çöker (eğilme + aşağı kayma + hafif
   * dönme), acı sesi, sarsıntı, kırmızımsı kenar; ardından altın ışık: yükselen parçacıklar, ışık sütunu, altın
   * vinyet, küçük trait kartı (2–3 sn) ve 2 sn titreşen altın aura. Sonra doğrulur, oyun "Hana Git" ile sürer.
   */
  async divineAwaken() {
    const w = this.w, ui = this.ui;
    const a = w.player.actor;
    const [fx, fy] = (() => { const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as Record<string, number[]>; return v[a.dir] ?? [0, 1]; })();
    // bir adım
    a.play('walk');
    await new Promise<void>((r) => w.tweens.add({ targets: a, x: a.x + fx * 10, y: a.y + fy * 10, duration: 260, onComplete: () => r() }));
    a.body2?.reset(a.x, a.y);
    // tökezleme: diz çökme pozu
    a.play('idle');
    Sound.sfx('hurt', 0.8);
    Sound.sfx('thud', 0.7);
    if (G.settings.shake) w.cameras.main.shake(220, 0.006 * (4 / Display.worldZoom));
    ui.flashDamage(0.35);
    const lean = fx >= 0 ? 9 : -9;
    await new Promise<void>((r) => w.tweens.add({ targets: a, angle: lean, scaleY: a.scaleY * 0.86, y: a.y + 5, duration: 220, ease: 'Quad.In', onComplete: () => r() }));
    await this.think('Ah—! Bacaklarım... Bu beden kendi ağırlığını bile taşıyamıyor.');
    ui.closeDialogue();
    // altın ışık
    Sound.sfx('awaken');
    const col = w.add.image(a.x, a.y - 60, 'soft').setTint(0xffd56a).setBlendMode(Phaser.BlendModes.ADD).setDepth(a.y + 2).setScale(0.6, 0.1).setAlpha(0);
    w.tweens.add({ targets: col, alpha: 0.85, scaleY: 3.2, duration: 500, ease: 'Cubic.Out' });
    const rise = w.time.addEvent({
      delay: 45, repeat: 60, callback: () => {
        const p = w.add.image(a.x + (Math.random() - 0.5) * 34, a.y - Math.random() * 10, 'spark').setTint(Math.random() < 0.5 ? 0xffe9a0 : 0xffc040).setBlendMode(Phaser.BlendModes.ADD).setDepth(a.y + 3).setScale(0.8 + Math.random());
        w.tweens.add({ targets: p, y: p.y - 60 - Math.random() * 50, alpha: 0, duration: 900 + Math.random() * 500, onComplete: () => p.destroy() });
      },
    });
    const gv = ui.add.rectangle(Display.uiW / 2, Display.uiH / 2, Display.uiW, Display.uiH, 0xffc040, 0).setDepth(48).setBlendMode(Phaser.BlendModes.ADD);
    ui.tweens.add({ targets: gv, fillAlpha: 0.22, duration: 400, yoyo: true, hold: 1600 });
    // küçük trait kartı (prologdaki kartın hızlı hali)
    const card = ui.add.container(Display.uiW / 2, Display.uiH * 0.36).setDepth(90).setScale(0.3).setAlpha(0);
    const cg = ui.add.graphics();
    cg.fillStyle(0x2a1a46, 0.96);
    cg.fillRoundedRect(-150, -46, 300, 92, 12);
    cg.lineStyle(3, 0xffd56a, 1);
    cg.strokeRoundedRect(-150, -46, 300, 92, 12);
    card.add(cg);
    card.add(uiIcon(ui, -112, 0, 'rank_X', 44));
    card.add(txt(ui, 18, -14, 'DIVINE PALADIN — X', { size: 21, bold: true, font: FONT.title, color: '#ffe9a0', stroke: true }).setOrigin(0.5));
    card.add(txt(ui, 18, 16, 'Trait', { size: 13, italic: true, color: '#d8c890' }).setOrigin(0.5));
    ui.tweens.add({ targets: card, alpha: 1, scale: 1, duration: 300, ease: 'Back.Out' });
    // 2 sn aura: titreşen altın dış hat ve alev gibi parçacıklar
    const auraT0 = w.time.now;
    const aura = w.time.addEvent({
      delay: 70, loop: true, callback: () => {
        const k = (w.time.now - auraT0) / 2000;
        if (k >= 1) return;
        w.fx.ghost(a as any, 0xffd56a);
        const f = w.add.image(a.x + (Math.random() - 0.5) * 26, a.y - 8 - Math.random() * 30, 'soft').setTint(0xffb030).setBlendMode(Phaser.BlendModes.ADD).setDepth(a.y + 1).setScale(0.18).setAlpha(0.8);
        w.tweens.add({ targets: f, y: f.y - 28, scaleX: 0.08, alpha: 0, duration: 420, onComplete: () => f.destroy() });
      },
    });
    await wait(w, 2000);
    aura.remove();
    rise.remove();
    ui.tweens.add({ targets: card, alpha: 0, scale: 0.8, duration: 400, onComplete: () => card.destroy() });
    w.tweens.add({ targets: col, alpha: 0, duration: 600, onComplete: () => col.destroy() });
    w.time.delayedCall(2400, () => gv.destroy());
    // doğrulur
    await new Promise<void>((r) => w.tweens.add({ targets: a, angle: 0, scaleY: a.scaleY / 0.86, y: a.y - 5, duration: 380, ease: 'Quad.Out', onComplete: () => r() }));
    a.body2?.reset(a.x, a.y);
    await this.think('Bu ışık... Status\'taki o trait. Divine Paladin.');
  }

  // ============================================================ karşılaşmalar
  private encounterT = 0;
  /** Düzenli kontrol: kâhya geçerken ilk karşılaşma sahnesi. */
  private mainT = 0;
  checkEncounters(dt: number) {
    // B20: uyandıktan sonra ilk yürüme denemesi → tökezleme ve Divine Paladin'in uyanışı (bir kez)
    if (awakenDue(G.state.flags, !!Q.status('m_inn'), !this.busy && !this.w.cutscene && !this.ui.dialogueOpen(), Math.hypot(Input.moveX, Input.moveY))) {
      G.setFlag('dp_awaken');
      void this.scene(async () => this.divineAwaken());
      return;
    }
    if (!this.busy) this.ch2.tick(dt);
    // ana görev güvencesi: sahne dışında yarım saniyede bir
    this.mainT -= dt;
    if (this.mainT <= 0 && !this.busy && !this.w.cutscene && !this.ui.dialogueOpen()) {
      this.mainT = 0.5;
      this.ch2.ensureMain();
    }
    this.encounterT -= dt;
    if (this.encounterT > 0 || this.busy || this.w.cutscene || this.w.mapData.id !== 'world') return;
    this.encounterT = 0.5;
    if (G.flag('steward_met') || !G.flag('woke')) return;
    const st = this.w.npc('steward');
    if (!st) return;
    const a = this.w.player.actor;
    if (Math.hypot(st.x - a.x, st.y - a.y) < 5 * TILE) this.stewardScene();
  }

  stewardScene() {
    this.scene(async () => {
      G.setFlag('steward_met');
      const a = this.w.player.actor;
      const st = this.w.npc('steward')!;
      const kn = this.w.npc('knight');
      st.scripted = true;
      if (kn) kn.scripted = true;
      this.face(st.actor, a);
      if (kn) this.face(kn.actor, a);
      if (kn) await this.say('knight', 'Yol açın! Baron Merrow\'un kâhyası geçiyor!', 'kizgin');
      // çevredeki köylüler eğilir
      for (const n of this.w.npcs) {
        if (n === st || n === kn || n.prestige > 2) continue;
        if (Math.hypot(n.x - st.x, n.y - st.y) < 10 * TILE) n.bow(st, Math.random() < 0.5 ? 'Efendim!' : null);
      }
      await wait(this.w, 1200);
      await this.think('Herkes eğildi. Kimse ona bakmıyor; hepsi toprağa bakıyor.');
      await this.say('steward', 'Sen. Neden ayaktasın?', 'kizgin');
      const c = await this.ui.choice(['(Başını eğ.)', '(Dimdik dur.)', '"Ben buralı değilim."']);
      if (c === 0) {
        a.play('bow', { loop: false, restart: true });
        await wait(this.w, 900);
        await this.say('steward', 'Hiç değilse eğilmeyi biliyor. Yürü, Cedric.');
        a.play('idle');
      } else if (c === 1) {
        if (kn) {
          await this.walk(kn.actor, Math.floor(a.x / TILE), Math.floor(a.y / TILE) - 1, 3);
          this.face(kn.actor, a);
          await this.say('knight', 'Kâhya Efendi sana bir soru sordu, köksüz.', 'kizgin');
          Sound.sfx('hit');
          a.kb.set(0, 1).scale(220);
          G.p.hp = Math.max(1, G.p.hp - 1);
          this.w.fx.number(a.x, a.y - 50, `-${fmtHp(1)}`, 'hurt');
          this.ui.flashDamage();
          await wait(this.w, 600);
        }
        await this.say('steward', 'Bırak, Cedric. Bir köksüzün dizini bükmek bana düşmez. Hayat büker nasılsa.');
        G.affinity('steward', -2);
      } else {
        await this.say('steward', 'Buralı olmayan köksüz, buralı köksüzden de değersizdir. Baronun toprağındasın. Eğil ya da defol.');
      }
      await this.think('Bertram haklıydı. Bu dünyada herkes sıfırdan doğuyor ama herkes aynı yerden başlamıyor.');
      st.scripted = false;
      if (kn) kn.scripted = false;
    });
  }

  // ============================================================ sahne: köye giriş
  villageReaction() {
    this.scene(async () => {
      const a = this.w.player.actor;
      const ax = Math.floor(a.x / TILE), ay = Math.floor(a.y / TILE);
      const extras: Npc[] = [];
      const add = (id: string, x: number, y: number) => {
        let n = this.w.npc(id);
        if (!n) {
          n = this.w.addNpc(NPC_BY_ID[id], x, y, true);
          extras.push(n);
        } else n.scripted = true;
        return n;
      };
      const greta = add('greta', ax + 6, ay - 2);
      const tobin = add('tobin', ax + 7, ay + 1);
      const anna = add('anna', ax + 5, ay + 3);
      const pip = add('pip', ax + 5, ay + 2);
      for (const n of [greta, tobin, anna, pip]) this.face(n.actor, a);
      await wait(this.w, 500);
      greta.say('Kim bu adam?', 2.5);
      await wait(this.w, 1100);
      tobin.say('Haydut mu soydu bunu?', 2.5);
      await wait(this.w, 1200);
      anna.say('Pip! Bakma! Kapat gözlerini!', 2.8);
      anna.actor.face('up');
      await wait(this.w, 900);
      pip.say('Anne, göremiyorum!', 2.4);
      await wait(this.w, 1400);
      greta.say('Fısır fısır...', 2);
      tobin.say('Ormandan mı gelmiş?', 2);
      await wait(this.w, 1500);
      await this.think('Herkes bakıyor. Haklılar. Yarı çıplağım.');
      await this.think('Bir han bulmalıyım. Han varsa iş de vardır.');
      for (const n of extras) {
        n.scripted = false;
        n.entry = null;
      }
      for (const n of [greta, tobin, anna, pip]) n.scripted = false;
    });
  }

  // ============================================================ sahne: han
  innScene() {
    this.scene(async () => {
      G.setFlag('inn_met');
      // A7.9: "Hana Git" görevi açık kalır, Appraisal öğreticisinde amacı "Vera'yı Appraisal ile incele"
      if (Q.active('m_inn') && !Q.objDone('m_inn', 0)) Q.advance('m_inn', 0);
      const vera = this.w.npc('vera');
      const lina = this.w.npc('lina');
      const bert = this.w.npc('bertram');
      const a = this.w.player.actor;
      await wait(this.w, 500);
      if (vera) this.face(vera.actor, a);
      if (lina) this.face(lina.actor, a);
      const naked = this.w.josephStatus() === 'naked';
      Sound.sfx('laugh', 0.6);
      if (naked) {
        await this.say('vera', 'Lina, bak! Ormandan bir haydut kurbanı gelmiş!', 'alayci');
        await this.say('lina', 'Hihi! Pantolonu bile yok! Şort mu o?', 'gulen');
      } else {
        await this.say('vera', 'Bak sen, yeni bir yüz. Kimin nesisin?', 'alayci');
      }
      await this.say('bertram', 'Kapıyı kapat, içerisi soğuyor.');
      await this.say('joseph', 'Ben... iş arıyorum. Herhangi bir iş.');
      await this.say('vera', 'İş mi? Önce bir gömlek bulsana. Lonca bile böyle adamı kapıdan çevirir. Kayıt bir gümüş, biliyor musun?', 'alayci');
      await this.say('lina', 'Hihi! Bir gümüşü olsa üstüne bir şey alırdı!', 'gulen');
      await this.think('Bu ikisi... Üzerlerinde bir şey var. Sanki bir şeyleri okuyabilirim.');
      await this.ui.system('Appraisal kullanılabilir. Vera\'ya dokun (ya da 🔍 butonuna bas / Q tuşu) ve onu incele.');
      this.ui.closeDialogue();
      // oyuncunun Appraisal kullanmasını bekle
      this.w.cutscene = false;
      if (vera) this.face(a, vera.actor);
      const got = await new Promise<string>((resolve) => {
        this.appraiseWaiter = resolve;
        this.w.time.delayedCall(25000, () => resolve('timeout'));
      });
      this.appraiseWaiter = null;
      if (got === 'timeout' && vera) this.w.appraise(vera.def.creature, vera.def, vera, true);
      Q.complete('m_inn', { silent: true });
      this.w.cutscene = true;
      await wait(this.w, 2600);
      this.ui.closeAppraisal();
      await this.think('Vera. İnsan, on dokuz yaşında. F- rütbe. Level 3.');
      await this.think('Statlarını göremiyorum. Rütbesi benimkinden bir harf yüksek. Aradaki farkı... hissediyorum.');
      if (lina) {
        this.w.appraise(lina.def.creature, lina.def, lina, true);
        await wait(this.w, 2200);
        this.ui.closeAppraisal();
        await this.think('Lina. Kedi soylu. O kulaklar gerçek. O da Level 3.');
      }
      await this.think('Ve ben Level 0\'ım.');
      await this.say('vera', 'Ne o, bize mi bakıyorsun? Appraisal\'ın G- değil mi? Hah! Hiçbir şey göremezsin!', 'alayci');
      const c = await this.ui.choice(['(Sessiz kal.)', '"Görecek pek bir şey yok zaten."', '"Dilin kadar kılıcın da keskin mi bakalım?"']);
      if (c === 0) {
        G.affinity('vera', -1);
        await this.say('vera', 'Dili de yokmuş.', 'alayci');
        await this.say('lina', 'Hihi.', 'gulen');
      } else if (c === 1) {
        G.affinity('vera', 1);
        G.affinity('lina', 2);
        await this.say('lina', 'Hihihi! Vera, bu komikti!', 'gulen');
        await this.say('vera', '...Hıh. En azından mizah anlayışı var.', 'saskin');
      } else {
        G.affinity('vera', -2);
        G.affinity('lina', -1);
        G.affinity('bertram', 1);
        await this.say('vera', 'Bana bak, çıplak! Bir kelime daha et, seni şu kapıdan fırlatırım!', 'kizgin');
        await this.say('bertram', 'Vera! Benim hanımda kavga yok. Otur yerine.', 'kizgin');
        await this.say('vera', '...Tch.', 'kizgin');
      }
      await this.say('bertram', 'Sen. Buraya gel.');
      if (bert) {
        const bf = this.w.mapData.points.bar_front;
        await this.walk(a, bf.x, bf.y);
        this.face(a, bert.actor);
        this.face(bert.actor, a);
      }
      await this.bertramDeal();
    });
  }

  async bertramDeal() {
    await this.say('bertram', 'İş istiyorsun demek. Görünüşe bakılırsa ne paran var ne de adın.');
    await this.say('joseph', 'Adım Joseph. Ama gerisi... doğru.');
    await this.say('bertram', 'Joseph. İyi. Bak, sana açık konuşacağım. Ben lafı dolandırmam.');
    await this.say('bertram', 'İki gün çalışırsın. Bulaşık, odun, akşamları da masalar. Günde bir vardiya, sabahtan geceye.');
    await this.say('bertram', 'Karşılığı ikinci günün akşamı, hepsi birden: elli bronz. Üstüne seni giydiririm. Bu hâlde ne iş görürsün ne adam yüzü.');
    await this.say('bertram', 'Çalıştığın günlerin yemeği benden, akşam güveci. Tavan arasında bir yatak var, o da senin. İş bitince yemeğini herkes gibi parayla yersin.');
    const c = await this.ui.choice(['"Kabul. Elimden geleni yaparım."', '"İki gün. Söz veriyorum."']);
    G.affinity('bertram', 1);
    if (c === 0) await this.say('bertram', 'Elinden geleni değil, işin gerektirdiğini yapacaksın. Ama niyetin iyi.');
    else await this.say('bertram', 'Söz mü? Hah. Bu dünyada söz bronzdan ucuzdur. Seninki öyle olmasın.');
    await this.say('bertram', 'Hırsızlık yok, sızlanmak yok. Gerisini konuşmaya gerek yok.');
    // Kıyafet işlemi
    const r = transact(G.p as any, { label: 'Bertram\'ın kıyafetleri', give: [{ id: 'linen_shirt', qty: 1 }, { id: 'linen_pants', qty: 1 }, { id: 'cloth_shoes', qty: 1 }] });
    if (r.ok) {
      R.toast('+1 Keten Gömlek (G)', 'item', 'shirt');
      R.toast('+1 Keten Pantolon (G)', 'item', 'pants');
      R.toast('+1 Bez Ayakkabı (G)', 'item', 'shoes');
      Sound.sfx('pickup');
      await this.ui.curtain(1, 500);
      equip(G.p as any, 'linen_shirt', 'chest');
      equip(G.p as any, 'linen_pants', 'pants');
      equip(G.p as any, 'cloth_shoes', 'boots');
      this.w.player.refreshLayers();
      G.invalidate();
      await wait(this.w, 500);
      await this.ui.curtain(0, 500);
      R.sysmsg('EKİPMAN', ['Keten Gömlek (G) [DEF: +0]', 'Keten Pantolon (G) [DEF: +1]', 'Bez Ayakkabı (G) [DEF: +0]', 'Yırtık Şort envantere kaldırıldı.']);
    }
    G.setFlag('bertram_deal');
    G.setFlag('deal_day', G.state.time.day);
    await this.say('bertram', 'Biraz büyük ama idare eder. Tavan arasındaki yatak artık senin. Merdiven arkada.');
    await this.say('bertram', 'İşe hazır olunca bana söyle. Sabah erken gelirsen tam gün çalışırsın.');
    await this.say('vera', 'Bulaşıkçı! Ne yakışmış!', 'alayci');
    await this.say('lina', 'Hihi! Bulaşık prensi!', 'gulen');
    await this.think('...Bir iş, bir yatak, bir gömlek. Bu dünyadaki ilk sahip olduklarım.');
    Q.start('m_bertram', true);
    R.sysmsg('İŞ: YORGUN YABAN DOMUZU HANI', [`${JOBS.bertramShifts} vardiya (günde en fazla 1, 06:00–15:00 arası başlar)`, `Ödeme: ${JOBS.bertramShifts}. günün sonunda {m:${JOBS.bertramPay}}`, `Vardiya günlerinin yemeği Bertram\'dan (+${SHIFT_MEAL} Tokluk).`, 'Tavan arasındaki yatak artık senin (yeniden doğma noktası).']);
    G.save('auto');
  }

  // ============================================================ NPC konuşmaları
  talk(n: Npc) {
    const id = n.def.id;
    if (this.busy) return;
    // B15: ilk konuşmada ad ve portre ansiklopediye
    if (codexMeet(G.state.codex, id, this.w.placeName(true), G.state.time.day)) this.w.codexAdded('people', id);
    n.talking = true;
    n.actor.body2?.setVelocity(0, 0);
    this.scene(async () => {
      try {
        await this.talkInner(n, id);
      } finally {
        n.talking = false;
      }
    }).finally(() => (n.talking = false));
  }

  private async talkInner(n: Npc, id: string) {
    {
      this.face(n.actor, this.w.player.actor);
      this.face(this.w.player.actor, n.actor);
      if (await this.ch2.talk(n)) return;
      switch (id) {
        case 'bertram': return this.talkBertram();
        case 'celeste': return this.talkCeleste();
        case 'captain': return this.talkCaptain();
        case 'haldor': return this.talkHaldor(n);
        case 'hunter': return this.talkHunter(n);
        default:
          if (n.def.shop) return this.talkShop(n, n.def.shop);
          return this.talkGeneric(n);
      }
    }
  }

  async talkGeneric(n: Npc) {
    const st = this.w.josephStatus();
    const pool = [...(n.def.talk[st] ?? []), ...(n.def.talk.any ?? [])];
    const line = pool.length ? pool[Math.floor(Math.random() * pool.length)] : '...';
    const expr = n.def.personality === 'rude' ? 'kizgin' : n.def.personality === 'gossip' ? 'gulen' : n.def.personality === 'drunk' ? 'gulen' : 'normal';
    // C1: Saygınlık tonu: ara sıra küçümseyen ya da saygılı bir giriş
    const tone = this.w.toneFor(n);
    if (tone !== 'neutral' && st !== 'naked' && Math.random() < 0.4) {
      const op = TONE_LINES[n.def.caste]?.[tone]?.open ?? [];
      if (op.length) await this.say(id(n), op[Math.floor(Math.random() * op.length)], tone === 'scorn' ? 'alayci' : 'normal');
    }
    await this.say(id(n), line, expr);
    if (n.def.id === 'hilda' && st === 'naked' && !G.flag('hilda_apple')) {
      G.setFlag('hilda_apple');
      R.giveItems([{ id: 'apple', qty: 1 }], 'Hilda\'nın elması');
      G.affinity('hilda', 1);
      await this.think('Bu dünyada ilk iyilik. Bir elma.');
    }
    function id(x: Npc) {
      return x.def.id;
    }
  }

  /** Bertram'ın hanında kalan vardiya sayısı. */
  shiftsDone() {
    return G.state.counters.workDays ?? 0;
  }

  /** Bugün handa yemek bedava mı? (Sadece ilk çalışma günü.) */
  static freeMealToday() {
    return G.flag('free_meal_day') === G.state.time.day && G.flag('meal_day') !== G.state.time.day;
  }

  async talkBertram() {
    const st = this.w.josephStatus();
    const deal = !!G.flag('bertram_deal');
    const done = !!G.flag('bertram_done');
    const h = G.state.time.minute / 60;
    if (!G.flag('inn_met')) {
      await this.say('bertram', 'Ne istiyorsun?');
      return;
    }
    // B12: 0.9.0 kaydından gelen, işi (2/3 → 2/2) bitmiş oyuncu: ücret sahnesi bir kez
    if (deal && !done && G.flag('bertram_pay_pending')) {
      delete G.state.flags.bertram_pay_pending;
      await this.say('bertram', 'Sen! Hesabımız kaldı, evlat. Otur.');
      await this.bertramSpeech();
      return;
    }
    const opts: string[] = [];
    const acts: (() => Promise<void>)[] = [];
    if (deal && !done) {
      const worked = G.flag('worked_today') === G.state.time.day;
      const n = this.shiftsDone();
      opts.push(worked ? 'Yarın da çalışabilir miyim?' : `Çalışmaya hazırım. (Gün ${n + 1}/${JOBS.bertramShifts})${h >= 15 ? ' — geç oldu' : h < 6 ? ' — çok erken' : ''}`);
      acts.push(async () => {
        if (worked) {
          await this.say('bertram', 'Günde bir vardiya, evlat. Yarın sabah gel. Şimdi ye ve uyu.');
          return;
        }
        if (h >= 15) {
          await this.say('bertram', 'Bu saatte mi? Gün bitti sayılır. Yarın sabah gel.');
          return;
        }
        if (h < 6) {
          await this.say('bertram', 'Gecenin bu saatinde mi? Ocak bile uyuyor. Altıda gel.');
          return;
        }
        await this.workMontage();
      });
    } else if (done) {
      opts.push('İş var mı?');
      acts.push(async () => {
        await this.say('bertram', 'Sana verecek işim kalmadı, evlat. Söz sözdür: iki gündü, iki gün oldu.');
        if (!G.flag('farm_done')) await this.say('bertram', 'Haldor\'a gittin mi? Kuzeydoğudaki buğday tarlası. Elli bronz, unutma.');
        else if (!G.flag('guild_registered')) await this.say('bertram', 'Bir gümüşün var. Daha ne bekliyorsun? Lonca seni bekliyor.');
        else await this.say('bertram', 'Artık maceracısın. Para avda, evlat. Fare kuyruğu bile para eder. Az, ama eder.');
      });
    } else {
      opts.push('İş var mı?');
      acts.push(async () => this.bertramDeal());
      opts.push(`Yatak kirala ({m:${FEES.innBed}})`);
      acts.push(async () => {
        const r = R.pay(FEES.innBed, 'Han yatağı');
        if (!r.ok) {
          await this.say('bertram', 'Paran yok. Yatak da yok.');
          return;
        }
        G.setFlag('room_day', G.state.time.day);
        Sound.sfx('coin');
        await this.say('bertram', 'Tavan arası. Merdiven arkada. Sabah çık.');
      });
    }
    opts.push('Yiyecek ve içecek');
    acts.push(async () => {
      if (deal && !done) await this.say('bertram', 'Çalıştığın akşam güvecin benden, vardiyadan sonra. Şimdi bir şey istersen parasıyla: güveç on iki, ekmek dört, elma üç.');
      else await this.say('bertram', 'Sıcak güveç on iki bronz. Ekmek dört. Elma üç. Aç kalma, evlat; aç adam iş göremez.');
      this.ui.closeDialogue();
      await openShop(this.ui, 'inn');
    });
    opts.push('Kendin hakkında anlat.');
    acts.push(async () => {
      const lines = [
        'Ben mi? Eskiden maceracıydım. E rütbe. Bir kurt sürüsü bacağımı aldı, ben de sürüyü aldım. Sonra bu hanı.',
        'Lonca kartı bir kâğıttır, evlat. Asıl rütbe bacaklarında, ellerinde ve kafandadır.',
        'Brindlewood küçük ama dürüst bir köy. Çoğu. Wilmer hariç.',
        'Kuzeydeki şehre mi? Orası soylularla dolu. Senin gibi köksüz birini kapıdan sokmazlar.',
        'Ön masalar mı? Ben koymadım o kuralı. Ama müşteri ön masaya göre bahşiş bırakır. Han da böyle döner.',
      ];
      await this.say('bertram', lines[Math.floor(Math.random() * lines.length)]);
    });
    opts.push('Hoşça kal.');
    acts.push(async () => {});
    await this.say('bertram', st === 'naked' ? 'Hâlâ o şortla mısın?' : deal ? 'Ne var, evlat?' : 'Ne istiyorsun?');
    const c = await this.ui.choice(opts);
    await acts[c]();
  }

  async workMontage() {
    const day = G.state.time.day;
    const shift = Math.min(this.shiftsDone() + 1, JOBS.bertramShifts);
    const total = JOBS.bertramShifts;
    // B12 (0.10.0): iş iki gün
    const intro = [
      'Güzel. Önce bulaşıklar, sonra odun. Akşam han dolar, o zaman masalara koşarsın. Bira, güveç, ekmek. Karıştırma.',
      'Son gün. Bu akşam değirmenciler ücret almış, Aurelio\'nun adamları da gelecek. Akşama kadar dayan, sonra konuşacağız.',
    ];
    await this.say('bertram', intro[shift - 1]);
    await this.ui.curtain(1, 700);
    Sound.play('inn');
    const SCENES: [string, string][][] = [
      [
        ['Bulaşıklar. Tabak, tabak, tabak... Suyun soğuğu parmaklarıma işliyor.', 'click'],
        ['Odun taşımak. Her kütük bir öncekinden ağır. Kollarım titriyor.', 'chop'],
        ['Akşam oluyor. Kapı açıldı, han dolmaya başladı.', 'laugh'],
      ],
      [
        ['Son gün. Sabah ekmek teknesini taşıdım. Bertram ocağı yakmayı gösterdi: "Önce kuru dal, sonra sabır."', 'chop'],
        ['Garrick\'in kurt postlarını tabakhaneye taşıdım. Gorm burnunu bile kaldırmadı.', 'click'],
        ['Değirmenciler geldi, ardından Aurelio\'nun adamları şöminenin önüne oturdu. Köylüler ayakta kaldı. Ben koştum.', 'laugh'],
      ],
    ];
    const scenes = SCENES[shift - 1];
    // İlerleme göstergesi: ekranın üstünde, konuşma kutusundan uzakta
    const prog = this.ui.add.container(Display.uiW / 2, Display.uiH * 0.16).setDepth(96);
    const pg = this.ui.add.graphics();
    const pw = 64 * total + 10 * (total - 1);
    for (let i = 0; i < total; i++) {
      const x = -pw / 2 + i * 74;
      pg.fillStyle(i < shift - 1 ? 0xd9b45a : 0x2a2235, 1);
      pg.fillRoundedRect(x, 34, 64, 10, 4);
      pg.lineStyle(1, 0x6b5426, 1);
      pg.strokeRoundedRect(x, 34, 64, 10, 4);
    }
    const label = this.ui.overlayText(`Gün ${shift}/${total}`, { size: 28, y: 0, color: '#f3dc95', font: 'Cinzel, serif' });
    label.setPosition(0, 0).setOrigin(0.5, 0);
    prog.add([pg, label]);
    const fill = this.ui.add.rectangle(-pw / 2 + (shift - 1) * 74, 34, 0, 10, 0xf3dc95).setOrigin(0, 0);
    prog.add(fill);
    for (const [text, sfx] of scenes) {
      const t = this.ui.overlayText(text, { size: 23 });
      t.setAlpha(0);
      this.ui.tweens.add({ targets: t, alpha: 1, duration: 400 });
      Sound.sfx(sfx, 0.7);
      this.ui.tweens.add({ targets: fill, width: fill.width + 64 / (scenes.length + 1), duration: 2300 });
      await wait(this.w, 2600);
      this.ui.tweens.add({ targets: t, alpha: 0, duration: 300, onComplete: () => t.destroy() });
      await wait(this.w, 350);
    }
    prog.setVisible(false);
    // A7.8b: mini oyun açılırken eski diyalog satırı kutuda kalmasın (dönüşte bir an görünüyordu)
    this.ui.closeDialogue();
    // D4: akşam servisi — Servis Koşturmacası
    const perf = await new Promise<number>((resolve) => {
      this.w.scene.launch('Minigame', { kind: 'serve', day: shift, done: resolve });
      this.w.scene.bringToTop('Minigame');
      this.w.paused = true;
    });
    this.w.paused = false;
    prog.destroy();
    const best = Math.max(G.flag('serve_best') ? Number(G.flag('serve_best')) : 0, Math.round(perf * 100));
    G.setFlag('serve_best', best);
    G.state.counters.workDays = shift;
    G.setFlag('worked_today', day);
    // vardiya akşama kadar sürer: geçen saatler (uyanık) Tokluğu düşürür, sonra Bertram'ın güveci (B13)
    const end = Math.max(G.state.time.minute, 21 * 60);
    R.passHunger(end - G.state.time.minute);
    G.state.time.minute = end;
    R.feed(SHIFT_MEAL);
    R.toast(`Bertram'ın güveci: +${SHIFT_MEAL} Tokluk`, 'info', 'inv_food');
    G.p.hp = G.d.maxHp;
    G.p.stamina = G.d.maxStamina;
    Q.notify('custom', 'shift');
    await this.ui.curtain(0, 700);
    this.w.updateMusic();
    // Bertram'ın yorumu yalnızca performansa göre değişir; ücret ve hikâye aynı
    const COMMENTS: [string, string, string][] = [
      ['Hiç fena değil. Bir tek bira döktün, onu da kendin sildin. İyi.', 'Yavaşsın ama tabak kırmadın. Yarın daha hızlı olursun.', 'İki müşteri kapıdan söylenerek çıktı. Bira bekleyen adam sabırsızdır, evlat. Yarın son gün, toparlan.'],
      ['Aurelio\'nun adamları bile şikâyet etmedi. Bu hanın tarihinde ilk.', 'İdare eder. Ben de ilk yıl böyleydim.', 'Kötü bir akşamdı. Ama sonuna kadar koştun. Bu da bir şey.'],
    ];
    const ci = perf >= 0.75 ? 0 : perf >= 0.45 ? 1 : 2;
    await this.say('bertram', COMMENTS[shift - 1][ci]);
    if (shift < total) {
      await this.say('bertram', 'Ödemen yarın akşam, sözleştiğimiz gibi. Yarın son gün, erken gel.');
      await this.say('bertram', 'Al, güvecin. Çalıştığın günlerin yemeği benden. Ye, sonra yukarı çık ve uyu. Merdiven arkada.');
      await this.think('Sıcak güveç. Midem bu dünyada ilk kez doydu.');
      G.save('auto');
      return;
    }
    await this.bertramSpeech();
  }

  /** Üçüncü günün sonunda: ödeme ve dünyanın düzeni üzerine uzun konuşma. */
  async bertramSpeech() {
    await this.say('bertram', 'İki gün. Bir kere bile sızlanmadın. Bir tabak da kırmadın... Fenn\'in kırdığını saymazsak.');
    await this.say('bertram', 'Önce güvecini al. Bugünün yemeği de benden.');
    await this.say('bertram', 'Al. Elli bronz, sözleştiğimiz gibi. Gömlek, pantolon, ayakkabı da senin.');
    R.giveMoney(JOBS.bertramPay, 'Bertram\'ın ücreti');
    Sound.sfx('coin');
    G.setFlag('bertram_done');
    Q.complete('m_bertram', { money: 0, silent: true });
    await this.say('joseph', 'Teşekkür ederim. Yarın da...');
    await this.say('bertram', 'Yarın yok, evlat. Bu han iki kişiyi doyurur, üçü fazla. Sana verecek işim kalmadı.');
    const c1 = await this.ui.choice(['"Peki ben şimdi ne yapacağım?"', '(Sessizce paraları say.)']);
    if (c1 === 1) await this.say('bertram', 'Say, say. Elli tane. Ben kimseyi kandırmam. Ama otur, sana bir şey anlatacağım. Bir kez anlatacağım.');
    else await this.say('bertram', 'İşte onu konuşacağız. Otur. Bir kez anlatacağım, iyi dinle.');
    await this.say('bertram', 'Bu dünyada herkes sıfırdan doğar. Level 0. Kral da, fare de. Ama herkes aynı yerden başlamaz.');
    await this.say('bertram', 'En tepede soylular. Toprak, vergi, yasa onların. Baron Merrow\'un kâhyası köye gelince herkes yolun kenarına çekilir, şapkasını çıkarır. Gördün mü daha?');
    await this.say('bertram', 'Sonra yüksek rütbeli maceracılar. C, B, A... Kılıçları soyluların bile işine yarar. O yüzden şöminenin önündeki masa onlarındır.');
    await this.say('bertram', 'Sonra tüccarlar ve zanaatkârlar. Gunnar, Marta, Brunhild, ben. Bir dükkânın, bir adın varsa insanlar sana selam verir.');
    await this.say('bertram', 'Sonra köylüler. Tarla, hayvan, vergi. Ve en altta...');
    await this.say('bertram', '...köksüzler. Ailesi, toprağı, adı olmayanlar. Sen, evlat.');
    await this.think('Köksüz. Wilmer de öyle demişti. Ve han ön masaları hiç bana göstermedi.');
    await this.say('bertram', 'Darılma, gerçek bu. Ama köksüzün de bir kapısı var: Maceracılar Loncası. Lonca kimin oğlu olduğuna bakmaz. Rütbene bakar.');
    await this.say('bertram', 'G\'den başlarsın. Sonra F, E, D, C, B, A, S. Bir de X var, ama X\'i sadece ozanlar söyler. Masal.');
    await this.say('bertram', 'S rütbe mi? Koca dünyada iki, belki üç tane. Ejderha avlarlar, krallarla aynı masaya otururlar. Onların adını çocuklar ezberler.');
    // B21: dünyada bilinen bir kavram olarak trait
    await this.say('bertram', 'Bir de trait var. Bazıları doğuştan bir trait taşır. Çoğununki G, F; ufak şeyler. Keskin kulak, sağlam mide.');
    await this.say('bertram', 'Bir A trait\'i olan krallara yaver olur. S\'yi masallarda duyarsın. Lonca taşı gösterir, çoğu zaman da gösterecek bir şey bulamaz.');
    await this.think('Trait... Benimki X. Ve taş onu göremeyecek mi?');
    await this.say('bertram', 'Ben E rütbeydim. Emekli E. Bu köyde bu bile bir şey. Kurtlar bacağımı almadan önce bir ayda kazandığımı bu han bir yılda kazandırmaz.');
    await this.say('bertram', 'Para orada döner, evlat. Avda, görevde, lonca panosunda. Bulaşıkta değil.');
    const c2 = await this.ui.choice(['"Ben de bir gün S rütbe olabilir miyim?"', '"Lonca kaydı ne kadar?"']);
    if (c2 === 0) {
      await this.say('bertram', 'Hah! Önce G-\'yi gör, sonra hayal kur. Ama hayal kurmak bedava. Ona bir şey demem.');
      await this.say('bertram', 'Kayıt bir gümüş, bu arada. Yüz bronz.');
    } else await this.say('bertram', 'Bir gümüş. Yüz bronz. Celeste bozuk parayı iki parmağıyla alır, gümüş verirsen yüzü biraz daha az ekşir.');
    await this.say('bertram', 'Benim verdiğim elli bronz yetmez, biliyorum. O yüzden bir çare buldum.');
    await this.say('bertram', 'Köyün kuzeydoğusunda bir buğday tarlası var. Sahibi Haldor, eski dostum. Dizleri artık tutmuyor, başaklar biçilmeyi bekliyor.');
    await this.say('bertram', 'Git, Bertram gönderdi de. Hasada yardım edersen o da elli bronz verir. İkisi bir gümüş eder. Sonra loncaya git, kaydol.');
    await this.say('bertram', 'Tavan arasındaki yatak hâlâ senin. Kira istemem. Ama yemeğini artık kendin ödersin. Para yoksa Haldor\'un yolundaki elma ağaçları bedava, unutma.');
    const c3 = await this.ui.choice(['"Bertram... neden bu kadar yardım ediyorsun?"', '"Teşekkür ederim. Unutmayacağım."']);
    if (c3 === 0) await this.say('bertram', 'Çünkü ben de bir zamanlar bir kapının önünde aç durdum. Biri bana da iş verdi. Borcumu ödüyorum, o kadar.');
    else await this.say('bertram', 'Unutma. Ama bana değil, bir gün kapının önünde aç duran birine öde.');
    G.affinity('bertram', 2);
    // A7.3: saate göre (ücret gecesi vardiya 21:00'de biter; hasat 06:00–16:00)
    const hh = G.state.time.minute / 60;
    await this.say('bertram', hh >= 16 || hh < 6 ? 'Bu gece dinlen. Yarın sabah erkenden Haldor\'a git; altıda tarlada olur.' : hh < 12 ? 'Hadi. Gün daha yeni başladı, Haldor tarlada.' : 'Hadi. Gün kısa, Haldor dörde kadar tarlada.');
    Q.start('m_harvest', true);
    R.sysmsg('YENİ İŞ: HALDOR\'UN HASADI', ['Brindlewood\'un kuzeydoğusundaki buğday tarlasında Yaşlı Haldor\'u bul.', `Ödül: {m:${JOBS.harvestPay}} (tek seferlik)`, `Hedef: {m:${FEES.guildRegistration}} → Maceracılar Loncası kaydı`], { big: true });
    G.save('auto');
  }

  // ============================================================ Haldor'un tarlası
  async talkHaldor(n: Npc) {
    if (!G.flag('bertram_done')) return this.talkGeneric(n);
    if (G.flag('farm_done')) {
      const lines = ['Hasat ambarda, evlat. Sana verecek işim kalmadı. Ama bir gün yine uğra, bir kâse çorba her zaman var.', 'Bertram\'a selam söyle. O ihtiyar kurt beni hâlâ yener.', 'Loncada nasıl gidiyor? Fareler mi? Hah. Herkes farelerle başlar.'];
      await this.say('haldor', lines[Math.floor(Math.random() * lines.length)]);
      return;
    }
    const first = !G.flag('farm_offered');
    if (Q.active('m_harvest') && Q.progress('m_harvest', 0) < 1) Q.advance('m_harvest', 0);
    if (first) {
      G.setFlag('farm_offered');
      await this.say('haldor', 'Kimsin sen? Bir dakika... O gömlek. Bertram\'ın eski gömleği bu!');
      await this.say('joseph', 'Bertram gönderdi. Hasada yardım edeceğim.');
      await this.say('haldor', 'Gönderdi demek! O inatçı ihtiyar, dizlerimi hâlâ dert ediyor demek.');
      await this.say('haldor', 'Bak evlat: buğdayı biçersin, demetleri bağlarsın, arabaya yüklersin. Birkaç saat sürer. Karşılığı elli bronz. Pazarlık yok, ben de köylüyüm, kesem bu kadar.');
    } else await this.say('haldor', 'Geldin mi? Başaklar seni bekliyor.');
    const h = G.state.time.minute / 60;
    // A7.3: kapalı saatlerde "Hasada başla" hiç sunulmaz
    if (h < 6 || h >= 16) {
      await this.say('haldor', h >= 16 ? 'Ama bu saatte olmaz. Karanlıkta orakla ancak kendi ayağını biçersin. Sabah altıda gel, orak hazır olur.' : 'Daha horozlar ötmedi, evlat. Altıda gel, orak hazır olur.');
      return;
    }
    const c = await this.ui.choice(['Hasada başla (birkaç saat sürer)', 'Sonra gelirim.']);
    if (c !== 0) {
      await this.say('haldor', 'Çok bekletme. Başak beklemez, dizlerim hiç beklemez.');
      return;
    }
    await this.harvest();
  }

  async harvest() {
    await this.say('haldor', 'Orak şurada. Yerden kes, bilekten çevir. Kendini değil, başağı kes.');
    this.ui.closeDialogue();
    const perf = await new Promise<number>((resolve) => {
      this.w.scene.launch('Minigame', { kind: 'harvest', done: resolve });
      this.w.scene.bringToTop('Minigame');
      this.w.paused = true;
    });
    this.w.paused = false;
    await this.ui.curtain(1, 600);
    const lines = [
      'Saatler geçiyor. Demet, demet, demet. Sırtım iki büklüm.',
      'Haldor her demette bir hikâye anlatıyor. Çoğu Bertram\'ın gençliği hakkında. Çoğu yalan olabilir.',
      'Öğlen Elke ekmek ve peynir getirdi. Benimle göz göze gelmedi ama payımı da ayırdı.',
      'Güneş eğilirken son demeti arabaya yükledik.',
    ];
    for (const l of lines) {
      const t = this.ui.overlayText(l, { size: 23 });
      t.setAlpha(0);
      this.ui.tweens.add({ targets: t, alpha: 1, duration: 400 });
      Sound.sfx('chop', 0.4);
      await wait(this.w, 2500);
      this.ui.tweens.add({ targets: t, alpha: 0, duration: 300, onComplete: () => t.destroy() });
      await wait(this.w, 350);
    }
    this.advanceClock(JOBS.harvestMinutes);
    G.p.stamina = Math.max(0, G.p.stamina - 30);
    await this.ui.curtain(0, 600);
    this.w.updateMusic();
    await this.say('haldor', perf > 0.6 ? 'Vay be! Bertram\'ın çırağı dediğin böyle olur. Bu kadar temiz biçeni yıllardır görmedim.' : perf > 0.3 ? 'Fena değil. Biraz eğri ama tarla senden şikâyetçi değil.' : 'Başakların yarısı yerde kaldı... Neyse. Emek emektir.');
    await this.say('haldor', 'Al bakalım. Elli bronz. Söz sözdür.');
    R.giveMoney(JOBS.harvestPay, 'Haldor\'un hasadı');
    Sound.sfx('coin');
    // B13: Haldor hasattan sonra bir ekmek verir
    await this.say('haldor', 'Bir de şunu al. Elke\'nin ekmeği. Aç maceracı tarlada bile işe yaramaz.');
    R.giveItems([{ id: 'bread', qty: 1 }], 'Haldor\'un ekmeği');
    G.setFlag('farm_done');
    G.affinity('haldor', 2);
    Q.complete('m_harvest', { money: 0, silent: true });
    Q.start('m_register', true);
    // 100 bronz → 1 gümüş
    // Cüzdan artık kendiliğinden bozduruluyor (core/money normalizeWallet); sahne yine de Haldor'un ağzından anlatılır.
    if (walletTotal(G.p.wallet) >= 100 && !G.flag('silver_exchanged')) {
      await this.say('haldor', 'Cebin bozuk parayla şıngırdıyor. Ver şunları, sana bir gümüş vereyim. Lonca bozukluk saymayı sevmez.');
      const r = transact(G.p as any, { label: 'Bozdurma', pay: 100, receive: { ...emptyWallet(), silver: 1 } });
      if (r.ok) {
        G.setFlag('silver_exchanged');
        Sound.sfx('coin');
        R.toast('{w:bronze:100} → {w:silver:1}', 'money');
        await this.think('Bir gümüş. Avucumda soğuk ve ağır. Lonca kaydı tam bu kadar tutuyor.');
      }
    } else if (walletTotal(G.p.wallet) >= FEES.guildRegistration) await this.think('Bertram\'ın ellisi, Haldor\'un ellisi. Lonca kaydı için yetiyor.');
    await this.say('haldor', 'Bundan sonrası senin işin, evlat. Kolay para yok bu köyde; ne buldunsa kılıcınla bulacaksın.');
    G.save('auto');
  }

  async talkCeleste() {
    const st = this.w.josephStatus();
    if (st === 'naked') {
      await this.say('celeste', '...Önce giyin. Sonra konuşuruz. Belki.', 'kizgin');
      return;
    }
    if (!G.flag('guild_registered')) {
      await this.say('celeste', 'Evet? Görev teslimi mi, yoksa yolunu mu kaybettin?', 'alayci');
      const c = await this.ui.choice(['"Maceracı olarak kaydolmak istiyorum."', '"Sadece bakıyordum."']);
      if (c === 1) {
        await this.say('celeste', 'Bakmak bedava. Şimdilik.', 'alayci');
        return;
      }
      await this.say('celeste', 'Kayıt.', 'saskin');
      await this.say('celeste', 'Kayıt ücreti bir gümüş. Gerçekten bir gümüşün var mı?', 'alayci');
      if (walletTotal(G.p.wallet) < FEES.guildRegistration) {
        await this.say('joseph', '...Şu an yok.');
        await this.say('celeste', 'Sanmıştım. Kapı arkanda.', 'alayci');
        return;
      }
      await this.say('joseph', 'Var.');
      await this.registerScene();
      return;
    }
    const lines = [
      BOARD_EXCUSES[(G.state.time.day - 1) % BOARD_EXCUSES.length],
      'Kaydolunca G- ilanlarını ben dağıtırım. Kartsız ilan yok.',
      'Kartını kaybetme. Yenisi beş gümüş.',
    ];
    await this.say('celeste', lines[Math.floor(Math.random() * lines.length)], 'normal');
  }

  async registerScene() {
    this.registering = true;
    // Vera, Lina ve Dorn salonda
    for (const id of ['vera', 'lina', 'dorn']) {
      if (!this.w.npc(id)) {
        const p = this.w.mapData.points[id === 'dorn' ? 'adv1' : id];
        this.w.addNpc(NPC_BY_ID[id], p.x, p.y, true);
      } else this.w.npc(id)!.scripted = true;
    }
    const r = R.pay(FEES.guildRegistration, 'Lonca kaydı');
    if (!r.ok) {
      this.registering = false;
      return;
    }
    Sound.sfx('coin');
    await this.ui.narrate('Celeste gümüşü iki parmağıyla, sanki kirliymiş gibi alıp kasaya bırakıyor.');
    const vera = this.w.npc('vera')!;
    const lina = this.w.npc('lina')!;
    const dorn = this.w.npc('dorn')!;
    const a = this.w.player.actor;
    for (const n of [vera, lina, dorn]) this.face(n.actor, a);
    await this.say('vera', 'Lina, bak! Bulaşıkçı maceracı olmaya gelmiş!', 'alayci');
    await this.say('lina', 'Hihihi! Bulaşık bezini kılıç diye mi kullanacak?', 'gulen');
    await this.say('celeste', 'Sessizlik. Elini Appraisal taşına koy. Taş, Level\'ını, skill\'lerini ve statlarını gösterir.', 'normal');
    const sp = this.w.mapData.points.stone;
    await this.walk(a, sp.x, sp.y);
    a.face('right');
    Sound.sfx('appraise');
    const stone = this.w.r.propImages.find((p) => p.p.interact === 'appraisal_stone');
    if (stone) this.w.fx.glow(stone.p.x, stone.p.y - 20, 0x7cc8ff, 90, 1500);
    await wait(this.w, 800);
    await this.stoneReveal();
    Sound.sfx('laugh', 0.8);
    dorn.say('Sıfır! Hepsi sıfır!', 3);
    await wait(this.w, 600);
    lina.say('Hihihihi!', 2.5);
    await wait(this.w, 600);
    vera.say('Level 0! Fareler bile seni döver!', 3);
    await wait(this.w, 1800);
    await this.think('Kahkahalar. Haklılar. Bir fareyle bile dövüşsem kaybedebilirim.');
    // B21: taşın "Trait" satırı "—"; Celeste trait'in ne olduğunu bilir, Joseph'inkini göremez
    await this.say('celeste', 'Trait\'in yok. Çoğunun yoktur, üzülme. Doğuştan gelir; ya vardır ya yoktur.', 'normal');
    await this.think('Divine Paladin... Taş göremiyor. O mavi pencerede gördüğümü kimse göremiyor.');
    await this.say('celeste', 'Gördüğün gibi. Brindlewood şubesi. Rütben G-.', 'alayci');
    // kart
    transact(G.p as any, { label: 'Lonca kartı', give: [{ id: 'guild_card', qty: 1 }] });
    G.p.guildRank = 0;
    G.setFlag('guild_registered');
    R.toast('+1 Lonca Kartı (G-)', 'item', 'card');
    R.sysmsg('LONCA KAYDI', ['Maceracılar Loncası — Brindlewood Şubesi', 'Rütbe: G-', 'Görevler: kendi harfin ve bir üstü (G, F)'], { big: true });
    await this.say('celeste', 'Kartını kaybetme. Yenisi beş gümüş. Görev panosu orada.', 'normal');
    await this.say('celeste', 'Ama elinde bir silah görmeden sana ilan vermem. Çıplak elle fare kovalayan G-\'nin cenazesini lonca ödemez.', 'alayci');
    await this.say('vera', 'Hoş geldin, G- maceracı! Dikkat et, fareler ısırır!', 'alayci');
    this.registering = false;
    for (const n of [vera, lina, dorn]) n.scripted = false;
    await this.ch2.onRegistered();
  }

  async stoneReveal() {
    const W = Display.uiW;
    const c = this.ui.add.container(W / 2 - 300, 70).setDepth(70);
    const g = this.ui.add.graphics();
    const { drawBlue, txt, FONT } = await import('../ui/kit');
    drawBlue(g, 0, 0, 600, 360, 0.88);
    c.add(g);
    c.add(txt(this.ui, 300, 16, '【 APPRAISAL TAŞI — LONCA KAYDI 】', { size: 19, font: FONT.title, color: '#e6f6ff', bold: true }).setOrigin(0.5, 0));
    const rows = [
      ['İsim', 'Joseph'], ['Irk', 'İnsan'], ['Cinsiyet', 'Erkek'], ['Yaş', '18'],
      ['Level', `${G.p.level}`], ['HP', fmtHp(G.d.maxHp)], ['MP', `${G.d.maxMp}`],
      ['Statlar', STAT_KEYS.map((k) => `${k} ${G.d.stats[k]}`).join(' · ')],
      ['Skill', 'Appraisal (G-)'],
      // B21: taş trait'i göremez (Divine Paladin hiçbir Appraisal'da görünmez)
      ['Trait', '—'],
    ];
    rows.forEach(([k, v], i) => {
      c.add(txt(this.ui, 30, 60 + i * 30, k, { size: 17, bold: true, color: '#cfeaff' }));
      const t = txt(this.ui, 170, 60 + i * 30, v, { size: 17, color: '#ffffff' });
      t.setAlpha(0);
      this.ui.tweens.add({ targets: t, alpha: 1, delay: 300 + i * 220, duration: 200, onStart: () => Sound.sfx('click', 0.3) });
      c.add(t);
    });
    c.setAlpha(0);
    this.ui.tweens.add({ targets: c, alpha: 1, duration: 300 });
    await wait(this.w, 4200);
    this.ui.tweens.add({ targets: c, alpha: 0, duration: 400, onComplete: () => c.destroy() });
  }

  async talkCaptain() {
    const hasCard = !!G.p.inventory.guild_card;
    await this.say('captain', 'Dur. Bu yol Eros\'a çıkar. Kimsin, nereye?');
    if (!hasCard) {
      await this.say('captain', 'Lonca kartın yok, soyadın yok, paran yok. Geçiş ücreti beş gümüş, kartlı olsan bile. Geri dön.', 'kizgin');
      return;
    }
    await this.say('captain', 'Lonca kartı... G-. Hm. Geçiş ücreti beş gümüş. Ve şehir yolu G- biri için bir haftalık ölüm yürüyüşüdür.');
    const c = await this.ui.choice(['"Ücreti ödemek istiyorum." ', '"Anladım. Dönüyorum."']);
    if (c === 0) {
      if (walletTotal(G.p.wallet) < FEES.gatePass) {
        await this.say('captain', 'Beş gümüş dedim. Cebindekiyle bu kapıdan bir tavuk bile geçmez.');
      } else {
        await this.say('captain', 'Paran var ama rütben yok. Şehre en az E rütbe maceracılar alınıyor bu aralar. Kral emri. Geri dön, evlat.');
      }
    } else await this.say('captain', 'Akıllıca.');
  }

  async talkHunter(n: Npc) {
    const shop = SHOPS.lodge;
    const hour = G.state.time.minute / 60;
    const open = shopOpen(shop, this.w.mapData.id, hour);
    await this.say('hunter', n.def.talk.any![Math.floor(Math.random() * n.def.talk.any!.length)]);
    if (!open) {
      await this.say('hunter', `Ders mi, yay mı? Kulübemdeyken gel. Kuzeydoğuda, korunun kenarında. Öğleden sonra ${shop.hours[0]}:00–${shop.hours[1]}:00 oradayım.`);
      return;
    }
    if (this.w.josephStatus() === 'naked') {
      await this.say('hunter', '...Önce bir şey giy. Ormanda bile böyle gezilmez.');
      return;
    }
    await this.serveCustomersFirst(n, shop.id);
    const opts = ['Alışveriş', 'Bir şey satmak istiyorum'];
    const acts: (() => Promise<void>)[] = [async () => openShop(this.ui, 'lodge', 'buy'), async () => openShop(this.ui, 'lodge', 'sell')];
    for (const o of this.ch2.sideOptions(n)) {
      opts.push(o.label);
      acts.push(o.run);
    }
    opts.push('Teşekkürler.');
    acts.push(async () => {});
    const c = await this.ui.choice(opts);
    this.ui.closeDialogue();
    await acts[c]();
  }

  /** Dükkânda Joseph'ten üst kasttan bir müşteri varsa önce ona bakılır. */
  async serveCustomersFirst(keeper: Npc, shopId: string) {
    const stamp = `${G.state.time.day}:${Math.floor(G.state.time.minute / 60)}`;
    const customers = this.w.npcs.filter((c) => c !== keeper && !c.def.shop && c.def.id !== 'merc_guard' && c.def.id !== 'apprentice' && c.def.id !== 'innmaid' && c.prestige >= 2 && (c as any).servedAt !== stamp);
    if (!customers.length) return;
    customers.sort((a, b) => b.prestige - a.prestige);
    const cust = customers[0];
    (cust as any).servedAt = stamp;
    const title = cust.def.caste === 'noble' || cust.prestige >= 4 ? 'Efendi' : cust.def.creature.gender === 'Kadın' ? 'Hanım' : 'Usta';
    const short = cust.def.name.split(' ').pop();
    await this.say(keeper.def.id, `Bekle. Önce ${short} ${title}.`);
    this.ui.closeDialogue();
    const a = this.w.player.actor;
    const cf = this.w.mapData.points.counter_front;
    if (cf) {
      await this.walk(a, cf.x + 2, cf.y + 1);
      a.face('left');
      cust.scripted = true;
      await this.walk(cust.actor, cf.x, cf.y, 2);
      cust.actor.face('up');
      this.face(keeper.actor, cust.actor);
    }
    const asks: Record<string, string> = {
      merchant: 'En iyisinden. Hesabıma yaz, ay sonunda öderim. Belki.',
      headwife: 'Sıra mı? Muhtar karısı sıra beklemez. Çabuk ol.',
      steward: 'Baron adına alıyorum. Fiyatı sen değil, ben söylerim.',
    };
    cust.say(asks[cust.def.id] ?? 'Her zamankinden, lütfen.', 2.6);
    await wait(this.w, 1500);
    keeper.say(cust.prestige >= 4 ? 'Hemen, efendim! Başüstüne!' : 'Hemen geliyor.', 2.2);
    Sound.sfx('coin', 0.5);
    await wait(this.w, 1900);
    if (cf) {
      const q = this.w.mapData.points.queue ?? { x: cf.x + 3, y: cf.y };
      await this.walk(cust.actor, q.x, q.y, 2);
      await this.walk(a, cf.x, cf.y);
      a.face('up');
    }
    cust.scripted = false;
    this.face(keeper.actor, a);
    if (!G.flag('queue_seen')) {
      G.setFlag('queue_seen');
      await this.think('Ben önce gelmiştim. Ama burada sıra gelişle değil, kimin ne olduğuyla belirleniyor.');
    }
    await this.say(keeper.def.id, 'Evet, sen. Ne istiyordun?');
  }

  async talkShop(n: Npc, shopId: string) {
    const shop = SHOPS[shopId];
    const st = this.w.josephStatus();
    const pool = [...(n.def.talk[st] ?? []), ...(n.def.talk.any ?? [])];
    const hour = G.state.time.minute / 60;
    const kind = shopId;
    // Hizmet sadece kendi dükkânında ve çalışma saatinde
    if (!shopOpen(shop, this.w.mapData.id, hour)) {
      await this.say(n.def.id, pool[Math.floor(Math.random() * pool.length)] ?? 'Hm?');
      if (this.w.mapData.id === shop.map) {
        // A3.3: sabah açılmadan önce "yarın" değil
        const early = G.state.time.minute / 60 < shop.hours[0];
        await this.say(n.def.id, `Dükkân kapalı. ${early ? `Biraz sonra gel; ${shop.hours[0]}:00'de açarım.` : `Yarın gel; ${shop.hours[0]}:00 ile ${shop.hours[1]}:00 arası açığım.`}`);
      }
      else await this.say(n.def.id, shopId === 'healer' ? 'Yara sarmak, ilaç satmak... Bunlar şifa evinde olur, yavrum. Dükkânımdayken gel.' : 'Alışveriş mi? Burada değil. Dükkânımdayken gel.');
      if (shopId === 'healer' && st === 'naked' && G.p.hp < G.d.maxHp && !G.flag('healer_free')) {
        G.setFlag('healer_free');
        G.p.hp = G.d.maxHp;
        Sound.sfx('heal');
        await this.think('Yine de yaralarıma bir merhem sürdü. Bedava.');
      }
      return;
    }
    const side = this.ch2.sideOptions(n);
    if (st === 'naked' && kind !== 'healer') {
      await this.say(n.def.id, pool[0] ?? 'Önce bir şey giy.', 'kizgin');
      // çıplakken alışveriş yok; yan görev seçeneği yine de sunulur
      if (side.length) {
        const c = await this.ui.choice([...side.map((o) => o.label), 'Hoşça kal']);
        if (c < side.length) await side[c].run();
      }
      return;
    }
    await this.say(n.def.id, pool[Math.floor(Math.random() * pool.length)] ?? 'Buyur.');
    await this.serveCustomersFirst(n, shopId);
    const opts = ['Alışveriş', 'Bir şey satmak istiyorum'];
    const acts: (() => Promise<void>)[] = [async () => openShop(this.ui, kind, 'buy'), async () => openShop(this.ui, kind, 'sell')];
    // 0.9.0: yan görev seçeneği (mavi ünlem + görevin adı) alışverişin yanında; görev aktifken de alışveriş açık
    for (const o of side) {
      opts.push(o.label);
      acts.push(o.run);
    }
    // B21: Ilse Nine'nin eski masalı (bir kez) — ışık taşıyan şövalyeler
    if (kind === 'healer' && G.flag('guild_registered') && !G.flag('paladin_tale')) {
      opts.push('Eski masallar bilir misin?');
      acts.push(async () => {
        G.setFlag('paladin_tale');
        await this.say('healer', 'Masal mı? Hıh. Annem anlatırdı, yavrum. Çok eskiden, ışık taşıyan şövalyeler varmış. Paladin derlermiş onlara.');
        await this.say('healer', 'Ne kılıçları keskinmiş ne zırhları parlak. Ama yaralı birine dokununca yara kapanırmış, karanlık bir yerde dursalar gölge çekilirmiş.');
        await this.say('healer', 'Lonca taşı onları okuyamazmış, derler. Taş ne bilir ki? Masal işte. Al şu merhemi, otur biraz.');
        await this.think('Işık taşıyan şövalyeler... Taş onları okuyamazmış.');
      });
    }
    if (kind === 'healer' && G.p.hp < G.d.maxHp) {
      opts.push(`Yaralarımı sar ({m:${FEES.healerWrap}})`);
      acts.push(async () => {
        const r = R.pay(FEES.healerWrap, 'Şifacı');
        if (!r.ok) {
          await this.say('healer', 'Paran yoksa otur, yine de sararım. Ama söyleme kimseye.');
        } else Sound.sfx('coin');
        G.p.hp = G.d.maxHp;
        Sound.sfx('heal');
      });
    }
    opts.push('Hoşça kal');
    acts.push(async () => {});
    const c = await this.ui.choice(opts);
    this.ui.closeDialogue();
    await acts[c]();
  }

  // ============================================================ prop etkileşimi
  /** Bu etkileşim şu an sunulsun mu? (ör. "Otur" yalnızca ilk kadehte) */
  propAvailable(id: string): boolean {
    if (id === 'sit_table') return this.ch2.canSit();
    return true;
  }

  interactProp(id: string, p: PropPlacement) {
    if (this.busy) return;
    if (TRAINING_SPOTS[id]) return this.training(TRAINING_SPOTS[id]);
    switch (id) {
      case 'bed_attic':
        return this.scene(async () => this.sleepAttic());
      case 'quest_board':
        return this.scene(async () => {
          if (await this.ch2.board()) return;
          await this.think('Pano dolu ama ilanları Celeste dağıtıyor. Kartı olmayana bakmıyor bile.');
          if (this.w.npc('celeste')) await this.say('celeste', BOARD_EXCUSES[(G.state.time.day - 1) % BOARD_EXCUSES.length]);
        });
      case 'rank_table':
        return this.scene(async () => {
          await this.ui.system('RÜTBE TABLOSU: G → F → E → D → C → B → A → S → X. Görev alabileceğin rütbeler: kendi harfin ve bir üstü. G, F ve E içindeki terfiler puanla, sınavsızdır; E-\'den itibaren harf atlamak için terfi sınavı gerekir. Eşikler: G 40, G+ 100, F- 180 puan (ve en az Level 1).');
          await this.think('S rütbede sadece iki üç kişi varmış. X... sadece efsanelerde.');
        });
      case 'appraisal_stone':
        return this.scene(async () => {
          if (!G.flag('guild_registered')) await this.think('Mavi bir taş. İçinde ışık dönüyor. Kayıt için kullanıyorlarmış.');
          else await this.think('Taş artık sessiz. Kayıttan sonra bir daha dokunmama izin vermezler herhalde.');
        });
      case 'sit_table':
        return this.scene(async () => {
          if (this.ch2.canSit()) await this.ch2.celebrate();
          else await this.think('Vera\'nın masası. Davetsiz oturursam bıçağını çatalla karıştırır.');
        });
      case 'archery_target':
        return this.scene(async () => {
          await this.think(R.hasSkill('archery') ? 'Bir yayım olsa burada atış çalışabilirim.' : 'Ok izleriyle dolu bir hedef. Biri sık sık çalışıyor.');
        });
    }
  }

  async sleepAttic() {
    const ok = !!G.flag('bertram_deal') || G.flag('room_day') === G.state.time.day;
    if (!ok) {
      await this.think('Bu yatak benim değil.');
      return;
    }
    // C9: her "Uyu"da yeniden doğma noktası ve kayıt; gerçek uyku 20:00 sonrası ya da 8 saat uyanıklıktan sonra
    const bed = this.w.mapData.points.bed;
    this.w.sleep({ map: 'inn_attic', x: bed.x, y: bed.y });
    const t = G.state.time;
    const now = absMinute(t.day, t.minute);
    // 0.6.0: görev bir saati bekliyorsa (lonca kapalı, NPC yok, ertesi gün) o saate kadar uyunabilir; bu seçenek
    // "20:00 sonrası ya da 8 saat uyanık" kuralına takılmaz.
    const qw = this.w.questWaitSoonest();
    let questSleep = false;
    if (qw) {
      const u = fromAbsMinute(qw.until);
      const when = `${u.day > t.day ? 'yarın ' : ''}${clockLabel(u)}`;
      const c = await this.ui.choice(['Uyu', `Görev saatine kadar uyu (${when})`, 'Vazgeç']);
      if (c === 2) return;
      questSleep = c === 1;
      if (questSleep) G.setFlag('tut_sleep');
    }
    if (!questSleep && !canSleep(t.minute, now, G.state.awakeSince)) {
      G.save('auto');
      G.events.emit('saved');
      R.sysmsg('YENİDEN DOĞMA NOKTASI', ['Tavan arasındaki yatak. Oyun kaydedildi.'], { sound: 'system' });
      await this.think('Uykum yok. Daha gün bitmedi.');
      return;
    }
    await this.ui.curtain(1, 900);
    Sound.play('night');
    const late = t.minute >= 20 * 60 || t.minute < 4 * 60;
    const morning = nextMorning(t);
    const wake = questSleep ? fromAbsMinute(qw!.until) : late ? morning : (() => {
      const a = absMinute(morning.day, morning.minute), b = now + 8 * 60;
      const m = Math.min(a, b);
      return { day: Math.floor(m / 1440) + 1, minute: m % 1440 };
    })();
    G.state.time = wake;
    G.state.awakeSince = absMinute(wake.day, wake.minute);
    // B13: uyurken Tokluk yarı hızda azalır
    R.passHunger(absMinute(wake.day, wake.minute) - now, true);
    // gün değişimi: görev uykusunda geçilen her gün için bir kez (normal uykuda eskisi gibi bir kez)
    const days = questSleep ? Math.max(0, wake.day - t.day) : 1;
    for (let i = 0; i < days; i++) {
      R.onNewDay();
      this.onNewDay();
    }
    G.p.hp = G.d.maxHp;
    G.p.mp = G.d.maxMp;
    G.p.stamina = G.d.maxStamina;
    G.state.divine.light = 0;
    const msg = this.ui.overlayText('Uyuyorsun...', { size: 26, color: '#a9c8ff' });
    await wait(this.w, 1600);
    msg.destroy();
    G.save('auto');
    G.events.emit('saved');
    R.sysmsg('UYKU · KAYDEDİLDİ', ['Yeniden doğma noktası: tavan arası.', `${G.state.time.day}. gün, ${clockLabel(G.state.time)}.`]);
    await this.ui.curtain(0, 900);
    this.w.updateMusic();
    await this.afterSleep();
  }

  /** Uyandıktan sonra (hikâye kancası). */
  async afterSleep() {
    this.ch2.checkDeadlines();
    if (G.state.time.minute / 60 < 8 && G.flag('bertram_deal') && !G.flag('bertram_done') && G.flag('worked_today') !== G.state.time.day) await this.think('Sabah. Bertram aşağıda bekliyordur.');
  }

  async training(spot: TrainingSpot) {
    const kind = spot.minigame;
    this.scene(async () => {
      if (!R.trainingAvailable()) {
        await this.think('Bugün yeterince antrenman yaptım. Bedenim daha fazlasını kaldırmaz. (Günde en fazla 3)');
        return;
      }
      const c = await this.ui.choice([`${spot.name} antrenmanı yap (1 saat)`, 'Vazgeç']);
      if (c !== 0) return;
      this.ui.closeDialogue();
      const perf = await new Promise<number>((resolve) => {
        this.w.scene.launch('Minigame', { kind, done: resolve });
        this.w.scene.bringToTop('Minigame');
        this.w.paused = true;
      });
      this.w.paused = false;
      this.advanceClock(60);
      const e = R.completeTraining(spot.divineExp, perf);
      G.p.stamina = Math.max(0, G.p.stamina - 30);
      await this.think(perf > 0.75 ? 'Kaslarım yanıyor, ama içimde bir şey parlıyor. Divine...' : perf > 0.4 ? 'Fena değil. Biraz daha güçlendim galiba.' : 'Berbattı. Ama bir şey kazandım yine de.');
      R.sysmsg('ANTRENMAN', [`${spot.name} · Performans %${Math.round(perf * 100)}`, `Divine EXP +${e}`, `Bugün kalan seans: ${3 - G.state.divine.trainingCount}`]);
    });
  }

  // ============================================================ awakening (0.10.0: gizli keşif teklifleri kalktı — B17)
  tryPending() {
    if (this.busy || this.w.cutscene || this.w.inBattle || this.ui.dialogueOpen() || this.ui.menuOpen() || this.w.paused) return;
    const dv = G.state.divine;
    if (dv.pendingAwakenings.length) {
      const lv = dv.pendingAwakenings.shift()!;
      this.scene(async () => this.awakening(lv));
    }
  }

  async awakening(level: number) {
    this.musicOverride = true;
    Sound.play('void');
    Sound.sfx('awaken');
    const W = Display.uiW, H = Display.uiH;
    const glow = fullScreenRect(this.ui, 0xffe9a0, 0).setDepth(85).setBlendMode(Phaser.BlendModes.ADD);
    this.ui.tweens.add({ targets: glow, fillAlpha: 0.55, duration: 1400, yoyo: true, hold: 600 });
    const a = this.w.player.actor;
    for (let i = 0; i < 6; i++) this.w.time.delayedCall(i * 250, () => this.w.fx.ring(a.x, a.y - 20, 0xffe28a, 60 + i * 20, 900));
    this.w.fx.glow(a.x, a.y - 20, 0xffe28a, 140, 3000);
    await wait(this.w, 2200);
    glow.destroy();
    const lines = DIVINE_STATS.map((s) => `${DIVINE_STAT_NAMES[s]} ${divineStat(s, level).toFixed(2)}x`);
    await this.ui.system(`Divine Paladin — AWAKENING (Divine Level ${level}). Tüm Divine statları ×1.5 yükseldi. ${lines.join(' · ')}`);
    const opts = divineOffer(level, G.state.divine.skills);
    if (opts.length) {
      await this.ui.system('Sistem üç Divine skill öneriyor. Birini seç. İade yok.');
      this.ui.closeDialogue();
      const i = await panelChoice(this.ui, 'DIVINE SKILL SEÇİMİ', opts.map((o) => ({ title: o.name + (o.kind === 'passive' ? ' (Pasif)' : ` (Aktif · Işık ${o.light})`), desc: o.desc, icon: o.icon })), true);
      const pick = opts[i];
      G.state.divine.skills.push(pick.id);
      R.sysmsg('DIVINE SKILL', [`Divine Paladin: ${pick.name}`, pick.kind === 'active' ? 'Işık barı açıldı. Vuruş yaptıkça ve kaçtıkça dolar.' : 'Pasif olarak her zaman etkin.'], { big: true, sound: 'title' });
      G.invalidate();
      this.ui.refreshButtons();
    }
    this.musicOverride = false;
    this.w.updateMusic();
    // B21: ilk Uyanış'ta iç ses
    if (!G.flag('thought_awakening')) {
      G.setFlag('thought_awakening');
      await this.think('Uyanış... Status bunu bekliyormuş. Trait\'in kendisi uyanıyor, ben değil.');
    }
    G.save('auto');
  }
}
