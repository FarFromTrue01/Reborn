// Oyun kuralları: EXP, level, Divine, skill, eşya — bildirimleriyle birlikte.
import { G } from './G';
import { addExp, STAT_POINTS_PER_LEVEL, SP_PER_LEVEL, type StatKey } from '../core/formulas';
import { addDivineExp, victoryDivineExp, isMeaningfulVictory, trainingExp, streakMultiplier, TRAINING_SESSIONS_PER_DAY, divineExpToNext } from '../core/divine';
import { fmtMult, fmtHp } from '../ui/format';
import { addSkillExp, canLearnThisWeek, weekOfDay, newSkill } from '../core/skills';
import { SKILLS, TECHNIQUES, HIDDEN_DISCOVERIES, RARITY_NAMES } from '../data/skills';
import { subRankToString } from '../core/ranks';
import { transact, type ItemQty } from '../core/transactions';
import { ITEMS } from '../data/items';
import { canonicalCoins } from '../core/money';
import { eat as eatRule, type EatState } from '../core/eating';
import { TITLES } from '../data/titles';
import { equipmentPrestige } from '../core/prestige';

export type ToastKind = 'item' | 'exp' | 'divine' | 'money' | 'info' | 'warn' | 'skill';

export function toast(text: string, kind: ToastKind = 'info', icon?: string) {
  G.events.emit('toast', { text, kind, icon });
}

/** Mavi sistem paneli. */
export function sysmsg(title: string, lines: string[] = [], opts: { sound?: string; big?: boolean } = {}) {
  G.events.emit('sysmsg', { title, lines, ...opts });
}

// ------------------------------------------------------------------ zaman
export function onNewDay() {
  const s = G.state;
  if (s.expDay !== s.time.day) {
    s.expDay = s.time.day;
    s.expToday = 0;
  }
  if (s.divine.trainingDay !== s.time.day) {
    s.divine.trainingDay = s.time.day;
    s.divine.trainingCount = 0;
  }
}

// ------------------------------------------------------------------ karakter EXP
export function gainExp(amount: number) {
  if (amount <= 0) return;
  const p = G.p;
  const amt = Math.round(amount * G.d.expMult);
  onNewDay();
  const r = addExp(p.level, p.exp, amt);
  G.state.expToday += amt;
  toast(`+${amt} EXP`, 'exp');
  const before = G.d.maxHp;
  const beforeMp = G.d.maxMp;
  p.level = r.level;
  p.exp = r.exp;
  if (r.levelsGained > 0) {
    p.unspent += STAT_POINTS_PER_LEVEL * r.levelsGained;
    p.sp += SP_PER_LEVEL * r.levelsGained;
    G.invalidate();
    p.hp += G.d.maxHp - before;
    p.mp += G.d.maxMp - beforeMp;
    sysmsg('LEVEL ATLADIN', [
      `Level ${p.level - r.levelsGained} → Level ${p.level}`,
      `+${STAT_POINTS_PER_LEVEL * r.levelsGained} stat puanı · +${SP_PER_LEVEL * r.levelsGained} SP`,
      `Max HP ${fmtHp(before)} → ${fmtHp(G.d.maxHp)} · Max MP ${beforeMp} → ${G.d.maxMp}`,
      'Stat puanlarını Status ekranından dağıtabilirsin.',
    ], { sound: 'levelup', big: true });
    G.events.emit('levelup', p.level);
  }
  G.events.emit('stats');
}

/** Ölüm cezası: o gün kazanılan EXP kaybedilir (level düşmez). */
export function loseTodayExp(): number {
  onNewDay();
  const lose = Math.min(G.state.expToday, G.p.exp);
  G.p.exp -= lose;
  G.state.expToday = 0;
  G.events.emit('stats');
  return lose;
}

export function allocateStat(k: StatKey): boolean {
  const p = G.p;
  if (p.unspent <= 0) return false;
  p.unspent--;
  p.alloc[k]++;
  const beforeHp = G.d.maxHp;
  const beforeMp = G.d.maxMp;
  G.invalidate();
  // Max artışı mevcut değere de eklenir
  p.hp += Math.max(0, G.d.maxHp - beforeHp);
  p.mp += Math.max(0, G.d.maxMp - beforeMp);
  G.scheduleSave();
  return true;
}

// ------------------------------------------------------------------ Divine
export function gainDivineExp(amount: number, reason: string) {
  if (amount <= 0) return;
  const dv = G.state.divine;
  const r = addDivineExp(dv.level, dv.exp, amount);
  toast(`✦ Divine +${amount} (${reason})`, 'divine');
  const lv0 = dv.level;
  dv.level = r.level;
  dv.exp = r.exp;
  if (r.level > lv0) {
    G.invalidate();
    G.events.emit('divineLevel', r.level);
    if (r.awakenings.length) {
      dv.pendingAwakenings.push(...r.awakenings);
      G.events.emit('awakening');
    }
  }
  G.events.emit('stats');
  G.scheduleSave();
}

