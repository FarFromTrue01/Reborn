// Grup 1 elle doğrulama: Menü → Ana Menüye Dön → Devam (HUD görünür mü?) ve
// ana ekran → tam ekran gir/çık (yeniden boyutlanma) → Ayarlar açılıyor mu?
export default async ({ page, wait, shot, evalG }) => {
  // Düğmeyi etiketinden bulup tıkla (sahnedeki tüm container'larda arar)
  const click = (scene, label) => evalG(([scene, label]) => {
    const s = window.__game.scene.getScene(scene);
    const all = [];
    const walk = (list) => { for (const o of list) { all.push(o); if (o.list) walk(o.list); } };
    walk(s.children.list);
    const b = all.filter((o) => o.label && o.label.text !== undefined && o.label.text.trim() === label).pop();
    if (!b) return 'yok: ' + label;
    const ev = { stopPropagation() {} };
    b.emit('pointerdown', {}, 0, 0, ev); b.emit('pointerup', {}, 0, 0, ev);
    return 'ok';
  }, [scene, label]);
  const hud = () => evalG(() => {
    const ui = window.__game.scene.getScene('UI');
    return { uiActive: ui.scene.isActive(), menuIsOpen: ui.menuIsOpen, hud: ui.hud?.visible, touch: ui.touch?.visible, world: window.__game.scene.isActive('World'), frozen: window.__game.scene.getScene('World').frozen };
  });
  // oyuna gir
  await evalG(() => {
    const G = window.__G;
    G.newGame();
    for (const f of ['woke', 'inn_met', 'village_entered']) G.setFlag(f);
    G.save('auto');
    window.__game.scene.getScene('Title').scene.start('World', {});
  });
  await wait(3000);
  console.log('oyunda', JSON.stringify(await hud()));
  await evalG(() => window.__game.scene.getScene('UI').openMenu('save'));
  await wait(800);
  console.log('Ana Menüye Dön:', await click('Menu', 'Ana Menüye Dön'));
  await wait(300);
  console.log('Evet:', await click('Menu', 'Evet'));
  await wait(1500);
  console.log('Title aktif:', await evalG(() => window.__game.scene.isActive('Title')));
  console.log('Devam:', await click('Title', 'Devam'));
  await wait(3500);
  const h = await hud();
  console.log('devamdan sonra', JSON.stringify(h));
  await shot('g1_after_continue');
  console.log(h.hud && h.touch !== false && !h.menuIsOpen && !h.frozen ? 'PASS HUD' : 'FAIL HUD');
  // ana ekran: yeniden boyutlanma (tam ekran gir/çık ile aynı zincir) sonrası Ayarlar
  await evalG(() => window.__game.scene.getScene('UI').openMenu('save'));
  await wait(800);
  await click('Menu', 'Ana Menüye Dön');
  await wait(300);
  await click('Menu', 'Evet');
  await wait(1500);
  console.log('Ayarlar (1):', await click('Title', 'Ayarlar'));
  await wait(500);
  console.log('Kapat:', await click('Title', 'Kapat'));
  await wait(1200);
  await page.setViewportSize({ width: 1100, height: 760 });
  await wait(1500);
  await page.setViewportSize({ width: 1280, height: 854 });
  await wait(2000);
  console.log('Ayarlar (2):', await click('Title', 'Ayarlar'));
  await wait(800);
  const open = await evalG(() => { const t = window.__game.scene.getScene('Title'); return !!t.panel && t.panel.active !== false && !!t.panel.scene; });
  await shot('g1_title_settings');
  console.log(open ? 'PASS AYARLAR' : 'FAIL AYARLAR');
  // Devam'a basınca tam ekrana geçilir: o yeniden boyutlanma karartmayı kesmemeli (tek dokunuşta açılış)
  await click('Title', 'Kapat');
  await wait(800);
  console.log('Devam (yeniden boyutlanmalı):', await click('Title', 'Devam'));
  await wait(120);
  await page.setViewportSize({ width: 1180, height: 800 });
  await wait(3500);
  const opened = await evalG(() => window.__game.scene.isActive('World'));
  console.log(opened ? 'PASS tek dokunuşta açılış' : 'FAIL tek dokunuşta açılış');
};
