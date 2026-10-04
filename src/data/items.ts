import type { ItemDef } from '../core/types';

// Tüm eşyalar. Fiyatlar bronz cinsindendir (1 Gümüş = 100 Bronz).
// Köy fiyatları (0.2.0): yiyecek ve iksirler yaklaşık ×3, silah/zırh ×2.5, kitaplar ×2.
// Canavar drop'larının satış değerleri (sell) sabittir; fiyat artışı drop satışını artırmaz.
// Yeni eşya eklemek için bu listeye bir kayıt eklemek yeterli.

const list: ItemDef[] = [
  // ------------------------------------------------------------------ Silahlar
  {
    id: 'rusty_shortsword', name: 'Paslı Kısa Kılıç', kind: 'weapon', slot: 'weapon', rank: 'G',
    saygınlık: 1, price: 150, dmg: [2, 4], weaponType: 'sword', icon: 'sword_rusty', visual: 'w_dagger',
    desc: 'Kenarları körelmiş, pası kazınmamış bir kısa kılıç. Hiç yoktan iyidir.',
  },
  {
    id: 'cracked_stick', name: 'Çatlak Sopa', kind: 'weapon', slot: 'weapon', rank: 'G',
    saygınlık: -2, price: 5, sell: 0, dmg: [2, 2], weaponType: 'club', icon: 'club', visual: 'w_club',
    desc: 'İçini kurt yemiş, boydan boya çatlak bir sopa. Bertram verdi: "Kılıç alacak paran olunca kılıç taşırsın."',
  },
  {
    id: 'wooden_club', name: 'Budaklı Sopa', kind: 'weapon', slot: 'weapon', rank: 'G',
    saygınlık: 0, price: 55, dmg: [2, 4], weaponType: 'club', icon: 'club', visual: 'w_club',
    desc: 'Meşe dalından yontulmuş sopa. Ucuz ama sağlam.',
  },
  {
    id: 'hunting_knife', name: 'Av Bıçağı', kind: 'weapon', slot: 'weapon', rank: 'G',
    saygınlık: 1, price: 140, dmg: [2, 4], weaponType: 'dagger', stats: { DEX: 1 }, icon: 'dagger', visual: 'w_dagger',
    desc: 'Avcıların deri yüzmekte kullandığı bıçak. Elde hafif durur.',
  },
  {
    id: 'short_bow', name: 'Kısa Yay', kind: 'weapon', slot: 'weapon', rank: 'G',
    saygınlık: 1, price: 175, dmg: [2, 4], weaponType: 'bow', icon: 'bow', visual: 'w_bow',
    desc: 'Tavşan avı için yapılmış basit bir yay. Ok sınırsız sayılır (köylü idareliği).',
  },
  {
    id: 'iron_shortsword', name: 'Demir Kısa Kılıç', kind: 'weapon', slot: 'weapon', rank: 'F',
    saygınlık: 3, price: 550, dmg: [4, 10], weaponType: 'sword', icon: 'sword_iron', visual: 'w_dagger',
    desc: 'Brindlewood demircisinin elinden çıkmış dengeli bir kılıç.',
  },
  {
    id: 'iron_spear', name: 'Demir Mızrak', kind: 'weapon', slot: 'weapon', rank: 'F',
    saygınlık: 3, price: 475, dmg: [4, 10], weaponType: 'spear', icon: 'spear', visual: 'w_spear',
    desc: 'Uzun saplı mızrak. Düşmanı uzakta tutar.',
  },
  {
    id: 'hunter_bow', name: 'Avcı Yayı', kind: 'weapon', slot: 'weapon', rank: 'F',
    saygınlık: 3, price: 600, dmg: [4, 8], weaponType: 'bow', stats: { DEX: 1 }, icon: 'bow_good', visual: 'w_bow',
    desc: 'Porsuk ağacından, iyi gerilmiş bir yay.',
  },
  {
    id: 'goblin_cleaver', name: 'Goblin Satırı', kind: 'weapon', slot: 'weapon', rank: 'F',
    saygınlık: -1, price: 450, sell: 63, dmg: [4, 10], weaponType: 'sword', stats: { STR: 1 }, icon: 'cleaver', visual: 'w_dagger',
    special: 'Kaba ama ağır.',
    desc: 'Bir goblinin sırtında taşıdığı çentikli satır. Kimden çaldığı belli değil.',
  },

  // ------------------------------------------------------------------ Zırhlar
  {
    id: 'torn_shorts', name: 'Yırtık Şort', kind: 'armor', slot: 'pants', rank: 'G',
    saygınlık: -3, price: 5, sell: 0, def: 0, icon: 'shorts', visual: 'a_shorts',
    desc: 'Ormanda uyandığında üzerindeki tek şey. Utanç verici derecede kısa.',
  },
  {
    id: 'linen_shirt', name: 'Keten Gömlek', kind: 'armor', slot: 'chest', rank: 'G',
    saygınlık: 1, price: 75, def: 0, icon: 'shirt', visual: 'a_shirt',
    desc: 'Bertram\'ın eski gömleklerinden biri. Biraz bol ama temiz.',
  },
  {
    id: 'linen_pants', name: 'Keten Pantolon', kind: 'armor', slot: 'pants', rank: 'G',
    saygınlık: 1, price: 65, def: 1, icon: 'pants', visual: 'a_pants',
    desc: 'Kaba dokunmuş keten pantolon. Dizleri yamalı.',
  },
  {
    id: 'cloth_shoes', name: 'Bez Ayakkabı', kind: 'armor', slot: 'boots', rank: 'G',
    saygınlık: 0, price: 50, def: 0, icon: 'shoes', visual: 'a_shoes',
    desc: 'Taban yerine kalın keçe. En azından ayaklar kanamıyor.',
  },
  {
    id: 'leather_vest', name: 'Deri Yelek', kind: 'armor', slot: 'chest', rank: 'G',
    saygınlık: 2, price: 175, def: 1, stats: { AGI: 1 }, icon: 'vest', visual: 'a_vest',
    desc: 'Hafif, hareketi kısıtlamayan deri yelek.',
  },
  {
    id: 'leather_cap', name: 'Deri Başlık', kind: 'armor', slot: 'helmet', rank: 'G',
    saygınlık: 1, price: 105, def: 1, icon: 'cap', visual: 'a_cap',
    desc: 'Kafayı taşa çarpmaktan korur. Kılıçtan pek değil.',
  },
  {
    id: 'leather_gloves', name: 'Deri Eldiven', kind: 'armor', slot: 'gloves', rank: 'G',
    saygınlık: 1, price: 70, def: 0, stats: { DEX: 1 }, icon: 'gloves', visual: 'a_gloves',
    desc: 'İnce deri. Kavrayışı iyileştirir.',
  },
  {
    id: 'rope_belt', name: 'Örgü Kemer', kind: 'armor', slot: 'belt', rank: 'G',
    saygınlık: 0, price: 55, def: 0, stats: { VIT: 1 }, icon: 'belt', visual: 'a_belt',
    desc: 'Sıkı örülmüş kenevir kemer. Karın kaslarına destek.',
  },
  {
    id: 'leather_boots', name: 'Deri Çizme', kind: 'armor', slot: 'boots', rank: 'G',
    saygınlık: 2, price: 95, def: 1, icon: 'boots', visual: 'a_boots',
    desc: 'Çamura ve dikene dayanıklı çizmeler.',
  },
  {
    id: 'traveler_cape', name: 'Yolcu Pelerini', kind: 'armor', slot: 'cape', rank: 'G',
    saygınlık: 2, price: 80, def: 1, icon: 'cape', visual: 'a_cape',
    desc: 'Rüzgâra ve çiseleyen yağmura karşı yün pelerin.',
  },
  {
    id: 'copper_ring', name: 'Bakır Yüzük', kind: 'armor', slot: 'ring', rank: 'G',
    saygınlık: 1, price: 65, def: 0, stats: { LUK: 1 }, icon: 'ring_copper',
    desc: 'Basit bir bakır halka. Pazarcı "uğurludur" diyor.',
  },
  {
    id: 'wool_vest', name: 'Yün Yelek', kind: 'armor', slot: 'chest', rank: 'G',
    saygınlık: 3, price: 160, def: 1, stats: { VIT: 1 }, icon: 'vest_wool', visual: 'a_vest',
    desc: 'Terzi Mirelle\'in diktiği kalın yün yelek. Soğuğu keser.',
  },
  {
    id: 'felt_hat', name: 'Keçe Başlık', kind: 'armor', slot: 'helmet', rank: 'G',
    saygınlık: 1, price: 85, def: 1, icon: 'hat_felt', visual: 'a_cap',
    desc: 'Sıkıştırılmış yünden başlık. Yağmuru tutar, kılıcı pek tutmaz.',
  },
  {
    id: 'padded_armor', name: 'Kapitone Zırh', kind: 'armor', slot: 'chest', rank: 'F',
    saygınlık: 4, price: 575, def: 3, icon: 'armor_padded', visual: 'a_padded',
    desc: 'Kat kat dikilmiş keten ve yün. Bir kılıç darbesini yutabilir.',
  },
  {
    id: 'iron_cap', name: 'Demir Miğfer', kind: 'armor', slot: 'helmet', rank: 'F',
    saygınlık: 3, price: 375, def: 2, icon: 'helm_iron', visual: 'a_helm',
    desc: 'Basit dövme demir miğfer.',
  },
  {
    id: 'sturdy_pants', name: 'Sağlam Deri Pantolon', kind: 'armor', slot: 'pants', rank: 'F',
    saygınlık: 3, price: 350, def: 2, icon: 'pants_leather', visual: 'a_pants_leather',
    desc: 'Kalın deri, dizlerde takviye.',
  },
  {
    id: 'hobnail_boots', name: 'Nalçalı Çizme', kind: 'armor', slot: 'boots', rank: 'F',
    saygınlık: 2, price: 265, def: 2, icon: 'boots_iron', visual: 'a_boots',
    desc: 'Tabanına demir çivi çakılmış çizme.',
  },
  {
    id: 'rabbit_charm', name: 'Tavşan Ayağı Tılsımı', kind: 'armor', slot: 'necklace', rank: 'G',
    saygınlık: 1, price: 150, sell: 20, def: 0, stats: { LUK: 2 }, icon: 'charm', special: 'Şans getirdiğine inanılır.',
    desc: 'Bir ipe geçirilmiş tavşan ayağı. Tavşan için pek şanslı olmamış.',
  },
  {
    id: 'wolf_fang_necklace', name: 'Kurt Dişi Kolye', kind: 'armor', slot: 'necklace', rank: 'F',
    saygınlık: 2, price: 400, sell: 55, def: 0, stats: { STR: 1, AGI: 1 }, icon: 'fang_necklace', special: 'Yırtıcının cesareti.',
    desc: 'Sürü liderinin dişinden yapılmış kolye.',
  },
  {
    id: 'gnawed_ring', name: 'Kemirilmiş Bakır Yüzük', kind: 'armor', slot: 'ring', rank: 'G',
    saygınlık: 0, price: 75, sell: 10, def: 0, stats: { LUK: 1, AGI: 1 }, icon: 'ring_gnawed',
    desc: 'Bir farenin yuvasından çıktı. Diş izleri hâlâ belli.',
  },
  {
    id: 'slime_gloves', name: 'Yapışkan Eldiven', kind: 'armor', slot: 'gloves', rank: 'G',
    saygınlık: -1, price: 115, sell: 15, def: 0, stats: { DEX: 2 }, icon: 'gloves_slime', special: 'Kavrayış mükemmel, temizlik berbat.',
    desc: 'Sümüksünün içinde erimemiş bir eldiven. Hâlâ yapış yapış.',
  },

  // ------------------------------------------------------------------ Tüketilebilir
  {
    id: 'bread', name: 'Ekmek', kind: 'food', price: 4, sell: 0, stack: true, icon: 'bread',
    effects: [{ type: 'heal', amount: 2 }], desc: 'Kepekli köy ekmeği. 2 HP iyileştirir.',
  },
  {
    id: 'hot_stew', name: 'Sıcak Güveç', kind: 'food', price: 12, sell: 1, stack: true, icon: 'stew',
    effects: [{ type: 'heal', amount: 6 }, { type: 'stamina', amount: 30 }],
    desc: 'Bertram\'ın mutfağından. 6 HP ve 30 dayanıklılık verir.',
  },
  {
    id: 'apple', name: 'Elma', kind: 'food', price: 3, sell: 0, stack: true, icon: 'apple',
    effects: [{ type: 'heal', amount: 1 }, { type: 'stamina', amount: 10 }], desc: 'Ekşi bir yabani elma.',
  },
  {
    id: 'honey_bun', name: 'Ballı Çörek', kind: 'food', price: 9, sell: 0, stack: true, icon: 'bread',
    effects: [{ type: 'heal', amount: 3 }, { type: 'stamina', amount: 20 }], desc: 'Brunhild\'in fırınından, üstü bal parlak. 3 HP ve 20 dayanıklılık.',
  },
  {
    id: 'meat_pie', name: 'Etli Börek', kind: 'food', price: 18, sell: 1, stack: true, icon: 'pie',
    effects: [{ type: 'heal', amount: 8 }, { type: 'stamina', amount: 25 }], desc: 'Kıyır kıyır hamur, içi baharatlı et. 8 HP ve 25 dayanıklılık.',
  },
  {
    id: 'cheese', name: 'Köy Peyniri', kind: 'food', price: 10, sell: 0, stack: true, icon: 'cheese',
    effects: [{ type: 'heal', amount: 4 }, { type: 'stamina', amount: 10 }], desc: 'Rosa\'nın sağdığı sütten. 4 HP ve 10 dayanıklılık.',
  },
  {
    id: 'dried_meat', name: 'Kuru Et', kind: 'food', price: 10, sell: 0, stack: true, icon: 'jerky',
    effects: [{ type: 'heal', amount: 3 }, { type: 'stamina', amount: 15 }], desc: 'Garrick\'in tütsülediği av eti. Sert ama dayanıklı. 3 HP ve 15 dayanıklılık.',
  },
  {
    id: 'hp_potion_s', name: 'Küçük HP İksiri', kind: 'consumable', price: 60, stack: true, icon: 'potion_red',
    effects: [{ type: 'heal', amount: 10 }], desc: 'Kırmızı, acı bir sıvı. 10 HP iyileştirir.',
  },
  {
    id: 'mp_potion_s', name: 'Küçük MP İksiri', kind: 'consumable', price: 90, stack: true, icon: 'potion_blue',
    effects: [{ type: 'mana', amount: 8 }], desc: 'Mavi ve soğuk. 8 MP yeniler.',
  },
  {
    id: 'bandage', name: 'Bez Sargı', kind: 'consumable', price: 15, stack: true, icon: 'bandage',
    effects: [{ type: 'regen', amount: 4, duration: 6 }], desc: '6 saniyede 4 HP iyileştirir. İlk Yardım ile daha etkili.',
  },
  {
    id: 'antidote', name: 'Panzehir', kind: 'consumable', price: 45, stack: true, icon: 'potion_green',
    effects: [{ type: 'cure' }], desc: 'Zehri ve yanmayı söndürür.',
  },

  // ------------------------------------------------------------------ Malzeme
  // Malzemelerin de rütbesi var (kalitesi): G sıradan, F daha zor bulunan av ürünü.
  { id: 'rat_tail', name: 'Fare Kuyruğu', kind: 'material', rank: 'G', price: 3, sell: 1, stack: true, icon: 'rat_tail', desc: 'Şifacılar bir şeyler için kullanıyor. Ne için, sorma.' },
  { id: 'small_stone', name: 'Küçük Taş', kind: 'junk', rank: 'G', price: 1, sell: 0, stack: true, icon: 'stone', desc: 'Pürüzsüz, yuvarlak bir taş. Farenin yuvasında ne arıyordu?' },
  { id: 'slime_jelly', name: 'Sümüksü Jölesi', kind: 'material', rank: 'G', price: 5, sell: 2, stack: true, icon: 'jelly', desc: 'Yapışkan, hafif ışıldayan jöle. Simyacılar sever.' },
  { id: 'color_core', name: 'Renkli Çekirdek', kind: 'material', rank: 'F', price: 25, sell: 8, stack: true, icon: 'core', desc: 'Sümüksünün kalbi. Işığa tutunca renk değiştiriyor.' },
  { id: 'rabbit_meat', name: 'Tavşan Eti', kind: 'material', rank: 'G', price: 6, sell: 3, stack: true, icon: 'meat', desc: 'Taze et. Han mutfağı iyi para verir.' },
  { id: 'rabbit_pelt', name: 'Tavşan Postu', kind: 'material', rank: 'G', price: 12, sell: 5, stack: true, icon: 'pelt_small', desc: 'Yumuşak, beyaz post.' },
  { id: 'wolf_pelt', name: 'Kurt Postu', kind: 'material', rank: 'F', price: 25, sell: 9, stack: true, icon: 'pelt', desc: 'Kalın, gri kurt postu. Demirci ve terziler alır.' },
  { id: 'wolf_fang', name: 'Kurt Dişi', kind: 'material', rank: 'F', price: 14, sell: 5, stack: true, icon: 'fang', desc: 'Sivri bir köpek dişi.' },
  { id: 'goblin_ear', name: 'Goblin Kulağı', kind: 'material', rank: 'F', price: 10, sell: 4, stack: true, icon: 'goblin_ear', desc: 'Sivri, yeşil bir kulak. Lonca av kanıtı olarak kabul ediyor.' },
  { id: 'goblin_trinket', name: 'Goblin Biblosu', kind: 'junk', rank: 'G', price: 8, sell: 3, stack: true, icon: 'trinket', desc: 'Kemik, tüy ve parlak bir düğme. Goblinlere göre çok değerli.' },
  { id: 'herb', name: 'Şifalı Ot', kind: 'material', rank: 'G', price: 5, sell: 2, stack: true, icon: 'herb', desc: 'Ormanda biten acı yapraklı ot. Şifacı alır.' },
  { id: 'firewood', name: 'Odun', kind: 'material', rank: 'G', price: 2, sell: 1, stack: true, icon: 'wood', desc: 'Kuru odun parçası.' },
  { id: 'chief_tusk', name: 'Şef Dişi', kind: 'material', rank: 'F', price: 120, sell: 40, stack: true, icon: 'tusk', desc: 'Goblin şefinin kırık dişi. Bir kahramanlık kanıtı.' },

  // ------------------------------------------------------------------ Kitap / parşömen
  {
    id: 'book_fire', name: 'Ateş Büyüsü: İlk Kıvılcım', kind: 'book', price: 900, stack: true, icon: 'book_red',
    effects: [{ type: 'learnSkill', skill: 'fire_magic' }],
    desc: 'Okununca Ateş Büyüsü (Nadir) öğrenilir. Haftalık skill sınırına tabidir.',
  },
  {
    id: 'scroll_spark', name: 'Kıvılcım Parşömeni', kind: 'book', price: 600, sell: 100, stack: true, icon: 'scroll',
    effects: [{ type: 'learnSkill', skill: 'fire_magic' }],
    desc: 'Goblin şamanının sakladığı yanık kenarlı parşömen. Okununca Ateş Büyüsü öğrenilir.',
  },
  {
    id: 'book_archery', name: 'Okçunun El Kitabı', kind: 'book', price: 180, stack: true, icon: 'book_green',
    effects: [{ type: 'learnSkill', skill: 'archery' }],
    desc: 'Okununca Okçuluk (Sıradan) öğrenilir.',
  },
  {
    id: 'book_firstaid', name: 'Sargı ve Merhem', kind: 'book', price: 120, stack: true, icon: 'book_white',
    effects: [{ type: 'learnSkill', skill: 'first_aid' }],
    desc: 'Okununca İlk Yardım (Sıradan) öğrenilir.',
  },

  // ------------------------------------------------------------------ Görev / özel
  { id: 'guild_card', name: 'Lonca Kartı', kind: 'quest', price: 0, bound: true, icon: 'card', desc: 'Brindlewood şubesinin mühürlü maceracı kartı.' },
  { id: 'guild_letter', name: 'Mühürlü Mektup', kind: 'quest', price: 0, bound: true, icon: 'scroll', desc: 'Lonca mührüyle kapatılmış bir mektup. Kaptan Roderick\'e.' },
  { id: 'steward_purse', name: 'Kâhyanın Kesesi', kind: 'quest', price: 0, bound: true, icon: 'trinket', desc: 'Kâhya Edric\'in işlemeli deri kesesi. Ağır.' },
  { id: 'side_parcel', name: 'Bağlı Paket', kind: 'quest', price: 0, bound: true, icon: 'trinket', desc: 'Sıkı sıkı bağlanmış bir paket. Açmak sana düşmez.' },
  { id: 'map_village', name: 'Brindlewood Haritası', kind: 'quest', price: 60, icon: 'map', desc: 'Köyün elle çizilmiş haritası. Kullanınca haritada köy açılır.' },
  { id: 'map_forest_deep', name: 'Harita Parçası: Orman Derinlikleri', kind: 'quest', price: 0, icon: 'map_piece', desc: 'Goblinlerin çizdiği kaba bir harita. Kullanınca ormanın derinlikleri açılır.' },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((i) => [i.id, i]));

export function item(id: string): ItemDef {
  const d = ITEMS[id];
  if (!d) throw new Error('Bilinmeyen eşya: ' + id);
  return d;
}
