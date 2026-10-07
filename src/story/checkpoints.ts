// 0.11.0 (E): hikâye kontrol noktaları — geliştirici modu ve QA betiği (window.__qa.checkpoint). Her nokta yeni bir
// oyundan başlar ve o ana kadarki görevleri, bayrakları, envanteri, parayı, lonca durumunu ve konumu tutarlı kurar;
// sıradaki ana görev ensureMainQuest ile (ya da burada) açılır. Phaser'sız; tests/g7dev.test.ts.
//
// Grup 6'daki bilinen sorun (mini oyunlu adımları geliştirici "Tamamla" ile geçmek sahne bayraklarını kurmuyordu):
// QUEST_EFFECTS hem kontrol noktalarında hem de geliştirici panelindeki "Tamamla"da aynı yan etkileri uygular.
import { newGameState, type GameState } from '../core/state';
import { finishQuest, startQuest } from '../core/quests';
import { questDef } from '../data/quests';
import { canonicalCoins, walletTotal } from '../core/money';
import { codexMeet } from '../core/codex';
import { RANK_THRESHOLDS } from '../core/guild';
import { SATIETY_MAX } from '../core/hunger';

export interface CheckpointDef {
  id: string;
  name: string;
}

export const CHECKPOINTS: CheckpointDef[] = [
  { id: 'awake', name: 'Uyanış sonrası' },
  { id: 'bertram_done', name: 'Bertram\'ın işi bitti' },
  { id: 'harvest_done', name: 'Hasat bitti' },
  { id: 'registered', name: 'Loncaya kayıtlı (pano açık)' },
  { id: 'vl_friends', name: 'Vera-Lina dostluğu sonrası' },
  { id: 'celebrate', name: 'İlk Kadeh (hana gir)' },
  { id: 'theft_done', name: 'Hırsızlık bitti' },
  { id: 'gate', name: 'Kapı' },
];

type Pts = (map: string) => Record<string, { x: number; y: number }>;

const give = (s: GameState, id: string, qty = 1) => {
  s.player.inventory[id] = (s.player.inventory[id] ?? 0) + qty;
};
const setMoney = (s: GameState, bronze: number) => {
  s.player.wallet = canonicalCoins(Math.max(0, bronze));
};
const addMoney = (s: GameState, bronze: number) => setMoney(s, walletTotal(s.player.wallet) + bronze);

/**
 * Bir görev bittiğinde hikâye sahnesinin kurduğu kalıcı yan etkiler (bayraklar, eşyalar, para, lonca). Sahne
 * oynamadan bitirilen görevlerde (kontrol noktası, geliştirici "Tamamla") bunlar uygulanır.
 */
export const QUEST_EFFECTS: Record<string, (s: GameState, day: number) => void> = {
  m_inn: (s, day) => {
    s.flags.inn_met = true;
    s.flags.bertram_deal = true;
    s.flags.deal_day = day;
    s.player.equipment.chest = 'linen_shirt';
    s.player.equipment.pants = 'linen_pants';
    s.player.equipment.boots = 'cloth_shoes';
    give(s, 'torn_shorts');
    for (const id of ['bertram', 'vera', 'lina']) codexMeet(s.codex, id, null, day);
  },
  m_bertram: (s) => {
    s.flags.bertram_done = true;
    s.counters.workDays = 2;
    addMoney(s, 50);
    s.satiety = SATIETY_MAX; // C1: ziyafet
  },
  m_harvest: (s, day) => {
    s.flags.farm_offered = true;
    s.flags.farm_done = true;
    addMoney(s, 50);
    give(s, 'bread');
    codexMeet(s.codex, 'haldor', null, day);
  },
  m_register: (s, day) => {
    s.flags.guild_registered = true;
    s.flags.guild_seen = true;
    s.guild.member = true;
    s.player.guildRank = 0;
    s.flags.ch2_start_day = day;
    give(s, 'guild_card');
    addMoney(s, -100);
    codexMeet(s.codex, 'celeste', null, day);
  },
  m_weapon: (s) => {
    give(s, 'cracked_stick');
    s.player.equipment.weapon = 'cracked_stick';
  },
  m_board: (s, day) => {
    s.flags.ch2_board_open = day;
  },
  g1_rats: (s) => addMoney(s, 20),
  g2_herbs: (s) => addMoney(s, 30),
  g3_letter: (s) => addMoney(s, 30),
  m_wounded: (s, day) => {
    s.flags.vl_healed_day = day;
    s.flags.spend_lock = 0;
    addMoney(s, -30);
  },
  m_vl_rest: (s, day) => {
    s.flags.friends_vl = day;
  },
  f_wolves: (s) => addMoney(s, 40),
  m_celebrate: (s, day) => {
    s.flags.side_unlocked = day;
    s.flags.theft_day = day;
  },
  m_theft: (s, day) => {
    s.flags.theft_started = day;
    s.flags.steward_met = true;
    s.flags.wynn_jailed = day;
    s.flags.cellar_offer_day = day + 1;
    addMoney(s, 5);
  },
  f_cellar: (s) => addMoney(s, 90),
  m_farewell: (s) => {
    give(s, 'bread', 2);
    give(s, 'cheese');
  },
  m_gate: (s, day) => {
    s.flags.ch2_done = day;
  },
};

