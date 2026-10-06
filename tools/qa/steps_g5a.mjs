// Grup 5A (0.8.0) QA: ekran görüntüleri ve ölçümler.
// Çalıştır: npm run build && npx vite preview --port 4173 & ; URL='http://localhost:4173/?qa=1' DPR=1 node tools/qa/shot.mjs g5a
// ONLY=sys,door,apples,herbs,dorn,guard,shorts,east,bridge,dmg,serve,fade,party,weapons ile bölüm seçilebilir.
import { helpers } from './helpers.mjs';

export default async ({ page, wait, shot, evalG }) => {
  const h = helpers(page, wait, evalG);
  const log = (...a) => console.log(...a);
  const only = (process.env.ONLY || '').split(',').filter(Boolean);
  const want = (k) => !only.length || only.includes(k);
  const problems = [];
  const check = (ok, what) => { log(ok ? '  ✓' : '  ✗', what); if (!ok) problems.push(what); };
  const W = (fn, arg) => evalG(fn, arg);
  const setTime = (day, hour, min = 0) => W(([d, hh, mm]) => { window.__G.state.time = { day: d, minute: hh * 60 + mm }; }, [day, hour, min]);
  const tpPoint = async (map, name, dx = 0, dy = 0, facing = 'down') => { await W(([map, name, dx, dy, f]) => { const w = window.__game.scene.getScene('World'); const p = w.pointsOf(map)[name]; w.loadMap(map, p.x + dx, p.y + dy, f); }, [map, name, dx, dy, facing]); await h.frames(8); };
  /** Kamerayı bir dünya karosuna götür (oyuncu yerinde kalır). */
  const look = async (tx, ty) => { await W(([x, y]) => { const w = window.__game.scene.getScene('World'); w.camFollow = false; w.cameras.main.centerOn(x * 32 + 16, y * 32 + 16); }, [tx, ty]); await h.frames(6); };
  const follow = () => W(() => window.__game.scene.getScene('World').followPlayer());
  const hideUi = (v) => W((v) => { const ui = window.__game.scene.getScene('UI'); ui.cameras.main.setVisible(!v); }, v);

  await W(() => {
    const G = window.__G;
    G.newGame();
    G.setFlag('woke');
    for (const k of ['stealth', 'evasion', 'athletics', 'archery', 'first_aid', 'iron_body', 'sword_mastery', 'spear_mastery', 'gathering']) G.state.flags['declined_' + k] = true;
    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 84, y: 62, facing: 'down' });
  });
  await h.until(() => { const w = window.__game.scene.getScene('World'); return w.sys.isActive() && !!w.player && !!w.director; }, null, 20000);
  await h.frames(10);
  await setTime(3, 11);

  const ui = (fn, arg) => W(fn, arg);
  /** Oyuncunun çevresinden büyütülmüş görüntü (kamera yakın, arayüz gizli). */
  const closeShot = async (name, zoom = 4, dy = -20) => {
    await hideUi(true);
    await W(([z, dy]) => { const w = window.__game.scene.getScene('World'); const c = w.cameras.main; w.camFollow = false; c.setZoom(z); c.centerOn(w.player.actor.x, w.player.actor.y + dy); }, [zoom, dy]);
    await h.frames(4);
    await shot(name);
    await W(() => { const w = window.__game.scene.getScene('World'); w.cameras.main.setZoom(window.__Display.worldZoom); w.followPlayer(); });
    await hideUi(false);
  };

  // ================================================================ A1: sistem bildirimi takılmaz
  if (want('sys')) {
    log('== A1 sistem bildirimleri');
    await ui(() => { const u = window.__game.scene.getScene('UI'); u.queueSys({ title: 'SKILL GELİŞTİ', lines: ['Appraisal G- → G'] }); });
    await h.until(() => !!window.__game.scene.getScene('UI').sysShowing, null, 4000);
    await wait(400);
    await ui(() => window.__game.scene.getScene('UI').dismissSys());
    await wait(50);
    await ui(() => window.__game.scene.getScene('UI').queueSys({ title: 'YENİ ANA GÖREV', lines: ['Handa Bertram\'la konuş'] }));
    await wait(600);
    await shot('g5a_a1_second_note');
    const mid = await ui(() => { const u = window.__game.scene.getScene('UI'); return { showing: !!u.sysShowing, closing: u.sysFlow.closing, q: u.sysFlow.queue.length }; });
    log('  kapanırken gelen bildirim:', JSON.stringify(mid));
    await wait(9000);
    const end = await ui(() => { const u = window.__game.scene.getScene('UI'); const panels = u.children.list.filter((o) => o.type === 'Container' && o.depth === 45 && o.active); return { showing: !!u.sysShowing, panels: panels.length, q: u.sysFlow.queue.length }; });
    log('  9 sn sonra:', JSON.stringify(end));
    check(!end.showing && end.panels === 0 && end.q === 0, 'A1: kapanış sırasında gelen bildirim gösterildi ve kendiliğinden kapandı');
    await shot('g5a_a1_cleared');
  }

  // ================================================================ A2: kapıdan hızlı geçiş
  if (want('door')) {
    log('== A2 kapıdan hızlı geçiş');
    await setTime(3, 13);
    await W(() => { const Q = window.__Q; Q.start('m_wounded', true); Q.track('m_wounded'); });
    // kapının 1 karo önünde, görev denetimi çalışmadan hemen kapıdan geç
    await W(() => { const w = window.__game.scene.getScene('World'); const d = w.pointsOf('world').door_healer; w.loadMap('world', d.x, d.y + 1, 'up'); const wp = w.mapData.warps.find((x) => x.to === 'healer'); w.questT = 99; w.tryWarp(wp); });
    await h.until(() => window.__game.scene.getScene('World').mapData.id === 'healer' && !window.__game.scene.getScene('World').transitioning, null, 8000);
    const st = await W(() => { const Q = window.__Q; return { done0: Q.objDone('m_wounded', 0), label: (() => { const d = Q.def('m_wounded'); const s = window.__G.state.quests.quests.m_wounded; const i = d.objectives.findIndex((o, k) => s.progress[k] < (o.count ?? 1)); return d.objectives[i]?.label; })() }; });
    log('  içeride:', JSON.stringify(st));
    check(st.done0, 'A2: kapıdan hızlı geçişte "şifacıya git" amacı tamamlandı');
    await h.run([0], 200, undefined, { start: 2500 });
    await shot('g5a_a2_inside');
    await W(() => { const Q = window.__Q; const G = window.__G; delete G.state.quests.quests.m_wounded; G.state.quests.order = G.state.quests.order.filter((x) => x !== 'm_wounded'); });
  }

  // ================================================================ B1/B3: elmalar ve görev malzemesi
  if (want('apples')) {
    log('== B1 elmalar, B3 görev malzemesi');
    await setTime(5, 10);
    await W(() => { const G = window.__G; G.p.inventory = {}; G.state.gathered = {}; window.__Q.start('sq_baker_apples', true); window.__Q.track('sq_baker_apples'); });
    await tpPoint('world', 'plaza');
    const trees = await W(() => { const w = window.__game.scene.getScene('World'); return w.mapData.gathers.filter((g) => g.item === 'apple').map((g) => ({ id: g.id, x: g.x, y: g.y })); });
    log('  elma ağaçları:', trees.map((t) => `${t.id}@${t.x},${t.y}`).join(' '));
    for (let k = 0; k < 2; k++) {
      // ok bugün elması olan en yakın ağacı göstermeli
      const r = await W(() => { const w = window.__game.scene.getScene('World'); const a = w.player.actor; const t = w.questTargetPx(); const av = w.mapData.gathers.filter((g) => g.item === 'apple' && (window.__G.state.gathered[g.id] ?? 0) !== window.__G.state.time.day); av.sort((p, q) => Math.hypot(p.x * 32 - a.x, p.y * 32 - a.y) - Math.hypot(q.x * 32 - a.x, q.y * 32 - a.y)); return { arrow: t ? [Math.round((t.x - 16) / 32), Math.round((t.y - 16) / 32)] : null, nearest: av[0] ? [av[0].x, av[0].y, av[0].id] : null }; });
      log(`  ok → ${JSON.stringify(r.arrow)} · en yakın elmalı ağaç ${JSON.stringify(r.nearest)}`);
      check(!!r.arrow && !!r.nearest && r.arrow[0] === r.nearest[0] && r.arrow[1] === r.nearest[1], `ok elması olan en yakın ağaçta (${k + 1}. ağaç)`);
      await W((id) => { const w = window.__game.scene.getScene('World'); const g = w.mapData.gathers.find((x) => x.id === id); w.loadMap('world', g.x, g.y + 1, 'up'); }, r.nearest[2]);
      await h.frames(5);
      if (k === 0) await closeShot('g5a_b1_apple_tree_glow', 3, -40);
      await W((id) => { const w = window.__game.scene.getScene('World'); const g = w.mapData.gathers.find((x) => x.id === id); w.gather(g); }, r.nearest[2]);
      await h.frames(5);
    }
    const inv = await W(() => ({ apple: window.__G.p.inventory.apple ?? 0, day: window.__G.state.time.day, prog: window.__G.state.quests.quests.sq_baker_apples.progress[0] }));
    log('  aynı gün:', JSON.stringify(inv));
    check(inv.apple >= 6, `B1: bir günde iki ağaçtan ${inv.apple} elma (≥6)`);
    // yeme denemesi: envanterden ve hızlı yemekten
    const eat = await W(() => { const w = window.__game.scene.getScene('World'); const before = window.__G.p.inventory.apple; const a = w.consume('apple'); w.eatQuick(); return { consume: a, after: window.__G.p.inventory.apple, before, quick: w.quickFoodId() }; });
    log('  yeme:', JSON.stringify(eat));
    check(!eat.consume && eat.after === eat.before, 'B3: görev elması envanterden ve hızlı yemekle yenmedi ("Görev için lazım")');
    await shot('g5a_b3_quest_item_warning');
  }

  // ================================================================ B4: şifalı otlar
  if (want('herbs')) {
    log('== B4 şifalı otlar');
    await setTime(6, 11);
    await W(() => { window.__G.state.gathered = {}; });
    await tpPoint('world', 'forest_edge', 0, 2);
    await h.frames(6);
    const r = await W(() => { const w = window.__game.scene.getScene('World'); const f = w.r.atlasFrame ?? null; void f; const herbs = w.r.propImages.filter((p) => p.p.key === 'herb_plant'); const img = herbs[0]?.img; return { n: herbs.length, w: img?.displayWidth, h: img?.displayHeight, glows: w.gatherGlows.size }; });
    log('  ot:', JSON.stringify(r));
    check(r.w >= 24 && r.h >= 15, `otun görüntü boyutu ${r.w}×${r.h} (eskiden 14×3)`);
    check(r.glows > 0, `yakındaki toplanabilirler parlıyor (${r.glows})`);
    await closeShot('g5a_b4_herbs_glow', 3, -10);
  }

  // ================================================================ B10: kahverengi şort
  if (want('shorts')) {
    log('== B10 kahverengi şort');
    await W(() => { const G = window.__G; G.p.equipment = { pants: 'torn_shorts' }; window.__game.scene.getScene('World').player.refreshLayers(); });
    await tpPoint('world', 'plaza');
    for (const d of ['down', 'left', 'up', 'right']) {
      await W((d) => window.__game.scene.getScene('World').player.actor.face(d), d);
      await closeShot(`g5a_b10_shorts_${d}`, 6, -18);
    }
  }

  // ================================================================ B5: Dorn
  if (want('dorn')) {
    log('== B5 Dorn');
    await setTime(7, 10);
    await W(() => { const G = window.__G; G.state.flags.dorn_steal = 0; G.p.inventory.rat_tail = 6; window.__Q.start('g1_rats', true); window.__Q.set('g1_rats', 0, 6); });
    // ahırın yanında, Dorn'un yolunda çit/bina olan bir yer
    await W(() => { const w = window.__game.scene.getScene('World'); const p = w.pointsOf('world').barn_yard; w.loadMap('world', p.x - 2, p.y + 2, 'right'); });
    await h.frames(6);
    let samples = 0, stillMax = 0, still = 0, last = null;
    await W(() => { const w = window.__game.scene.getScene('World'); w.director.scene(async () => w.director.ch2.dornScene()); });
    const t0 = Date.now();
    const res = await h.run([1], 500, async () => {
      const p = await W(() => { const w = window.__game.scene.getScene('World'); const n = w.npc('dorn'); return n ? { x: n.x, y: n.y, anim: n.actor.anim, t: w.playClock } : null; });
      if (!p) return;
      samples++;
      if (last && p.anim === 'walk') { if (Math.hypot(p.x - last.x, p.y - last.y) < 1) still += p.t - last.t; else still = 0; stillMax = Math.max(stillMax, still); }
      last = p;
      if (samples === 3) await shot('g5a_b5_dorn_walk');
    });
    log(`  sahne ${((Date.now() - t0) / 1000).toFixed(1)} sn (gerçek) sürdü, örnek ${samples}, yürürken en uzun takılma ${stillMax.toFixed(2)} sn (oyun)`);
    check(!res.cut && stillMax < 1.0, 'B5: Dorn duvara takılmadan yürüdü, sahne bitti');
  }

  // ================================================================ B6: muhafızı izleme
  if (want('guard')) {
    log('== B6 muhafız');
    await setTime(8, 10);
    await W(() => { const Q = window.__Q; Q.start('m_theft', true); Q.track('m_theft'); Q.set('m_theft', 0, 4); });
    await tpPoint('world', 'plaza');
    const gid = await W(() => { const w = window.__game.scene.getScene('World'); const g = w.npc('guard_hob') ?? w.npc('guard_wil'); const p = w.player.actor; if (g) { p.setPosition(g.x + 40, g.y); p.body2.reset(p.x, p.y); } return g?.def.id; });
    log('  muhafız:', gid);
    await W((gid) => { const w = window.__game.scene.getScene('World'); w.director.talk(w.npc(gid)); }, gid);
    let walkSamples = 0, idleMoving = 0, facingBack = 0, shotDone = false;
    await h.run([3], 600, async () => {
      const r = await W((gid) => { const w = window.__game.scene.getScene('World'); const n = w.npc(gid); if (!n) return null; const v = n.actor.body2.velocity; const sp = Math.hypot(v.x, v.y); const d = n.actor.dir; const dirOk = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? d === 'right' : d === 'left') : (v.y > 0 ? d === 'down' : d === 'up'); return { sp, anim: n.actor.anim, dirOk }; }, gid);
      if (!r || r.sp < 20) return;
      walkSamples++;
      if (r.anim !== 'walk') idleMoving++;
      if (!r.dirOk) facingBack++;
      if (walkSamples === 4 && !shotDone) { shotDone = true; await shot('g5a_b6_guard_walk'); }
    });
    log(`  yürürken örnek ${walkSamples}: idle'da kayma ${idleMoving}, yön ters ${facingBack}`);
    check(walkSamples > 3 && idleMoving === 0 && facingBack <= 1, 'B6: muhafız yürüme animasyonuyla, önüne bakarak yürüdü');
  }

  // ================================================================ B13: servis mini oyunu
  if (want('serve')) {
    log('== B13 servis');
    const launch = async () => {
      await W(() => { const w = window.__game.scene.getScene('World'); window.__serveDone = null; w.scene.launch('Minigame', { kind: 'serve', day: 1, done: (p) => (window.__serveDone = p) }); w.scene.bringToTop('Minigame'); });
      await h.until(() => window.__game.scene.getScene('Minigame').running, null, 10000);
    };
    await launch();
    await wait(800);
    const info = await W(() => { const m = window.__game.scene.getScene('Minigame'); return { goal: m.serve.cfg.goal, music: window.__SOUND?.current?.() ?? null }; });
    log('  1. gün hedef:', info.goal);
    await shot('g5a_b13_serve_goal');
    // kaybetme: bir siparişin süresi dolsun
    await W(() => { const m = window.__game.scene.getScene('Minigame'); const t = m.serve.tables[0]; m.serve.seat(t); t.patience = 0.01; });
    await h.until(() => !!window.__game.scene.getScene('Minigame').loseScreen, null, 6000);
    await wait(500);
    await shot('g5a_b13_serve_lose');
    check(await W(() => !!window.__game.scene.getScene('Minigame').loseScreen), 'B13: sipariş geç kalınca "Kaybettin" ekranı');
    // tekrar dene
    await W(() => { const m = window.__game.scene.getScene('Minigame'); const b = m.children.list.find((o) => o.label?.text === 'Tekrar dene' || o.list?.some?.((x) => x.text === 'Tekrar dene')); const ev = { stopPropagation() {} }; b.emit('pointerdown', {}, 0, 0, ev); b.emit('pointerup', {}, 0, 0, ev); });
    await h.until(() => { const m = window.__game.scene.getScene('Minigame'); return m.sys.isActive() && m.running && !m.loseScreen; }, null, 10000);
    check(true, 'B13: "Tekrar dene" oyunu baştan başlattı');
    // kirli tabak süresi
    await W(() => { const m = window.__game.scene.getScene('Minigame'); const t = m.serve.tables[1]; m.serve.seat(t); t.state = 'eating'; t.eatT = 0.01; });
    await h.until(() => window.__game.scene.getScene('Minigame').serve.tables[1].state === 'dirty', null, 5000);
    await W(() => { const m = window.__game.scene.getScene('Minigame'); m.serve.tables[1].plateT = 0.01; });
    await h.until(() => !!window.__game.scene.getScene('Minigame').loseScreen, null, 6000);
    const reason = await W(() => window.__game.scene.getScene('Minigame').serve.lost);
    check(reason === 'plate', 'B13: kirli tabak zamanında bulaşığa konmayınca kaybedildi: ' + reason);
    await shot('g5a_b13_serve_lose_plate');
    // kazanma
    await W(() => { const m = window.__game.scene.getScene('Minigame'); const b = m.children.list.find((o) => o.list?.some?.((x) => x.text === 'Tekrar dene')); const ev = { stopPropagation() {} }; b.emit('pointerdown', {}, 0, 0, ev); b.emit('pointerup', {}, 0, 0, ev); });
    await h.until(() => { const m = window.__game.scene.getScene('Minigame'); return m.sys.isActive() && m.running && !m.loseScreen; }, null, 10000);
    await W(() => { const m = window.__game.scene.getScene('Minigame'); m.serve.served = m.serve.cfg.goal; m.serve.platesCleared = m.serve.cfg.goal; });
    await h.frames(4);
    await shot('g5a_b13_serve_win');
    await h.until(() => window.__serveDone !== null, null, 8000);
    const perf = await W(() => window.__serveDone);
    check(perf !== null, 'B13: hedefe ulaşınca kazanıldı (perf ' + perf + ')');
  }

  // ================================================================ B14: siyah ekran kenarları
  if (want('fade')) {
    log('== B14 karartma kenarları');
    const sizes = [[1280, 854], [1600, 720], [1920, 1080], [2340, 1080]];
    // perde açıkken boyut değişimi: eskiden perde ilk boyutta kalıyordu
    await page.setViewportSize({ width: sizes[0][0], height: sizes[0][1] });
    await h.frames(4);
    await W(() => { const u = window.__game.scene.getScene('UI'); u.curtain(1, 10); u.__qaText = u.overlayText('Uyuyorsun...'); });
    await wait(400);
    for (const [vw, vh] of sizes) {
      await page.setViewportSize({ width: vw, height: vh });
      await wait(700);
      await h.frames(4);
      await shot(`g5a_b14_curtain_${vw}x${vh}`);
    }
    await W(() => { const u = window.__game.scene.getScene('UI'); u.curtain(0, 10); u.__qaText?.destroy(); });
    // kamera karartması (uyku/harita geçişi)
    await W(() => window.__game.scene.getScene('World').cameras.main.fadeOut(10, 0, 0, 0));
    await wait(300);
    await shot('g5a_b14_camfade_2340x1080');
    await W(() => window.__game.scene.getScene('World').cameras.main.fadeIn(10));
    await page.setViewportSize({ width: 1280, height: 854 });
    await wait(700);
  }

  // ================================================================ C4: hasar sayılarının okunurluğu
  if (want('dmg') || want('dmgfont')) {
    log('== C4 hasar sayıları');
    await tpPoint('world', 'plaza');
    await hideUi(true);
    const variants = process.env.DMG_VARIANTS === '1';
    await W((variants) => {
      const w = window.__game.scene.getScene('World');
      const a = w.player.actor;
      const z = w.cameras.main.zoom;
      const nums = ['0,3', '0,5', '0,6', '0,8', '0,9'];
      const rows = variants
        ? [
            ['eski', { fontFamily: 'Pixelify, monospace', fontSize: '13px', fontStyle: 'bold', strokeThickness: 3 }],
            ['B', { fontFamily: 'Pixelify, monospace', fontSize: '16px', fontStyle: 'normal', strokeThickness: 2 }],
            ['C', { fontFamily: 'AlegreyaSans, sans-serif', fontSize: '15px', fontStyle: 'bold', strokeThickness: 2 }],
            ['D', { fontFamily: 'Pixelify, monospace', fontSize: '16px', fontStyle: 'bold', strokeThickness: 2 }],
            ['E', { fontFamily: 'AlegreyaSans, sans-serif', fontSize: '16px', fontStyle: 'bold', strokeThickness: 3 }],
          ]
        : [['eski', { fontFamily: 'Pixelify, monospace', fontSize: '13px', fontStyle: 'bold', strokeThickness: 3 }], ['yeni', null]];
      w.__qaNums = [];
      rows.forEach(([name, st], r) => {
        const y = a.y - 90 + r * 26;
        w.__qaNums.push(w.add.text(a.x - 110, y, name, { fontFamily: 'AlegreyaSans', fontSize: '10px', color: '#fff' }).setOrigin(0, 1).setDepth(960000).setResolution(z));
        nums.forEach((n, i) => {
          let t;
          if (st) {
            t = w.add.text(a.x - 70 + i * 34, y, n, { color: '#ffffff', stroke: '#2a1a10', ...st }).setOrigin(0.5, 1).setDepth(960000);
            t.setResolution(z);
          } else {
            w.fx.number(a.x - 70 + i * 34, y, n, 'dmg');
            t = w.children.list[w.children.list.length - 1];
            w.tweens.killTweensOf(t);
            t.setPosition(a.x - 70 + i * 34, y).setAlpha(1);
          }
          w.__qaNums.push(t);
        });
      });
    }, variants);
    await W(() => { const w = window.__game.scene.getScene('World'); w.camFollow = false; w.cameras.main.centerOn(w.player.actor.x - 20, w.player.actor.y - 60); });
    await h.frames(4);
    await shot(variants ? 'g5a_c4_dmg_variants' : 'g5a_c4_dmg_numbers');
    await W(() => { const w = window.__game.scene.getScene('World'); for (const t of w.__qaNums) t.destroy(); w.followPlayer(); });
    await hideUi(false);
  }

  // ================================================================ C6: yoldaş ölçütleri (değirmen bodrumu)
  if (want('party')) {
    log('== C6 yoldaşlar (değirmen bodrumu, 4 Dev Fare)');
    const runs = Number(process.env.PARTY_RUNS || 2);
    const setup = async () => {
      await W(() => {
        const G = window.__G;
        G.p.equipment.weapon = 'wooden_club';
        G.p.hp = 999;
        const w = window.__game.scene.getScene('World');
        w.loadMap('mill_cellar', 4, 8, 'up');
        w.player.refreshLayers();
        G.p.hp = window.__G.d.maxHp;
        for (const id of ['vera', 'lina']) if (!w.companion(id)) w.addCompanion(id);
        for (const c of w.companions) { c.hp = c.maxHp; c.fights = true; c.cooldownT = 0; c.teleportNear(); }
        const p = w.pointsOf('mill_cellar').rats;
        const es = w.spawnAt('giant_rat', p.x, p.y, 4, 2, 'qa');
        for (const e of es) e.becomeAware(true);
        window.__kills = { joseph: 0, comp: 0 };
        if (!w.__qaWrapped) {
          w.__qaWrapped = true;
          const ch = w.companionHit.bind(w), he = w.hitEnemy.bind(w);
          w.companionHit = (c, e, d, m) => { const was = e.alive && e.c.hp > 0; ch(c, e, d, m); if (was && e.c.hp <= 0) window.__kills.comp++; };
          w.hitEnemy = (e, o) => { const was = e.alive && e.c.hp > 0; he(e, o); if (was && e.c.hp <= 0) window.__kills.joseph++; };
        }
        w.__qaT0 = w.playClock;
      });
      await h.run([], 50, undefined, { start: 800 });
      await W(() => { const w = window.__game.scene.getScene('World'); w.__qaT0 = w.playClock; });
      await h.frames(3);
    };
    const alive = () => W(() => window.__game.scene.getScene('World').enemies.filter((e) => e.alive && e.spawnId.startsWith('qa')).length);
    // ölçülen şey öldürme payı: Joseph ölmesin (ölüm sahnesi dünyayı dondurur)
    const godMode = () => W(() => { const G = window.__G; const w = window.__game.scene.getScene('World'); G.p.hp = window.__G.d.maxHp; w.player.invulnT = 999; });
    await page.setViewportSize({ width: 800, height: 500 });
    // 1) Joseph hiç vurmaz (köşede durur)
    const idleT = [];
    for (let r = 0; r < runs; r++) {
      await setup();
      const t0 = Date.now();
      while ((await alive()) > 0 && Date.now() - t0 < 900000) { await godMode(); await wait(250); }
      const t = await W(() => { const w = window.__game.scene.getScene('World'); return w.playClock - w.__qaT0; });
      idleT.push(t);
      log(`  Joseph vurmadan: ${t.toFixed(1)} sn (oyun) · öldürme ${JSON.stringify(await W(() => window.__kills))}`);
    }
    const idleAvg = idleT.reduce((a, b) => a + b, 0) / idleT.length;
    check(idleAvg >= 15, `C6: Joseph hiç vurmazsa bodrum ~15 sn'den uzun sürer (ort. ${idleAvg.toFixed(1)} sn)`);
    // 2) Joseph aktif savaşır (en yakın fareye yürür ve vurur)
    let jk = 0, ck = 0;
    for (let r = 0; r < runs; r++) {
      await setup();
      const t0 = Date.now();
      let shotDone = false;
      while ((await alive()) > 0 && Date.now() - t0 < 900000) {
        await godMode();
        await W(() => {
          const w = window.__game.scene.getScene('World'); const I = window.__IN; const a = w.player.actor;
          const es = w.enemies.filter((e) => e.alive && e.spawnId.startsWith('qa'));
          es.sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y));
          const e = es[0]; if (!e) return;
          const d = Math.hypot(e.x - a.x, e.y - a.y);
          if (d > 34) { I.touchMove = true; I.touchX = (e.x - a.x) / d; I.touchY = (e.y - a.y) / d; }
          else { I.touchMove = false; I.touchX = 0; I.touchY = 0; I.moveX = 0; I.moveY = 0; I.aim = { x: e.x, y: e.y - 10 }; I.press('attack'); }
        });
        if (!shotDone) { shotDone = true; await wait(1500); await shot('g5a_c6_cellar_fight'); }
        await wait(150);
      }
      await W(() => { const I = window.__IN; I.touchMove = false; I.touchX = 0; I.touchY = 0; });
      const k = await W(() => window.__kills);
      jk += k.joseph; ck += k.comp;
      log(`  Joseph aktif: öldürme ${JSON.stringify(k)}`);
    }
    const share = jk / Math.max(1, jk + ck);
    check(share >= 0.4, `C6: Joseph aktif savaşınca öldürmelerin %${Math.round(share * 100)}'i Joseph'in (≥%40)`);
    await W(() => { const w = window.__game.scene.getScene('World'); for (const id of ['vera', 'lina']) w.removeCompanion(id); w.player.invulnT = 0; });
    await page.setViewportSize({ width: 1280, height: 854 });
  }

  // ================================================================ D: silahların yeni kareleri (oyun içinde)
  if (want('weapons')) {
    log('== D silahlar (oyun içi)');
    await tpPoint('world', 'plaza');
    const pose = async (item, dir, anim, frame, name) => {
      await W(([item, dir, anim, frame]) => {
        const w = window.__game.scene.getScene('World'); const pl = w.player; const a = pl.actor;
        window.__G.p.equipment.weapon = item; pl.refreshLayers(); pl.setSheathed(false);
        pl.combatT = 0; a.weaponMode = 'hand'; a.face(dir);
        a.play(anim, { loop: anim === 'walk', restart: true });
        if (frame !== null) a.setManualFrame(frame);
        // donmuş dünyada holdStill yürüme pozunu idle'a çevirir: çekim boyunca devre dışı
        pl.__hold = pl.__hold ?? pl.holdStill; pl.holdStill = () => {};
        w.freeze('qa');
      }, [item, dir, anim, frame]);
      await h.frames(2);
      await closeShot(name, 6, -22);
      await W(() => { const w = window.__game.scene.getScene('World'); w.player.holdStill = w.player.__hold; w.unfreeze('qa'); });
    };
    for (const d of ['down', 'left', 'up', 'right']) await pose('iron_spear', d, 'walk', 3, `g5a_d2_spear_walk_${d}`);
    for (const d of ['down', 'left', 'right']) await pose('short_bow', d, 'walk', 3, `g5a_d2_bow_walk_${d}`);
    await pose('hunting_knife', 'up', 'thrust', 5, 'g5a_d3_dagger_thrust_up');
    await pose('goblin_cleaver', 'down', 'hurt', 1, 'g5a_d4_cleaver_hurt');
    await pose('rusty_shortsword', 'left', 'slash', 1, 'g5a_d1_sword_pullback_left');
    await pose('cracked_stick', 'right', 'walk', 0, 'g5a_d7_cracked_stick');
    const vis = await W(() => { const a = window.__game.scene.getScene('World').player.actor; return a.layers.filter((l) => l.visible).map((l) => l.texture.key); });
    log('  son pozda görünen katmanlar:', vis.join(' '));
  }

  // ================================================================ doğu kenarı (B11)
  if (want('east')) {
    log('== Doğu kenarı');
    await tpPoint('world', 'checkpoint', -2, 0, 'right');
    await hideUi(true);
    await look(150, 57);
    await shot('g5a_east_gate');
    await look(150, 40);
    await shot('g5a_east_wall_n');
    await look(150, 80);
    await shot('g5a_east_wall_s');
    const r = await W(() => { const w = window.__game.scene.getScene('World'); return { knights: w.npcs.filter((n) => /knight|gate_guard/.test(n.def.id) && Math.hypot(n.x / 32 - 150, n.y / 32 - 57) < 8).map((n) => n.def.id), city: w.r.propImages.some((p) => p.p.key === '__city') }; });
    log('  geçitteki şövalyeler:', r.knights.join(', '));
    check(r.knights.length >= 4, `geçitte en az 4 şövalye (${r.knights.length})`);
    check(!r.city, 'yolun üstündeki saray figürü yok');
    await follow();
    await hideUi(false);
  }

  // ================================================================ köprü yolu (B2)
  if (want('bridge')) {
    log('== Köprü yolu');
    await setTime(3, 7);
    await tpPoint('world', 'bridge', 3, 0, 'right');
    await hideUi(true);
    await look(64, 60);
    await shot('g5a_bridge_path');
    const r = await W(() => { const w = window.__game.scene.getScene('World'); const trees = w.r.propImages.filter((p) => /^tree_/.test(p.p.key) && Math.abs(p.p.x / 32 - 64) < 2.5 && p.p.y / 32 > 59 && p.p.y / 32 < 64.5).map((p) => p.p.key + '@' + Math.round(p.p.x / 32) + ',' + Math.round(p.p.y / 32)); return { trees, apple3: w.mapData.gathers.some((g) => g.id === 'apple3'), nim: (() => { const n = w.npc('vagrant'); return n ? [Math.round(n.x / 32), Math.round(n.y / 32)] : null; })() }; });
    log('  Nim:', JSON.stringify(r.nim), 'yakın ağaçlar:', r.trees.join(' '));
    check(!r.apple3 && r.trees.length === 0, 'köprü yolunda (64,62) ağaç ve toplama noktası yok');
    await follow();
    await hideUi(false);
  }

  log(problems.length ? `SORUNLAR (${problems.length}):\n - ${problems.join('\n - ')}` : 'Hepsi tamam.');
};
