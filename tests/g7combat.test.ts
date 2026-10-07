// Grup 7 (0.11.0) — A: hamle ve karşı hamle. Saf kurallar: kırmızı alan = hasar alanı, sendeleme, saldırı sırası,
// ritim, şarj, karşı saldırı, kovalama hızı, yumruk sayıları, Işık barı.
import { describe, it, expect } from 'vitest';
import { inTelegraph, telegraphShape, TELEGRAPH_HALF_ANGLE } from '../src/core/telegraph';
import {
  STAGGER_CAP, STAGGER_FILL, SKILL_STAGGER, addStagger, newStagger, staggerCap, tickStagger, stunDamageMult,
  STUN_SEC, STUN_SEC_BOSS, AFTER_STUN_SEC,
} from '../src/core/stagger';
import { acquire, canStrike, isTurn, newQueue, noteStrike, queueLimit, release, want, STRIKE_GAP } from '../src/core/attackQueue';
import {
  CHAIN_GRACE, CHARGE_TIME, FINISHER_RECOVERY, RHYTHM_STEPS, beginSwing, breakRhythm, cancelCharge, chargeStep, counterWindow,
  endSwing, newCharge, newRhythm, pressAttack, recovering, COUNTER_DMG_SKILLED, HEAVY_STAMINA, HEAVY_DMG_MULT, CHARGE_MOVE_MULT,
} from '../src/core/rhythm';
import { CHASE_SPEED_MULT, chaseSpeed, naturalWalk } from '../src/core/movement';
import { MONSTERS } from '../src/data/monsters';
import { derive } from '../src/core/creature';
import { newJoseph } from '../src/core/state';
import { createMonster } from '../src/core/monster';
import { applyDamage, mitigatedDamage, physicalDamage, roundDamage } from '../src/core/formulas';
import { damageStat, skillDamageMult, type Derived } from '../src/core/creature';
import { LIGHT_ON_HIT, LIGHT_ON_PERFECT_DODGE, LIGHT_ON_STUN } from '../src/core/divine';
import { companionTargetScore } from '../src/data/companions';
import { SKILLS, TECHNIQUES } from '../src/data/skills';

const T = 32;

describe('A2 kırmızı alan = hasar alanı', () => {
  const rat = { x: 100, y: 100, attackRange: 0.9, heavy: false, attack: 'melee' as const, tile: T };
  it('Koni: yarıçap (menzil + 0,4 kare) ve ±0,9 rad; içteki nokta vurulur, dışındaki vurulmaz', () => {
    const s = telegraphShape({ ...rat, tx: 140, ty: 100 });
    expect(s.kind).toBe('cone');
    const r = (0.9 + 0.4) * T;
    if (s.kind !== 'cone') return;
    expect(s.r).toBeCloseTo(r);
    expect(s.half).toBe(TELEGRAPH_HALF_ANGLE);
    expect(inTelegraph(s, { x: 100 + r - 1, y: 100 })).toBe(true);
    expect(inTelegraph(s, { x: 100 + r + 1, y: 100 })).toBe(false);
    // yana çıkan (açının dışında) vurulmaz
    expect(inTelegraph(s, { x: 100 + Math.cos(1.0) * 20, y: 100 + Math.sin(1.0) * 20 })).toBe(false);
    expect(inTelegraph(s, { x: 100 + Math.cos(0.85) * 20, y: 100 + Math.sin(0.85) * 20 })).toBe(true);
    // arkaya geçen vurulmaz (eski kod: 14 px içinde her yönden vuruyordu)
    expect(inTelegraph(s, { x: 90, y: 100 })).toBe(false);
  });
  it('Hazırlık sırasında hedef yer değiştirse de yön değişmez (şekil hazırlık başında kurulur)', () => {
    const s = telegraphShape({ ...rat, tx: 140, ty: 100 });
    // Joseph fare hazırlanırken arkasına geçti: şekil aynı, arkadaki nokta dışarıda
    const behind = { x: 70, y: 100 };
    expect(inTelegraph(s, behind)).toBe(false);
    expect(inTelegraph(s, { x: 125, y: 100 })).toBe(true);
  });
  it('Ağır saldırı daire (×1,7); büyü çizgisi hazırlık başında kilitli yön', () => {
    const h = telegraphShape({ ...rat, heavy: true, tx: 0, ty: 0 });
    expect(h.kind).toBe('circle');
    if (h.kind === 'circle') expect(h.r).toBeCloseTo(1.3 * T * 1.7);
    expect(inTelegraph(h, { x: 60, y: 100 })).toBe(true);
    const b = telegraphShape({ ...rat, attack: 'bolt', tx: 100, ty: 200 });
    expect(b.kind).toBe('line');
    if (b.kind === 'line') expect(b.angle).toBeCloseTo(Math.PI / 2);
  });
});

