// Tablet çözünürlüğünde (DPR 2.5) HUD, diyalog ve dövüş butonları.
export default async ({ page, wait, shot, evalG }) => {
  await evalG(() => { const G = window.__G; G.newGame(); G.setFlag('woke'); G.setFlag('inn_met'); G.setFlag('bertram_deal'); G.setFlag('village_entered');
    G.p.equipment = { pants: 'linen_pants', chest: 'linen_shirt', boots: 'cloth_shoes' }; G.p.wallet.bronze = 87;
    G.p.skills.push({ id: 'fire_magic', rank: 0, exp: 0 }); G.state.divine.skills = ['light_step']; G.state.divine.level = 3; G.state.divine.light = 60; G.invalidate();
    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 96, y: 62, facing: 'down' }); });
  await wait(12000);
  await shot('80_tablet_hud');
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.director.scene(async () => { await w.director.say('bertram', 'Tablette bu diyalog kutusu nasıl görünüyor? Uzun bir cümle yazalım ki satır kaydırma da denensin, değil mi evlat?'); }); });
  await wait(10000);
  await shot('81_tablet_dialog');
};
