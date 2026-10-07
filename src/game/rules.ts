// Oyun kuralları: EXP, level, Divine, skill, eşya — bildirimleriyle birlikte.
import { GUILD_LOCK_TEXT, GUILD_LOCK_TITLE, spendLock } from '../core/spendLock';
import { G } from './G';
import { hungerState, decaySatiety, eatSatiety, SATIETY_MAX } from '../core/hunger';
import { addExp, round2, STAT_POINTS_PER_LEVEL, SP_PER_LEVEL, type StatKey } from '../core/formulas';
import { addDivineExp, victoryDivineExp, isMeaningfulVictory, trainingExp, streakMultiplier, TRAINING_SESSIONS_PER_DAY, divineExpToNext } from '../core/divine';
import { fmtMult, fmtHp } from '../ui/format';
import { addSkillExp, canLearnThisWeek, weekOfDay, newSkill, ownedTechniques, sanitizeSlots } from '../core/skills';
import { SKILLS, TECHNIQUES, RARITY_NAMES } from '../data/skills';
import { subRankToString } from '../core/ranks';
import { transact, type ItemQty } from '../core/transactions';
import { ITEMS } from '../data/items';
import { canonicalCoins } from '../core/money';
import { eat as eatRule, type EatState } from '../core/eating';
import { TITLES } from '../data/titles';
import { equipmentPrestige } from '../core/prestige';
import { questNeededItems } from '../core/quests';
import { questDef } from '../data/quests';

export type ToastKind = 'item' | 'exp' | 'divine' | 'money' | 'info' | 'warn' | 'skill';

export function toast(text: string, kind: ToastKind = 'info', icon?: string) {
  G.events.emit('toast', { text, kind, icon });
}

/**
 * C12 (0.11.0): Sistem Teklifi öğreticisi açık mı? İlk kez Level 1 olup SP alınca bir kerelik, isteğe bağlı amaç;
 * teklif kullanılınca (tut_offer) biter.
 */
export function offerTutorialActive(): boolean {
  return G.p.level >= 1 && G.p.sp > 0 && !G.flag('tut_offer');
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
/** Karakter EXP'si verir (title/skill çarpanı dahil); gerçekten eklenen miktarı döndürür. */
export function gainExp(amount: number): number {
  if (amount <= 0) return 0;
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
    p.hp = round2(p.hp + G.d.maxHp - before);
    p.mp = round2(p.mp + G.d.maxMp - beforeMp);
    // B2 (0.11.0): "etiket: değer" satırları (kutuda simgeli ve hizalı)
    const lines = [
      `Level: ${p.level - r.levelsGained} → ${p.level}`,
      `Stat puanı: +${STAT_POINTS_PER_LEVEL * r.levelsGained}`,
      `SP: +${SP_PER_LEVEL * r.levelsGained}`,
      `Max HP: ${fmtHp(before)} → ${fmtHp(G.d.maxHp)}`,
    ];
    if (G.d.maxMp !== beforeMp) lines.push(`Max MP: ${beforeMp} → ${G.d.maxMp}`);
    lines.push('Stat puanlarını Status ekranından dağıtabilirsin.');
    sysmsg('LEVEL ATLADIN', lines, { sound: 'levelup', big: true });
    G.events.emit('levelup', p.level);
  }
  G.events.emit('stats');
  return amt;
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
  p.hp = round2(p.hp + Math.max(0, G.d.maxHp - beforeHp));
  p.mp = round2(p.mp + Math.max(0, G.d.maxMp - beforeMp));
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
  // B9: INT skill EXP kazancını artırır (+%1,5/puan, en çok +%50)
  const amt = raw * G.d.divLearning * G.d.skillExpMult;
  const r = addSkillExp(G.p.skills[idx], amt);
  G.p.skills[idx] = r.state;
  if (r.rankUps.length) {
    const def = SKILLS[id];
    const lines = [`${def.name}: ${subRankToString(r.rankUps[0] - 1)} → ${subRankToString(r.state.rank)}`];
    for (const t of r.unlocked) {
      if (t.technique) lines.push(`Yeni yetenek: ${TECHNIQUES[t.technique]?.name ?? t.technique} (Status → Skills'ten takılır)`);
      else lines.push(t.note);
    }
    sysmsg('SKILL GELİŞTİ', lines, { sound: 'skillup' });
    fillEmptySlot();
    G.invalidate();
  }
  G.events.emit('skills');
}

