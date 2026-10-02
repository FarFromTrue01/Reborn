import type { SkillDef, TechniqueDef } from '../core/types';

// Skill'ler: kaliteli ve az. Her skill'in kendi gelişim tablosu var.
// 'at' alanı o tabloya ulaşılan alt kademedir (ör. 'D-').

const skills: SkillDef[] = [
  {
    id: 'appraisal', name: 'Appraisal', rarity: 'innate', icon: 'sk_appraisal',
    desc: 'Bir canlının bilgisini okur. Rütbe farkı ne kadar büyükse o kadar çok şey görülür. Trait\'ler hiçbir rütbede görünmez.',
    tiers: [
      { at: 'G-', note: 'Hedefin Appraisal rütbesiyle karşılaştırılarak bilgi gösterir.' },
      { at: 'F-', note: 'Bir harf daha yükseğe kadar daha çok bilgi görülür.' },
      { at: 'E-', note: 'Lonca görevlileri gibi insanları okuyabilirsin.' },
    ],
  },
  // --------------------------------------------------------------- Sıradan
  {
    id: 'stealth', name: 'Gizlilik', rarity: 'common', icon: 'sk_stealth',
    desc: 'Fark edilmeden hareket etme sanatı.',
    tiers: [
      { at: 'G-', passive: { detectionPct: -0.1 }, note: 'Düşmanların seni fark etme mesafesi -%10.' },
      { at: 'F-', passive: { detectionPct: -0.2 }, note: 'Fark edilme mesafesi -%20.' },
      { at: 'E-', passive: { detectionPct: -0.25, sneakMult: 1.75 }, note: 'Gizli saldırı ×1.75.' },
      { at: 'D-', passive: { detectionPct: -0.35, sneakMult: 2 }, note: 'Gizli saldırı ×2.' },
    ],
  },
  {
    id: 'evasion', name: 'Kaçınma', rarity: 'common', icon: 'sk_evasion',
    desc: 'Darbeyi son anda savuşturma içgüdüsü.',
    tiers: [
      { at: 'G-', passive: { dodgeWindowPct: 0.1 }, note: 'Mükemmel kaçış penceresi +%10.' },
      { at: 'F-', passive: { dodgeWindowPct: 0.2, dodgeCostPct: -0.1 }, note: 'Pencere +%20, kaçış maliyeti -%10.' },
      { at: 'E-', passive: { dodgeWindowPct: 0.3, dodgeCostPct: -0.2 }, note: 'Pencere +%30, maliyet -%20.' },
    ],
  },
  {
    id: 'archery', name: 'Okçuluk', rarity: 'common', weapon: 'bow', icon: 'sk_archery',
    desc: 'Yay kullanımı.',
    tiers: [
      { at: 'G-', note: 'Temel nişan.' },
      { at: 'F-', passive: { damagePct: { weapon: 'bow', pct: 0.1 } }, note: 'Yay hasarı +%10.' },
      { at: 'E-', technique: 'double_shot', note: 'Çift Ok tekniği.' },
      { at: 'D-', passive: { damagePct: { weapon: 'bow', pct: 0.2 } }, note: 'Yay hasarı +%20.' },
    ],
  },
  {
    id: 'first_aid', name: 'İlk Yardım', rarity: 'common', icon: 'sk_firstaid',
    desc: 'Sargı, merhem ve dinlenmeyi bilmek.',
    tiers: [
      { at: 'G-', passive: { healPct: 0.2 }, note: 'Sargı ve iksirler +%20 iyileştirir.' },
      { at: 'F-', passive: { healPct: 0.3, regenPct: 0.1 }, note: 'Savaş dışı yenilenme +%10.' },
      { at: 'E-', passive: { healPct: 0.45, regenPct: 0.2 }, note: 'İyileşme +%45, yenilenme +%20.' },
    ],
  },
  {
    id: 'athletics', name: 'Atletizm', rarity: 'common', icon: 'sk_athletics',
    desc: 'Koşmak, tırmanmak, yorulmamak.',
    tiers: [
      { at: 'G-', passive: { staminaFlat: 5 }, note: 'Dayanıklılık +5.' },
      { at: 'F-', passive: { staminaFlat: 10, runCostPct: -0.15 }, note: 'Dayanıklılık +10, koşu maliyeti -%15.' },
      { at: 'E-', passive: { staminaFlat: 20, runCostPct: -0.25 }, note: 'Dayanıklılık +20.' },
    ],
  },
  {
    id: 'gathering', name: 'Toplayıcılık', rarity: 'common', icon: 'sk_gather',
    desc: 'Ormanın verdiklerini tanımak.',
    tiers: [
      { at: 'G-', passive: { gatherBonus: 0.15 }, note: 'Toplarken ek ürün şansı %15.' },
      { at: 'F-', passive: { gatherBonus: 0.3 }, note: 'Ek ürün şansı %30.' },
      { at: 'E-', passive: { gatherBonus: 0.5 }, note: 'Ek ürün şansı %50.' },
    ],
  },
  // --------------------------------------------------------------- Nadir
  {
    id: 'sword_mastery', name: 'Kılıç Ustalığı', rarity: 'rare', weapon: 'sword', icon: 'sk_sword',
    desc: 'Kılıcı vücudun bir uzantısı gibi kullanmak.',
    tiers: [
      { at: 'G-', passive: { cleanAnim: true }, note: 'Bonus yok, sadece daha temiz hareket.' },
      { at: 'F-', passive: { cleanAnim: true }, note: 'Bonus yok, daha akıcı geçişler.' },
      { at: 'E-', passive: { cleanAnim: true }, note: 'Bonus yok, kusursuz duruş.' },
      { at: 'D-', technique: 'double_slash', note: 'Çift Kesik tekniği.' },
      { at: 'C-', passive: { damagePct: { weapon: 'sword', pct: 0.15 } }, note: 'Kılıç hasarı +%15.' },
      { at: 'B-', technique: 'counter', note: 'Karşı Saldırı tekniği.' },
    ],
  },
  {
    id: 'spear_mastery', name: 'Mızrak Ustalığı', rarity: 'rare', weapon: 'spear', icon: 'sk_spear',
    desc: 'Uzun sapın getirdiği menzil ve kontrol.',
    tiers: [
      { at: 'G-', note: 'Temel duruş.' },
      { at: 'E-', passive: { reachPct: 0.15 }, note: 'Menzil +%15.' },
      { at: 'D-', technique: 'piercing_thrust', note: 'Delici Hamle tekniği.' },
      { at: 'C-', passive: { reachPct: 0.25, damagePct: { weapon: 'spear', pct: 0.15 } }, note: 'Mızrak hasarı +%15.' },
    ],
  },
  {
    id: 'fire_magic', name: 'Ateş Büyüsü', rarity: 'rare', icon: 'sk_fire',
    desc: 'Mananı alev olarak dışa vurmak.',
    tiers: [
      { at: 'G-', technique: 'spark', note: 'Kıvılcım: meşale ve ot yakar.' },
      { at: 'F-', technique: 'flame_spray', note: 'Küçük alev püskürtmesi.' },
      { at: 'E-', passive: { damagePct: { weapon: 'fire', pct: 0.1 } }, note: 'Pasif ateş hasarı +%10.' },
      { at: 'D-', technique: 'fireball', note: 'Ateş Topu.' },
      { at: 'C-', passive: { damagePct: { weapon: 'fire', pct: 0.25 }, areaPct: 0.3 }, note: 'Alan genişler, ateş hasarı +%25.' },
      { at: 'B-', technique: 'flame_wall', note: 'Alev Duvarı.' },
      { at: 'A-', awakening: true, technique: 'inferno_ring', note: 'Awakening: Cehennem Çemberi (alan büyüsü).' },
      { at: 'S-', awakening: true, passive: { damagePct: { weapon: 'fire', pct: 0.6 }, areaPct: 0.8 }, note: 'Awakening: Alevlerin Efendisi.' },
    ],
  },
  {
    id: 'healing_magic', name: 'Şifa Büyüsü', rarity: 'rare', icon: 'sk_heal',
    desc: 'Mananı yaşam gücüne çevirmek.',
    tiers: [
      { at: 'G-', technique: 'minor_heal', note: 'Küçük Şifa.' },
      { at: 'E-', passive: { healPct: 0.2 }, note: 'Tüm iyileşme +%20.' },
      { at: 'D-', technique: 'regeneration', note: 'Yenilenme (zamanla iyileşme).' },
      { at: 'C-', passive: { healPct: 0.4, regenPct: 0.2 }, note: 'İyileşme +%40.' },
    ],
  },
  // --------------------------------------------------------------- Efsanevi
  {
    id: 'storm_blade', name: 'Fırtına Kılıcı', rarity: 'legendary', weapon: 'sword', icon: 'sk_storm',
    desc: 'Kılıcın rüzgârı kesip uzağa taşıdığı eski bir sanat.',
    tiers: [
      { at: 'G-', technique: 'wind_cut', note: 'Rüzgâr Kesiği: kısa menzilli kesik dalgası.' },
      { at: 'E-', passive: { damagePct: { weapon: 'sword', pct: 0.1 }, stats: { AGI: 2 } }, note: 'Kılıç hasarı +%10, AGI +2.' },
      { at: 'C-', technique: 'gale_dance', note: 'Fırtına Dansı: ardışık dört kesik.' },
      { at: 'A-', awakening: true, passive: { damagePct: { weapon: 'sword', pct: 0.4 }, stats: { AGI: 10 } }, note: 'Awakening: Fırtınanın Gözü.' },
      { at: 'S-', awakening: true, technique: 'sky_sunder', note: 'Awakening: Gök Yaran.' },
    ],
  },
  {
    id: 'thunder_magic', name: 'Yıldırım Büyüsü', rarity: 'legendary', icon: 'sk_thunder',
    desc: 'Göğün öfkesini çağırmak.',
    tiers: [
      { at: 'G-', technique: 'static_bolt', note: 'Statik Ok: hızlı, zincirlenen küçük yıldırım.' },
      { at: 'E-', passive: { damagePct: { weapon: 'spell', pct: 0.15 } }, note: 'Büyü hasarı +%15.' },
      { at: 'C-', technique: 'thunder_strike', note: 'Gök Gürültüsü: alan yıldırımı.' },
      { at: 'A-', awakening: true, passive: { damagePct: { weapon: 'spell', pct: 0.5 } }, note: 'Awakening: Fırtına Çağıran.' },
      { at: 'S-', awakening: true, technique: 'heaven_judgement', note: 'Awakening: Göğün Hükmü.' },
    ],
  },
  {
    id: 'iron_body', name: 'Demir Beden', rarity: 'legendary', icon: 'sk_ironbody',
    desc: 'Bedeni bir kale gibi sertleştirmek.',
    tiers: [
      { at: 'G-', passive: { hpPct: 0.05, stats: { VIT: 1 } }, note: 'Max HP +%5, VIT +1.' },
      { at: 'E-', passive: { hpPct: 0.15, stats: { VIT: 3 } }, note: 'Max HP +%15, VIT +3.' },
      { at: 'C-', technique: 'iron_skin', passive: { hpPct: 0.25, stats: { VIT: 6 } }, note: 'Demir Deri tekniği.' },
      { at: 'A-', awakening: true, passive: { hpPct: 0.6, stats: { VIT: 20 } }, note: 'Awakening: Yıkılmaz.' },
    ],
  },
];

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(skills.map((s) => [s.id, s]));

