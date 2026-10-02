export default async ({ page, wait, shot, evalG }) => {
  // Yeni oyun → prolog
  await evalG(() => { const g = window.__game; g.scene.getScene('Title').scene.start('Prologue'); window.__G.newGame(); });
  await wait(4000); await shot('02_prologue_died');
  await wait(4500); await shot('03_battlefield');
  await wait(6000); await shot('04_after_battle');
  await page.mouse.click(600, 400); await wait(4000); await shot('05_void');
  for (let i = 0; i < 6; i++) { await page.mouse.click(600, 400); await wait(1500); }
  await shot('06_status');
  await wait(9000);
  await shot('07_world_wake');
};
