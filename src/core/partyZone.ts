// 0.11.0 (C8): yoldaşlarla birlikteyken (G.state.party boş değilken) görev bölgesi ve kapılar. Phaser'sız; uygulaması
// story/chapter2 (partyTick, beforeWarp). Genel yapı: her yoldaşlı görevin bölgesi veriden gelir — rota (harita
// noktalarından geçen koridor) + hedef alanları + girilebilecek iç mekânlar. Yeni görev = PARTY_ZONES'a bir kayıt.

export interface PartyZoneDef {
  /** Dünyadaki rota: sırayla harita noktaları (karo); aralarındaki doğru parçaları koridordur. */
  route: string[];
  /** Koridorun yarıçapı (karo). */
  radius: number;
  /** Hedef alanları (nokta + yarıçap, karo). */
  areas: { at: string; r: number }[];
  /** Girilebilen iç mekânlar (harita kimliği). Diğer kapılar kilitli. */
  doors: string[];
  /** Bölgeden çıkınca Vera'nın uyarısı ve geri dönüşteki repliği. */
  warn: string;
  back: string;
}

export const PARTY_ZONES: Record<string, PartyZoneDef> = {
  m_wounded: {
    route: ['forest_edge', 'road_w', 'plaza', 'door_healer'],
    radius: 6,
    areas: [{ at: 'forest_edge', r: 8 }, { at: 'door_healer', r: 4 }],
    doors: ['healer'],
    warn: 'Şifacı o tarafta, köksüz. Lina\'yı nereye götürüyorsun?',
    back: 'Dolaşacak hâlimiz yok. Şifacıya, dümdüz.',
  },
  f_wolves: {
    route: ['inn_front', 'plaza', 'guild_front', 'road_mid', 'south_road', 'stable_yard', 'pasture'],
    radius: 6,
    areas: [{ at: 'pasture', r: 12 }, { at: 'guild_front', r: 5 }, { at: 'inn_front', r: 5 }],
    doors: ['guild'],
    warn: 'Otlak bu tarafta. Nereye gidiyorsun?',
    back: 'Yolumuzdan şaşma, köksüz. Fareler bizi bekliyor.',
  },
  f_cellar: {
    route: ['inn_front', 'plaza', 'guild_front', 'plaza', 'mill_yard'],
    radius: 6,
    areas: [{ at: 'mill_yard', r: 8 }, { at: 'guild_front', r: 5 }, { at: 'inn_front', r: 5 }],
    doors: ['mill_cellar', 'guild'],
    warn: 'Değirmen bu tarafta. Nereye gidiyorsun?',
    back: 'Önce bodrum. Sonra istediğin yere gidersin.',
  },
};

/** Kilitli kapıda Vera'nın replikleri (sırayla gelir). */
export const PARTY_DOOR_LINES = [
  'Önce işimizi bitirelim, Joseph. Dükkânlar kaçmıyor.',
  'Şimdi olmaz, köksüz. Görev bitince içeri girersin.',
  'Lina\'nın sabrı yok, benimki daha az. Yürü.',
];

/** Uyarıdan sonra bu kadar karo daha uzaklaşırsa ya da bu kadar saniye dışarıda kalırsa grup rotaya döner. */
export const LEASH_EXTRA_TILES = 8;
export const LEASH_SECONDS = 10;
/** Bölgenin kenarında titreşmesin: bu kadar karo dışarıdaysa "dışarıda" sayılır. */
const OUT_EPS = 0.5;

type Pt = { x: number; y: number };

function segDist(p: Pt, a: Pt, b: Pt): { d: number; q: Pt } {
  const vx = b.x - a.x, vy = b.y - a.y;
  const L = vx * vx + vy * vy;
  const t = L > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L)) : 0;
  const q = { x: a.x + vx * t, y: a.y + vy * t };
  return { d: Math.hypot(p.x - q.x, p.y - q.y), q };
}

/**
 * Bölgeye uzaklık (karo; içerideyse 0) ve bölgenin en yakın noktası. `points` dünya haritasının noktaları (karo).
 */
export function zoneDistance(def: PartyZoneDef, points: Record<string, Pt>, p: Pt): { dist: number; nearest: Pt } {
  let best = { dist: Infinity, nearest: p };
  const route = def.route.map((k) => points[k]).filter(Boolean);
  for (let i = 0; i < route.length; i++) {
    const a = route[i], b = route[Math.min(route.length - 1, i + 1)];
    const { d, q } = segDist(p, a, b);
    const out = d - def.radius;
    if (out < best.dist) best = { dist: out, nearest: d <= def.radius ? p : { x: q.x + ((p.x - q.x) / (d || 1)) * (def.radius - 1), y: q.y + ((p.y - q.y) / (d || 1)) * (def.radius - 1) } };
  }
  for (const ar of def.areas) {
    const c = points[ar.at];
    if (!c) continue;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    const out = d - ar.r;
    if (out < best.dist) best = { dist: out, nearest: d <= ar.r ? p : { x: c.x + ((p.x - c.x) / (d || 1)) * (ar.r - 1), y: c.y + ((p.y - c.y) / (d || 1)) * (ar.r - 1) } };
  }
  return { dist: Math.max(0, best.dist), nearest: best.nearest };
}

/** Aktif yoldaşlı görevin bölgesi (yoksa null: kural yok). */
export function activePartyZone(activeQuest: (id: string) => boolean): { id: string; def: PartyZoneDef } | null {
  for (const [id, def] of Object.entries(PARTY_ZONES)) if (activeQuest(id)) return { id, def };
  return null;
}

/** Kapı: dünya haritasından iç mekâna giriş serbest mi? Çıkış hep serbest. */
export function partyDoorAllowed(def: PartyZoneDef | null, from: string, to: string): boolean {
  if (!def || from !== 'world' || to === 'world') return true;
  return def.doors.includes(to);
}

export interface LeashState {
  warned: boolean;
  outT: number;
  warnDist: number;
}

export function newLeash(): LeashState {
  return { warned: false, outT: 0, warnDist: 0 };
}

/**
 * Bölge dışı: ilk çıkışta Vera uyarır ('warn'); Joseph uyarıdan sonra ~8 karo daha uzaklaşır ya da 10 sn dışarıda
 * kalırsa grup rotaya döner ('return'). İçeri dönünce sıfırlanır.
 */
export function leashStep(s: LeashState, dist: number, dt: number): 'none' | 'warn' | 'return' {
  if (dist <= OUT_EPS) {
    s.warned = false;
    s.outT = 0;
    return 'none';
  }
  if (!s.warned) {
    s.warned = true;
    s.outT = 0;
    s.warnDist = dist;
    return 'warn';
  }
  s.outT += dt;
  if (dist - s.warnDist >= LEASH_EXTRA_TILES || s.outT >= LEASH_SECONDS) {
    s.warned = false;
    s.outT = 0;
    return 'return';
  }
  return 'none';
}
