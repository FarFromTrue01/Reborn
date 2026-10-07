// Aktif yeteneklerin (teknik) dünyadaki uygulanışı (0.9.0, Grup 5B — S4–S7). WorldScene.useSkillSlot buraya devreder.
// Hasar: fiziksel yetenekler normal vuruşun katı (resolvePhysical, mult), büyüler taban hasar × büyü gücü
// (resolveSpell). İkisi de teknik gücüyle (skill'in her alt kademesinde +%5) çarpılır.
import Phaser from 'phaser';
import { skillStagger } from '../core/stagger';
import { G } from '../game/G';
import * as R from '../game/rules';
import { Sound } from '../audio/audio';
import { TECHNIQUES } from '../data/skills';
import { techniqueSource, techniqueCost, techniqueCooldown, techniquePower, mergedPassive } from '../core/skills';
import { spellPowerMult } from '../core/formulas';
import { cleanseStatuses, BURN_PER_SEC } from '../core/status';
import { dirFromVec } from './actor';
import { TILE } from './types';
import type { SkillState } from '../core/types';
import type { WorldScene } from '../scenes/WorldScene';
import type { Enemy } from './enemy';

export const ELEMENT_COLOR: Record<string, number> = { fire: 0xff8a30, lightning: 0xbfe4ff, wind: 0xd8fff0, heal: 0x9fffa0, ice: 0x9fdcff };

/** Tekniğin sahibi olan skill'in durumu. */
export function ownerOf(techId: string): SkillState | null {
  const src = techniqueSource(techId);
  return src ? G.p.skills.find((s) => s.id === src.skill) ?? null : null;
}

/** Teknik gücü (sahip skill'in rütbesine göre). */
export function powerOf(techId: string): number {
  return techniquePower(ownerOf(techId)?.rank ?? 0);
}

/**
 * Bir vuruşta tekniğin/elementin bıraktığı durum etkisi: ateş yakar (Ateş Büyüsü: süre ve çarpan), buz yavaşlatır
 * (Buz Büyüsü), yıldırım %x felç (Yıldırım D-). base: vuruşun taban hasarı (yanma bunun %20'si/sn).
 */
export function elementStatus(w: WorldScene, e: Enemy, element: string | undefined, base: number, techId?: string) {
  if (!e.alive) return;
  const fx = G.d.fx;
  if (element === 'fire') {
    const fm = mergedPassive(G.p.skills.find((s) => s.id === 'fire_magic') ?? { id: 'fire_magic', rank: 0, exp: 0 });
    e.addStatus({ kind: 'burn', t: fm.burnDur ?? 3, power: base * BURN_PER_SEC * (fm.burnMult ?? 1) }, G.p.level);
  } else if (element === 'ice' && techId !== 'frost_ring') {
    const pct = Math.min(0.9, (fx.slowPct ?? 0.2) * (fx.slowMult ?? 1));
    e.addStatus({ kind: 'slow', t: 2, power: pct }, G.p.level);
  } else if (element === 'lightning') {
    if (Math.random() < (fx.paralyzeChance ?? 0)) e.addStatus({ kind: 'paralyze', t: 0.6 }, G.p.level);
  }
  void w;
}

