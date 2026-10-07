// 0.11.0 (B1): sol üstteki kısa bildirimlerin düzeni ve ömrü. Phaser'sız; UIScene çizer, bu modül karar verir.
//
// Kök neden: HUD yüksekliği değişince (görev kutusu, Tokluk uyarısı) bildirimler yeniden diziliyordu; dizme
// `killTweensOf` ile kaybolma animasyonunu da öldürüp alpha'yı 1'e çekiyordu. Kapatma zamanlayıcısı zaten bittiği
// için bildirim sonsuza kadar ekranda kalıyordu. Şimdi: yeniden dizme yalnızca konumu değiştirir, kaybolan bildirim
// işaretlidir ve her bildirimin kendi ömür sayacı vardır — ömrü dolan hangi durumda olursa olsun yok edilir.

/** Bildirimin görünür kaldığı süre, kaybolma süresi ve kesin üst sınır (ms). */
export const TOAST_SHOW_MS = 2600;
export const TOAST_FADE_MS = 400;
export const TOAST_HARD_MS = 4200;
/** Satır aralığı ve en fazla bildirim. */
export const TOAST_GAP = 40;
export const TOAST_MAX = 6;

export interface ToastEntry<T> {
  item: T;
  born: number;
  fading: boolean;
}

export type ToastAction<T> = { kind: 'fade'; item: T } | { kind: 'destroy'; item: T };

export class ToastStack<T> {
  entries: ToastEntry<T>[] = [];

  /** Yeni bildirim en üste; fazlası en alttan atılır (yok edilecekleri döner). */
  add(item: T, now: number): T[] {
    this.entries.unshift({ item, born: now, fading: false });
    const out: T[] = [];
    while (this.entries.length > TOAST_MAX) out.push(this.entries.pop()!.item);
    return out;
  }

  /** Dizme: yalnızca y konumları (sırayla). Alpha'ya ve kaybolmaya dokunmaz. */
  layout(top: number): { item: T; y: number }[] {
    return this.entries.map((e, i) => ({ item: e.item, y: top + 10 + i * TOAST_GAP }));
  }

  /**
   * Her kare: ömrü dolan kaybolmaya başlar ('fade'), kaybolması bitmiş ya da kesin sınırı aşmış olan yok edilir
   * ('destroy'). Kaybolma animasyonu bir şekilde öldürülse de bildirim en geç TOAST_HARD_MS'de gider.
   */
  tick(now: number): ToastAction<T>[] {
    const acts: ToastAction<T>[] = [];
    for (const e of [...this.entries]) {
      const age = now - e.born;
      if (age >= TOAST_HARD_MS || (e.fading && age >= TOAST_SHOW_MS + TOAST_FADE_MS + 50)) {
        this.entries = this.entries.filter((x) => x !== e);
        acts.push({ kind: 'destroy', item: e.item });
      } else if (!e.fading && age >= TOAST_SHOW_MS) {
        e.fading = true;
        acts.push({ kind: 'fade', item: e.item });
      }
    }
    return acts;
  }

  /** Bildirim başka yoldan yok edildi (ör. sahne kapandı). */
  remove(item: T) {
    this.entries = this.entries.filter((e) => e.item !== item);
  }

  isFading(item: T): boolean {
    return !!this.entries.find((e) => e.item === item)?.fading;
  }

  get items(): T[] {
    return this.entries.map((e) => e.item);
  }
}
