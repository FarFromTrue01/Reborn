// Yan görevler ve pano şablonları (Bölüm II). Joseph G rütbesine yükselip ilk kadehini içtikten sonra açılır.
// Yan görevler elle yazılmıştır; pano görevleri her sabah şablonlardan seçilir (günde 3–4 ilan).
// Ödüller (E7): G 15–40 bronz, F 60–90 bronz. F görevleri risklidir: başarısızlıkta −30 puan ve ödülün iki katı ceza.
// EXP (0.5.0): yan ve pano görevleri az EXP verir (2–6); aynı süre canavar avlamak belirgin biçimde daha çok verir.
// Ana görevler hiç EXP vermez (tests/systems.test.ts).
import type { QuestDef } from '../core/quests';

const NPC = (map: string, npc: string) => ({ map, npc });
const W = (point: string, radius = 2) => ({ map: 'world', point, radius });

/** Yan görevin konuşma metinleri. {n}: Joseph'in adı yok, düz metin. */
export interface SideScript {
  /** Teklif (giver konuşunca, görev başlamadan). */
  offer: string[];
  /** Kabul edilince. */
  accept: string;
  /** Aktifken, eksik varken. */
  waiting: string;
  /** Teslimde. */
  done: string[];
  /** İsteğe bağlı: teklif için koşul (ör. Saygınlık). */
  needs?: 'none';
}

