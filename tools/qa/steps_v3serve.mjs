// D4: Servis Koşturmacası — her gün için oyun ekranı; otomatik oyuncu siparişleri taşır.
export default async ({ page, wait, shot, evalG }) => {
  await evalG(() => {
    const G = window.__G;
    G.newGame();
    for (const f of ['woke', 'inn_met', 'village_entered', 'bertram_deal']) G.setFlag(f);
    G.p.equipment = { chest: 'linen_shirt', pants: 'linen_pants', boots: 'cloth_shoes' };
    window.__game.scene.getScene('Title').scene.start('World', { map: 'inn', x: 7, y: 10, facing: 'up' });
  });
  await wait(3000);
  for (const day of [1, 3]) {
    await evalG((day) => { const w = window.__game.scene.getScene('World'); window.__servePerf = null; w.scene.launch('Minigame', { kind: 'serve', day, done: (p) => { window.__servePerf = p; } }); w.scene.bringToTop('Minigame'); w.paused = true; }, day);
    await wait(1500);
    // Başsız tarayıcıda kare süresi kısılıyor; oyunu elle 0.1 sn adımlarla ilerlet
    await evalG(() => { const m = window.__game.scene.getScene('Minigame'); m.running = true; });
    for (let i = 0; i < 45; i++) {
      await evalG(() => {
        const m = window.__game.scene.getScene('Minigame');
        const s = m.serve;
        for (let k = 0; k < 10; k++) {
          if (!s || !m.running) return;
          if (!s.target) {
            if (s.carry.includes('plate')) s.goTo(s.sink.x, s.sink.y, () => s.dropPlates());
            else {
              const w = s.tables.find((t) => t.state === 'waiting' && s.carry.includes(t.order));
              const need = s.tables.filter((t) => t.state === 'waiting').sort((a, b) => a.patience - b.patience)[0];
              const d = s.tables.find((t) => t.state === 'dirty');
              if (w) s.goTo(w.x, w.y + 34, () => s.serveTable(w));
              else if (need && s.carry.length < 2) { const f = need.order; const p = s.stockPos[f]; s.goTo(p.x, p.y, () => s.pick(f)); }
              else if (d && !s.carry.length) s.goTo(d.x, d.y + 34, () => s.serveTable(d));
            }
          }
          m.t += 0.1;
          s.update(0.1);
          if (m.t >= m.dur) m.finish();
        }
      });
      if (i === 14) await shot(`v3serve_day${day}`);
      await wait(150);
    }
    await wait(1500);
    console.log('day', day, 'perf', await evalG(() => window.__servePerf), JSON.stringify(await evalG(() => { const s = window.__game.scene.getScene('Minigame').serve; return s ? { served: s.served, failed: s.failed, plates: [s.platesCleared, s.platesMade] } : null; })));
    await wait(3000);
  }
};
