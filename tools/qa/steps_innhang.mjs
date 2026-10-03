// Tanı: akşam hanında saat başı NPC girişi; donarsa CDP ile duraklatıp yığın izini yaz
export default async ({ page, wait, evalG }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Debugger.enable');
  await evalG(() => {
    const G = window.__G;
    G.newGame();
    for (const f of ['woke', 'inn_met', 'village_entered', 'bertram_deal', 'checkpoint_seen', 'camp_seen', 'steward_met']) G.setFlag(f);
    G.state.time = { day: 3, minute: 17 * 60 + 30 };
    window.__game.scene.getScene('Title').scene.start('World', { map: 'inn', x: 7, y: 10, facing: 'up' });
  });
  await wait(4000);
  for (const h of [18, 19, 20, 21, 22, 7, 8, 12, 17, 18, 19]) {
    const r = await evalG((h) => {
      const w = window.__game.scene.getScene('World');
      window.__G.state.time.minute = h * 60 - 1;
      const n0 = w.npcs.length;
      w.tickMinute();
      return { h, n0, n1: w.npcs.length };
    }, h);
    await wait(3000);
    r.after3s = await evalG(() => ({ npcs: window.__game.scene.getScene('World').npcs.length, q: window.__game.scene.getScene('World').npcArrivals?.length, fps: Math.round(window.__game.loop.actualFps) }));
    console.log(JSON.stringify(r));
    const ok = await Promise.race([evalG(() => 1), new Promise((r) => setTimeout(() => r(0), 8000))]);
    if (!ok) {
      console.log('HUNG — pausing');
      const paused = new Promise((res) => cdp.once('Debugger.paused', res));
      await cdp.send('Debugger.pause');
      const ev = await paused;
      for (const f of ev.callFrames.slice(0, 8)) console.log('  at', f.functionName, f.url.split('/').pop(), f.location.lineNumber + 1);
      const q = async (i, expr) => (await cdp.send('Debugger.evaluateOnCallFrame', { callFrameId: ev.callFrames[i].callFrameId, expression: expr, returnByValue: true })).result.value;
      console.log('findPath', await q(0, 'JSON.stringify({W, H, sx, sy, tx, ty, iter, heap: heap.length, maxIter})'));
      console.log('npc', await q(2, 'JSON.stringify({id: this.def.id, x: this.x, y: this.y, state: this.state, react: this.reactCd})'));
      for (let k = 0; k < 4; k++) {
        await cdp.send('Debugger.resume');
        await new Promise((r) => setTimeout(r, 1500));
        const p2 = new Promise((res) => cdp.once('Debugger.paused', res));
        await cdp.send('Debugger.pause');
        const e2 = await p2;
        console.log('--', e2.callFrames.slice(0, 4).map((f) => f.functionName + ':' + (f.location.lineNumber + 1)).join(' < '));
        const fp = e2.callFrames.findIndex((f) => f.functionName === 'findPath');
        if (fp >= 0) console.log('   ', (await cdp.send('Debugger.evaluateOnCallFrame', { callFrameId: e2.callFrames[fp].callFrameId, expression: 'JSON.stringify({W, H, sx, sy, tx, ty, iter, heap: heap.length})', returnByValue: true })).result.value);
      }
      return;
    }
  }
};
