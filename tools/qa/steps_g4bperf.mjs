// Grup 4B performans: köy meydanında (25 NPC) silah + pelerin kuşanık FPS ve CPU kare süresi; ormanda
// sürekli saldırı sırasında. Önce/sonra kıyası için iki sürümde de çalıştırılır (başsız, SwiftShader).
// URL='http://localhost:4173/?qa=1' DPR=1 node tools/qa/shot.mjs g4bperf
export default async ({ wait, evalG }) => {
  const fps = (ms = 4000) => evalG((ms) => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(Math.round((n * 1000) / (performance.now() - t0) * 10) / 10); };
    requestAnimationFrame(f);
  }), ms);
  const cpu = (ms = 3000) => evalG((ms) => new Promise((res) => {
    const g = window.__game; let t0 = 0, sum = 0, n = 0;
    const a = () => { t0 = performance.now(); }; const b = () => { if (t0) { sum += performance.now() - t0; n++; } };
    g.events.on('prestep', a); g.events.on('postrender', b);
    setTimeout(() => { g.events.off('prestep', a); g.events.off('postrender', b); res(n ? Math.round((sum / n) * 10) / 10 : -1); }, ms);
  }), ms);
  await evalG(() => {
    const G = window.__G;
    G.newGame();
    for (const f of ['woke', 'inn_met', 'village_entered', 'bertram_deal', 'checkpoint_seen', 'camp_seen', 'steward_met']) G.setFlag(f);
    G.p.equipment = { chest: 'linen_shirt', pants: 'linen_pants', boots: 'cloth_shoes', weapon: 'iron_shortsword', cape: 'traveler_cape' };
    G.state.time = { day: 3, minute: 12 * 60 };
    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 95, y: 60, facing: 'down' });
  });
  await wait(4000);
  await evalG(() => { const w = window.__game.scene.getScene('World'); const p = w.mapData.points.plaza; w.player.actor.setPosition(p.x * 32 + 16, p.y * 32 + 22); });
  await wait(1500);
  const out = { plaza: [], attack: [] };
  for (let i = 0; i < 3; i++) out.plaza.push({ fps: await fps(), cpuMs: await cpu() });
  out.npcs = await evalG(() => window.__game.scene.getScene('World').npcs.length);
  out.layers = await evalG(() => window.__game.scene.getScene('World').player.actor.layers.length);
  // ormanda sürekli saldırı (normal/ağır sırayla)
  await evalG(() => { const w = window.__game.scene.getScene('World'); const p = w.mapData.points.wake; w.player.actor.setPosition(p.x * 32 + 16, (p.y + 8) * 32); });
  await wait(1500);
  const spam = await evalG(() => { let k = 0; return setInterval(() => { window.__G.p.stamina = 999; window.__IN.press(k++ % 3 === 2 ? 'heavy' : 'attack'); }, 250); });
  for (let i = 0; i < 3; i++) out.attack.push({ fps: await fps(), cpuMs: await cpu() });
  await evalG((id) => clearInterval(id), spam);
  const avg = (a, k) => Math.round((a.reduce((s, x) => s + x[k], 0) / a.length) * 10) / 10;
  console.log('PERF', JSON.stringify({ plazaFps: avg(out.plaza, 'fps'), plazaCpuMs: avg(out.plaza, 'cpuMs'), attackFps: avg(out.attack, 'fps'), attackCpuMs: avg(out.attack, 'cpuMs'), npcs: out.npcs, joseph_layers: out.layers, raw: out }));
};
