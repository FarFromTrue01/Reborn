// Ansiklopedi (B15, 0.10.0): Yaratıklar · Karakterler · Bitkiler. Genel iskelet: kayıt türü + bölge + bilinme durumu
// + kart verisi (çizim ui/codexTab.ts). İleride "Eşyalar", "Yerler" aynı yapıya CODEX_KINDS'e bir satırla eklenir.
// Saf: tests/g6.test.ts.
import { MONSTERS } from '../data/monsters';
import { NPCS, NPC_BY_ID } from '../data/npcs';
import { ITEMS } from '../data/items';
import { SHOPS } from '../data/shops';
import { RESPAWN_MINUTES } from '../world/worldgen';

export type CodexKind = 'monsters' | 'people' | 'plants';

export interface CodexMonster {
  /** İlk Appraisal günü (0: incelenmedi; öldürmeden biliniyor — eski kayıt). */
  firstDay: number;
  /** Görülen level aralığı. */
  levels: [number, number] | null;
  kills: number;
  /** Gerçekten alınan ganimetler. */
  drops: string[];
  /** Görüldüğü yerler (bölge adı). */
  places: string[];
}

export interface CodexPerson {
  /** İlk konuşma günü. */
  met: number;
  /** İlk Appraisal günü (0: incelenmedi). */
  appraised: number;
  /** Görüldüğü yerler ve saatleri ("Han · 08–21"). */
  places: string[];
}

export interface CodexPlant {
  first: number;
  count: number;
  places: string[];
}

export interface CodexState {
  monsters: Record<string, CodexMonster>;
  people: Record<string, CodexPerson>;
  plants: Record<string, CodexPlant>;
}

export function newCodex(): CodexState {
  return { monsters: {}, people: {}, plants: {} };
}

// ---------------------------------------------------------------- bölgeler
export interface CodexRegion {
  id: string;
  name: string;
}

/** Sayfalar = bölgeler. Yeni bölge (harita) bir satır; içeriği olmayan bölge "???" ile kilitli görünür. */
export const CODEX_REGIONS: CodexRegion[] = [
  { id: 'brindlewood', name: 'Brindlewood ve Çevresi' },
  { id: 'eros', name: 'Eros' },
];

/** Toplanabilir bitkiler (dünyadaki toplama noktalarının eşyaları ve nadir ot). */
export const PLANTS: { id: string; item: string; name: string; use: string; regrow: string; region: string[] }[] = [
  { id: 'herb', item: 'herb', name: 'Şifalı Ot', use: 'Şifacıya satılır, görevlerde istenir; iksir ve merhem yapımında kullanılır.', regrow: 'Her gün yeniden biter (Toplayıcılık X-: 12 saatte).', region: ['brindlewood'] },
  { id: 'apple', item: 'apple', name: 'Elma Ağacı', use: 'Yiyecek: +10 Tokluk, biraz can ve dayanıklılık. Parasızken bedava karın tokluğu.', regrow: 'Her gün yeniden meyve verir (toplamada 3 elma).', region: ['brindlewood'] },
  { id: 'silver_herb', item: 'silver_herb', name: 'Gümüş Yapraklı Ot', use: 'Nadir malzeme; şifacı iyi para verir.', regrow: 'Şifalı otların arasında nadiren (Toplayıcılık D-).', region: ['brindlewood'] },
];

/** Bir kaydın bölgeleri: bugün bütün yaratık, karakter ve bitkiler Brindlewood'da; Eros henüz boş. */
export function regionsOf(kind: CodexKind, id: string): string[] {
  if (kind === 'plants') return PLANTS.find((p) => p.id === id)?.region ?? ['brindlewood'];
  return ['brindlewood'];
}

/** Bir türün bütün kayıtları (bilinsin bilinmesin). */
export function codexIds(kind: CodexKind): string[] {
  if (kind === 'monsters') return Object.keys(MONSTERS);
  if (kind === 'people') return NPCS.filter((n) => n.id !== 'joseph').map((n) => n.id);
  return PLANTS.map((p) => p.id);
}

export const CODEX_KINDS: { kind: CodexKind; name: string; icon: string }[] = [
  { kind: 'monsters', name: 'Yaratıklar', icon: 'appraisal' },
  { kind: 'people', name: 'Karakterler', icon: 'identity' },
  { kind: 'plants', name: 'Bitkiler', icon: 'm_healer' },
];

// ---------------------------------------------------------------- kayıt (dünyadan çağrılır)
const addPlace = (list: string[], place: string | null | undefined) => {
  if (place && !list.includes(place)) list.push(place);
};

/** Yaratık Appraisal ile incelendi. Döner: yeni mi bilindi (bildirim için). */
export function codexAppraiseMonster(c: CodexState, id: string, level: number, place: string | null, day: number): boolean {
  if (!MONSTERS[id]) return false;
  const e = (c.monsters[id] ??= { firstDay: 0, levels: null, kills: 0, drops: [], places: [] });
  const fresh = !e.firstDay;
  if (fresh) e.firstDay = day;
  e.levels = e.levels ? [Math.min(e.levels[0], level), Math.max(e.levels[1], level)] : [level, level];
  addPlace(e.places, place);
  return fresh;
}