export function canLearnSkill(): { ok: boolean; reason?: string } {
  if (!canLearnThisWeek(G.state.lastSkillLearnWeek, G.state.time.day))
    return { ok: false, reason: 'Bu hafta zaten yeni bir skill öğrendin. (Haftada en fazla 1)' };
  return { ok: true };
}

/** B17 (0.10.0): yeni skill'in tek kaynağı — SP harcanan Sistem Teklifi. */
export const SKILL_SOURCE = 'Sistem Teklifi';

/**
 * Yeni skill. 0.10.0 (B17): **yalnızca Sistem Teklifi** (SP) — öğretmenler, kitaplar, gizli keşifler, ganimet ve görev
 * ödülleri skill vermez; başka bir kaynak reddedilir. Haftada 1 yeni skill sınırı aynı: teklifin hakkı teklif
 * açılınca kullanılır (useWeeklyLearn), seçim ayrıca hakkı düşürmez (weekly: false). Divine skill'leri ayrı sistem.
 */
export function learnSkill(id: string, via: string, opts: { weekly?: boolean } = {}): boolean {
  if (via !== SKILL_SOURCE) {
    console.warn('Skill yalnızca Sistem Teklifi ile öğrenilir:', id, via);
    return false;
  }
  const weekly = opts.weekly ?? true;
  if (hasSkill(id)) {
    toast('Bu skill\'e zaten sahipsin.', 'warn');
    return false;
  }
  if (weekly) {
    const c = canLearnSkill();
    if (!c.ok) {
      sysmsg('ÖĞRENİLEMEDİ', [c.reason!]);
      return false;
    }
    useWeeklyLearn();
  }
  G.p.skills.push(newSkill(id));
  const def = SKILLS[id];
  sysmsg('YENİ SKILL', [`${def.name} (G-) [${RARITY_NAMES[def.rarity]}]`, def.desc, `Kaynak: ${via}`], { sound: 'skillup', big: true });
  fillEmptySlot();
  G.invalidate();
  G.events.emit('skills');
  G.scheduleSave();
  return true;
}

/** Bu haftanın yeni skill hakkını kullan (teklif açmak da kullanır; kartlar boş gelse ya da seçilmese bile). */
export function useWeeklyLearn() {
  G.state.lastSkillLearnWeek = weekOfDay(G.state.time.day);
}

/** Açık slot boşsa ilk aktif yeteneği tak (yeni yetenek açılınca elle takmaya gerek kalmasın). */
export function fillEmptySlot() {
  const owned = ownedTechniques(G.p.skills);
  const slots = sanitizeSlots(G.state.skillSlots, owned);
  if (!slots[0] && owned.length) slots[0] = owned[0];
  G.state.skillSlots = slots;
}

