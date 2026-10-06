// Servis Koşturmacası (D4) için saf kurallar: günlük zorluk, hedef, kazanma/kaybetme ve performans puanı.

/** Güne göre zorluk (1–3). */
export function serveDifficulty(day: number) {
  const d = Math.max(1, Math.min(3, day));
  const spawnEvery = [5.2, 4.2, 3.3][d - 1];
  const dur = 42;
  return {
    tables: [4, 5, 6][d - 1],
    spawnEvery,
    patience: [15, 12.5, 10.5][d - 1],
    tray: 2,
    speed: [620, 600, 580][d - 1],
    /** Temponun ölçüsü: bu sürede gelecek müşteri sayısı hedefi belirler (eski oyun süresi). */
    dur,
    /** Aynı anda en fazla bekleyen müşteri. */
    maxWaiting: [3, 4, 5][d - 1],
    /** 0.8.0: günün hedef müşteri sayısı (yemeği verilip tabağı bulaşığa konan). */
    goal: serveGoal(dur, spawnEvery),
    /** 0.8.0: kirli tabağın bulaşığa konması için süre (sn). Dolarsa oyun kaybedilir. */
    plateTime: [18, 16, 14][d - 1],
    /** Güvenlik sınırı: hedefe bu sürede ulaşılamazsa kaybedilir (han kapanır). */
    limit: 150,
  };
}

/** Hedef: mevcut tempoda (süre / müşteri aralığı) gelen müşterilerin %60'ı → 1. gün 5, 2. gün 6, 3. gün 8. */
export function serveGoal(dur: number, spawnEvery: number) {
  return Math.round((dur / spawnEvery) * 0.6);
}

export type ServeLoss = 'order' | 'plate' | 'time';

/** Kaybetme nedeni metni (kaybettin ekranı). */
export const SERVE_LOSS_TEXT: Record<ServeLoss, string> = {
  order: 'Bir müşterinin siparişi zamanında gelmedi.',
  plate: 'Kirli bir tabak zamanında bulaşığa konmadı.',
  time: 'Han kapandı; hedef müşteri sayısına ulaşılamadı.',
};

/** Durum: kazanıldı mı, kaybedildi mi? (anında; hedef = yemeği verilen ve tabağı bulaşığa konan müşteri) */
export function serveOutcome(s: { completed: number; goal: number; orderExpired: boolean; plateExpired: boolean; t: number; limit: number }): { win: boolean; loss: ServeLoss | null } | null {
  if (s.orderExpired) return { win: false, loss: 'order' };
  if (s.plateExpired) return { win: false, loss: 'plate' };
  if (s.completed >= s.goal) return { win: true, loss: null };
  if (s.t >= s.limit) return { win: false, loss: 'time' };
  return null;
}

/** Performans (yalnızca Bertram'ın yorumu): hedefe ne kadar hızlı ulaşıldı. 0..1 */
export function servePerfTime(t: number, goal: number, spawnEvery: number) {
  const expected = goal * spawnEvery + 10;
  return Math.max(0, Math.min(1, expected / Math.max(1, t)));
}

/** Eski performans puanı: başarı oranı, hacim ve tabak düzeni. 0..1 */
export function servePerf(served: number, failed: number, platesCleared: number, platesMade: number, target: number) {
  const ratio = served / Math.max(1, served + failed);
  const volume = Math.min(1, served / Math.max(1, target));
  const plates = platesMade ? platesCleared / platesMade : 1;
  return Math.max(0, Math.min(1, ratio * 0.55 + volume * 0.3 + plates * 0.15));
}
