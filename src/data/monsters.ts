import type { Stats } from '../core/formulas';
import { parseSubRank, type SubRank } from '../core/ranks';

/** Yaratık sprite sayfası düzeni (assets/gfx/monsters/monsters.json): her animasyon dört yön satırı (yukarı, sol, aşağı, sağ). */
export interface MonsterSheetMeta {
  cols: number;
  anims: Record<string, { row: number; frames: number; fps: number }>;
}

/** Sayfadaki yön satırı sırası (LPC ile aynı: data/manifest DIR_INDEX). */
const DOWN_ROW = 2;

/**
 * Yaratık portresinin karesi (0.6.0): tanımda portraitFrame varsa o; yoksa bekleme (yoksa yürüme) animasyonunun
 * aşağı, yani kameraya bakan ilk karesi. Eskiden sayfanın ilk karesiydi: fare ve tavşan sırtı dönük görünüyordu.
 */
export function monsterPortraitFrame(meta: MonsterSheetMeta, override?: number): number {
  if (override !== undefined) return override;
  const a = meta.anims.idle ?? meta.anims.walk;
  return (a.row + DOWN_ROW) * meta.cols;
}

export interface DropDef {
  id: string;
  chance: number; // 0..1, LUK çarpanı uygulanır
  qty?: [number, number];
}

export type MonsterBehavior = 'aggressive' | 'flee' | 'pack' | 'slow' | 'caster' | 'boss';

export interface MonsterDef {
  id: string;
  name: string;
  /** Level aralığı; her level için kesin stat tablosu. */
  levels: [number, number];
  statsByLevel: Record<number, Partial<Stats>>;
  /**
   * 0.10.0 (B5/B9): level başına doğrudan HP (stat formülünden türetilmez; bir ondalıklı olabilir). Statlar yalnızca
   * hasar ve hız için.
   */
  hpByLevel: Record<number, number>;
  natural: { name: string; dmg: [number, number] };
  naturalDef: number;
  exp: [number, number];
  drops: DropDef[];
  /** Düşük ihtimalli özel drop. */
  special: DropDef;
  money?: [number, number, number]; // [min, max, şans] bronz
  behavior: MonsterBehavior;
  /** Kare/saniye. */
  speed: number;
  /** Fark etme mesafesi (kare). */
  sight: number;
  /** Görüş açısı (derece). */
  fov: number;
  attackRange: number; // kare
  windup: number; // saniye: saldırı öncesi uyarı
  cooldown: number; // saniye
  /** Alt kademeli rütbe (G-, G, G+ …): Appraisal direnci ve drop oranlarının görünürlüğü buna göre. */
  rank: string;
  /**
   * Köşeye sıkışma (ürkek hayvanlar): oyuncu `range` karo içinde `after` saniye kesintisiz kovalarsa
   * saldırgana döner; oyuncu `calmRange` karodan uzakta `calm` saniye kalınca yeniden ürkekleşir.
   */
  cornered?: { after: number; range: number; calm: number; calmRange: number };
  sprite: string;
  /** Appraisal portresi için sprite sayfasındaki kare (yoksa aşağı/kameraya bakan ilk kare: monsterPortraitFrame). */
  portraitFrame?: number;
  scale?: number;
  boss?: boolean;
  title?: string;
  gender?: string;
  /** Saldırı türü: ısırık (yakın), büyü (mermi). */
  attack: 'melee' | 'bolt';
  /** Düşmanın vücut yarıçapı (kare). */
  radius: number;
  desc: string;
}

