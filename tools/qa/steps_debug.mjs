export default async ({ page, wait, shot, evalG }) => {
  await evalG(() => { window.__G.newGame(); window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 0, y: 0, facing: 'down' }); });
  await wait(3000);
  const st = () => evalG(() => { const w = window.__game.scene.getScene('World'); const a = w.player.actor; return { anim: a.anim, col: a.frameCol, t: a.animT.toFixed(2), state: w.player.state, frame: a.layers[0].frame.name, cut: w.cutscene }; });
  for (let i = 0; i < 40; i++) {
    const s = await st(); console.log(i, JSON.stringify(s));
    if (!s.cut && i > 3) break;
    await evalG(() => window.__game.scene.getScene('UI').advanceDialogue());
    await wait(800);
  }
};
