export function helpers(page, wait, evalG) {
  const S = () => evalG(() => {
    const w = window.__game.scene.getScene('World'); const ui = window.__game.scene.getScene('UI');
    return { cut: w.cutscene, dlg: !!ui.dlgState, choice: ui.choiceObjs.length, map: w.mapData?.id, menu: ui.menuIsOpen, busy: w.director?.busy, appr: !!w.director?.appraiseWaiter, x: Math.round(w.player.actor.x/32), y: Math.round(w.player.actor.y/32), time: window.__G.state.time, money: window.__G.p.wallet };
  });
  const pick = (i) => evalG((i) => {
    const ui = window.__game.scene.getScene('UI'); const b = ui.choiceObjs[i];
    const ev = { stopPropagation() {} };
    b.emit('pointerdown', {}, 0, 0, ev); b.emit('pointerup', {}, 0, 0, ev);
  }, i);
  const adv = () => evalG(() => window.__game.scene.getScene('UI').advanceDialogue());
  /** Sahne bitene kadar ilerle. choices: sırayla seçilecek indeksler. */
  const run = async (choices = [], maxSteps = 400, onStep) => {
    let ci = 0;
    for (let i = 0; i < maxSteps; i++) {
      const s = await S();
      if (onStep) await onStep(s, i);
      if (s.choice) { await pick(choices[ci] ?? 0); ci++; await wait(300); continue; }
      if (s.appr) { await evalG(() => window.__G && (window.__INPUT ? 0 : 0)); await evalG(() => { const w = window.__game.scene.getScene('World'); w.appraiseNearest(); }); await wait(500); continue; }
      if (s.dlg) { await adv(); await wait(250); continue; }
      if (!s.cut && !s.busy && i > 2) return s;
      await wait(250);
    }
    return S();
  };
  const tp = (map, x, y) => evalG(([map, x, y]) => { const w = window.__game.scene.getScene('World'); w.loadMap(map, x, y, 'up'); }, [map, x, y]);
  return { S, pick, adv, run, tp };
}
