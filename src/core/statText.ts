// Status ekranındaki stat açıklamaları (A4/B9): sayılar formüllerdeki sabitlerden (STAT_RULES) gelir, metin
// formülle hiçbir zaman çelişmez. Saf: tests/g6.test.ts.
import { STAT_RULES, type StatKey } from './formulas';

/** %8 → "%8", 0.015 → "%1,5", 0.004 → "%0,4" */
export function pct(x: number): string {
  const v = Math.round(x * 1000) / 10;
  return '%' + String(v).replace('.', ',');
}

/** Puan başına etkiler (gerçek sabitlerle). */
export function statHintText(k: StatKey): string {
  const R = STAT_RULES;
  switch (k) {
    case 'STR':
      return `Fiziksel hasar +${pct(R.STR.dmgPct)} (tavansız; yay AGI ile)`;
    case 'VIT':
      return `Max HP +${pct(R.VIT.hpPct)} · dayanıklılık +${R.VIT.stamina} · zehir/kanama/yanma süresi −${pct(R.VIT.statusDurPct)} (en çok −${pct(R.VIT.statusDurMax)})`;
    case 'AGI':
      return `Hareket +${pct(R.AGI.movePct)} (≤${pct(R.AGI.moveMax)}) · saldırı hızı +${pct(R.AGI.atkSpdPct)} (≤${pct(R.AGI.atkSpdMax)}) · kritik +${pct(R.AGI.critPct)} (≤${pct(R.AGI.critMax)}) · dayanıklılık +${R.AGI.stamina}, yenilenme +${pct(R.AGI.staminaRegenPct)} · kaçış bedeli −${pct(R.AGI.dodgeCostPct)} (≤−${pct(R.AGI.dodgeCostMax)}) · kusursuz kaçış +${pct(R.AGI.dodgeWindowPct)} (≤+${pct(R.AGI.dodgeWindowMax)}) · yay hasarı +${pct(R.STR.dmgPct)}`;
    case 'INT':
      return `+${R.INT.mp} MP · MP yenilenmesi +${pct(R.INT.mpRegenPct)} · büyü gücü +${pct(R.INT.spellPct)} · büyü alanı +${pct(R.INT.areaPct)} (≤+${pct(R.INT.areaMax)}) · skill EXP +${pct(R.INT.skillExpPct)} (≤+${pct(R.INT.skillExpMax)})`;
    case 'LUK':
      return `Kritik +${pct(R.LUK.critPct)} (≤${pct(R.LUK.critMax)}) · şans eseri ıska +${pct(R.LUK.missPct)} (≤${pct(R.LUK.missMax)}) · ganimet şansı +${pct(R.LUK.dropPct)} · toplamada çift ürün +${pct(R.LUK.doublePct)} (≤${pct(R.LUK.doubleMax)}) · sonucu değiştirdiğinde "Şans!"`;
  }
  return '';
}

/** Statın şu anki toplam etkisi (Status satırının ilk satırı). */
export function statNowText(k: StatKey, v: number): string {
  const R = STAT_RULES;
  const c = (x: number, max: number) => Math.min(max, x);
  switch (k) {
    case 'STR':
      return `hasar ×${(1 + R.STR.dmgPct * v).toFixed(2).replace('.', ',')}`;
    case 'VIT':
      return `HP ×${(1 + R.VIT.hpPct * v).toFixed(2).replace('.', ',')} · dayanıklılık +${R.VIT.stamina * v} · durum süresi −${pct(c(R.VIT.statusDurPct * v, R.VIT.statusDurMax))}`;
    case 'AGI':
      return `hareket +${pct(c(R.AGI.movePct * v, R.AGI.moveMax))} · saldırı hızı +${pct(c(R.AGI.atkSpdPct * v, R.AGI.atkSpdMax))} · kritik +${pct(c(R.AGI.critPct * v, R.AGI.critMax))}`;
    case 'INT':
      return `MP +${R.INT.mp * v} · büyü gücü +${pct(R.INT.spellPct * v)} · skill EXP +${pct(c(R.INT.skillExpPct * v, R.INT.skillExpMax))}`;
    case 'LUK':
      return `kritik +${pct(c(R.LUK.critPct * v, R.LUK.critMax))} · ıska ${pct(c(R.LUK.missPct * v, R.LUK.missMax))} · ganimet ×${(1 + R.LUK.dropPct * v).toFixed(2).replace('.', ',')} · çift ürün ${pct(c(R.LUK.doublePct * v, R.LUK.doubleMax))}`;
  }
  return '';
}
