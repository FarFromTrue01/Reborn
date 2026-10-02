const W = (p) => p.evaluate(() => { const w = window.__game.scene.getScene('World'); return { cut: w.cutscene, x: w.player?.actor.x, y: w.player?.actor.y, vis: w.player?.actor.visible, layers: w.player?.actor.layers.length, alpha: w.player?.actor.alpha, depth: w.player?.actor.depth, cam: [w.cameras.main.scrollX, w.cameras.main.scrollY] }; });
export default async ({ page, wait, shot, evalG }) => {
  await evalG(() => { window.__G.newGame(); window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 0, y: 0, facing: 'down' }); });
  await wait(6000); await shot('10_wake_a');
  for (let i = 0; i < 60; i++) {
    const st = await W(page);
    if (!st.cut) break;
    await evalG(() => { const ui = window.__game.scene.getScene('UI'); ui && ui.advanceDialogue(); });
    await wait(600);
  }
  console.log(JSON.stringify(await W(page)));
  await wait(1500);
  await shot('11_wake_after');
  const tp = async (x, y) => { await evalG(([x, y]) => { const w = window.__game.scene.getScene('World'); w.player.actor.setPosition(x*32, y*32); w.cameras.main.centerOn(x*32, y*32); }, [x, y]); };
  await evalG(() => { window.__G.state.time.minute = 10*60; window.__G.setFlag('village_entered'); });
  await tp(95, 62); await wait(2500); await shot('12_village_plaza');
  await tp(88.5, 52); await wait(2000); await shot('13_inn_front');
  await tp(58, 58.5); await wait(2000); await shot('14_bridge');
  await tp(18, 18); await wait(2500); await shot('15_camp');
  await evalG(() => { window.__G.state.time.minute = 22*60; });
  await tp(95, 60); await wait(2500); await shot('16_village_night');
  await tp(105, 72); await wait(2000); await shot('17_shops');
};
