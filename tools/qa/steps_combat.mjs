import { helpers } from './helpers.mjs';
export default async ({ page, wait, shot, evalG }) => {
  const h = helpers(page, wait, evalG);
  await evalG(() => { window.__G.newGame(); window.__G.setFlag('woke'); window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 34, y: 64, facing: 'right' }); });
  await wait(3000);
  // fareye yaklaş
  const info = await evalG(() => { const w = window.__game.scene.getScene('World'); return w.enemies.map(e => [e.def.id, Math.round(e.x/32), Math.round(e.y/32), e.c.hp, e.level]).slice(0, 8); });
  console.log(JSON.stringify(info));
  await evalG(() => { const w = window.__game.scene.getScene('World'); const e = w.enemies.find(e => e.def.id === 'rat'); w.player.actor.setPosition(e.x - 30, e.y); });
  await wait(1500); await shot('40_rat_near');
  const I = () => evalG(() => window.__INPUTP);
  for (let i = 0; i < 40; i++) {
    await evalG(() => { const w = window.__game.scene.getScene('World'); const e = w.enemies.filter(e => e.alive).sort((a,b)=> Math.hypot(a.x-w.player.actor.x,a.y-w.player.actor.y)-Math.hypot(b.x-w.player.actor.x,b.y-w.player.actor.y))[0]; if (e) { w.player.actor.face(e.x < w.player.actor.x ? 'left' : 'right'); } window.__IN.press('attack'); });
    await wait(350);
    if (i === 3 || i === 9) await shot('41_fight_' + i);
    const s = await evalG(() => ({ hp: window.__G.p.hp, dead: window.__game.scene.getScene('World').player.dead, exp: window.__G.p.exp, inv: window.__G.p.inventory, dv: window.__G.state.divine.exp }));
    if (s.dead) { console.log('öldü', JSON.stringify(s)); break; }
    if (i % 5 === 0) console.log(i, JSON.stringify(s));
  }
  await wait(2000);
  await shot('42_after_fight');
  // ölüm testi
  await evalG(() => { const w = window.__game.scene.getScene('World'); window.__G.p.wallet.bronze = 37; w.hurtPlayer(99, new window.Phaser.Math.Vector2(1, 0), false, null); });
  await wait(4000); await shot('43_death');
  await page.mouse.click(600, 400);
  await wait(4000);
  await shot('44_respawn');
  console.log(JSON.stringify(await evalG(() => ({ hp: window.__G.p.hp, w: window.__G.p.wallet, pos: window.__G.state.pos, exp: window.__G.p.exp }))));
};
