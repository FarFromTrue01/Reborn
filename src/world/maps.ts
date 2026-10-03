// Tüm haritaları bir kez kurar: dünya + iç mekânlar; iç mekân çıkışları bina kapılarına bağlanır.
import { buildWorld, linkInteriors, type BuildingMeta } from './worldgen';
import { buildInteriors } from './interiors';
import type { MapData } from './types';

export function buildMaps(bmeta: Record<string, BuildingMeta>, floors: Record<string, number>): { world: MapData; interiors: Record<string, MapData> } {
  const world = buildWorld(bmeta);
  const interiors = buildInteriors(floors);
  linkInteriors(world, interiors);
  return { world, interiors };
}
