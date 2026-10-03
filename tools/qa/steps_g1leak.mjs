// Grup 1: iç mekânlar arasında gidip gelirken doku/nesne sızıntısı var mı? WebGL bağlam kaybı toparlanıyor mu?
export default async ({ page, wait, shot, evalG }) => {
  const stats = () => evalG(() => {
    const g = window.__game;
    const w = g.scene.getScene('World');
    const r = g.renderer;
    return {
      map: w.mapData?.id,
      glTextures: r.glTextureWrappers?.length,
      glFramebuffers: r.glFramebufferWrappers?.length,
      textures: Object.keys(g.textures.list).length,
      worldChildren: w.children.list.length,
      uiChildren: g.scene.getScene('UI').children.list.length,
      heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null,
    };
  });
  await evalG(() => {
    const G = window.__G;
    G.newGame();
    for (const f of ['woke', 'inn_met', 'village_entered', 'bertram_deal', 'checkpoint_seen', 'camp_seen', 'steward_met', 'guild_seen']) G.setFlag(f);
    G.state.time = { day: 3, minute: 12 * 60 };
    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 95, y: 60, facing: 'down' });
  });
  await wait(4000);
  const rows = [['başlangıç', await stats()]];
  const maps = ['inn', 'world', 'smithy', 'world', 'guild', 'world', 'shop', 'world', 'inn', 'inn_attic', 'inn', 'world'];
  for (let round = 1; round <= 3; round++) {
    for (const m of maps) {
      await evalG((m) => {
        const w = window.__game.scene.getScene('World');
        const p = m === 'world' ? w.getWorldPoint('plaza') ?? { x: 95, y: 60 } : null;
        w.loadMap(m, p ? p.x : 6, p ? p.y : 8, 'down');
      }, m);
      await wait(700);
    }
    await evalG(() => window.gc?.());
    rows.push(['tur ' + round, await stats()]);
  }
  for (const [k, v] of rows) console.log('LEAK', k, JSON.stringify(v));

  // WebGL bağlam kaybı: perde, kayıt, yenileme ve otomatik devam
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.loadMap('inn', 6, 8, 'down'); });
  await wait(1500);
  const before = await evalG(() => ({ map: window.__G.state.pos.map, savedAt: JSON.parse(localStorage.getItem('elonth.save.auto') || '{}').savedAt ?? null }));
  await evalG(() => { window.__ext = window.__game.renderer.gl.getExtension('WEBGL_lose_context'); window.__ext.loseContext(); });
  await wait(800);
  const curtain = await evalG(() => document.getElementById('ctxcurtain')?.textContent ?? null);
  const resumeFlag = await evalG(() => sessionStorage.getItem('elonth.resume'));
  console.log('CTX lost: perde =', curtain, '| resume bayrağı =', resumeFlag);
  await shot('g1_ctx_curtain');
  const nav = page.waitForNavigation({ timeout: 20000 }).then(() => 'reloaded').catch(() => 'no-reload');
  await evalG(() => window.__ext.restoreContext());
  console.log('CTX restore →', await nav);
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('World'), null, { timeout: 60000 }).catch(() => {});
  await wait(3000);
  const after = await evalG(() => ({ world: window.__game.scene.isActive('World'), map: window.__G.state.pos.map, hud: window.__game.scene.getScene('UI').hud?.visible }));
  console.log('CTX sonrası', JSON.stringify({ before, after }));
  await shot('g1_ctx_after');
  console.log(after.world && after.map === before.map && after.hud ? 'PASS CTX' : 'FAIL CTX');
};