/** Kontrol noktasına kadar biten görevler (sırayla) ve sonunda açık kalan görev. */
const PLAN: Record<string, { done: string[]; active?: string[]; day: number; minute: number; map: string; at: string | [number, number]; level?: number; points?: number; rank?: number; money?: number }> = {
  awake: { done: [], active: ['m_inn'], day: 1, minute: 8 * 60, map: 'world', at: 'wake' },
  bertram_done: { done: ['m_inn', 'm_bertram'], day: 3, minute: 6 * 60 + 30, map: 'inn', at: [7, 10] },
  harvest_done: { done: ['m_inn', 'm_bertram', 'm_harvest'], day: 3, minute: 17 * 60, map: 'world', at: 'guild_front' },
  registered: { done: ['m_inn', 'm_bertram', 'm_harvest', 'm_register', 'm_weapon', 'm_board'], active: ['m_grank', 'g1_rats', 'g2_herbs', 'g3_letter'], day: 4, minute: 9 * 60, map: 'guild', at: [7, 9] },
  vl_friends: { done: ['m_inn', 'm_bertram', 'm_harvest', 'm_register', 'm_weapon', 'm_board', 'g1_rats', 'g2_herbs', 'g3_letter', 'm_grank', 'm_air', 'm_wounded', 'm_vl_rest'], day: 5, minute: 9 * 60, map: 'inn', at: [7, 10], level: 1, points: 30 },
  celebrate: { done: ['m_inn', 'm_bertram', 'm_harvest', 'm_register', 'm_weapon', 'm_board', 'g1_rats', 'g2_herbs', 'g3_letter', 'm_grank', 'm_air', 'm_wounded', 'm_vl_rest', 'f_wolves'], active: ['m_celebrate'], day: 6, minute: 18 * 60, map: 'world', at: 'inn_front', level: 2, points: RANK_THRESHOLDS[1] + 5, rank: 1 },
  theft_done: { done: ['m_inn', 'm_bertram', 'm_harvest', 'm_register', 'm_weapon', 'm_board', 'g1_rats', 'g2_herbs', 'g3_letter', 'm_grank', 'm_air', 'm_wounded', 'm_vl_rest', 'f_wolves', 'm_celebrate', 'm_next_day', 'm_theft'], day: 6, minute: 21 * 60, map: 'world', at: 'plaza', level: 2, points: RANK_THRESHOLDS[1] + 5, rank: 1 },
  gate: { done: ['m_inn', 'm_bertram', 'm_harvest', 'm_register', 'm_weapon', 'm_board', 'g1_rats', 'g2_herbs', 'g3_letter', 'm_grank', 'm_air', 'm_wounded', 'm_vl_rest', 'f_wolves', 'm_celebrate', 'm_next_day', 'm_theft', 'm_vl_cellar', 'f_cellar', 'm_silver', 'm_farewell'], active: ['m_gate'], day: 12, minute: 10 * 60, map: 'world', at: 'checkpoint', level: 3, points: RANK_THRESHOLDS[1] + 20, rank: 1, money: 1000 },
};

/** Görev kimliği → bitince hikâyenin açtığı / sonrasında geçen tipik süre (gün) yok: düz liste yeterli. */
export function buildCheckpoint(id: string, points: Pts): GameState {
  const plan = PLAN[id];
  if (!plan) throw new Error('Bilinmeyen kontrol noktası: ' + id);
  const s = newGameState();
  s.flags.woke = true;
  s.flags.dp_awaken = true;
  s.flags.village_entered = true;
  s.flags.thought_run = true;
  s.flags.offer_intro = true;
  s.satiety = 80;
  let day = 1;
  const steps = plan.done.length || 1;
  plan.done.forEach((q, i) => {
    const def = questDef(q);
    if (!def) return;
    day = Math.max(1, Math.round(1 + ((plan.day - 1) * i) / steps));
    startQuest(s.quests, def, day);
    s.quests.quests[q].progress = def.objectives.map((o) => o.count ?? 1);
    finishQuest(s.quests, q, 'done', day);
    QUEST_EFFECTS[q]?.(s, day);
  });
  for (const q of plan.active ?? []) {
    const def = questDef(q);
    if (def) startQuest(s.quests, def, plan.day);
  }
  if (plan.active?.includes('m_grank')) give(s, 'guild_letter');
  if (plan.active?.includes('m_celebrate')) s.flags.celebrate_day = plan.day;
  if (plan.level) {
    s.player.level = plan.level;
    s.player.unspent = 4 * plan.level;
    s.player.sp = plan.level;
  }
  if (plan.points !== undefined) s.guild.points = plan.points;
  if (plan.rank !== undefined) s.player.guildRank = plan.rank;
  if (plan.money !== undefined) setMoney(s, plan.money);
  s.time = { day: plan.day, minute: plan.minute };
  s.expDay = plan.day;
  s.divine.trainingDay = plan.day;
  s.awakeSince = (plan.day - 1) * 1440 + 6 * 60;
  const pt = Array.isArray(plan.at) ? { x: plan.at[0], y: plan.at[1] } : points(plan.map)[plan.at];
  s.pos = { map: plan.map, x: pt?.x ?? 0, y: pt?.y ?? 0, facing: 'down' };
  if (s.flags.bertram_deal) s.spawn = { map: 'inn_attic', x: 5, y: 4 };
  s.player.hp = 9999;
  s.player.stamina = 9999;
  return s;
}
