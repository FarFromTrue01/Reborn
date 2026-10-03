/**
 * EXP gösterimi (B1): en fazla bir ondalık, virgülle; uzun ondalıklar kısaltılır (aşağı), tam sayılar ondalıksız.
 * 0.5 → "0,5" · 2.5 → "2,5" · 3.3555 → "3,3" · 3 → "3"
 */
export function fmtExp(n: number): string {
  if (!isFinite(n)) return '0';
  const neg = n < 0;
  const v = Math.floor(Math.abs(n) * 10 + 1e-6) / 10;
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
  return neg && v !== 0 ? '−' + s : s;
}

import { ITEMS } from '../data/items';
import { STAT_KEYS } from '../core/formulas';

/** Eşya etiketi: `Paslı Kısa Kılıç (G) [DMG: 1-2]`, `Deri Yelek (G) [DEF: +1 | AGI: +1]` */
export function itemLabel(id: string): string {
  const it = ITEMS[id];
  if (!it) return id;
  const parts: string[] = [];
  if (it.dmg) parts.push(`DMG: ${it.dmg[0]}-${it.dmg[1]}`);
  if (it.def !== undefined && it.kind === 'armor') parts.push(`DEF: +${it.def}`);
  if (it.stats) for (const k of STAT_KEYS) if (it.stats[k]) parts.push(`${k}: ${it.stats[k]! > 0 ? '+' : ''}${it.stats[k]}`);
  if (it.hpFlat) parts.push(`HP: +${it.hpFlat}`);
  const rank = it.rank ? ` (${it.rank})` : '';
  return `${it.name}${rank}${parts.length ? ` [${parts.join(' | ')}]` : ''}`;
}

export function itemEffectsText(id: string): string {
  const it = ITEMS[id];
  if (!it?.effects) return '';
  return it.effects
    .map((e) => {
      switch (e.type) {
        case 'heal': return `+${e.amount} HP`;
        case 'mana': return `+${e.amount} MP`;
        case 'stamina': return `+${e.amount} Dayanıklılık`;
        case 'regen': return `${e.duration} sn'de +${e.amount} HP`;
        case 'cure': return 'Olumsuz etkileri giderir';
        case 'learnSkill': return 'Okununca skill öğretir';
      }
      return '';
    })
    .join(', ');
}
