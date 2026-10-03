// 0.2.0 prolog: kaza sesi, ÖLDÜN., beyaz boşluk, içeriğe göre boyutlanan Status paneli; sallanma yok.
export default async ({ page, wait, shot, evalG }) => {
  await evalG(() => { window.__G.newGame(); window.__game.scene.getScene('Title').scene.start('Prologue'); });
  let shakes = 0;
  await wait(500);
  await evalG(() => { const s = window.__game.scene.getScene('Prologue'); const orig = s.cameras.main.shake.bind(s.cameras.main); s.cameras.main.shake = (...a) => { window.__shakes = (window.__shakes || 0) + 1; return orig(...a); }; });
  for (let i = 0; i < 140; i++) {
    const st = await evalG(() => { const s = window.__game.scene.getScene('Prologue'); const all = []; const walk = (l) => { for (const o of l) { if (o.type === 'Text') all.push(o.text); if (o.list) walk(o.list); } }; walk(s.children.list); const t = all.join(' | '); return { active: window.__game.scene.isActive('Prologue'), t }; });
    if (!st.active) break;
    if (i % 10 === 0) console.log(i, st.t.slice(0, 120));
    if (/ÖLDÜN\.$|ÖLDÜN\. /.test(st.t) && !page.__died) { page.__died = true; await shot('p_01_oldun'); }
    if (/Lastik/.test(st.t) && !page.__th) { page.__th = true; await wait(1500); await shot('p_02_thought'); }
    if (/INVENTORY/.test(st.t) && !page.__st) { page.__st = true; await wait(1500); await shot('p_03_status'); await evalG(() => window.__game.scene.getScene('Prologue').advance?.()); }
    await wait(500);
  }
  shakes = await evalG(() => window.__shakes || 0);
  console.log('shakes during prologue:', shakes);
  await wait(3000);
  console.log('scene', await evalG(() => window.__game.scene.getScenes(true).map((s) => s.sys.settings.key).join(',')));
};
