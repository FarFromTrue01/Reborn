import type { TitleDef } from '../core/types';

// Title'lar önemli başarılarla kazanılır ve genel (her yerde işe yarayan) bonus verir.
const titles: TitleDef[] = [
  {
    id: 'unyielding', name: 'Boyun Eğmeyen', rank: 'G',
    desc: 'Canı %15\'in altındayken kendinden güçlü bir düşmanı yendin.',
    bonus: { hpPct: 0.05 },
  },
  {
    id: 'forest_walker', name: 'Orman Yürüyücüsü', rank: 'G',
    desc: 'Başlangıç ormanının tamamını keşfettin.',
    bonus: { stats: { AGI: 1 }, expPct: 0.02 },
  },
  {
    id: 'camp_breaker', name: 'Kamp Dağıtan', rank: 'E',
    desc: 'Goblin kampının şefini yendin.',
    bonus: { stats: { STR: 1, VIT: 1 }, damagePct: 0.03 },
  },
  {
    id: 'pack_hunter', name: 'Sürü Avcısı', rank: 'F',
    desc: 'Bir kurt sürüsünü tek başına dağıttın (aynı savaşta 3 kurt).',
    bonus: { stats: { DEX: 1 }, damagePct: 0.02 },
  },
  // NPC title'ları
  { id: 'npc_retired', name: 'Kurt Sürüsü Avcısı', rank: 'E', desc: 'Gençliğinde bir kurt sürüsünü tek başına durdurdu.', bonus: { damagePct: 0.03 } },
  { id: 'npc_redblade', name: 'Kızıl Kılıç', rank: 'F', desc: 'Köyde nam salmış genç kılıççı.', bonus: { stats: { STR: 1 } } },
  { id: 'npc_sharpeye', name: 'Keskin Göz', rank: 'F', desc: 'Kırk adımdan elma vuran okçu.', bonus: { stats: { DEX: 1 } } },
  { id: 'npc_reader', name: 'İnsan Okuyan', rank: 'E', desc: 'Lonca sınavlarında yüzlerce maceracıyı değerlendirdi.', bonus: { expPct: 0.02 } },
  { id: 'npc_smith', name: 'Örs Ustası', rank: 'F', desc: 'Bin kılıç dövdü.', bonus: { stats: { STR: 1 } } },
  { id: 'npc_merchant', name: 'Altın Terazi', rank: 'E', desc: 'Üç krallıkta ticaret yaptı, hiçbir pazarlığı kaybetmedi.', bonus: { stats: { INT: 1 } } },
  { id: 'npc_steward', name: 'Valmont Mührü', rank: 'D', desc: 'Valmont Baronu adına konuşur. Sözü emirdir.', bonus: { stats: { INT: 1 } } },
  { id: 'npc_knight', name: 'Yemin Eden', rank: 'D', desc: 'Valmont Hanedanı\'na kılıç yemini etti.', bonus: { stats: { VIT: 2 } } },
  { id: 'npc_blackhound', name: 'Kara Tazı', rank: 'D', desc: 'Sınır boylarında yüz goblin kulağı topladı.', bonus: { damagePct: 0.04 } },
  { id: 'npc_watch', name: 'Kapı Bekçisi', rank: 'F', desc: 'On yıl boyunca kapıyı tuttu.', bonus: { stats: { VIT: 1 } } },
  { id: 'goblin_chief_title', name: 'Kampın Şefi', rank: 'F', desc: 'Kendi kabilesini yumrukla yönetiyor.', bonus: { stats: { STR: 1 } } },
];

export const TITLES: Record<string, TitleDef> = Object.fromEntries(titles.map((t) => [t.id, t]));

// Trait'ler gizlidir. Burada sadece görüntü adları tutulur.
export const TRAIT_NAMES: Record<string, { name: string; rank: string }> = {
  divine_paladin: { name: 'Divine Paladin', rank: 'X' },
  keen_ears: { name: 'Keskin Kulaklar', rank: 'G' },
  iron_liver: { name: 'Demir Karaciğer', rank: 'G' },
  silver_tongue: { name: 'Gümüş Dil', rank: 'F' },
};
