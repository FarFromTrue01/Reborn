// Oyunun küresel bağlamı: durum, ayarlar, olay yolu ve kurallar.
import Phaser from 'phaser';
import { newGameState, type GameState } from '../core/state';
import { loadSettings, saveSettings, type Settings } from './settings';
import { readSave, writeSave, latestSlot, type SlotKey } from '../core/save';
import { derive, type Derived } from '../core/creature';
import { setCommitHook } from '../core/transactions';

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
    if (!this.derivedCache) this.derivedCache = derive(this.state.player, { level: this.state.divine.level });
    return this.derivedCache;
  }

  invalidate() {
    this.derivedCache = null;
    const d = this.d;
    const p = this.state.player;
    p.hp = Math.min(p.hp, d.maxHp);
    p.mp = Math.min(p.mp, d.maxMp);
    p.stamina = Math.min(p.stamina, d.maxStamina);
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

  save(slot: SlotKey = 'auto') {
    try {
      writeSave(localStorage, slot, this.state);
      if (slot !== 'auto') writeSave(localStorage, 'auto', this.state);
      return true;
    } catch (e) {
      console.warn('Kayıt başarısız', e);
      return false;
    }
  }

  load(slot?: SlotKey | null): boolean {
    const s = slot ?? latestSlot(localStorage);
    if (!s) return false;
    const st = readSave(localStorage, s);
    if (!st) return false;
    this.state = st;
    this.invalidate();
    return true;
  }

  hasSave() {
    return latestSlot(localStorage) !== null;
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
