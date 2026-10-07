// Silaha özel saldırı zaman çizelgeleri (Grup 4B). Phaser'a bağımlı değil: testlerde sınanır.
//
// Toplam süre (`attackDur`, AGI ve Divine Hız'a bağlı) değişmez; animasyon bu süreye ölçeklenir.
// Çizelge üç bölümdür: `pre` (tutma karesine kadar), `hold` (hazırlanma: karede bekle) ve `swing`
// (geri kalan kareler). Hasar `impact` karesinin başladığı anda uygulanır.
import type { WeaponType } from '../core/types';

export type AttackAnim = 'slash' | 'thrust' | 'shoot';

export interface AttackPlan {
  anim: AttackAnim;
  frames: number;
  /** Hazırlanmada tutulan kare (öncesi `pre` bölümünde oynar). */
  holdFrame: number;
  /** Bölüm payları (toplam süreye oran): pre + hold + swing = 1. */
  pre: number;
  hold: number;
  /** Darbe karesi: hasar, düşmana değdiği bu karede. */
  impact: number;
  /** Savuruşta öne adım / atılma hızı (karo/sn, swing boyunca azalarak). */
  lunge: number;
  /** Hazırlanırken geri çekilme (piksel; görsel). */
  pullBack: number;
  /** Belirgin savurma izi. */
  trail: boolean;
  /** Yay: bırakınca geri tepme ve çekiş efekti. */
  release: boolean;
}

const base = (p: Partial<AttackPlan> & Pick<AttackPlan, 'anim' | 'frames' | 'impact'>): AttackPlan => ({
  holdFrame: 0, pre: 0, hold: 0, lunge: 0, pullBack: 0, trail: false, release: false, ...p,
});

export const ANIM_FRAMES: Record<AttackAnim, number> = { slash: 6, thrust: 8, shoot: 13 };

/**
 * Silah türüne göre normal ve ağır vuruş. Yumruk (`null`) mevcut davranışı korur: düz slash,
 * eski vuruş anı (normal %45, ağır %60) — bu yüzden impact karesi o orana denk seçildi.
 */
export function attackPlan(wt: WeaponType | null | undefined, heavy: boolean): AttackPlan {
  switch (wt) {
    case 'sword':
      return heavy
        // kısa hazırlanma (kılıç geriye çekili karede tutulur), sonra hızlı ve geniş savuruş + öne adım
        ? base({ anim: 'slash', frames: 6, holdFrame: 2, pre: 0.1, hold: 0.32, impact: 3, pullBack: 3, lunge: 2.6, trail: true })
        : base({ anim: 'slash', frames: 6, impact: 3 });
    case 'club':
      return heavy
        // sopa (ters slash): ilk karede sopa başın üstünde, geriye çekili; sonra hızlı iniş + öne adım
        ? base({ anim: 'slash', frames: 6, impact: 3, hold: 0.36, pullBack: 3, lunge: 2.6, trail: true })
        : base({ anim: 'slash', frames: 6, impact: 3 });
    case 'dagger':
      return heavy
        // hızlı saplama, kısa öne atılma
        ? base({ anim: 'thrust', frames: 8, holdFrame: 2, pre: 0.12, hold: 0.14, impact: 5, lunge: 4.2, pullBack: 1 })
        : base({ anim: 'slash', frames: 6, impact: 3 });
    case 'spear':
      return heavy
        // uzun hazırlanma (geri çekili tut) + öne hamle
        ? base({ anim: 'thrust', frames: 8, holdFrame: 3, pre: 0.14, hold: 0.42, impact: 5, lunge: 5.2, pullBack: 4, trail: true })
        : base({ anim: 'thrust', frames: 8, impact: 5 });
    case 'bow':
      return heavy
        // daha uzun germe (tam gerili karede tut), bırakınca çekiş efekti
        ? base({ anim: 'shoot', frames: 13, holdFrame: 8, pre: 0.32, hold: 0.36, impact: 9, release: true, pullBack: 1 })
        : base({ anim: 'shoot', frames: 13, impact: 9, release: true });
    default:
      return heavy ? base({ anim: 'slash', frames: 6, impact: 3.6 }) : base({ anim: 'slash', frames: 6, impact: 2.7 });
  }
}

/** Swing bölümünün kapsadığı kareler: holdFrame..frames (yarı açık). */
function swingSpan(p: AttackPlan) {
  return p.frames - p.holdFrame;
}

/** t anında (0..dur) gösterilecek kare ve bölüm. */
export function attackFrameAt(p: AttackPlan, t: number, dur: number): { frame: number; phase: 'pre' | 'hold' | 'swing' } {
  const u = Math.max(0, t / Math.max(0.0001, dur));
  const preEnd = p.pre, holdEnd = p.pre + p.hold;
  if (u < preEnd) {
    const k = u / p.pre;
    return { frame: Math.min(p.holdFrame, Math.floor(k * (p.holdFrame + 1))), phase: 'pre' };
  }
  if (u < holdEnd) return { frame: p.holdFrame, phase: 'hold' };
  const k = (u - holdEnd) / Math.max(0.0001, 1 - holdEnd);
  const f = p.holdFrame + Math.floor(k * swingSpan(p));
  return { frame: Math.min(p.frames - 1, f), phase: 'swing' };
}

/** Darbe anı (saniye): impact karesinin başladığı an. */
export function impactTime(p: AttackPlan, dur: number): number {
  const holdEnd = p.pre + p.hold;
  const k = (p.impact - p.holdFrame) / swingSpan(p);
  return dur * (holdEnd + (1 - holdEnd) * k);
}

/** Hazırlanma (kaçışla iptal edilebilir) bitiş anı. */
export function windupEnd(p: AttackPlan, dur: number): number {
  return dur * (p.pre + p.hold);
}
