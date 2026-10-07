// Servis Koşturmacası (D4) için saf kurallar: günlük zorluk, hedef, kazanma/kaybetme ve performans puanı.

/**
 * Güne göre zorluk. 0.10.0 (B12): iş 2 gün; eski 1. gün (4 masa) kalktı — yeni 1. gün eski 2. gün, yeni 2. gün eski
 * 3. gün. Tablolar eski üç günün değerleri; `SERVE_DAY_OFFSET` yeni günü eski satıra kaydırır.
 */
export const SERVE_DAYS = 2;
const SERVE_DAY_OFFSET = 1;
export function serveDifficulty(day: number) {
  const d = Math.max(1, Math.min(SERVE_DAYS, day)) + SERVE_DAY_OFFSET;
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
    /** A7.13: ilk müşteri oyun açıldıktan bu kadar sonra gelir (sn) ve ilk siparişin sabrı biraz uzundur. */
    firstDelay: 2.8,
    firstPatienceMult: 1.35,
  };
}

/** Çöp kutusu (B12): elindeki yiyecekler atılır, kirli tabaklar atılamaz (bulaşığa). Ceza yok. */
export function discardFood<T extends string>(carry: T[]): { carry: T[]; discarded: number; plateWarning: boolean } {
  const plates = carry.filter((c) => c === 'plate');
  const food = carry.length - plates.length;
  return { carry: plates, discarded: food, plateWarning: plates.length > 0 };
}

/** Hedef: mevcut tempoda (süre / müşteri aralığı) gelen müşterilerin %60'ı → 1. gün 6, 2. gün 8 (eski 1. gün 5). */
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
