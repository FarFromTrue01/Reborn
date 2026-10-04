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

/**
 * Hasar ve HP gösterimi (tek ortak biçim): 10'un altı bir ondalık, 10 ve üstü tam sayı, ondalık ayracı virgül.
 * 0.5 → "0,5" · 1 → "1,0" · 3.66 → "3,7" · 14.2 → "14" · 9.96 → "10"
 * Hasar sayıları, HP barları, HUD, Appraisal paneli ve düşman HP'leri hep buradan geçer;
 * bir yerde "3,5 HP" yazarken başka yerde "4 HP" görünmez.
 */
export function fmtHp(n: number): string {
  if (!isFinite(n)) return '0,0';
  const a = Math.abs(n);
  const r = Math.round(a * 10) / 10;
  const s = r >= 10 ? String(Math.round(a)) : r.toFixed(1).replace('.', ',');
  return n < 0 && r !== 0 ? '−' + s : s;
}

/** Çarpan gösterimi: 1.4 → "1,4" (bir ondalık, virgül). */
export function fmtMult(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
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
