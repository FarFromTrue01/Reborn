// Statlarda renkli artılar (0.9.0): saf kurallar (Phaser'sız, tests/g5b.test.ts). Çizim src/ui/statPlus.ts.
import type { Stats, StatKey } from './formulas';

export const PLUS_SOURCES = [
  { key: 'Ekipman', color: '#7ee07a' },
  { key: 'Title', color: '#ffd75e' },
  { key: 'Skill', color: '#c99aff' },
] as const;

export interface PlusVisibility {
  Ekipman: boolean;
  Title: boolean;
  Skill: boolean;
}

/** Bir statın temel değeri ve görünür artıları (sıfır olanlar atlanır). */
export function statParts(src: Record<string, Partial<Stats>>, k: StatKey, vis: PlusVisibility = { Ekipman: true, Title: true, Skill: true }) {
  const base = src.Level?.[k] ?? 0;
  const plus: { v: number; color: string }[] = [];
  for (const s of PLUS_SOURCES) {
    const v = src[s.key]?.[k] ?? 0;
    if (v && vis[s.key]) plus.push({ v, color: s.color });
  }
  return { base, plus };
}

/**
 * Artıların dikey yerleri (satır yüksekliğine oran, 0 = orta): tek artı ortada; iki artı üst–orta ve orta–alt
 * arasında; üç artı üst, orta, alt.
 */
export function plusOffsets(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0];
  if (n === 2) return [-1 / 6, 1 / 6];
  return [-1 / 3, 0, 1 / 3];
}

