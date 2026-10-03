// 0.2.0 dünya turu: ağaç saydamlığı, yeni mahalleler, kast sahneleri, dokunarak Appraisal, sabit joystick.
import { helpers } from './helpers.mjs';
export default async ({ page, wait, shot, evalG }) => {
  const h = helpers(page, wait, evalG);
  await evalG(() => {
    const G = window.__G;
    G.newGame();
    for (const f of ['woke', 'inn_met', 'village_entered', 'bertram_deal', 'checkpoint_seen', 'camp_seen']) G.setFlag(f);
    G.p.equipment = { chest: 'linen_shirt', pants: 'linen_pants', boots: 'cloth_shoes' };
    G.state.time = { day: 2, minute: 10 * 60 + 30 }; // 2. gün = Ateş Günü: kâhya köyde
    G.settings.joystick = 'fixed';
    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 40, y: 60, facing: 'down' });
  });
  await wait(3500);
  // 1) Ağaç arkası: oyuncuyu büyük bir ağacın tepesinin arkasına koy
  const tree = await evalG(() => {
    const w = window.__game.scene.getScene('World');
    const a = w.player.actor;
    let best = null;
    for (const p of w.r.propImages) {
      if (!/^tree_big|tree_dense|tree_oak/.test(p.p.key)) continue;
      const d = Math.hypot(p.p.x - a.x, p.p.y - a.y);
      const tx = Math.floor(p.p.x / 32), ty = Math.floor(p.p.y / 32) - 1;
      if (w.mapData.solid[ty * w.mapData.w + tx]) continue;
      if (!best || d < best.d) best = { d, x: p.p.x, y: p.p.y - 26, key: p.p.key };
    }
    a.setPosition(best.x, best.y);
    // bir fareyi de başka bir ağacın arkasına
    const rat = w.enemies.find((e) => e.def.id === 'rat');
    return { best, rat: !!rat };
  });
  console.log('tree', JSON.stringify(tree));
  await wait(1500);
  await shot('w_01_behind_tree');
  const alpha = await evalG(() => { const w = window.__game.scene.getScene('World'); return w.r.propImages.filter((p) => p.img.alpha < 0.9 && p.img.alpha > 0.3).map((p) => p.p.key + ':' + p.img.alpha.toFixed(2)).slice(0, 5); });
  console.log('faded', JSON.stringify(alpha));
  // Spawn kontrolü: hiçbir düşman bir ağaç tepesinin arkasında doğmamış olmalı
  const spawnBad = await evalG(() => { const w = window.__game.scene.getScene('World'); return w.enemies.filter((e) => w.r.occluders.covers(e.x, e.y, 0)).length; });
  console.log('enemies covered at spawn:', spawnBad, 'of', await evalG(() => window.__game.scene.getScene('World').enemies.length));
  // 2) Meydan: kâhya alayı ve eğilen köylüler
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.loadMap('world', 93, 66, 'up'); });
  await wait(3000);
  await shot('w_02_plaza_steward');
  console.log('steward', await evalG(() => !!window.__game.scene.getScene('World').npc('steward')));
  const r = await h.run([0, 0], 120, async (s, i) => { if (i === 6) await shot('w_03_steward_scene'); });
  console.log('steward scene', JSON.stringify(r), await evalG(() => window.__G.state.flags.steward_met));
  await wait(1500);
  await shot('w_04_bowing');
  const bows = await evalG(() => window.__game.scene.getScene('World').npcs.filter((n) => n.actor.anim === 'bow').map((n) => n.def.id));
  console.log('bowing', JSON.stringify(bows));
  // 3) Doğu Mahallesi ve Güney Çiftlikleri
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.player.actor.setPosition(172 * 32, 74 * 32); });
  await wait(2500);
  await shot('w_05_east_plaza');
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.player.actor.setPosition(131 * 32, 119 * 32); });
  await wait(2500);
  await shot('w_06_old_oak');
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.player.actor.setPosition(188 * 32, 128 * 32); });
  await wait(2000);
  await shot('w_07_pasture');
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.player.actor.setPosition(208 * 32, 58 * 32); });
  await wait(2000);
  await shot('w_08_checkpoint');
  // 4) Dokunarak Appraisal (gerçek dokunma)
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.player.actor.setPosition(172 * 32, 76 * 32); });
  await wait(2000);
  const tgt = await evalG(() => {
    const w = window.__game.scene.getScene('World');
    const cam = w.cameras.main; const dpr = window.devicePixelRatio || 1;
    const v = cam.worldView;
    const n = w.npcs.find((n) => n.x > v.x + 40 && n.x < v.right - 200 && n.y > v.y + 120 && n.y < v.bottom - 60);
    if (!n) return null;
    return { id: n.def.id, x: (n.x - v.x) * cam.zoom / dpr, y: (n.y - 26 - v.y) * cam.zoom / dpr };
  });
  console.log('tap target', JSON.stringify(tgt));
  if (tgt) {
    await page.touchscreen.tap(tgt.x, tgt.y);
    await wait(900);
    await shot('w_09_tap_appraise');
    const st = await evalG(() => ({ panel: !!window.__game.scene.getScene('UI').appraisalWin, joy: !!window.__game.scene.getScene('UI').joy, appraised: window.__G.state.appraised }));
    console.log('after tap', JSON.stringify(st));
    // panel açıkken tekrar dokun: yeni panel açılmamalı
    const before = await evalG(() => window.__game.scene.getScene('UI').appraisalWin?.id ?? window.__game.scene.getScene('UI').appraisalWin?.name);
    await page.touchscreen.tap(tgt.x, tgt.y);
    await wait(400);
    console.log('same panel', await evalG((b) => { const w = window.__game.scene.getScene('UI').appraisalWin; return !!w; }, before));
  }
  // 5) Han akşam: oturma düzeni
  await evalG(() => { window.__G.state.time.minute = 19 * 60 + 30; const w = window.__game.scene.getScene('World'); w.loadMap('inn', 7, 11, 'up'); });
  await wait(3000);
  await shot('w_10_inn_evening');
  console.log('inn seats', JSON.stringify(await evalG(() => window.__game.scene.getScene('World').npcs.map((n) => `${n.def.id}@${Math.floor(n.x / 32)},${Math.floor(n.y / 32)}`))));
  // 6) Terzide sıra kesme (Aurelio 11-13 terzide)
  await evalG(() => { window.__G.state.time = { day: 3, minute: 11 * 60 + 20 }; const w = window.__game.scene.getScene('World'); w.loadMap('tailor', 5, 6, 'up'); });
  await wait(2500);
  await evalG(() => { const w = window.__game.scene.getScene('World'); const t = w.npc('tailor'); w.player.actor.setPosition(t.x, t.y + 64); w.director.talk(t); });
  let qi = 0;
  const rq = await h.run([2], 200, async (s) => { if (s.dlg && ++qi === 3) await shot('w_11_queue'); });
  console.log('queue', JSON.stringify(rq), await evalG(() => window.__G.state.flags.queue_seen));
  // 7) Dükkân dışında hizmet yok: Gunnar handa
  await evalG(() => { window.__G.state.time.minute = 19 * 60; const w = window.__game.scene.getScene('World'); w.loadMap('inn', 7, 11, 'up'); });
  await wait(2500);
  const said = [];
  await evalG(() => { const w = window.__game.scene.getScene('World'); const n = w.npc('smith'); if (n) { w.player.actor.setPosition(n.x, n.y + 50); w.director.talk(n); } });
  await h.run([0], 60, async () => { const t = await evalG(() => window.__game.scene.getScene('UI').dlgState?.full); if (t && !said.includes(t)) said.push(t); });
  console.log('smith in inn:', JSON.stringify(said));
  // 8) Sabit joystick görünümü
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.loadMap('world', 95, 60, 'down'); });
  await wait(2500);
  await shot('w_12_fixed_joystick');
};