export const SIDE_QUESTS: QuestDef[] = [
  {
    id: 'sq_baker_apples', kind: 'side', chapter: 2, title: 'Elmalı Çörek', giver: 'baker',
    desc: 'Fırıncı Brunhild yarın pazar için elmalı çörek pişirecek ama elması bitmiş. Altı elma istiyor.',
    objectives: [
      { type: 'collect', label: 'Elma topla', target: 'apple', count: 6 },
      { type: 'talk', label: 'Elmaları Brunhild\'e götür', target: 'baker', where: { map: 'world', npc: 'baker', point: 'bakery_front' }, sequential: true },
    ],
    reward: { money: 30, items: [{ id: 'honey_bun', qty: 1 }], exp: 4 },
  },
  {
    id: 'sq_tanner_pelts', kind: 'side', chapter: 2, title: 'Gorm\'un Postları', giver: 'tanner',
    desc: 'Tabakçı Gorm tavşan postu bekliyor. Üç tane. Kokusuna katlanırsan parasını verecek.',
    objectives: [
      { type: 'collect', label: 'Tavşan postu topla', target: 'rabbit_pelt', count: 3 },
      { type: 'talk', label: 'Postları Gorm\'a götür', target: 'tanner', where: { map: 'world', npc: 'tanner', point: 'tannery_yard' }, sequential: true },
    ],
    reward: { money: 45, exp: 5 },
  },
  {
    id: 'sq_smith_jelly', kind: 'side', chapter: 2, title: 'Su Verme Jölesi', giver: 'smith',
    desc: 'Gunnar bıçak çeliğine su verirken sümüksü jölesi kullanıyormuş. Dört jöle istiyor. "Sorma neden. İşe yarıyor."',
    objectives: [
      { type: 'collect', label: 'Sümüksü jölesi topla', target: 'slime_jelly', count: 4 },
      { type: 'talk', label: 'Jöleleri Gunnar\'a götür', target: 'smith', where: NPC('smithy', 'smith'), sequential: true },
    ],
    reward: { money: 50, exp: 5 },
  },
  {
    id: 'sq_healer_salve', kind: 'side', chapter: 2, title: 'Nine\'nin Merhemi', giver: 'healer',
    desc: 'Ilse Nine kış için merhem kaynatacak. Altı şifalı ot lazım. Bu sefer kayıt masrafı yok.',
    objectives: [
      { type: 'collect', label: 'Şifalı ot topla', target: 'herb', count: 6, where: { map: 'world', point: 'forest_edge', radius: 6 } },
      { type: 'talk', label: 'Otları Ilse Nine\'ye götür', target: 'healer', where: NPC('healer', 'healer'), sequential: true },
    ],
    reward: { money: 35, items: [{ id: 'hp_potion_s', qty: 1 }], exp: 4 },
  },
  {
    id: 'sq_tailor_parcel', kind: 'side', chapter: 2, title: 'Kâhyaya Kumaş', giver: 'tailor',
    desc: 'Terzi Mirelle kâhya için ince kumaş dikmiş. Paketi götürmem lazım. Ama kâhya köksüzleri kapıdan çevirir; düzgün giyinmeliyim (Saygınlık en az +3).',
    objectives: [
      { type: 'deliver', label: 'Paketi Kâhya Edric\'e götür (Saygınlık +3)', target: 'steward', where: { map: 'world', npc: 'steward', point: 'manor_front' } },
      { type: 'talk', label: 'Mirelle\'e haber ver', target: 'tailor', where: { map: 'world', npc: 'tailor', point: 'tailor_front' }, sequential: true },
    ],
    reward: { money: 40, exp: 3 },
  },
  {
    id: 'sq_mill_sacks', kind: 'side', chapter: 2, title: 'Un Çuvalı', giver: 'oswin',
    desc: 'Değirmenci Oswin\'in fırına götürülecek bir paketi var. Kendisi bodrumdaki fare işinden sonra kapıdan çıkmak istemiyor.',
    objectives: [
      { type: 'deliver', label: 'Paketi Fırıncı Brunhild\'e götür', target: 'baker', where: { map: 'world', npc: 'baker', point: 'bakery_front' } },
      { type: 'talk', label: 'Oswin\'e dön', target: 'oswin', where: { map: 'world', npc: 'oswin', point: 'mill_yard' }, sequential: true },
    ],
    reward: { money: 25, exp: 2 },
  },
  {
    id: 'sq_hunter_fangs', kind: 'side', chapter: 2, title: 'Kurt Dişleri', giver: 'hunter',
    desc: 'Garrick kolye yapacakmış. Üç kurt dişi istiyor. Kurtlar kuzeybatıdaki ormanda.',
    objectives: [
      { type: 'collect', label: 'Kurt dişi topla', target: 'wolf_fang', count: 3 },
      { type: 'talk', label: 'Dişleri Garrick\'e götür', target: 'hunter', where: { map: 'world', npc: 'hunter', point: 'lodge_yard' }, sequential: true },
    ],
    reward: { money: 60, exp: 6 },
  },
  {
    id: 'sq_kids_ball', kind: 'side', chapter: 2, title: 'Kayıp Top', giver: 'pip',
    desc: 'Pip\'in bez topu göletin oradaki sazlara kaçmış. Annesi Anna oraya gitmesini yasaklamış.',
    objectives: [
      { type: 'go', label: 'Göletin kenarında topu bul', target: 'pond', where: W('pond', 3) },
      { type: 'talk', label: 'Topu Pip\'e ver', target: 'pip', where: { map: 'world', npc: 'pip', point: 'plaza' }, sequential: true },
    ],
    reward: { money: 5, text: 'Pip\'in sonsuz minneti', exp: 2 },
  },
  {
    id: 'sq_merchant_guard', kind: 'side', chapter: 2, title: 'Paralı Askerin Rütbesi', giver: 'merchant',
    desc: 'Tüccar Aurelio, paralı askeri Varg\'ın rütbesi hakkında yalan söylediğinden şüpheleniyor. Appraisal ile Varg\'ı okuyup Aurelio\'ya söylemem lazım.',
    objectives: [
      { type: 'custom', label: 'Varg\'ı Appraisal ile incele', target: 'appraise_varg' },
      { type: 'talk', label: 'Aurelio\'ya söyle', target: 'merchant', where: { map: 'world', npc: 'merchant', point: 'manor_front' }, sequential: true },
    ],
    reward: { money: 40, exp: 3 },
  },
  {
    id: 'sq_nim_bread', kind: 'side', chapter: 2, title: 'Nim\'in Ekmeği', giver: 'vagrant',
    desc: 'Köksüz Nim iki gündür bir şey yememiş. Kimse ona ekmek satmıyor. Bana satarlar. Bir ekmek götürsem...',
    objectives: [{ type: 'deliver', label: 'Nim\'e bir ekmek götür', target: 'vagrant', where: { map: 'world', npc: 'vagrant', point: 'beggar_spot' } }],
    reward: { text: 'Nim\'in anlattıkları', exp: 2 },
  },
];

