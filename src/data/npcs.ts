// NPC'ler: stat blokları (Appraisal için), ses profili, kişilik, günlük program ve replikler.
import { zeroStats, addStats, type Stats } from '../core/formulas';
import { parseSubRank } from '../core/ranks';
import type { CreatureData } from '../core/types';

export type Personality = 'kind' | 'rude' | 'neutral' | 'gossip' | 'proud' | 'shy' | 'drunk' | 'wise';

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
}

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
    id: 'bertram', name: 'Bertram', sheet: 'bertram', voice: 'bertram', portrait: 'bertram', personality: 'neutral', role: 'inn',
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
    id: 'vera', name: 'Vera', sheet: 'vera', voice: 'vera', portrait: 'vera', personality: 'proud',
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
    id: 'lina', name: 'Lina', sheet: 'lina', voice: 'lina', portrait: 'lina', personality: 'gossip',
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
    id: 'celeste', name: 'Celeste', sheet: 'celeste', voice: 'celeste', portrait: 'celeste', personality: 'proud', role: 'guild',
    creature: creature('celeste', 'Celeste', 'İnsan', 'Kadın', 22, 4, { INT: 6, MNA: 4, DEX: 3, AGI: 3 }, {
      appraisal: 'E', skills: [['first_aid', 'F-']], titles: ['npc_reader'], equipment: { boots: 'cloth_shoes', necklace: 'rabbit_charm' },
      inventory: { mp_potion_s: 1 },
    }),
    guildLabel: 'Görevli',
    schedule: [{ from: 7, to: 21, map: 'guild', at: 'celeste', act: 'work' }, { from: 21, to: 7, map: 'hidden', at: 'celeste' }],
    bubbles: {
      any: ['Sıradaki.', 'Görev kanıtları tezgâhın üstüne, lütfen.'],
      naked: ['...Kapıyı kapatır mısın? Cereyan yapıyor. Ve... bu manzara.'],
    },
    talk: {},
  },

  // ======================================================================= ESNAF
  {
    id: 'smith', name: 'Gunnar', sheet: 'smith', voice: 'gruff', portrait: 'smith', personality: 'neutral', role: 'smith',
    creature: creature('smith', 'Gunnar', 'İnsan', 'Erkek', 41, 5, { STR: 9, VIT: 6, DEX: 4, AGI: 1 }, {
      appraisal: 'G+', titles: ['npc_smith'], equipment: { gloves: 'leather_gloves', boots: 'leather_boots' }, inventory: { firewood: 8 },
    }),
    schedule: [
      { from: 8, to: 18, map: 'smithy', at: 'smith', act: 'work' },
      { from: 18, to: 22, map: 'inn', at: 'table_a', act: 'drink' },
      { from: 22, to: 8, map: 'hidden', at: 'smith' },
    ],
    bubbles: { any: ['Demir sıcakken dövülür.', 'Kömür yine pahalanmış.'], naked: ['Önce bir pantolon al, evlat. Sonra kılıç.'] },
    talk: {
      naked: ['Kılıç mı? Önce pantolon. Kimse yarı çıplak adama silah satmaz.', 'Paran varsa konuşuruz. Yoksa ateşimi soğutma.'],
      rootless: ['Bertram\'ın yanında çalıştığını duydum. İyi adamdır. Paran olunca gel.'],
      adventurer: ['Lonca kartı, ha. Şimdi doğru düzgün bir silaha ihtiyacın var.'],
    },
  },
  {
    id: 'shopkeeper', name: 'Marta', sheet: 'shopkeeper', voice: 'female', portrait: 'shopkeeper', personality: 'neutral', role: 'shop',
    creature: creature('shopkeeper', 'Marta', 'İnsan', 'Kadın', 36, 2, { INT: 3, LUK: 3, DEX: 2 }, { appraisal: 'G+', equipment: { ring1: 'copper_ring' } }),
    schedule: [
      { from: 8, to: 19, map: 'shop', at: 'shopkeeper', act: 'work' },
      { from: 19, to: 21, map: 'world', at: [97, 60], wander: 2, act: 'talk' },
      { from: 21, to: 8, map: 'hidden', at: 'shopkeeper' },
    ],
    bubbles: { any: ['Taze ekmek, ucuz sargı!', 'İp, mum, tuz... ne lazımsa.'], naked: ['Aman! Dükkânıma öyle girme!'] },
    talk: {
      naked: ['Önce üstüne bir şey giy, sonra konuşalım. Müşterilerim kaçıyor.'],
      any: ['Ne lazımsa var. Paran kadar tabii.'],
    },
  },
  {
    id: 'healer', name: 'Ilse Nine', sheet: 'healer', voice: 'female_old', portrait: 'healer', personality: 'kind', role: 'healer',
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
    id: 'hunter', name: 'Garrick', sheet: 'hunter', voice: 'male', portrait: 'hunter', personality: 'shy', role: 'teacher',
    creature: creature('hunter', 'Garrick', 'İnsan', 'Erkek', 33, 6, { DEX: 9, AGI: 7, STR: 3, LUK: 5 }, {
      appraisal: 'G+', skills: [['archery', 'E'], ['stealth', 'F'], ['gathering', 'F']], guildRank: parseSubRank('F+'),
      equipment: { weapon: 'hunter_bow', chest: 'leather_vest', boots: 'leather_boots' }, inventory: { rabbit_pelt: 4, wolf_pelt: 1 },
    }),
    schedule: [
      { from: 6, to: 12, map: 'world', at: [73, 52], wander: 3, act: 'work' },
      { from: 12, to: 18, map: 'world', at: [100, 66], wander: 3, act: 'talk' },
      { from: 18, to: 23, map: 'inn', at: 'table_c', act: 'drink' },
      { from: 23, to: 6, map: 'hidden', at: [73, 52] },
    ],
    bubbles: { any: ['Rüzgâra karşı yaklaş. Hep rüzgâra karşı.', 'Kurtlar bu yıl erken indi.'], naked: ['...Ormanda öyle dolaşma. Sivrisinekler yer seni.'] },
    talk: {
      any: ['Kurtlar sürüyle gezer. Birini görürsen, üçünü say.', 'Goblinler derin ormanda kamp kurmuş. Oraya tek başına gitme.'],
    },
  },

  // ======================================================================= MUHAFIZLAR
  {
    id: 'guard_hob', name: 'Muhafız Hob', sheet: 'guard', voice: 'male', portrait: 'guard', personality: 'neutral', role: 'guard',
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
    id: 'guard_wil', name: 'Muhafız Wilmer', sheet: 'guard2', voice: 'gruff', portrait: 'guard2', personality: 'rude', role: 'guard',
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
    id: 'captain', name: 'Kaptan Roderick', sheet: 'gate_captain', voice: 'bertram', portrait: 'captain', personality: 'proud',
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
    id: 'tobin', name: 'Tobin', sheet: 'farmer_m1', voice: 'male', portrait: 'farmer_m1', personality: 'gossip',
    creature: creature('tobin', 'Tobin', 'İnsan', 'Erkek', 20, 1, { STR: 2, VIT: 2 }),
    schedule: [
      { from: 7, to: 17, map: 'world', at: [104, 26], wander: 4, act: 'work' },
      { from: 17, to: 19, map: 'world', at: [92, 60], wander: 2, act: 'talk' },
      { from: 19, to: 22, map: 'inn', at: 'table_b', act: 'drink' },
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
    id: 'ulric', name: 'Ulric', sheet: 'farmer_m2', voice: 'gruff', portrait: 'farmer_m2', personality: 'rude',
    creature: creature('ulric', 'Ulric', 'İnsan', 'Erkek', 44, 2, { STR: 4, VIT: 4 }),
    schedule: [
      { from: 6, to: 16, map: 'world', at: [119, 26], wander: 4, act: 'work' },
      { from: 16, to: 19, map: 'world', at: [120, 45], wander: 2, act: 'work' },
      { from: 19, to: 23, map: 'inn', at: 'table_d', act: 'drink' },
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
    id: 'hilda', name: 'Hilda', sheet: 'farmer_f1', voice: 'female', portrait: 'farmer_f1', personality: 'kind',
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
    id: 'greta', name: 'Greta', sheet: 'farmer_f2', voice: 'female', portrait: 'farmer_f2', personality: 'gossip',
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
    id: 'edwin', name: 'İhtiyar Edwin', sheet: 'elder_m', voice: 'male_old', portrait: 'elder_m', personality: 'wise',
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
    id: 'berta', name: 'Berta Nine', sheet: 'elder_f', voice: 'female_old', portrait: 'elder_f', personality: 'rude',
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
    id: 'anna', name: 'Anna', sheet: 'mother', voice: 'female', portrait: 'mother', personality: 'kind',
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
    id: 'pip', name: 'Pip', sheet: 'child', voice: 'child', portrait: 'child', personality: 'kind', speed: 2.8,
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
    id: 'fenn', name: 'Sarhoş Fenn', sheet: 'drunk', voice: 'male', portrait: 'drunk', personality: 'drunk',
    creature: creature('fenn', 'Fenn', 'İnsan', 'Erkek', 38, 2, { VIT: 5, LUK: 3 }, { traits: ['iron_liver'] }),
    schedule: [
      { from: 10, to: 16, map: 'world', at: [87, 58], wander: 1, act: 'sit' },
      { from: 16, to: 24, map: 'inn', at: 'table_a', act: 'drink' },
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
    id: 'oswin', name: 'Değirmenci Oswin', sheet: 'miller', voice: 'male_old', portrait: 'miller', personality: 'neutral',
    creature: creature('oswin', 'Oswin', 'İnsan', 'Erkek', 58, 2, { STR: 3, VIT: 3, DEX: 2 }),
    schedule: [
      { from: 6, to: 18, map: 'world', at: [68, 94], wander: 2, act: 'work' },
      { from: 18, to: 22, map: 'inn', at: 'table_c', act: 'drink' },
      { from: 22, to: 6, map: 'hidden', at: [68, 94] },
    ],
    bubbles: { any: ['Değirmen taşı aşınmış yine.', 'Fareler ambara dadandı.'] },
    talk: {
      any: ['Değirmenin arkası farelerle dolu. Birisi temizlese iyi olurdu. Para veremem ama teşekkür ederim.'],
    },
  },
  {
    id: 'dorn', name: 'Dorn', sheet: 'adventurer_m', voice: 'male', portrait: 'adventurer_m', personality: 'proud',
    creature: creature('dorn', 'Dorn', 'İnsan', 'Erkek', 26, 8, { STR: 10, AGI: 8, DEX: 7, VIT: 6, LUK: 1 }, {
      appraisal: 'F+', skills: [['sword_mastery', 'E'], ['evasion', 'F'], ['athletics', 'E-']], guildRank: parseSubRank('E-'),
      equipment: { weapon: 'iron_shortsword', chest: 'padded_armor', pants: 'sturdy_pants', boots: 'hobnail_boots', cape: 'traveler_cape' },
    }),
    schedule: [
      { from: 9, to: 14, map: 'guild', at: 'adv1', act: 'talk' },
      { from: 14, to: 18, map: 'world', at: [100, 57], wander: 2, act: 'talk' },
      { from: 18, to: 23, map: 'inn', at: 'table_d', act: 'drink' },
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
    id: 'sira', name: 'Sira', sheet: 'adventurer_f', voice: 'female', portrait: 'adventurer_f', personality: 'shy',
    creature: creature('sira', 'Sira', 'Elf', 'Kadın', 112, 12, { INT: 16, MNA: 14, AGI: 8, DEX: 6, VIT: 4 }, {
      appraisal: 'E', skills: [['fire_magic', 'D-'], ['healing_magic', 'E'], ['stealth', 'E-']], guildRank: parseSubRank('D'),
    }),
    schedule: [
      { from: 10, to: 16, map: 'guild', at: 'adv2', act: 'sit' },
      { from: 16, to: 18, map: 'world', at: [92, 52], wander: 1, act: 'sit' },
      { from: 18, to: 10, map: 'hidden', at: [92, 52] },
    ],
    bubbles: { any: ['...', 'Bu köyün havası temiz.'], naked: ['...(başını çevirir)'] },
    talk: {
      any: ['...Seni okuyamıyorum. Garip.', 'Elf\'ler yüz yıl yaşar, insanlar yüz yılda yaşlanır. Acele etme.'],
      naked: ['...Lütfen giyin.'],
    },
  },
];

export const NPC_BY_ID: Record<string, NpcDef> = Object.fromEntries(NPCS.map((n) => [n.id, n]));

/** Bir NPC'nin saat için program kaydı. */
export function scheduleAt(n: NpcDef, hour: number): ScheduleEntry {
  for (const s of n.schedule) {
    if (s.from <= s.to ? hour >= s.from && hour < s.to : hour >= s.from || hour < s.to) return s;
  }
  return n.schedule[0];
}
