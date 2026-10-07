import { subRankLetterIndex, type SubRank } from './ranks';

/**
 * Appraisal görünürlük seviyeleri. diff = hedefin harfi − seninki.
 *  ≥2 : sadece Title
 *   1 : + Irk, Cinsiyet, Yaş, Lonca Rütbesi, Level
 *   0 : + Statlar, Max HP/MP, Ekipman
 *  -1 : + Skill'ler
 * ≤-2 : her şey, skill EXP ilerlemesine kadar
 * Trait'ler (0.10.0, B21): NPC'lerin küçük trait'leri skill'lerle aynı kademede (≤ -1) görünür, yoksa "???".
 * Joseph'in Divine Paladin'i hiçbir Appraisal'da (ve lonca taşında) görünmez. Envanter Appraisal ile okunmaz.
 * Saygınlık yalnızca kendi kartında görünür (görünürlük kademesi değil, panel kuralı).
 */
export interface AppraisalView {
  diff: number;
  title: true;
  identity: boolean; // ırk, cinsiyet, yaş, lonca rütbesi, level
  stats: boolean; // statlar, max HP/MP, ekipman
  skills: boolean; // skill'ler
  skillExp: boolean; // skill EXP ilerlemesi
  traits: boolean; // B21: NPC trait'leri
}

export function appraisalDiff(mine: SubRank, target: SubRank): number {
  return subRankLetterIndex(target) - subRankLetterIndex(mine);
}

export function appraisalView(mine: SubRank, target: SubRank): AppraisalView {
  const diff = appraisalDiff(mine, target);
  return {
    diff,
    title: true,
    identity: diff <= 1,
    stats: diff <= 0,
    skills: diff <= -1,
    skillExp: diff <= -2,
    traits: diff <= -1,
  };
}

/** Panelin sağ üstündeki fark metni: hedefin Appraisal rütbesinin seninkine göre harf farkı (B1). */
export function appraisalDiffText(diff: number, self = false): string {
  if (self) return 'Kendine bakıyorsun.';
  if (diff >= 2) return 'Hedefin Appraisal\'ı seninkinden çok yüksek: yalnızca Title okunabiliyor.';
  if (diff === 1) return 'Hedefin Appraisal\'ı seninkinden bir harf yüksek.';
  if (diff === 0) return 'Appraisal\'larınız aynı harfte.';
  if (diff === -1) return 'Hedefin Appraisal\'ı seninkinden bir harf düşük.';
  return 'Hedefin Appraisal\'ı seninkinin çok altında: her şey okunuyor.';
}

/** Hedef seni appraise ettiğinde fark eder misin? Seninki onunkinden yüksekse. */
export function noticesAppraisal(mine: SubRank, appraiser: SubRank): boolean {
  return mine > appraiser;
}

/** Appraisal kullanım EXP tabanı: hedef ne kadar "okunması zor"sa o kadar çok. */
export function appraisalBaseExp(mine: SubRank, target: SubRank, targetLevel: number, myLevel: number): number {
  const diff = appraisalDiff(mine, target);
  const lv = Math.max(0, targetLevel - myLevel);
  return Math.max(0.5, 1.5 + diff * 1.5 + lv * 0.5);
}

/** Appraisal'ı art arda kullanmayı engelleyen bekleme (ms). */
export const APPRAISAL_COOLDOWN_MS = 1500;

/**
 * Yeni bir Appraisal paneli açılabilir mi? Panel açıkken ya da bekleme sürerken hayır.
 */
export function appraisalReady(now: number, lastAt: number | null, panelOpen: boolean, cooldownMs = APPRAISAL_COOLDOWN_MS): boolean {
  if (panelOpen) return false;
  return lastAt === null || now - lastAt >= cooldownMs;
}

/** Son Appraisal EXP kazanımından sonra, hedef farklı olsa bile yeni EXP verilmeden önce beklenen süre (ms). */
export const APPRAISAL_EXP_COOLDOWN_MS = 10_000;

/** Oturum içi Appraisal EXP saati (kayda yazılmaz). */
export interface AppraisalExpClock {
  lastAt: number | null;
}

/**
 * Skill EXP aynı hedef için günde bir kez verilir; ayrıca son EXP'den 10 sn geçmeden hiçbir hedef EXP vermez
 * (peş peşe farklı NPC'lere tıklayarak EXP biriktirilemez). Panelin açılmasını etkilemez.
 * EXP verilecekse kaydı ve saati günceller, true döner. Beklemedeyken günlük hak harcanmaz.
 * appraised: hedef kimliği → son EXP verilen gün.
 */
export function claimAppraisalExp(
  appraised: Record<string, number>,
  key: string,
  day: number,
  clock?: AppraisalExpClock,
  now = 0,
  cooldownMs = APPRAISAL_EXP_COOLDOWN_MS,
): boolean {
  if (appraised[key] === day) return false;
  if (clock && clock.lastAt !== null && now - clock.lastAt < cooldownMs) return false;
  appraised[key] = day;
  if (clock) clock.lastAt = now;
  return true;
}

/**
 * Yaratığın drop oranları yalnızca Joseph'in Appraisal rütbesi yaratığın rütbesine eşit veya üstündeyse görünür
 * (alt kademeler dahil: G+ Appraisal, G+ yaratığı okur; G okuyamaz).
 */
export function dropsVisible(mine: SubRank, creatureRank: SubRank): boolean {
  return mine >= creatureRank;
}
