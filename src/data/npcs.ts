// NPC'ler: stat blokları (Appraisal için), ses profili, kişilik, günlük program ve replikler.
import { zeroStats, addStats, type Stats } from '../core/formulas';
import { parseSubRank } from '../core/ranks';
import type { CreatureData } from '../core/types';

export type Personality = 'kind' | 'rude' | 'neutral' | 'gossip' | 'proud' | 'shy' | 'drunk' | 'wise';

/**
 * Kast sırası: soylular → yüksek rütbeli maceracılar → tüccar ve zanaatkârlar → köylüler → köksüzler.
 * Joseph her zaman en alttadır (köksüz), lonca kartı olsa bile.
 */
export type Caste = 'noble' | 'elite' | 'burgher' | 'commoner' | 'rootless';
export const CASTE_RANK: Record<Caste, number> = { noble: 5, elite: 4, burgher: 3, commoner: 2, rootless: 1 };
export const CASTE_NAMES: Record<Caste, string> = {
  noble: 'Soylu', elite: 'Yüksek rütbeli maceracı', burgher: 'Tüccar / zanaatkâr', commoner: 'Köylü', rootless: 'Köksüz',
};

/** Joseph'in toplumdaki görünümü (kast). */
export type JosephStatus = 'naked' | 'rootless' | 'adventurer';

export interface ScheduleEntry {
  from: number; // saat
  to: number;
  map: string; // 'world' | iç mekân id | 'hidden'
  at: string | [number, number]; // nokta adı veya karo
  wander?: number;
  act?: 'work' | 'sit' | 'talk' | 'patrol' | 'sleep' | 'drink';
  patrol?: [number, number][];
  /** Sadece haftanın bu günlerinde (0 = Ay Günü … 6 = Güneş Günü). */
  days?: number[];
}

export interface NpcDef {
  id: string;
  name: string;
  sheet: string;
  voice: string;
  portrait: string; // portre kimliği
  personality: Personality;
  creature: CreatureData;
  guildLabel?: string; // lonca rütbesi yerine görünen (ör. Görevli)
  schedule: ScheduleEntry[];
  /** Kast durumuna göre balon replikleri. */
  bubbles: Partial<Record<JosephStatus | 'any' | 'night', string[]>>;
  /** Konuşunca söyledikleri (kısa). */
  talk: Partial<Record<JosephStatus | 'any', string[]>>;
  role?: 'shop' | 'smith' | 'healer' | 'inn' | 'guild' | 'teacher' | 'guard';
  speed?: number;
  caste: Caste;
  /** Kastın ötesinde itibar (ör. varlıklı tüccar = 4). Yoksa kast sırası. */
  prestige?: number;
  /** Sahibi olduğu dükkân (data/shops). */
  shop?: string;
}

export function prestigeOf(n: NpcDef): number {
  return n.prestige ?? CASTE_RANK[n.caste];
}

/**
 * Kasta göre ek balon replikleri: NPC'nin kendi replikleri yetmezse ya da araya karışsın diye.
 * Üst kastlar küçümser, iyi huylular bile mesafeyi korur.
 */
export const CASTE_BUBBLES: Record<Caste, Partial<Record<JosephStatus, string[]>>> = {
  noble: {
    naked: ['Muhafız! Bu yaratık neden yolda?', '(Burnunu mendille kapatıyor.)'],
    rootless: ['Çekil önümden, köksüz.', '(Seni görmüyor bile.)', 'Bu köy de artık kimi kabul ediyor böyle.'],
    adventurer: ['G- bir kart... Köksüz bir köpeğe tasma takmışlar.', 'Yolu aç, maceracı. Ya da ne dersen.'],
  },
  elite: {
    naked: ['Hah. Ormanın çıkardığı en komik şey.'],
    rootless: ['Ayağımın altında dolaşma, çaylak.', 'Bulaşıkçı. Masamı sil, sonra kaybol.'],
    adventurer: ['G-... İlk kışını çıkarırsan konuşuruz.', 'Kartını göğsünde değil, kılıcında taşı.'],
  },
  burgher: {
    naked: ['Dükkânımın önünden uzak dur!'],
    rootless: ['Paran varsa müşterisin. Yoksa köksüzsün.', 'Veresiye yok, köksüze hiç yok.'],
    adventurer: ['Maceracıymış... Peşin öde, yeter.'],
  },
  commoner: {
    naked: ['Kim bu?', 'Utanmaz!'],
    rootless: ['Köksüz... Hangi köyden kovdular seni?', 'Bizden değil o.'],
    adventurer: ['Köksüz maceracı. O da bir şey.'],
  },
  rootless: {
    naked: ['Hoş geldin aşağıya, kardeş.'],
    rootless: ['Sen de mi köksüzsün? Başını eğ, gözünü aç.', 'Kimse bize bakmaz. Bazen iyidir bu.'],
    adventurer: ['Kart almışsın. Yine de bizden birisin, unutma.'],
  },
};

function creature(id: string, name: string, race: string, gender: string, age: number, level: number, stats: Partial<Stats>, opts: Omit<Partial<CreatureData>, 'skills'> & { appraisal?: string; skills?: [string, string, number?][] } = {}): CreatureData {
  const skills = [{ id: 'appraisal', rank: parseSubRank(opts.appraisal ?? 'G-'), exp: 0 }];
  for (const [sid, r, e] of opts.skills ?? []) skills.push({ id: sid, rank: parseSubRank(r), exp: e ?? 0 });
  return {
    id, name, race, gender, age, level, exp: 0,
    alloc: addStats(zeroStats(), stats),
    unspent: 0, sp: 0, hp: 1, mp: 0,
    skills,
    traits: opts.traits ?? [],
    titles: opts.titles ?? [],
    equipment: opts.equipment ?? {},
    inventory: opts.inventory ?? {},
    guildRank: opts.guildRank ?? null,
  };
}

const always = (map: string, at: string | [number, number], wander = 0, act: ScheduleEntry['act'] = 'work'): ScheduleEntry[] => [{ from: 0, to: 24, map, at, wander, act }];

