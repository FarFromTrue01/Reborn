/** Kapı hedefli "git" amaçları (0.8.0, A2). Saf: test edilir. */

/** Bir "git" hedefi bu kapılardan birinin önünde mi? (kapı noktası ya da 1,5 karo içi) */
export function doorGoal(p: { x: number; y: number }, doors: { x: number; y: number; w: number; h: number }[]): boolean {
  return doors.some((d) => {
    const cx = Math.max(d.x, Math.min(d.x + d.w - 1, p.x));
    const cy = Math.max(d.y, Math.min(d.y + d.h - 1, p.y));
    return Math.hypot(p.x - cx, p.y - cy) <= 1.5;
  });
}