describe('A3 sendeleme barı', () => {
  it('Kapasite tablosu', () => {
    expect(STAGGER_CAP).toMatchObject({ rat: 2, barn_rat: 2, rabbit: 2, field_rat: 3, giant_rat: 4, slime: 4, goblin_shaman: 4, wolf: 5, goblin: 5, goblin_chief: 12 });
    for (const id of Object.keys(MONSTERS)) expect(staggerCap(id), id).toBeGreaterThan(0);
  });
  it('Dolum: normal 1, 3. vuruş 2, ağır 3, karşı saldırı 3; yetenekler 1–3', () => {
    expect(STAGGER_FILL).toEqual({ normal: 1, finisher: 2, heavy: 3, counter: 3 });
    for (const [id, v] of Object.entries(SKILL_STAGGER)) {
      expect(v, id).toBeGreaterThanOrEqual(1);
      expect(v, id).toBeLessThanOrEqual(3);
    }
    for (const id of Object.keys(SKILL_STAGGER)) if (id !== 'holy') expect(TECHNIQUES[id], id).toBeTruthy();
  });
  it('Fare iki normal vuruşta sersemler: 1,2 sn, %50 fazla hasar, bar sıfırlanır', () => {
    const s = newStagger();
    expect(addStagger(s, 1, 2, false)).toBe(false);
    expect(addStagger(s, 1, 2, false)).toBe(true);
    expect(s.stunT).toBe(STUN_SEC);
    expect(s.fill).toBe(0);
    expect(stunDamageMult(s)).toBe(1.5);
    // sersemken bar dolmaz
    expect(addStagger(s, 3, 2, false)).toBe(false);
    expect(s.fill).toBe(0);
  });
  it('Boss 0,8 sn sersemler', () => {
    const s = newStagger();
    expect(addStagger(s, 12, 12, true)).toBe(true);
    expect(s.stunT).toBe(STUN_SEC_BOSS);
  });
  it('2 sn vurulmazsa saniyede 1 boşalır', () => {
    const s = newStagger();
    addStagger(s, 3, 5, false);
    for (let i = 0; i < 200; i++) tickStagger(s, 0.01); // 2 sn
    expect(s.fill).toBeCloseTo(3, 5);
    for (let i = 0; i < 100; i++) tickStagger(s, 0.01); // +1 sn
    expect(s.fill).toBeCloseTo(2, 1);
    for (let i = 0; i < 300; i++) tickStagger(s, 0.01);
    expect(s.fill).toBe(0);
  });
  it('Sersemleme bitince 3 sn dolum yarıya iner (kilitleme yok)', () => {
    const s = newStagger();
    addStagger(s, 2, 2, false);
    let ended = false;
    for (let i = 0; i < 130 && !ended; i++) ended = tickStagger(s, 0.01);
    expect(ended).toBe(true);
    expect(s.afterT).toBe(AFTER_STUN_SEC);
    expect(addStagger(s, 1, 2, false)).toBe(false);
    expect(s.fill).toBe(0.5);
    expect(addStagger(s, 1, 2, false)).toBe(false);
    expect(addStagger(s, 1, 2, false)).toBe(false);
    expect(addStagger(s, 1, 2, false)).toBe(true);
  });
  it('Sürekli normal vuruşla bile düşman en fazla belli bir oranda sersem kalır (kilitleme yok)', () => {
    const s = newStagger();
    let stunnedT = 0;
    const dt = 0.01;
    let next = 0;
    for (let t = 0; t < 30; t += dt) {
      tickStagger(s, dt);
      if (s.stunT > 0) stunnedT += dt;
      if (t >= next) {
        next += 0.36; // ritmin en hızlı temposu
        addStagger(s, 1, 2, false);
      }
    }
    expect(stunnedT / 30).toBeLessThan(0.6);
  });
});

