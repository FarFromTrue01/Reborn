// 0.11.0 (E): betik API'si — `?qa=1` ya da geliştirici modunda `window.__qa`. Başsız tarayıcı betikleri (tools/qa)
// oyunun iç alanlarına elle dokunmadan bunları kullanır. Belgesi README'de ("window.__qa").
import type Phaser from 'phaser';
import { G } from './G';
import { Dev } from './dev';
import { errors, errorsText } from './errorLog';
import { buildCheckpoint, CHECKPOINTS } from '../story/checkpoints';
import { activeQuests, currentObjective } from '../core/quests';
import { questDef } from '../data/quests';
import { walletTotal } from '../core/money';
import { importToSlot, type SlotId } from '../core/slots';
import { clockLabel } from '../core/time';

type AnyScene = Phaser.Scene & Record<string, any>;

export interface QaApi {
  checkpoint(name: string): Promise<boolean>;
  checkpoints(): { id: string; name: string }[];
  teleport(map: string, x: number, y: number, facing?: string): boolean;
  spawn(monster: string, x?: number, y?: number, count?: number): number[];
  respawn(): void;
  god(on?: boolean): boolean;
  oneHit(on?: boolean): boolean;
  debug(on?: boolean): boolean;
  setTime(day: number, minute: number): void;
  clock(scale: number, paused?: boolean): void;
  state(): Record<string, unknown>;
  errors(): ReturnType<typeof errors>;
  errorsText(): string;
  exportSave(): string;
  importSave(json: string, slot?: SlotId): boolean;
}

export function installQaApi(game: Phaser.Game) {
  const world = () => {
    const w = game.scene.getScene('World') as AnyScene | null;
    return w && w.sys.isActive() ? w : null;
  };
  const waitWorld = (timeout = 20000) =>
    new Promise<boolean>((resolve) => {
      const t0 = Date.now();
      const check = () => {
        const w = world();
        if (w?.player && w.mapData) resolve(true);
        else if (Date.now() - t0 > timeout) resolve(false);
        else setTimeout(check, 100);
      };
      check();
    });
  const api: QaApi = {
    /** Hikâye kontrol noktası: durumu kur, World sahnesini yeniden başlat; hazır olunca true. */
    async checkpoint(name) {
      const pts = (map: string) => {
        const w = world();
        if (w) return w.pointsOf(map);
        return {};
      };
      // noktalar dünya haritasından: World açık değilse önce bir kez açılır
      if (!world()) {
        G.newGame();
        startWorld(game);
        await waitWorld();
      }
      const s = buildCheckpoint(name, pts);
      G.state = s;
      G.invalidate();
      G.p.hp = G.d.maxHp;
      G.p.stamina = G.d.maxStamina;
      G.p.mp = G.d.maxMp;
      startWorld(game);
      const ok = await waitWorld();
      G.save('auto');
      return ok;
    },
    checkpoints: () => CHECKPOINTS.map((c) => ({ ...c })),
    teleport(map, x, y, facing = 'down') {
      const w = world();
      if (!w) return false;
      w.loadMap(map, x, y, facing);
      return true;
    },
    spawn(monster, x, y, count = 1) {
      const w = world();
      if (!w) return [];
      const a = w.player.actor;
      const tx = x ?? Math.round(a.x / 32) + 3, ty = y ?? Math.round(a.y / 32);
      return w.spawnAt(monster, tx, ty, count, 1, 'qa').map((e: any) => e.uid);
    },
    respawn() {
      world()?.respawnAll();
    },
    god: (on = true) => (Dev.god = on),
    oneHit: (on = true) => (Dev.oneHit = on),
    debug: (on = true) => (Dev.debug = on),
    setTime(day, minute) {
      G.state.time = { day, minute };
      G.events.emit('time');
    },
    clock(scale, paused = false) {
      Dev.clockScale = scale;
      Dev.clockPaused = paused;
    },
    state() {
      const w = world();
      const a = w?.player?.actor;
      return {
        map: w?.mapData?.id ?? null,
        x: a ? Math.round(a.x / 32) : null,
        y: a ? Math.round(a.y / 32) : null,
        time: `${G.state.time.day}. gün ${clockLabel(G.state.time)}`,
        level: G.p.level,
        hp: G.p.hp,
        maxHp: G.d.maxHp,
        stamina: G.p.stamina,
        money: walletTotal(G.p.wallet),
        guild: { member: G.state.guild.member, points: G.state.guild.points, rank: G.p.guildRank },
        divine: { level: G.state.divine.level, exp: G.state.divine.exp, light: G.state.divine.light },
        satiety: G.state.satiety,
        party: [...G.state.party],
        slot: G.slot,
        quests: activeQuests(G.state.quests).map((id) => {
          const def = questDef(id);
          const st = G.state.quests.quests[id];
          const ci = def ? currentObjective(def, st) : -1;
          return { id, objective: def && ci >= 0 ? def.objectives[ci].label : null };
        }),
        cutscene: !!w?.cutscene,
        enemies: (w?.enemies ?? []).filter((e: any) => e.alive).map((e: any) => ({ uid: e.uid, id: e.def.id, state: e.state, hp: e.c.hp, x: Math.round(e.x / 32), y: Math.round(e.y / 32), stagger: e.stagger.fill, stunned: e.stunned })),
        errors: errors().length,
      };
    },
    errors: () => errors(),
    errorsText: () => errorsText(),
    exportSave: () => JSON.stringify(G.state),
    importSave(json, slot = G.slot) {
      return importToSlot(localStorage, slot, json);
    },
  };
  (window as any).__qa = api;
  return api;
}

/** World sahnesini (UI ile) baştan başlat: başlık ekranından ya da oyun içinden. */
function startWorld(game: Phaser.Game) {
  const sm = game.scene;
  // UI de durur: World açılırken temiz kurulur (önceki durumdan kalan seçim panelleri, bildirimler taşınmaz)
  for (const k of ['Menu', 'Minigame', 'Prologue', 'Title', 'Credits', 'UI']) if (sm.isActive(k) || sm.isPaused(k)) sm.stop(k);
  if (sm.isActive('World')) sm.getScene('World').scene.restart({});
  else sm.start('World', {});
}