// 0.10.0 (B5/B9): HP'ler level başına doğrudan değer (hpByLevel), 0.9.0 değerlerinin 1,5 katı; tests/balance.test.ts
// doğrular. Fare/Ahır Faresi/Tavşan 1,5 · Sümüksü 3/4,5 · Tarla Faresi 3 · Dev Fare 4,5 · Kurt 9/13,5 · Goblin 7,5/10,5 ·
// Şaman 6 · Şef 22,5. Statlar (DEX → AGI, MNA → INT birleşik) yalnızca hasar ve hız için.
const list: MonsterDef[] = [
  {
    id: 'rat', name: 'Fare', levels: [0, 0], statsByLevel: { 0: {} },
    hpByLevel: { 0: 1.5 }, natural: { name: 'Isırık', dmg: [1, 1] }, naturalDef: 0,
    exp: [1, 2],
    drops: [{ id: 'rat_tail', chance: 0.6 }, { id: 'small_stone', chance: 0.08 }],
    special: { id: 'gnawed_ring', chance: 0.012 },
    behavior: 'aggressive', speed: 3.2, sight: 4, fov: 140, attackRange: 0.9, windup: 0.45, cooldown: 1.4,
    rank: 'G-', sprite: 'm_rat', attack: 'melee', radius: 0.3,
    desc: 'Köy ambarlarından ormana yayılmış iri fareler. Küçük ama hırçın.',
  },
  {
    id: 'barn_rat', name: 'Ahır Faresi', levels: [0, 0], statsByLevel: { 0: {} },
    hpByLevel: { 0: 1.5 }, natural: { name: 'Isırık', dmg: [1, 1] }, naturalDef: 0,
    exp: [1, 2],
    drops: [{ id: 'rat_tail', chance: 1 }],
    special: { id: 'gnawed_ring', chance: 0.01 },
    behavior: 'aggressive', speed: 3, sight: 3.5, fov: 140, attackRange: 0.9, windup: 0.5, cooldown: 1.5,
    rank: 'G-', sprite: 'm_rat', scale: 0.85, attack: 'melee', radius: 0.28,
    desc: 'Haldor\'un ahırında arpa çuvallarını kemiren semiz fareler. Kuyrukları lonca için kanıt.',
  },
  {
    id: 'field_rat', name: 'Tarla Faresi', levels: [0, 0], statsByLevel: { 0: {} },
    hpByLevel: { 0: 3 }, natural: { name: 'Isırık', dmg: [1, 2] }, naturalDef: 0,
    exp: [2, 3],
    drops: [{ id: 'rat_tail', chance: 0.85 }, { id: 'small_stone', chance: 0.06 }],
    special: { id: 'gnawed_ring', chance: 0.015 },
    behavior: 'aggressive', speed: 3.3, sight: 4.5, fov: 150, attackRange: 0.95, windup: 0.5, cooldown: 1.4,
    rank: 'G', sprite: 'm_rat', scale: 1.2, attack: 'melee', radius: 0.34,
    desc: 'Tarlalarda ve otlaklarda sürüyle dolaşan, kedi iriliğinde fareler. Ekini de kuzuyu da ısırır.',
  },
  {
    id: 'giant_rat', name: 'Dev Fare', levels: [1, 1], statsByLevel: { 1: { STR: 2, VIT: 2, AGI: 1 } },
    hpByLevel: { 1: 4.5 }, natural: { name: 'Kemirme', dmg: [1, 2] }, naturalDef: 1,
    exp: [5, 7],
    drops: [{ id: 'rat_tail', chance: 1 }, { id: 'small_stone', chance: 0.1 }],
    special: { id: 'gnawed_ring', chance: 0.03 },
    behavior: 'pack', speed: 3.4, sight: 5, fov: 160, attackRange: 1, windup: 0.5, cooldown: 1.3,
    rank: 'G', sprite: 'm_rat', scale: 1.55, attack: 'melee', radius: 0.42,
    desc: 'Değirmen bodrumunun karanlığında un çuvallarıyla şişmiş, köpek iriliğinde fareler.',
  },
  {
    id: 'slime', name: 'Sümüksü', levels: [0, 1], statsByLevel: { 0: {}, 1: { STR: 2, INT: 2 } },
    hpByLevel: { 0: 3, 1: 4.5 }, natural: { name: 'Asit Teması', dmg: [1, 1] }, naturalDef: 1,
    exp: [3, 5],
    drops: [{ id: 'slime_jelly', chance: 0.7 }, { id: 'color_core', chance: 0.07 }],
    special: { id: 'slime_gloves', chance: 0.015 },
    behavior: 'slow', speed: 1.1, sight: 3.5, fov: 360, attackRange: 0.9, windup: 0.7, cooldown: 1.8,
    rank: 'G-', sprite: 'm_slime', attack: 'melee', radius: 0.35,
    desc: 'Nemli ağaç diplerinde yaşayan jöle. Yavaştır ama asidi yakar.',
  },
  {
    id: 'rabbit', name: 'Orman Tavşanı', levels: [0, 0], statsByLevel: { 0: {} },
    hpByLevel: { 0: 1.5 }, natural: { name: 'Tekme', dmg: [1, 1] }, naturalDef: 0,
    exp: [1, 1],
    drops: [{ id: 'rabbit_meat', chance: 0.85 }, { id: 'rabbit_pelt', chance: 0.12 }],
    special: { id: 'rabbit_charm', chance: 0.02 },
    // Saldırı değerleri yalnızca köşeye sıkışınca kullanılır.
    behavior: 'flee', speed: 2.8, sight: 4.5, fov: 360, attackRange: 0.8, windup: 0.55, cooldown: 1.8,
    cornered: { after: 8, range: 3, calm: 5, calmRange: 5 },
    rank: 'G-', sprite: 'm_rabbit', attack: 'melee', radius: 0.3,
    desc: 'Ürkek ve çevik. Saldırmaz ama yakalamak zordur. Köşeye sıkışırsa tekme atar.',
  },
  {
    id: 'wolf', name: 'Yaban Kurdu', levels: [1, 2],
    statsByLevel: { 1: { STR: 1, AGI: 2, VIT: 1 }, 2: { STR: 2, AGI: 4, VIT: 2 } },
    hpByLevel: { 1: 9, 2: 13.5 }, natural: { name: 'Isırık', dmg: [1, 2] }, naturalDef: 1,
    exp: [8, 15],
    drops: [{ id: 'wolf_pelt', chance: 0.55 }, { id: 'wolf_fang', chance: 0.35 }],
    special: { id: 'wolf_fang_necklace', chance: 0.015 },
    behavior: 'pack', speed: 3.6, sight: 6, fov: 160, attackRange: 1.1, windup: 0.5, cooldown: 1.6,
    rank: 'G+', sprite: 'm_wolf', attack: 'melee', radius: 0.45,
    desc: 'Ormanın ortasında sürü hâlinde dolaşır. Biri saldırınca hepsi gelir.',
  },
  {
    id: 'goblin', name: 'Goblin', levels: [1, 2],
    statsByLevel: { 1: { STR: 2, AGI: 1, VIT: 1 }, 2: { STR: 4, AGI: 3, VIT: 1 } },
    hpByLevel: { 1: 7.5, 2: 10.5 }, natural: { name: 'Paslı Bıçak', dmg: [1, 3] }, naturalDef: 1,
    exp: [15, 30],
    drops: [{ id: 'goblin_ear', chance: 0.65 }, { id: 'goblin_trinket', chance: 0.2 }],
    special: { id: 'goblin_cleaver', chance: 0.02 },
    money: [1, 6, 0.5],
    behavior: 'aggressive', speed: 2.9, sight: 5.5, fov: 150, attackRange: 1.0, windup: 0.55, cooldown: 1.5,
    rank: 'G+', sprite: 'm_goblin', attack: 'melee', radius: 0.38, gender: 'Erkek',
    desc: 'Ormanın derinliklerindeki kampta yaşayan, kurnaz ve açgözlü yaratıklar.',
  },
  {
    id: 'goblin_shaman', name: 'Goblin Şamanı', levels: [2, 2],
    statsByLevel: { 2: { INT: 7, VIT: 1 } },
    hpByLevel: { 2: 6 }, natural: { name: 'Ateş Kıvılcımı', dmg: [2, 3] }, naturalDef: 0,
    exp: [25, 32],
    drops: [{ id: 'goblin_ear', chance: 0.7 }, { id: 'herb', chance: 0.4, qty: [1, 2] }],
    // 0.10.0 (B17): Kıvılcım Parşömeni kalktı (skill yalnızca Sistem Teklifi ile); yerine nadir mana iksiri
    special: { id: 'mp_potion_s', chance: 0.06 },
    money: [2, 8, 0.6],
    behavior: 'caster', speed: 2.4, sight: 6.5, fov: 170, attackRange: 5, windup: 0.8, cooldown: 2.6,
    rank: 'F-', sprite: 'm_goblin_shaman', attack: 'bolt', radius: 0.38, gender: 'Kadın',
    desc: 'Kemik takılar takmış, kıvılcım fırlatan goblin.',
  },
  {
    id: 'goblin_chief', name: 'Goblin Şefi', levels: [3, 3],
    statsByLevel: { 3: { STR: 6, VIT: 3, AGI: 3 } },
    hpByLevel: { 3: 22.5 }, natural: { name: 'Çivili Sopa', dmg: [2, 5] }, naturalDef: 3,
    exp: [55, 65],
    drops: [{ id: 'chief_tusk', chance: 1 }, { id: 'map_forest_deep', chance: 1 }, { id: 'goblin_trinket', chance: 1, qty: [2, 3] }],
    special: { id: 'goblin_cleaver', chance: 0.2 },
    money: [20, 45, 1],
    behavior: 'boss', speed: 2.6, sight: 7, fov: 200, attackRange: 1.3, windup: 0.75, cooldown: 1.7,
    rank: 'F+', sprite: 'm_goblin_chief', attack: 'melee', radius: 0.5, boss: true,
    title: 'goblin_chief_title', gender: 'Erkek', scale: 1.15,
    desc: 'Goblin kampının iri ve öfkeli şefi.',
  },
];

export const MONSTERS: Record<string, MonsterDef> = Object.fromEntries(list.map((m) => [m.id, m]));

/** Yaratığın alt kademeli rütbesi (SubRank). */
export function monsterRank(d: MonsterDef): SubRank {
  return parseSubRank(d.rank);
}