describe('A4 saldırı sırası', () => {
  it('Bölgeye göre N: başlangıç 1, derin orman ve kamp 2', () => {
    for (const z of ['village', 'forest_outer', 'south_farms', 'haldor_farm', 'training', null]) expect(queueLimit(z)).toBe(1);
    for (const z of ['forest_mid', 'forest_deep', 'north_woods', 'goblin_camp']) expect(queueLimit(z)).toBe(2);
  });
  it('Üç fareden yalnızca biri saldırır; bitince sıranın sonuna geçer', () => {
    const q = newQueue();
    want(q, 1, 1, 0);
    want(q, 2, 1.5, 0.1);
    want(q, 3, 2, 0.2);
    const now = 1;
    for (const id of [1, 2, 3]) want(q, id, 1, now);
    expect([1, 2, 3].filter((id) => isTurn(q, id, 1, now))).toEqual([1]);
    expect(acquire(q, 2, 1, now)).toBe(false);
    expect(acquire(q, 1, 1, now)).toBe(true);
    expect(isTurn(q, 2, 1, now)).toBe(false);
    expect(isTurn(q, 3, 1, now)).toBe(false);
    release(q, 1, 2);
    for (const id of [1, 2, 3]) want(q, id, 1, 2);
    // en uzun bekleyen (2) önce; 1 sıranın sonunda
    expect(isTurn(q, 2, 1, 2)).toBe(true);
    expect(isTurn(q, 1, 1, 2)).toBe(false);
  });
  it('N = 2: iki düşman; yakın olan önce', () => {
    const q = newQueue();
    want(q, 1, 5, 0);
    want(q, 2, 1, 0);
    want(q, 3, 1.2, 0);
    expect(isTurn(q, 2, 2, 0)).toBe(true);
    expect(isTurn(q, 3, 2, 0)).toBe(true);
    expect(isTurn(q, 1, 2, 0)).toBe(false);
  });
  it('Ölen/kaçan hak bırakır ve sıradan çıkar; uzun süre istemeyen düşer', () => {
    const q = newQueue();
    want(q, 1, 1, 0);
    acquire(q, 1, 1, 0);
    want(q, 2, 1, 0);
    release(q, 1, 0.5, false);
    expect(q.waiting.has(1)).toBe(false);
    want(q, 2, 1, 0.5);
    expect(isTurn(q, 2, 1, 0.5)).toBe(true);
    // 2 istemeyi bıraktı (öldü): 1 sn sonra 3'ün sırası
    want(q, 3, 3, 1.5);
    expect(isTurn(q, 3, 1, 1.5)).toBe(true);
  });
  it('Aynı hedefe iki farklı düşmanın vuruşu arasında en az 0,5 sn', () => {
    const q = newQueue();
    noteStrike(q, 1, 10);
    expect(canStrike(q, 2, 10.2)).toBe(false);
    expect(canStrike(q, 1, 10.2)).toBe(true);
    expect(canStrike(q, 2, 10 + STRIKE_GAP)).toBe(true);
  });
  it('Boss kendi hakkı dışında en fazla 1 yardımcıya izin verir (bölge N = 2 olsa da)', () => {
    const q = newQueue();
    expect(acquire(q, 99, 2, 0, true)).toBe(true);
    want(q, 1, 1, 0);
    want(q, 2, 1, 0);
    expect(acquire(q, 1, 2, 0)).toBe(true);
    expect(acquire(q, 2, 2, 0)).toBe(false);
  });
  it('Hedef başına ayrı sıra: Joseph ve yoldaşın sırası birbirini etkilemez', () => {
    const jo = newQueue(), vera = newQueue();
    want(jo, 1, 1, 0);
    acquire(jo, 1, 1, 0);
    want(vera, 2, 1, 0);
    expect(acquire(vera, 2, 1, 0)).toBe(true);
  });
});

