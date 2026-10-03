// 0.3.0 dünya turu: küçülen köy, orman, yol kenarları, koşu kilidi (A1), kamera titremesi (A2), konuşan NPC (A8).
export default async ({ page, wait, shot, evalG }) => {
  await evalG(() => {
    const G = window.__G;
    G.newGame();
    for (const f of ['woke', 'inn_met', 'village_entered', 'bertram_deal', 'checkpoint_seen', 'camp_seen', 'steward_met']) G.setFlag(f);
    G.p.equipment = { chest: 'linen_shirt', pants: 'linen_pants', boots: 'cloth_shoes' };
    G.state.time = { day: 3, minute: 11 * 60 };
    G.settings.joystick = 'fixed';
    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 84, y: 62, facing: 'down' });
  });
  await wait(3500);
  const tp = (x, y) => evalG(([x, y]) => { const w = window.__game.scene.getScene('World'); w.player.actor.setPosition(x * 32 + 16, y * 32 + 22); w.camX = w.player.actor.x; w.camY = w.player.actor.y - 20; }, [x, y]);
  const places = [['plaza', 84, 61], ['east_plaza', 128, 70], ['south_oak', 103, 101], ['haldor', 124, 46], ['north_fields', 87, 36], ['checkpoint', 146, 57], ['training', 67, 52], ['shops', 93, 74], ['forest', 40, 62]];
  for (const [n, x, y] of places) {
    await tp(x, y);
    await wait(1300);
    await shot('v3w_' + n);
  }
  // Ormanda serbest yürüyüş: takılmadan ne kadar ilerleniyor?
  await tp(30, 70);
  await wait(500);
  const walk = await evalG(() => new Promise((res) => {
    const w = window.__game.scene.getScene('World');
    const IN = window.__IN;
    const a = w.player.actor;
    const x0 = a.x, y0 = a.y;
    let t = 0, path = 0, lx = a.x, ly = a.y;
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [0.7, 0.7]];
    const iv = setInterval(() => {
      const d = dirs[Math.floor(t / 1000) % dirs.length];
      IN.touchMove = true; IN.moveX = d[0] * 0.6; IN.moveY = d[1] * 0.6;
      path += Math.hypot(a.x - lx, a.y - ly);
      lx = a.x; ly = a.y;
      t += 50;
      if (t > 5000) { clearInterval(iv); IN.touchMove = false; IN.moveX = 0; IN.moveY = 0; res({ st: w.player.state, cut: w.cutscene, dlg: w.ui.dialogueOpen(), fz: w.frozen, pz: w.paused, pathPx: Math.round(path), expectedPx: Math.round(5 * 0.6 * 5.2 * 32 * w.player.d.moveSpeed) }); }
    }, 50);
  }));
  console.log('FOREST_WALK', JSON.stringify(walk));
  await shot('v3w_forest_walk');
  // A1: joystick sonda tutulurken dayanıklılık bitince koşu kilidi
  await tp(84, 57);
  const a1 = await evalG(() => new Promise((res) => {
    const w = window.__game.scene.getScene('World');
    const G = window.__G, IN = window.__IN;
    G.p.stamina = 6;
    const log = [];
    let t = 0;
    const iv = setInterval(() => {
      t += 100;
      if (t < 4000) { IN.touchMove = true; IN.moveX = (t / 200) % 2 < 1 ? 1 : -1; IN.moveY = 0; }
      else if (t < 4300) { IN.moveX = 0.3; } // eşiğin altına çek
      else if (t < 5200) { IN.moveX = 1; }
      log.push([t, Math.round(G.p.stamina * 10) / 10, w.player.running ? 1 : 0, w.player.runLock.exhausted ? 1 : 0]);
      if (t >= 5200) { clearInterval(iv); IN.touchMove = false; IN.moveX = 0; res(log); }
    }, 100);
  }));
  console.log('A1', JSON.stringify(a1.filter((_, i) => i % 3 === 0)));
  // A2: yavaş yürüyüşte kare kare oyuncu ekran konumu ve kamera
  await tp(84, 57);
  await wait(400);
  const a2 = await evalG(() => new Promise((res) => {
    const w = window.__game.scene.getScene('World');
    const IN = window.__IN;
    const cam = w.cameras.main;
    const samples = [];
    let n = 0;
    IN.touchMove = true; IN.moveX = 0.25; IN.moveY = 0;
    const f = () => {
      const z = cam.zoom;
      const L = cam.scrollX + cam.width / 2 - cam.width / z / 2;
      samples.push({ px: w.player.actor.x, sx: (Math.floor(w.player.actor.x) - Math.floor(cam.scrollX)) * z, L: Math.floor(cam.scrollX) });
      if (++n < 180) requestAnimationFrame(f);
      else { IN.touchMove = false; IN.moveX = 0; res(samples); }
    };
    requestAnimationFrame(f);
  }));
  // Titreme: ekran konumunun (yuvarlanmış) ileri-geri gidip gelmesi
  let flips = 0, last = 0;
  const scr = a2.map((s) => Math.round(s.sx));
  for (let i = 1; i < scr.length; i++) {
    const d = Math.sign(scr[i] - scr[i - 1]);
    if (d && last && d !== last) flips++;
    if (d) last = d;
  }
  const camMoves = a2.filter((s, i) => i && s.L !== a2[i - 1].L).length;
  console.log('A2', JSON.stringify({ frames: a2.length, screenXRange: [Math.min(...scr), Math.max(...scr)], directionFlips: flips, cameraMovedFrames: camMoves, playerMoved: Math.round(a2[a2.length - 1].px - a2[0].px) }));
  // A8: konuşurken NPC durur
  const a8 = await evalG(() => new Promise((res) => {
    const w = window.__game.scene.getScene('World');
    const n = w.npcs.find((n) => !n.scripted && n.def.id !== 'captain');
    if (!n) return res('npc yok');
    w.player.actor.setPosition(n.x, n.y + 28);
    w.player.actor.face('up');
    n.walkTo(Math.floor(n.x / 32) + 6, Math.floor(n.y / 32));
    setTimeout(() => {
      w.interact();
      const x0 = n.x;
      setTimeout(() => res({ id: n.def.id, talking: n.talking, movedWhileTalking: Math.round(Math.abs(n.x - x0)), anim: n.actor.anim, cut: w.cutscene }), 1200);
    }, 300);
  }));
  console.log('A8', JSON.stringify(a8));
  await shot('v3w_talk');
};
