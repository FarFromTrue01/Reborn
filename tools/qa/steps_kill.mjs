// Fareyi kovalayıp öldür: EXP, Divine EXP, drop ve title kontrolü.
export default async ({ page, wait, shot, evalG }) => {
  await evalG(() => { window.__G.newGame(); window.__G.setFlag('woke'); window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 34, y: 64, facing: 'right' }); });
  await wait(3000);
  for (let i = 0; i < 80; i++) {
    const s = await evalG(() => {
      const w = window.__game.scene.getScene('World'); const p = w.player.actor;
      const e = w.enemies.filter((e) => e.alive && e.def.id === 'rat').sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (!e) return { none: true };
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d > 30) { p.setPosition(e.x + (e.x < p.x ? 26 : -26), e.y); }
      p.face(e.x < p.x ? 'left' : 'right');
      window.__IN.press('attack');
      window.__G.p.hp = Math.max(window.__G.p.hp, 3);
      return { ehp: e.c.hp, exp: window.__G.p.exp, dv: window.__G.state.divine.exp, inv: window.__G.p.inventory, kills: window.__G.state.killed };
    });
    if (i % 8 === 0) console.log(i, JSON.stringify(s));
    if (s.none || (s.kills && s.kills.rat >= 2)) break;
    await wait(300);
  }
  await wait(2500);
  await shot('45_kill');
  console.log(JSON.stringify(await evalG(() => ({ exp: window.__G.p.exp, lv: window.__G.p.level, dv: window.__G.state.divine, inv: window.__G.p.inventory, titles: window.__G.p.titles, killed: window.__G.state.killed }))));
};