export const SIDE_SCRIPTS: Record<string, SideScript> = {
  sq_baker_apples: {
    offer: ['Elma! Bütün köyde bir elma kalmadı mı? Yarın pazar, çörek tezgâhı boş kalacak.', 'Altı elma getirirsen otuz bronz. Bir de sıcak çörek. Ağaçlar köyün kenarında, kimse toplamıyor.'],
    accept: 'Altı tane. Çürüğünü getirme, köksüz. Anlarım.',
    waiting: 'Elmalar? Altı tane dedim.',
    done: ['Oh! Kırmızı, sert, tam istediğim gibi. Al bakalım. Çörek de senin. Kimseye söyleme, fiyatı iki bronz.'],
  },
  sq_tanner_pelts: {
    offer: ['Ne bakıyorsun? Koku mu? Alışırsın. Ya da alışmazsın, bana ne.', 'Tavşan postu lazım. Üç tane. Kırk beş bronz. Delik deşik getirme.'],
    accept: 'Hah. Köksüz bir tabakçıya çalışıyor. Köy buna da güler.',
    waiting: 'Postlar nerede? Tavşanlar kendiliğinden soyulmaz.',
    done: ['...Fena değil. Kesiği temiz. Al. Bir dahakine kokuna bir şey sürmeden gel, müşteri kaçıyor.'],
  },
  sq_smith_jelly: {
    offer: ['Çelik su ister. Benim çeliğim jöle ister. Ormandaki sümüksülerin jölesi.', 'Dört tane getir, elli bronz. Elini yakmasın, asidi var.'],
    accept: 'İyi. Bir dahakine kılıç almaya gelirsen... pazarlık yapmam ama gülümserim.',
    waiting: 'Jöle? Dört tane. Sümüksüler ağaç diplerinde olur.',
    done: ['Hah! Bak şu renge. Bu çelik kırılmaz artık. Al paranı, köksüz. Hak ettin.'],
  },
  sq_healer_salve: {
    offer: ['Yavrum, yine sen. Kış geliyor, merhem kaynatmam lazım. Altı ot.', 'Otuz beş bronz veririm. Bir de küçük bir iksir. Bu sefer aracı yok, kimse kesmez.'],
    accept: 'Orman kenarında, ağaç diplerinde. Yapraklarının altı gümüşi olanlar.',
    waiting: 'Otlar, yavrum. Altı tane.',
    done: ['Güzel, güzel. Al. Celeste\'ye söyleme; benden doğrudan aldığını duyarsa yüzü ekşir.'],
  },
  sq_tailor_parcel: {
    offer: ['Kâhya Edric\'in kumaşı hazır. Benim çırak hasta, kendim gidemem.', 'Kırk bronz. Ama dikkat: konağın kapısındaki adam köksüzü içeri sokmaz. Düzgün giyinmen lazım.'],
    accept: 'Paketi buruşturma. Kâhya kırışığı bile sayar.',
    waiting: 'Paketi götürdün mü? Kâhya bekletilmez.',
    done: ['Ulaştı mı? Bir şey dedi mi? "Kabul edilebilir" mi dedi? Oh, bu iyi. Bu çok iyi. Al kırk bronzunu.'],
  },
  sq_mill_sacks: {
    offer: ['Fırına bir paket gidecek. Mayalı un. Ben gidemem, bodrumdaki şeyleri hatırladıkça bacaklarım titriyor.', 'Yirmi beş bronz. Kolay iş.'],
    accept: 'Brunhild\'e ver. Benden selam söyleme, borcum var.',
    waiting: 'Paket? Fırına.',
    done: ['Brunhild bir şey dedi mi borçla ilgili? Demedi mi? İyi. Al paranı.'],
  },
  sq_hunter_fangs: {
    offer: ['Kurt dişi kolyesi isteyen bir tüccar var. Şehirli. Para veriyor.', 'Üç diş. Altmış bronz. Kurtlar kuzeybatıda, korunun dibinde. Yalnız gitme, ya da git, bana ne.'],
    accept: 'Dişleri sökerken köküne dikkat et. Kırık dişi kimse almaz.',
    waiting: 'Dişler? Üç tane.',
    done: ['Hm. Temiz. Al. Bir dahakine ok atmayı öğren, kılıçla kurt kovalamak aptallık.'],
  },
  sq_kids_ball: {
    offer: ['Topum! Topum sazlara kaçtı! Annem göletin oraya gitmeme izin vermiyor!', 'Getirir misin? Lütfen? Sana... sana bir şey veririm! Bir bronz! Belki beş!'],
    accept: 'Gerçekten mi?! Göletin yanında, sazların içinde! Kırmızı bezden!',
    waiting: 'Buldun mu? Buldun mu?',
    done: ['TOPUM! Sen en iyi köksüzsün! Al, beş bronz! Annem bilmesin!'],
  },
  sq_merchant_guard: {
    offer: ['Sen... Appraisal\'ı olan köksüz. Duydum. Bir işim var.', 'Varg kendini E rütbe diye sattı bana. Maaşını ona göre ödüyorum. Oku onu. Söyle bana. Kırk bronz.'],
    accept: 'Ona belli etme. Paralı askerler okunmayı sevmez.',
    waiting: 'Okudun mu Varg\'ı? Söyle.',
    done: ['F mi? F! Üç aydır E maaşı ödüyorum! ...Al kırk bronzunu. Ve bu konuşma hiç olmadı.'],
  },
  sq_nim_bread: {
    offer: ['...Ne var? Para yok bende. Ekmek de yok. Kimse satmıyor zaten.', '...Bir ekmek. Bir ekmek getirsen. Sana bir şey anlatırım. Şehir hakkında.'],
    accept: '...Gerçekten mi? Kimse bana bunu sormamıştı.',
    waiting: '...',
    done: ['...Teşekkür ederim. Kimse... neyse.', 'Şehir kapısında kartı olan herkes geçer, biliyor musun? Ama kart üç ay sonra biter. Bitince seni dışarı atarlar. Ben öyle atıldım.', 'Bir kartla girer, bir iş bulursan... kalırsın. Bulamazsan benim gibi olursun. Unutma.'],
  },
};

