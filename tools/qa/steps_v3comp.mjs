// 0.3.0 yoldaş turu: Vera ve Lina Joseph'i izler, kapıdan geçer, kurtlarla dövüşür, yere düşer/kalkar.
export default async ({ page, wait, shot, evalG }) => {
  await evalG(() => {
    const G = window.__G;
    G.newGame();
    for (const f of ['woke', 'inn_met', 'village_entered', 'bertram_deal', 'bertram_done', 'farm_done', 'guild_registered', 'steward_met', 'checkpoint_seen']) G.setFlag(f);
    G.p.equipment = { chest: 'linen_shirt', pants: 'linen_pants', boots: 'cloth_shoes', weapon: 'cracked_stick' };
    G.state.party = ['vera', 'lina'];
    G.state.time = { day: 6, minute: 10 * 60 };
    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 132, y: 104, facing: 'down' });
  });
  await wait(3000);
  const W = () => window.__game.scene.getScene('World');
  const info = () => evalG(() => { const w = window.__game.scene.getScene('World'); const pa = w.player.actor; return w.companions.map((c) => ({ id: c.id, st: c.state, hp: Math.round(c.hp), d: +(Math.hypot(c.x - pa.x, c.y - pa.y) / 32).toFixed(1) })); });
  console.log('start', JSON.stringify(await info()));
  // yürü: sağa 3 sn
  await evalG(() => { window.__input = window.__input; });
  const move = async (x, y, ms) => {
    await evalG(([x, y]) => { const I = window.__IN; I.moveX = x; I.moveY = y; I.touchMove = true; }, [x, y]);
    await wait(ms);
    await evalG(() => { const I = window.__IN; I.moveX = 0; I.moveY = 0; I.touchMove = false; });
  };
  await move(1, 0, 2500);
  await wait(800);
  console.log('after walk', JSON.stringify(await info()));
  await shot('v3comp_01_follow');
  // kurtlar
  await evalG(() => { const w = window.__game.scene.getScene('World'); const pa = w.player.actor; const es = w.spawnAt('wolf', Math.floor(pa.x / 32) + 5, Math.floor(pa.y / 32), 3, 1, 'qa'); for (const e of es) e.becomeAware(true); });
  for (let i = 0; i < 30; i++) {
    await wait(1000);
    await evalG(() => { const p = window.__G.p; p.hp = Math.max(p.hp, 3); });
    if (i === 2) await shot('v3comp_02_fight');
    if (i === 5) await shot('v3comp_03_fight2');
    const s = await evalG(() => { const w = window.__game.scene.getScene('World'); const q = w.enemies.filter((e) => e.spawnId.startsWith('qa')); return { fps: Math.round(window.__game.loop.actualFps), alive: q.filter((e) => e.alive).length, foes: q.map((e) => e.foe ? e.foe.id : 'J'), st: q.map((e) => e.state), exp: window.__G.p.exp, hp: window.__G.p.hp, dmg: q.map((e) => JSON.stringify(e.damageBy)) }; });
    console.log(i, JSON.stringify(s), JSON.stringify(await info()));
    if (!s.alive) break;
  }
  await shot('v3comp_04_after');
  // yere düşme ve kalkma
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.companions[0].hurt(999, new Phaser.Math.Vector2(1, 0)); });
  await wait(600);
  console.log('down', JSON.stringify(await info()));
  await shot('v3comp_05_down');
  await wait(4000);
  console.log('recovered', JSON.stringify(await info()));
  // harita değişimi: hana ışınlan
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.warpTo('inn', 7, 10, 'up'); });
  await wait(2000);
  console.log('inn', JSON.stringify(await info()));
  await shot('v3comp_06_inn');
  // uzaklaşma → ışınlanma
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.warpTo('world', 84, 64, 'down'); });
  await wait(2000);
  await evalG(() => { const w = window.__game.scene.getScene('World'); const pa = w.player.actor; pa.setPosition(pa.x + 32 * 20, pa.y); pa.body.reset(pa.x, pa.y); });
  await wait(600);
  console.log('teleport', JSON.stringify(await info()));
};
