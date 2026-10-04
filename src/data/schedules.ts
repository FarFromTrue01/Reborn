// NPC günlük programları (0.3.0). Her NPC'nin bir temel programı ve günden güne değişen
// alternatif gün planları vardır; hangi planın uygulanacağı gün ve NPC'ye göre deterministik seçilir
// (bkz. data/npcs.ts → planFor). Dükkân sahipleri her planda çalışma saatlerinde dükkânlarındadır.
// Konumlar dünya haritasındaki adlandırılmış noktalardır (world/worldgen.ts) ya da iç mekân noktaları.
import type { ScheduleEntry } from './npcs';
import { GUILD_HOURS } from './shops';

type Act = ScheduleEntry['act'];
const e = (from: number, to: number, map: string, at: string | [number, number], act: Act = 'work', wander = 0): ScheduleEntry => ({ from, to, map, at, act, wander });
const hide = (from: number, to: number, at: string | [number, number] = 'plaza'): ScheduleEntry => ({ from, to, map: 'hidden', at });
const patrol = (from: number, to: number, pts: [number, number][]): ScheduleEntry => ({ from, to, map: 'world', at: pts[0], act: 'patrol', patrol: pts });

export interface NpcSchedule {
  base: ScheduleEntry[];
  /** Alternatif gün planları. */
  plans?: ScheduleEntry[][];
  /** Plan seçimini başka bir NPC'yle eşle (ör. paralı asker efendisini, Pip annesini izler). */
  planKey?: string;
}

const HOB_A: [number, number][] = [[66, 58], [78, 57], [84, 53], [91, 57], [104, 57], [86, 66], [86, 78], [92, 73]];
const HOB_B: [number, number][] = [[85, 66], [85, 84], [100, 100], [116, 101], [128, 92], [128, 72], [112, 58], [91, 57]];
const WIL: [number, number][] = [[84, 55], [90, 58], [86, 65], [78, 59]];
const PELL: [number, number][] = [[112, 58], [128, 60], [128, 75], [128, 90], [136, 89], [128, 80], [120, 58], [146, 57]];

