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

export interface PropPlacement {
  key: string; // props atlas frame
  x: number; // px, alt orta
  y: number; // px, alt
  solid?: [number, number, number, number]; // karo bazında engel: dx0, dy0, dx1, dy1 (alt-orta karoya göre)
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

export interface MapData {
  id: string;
  name: string;
  w: number;
  h: number;
  indoor: boolean;
  terrain: Uint8Array;
  solid: Uint8Array;
  floorTiles?: Int16Array; // iç mekân: tileset karo indeksi (-1 boş)
  wallTiles?: { x: number; y: number; h: number; style: string }[];
  props: PropPlacement[];
  buildings: BuildingPlacement[];
  zones: Zone[];
  spawns: SpawnDef[];
  warps: Warp[];
  triggers: Trigger[];
  gathers: Gather[];
  music: string;
  ambientDark?: number; // iç mekân karanlığı (0..1)
  points: Record<string, { x: number; y: number }>; // adlandırılmış noktalar (karo)
}