export function skillDef(id: string): SkillDef {
  const s = SKILLS[id];
  if (!s) throw new Error('Bilinmeyen skill: ' + id);
  return s;
}

export const RARITY_NAMES: Record<string, string> = {
  common: 'Sıradan',
  rare: 'Nadir',
  legendary: 'Efsanevi',
  innate: 'Doğuştan',
};

/** Sistem Teklifi maliyeti (SP). */
export const OFFER_COST: Record<'common' | 'rare' | 'legendary', number> = {
  common: 1,
  rare: 3,
  legendary: 8,
};

const techniques: TechniqueDef[] = [
  { id: 'spark', name: 'Kıvılcım', desc: 'Küçük bir kıvılcım fırlatır. Meşale ve ot yakar.', mp: 1, cooldown: 1.2, kind: 'projectile', power: 1.5, element: 'fire', range: 4, ignites: true },
  { id: 'flame_spray', name: 'Alev Püskürtmesi', desc: 'Önüne kısa bir alev konisi püskürtür.', mp: 3, cooldown: 4, kind: 'cone', power: 3, element: 'fire', range: 2.5, ignites: true },
  { id: 'fireball', name: 'Ateş Topu', desc: 'Çarptığı yerde patlayan ateş topu.', mp: 6, cooldown: 6, kind: 'projectile', power: 8, element: 'fire', range: 7, radius: 1.5, ignites: true },
  { id: 'flame_wall', name: 'Alev Duvarı', desc: 'Önüne yanan bir duvar örer.', mp: 12, cooldown: 14, kind: 'wall', power: 6, element: 'fire', duration: 5, ignites: true },
  { id: 'inferno_ring', name: 'Cehennem Çemberi', desc: 'Etrafını alev denizine çevirir.', mp: 30, cooldown: 30, kind: 'aoe', power: 40, element: 'fire', radius: 5, ignites: true },
  { id: 'double_slash', name: 'Çift Kesik', desc: 'Göz açıp kapayıncaya kadar iki kesik.', mp: 3, cooldown: 5, kind: 'melee_multi', power: 0.9, hits: 2, weapon: 'sword' },
  { id: 'counter', name: 'Karşı Saldırı', desc: 'Kısa bir süre gelen darbeyi savuşturup karşılık verir.', mp: 5, cooldown: 10, kind: 'counter', power: 2, duration: 1.2, weapon: 'sword' },
  { id: 'piercing_thrust', name: 'Delici Hamle', desc: 'Sıradaki düşmanları delip geçen hamle.', mp: 4, cooldown: 6, kind: 'melee_multi', power: 1.6, hits: 1, range: 2.5, weapon: 'spear' },
  { id: 'double_shot', name: 'Çift Ok', desc: 'İki oku aynı anda bırakır.', mp: 2, cooldown: 4, kind: 'projectile', power: 0.85, hits: 2, weapon: 'bow', range: 8 },
  { id: 'minor_heal', name: 'Küçük Şifa', desc: 'Yaraları kapatır.', mp: 2, cooldown: 3, kind: 'heal', power: 4, element: 'heal' },
  { id: 'regeneration', name: 'Yenilenme', desc: 'Bir süre boyunca iyileştirir.', mp: 6, cooldown: 15, kind: 'buff', power: 2, duration: 8, element: 'heal' },
  { id: 'wind_cut', name: 'Rüzgâr Kesiği', desc: 'Kılıçtan fırlayan kesik dalgası.', mp: 2, cooldown: 3, kind: 'projectile', power: 1.2, element: 'wind', range: 4, weapon: 'sword' },
  { id: 'gale_dance', name: 'Fırtına Dansı', desc: 'Ardışık dört kesik.', mp: 8, cooldown: 10, kind: 'melee_multi', power: 0.8, hits: 4, weapon: 'sword' },
  { id: 'sky_sunder', name: 'Gök Yaran', desc: 'Göğü yaran tek bir kesik.', mp: 40, cooldown: 40, kind: 'aoe', power: 10, radius: 6, element: 'wind', weapon: 'sword' },
  { id: 'static_bolt', name: 'Statik Ok', desc: 'Hızlı, zincirlenen küçük yıldırım.', mp: 2, cooldown: 2, kind: 'projectile', power: 2, element: 'lightning', range: 6 },
  { id: 'thunder_strike', name: 'Gök Gürültüsü', desc: 'Hedef bölgeye yıldırım düşürür.', mp: 10, cooldown: 10, kind: 'aoe', power: 14, radius: 2.5, element: 'lightning' },
  { id: 'heaven_judgement', name: 'Göğün Hükmü', desc: 'Göğün öfkesi.', mp: 50, cooldown: 60, kind: 'aoe', power: 80, radius: 7, element: 'lightning' },
  { id: 'iron_skin', name: 'Demir Deri', desc: 'Kısa süre aldığın hasarı yarıya indirir.', mp: 6, cooldown: 20, kind: 'buff', power: 0.5, duration: 6 },
];

export const TECHNIQUES: Record<string, TechniqueDef> = Object.fromEntries(techniques.map((t) => [t.id, t]));

/** Hidden discovery: davranış sayaçları → önerilen skill. */
export const HIDDEN_DISCOVERIES: { counter: string; need: number; skill: string; hint: string }[] = [
  { counter: 'sneakApproach', need: 20, skill: 'stealth', hint: 'Fark edilmeden düşmanlara yaklaşmayı alışkanlık hâline getirdin.' },
  { counter: 'perfectDodge', need: 15, skill: 'evasion', hint: 'Darbeleri son anda savuşturmayı öğreniyorsun.' },
  { counter: 'bowHits', need: 20, skill: 'archery', hint: 'Yayın gerginliğini artık parmaklarında hissediyorsun.' },
  { counter: 'runDistance', need: 4000, skill: 'athletics', hint: 'Koştukça bedenin buna alışıyor.' },
  { counter: 'gathered', need: 15, skill: 'gathering', hint: 'Ormanın otlarını tanımaya başladın.' },
  { counter: 'bandagesUsed', need: 8, skill: 'first_aid', hint: 'Yaralarını sarmakta ustalaşıyorsun.' },
];
