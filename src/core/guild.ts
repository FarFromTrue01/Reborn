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
  // 0.11.0 (C15): yeni eşikler (rütbenin altındaki görevler artık az ya da hiç puan vermez)
  0, 60, 150, // G-, G, G+
  300, 500, 750, // F-, F, F+
  1200, 1700, 2300, // E-, E, E+
  3200, 4300, 5600, // D
  7500, 9800, 12500, // C
  16000, 21000, 27000, // B
  35000, 45000, 58000, // A
  75000, 97000, 125000, // S
  170000, 250000, // X-, X
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

/**
 * 0.11.0 (C15): rütbenin altındaki görevler. Görevin harfi Joseph'in harfinden bir düşükse puanın %25'i (aşağı
 * yuvarlanır), iki ve daha fazla düşükse 0. Grup görevlerinde önce %50, sonra bu indirim.
 * Döner: gerçek puan ve kaç harf altta olduğu (0: rütbede ya da üstte).
 */
export function questPointsFor(base: number, questLetter: Letter, myRank: SubRank | null, group = false): { points: number; below: number } {
  const p = group ? groupPoints(base) : base;
  if (myRank === null) return { points: p, below: 0 };
  const below = Math.max(0, subRankLetterIndex(myRank) - LETTERS.indexOf(questLetter));
  if (below === 0) return { points: p, below };
  if (below === 1) return { points: Math.floor(p * 0.25), below };
  return { points: 0, below };
}

/** İlanda ve bitiş animasyonunda puan yazısı: "+2 Lonca Puanı (rütbenin altında)", "0 puan". */
export function questPointsLabel(r: { points: number; below: number }): string {
  if (r.points <= 0) return '0 puan (rütbenin çok altında)';
  return `+${r.points} Lonca Puanı${r.below ? ' (rütbenin altında)' : ''}`;
}

export interface GuildState {
  /** Kayıtlı mı (kart elinde mi)? */
  member: boolean;
  points: number;
  /** Loncaya borç (bronz); sonraki ödüllerden düşülür. */
  debt: number;
  /** Kart kaç kez alındı. */
  revoked: number;
}

export function newGuildState(): GuildState {
  return { member: false, points: 0, debt: 0, revoked: 0 };
}

/**
 * Terfi (0.5.0): puan eşiği (ve Level şartı) sağlanınca "Terfi" görevi açılır; Celeste'yle konuşunca terfi o anda
 * işlenir. Eski "kayıtlar yarın işlenir" bekleyişi (guild.pending) kalktı; eski kayıtlardaki bekleyen terfi
 * yüklenirken Terfi görevine dönüştürülür (save.ts, v5 → v6).
 */
export function rankupQuestId(target: SubRank): string {
  return `m_rankup_${target}`;
}