/** Yaratık öldürüldü (sayaç; kart Appraisal'la açılır). */
export function codexKill(c: CodexState, id: string, level: number, place: string | null) {
  if (!MONSTERS[id]) return;
  const e = (c.monsters[id] ??= { firstDay: 0, levels: null, kills: 0, drops: [], places: [] });
  e.kills++;
  e.levels = e.levels ? [Math.min(e.levels[0], level), Math.max(e.levels[1], level)] : [level, level];
  addPlace(e.places, place);
}

/** Yaratıktan gerçekten alınan ganimet. */
export function codexDrop(c: CodexState, monster: string, item: string) {
  const e = c.monsters[monster];
  if (e && !e.drops.includes(item)) e.drops.push(item);
}

/** NPC ile ilk konuşma (ad ve portre açılır) ve görülen yer. Döner: yeni mi. */
export function codexMeet(c: CodexState, id: string, place: string | null, day: number): boolean {
  if (!NPC_BY_ID[id]) return false;
  const fresh = !c.people[id];
  const e = (c.people[id] ??= { met: day, appraised: 0, places: [] });
  addPlace(e.places, place);
  return fresh;
}

/** NPC Appraisal ile incelendi (tanışmadan da olabilir: önce ad açılır). */
export function codexAppraisePerson(c: CodexState, id: string, place: string | null, day: number): boolean {
  if (!NPC_BY_ID[id]) return false;
  const fresh = !c.people[id];
  const e = (c.people[id] ??= { met: day, appraised: 0, places: [] });
  if (!e.appraised) e.appraised = day;
  addPlace(e.places, place);
  return fresh;
}

/** Toplama (ilk kez → bitki kartı açılır). */
export function codexGather(c: CodexState, item: string, place: string | null, day: number, n = 1): boolean {
  const p = PLANTS.find((x) => x.item === item);
  if (!p) return false;
  const fresh = !c.plants[p.id];
  const e = (c.plants[p.id] ??= { first: day, count: 0, places: [] });
  e.count += n;
  addPlace(e.places, place);
  return fresh;
}

export function codexKnown(c: CodexState, kind: CodexKind, id: string): boolean {
  if (kind === 'monsters') return !!c.monsters[id]?.firstDay;
  if (kind === 'people') return !!c.people[id];
  return !!c.plants[id];
}

export function codexName(kind: CodexKind, id: string): string {
  if (kind === 'monsters') return MONSTERS[id]?.name ?? id;
  if (kind === 'people') return NPC_BY_ID[id]?.name ?? id;
  return PLANTS.find((p) => p.id === id)?.name ?? id;
}

// ---------------------------------------------------------------- sayfalar ve kart verisi
export interface CodexPage {
  region: CodexRegion;
  /** Bölgede hiç kayıt yoksa (henüz içerik yok): sayfa "???" ile kilitli. */
  locked: boolean;
  ids: string[];
  known: number;
  total: number;
}

/** Bir türün bölge sayfaları ve "Bilinen: x/y" sayaçları. */
export function codexPages(c: CodexState, kind: CodexKind): CodexPage[] {
  const all = codexIds(kind);
  return CODEX_REGIONS.map((region) => {
    const ids = all.filter((id) => regionsOf(kind, id).includes(region.id));
    const known = ids.filter((id) => codexKnown(c, kind, id)).length;
    return { region, locked: ids.length === 0, ids, known, total: ids.length };
  });
}

/** Kartın satırları ([etiket, değer]); bilinmeyen alanlar "???". */
export interface CodexCard {
  known: boolean;
  title: string;
  subtitle: string;
  rows: [string, string][];
  notes: string[];
}

const Q = '???';

export function monsterCard(c: CodexState, id: string): CodexCard {
  const m = MONSTERS[id];
  const e = c.monsters[id];
  if (!m || !e?.firstDay) return { known: false, title: Q, subtitle: '', rows: [], notes: [] };
  const lv = e.levels ? (e.levels[0] === e.levels[1] ? `Level ${e.levels[0]}` : `Level ${e.levels[0]}–${e.levels[1]}`) : Q;
  const drops = [...m.drops.map((d) => d.id), m.special.id].map((d) => (e.drops.includes(d) ? ITEMS[d]?.name ?? d : Q));
  return {
    known: true,
    title: m.name,
    subtitle: `Rütbe ${m.rank} · ${lv}`,
    rows: [
      ['Ganimet', drops.join(', ')],
      ['Görüldüğü yer', e.places.join(', ') || Q],
      ['Yeniden doğma', `${RESPAWN_MINUTES / 60} saat`],
      ['Öldürülen', String(e.kills)],
      ['İlk inceleme', `${e.firstDay}. gün`],
    ],
    notes: [m.desc],
  };
}