describe('A5 3 vuruşluk ritim', () => {
  it('1. ve 2. vuruş ×0,85, 3. vuruş ×1,35 süre, ×1,4 hasar, sendeleme 2', () => {
    expect(RHYTHM_STEPS.map((s) => s.dur)).toEqual([0.85, 0.85, 1.35]);
    expect(RHYTHM_STEPS[2]).toEqual({ dur: 1.35, dmg: 1.4, stagger: 2 });
  });
  it('%55\'ten önceki basışlar yok sayılır; sonrakiler tamponlanır ve zincir sürer', () => {
    const r = newRhythm();
    expect(pressAttack(r, 0)).toBe('start');
    expect(beginSwing(r, 0, 0.4)).toBe(0);
    expect(pressAttack(r, 0.1)).toBe('ignored');
    expect(pressAttack(r, 0.23)).toBe('buffered');
    expect(endSwing(r, 0.4)).toBe('chain');
    expect(beginSwing(r, 0.4, 0.4)).toBe(1);
  });
  it('Tuşa sürekli basmak zinciri hızlandırmaz', () => {
    // her 0,02 sn basılan tuş ile 3 vuruş, pencerede tek basışla aynı sürede biter
    const run = (spam: boolean) => {
      const r = newRhythm();
      let t = 0, swings = 0, swingEnd = -1;
      const dur = (step: number) => 0.4 * RHYTHM_STEPS[step].dur;
      const dt = 0.01;
      while (swings < 3 && t < 5) {
        if (r.swing && t >= swingEnd) {
          const c = endSwing(r, t);
          if (c === 'chain') {
            const step = r.next;
            beginSwing(r, t, dur(step));
            swingEnd = t + dur(step);
            swings++;
          }
        }
        const press = spam ? true : r.swing ? (t - r.swing.start) / r.swing.dur >= 0.6 && !r.buffered : true;
        if (press && pressAttack(r, t) === 'start') {
          const step = r.next;
          beginSwing(r, t, dur(step));
          swingEnd = t + dur(step);
          swings++;
        }
        t += dt;
      }
      return t;
    };
    expect(run(true)).toBeGreaterThanOrEqual(run(false) - 0.011);
  });
  it('Pencerede basılmazsa zincir 1. vuruşa döner; 0,35 sn içinde basılırsa sürer', () => {
    const r = newRhythm();
    pressAttack(r, 0);
    beginSwing(r, 0, 0.4);
    endSwing(r, 0.4);
    expect(pressAttack(r, 0.4 + CHAIN_GRACE - 0.01)).toBe('start');
    expect(r.next).toBe(1);
    const r2 = newRhythm();
    pressAttack(r2, 0);
    beginSwing(r2, 0, 0.4);
    endSwing(r2, 0.4);
    expect(pressAttack(r2, 0.4 + CHAIN_GRACE + 0.05)).toBe('start');
    expect(r2.next).toBe(0);
  });
  it('3. vuruştan sonra 0,3 sn toparlanma (yalnızca kaçış), tampon silinir', () => {
    const r = newRhythm();
    r.next = 2;
    beginSwing(r, 0, 0.5);
    pressAttack(r, 0.4);
    expect(endSwing(r, 0.5)).toBe('idle');
    expect(recovering(r, 0.5 + FINISHER_RECOVERY - 0.01)).toBe(true);
    expect(pressAttack(r, 0.6)).toBe('ignored');
    expect(pressAttack(r, 0.5 + FINISHER_RECOVERY + 0.01)).toBe('start');
    expect(r.next).toBe(0);
  });
  it('Kaçış/vurulma ritmi bozar', () => {
    const r = newRhythm();
    r.next = 2;
    breakRhythm(r);
    expect(r.next).toBe(0);
  });
});

describe('A6 ağır saldırı: basılı tut ve bırak', () => {
  it('0,5 sn\'de dolar; dolduktan sonra bırakınca çıkar', () => {
    const c = newCharge();
    chargeStep(c, true, 0);
    for (let i = 0; i < 50; i++) chargeStep(c, true, 0.01);
    expect(c.t).toBeGreaterThanOrEqual(CHARGE_TIME - 1e-9);
    expect(chargeStep(c, false, 0.01)).toBe('fire');
  });
  it('Dolmadan bırakılırsa hiçbir şey olmaz; vurulmak/kaçmak iptal eder', () => {
    const c = newCharge();
    chargeStep(c, true, 0);
    chargeStep(c, true, 0.3);
    expect(chargeStep(c, false, 0.01)).toBe('fizzle');
    chargeStep(c, true, 0);
    chargeStep(c, true, 0.6);
    cancelCharge(c);
    expect(chargeStep(c, false, 0.01)).toBe('none');
  });
  it('Bedel 18, hasar ×1,8, hareket ×0,4', () => {
    expect(HEAVY_STAMINA).toBe(18);
    expect(HEAVY_DMG_MULT).toBe(1.8);
    expect(CHARGE_MOVE_MULT).toBe(0.4);
  });
});

