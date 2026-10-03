// Performans ölçümü (A3): köy, orman, han ve han + menü açıkken FPS ve nesne sayıları.
// Not: headless Chromium (SwiftShader, yazılım GPU) mutlak FPS'i düşük gösterir; önce/sonra kıyası içindir.
// DEV=1: geliştirici modu açık. Akşam hanı: saat 19'a geçerken hana giren NPC'ler ve en uzun kare.
export default async ({ page, wait, shot, evalG }) => {
  const DEV = process.env.DEV === '1';
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
  // en uzun kare (ms) ve ortalama: ani donmaları yakalar
  const spikes = (ms = 3000) => evalG((ms) => new Promise((res) => {
    let last = performance.now(), worst = 0, n = 0, sum = 0;
    const f = () => {
      const now = performance.now();
      const d = now - last;
      last = now;
      worst = Math.max(worst, d);
      sum += d;
      n++;
      if (sum < ms) requestAnimationFrame(f);
      else res({ worstMs: Math.round(worst), avgMs: Math.round((sum / n) * 10) / 10 });
    };
    requestAnimationFrame(f);
  }), ms);
  // Kare başına iş: NPC güncelleme süresi, metin dokusu yeniden çizimi (Text.updateText) ve walkTo sayısı
  const work = (ms = 2000) => evalG((ms) => new Promise((res) => {
    const g = window.__game;
    const w = g.scene.getScene('World');
    const Text = window.Phaser.GameObjects.Text.prototype;
    const np = w.npcs[0]?.constructor.prototype;
    let frames = 0, npcMs = 0, texUpd = 0, walks = 0;
    const oUpd = Text.updateText, oNpc = np?.update, oFar = np?.updateFar, oWalk = np?.walkTo;
    Text.updateText = function (...a) { texUpd++; return oUpd.apply(this, a); };
    const timed = (fn) => function (...a) { const t = performance.now(); const r = fn.apply(this, a); npcMs += performance.now() - t; return r; };
    if (np) {
      np.update = timed(oNpc);
      if (oFar) np.updateFar = timed(oFar); // 0.3.1: uzaktaki NPC'lerin hafif güncellemesi de sayılsın
      np.walkTo = function (...a) { walks++; return oWalk.apply(this, a); };
    }
    const f = () => frames++;
    g.events.on('postrender', f);
    setTimeout(() => {
      g.events.off('postrender', f);
      Text.updateText = oUpd;
      if (np) { np.update = oNpc; if (oFar) np.updateFar = oFar; np.walkTo = oWalk; }
      const k = Math.max(1, frames);
      res({ npcMsPerFrame: Math.round((npcMs / k) * 100) / 100, textRedrawsPerFrame: Math.round((texUpd / k) * 10) / 10, walkToCalls: walks });
    }, ms);
  }), ms);
  // Hana aynı anda gelen NPC'ler: refreshNpcPresence'ın tek karede harcadığı süre (en kötü durum)
  const arrival = () => evalG(() => {
    const w = window.__game.scene.getScene('World');
    for (const n of w.npcs) n.destroy();
    w.npcs = [];
    const t0 = performance.now();
    w.refreshNpcPresence();
    const syncMs = Math.round((performance.now() - t0) * 10) / 10;
    return { syncMs, npcsAfterCall: w.npcs.length, queued: w.npcArrivals?.length ?? 0 };
  });
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
    const texts = w.children.list.filter((o) => o.type === 'Text').length;
    return { map: w.mapData.id, children: w.children.list.length, rendered, texts, npcs: w.npcs.length, props, propsOnScreen, uiChildren: ui.children.list.length, worldActive: w.scene.isActive(), worldVisible: w.scene.isVisible() };
  });
  const result = {};
  await evalG((DEV) => {
    const G = window.__G;
    G.newGame();
    for (const f of ['woke', 'inn_met', 'village_entered', 'bertram_deal', 'checkpoint_seen', 'camp_seen', 'steward_met']) G.setFlag(f);
    G.p.equipment = { chest: 'linen_shirt', pants: 'linen_pants', boots: 'cloth_shoes' };
    G.state.time = { day: 3, minute: 12 * 60 };
    G.settings.showFps = true;
    G.settings.devMode = DEV;
    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 95, y: 60, facing: 'down' });
  }, DEV);
  await wait(4000);
  const plaza = await evalG(() => { const w = window.__game.scene.getScene('World'); const p = w.mapData.points.plaza; return p; });
  await evalG((p) => { const w = window.__game.scene.getScene('World'); w.player.actor.setPosition(p.x * 32 + 16, p.y * 32 + 22); }, plaza);
  await wait(1500);
  result.village = { fps: await fps(), cpuMs: await cpu(), ...(await work()), ...(await counts()) };
  await shot('perf_01_village');
  await evalG(() => { const w = window.__game.scene.getScene('World'); const p = w.mapData.points.wake; w.player.actor.setPosition(p.x * 32 + 16, (p.y + 8) * 32); });
  await wait(1500);
  result.forest = { fps: await fps(), cpuMs: await cpu(), ...(await work()), ...(await counts()) };
  await shot('perf_02_forest');
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.loadMap('inn', 7, 10, 'up'); });
  await wait(2500);
  result.inn = { fps: await fps(), cpuMs: await cpu(), ...(await counts()) };
  await shot('perf_03_inn');
  // Akşam hanı: saat başlarında hana gelen NPC'ler (refreshNpcPresence). Eski sürümde kast tepkisindeki
  // harita dışı yol hedefi sayfayı donduruyordu: zaman aşımıyla "HUNG" yazılır.
  const guard = (p, ms = 20000) => Promise.race([p, new Promise((r) => setTimeout(() => r('HUNG'), ms))]);
  result.innEvening = await guard((async () => {
    await evalG(() => { const G = window.__G; G.state.time.minute = 17 * 60 + 30; const w = window.__game.scene.getScene('World'); w.loadMap('inn', 7, 10, 'up'); });
    await wait(1500);
    const out = { npcsBefore: await evalG(() => window.__game.scene.getScene('World').npcs.length) };
    for (const h of [18, 19, 20]) {
      await evalG((h) => { const w = window.__game.scene.getScene('World'); window.__G.state.time.minute = h * 60 - 1; w.tickMinute(); }, h);
      const sp = await spikes(2500);
      out['h' + h] = sp;
    }
    Object.assign(out, await counts());
    out.fps = await fps();
    out.work = await work();
    out.arrival = await arrival();
    await wait(3000);
    out.npcsAfter3s = await evalG(() => window.__game.scene.getScene('World').npcs.length);
    return out;
  })(), 90000);
  if (result.innEvening === 'HUNG') {
    console.log('PERF', JSON.stringify(result, null, 1));
    return;
  }
  await shot('perf_03b_inn_evening');
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