/** Yetenek tak/çıkar (yalnızca savaş dışında; çağıran denetler). */
export function setSkillSlot(i: number, tech: string | null) {
  const owned = ownedTechniques(G.p.skills);
  const slots = [...sanitizeSlots(G.state.skillSlots, owned)];
  if (tech) for (let k = 0; k < slots.length; k++) if (slots[k] === tech) slots[k] = null;
  slots[i] = tech;
  G.state.skillSlots = sanitizeSlots(slots, owned);
  G.events.emit('skills');
  G.scheduleSave();
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
 * Harcama kilidi (core/spendLock): E3 hikâye kilidi (G3'ün ödülünden şifacıya varana kadar) ve 0.11.0 (C1) lonca
 * kaydına kadar kilit. Kilitliyse nedeni döner; lonca kilidinde "ÖNCE LONCA" bildirimi çıkar.
 * allow: kilide rağmen izin verilen ödeme (şifacının tedavisi, cezalar).
 */
export function spendBlocked(allow = false, label = ''): string | null {
  const why = spendLock({ member: !!G.state.guild.member, exempt: !!G.flag('spend_free'), storyLock: !!G.flag('spend_lock') }, label, allow);
  if (why === 'story') return 'Bu paraya şimdi dokunamam.';
  if (why === 'guild') return GUILD_LOCK_TEXT;
  return null;
}

/** Kilitli harcama girişimi: hikâye kilidinde iç ses, lonca kilidinde sistem bildirimi. */
function reportBlocked(reason: string) {
  if (reason === GUILD_LOCK_TEXT) sysmsg(GUILD_LOCK_TITLE, [GUILD_LOCK_TEXT], { sound: 'alert' });
  else G.events.emit('think', reason);
}

export function buy(id: string, qty: number, unitPrice: number, label: string) {
  const blocked = spendBlocked(false, label);
  if (blocked) {
    reportBlocked(blocked);
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
  const blocked = spendBlocked(allowWhenLocked || label === 'Lonca cezası', label);
  if (blocked) {
    reportBlocked(blocked);
    return { ok: false, reason: blocked };
  }
  return transact(G.p as any, { label, pay: amount });
}

// ------------------------------------------------------------ açlık (B13)
/** Tokluğu ayarla; Aç/Çok aç eşiği geçilirse türetilmiş değerler yenilenir (en yüksek dayanıklılık). */
export function setSatiety(v: number) {
  const before = hungerState(G.state.satiety ?? 100);
  G.state.satiety = Math.max(0, Math.min(SATIETY_MAX, Math.round(v * 100) / 100));
  const after = hungerState(G.state.satiety);
  if (before !== after) {
    G.invalidate();
    if (after === 'hungry' && before === 'normal') toast('Acıktın. Dayanıklılığın yavaş doluyor.', 'warn', 'inv_food');
    if (after === 'starving') toast('Çok açsın! Yaraların iyileşmiyor.', 'warn', 'inv_food');
  }
  G.events.emit('stats');
}

/** Zaman geçti: Tokluk azalır (uyurken yarısı). */
export function passHunger(minutes: number, asleep = false) {
  if (minutes <= 0) return;
  setSatiety(decaySatiety(G.state.satiety ?? 100, minutes, asleep));
}

/** Yemek (hikâye: Bertram'ın güveci). Tavanı aşmaz; "Tokum" kuralı burada yok (hikâye yemeği). */
export function feed(gain: number) {
  setSatiety((G.state.satiety ?? 0) + gain);
}

// ------------------------------------------------------------ tüketme
/**
 * Bir eşyayı tüketir (yiyecek, iksir). Yiyecekler bekleme kurallarına tabidir (core/eating).
 * addBuff: süreli etkiler (sargı) için oyuncuya buff ekler.
 */
export const QUEST_ITEM_REASON = 'Görev için lazım.';

/** Aktif görevlerin toplama amacındaki (teslim edilmemiş) eşyalar: yenemez. */
export function questNeeded(): Set<string> {
  return questNeededItems(G.state.quests, questDef);
}

export function consumeItem(id: string, eat: { state: EatState; now: number } | null, addBuff: (b: { id: string; t: number; amount: number }) => void): { ok: boolean; reason?: string; eatState?: EatState } {
  const it = ITEMS[id];
  if (!it || !G.p.inventory[id]) return { ok: false, reason: 'Elinde yok.' };
  if (questNeeded().has(id)) return { ok: false, reason: QUEST_ITEM_REASON };
  let next: EatState | undefined;
  // B13: tokken yemek yenmez (eşya harcanmaz)
  if (it.kind === 'food' && it.satiety && eatSatiety(G.state.satiety ?? 0, it.satiety).refused) return { ok: false, reason: 'Tokum.' };
  if (it.kind === 'food' && eat) {
    const r = eatRule(eat.state, eat.now);
    if (!r.ok) return { ok: false, reason: `Henüz yiyemezsin. (${Math.ceil(r.cooldown)} sn)` };
    next = r.state;
  }
  const t = transact(G.p as any, { label: 'Kullan: ' + it.name, take: [{ id, qty: 1 }] });
  if (!t.ok) return { ok: false, reason: t.reason };
  const p = G.p;
  if (it.satiety) setSatiety(eatSatiety(G.state.satiety ?? 0, it.satiety).value);
  for (const e of it.effects ?? []) {
    if (e.type === 'heal') {
      const amt = Math.round(e.amount! * G.d.healMult * 10) / 10;
      p.hp = round2(Math.min(G.d.maxHp, p.hp + amt));
      // İlk Yardım S- (Saha Hekimi): iyileşmenin yarısı yakındaki yoldaşlara
      G.events.emit('healed', amt);
    }
    if (e.type === 'mana') p.mp = round2(Math.min(G.d.maxMp, p.mp + e.amount!));
    if (e.type === 'stamina') p.stamina = round2(Math.min(G.d.maxStamina, p.stamina + e.amount!));
    if (e.type === 'regen') {
      // İlk Yardım D-: sargı süresi yarıya iner (toplam iyileşme aynı)
      const dur = Math.max(1, e.duration! * (1 + (G.d.fx.bandageTimePct ?? 0)));
      addBuff({ id: 'regen', t: dur, amount: (e.amount! * G.d.healMult) / dur });
      G.events.emit('healed', e.amount! * G.d.healMult);
      G.count('bandagesUsed');
      gainSkillExp('first_aid', 1.5);
    }
  }
  G.events.emit('stats');
  return { ok: true, eatState: next };
}
