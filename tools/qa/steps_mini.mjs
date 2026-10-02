// Antrenman mini oyunlarının görsel kontrolü.
export default async ({ page, wait, shot, evalG }) => {
  await evalG(() => { window.__G.newGame(); window.__G.setFlag('woke'); window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 70, y: 52, facing: 'down' }); });
  await wait(3000);
  for (const kind of ['chop', 'lift', 'run']) {
    await evalG((kind) => { window.__res = null; window.__game.scene.getScene('World').scene.launch('Minigame', { kind, done: (p) => { window.__res = p; } }); }, kind);
    await wait(2800);
    const mg = () => evalG(() => window.__game.scene.getScene('Minigame'));
    for (let i = 0; i < 14; i++) {
      await evalG((kind) => {
        const m = window.__game.scene.getScene('Minigame');
        if (kind === 'chop') { m.press(true); }
        else if (kind === 'lift') { m.press(i => i)(0); }
      }, kind).catch(() => {});
      if (kind === 'lift') await evalG(() => { const m = window.__game.scene.getScene('Minigame'); m.holding = m.needle < m.target; });
      if (kind === 'run') await evalG(() => { const m = window.__game.scene.getScene('Minigame'); m.step(m.lastSide === 'L' ? 'R' : 'L'); });
      await wait(kind === 'chop' ? 120 : 250);
      if (i === 1) await evalG(() => {});
    }
    await shot('70_mini_' + kind);
    await evalG(() => window.__game.scene.getScene('Minigame').finish());
    await wait(2200);
    console.log(kind, await evalG(() => window.__res));
  }
};
