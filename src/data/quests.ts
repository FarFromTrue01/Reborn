// Görev tanımları (C2). Ana görevler "m_" ile başlar. Joseph G olana kadar her şey ana görevdir
// (panodaki G görevleri dahil); yan görevler ve isteğe bağlı pano görevleri G olduktan sonra açılır.
import type { QuestDef } from '../core/quests';
import { SIDE_QUESTS } from './sidequests';

const W = (point: string, radius = 2) => ({ map: 'world', point, radius });
const NPC = (map: string, npc: string) => ({ map, npc });

export const MAIN_QUESTS: QuestDef[] = [
  // ===================================================================== Bölüm I — Köksüz
  {
    id: 'm_inn', kind: 'main', chapter: 1, title: 'Hana Git',
    desc: 'Ormanda, üstümde yırtık bir şortla uyandım. Ağaçların arasından bir köy görünüyor. Han varsa iş de vardır.',
    objectives: [{ type: 'go', label: 'Brindlewood\'daki hana git', target: 'inn', where: W('door_inn', 1.5) }],
    reward: { text: 'Bir başlangıç' },
  },
  {
    id: 'm_bertram', kind: 'main', chapter: 1, title: 'Bertram\'ın İşi', giver: 'bertram',
    desc: 'Bertram üç gün çalışmamı istiyor: bulaşık, odun, masa. Günde bir vardiya. Üçüncü günün akşamı elli bronz ve üstüne kıyafet.',
    objectives: [{ type: 'custom', label: 'Handa çalış (Bertram\'la konuş)', target: 'shift', count: 3, where: NPC('inn', 'bertram') }],
    reward: { money: 50, text: 'Keten gömlek, pantolon ve ayakkabı' },
  },
  {
    id: 'm_harvest', kind: 'main', chapter: 1, title: 'Haldor\'un Hasadı', giver: 'bertram',
    desc: 'Bertram\'ın eski dostu Yaşlı Haldor\'un buğday tarlası köyün kuzeydoğusunda. Hasada yardım edersem elli bronz verecek.',
    objectives: [
      { type: 'talk', label: 'Yaşlı Haldor\'u bul', target: 'haldor', where: { map: 'world', npc: 'haldor', point: 'haldor_field' } },
      { type: 'custom', label: 'Hasada yardım et (06:00–16:00)', target: 'harvest', where: { map: 'world', npc: 'haldor', point: 'haldor_field' }, sequential: true },
    ],
    reward: { money: 50 },
  },
  {
    id: 'm_register', kind: 'main', chapter: 1, title: 'Lonca Kaydı', giver: 'bertram',
    desc: 'Maceracılar Loncası kimin oğlu olduğuna bakmaz, rütbene bakar. Kayıt bir gümüş.',
    objectives: [
      { type: 'custom', label: 'Bir gümüş biriktir (100 bronz)', target: 'silver' },
      { type: 'talk', label: 'Loncada Celeste\'ye kaydol', target: 'celeste', where: NPC('guild', 'celeste'), sequential: true },
    ],
    reward: { text: 'Lonca Kartı (G-)' },
  },

  // ===================================================================== Bölüm II — G- Rütbe
  {
    id: 'm_weapon', kind: 'main', chapter: 2, title: 'Eli Boş Maceracı', giver: 'bertram',
    desc: 'Lonca kartım var ama silahım yok. Bertram\'ın söyleyecek bir şeyi var gibi.',
    objectives: [{ type: 'talk', label: 'Handa Bertram\'la konuş', target: 'bertram', where: NPC('inn', 'bertram') }],
    reward: { text: 'Bir silah... sayılır.' },
  },
  {
    id: 'm_grank', kind: 'main', chapter: 2, title: 'G- Rütbe', giver: 'celeste',
    desc: 'Pano açıldı. Celeste bana yalnızca G görevlerini gösteriyor. G rütbesine yükselmek için 40 Lonca Puanı lazım.',
    objectives: [
      { type: 'custom', label: 'G görevi: Ahırdaki Fareler', target: 'g1_rats' },
      { type: 'custom', label: 'G görevi: Şifacıya Ot', target: 'g2_herbs' },
      { type: 'custom', label: 'G görevi: Kontrol Noktasına Mektup', target: 'g3_letter' },
    ],
    reward: { text: '30 Lonca Puanı' },
  },
  {
    id: 'g1_rats', kind: 'main', chapter: 2, rank: 'G', guild: true, title: 'Ahırdaki Fareler', giver: 'celeste',
    desc: 'Haldor\'un ahırı (kuzeydeki büyük ahır) farelerle dolmuş. Kanıt olarak kuyruklarını getir. Ödül 20 bronz.',
    objectives: [
      { type: 'kill', label: 'Ahırdaki fareleri temizle', target: 'barn_rat', count: 6, where: W('barn_yard', 4) },
      { type: 'talk', label: 'Celeste\'ye teslim et', target: 'celeste', where: NPC('guild', 'celeste'), sequential: true },
    ],
    reward: { money: 20, points: 10 },
  },
  {
    id: 'g2_herbs', kind: 'main', chapter: 2, rank: 'G', guild: true, title: 'Şifacıya Ot', giver: 'celeste',
    desc: 'Ilse Nine\'nin şifalı ot stoğu bitmiş. Ormandan beş şifalı ot topla, şifacıya götür. İlanda ödül 30 bronz yazıyor.',
    objectives: [
      { type: 'collect', label: 'Şifalı ot topla', target: 'herb', count: 5, where: { map: 'world', point: 'forest_edge', radius: 6 } },
      { type: 'deliver', label: 'Otları Ilse Nine\'ye götür', target: 'healer', where: NPC('healer', 'healer'), sequential: true },
      { type: 'talk', label: 'Celeste\'den ödülü al', target: 'celeste', where: NPC('guild', 'celeste'), sequential: true },
    ],
    reward: { money: 30, points: 10 },
  },
  {
    id: 'g3_letter', kind: 'main', chapter: 2, rank: 'G', guild: true, title: 'Kontrol Noktasına Mektup', giver: 'celeste',
    desc: 'Lonca mühürlü bir mektubu Kaptan Roderick\'e götür. Ödül 30 bronz.',
    objectives: [
      { type: 'deliver', label: 'Mektubu Kaptan Roderick\'e ver', target: 'captain', where: { map: 'world', npc: 'captain', point: 'checkpoint' } },
      { type: 'talk', label: 'Celeste\'den ödülü al', target: 'celeste', where: NPC('guild', 'celeste'), sequential: true },
    ],
    reward: { money: 30, points: 10 },
  },
  {
    id: 'm_air', kind: 'main', chapter: 2, title: 'Biraz Hava',
    desc: 'İlk gerçek ödülüm cebimde. Biraz hava almam lazım. Ormanın kenarı sakin olur.',
    objectives: [{ type: 'go', label: 'Ormanın kenarına yürü', target: 'forest_edge', where: W('forest_edge', 3) }],
    reward: {},
  },
  {
    id: 'm_wounded', kind: 'main', chapter: 2, title: 'Yaralılar',
    desc: 'Vera ve Lina ormanın kenarında, yaralı. Goblin görevleri başarısız olmuş. Onları köye, Ilse Nine\'ye götürmem lazım.',
    objectives: [
      { type: 'go', label: 'Lina\'yı taşı; Vera\'yla şifacıya git', target: 'healer', where: W('door_healer', 1.5) },
      { type: 'custom', label: 'Ilse Nine\'ye tedaviyi öde (30 bronz)', target: 'pay_healer', where: NPC('healer', 'healer'), sequential: true },
    ],
    reward: {},
  },
  {
    id: 'f_wolves', kind: 'main', chapter: 2, rank: 'F', guild: true, group: true, title: 'Otlaktaki Kurtlar', giver: 'lina',
    desc: 'Çoban Tam\'ın otlağına kurtlar dadanmış. Vera ve Lina\'yla ortak bir F görevi: toplam 120 bronz, üçe eşit. Grup görevi: Lonca Puanının yarısı.',
    objectives: [
      { type: 'go', label: 'Vera ve Lina\'yla otlağa git', target: 'pasture', where: W('pasture', 4) },
      { type: 'kill', label: 'Kurtları kov', target: 'wolf', count: 3, where: W('pasture', 6), sequential: true },
      { type: 'talk', label: 'Celeste\'ye rapor ver', target: 'celeste', where: NPC('guild', 'celeste'), sequential: true },
    ],
    reward: { money: 40, points: 30, text: 'Toplam 120 bronz, kişi başı 40' },
  },
  {
    id: 'm_promotion', kind: 'main', chapter: 2, title: 'Kayıtlar Yarın İşlenir', giver: 'celeste',
    desc: 'G eşiğini geçtim. Celeste\'ye göre kayıtlar yarın işlenecek.',
    objectives: [{ type: 'talk', label: 'Ertesi gün loncaya uğra', target: 'celeste', where: NPC('guild', 'celeste') }],
    reward: { text: 'G rütbe' },
  },
  {
    id: 'm_celebrate', kind: 'main', chapter: 2, title: 'İlk Kadeh', giver: 'vera',
    desc: 'Vera akşam handa beklediğini söyledi. "Geç kalma, köksüz."',
    objectives: [{ type: 'go', label: 'Akşam (18:00 sonrası) hana git', target: 'inn_evening', where: W('door_inn', 1.5) }],
    reward: {},
  },
  {
    id: 'm_theft', kind: 'main', chapter: 2, title: 'Kâhyanın Kesesi', giver: 'steward',
    desc: 'Kâhya Edric\'in kesesi çalındı. Köksüz olduğum için ilk şüpheli benim. Hırsız düşük rütbeli biriymiş: Appraisal ile okuyabilirim.',
    objectives: [
      { type: 'custom', label: 'Şüphelileri Appraisal ile incele', target: 'suspects', count: 4 },
      { type: 'custom', label: 'Hırsızı bir muhafıza göster', target: 'accuse', where: { map: 'world', npc: 'guard_hob', point: 'guardpost' }, sequential: true },
    ],
    reward: { text: 'Birkaç bronz ve bir "Dikkatli ol, köksüz."' },
  },
  {
    id: 'f_cellar', kind: 'main', chapter: 2, rank: 'F', guild: true, group: true, title: 'Değirmen Bodrumundaki Dev Fareler', giver: 'vera',
    desc: 'Değirmenci Oswin\'in bodrumuna dev fareler dadanmış. Vera ve Lina\'yla ikinci ortak görev: toplam 90 bronz, kişi başı 30.',
    objectives: [
      { type: 'go', label: 'Değirmene git', target: 'mill', where: W('mill_yard', 2) },
      { type: 'kill', label: 'Bodrumdaki dev fareleri temizle', target: 'giant_rat', count: 4, where: { map: 'mill_cellar', x: 6, y: 5 }, sequential: true },
      { type: 'talk', label: 'Celeste\'ye rapor ver', target: 'celeste', where: NPC('guild', 'celeste'), sequential: true },
    ],
    reward: { money: 30, points: 30, text: 'Toplam 90 bronz, kişi başı 30' },
  },
  {
    id: 'm_silver', kind: 'main', chapter: 2, title: '10 Gümüş',
    desc: 'Şehre giriş kartı üç aylık ve 10 gümüş. Yan görevler, pano, av ve toplayıcılıkla biriktirmem lazım.',
    objectives: [{ type: 'custom', label: '10 gümüş biriktir (1.000 bronz)', target: 'silver10', count: 1000 }],
    reward: {},
  },
  {
    id: 'm_farewell', kind: 'main', chapter: 2, title: 'Veda', giver: 'bertram',
    desc: 'On gümüş tamam. Gitmeden önce Bertram\'la konuşmalıyım.',
    objectives: [{ type: 'talk', label: 'Handa Bertram\'la konuş', target: 'bertram', where: NPC('inn', 'bertram') }],
    reward: {},
  },
  {
    id: 'm_gate', kind: 'main', chapter: 2, title: 'Şehir Kapısı', giver: 'bertram',
    desc: 'Kontrol noktasında Kaptan Roderick\'ten giriş kartı alacağım. Ötesi: kraliyet şehri.',
    objectives: [{ type: 'talk', label: 'Kaptan Roderick\'ten giriş kartı al (10 gümüş)', target: 'captain', where: { map: 'world', npc: 'captain', point: 'checkpoint' } }],
    reward: { text: 'Giriş Kartı (3 ay)' },
  },
];

const ALL: Record<string, QuestDef> = Object.fromEntries([...MAIN_QUESTS, ...SIDE_QUESTS].map((q) => [q.id, q]));

export function questDef(id: string): QuestDef | undefined {
  return ALL[id];
}

export const QUEST_IDS = Object.keys(ALL);
