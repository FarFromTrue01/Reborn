// Grup 1 (5c): grafik kalitesi çözünürlüğü belirliyor mu? DPR=3 ile çalıştır.
export default async ({ page, wait, shot, evalG }) => {
  const fps = (ms = 4000) => evalG((ms) => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(Math.round((n * 1000) / (performance.now() - t0) * 10) / 10); };
    requestAnimationFrame(f);
  }), ms);
  await evalG(() => {
    const G = window.__G;
    G.newGame();
    for (const f of ['woke', 'inn_met', 'village_entered', 'bertram_deal', 'checkpoint_seen', 'camp_seen', 'steward_met']) G.setFlag(f);
    G.state.time = { day: 3, minute: 12 * 60 };
    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 95, y: 60, facing: 'down' });
  });
  await wait(4000);
  await evalG(() => { const w = window.__game.scene.getScene('World'); const p = w.mapData.points.plaza; w.player.actor.setPosition(p.x * 32 + 16, p.y * 32 + 22); });
  for (const q of ['high', 'medium', 'low']) {
    await evalG((q) => { const G = window.__G; G.settings.quality = q; G.saveSettings(); window.__Display?.applyQuality?.(q); }, q);
    await wait(2500);
    const c = await evalG(() => ({ canvas: `${window.__game.canvas.width}×${window.__game.canvas.height}`, mp: Math.round(window.__game.canvas.width * window.__game.canvas.height / 1e5) / 10, devicePixelRatio, worldZoom: window.__game.scene.getScene('World').cameras.main.zoom }));
    console.log('DPR', q, JSON.stringify({ ...c, fps: await fps() }));
    await shot('g1_dpr_' + q);
  }
};