/**
 * Düşman yenildiğinde: meydan okuma + seri. Fark (d) normal levelle, azalma divine levelle hesaplanır.
 * Bildirim gerçek seri çarpanını gösterir ("meydan okuma · seri ×1,4"), seri sayısını değil.
 */
export function divineVictory(enemyLevel: number, boss: boolean) {
  const dv = G.state.divine;
  const meaningful = isMeaningfulVictory(enemyLevel, G.p.level);
  const mult = streakMultiplier(dv.streak);
  const e = victoryDivineExp(enemyLevel, G.p.level, dv.level, boss, dv.streak);
  if (meaningful) dv.streak++;
  if (e > 0) gainDivineExp(e, mult > 1 ? `meydan okuma · seri ×${fmtMult(mult)}` : 'meydan okuma');
}

export function resetStreak() {
  G.state.divine.streak = 0;
}

export function trainingAvailable(): boolean {
  onNewDay();
  return G.state.divine.trainingCount < TRAINING_SESSIONS_PER_DAY;
}

/** Antrenman seansı: EXP noktanın kendi aralığından (data/props.ts → TRAINING_SPOTS). */
export function completeTraining(range: [number, number], performance: number) {
  onNewDay();
  const dv = G.state.divine;
  dv.trainingCount++;
  const e = trainingExp(range, performance);
  gainDivineExp(e, 'antrenman');
  return e;
}

export function divineProgressLabel() {
  const dv = G.state.divine;
  return `${dv.exp}/${divineExpToNext(dv.level)}`;
}

// ------------------------------------------------------------------ skill
export function hasSkill(id: string) {
  return G.p.skills.some((s) => s.id === id);
}

export function skillState(id: string) {
  return G.p.skills.find((s) => s.id === id) ?? null;
}

/** Skill EXP ver (Divine Öğrenme çarpanı uygulanır). */
export function gainSkillExp(id: string, raw: number) {
  const idx = G.p.skills.findIndex((s) => s.id === id);
  if (idx < 0 || raw <= 0) return;
  const amt = raw * G.d.divLearning;
  const r = addSkillExp(G.p.skills[idx], amt);
  G.p.skills[idx] = r.state;
  if (r.rankUps.length) {
    const def = SKILLS[id];
    const lines = [`${def.name}: ${subRankToString(r.rankUps[0] - 1)} → ${subRankToString(r.state.rank)}`];
    for (const t of r.unlocked) {
      if (t.technique) lines.push(`Yeni teknik: ${TECHNIQUES[t.technique]?.name ?? t.technique}`);
      else lines.push(t.note);
    }
    sysmsg('SKILL GELİŞTİ', lines, { sound: 'skillup' });
    G.invalidate();
  }
  G.events.emit('skills');
}

export function canLearnSkill(): { ok: boolean; reason?: string } {
  if (!canLearnThisWeek(G.state.lastSkillLearnWeek, G.state.time.day))
    return { ok: false, reason: 'Bu hafta zaten yeni bir skill öğrendin. (Haftada en fazla 1)' };
  return { ok: true };
}

export function learnSkill(id: string, via: string): boolean {
  if (hasSkill(id)) {
    toast('Bu skill\'e zaten sahipsin.', 'warn');
    return false;
  }
  const c = canLearnSkill();
  if (!c.ok) {
    sysmsg('ÖĞRENİLEMEDİ', [c.reason!]);
    return false;
  }
  G.p.skills.push(newSkill(id));
  G.state.lastSkillLearnWeek = weekOfDay(G.state.time.day);
  const def = SKILLS[id];
  sysmsg('YENİ SKILL', [`${def.name} (G-) [${RARITY_NAMES[def.rarity]}]`, def.desc, `Kaynak: ${via}`], { sound: 'skillup', big: true });
  G.invalidate();
  G.events.emit('skills');
  G.scheduleSave();
  return true;
}

/** Gizli keşif sayaçlarını kontrol et. */
export function checkDiscoveries() {
  for (const h of HIDDEN_DISCOVERIES) {
    if ((G.state.counters[h.counter] ?? 0) >= h.need && !hasSkill(h.skill) && !G.state.pendingDiscoveries.includes(h.skill) && !G.state.flags['declined_' + h.skill] && G.state.flags['postponed_' + h.skill] !== weekOfDay(G.state.time.day)) {
      G.state.pendingDiscoveries.push(h.skill);
      G.events.emit('discovery', h.skill, h.hint);
    }
  }
}

