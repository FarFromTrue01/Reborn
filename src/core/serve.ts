// Servis Koşturmacası (D4) için saf kurallar: günlük zorluk ve performans puanı.

/** Güne göre zorluk (1–3). */
export function serveDifficulty(day: number) {
  const d = Math.max(1, Math.min(3, day));
  return {
    tables: [4, 5, 6][d - 1],
    spawnEvery: [5.2, 4.2, 3.3][d - 1],
    patience: [15, 12.5, 10.5][d - 1],
    tray: 2,
    speed: [620, 600, 580][d - 1],
    dur: 42,
    /** Aynı anda en fazla bekleyen müşteri. */
    maxWaiting: [3, 4, 5][d - 1],
  };
}

/** Performans: başarı oranı, hacim ve tabak düzeni. 0..1 */
export function servePerf(served: number, failed: number, platesCleared: number, platesMade: number, target: number) {
  const ratio = served / Math.max(1, served + failed);
  const volume = Math.min(1, served / Math.max(1, target));
  const plates = platesMade ? platesCleared / platesMade : 1;
  return Math.max(0, Math.min(1, ratio * 0.55 + volume * 0.3 + plates * 0.15));
}
