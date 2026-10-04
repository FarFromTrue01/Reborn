// Grup 4B (0.7.0) görsel QA: her silah için dört yönde yürüme (elde ve sırtta), normal ve ağır saldırının
// darbe karesi, sırta koyma ve çekmenin orta karesi, pelerinliyken sırttaki silah (yukarı yön), konuşurken idle.
// Sahne duraklatılıp kareler elle ayarlanır; Joseph'in çevresi kırpılır. Kırpıntılar tools/qa/g4b_sheets.py ile
// büyütülüp (en yakın komşu) tablolara dizilir.
// Çalıştır: npm run build && npx vite preview --port 4173 & ; URL='http://localhost:4173/?qa=1' DPR=1 OUT=screens/g4b node tools/qa/shot.mjs g4b
// ONLY=walk,attack,sheath,cape,talk ile bölüm seçilebilir.
import { helpers } from './helpers.mjs';

const WEAPONS = [
  ['cracked_stick', 'Çatlak Sopa'], ['wooden_club', 'Budaklı Sopa'], ['rusty_shortsword', 'Paslı Kısa Kılıç'],
  ['iron_shortsword', 'Demir Kısa Kılıç'], ['goblin_cleaver', 'Goblin Satırı'], ['hunting_knife', 'Av Bıçağı'],
  ['iron_spear', 'Demir Mızrak'], ['short_bow', 'Kısa Yay'], [null, 'Yumruk'],
];
const DIRS = ['up', 'left', 'down', 'right'];

