// Handaki oturma yerleri (0.6.0): rezervasyonlu. Her oturma noktasını aynı anda tek bir NPC tutar; dolu ise NPC aynı
// türden (iyi masalar, orta masalar, arka köşe, bar) boş bir yere yönelir; o da yoksa ayakta bekleyeceği, başka
// herkesten en az `gap` karo uzak bir boş kare seçer. Ayakta duranlar da birbirine bu mesafeden yakın durmaz.
// Saf (tests/g4a.test.ts). WorldScene, NPC haritaya girdiğinde / program yeri değiştiğinde claim, ayrılınca release çağırır;
// kapıdan teker teker giriş (npcQueue) aynen sürer, yer ayırma girişin olduğu anda yapılır.

export interface SeatPoint {
  name: string;
  x: number;
  y: number;
}

/** Oturma noktası adları (hanın noktaları: seat_m1, good_3, back_2, bar_1, table_vera...). */
export const SEAT_RE = /^(seat_|good_|back_|bar_\d|table_(vera|lina))/;

/** Aynı türden yer: adın ön eki (good, seat, back, bar, table). */
export function seatGroup(name: string): string {
  return name.split('_')[0];
}

type Tile = [number, number];

export class SeatBook {
  private owner = new Map<string, string>(); // koltuk → NPC
  private claims = new Map<string, { x: number; y: number; seat: string | null }>(); // NPC → yer

  /**
   * seats: oturma noktaları; floor: ayakta durulabilecek boş kareler (koltuklar hariç tutulur); gap: ayakta
   * duranlar ile başkaları arasındaki en az uzaklık (karo).
   */
  constructor(private seats: SeatPoint[], private floor: Tile[], private gap = 1.5) {
    const seatSet = new Set(seats.map((s) => `${s.x},${s.y}`));
    this.floor = floor.filter(([x, y]) => !seatSet.has(`${x},${y}`));
  }

  /** NPC'nin tuttuğu yer (yoksa null). */
  of(npc: string): Tile | null {
    const c = this.claims.get(npc);
    return c ? [c.x, c.y] : null;
  }

  ownerOf(seat: string): string | null {
    return this.owner.get(seat) ?? null;
  }

  release(npc: string) {
    const c = this.claims.get(npc);
    if (!c) return;
    if (c.seat && this.owner.get(c.seat) === npc) this.owner.delete(c.seat);
    this.claims.delete(npc);
  }

  /** NPC `want` karesine gitmek istiyor: gerçekte gideceği kare (koltuk ya da ayakta bekleme yeri). */
  claim(npc: string, want: Tile): Tile {
    this.release(npc);
    const seat = this.seats.find((s) => s.x === want[0] && s.y === want[1]);
    if (seat) {
      const pick = !this.owner.has(seat.name) ? seat : this.nearestFreeSeat(want, seatGroup(seat.name));
      if (pick) {
        this.owner.set(pick.name, npc);
        this.claims.set(npc, { x: pick.x, y: pick.y, seat: pick.name });
        return [pick.x, pick.y];
      }
    }
    const spot = this.standSpot(npc, want);
    this.claims.set(npc, { x: spot[0], y: spot[1], seat: null });
    return spot;
  }

  private nearestFreeSeat(want: Tile, group: string): SeatPoint | null {
    let best: SeatPoint | null = null;
    let bd = Infinity;
    for (const s of this.seats) {
      // Vera ve Lina'nın masası yalnızca onların (table_ grubu kendi içinde de paylaşılmaz)
      if (this.owner.has(s.name) || seatGroup(s.name) !== group || group === 'table') continue;
      const d = Math.hypot(s.x - want[0], s.y - want[1]);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  /** Ayakta: istenen kare kalabalık değilse orası; değilse en yakın, herkesten en az `gap` uzak boş kare. */
  private standSpot(npc: string, want: Tile): Tile {
    const others = [...this.claims.entries()].filter(([id]) => id !== npc).map(([, c]) => c);
    const ok = (x: number, y: number) => others.every((c) => Math.hypot(c.x - x, c.y - y) >= this.gap);
    if (ok(want[0], want[1]) && !this.seats.some((s) => s.x === want[0] && s.y === want[1])) return want;
    let best: Tile | null = null;
    let bd = Infinity;
    for (const [x, y] of this.floor) {
      if (!ok(x, y)) continue;
      const d = Math.hypot(x - want[0], y - want[1]);
      if (d < bd) {
        bd = d;
        best = [x, y];
      }
    }
    return best ?? want;
  }
}
