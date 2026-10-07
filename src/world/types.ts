export const TILE = 32;

export const TERRAIN = {
  grass: 0,
  flowers: 1,
  forest: 2,
  sand: 3,
  dirt: 4,
  mud: 5,
  farm: 6,
  cobble: 7,
  water: 8,
  floor: 20, // iç mekân zemini (ayrı karo)
  wall: 21, // iç mekân duvarı
  void: 22,
} as const;

/** Çizim sırası (alttan üste) ve tileset satır adı. */
export const LAYER_ORDER: { id: number; name: string }[] = [
  { id: TERRAIN.forest, name: 'forest' },
  { id: TERRAIN.sand, name: 'sand' },
  { id: TERRAIN.dirt, name: 'dirt' },
  { id: TERRAIN.mud, name: 'mud' },
  { id: TERRAIN.farm, name: 'farm' },
  { id: TERRAIN.cobble, name: 'cobble' },
  { id: TERRAIN.water, name: 'water' },
];

export interface ColliderRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Hangi dekora ait (testler ve yakılabilir çalılar için). */
  key?: string;
  off?: boolean;
}

export interface PropPlacement {
  key: string; // props atlas frame
  x: number; // px, alt orta
  y: number; // px, alt
  sway?: boolean;
  depthOffset?: number;
  flat?: boolean; // zemine yatık (derinlik sıralamasız)
  light?: { radius: number; color: number; flicker?: boolean; night?: boolean };
  interact?: string; // etkileşim kimliği
  scale?: number;
  flipX?: boolean;
  anim?: string[];
  alpha?: number;
  tint?: number;
  /** Bu dekor bir toplama noktasının görseli (0.6.0: bire bir eşleşme; toplandığı gün soluk görünür). */
  gather?: string;
}

export interface BuildingPlacement {
  id: string;
  name: string;
  tx: number; // sol kenar (karo)
  tyBottom: number; // alt kenar (karo)
  enter?: { map: string; x: number; y: number } | null;
  locked?: string; // kilitliyse mesaj
  sign?: string;
  hours?: [number, number];
}

export interface Zone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number; // karo
  name?: string;
  safe?: boolean;
  music?: string;
  danger?: number;
}

export interface SpawnDef {
  id: string;
  monster: string;
  x: number;
  y: number; // karo
  radius: number; // karo (dolaşma)
  count: number;
  respawn: number; // oyun dakikası
  level?: number;
}

export interface Warp {
  x: number;
  y: number;
  w: number;
  h: number; // karo
  to: string;
  tx: number;
  ty: number;
  facing: string;
  label?: string;
  hours?: [number, number];
  closedMsg?: string;
}

export interface Trigger {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  once?: boolean;
}

export interface Gather {
  id: string;
  x: number;
  y: number;
  item: string;
  kind: 'herb' | 'wood' | 'apple';
}

/** Kapı/geçiş görselleri. Testler (tests/doors.test.ts) her geçişin bunlardan birine sahip olduğunu doğrular. */
export const DOOR_SPRITES = ['building', 'exit', 'side', 'ladder'] as const;
export type DoorSprite = (typeof DOOR_SPRITES)[number];

/**
 * Bir kapı ya da geçiş. (x, y) geçilen açıklık karosu; h dikey kapılarda açıklığın yüksekliği.
 * dir: kapıdan geçerken bakılan yön (dünyadaki bina kapıları 'up', iç mekân çıkışları 'down',
 * yan duvardaki kapılar 'left' / 'right').
 */
export interface DoorDef {
  x: number;
  y: number;
  h?: number;
  dir: 'up' | 'down' | 'left' | 'right';
  sprite: DoorSprite;
  /** Bir warp'a (harita geçişine) mı bağlı, yoksa aynı harita içinde bir geçit mi? */
  warp: boolean;
  /** 'building' kapıları için binanın kimliği. */
  building?: string;
  label?: string;
}

export interface MapData {
  id: string;
  name: string;
  /** İç mekânın kısa adı (HUD bölge kutusu). */
  short?: string;
  w: number;
  h: number;
  indoor: boolean;
  terrain: Uint8Array;
  /** NPC yol bulma ızgarası (karo): sert engeller + dekorların kapladığı karolar. */
  solid: Uint8Array;
  /** Oyuncu/aktör çarpışma ızgarası (karo): yalnızca su, duvar, bina, bariyer gibi sert engeller. */
  hard: Uint8Array;
  /** Dekorların piksel çarpışma kutuları (görünen tabanlarına oturur). */
  colliders: ColliderRect[];
  floorTiles?: Int16Array; // iç mekân: tileset karo indeksi (-1 boş)
  wallTiles?: { x: number; y: number; h: number; style: string }[];
  props: PropPlacement[];
  buildings: BuildingPlacement[];
  zones: Zone[];
  spawns: SpawnDef[];
  warps: Warp[];
  doors: DoorDef[];
  triggers: Trigger[];
  gathers: Gather[];
  music: string;
  ambientDark?: number; // iç mekân karanlığı (0..1)
  points: Record<string, { x: number; y: number }>; // adlandırılmış noktalar (karo)
}
