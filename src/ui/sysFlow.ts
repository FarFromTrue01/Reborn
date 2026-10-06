/**
 * Sistem bildirimi kuyruğu (0.8.0): tek bir yerden ilerler.
 *
 * Durumlar: boş → gösteriliyor → kapanıyor → (sıradaki ya da boş). Kapanış animasyonu sürerken gelen
 * bildirim kuyrukta bekler; kapanış bitince sıradaki gösterilir. Eskiden kapanış başlarken "gösterilen"
 * boşaltılıyordu: kapanma süresinde gelen bildirim hemen gösteriliyor, ardından kapanışın kendi
 * `next()` çağrısı onu kuyruk dışı bırakıyor ve o bildirim hiç kapanmıyordu.
 */
export interface SysFlowHooks<T, H> {
  /** Bildirimi göster; kendi kendine biten (ör. kutlama sahnesi) bildirimler `finish(h)` çağırır. */
  show(m: T): H;
  /** Kapanış animasyonu; bitince `done()` çağrılmalı. */
  hide(h: H, done: () => void): void;
}

export class SysFlow<T, H> {
  queue: T[] = [];
  /** Ekrandaki bildirim (kapanırken de). */
  current: H | null = null;
  closing = false;

  constructor(private hooks: SysFlowHooks<T, H>) {}

  push(m: T) {
    this.queue.push(m);
    if (this.current === null) this.next();
  }

  /** Ekrandaki bildirimi kapat (dokunuş ya da zamanlayıcı). `h` verilirse yalnızca o hâlâ ekrandaysa. */
  dismiss(h?: H): boolean {
    const c = this.current;
    if (c === null || this.closing || (h !== undefined && h !== c)) return false;
    this.closing = true;
    this.hooks.hide(c, () => {
      if (this.current !== c) return;
      this.next();
    });
    return true;
  }

  /** Kendi kapanışını yöneten bildirim bitti (kutlama sahneleri). */
  finish(h: H) {
    if (this.current !== h) return;
    this.next();
  }

  get busy() {
    return this.current !== null;
  }

  clear() {
    this.queue = [];
    this.current = null;
    this.closing = false;
  }

  private next() {
    this.current = null;
    this.closing = false;
    const m = this.queue.shift();
    if (m === undefined) return;
    this.current = this.hooks.show(m);
  }
}