// ===================================================================== Pano şablonları
// Her şablon bir gün numarasıyla bir ilan (dinamik görev) üretir. Ödüller aralık içinde günle oynar.

export interface BoardTemplate {
  key: string;
  rank: 'G' | 'F';
  title: string;
  desc: string;
  reward: [number, number];
  make: (id: string) => Pick<QuestDef, 'objectives'>;
  /** Günden bağımsız ek koşul (ör. hikâye ilerlemesi). */
  minDay?: number;
}

const turnIn = { type: 'talk' as const, label: 'Celeste\'ye teslim et', target: 'celeste', where: NPC('guild', 'celeste'), sequential: true };

export const BOARD_TEMPLATES: BoardTemplate[] = [
  { key: 'rats_forest', rank: 'G', title: 'Orman Kenarındaki Fareler', desc: 'Değirmenin arkasından ormana yayılan fareler tarlalara iniyor. Beşini temizle.', reward: [15, 25],
    make: () => ({ objectives: [{ type: 'kill', label: 'Fare avla', target: 'rat', count: 5 }, turnIn] }) },
  { key: 'herbs', rank: 'G', title: 'Şifalı Ot Toplama', desc: 'Şifacının stoğu için dört şifalı ot. Lonca aracılık eder.', reward: [18, 28],
    make: () => ({ objectives: [{ type: 'collect', label: 'Şifalı ot topla', target: 'herb', count: 4, where: { map: 'world', point: 'forest_edge', radius: 6 } }, turnIn] }) },
  { key: 'slimes', rank: 'G', title: 'Sümüksü Temizliği', desc: 'Güney yolundaki sümüksüler arabalara yapışıyor. Üçünü temizle.', reward: [22, 32],
    make: () => ({ objectives: [{ type: 'kill', label: 'Sümüksü temizle', target: 'slime', count: 3 }, turnIn] }) },
  { key: 'rabbits', rank: 'G', title: 'Tavşan Eti', desc: 'Han için tavşan eti. Üç parça.', reward: [20, 30],
    make: () => ({ objectives: [{ type: 'collect', label: 'Tavşan eti topla', target: 'rabbit_meat', count: 3 }, turnIn] }) },
  { key: 'apples', rank: 'G', title: 'Elma Hasadı', desc: 'Muhtarın sofrası için beş elma. Evet, lonca bunu da ilan ediyor.', reward: [15, 20],
    make: () => ({ objectives: [{ type: 'collect', label: 'Elma topla', target: 'apple', count: 5 }, turnIn] }) },
  { key: 'letter_haldor', rank: 'G', title: 'Haldor\'a Mektup', desc: 'Loncanın Yaşlı Haldor\'a bir bildirisi var. Elden teslim.', reward: [15, 22],
    make: () => ({ objectives: [{ type: 'deliver', label: 'Mektubu Haldor\'a ver', target: 'haldor', where: { map: 'world', npc: 'haldor', point: 'haldor_field' } }, turnIn] }) },
  { key: 'letter_garrick', rank: 'G', title: 'Avcıya Haber', desc: 'Garrick\'e ormandaki iz raporu iletilecek.', reward: [18, 25],
    make: () => ({ objectives: [{ type: 'deliver', label: 'Raporu Garrick\'e ver', target: 'hunter', where: { map: 'world', npc: 'hunter', point: 'lodge_yard' } }, turnIn] }) },
  { key: 'rat_tails', rank: 'G', title: 'Kuyruk Sayımı', desc: 'Muhtarlık fare sayımı yapıyor. Altı fare kuyruğu.', reward: [25, 40],
    make: () => ({ objectives: [{ type: 'collect', label: 'Fare kuyruğu topla', target: 'rat_tail', count: 6 }, turnIn] }) },
  { key: 'jelly', rank: 'G', title: 'Jöle Siparişi', desc: 'Demirci üç sümüksü jölesi istiyor. Lonca üzerinden.', reward: [28, 40],
    make: () => ({ objectives: [{ type: 'collect', label: 'Sümüksü jölesi topla', target: 'slime_jelly', count: 3 }, turnIn] }) },
  { key: 'pelts', rank: 'G', title: 'Post Siparişi', desc: 'Tabakhane için iki tavşan postu.', reward: [25, 35],
    make: () => ({ objectives: [{ type: 'collect', label: 'Tavşan postu topla', target: 'rabbit_pelt', count: 2 }, turnIn] }) },
  { key: 'wolves_north', rank: 'F', title: 'Kuzey Korusunda Kurtlar', desc: 'Kuzeybatı korusunda bir kurt sürüsü oduncuları korkutuyor. Üç kurt. Risklidir.', reward: [70, 90],
    make: () => ({ objectives: [{ type: 'kill', label: 'Kurt avla', target: 'wolf', count: 3 }, turnIn] }) },
  { key: 'wolf_pelts', rank: 'F', title: 'Kurt Postu', desc: 'Şehirli bir tüccar iki kurt postu istiyor. Risklidir.', reward: [60, 80],
    make: () => ({ objectives: [{ type: 'collect', label: 'Kurt postu topla', target: 'wolf_pelt', count: 2 }, turnIn] }) },
  { key: 'goblin_ears', rank: 'F', title: 'Goblin Kulakları', desc: 'Kampın dışında dolaşan goblin keşifçileri. İki kulak getir. Ölmek de bir ihtimal.', reward: [75, 90],
    make: () => ({ objectives: [{ type: 'collect', label: 'Goblin kulağı topla', target: 'goblin_ear', count: 2 }, turnIn] }) },
  { key: 'slime_cores', rank: 'F', title: 'Renkli Çekirdek', desc: 'Simyacılar renkli çekirdek arıyor. Bir tane yeter. Bulmak şans işi.', reward: [60, 75],
    make: () => ({ objectives: [{ type: 'collect', label: 'Renkli çekirdek bul', target: 'color_core', count: 1 }, turnIn] }) },
  { key: 'wolf_fangs', rank: 'F', title: 'Kurt Dişi', desc: 'Lonca deposu için üç kurt dişi. Risklidir.', reward: [65, 85],
    make: () => ({ objectives: [{ type: 'collect', label: 'Kurt dişi topla', target: 'wolf_fang', count: 3 }, turnIn] }) },
];

