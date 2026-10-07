import { helpers } from './helpers.mjs';
export default async ({ page, wait, shot, evalG }) => {
  const h = helpers(page, wait, evalG);
  await evalG(() => { const G = window.__G; G.newGame(); G.setFlag('woke'); G.setFlag('inn_met'); G.setFlag('bertram_deal'); G.setFlag('village_entered');
    G.p.equipment = { pants: 'linen_pants', chest: 'linen_shirt', boots: 'cloth_shoes' }; G.p.inventory = { torn_shorts: 1, rat_tail: 4, bread: 2, hp_potion_s: 1, rusty_shortsword: 1 }; G.p.wallet.bronze = 87; G.p.wallet.silver = 2;
    G.p.level = 1; G.p.unspent = 4; G.p.sp = 1; G.invalidate();
    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 96, y: 62, facing: 'up' }); });
  await wait(3000);
  await evalG(() => window.__game.scene.getScene('UI').openMenu());
  await wait(1500); await shot('50_status');
  await evalG(() => { const m = window.__game.scene.getScene('Menu'); m.tab = 'inventory'; m.selItem = 'rusty_shortsword'; m.render(); });
  await wait(800); await shot('51_inventory');
  await evalG(() => { const m = window.__game.scene.getScene('Menu'); m.tab = 'equipment'; m.selSlot = 'weapon'; m.render(); });
  await wait(800); await shot('52_equipment');
  await evalG(() => { const m = window.__game.scene.getScene('Menu'); m.tab = 'map'; m.render(); });
  await wait(1200); await shot('53_map');
  await evalG(() => { const m = window.__game.scene.getScene('Menu'); m.tab = 'settings'; m.render(); });
  await wait(800); await shot('54_settings');
  await evalG(() => { const m = window.__game.scene.getScene('Menu'); m.close(); });
  await wait(800);
  // appraisal
  await evalG(() => { const w = window.__game.scene.getScene('World'); const n = w.npcs[0]; w.appraise(n.def.creature, n.def, n); });
  await wait(1200); await shot('55_appraisal');
  // dükkân
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.loadMap('smithy', 4, 7, 'up'); window.__G.state.time.minute = 10*60; });
  await wait(2000);
  await evalG(async () => { const ui = window.__game.scene.getScene('UI'); const { } = {}; const mod = await import('/src/ui/shop.ts').catch(() => null); });
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.director.talk(w.npc('smith')); });
  await wait(600);
  await h.run([0], 30);
  await wait(1500); await shot('56_shop');
  // mini oyun
  await evalG(() => { const w = window.__game.scene.getScene('World'); window.__game.scene.getScene('Menu'); });
  await evalG(() => { const g = window.__game; const ui = g.scene.getScene('UI'); g.scene.getScenes(true).forEach(s => { if (s.sys.settings.key === 'UI') {} }); });
  await evalG(() => { const g = window.__game; g.scene.getScene('UI').children.list.filter(c => c.depth === 140).forEach(c => c.destroy()); const ui = g.scene.getScene('UI'); ui.menuIsOpen = false; const w = g.scene.getScene('World'); w.paused = false; w.physics.resume(); });
  await evalG(() => { const g = window.__game; g.scene.getScene('World').scene.launch('Minigame', { kind: 'chop', done: () => {} }); });
  await wait(4000); await shot('57_minigame');
  await evalG(() => { const g = window.__game; g.scene.stop('Minigame'); });
  // awakening
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.loadMap('world', 70, 54, 'down'); });
  await wait(1500);
  await evalG(() => { window.__R_gain = true; const G = window.__G; G.state.divine.exp = 0; });
  await evalG(() => { const G = window.__G; G.state.divine.pendingAwakenings.push(3); G.state.divine.level = 3; G.invalidate(); });
  let k = 0;
  for (let i = 0; i < 80; i++) {
    const s = await h.S();
    const cards = await evalG(() => window.__game.scene.getScene('UI').children.list.filter(c => c.depth === 150).length);
    if (cards) { await shot('58_awakening_offer'); break; }
    if (s.dlg) await h.adv();
    await wait(400);
  }
};