// ------------------------------------------------------------------ title
export function grantTitle(id: string) {
  if (G.p.titles.includes(id)) return;
  G.p.titles.push(id);
  const t = TITLES[id];
  const b: string[] = [];
  if (t.bonus.stats) b.push(Object.entries(t.bonus.stats).map(([k, v]) => `${k} +${v}`).join(', '));
  if (t.bonus.hpPct) b.push(`Max HP +%${Math.round(t.bonus.hpPct * 100)}`);
  if (t.bonus.damagePct) b.push(`Hasar +%${Math.round(t.bonus.damagePct * 100)}`);
  if (t.bonus.expPct) b.push(`EXP +%${Math.round(t.bonus.expPct * 100)}`);
  sysmsg('TITLE KAZANILDI', [`${t.name} (${t.rank})`, t.desc, 'Bonus: ' + b.join(' · ')], { sound: 'title', big: true });
  G.invalidate();
  G.scheduleSave();
}

// ------------------------------------------------------------------ eşya ve para
export function giveItems(items: ItemQty[], label: string, silent = false): boolean {
  if (!items.length) return true;
  const r = transact(G.p as any, { label, give: items });
  if (r.ok && !silent) for (const i of items) toast(`+${i.qty} ${ITEMS[i.id].name}`, 'item', ITEMS[i.id].icon);
  return r.ok;
}

export function giveMoney(bronze: number, label: string, silent = false): boolean {
  if (bronze <= 0) return true;
  const r = transact(G.p as any, { label, receive: canonicalCoins(bronze) });
  if (r.ok && !silent) toast(`+{m:${bronze}}`, 'money');
  return r.ok;
}

/**
 * E3: harcama kilidi (G3'ün ödülünden şifacıya varana kadar). Kilitliyse Joseph'in düşüncesi döner.
 * allow: kilide rağmen izin verilen ödeme (şifacının tedavisi).
 */
export function spendBlocked(allow = false): string | null {
  if (!G.flag('spend_lock') || allow) return null;
  return 'Bu paraya şimdi dokunamam.';
}

export function buy(id: string, qty: number, unitPrice: number, label: string) {
  const blocked = spendBlocked();
  if (blocked) {
    G.events.emit('think', blocked);
    return { ok: false, reason: blocked };
  }
  const r = transact(G.p as any, { label, pay: unitPrice * qty, give: [{ id, qty }] });
  return r;
}

export function takeItem(id: string, qty = 1, label = 'Teslim') {
  return transact(G.p as any, { label, take: [{ id, qty }] });
}

/** Joseph'in Saygınlık'ı (C1): giydiklerinin toplamı. */
export function josephPrestige(): number {
  return equipmentPrestige(G.p.equipment);
}

export function sell(id: string, qty: number, unitPrice: number, label: string) {
  const r = transact(G.p as any, { label, take: [{ id, qty }], receive: canonicalCoins(unitPrice * qty) });
  return r;
}

export function pay(amount: number, label: string, allowWhenLocked = false) {
  const blocked = spendBlocked(allowWhenLocked || label === 'Lonca cezası');
  if (blocked) {
    G.events.emit('think', blocked);
    return { ok: false, reason: blocked };
  }
  return transact(G.p as any, { label, pay: amount });
}

// ------------------------------------------------------------ tüketme
/**
 * Bir eşyayı tüketir (yiyecek, iksir). Yiyecekler bekleme kurallarına tabidir (core/eating).
 * addBuff: süreli etkiler (sargı) için oyuncuya buff ekler.
 */
export function consumeItem(id: string, eat: { state: EatState; now: number } | null, addBuff: (b: { id: string; t: number; amount: number }) => void): { ok: boolean; reason?: string; eatState?: EatState } {
  const it = ITEMS[id];
  if (!it || !G.p.inventory[id]) return { ok: false, reason: 'Elinde yok.' };
  let next: EatState | undefined;
  if (it.kind === 'food' && eat) {
    const r = eatRule(eat.state, eat.now);
    if (!r.ok) return { ok: false, reason: `Henüz yiyemezsin. (${Math.ceil(r.cooldown)} sn)` };
    next = r.state;
  }
  const t = transact(G.p as any, { label: 'Kullan: ' + it.name, take: [{ id, qty: 1 }] });
  if (!t.ok) return { ok: false, reason: t.reason };
  const p = G.p;
  for (const e of it.effects ?? []) {
    if (e.type === 'heal') p.hp = Math.min(G.d.maxHp, p.hp + Math.round(e.amount! * G.d.healMult * 10) / 10);
    if (e.type === 'mana') p.mp = Math.min(G.d.maxMp, p.mp + e.amount!);
    if (e.type === 'stamina') p.stamina = Math.min(G.d.maxStamina, p.stamina + e.amount!);
    if (e.type === 'regen') {
      addBuff({ id: 'regen', t: e.duration!, amount: (e.amount! * G.d.healMult) / e.duration! });
      G.count('bandagesUsed');
      gainSkillExp('first_aid', 1.5);
      checkDiscoveries();
    }
  }
  G.events.emit('stats');
  return { ok: true, eatState: next };
}