/** Pano görevi EXP'si (harfe göre, az). */
export const BOARD_EXP: Record<'G' | 'F', number> = { G: 3, F: 6 };

/** Basit belirleyici rastgele (gün tohumu). */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/**
 * Günün pano ilanları: 3–4 ilan, en az 2'si G. Aynı gün hep aynı ilanlar çıkar.
 * Dönen tanımlar dinamiktir (kayıtta görevle birlikte saklanır).
 */
export function boardForDay(day: number): QuestDef[] {
  const r = rng(day * 2654435761);
  const count = 3 + (r() < 0.5 ? 1 : 0);
  const g = BOARD_TEMPLATES.filter((t) => t.rank === 'G');
  const f = BOARD_TEMPLATES.filter((t) => t.rank === 'F');
  const picks: BoardTemplate[] = [];
  const take = (pool: BoardTemplate[]) => {
    const left = pool.filter((t) => !picks.includes(t));
    if (left.length) picks.push(left[Math.floor(r() * left.length)]);
  };
  take(g);
  take(g);
  take(f);
  if (count === 4) take(r() < 0.5 ? g : f);
  return picks.map((t) => {
    const id = `b${day}_${t.key}`;
    const money = Math.round(t.reward[0] + r() * (t.reward[1] - t.reward[0]));
    return {
      id, kind: 'board', chapter: 2, rank: t.rank, guild: true, title: t.title, desc: t.desc, giver: 'celeste', days: 3,
      ...t.make(id), reward: { money, exp: BOARD_EXP[t.rank] },
    } as QuestDef;
  });
}
