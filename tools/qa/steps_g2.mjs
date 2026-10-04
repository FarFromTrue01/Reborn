// Grup 2 (0.4.0) elle test: yumruk/sopa ile fare, tavşan kovalama, saldırı iptali ve kilitleme, koşu döngüsü.
// Çalıştır: npm run build && npx vite preview --port 4173 & ; node tools/qa/shot.mjs g2
export default async ({ page, wait, shot, evalG }) => {
  const W = () => 'window.__game.scene.getScene("World")';
  const log = (...a) => console.log(...a);
  await evalG(() => { window.__G.newGame(); window.__G.setFlag('woke'); window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 34, y: 64, facing: 'right' }); });
  await wait(3500);
  log('HUD', await evalG(() => window.__game.scene.getScene('UI').hudTexts.hp.text));

  // ---------------------------------------------------------------- 1) yumrukla fare
  const fightRat = async (label) => {
    const r = await evalG(() => {
      const w = window.__game.scene.getScene('World');
      const pl = w.player.actor;
      const e = w.enemies.filter((e) => e.alive && e.def.id === 'rat').sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y))[0];
      if (!e) return null;
      pl.setPosition(e.x - 26, e.y);
      pl.body2.reset(e.x - 26, e.y);
      e.becomeAware(false);
      window.__qaRat = e;
      return { hp: e.c.hp, max: e.d.maxHp };
    });
    let hits = 0;
    const dmgs = [];
    for (let i = 0; i < 12; i++) {
      const before = await evalG(() => window.__qaRat.c.hp);
      await evalG(() => { const w = window.__game.scene.getScene('World'); const e = window.__qaRat; w.player.actor.setPosition(e.x - 26, e.y); w.player.actor.face('right'); window.__IN.press('attack'); });
      await wait(450);
      const s = await evalG(() => ({ hp: window.__qaRat.c.hp, alive: window.__qaRat.alive, jhp: window.__G.p.hp }));
      if (s.hp !== before) { hits++; dmgs.push(+(before - s.hp).toFixed(2)); }
      if (!s.alive) break;
    }
    log(label, JSON.stringify(r), 'isabet:', hits, 'hasarlar:', dmgs.join(' '), 'Joseph HP:', await evalG(() => window.__G.p.hp));
    return hits;
  };
  await fightRat('YUMRUK fare');
  await shot('g2_01_fist_rat');
  await fightRat('YUMRUK fare 2');

  // ---------------------------------------------------------------- 2) Bertram'ın sopası
  await evalG(() => {
    const R = window.__G;
    const p = R.p;
    p.inventory.cracked_stick = 1;
    delete p.inventory.cracked_stick;
    p.equipment.weapon = 'cracked_stick';
    R.invalidate();
    p.hp = window.__G.d.maxHp;
  });
  log('silah', await evalG(() => `${window.__G.d.weaponName} ${JSON.stringify(window.__G.d.weaponDmg)} güç ${window.__G.d.divPower}`));
  await fightRat('SOPA fare');
  await fightRat('SOPA fare 2');
  await shot('g2_02_stick_rat');

  // ---------------------------------------------------------------- 3) tavşan kovalama
  const rab = await evalG(() => {
    const w = window.__game.scene.getScene('World');
    w.loadMap('world', 18, 58, 'down');
    return true;
  });
  await wait(2500);
  const rabInfo = await evalG(() => {
    const w = window.__game.scene.getScene('World');
    let e = w.enemies.find((e) => e.alive && e.def.id === 'rabbit');
    if (!e) e = w.spawnAt('rabbit', 18, 60, 1, 1, 'qa')[0];
    window.__qaRab = e;
    window.__G.p.hp = window.__G.d.maxHp;
    return { x: Math.round(e.x / 32), y: Math.round(e.y / 32), st: e.state };
  });
  log('tavşan', JSON.stringify(rabInfo));
  // Her karede tavşanın 2 karo arkasında dur (oyuncu kovalıyor); oyun saatiyle ölç.
  await evalG(() => {
    const w = window.__game.scene.getScene('World');
    const e = window.__qaRab;
    window.__qaChase = { t0: w.playClock, cornerAt: null, hitAt: null, hp0: window.__G.p.hp, states: {} };
    window.__qaChaseFn = () => {
      const q = window.__qaChase;
      const pl = w.player.actor;
      q.states[e.state] = 1;
      if (e.corner.cornered && q.cornerAt === null) q.cornerAt = +(w.playClock - q.t0).toFixed(2);
      if (window.__G.p.hp < q.hp0 && q.hitAt === null) q.hitAt = +(w.playClock - q.t0).toFixed(2);
      if (e.corner.cornered) return; // döndü: artık o bize geliyor
      const dx = pl.x - e.x, dy = pl.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      pl.setPosition(e.x + (dx / d) * 64, e.y + (dy / d) * 64);
      pl.body2.reset(pl.x, pl.y);
    };
    w.events.on('postupdate', window.__qaChaseFn);
  });
  for (let i = 0; i < 400; i++) {
    const q = await evalG(() => window.__qaChase);
    if (q.cornerAt !== null && q.hitAt !== null) break;
    if (i === 40) await shot('g2_03_rabbit_chase');
    await wait(250);
  }
  await shot('g2_04_rabbit_cornered');
  const q = await evalG(() => { const w = window.__game.scene.getScene('World'); w.events.off('postupdate', window.__qaChaseFn); return { ...window.__qaChase, hp: window.__G.p.hp }; });
  log('TAVŞAN köşeye sıkıştı (oyun sn):', q.cornerAt, '· Joseph\'e ilk tekme (oyun sn):', q.hitAt, '· HP', q.hp0, '→', q.hp, '· durumlar:', Object.keys(q.states).join(','));
  // uzaklaş → yine ürkek
  await evalG(() => { const w = window.__game.scene.getScene('World'); const e = window.__qaRab; const pl = w.player.actor; pl.setPosition(e.x + 8 * 32, e.y); pl.body2.reset(pl.x, pl.y); });
  let calm = null;
  for (let i = 0; i < 100; i++) {
    await evalG(() => { const w = window.__game.scene.getScene('World'); const e = window.__qaRab; const pl = w.player.actor; if (Math.hypot(pl.x - e.x, pl.y - e.y) < 7 * 32) { pl.setPosition(e.x + 8 * 32, e.y); pl.body2.reset(pl.x, pl.y); } });
    const c = await evalG(() => window.__qaRab.corner.cornered);
    if (!c) { calm = i / 10; break; }
    await wait(100);
  }
  log('TAVŞAN sakinleşti (~sn):', calm, 'davranış:', await evalG(() => window.__qaRab.behavior));

  // ---------------------------------------------------------------- 4) saldırı iptali ve kilitleme
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.loadMap('world', 36, 18, 'down'); });
  await wait(2500);
  await evalG(() => {
    const w = window.__game.scene.getScene('World');
    for (const e of w.enemies) if (e.def.id !== 'goblin') e.setState('dead');
    const g = w.spawnAt('goblin', 36, 20, 1, 0, 'qa')[0];
    g.c.hp = 999; // dayanıklı hedef
    window.__qaGob = g;
    const p = window.__G.p;
    p.hp = 999;
    const pl = w.player.actor;
    pl.setPosition(g.x - 30, g.y);
    pl.body2.reset(pl.x, pl.y);
    g.becomeAware(false);
  });
  // a) tek vuruş hazırlıktaki saldırıyı keser
  let interrupted = false;
  for (let i = 0; i < 80 && !interrupted; i++) {
    const st = await evalG(() => window.__qaGob.state);
    if (st === 'windup') {
      const r = await evalG(() => { const w = window.__game.scene.getScene('World'); const e = window.__qaGob; w.hitEnemy(e, { dir: new window.Phaser.Math.Vector2(1, 0), physical: true }); return e.state; });
      interrupted = r === 'hurt';
      log('İPTAL: windup sırasında normal vuruş →', r);
      await shot('g2_05_interrupt');
    }
    await wait(50);
  }
  // b) arka arkaya vurarak kilitleme: her 0,15 sn vur, düşman yine de saldırabilmeli
  const strikes0 = await evalG(() => window.__qaGob.attackCount);
  const lockT0 = await evalG(() => window.__game.scene.getScene('World').playClock);
  let struck = 0, cancels = 0;
  await evalG(() => { const e = window.__qaGob; e._qaStrike = 0; const orig = e.strike.bind(e); e.strike = () => { e._qaStrike++; orig(); }; });
  for (let i = 0; i < 60; i++) {
    const r = await evalG(() => { const w = window.__game.scene.getScene('World'); const e = window.__qaGob; const pl = w.player.actor; pl.setPosition(e.x - 30, e.y); pl.body2.reset(pl.x, pl.y); const before = e.state; w.hitEnemy(e, { dir: new window.Phaser.Math.Vector2(1, 0), physical: true }); return { before, after: e.state }; });
    if (r.before === 'windup' && r.after === 'hurt') cancels++;
    await wait(150);
  }
  struck = await evalG(() => window.__qaGob._qaStrike);
  const lockGame = (await evalG(() => window.__game.scene.getScene('World').playClock)) - lockT0;
  log('KİLİTLEME oyun sn:', lockGame.toFixed(1), '· sürekli vuruş → iptal:', cancels, 'düşmanın tamamladığı saldırı:', struck, 'windup sayısı:', (await evalG(() => window.__qaGob.attackCount)) - strikes0);
  // c) boss: normal vuruş kesmez, ağır keser
  await evalG(() => { const w = window.__game.scene.getScene('World'); window.__qaGob.setState('dead'); const b = w.spawnAt('goblin_chief', 36, 20, 1, 0, 'qaboss')[0]; b.c.hp = 999; window.__qaBoss = b; b.becomeAware(false); });
  let bossNormal = null, bossHeavy = null;
  for (let i = 0; i < 600 && (bossNormal === null || bossHeavy === null); i++) {
    const st = await evalG(() => window.__qaBoss.state);
    if (st === 'windup') {
      const heavy = bossNormal !== null;
      const since = await evalG(() => window.__qaBoss.sinceInterrupt);
      if (since >= 1.2) {
        const r = await evalG((heavy) => { const w = window.__game.scene.getScene('World'); const e = window.__qaBoss; const pl = w.player.actor; pl.setPosition(e.x - 30, e.y); pl.body2.reset(pl.x, pl.y); w.hitEnemy(e, { dir: new window.Phaser.Math.Vector2(1, 0), physical: true, heavy }); return e.state; }, heavy);
        if (!heavy) bossNormal = r; else bossHeavy = r;
      }
    }
    await wait(40);
  }
  log('BOSS: normal vuruş sonrası durum', bossNormal, '· ağır vuruş sonrası', bossHeavy, '· boss durumu', await evalG(() => window.__qaBoss.state));

  // ---------------------------------------------------------------- 5) koşu döngüsü (joystick sonda)
  await evalG(() => { const w = window.__game.scene.getScene('World'); window.__qaBoss.setState('dead'); w.loadMap('world', 100, 60, 'right'); });
  await wait(2500);
  await evalG(() => { const p = window.__G.p; p.hp = window.__G.d.maxHp; p.stamina = 3; const I = window.__IN; I.touchMove = true; I.moveX = 1; I.moveY = 0; });
  const seq = [];
  let prev = null;
  for (let i = 0; i < 500; i++) {
    const s = await evalG(() => { const I = window.__IN; I.touchMove = true; I.moveX = (Math.floor(Date.now() / 3000) % 2) ? 1 : -1; I.moveY = 0; const w = window.__game.scene.getScene('World'); return { run: w.player.running, st: Math.round(window.__G.p.stamina), max: window.__G.d.maxStamina, lock: w.player.runLock.exhausted }; });
    const tag = s.run ? 'KOŞ' : s.lock ? 'yürü(kilit)' : 'yürü';
    if (tag !== prev) { seq.push(`${tag}@${s.st}/${s.max}`); prev = tag; }
    if (seq.length >= 6) break;
    if (i === 30) await shot('g2_06_run_locked');
    await wait(80);
  }
  await evalG(() => { const I = window.__IN; I.touchMove = false; I.moveX = 0; });
  log('KOŞU döngüsü (joystick hep sonda):', seq.join(' → '));
};
