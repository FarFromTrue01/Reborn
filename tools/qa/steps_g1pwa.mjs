// Grup 1: PWA — ilk kurulumda yenileme yok, çekirdek önbellek küçük, açılış görselleri önbelleğe kopyalanır,
// çevrimdışı yeniden açılış çalışır. (vite preview ile: npm run build && npx vite preview --port 4173)
export default async ({ page, wait, shot, evalG }) => {
  let navs = 0;
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs++; });
  const ready = await evalG(() => navigator.serviceWorker.ready.then(() => true));
  await wait(6000);
  const st = await evalG(async () => {
    const keys = (await caches.keys()).filter((k) => k.startsWith('elonth-'));
    const c = await caches.open(keys[0]);
    const reqs = await c.keys();
    return { caches: keys, entries: reqs.length, controlled: !!navigator.serviceWorker.controller, sample: reqs.slice(0, 3).map((r) => r.url.split('/').slice(-2).join('/')) };
  });
  console.log('SW', JSON.stringify({ ready, navsAfterInstall: navs, ...st }));
  console.log(navs === 0 ? 'PASS ilk kurulumda yenileme yok' : 'FAIL ilk kurulumda yenileme: ' + navs);
  await page.context().setOffline(true);
  await page.reload();
  const ok = await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 30000 }).then(() => true).catch(() => false);
  await wait(1500);
  const missing = await evalG(() => performance.getEntriesByType('resource').filter((e) => e.responseStatus >= 400 || e.transferSize === 0 && e.decodedBodySize === 0 && e.name.includes('/assets/')).length).catch(() => -1);
  await shot('g1_pwa_offline');
  console.log(ok ? 'PASS çevrimdışı açılış' : 'FAIL çevrimdışı açılış', '| boş yanıt:', missing);
  await page.context().setOffline(false);
};
