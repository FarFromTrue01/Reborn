// QA yardımcıları. 0.8.0 (A3): sabit beklemeler yerine zaman aşımlı yoklama — başsız tarayıcıda kare hızı
// 3–6 FPS'e düşebiliyor; olaylar sabit `wait()` sürelerinden geç tetikleniyordu.
export function helpers(page, wait, evalG) {
  const S = () => evalG(() => {
    const w = window.__game.scene.getScene('World'); const ui = window.__game.scene.getScene('UI');
    return { cut: w.cutscene, dlg: !!ui.dlgState, choice: ui.choiceObjs.length, map: w.mapData?.id, menu: ui.menuIsOpen, busy: w.director?.busy, appr: !!w.director?.appraiseWaiter, trans: !!w.transitioning, x: Math.round(w.player.actor.x/32), y: Math.round(w.player.actor.y/32), time: window.__G.state.time, money: window.__G.p.wallet, frame: window.__game.loop.frame };
  });
  const pick = (i) => evalG((i) => {
    const ui = window.__game.scene.getScene('UI'); const b = ui.choiceObjs[i];
    const ev = { stopPropagation() {} };
    b.emit('pointerdown', {}, 0, 0, ev); b.emit('pointerup', {}, 0, 0, ev);
  }, i);
  const adv = () => evalG(() => window.__game.scene.getScene('UI').advanceDialogue());
  const sceneOn = (s) => !!(s.cut || s.busy || s.dlg || s.choice || s.appr || s.trans);
  /** Koşul (tarayıcıda çalışan fonksiyon) doğru olana kadar yokla; zaman aşımında false. */
  const until = async (fn, arg, timeout = 8000, every = 150) => {
    const t0 = Date.now();
    for (;;) {
      if (await evalG(fn, arg)) return true;
      if (Date.now() - t0 > timeout) return false;
      await wait(every);
    }
  };
  /** Oyun en az n kare ilerlesin (kare hızından bağımsız "biraz bekle"). */
  const frames = async (n = 10, timeout = 15000) => {
    const f0 = await evalG(() => window.__game.loop.frame);
    return until((f) => window.__game.loop.frame >= f, f0 + n, timeout, 60);
  };
  /** Oyun saatiyle en az `sec` saniye geçsin (World sahnesinin oyun zamanı; donmuşken ilerlemez). */
  const gameSec = async (sec, timeout = 30000) => {
    const t0 = await evalG(() => window.__game.scene.getScene('World').playClock);
    return until((t) => window.__game.scene.getScene('World').playClock >= t, t0 + sec, timeout, 80);
  };
  /**
   * Sahne bitene kadar ilerle. Önce bir sahnenin başlamasını bekler (`start` ms; görev denetimi yarım saniyede bir
   * çalıştığından sahne birkaç kare sonra başlayabilir), sonra diyalogları/seçimleri ilerletir. Sahne bitince birkaç
   * kare daha bakar: zincirleme sahneler (ör. görev bitişinden hemen sonra başlayan) yarıda kalmasın.
   * choices: sırayla seçilecek indeksler.
   */
  const run = async (choices = [], maxSteps = 400, onStep, { start = 3000, settle = 6 } = {}) => {
    let ci = 0;
    let s = await S();
    if (!sceneOn(s) && start > 0) {
      const t0 = Date.now();
      while (!sceneOn(s) && Date.now() - t0 < start) { await wait(120); s = await S(); }
    }
    let idle = 0;
    for (let i = 0; i < maxSteps; i++) {
      s = await S();
      if (onStep) await onStep(s, i);
      if (s.choice) { await pick(choices[ci] ?? 0); ci++; idle = 0; await wait(200); continue; }
      if (s.appr) { await evalG(() => { const w = window.__game.scene.getScene('World'); w.appraiseNearest(); }); idle = 0; await wait(300); continue; }
      if (s.dlg) { await adv(); idle = 0; await wait(180); continue; }
      if (!sceneOn(s)) {
        // birkaç kare boyunca sahne yoksa bitti
        if (++idle >= 2) {
          const f0 = s.frame;
          let again = false;
          for (let k = 0; k < 40; k++) {
            const s2 = await S();
            if (sceneOn(s2)) { again = true; break; }
            if (s2.frame - f0 >= settle) break;
            await wait(60);
          }
          if (!again) return S();
          idle = 0;
        }
      } else idle = 0;
      await wait(150);
    }
    return S();
  };
  /** Haritaya ışınlan ve haritanın yüklendiğini doğrula (girişte başlayan sahneler için ardından run()). */
  const tp = async (map, x, y, facing = 'up') => {
    await evalG(([map, x, y, f]) => { const w = window.__game.scene.getScene('World'); w.loadMap(map, x, y, f); }, [map, x, y, facing]);
    await frames(3);
  };
  /** Bir kapıdan geç (tryWarp) ve geçişin bitmesini bekle. */
  const warp = async (to) => {
    await evalG((to) => { const w = window.__game.scene.getScene('World'); const wp = w.mapData.warps.find((x) => x.to === to); if (wp) w.tryWarp(wp); }, to);
    await until((to) => { const w = window.__game.scene.getScene('World'); return w.mapData?.id === to && !w.transitioning; }, to, 10000);
    await frames(3);
  };
  return { S, pick, adv, run, tp, warp, until, frames, gameSec };
}