describe('A7 kusursuz kaçış → karşı saldırı', () => {
  it('Pencere 0,6 sn; Kaçınma A- ile 1,0 sn ve ×1,3', () => {
    expect(counterWindow(false)).toBe(0.6);
    expect(counterWindow(true)).toBe(1.0);
    expect(COUNTER_DMG_SKILLED).toBe(1.3);
  });
  it('Kaçınma A- açıklaması yeni kural', () => {
    const t = SKILLS.evasion.tiers.find((x) => x.at === 'A-')!;
    expect(t.passive).toEqual({ counterSkilled: true });
    expect(t.note).toContain('0,6 → 1,0');
  });
});

describe('A8 hız dengesi', () => {
  it('Kovalama hızı def.speed × 0,75', () => {
    expect(CHASE_SPEED_MULT).toBe(0.75);
    expect(chaseSpeed(3.2)).toBeCloseTo(2.4);
  });
  it('Başlangıç Joseph\'inin yürüme hızı ≥ fare, sümüksü ve ahır faresinin kovalama hızı; kurt yürüyen Joseph\'ten hızlı, koşandan yavaş', () => {
    const walk = naturalWalk(derive(newJoseph(), { level: 0 }).moveSpeed);
    expect(walk).toBeCloseTo(2.6, 2);
    for (const id of ['rat', 'slime', 'barn_rat']) expect(walk, id).toBeGreaterThanOrEqual(chaseSpeed(MONSTERS[id].speed));
    expect(chaseSpeed(MONSTERS.wolf.speed)).toBeGreaterThan(walk);
    expect(chaseSpeed(MONSTERS.wolf.speed)).toBeLessThan(walk * 1.6);
  });
});

describe('A9 yumruk ve ilk yaratıklar', () => {
  const hit = (att: Derived, def: Derived, base: number) =>
    roundDamage(mitigatedDamage(physicalDamage({ weaponBase: base, str: damageStat(att), skillMult: skillDamageMult(att, att.weaponType), traitMult: att.divPower }), def.def, 0, def.divEndurance));
  const count = (hp: number, dmg: number) => {
    let n = 0;
    while (hp > 0) {
      hp = applyDamage(hp, dmg);
      n++;
    }
    return n;
  };
  const jo = (w?: string) => {
    const j = newJoseph();
    if (w) j.equipment.weapon = w;
    return derive(j, { level: 0 });
  };
  it('Kritiksiz: yumrukla fare 3, sümüksü 6; sopayla fare 2, sümüksü 3', () => {
    const rat = derive(createMonster('rat', Math.random, 0));
    const slime = derive(createMonster('slime', Math.random, 0));
    const fist = jo();
    expect(count(rat.maxHp, hit(fist, rat, fist.weaponDmg[0]))).toBe(3);
    expect(count(slime.maxHp, hit(fist, slime, fist.weaponDmg[0]))).toBe(6);
    const stick = jo('cracked_stick');
    expect(count(rat.maxHp, hit(stick, rat, stick.weaponDmg[0]))).toBe(2);
    expect(count(slime.maxHp, hit(stick, slime, stick.weaponDmg[0]))).toBe(3);
  });
  it('Sersemletmenin ×1,5\'i ile vuruş sayısı en fazla bir azalır', () => {
    const slime = derive(createMonster('slime', Math.random, 0));
    const fist = jo();
    const d = hit(fist, slime, fist.weaponDmg[0]);
    const s = newStagger();
    let hp = slime.maxHp, n = 0;
    while (hp > 0) {
      hp = applyDamage(hp, roundDamage(d * stunDamageMult(s)));
      addStagger(s, 1, staggerCap('slime'), false);
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(5);
    expect(n).toBeLessThanOrEqual(6);
  });
});

describe('A10 Divine Işık barı', () => {
  it('Vuruş 3, kusursuz kaçış 14, sersemletme +10', () => {
    expect(LIGHT_ON_HIT).toBe(3);
    expect(LIGHT_ON_PERFECT_DODGE).toBe(14);
    expect(LIGHT_ON_STUN).toBe(10);
  });
});

describe('A11 yoldaşlar sersemlemiş düşmana öncelik verir', () => {
  it('Sersem düşman, biraz daha uzakta olsa da seçilir', () => {
    expect(companionTargetScore(4, false, false, true)).toBeLessThan(companionTargetScore(1, false, false, false));
  });
});
