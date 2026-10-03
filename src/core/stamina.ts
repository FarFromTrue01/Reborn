// Koşu ve "tükendi" kilidi (A1).
// Dayanıklılık 0'a inince koşu kilitlenir: koşu isteği sürse bile Joseph yürür ve dayanıklılık dolar.
// Kilit, koşu isteği bir kez bırakılınca (joystick eşiğin altına çekilir / bırakılır, Shift bırakılır) kalkar.

export interface RunLock {
  exhausted: boolean;
}

/** Bir karelik koşu kararı. want: oyuncu şu an koşmak istiyor mu (joystick sonda / Shift basılı). */
export function runStep(lock: RunLock, want: boolean, stamina: number): boolean {
  if (lock.exhausted) {
    if (!want) lock.exhausted = false;
    return false;
  }
  if (want && stamina <= 0) {
    lock.exhausted = true;
    return false;
  }
  return want;
}

/** Joystick'in koşu eşiği (0..1). */
export const RUN_THRESHOLD = 0.92;
