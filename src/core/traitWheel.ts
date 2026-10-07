// Trait çarkı (B19, 0.10.0): prologda "ne kadar şanslıymışım" anı. Olasılık tablosu yalnızca gösterim içindir; sonuç
// her zaman Divine Paladin (X). Makaradaki karartılmış kartlar gerçekçi bir karışım (G–S), sonuncusu X. Açıklama
// gerçek veriden (core/divine). Saf: tests/g6.test.ts.
import { TRAIT_NAMES } from '../data/titles';
import { DIVINE_STATS, DIVINE_STAT_NAMES, divineStat, isAwakeningLevel, ADAPTATION_CAP } from './divine';

/** Rütbe olasılıkları (%): toplam tam 100. */
export const TRAIT_ODDS: [rank: string, pct: number][] = [
  ['G', 40], ['F', 25], ['E', 15], ['D', 10], ['C', 5.5], ['B', 3], ['A', 1.2], ['S', 0.2999], ['X', 0.0001],
];

/** Sonuç (her zaman): oyuncu Divine Paladin ile başlar. */
export const WHEEL_RESULT = 'divine_paladin';

/** "%0,0001", "%5,5", "%40" */
export function pctLabel(p: number): string {
  return '%' + String(p).replace('.', ',');
}

/** Bir rütbenin trait kimlikleri (makara kartları). */
export function traitsOfRank(rank: string): string[] {
  return Object.keys(TRAIT_NAMES).filter((id) => TRAIT_NAMES[id].rank === rank && id !== WHEEL_RESULT);
}

/**
 * Makara: `n` kart. Önce olasılıklara göre (X hariç) karışık kartlar, sonlara doğru "az kalsın" anları (S ve A
 * kartları sonuçtan hemen önce geçer), en son kart Divine Paladin.
 */
export function wheelReel(n: number, rnd: () => number = Math.random): string[] {
  const pool = TRAIT_ODDS.filter(([r]) => r !== 'X');
  const total = pool.reduce((a, [, p]) => a + p, 0);
  const pickRank = () => {
    let x = rnd() * total;
    for (const [r, p] of pool) {
      x -= p;
      if (x <= 0) return r;
    }
    return 'G';
  };
  const pickOf = (rank: string) => {
    const ids = traitsOfRank(rank);
    return ids[Math.floor(rnd() * ids.length)] ?? 'keen_ears';
  };
  const out: string[] = [];
  for (let i = 0; i < n - 4; i++) out.push(pickOf(pickRank()));
  // az kalsın: S, G, A ve sonuç
  out.push(pickOf('S'), pickOf('G'), pickOf('A'), WHEEL_RESULT);
  return out;
}

/** Durunca kartın altındaki açıklama — gerçek veriden. */
export function divineDescription(): { title: string; lines: string[] } {
  const stats = DIVINE_STATS.map((k) => `${DIVINE_STAT_NAMES[k]} ${divineStat(k, 0).toFixed(2).replace('.', ',')}x`).join(' · ');
  const firstAwaken = [1, 2, 3, 4, 5, 6].find(isAwakeningLevel) ?? 3;
  return {
    title: 'X — DIVINE PALADIN',
    lines: [
      `Beş Divine statı (normal statlarından ayrı): ${stats}. Adaptasyon iyileşmeyi ve durum etkilerinden toparlanmayı hızlandırır (en çok ${ADAPTATION_CAP}x).`,
      'Divine Level ile büyürler: her level ×1,20, her 3. levelde ek ×1,32.',
      'Divine EXP güçlü rakiplere meydan okuyarak kazanılır; normal levelden çok daha zor ilerler.',
      `Her ${firstAwaken} Divine Level'da bir Uyanış ve Divine skill seçimi. Divine skill'ler MP değil Işık kullanır.`,
      'Bu trait başkalarının Appraisal\'ında ve lonca taşında görünmez.',
      `Uyarı: başlangıçta zayıfsın — Güç ${divineStat('power', 0).toFixed(2).replace('.', ',')}x, Hız ${divineStat('speed', 0).toFixed(2).replace('.', ',')}x; beden ağır ve yavaş.`,
    ],
  };
}

/**
 * B20: Divine Paladin'in uyanış sahnesi zamanı mı? Uyanmış (woke), henüz oynamamış (dp_awaken yok), "Hana Git"
 * başlamış, sahne/diyalog yok ve oyuncu ilk kez yürümeye çalışıyor.
 */
export function awakenDue(flags: Record<string, unknown>, innQuestStarted: boolean, idle: boolean, moveLen: number): boolean {
  return !flags.dp_awaken && !!flags.woke && innQuestStarted && idle && moveLen > 0.3;
}