/** Yeteneği kullan (slot kontrolü çağıranda). Başarılıysa true. */
export function useTechnique(w: WorldScene, id: string): boolean {
  const t = TECHNIQUES[id];
  if (!t) return false;
  const pl = w.player;
  const owner = ownerOf(id);
  const cost = techniqueCost(id, owner);
  if ((pl.skillCd[id] ?? 0) > 0) {
    Sound.sfx('error', 0.4);
    return false;
  }
  if (G.p.mp < cost) {
    w.fx.number(pl.actor.x, pl.actor.y - 50, 'MP yetersiz', 'miss');
    Sound.sfx('error', 0.4);
    return false;
  }
  if (t.weapon && t.weapon !== G.d.weaponType) {
    w.fx.number(pl.actor.x, pl.actor.y - 50, 'Uygun silah yok', 'miss');
    Sound.sfx('error', 0.4);
    return false;
  }
  G.p.mp -= cost;
  pl.skillCd[id] = techniqueCooldown(id, owner);
  // yetenek kullanmak Gölge'yi bozar
  pl.hidden = false;
  pl.stillT = 0;
  // silahla yapılan beceri: silah sırttaysa hemen ele
  if (t.weapon || t.kind === 'melee_multi' || t.kind === 'sweep' || t.kind === 'lunge' || t.kind === 'parry') pl.drawNow();
  const own = owner ? mergedPassive(owner) : {};
  const range = (t.range ?? 2) * (1 + (own.techRangePct ?? 0));
  const dir = w.aimAssist(range);
  pl.actor.face(dirFromVec(dir.x, dir.y, pl.actor.dir));
  const skill = owner?.id;
  const pw = techniquePower(owner?.rank ?? 0);
  const color = ELEMENT_COLOR[t.element ?? ''] ?? 0xffffff;
  const fx = G.d.fx;
  switch (t.kind) {
    case 'projectile': {
      pl.setState('cast');
      pl.actor.play(t.physical ? 'slash' : 'cast', { loop: false, restart: true, speed: 1.6 });
      const waves = id === 'wind_cut' ? Math.max(1, Math.round(own.windWaves ?? 1)) : t.hits ?? 1;
      for (let k = 0; k < waves; k++) {
        const dd = id === 'wind_cut' ? dir.clone() : dir.clone().rotate((k - (waves - 1) / 2) * 0.12);
        w.time.delayedCall(k * (id === 'wind_cut' ? 140 : 60), () =>
          w.spawnSpellProjectile(dd, id, t.power * pw, id === 'glacier_spear' ? 12 : 8, color, !!t.ignites, t.element ?? 'physical', range, !!t.physical, { pierce: !!t.pierce, skill }));
      }
      Sound.sfx(t.element === 'fire' ? 'fire' : 'swing', 0.6);
      break;
    }
    case 'melee_multi': {
      const n = t.hits ?? 1;
      for (let k = 0; k < n; k++) {
        w.time.delayedCall(k * 140, () => {
          pl.actor.play(G.d.weaponType === 'spear' ? 'thrust' : 'slash', { loop: false, restart: true, speed: 2.2 });
          Sound.sfx('swing');
          const reach = pl.weaponReach() * TILE;
          w.fx.slashArc(pl.actor.x + dir.x * 16, pl.actor.y - 14 + dir.y * 16, dir.angle() + (k % 2 ? 0.6 : -0.6), 0xbfe4ff);
          for (const e of w.enemies) {
            if (!e.alive) continue;
            const v = new Phaser.Math.Vector2(e.x - pl.actor.x, e.y - pl.actor.y);
            if (v.length() - e.actor.bodyR < reach && Math.abs(Phaser.Math.Angle.Wrap(v.angle() - dir.angle())) < 1.0) w.hitEnemy(e, { dir, physical: true, mult: t.power * pw, skill, stagger: skillStagger(t.id) / n });
          }
        });
      }
      pl.setState('attack');
      pl.attackHitDone = true;
      pl.attackDur = n * 0.14 + 0.25;
      break;
    }
    case 'sweep': {
      // Süpürme: önündeki yarım dairede herkes (geri itmez)
      pl.actor.play('thrust', { loop: false, restart: true, speed: 1.8 });
      Sound.sfx('heavy', 0.7);
      const reach = pl.weaponReach() * TILE * 1.1;
      w.fx.swingTrail(pl.actor.x, pl.actor.y - 16, dir.angle(), 0xbfe4ff, reach, Math.PI, 180);
      for (const e of w.enemies) {
        if (!e.alive) continue;
        const v = new Phaser.Math.Vector2(e.x - pl.actor.x, e.y - pl.actor.y);
        if (v.length() - e.actor.bodyR < reach && Math.abs(Phaser.Math.Angle.Wrap(v.angle() - dir.angle())) <= Math.PI / 2) w.hitEnemy(e, { dir: v.normalize(), physical: true, mult: t.power * pw, skill, stagger: skillStagger(t.id) });
      }
      pl.setState('attack');
      pl.attackHitDone = true;
      pl.attackDur = 0.4;
      break;
    }
    case 'lunge': {
      // Delici Hamle: 2,5 kare ileri hamle, yolundaki herkese bir kez
      pl.actor.play('thrust', { loop: false, restart: true, speed: 2 });
      Sound.sfx('heavy', 0.7);
      pl.techDash(dir, { power: t.power * pw, skill });
      break;
    }
    case 'parry': {
      // Karşı Saldırı: 1,2 sn savunma duruşu (gelen darbe engellenir, otomatik karşılık)
      pl.parryT = t.duration ?? 1.2;
      pl.parryPower = t.power * pw;
      pl.setState('cast');
      pl.actor.play('idle');
      w.fx.ring(pl.actor.x, pl.actor.y - 16, 0x9fd6ff, 34, (t.duration ?? 1.2) * 1000);
      Sound.sfx('draw', 0.8);
      break;
    }
    case 'aoe': {
      pl.setState('cast');
      pl.actor.play(t.physical ? 'slash' : 'cast', { loop: false, restart: true, speed: 1.6 });
      const area = t.physical ? 1 : G.d.areaMult;
      let r = (t.radius ?? 2) * TILE * area;
      if (id === 'frost_ring') r *= fx.freezeRadiusMult ?? 1;
      const cx = t.self ? pl.actor.x : pl.actor.x + dir.x * Math.min(3, range) * TILE;
      const cy = t.self ? pl.actor.y : pl.actor.y + dir.y * Math.min(3, range) * TILE;
      w.areaBlast(cx, cy, r, t, t.power * pw, skill);
      break;
    }
    case 'heal': {
      const amt = Math.round(t.power * pw * spellPowerMult(G.d.stats.INT) * G.d.healMult * 10) / 10;
      w.healJoseph(amt, !!fx.healParty);
      if (skill && G.p.hp < G.d.maxHp) R.gainSkillExp(skill, 0.8);
      pl.setState('cast');
      pl.actor.play('cast', { loop: false, restart: true, speed: 1.6 });
      break;
    }
    case 'buff': {
      // Yenilenme: saniyede güç × teknik gücü HP; Demir Deri: hasar yarıya
      pl.buffs = pl.buffs.filter((b) => b.id !== (id === 'regeneration' ? 'regen' : id));
      pl.buffs.push({ id: id === 'regeneration' ? 'regen' : id, t: t.duration ?? 5, amount: id === 'regeneration' ? t.power * pw : t.power });
      if (id === 'regeneration' && fx.healParty) for (const c of w.companions) if (!c.down) c.hp = Math.min(c.maxHp, c.hp + t.power * pw * (t.duration ?? 8) * 0.5);
      w.fx.glow(pl.actor.x, pl.actor.y - 20, color, 50);
      Sound.sfx(id === 'iron_skin' ? 'draw' : 'heal');
      break;
    }
    case 'shield': {
      // Buz Zırhı: 3 + max HP'nin %20'si (teknik gücüyle)
      pl.startShield(Math.round((t.power + G.d.maxHp * 0.2) * pw * 10) / 10, t.duration ?? 6);
      pl.shieldFx?.setTint(0x9fdcff);
      w.fx.ring(pl.actor.x, pl.actor.y - 20, 0x9fdcff, 40);
      Sound.sfx('heal', 0.7);
      break;
    }
    case 'cleanse': {
      // Arındırma: savaş etkileri anında silinir; lanetler yalnızca Lanet Kıran (S-) ile
      const before = pl.statuses.length;
      pl.statuses = cleanseStatuses(pl.statuses, !!fx.curseBreak);
      w.fx.glow(pl.actor.x, pl.actor.y - 20, 0xe8fff0, 60, 600);
      w.fx.number(pl.actor.x, pl.actor.y - 50, before > pl.statuses.length ? 'Arındı' : 'Arınık', 'heal');
      Sound.sfx('heal');
      break;
    }
    case 'shout': {
      w.warShout(t, own);
      break;
    }
    case 'taunt': {
      // Meydan Okuma: 5 sn düşmanlar sana yönelir
      const r = (t.radius ?? 6) * TILE;
      w.fx.ring(pl.actor.x, pl.actor.y - 14, 0xff7050, r, 500);
      Sound.sfx('alert', 0.8);
      for (const e of w.enemies) if (e.alive && Math.hypot(e.x - pl.actor.x, e.y - pl.actor.y) < r) {
        e.addStatus({ kind: 'taunt', t: t.duration ?? 5 }, G.p.level);
        if (!e.aware) e.becomeAware(false);
      }
      pl.setState('cast');
      pl.actor.play('cast', { loop: false, restart: true, speed: 1.6 });
      break;
    }
    case 'dash': {
      // Yıldırım Adımı: kısa mesafe ışınlanma (dash türü)
      w.fx.glow(pl.actor.x, pl.actor.y - 20, 0xbfe4ff, 40);
      Sound.sfx('holy', 0.5);
      pl.techDash(dir, null);
      pl.invulnT = 0.3;
      break;
    }
  }
  G.events.emit('stats');
  return true;
}
