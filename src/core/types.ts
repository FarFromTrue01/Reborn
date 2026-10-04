import type { Letter, SubRank } from './ranks';
import type { Stats, StatKey } from './formulas';

export const EQUIP_SLOTS = [
  'weapon',
  'helmet',
  'chest',
  'gloves',
  'belt',
  'pants',
  'boots',
  'cape',
  'necklace',
  'ring1',
  'ring2',
] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];

export const EQUIP_SLOT_NAMES: Record<EquipSlot, string> = {
  weapon: 'Silah',
  helmet: 'Kask',
  chest: 'Göğüs Zırhı',
  gloves: 'Eldiven',
  belt: 'Kemer',
  pants: 'Pantolon',
  boots: 'Bot',
  cape: 'Pelerin',
  necklace: 'Kolye',
  ring1: 'Yüzük I',
  ring2: 'Yüzük II',
};

export type ItemKind = 'weapon' | 'armor' | 'material' | 'consumable' | 'quest' | 'book' | 'junk' | 'food';
export type WeaponType = 'sword' | 'dagger' | 'spear' | 'bow' | 'club' | 'staff';

export interface ItemEffect {
  type: 'heal' | 'mana' | 'stamina' | 'learnSkill' | 'cure' | 'regen';
  amount?: number;
  skill?: string;
  duration?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  /** Kuşanılabilir eşyanın slot türü; yüzükler 'ring'. */
  slot?: Exclude<EquipSlot, 'ring1' | 'ring2'> | 'ring';
  /** Eşya rütbesi (alt kademesiz harf). Kuşanılabilir eşyalarda ve malzemelerde zorunlu (tests/systems.test.ts). */
  rank?: Letter;
  /** Saygınlık katkısı (C1): kaliteli eşya artı, paçavra eksi. Yalnızca kuşanılınca sayılır. */
  saygınlık?: number;
  /** Bronz cinsinden alış fiyatı (dükkân). */
  price: number;
  /** Tüccarın ödediği sabit tutar (malzemeler için). Yoksa fiyatın %30–40'ı. */
  sell?: number;
  dmg?: [number, number];
  weaponType?: WeaponType;
  def?: number;
  stats?: Partial<Stats>;
  hpFlat?: number;
  effects?: ItemEffect[];
  /** Özel efekt açıklaması (görsel). */
  special?: string;
  desc: string;
  icon: string;
  /** Joseph'in üzerinde görünecek LPC katmanı (manifest anahtarı). */
  visual?: string;
  stack?: boolean;
  /** Satılamaz / atılamaz. */
  bound?: boolean;
}

export type SkillRarity = 'common' | 'rare' | 'legendary' | 'innate';

export interface SkillPassive {
  stats?: Partial<Stats>;
  /** Hasar çarpanı (ör. kılıç hasarı +%15 → {weapon:'sword', pct:0.15}). */
  damagePct?: { weapon?: WeaponType | 'any' | 'fire' | 'spell'; pct: number };
  staminaFlat?: number;
  hpPct?: number;
  dodgeWindowPct?: number;
  dodgeCostPct?: number;
  detectionPct?: number;
  sneakMult?: number;
  healPct?: number;
  regenPct?: number;
  gatherBonus?: number;
  areaPct?: number;
  reachPct?: number;
  runCostPct?: number;
  /** Daha temiz animasyon (Kılıç Ustalığı G–E). */
  cleanAnim?: boolean;
}

export interface TechniqueDef {
  id: string;
  name: string;
  desc: string;
  mp: number;
  cooldown: number; // saniye
  kind: 'melee_multi' | 'projectile' | 'cone' | 'aoe' | 'wall' | 'heal' | 'counter' | 'buff' | 'dash';
  /** Hasar tabanı (büyüler) ya da silah hasarına çarpan (fiziksel). */
  power: number;
  hits?: number;
  element?: 'fire' | 'physical' | 'holy' | 'heal' | 'wind' | 'lightning';
  radius?: number;
  range?: number;
  duration?: number;
  weapon?: WeaponType;
  /** Kıvılcım gibi dünya ile etkileşim (meşale/ot yakma). */
  ignites?: boolean;
}

export interface SkillTier {
  /** Bu kademeye ulaşınca açılan. */
  at: string; // ör. 'D-'
  passive?: SkillPassive;
  technique?: string; // TechniqueDef id
  awakening?: boolean;
  note: string;
}

export interface SkillDef {
  id: string;
  name: string;
  rarity: SkillRarity;
  desc: string;
  tiers: SkillTier[];
  /** Bu skill'in kullanım EXP'si için ilgili silah türü. */
  weapon?: WeaponType;
  icon: string;
}

export interface SkillState {
  id: string;
  rank: SubRank;
  exp: number;
}

export interface TitleDef {
  id: string;
  name: string;
  rank: Letter;
  desc: string;
  bonus: {
    stats?: Partial<Stats>;
    hpPct?: number;
    damagePct?: number;
    expPct?: number;
  };
}

export type Race = 'İnsan' | 'Elf' | 'Cüce' | 'Beastkin' | 'Demonborn' | 'Canavar';

export interface CreatureData {
  id: string;
  name: string;
  race: Race | string;
  gender: string;
  age: number | null;
  level: number;
  exp: number;
  /** Level'dan gelen ve dağıtılmış statlar. */
  alloc: Stats;
  unspent: number;
  sp: number;
  hp: number;
  mp: number;
  skills: SkillState[];
  traits: string[];
  titles: string[];
  equipment: Partial<Record<EquipSlot, string>>;
  inventory: Record<string, number>;
  guildRank: SubRank | null;
  /** Canavarlar için türe özgü HP değiştiricisi (bonuslar). */
  hpMod?: { flat: number; mult: number };
  /** Canavarlar için doğal silah (ısırık, pençe). */
  natural?: { name: string; dmg: [number, number] };
  /** Canavarlar için doğal zırh. */
  naturalDef?: number;
}

export type { Letter, SubRank, Stats, StatKey };
