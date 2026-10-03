// Maceracılar Loncası: Lonca Puanı, terfi, başarısızlık cezası, borç ve kartın alınması (C3).
// Saf kurallar — tests/guild.test.ts.
import { parseSubRank, subRankLetterIndex, subRankToString, LETTERS, RANK_LEVEL_RANGES, type Letter, type SubRank } from './ranks';

/** Bir görevin Lonca Puanı (görevin harfine göre; her harfte belirgin artar — kast ve kademe hissi). */
export const QUEST_POINTS: Record<Letter, number> = { G: 10, F: 30, E: 70, D: 150, C: 320, B: 650, A: 1300, S: 2600, X: 5200 };

/** Pano görevlerinin ödül aralığı (bronz). */
export const BOARD_REWARD: Partial<Record<Letter, [number, number]>> = { G: [15, 40], F: [60, 90], E: [150, 260] };

/** Yeniden kayıt ücreti (kart alındıktan sonra): 1 gümüş. */
export const REREGISTER_FEE = 100;

/**
 * Bir alt kademeye ulaşmak için gereken TOPLAM puan. İndeks = SubRank (0 = G-).
 * G: 40, G+: 100, F-: 180 (en az Level 1). Sonrası her kademede belirgin artar.
 */
export const RANK_THRESHOLDS: number[] = [
  0, 40, 100, // G-, G, G+
  180, 300, 450, // F-, F, F+
  700, 1000, 1400, // E-, E, E+
  2000, 2800, 3800, // D
  5200, 7000, 9200, // C
  12000, 16000, 21000, // B
  28000, 37000, 48000, // A
  65000, 85000, 110000, // S
  150000, 220000, // X-, X
];

/** Bir kademeye terfi için gereken en düşük Level: harfin ilk kademesinde o harfin tipik alt sınırı (F- → Level 1). */
export function levelRequirement(target: SubRank): number {
  const li = subRankLetterIndex(target);
  const sub = target - li * 3;
  if (li === 0) return 0;
  if (li === 1) return sub === 0 ? 1 : sub === 1 ? 2 : 2;
  const [lo] = RANK_LEVEL_RANGES[LETTERS[li]];
  return lo + sub;
}

/**
 * Terfi sınavı: G, F ve E harflerinin içinde terfi sınavsızdır (puanla olur).
 * E-'den itibaren harf atlayan terfiler (F+ → E-, E+ → D-, …) ve D ve üstündeki tüm terfiler sınavlıdır.
 */
export function examRequired(target: SubRank): boolean {
  const E = parseSubRank('E-');
  if (target < E) return false;
  if (target === E + 1 || target === E + 2) return false; // E içinde
  return true;
}

/** Joseph'in kendi harfinin ve bir üstünün görevlerini alabilir. */
export function canTakeQuest(myRank: SubRank, questLetter: Letter): boolean {
  const qi = LETTERS.indexOf(questLetter);
  const mi = subRankLetterIndex(myRank);
  return qi <= mi + 1;
}

/** Grup görevi: herkes puanın %50'sini alır (aşağı yuvarlanır). */
export function groupPoints(points: number): number {
  return Math.floor(points * 0.5);
}

export interface GuildState {
  /** Kayıtlı mı (kart elinde mi)? */
  member: boolean;
  points: number;
  /** Loncaya borç (bronz); sonraki ödüllerden düşülür. */
  debt: number;
  /** Ertesi gün işlenecek terfi (Celeste: "Kayıtlar yarın işlenir."). */
  pending: { rank: SubRank; day: number } | null;
  /** Kart kaç kez alındı. */
  revoked: number;
}

export function newGuildState(): GuildState {
  return { member: false, points: 0, debt: 0, pending: null, revoked: 0 };
}

/** Puana göre ulaşılabilecek en yüksek kademe (Level şartı ve sınavsız terfiler dahil, sınavlılar hariç). */
export function earnedRank(points: number, current: SubRank, level: number): SubRank {
  let r = current;
  while (r + 1 < RANK_THRESHOLDS.length && points >= RANK_THRESHOLDS[r + 1] && level >= levelRequirement(r + 1) && !examRequired(r + 1)) r++;
  return r;
}

/** Bir sonraki kademeye kalan puan (yoksa null). */
export function pointsToNext(points: number, current: SubRank): number | null {
  if (current + 1 >= RANK_THRESHOLDS.length) return null;
  return Math.max(0, RANK_THRESHOLDS[current + 1] - points);
}

export interface RewardResult {
  /** Gerçekten ödenen para (borç düşüldükten sonra). */
  paid: number;
  /** Borçtan düşülen. */
  toDebt: number;
  points: number;
}

/**
 * Görev ödülü: puan eklenir, ödül varsa önce loncaya olan borç kapatılır.
 * group: grup görevi (puanın yarısı).
 */
export function applyReward(g: GuildState, points: number, money: number, group = false): RewardResult {
  const pts = group ? groupPoints(points) : points;
  g.points += pts;
  const toDebt = Math.min(g.debt, money);
  g.debt -= toDebt;
  return { paid: money - toDebt, toDebt, points: pts };
}

export interface PenaltyResult {
  /** Cezadan kesilen puan. */
  points: number;
  /** Ödenmesi gereken toplam para cezası (ödülün iki katı). */
  fine: number;
  /** Cüzdandan hemen ödenen. */
  paid: number;
  /** Borca yazılan. */
  addedDebt: number;
  /** Puan sıfırın altına düştü: kart alındı. */
  cardRevoked: boolean;
}

/**
 * Başarısızlık ya da yarıda bırakma: görevin puanı kadar puan ve ödülünün iki katı kadar para kesilir.
 * Para yetmezse kalan kısım loncaya borç olarak yazılır. Puan 0'ın altına düşerse kart alınır.
 * wallet: Joseph'in o anki toplam parası (bronz). Ödenecek tutarı döndürür; cüzdan işlemini çağıran yapar.
 */
export function applyPenalty(g: GuildState, points: number, reward: number, wallet: number): PenaltyResult {
  const fine = reward * 2;
  const paid = Math.min(wallet, fine);
  const addedDebt = fine - paid;
  g.debt += addedDebt;
  g.points -= points;
  let cardRevoked = false;
  if (g.points < 0) {
    cardRevoked = true;
    g.member = false;
    g.points = 0;
    g.pending = null;
    g.revoked++;
  }
  return { points, fine, paid, addedDebt, cardRevoked };
}

/** Yeniden kayıt: G-'den ve 0 puandan başlar (borç kalır). */
export function reRegister(g: GuildState) {
  g.member = true;
  g.points = 0;
  g.pending = null;
}

/** Görev alınırken gösterilen risk metni. */
export function riskText(points: number, reward: number): string {
  return `Başarısızlık ya da yarıda bırakma: −${points} Lonca Puanı ve ödülün iki katı (${reward * 2} bronz) ceza. Para yetmezse kalanı loncaya borç yazılır; puan sıfırın altına düşerse kart alınır.`;
}

export function rankName(r: SubRank | null): string {
  return r === null ? 'Yok' : subRankToString(r);
}
