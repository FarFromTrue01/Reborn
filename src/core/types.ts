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
  type: 'heal' | 'mana' | 'stamina' | 'cure' | 'regen';
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
  /** B13: yiyecek Tokluk verir (0–100). */
  satiety?: number;
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

export type SkillRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'innate';

/** Hasar/menzil/hız türü anahtarları: silah türleri, 'any' ve büyü elementleri. */
export type DmgKind = WeaponType | 'any' | 'fire' | 'spell' | 'ice' | 'lightning';
export type KindMap = Partial<Record<DmgKind, number>>;

/**
 * Skill pasifi (0.9.0). Tablolar o rütbedeki TOPLAM değeri yazar; mergedPassive alan alan birleştirir.
 * Sayılar ve eşlem değerleri ara kademelerde bir sonraki kilometre taşına doğru üçte bir ilerler; bayraklar ilerlemez.
 */
export interface SkillPassive {
  stats?: Partial<Stats>;
  /** Hasar çarpanı türe göre (ör. kılıç hasarı +%15 → { sword: 0.15 }). */
  dmg?: KindMap;
  /** Kritik şansı (silah türüne göre). */
  crit?: KindMap;
  /** Saldırı hızı (silah türüne göre). */
  atkSpd?: KindMap;
  /** Saldırıların dayanıklılık maliyeti (silah türüne göre, -0.1 = -%10). */
  atkStamina?: KindMap;
  /** Menzil (mızrak erişimi, yay menzili). */
  range?: KindMap;
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
  runCostPct?: number;
  // ---- Gizlilik
  noticeDelay?: number;
  shadow?: boolean;
  ghost?: boolean;
  // ---- Kaçınma
  perfectDodgeStamina?: number;
  critAfterPerfect?: boolean;
  freeDodge?: boolean;
  // ---- Okçuluk
  arrowSpeedPct?: number;
  stillBowPct?: number;
  // ---- İlk Yardım
  bandageTimePct?: number;
  afterCombatRegen?: boolean;
  debuffDurPct?: number;
  healShare?: number;
  secondWind?: boolean;
  // ---- Atletizm
  staminaRegenPct?: number;
  freeRun?: boolean;
  // ---- Toplayıcılık
  rareGatherPct?: number;
  gatherTimePct?: number;
  gatherExtra2?: number;
  regrowHalf?: boolean;
  // ---- skill'in kendi teknikleri için
  /** Bu skill'in tekniklerinin MP'si (-0.3 = -%30). */
  mpPct?: number;
  /** Bu skill'in tekniklerinin bekleme çarpanı (0.5 = yarıya). */
  cdMult?: number;
  /** Bu skill'in tekniklerinin menzili. */
  techRangePct?: number;
  // ---- Kılıç
  comboFinisher?: number;
  // ---- Ateş
  burnDur?: number;
  burnMult?: number;
  // ---- Şifa
  healParty?: boolean;
  curseBreak?: boolean;
  // ---- Buz
  slowPct?: number;
  slowMult?: number;
  freezeRadiusMult?: number;
  freezeDur?: number;
  frozenDmgMult?: number;
  // ---- Savaş Narası
  allyDmgBuff?: number;
  allyDefBuff?: number;
  shoutRadiusPct?: number;
  shoutAtkSpd?: number;
  fearLow?: boolean;
  staggerDur?: number;
  // ---- Fırtına Kılıcı
  windWaves?: number;
  deflect?: number;
  windOnHit?: boolean;
  // ---- Yıldırım
  chain?: number;
  paralyzeChance?: number;
  chainAll?: boolean;
  // ---- Demir Beden
  stunDurPct?: number;
  noKnockback?: boolean;
  dmgTakenPct?: number;
  deathGuard?: boolean;
}

export interface TechniqueDef {
  id: string;
  name: string;
  desc: string;
  /** Hesaplanır (core/skills techniqueMp); veride 0. */
  mp: number;
  cooldown: number; // saniye
  kind: 'melee_multi' | 'projectile' | 'aoe' | 'heal' | 'parry' | 'buff' | 'dash' | 'lunge' | 'sweep' | 'shield' | 'cleanse' | 'shout' | 'taunt';
  /** Hasar tabanı (büyüler) ya da normal vuruşa çarpan (fiziksel). */
  power: number;
  hits?: number;
  element?: 'fire' | 'physical' | 'holy' | 'heal' | 'wind' | 'lightning' | 'ice';
  radius?: number;
  range?: number;
  duration?: number;
  weapon?: WeaponType;
  /** Kıvılcım gibi dünya ile etkileşim (meşale/ot yakma). */
  ignites?: boolean;
  /** Büyü temelli: MP ×2 (0.9.0, S4). */
  spell?: boolean;
  /** Fiziksel mermi/alan (normal vuruşun katı; Rüzgâr Kesiği, Gök Yaran). */
  physical?: boolean;
  /** Alan yeteneği kullanıcının çevresinde (Cehennem Çemberi, Donduran Halka). */
  self?: boolean;
  /** Mermi sıradaki tüm düşmanları deler. */
  pierce?: boolean;
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
  /** Canavarlar için doğrudan max HP (0.10.0: level başına tablo, stat formülünden türetilmez). */
  hpFixed?: number;
  /** Canavarlar için doğal silah (ısırık, pençe). */
  natural?: { name: string; dmg: [number, number] };
  /** Canavarlar için doğal zırh. */
  naturalDef?: number;
}

export type { Letter, SubRank, Stats, StatKey };
