import { zeroStats } from './formulas';
import { emptyWallet, type Wallet } from './money';
import type { CreatureData } from './types';
import type { GameTime } from './time';
import { newSkill } from './skills';
import { newGuildState, type GuildState } from './guild';
import { newQuestLog, type QuestLog } from './quests';
import type { EntryCard } from './cards';

export interface DivineState {
  level: number;
  exp: number;
  skills: string[]; // açılmış Divine skill id'leri
  light: number;
  streak: number;
  trainingDay: number;
  trainingCount: number;
  pendingAwakenings: number[]; // henüz seçim yapılmamış awakening level'ları
}

export interface HistoryLine {
  speaker: string;
  text: string;
  kind: 'say' | 'thought' | 'system' | 'choice';
}

export interface Point {
  map: string;
  x: number;
  y: number;
}

export interface GameState {
  saveVersion: number;
  createdAt: number;
  savedAt: number;
  playSeconds: number;
  player: CreatureData & { wallet: Wallet; stamina: number };
  divine: DivineState;
  time: GameTime;
  pos: Point & { facing: string };
  /** Son uyunan yatak; yoksa ormanda ilk uyanılan yer. */
  spawn: Point;
  fog: Record<string, string>; // harita id → keşif bitmap'i (base64)
  flags: Record<string, number | string | boolean>;
  affinity: Record<string, number>;
  counters: Record<string, number>;
  history: HistoryLine[];
  lastSkillLearnWeek: number | null;
  expToday: number;
  expDay: number;
  /** Teklif edilip bekleyen hidden discovery skill'leri. */
  pendingDiscoveries: string[];
  appraised: Record<string, number>; // hedef id → son appraise edilen gün (boşa kullanım engeli)
  killed: Record<string, number>; // canavar türü → sayı
  respawns: Record<string, number>; // spawn noktası id → yeniden doğacağı oyun dakikası (mutlak)
  gathered: Record<string, number>; // toplama noktası → toplandığı gün
  /** Hızlı Yemek yuvasına atanmış yiyecek (yoksa envanterdeki ilk yiyecek). */
  quickFood: string | null;
  // ---------------------------------------------------------------- 0.3.0
  /** Maceracılar Loncası: puan, borç, bekleyen terfi (C3). */
  guild: GuildState;
  /** Görev günlüğü (C2). */
  quests: QuestLog;
  /** Şehir giriş kartları (C8). */
  cards: EntryCard[];
  /** En son uyanılan an (mutlak oyun dakikası) — uyku kuralı (C9). */
  awakeSince: number;
  /** Yanındaki yoldaşlar (C4). */
  party: string[];
  /** Yoldaşların son HP'si (harita geçişlerinde korunur). */
  partyHp: Record<string, number>;
  /** Günün pano görevleri (her sabah yenilenir). */
  board: { day: number; ids: string[] };
}

export const START_POINT: Point = { map: 'world', x: 0, y: 0 };

export function newJoseph(): GameState['player'] {
  return {
    id: 'joseph',
    name: 'Joseph',
    race: 'İnsan',
    gender: 'Erkek',
    age: 18,
    level: 0,
    exp: 0,
    alloc: zeroStats(),
    unspent: 0,
    sp: 0,
    hp: 5,
    mp: 0,
    stamina: 50,
    skills: [newSkill('appraisal')],
    traits: ['divine_paladin'],
    titles: [],
    equipment: { pants: 'torn_shorts' },
    inventory: {},
    wallet: emptyWallet(),
    guildRank: null,
  };
}

export function newGameState(): GameState {
  const now = Date.now();
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    createdAt: now,
    savedAt: now,
    playSeconds: 0,
    player: newJoseph(),
    divine: {
      level: 0, exp: 0, skills: [], light: 0, streak: 0,
      trainingDay: 1, trainingCount: 0, pendingAwakenings: [],
    },
    time: { day: 1, minute: 7 * 60 + 20 },
    pos: { ...START_POINT, facing: 'down' },
    spawn: { ...START_POINT },
    fog: {},
    flags: {},
    affinity: {},
    counters: {},
    history: [],
    lastSkillLearnWeek: null,
    expToday: 0,
    expDay: 1,
    pendingDiscoveries: [],
    appraised: {},
    killed: {},
    respawns: {},
    gathered: {},
    quickFood: null,
    guild: newGuildState(),
    quests: newQuestLog(),
    cards: [],
    awakeSince: 7 * 60 + 20,
    party: [],
    partyHp: {},
    board: { day: 0, ids: [] },
  };
}

export const CURRENT_SAVE_VERSION = 4;

/** Dünya haritasının 0.1.x boyutları (sis haritası göçü için). */
export const OLD_WORLD_W = 150;
export const OLD_WORLD_H = 110;
/** 0.2.0 dünya boyutu. */
export const V2_WORLD_W = 230;
export const V2_WORLD_H = 150;
