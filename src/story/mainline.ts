// Ana görev güvencesi (0.6.0): bölüm bitene kadar her an en az bir aktif ana görev olmalı.
// Hikâye sahneleri bir sonraki ana görevi kendileri açar; ama bazı geçişlerde bekleme vardır (ertesi gün, akşam,
// lonca saati) ya da görev geliştirici araçlarıyla bitirilmiştir. ensureMainQuest zincirin o anki yerine bakar ve
// eksik halkayı açar: ya zincirin gerçek bir sonraki görevini ya da oyuncuya ne yapacağını söyleyen bir "adım"
// görevini (STEP_QUESTS). Adım görevleri, zincirdeki asıl görev başlayınca sessizce kapanır.
// Saf: tests/g4a.test.ts zinciri geliştirici araçlarıyla (görevi doğrudan bitirerek) baştan sona yürütür.
import type { QuestStatus } from '../core/quests';

/** Bekleme / yönlendirme adımları (hikâye zincirinin halkası değil; asıl görev açılınca kapanır). */
export const STEP_QUESTS = ['m_board', 'm_vl_rest', 'm_gpoints', 'm_next_day', 'm_vl_cellar'] as const;

/** Bölüm I–II'nin ana görev zinciri, sırayla (adımlar ve terfi görevleri hariç). */
export const CHAIN = [
  'm_inn', 'm_bertram', 'm_harvest', 'm_register', 'm_weapon', 'm_grank', 'm_air', 'm_wounded', 'f_wolves', 'm_celebrate',
  'm_theft', 'f_cellar', 'm_silver', 'm_farewell', 'm_gate',
] as const;

export interface MainlineOps {
  status(id: string): QuestStatus | null;
  flag(name: string): unknown;
  /** Joseph'in lonca kademesi (null: kayıtsız). */
  rank: number | null;
  /** Şu an aktif olan tüm görevlerin kimlikleri. */
  active(): string[];
  start(id: string): void;
  /** Adım görevini animasyonsuz kapat. */
  closeStep(id: string): void;
}

const isStep = (id: string) => (STEP_QUESTS as readonly string[]).includes(id);
const inChain = (id: string) => (CHAIN as readonly string[]).includes(id) || /^g\d_/.test(id) || id === 'm_promotion';

/**
 * Hiçbir zincir görevi aktif değilken açılması gereken görev (zincir görevi ya da adım). Kurallar sondan başa:
 * zincirde en ileri bitmiş halkanın arkasındaki ilk eksik halka.
 */
export function nextMainQuest(o: Pick<MainlineOps, 'status' | 'flag' | 'rank'>): string | null {
  const st = (id: string) => o.status(id);
  const fin = (id: string) => { const s = st(id); return s !== null && s !== 'active'; };
  const none = (id: string) => st(id) === null;
  if (o.flag('ch2_done') || fin('m_gate')) return null;
  if (fin('m_farewell')) return 'm_gate';
  if (fin('m_silver')) return 'm_farewell';
  if (fin('f_cellar')) return 'm_silver';
  if (fin('m_theft')) return fin('m_vl_cellar') ? 'f_cellar' : 'm_vl_cellar';
  if (fin('m_celebrate')) return fin('m_next_day') ? 'm_theft' : 'm_next_day';
  if (fin('f_wolves') || fin('m_promotion')) {
    if ((o.rank ?? 0) >= 1 || fin('m_gpoints')) return 'm_celebrate';
    return 'm_gpoints';
  }
  if (fin('m_wounded')) return fin('m_vl_rest') ? 'f_wolves' : 'm_vl_rest';
  if (fin('m_air')) return 'm_wounded';
  if (fin('m_grank')) return 'm_air';
  if (fin('m_weapon')) return fin('m_board') ? 'm_grank' : 'm_board';
  if (fin('m_register')) return 'm_weapon';
  if (fin('m_harvest')) return 'm_register';
  if (fin('m_bertram')) return 'm_harvest';
  if (fin('m_inn')) return 'm_bertram';
  if (o.flag('woke') && none('m_inn')) return 'm_inn';
  return null;
}

/**
 * Güvence: bir zincir görevi aktifse açık adım görevlerini kapatır; değilse eksik halkayı açar.
 * Döner: açılan görev (ya da null).
 */
export function ensureMainQuest(o: MainlineOps): string | null {
  const act = o.active();
  const chainActive = act.some(inChain);
  if (chainActive) {
    for (const id of act) if (isStep(id)) o.closeStep(id);
    return null;
  }
  const want = nextMainQuest(o);
  if (!want || act.includes(want)) return null;
  // başka bir adım açıksa (eski kayıt, geliştirici) kapat
  for (const id of act) if (isStep(id) && id !== want) o.closeStep(id);
  o.start(want);
  return want;
}
