// Gerçek zaman saati (kare deltasından bağımsız animasyonlar için).

/**
 * Kutlama zaman çizelgesinin saati (0.6.0): gerçek zamanla (performance.now) ilerler, sahnenin kare deltasıyla değil.
 * Phaser kare deltasını hedefe kırptığı için yavaş karelerde animasyon da yavaşlıyordu. Uzun bir duraklama
 * (sekme gizlendi) tek adımda en fazla `maxStep` ms sayılır.
 */
export class RealClock {
  private last: number;
  constructor(now: number, private maxStep = 1000) {
    this.last = now;
  }
  /** Son çağrıdan bu yana geçen gerçek süre (ms). */
  step(now: number): number {
    const d = Math.max(0, Math.min(this.maxStep, now - this.last));
    this.last = now;
    return d;
  }
}
