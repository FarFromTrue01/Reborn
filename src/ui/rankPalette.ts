// Rütbe paleti (Phaser'sız; ui/kit yeniden dışa aktarır).
/**
 * Rütbe arka planları (G → X), rozetlerle aynı renk ailesi (tools/build_uiicons.py TIERS'in koyu tonları).
 * 0.11.0 (C4): her harf ayrı renk — G kahverengi, F demir grisi, E bronz, D gümüş, C yeşim yeşili, B safir mavisi,
 * A altın, S kızıl yakut, X mor.
 */
export const RANK_BG: Record<string, number> = {
  G: 0x4a3420, F: 0x33363e, E: 0x5c3418, D: 0x4c5262, C: 0x14563a, B: 0x1a3274, A: 0x6e5210, S: 0x701226, X: 0x48207a,
};
/** Rütbe arka planlarının açık kenar tonu (rozet gövdesinin açık tonu). */
export const RANK_EDGE: Record<string, number> = {
  G: 0x966c40, F: 0x7e828c, E: 0xcd7f3c, D: 0xd6dce6, C: 0x56c48e, B: 0x5288f0, A: 0xfad660, S: 0xe84256, X: 0xb078ff,
};
/** Rütbe yazı tonu (CSS). */
export const RANK_TEXT: Record<string, string> = {
  G: '#d8b088', F: '#c4c8d2', E: '#f0a868', D: '#eef2f8', C: '#8ff0be', B: '#9cc0ff', A: '#ffe08a', S: '#ff8a98', X: '#d4b0ff',
};