export const NPCS: NpcDef[] = [
  // ======================================================================= ANA KARAKTERLER
  {
    id: 'bertram', name: 'Bertram', sheet: 'bertram', voice: 'bertram', portrait: 'bertram', personality: 'neutral', caste: 'burgher', shop: 'inn', role: 'inn',
    creature: creature('bertram', 'Bertram', 'İnsan', 'Erkek', 54, 9, { STR: 12, VIT: 10, AGI: 3, DEX: 7, INT: 2, LUK: 2 }, {
      appraisal: 'F', skills: [['sword_mastery', 'E+'], ['first_aid', 'F'], ['athletics', 'F-']], titles: ['npc_retired'],
      guildRank: parseSubRank('E'), traits: ['iron_liver'], equipment: { pants: 'linen_pants', boots: 'leather_boots' },
      inventory: { bread: 12, hot_stew: 6, rabbit_meat: 3 },
    }),
    guildLabel: 'E (emekli)',
    schedule: [{ from: 5, to: 24, map: 'inn', at: 'bertram', act: 'work' }, { from: 0, to: 5, map: 'hidden', at: 'bertram' }],
    bubbles: {
      any: ['Bira döküldü, biri silsin şunu!', 'Güveç ocakta. Kaşıklar nerede?', 'Bacağım yine sızlıyor. Yağmur gelecek.'],
    },
    talk: {},
  },
  {
    id: 'vera', name: 'Vera', sheet: 'vera', voice: 'vera', portrait: 'vera', personality: 'proud', caste: 'commoner',
    creature: creature('vera', 'Vera', 'İnsan', 'Kadın', 19, 3, { STR: 5, VIT: 3, AGI: 2, DEX: 2 }, {
      appraisal: 'F-', skills: [['sword_mastery', 'G+', 9], ['athletics', 'G', 4]], titles: ['npc_redblade'], guildRank: parseSubRank('F-'),
      equipment: { weapon: 'iron_shortsword', chest: 'leather_vest', pants: 'sturdy_pants', boots: 'leather_boots' },
      inventory: { hp_potion_s: 2, bread: 1 }, traits: ['silver_tongue'],
    }),
    schedule: [
      { from: 8, to: 12, map: 'inn', at: 'table_vera', act: 'sit' },
      { from: 12, to: 17, map: 'guild', at: 'vera', act: 'talk' },
      { from: 17, to: 23, map: 'inn', at: 'table_vera', act: 'drink' },
      { from: 23, to: 8, map: 'hidden', at: 'table_vera' },
    ],
    bubbles: {
      naked: ['Bak bak, çıplak kahraman geliyor!', 'Lina, kapat gözlerini!', 'Şortun da mı çalındı, yoksa moda mı?'],
      rootless: ['Bulaşıkçı! Tabaklar parlıyor mu?', 'Giyinmişsin bile. Gelişiyorsun.'],
      adventurer: ['G- maceracı! Fareler titresin!', 'Kartını çerçeveletecek misin?'],
    },
    talk: {
      naked: ['Ne bakıyorsun? Gözlerimi yıkamam gerekecek.'],
      rootless: ['Bulaşık suyu gibi kokuyorsun. Uzak dur.', 'Han senin evin artık, ha? Ne romantik.'],
      adventurer: ['G- ha? Ben de ilk gün F-\'ydim. Fark ediyor mu? Ediyor.', 'Bir fareyi tek başına yendiğinde bize haber ver. Kutlarız.'],
    },
  },
  {
    id: 'lina', name: 'Lina', sheet: 'lina', voice: 'lina', portrait: 'lina', personality: 'gossip', caste: 'commoner',
    creature: creature('lina', 'Lina', 'Beastkin (Kedi Soylu)', 'Kadın', 18, 3, { DEX: 5, AGI: 4, VIT: 2, LUK: 1 }, {
      appraisal: 'F-', skills: [['archery', 'G+', 11], ['stealth', 'G', 6]], titles: ['npc_sharpeye'], guildRank: parseSubRank('F-'),
      equipment: { weapon: 'hunter_bow', chest: 'leather_vest', pants: 'linen_pants', boots: 'leather_boots' },
      inventory: { apple: 3, rabbit_pelt: 1 }, traits: ['keen_ears'],
    }),
    schedule: [
      { from: 8, to: 12, map: 'inn', at: 'table_lina', act: 'sit' },
      { from: 12, to: 17, map: 'guild', at: 'lina', act: 'talk' },
      { from: 17, to: 23, map: 'inn', at: 'table_lina', act: 'drink' },
      { from: 23, to: 8, map: 'hidden', at: 'table_lina' },
    ],
    bubbles: {
      naked: ['Hihihi!', 'Vera, bak, bak! Hihi!', 'Kuyruğumu bile daha çok örtüyor!'],
      rootless: ['Hihi, bulaşıkçı!', 'Kulaklarım her şeyi duyar, haberin olsun~'],
      adventurer: ['Hihi, G-! Tavşanlar dikkat!', 'Kartın parlıyor mu? Hihi.'],
    },
    talk: {
      naked: ['Hihi! Vera haklıymış, tam bir haydut kurbanı!'],
      rootless: ['Hihi! Vera senin için "bulaşık prensi" diyor. Ben de diyorum!'],
      adventurer: ['Hihi! Dikkat et, ormanda tavşanlar bile ısırır! ...Şaka şaka. Fareler ısırır.'],
    },
  },
  {
    id: 'celeste', name: 'Celeste', sheet: 'celeste', voice: 'celeste', portrait: 'celeste', personality: 'proud', caste: 'burgher', role: 'guild',
    creature: creature('celeste', 'Celeste', 'İnsan', 'Kadın', 22, 4, { INT: 6, MNA: 4, DEX: 3, AGI: 3 }, {
      appraisal: 'E', skills: [['first_aid', 'F-']], titles: ['npc_reader'], equipment: { boots: 'cloth_shoes', necklace: 'rabbit_charm' },
      inventory: { mp_potion_s: 1 },
    }),
    guildLabel: 'Görevli',
    schedule: [{ from: 7, to: 21, map: 'guild', at: 'celeste', act: 'work' }, { from: 21, to: 7, map: 'hidden', at: 'celeste' }],
    bubbles: {
      any: ['Sıradaki.', 'Görev kanıtları tezgâhın üstüne, lütfen.'],
      naked: ['...Kapıyı kapatır mısın? Cereyan yapıyor. Ve... bu manzara.'],
      rootless: ['Köksüzler için kayıt bir gümüş. İndirim yok.', '(Seni görünce kalemini bırakmıyor bile.)'],
    },
    talk: {},
  },

  // ======================================================================= ESNAF
  {
    id: 'smith', name: 'Gunnar', sheet: 'smith', voice: 'gruff', portrait: 'smith', personality: 'neutral', caste: 'burgher', shop: 'smith', role: 'smith',
    creature: creature('smith', 'Gunnar', 'İnsan', 'Erkek', 41, 5, { STR: 9, VIT: 6, DEX: 4, AGI: 1 }, {
      appraisal: 'G+', titles: ['npc_smith'], equipment: { gloves: 'leather_gloves', boots: 'leather_boots' }, inventory: { firewood: 8 },
    }),
    schedule: [
      { from: 8, to: 18, map: 'smithy', at: 'smith', act: 'work' },
      { from: 18, to: 22, map: 'inn', at: 'seat_m1', act: 'drink' },
      { from: 22, to: 8, map: 'hidden', at: 'smith' },
    ],
    bubbles: { any: ['Demir sıcakken dövülür.', 'Kömür yine pahalanmış.'], naked: ['Önce bir pantolon al, evlat. Sonra kılıç.'] },
    talk: {
      naked: ['Kılıç mı? Önce pantolon. Kimse yarı çıplak adama silah satmaz.', 'Paran varsa konuşuruz. Yoksa ateşimi soğutma.'],
      rootless: ['Bertram\'ın yanında çalıştığını duydum. İyi adamdır. Paran olunca gel.', 'Köksüze kılıç satarım, ama önce parayı tezgâha koyarsın.'],
      adventurer: ['Lonca kartı, ha. Şimdi doğru düzgün bir silaha ihtiyacın var.'],
    },
  },
  {
    id: 'shopkeeper', name: 'Marta', sheet: 'shopkeeper', voice: 'female', portrait: 'shopkeeper', personality: 'neutral', caste: 'burgher', shop: 'shop', role: 'shop',
    creature: creature('shopkeeper', 'Marta', 'İnsan', 'Kadın', 36, 2, { INT: 3, LUK: 3, DEX: 2 }, { appraisal: 'G+', equipment: { ring1: 'copper_ring' } }),
    schedule: [
      { from: 8, to: 19, map: 'shop', at: 'shopkeeper', act: 'work' },
      { from: 19, to: 21, map: 'world', at: [97, 60], wander: 2, act: 'talk' },
      { from: 21, to: 8, map: 'hidden', at: 'shopkeeper' },
    ],
    bubbles: { any: ['Taze ekmek, ucuz sargı!', 'İp, mum, tuz... ne lazımsa.'], naked: ['Aman! Dükkânıma öyle girme!'] },
    talk: {
      naked: ['Önce üstüne bir şey giy, sonra konuşalım. Müşterilerim kaçıyor.'],
      rootless: ['Köksüzlere veresiye yok. Peşin para, peşin mal.', 'Ne lazımsa var. Paran kadar tabii.'],
      adventurer: ['G- kartla indirim mi? Hah. Peşin öde, evlat.', 'Ne lazımsa var. Paran kadar tabii.'],
    },
  },
  {
    id: 'healer', name: 'Ilse Nine', sheet: 'healer', voice: 'female_old', portrait: 'healer', personality: 'kind', caste: 'burgher', shop: 'healer', role: 'healer',
    creature: creature('healer', 'Ilse', 'İnsan', 'Kadın', 67, 6, { INT: 8, MNA: 8, VIT: 4, LUK: 4 }, {
      appraisal: 'F', skills: [['healing_magic', 'E-'], ['first_aid', 'D-'], ['gathering', 'E']], inventory: { herb: 20, hp_potion_s: 5 },
    }),
    schedule: [
      { from: 9, to: 17, map: 'healer', at: 'healer', act: 'work' },
      { from: 17, to: 20, map: 'world', at: [117, 73], wander: 2, act: 'work' },
      { from: 20, to: 9, map: 'hidden', at: 'healer' },
    ],
    bubbles: { any: ['Bu otlar kendiliğinden kurumaz.', 'Rüzgâr değişti. Öksürük mevsimi.'], naked: ['Üşüteceksin evladım, bir şey giy.'] },
    talk: {
      naked: ['Vah yavrum, kimdir seni bu hâle koyan? Gel, şu çizikleri bir göreyim. ...Bedava, merak etme. Bu sefer.'],
      any: ['Yaralıysan otur. Paran yoksa da otur, sonra konuşuruz.', 'Ormanda şifalı ot görürsen topla. Ben alırım.'],
    },
  },
  {
    id: 'hunter', name: 'Garrick', sheet: 'hunter', voice: 'male', portrait: 'hunter', personality: 'shy', caste: 'commoner', shop: 'lodge', role: 'teacher',
    creature: creature('hunter', 'Garrick', 'İnsan', 'Erkek', 33, 6, { DEX: 9, AGI: 7, STR: 3, LUK: 5 }, {
      appraisal: 'G+', skills: [['archery', 'E'], ['stealth', 'F'], ['gathering', 'F']], guildRank: parseSubRank('F+'),
      equipment: { weapon: 'hunter_bow', chest: 'leather_vest', boots: 'leather_boots' }, inventory: { rabbit_pelt: 4, wolf_pelt: 1 },
    }),
    schedule: [
      { from: 6, to: 12, map: 'world', at: [73, 52], wander: 3, act: 'work' },
      { from: 12, to: 18, map: 'lodge', at: 'hunter', act: 'work' },
      { from: 18, to: 23, map: 'inn', at: 'seat_m6', act: 'drink' },
      { from: 23, to: 6, map: 'hidden', at: [73, 52] },
    ],
    bubbles: { any: ['Rüzgâra karşı yaklaş. Hep rüzgâra karşı.', 'Kurtlar bu yıl erken indi.'], naked: ['...Ormanda öyle dolaşma. Sivrisinekler yer seni.'] },
    talk: {
      any: ['Kurtlar sürüyle gezer. Birini görürsen, üçünü say.', 'Goblinler derin ormanda kamp kurmuş. Oraya tek başına gitme.'],
    },
  },

  // ======================================================================= MUHAFIZLAR
  {
    id: 'guard_hob', name: 'Muhafız Hob', sheet: 'guard', voice: 'male', portrait: 'guard', personality: 'neutral', caste: 'burgher', role: 'guard',
    creature: creature('guard_hob', 'Hob', 'İnsan', 'Erkek', 29, 4, { STR: 5, VIT: 6, AGI: 3, DEX: 2 }, {
      appraisal: 'G', skills: [['spear_mastery', 'G+']], titles: ['npc_watch'], equipment: { weapon: 'iron_spear', helmet: 'iron_cap', chest: 'padded_armor', boots: 'leather_boots' },
    }),
    schedule: [
      { from: 6, to: 22, map: 'world', at: [80, 57], act: 'patrol', patrol: [[70, 58], [88, 58], [95, 52], [102, 58], [124, 57], [102, 63], [92, 72]] },
      { from: 22, to: 6, map: 'hidden', at: [80, 57] },
    ],
    bubbles: {
      naked: ['Hey sen! Köyde böyle dolaşılmaz!', 'Haydutlar mı soydu? Kayıt tutmam lazım...'],
      rootless: ['Sorun çıkarma, yeter.', 'Han çalışanı, ha? İyi. Göz önündesin.'],
      adventurer: ['Maceracı! Ormandaki kurtlara dikkat.', 'Lonca kartın var, değil mi? Güzel.'],
      night: ['Gece geç oldu. Evine git.'],
    },
    talk: {
      naked: ['Haydutlar mı soydu seni? Şikâyetini karakola... dur, önce bir şey giy. Öyle ifade alınmaz.'],
      rootless: ['Gözüm üzerinde, köksüz. Ama dürüst çalışana lafım yok.'],
      adventurer: ['Kuzeydeki şehre gitmek mi? Kartın G- ise kaptan seni geçirmez. Geçiş ücreti de yüksek.'],
    },
  },
  {
    id: 'guard_wil', name: 'Muhafız Wilmer', sheet: 'guard2', voice: 'gruff', portrait: 'guard2', personality: 'rude', caste: 'burgher', role: 'guard',
    creature: creature('guard_wil', 'Wilmer', 'İnsan', 'Erkek', 35, 5, { STR: 7, VIT: 6, AGI: 2, DEX: 3, LUK: 2 }, {
      appraisal: 'G', skills: [['spear_mastery', 'F-']], equipment: { weapon: 'iron_spear', helmet: 'iron_cap', chest: 'padded_armor', boots: 'hobnail_boots' },
    }),
    schedule: [
      { from: 0, to: 6, map: 'world', at: [96, 56], act: 'patrol', patrol: [[95, 54], [104, 58], [95, 62], [88, 58]] },
      { from: 6, to: 14, map: 'world', at: [131, 57], wander: 2, act: 'work' },
      { from: 14, to: 18, map: 'world', at: [96, 56], act: 'patrol', patrol: [[95, 54], [104, 58], [95, 62], [88, 58]] },
      { from: 18, to: 24, map: 'world', at: [96, 56], act: 'patrol', patrol: [[95, 54], [104, 58], [95, 62], [88, 58]] },
    ],
    bubbles: {
      naked: ['Köksüz serseri. Defol, çocuklar var burada.', 'Şuna bak. Böcek gibi.'],
      rootless: ['Köksüz yine burada. Bir şey çalarsan kolunu kırarım.', 'Bulaşıkçı. Dilencilikten iyidir.'],
      adventurer: ['G- kart, ha? Benim çizmem senden pahalı.', 'Maceracı olmuş! Güleyim mi ağlayayım mı?'],
      night: ['Gece kimse sokakta dolaşmaz. Hele senin gibisi.'],
    },
    talk: {
      naked: ['Dilenmeye mi geldin? Burada sadaka yok. Yürü.'],
      rootless: ['Ne istiyorsun? Ağzını aç da konuş, köksüz.'],
      adventurer: ['G-... Fare avla da göreyim seni.'],
    },
  },
  {
    id: 'captain', name: 'Kaptan Roderick', sheet: 'gate_captain', voice: 'bertram', portrait: 'captain', personality: 'proud', caste: 'elite',
    creature: creature('captain', 'Roderick', 'İnsan', 'Erkek', 46, 11, { STR: 12, VIT: 14, AGI: 6, DEX: 8, INT: 3, LUK: 1 }, {
      appraisal: 'E-', skills: [['spear_mastery', 'D-'], ['athletics', 'E']], titles: ['npc_watch'], guildRank: parseSubRank('D-'),
      equipment: { weapon: 'iron_spear', helmet: 'iron_cap', chest: 'padded_armor', pants: 'sturdy_pants', boots: 'hobnail_boots' },
    }),
    schedule: always('world', 'checkpoint', 1, 'work'),
    bubbles: { any: ['Geçiş için kart ve ücret.', 'Şehir yolu güvenli değil, ama kurallar kurallardır.'] },
    talk: {},
  },

  // ======================================================================= KÖYLÜLER
  {
    id: 'tobin', name: 'Tobin', sheet: 'farmer_m1', voice: 'male', portrait: 'farmer_m1', personality: 'gossip', caste: 'commoner',
    creature: creature('tobin', 'Tobin', 'İnsan', 'Erkek', 20, 1, { STR: 2, VIT: 2 }),
    schedule: [
      { from: 7, to: 17, map: 'world', at: [104, 26], wander: 4, act: 'work' },
      { from: 17, to: 19, map: 'world', at: [92, 60], wander: 2, act: 'talk' },
      { from: 19, to: 22, map: 'inn', at: 'seat_m5', act: 'drink' },
      { from: 22, to: 7, map: 'hidden', at: [104, 26] },
    ],
    bubbles: {
      naked: ['Duydun mu? Ormandan çıplak biri gelmiş!', 'Haydut mu soydu bunu?', 'Vay be, ne kaslar ama... yok, yok.'],
      rootless: ['Han\'ın yeni bulaşıkçısı bu işte.', 'Bertram herkesi işe alıyor artık.'],
      adventurer: ['Bulaşıkçı maceracı olmuş! Annem inanmayacak.', 'G- de olsa lonca kartı lonca kartıdır.'],
    },
    talk: {
      naked: ['Sen... ormandan mı geldin? Öyle mi? Kurtlar yemedi mi seni? Şanslıymışsın.'],
      rootless: ['Bertram sert adamdır ama hakkını yemez. Benim dayımı da işe almıştı bir zamanlar.'],
      adventurer: ['Maceracı ha! Kuzeydeki şehirde S rütbe kahramanlar varmış, biliyor musun? Ejderha öldürmüşler!'],
    },
  },
  {
    id: 'ulric', name: 'Ulric', sheet: 'farmer_m2', voice: 'gruff', portrait: 'farmer_m2', personality: 'rude', caste: 'commoner',
    creature: creature('ulric', 'Ulric', 'İnsan', 'Erkek', 44, 2, { STR: 4, VIT: 4 }),
    schedule: [
      { from: 6, to: 16, map: 'world', at: [119, 26], wander: 4, act: 'work' },
      { from: 16, to: 19, map: 'world', at: [120, 45], wander: 2, act: 'work' },
      { from: 19, to: 23, map: 'inn', at: 'seat_m7', act: 'drink' },
      { from: 23, to: 6, map: 'hidden', at: [119, 26] },
    ],
    bubbles: {
      naked: ['Köksüz pislik. Tarlama yaklaşma!', 'Bunun ne işi var burada?'],
      rootless: ['Köksüz yine dolaşıyor.', 'Tarlamdan uzak dur, köksüz.'],
      adventurer: ['Kart aldı diye adam olacak sanıyor.'],
    },
    talk: {
      naked: ['Ne var? Ekmek mi istiyorsun? Çalış da ye. Köksüzlere sadaka yok bende.'],
      rootless: ['Bertram\'ın bulaşıkçısı. Ne bakıyorsun?'],
      adventurer: ['Maceracıymış... Tavşanlardan tarlamı koru o zaman, işe yara.'],
    },
  },
  {
    id: 'hilda', name: 'Hilda', sheet: 'farmer_f1', voice: 'female', portrait: 'farmer_f1', personality: 'kind', caste: 'commoner',
    creature: creature('hilda', 'Hilda', 'İnsan', 'Kadın', 31, 1, { VIT: 2, DEX: 2 }),
    schedule: [
      { from: 7, to: 16, map: 'world', at: [84, 93], wander: 4, act: 'work' },
      { from: 16, to: 20, map: 'world', at: [95, 61], wander: 3, act: 'talk' },
      { from: 20, to: 7, map: 'hidden', at: [84, 93] },
    ],
    bubbles: {
      naked: ['Zavallı çocuk... kim yaptı bunu?', 'Üşüyor olmalı.'],
      rootless: ['Hoş geldin, evlat. Bertram\'ın yanında mısın?'],
      adventurer: ['Kendine dikkat et ormanda.'],
    },
    talk: {
      naked: ['Ah, evlat... Al şu elmayı. Hayır, hayır, al. Karnın aç olmalı.'],
      rootless: ['Bertram iyi insandır. Ona sadık ol, o da sana olur.'],
      adventurer: ['Lonca mı? Aman dikkatli ol. Kocam da maceracıydı... neyse. Dikkatli ol.'],
    },
  },
  {
    id: 'greta', name: 'Greta', sheet: 'farmer_f2', voice: 'female', portrait: 'farmer_f2', personality: 'gossip', caste: 'commoner',
    creature: creature('greta', 'Greta', 'İnsan', 'Kadın', 27, 0, {}),
    schedule: [
      { from: 7, to: 12, map: 'world', at: [96, 60], wander: 3, act: 'talk' },
      { from: 12, to: 17, map: 'world', at: [98, 94], wander: 3, act: 'work' },
      { from: 17, to: 21, map: 'world', at: [93, 60], wander: 3, act: 'talk' },
      { from: 21, to: 7, map: 'hidden', at: [96, 60] },
    ],
    bubbles: {
      naked: ['Görmedim, görmedim! ...Gördüm.', 'Kim bu adam? Bunu herkese anlatacağım!'],
      rootless: ['Bertram onu tavan arasına yerleştirmiş, biliyor musun?', 'Vera ona "bulaşık prensi" diyormuş!'],
      adventurer: ['Lonca kartı almış! Celeste parasını iki parmağıyla almış, duydun mu?'],
    },
    talk: {
      naked: ['Hıh! Ben evli bir kadınım! ...Ama yine de, ormandan mı geldin? Anlat bakalım!'],
      rootless: ['Söylesene, hangi köydensin? Kimsin, neyin nesisin? Kimse bilmiyor seni!'],
      adventurer: ['Celeste seni sevmedi galiba. O kimseyi sevmez zaten. Maceracı Dorn hariç! Hihi.'],
    },
  },
  {
    id: 'edwin', name: 'İhtiyar Edwin', sheet: 'elder_m', voice: 'male_old', portrait: 'elder_m', personality: 'wise', caste: 'commoner',
    creature: creature('edwin', 'Edwin', 'İnsan', 'Erkek', 78, 3, { INT: 5, VIT: 2, MNA: 3, LUK: 2 }, { appraisal: 'F-', skills: [['gathering', 'F']] }),
    schedule: [
      { from: 9, to: 12, map: 'world', at: [92, 63], act: 'sit' },
      { from: 12, to: 14, map: 'hidden', at: [92, 63] },
      { from: 14, to: 18, map: 'world', at: [98, 63], act: 'sit' },
      { from: 18, to: 9, map: 'hidden', at: [92, 63] },
    ],
    bubbles: {
      any: ['Gençken ben de...', 'Elonth\'ta herkes sıfırdan başlar. Kral da, fare de.'],
      naked: ['Hm. Gözlerinde başka bir dünyanın tozu var.'],
    },
    talk: {
      any: [
        'Elonth\'ta herkes Level 0 doğar, evlat. Kral da, ejderha da. Gerisi ter ve kandır.',
        'Kuzeydeki surları görüyor musun? Kraliyet şehri. Orada S rütbe kahramanlar var derler. İkisi ya da üçü... Ejderhalarla savaşırlarmış.',
        'Appraisal\'ı herkes bilir ama herkes aynı göremez. Gözün keskinleştikçe dünya açılır.',
        'Trait... Ha, o kelimeyi duydun mu? Kimse kimseninkini bilemez. Taş bile göremez onu.',
        'Gençler sistemi sorar hep. "Neden?" derler. Sistem cevap vermez. Sadece sayar.',
      ],
    },
  },
  {
    id: 'berta', name: 'Berta Nine', sheet: 'elder_f', voice: 'female_old', portrait: 'elder_f', personality: 'rude', caste: 'commoner',
    creature: creature('berta', 'Berta', 'İnsan', 'Kadın', 71, 1, { VIT: 2, INT: 2 }),
    schedule: [
      { from: 8, to: 12, map: 'world', at: [86, 46], wander: 1, act: 'sit' },
      { from: 15, to: 18, map: 'world', at: [96, 64], wander: 1, act: 'sit' },
      { from: 18, to: 8, map: 'hidden', at: [86, 46] },
      { from: 12, to: 15, map: 'hidden', at: [86, 46] },
    ],
    bubbles: {
      naked: ['Ahlaksız! Benim zamanımda...', 'Çık şuradan, utanmaz!'],
      rootless: ['Köksüz. Kesin bir şey çalacak.', 'Bizim zamanımızda köksüzler köye giremezdi.'],
      adventurer: ['Kart almış. Hıh. Herkes maceracı artık.'],
    },
    talk: {
      naked: ['Çekil önümden! Benim gözlerim bunu görmek için mi yaşadı?'],
      rootless: ['Ailen yok, adın yok, paran yok. Ne işin var burada?'],
      adventurer: ['Lonca kartı mı? Babam da maceracıydı. İlk kışında öldü. Hadi git şimdi.'],
    },
  },
  {
    id: 'anna', name: 'Anna', sheet: 'mother', voice: 'female', portrait: 'mother', personality: 'kind', caste: 'commoner',
    creature: creature('anna', 'Anna', 'İnsan', 'Kadın', 29, 0, {}),
    schedule: [
      { from: 9, to: 12, map: 'world', at: [94, 60], wander: 2, act: 'talk' },
      { from: 12, to: 14, map: 'hidden', at: [94, 60] },
      { from: 14, to: 18, map: 'world', at: [93, 59], wander: 2, act: 'talk' },
      { from: 18, to: 9, map: 'hidden', at: [94, 60] },
    ],
    bubbles: {
      naked: ['Pip! Bakma oraya! Kapat gözlerini!', 'Aman Tanrım...'],
      rootless: ['Pip, adamı rahat bırak.'],
      adventurer: ['Maceracı olmuşsun! Pip sana hayran.'],
    },
    talk: {
      naked: ['L-lütfen bir şey giyin! Oğlum burada!'],
      rootless: ['Kusura bakma, Pip seni çok merak ediyor. Bertram\'ın yanında çalıştığın doğru mu?'],
      adventurer: ['Pip de maceracı olmak istiyor şimdi. Sağ ol(!)'],
    },
  },
  {
    id: 'pip', name: 'Pip', sheet: 'child', voice: 'child', portrait: 'child', personality: 'kind', caste: 'commoner', speed: 2.8,
    creature: creature('pip', 'Pip', 'İnsan', 'Erkek', 7, 0, {}),
    schedule: [
      { from: 9, to: 12, map: 'world', at: [95, 61], wander: 3, act: 'talk' },
      { from: 12, to: 14, map: 'hidden', at: [95, 61] },
      { from: 14, to: 18, map: 'world', at: [94, 61], wander: 3, act: 'talk' },
      { from: 18, to: 9, map: 'hidden', at: [95, 61] },
    ],
    bubbles: {
      naked: ['Anne! O adamın pantolonu yok!', 'Anne, göremiyorum!'],
      rootless: ['Bulaşıkçı abi!', 'Abi, kılıç kullanabiliyor musun?'],
      adventurer: ['Maceracı abi! Bana bir ejderha getir!', 'Ben de büyüyünce G- olacağım!'],
    },
    talk: {
      naked: ['Abi neden çıplaksın? Annem bakma dedi ama ben baktım.'],
      rootless: ['Abi, Bertram amca kızınca bacağını vurur, gördün mü? Pat pat!'],
      adventurer: ['Abi! Fare öldürdün mü? Kaç tane? Ben bir tane gördüm, kaçtım.'],
    },
  },
  {
    id: 'fenn', name: 'Sarhoş Fenn', sheet: 'drunk', voice: 'male', portrait: 'drunk', personality: 'drunk', caste: 'commoner',
    creature: creature('fenn', 'Fenn', 'İnsan', 'Erkek', 38, 2, { VIT: 5, LUK: 3 }, { traits: ['iron_liver'] }),
    schedule: [
      { from: 10, to: 16, map: 'world', at: [87, 58], wander: 1, act: 'sit' },
      { from: 16, to: 24, map: 'inn', at: 'seat_m3', act: 'drink' },
      { from: 0, to: 10, map: 'hidden', at: [87, 58] },
    ],
    bubbles: {
      naked: ['Hık! Ben de... ben de bir zamanlar böyleydim!', 'Kardeşim! Sen de mi kaybettin pantolonunu? Hık!'],
      rootless: ['Bulaşıkçı! Bir bira! Hık!', 'Sen iyi çocuksun. Hık. Herkes iyidir.'],
      adventurer: ['Kahramanımız! Bir bira ısmarlar mısın? Hık!'],
    },
    talk: {
      naked: ['Hık! Pantolon dediğin... nedir ki? Bir kumaş. Hık. Biz özgürüz kardeşim!'],
      rootless: ['Bertram\'a söyle... hık... bana veresiye yazsın. Sen söylersen dinler.'],
      adventurer: ['Maceracı! Ben de maceracıydım! Hık. Bir gün. Bir öğleden sonra.'],
    },
  },
  {
    id: 'oswin', name: 'Değirmenci Oswin', sheet: 'miller', voice: 'male_old', portrait: 'miller', personality: 'neutral', caste: 'burgher',
    creature: creature('oswin', 'Oswin', 'İnsan', 'Erkek', 58, 2, { STR: 3, VIT: 3, DEX: 2 }),
    schedule: [
      { from: 6, to: 18, map: 'world', at: [68, 94], wander: 2, act: 'work' },
      { from: 18, to: 22, map: 'inn', at: 'seat_m8', act: 'drink' },
      { from: 22, to: 6, map: 'hidden', at: [68, 94] },
    ],
    bubbles: { any: ['Değirmen taşı aşınmış yine.', 'Fareler ambara dadandı.'] },
    talk: {
      any: ['Değirmenin arkası farelerle dolu. Birisi temizlese iyi olurdu. Para veremem ama teşekkür ederim.'],
    },
  },
  {
    id: 'dorn', name: 'Dorn', sheet: 'adventurer_m', voice: 'male', portrait: 'adventurer_m', personality: 'proud', caste: 'elite',
    creature: creature('dorn', 'Dorn', 'İnsan', 'Erkek', 26, 8, { STR: 10, AGI: 8, DEX: 7, VIT: 6, LUK: 1 }, {
      appraisal: 'F+', skills: [['sword_mastery', 'E'], ['evasion', 'F'], ['athletics', 'E-']], guildRank: parseSubRank('E-'),
      equipment: { weapon: 'iron_shortsword', chest: 'padded_armor', pants: 'sturdy_pants', boots: 'hobnail_boots', cape: 'traveler_cape' },
    }),
    schedule: [
      { from: 9, to: 14, map: 'guild', at: 'adv1', act: 'talk' },
      { from: 14, to: 18, map: 'world', at: [100, 57], wander: 2, act: 'talk' },
      { from: 18, to: 23, map: 'inn', at: 'good_1', act: 'drink' },
      { from: 23, to: 9, map: 'hidden', at: [100, 57] },
    ],
    bubbles: {
      naked: ['Ha! Bu da ne?', 'Haydutlara yakalanmışsın, çaylak.'],
      rootless: ['Bertram\'ın yeni köpeği.'],
      adventurer: ['G-... Ben bir yılda E\'ye çıktım. Sen kaç yılda çıkarsın?'],
    },
    talk: {
      naked: ['Uzak dur benden. Ve Celeste\'den.'],
      rootless: ['Ne istiyorsun, köksüz? Benimle konuşmak için önce bir kartın olsun.'],
      adventurer: ['G- olmanın tek iyi yanı, düşebileceğin daha aşağı bir yer olmaması.'],
    },
  },
  {
    id: 'sira', name: 'Sira', sheet: 'adventurer_f', voice: 'female', portrait: 'adventurer_f', personality: 'shy', caste: 'elite',
    creature: creature('sira', 'Sira', 'Elf', 'Kadın', 112, 12, { INT: 16, MNA: 14, AGI: 8, DEX: 6, VIT: 4 }, {
      appraisal: 'E', skills: [['fire_magic', 'D-'], ['healing_magic', 'E'], ['stealth', 'E-']], guildRank: parseSubRank('D'),
    }),
    schedule: [
      { from: 10, to: 16, map: 'guild', at: 'adv2', act: 'sit' },
      { from: 16, to: 18, map: 'world', at: [92, 52], wander: 1, act: 'sit' },
      { from: 18, to: 21, map: 'inn', at: 'good_2', act: 'drink' },
      { from: 21, to: 10, map: 'hidden', at: [92, 52] },
    ],
    bubbles: { any: ['...', 'Bu köyün havası temiz.'], naked: ['...(başını çevirir)'] },
    talk: {
      any: ['...Seni okuyamıyorum. Garip.', 'Elf\'ler yüz yıl yaşar, insanlar yüz yılda yaşlanır. Acele etme.'],
      naked: ['...Lütfen giyin.'],
    },
  },

  // ======================================================================= 0.2.0: HALDOR'UN ÇİFTLİĞİ
  {
    id: 'haldor', name: 'Yaşlı Haldor', sheet: 'haldor', voice: 'male_old', portrait: 'haldor', personality: 'kind', caste: 'commoner',
    creature: creature('haldor', 'Haldor', 'İnsan', 'Erkek', 71, 2, { STR: 2, VIT: 3, DEX: 1 }, { appraisal: 'G', skills: [['gathering', 'F-']], inventory: { bread: 2, apple: 4 } }),
    schedule: [
      { from: 6, to: 12, map: 'world', at: [134, 46], wander: 3, act: 'work' },
      { from: 12, to: 14, map: 'farmhouse', at: 'haldor', act: 'sit' },
      { from: 14, to: 18, map: 'world', at: [136, 46], wander: 3, act: 'work' },
      { from: 18, to: 22, map: 'farmhouse', at: 'haldor', act: 'sit' },
      { from: 22, to: 6, map: 'hidden', at: 'haldor' },
    ],
    bubbles: {
      naked: ['Vay evlat... Üşüyeceksin bu hâlde.', 'Kimin nesi bu? Ormandan mı çıktı?'],
      rootless: ['Buğday kendini biçmez...', 'Ah, dizlerim. Ah, belim.', 'Bertram\'ın çırağı mı o?'],
      adventurer: ['Maceracı olmuşsun ha! Bertram hep bilir kimin adam olacağını.'],
      any: ['Bu yıl başaklar dolu. Biçecek el lazım.'],
    },
    talk: {
      naked: ['Ne o, yolunu mu kaybettin? Bertram\'ın hanı meydanın kuzeyinde. Git, belki bir lokma verir.'],
      rootless: ['Ben yaşlı bir çiftçiyim, evlat. Sana verecek bir şeyim yok. Tarlam benden büyük, o kadar.', 'Köksüz müsün? Ben de köksüz bir babanın oğluyum. Toprak sonradan kök verir.'],
      adventurer: ['Lonca kartı ha? Dikkat et. Kurtlar kartına bakmaz.'],
    },
  },

  // ======================================================================= 0.2.0: DOĞU MAHALLESİ ESNAFI
  {
    id: 'baker', name: 'Fırıncı Brunhild', sheet: 'baker', voice: 'female', portrait: 'baker', personality: 'neutral', caste: 'burgher', shop: 'bakery', role: 'shop',
    creature: creature('baker', 'Brunhild', 'İnsan', 'Kadın', 39, 2, { STR: 3, VIT: 3, DEX: 2 }, { appraisal: 'G+', inventory: { bread: 30, honey_bun: 12, meat_pie: 6 } }),
    schedule: [
      { from: 5, to: 18, map: 'bakery', at: 'baker', act: 'work' },
      { from: 18, to: 21, map: 'world', at: [168, 72], wander: 2, act: 'talk' },
      { from: 21, to: 5, map: 'hidden', at: 'baker' },
    ],
    bubbles: {
      any: ['Taze ekmek! Sıcak sıcak!', 'Hamur kendini yoğurmaz.'],
      naked: ['Fırınımın önünden çekil! Un kokusu sana bulaşmasın!'],
      rootless: ['Köksüze bayat ekmek yarı fiyata. ...Şaka. Tam fiyat.', 'Paran var mı, onu söyle önce.'],
      adventurer: ['Maceracılar çok yer. İyi müşteri.'],
    },
    talk: {
      naked: ['Bu kılıkla fırınıma girme! Önce bir gömlek.'],
      rootless: ['Ekmek dört bronz. Börek on sekiz. Pazarlık yok, köksüzle hiç yok.', 'Kuru ekmek bile para eder, evlat. Un pahalı.'],
      adventurer: ['Yola çıkacaksan börek al. Midesi boş maceracı çabuk ölür.'],
    },
  },
  {
    id: 'tailor', name: 'Terzi Mirelle', sheet: 'tailor', voice: 'female', portrait: 'tailor', personality: 'proud', caste: 'burgher', shop: 'tailor', role: 'shop',
    creature: creature('tailor', 'Mirelle', 'İnsan', 'Kadın', 33, 2, { DEX: 5, INT: 3, LUK: 2 }, { appraisal: 'F-', equipment: { necklace: 'rabbit_charm' }, inventory: { linen_shirt: 3 } }),
    schedule: [
      { from: 9, to: 18, map: 'tailor', at: 'tailor', act: 'work' },
      { from: 18, to: 20, map: 'world', at: [178, 72], wander: 2, act: 'talk' },
      { from: 20, to: 9, map: 'hidden', at: 'tailor' },
    ],
    bubbles: {
      any: ['İğne, iplik, sabır.', 'Bu kumaş başkentten geldi. Sakın dokunma.'],
      naked: ['Tanrılar! Gözlerim! Biri bu adama bir çuval versin!'],
      rootless: ['O gömlek Bertram\'ın değil mi? Kollar bile tutmuyor.', 'Köksüzler hep başkasının elbisesini giyer.'],
      adventurer: ['Kartın var ama terbiyeli bir pelerinin yok.'],
    },
    talk: {
      naked: ['Dükkânıma çıplak giremezsin! ...Dur. Bir şey alacaksan parayı kapıdan uzat.'],
      rootless: ['Kumaşlarım soylu kâhyalarına gider, köksüzlere değil. Ama paran varsa... bakarız.', 'Ölçü almam. Hazır ne varsa o.'],
      adventurer: ['Maceracılar hep yırtık giyer. Bari temiz yırtık olsun.'],
    },
  },
  {
    id: 'tanner', name: 'Tabakçı Gorm', sheet: 'tanner', voice: 'gruff', portrait: 'tanner', personality: 'rude', caste: 'burgher', shop: 'tannery', role: 'shop',
    creature: creature('tanner', 'Gorm', 'İnsan', 'Erkek', 45, 4, { STR: 7, VIT: 6, DEX: 3 }, { appraisal: 'G+', equipment: { gloves: 'leather_gloves' }, inventory: { wolf_pelt: 3, rabbit_pelt: 6 } }),
    schedule: [
      { from: 8, to: 18, map: 'tannery', at: 'tanner', act: 'work' },
      { from: 18, to: 23, map: 'inn', at: 'bar_2', act: 'drink' },
      { from: 23, to: 8, map: 'hidden', at: 'tanner' },
    ],
    bubbles: {
      any: ['Koku mu? Para kokusu bu.', 'Post getir, para götür. Az para.'],
      naked: ['Senin derin bile satılmaz.'],
      rootless: ['Köksüz, postun varsa getir. Yoksa yolumdan çekil.'],
      adventurer: ['Kurt postu getirirsen konuşuruz.'],
    },
    talk: {
      naked: ['Defol. Leş kokusundan daha kötü kokuyorsun.'],
      rootless: ['Post getirirsen fiyatını ben söylerim. İtiraz edersen kapı orada.', 'Köksüzlerin pazarlık hakkı yoktur. Kural bu.'],
      adventurer: ['Kurt postu dokuz bronz. Tavşan beş. Pazarlık edersen dört.'],
    },
  },
  {
    id: 'apprentice', name: 'Çırak Ott', sheet: 'apprentice', voice: 'male', portrait: 'apprentice', personality: 'shy', caste: 'commoner',
    creature: creature('apprentice', 'Ott', 'İnsan', 'Erkek', 15, 1, { STR: 2, VIT: 1, DEX: 1 }),
    schedule: [
      { from: 8, to: 18, map: 'smithy', at: [6, 6], act: 'work' },
      { from: 18, to: 21, map: 'world', at: [80, 69], wander: 2, act: 'talk' },
      { from: 21, to: 8, map: 'hidden', at: [80, 69] },
    ],
    bubbles: {
      any: ['Usta yine bağıracak...', 'Körük, körük, körük.'],
      naked: ['(Kızarıp başka yere bakıyor.)'],
      rootless: ['Sen de mi her şeye sıfırdan başladın?'],
      adventurer: ['Kart almışsın! Ben de bir gün... belki.'],
    },
    talk: {
      any: ['Usta Gunnar\'ın çırağıyım. Henüz kılıç dövemiyorum. Çivi dövüyorum. Çok çivi.', 'Demir sıcakken dövülür derler. Ben hep geç kalıyorum.'],
    },
  },
  {
    id: 'carpenter', name: 'Marangoz Ivo', sheet: 'carpenter', voice: 'male', portrait: 'carpenter', personality: 'neutral', caste: 'burgher',
    creature: creature('carpenter', 'Ivo', 'İnsan', 'Erkek', 37, 3, { STR: 5, DEX: 5, VIT: 3 }, { appraisal: 'G', inventory: { firewood: 12 } }),
    schedule: [
      { from: 7, to: 17, map: 'world', at: [179, 62], wander: 2, act: 'work' },
      { from: 17, to: 21, map: 'world', at: [131, 117], wander: 2, act: 'talk' },
      { from: 21, to: 7, map: 'hidden', at: [179, 62] },
    ],
    bubbles: {
      any: ['Bu araba tekerleği üçüncü kez kırıldı.', 'Tüccarın arabası, tüccarın derdi.'],
      naked: ['Hey! Talaşa basma, yalınayaksın!'],
      rootless: ['Köksüz, çivi taşıyabilir misin? Yok, yok. Para veremem.'],
      adventurer: ['Kılıcın kırılınca sapını ben yaparım. Ucuz değil.'],
    },
    talk: {
      any: ['Aurelio Efendi\'nin arabası yine kırık. Adam ödemeyi unutur ama sipariş vermeyi asla.'],
      rootless: ['Köksüzlere iş vermem. Kızma, kural benim değil, köyün.'],
    },
  },
  {
    id: 'bard', name: 'Ozan Fennick', sheet: 'bard', voice: 'male', portrait: 'bard', personality: 'gossip', caste: 'burgher',
    creature: creature('bard', 'Fennick', 'İnsan', 'Erkek', 28, 3, { DEX: 4, LUK: 4, INT: 3 }, { appraisal: 'F-', traits: ['silver_tongue'] }),
    schedule: [
      { from: 10, to: 17, map: 'world', at: [174, 74], wander: 2, act: 'talk' },
      { from: 18, to: 23, map: 'inn', at: 'stage', act: 'talk' },
      { from: 23, to: 10, map: 'hidden', at: [174, 74] },
    ],
    bubbles: {
      any: ['♪ S rütbe Leydi Aveline, ejderhanın dişini söktü ♪', '♪ Kral bir kadeh kaldırdı, köylüler eğildi ♪', 'Bir bronz atan bir şarkı dinler!'],
      naked: ['♪ Ormandan çıktı bir adam, ne gömlek ne de don ♪'],
      rootless: ['♪ Bulaşıkçı Joseph, tabakları parlattı ♪ ...Hoşuna gitmedi mi?'],
      adventurer: ['♪ G- bir kahraman, fareleri kovaladı ♪'],
    },
    talk: {
      any: ['Dünyada iki üç S rütbe var, derler. Leydi Aveline, Demir Yemin Kaldor... Üçüncüsünü kimse bilmez. Belki yoktur. Belki şarkılarda yaşar.', 'X rütbe mi? O masal. Ben de masal anlatırım, para alırım.'],
      rootless: ['Senin şarkını da yazarım bir gün. Ama önce bir şey yapman lazım. Bulaşık şarkısı satmaz.'],
    },
  },
  {
    id: 'innmaid', name: 'Hizmetçi Mia', sheet: 'innmaid', voice: 'female', portrait: 'innmaid', personality: 'kind', caste: 'commoner',
    creature: creature('innmaid', 'Mia', 'İnsan', 'Kadın', 17, 1, { DEX: 2, AGI: 2 }),
    schedule: [
      { from: 7, to: 23, map: 'inn', at: [6, 7], wander: 3, act: 'work' },
      { from: 23, to: 7, map: 'hidden', at: [6, 7] },
    ],
    bubbles: {
      any: ['Geliyor, geliyor!', 'Ocaktaki güveç yanmasın...'],
      naked: ['Ay! Bertram Amca, kapıda biri var... çıplak!'],
      rootless: ['Ön masalar efendilerin, sen arkaya otur. Kusura bakma.', 'Bulaşıklar bugün seni bekliyor.'],
      adventurer: ['Kart mı almışsın? Yine de ön masalar sana değil, üzgünüm.'],
    },
    talk: {
      any: ['Şöminenin önündeki masalar Dorn Efendi gibilere ayrılır. Biz köylüler ortada, köksüzler arkada otururuz. Bertram Amca böyle istemez ama müşteri böyle ister.'],
      rootless: ['Bertram Amca seni sevdi, belli. Kimseye tavan arasını vermez.'],
    },
  },

  // ======================================================================= 0.2.0: ÜST KAST
  {
    id: 'merchant', name: 'Tüccar Aurelio', sheet: 'merchant', voice: 'male', portrait: 'merchant', personality: 'proud', caste: 'burgher', prestige: 4,
    creature: creature('merchant', 'Aurelio', 'İnsan', 'Erkek', 48, 4, { INT: 7, LUK: 6, VIT: 2 }, {
      appraisal: 'E-', titles: ['npc_merchant'], traits: ['silver_tongue'],
      equipment: { ring1: 'copper_ring', necklace: 'rabbit_charm', boots: 'leather_boots' }, inventory: { meat_pie: 2, mp_potion_s: 1 },
    }),
    schedule: [
      { from: 9, to: 11, map: 'world', at: [172, 74], wander: 2, act: 'talk' },
      { from: 11, to: 13, map: 'tailor', at: 'queue', act: 'talk' },
      { from: 13, to: 16, map: 'world', at: [97, 59], wander: 3, act: 'talk' },
      { from: 16, to: 18, map: 'tannery', at: 'queue', act: 'talk' },
      { from: 18, to: 23, map: 'inn', at: 'good_3', act: 'drink' },
      { from: 23, to: 9, map: 'hidden', at: [154, 55] },
    ],
    bubbles: {
      any: ['Zaman paradır, para da benim.', 'Bu köyde bir şey alınacak, bir şey satılacak. O kadar.'],
      naked: ['Varg, şu şeyi yolumdan al.'],
      rootless: ['Köksüz... Bir gün borç almaya gelirsin. Faizim yüksektir.', '(Kesesini sıkıca tutuyor.)'],
      adventurer: ['G- maceracı. Kervanıma muhafız lazım... ama sen değil.'],
    },
    talk: {
      naked: ['Konuşmuyorum. Varg!'],
      rootless: ['Bana ancak efendim diyerek hitap edebilirsin. ...Ne istiyorsun? Çabuk.', 'Köksüzlerin iki kaderi vardır: ya borçlanır ya ölür. Hangisini seçersin?'],
      adventurer: ['Maceracı mı? Hm. B rütbe olunca kapımı çal. O zamana kadar... yürü.'],
    },
  },
  {
    id: 'merc_guard', name: 'Paralı Asker Varg', sheet: 'merc_guard', voice: 'gruff', portrait: 'merc_guard', personality: 'rude', caste: 'burgher',
    creature: creature('merc_guard', 'Varg', 'İnsan', 'Erkek', 34, 7, { STR: 9, VIT: 8, AGI: 3, DEX: 4 }, {
      appraisal: 'G+', skills: [['sword_mastery', 'E-'], ['athletics', 'F']], guildRank: parseSubRank('E'),
      equipment: { weapon: 'iron_shortsword', chest: 'padded_armor', helmet: 'iron_cap', boots: 'hobnail_boots' },
    }),
    schedule: [
      { from: 9, to: 11, map: 'world', at: [174, 75], wander: 1, act: 'talk' },
      { from: 11, to: 13, map: 'tailor', at: [2, 5], act: 'work' },
      { from: 13, to: 16, map: 'world', at: [99, 60], wander: 1, act: 'talk' },
      { from: 16, to: 18, map: 'tannery', at: [2, 6], act: 'work' },
      { from: 18, to: 23, map: 'inn', at: 'good_6', act: 'drink' },
      { from: 23, to: 9, map: 'hidden', at: [154, 55] },
    ],
    bubbles: {
      any: ['...', 'Efendinin keselerine bakma.'],
      rootless: ['Bir adım daha yaklaş, kolunu kırarım.', 'Köksüz. Gözüm üzerinde.'],
      adventurer: ['E rütbe olmadan karşıma çıkma.'],
    },
    talk: { any: ['Efendiyle konuşmak mı? Önce benimle konuşursun. Ve ben konuşmayı sevmem.'] },
  },
  {
    id: 'steward', name: 'Kâhya Edric', sheet: 'steward', voice: 'male_old', portrait: 'steward', personality: 'proud', caste: 'noble',
    creature: creature('steward', 'Edric Valmont', 'İnsan', 'Erkek', 52, 6, { INT: 9, LUK: 3, VIT: 3 }, {
      appraisal: 'E', titles: ['npc_steward'], equipment: { ring1: 'copper_ring', boots: 'leather_boots', cape: 'traveler_cape' },
    }),
    schedule: [
      { from: 10, to: 12, map: 'world', at: [96, 61], act: 'talk', days: [1, 5] },
      { from: 12, to: 14, map: 'world', at: [172, 73], act: 'talk', days: [1, 5] },
      { from: 14, to: 16, map: 'world', at: [158, 84], act: 'talk', days: [1, 5] },
      { from: 0, to: 24, map: 'hidden', at: [210, 57] },
    ],
    bubbles: {
      any: ['Baron Valmont\'un vergisi bu ay yüzde on artmıştır.', 'Muhtar nerede? Defterler eksik.'],
      naked: ['Bu... şey... neden yolda? Cedric!'],
      rootless: ['Köksüz. Gözlerini yere indir.', 'Baronun topraklarında köksüze yer yok. Ama sen yine de buradasın.'],
      adventurer: ['G- bir kart. Baron, G- maceracıları kuş korkuluğu olarak kullanır. Ucuzdur.'],
    },
    talk: {
      naked: ['(Seninle konuşmuyor. Yanındaki şövalye elini kılıcına götürüyor.)'],
      rootless: ['Benimle konuşmak için ya bir soyadın ya bir dilekçen olmalı. İkisi de yok. Çekil.', 'Köksüzler Baron Valmont\'un ekmeğini yer ama vergisini ödemez. Sen de onlardan mısın?'],
      adventurer: ['Lonca kartı soyadı yerine geçmez, maceracı. Ama vergini ödersen adını defterime yazarım.'],
    },
  },
  {
    id: 'knight', name: 'Şövalye Cedric', sheet: 'knight', voice: 'gruff', portrait: 'knight', personality: 'proud', caste: 'noble',
    creature: creature('knight', 'Cedric', 'İnsan', 'Erkek', 31, 14, { STR: 16, VIT: 16, AGI: 6, DEX: 9 }, {
      appraisal: 'E-', skills: [['sword_mastery', 'D'], ['athletics', 'E'], ['iron_body', 'E-']], titles: ['npc_knight'],
      equipment: { weapon: 'iron_shortsword', chest: 'padded_armor', helmet: 'iron_cap', pants: 'sturdy_pants', boots: 'hobnail_boots', cape: 'traveler_cape' },
    }),
    schedule: [
      { from: 10, to: 12, map: 'world', at: [97, 62], act: 'patrol', patrol: [[97, 62], [94, 62]], days: [1, 5] },
      { from: 12, to: 14, map: 'world', at: [173, 74], act: 'work', days: [1, 5] },
      { from: 14, to: 16, map: 'world', at: [159, 85], act: 'work', days: [1, 5] },
      { from: 0, to: 24, map: 'hidden', at: [210, 57] },
    ],
    bubbles: {
      any: ['...', 'Kâhyadan üç adım uzak dur.'],
      rootless: ['Bir adım daha, köksüz.', 'Eğil.'],
      adventurer: ['Kılıcını kınında tut, G-.'],
    },
    talk: { any: ['Kâhya Efendi\'yle konuşacaksan yere bak. Gözüne bakarsan, gözünü kaybedersin.'] },
  },
  {
    id: 'adv_thorne', name: 'Thorne', sheet: 'adv_thorne', voice: 'gruff', portrait: 'adv_thorne', personality: 'proud', caste: 'elite',
    creature: creature('adv_thorne', 'Thorne', 'İnsan', 'Erkek', 36, 16, { STR: 18, VIT: 14, AGI: 9, DEX: 10, LUK: 2 }, {
      appraisal: 'E', skills: [['sword_mastery', 'D+'], ['evasion', 'E'], ['athletics', 'D-'], ['iron_body', 'E']], titles: ['npc_blackhound'],
      guildRank: parseSubRank('D-'), equipment: { weapon: 'iron_shortsword', chest: 'padded_armor', pants: 'sturdy_pants', boots: 'hobnail_boots', cape: 'traveler_cape' },
    }),
    schedule: [
      { from: 9, to: 13, map: 'guild', at: 'adv4', act: 'sit' },
      { from: 13, to: 18, map: 'world', at: [101, 57], wander: 2, act: 'talk' },
      { from: 18, to: 23, map: 'inn', at: 'good_5', act: 'drink' },
      { from: 23, to: 9, map: 'hidden', at: [101, 57] },
    ],
    bubbles: {
      any: ['Bu köyde öldürülecek bir şey kalmamış.', 'Goblin kampı mı? Çocuk oyuncağı.'],
      naked: ['Hah! Goblinler bile pantolon giyer.'],
      rootless: ['Yolumdan çekil, bulaşıkçı.', 'Köksüz. Kokusunu buradan alıyorum.'],
      adventurer: ['G-... Ben G-\'yken bir kurt sürüsünü tek başıma devirmiştim. Yalan. Ama inandın, değil mi?'],
    },
    talk: {
      naked: ['Uzak dur.'],
      rootless: ['D- rütbe Thorne. Kara Tazı. Adımı duymadıysan, köksüz olduğun için.', 'Konuşmak için kart lazım. Kart almak için bir gümüş. Bir gümüşün yoksa... işte bu yüzden konuşmuyoruz.'],
      adventurer: ['D rütbe olmak ne mi demek? Soylular sofrasına oturtmaz ama kapıdan da kovmaz. Köylüler yol verir. Senin gibiler önümde eğilir. Alışacaksın.'],
    },
  },
  {
    id: 'adv_kael', name: 'Kael', sheet: 'adv_kael', voice: 'male', portrait: 'adv_kael', personality: 'proud', caste: 'commoner',
    creature: creature('adv_kael', 'Kael', 'İnsan', 'Erkek', 17, 2, { STR: 3, AGI: 3, DEX: 2 }, {
      appraisal: 'G', skills: [['sword_mastery', 'G+', 6]], guildRank: parseSubRank('F-'),
      equipment: { weapon: 'rusty_shortsword', chest: 'leather_vest', boots: 'leather_boots' },
    }),
    schedule: [
      { from: 8, to: 12, map: 'guild', at: 'adv3', act: 'sit' },
      { from: 12, to: 18, map: 'world', at: [71, 54], wander: 3, act: 'work' },
      { from: 18, to: 23, map: 'inn', at: 'bar_1', act: 'drink' },
      { from: 23, to: 8, map: 'hidden', at: [71, 54] },
    ],
    bubbles: {
      any: ['Bir gün D rütbe olacağım. Sonra C. Sonra...', 'Thorne Efendi bana bakmadı bile.'],
      naked: ['Hahaha! Bu adam kim?!'],
      rootless: ['Bulaşıkçı! Ben F-\'yim, sen hiçsin. Unutma.', 'Köksüzle görülürsem adım çıkar.'],
      adventurer: ['G- ha? Ben senden bir rütbe yüksekteyim. Bana "abi" diyebilirsin.'],
    },
    talk: {
      naked: ['Uzak dur, rezil olacağım.'],
      rootless: ['F- rütbe Kael! Babam tarlada çalışır ama ben kılıç tutarım. Sen? Sen bulaşık tutarsın.'],
      adventurer: ['Antrenman alanında dövüşelim mi? ...Şaka. Seni ezersem Bertram beni hanına sokmaz.'],
    },
  },

  // ======================================================================= 0.2.0: KÖYLÜLER
  {
    id: 'headman', name: 'Muhtar Godric', sheet: 'headman', voice: 'bertram', portrait: 'headman', personality: 'proud', caste: 'burgher',
    creature: creature('headman', 'Godric', 'İnsan', 'Erkek', 56, 3, { INT: 5, VIT: 3, LUK: 3 }, { appraisal: 'F-', equipment: { ring1: 'copper_ring' } }),
    schedule: [
      { from: 8, to: 12, map: 'world', at: [158, 84], wander: 2, act: 'talk' },
      { from: 12, to: 15, map: 'world', at: [94, 59], wander: 3, act: 'talk' },
      { from: 15, to: 18, map: 'world', at: [170, 73], wander: 2, act: 'talk' },
      { from: 18, to: 22, map: 'inn', at: 'good_4', act: 'drink' },
      { from: 22, to: 8, map: 'hidden', at: [158, 84] },
    ],
    bubbles: {
      any: ['Vergi defterleri, vergi defterleri...', 'Kâhya gelecek, her şey yerli yerinde olsun.'],
      naked: ['Muhafız! Köyümde bu ne rezalet!'],
      rootless: ['Köksüzler muhtarlık defterine yazılmaz. Sen yoksun, evlat.', 'Köyümde hırsızlık olursa ilk sana bakarım.'],
      adventurer: ['Lonca kartı ha. Defterime "maceracı, köksüz" diye yazdım. İkisi de doğru.'],
    },
    talk: {
      naked: ['Muhtar olarak sana söylüyorum: ya giyinirsin ya köyden çıkarsın.'],
      rootless: ['Bu köyün muhtarıyım. Kim nerede doğdu, kimin tarlası kime kaldı, hepsi bende yazılı. Senin adın yok. Yoksan, haklar da yok.', 'Baron\'un kâhyası Ateş Günü ve Toprak Günü gelir. O gün yolda görünme. Görünürsen eğil.'],
      adventurer: ['Maceracı oldun diye vergiden kurtulmazsın. Ama köksüzlükten biraz kurtulursun. Biraz.'],
    },
  },
  {
    id: 'headwife', name: 'Hanım Matilde', sheet: 'headwife', voice: 'female', portrait: 'headwife', personality: 'rude', caste: 'burgher',
    creature: creature('headwife', 'Matilde', 'İnsan', 'Kadın', 50, 1, { INT: 3, LUK: 2 }, { equipment: { necklace: 'rabbit_charm' } }),
    schedule: [
      { from: 9, to: 11, map: 'bakery', at: 'queue', act: 'talk' },
      { from: 11, to: 16, map: 'world', at: [173, 72], wander: 2, act: 'talk' },
      { from: 16, to: 18, map: 'tailor', at: 'queue', act: 'talk' },
      { from: 18, to: 9, map: 'hidden', at: [158, 84] },
    ],
    bubbles: {
      any: ['Brunhild\'in ekmeği yine hamur.', 'Muhtar karısına yol verilir, bilmiyor musunuz?'],
      naked: ['Ahlaksız! Gözlerim kirlendi!'],
      rootless: ['Köksüzler pazara girmesin diye kural koymalı.', 'Uzak dur, eteğim kirlenecek.'],
      adventurer: ['Maceracı! Daha beter. Kanlı çizmelerle dolaşırsınız.'],
    },
    talk: {
      naked: ['Kocam muhtardır! Seni köyden kovdururum!'],
      rootless: ['Benimle konuşmadan önce selam verilir, köksüz. Eğilerek.', 'Fırında önce ben alırım, sonra köylüler, sonra... sen. Belki.'],
      adventurer: ['Kart mı almışsın? Kocam söyledi. Yine de sırada en sondasın.'],
    },
  },
  {
    id: 'farmer_m3', name: 'Jonas', sheet: 'farmer_m3', voice: 'male', portrait: 'farmer_m3', personality: 'neutral', caste: 'commoner',
    creature: creature('farmer_m3', 'Jonas', 'İnsan', 'Erkek', 35, 2, { STR: 4, VIT: 3 }, { skills: [['gathering', 'G+']] }),
    schedule: [
      { from: 6, to: 12, map: 'world', at: [149, 130], wander: 4, act: 'work' },
      { from: 12, to: 13, map: 'world', at: [115, 122], act: 'sit' },
      { from: 13, to: 18, map: 'world', at: [165, 130], wander: 4, act: 'work' },
      { from: 18, to: 22, map: 'world', at: [131, 117], wander: 2, act: 'talk' },
      { from: 22, to: 6, map: 'hidden', at: [115, 122] },
    ],
    bubbles: {
      any: ['Lahanalar tavşanlara yem oluyor.', 'Vergiden sonra elimize ne kalacak?'],
      naked: ['Ormandan gelen o adam mı bu?'],
      rootless: ['Köksüz, tarlama basma. Toprak bile senden şüpheleniyor.', 'Haldor\'a mı yardım edeceksin? Hah, şansın varmış.'],
      adventurer: ['Tavşanları kovala, maceracı. İşe yara.'],
    },
    talk: {
      naked: ['Git buradan, karım görmesin.'],
      rootless: ['Ben köylüyüm, sen köksüzsün. Aramızda bir basamak var. Küçük ama var.'],
      adventurer: ['Tarlaları tavşanlar yiyor. Avlarsan eti hana satarsın. Üç bronz eder, fazlası değil.'],
    },
  },
  {
    id: 'farmer_f3', name: 'Elke', sheet: 'farmer_f3', voice: 'female', portrait: 'farmer_f3', personality: 'kind', caste: 'commoner',
    creature: creature('farmer_f3', 'Elke', 'İnsan', 'Kadın', 32, 1, { VIT: 2, DEX: 2 }),
    schedule: [
      { from: 7, to: 11, map: 'world', at: [117, 123], wander: 2, act: 'work' },
      { from: 11, to: 15, map: 'world', at: [168, 73], wander: 2, act: 'talk' },
      { from: 15, to: 19, map: 'world', at: [119, 123], wander: 2, act: 'work' },
      { from: 19, to: 7, map: 'hidden', at: [117, 123] },
    ],
    bubbles: {
      any: ['Pazarda yumurta yine ucuz.', 'Jonas yine yemeği unuttu.'],
      naked: ['Çocuğum, sen ne hâldesin...'],
      rootless: ['Köksüz ama terbiyeli görünüyor.', 'Kocam köksüzlerle konuşma der. Ama...'],
      adventurer: ['Dikkat et kendine. Annen yok ki söylesin.'],
    },
    talk: {
      naked: ['Al şu bezi, en azından omzuna at. ...Geri isteme diye vermiyorum, al.'],
      rootless: ['Ben sana kötü bir şey demem. Ama burada herkes izliyor. Benden uzak durursan ikimiz için de iyi olur.'],
      adventurer: ['Haldor Dede bu yıl hasadı yetiştiremeyecek diye korkuyorduk. Yardım ettiysen sağ ol.'],
    },
  },
  {
    id: 'shepherd', name: 'Çoban Tam', sheet: 'shepherd', voice: 'child', portrait: 'shepherd', personality: 'shy', caste: 'commoner', speed: 2.6,
    creature: creature('shepherd', 'Tam', 'İnsan', 'Erkek', 13, 1, { AGI: 2, VIT: 1 }),
    schedule: [
      { from: 6, to: 19, map: 'world', at: [188, 128], wander: 6, act: 'work' },
      { from: 19, to: 6, map: 'hidden', at: [188, 128] },
    ],
    bubbles: {
      any: ['Hoy hoy hoy!', 'Bir kuzu eksik... yine.'],
      naked: ['(Değneğini sıkıca tutuyor.)'],
      rootless: ['Abi, sen de mi yalnızsın?'],
      adventurer: ['Kurt görürsen bana söyle! Kuzularım!'],
    },
    talk: { any: ['Meradaki kuzular benim sayılmaz. Muhtar\'ın. Ben sadece sayarım. Hep bir eksik çıkar.'] },
  },
  {
    id: 'milkmaid', name: 'Sütçü Rosa', sheet: 'milkmaid', voice: 'female', portrait: 'milkmaid', personality: 'gossip', caste: 'commoner',
    creature: creature('milkmaid', 'Rosa', 'İnsan', 'Kadın', 19, 1, { VIT: 2, STR: 1 }),
    schedule: [
      { from: 5, to: 10, map: 'world', at: [186, 121], wander: 3, act: 'work' },
      { from: 10, to: 14, map: 'world', at: [169, 74], wander: 2, act: 'talk' },
      { from: 14, to: 18, map: 'world', at: [186, 123], wander: 3, act: 'work' },
      { from: 18, to: 5, map: 'hidden', at: [186, 121] },
    ],
    bubbles: {
      any: ['Süt! Taze süt!', 'Duydun mu? Kâhya bu hafta yine geliyormuş.'],
      naked: ['Hihi! Mia\'ya anlatacağım!'],
      rootless: ['Bertram\'ın bulaşıkçısı bu! Vera ona "prens" diyormuş, hihi.'],
      adventurer: ['Köksüz maceracı! Kel Wilmer çok kızmış, hihi.'],
    },
    talk: {
      any: ['Muhtar\'ın karısı bugün Mirelle\'den yeni kumaş aldı. Üçüncü kez bu ay! Vergiyi kim ödüyor sanıyorsun?'],
      rootless: ['Köksüzlerle konuşmak yasak değil. Ama annem duyarsa... Hadi git.'],
    },
  },
  {
    id: 'washer', name: 'Çamaşırcı Wynn', sheet: 'washer', voice: 'female', portrait: 'washer', personality: 'gossip', caste: 'commoner',
    creature: creature('washer', 'Wynn', 'İnsan', 'Kadın', 41, 1, { VIT: 2, STR: 2 }),
    schedule: [
      { from: 7, to: 13, map: 'world', at: [100, 125], wander: 2, act: 'work' },
      { from: 13, to: 17, map: 'world', at: [188, 67], wander: 2, act: 'work' },
      { from: 17, to: 20, map: 'world', at: [130, 117], wander: 2, act: 'talk' },
      { from: 20, to: 7, map: 'hidden', at: [100, 125] },
    ],
    bubbles: {
      any: ['Kâhyanın gömleği yine şarap lekesi.', 'Herkesin kirli çamaşırı bende. Her anlamda.'],
      naked: ['Sana yıkayacak bir şey bile kalmamış!'],
      rootless: ['Köksüzün gömleğini yıkamam. Bertram\'ınki olsa bile.'],
      adventurer: ['Kanlı çamaşırları iki katı fiyata yıkarım.'],
    },
    talk: { any: ['Muhtar Godric\'in gömlekleri haftada üç kez yıkanır. Haldor Dede\'ninki ayda bir. Seninki hiç. Köyün düzeni bu.'] },
  },
  {
    id: 'gerda', name: 'Gerda Nine', sheet: 'gerda', voice: 'female_old', portrait: 'gerda', personality: 'kind', caste: 'commoner',
    creature: creature('gerda', 'Gerda', 'İnsan', 'Kadın', 76, 1, { INT: 3, VIT: 1 }, { skills: [['gathering', 'F-']] }),
    schedule: [
      { from: 8, to: 13, map: 'world', at: [129, 117], act: 'sit' },
      { from: 13, to: 15, map: 'hidden', at: [117, 123] },
      { from: 15, to: 19, map: 'world', at: [120, 123], wander: 1, act: 'sit' },
      { from: 19, to: 8, map: 'hidden', at: [117, 123] },
    ],
    bubbles: {
      any: ['Bu meşe ben kızken de buradaydı.', 'Gel otur yavrum, ayakta durma.'],
      naked: ['Vah yavrucak... Üşüme, gel güneşe otur.'],
      rootless: ['Köksüz değil kimse, yavrum. Kökün henüz toprağa değmemiş, o kadar.'],
      adventurer: ['Maceracı! Benim oğlum da öyleydi. Şimdi meşenin dibinde yatıyor. Dikkat et.'],
    },
    talk: {
      any: ['Benim gençliğimde bir S rütbe kahraman bu köyden geçti. At üstündeydi. Herkes diz çöktü. Ben çöküvermedim, merak ettim. Annem kulağımı çekti.', 'Meşenin altında herkes eşittir derler. Ama muhtar gelince yine de kalkarlar.'],
    },
  },
  {
    id: 'child_girl', name: 'Lotte', sheet: 'child_girl', voice: 'child', portrait: 'child_girl', personality: 'kind', caste: 'commoner', speed: 2.8,
    creature: creature('child_girl', 'Lotte', 'İnsan', 'Kız', 8, 0, {}),
    schedule: [
      { from: 9, to: 17, map: 'world', at: [170, 75], wander: 4, act: 'talk' },
      { from: 17, to: 9, map: 'hidden', at: [170, 75] },
    ],
    bubbles: {
      any: ['Çeşmeye bozuk para attım! Dilek tuttum!', 'Benno beni kovalıyor!'],
      naked: ['Anneee! Çıplak adam!'],
      rootless: ['Annem köksüzlere yaklaşma dedi. Neden?'],
      adventurer: ['Kılıcın var mı? Göster! Göster!'],
    },
    talk: { any: ['Çeşmeye bir bronz atarsan dileğin olurmuş. Ama annem bronzu geri aldı.'] },
  },
  {
    id: 'child_boy', name: 'Benno', sheet: 'child_boy', voice: 'child', portrait: 'child_boy', personality: 'gossip', caste: 'commoner', speed: 2.9,
    creature: creature('child_boy', 'Benno', 'İnsan', 'Erkek', 9, 0, {}),
    schedule: [
      { from: 9, to: 12, map: 'world', at: [128, 115], wander: 4, act: 'talk' },
      { from: 12, to: 17, map: 'world', at: [174, 76], wander: 4, act: 'talk' },
      { from: 17, to: 9, map: 'hidden', at: [128, 115] },
    ],
    bubbles: {
      any: ['Yakalayamazsın!', 'Lotte ağlak!'],
      naked: ['Hahaha! Bak bak!'],
      rootless: ['Köksüz! Köksüz! Kökün nerede?', 'Babam sana taş atmayı söyledi. Ama atmıyorum.'],
      adventurer: ['G- ne demek? Gerçekten mi berbat demek?'],
    },
    talk: { any: ['Sen gerçekten ormandan mı çıktın? Kurt mu büyüttü seni?'] },
  },
  {
    id: 'woodcutter', name: 'Oduncu Brann', sheet: 'woodcutter', voice: 'gruff', portrait: 'woodcutter', personality: 'neutral', caste: 'commoner',
    creature: creature('woodcutter', 'Brann', 'İnsan', 'Erkek', 42, 3, { STR: 7, VIT: 5 }, { inventory: { firewood: 20 } }),
    schedule: [
      { from: 6, to: 16, map: 'world', at: [127, 136], wander: 2, act: 'work' },
      { from: 16, to: 19, map: 'world', at: [132, 117], wander: 2, act: 'talk' },
      { from: 19, to: 22, map: 'inn', at: 'back_2', act: 'drink' },
      { from: 22, to: 6, map: 'hidden', at: [127, 136] },
    ],
    bubbles: {
      any: ['Kütük, kütük, kütük.', 'Güney ormanında bir şey dolaşıyor. Büyük bir şey.'],
      naked: ['Bu soğukta mı? Delisin sen.'],
      rootless: ['Köksüz, balta tutmasını bilir misin? Bilmezsin. Yürü.'],
      adventurer: ['Kurt postu soğukta işe yarar. Tabakçı Gorm iyi işler. Pahalı işler.'],
    },
    talk: { any: ['Handa arka masaya otururum. Talaş kokuyorum, ön masalar beni istemez. Umurumda da değil.'] },
  },
  {
    id: 'guard_pell', name: 'Muhafız Pell', sheet: 'guard3', voice: 'male', portrait: 'guard3', personality: 'neutral', caste: 'burgher', role: 'guard',
    creature: creature('guard_pell', 'Pell', 'İnsan', 'Erkek', 26, 4, { STR: 5, VIT: 5, AGI: 3, DEX: 3 }, {
      appraisal: 'G', skills: [['spear_mastery', 'G+']], titles: ['npc_watch'], equipment: { weapon: 'iron_spear', helmet: 'iron_cap', chest: 'padded_armor', boots: 'leather_boots' },
    }),
    schedule: [
      { from: 6, to: 22, map: 'world', at: [160, 58], act: 'patrol', patrol: [[150, 58], [172, 60], [172, 80], [172, 98], [184, 90], [172, 80], [160, 58], [196, 57]] },
      { from: 22, to: 6, map: 'hidden', at: [160, 58] },
    ],
    bubbles: {
      any: ['Doğu mahallesi sakindir. Sakin kalsın.'],
      naked: ['Hey! Burası muhtarın mahallesi, böyle dolaşamazsın!'],
      rootless: ['Köksüzler doğu mahallesinde oyalanmaz. Yürü.', 'Muhtar köksüzleri burada görmek istemiyor.'],
      adventurer: ['Kart göster. ...Tamam, geç.'],
      night: ['Gece doğu mahallesi kapalı sayılır. Hele köksüze.'],
    },
    talk: {
      rootless: ['Burada tüccarlar, zanaatkârlar ve muhtar oturur. Senin işin batıda, hanın etrafında. Kural benim değil.'],
      adventurer: ['Kâhya gelirse yolun kenarına çekil, kartın olsa bile. Şövalye Cedric şakadan anlamaz.'],
    },
  },

  // ======================================================================= 0.2.0: KÖKSÜZLER
  {
    id: 'vagrant', name: 'Köksüz Nim', sheet: 'vagrant', voice: 'male', portrait: 'vagrant', personality: 'wise', caste: 'rootless',
    creature: creature('vagrant', 'Nim', 'İnsan', 'Erkek', 44, 1, { VIT: 2, LUK: 3 }, { appraisal: 'G', skills: [['stealth', 'G+']], inventory: { small_stone: 3 } }),
    schedule: [
      { from: 6, to: 12, map: 'world', at: [86, 55], act: 'sit' },
      { from: 12, to: 17, map: 'world', at: [140, 59], wander: 2, act: 'sit' },
      { from: 17, to: 23, map: 'inn', at: 'back_1', act: 'sit' },
      { from: 23, to: 6, map: 'world', at: [64, 60], act: 'sit' },
    ],
    bubbles: {
      any: ['...', 'Bir bronz? Yok mu? Peki.'],
      naked: ['Kardeşim! Onları da mı aldılar senden?'],
      rootless: ['Hoş geldin aşağıya, kardeş. Burada manzara hep aynı: herkesin ayakkabısı.', 'Kâhya gelince eğil. Eğilmeyen köksüz, köksüz olarak da kalmaz.'],
      adventurer: ['Kart almışsın. İyi. Ama bil ki onlar seni hâlâ bizden sayar.'],
    },
    talk: {
      naked: ['Al, şu çuvalı omzuna at. Bende bir tane daha var. ...Yok aslında, ama al.'],
      rootless: ['Ben Nim. Bir zamanlar bir köyüm, bir tarlam vardı. Vergi, sel, bir de kumar. Şimdi bu hanın arka masası var.', 'Bertram iyi adamdır. Arka masada oturmama izin veriyor. Ön masalara bakma bile. Orası başka bir dünya.'],
      adventurer: ['Lonca kaydı mı yaptırdın? Ben de bir gümüş biriktirmiştim bir zaman. Sonra açlık geldi. Sen açlığa yenilme.'],
    },
  },
  {
    id: 'beggar', name: 'Dilenci Moss', sheet: 'beggar', voice: 'female_old', portrait: 'beggar', personality: 'kind', caste: 'rootless',
    creature: creature('beggar', 'Moss', 'İnsan', 'Kadın', 63, 0, {}),
    schedule: [
      { from: 7, to: 19, map: 'world', at: [105, 64], act: 'sit' },
      { from: 19, to: 7, map: 'hidden', at: [105, 64] },
    ],
    bubbles: {
      any: ['Bir bronz... bir ekmek parası...', 'Tanrılar sizi korusun, efendim.'],
      naked: ['Ah çocuğum... Senden de alacak bir şey kalmamış.'],
      rootless: ['Sen de bizdensin, yavrum. Eğil, gülümse, yaşa.'],
      adventurer: ['Maceracı yavrum, bir gün zengin olursan beni hatırla.'],
    },
    talk: { any: ['Herkes önümden geçer, kimse bakmaz. Muhtar\'ın karısı bakar ama. Tükürmek için.', 'Kâhya geçerken yere kapanırım. Bazen bir bronz atar. Bazen tekme.'] },
  },
];

export const NPC_BY_ID: Record<string, NpcDef> = Object.fromEntries(NPCS.map((n) => [n.id, n]));

/** Bir NPC'nin saat (ve gün) için program kaydı. Gün verilmezse haftanın günü kısıtları yok sayılır. */
export function scheduleAt(n: NpcDef, hour: number, day?: number): ScheduleEntry {
  const wd = day !== undefined ? (day - 1) % 7 : -1;
  for (const s of n.schedule) {
    if (s.days && (wd < 0 || !s.days.includes(wd))) continue;
    if (s.from <= s.to ? hour >= s.from && hour < s.to : hour >= s.from || hour < s.to) return s;
  }
  return n.schedule.find((s) => !s.days) ?? n.schedule[0];
}
