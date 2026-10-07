// Kaydırılabilir listelerde "bu dokunuş sürükleme miydi?" bilgisi — saf mantık (Phaser'sız, testli).
// Bayrak jeste (işaretçinin basış zamanı, `downTime`) bağlıdır: bir önceki kaydırmanın sürüklemesi,
// sahne düzeyindeki pointerdown hiç gelmese bile (Button stopPropagation) yeni dokunuşu yutmaz.

/** Bu kadar pikselden fazla kayan basış sürükleme sayılır (kaydırma eşiği 6, tıklama iptali 8). */
export const DRAG_SCROLL_PX = 6;
export const DRAG_CANCEL_PX = 8;

export class DragGesture {
  /** Şu an izlenen jestin basış zamanı (yoksa -1). */
  private downTime = -1;
  /** İzlenen jestte en büyük kayma (px). */
  moved = 0;
  /** Eşiği aşan (sürükleme olan) son jestin basış zamanı. */
  private dragStamp = -1;

  begin(downTime: number) {
    this.downTime = downTime;
    this.moved = 0;
  }

  /** Jest sürerken kayma; true dönerse liste kaydırılmalı. */
  move(dist: number, downTime: number): boolean {
    if (downTime !== this.downTime) return false;
    this.moved = Math.max(this.moved, Math.abs(dist));
    if (this.moved > DRAG_CANCEL_PX) this.dragStamp = downTime;
    return this.moved > DRAG_SCROLL_PX;
  }

  end() {
    this.downTime = -1;
  }

  get active() {
    return this.downTime >= 0;
  }

  /** `downTime` basışıyla başlayan jest sürükleme miydi? Başka (yeni) bir basış için hep false. */
  wasDrag(downTime: number) {
    return this.dragStamp >= 0 && this.dragStamp === downTime;
  }
}