export function isRankupQuest(id: string): boolean {
  return /^m_rankup_\d+$/.test(id);
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

/**
 * Lonca puan barı (0.9.0): mevcut rütbenin başladığı puandan bir sonraki rütbenin puanına kadar. Lonca Kartı ve görev
 * bitiş animasyonu aynı hesabı kullanır. hi === null: en yüksek rütbe (bar dolu).
 */
export function guildBar(points: number, rank: SubRank): { lo: number; hi: number | null; frac: number } {
  const lo = RANK_THRESHOLDS[Math.min(rank, RANK_THRESHOLDS.length - 1)];
  if (rank + 1 >= RANK_THRESHOLDS.length) return { lo, hi: null, frac: 1 };
  const hi = RANK_THRESHOLDS[rank + 1];
  return { lo, hi, frac: Math.max(0, Math.min(1, (points - lo) / Math.max(1, hi - lo))) };
}

/**
 * B6 (0.10.0): barın etiketi — mutlak puan / bir sonraki kademenin eşiği ("70 / 100"). Barın dolum oranı aynı kalır
 * (`guildBar`: mevcut kademenin başından). En yüksek kademede "En yüksek rütbe".
 */
export function guildBarLabel(points: number, rank: SubRank): string {
  const { hi } = guildBar(points, rank);
  return hi === null ? 'En yüksek rütbe' : `${points} / ${hi}`;
}

/**
 * Puan artışının bar dilimleri: önceki puandan yeni puana. Bir rütbe eşiği geçilirse o aralık dolar ve bir sonraki
 * aralıkta baştan başlar (rütbe terfi konuşmasıyla değişse de bar eşiklere göre ilerler).
 */
export function guildBarSegments(before: number, after: number, rank: SubRank): { rank: SubRank; lo: number; hi: number | null; from: number; to: number }[] {
  const out: { rank: SubRank; lo: number; hi: number | null; from: number; to: number }[] = [];
  let r = rank;
  let p0 = before;
  for (let guard = 0; guard < RANK_THRESHOLDS.length; guard++) {
    const { lo, hi } = guildBar(p0, r);
    const fr = (p: number) => (hi === null ? 1 : Math.max(0, Math.min(1, (p - lo) / Math.max(1, hi - lo))));
    if (hi === null || after < hi) {
      out.push({ rank: r, lo, hi, from: fr(p0), to: fr(after) });
      break;
    }
    out.push({ rank: r, lo, hi, from: fr(p0), to: 1 });
    p0 = Math.max(hi, p0);
    r++;
  }
  return out;
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
export function applyReward(g: GuildState, points: number, money: number, group = false, letter?: Letter, myRank: SubRank | null = null): RewardResult {
  const pts = letter ? questPointsFor(points, letter, myRank, group).points : group ? groupPoints(points) : points;
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
    g.revoked++;
  }
  return { points, fine, paid, addedDebt, cardRevoked };
}

/** Yeniden kayıt: G-'den ve 0 puandan başlar (borç kalır). */
export function reRegister(g: GuildState) {
  g.member = true;
  g.points = 0;
}

/** Görev alınırken gösterilen risk metni. */
export function riskText(points: number, reward: number): string {
  return `Başarısızlık ya da yarıda bırakma: −${points} Lonca Puanı ve ödülün iki katı (${reward * 2} bronz) ceza. Para yetmezse kalanı loncaya borç yazılır; puan sıfırın altına düşerse kart alınır.`;
}

export function rankName(r: SubRank | null): string {
  return r === null ? 'Yok' : subRankToString(r);
}

// ---------------------------------------------------------------- B14: pano görevlerinde süre uyarısı (0.10.0)
/**
 * Kalan gün (bugün dahil): görev `startedDay + days` gününün sonuna kadar teslim edilebilir (chapter2.onNewDay:
 * `day > startedDay + days` → başarısız). 1 = son gün, 0 ya da altı = süresi doldu.
 */
export function boardDaysLeft(startedDay: number, days: number, day: number): number {
  return startedDay + days - day + 1;
}

/** "3 gün kaldı", "Son gün!" */
export function deadlineLabel(left: number): string {
  return left <= 1 ? 'Son gün!' : `${left} gün kaldı`;
}

/** Hatırlatma saati (son günün akşamı). */
export const DEADLINE_EVENING_HOUR = 18;

/**
 * Hangi uyarı şimdi gösterilmeli? Son günün sabahı (uyanınca ya da gün değişince) bir kez büyük olmayan bildirim;
 * aynı gün 18:00'den sonra bir kez kısa hatırlatma. shown: o gün gösterilenler.
 */
export function deadlineNotice(left: number, hour: number, shown: { morning?: boolean; evening?: boolean }): 'morning' | 'evening' | null {
  if (left !== 1) return null;
  if (!shown.morning) return 'morning';
  if (hour >= DEADLINE_EVENING_HOUR && !shown.evening) return 'evening';
  return null;
}

/** Ceza tutarları (gerçek değerler): puan ve bronz. */
export function penaltyOf(points: number, reward: number): { points: number; fine: number } {
  return { points, fine: reward * 2 };
}
