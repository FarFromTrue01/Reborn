// 0.2.0 hikâye akışı: uyanış → köy → han (Appraisal öğreticisi) → Bertram'la anlaşma → 4 vardiya
// → Bertram'ın konuşması → Haldor'un hasadı → 1 gümüş → lonca kaydı.
import { helpers } from './helpers.mjs';
export default async ({ page, wait, shot, evalG }) => {
  const h = helpers(page, wait, evalG);
  await evalG(() => { window.__G.newGame(); window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 0, y: 0, facing: 'down' }); });
  await wait(3000);
  console.log('wake', JSON.stringify(await h.run()));
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.player.actor.setPosition(62 * 32, 58 * 32); });
  await wait(1500);
  console.log('village', JSON.stringify(await h.run([], 200)));
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.warpTo('inn', 7, 12, 'up'); });
  await wait(2500);
  let n = 0;
  const r = await h.run([1, 1], 500, async (s) => {
    if (s.dlg && (n === 26 || n === 30)) await shot('s2_inn_' + n);
    if (s.dlg) n++;
  });
  console.log('inn', JSON.stringify(r));
  await wait(1500);
  await shot('s2_deal_sysmsg');
  const st = await evalG(() => ({ eq: window.__G.p.equipment, flags: window.__G.state.flags, wallet: window.__G.p.wallet }));
  console.log('after deal', JSON.stringify(st));
  // Dört vardiya
  for (let day = 0; day < 4; day++) {
    await evalG(() => { window.__G.state.time.minute = 8 * 60; const w = window.__game.scene.getScene('World'); if (w.mapData.id !== 'inn') w.loadMap('inn', 7, 8, 'up'); });
    await wait(1200);
    await evalG(() => { const w = window.__game.scene.getScene('World'); const b = w.npc('bertram'); w.player.actor.setPosition(b.x, b.y + 64); w.player.actor.face('up'); w.director.talk(b); });
    await wait(800);
    let k = 0;
    const rr = await h.run([0, 0, 0, 0, 0], 700, async (s, i) => {
      if (i === 25) await shot(`s2_work_day${day + 1}`);
      if (day === 3 && s.dlg) { k++; if (k === 8 || k === 22) await shot('s2_speech_' + k); }
    });
    console.log('work', day + 1, JSON.stringify({ wallet: rr.money, shifts: await evalG(() => window.__G.state.counters.workDays), done: await evalG(() => window.__G.state.flags.bertram_done) }));
    if (day === 3) { await wait(1200); await shot('s2_quest_haldor'); }
    // ikinci kez çalışma isteği aynı gün → reddedilmeli
    if (day === 0) {
      await evalG(() => { const w = window.__game.scene.getScene('World'); const b = w.npc('bertram'); w.director.talk(b); });
      await wait(500);
      await h.run([0], 100);
      console.log('same-day shifts', await evalG(() => window.__G.state.counters.workDays));
      // ilk gün bedava yemek
      console.log('free meal', await evalG(() => window.__G.state.flags.free_meal_day === window.__G.state.time.day));
    }
    await evalG(() => { const w = window.__game.scene.getScene('World'); w.loadMap('inn_attic', 6, 4, 'up'); });
    await wait(1200);
    await evalG(() => { const w = window.__game.scene.getScene('World'); w.director.interactProp('bed_attic', {}); });
    await wait(600);
    await h.run([0]);
  }
  // Bertram'a tekrar iş sor
  await evalG(() => { window.__G.state.time.minute = 9 * 60; const w = window.__game.scene.getScene('World'); w.loadMap('inn', 7, 8, 'up'); });
  await wait(1200);
  await evalG(() => { const w = window.__game.scene.getScene('World'); const b = w.npc('bertram'); w.player.actor.setPosition(b.x, b.y + 64); w.director.talk(b); });
  await wait(600);
  let said = [];
  await h.run([0], 100, async (s) => { const t = await evalG(() => window.__game.scene.getScene('UI').dlgState?.full); if (t && !said.includes(t)) said.push(t); });
  console.log('bertram after:', JSON.stringify(said));
  // Haldor
  await evalG(() => { window.__G.state.time.minute = 8 * 60 + 30; const w = window.__game.scene.getScene('World'); w.loadMap('world', 134, 48, 'up'); });
  await wait(2500);
  await shot('s2_haldor_field');
  await evalG(() => { const w = window.__game.scene.getScene('World'); const n = w.npc('haldor'); w.player.actor.setPosition(n.x, n.y + 50); w.director.talk(n); });
  await wait(800);
  let hm = 0;
  const rh = await h.run([0, 0], 900, async (s, i) => { const mg = await evalG(() => window.__game.scene.isActive('Minigame')); if (mg && hm++ === 20) await shot('s2_harvest'); });
  console.log('harvest', JSON.stringify(rh), JSON.stringify(await evalG(() => ({ flags: window.__G.state.flags, wallet: window.__G.p.wallet }))));
  await shot('s2_after_harvest');
  // lonca
  await evalG(() => { window.__G.state.time.minute = 13 * 60; const w = window.__game.scene.getScene('World'); w.loadMap('guild', 6, 7, 'up'); });
  await wait(2000);
  await h.run();
  await evalG(() => { const w = window.__game.scene.getScene('World'); const c = w.npc('celeste'); w.player.actor.setPosition(c.x, c.y + 64); w.director.talk(c); });
  await wait(800);
  const rg = await h.run([0], 600);
  console.log('guild', JSON.stringify(rg));
  console.log(JSON.stringify(await evalG(() => ({ rank: window.__G.p.guildRank, inv: window.__G.p.inventory, wallet: window.__G.p.wallet, flags: window.__G.state.flags }))));
};