export const SCHEDULES: Record<string, NpcSchedule> = {
  // ------------------------------------------------------------- ana karakterler
  bertram: { base: [e(5, 24, 'inn', 'bertram'), hide(0, 5, 'bertram')] },
  vera: {
    base: [e(8, 12, 'inn', 'table_vera', 'sit'), e(12, 17, 'guild', 'vera', 'talk'), e(17, 23, 'inn', 'table_vera', 'drink'), hide(23, 8, 'table_vera')],
    plans: [
      [e(8, 12, 'world', 'training', 'work', 2), e(12, 17, 'guild', 'vera', 'talk'), e(17, 21, 'inn', 'table_vera', 'drink'), hide(21, 8, 'table_vera')],
      [e(8, 11, 'inn', 'table_vera', 'sit'), e(11, 16, 'world', 'plaza_e', 'talk', 2), e(16, 23, 'inn', 'table_vera', 'drink'), hide(23, 8, 'table_vera')],
    ],
  },
  lina: {
    planKey: 'vera',
    base: [e(8, 12, 'inn', 'table_lina', 'sit'), e(12, 17, 'guild', 'lina', 'talk'), e(17, 23, 'inn', 'table_lina', 'drink'), hide(23, 8, 'table_lina')],
    plans: [
      [e(8, 12, 'world', 'training', 'work', 2), e(12, 17, 'guild', 'lina', 'talk'), e(17, 21, 'inn', 'table_lina', 'drink'), hide(21, 8, 'table_lina')],
      [e(8, 11, 'inn', 'table_lina', 'sit'), e(11, 16, 'world', 'plaza_e', 'talk', 2), e(16, 23, 'inn', 'table_lina', 'drink'), hide(23, 8, 'table_lina')],
    ],
  },
  celeste: { base: [e(GUILD_HOURS[0], GUILD_HOURS[1], 'guild', 'celeste'), hide(GUILD_HOURS[1] % 24, GUILD_HOURS[0], 'celeste')] },

  // ------------------------------------------------------------- esnaf
  smith: {
    base: [e(8, 18, 'smithy', 'smith'), e(18, 22, 'inn', 'seat_m1', 'drink'), hide(22, 8, 'smith')],
    plans: [
      [e(8, 18, 'smithy', 'smith'), e(18, 20, 'world', 'smithy_yard', 'work', 1), hide(20, 8, 'smith')],
      [e(8, 18, 'smithy', 'smith'), hide(18, 8, 'smith')],
    ],
  },
  shopkeeper: {
    base: [e(8, 19, 'shop', 'shopkeeper'), e(19, 21, 'world', 'plaza_e', 'talk', 2), hide(21, 8, 'shopkeeper')],
    plans: [
      [e(8, 19, 'shop', 'shopkeeper'), e(19, 22, 'inn', 'seat_m5', 'drink'), hide(22, 8, 'shopkeeper')],
      [e(8, 19, 'shop', 'shopkeeper'), hide(19, 8, 'shopkeeper')],
    ],
  },
  healer: {
    base: [e(9, 17, 'healer', 'healer'), e(17, 20, 'world', 'healer_garden', 'work', 2), hide(20, 9, 'healer')],
    plans: [[e(9, 17, 'healer', 'healer'), e(17, 19, 'world', 'oak_w', 'sit'), hide(19, 9, 'healer')]],
  },
  hunter: {
    base: [e(6, 12, 'world', 'training', 'work', 3), e(12, 18, 'lodge', 'hunter'), e(18, 23, 'inn', 'seat_m6', 'drink'), hide(23, 6, 'training')],
    plans: [
      [e(6, 12, 'world', 'lodge_yard', 'work', 3), e(12, 18, 'lodge', 'hunter'), e(18, 21, 'world', 'lodge_yard', 'sit'), hide(21, 6, 'lodge_yard')],
      [e(6, 12, 'world', 'riverbank', 'work', 2), e(12, 18, 'lodge', 'hunter'), hide(18, 6, 'lodge_yard')],
    ],
  },
  baker: {
    base: [e(5, 18, 'bakery', 'baker'), e(18, 21, 'world', 'ep_w', 'talk', 2), hide(21, 5, 'baker')],
    plans: [[e(5, 18, 'bakery', 'baker'), hide(18, 5, 'baker')], [e(5, 18, 'bakery', 'baker'), e(18, 21, 'inn', 'seat_m8', 'drink'), hide(21, 5, 'baker')]],
  },
  tailor: {
    base: [e(9, 18, 'tailor', 'tailor'), e(18, 20, 'world', 'ep_e', 'talk', 2), hide(20, 9, 'tailor')],
    plans: [[e(9, 18, 'tailor', 'tailor'), hide(18, 9, 'tailor')]],
  },
  tanner: {
    base: [e(8, 18, 'tannery', 'tanner'), e(18, 23, 'inn', 'bar_2', 'drink'), hide(23, 8, 'tanner')],
    plans: [[e(8, 18, 'tannery', 'tanner'), e(18, 20, 'world', 'tannery_yard', 'work', 1), hide(20, 8, 'tanner')]],
  },
  apprentice: {
    base: [e(8, 18, 'smithy', [6, 6]), e(18, 21, 'world', 'smithy_yard', 'talk', 2), hide(21, 8, 'smithy_yard')],
    plans: [[e(8, 18, 'smithy', [6, 6]), e(18, 20, 'world', 'plaza_s', 'talk', 2), hide(20, 8, 'smithy_yard')]],
  },
  carpenter: {
    base: [e(7, 17, 'world', 'carpentry', 'work', 2), e(17, 21, 'world', 'oak_e', 'talk', 2), hide(21, 7, 'carpentry')],
    plans: [[e(7, 17, 'world', 'carpentry', 'work', 2), e(17, 21, 'inn', 'seat_m7', 'drink'), hide(21, 7, 'carpentry')]],
  },
  bard: {
    base: [e(10, 17, 'world', 'ep_s', 'talk', 2), e(18, 23, 'inn', 'stage', 'talk'), hide(23, 10, 'ep_s')],
    plans: [
      [e(10, 17, 'world', 'plaza_e', 'talk', 2), e(17, 21, 'world', 'oak', 'talk', 1), hide(21, 10, 'ep_s')],
      [e(10, 17, 'world', 'ep_s', 'talk', 2), hide(17, 10, 'ep_s')],
    ],
  },
  innmaid: { base: [e(7, 23, 'inn', [6, 7], 'work', 3), hide(23, 7, [6, 7])] },

  // ------------------------------------------------------------- muhafızlar
  guard_hob: { base: [patrol(6, 22, HOB_A), hide(22, 6)], plans: [[patrol(6, 22, HOB_B), hide(22, 6)]] },
  guard_wil: {
    base: [patrol(0, 6, WIL), e(6, 14, 'world', 'guardpost', 'work', 2), patrol(14, 24, WIL)],
    plans: [[patrol(6, 14, WIL), e(14, 22, 'world', 'guardpost', 'work', 2), hide(22, 6, 'guardpost')]],
  },
  guard_pell: { base: [patrol(6, 22, PELL), hide(22, 6, 'road_e')] },
  captain: { base: [e(0, 24, 'world', 'checkpoint', 'work', 1)] },

  // ------------------------------------------------------------- köylüler
  tobin: {
    base: [e(7, 17, 'world', 'field_cabbage', 'work', 4), e(17, 19, 'world', 'plaza_w', 'talk', 2), e(19, 22, 'inn', 'seat_m5', 'drink'), hide(22, 7, 'field_cabbage')],
    plans: [
      [e(7, 17, 'world', 'field_cabbage', 'work', 4), e(17, 21, 'world', 'oak', 'talk', 2), hide(21, 7, 'field_cabbage')],
      [e(7, 17, 'world', 'field_corn', 'work', 4), hide(17, 7, 'field_cabbage')],
    ],
  },
  ulric: {
    base: [e(6, 16, 'world', 'field_corn', 'work', 4), e(16, 19, 'world', 'barn_yard', 'work', 2), e(19, 23, 'inn', 'seat_m7', 'drink'), hide(23, 6, 'field_corn')],
    plans: [[e(6, 16, 'world', 'field_corn', 'work', 4), e(16, 19, 'world', 'barn_yard', 'work', 2), hide(19, 6, 'field_corn')]],
  },
  hilda: {
    base: [e(7, 16, 'world', 'field_carrot', 'work', 3), e(16, 20, 'world', 'plaza_s', 'talk', 3), hide(20, 7, 'field_carrot')],
    plans: [[e(7, 16, 'world', 'field_carrot', 'work', 3), e(16, 19, 'world', 'west_houses', 'talk', 2), e(19, 21, 'inn', 'seat_m1', 'drink'), hide(21, 7, 'field_carrot')]],
  },
  greta: {
    base: [e(7, 12, 'world', 'plaza_e', 'talk', 3), e(12, 17, 'world', 'field_s3', 'work', 3), e(17, 21, 'world', 'plaza_w', 'talk', 3), hide(21, 7, 'plaza_e')],
    plans: [[e(7, 12, 'world', 'shop_lane', 'talk', 3), e(12, 17, 'world', 'field_s3', 'work', 3), e(17, 22, 'inn', 'seat_m3', 'drink'), hide(22, 7, 'plaza_e')]],
  },
  edwin: {
    base: [e(9, 12, 'world', 'bench_w1', 'sit'), hide(12, 14, 'bench_w1'), e(14, 18, 'world', 'bench_w2', 'sit'), hide(18, 9, 'bench_w1')],
    plans: [[e(9, 12, 'world', 'bench_w1', 'sit'), hide(12, 14, 'bench_w1'), e(14, 18, 'world', 'oak_w', 'sit'), hide(18, 9, 'bench_w1')]],
  },
  berta: {
    base: [e(8, 12, 'world', 'inn_front', 'sit', 1), hide(12, 15, 'inn_front'), e(15, 18, 'world', 'plaza_s', 'sit', 1), hide(18, 8, 'inn_front')],
    plans: [[e(8, 12, 'world', 'inn_front', 'sit', 1), hide(12, 15, 'inn_front'), e(15, 18, 'world', 'oak', 'sit', 1), hide(18, 8, 'inn_front')]],
  },
  anna: {
    base: [e(9, 12, 'world', 'plaza', 'talk', 2), hide(12, 14), e(14, 18, 'world', 'plaza_w', 'talk', 2), hide(18, 9)],
    plans: [[e(9, 12, 'world', 'shop_lane', 'talk', 2), hide(12, 14), e(14, 18, 'world', 'plaza', 'talk', 2), hide(18, 9)]],
  },
  pip: {
    planKey: 'anna',
    base: [e(9, 12, 'world', 'plaza', 'talk', 3), hide(12, 14), e(14, 18, 'world', 'plaza_w', 'talk', 3), hide(18, 9)],
    plans: [[e(9, 12, 'world', 'shop_lane', 'talk', 3), hide(12, 14), e(14, 18, 'world', 'plaza', 'talk', 3), hide(18, 9)]],
  },
  fenn: {
    base: [e(10, 16, 'world', 'plaza_w', 'sit', 1), e(16, 24, 'inn', 'seat_m3', 'drink'), hide(0, 10, 'plaza_w')],
    plans: [[e(10, 16, 'world', 'riverbank', 'sit', 1), e(16, 21, 'inn', 'seat_m3', 'drink'), e(21, 24, 'world', 'inn_front', 'sit'), hide(0, 10, 'plaza_w')]],
  },
  oswin: {
    base: [e(6, 18, 'world', 'mill_yard', 'work', 2), e(18, 22, 'inn', 'seat_m8', 'drink'), hide(22, 6, 'mill_yard')],
    plans: [[e(6, 18, 'world', 'mill_yard', 'work', 2), hide(18, 6, 'mill_yard')]],
  },
  dorn: {
    base: [e(9, 14, 'guild', 'adv1', 'talk'), e(14, 18, 'world', 'road_mid', 'talk', 2), e(18, 23, 'inn', 'good_1', 'drink'), hide(23, 9, 'road_mid')],
    plans: [[e(9, 14, 'guild', 'adv1', 'talk'), e(14, 18, 'world', 'training', 'work', 2), hide(18, 9, 'road_mid')]],
  },
  sira: {
    base: [e(10, 16, 'guild', 'adv2', 'sit'), e(16, 18, 'world', 'plaza_n', 'sit', 1), e(18, 21, 'inn', 'good_2', 'drink'), hide(21, 10, 'plaza_n')],
    plans: [[e(10, 16, 'guild', 'adv2', 'sit'), e(16, 20, 'world', 'oak_e', 'sit'), hide(20, 10, 'plaza_n')]],
  },
  haldor: {
    base: [e(6, 12, 'world', 'haldor_field', 'work', 3), e(12, 14, 'farmhouse', 'haldor', 'sit'), e(14, 18, 'world', 'haldor_field', 'work', 3), e(18, 22, 'farmhouse', 'haldor', 'sit'), hide(22, 6, 'haldor')],
    plans: [[e(6, 12, 'world', 'haldor_field', 'work', 3), e(12, 14, 'farmhouse', 'haldor', 'sit'), e(14, 17, 'world', 'haldor_field', 'work', 3), e(17, 21, 'inn', 'back_3', 'drink'), hide(21, 6, 'haldor')]],
  },

  // ------------------------------------------------------------- üst kast
  merchant: {
    base: [e(9, 11, 'world', 'ep_s', 'talk', 2), e(11, 13, 'tailor', 'queue', 'talk'), e(13, 16, 'world', 'plaza_e', 'talk', 3), e(16, 18, 'tannery', 'queue', 'talk'), e(18, 23, 'inn', 'good_3', 'drink'), hide(23, 9, 'manor_front')],
    plans: [[e(9, 12, 'world', 'manor_front', 'talk', 2), e(12, 16, 'world', 'ep_s', 'talk', 3), e(16, 18, 'tannery', 'queue', 'talk'), hide(18, 9, 'manor_front')]],
  },
  merc_guard: {
    planKey: 'merchant',
    base: [e(9, 11, 'world', 'ep_s', 'talk', 1), e(11, 13, 'tailor', [2, 5]), e(13, 16, 'world', 'plaza_e', 'talk', 1), e(16, 18, 'tannery', [2, 6]), e(18, 23, 'inn', 'good_6', 'drink'), hide(23, 9, 'manor_front')],
    plans: [[e(9, 12, 'world', 'manor_front', 'talk', 1), e(12, 16, 'world', 'ep_s', 'talk', 1), e(16, 18, 'tannery', [2, 6]), hide(18, 9, 'manor_front')]],
  },
  steward: {
    base: [
      { ...e(10, 12, 'world', 'plaza', 'talk'), days: [1, 5] },
      { ...e(12, 14, 'world', 'ep_s', 'talk'), days: [1, 5] },
      { ...e(14, 16, 'world', 'headman_house', 'talk'), days: [1, 5] },
      hide(0, 24, 'checkpoint'),
    ],
  },
  knight: {
    base: [
      { ...patrol(10, 12, [[85, 62], [82, 62]]), days: [1, 5] },
      { ...e(12, 14, 'world', 'ep_s'), days: [1, 5] },
      { ...e(14, 16, 'world', 'headman_house'), days: [1, 5] },
      hide(0, 24, 'checkpoint'),
    ],
  },
  adv_thorne: {
    base: [e(9, 13, 'guild', 'adv4', 'sit'), e(13, 18, 'world', 'road_mid', 'talk', 2), e(18, 23, 'inn', 'good_5', 'drink'), hide(23, 9, 'road_mid')],
    plans: [[e(9, 13, 'guild', 'adv4', 'sit'), e(13, 18, 'world', 'training', 'talk', 2), hide(18, 9, 'road_mid')]],
  },
  adv_kael: {
    base: [e(8, 12, 'guild', 'adv3', 'sit'), e(12, 18, 'world', 'training', 'work', 3), e(18, 23, 'inn', 'bar_1', 'drink'), hide(23, 8, 'training')],
    plans: [[e(8, 12, 'world', 'training', 'work', 3), e(12, 17, 'guild', 'adv3', 'sit'), e(17, 20, 'world', 'plaza_n', 'talk', 2), hide(20, 8, 'training')]],
  },
  headman: {
    base: [e(8, 12, 'world', 'headman_house', 'talk', 2), e(12, 15, 'world', 'plaza', 'talk', 3), e(15, 18, 'world', 'ep_w', 'talk', 2), e(18, 22, 'inn', 'good_4', 'drink'), hide(22, 8, 'headman_house')],
    plans: [[e(8, 12, 'world', 'headman_house', 'talk', 2), e(12, 15, 'world', 'ep_s', 'talk', 3), e(15, 18, 'world', 'south_road', 'talk', 2), hide(18, 8, 'headman_house')]],
  },
  headwife: {
    base: [e(9, 11, 'bakery', 'queue', 'talk'), e(11, 16, 'world', 'ep_s', 'talk', 2), e(16, 18, 'tailor', 'queue', 'talk'), hide(18, 9, 'headman_house')],
    plans: [[e(9, 11, 'bakery', 'queue', 'talk'), e(11, 14, 'world', 'plaza', 'talk', 2), e(14, 18, 'world', 'ep_w', 'talk', 2), hide(18, 9, 'headman_house')]],
  },

  // ------------------------------------------------------------- güney çiftlikleri ve doğu
  farmer_m3: {
    base: [e(6, 12, 'world', 'field_s1', 'work', 4), e(12, 13, 'world', 'farm_yard', 'sit'), e(13, 18, 'world', 'field_s2', 'work', 4), e(18, 22, 'world', 'oak', 'talk', 2), hide(22, 6, 'farm_yard')],
    plans: [[e(6, 12, 'world', 'field_s2', 'work', 4), e(12, 13, 'world', 'farm_yard', 'sit'), e(13, 18, 'world', 'field_s1', 'work', 4), e(18, 22, 'inn', 'back_3', 'drink'), hide(22, 6, 'farm_yard')]],
  },
  farmer_f3: {
    base: [e(7, 11, 'world', 'farm_yard', 'work', 2), e(11, 15, 'world', 'ep_w', 'talk', 2), e(15, 19, 'world', 'field_s3', 'work', 2), hide(19, 7, 'farm_yard')],
    plans: [[e(7, 11, 'world', 'field_s3', 'work', 2), e(11, 15, 'world', 'plaza_s', 'talk', 2), e(15, 19, 'world', 'farm_yard', 'work', 2), hide(19, 7, 'farm_yard')]],
  },
  shepherd: { base: [e(6, 19, 'world', 'pasture', 'work', 5), hide(19, 6, 'pasture')] },
  milkmaid: {
    base: [e(5, 10, 'world', 'pasture_n', 'work', 3), e(10, 14, 'world', 'ep_s', 'talk', 2), e(14, 18, 'world', 'stable_yard', 'work', 3), hide(18, 5, 'pasture_n')],
    plans: [[e(5, 10, 'world', 'pasture_n', 'work', 3), e(10, 14, 'world', 'plaza_e', 'talk', 2), e(14, 18, 'world', 'pasture_n', 'work', 3), hide(18, 5, 'pasture_n')]],
  },
  washer: {
    base: [e(7, 13, 'world', 'pond', 'work', 2), e(13, 17, 'world', 'wash_line', 'work', 2), e(17, 20, 'world', 'oak_w', 'talk', 2), hide(20, 7, 'pond')],
    plans: [[e(7, 13, 'world', 'pond', 'work', 2), e(13, 17, 'world', 'wash_line', 'work', 2), e(17, 20, 'inn', 'back_2', 'drink'), hide(20, 7, 'pond')]],
  },
  gerda: {
    base: [e(8, 13, 'world', 'oak_w', 'sit'), hide(13, 15, 'farm_yard'), e(15, 19, 'world', 'farm_yard', 'sit', 1), hide(19, 8, 'farm_yard')],
    plans: [[e(8, 13, 'world', 'farm_yard', 'sit', 1), hide(13, 15, 'farm_yard'), e(15, 19, 'world', 'oak_w', 'sit'), hide(19, 8, 'farm_yard')]],
  },
  child_girl: {
    base: [e(9, 17, 'world', 'ep_s', 'talk', 4), hide(17, 9, 'ep_s')],
    plans: [[e(9, 13, 'world', 'oak', 'talk', 4), e(13, 17, 'world', 'ep_s', 'talk', 4), hide(17, 9, 'ep_s')]],
  },
  child_boy: {
    base: [e(9, 12, 'world', 'oak', 'talk', 4), e(12, 17, 'world', 'ep_s', 'talk', 4), hide(17, 9, 'oak')],
    plans: [[e(9, 12, 'world', 'training', 'talk', 3), e(12, 17, 'world', 'plaza_w', 'talk', 4), hide(17, 9, 'oak')]],
  },
  woodcutter: {
    base: [e(6, 16, 'world', 'woodcut', 'work', 2), e(16, 19, 'world', 'oak_e', 'talk', 2), e(19, 22, 'inn', 'back_2', 'drink'), hide(22, 6, 'woodcut')],
    plans: [[e(6, 16, 'world', 'woodcut', 'work', 2), hide(16, 6, 'woodcut')]],
  },

  // ------------------------------------------------------------- köksüzler
  vagrant: {
    base: [e(6, 12, 'world', 'inn_front', 'sit'), e(12, 17, 'world', 'road_e', 'sit', 2), e(17, 23, 'inn', 'back_1', 'sit'), e(23, 6, 'world', 'riverbank', 'sit')],
    plans: [[e(6, 12, 'world', 'riverbank', 'sit'), e(12, 17, 'world', 'oak_w', 'sit', 1), e(17, 23, 'inn', 'back_1', 'sit'), e(23, 6, 'world', 'riverbank', 'sit')]],
  },
  beggar: {
    base: [e(7, 19, 'world', 'beggar_spot', 'sit'), hide(19, 7, 'beggar_spot')],
    plans: [[e(7, 12, 'world', 'beggar_spot', 'sit'), e(12, 19, 'world', 'ep_w', 'sit'), hide(19, 7, 'beggar_spot')]],
  },
};
