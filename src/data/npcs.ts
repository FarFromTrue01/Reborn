// NPC'ler: stat blokları (Appraisal için), ses profili, kişilik, günlük program ve replikler.
import { zeroStats, addStats, type Stats } from '../core/formulas';
import { parseSubRank } from '../core/ranks';
import type { CreatureData } from '../core/types';
import { SCHEDULES } from './schedules';

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
  /** B4: meslek ya da tanım (diyalog isim satırında; ör. "Hancı", "Muhafız"). */
  title: string;
  /** Günden güne değişen alternatif gün planları (data/schedules.ts). */
  plans?: ScheduleEntry[][];
  planKey?: string;
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

/**
 * C1: Saygınlık'a göre tonun hafif kayması. Kast farkı kalır; ton küçümseme ↔ saygı arasında kayar.
 * Balonlarda ve konuşmaların başında ara sıra kullanılır.
 */
export const TONE_LINES: Record<Caste, Record<'scorn' | 'respect', { bubble: string[]; open: string[] }>> = {
  noble: {
    scorn: { bubble: ['Paçavralar içinde bir köksüz. Ne manzara.', '(Mendilini burnuna götürüyor.)'], open: ['(Seni baştan aşağı süzüp yüzünü buruşturuyor.)', 'Kokunu buradan alıyorum.'] },
    respect: { bubble: ['Hm. En azından düzgün giyinmiş.', '(Kısa bir baş selamı veriyor.)'], open: ['(Kıyafetine bir an bakıyor. Bugün seni kovmuyor.)', 'Köksüz olsan da üstüne başına özen göstermişsin.'] },
  },
  elite: {
    scorn: { bubble: ['Şu paçavralara bak.', 'Çaylak bile değil bu.'], open: ['(Gülümsemesi küçümser.)', 'O kılıkla mı maceracı olacaksın?'] },
    respect: { bubble: ['Zırhın fena değil, çaylak.', '(Başıyla seni selamlıyor.)'], open: ['(Ekipmanını tartar gibi bakıyor.)', 'Donanımın en azından ciddi.'] },
  },
  burgher: {
    scorn: { bubble: ['Dükkânımın önünü kirletme.', 'Paçavralı müşteri, kötü müşteri.'], open: ['(Kesesini sıkıca tutuyor.)', 'Ne istiyorsan çabuk söyle.'] },
    respect: { bubble: ['Hoş geldin, maceracı!', 'İyi kumaş bu. Nereden aldın?'], open: ['(Seni daha nazik karşılıyor.)', 'Buyur, buyur. Ne lazımdı?'] },
  },
  commoner: {
    scorn: { bubble: ['Yine o köksüz.', 'Üstüne bir şey giysene.'], open: ['(Burun kıvırıyor.)', 'Ne var yine?'] },
    respect: { bubble: ['Maceracı efendi!', '(Saygıyla başını eğiyor.)'], open: ['(Biraz çekinerek konuşuyor.)', 'Buyurun... efendim?'] },
  },
  rootless: {
    scorn: { bubble: ['Kardeş, sen de mi düştün?'], open: ['(Paçavralarına bakıp iç çekiyor.)'] },
    respect: { bubble: ['Sen bizden çıktın ama bizden değilsin artık.'], open: ['(Kıyafetine imrenerek bakıyor.)'] },
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

const RAW_NPCS: Omit<NpcDef, 'schedule' | 'title'>[] = [
  // ======================================================================= ANA KARAKTERLER
  {
    id: 'bertram', name: 'Bertram', sheet: 'bertram', voice: 'bertram', portrait: 'bertram', personality: 'neutral', caste: 'burgher', shop: 'inn', role: 'inn',
    creature: creature('bertram', 'Bertram', 'İnsan', 'Erkek', 54, 9, { STR: 12, VIT: 10, AGI: 10, INT: 2, LUK: 2 }, {
      appraisal: 'F', skills: [['sword_mastery', 'E+'], ['first_aid', 'F'], ['athletics', 'F-']], titles: ['npc_retired'],
      guildRank: parseSubRank('E'), traits: ['iron_liver'], equipment: { pants: 'linen_pants', boots: 'leather_boots' },
      inventory: { bread: 12, hot_stew: 6, rabbit_meat: 3 },
    }),
    guildLabel: 'E (emekli)',
    bubbles: {
      any: ['Bira döküldü, biri silsin şunu!', 'Güveç ocakta. Kaşıklar nerede?', 'Bacağım yine sızlıyor. Yağmur gelecek.'],
    },
    talk: {},
  },
  {
    id: 'vera', name: 'Vera', sheet: 'vera', voice: 'vera', portrait: 'vera', personality: 'proud', caste: 'commoner',
    creature: creature('vera', 'Vera', 'İnsan', 'Kadın', 19, 3, { STR: 5, VIT: 3, AGI: 4 }, {
      appraisal: 'F-', skills: [['sword_mastery', 'G+', 9], ['athletics', 'G', 4]], titles: ['npc_redblade'], guildRank: parseSubRank('F-'),
      equipment: { weapon: 'iron_shortsword', chest: 'leather_vest', pants: 'sturdy_pants', boots: 'leather_boots' },
      inventory: { hp_potion_s: 2, bread: 1 }, traits: ['silver_tongue'],
    }),
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
    creature: creature('lina', 'Lina', 'Beastkin (Kedi Soylu)', 'Kadın', 18, 3, { VIT: 2, AGI: 9, LUK: 1 }, {
      appraisal: 'F-', skills: [['archery', 'G+', 11], ['stealth', 'G', 6]], titles: ['npc_sharpeye'], guildRank: parseSubRank('F-'),
      equipment: { weapon: 'hunter_bow', chest: 'leather_vest', pants: 'linen_pants', boots: 'leather_boots' },
      inventory: { apple: 3, rabbit_pelt: 1 }, traits: ['keen_ears'],
    }),
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
    creature: creature('celeste', 'Celeste', 'İnsan', 'Kadın', 22, 4, { AGI: 6, INT: 10 }, {
      appraisal: 'E', skills: [['first_aid', 'F-']], titles: ['npc_reader'], equipment: { boots: 'cloth_shoes', necklace: 'rabbit_charm' },
      inventory: { mp_potion_s: 1 },
    }),
    guildLabel: 'Görevli',
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
    creature: creature('smith', 'Gunnar', 'İnsan', 'Erkek', 41, 5, { STR: 9, VIT: 6, AGI: 5 }, {
      appraisal: 'G+', titles: ['npc_smith'], equipment: { gloves: 'leather_gloves', boots: 'leather_boots' }, inventory: { firewood: 8 },
    }),
    bubbles: { any: ['Demir sıcakken dövülür.', 'Kömür yine pahalanmış.'], naked: ['Önce bir pantolon al, evlat. Sonra kılıç.'] },
    talk: {
      naked: ['Kılıç mı? Önce pantolon. Kimse yarı çıplak adama silah satmaz.', 'Paran varsa konuşuruz. Yoksa ateşimi soğutma.'],
      rootless: ['Bertram\'ın yanında çalıştığını duydum. İyi adamdır. Paran olunca gel.', 'Köksüze kılıç satarım, ama önce parayı tezgâha koyarsın.'],
      adventurer: ['Lonca kartı, ha. Şimdi doğru düzgün bir silaha ihtiyacın var.'],
    },
  },
  {
    id: 'shopkeeper', name: 'Marta', sheet: 'shopkeeper', voice: 'female', portrait: 'shopkeeper', personality: 'neutral', caste: 'burgher', shop: 'shop', role: 'shop',
    creature: creature('shopkeeper', 'Marta', 'İnsan', 'Kadın', 36, 2, { AGI: 2, INT: 3, LUK: 3 }, { appraisal: 'G+', equipment: { ring1: 'copper_ring' } }),
    bubbles: { any: ['Taze ekmek, ucuz sargı!', 'İp, mum, tuz... ne lazımsa.'], naked: ['Aman! Dükkânıma öyle girme!'] },
    talk: {
      naked: ['Önce üstüne bir şey giy, sonra konuşalım. Müşterilerim kaçıyor.'],
      rootless: ['Köksüzlere veresiye yok. Peşin para, peşin mal.', 'Ne lazımsa var. Paran kadar tabii.'],
      adventurer: ['G- kartla indirim mi? Hah. Peşin öde, evlat.', 'Ne lazımsa var. Paran kadar tabii.'],
    },
  },
  {
    id: 'healer', name: 'Ilse Nine', sheet: 'healer', voice: 'female_old', portrait: 'healer', personality: 'kind', caste: 'burgher', shop: 'healer', role: 'healer',
    creature: creature('healer', 'Ilse', 'İnsan', 'Kadın', 67, 6, { VIT: 4, INT: 16, LUK: 4 }, {
      appraisal: 'F', skills: [['healing_magic', 'E-'], ['first_aid', 'D-'], ['gathering', 'E']], inventory: { herb: 20, hp_potion_s: 5 },
    }),
    bubbles: { any: ['Bu otlar kendiliğinden kurumaz.', 'Rüzgâr değişti. Öksürük mevsimi.'], naked: ['Üşüteceksin evladım, bir şey giy.'] },
    talk: {
      naked: ['Vah yavrum, kimdir seni bu hâle koyan? Gel, şu çizikleri bir göreyim. ...Bedava, merak etme. Bu sefer.'],
      any: ['Yaralıysan otur. Paran yoksa da otur, sonra konuşuruz.', 'Ormanda şifalı ot görürsen topla. Ben alırım.'],
    },
  },
  {
    id: 'hunter', name: 'Garrick', sheet: 'hunter', voice: 'male', portrait: 'hunter', personality: 'shy', caste: 'commoner', shop: 'lodge', role: 'teacher',
    creature: creature('hunter', 'Garrick', 'İnsan', 'Erkek', 33, 6, { STR: 3, AGI: 16, LUK: 5 }, {
      appraisal: 'G+', skills: [['archery', 'E'], ['stealth', 'F'], ['gathering', 'F']], guildRank: parseSubRank('F+'),
      equipment: { weapon: 'hunter_bow', chest: 'leather_vest', boots: 'leather_boots' }, inventory: { rabbit_pelt: 4, wolf_pelt: 1 },
    }),
    bubbles: { any: ['Rüzgâra karşı yaklaş. Hep rüzgâra karşı.', 'Kurtlar bu yıl erken indi.'], naked: ['...Ormanda öyle dolaşma. Sivrisinekler yer seni.'] },
    talk: {
      any: ['Kurtlar sürüyle gezer. Birini görürsen, üçünü say.', 'Goblinler derin ormanda kamp kurmuş. Oraya tek başına gitme.'],
    },
  },

  // ======================================================================= MUHAFIZLAR
  {
    id: 'guard_hob', name: 'Muhafız Hob', sheet: 'guard', voice: 'male', portrait: 'guard', personality: 'neutral', caste: 'burgher', role: 'guard',
    creature: creature('guard_hob', 'Hob', 'İnsan', 'Erkek', 29, 4, { STR: 5, VIT: 6, AGI: 5 }, {
      appraisal: 'G', skills: [['spear_mastery', 'G+']], titles: ['npc_watch'], equipment: { weapon: 'iron_spear', helmet: 'iron_cap', chest: 'padded_armor', boots: 'leather_boots' },
    }),
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
    creature: creature('guard_wil', 'Wilmer', 'İnsan', 'Erkek', 35, 5, { STR: 7, VIT: 6, AGI: 5, LUK: 2 }, {
      appraisal: 'G', skills: [['spear_mastery', 'F-']], equipment: { weapon: 'iron_spear', helmet: 'iron_cap', chest: 'padded_armor', boots: 'hobnail_boots' },
    }),
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
    creature: creature('captain', 'Roderick', 'İnsan', 'Erkek', 46, 11, { STR: 12, VIT: 14, AGI: 14, INT: 3, LUK: 1 }, {
      appraisal: 'E-', skills: [['spear_mastery', 'D-'], ['athletics', 'E']], titles: ['npc_watch'], guildRank: parseSubRank('D-'),
      equipment: { weapon: 'iron_spear', helmet: 'iron_cap', chest: 'padded_armor', pants: 'sturdy_pants', boots: 'hobnail_boots' },
    }),
    bubbles: { any: ['Geçiş için kart ve ücret.', 'Şehir yolu güvenli değil, ama kurallar kurallardır.'] },
    talk: {},
  },

  // ======================================================================= KÖYLÜLER
  {
    id: 'tobin', name: 'Tobin', sheet: 'farmer_m1', voice: 'male', portrait: 'farmer_m1', personality: 'gossip', caste: 'commoner',
    creature: creature('tobin', 'Tobin', 'İnsan', 'Erkek', 20, 1, { STR: 2, VIT: 2 }),
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
    creature: creature('hilda', 'Hilda', 'İnsan', 'Kadın', 31, 1, { VIT: 2, AGI: 2 }),
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
    creature: creature('greta', 'Greta', 'İnsan', 'Kadın', 27, 0, {  }),
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
    creature: creature('edwin', 'Edwin', 'İnsan', 'Erkek', 78, 3, { VIT: 2, INT: 8, LUK: 2 }, { appraisal: 'F-', skills: [['gathering', 'F']] }),
    bubbles: {
      any: ['Gençken ben de...', 'Elonth\'ta herkes sıfırdan başlar. Kral da, fare de.'],
      naked: ['Hm. Gözlerinde başka bir dünyanın tozu var.'],
    },
    talk: {
      any: [
        'Elonth\'ta herkes Level 0 doğar, evlat. Kral da, ejderha da. Gerisi ter ve kandır.',
        'Kuzeydeki surları görüyor musun? Eros. Elonth\'un en kalabalık şehirlerinden. Orada S rütbe kahramanlar var derler. İkisi ya da üçü... Ejderhalarla savaşırlarmış.',
        'Appraisal\'ı herkes bilir ama herkes aynı göremez. Gözün keskinleştikçe dünya açılır.',
        'Trait... Ha, o kelimeyi duydun mu? Kimse kimseninkini bilemez. Taş bile göremez onu.',
        'Gençler sistemi sorar hep. "Neden?" derler. Sistem cevap vermez. Sadece sayar.',
      ],
    },
  },
  {
    id: 'berta', name: 'Berta Nine', sheet: 'elder_f', voice: 'female_old', portrait: 'elder_f', personality: 'rude', caste: 'commoner',
    creature: creature('berta', 'Berta', 'İnsan', 'Kadın', 71, 1, { VIT: 2, INT: 2 }),
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
    creature: creature('anna', 'Anna', 'İnsan', 'Kadın', 29, 0, {  }),
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
    creature: creature('pip', 'Pip', 'İnsan', 'Erkek', 7, 0, {  }),
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
    creature: creature('oswin', 'Oswin', 'İnsan', 'Erkek', 58, 2, { STR: 3, VIT: 3, AGI: 2 }),
    bubbles: { any: ['Değirmen taşı aşınmış yine.', 'Fareler ambara dadandı.'] },
    talk: {
      any: ['Değirmenin arkası farelerle dolu. Birisi temizlese iyi olurdu. Para veremem ama teşekkür ederim.'],
    },
  },
  {
    id: 'dorn', name: 'Dorn', sheet: 'adventurer_m', voice: 'male', portrait: 'adventurer_m', personality: 'proud', caste: 'elite',
    creature: creature('dorn', 'Dorn', 'İnsan', 'Erkek', 26, 8, { STR: 10, VIT: 6, AGI: 15, LUK: 1 }, {
      appraisal: 'F+', skills: [['sword_mastery', 'E'], ['evasion', 'F'], ['athletics', 'E-']], guildRank: parseSubRank('F+'),
      equipment: { weapon: 'iron_shortsword', chest: 'padded_armor', pants: 'sturdy_pants', boots: 'hobnail_boots', cape: 'traveler_cape' },
    }),
    bubbles: {
      naked: ['Ha! Bu da ne?', 'Haydutlara yakalanmışsın, çaylak.'],
      rootless: ['Bertram\'ın yeni köpeği.'],
      adventurer: ['G-... Ben bir yılda F+\'ya çıktım. Sen kaç yılda çıkarsın?'],
    },
    talk: {
      naked: ['Uzak dur benden. Ve Celeste\'den.'],
      rootless: ['Ne istiyorsun, köksüz? Benimle konuşmak için önce bir kartın olsun.'],
      adventurer: ['G- olmanın tek iyi yanı, düşebileceğin daha aşağı bir yer olmaması.'],
    },
  },
  {
    id: 'sira', name: 'Sira', sheet: 'adventurer_f', voice: 'female', portrait: 'adventurer_f', personality: 'shy', caste: 'elite',
    creature: creature('sira', 'Sira', 'Elf', 'Kadın', 112, 12, { VIT: 4, AGI: 14, INT: 30 }, {
      appraisal: 'E', skills: [['fire_magic', 'D-'], ['healing_magic', 'E'], ['stealth', 'E-']], guildRank: parseSubRank('D'),
    }),
    bubbles: { any: ['...', 'Bu köyün havası temiz.'], naked: ['...(başını çevirir)'] },
    talk: {
      any: ['...Seni okuyamıyorum. Garip.', 'Elf\'ler yüz yıl yaşar, insanlar yüz yılda yaşlanır. Acele etme.'],
      naked: ['...Lütfen giyin.'],
    },
  },

  // ======================================================================= 0.2.0: HALDOR'UN ÇİFTLİĞİ
  {
    id: 'haldor', name: 'Yaşlı Haldor', sheet: 'haldor', voice: 'male_old', portrait: 'haldor', personality: 'kind', caste: 'commoner',
    creature: creature('haldor', 'Haldor', 'İnsan', 'Erkek', 71, 2, { STR: 3, VIT: 4, AGI: 1 }, { appraisal: 'G', skills: [['gathering', 'F-']], inventory: { bread: 2, apple: 4 } }),
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
    creature: creature('baker', 'Brunhild', 'İnsan', 'Kadın', 39, 2, { STR: 3, VIT: 3, AGI: 2 }, { appraisal: 'G+', inventory: { bread: 30, honey_bun: 12, meat_pie: 6 } }),
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
    creature: creature('tailor', 'Mirelle', 'İnsan', 'Kadın', 33, 2, { AGI: 4, INT: 3, LUK: 1 }, { appraisal: 'F-', equipment: { necklace: 'rabbit_charm' }, inventory: { linen_shirt: 3 } }),
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
    creature: creature('tanner', 'Gorm', 'İnsan', 'Erkek', 45, 4, { STR: 7, VIT: 6, AGI: 3 }, { appraisal: 'G+', equipment: { gloves: 'leather_gloves' }, inventory: { wolf_pelt: 3, rabbit_pelt: 6 } }),
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
    creature: creature('apprentice', 'Ott', 'İnsan', 'Erkek', 15, 1, { STR: 2, VIT: 1, AGI: 1 }),
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
    creature: creature('carpenter', 'Ivo', 'İnsan', 'Erkek', 37, 3, { STR: 4, VIT: 3, AGI: 5 }, { appraisal: 'G', inventory: { firewood: 12 } }),
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
    creature: creature('bard', 'Fennick', 'İnsan', 'Erkek', 28, 3, { AGI: 5, INT: 3, LUK: 4 }, { appraisal: 'F-', traits: ['silver_tongue'] }),
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
    creature: creature('innmaid', 'Mia', 'İnsan', 'Kadın', 17, 1, { AGI: 4 }),
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
    creature: creature('merchant', 'Aurelio', 'İnsan', 'Erkek', 48, 4, { VIT: 2, INT: 7, LUK: 7 }, {
      appraisal: 'E-', titles: ['npc_merchant'], traits: ['silver_tongue'],
      equipment: { ring1: 'copper_ring', necklace: 'rabbit_charm', boots: 'leather_boots' }, inventory: { meat_pie: 2, mp_potion_s: 1 },
    }),
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
    creature: creature('merc_guard', 'Varg', 'İnsan', 'Erkek', 34, 7, { STR: 11, VIT: 9, AGI: 8 }, {
      // 0.8.0: gerçek rütbesi F (kendini E diye satıyor — sq_merchant_guard); ekipmanı da F'ye göre, daha ucuz
      appraisal: 'G+', skills: [['sword_mastery', 'F+'], ['athletics', 'F']], guildRank: parseSubRank('F'),
      equipment: { weapon: 'rusty_shortsword', chest: 'padded_armor', helmet: 'leather_cap', boots: 'leather_boots' },
    }),
    bubbles: {
      any: ['...', 'Efendinin keselerine bakma.'],
      rootless: ['Bir adım daha yaklaş, kolunu kırarım.', 'Köksüz. Gözüm üzerinde.'],
      adventurer: ['Kartını cebinde tut, maceracı. Burada rütbeyi ben sorarım.', 'Efendinin işi var. Yürü.'],
    },
    talk: { any: ['Efendiyle konuşmak mı? Önce benimle konuşursun. Ve ben konuşmayı sevmem.'] },
  },
  {
    id: 'steward', name: 'Kâhya Edric', sheet: 'steward', voice: 'male_old', portrait: 'steward', personality: 'proud', caste: 'noble',
    creature: creature('steward', 'Edric Fenwick', 'İnsan', 'Erkek', 52, 6, { VIT: 5, INT: 14, LUK: 5 }, {
      appraisal: 'E', titles: ['npc_steward'], equipment: { ring1: 'copper_ring', boots: 'leather_boots', cape: 'traveler_cape' },
    }),
    bubbles: {
      any: ['Baron Merrow\'un vergisi bu ay yüzde on artmıştır.', 'Muhtar nerede? Defterler eksik.'],
      naked: ['Bu... şey... neden yolda? Cedric!'],
      rootless: ['Köksüz. Gözlerini yere indir.', 'Baronun topraklarında köksüze yer yok. Ama sen yine de buradasın.'],
      adventurer: ['G- bir kart. Baron, G- maceracıları kuş korkuluğu olarak kullanır. Ucuzdur.'],
    },
    talk: {
      naked: ['(Seninle konuşmuyor. Yanındaki şövalye elini kılıcına götürüyor.)'],
      rootless: ['Benimle konuşmak için ya bir soyadın ya bir dilekçen olmalı. İkisi de yok. Çekil.', 'Köksüzler Baron Merrow\'un ekmeğini yer ama vergisini ödemez. Sen de onlardan mısın?'],
      adventurer: ['Lonca kartı soyadı yerine geçmez, maceracı. Ama vergini ödersen adını defterime yazarım.'],
    },
  },
  {
    id: 'knight', name: 'Şövalye Cedric', sheet: 'knight', voice: 'gruff', portrait: 'knight', personality: 'proud', caste: 'noble',
    creature: creature('knight', 'Cedric', 'İnsan', 'Erkek', 31, 14, { STR: 19, VIT: 19, AGI: 18 }, {
      appraisal: 'E-', skills: [['sword_mastery', 'D'], ['athletics', 'E'], ['iron_body', 'E-']], titles: ['npc_knight'],
      equipment: { weapon: 'iron_shortsword', chest: 'padded_armor', helmet: 'iron_cap', pants: 'sturdy_pants', boots: 'hobnail_boots', cape: 'traveler_cape' },
    }),
    bubbles: {
      any: ['...', 'Kâhyadan üç adım uzak dur.'],
      rootless: ['Bir adım daha, köksüz.', 'Eğil.'],
      adventurer: ['Kılıcını kınında tut, G-.'],
    },
    talk: { any: ['Kâhya Efendi\'yle konuşacaksan yere bak. Gözüne bakarsan, gözünü kaybedersin.'] },
  },
  // 0.8.0 (B11): şehir geçidinde nöbet tutan şövalyeler
  {
    id: 'gate_knight_1', name: 'Şövalye Aldric', sheet: 'knight', voice: 'gruff', portrait: 'knight', personality: 'proud', caste: 'elite',
    creature: creature('gate_knight_1', 'Aldric', 'İnsan', 'Erkek', 34, 9, { STR: 10, VIT: 11, AGI: 11, INT: 3, LUK: 1 }, {
      appraisal: 'F', skills: [['spear_mastery', 'E-'], ['athletics', 'F+']], titles: ['npc_knight'],
      equipment: { weapon: 'iron_spear', chest: 'padded_armor', helmet: 'iron_cap', pants: 'sturdy_pants', boots: 'hobnail_boots' },
    }),
    bubbles: { any: ['Kart ve ücret. Yoksa geri dön.', '...'], rootless: ['Geri çekil, köksüz.'] },
    talk: { any: ['Şehir kapısı Baron Merrow\'un emriyle kapalı. Kaptan Roderick\'le konuş.'] },
  },
  {
    id: 'gate_knight_2', name: 'Şövalye Bren', sheet: 'knight', voice: 'gruff', portrait: 'knight', personality: 'proud', caste: 'elite',
    creature: creature('gate_knight_2', 'Bren', 'İnsan', 'Erkek', 29, 8, { STR: 11, VIT: 9, AGI: 10, INT: 1, LUK: 1 }, {
      appraisal: 'F', skills: [['sword_mastery', 'E-'], ['athletics', 'F+']], titles: ['npc_knight'],
      equipment: { weapon: 'iron_shortsword', chest: 'padded_armor', helmet: 'iron_cap', pants: 'sturdy_pants', boots: 'hobnail_boots' },
    }),
    bubbles: { any: ['Kapı kapalı. Emir yukarıdan.', '...'], rootless: ['Geri çekil, köksüz.'] },
    talk: { any: ['Şehir kapısı Baron Merrow\'un emriyle kapalı. Kaptan Roderick\'le konuş.'] },
  },
  {
    id: 'gate_knight_3', name: 'Şövalye Osric', sheet: 'knight', voice: 'gruff', portrait: 'knight', personality: 'proud', caste: 'elite',
    creature: creature('gate_knight_3', 'Osric', 'İnsan', 'Erkek', 41, 9, { STR: 10, VIT: 12, AGI: 9, INT: 4, LUK: 1 }, {
      appraisal: 'F', skills: [['spear_mastery', 'E-'], ['athletics', 'F+']], titles: ['npc_knight'],
      equipment: { weapon: 'iron_spear', chest: 'padded_armor', helmet: 'iron_cap', pants: 'sturdy_pants', boots: 'hobnail_boots' },
    }),
    bubbles: { any: ['Sur boyunca nöbet. Kimse tırmanmaz.', '...'], rootless: ['Geri çekil, köksüz.'] },
    talk: { any: ['Şehir kapısı Baron Merrow\'un emriyle kapalı. Kaptan Roderick\'le konuş.'] },
  },
  {
    id: 'gate_knight_4', name: 'Şövalye Ywain', sheet: 'knight', voice: 'gruff', portrait: 'knight', personality: 'proud', caste: 'elite',
    creature: creature('gate_knight_4', 'Ywain', 'İnsan', 'Erkek', 26, 8, { STR: 9, VIT: 9, AGI: 12, INT: 1, LUK: 1 }, {
      appraisal: 'F', skills: [['sword_mastery', 'E-'], ['athletics', 'F+']], titles: ['npc_knight'],
      equipment: { weapon: 'iron_shortsword', chest: 'padded_armor', helmet: 'iron_cap', pants: 'sturdy_pants', boots: 'hobnail_boots' },
    }),
    bubbles: { any: ['Köksüz mü? Kapıdan uzak dur.', '...'], rootless: ['Geri çekil, köksüz.'] },
    talk: { any: ['Şehir kapısı Baron Merrow\'un emriyle kapalı. Kaptan Roderick\'le konuş.'] },
  },
  {
    id: 'adv_thorne', name: 'Thorne', sheet: 'adv_thorne', voice: 'gruff', portrait: 'adv_thorne', personality: 'proud', caste: 'elite',
    creature: creature('adv_thorne', 'Thorne', 'İnsan', 'Erkek', 36, 16, { STR: 22, VIT: 17, AGI: 22, LUK: 3 }, {
      appraisal: 'E', skills: [['sword_mastery', 'D+'], ['evasion', 'E'], ['athletics', 'D-'], ['iron_body', 'E']], titles: ['npc_blackhound'],
      guildRank: parseSubRank('D-'), equipment: { weapon: 'iron_shortsword', chest: 'padded_armor', pants: 'sturdy_pants', boots: 'hobnail_boots', cape: 'traveler_cape' },
    }),
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
    creature: creature('adv_kael', 'Kael', 'İnsan', 'Erkek', 17, 2, { STR: 3, AGI: 5 }, {
      appraisal: 'G', skills: [['sword_mastery', 'G+', 6]], guildRank: parseSubRank('F-'),
      equipment: { weapon: 'rusty_shortsword', chest: 'leather_vest', boots: 'leather_boots' },
    }),
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
    creature: creature('headman', 'Godric', 'İnsan', 'Erkek', 56, 3, { VIT: 3, INT: 6, LUK: 3 }, { appraisal: 'F-', equipment: { ring1: 'copper_ring' } }),
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
    creature: creature('headwife', 'Matilde', 'İnsan', 'Kadın', 50, 1, { INT: 3, LUK: 1 }, { equipment: { necklace: 'rabbit_charm' } }),
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
    creature: creature('farmer_m3', 'Jonas', 'İnsan', 'Erkek', 35, 2, { STR: 5, VIT: 3 }, { skills: [['gathering', 'G+']] }),
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
    creature: creature('farmer_f3', 'Elke', 'İnsan', 'Kadın', 32, 1, { VIT: 2, AGI: 2 }),
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
    creature: creature('shepherd', 'Tam', 'İnsan', 'Erkek', 13, 1, { VIT: 1, AGI: 3 }),
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
    creature: creature('milkmaid', 'Rosa', 'İnsan', 'Kadın', 19, 1, { STR: 1, VIT: 3 }),
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
    creature: creature('washer', 'Wynn', 'İnsan', 'Kadın', 41, 2, { AGI: 8 }, { skills: [['stealth', 'F'], ['first_aid', 'G-']] }),
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
    creature: creature('gerda', 'Gerda', 'İnsan', 'Kadın', 76, 1, { VIT: 1, INT: 3 }, { skills: [['gathering', 'F-']] }),
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
    creature: creature('child_girl', 'Lotte', 'İnsan', 'Kız', 8, 0, {  }),
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
    creature: creature('child_boy', 'Benno', 'İnsan', 'Erkek', 9, 0, {  }),
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
    creature: creature('guard_pell', 'Pell', 'İnsan', 'Erkek', 26, 4, { STR: 6, VIT: 5, AGI: 5 }, {
      appraisal: 'G', skills: [['spear_mastery', 'G+']], titles: ['npc_watch'], equipment: { weapon: 'iron_spear', helmet: 'iron_cap', chest: 'padded_armor', boots: 'leather_boots' },
    }),
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
    creature: creature('vagrant', 'Nim', 'İnsan', 'Erkek', 44, 1, { VIT: 1, LUK: 3 }, { appraisal: 'G', skills: [['stealth', 'G+']], inventory: { small_stone: 3 } }),
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
    creature: creature('beggar', 'Moss', 'İnsan', 'Kadın', 63, 0, {  }),
    bubbles: {
      any: ['Bir bronz... bir ekmek parası...', 'Tanrılar sizi korusun, efendim.'],
      naked: ['Ah çocuğum... Senden de alacak bir şey kalmamış.'],
      rootless: ['Sen de bizdensin, yavrum. Eğil, gülümse, yaşa.'],
      adventurer: ['Maceracı yavrum, bir gün zengin olursan beni hatırla.'],
    },
    talk: { any: ['Herkes önümden geçer, kimse bakmaz. Muhtar\'ın karısı bakar ama. Tükürmek için.', 'Kâhya geçerken yere kapanırım. Bazen bir bronz atar. Bazen tekme.'] },
  },
];

/** B4: her NPC'nin mesleği ya da tanımı. */
export const NPC_TITLES: Record<string, string> = {
  bertram: 'Hancı', vera: 'Maceracı', lina: 'Maceracı', celeste: 'Lonca Görevlisi', smith: 'Demirci', shopkeeper: 'Dükkâncı',
  healer: 'Şifacı', hunter: 'Avcı', guard_hob: 'Muhafız', guard_wil: 'Muhafız', captain: 'Kontrol Noktası Kaptanı',
  tobin: 'Çiftçi', ulric: 'Çiftçi', hilda: 'Çiftçi', greta: 'Çiftçi', edwin: 'Köyün İhtiyarı', berta: 'Köylü', anna: 'Köylü',
  pip: 'Çocuk', fenn: 'Ayyaş', oswin: 'Değirmenci', dorn: 'Maceracı', sira: 'Büyücü', haldor: 'Çiftçi', baker: 'Fırıncı',
  tailor: 'Terzi', tanner: 'Tabakçı', apprentice: 'Demirci Çırağı', carpenter: 'Marangoz', bard: 'Ozan', innmaid: 'Han Hizmetçisi',
  merchant: 'Tüccar', merc_guard: 'Paralı Asker', steward: 'Baronun Kâhyası', knight: 'Şövalye', gate_knight_1: 'Geçit Şövalyesi', gate_knight_2: 'Geçit Şövalyesi', gate_knight_3: 'Geçit Şövalyesi', gate_knight_4: 'Geçit Şövalyesi', adv_thorne: 'Maceracı',
  adv_kael: 'Maceracı', headman: 'Muhtar', headwife: 'Muhtarın Karısı', farmer_m3: 'Çiftçi', farmer_f3: 'Çiftçi', shepherd: 'Çoban',
  milkmaid: 'Sütçü', washer: 'Çamaşırcı', gerda: 'Köylü', child_girl: 'Çocuk', child_boy: 'Çocuk', woodcutter: 'Oduncu',
  guard_pell: 'Muhafız', vagrant: 'Köksüz', beggar: 'Dilenci',
};

export const NPCS: NpcDef[] = RAW_NPCS.map((n) => {
  const sc = SCHEDULES[n.id];
  if (!sc) throw new Error('Programı olmayan NPC: ' + n.id);
  const title = NPC_TITLES[n.id];
  if (!title) throw new Error('Tanımı olmayan NPC: ' + n.id);
  return { ...n, title, schedule: sc.base, plans: sc.plans, planKey: sc.planKey };
});

export const NPC_BY_ID: Record<string, NpcDef> = Object.fromEntries(NPCS.map((n) => [n.id, n]));

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** O gün uygulanacak plan indeksi (0 = temel program). Deterministik: aynı gün aynı plan. */
export function planIndex(n: NpcDef, day: number): number {
  const count = 1 + (n.plans?.length ?? 0);
  if (count === 1) return 0;
  const key = n.planKey ?? n.id;
  return hashStr(key + ':' + day) % count;
}

/** O günün program satırları. */
export function planFor(n: NpcDef, day?: number): ScheduleEntry[] {
  if (day === undefined) return n.schedule;
  const i = planIndex(n, day);
  return i === 0 ? n.schedule : n.plans![i - 1];
}

/** Bir NPC'nin saat (ve gün) için program kaydı. Gün verilmezse haftanın günü kısıtları yok sayılır. */
export function scheduleAt(n: NpcDef, hour: number, day?: number): ScheduleEntry {
  const wd = day !== undefined ? (day - 1) % 7 : -1;
  const plan = planFor(n, day);
  for (const s of plan) {
    if (s.days && (wd < 0 || !s.days.includes(wd))) continue;
    if (s.from <= s.to ? hour >= s.from && hour < s.to : hour >= s.from || hour < s.to) return s;
  }
  return plan.find((s) => !s.days) ?? plan[0];
}
