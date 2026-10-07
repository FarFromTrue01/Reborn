// Hikâye kapıları (0.6.0, 0.10.0'da saf modüle taşındı): bir ana görev amacı belli bir saatten önce yapılamıyorsa
// bekleme metni ve saati (mutlak dakika). Chapter2.objectiveWait ve zincir saat denetimi (tests/g6.test.ts) kullanır.
import { absMinute } from '../core/sleep';
import { whenLabel } from '../core/time';

export interface GateCtx {
  day: number;
  minute: number;
  flag: (k: string) => unknown;
}

/** İlk Kadeh (0.11.0, C6): saat kapısı kalktı; han her saatte açık. (Eski akşam penceresi 18:00–02:00 idi.) */
export function celebrateOpen(_hour: number): boolean {
  return true;
}

export function storyGate(id: string, idx: number, c: GateCtx): { text: string; until: number } | null {
  const now = absMinute(c.day, c.minute);
  const at = (day: number, hour: number) => absMinute(day, hour * 60);
  const gate = (until: number, text: (when: string) => string) => (now < until ? { until, text: text(whenLabel(now, until)) } : null);
  const h = c.minute / 60;
  switch (id) {
    case 'm_vl_rest': {
      const healed = Number(c.flag('vl_healed_day') || c.day);
      return gate(at(healed + 1, 8), (w) => `Vera ve Lina şifa evinde dinleniyor — ${w} onları bul`);
    }
    case 'm_vl_cellar': {
      const d = Number(c.flag('cellar_offer_day') || c.day);
      return gate(at(d, 8), (w) => `Vera ve Lina ${w} ortalıkta olur — o saate kadar bekle`);
    }
    case 'm_next_day':
      // 0.11.0 (C6): "ertesi gün, gündüz" kapısı kalktı — İlk Kadeh bitip handan çıkıldığı anda kâhyanın sahnesi
      return null;
    case 'm_bertram': {
      // A3.1: günde bir vardiya, 06:00–15:00 arası başlar
      if (!c.flag('bertram_deal') || c.flag('bertram_done') || c.flag('bertram_pay_pending')) return null;
      const worked = c.flag('worked_today') === c.day;
      if (!worked && h >= 6 && h < 15) return null;
      const until = !worked && h < 6 ? at(c.day, 6) : at(c.day + 1, 6);
      return gate(until, (w) => `Bertram ${w} iş verir`);
    }
    case 'm_harvest': {
      // A7.3: Haldor tarlada 06:00–16:00; ücret gecesi açılan görev ilk amaçta da bekler
      if (h >= 6 && h < 16) return null;
      const until = at(h >= 16 ? c.day + 1 : c.day, 6);
      return gate(until, (w) => (idx === 0 ? `Haldor ${w} tarlada olur` : `Hasat ${w} başlar`));
    }
    case 'm_celebrate':
      // 0.11.0 (C6): 18:00 beklemesi kalktı — f_wolves bitince hana herhangi bir saatte girilince sahne başlar
      return null;
  }
  return null;
}