export default async ({ page, wait, shot, evalG }) => {
  const h = helpers(page, wait, evalG);
  const OUT = process.env.OUT || 'screens';
  const only = (process.env.ONLY || '').split(',').filter(Boolean);
  const want = (k) => !only.length || only.includes(k);
  const W = (fn, arg) => evalG(fn, arg);

  await W(() => {
    const G = window.__G;
    G.newGame();
    G.setFlag('woke');
    G.p.equipment.chest = 'linen_shirt';
    G.p.equipment.pants = 'linen_pants';
    // ormanda, köyün güvenli bölgesi dışında açık bir çayır
    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 40, y: 64, facing: 'down' });
  });
  await wait(3500);
  await W(() => {
    const w = window.__game.scene.getScene('World');
    for (const e of w.enemies) e.destroy?.();
    w.enemies = [];
    w.director.checkEncounters = () => {};
  });

  /** Joseph'in çevresini kırp (dünya koordinatında ±56 px yatay, 92 px yukarı, 30 px aşağı). */
  const crop = async (name) => {
    await wait(120);
    const r = await W(() => {
      const g = window.__game, w = g.scene.getScene('World'), cam = w.cameras.main, a = w.player.actor;
      const rect = g.canvas.getBoundingClientRect();
      const k = rect.width / g.scale.width;
      const sx = (wx) => rect.left + (wx - cam.worldView.x) * cam.zoom * k;
      const sy = (wy) => rect.top + (wy - cam.worldView.y) * cam.zoom * k;
      const x0 = sx(Math.floor(a.x) - 56), y0 = sy(Math.floor(a.y) - 92), x1 = sx(Math.floor(a.x) + 56), y1 = sy(Math.floor(a.y) + 30);
      return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    });
    await page.screenshot({ path: `${OUT}/${name}.png`, clip: r });
  };
  const equip = (id, cape = false) => W(([id, cape]) => {
    const G = window.__G, w = window.__game.scene.getScene('World');
    G.p.equipment.weapon = id || undefined;
    if (!id) delete G.p.equipment.weapon;
    if (cape) G.p.equipment.cape = 'traveler_cape';
    else delete G.p.equipment.cape;
    G.invalidate();
    w.player.refreshLayers();
  }, [id, cape]);
  /** Sahneyi durdur ve Joseph'i verilen karede göster. mode: 'hand' | 'carry'. */
  const pose = (dir, anim, frame, mode) => W(([dir, anim, frame, mode]) => {
    const w = window.__game.scene.getScene('World'), pl = w.player, a = pl.actor;
    if (!w.scene.isPaused()) w.scene.pause();
    pl.setState('locked');
    pl.setSheathed(mode === 'carry');
    a.dir = dir;
    a.play(anim, { loop: false, restart: true });
    a.setManualFrame(frame);
  }, [dir, anim, frame, mode]);
  /** Duraklatılmış sahnede biten efektler silinmez: her çekimden önce temizle. */
  const clearFx = () => W(() => {
    const w = window.__game.scene.getScene('World');
    for (const o of [...w.children.list]) if (o.depth >= 930000 && o.depth < 960000) o.destroy();
  });
  const resume = () => W(() => {
    const w = window.__game.scene.getScene('World');
    if (w.scene.isPaused()) w.scene.resume();
    w.player.setState('free');
    w.player.actor.play('idle');
  });

  // ================================================================ yürüme (elde / sırtta)
  if (want('walk')) {
    for (const [id] of WEAPONS) {
      if (!id) continue;
      await equip(id);
      for (const mode of ['hand', 'carry']) {
        for (const d of DIRS) {
          await pose(d, 'walk', 2, mode);
          await crop(`walk_${id}_${mode}_${d}`);
        }
      }
      await resume();
    }
    console.log('yürüme tamam');
  }

  // ================================================================ pelerinliyken sırtta (yukarı)
  if (want('cape')) {
    for (const [id] of WEAPONS) {
      if (!id) continue;
      await equip(id, true);
      await pose('up', 'walk', 2, 'carry');
      await crop(`cape_${id}`);
      await resume();
    }
    await equip(null);
    console.log('pelerin tamam');
  }

  // ================================================================ saldırı: darbe karesi
  if (want('attack')) {
    for (const [id] of WEAPONS) {
      await equip(id);
      for (const [heavy, phase] of [[false, 'impact'], [true, 'windup'], [true, 'impact']]) {
        for (const d of DIRS) {
          await clearFx();
          await W(([d, heavy, phase]) => {
            const w = window.__game.scene.getScene('World'), pl = w.player, a = pl.actor;
            if (w.scene.isPaused()) w.scene.resume();
            pl.setState('free');
            pl.setSheathed(false);
            window.__G.p.stamina = 999;
            a.dir = d;
            w.aimAssist = () => { const v = { up: [0, -1], left: [-1, 0], down: [0, 1], right: [1, 0] }[d]; return pl.attackDir.clone().set(v[0], v[1]); };
            w.scene.pause();
            pl.startAttack(heavy);
            // darbe karesine atla (hazırlanma ve swing öncesi kareler geçilir)
            const p = pl.plan, D = pl.attackDur;
            const hold = p.pre + p.hold;
            const t = phase === 'windup' ? D * (p.pre + p.hold * 0.6) : D * (hold + (1 - hold) * ((p.impact - p.holdFrame) / (p.frames - p.holdFrame))) + 0.001;
            pl.stateT = t - 0.0005;
            pl.update(0.0005);
          }, [d, heavy, phase]);
          await crop(`atk_${id || 'fist'}_${heavy ? 'heavy' : 'normal'}${phase === 'windup' ? '_windup' : ''}_${d}`);
        }
      }
      await resume();
    }
    console.log('saldırı tamam');
  }

  // ================================================================ sırta koyma / çekme: orta kare
  if (want('sheath')) {
    for (const [id] of WEAPONS) {
      if (!id) continue;
      await equip(id);
      for (const kind of ['stow', 'draw']) {
        for (const d of DIRS) {
          await clearFx();
          await W(([d, kind]) => {
            const w = window.__game.scene.getScene('World'), pl = w.player, a = pl.actor;
            if (w.scene.isPaused()) w.scene.resume();
            pl.setState('free');
            pl.setSheathed(kind === 'draw');
            a.dir = d;
            a.play('idle');
            w.scene.pause();
            pl.beginSheath(kind);
            pl.sheath.t = pl.sheath.dur * 0.42;
            window.__IN.touchX = 0; window.__IN.touchY = 0; window.__IN.moveX = 0; window.__IN.moveY = 0;
            pl.tickSheath(0.0001, true);
          }, [d, kind]);
          await crop(`${kind}_${id}_${d}`);
        }
      }
      await resume();
    }
    console.log('sırta koyma tamam');
  }

  // ================================================================ davranış: zamanlamalar (gerçek zamanlı)
  if (want('behavior')) {
    await resume();
    await equip('iron_shortsword');
    const P = () => W(() => {
      const w = window.__game.scene.getScene('World'), pl = w.player;
      return { t: w.playClock, st: pl.state, sheathed: pl.sheathed, sheath: pl.sheath?.kind ?? null, hit: pl.attackHitDone, anim: pl.actor.anim, calm: w.weaponCalm(), combat: +pl.combatT.toFixed(2) };
    });
    /** Koşul sağlanana kadar oyun saatiyle bekle; geçen oyun süresi (sn). */
    const until = async (cond, max = 15) => {
      const t0 = (await P()).t;
      for (;;) {
        const s = await P();
        if (cond(s)) return { dt: +(s.t - t0).toFixed(2), s };
        if (s.t - t0 > max) return { dt: null, s };
        await wait(40);
      }
    };
    // 1) açık alanda, savaşsız: 6 sn sonra sırta
    await W(() => { const pl = window.__game.scene.getScene('World').player; pl.setSheathed(false); pl.sinceAttack = 0; pl.combatT = 99; });
    let r = await until((s) => s.sheath === 'stow' || s.sheathed, 12);
    console.log(`  açık alan: elde → sırta koyma başladı ${r.dt} sn (beklenen ≈6)`);
    r = await until((s) => s.sheathed && !s.sheath, 2);
    console.log(`  sırta koyma süresi ≈ ${r.dt} sn (beklenen ≈0,35)`);
    // 2) sırttayken saldırı: hızlı çekme, saldırı hemen arkasından
    await W(() => window.__IN.press('attack'));
    r = await until((s) => s.st === 'attack', 2);
    console.log(`  saldırı tuşu → saldırı başladı: ${r.dt} sn (beklenen ≈0,17)`);
    r = await until((s) => s.hit, 2);
    console.log(`  saldırı başı → darbe: ${r.dt} sn`);
    await until((s) => s.st === 'free', 2);
    // 3) ağır vuruşun hazırlanmasında kaçış iptal eder
    await W(() => { window.__G.p.stamina = 999; window.__IN.press('heavy'); });
    r = await until((s) => s.st === 'heavy', 2);
    await wait(60);
    await W(() => window.__IN.press('dodge'));
    r = await until((s) => s.st === 'dodge' || s.st === 'free', 2);
    const hitBefore = (await P()).hit;
    console.log(`  ağır vuruş hazırlanırken kaçış: durum ${r.s.st}, darbe uygulandı mı: ${hitBefore ? 'evet (HATA)' : 'hayır'}`);
    // 4) düşman fark edince silah çekilir
    await W(() => { const w = window.__game.scene.getScene('World'); w.player.setSheathed(true); });
    await W(() => { const w = window.__game.scene.getScene('World'); const a = w.player.actor; const [e] = w.spawnAt('slime', Math.floor(a.x / 32) + 3, Math.floor(a.y / 32), 1, 0, 'qa'); e.becomeAware(true); });
    r = await until((s) => !s.sheathed && !s.sheath, 3);
    console.log(`  düşman fark etti → silah elde: ${r.dt} sn (çekme ≈0,25)`);
    await W(() => { const w = window.__game.scene.getScene('World'); for (const e of w.enemies) e.destroy?.(); w.enemies = []; w.inBattle = false; });
    // 5) diyalogda hemen sırta
    await W(() => { const w = window.__game.scene.getScene('World'); w.player.setSheathed(false); w.player.sinceAttack = 0; w.ui.say('joseph', 'QA'); });
    await wait(300);
    const dlg = await P();
    console.log(`  diyalog açıkken: sırtta=${dlg.sheathed} (calm=${dlg.calm})`);
    await h.run();
  }

  // ================================================================ konuşurken idle (joystick basılı)
  if (want('talk')) {
    await resume();
    await equip('iron_shortsword');
    await W(() => {
      const w = window.__game.scene.getScene('World');
      w.loadMap('world', 84, 62, 'down');
    });
    await wait(2500);
    await W(() => {
      const w = window.__game.scene.getScene('World'), n = w.npc('guard_hob');
      w.player.actor.setPosition(n.x - 60, n.y);
      const I = window.__IN; I.touchMove = true; I.touchX = 0.35; I.touchY = 0;
    });
    await wait(500);
    const before = await W(() => window.__game.scene.getScene('World').player.actor.anim);
    await W(() => { const w = window.__game.scene.getScene('World'); w.director.talk(w.npc('guard_hob')); });
    await wait(900);
    const during = await W(() => { const w = window.__game.scene.getScene('World'); const a = w.player.actor; return { anim: a.anim, dir: a.dir, vx: a.body2.velocity.x, sheathed: w.player.sheathed }; });
    await shot('g4b_talk_idle');
    await crop('talk_idle');
    await h.run();
    await wait(600);
    const after = await W(() => { const a = window.__game.scene.getScene('World').player.actor; return { anim: a.anim, mx: window.__IN.moveX }; });
    console.log('konuşma: önce', before, '· sırasında', JSON.stringify(during), '· sonra', JSON.stringify(after));
    await W(() => { const I = window.__IN; I.touchMove = false; I.touchX = 0; });
  }
};
