// Rütbe ölçeği: G → F → E → D → C → B → A → S → X
// Lonca ve skill rütbelerinde alt kademeler var (G-, G, G+ ... S+, X-, X).

export const LETTERS = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'X'] as const;
export type Letter = (typeof LETTERS)[number];

export function letterIndex(l: Letter): number {
  return LETTERS.indexOf(l);
}

/**
 * Alt kademeli rütbe tek bir tamsayı ile tutulur.
 * 0 = G-, 1 = G, 2 = G+, 3 = F-, ... 23 = S+, 24 = X-, 25 = X.
 */
export type SubRank = number;
export const SUBRANK_MAX: SubRank = 25;

export function subRankLetter(r: SubRank): Letter {
  return LETTERS[Math.min(8, Math.floor(r / 3))];
}

export function subRankLetterIndex(r: SubRank): number {
  return Math.min(8, Math.floor(r / 3));
}

export function subRankToString(r: SubRank): string {
  const li = Math.min(8, Math.floor(r / 3));
  const sub = r - li * 3;
  const suffix = sub === 0 ? '-' : sub === 1 ? '' : '+';
  return LETTERS[li] + suffix;
}

export function parseSubRank(s: string): SubRank {
  const letter = s[0] as Letter;
  const li = letterIndex(letter);
  if (li < 0) throw new Error('Geçersiz rütbe: ' + s);
  const rest = s.slice(1);
  const sub = rest === '-' ? 0 : rest === '' ? 1 : rest === '+' ? 2 : -1;
  if (sub < 0) throw new Error('Geçersiz rütbe: ' + s);
  const r = li * 3 + sub;
  if (r > SUBRANK_MAX) throw new Error('Geçersiz rütbe: ' + s);
  return r;
}

/** Bir harfin ilk alt kademesi (ör. 'D' → D-). */
export function letterStart(l: Letter): SubRank {
  return letterIndex(l) * 3;
}

/** Skill EXP eşikleri (her alt kademe için aynı). */
export const SKILL_EXP_THRESHOLDS: Record<Letter, number> = {
  G: 15,
  F: 40,
  E: 100,
  D: 500,
  C: 2500,
  B: 10000,
  A: 25000,
  S: 100000,
  X: 1000000,
};

export function skillThreshold(r: SubRank): number {
  return SKILL_EXP_THRESHOLDS[subRankLetter(r)];
}

/** Tipik level aralıkları. */
export const RANK_LEVEL_RANGES: Record<Letter, [number, number]> = {
  G: [0, 3],
  F: [2, 6],
  E: [4, 12],
  D: [9, 20],
  C: [16, 35],
  B: [28, 50],
  A: [40, 75],
  S: [75, 110],
  X: [110, 999],
};