/** Joseph'le ilişkinin sözle anlatımı (dostluk puanı). */
export function relationText(aff: number): string {
  if (aff >= 6) return 'Sana güveniyor';
  if (aff >= 3) return 'Sana ısınıyor';
  if (aff >= 1) return 'Seni tanıyor';
  if (aff <= -3) return 'Senden hoşlanmıyor';
  if (aff < 0) return 'Sana mesafeli';
  return 'Yabancı gibi';
}

/** Önemli olaylardan kısa notlar (bayraklara göre). */
const PERSON_NOTES: Record<string, [flag: string, note: string][]> = {
  bertram: [['bertram_deal', 'Sana iş, yatak ve bir gömlek verdi.'], ['bertram_done', 'Seni iki gün çalıştırdı, sözünü tuttu.']],
  haldor: [['farm_done', 'Hasadına yardım ettin; elli bronz ve bir ekmek verdi.']],
  celeste: [['guild_registered', 'Lonca kaydını yaptı.'], ['side_unlocked', 'Pano ilanlarını ondan alıyorsun.']],
  vera: [['friends_vl', 'Yaralıyken şifacıya taşıdın; artık yoldaşın.']],
  lina: [['friends_vl', 'Yaralıyken şifacıya taşıdın; artık yoldaşın.']],
  healer: [['vl_healed_day', 'Vera ve Lina\'yı iyileştirdi.']],
};

export function personCard(c: CodexState, id: string, ctx: { appraisalVisible?: (id: string) => { rank: string; level: string; title: string; trait: string } | null; affinity: number; flags: Record<string, unknown> }): CodexCard {
  const n = NPC_BY_ID[id];
  const e = c.people[id];
  if (!n || !e) return { known: false, title: Q, subtitle: '', rows: [], notes: [] };
  const ap = e.appraised ? ctx.appraisalVisible?.(id) ?? null : null;
  const shop = n.shop ? SHOPS[n.shop] : null;
  const rows: [string, string][] = [
    ['Rolü', n.title || Q],
    ['Rütbe', ap?.rank ?? Q],
    ['Level', ap?.level ?? Q],
    ['Unvan', ap?.title ?? Q],
    ['Trait', ap?.trait ?? Q],
    ['Görüldüğü yer', e.places.join(', ') || Q],
  ];
  if (shop) rows.push(['Satar', shop.stock.map((s) => ITEMS[s]?.name ?? s).join(', ')]);
  rows.push(['İlişki', relationText(ctx.affinity)]);
  const notes = (PERSON_NOTES[id] ?? []).filter(([f]) => !!ctx.flags[f]).map(([, t]) => t);
  return { known: true, title: n.name, subtitle: n.title ?? '', rows, notes };
}

export function plantCard(c: CodexState, id: string): CodexCard {
  const p = PLANTS.find((x) => x.id === id);
  const e = c.plants[id];
  if (!p || !e) return { known: false, title: Q, subtitle: '', rows: [], notes: [] };
  return {
    known: true,
    title: p.name,
    subtitle: ITEMS[p.item]?.name ?? '',
    rows: [
      ['Bulunduğu yer', e.places.join(', ') || Q],
      ['Ne işe yarar', p.use],
      ['Yeniden yetişme', p.regrow],
      ['Topladığın', String(e.count)],
    ],
    notes: [],
  };
}

// ---------------------------------------------------------------- göç (0.9.0 kayıtları)
/**
 * Eski kayıttan doldurma: Appraisal geçmişi (NPC kimlikleri → tanışılmış ve incelenmiş), öldürme sayaçları (yaratık
 * biliniyor), toplama kayıtları (bitki biliniyor), tanışma bayrakları.
 */
export function codexFromSave(d: { appraised?: Record<string, number>; killed?: Record<string, number>; gathered?: Record<string, number>; counters?: Record<string, number>; flags?: Record<string, unknown>; time?: { day: number } }): CodexState {
  const c = newCodex();
  const day = d.time?.day ?? 1;
  for (const [key, dd] of Object.entries(d.appraised ?? {})) {
    if (NPC_BY_ID[key]) c.people[key] = { met: dd || day, appraised: dd || day, places: [] };
  }
  for (const [id, n] of Object.entries(d.killed ?? {})) {
    if (MONSTERS[id] && n > 0) c.monsters[id] = { firstDay: day, levels: null, kills: n, drops: [], places: [] };
  }
  const gatheredIds = Object.keys(d.gathered ?? {});
  if (gatheredIds.some((g) => g.startsWith('herb')) || (d.counters?.gathered ?? 0) > 0) c.plants.herb = { first: day, count: d.counters?.gathered ?? 1, places: [] };
  if (gatheredIds.some((g) => g.startsWith('apple'))) c.plants.apple = { first: day, count: 1, places: [] };
  // tanışma bayrakları
  const f = d.flags ?? {};
  const met: [string, string[]][] = [['inn_met', ['bertram', 'vera', 'lina']], ['guild_registered', ['celeste']], ['farm_offered', ['haldor']]];
  for (const [flag, ids] of met) if (f[flag]) for (const id of ids) c.people[id] ??= { met: day, appraised: 0, places: [] };
  return c;
}
