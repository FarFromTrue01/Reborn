// Görev tanımları (C2). Ana görevler "m_" ile başlar. Joseph G olana kadar her şey ana görevdir
// (panodaki G görevleri dahil); yan görevler ve isteğe bağlı pano görevleri G olduktan sonra açılır.
import type { QuestDef } from '../core/quests';
import { rankupQuestId } from '../core/guild';
import { subRankToString, type SubRank } from '../core/ranks';
import { SIDE_QUESTS } from './sidequests';

const W = (point: string, radius = 2) => ({ map: 'world', point, radius });
const NPC = (map: string, npc: string) => ({ map, npc });

export const MAIN_QUESTS: QuestDef[] = [
  // ===================================================================== Bölüm I — Köksüz
  {
    id: 'm_inn', kind: 'main', chapter: 1, title: 'Hana Git',
    desc: 'Ormanda, üstümde yırtık bir şortla uyandım. Ağaçların arasından bir köy görünüyor. Han varsa iş de vardır.',
    objectives: [
      { type: 'go', label: 'Brindlewood\'daki hana git', target: 'inn', where: W('door_inn', 1.5) },
      // A7.9 (0.10.0): handaki Appraisal öğreticisi sırasında da bir amaç görünür
      { type: 'custom', label: 'Vera\'yı Appraisal ile incele', target: 'appraise_vera', where: NPC('inn', 'vera'), sequential: true },
    ],
    reward: { text: 'Bir başlangıç' },
  },
  {
    id: 'm_bertram', kind: 'main', chapter: 1, title: 'Bertram\'ın İşi', giver: 'bertram',
    desc: 'Bertram iki gün çalışmamı istiyor: bulaşık, odun, masa. Günde bir vardiya, akşam yemeği ondan. İkinci günün akşamı elli bronz ve üstüne kıyafet.',
    objectives: [{ type: 'custom', label: 'Handa çalış (Bertram\'la konuş)', target: 'shift', count: 2, where: NPC('inn', 'bertram') }],
    reward: { money: 50, text: 'Keten gömlek, pantolon ve ayakkabı' },
  },
  {
    id: 'm_harvest', kind: 'main', chapter: 1, title: 'Haldor\'un Hasadı', giver: 'bertram',
    desc: 'Bertram\'ın eski dostu Yaşlı Haldor\'un buğday tarlası köyün kuzeydoğusunda. Hasada yardım edersem elli bronz verecek.',
    objectives: [
      // 0.6.0: hedef Haldor'un kendisi (gün içinde tarla ↔ çiftlik evi arasında gidip gelir; bkz. world/reach)
      { type: 'talk', label: 'Yaşlı Haldor\'u bul', target: 'haldor', where: NPC('world', 'haldor') },
      { type: 'custom', label: 'Hasada yardım et (06:00–16:00)', target: 'harvest', where: NPC('world', 'haldor'), sequential: true },
    ],
    reward: { money: 50 },
  },
  {
    id: 'm_register', kind: 'main', chapter: 1, title: 'Lonca Kaydı', giver: 'bertram',
    desc: 'Maceracılar Loncası kimin oğlu olduğuna bakmaz, rütbene bakar. Kayıt bir gümüş.',
    objectives: [
      { type: 'custom', label: 'Bir gümüş biriktir (100 bronz)', target: 'silver', where: NPC('guild', 'celeste') },
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
    // 0.6.0: "pano yarın açılır" beklemesi kalktı; sopayı alınca aynı gün loncaya dönülür.
    id: 'm_board', kind: 'main', chapter: 2, title: 'Pano', giver: 'bertram',
    desc: 'Elimde bir sopa var. Sopa sayılırsa. Artık panodan iş alabilirim; ilanları Celeste dağıtıyor.',
    objectives: [{ type: 'custom', label: 'Loncaya dön, panodan görev al', target: 'board_open', where: NPC('guild', 'celeste') }],
    reward: {},
  },
  {
    id: 'm_grank', kind: 'main', chapter: 2, title: 'G- Rütbe', giver: 'celeste',
    desc: 'Pano açıldı. Celeste bana yalnızca G görevlerini gösteriyor. G rütbesine yükselmek için 40 Lonca Puanı lazım.',
    objectives: [
      { type: 'custom', label: 'G görevi: Ahırdaki Fareler', target: 'g1_rats', where: W('barn_yard', 4) },
      { type: 'custom', label: 'G görevi: Şifacıya Ot', target: 'g2_herbs', where: W('forest_edge', 6) },
      { type: 'custom', label: 'G görevi: Kontrol Noktasına Mektup', target: 'g3_letter', where: NPC('world', 'captain') },
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
      { type: 'deliver', label: 'Mektubu Kaptan Roderick\'e ver', target: 'captain', where: NPC('world', 'captain') },
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
    // Bekleme adımı (0.6.0): yaralılar şifa evinde bir gece kalır; ertesi gün dostluk ve ilk ortak F görevi.
    id: 'm_vl_rest', kind: 'main', chapter: 2, title: 'Vera ve Lina',
    desc: 'Vera ve Lina bu geceyi Ilse Nine\'nin yanında geçirecek. Yarın onlara bir bakmalıyım. Teşekkür beklemiyorum. Vera\'dan hiç beklemiyorum.',
    objectives: [{ type: 'custom', label: 'Vera ve Lina\'yı bul', target: 'vl_talk', where: NPC('inn', 'vera') }],
    reward: {},
  },
  {
    // Kimlik (f_wolves) kayıt uyumluluğu için korunuyor; 0.4.0'dan beri düşman kurt değil, tarla faresi sürüsü.
    id: 'f_wolves', kind: 'main', chapter: 2, rank: 'F', guild: true, group: true, title: 'Otlaktaki Fareler', giver: 'lina',
    desc: 'Çoban Tam\'ın otlağını bir tarla faresi sürüsü basmış: ekini kemiriyor, kuzuların bacaklarını ısırıyor. Vera ve Lina\'yla ortak bir F görevi: toplam 120 bronz, üçe eşit. Grup görevi: Lonca Puanının yarısı.',
    objectives: [
      { type: 'go', label: 'Vera ve Lina\'yla otlağa git', target: 'pasture', where: W('pasture', 4) },
      { type: 'kill', label: 'Fare sürüsünü dağıt', target: 'field_rat', count: 5, where: W('pasture', 6), sequential: true },
      { type: 'talk', label: 'Celeste\'ye rapor ver', target: 'celeste', where: NPC('guild', 'celeste'), sequential: true },
    ],
    reward: { money: 40, points: 30, text: 'Toplam 120 bronz, kişi başı 40' },
  },
  {
    // 0.5.0'dan beri kullanılmıyor (terfi "Terfi" göreviyle o anda işlenir); eski kayıtlarda aktif olabilir.
    id: 'm_promotion', kind: 'main', chapter: 2, title: 'Terfi', giver: 'celeste',
    desc: 'G eşiğini geçtim. Celeste kayıtlarımı işleyecek.',
    objectives: [{ type: 'talk', label: 'Celeste ile rütben hakkında konuş', target: 'celeste', where: NPC('guild', 'celeste') }],
    reward: { text: 'G rütbe' },
  },
  {
    id: 'm_celebrate', kind: 'main', chapter: 2, title: 'İlk Kadeh', giver: 'vera',
    desc: 'Vera akşam handa beklediğini söyledi. "Geç kalma, köksüz."',
    objectives: [
      { type: 'go', label: 'Akşam (18:00 sonrası) hana git', target: 'inn_evening', where: W('door_inn', 1.5) },
      { type: 'custom', label: 'Vera\'yla masaya otur', target: 'sit_table', where: { map: 'inn', point: 'table_joseph', radius: 1.5 }, sequential: true },
    ],
    reward: {},
  },
  {
    // Kutlamadan sonra G rütbesine yetmeyen puan (0.6.0, nadir): panodan G ilanlarıyla tamamlanır.
    id: 'm_gpoints', kind: 'main', chapter: 2, title: 'G Rütbesi', giver: 'celeste',
    desc: 'G eşiğine az kaldı. Panodaki G ilanlarıyla 40 Lonca Puanına ulaşmalıyım; Vera kutlamayı ona saklıyor.',
    objectives: [{ type: 'custom', label: '40 Lonca Puanına ulaş (pano)', target: 'g_points', where: NPC('guild', 'celeste') }],
    reward: {},
  },
  {
    // Bekleme adımı (0.6.0): kesenin çalınması ilk kadehin ertesi günü, gündüz meydanda.
    id: 'm_next_day', kind: 'main', chapter: 2, title: 'Ertesi Gün',
    desc: 'Dün gece ilk kez bir masada oturdum ve kimse "dolu" demedi. Bugün köyde bir şey dönüyor; meydana bir bakayım.',
    objectives: [{ type: 'custom', label: 'Gündüz köy meydanına uğra', target: 'theft_day', where: W('plaza', 4) }],
    reward: {},
  },
  {
    id: 'm_theft', kind: 'main', chapter: 2, title: 'Kâhyanın Kesesi', giver: 'steward',
    desc: 'Kâhya Edric\'in kesesi çalındı. Köksüz olduğum için ilk şüpheli benim. Hırsız düşük rütbeli biriymiş: Appraisal ile okuyabilirim.',
    objectives: [
      { type: 'custom', label: 'Şüphelileri incele (Appraisal)', target: 'suspects', count: 4, where: W('plaza', 8) },
      { type: 'custom', label: 'Hırsızı bir muhafıza göster', target: 'accuse', where: NPC('world', 'guard_hob'), sequential: true },
    ],
    reward: { text: 'Birkaç bronz ve bir "Dikkatli ol, köksüz."' },
  },
  {
    // Bekleme adımı (0.6.0): kese teslim edildikten sonraki gün Vera ve Lina ikinci ortak işi getirir.
    id: 'm_vl_cellar', kind: 'main', chapter: 2, title: 'Yeni İş',
    desc: 'Kese sahibine döndü, cebimde beş tozlu bronz. Vera ve Lina\'nın yanında iş hep çıkıyor. Yarın onları bulmalıyım.',
    objectives: [{ type: 'custom', label: 'Vera ve Lina\'yla konuş', target: 'vl_cellar', where: NPC('inn', 'vera') }],
    reward: {},
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
    objectives: [{ type: 'custom', label: '10 gümüş biriktir (1.000 bronz)', target: 'silver10', count: 1000, where: NPC('guild', 'celeste') }],
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
    desc: 'Kontrol noktasında Kaptan Roderick\'ten giriş kartı alacağım. Ötesi: Eros.',
    objectives: [{ type: 'talk', label: 'Kaptan Roderick\'ten giriş kartı al (10 gümüş)', target: 'captain', where: NPC('world', 'captain') }],
    reward: { text: 'Giriş Kartı (3 ay)' },
  },
];

/**
 * Terfi görevi (dinamik, kayıtta tanımıyla saklanır): puan eşiği geçilince açılır, Celeste'yle konuşunca terfi o anda
 * işlenir. Kimlik hedef kademeye göre (m_rankup_4 → F); aynı terfi için ikinci kez açılmaz.
 */
export function rankupQuest(target: SubRank): QuestDef {
  return {
    id: rankupQuestId(target), kind: 'main', title: 'Terfi', giver: 'celeste',
    desc: `Lonca Puanım bir sonraki rütbenin eşiğini geçti (${subRankToString(target)}). Celeste kayıtlarımı işleyecek.`,
    objectives: [{ type: 'talk', label: 'Celeste ile rütben hakkında konuş', target: 'celeste', where: NPC('guild', 'celeste') }],
    reward: { text: `${subRankToString(target)} rütbe` },
  };
}

const ALL: Record<string, QuestDef> = Object.fromEntries([...MAIN_QUESTS, ...SIDE_QUESTS].map((q) => [q.id, q]));

export function questDef(id: string): QuestDef | undefined {
  return ALL[id];
}

export const QUEST_IDS = Object.keys(ALL);
