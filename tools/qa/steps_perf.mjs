// Performans ölçümü (A3): köy, orman, han ve han + menü açıkken FPS ve nesne sayıları.
// Not: headless Chromium (SwiftShader, yazılım GPU) mutlak FPS'i düşük gösterir; önce/sonra kıyası içindir.
export default async ({ page, wait, shot, evalG }) => {
  const fps = (ms = 4000) => evalG((ms) => new Promise((res) => {
    let n = 0;
    const t0 = performance.now();
    const f = () => {
      n++;
      if (performance.now() - t0 < ms) requestAnimationFrame(f);
      else res(Math.round((n * 1000) / (performance.now() - t0) * 10) / 10);
    };
    requestAnimationFrame(f);
  }), ms);
  // CPU kare süresi: prestep → postrender (güncelleme + çizim komutları)
  const cpu = (ms = 3000) => evalG((ms) => new Promise((res) => {
    const g = window.__game;
    let t0 = 0, sum = 0, n = 0;
    const a = () => { t0 = performance.now(); };
    const b = () => { if (t0) { sum += performance.now() - t0; n++; } };
    g.events.on('prestep', a);
    g.events.on('postrender', b);
    setTimeout(() => { g.events.off('prestep', a); g.events.off('postrender', b); res(n ? Math.round((sum / n) * 10) / 10 : -1); }, ms);
  }), ms);
  const counts = () => evalG(() => {
    const w = window.__game.scene.getScene('World');
    const ui = window.__game.scene.getScene('UI');
    const cam = w.cameras.main;
    const v = cam.worldView;
    let rendered = 0;
    for (const o of w.children.list) {
      if (!o.visible || o.alpha === 0) continue;
      if (o.willRender && !o.willRender(cam)) continue;
      rendered++;
    }
    const props = w.r?.propImages?.length ?? 0;
    let propsOnScreen = 0;
    for (const p of w.r?.propImages ?? []) if (p.img.x > v.x - 64 && p.img.x < v.right + 64 && p.img.y > v.y - 32 && p.img.y < v.bottom + 256) propsOnScreen++;
    return { map: w.mapData.id, children: w.children.list.length, rendered, props, propsOnScreen, uiChildren: ui.children.list.length, worldActive: w.scene.isActive(), worldVisible: w.scene.isVisible() };
  });
  const result = {};
  await evalG(() => {
    const G = window.__G;
    G.newGame();
    for (const f of ['woke', 'inn_met', 'village_entered', 'bertram_deal', 'checkpoint_seen', 'camp_seen', 'steward_met']) G.setFlag(f);
    G.p.equipment = { chest: 'linen_shirt', pants: 'linen_pants', boots: 'cloth_shoes' };
    G.state.time = { day: 3, minute: 12 * 60 };
    G.settings.showFps = true;
    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 95, y: 60, facing: 'down' });
  });
  await wait(4000);
  const plaza = await evalG(() => { const w = window.__game.scene.getScene('World'); const p = w.mapData.points.plaza; return p; });
  await evalG((p) => { const w = window.__game.scene.getScene('World'); w.player.actor.setPosition(p.x * 32 + 16, p.y * 32 + 22); }, plaza);
  await wait(1500);
  result.village = { fps: await fps(), cpuMs: await cpu(), ...(await counts()) };
  await shot('perf_01_village');
  await evalG(() => { const w = window.__game.scene.getScene('World'); const p = w.mapData.points.wake; w.player.actor.setPosition(p.x * 32 + 16, (p.y + 8) * 32); });
  await wait(1500);
  result.forest = { fps: await fps(), cpuMs: await cpu(), ...(await counts()) };
  await shot('perf_02_forest');
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.loadMap('inn', 7, 10, 'up'); });
  await wait(2500);
  result.inn = { fps: await fps(), cpuMs: await cpu(), ...(await counts()) };
  await shot('perf_03_inn');
  await evalG(() => window.__game.scene.getScene('UI').openMenu('status'));
  await wait(1500);
  result.innMenu = { fps: await fps(), cpuMs: await cpu(), ...(await counts()) };
  // menüde sekme değiştirme süresi
  result.menuRenderMs = await evalG(() => {
    const m = window.__game.scene.getScene('Menu');
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) m.render();
    return Math.round((performance.now() - t0) / 5);
  });
  await shot('perf_04_inn_menu');
  console.log('PERF', JSON.stringify(result, null, 1));
};
