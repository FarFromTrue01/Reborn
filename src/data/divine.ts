// Divine Paladin skill'leri: rütbesiz, MP yerine Işık barı kullanır, Divine statlarıyla güçlenir.

export interface DivineSkillDef {
  id: string;
  name: string;
  kind: 'passive' | 'active';
  light: number; // Işık maliyeti
  cooldown: number;
  icon: string;
  desc: string;
  tier: number; // hangi awakening havuzunda (1 = ilk)
}

export const DIVINE_SKILLS: DivineSkillDef[] = [
  { id: 'second_wind', name: 'İkinci Nefes', kind: 'passive', light: 0, cooldown: 0, icon: 'dv_second_wind', tier: 1,
    desc: 'Savaş başına bir kez, öldürücü darbede 1 HP ile hayatta kalırsın.' },
  { id: 'holy_shield', name: 'Kutsal Kalkan', kind: 'active', light: 40, cooldown: 8, icon: 'dv_holy_shield', tier: 1,
    desc: 'Kısa süre gelen hasarı emen ışık kalkanı. Emilen miktar Dayanıklılık ile artar.' },
  { id: 'light_step', name: 'Işık Adımı', kind: 'active', light: 25, cooldown: 3, icon: 'dv_light_step', tier: 1,
    desc: 'Baktığın yöne ışık hızında kısa bir atılma. Atılma sırasında dokunulmazsın.' },
  // İkinci awakening havuzu (Divine Lv6)
  { id: 'holy_strike', name: 'Kutsal Darbe', kind: 'active', light: 50, cooldown: 10, icon: 'dv_holy_strike', tier: 2,
    desc: 'Bir sonraki vuruşun kutsal ışıkla patlar: ×2.5 hasar ve çevreye ışık dalgası.' },
  { id: 'guardian_aura', name: 'Koruyucu Aura', kind: 'passive', light: 0, cooldown: 0, icon: 'dv_aura', tier: 2,
    desc: 'Etrafında sürekli bir aura: aldığın hasar -%10, savaşta yenilenme +%50.' },
  { id: 'purify', name: 'Arınma', kind: 'active', light: 40, cooldown: 20, icon: 'dv_purify', tier: 2,
    desc: 'Tüm olumsuz etkileri siler ve Max HP\'nin %20\'sini iyileştirir.' },
  // Üçüncü havuz (Divine Lv9+)
  { id: 'judgement', name: 'Yargı Işığı', kind: 'active', light: 70, cooldown: 18, icon: 'dv_judgement', tier: 3,
    desc: 'Önündeki hattı yakıp geçen bir ışık huzmesi.' },
  { id: 'radiance', name: 'Işık Patlaması', kind: 'active', light: 60, cooldown: 15, icon: 'dv_radiance', tier: 3,
    desc: 'Etrafındaki düşmanları savuran ve sersemleten ışık patlaması.' },
  { id: 'swift_grace', name: 'Hızın Lütfu', kind: 'passive', light: 0, cooldown: 0, icon: 'dv_swift', tier: 3,
    desc: 'Mükemmel kaçışta Işık barı iki kat dolar ve zaman daha uzun yavaşlar.' },
];

export const DIVINE_BY_ID: Record<string, DivineSkillDef> = Object.fromEntries(DIVINE_SKILLS.map((d) => [d.id, d]));

/** Awakening level'ına göre önerilecek 3 skill (sahip olunmayanlardan). */
export function divineOffer(awakeningLevel: number, owned: string[]): DivineSkillDef[] {
  const tier = Math.min(3, Math.floor(awakeningLevel / 3));
  let pool = DIVINE_SKILLS.filter((d) => d.tier === tier && !owned.includes(d.id));
  if (pool.length < 3) pool = pool.concat(DIVINE_SKILLS.filter((d) => d.tier < tier && !owned.includes(d.id) && !pool.includes(d)));
  if (pool.length < 3) pool = pool.concat(DIVINE_SKILLS.filter((d) => !owned.includes(d.id) && !pool.includes(d)));
  return pool.slice(0, 3);
}
