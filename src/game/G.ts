// Oyunun küresel bağlamı: durum, ayarlar, olay yolu ve kurallar.
import Phaser from 'phaser';
import { newGameState, type GameState } from '../core/state';
import { loadSettings, saveSettings, type Settings } from './settings';
import { lastSlot, migrateSlots, readSlot, setLastSlot, writeSlot, type SlotId } from '../core/slots';
import { derive, type Derived } from '../core/creature';
import { setCommitHook } from '../core/transactions';
import { round2 } from '../core/formulas';
import { hungerMods } from '../core/hunger';

class GameContext {
  state: GameState = newGameState();
  settings: Settings = loadSettings();
  events = new Phaser.Events.EventEmitter();
  /** Oyun sahnesi aktifken true (kayıt yapılabilir). */
  inGame = false;
  private derivedCache: Derived | null = null;
  private saveTimer: any = null;
  artFiles = new Set<string>();
  /** assets/audio altındaki dosyalar (kullanıcının eklediği sesler). */
  audioFiles = new Set<string>();
  credits: any = null;
  /** D (0.11.0): oynanan kayıt yuvası (otomatik kayıt ve "Kaydet" buraya yazar). */
  slot: SlotId = 1;

  constructor() {
    setCommitHook(() => {
      this.invalidate();
      this.scheduleSave();
    });
  }

  get p() {
    return this.state.player;
  }

  /** Oyuncunun hesaplanmış statları (önbellekli). */
  get d(): Derived {
    if (!this.derivedCache) this.derivedCache = derive(this.state.player, { level: this.state.divine.level, staminaMult: hungerMods(this.state.satiety ?? 100).maxStamina });
    return this.derivedCache;
  }

  invalidate() {
    this.derivedCache = null;
    const d = this.d;
    const p = this.state.player;
    p.hp = round2(Math.min(p.hp, d.maxHp));
    p.mp = round2(Math.min(p.mp, d.maxMp));
    p.stamina = round2(Math.min(p.stamina, d.maxStamina));
    this.events.emit('stats');
  }

  newGame() {
    this.state = newGameState();
    this.invalidate();
  }

  flag(k: string) {
    return this.state.flags[k];
  }

  setFlag(k: string, v: number | string | boolean = true) {
    this.state.flags[k] = v;
  }

  count(k: string, n = 1) {
    this.state.counters[k] = (this.state.counters[k] ?? 0) + n;
    return this.state.counters[k];
  }

  affinity(npc: string, delta = 0) {
    this.state.affinity[npc] = (this.state.affinity[npc] ?? 0) + delta;
    return this.state.affinity[npc];
  }

  // ------------------------------------------------------------ kayıt
  scheduleSave() {
    if (!this.inGame) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save('auto'), 400);
  }

  /**
   * D (0.11.0): kayıt oynanan yuvaya yazılır ('auto' = otomatik, 'manual' = Kaydet; ikisi de aynı yuva).
   * `to` verilirse o yuvaya yazılır ve oynanan yuva o olur (Eski kaydı bir yuvaya kaydetmek için).
   */
  save(_kind: 'auto' | 'manual' = 'auto', to?: SlotId) {
    try {
      // A7.11: kayda iki ondalık
      const p = this.state.player;
      p.hp = round2(p.hp);
      p.mp = round2(p.mp);
      p.stamina = round2(p.stamina);
      if (to) this.slot = to;
      writeSlot(localStorage, this.slot, this.state);
      return true;
    } catch (e) {
      console.warn('Kayıt başarısız', e);
      return false;
    }
  }

  /** Bir yuvayı yükle (verilmezse son oynanan). 'legacy': eski kayıt (yüklenince bir yuvaya kaydedilmesi istenir). */
  load(slot?: SlotId | 'legacy' | null): boolean {
    this.migrateSlots();
    const s = slot ?? lastSlot(localStorage);
    if (!s) return false;
    const st = readSlot(localStorage, s);
    if (!st) return false;
    this.state = st;
    if (s !== 'legacy') {
      this.slot = s;
      setLastSlot(localStorage, s);
    }
    this.invalidate();
    return true;
  }

  hasSave() {
    this.migrateSlots();
    return lastSlot(localStorage) !== null;
  }

  /** Eski kayıt sisteminden bir kez taşı (açılışta). */
  migrateSlots() {
    try {
      migrateSlots(localStorage);
    } catch {
      /* depolama yok */
    }
  }

  /** Yeni oyun belirli bir yuvada. */
  newGameIn(slot: SlotId) {
    this.newGame();
    this.slot = slot;
  }

  saveSettings() {
    saveSettings(this.settings);
    this.events.emit('settings');
  }

  hasArt(path: string) {
    return this.artFiles.has(path);
  }

  /** assets/audio/<ad>.(ogg|mp3|wav|m4a) varsa yolunu döndürür. */
  audioFile(name: string): string | null {
    for (const ext of ['ogg', 'mp3', 'wav', 'm4a']) if (this.audioFiles.has(`${name}.${ext}`)) return `assets/audio/${name}.${ext}`;
    return null;
  }
}

export const G = new GameContext();
(window as any).__G = G;
