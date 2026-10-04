// Yoldaş takibinin saf adımı (0.6.0; companion.ts kullanır, tests/g4a.test.ts denetler).

/** Takip eşikleri (karo): bu kadar yaklaşınca durur, bu kadar uzaklaşınca yeniden yürür (histerezis). */
export const FOLLOW_STOP = 0.8;
export const FOLLOW_GO = 1.6;
/** Yürürken korunan uzaklık (iki eşiğin arası). */
export const FOLLOW_GAP = 1.2;

export interface FollowState {
  following: boolean;
  /** Yumuşatılmış hız (px/sn). */
  speed: number;
  /** Koşu animasyonu (histerezisli). */
  run: boolean;
}

/**
 * Yoldaş takibinin bir adımı (0.6.0, saf; tests/g4a.test.ts). Eskiden ikili mantıktı (0,7 karodan uzaksa koş,
 * değilse sert dur): hedefi aşıyor, duruyor, geri kalıyor, yeniden koşuyordu. Şimdi:
 * - histerezis: FOLLOW_STOP karoda durur, FOLLOW_GO karoda yeniden yürür;
 * - hız eşleştirme: oyuncunun o anki hızına yakın, mesafe arttıkça biraz hızlı, yaklaştıkça yavaş; yumuşak geçiş;
 * - durma da yumuşak: hız sıfıra iner (sert stop yok);
 * - koşu animasyonu da histerezisli (yürüme hızının 1,3 katında koşar, 1,1 katının altında yürür).
 * df: takip noktasına uzaklık (karo); distP: oyuncuya uzaklık (karo); pv: oyuncunun hızı (px/sn); walk: yoldaşın
 * yürüme hızı (px/sn).
 */
export function followStep(s: FollowState, df: number, distP: number, pv: number, walk: number, dt: number): FollowState {
  let following = s.following;
  if (following && (df < FOLLOW_STOP || distP < 1)) following = false;
  else if (!following && df > FOLLOW_GO && distP >= 1) following = true;
  let want = 0;
  if (following) {
    // oyuncunun hızı + uzaklığa göre pay: denge FOLLOW_GAP'te (durma eşiğinin üstünde, titreşmez); uzaktaysa
    // biraz hızlı, yakındaysa biraz yavaş; alt ve üst sınır
    want = Math.max(pv, walk * 0.55) + (df - FOLLOW_GAP) * 0.45 * walk;
    want = Math.max(walk * 0.25, Math.min(want, walk * 2.1));
  }
  const k = Math.min(1, dt * (following ? 7 : 10));
  let speed = s.speed + (want - s.speed) * k;
  if (!following && speed < walk * 0.12) speed = 0;
  let run = s.run;
  if (!run && speed > walk * 1.3) run = true;
  else if (run && speed < walk * 1.1) run = false;
  return { following, speed, run };
}
