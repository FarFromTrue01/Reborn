import { helpers } from './helpers.mjs';
export default async ({ page, wait, shot, evalG }) => {
  const h = helpers(page, wait, evalG);
  await evalG(() => { window.__G.newGame(); window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 0, y: 0, facing: 'down' }); });
  await wait(3000);
  console.log('wake', JSON.stringify(await h.run()));
  // köy girişi tetikleyicisi
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.player.actor.setPosition(62*32, 58*32); });
  await wait(1500);
  let shotDone = false;
  console.log('village', JSON.stringify(await h.run([], 200, async (s, i) => { if (i === 8 && !shotDone) { shotDone = true; await shot('30_village_reaction'); } })));
  // hana gir
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.warpTo('inn', 7, 12, 'up'); });
  await wait(2500);
  let n = 0;
  const r = await h.run([1, 1], 500, async (s, i) => {
    if (s.dlg && (n === 2 || n === 12 || n === 30)) await shot('31_inn_' + n);
    if (s.dlg) n++;
  });
  console.log('inn', JSON.stringify(r));
  await shot('32_after_deal');
  const inv = await evalG(() => ({ eq: window.__G.p.equipment, inv: window.__G.p.inventory, flags: window.__G.state.flags }));
  console.log(JSON.stringify(inv));
  // Bertram'la konuş → çalış
  for (let day = 0; day < 2; day++) {
    await evalG(() => { window.__G.state.time.minute = 8 * 60; const w = window.__game.scene.getScene('World'); const b = w.npc('bertram'); w.player.actor.setPosition(b.x, b.y + 64); w.player.actor.face('up'); w.director.talk(b); });
    await wait(800);
    const rr = await h.run([0], 400, async (s, i) => { if (i === 30 && day === 0) await shot('33_work'); });
    console.log('work', day, JSON.stringify(rr));
    // uyu
    await evalG(() => { const w = window.__game.scene.getScene('World'); w.loadMap('inn_attic', 6, 4, 'up'); });
    await wait(1200);
    await evalG(() => { const w = window.__game.scene.getScene('World'); w.director.interactProp('bed_attic', {}); });
    await wait(600);
    console.log('sleep', JSON.stringify(await h.run([0])));
    await evalG(() => { const w = window.__game.scene.getScene('World'); w.loadMap('inn', 7, 8, 'up'); });
    await wait(1200);
  }
  console.log('wallet', JSON.stringify(await evalG(() => window.__G.p.wallet)));
  // lonca
  await evalG(() => { window.__G.state.time.minute = 10 * 60; const w = window.__game.scene.getScene('World'); w.loadMap('guild', 6, 7, 'up'); });
  await wait(2000);
  await h.run();
  await shot('34_guild');
  await evalG(() => { const w = window.__game.scene.getScene('World'); const c = w.npc('celeste'); w.player.actor.setPosition(c.x, c.y + 64); w.director.talk(c); });
  await wait(800);
  let k = 0;
  const rg = await h.run([0], 600, async (s) => { if (s.dlg) { k++; if (k === 9 || k === 16) await shot('35_reg_' + k); } });
  console.log('guild', JSON.stringify(rg));
  await shot('36_after');
  console.log(JSON.stringify(await evalG(() => ({ rank: window.__G.p.guildRank, inv: window.__G.p.inventory, wallet: window.__G.p.wallet, flags: window.__G.state.flags }))));
};
