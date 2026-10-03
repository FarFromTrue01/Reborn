import { subRankLetterIndex, type SubRank } from './ranks';

/**
 * Appraisal görünürlük seviyeleri. diff = hedefin harfi − seninki.
 *  ≥2 : sadece Title
 *   1 : + Irk, Cinsiyet, Yaş, Lonca Rütbesi, Level
 *   0 : + Statlar, Max HP/MP, Ekipman
 *  -1 : + Skill'ler ve Envanter
 * ≤-2 : her şey, skill EXP ilerlemesine kadar
 * Trait'ler hiçbir rütbede görünmez.
 */
export interface AppraisalView {
  diff: number;
  title: true;
  identity: boolean; // ırk, cinsiyet, yaş, lonca rütbesi, level
  stats: boolean; // statlar, max HP/MP, ekipman
  skills: boolean; // skill'ler, envanter
  skillExp: boolean; // skill EXP ilerlemesi
  traits: false;
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
    traits: false,
  };
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

/**
 * Skill EXP aynı hedef için günde bir kez verilir. EXP verilecekse kaydı günceller ve true döner.
 * appraised: hedef kimliği → son EXP verilen gün.
 */
export function claimAppraisalExp(appraised: Record<string, number>, key: string, day: number): boolean {
  if (appraised[key] === day) return false;
  appraised[key] = day;
  return true;
}
