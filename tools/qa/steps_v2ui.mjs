// 0.2.0 arayüz turu: HUD, Status kartları, envanter kategorileri, ekipman, dükkân kaydırma, ayarlar.
export default async ({ page, wait, shot, evalG }) => {
  await evalG(() => {
    const G = window.__G;
    G.newGame();
    G.setFlag('woke'); G.setFlag('inn_met'); G.setFlag('village_entered'); G.setFlag('bertram_deal');
    G.p.wallet.bronze = 45; G.p.wallet.silver = 1;
    G.p.inventory = { bread: 3, apple: 2, hot_stew: 1, rat_tail: 4, linen_shirt: 1, hp_potion_s: 1, wolf_pelt: 2 };
    G.p.equipment = { chest: 'linen_shirt', pants: 'linen_pants', boots: 'cloth_shoes' };
    G.p.exp = 40; G.p.level = 1; G.p.unspent = 4; G.p.sp = 1;
    G.state.time.minute = 12 * 60;
    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 95, y: 61, facing: 'down' });
  });
  await wait(3500);
  await shot('v2_01_hud');
  // NPC yanına git: etkileşim butonu
  await evalG(() => { const w = window.__game.scene.getScene('World'); const n = w.npcs[0]; w.player.actor.setPosition(n.x, n.y + 30); w.player.actor.face('up'); });
  await wait(800);
  await shot('v2_02_talk_button');
  const ui = (fn) => evalG(fn);
  await ui(() => window.__game.scene.getScene('UI').openMenu('status'));
  await wait(1500);
  await shot('v2_03_status');
  await evalG(() => { const m = window.__game.scene.getScene('Menu'); m.section = 'stats'; m.render(); });
  await wait(600);
  await shot('v2_04_stats');
  await evalG(() => { const m = window.__game.scene.getScene('Menu'); m.section = 'traits'; m.render(); });
  await wait(600);
  await shot('v2_05_traits');
  await evalG(() => { const m = window.__game.scene.getScene('Menu'); m.section = 'equipment'; m.render(); });
  await wait(600);
  await shot('v2_06_equipment_section');
  await evalG(() => { const m = window.__game.scene.getScene('Menu'); m.tab = 'inventory'; m.selItem = 'bread'; m.render(); });
  await wait(600);
  await shot('v2_07_inventory');
  await evalG(() => { const m = window.__game.scene.getScene('Menu'); m.invCat = 'food'; m.render(); });
  await wait(500);
  await shot('v2_08_inventory_food');
  await evalG(() => { const m = window.__game.scene.getScene('Menu'); m.tab = 'equipment'; m.selSlot = 'chest'; m.render(); });
  await wait(600);
  await shot('v2_09_equipment');
  await evalG(() => { const m = window.__game.scene.getScene('Menu'); m.tab = 'settings'; m.render(); });
  await wait(600);
  await shot('v2_10_settings');
  // Ayar butonları gerçekten çalışıyor mu (tıklama ile)
  const before = await evalG(() => ({ ...window.__G.settings }));
  for (const name of ['set_auto', 'set_shake', 'set_fps', 'set_quality', 'set_joy']) {
    const pt = await evalG((name) => {
      const m = window.__game.scene.getScene('Menu');
      const b = m.content.list.find((o) => o.name === name);
      const z = m.cameras.main.zoom, dpr = window.devicePixelRatio || 1;
      return { x: (m.content.x + b.x) * z / dpr, y: (m.content.y + b.y) * z / dpr, label: b.label?.text };
    }, name);
    console.log('btn', name, pt.label);
    await page.mouse.click(pt.x, pt.y);
    await wait(300);
  }
  const after = await evalG(() => ({ ...window.__G.settings }));
  console.log('settings before', JSON.stringify(before));
  console.log('settings after ', JSON.stringify(after));
  await shot('v2_11_settings_after');
  await evalG(() => window.__game.scene.getScene('Menu').close());
  await wait(800);
  // dükkân kaydırma: demirci
  await evalG(() => { window.__G.state.time.minute = 10 * 60; const w = window.__game.scene.getScene('World'); w.loadMap('smithy', 4, 7, 'up'); });
  await wait(1500);
  await evalG(async () => { const ui = window.__game.scene.getScene('UI'); const m = await import('/src/ui/shop.ts').catch(() => null); });
  await evalG(() => { const w = window.__game.scene.getScene('World'); const n = w.npc('smith'); w.director.talk(n); });
  await wait(1500);
  for (let i = 0; i < 6; i++) { const s = await evalG(() => ({ dlg: !!window.__game.scene.getScene('UI').dlgState, ch: window.__game.scene.getScene('UI').choiceObjs.length })); if (s.ch) break; await evalG(() => window.__game.scene.getScene('UI').advanceDialogue()); await wait(400); }
  await evalG(() => { const ui = window.__game.scene.getScene('UI'); const b = ui.choiceObjs[0]; const ev = { stopPropagation() {} }; b.emit('pointerdown', {}, 0, 0, ev); b.emit('pointerup', {}, 0, 0, ev); });
  await wait(1200);
  await shot('v2_12_shop');
  // sürükle (satırın üstünden)
  const box = await evalG(() => { const ui = window.__game.scene.getScene('UI'); const z = ui.cameras.main.zoom, dpr = window.devicePixelRatio || 1; const W = ui.cameras.main.width / z, H = ui.cameras.main.height / z; return { x: (W / 2 - 200) * z / dpr, y: (H / 2 + 150) * z / dpr, dy: 300 * z / dpr }; });
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(box.x, box.y - (box.dy * i) / 10); await wait(30); }
  await page.mouse.up();
  await wait(800);
  await shot('v2_13_shop_scrolled');
};
