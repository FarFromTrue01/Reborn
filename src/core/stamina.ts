// Koşu ve "tükendi" kilidi (A1).
// Dayanıklılık 0'a inince koşu kilitlenir: koşu isteği sürse bile Joseph yürür ve dayanıklılık dolar.
// Kilit iki şekilde kalkar: (a) koşu isteği bir kez bırakılınca (joystick eşiğin altına çekilir / bırakılır,
// Shift bırakılır), (b) dayanıklılık tamamen dolunca — oyuncu elini çekmemişse Joseph kendiliğinden yeniden koşar.

export interface RunLock {
  exhausted: boolean;
}

/**
 * Bir karelik koşu kararı. want: oyuncu şu an koşmak istiyor mu (joystick sonda / Shift basılı).
 * maxStamina verilmezse yalnızca (a) yolu çalışır.
 */
export function runStep(lock: RunLock, want: boolean, stamina: number, maxStamina = Infinity): boolean {
  if (lock.exhausted) {
    if (want && stamina < maxStamina) return false;
    lock.exhausted = false;
  }
  if (want && stamina <= 0) {
    lock.exhausted = true;
    return false;
  }
  return want;
}

/** Joystick'in koşu eşiği (0..1). */
export const RUN_THRESHOLD = 0.92;
