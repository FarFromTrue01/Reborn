import type { ItemDef } from '../core/types';

// Tüm eşyalar. Fiyatlar bronz cinsindendir (1 Gümüş = 100 Bronz).
// Yeni eşya eklemek için bu listeye bir kayıt eklemek yeterli.

const list: ItemDef[] = [
  // ------------------------------------------------------------------ Silahlar
  {
    id: 'rusty_shortsword', name: 'Paslı Kısa Kılıç', kind: 'weapon', slot: 'weapon', rank: 'G',
    price: 60, dmg: [1, 2], weaponType: 'sword', icon: 'sword_rusty', visual: 'w_dagger',
    desc: 'Kenarları körelmiş, pası kazınmamış bir kısa kılıç. Hiç yoktan iyidir.',
  },
  {
    id: 'wooden_club', name: 'Budaklı Sopa', kind: 'weapon', slot: 'weapon', rank: 'G',
    price: 22, dmg: [1, 2], weaponType: 'club', icon: 'club', visual: 'w_club',
    desc: 'Meşe dalından yontulmuş sopa. Ucuz ama sağlam.',
  },
  {
    id: 'hunting_knife', name: 'Av Bıçağı', kind: 'weapon', slot: 'weapon', rank: 'G',
    price: 55, dmg: [1, 2], weaponType: 'dagger', stats: { DEX: 1 }, icon: 'dagger', visual: 'w_dagger',
    desc: 'Avcıların deri yüzmekte kullandığı bıçak. Elde hafif durur.',
  },
  {
    id: 'short_bow', name: 'Kısa Yay', kind: 'weapon', slot: 'weapon', rank: 'G',
    price: 70, dmg: [1, 2], weaponType: 'bow', icon: 'bow', visual: 'w_bow',
    desc: 'Tavşan avı için yapılmış basit bir yay. Ok sınırsız sayılır (köylü idareliği).',
  },
  {
    id: 'iron_shortsword', name: 'Demir Kısa Kılıç', kind: 'weapon', slot: 'weapon', rank: 'F',
    price: 220, dmg: [2, 5], weaponType: 'sword', icon: 'sword_iron', visual: 'w_dagger',
    desc: 'Brindlewood demircisinin elinden çıkmış dengeli bir kılıç.',
  },
  {
    id: 'iron_spear', name: 'Demir Mızrak', kind: 'weapon', slot: 'weapon', rank: 'F',
    price: 190, dmg: [2, 5], weaponType: 'spear', icon: 'spear', visual: 'w_spear',
    desc: 'Uzun saplı mızrak. Düşmanı uzakta tutar.',
  },
  {
    id: 'hunter_bow', name: 'Avcı Yayı', kind: 'weapon', slot: 'weapon', rank: 'F',
    price: 240, dmg: [2, 4], weaponType: 'bow', stats: { DEX: 1 }, icon: 'bow_good', visual: 'w_bow',
    desc: 'Porsuk ağacından, iyi gerilmiş bir yay.',
  },
  {
    id: 'goblin_cleaver', name: 'Goblin Satırı', kind: 'weapon', slot: 'weapon', rank: 'F',
    price: 180, dmg: [2, 5], weaponType: 'sword', stats: { STR: 1 }, icon: 'cleaver', visual: 'w_dagger',
    special: 'Kaba ama ağır.',
    desc: 'Bir goblinin sırtında taşıdığı çentikli satır. Kimden çaldığı belli değil.',
  },

  // ------------------------------------------------------------------ Zırhlar
  {
    id: 'torn_shorts', name: 'Yırtık Şort', kind: 'armor', slot: 'pants', rank: 'G',
    price: 2, sell: 0, def: 0, icon: 'shorts', visual: 'a_shorts',
    desc: 'Ormanda uyandığında üzerindeki tek şey. Utanç verici derecede kısa.',
  },
  {
    id: 'linen_shirt', name: 'Keten Gömlek', kind: 'armor', slot: 'chest', rank: 'G',
    price: 30, def: 0, icon: 'shirt', visual: 'a_shirt',
    desc: 'Bertram\'ın eski gömleklerinden biri. Biraz bol ama temiz.',
  },
  {
    id: 'linen_pants', name: 'Keten Pantolon', kind: 'armor', slot: 'pants', rank: 'G',
    price: 26, def: 1, icon: 'pants', visual: 'a_pants',
    desc: 'Kaba dokunmuş keten pantolon. Dizleri yamalı.',
  },
  {
    id: 'cloth_shoes', name: 'Bez Ayakkabı', kind: 'armor', slot: 'boots', rank: 'G',
    price: 20, def: 0, icon: 'shoes', visual: 'a_shoes',
    desc: 'Taban yerine kalın keçe. En azından ayaklar kanamıyor.',
  },
  {
    id: 'leather_vest', name: 'Deri Yelek', kind: 'armor', slot: 'chest', rank: 'G',
    price: 70, def: 1, stats: { AGI: 1 }, icon: 'vest', visual: 'a_vest',
    desc: 'Hafif, hareketi kısıtlamayan deri yelek.',
  },
  {
    id: 'leather_cap', name: 'Deri Başlık', kind: 'armor', slot: 'helmet', rank: 'G',
    price: 42, def: 1, icon: 'cap', visual: 'a_cap',
    desc: 'Kafayı taşa çarpmaktan korur. Kılıçtan pek değil.',
  },
  {
    id: 'leather_gloves', name: 'Deri Eldiven', kind: 'armor', slot: 'gloves', rank: 'G',
    price: 28, def: 0, stats: { DEX: 1 }, icon: 'gloves', visual: 'a_gloves',
    desc: 'İnce deri. Kavrayışı iyileştirir.',
  },
  {
    id: 'rope_belt', name: 'Örgü Kemer', kind: 'armor', slot: 'belt', rank: 'G',
    price: 22, def: 0, stats: { VIT: 1 }, icon: 'belt', visual: 'a_belt',
    desc: 'Sıkı örülmüş kenevir kemer. Karın kaslarına destek.',
  },
  {
    id: 'leather_boots', name: 'Deri Çizme', kind: 'armor', slot: 'boots', rank: 'G',
    price: 38, def: 1, icon: 'boots', visual: 'a_boots',
    desc: 'Çamura ve dikene dayanıklı çizmeler.',
  },
  {
    id: 'traveler_cape', name: 'Yolcu Pelerini', kind: 'armor', slot: 'cape', rank: 'G',
    price: 32, def: 1, icon: 'cape', visual: 'a_cape',
    desc: 'Rüzgâra ve çiseleyen yağmura karşı yün pelerin.',
  },
  {
    id: 'copper_ring', name: 'Bakır Yüzük', kind: 'armor', slot: 'ring', rank: 'G',
    price: 25, def: 0, stats: { LUK: 1 }, icon: 'ring_copper',
    desc: 'Basit bir bakır halka. Pazarcı "uğurludur" diyor.',
  },
  {
    id: 'padded_armor', name: 'Kapitone Zırh', kind: 'armor', slot: 'chest', rank: 'F',
    price: 230, def: 3, icon: 'armor_padded', visual: 'a_padded',
    desc: 'Kat kat dikilmiş keten ve yün. Bir kılıç darbesini yutabilir.',
  },
  {
    id: 'iron_cap', name: 'Demir Miğfer', kind: 'armor', slot: 'helmet', rank: 'F',
    price: 150, def: 2, icon: 'helm_iron', visual: 'a_helm',
    desc: 'Basit dövme demir miğfer.',
  },
  {
    id: 'sturdy_pants', name: 'Sağlam Deri Pantolon', kind: 'armor', slot: 'pants', rank: 'F',
    price: 140, def: 2, icon: 'pants_leather', visual: 'a_pants_leather',
    desc: 'Kalın deri, dizlerde takviye.',
  },
  {
    id: 'hobnail_boots', name: 'Nalçalı Çizme', kind: 'armor', slot: 'boots', rank: 'F',
    price: 105, def: 2, icon: 'boots_iron', visual: 'a_boots',
    desc: 'Tabanına demir çivi çakılmış çizme.',
  },
  {
    id: 'rabbit_charm', name: 'Tavşan Ayağı Tılsımı', kind: 'armor', slot: 'necklace', rank: 'G',
    price: 60, def: 0, stats: { LUK: 2 }, icon: 'charm', special: 'Şans getirdiğine inanılır.',
    desc: 'Bir ipe geçirilmiş tavşan ayağı. Tavşan için pek şanslı olmamış.',
  },
  {
    id: 'wolf_fang_necklace', name: 'Kurt Dişi Kolye', kind: 'armor', slot: 'necklace', rank: 'F',
    price: 160, def: 0, stats: { STR: 1, AGI: 1 }, icon: 'fang_necklace', special: 'Yırtıcının cesareti.',
    desc: 'Sürü liderinin dişinden yapılmış kolye.',
  },
  {
    id: 'gnawed_ring', name: 'Kemirilmiş Bakır Yüzük', kind: 'armor', slot: 'ring', rank: 'G',
    price: 30, def: 0, stats: { LUK: 1, AGI: 1 }, icon: 'ring_gnawed',
    desc: 'Bir farenin yuvasından çıktı. Diş izleri hâlâ belli.',
  },
  {
    id: 'slime_gloves', name: 'Yapışkan Eldiven', kind: 'armor', slot: 'gloves', rank: 'G',
    price: 45, def: 0, stats: { DEX: 2 }, icon: 'gloves_slime', special: 'Kavrayış mükemmel, temizlik berbat.',
    desc: 'Sümüksünün içinde erimemiş bir eldiven. Hâlâ yapış yapış.',
  },

  // ------------------------------------------------------------------ Tüketilebilir
  {
    id: 'bread', name: 'Ekmek', kind: 'food', price: 1, sell: 0, stack: true, icon: 'bread',
    effects: [{ type: 'heal', amount: 2 }], desc: 'Kepekli köy ekmeği. 2 HP iyileştirir.',
  },
  {
    id: 'hot_stew', name: 'Sıcak Güveç', kind: 'food', price: 4, sell: 1, stack: true, icon: 'stew',
    effects: [{ type: 'heal', amount: 6 }, { type: 'stamina', amount: 30 }],
    desc: 'Bertram\'ın mutfağından. 6 HP ve 30 dayanıklılık verir.',
  },
  {
    id: 'apple', name: 'Elma', kind: 'food', price: 1, sell: 0, stack: true, icon: 'apple',
    effects: [{ type: 'heal', amount: 1 }, { type: 'stamina', amount: 10 }], desc: 'Ekşi bir yabani elma.',
  },
  {
    id: 'hp_potion_s', name: 'Küçük HP İksiri', kind: 'consumable', price: 20, stack: true, icon: 'potion_red',
    effects: [{ type: 'heal', amount: 10 }], desc: 'Kırmızı, acı bir sıvı. 10 HP iyileştirir.',
  },
  {
    id: 'mp_potion_s', name: 'Küçük MP İksiri', kind: 'consumable', price: 30, stack: true, icon: 'potion_blue',
    effects: [{ type: 'mana', amount: 8 }], desc: 'Mavi ve soğuk. 8 MP yeniler.',
  },
  {
    id: 'bandage', name: 'Bez Sargı', kind: 'consumable', price: 5, stack: true, icon: 'bandage',
    effects: [{ type: 'regen', amount: 4, duration: 6 }], desc: '6 saniyede 4 HP iyileştirir. İlk Yardım ile daha etkili.',
  },
  {
    id: 'antidote', name: 'Panzehir', kind: 'consumable', price: 15, stack: true, icon: 'potion_green',
    effects: [{ type: 'cure' }], desc: 'Zehri ve yanmayı söndürür.',
  },

  // ------------------------------------------------------------------ Malzeme
  { id: 'rat_tail', name: 'Fare Kuyruğu', kind: 'material', price: 3, sell: 1, stack: true, icon: 'rat_tail', desc: 'Şifacılar bir şeyler için kullanıyor. Ne için, sorma.' },
  { id: 'small_stone', name: 'Küçük Taş', kind: 'junk', price: 1, sell: 0, stack: true, icon: 'stone', desc: 'Pürüzsüz, yuvarlak bir taş. Farenin yuvasında ne arıyordu?' },
  { id: 'slime_jelly', name: 'Sümüksü Jölesi', kind: 'material', price: 5, sell: 2, stack: true, icon: 'jelly', desc: 'Yapışkan, hafif ışıldayan jöle. Simyacılar sever.' },
  { id: 'color_core', name: 'Renkli Çekirdek', kind: 'material', price: 25, sell: 8, stack: true, icon: 'core', desc: 'Sümüksünün kalbi. Işığa tutunca renk değiştiriyor.' },
  { id: 'rabbit_meat', name: 'Tavşan Eti', kind: 'material', price: 6, sell: 3, stack: true, icon: 'meat', desc: 'Taze et. Han mutfağı iyi para verir.' },
  { id: 'rabbit_pelt', name: 'Tavşan Postu', kind: 'material', price: 12, sell: 5, stack: true, icon: 'pelt_small', desc: 'Yumuşak, beyaz post.' },
  { id: 'wolf_pelt', name: 'Kurt Postu', kind: 'material', price: 25, sell: 9, stack: true, icon: 'pelt', desc: 'Kalın, gri kurt postu. Demirci ve terziler alır.' },
  { id: 'wolf_fang', name: 'Kurt Dişi', kind: 'material', price: 14, sell: 5, stack: true, icon: 'fang', desc: 'Sivri bir köpek dişi.' },
  { id: 'goblin_ear', name: 'Goblin Kulağı', kind: 'material', price: 10, sell: 4, stack: true, icon: 'goblin_ear', desc: 'Sivri, yeşil bir kulak. Lonca av kanıtı olarak kabul ediyor.' },
  { id: 'goblin_trinket', name: 'Goblin Biblosu', kind: 'junk', price: 8, sell: 3, stack: true, icon: 'trinket', desc: 'Kemik, tüy ve parlak bir düğme. Goblinlere göre çok değerli.' },
  { id: 'herb', name: 'Şifalı Ot', kind: 'material', price: 5, sell: 2, stack: true, icon: 'herb', desc: 'Ormanda biten acı yapraklı ot. Şifacı alır.' },
  { id: 'firewood', name: 'Odun', kind: 'material', price: 2, sell: 1, stack: true, icon: 'wood', desc: 'Kuru odun parçası.' },
  { id: 'chief_tusk', name: 'Şef Dişi', kind: 'material', price: 120, sell: 40, stack: true, icon: 'tusk', desc: 'Goblin şefinin kırık dişi. Bir kahramanlık kanıtı.' },

  // ------------------------------------------------------------------ Kitap / parşömen
  {
    id: 'book_fire', name: 'Ateş Büyüsü: İlk Kıvılcım', kind: 'book', price: 450, stack: true, icon: 'book_red',
    effects: [{ type: 'learnSkill', skill: 'fire_magic' }],
    desc: 'Okununca Ateş Büyüsü (Nadir) öğrenilir. Haftalık skill sınırına tabidir.',
  },
  {
    id: 'scroll_spark', name: 'Kıvılcım Parşömeni', kind: 'book', price: 300, stack: true, icon: 'scroll',
    effects: [{ type: 'learnSkill', skill: 'fire_magic' }],
    desc: 'Goblin şamanının sakladığı yanık kenarlı parşömen. Okununca Ateş Büyüsü öğrenilir.',
  },
  {
    id: 'book_archery', name: 'Okçunun El Kitabı', kind: 'book', price: 90, stack: true, icon: 'book_green',
    effects: [{ type: 'learnSkill', skill: 'archery' }],
    desc: 'Okununca Okçuluk (Sıradan) öğrenilir.',
  },
  {
    id: 'book_firstaid', name: 'Sargı ve Merhem', kind: 'book', price: 60, stack: true, icon: 'book_white',
    effects: [{ type: 'learnSkill', skill: 'first_aid' }],
    desc: 'Okununca İlk Yardım (Sıradan) öğrenilir.',
  },

  // ------------------------------------------------------------------ Görev / özel
  { id: 'guild_card', name: 'Lonca Kartı', kind: 'quest', price: 0, bound: true, icon: 'card', desc: 'Brindlewood şubesinin mühürlü maceracı kartı.' },
  { id: 'map_village', name: 'Brindlewood Haritası', kind: 'quest', price: 10, icon: 'map', desc: 'Köyün elle çizilmiş haritası. Kullanınca haritada köy açılır.' },
  { id: 'map_forest_deep', name: 'Harita Parçası: Orman Derinlikleri', kind: 'quest', price: 0, icon: 'map_piece', desc: 'Goblinlerin çizdiği kaba bir harita. Kullanınca ormanın derinlikleri açılır.' },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((i) => [i.id, i]));

export function item(id: string): ItemDef {
  const d = ITEMS[id];
  if (!d) throw new Error('Bilinmeyen eşya: ' + id);
  return d;
}
