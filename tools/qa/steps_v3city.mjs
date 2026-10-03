// E8 şehir manzarası ve E3 sırtta taşıma pozu (tek kare).
export default async ({ page, wait, shot, evalG }) => {
  await evalG(() => {
    const G = window.__G;
    G.newGame();
    for (const f of ['woke', 'inn_met', 'village_entered', 'bertram_deal', 'bertram_done', 'farm_done', 'guild_registered', 'steward_met', 'checkpoint_seen']) G.setFlag(f);
    G.p.equipment = { chest: 'linen_shirt', pants: 'linen_pants', boots: 'cloth_shoes', weapon: 'cracked_stick' };
    G.state.time = { day: 7, minute: 11 * 60 };
    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 90, y: 64, facing: 'down' });
  });
  await wait(3500);
  await evalG(() => {
    const w = window.__game.scene.getScene('World');
    window.__Q.start('m_wounded', true);
    const v = w.addCompanion('vera'); v.speedMult = 0.42; v.fights = false;
    const l = w.addCompanion('lina'); l.carried = true; l.fights = false;
    w.player.burden = 0.5;
  });
  await evalG(() => { const I = window.__IN; I.moveX = 0; I.moveY = 1; I.touchMove = true; });
  await wait(1500);
  await evalG(() => { const I = window.__IN; I.moveX = 0; I.moveY = 0; I.touchMove = false; });
  await wait(600);
  await shot('v3city_01_carry');
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.director.scene(async () => w.director.ch2.cityView()); });
  for (let i = 0; i < 40; i++) {
    await wait(500);
    if (i === 10) await shot('v3city_02_city');
    if (i === 22) await shot('v3city_03_city_end');
    await evalG(() => { const ui = window.__game.scene.getScene('UI'); if (ui.dlgState) ui.advanceDialogue(); });
  }
};
