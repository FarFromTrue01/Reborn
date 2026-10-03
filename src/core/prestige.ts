// Saygınlık (C1): kılık kıyafete göre yargılanma. Bir stat değil, bir oyun mekaniği.
// Joseph'in Saygınlık'ı giydiği eşyaların toplamıdır; çıplak ya da paçavra içindeyken eksiye düşer.
// NPC'ler kendi Saygınlık'larıyla karşılaştırır: kendi Saygınlık'ı yüksek olan daha az etkilenir.
// Etkilenmek hoşlanmak değil, saygı duymaktır; tersi küçümsemektir. Kast ortadan kalkmaz, ton kayar.
import { ITEMS } from '../data/items';
import { EQUIP_SLOTS, type EquipSlot } from './types';

/** Boş slot cezaları: çıplak gövde ve bacaklar. */
export const EMPTY_SLOT_PENALTY: Partial<Record<EquipSlot, number>> = { chest: -4, pants: -6, boots: -1 };

export function itemPrestige(id: string): number {
  return ITEMS[id]?.saygınlık ?? 0;
}

/** Ekipmandan Saygınlık (kuşanılmış eşyaların toplamı + boş slot cezaları). */
export function equipmentPrestige(eq: Partial<Record<EquipSlot, string>>): number {
  let s = 0;
  for (const slot of EQUIP_SLOTS) {
    const id = eq[slot];
    if (id) s += itemPrestige(id);
    else s += EMPTY_SLOT_PENALTY[slot] ?? 0;
  }
  return s;
}

/** NPC Saygınlık'ı: konumundan (kast/itibar 1–5) ve kıyafetinden. */
export function npcPrestige(prestigeRank: number, eq: Partial<Record<EquipSlot, string>>): number {
  let s = prestigeRank * 4;
  for (const slot of EQUIP_SLOTS) {
    const id = eq[slot];
    if (id) s += itemPrestige(id);
  }
  return s;
}

export type Tone = 'scorn' | 'neutral' | 'respect';

/**
 * Bir NPC'nin Joseph'e karşı tonu. diff = Joseph − NPC; NPC'nin Saygınlık'ı yükseldikçe
 * etkilenme katsayısı düşer. Sonuç −1 (küçümseme) … +1 (saygı).
 */
export function regard(joseph: number, npc: number): number {
  const sens = 1 / (1 + Math.max(0, npc) / 8);
  // Nötr çizgi NPC'nin Saygınlık'ının yarısı: üst kastlar köksüzden daha fazlasını bekler
  const diff = joseph - (npc * 0.5 - 2);
  return Math.max(-1, Math.min(1, (diff * sens) / 6));
}

export function toneOf(joseph: number, npc: number): Tone {
  const r = regard(joseph, npc);
  if (r <= -0.33) return 'scorn';
  if (r >= 0.33) return 'respect';
  return 'neutral';
}

/** Joseph'in toplumdaki görünümü: Saygınlık ve lonca kaydı birlikte. */
export function josephStatusOf(prestige: number, guildMember: boolean): 'naked' | 'rootless' | 'adventurer' {
  if (prestige <= -7) return 'naked';
  return guildMember ? 'adventurer' : 'rootless';
}

/** Ekranda gösterim: işaretli tamsayı. */
export function prestigeLabel(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
