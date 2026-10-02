// Awakening (Divine skill seçimi), level atlama, Sistem Teklifi, gizli keşif ve kaydet/yükle testi.
import { helpers } from './helpers.mjs';
export default async ({ page, wait, shot, evalG }) => {
  const h = helpers(page, wait, evalG);
  await evalG(() => { window.__G.newGame(); window.__G.setFlag('woke'); window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 70, y: 52, facing: 'down' }); });
  await wait(3000);
  // panelChoice kartına gerçek tıklama (arayüz birimi → CSS pikseli)
  const clickCard = async (i, n) => {
    const pt = await evalG(([i, n]) => {
      const D = window.__game.scene.getScene('UI').sys.game.registry.get('display') || null;
      const ui = window.__game.scene.getScene('UI');
      const z = ui.cameras.main.zoom, dpr = window.devicePixelRatio || 1;
      const W = ui.cameras.main.width / z, H = ui.cameras.main.height / z;
      const cw = Math.min(300, (W - 80) / n - 20), ch = 330;
      const total = n * cw + (n - 1) * 20;
      const x = (W - total) / 2 + i * (cw + 20) + cw / 2;
      const y = (H - ch) / 2 + 20 + ch - 34;
      return { x: x * z / dpr, y: y * z / dpr };
    }, [i, n]);
    await page.mouse.click(pt.x, pt.y);
  };
  // 1) Divine EXP → awakening (Divine Level 3)
  await evalG(() => window.__R.gainDivineExp(500 + 1000 + 1500 + 10, 'QA'));
  let s;
  for (let i = 0; i < 60; i++) {
    s = await evalG(() => ({ dlg: !!window.__game.scene.getScene('UI').dlgState, lv: window.__G.state.divine.level, sk: window.__G.state.divine.skills, panel: window.__game.scene.getScene('UI').children.list.some((o) => o.depth === 150) }));
    if (s.panel) break;
    if (s.dlg) await h.adv();
    await wait(400);
  }
  console.log('awakening', JSON.stringify(s));
  await wait(900);
  await shot('60_awakening_offer');
  await clickCard(1, 3);
  await wait(1500);
  await shot('61_awakening_done');
  console.log('divine skills', JSON.stringify(await evalG(() => window.__G.state.divine.skills)));
  // 2) Level atlama (EXP) → SP; Status menüsünde Sistem Teklifi
  await evalG(() => { window.__R.gainExp(100 + 200 + 300 + 400); });
  await wait(2500);
  console.log('level', JSON.stringify(await evalG(() => ({ lv: window.__G.p.level, sp: window.__G.p.sp, pts: window.__G.p.statPoints }))));
  await evalG(() => window.__game.scene.getScene('UI').openMenu('status'));
  await wait(1200);
  await shot('62_status_sp');
  await evalG(() => { window.__game.scene.getScene('Menu').systemOffer(); });
  await wait(1200);
  await shot('63_offer_rarity');
  await clickCard(1, 3); // Nadir (3 SP)
  await wait(1200);
  await shot('64_offer_skills');
  await clickCard(0, 3);
  await wait(1500);
  await shot('65_offer_learned');
  console.log('skills', JSON.stringify(await evalG(() => ({ sk: window.__G.p.skills, sp: window.__G.p.sp }))));
  await evalG(() => window.__game.scene.getScene('UI').closeMenu());
  await wait(800);
  // 3) Gizli keşif: aynı hafta ikinci skill → ertelenmeli
  await evalG(() => { window.__G.state.counters.gathered = 20; window.__R.checkDiscoveries(); });
  for (let i = 0; i < 30; i++) {
    const d = await evalG(() => !!window.__game.scene.getScene('UI').dlgState);
    if (d) { if (i === 3) await shot('66_discovery'); await h.adv(); }
    await wait(400);
  }
  console.log('discovery', JSON.stringify(await evalG(() => ({ pend: window.__G.state.pendingDiscoveries, fl: Object.keys(window.__G.state.flags).filter((k) => k.startsWith('postponed') || k.startsWith('declined')), sk: window.__G.p.skills.map((s) => s.id) }))));
  // 4) Kaydet / yükle
  const before = await evalG(() => { window.__G.save('manual1'); return JSON.stringify({ p: window.__G.p, d: window.__G.state.divine }); });
  await evalG(() => { window.__G.p.level = 0; window.__G.p.skills = []; window.__G.state.divine.skills = []; });
  const ok = await evalG(() => window.__G.load('manual1'));
  const after = await evalG(() => JSON.stringify({ p: window.__G.p, d: window.__G.state.divine }));
  console.log('save/load', ok, before === after ? 'AYNI' : 'FARKLI');
  // Skill butonları HUD'da
  await wait(1000);
  await shot('67_hud_skills');
};
