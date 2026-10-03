// Tablet (DPR 2.5) görünümü: HUD, hızlı yemek bekleme göstergesi, mini haritaya dokununca tam harita.
export default async ({ page, wait, shot, evalG }) => {
  await evalG(() => {
    const G = window.__G;
    G.newGame();
    for (const f of ['woke', 'inn_met', 'village_entered', 'bertram_deal']) G.setFlag(f);
    G.p.equipment = { chest: 'linen_shirt', pants: 'linen_pants', boots: 'cloth_shoes' };
    G.p.inventory = { bread: 5, honey_bun: 2 };
    G.p.wallet.bronze = 37; G.p.wallet.silver = 2; G.p.hp = 2;
    G.state.time.minute = 15 * 60;
    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 172, y: 74, facing: 'down' });
  });
  await wait(6000);
  // üç yemek art arda (bekleme sürelerini atlamak için oyun saatini ileri al)
  const res = [];
  for (let i = 0; i < 4; i++) {
    await evalG(() => window.__IN.press('eat'));
    await wait(1500);
    res.push(await evalG(() => { const w = window.__game.scene.getScene('World'); return { bread: window.__G.p.inventory.bread, chain: w.eatState.chain, left: +(w.eatState.readyAt - w.playClock).toFixed(1) }; }));
    if (i < 3) await evalG(() => { const w = window.__game.scene.getScene('World'); if (w.eatState.chain < 3) w.playClock = w.eatState.readyAt; });
  }
  console.log('eat', JSON.stringify(res));
  await shot('t_01_hud_eat_cooldown');
  // mini haritaya dokun
  const mm = await evalG(() => { const ui = window.__game.scene.getScene('UI'); const z = ui.cameras.main.zoom, dpr = window.devicePixelRatio || 1; return { x: ui.minimap.x * z / dpr, y: ui.minimap.y * z / dpr }; });
  await page.touchscreen.tap(mm.x, mm.y);
  await wait(3000);
  console.log('menu tab', await evalG(() => window.__game.scene.isActive('Menu') ? window.__game.scene.getScene('Menu').tab : 'kapalı'));
  await shot('t_02_map_from_minimap');
};
