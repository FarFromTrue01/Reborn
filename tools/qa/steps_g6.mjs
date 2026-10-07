// Grup 6 (0.10.0) uçtan uca QA: yeni oyundan gerçek etkileşimle (klavye, etkileşim tuşu, merdiven, yatak, mini oyun)
// ilk lonca görevlerine kadar; ok/merdiven/yatak (B1, A7), uyku öğreticisi (B3), trait çarkı (B19), uyanış (B20),
// Tokluk, Konuşmalar "Daha fazla göster" (A1), ansiklopedi, harita işaretleri, dövüş geri bildirimi.
// Çalıştır: npm run build && npx vite preview --port 4173 & ;
//   URL='http://localhost:4173/?qa=1' DPR=1 OUT=screens/g6 node tools/qa/shot.mjs g6
// ONLY=prologue,inn,shift,attic,wage,harvest,guild,history,codex,map,combat,hud ile bölüm seçilebilir.
import { helpers } from './helpers.mjs';

export default async ({ page, wait, shot, evalG }) => {
  const h = helpers(page, wait, evalG);
  const log = (...a) => console.log(...a);
  const only = (process.env.ONLY || '').split(',').filter(Boolean);
  const want = (k) => !only.length || only.includes(k);
  const problems = [];
  const check = (ok, what) => { log(ok ? '  ✓' : '  ✗', what); if (!ok) problems.push(what); };
  const W = (fn, arg) => evalG(fn, arg);

  /** UI biriminden ekran pikseline (DPR=1). */
  const uiToScreen = async (x, y) => W(([x, y]) => { const D = window.__Display; return [x * D.uiZoom / D.dpr, y * D.uiZoom / D.dpr]; }, [x, y]);
  const clickUi = async (x, y) => { const [sx, sy] = await uiToScreen(x, y); await page.mouse.click(sx, sy); };
  const tapCenter = async () => { const vp = page.viewportSize(); await page.mouse.click(vp.width / 2, vp.height / 2); };
  /** Sahnedeki metinlerden birini bul (UI koordinatı). */
  const findText = (sceneKey, re) => W(([k, re]) => {
    const sc = window.__game.scene.getScene(k);
    if (!sc?.sys.isActive()) return null;
    const out = [];
    const walk = (list, ox, oy) => {
      for (const o of list) {
        if (o.type === 'Text' && new RegExp(re).test(o.text) && o.visible !== false) out.push([o.x + ox, o.y + oy, o.text]);
        if (o.list) walk(o.list, ox + o.x, oy + o.y);
      }
    };
    walk(sc.children.list, 0, 0);
    return out[0] ?? null;
  }, [sceneKey, re]);
  /** Tuşa bas-bırak. */
  const key = async (k, ms = 80) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); };
  /** Takip edilen görevin oku (dünya pikseli) ve oyuncu. */
  const arrow = () => W(() => {
    const w = window.__game.scene.getScene('World');
    const t = w.questTargetPx();
    const a = w.player.actor;
    return { map: w.mapData.id, t, px: a.x, py: a.y, tx: Math.round(a.x / 32), ty: Math.round(a.y / 32) };
  });
  /** Klavyeyle oka doğru yürü (yol bulma yok: oyuncu gibi oku izler). Hedefe varınca ya da harita değişince durur. */
  const followArrow = async (maxMs = 20000, stopMap = null) => {
    const t0 = Date.now();
    const startMap = (await arrow()).map;
    const held = new Set();
    const setKeys = async (want) => {
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
        if (want.has(k) && !held.has(k)) { await page.keyboard.down(k); held.add(k); }
        if (!want.has(k) && held.has(k)) { await page.keyboard.up(k); held.delete(k); }
      }
    };
    let arrived = false;
    while (Date.now() - t0 < maxMs) {
      const a = await arrow();
      if (a.map !== startMap && (!stopMap || a.map === stopMap)) break;
      if (!a.t) break;
      const dx = a.t.x - a.px, dy = a.t.y - (a.py - 10);
      if (Math.hypot(dx, dy) < Math.max(18, a.t.r * 0.7)) { arrived = true; break; }
      const want = new Set();
      if (Math.abs(dx) > 8) want.add(dx > 0 ? 'KeyD' : 'KeyA');
      if (Math.abs(dy) > 8) want.add(dy > 0 ? 'KeyS' : 'KeyW');
      await setKeys(want);
      await wait(120);
    }
    await setKeys(new Set());
    return arrived;
  };
  const mainsInfo = () => W(() => {
    const Q = window.__Q, G = window.__G;
    const id = G.state.quests.tracked;
    return { tracked: id, wait: id ? Q.wait(id) : null, guides: id ? Q.guides(id).map((g) => g.label) : [] };
  });

  // ================================================================ 1) prolog: trait çarkı, Status
  if (want('prologue') || !only.length) {
    log('== Prolog: trait çarkı (B19)');
    await W(() => { const t = window.__game.scene.getScene('Title'); t.newGame(false); });
    await h.until(() => window.__game.scene.isActive('Prologue'), null, 20000);
    // yazıları dokunarak ilerlet, çark başlığı gelene kadar
    for (let i = 0; i < 80; i++) {
      if (await findText('Prologue', 'TRAIT BELİRLENİYOR')) break;
      await tapCenter();
      await wait(500);
    }
    await wait(1200);
    check(!!(await findText('Prologue', 'TRAIT BELİRLENİYOR')), 'çark ekranı: "TRAIT BELİRLENİYOR"');
    check(!!(await findText('Prologue', '%0,0001')), 'olasılık tablosunda X %0,0001');
    await shot('g6_b19_wheel_table');
    const btn = await findText('Prologue', 'TRAIT ÇEVİR');
    check(!!btn, '"TRAIT ÇEVİR" düğmesi');
    if (btn) await clickUi(btn[0], btn[1]);
    await wait(1600);
    await shot('g6_b19_wheel_spin');
    for (let i = 0; i < 40 && !(await findText('Prologue', 'X — DIVINE PALADIN')); i++) await wait(300);
    await wait(1500);
    check(!!(await findText('Prologue', 'X — DIVINE PALADIN')), 'çark Divine Paladin\'de durdu');
    check(!!(await findText('Prologue', 'kayıtlı değil')), 'sistem satırı');
    await shot('g6_b19_wheel_result');
    await tapCenter();
    // Status
    await wait(2500);
    await shot('g6_b19_status_after');
    for (let i = 0; i < 40; i++) {
      if (await W(() => window.__game.scene.isActive('World'))) break;
      await tapCenter();
      await wait(700);
    }
    check(await h.until(() => { const w = window.__game.scene.getScene('World'); return w.sys.isActive() && !!w.player; }, null, 30000), 'dünyaya geçildi');
  }

  // ================================================================ 2) uyanış ve ilk adım (B20), han yolu (A7.8a)
  if (want('prologue') || !only.length) {
    log('== Uyanış (B20)');
    await h.run([], 400, null, { start: 8000 });
    await shot('g6_a78a_hint_bottom');
    const sat0 = await W(() => window.__G.state.satiety);
    check(sat0 <= 40, `yeni oyun Tokluk 40 (şu an ${sat0})`);
    // ilk yürüme denemesi → tökezleme
    await page.keyboard.down('KeyD');
    await wait(400);
    await page.keyboard.up('KeyD');
    const started = await h.until(() => !!window.__G.state.flags.dp_awaken, null, 6000);
    check(started, 'ilk adımda uyanış sahnesi başladı');
    await h.until(() => !!window.__game.scene.getScene('UI').dlgState, null, 10000);
    await wait(400);
    const pose = await W(() => { const a = window.__game.scene.getScene('World').player.actor; return { angle: a.angle, sy: a.scaleY, type: a.type }; });
    log('  tökezleme pozu', JSON.stringify(pose));
    check(Math.abs(pose.angle) > 4 && pose.sy < 0.95, 'Joseph diz çöktü (eğik ve basık)');
    await shot('g6_b20_stumble');
    // satırı tamamla ve kapat (ilk dokunuş daktiloyu bitirir)
    for (let i = 0; i < 6 && (await W(() => !!window.__game.scene.getScene('UI').dlgState)); i++) { await h.adv(); await wait(250); }
    let card = null;
    for (let i = 0; i < 40 && !card; i++) { card = await findText('UI', 'DIVINE PALADIN — X'); if (!card) await wait(100); }
    check(!!card, 'uyanış kartı: DIVINE PALADIN — X');
    await wait(450);
    await shot('g6_b20_card_aura');
    await h.run();
    check(!!(await W(() => window.__G.state.flags.dp_awaken)), 'dp_awaken bayrağı');
  }

  // ================================================================ 3) han: Appraisal amacı (A7.9), Bertram
  if (want('inn') || !only.length) {
    log('== Han');
    // köy yolu uzun: hanın önüne ışınlan, kapıya klavyeyle gir
    const door = await W(() => { const w = window.__game.scene.getScene('World'); const d = w.mapData.warps.find((x) => x.to === 'inn'); return d && { x: d.x + Math.floor(d.w / 2), y: d.y + d.h }; });
    log('  han kapısı', JSON.stringify(door));
    await h.tp('world', door.x, door.y + 1, 'up');
    await h.frames(5);
    await page.keyboard.down('KeyW');
    await h.until(() => window.__game.scene.getScene('World').mapData.id === 'inn', null, 8000);
    await page.keyboard.up('KeyW');
    // sahne Appraisal adımına kadar
    for (let i = 0; i < 120; i++) {
      const s = await h.S();
      if (s.appr) break;
      if (s.choice) await h.pick(0);
      else if (s.dlg) await h.adv();
      await wait(180);
    }
    const mi = await mainsInfo();
    const lab = await W(() => { const Q = window.__Q; const d = Q.def('m_inn'); const st = window.__G.state.quests.quests.m_inn; return st?.status === 'active' ? d.objectives[1].label : null; });
    check(lab === 'Vera\'yı Appraisal ile incele', `Appraisal öğreticisinde amaç görünüyor: ${lab} (takip ${mi.tracked})`);
    await shot('g6_a79_appraise_objective');
    await key('KeyQ');
    let apprShot = false;
    await h.run([1, 0], 400, async (s) => {
      if (await W(() => !!window.__game.scene.getScene('UI').appraisalWin)) {
        if (!apprShot) { await wait(900); await shot('g6_inn_appraise_vera'); apprShot = true; }
        // panelin dışına (karartmaya) dokun: kapanır
        await page.mouse.click(1240, 830);
        await wait(300);
        return;
      }
      if (s.choice) log('  seçim', JSON.stringify(await W(() => window.__game.scene.getScene('UI').choiceObjs.map((b) => b.labelText))));
    });
    log('  S', JSON.stringify(await h.S()), JSON.stringify(await W(() => Object.fromEntries(Object.entries(window.__G.state.quests.quests).map(([k, v]) => [k, v.status])))));
    const st = await W(() => window.__G.state.quests.quests.m_bertram?.status);
    check(st === 'active', 'Bertram\'ın işi başladı (m_bertram)');
    const prog = await W(() => { const d = window.__Q.def('m_bertram'); return d.objectives[0].count; });
    check(prog === 2, 'vardiya sayısı 2');
    // A7.7: kamera, HUD panelinin altına oyuncuyu saklamıyor
    await h.tp('inn', 5, 3, 'down');
    await h.frames(20);
    await shot('g6_a77_inn_5_3');
    await h.tp('inn', 2, 5, 'down');
    await h.frames(20);
    await shot('g6_a77_inn_2_5');
    const cam = await W(() => { const w = window.__game.scene.getScene('World'); const c = w.cameras.main; const a = w.player.actor; return { sx: (a.x - c.worldView.x) * c.zoom / window.__Display.uiZoom, sy: (a.y - c.worldView.y) * c.zoom / window.__Display.uiZoom }; });
    check(cam.sx > 316 || cam.sy > 330, `oyuncu görev panelinin altında değil (ekran ${Math.round(cam.sx)}, ${Math.round(cam.sy)})`);
  }

  // ================================================================ 4) 1. vardiya: servis mini oyunu (gerçek), çöp kutusu
  /** Servis mini oyununu oyna: masaların siparişlerini tezgâhtan al, götür, tabakları bulaşığa koy. */
  const playServe = async (shotName) => {
    await h.until(() => window.__game.scene.isActive('Minigame'), null, 30000);
    let shotTaken = false, trashTried = false;
    for (let i = 0; i < 600; i++) {
      const st = await W(() => {
        const m = window.__game.scene.getScene('Minigame');
        const g = m?.serve;
        if (!m?.sys.isActive() || !g) return { done: !m?.sys.isActive() };
        return {
          running: m.running, target: !!g.target, carry: [...g.carry], lose: !!m.loseScreen,
          tables: g.tables.map((t) => ({ state: t.state, order: t.order })),
        };
      });
      if (st.done) break;
      if (!st.running) {
        if (st.lose) {
          // kaybettin ekranı: "Tekrar dene" düğmesine tıkla
          log('  servis kaybedildi, tekrar');
          const b = await findText('Minigame', '^Tekrar dene$');
          if (b) await clickUi(b[0], b[1]);
          await wait(800);
          continue;
        }
        // geri sayım ya da kazandın ekranı
        await wait(400);
        await wait(400);
        continue;
      }
      if (st.target) { await wait(120); continue; }
      if (!shotTaken && i > 15) { await shot(shotName); shotTaken = true; }
      await W(([carry, trash]) => {
        const g = window.__game.scene.getScene('Minigame').serve;
        const tables = g.tables;
        // B12: bir kez yanlış yiyecek alıp çöpe at
        if (trash === 'pick') { g.goTo(g.stockPos.bread.x, g.stockPos.bread.y, () => g.pick('bread')); return; }
        if (trash === 'drop') { g.goTo(g.trash.x, g.trash.y, () => g.discard()); return; }
        const plates = carry.filter((c) => c === 'plate').length;
        const dirty = tables.find((t) => t.state === 'dirty');
        if (plates && (!dirty || plates >= g.cfg.tray)) { g.goTo(g.sink.x, g.sink.y, () => g.dropPlates()); return; }
        if (dirty && !carry.some((c) => c !== 'plate')) { g.goTo(dirty.x, dirty.y + 34, () => g.serveTable(dirty)); return; }
        const want = tables.filter((t) => t.state === 'waiting' && t.order);
        const deliver = want.find((t) => carry.includes(t.order));
        if (deliver) { g.goTo(deliver.x, deliver.y + 34, () => g.serveTable(deliver)); return; }
        const need = want.find((t) => !carry.includes(t.order));
        if (need && carry.length < g.cfg.tray && !plates) { const p = g.stockPos[need.order]; g.goTo(p.x, p.y, () => g.pick(need.order)); return; }
        if (carry.length && !plates && !want.length) { g.goTo(g.trash.x, g.trash.y, () => g.discard()); }
      }, [st.carry, !trashTried ? 'pick' : trashTried === 'picked' ? 'drop' : null]);
      if (!trashTried) trashTried = 'picked';
      else if (trashTried === 'picked') trashTried = true;
      await wait(150);
    }
  };

  const doShift = async (n) => {
    log(`== ${n}. vardiya`);
    await h.tp('inn', 4, 6, 'up');
    await h.frames(5);
    await W(() => { const w = window.__game.scene.getScene('World'); w.director.talk(w.npc('bertram')); });
    // "Çalışmaya hazırım" seçeneği
    let lastLine = '';
    for (let i = 0; i < 200; i++) {
      const s = await h.S();
      if (await W(() => window.__game.scene.isActive('Minigame'))) break;
      if (s.choice) { log('  seçim', JSON.stringify(await W(() => window.__game.scene.getScene('UI').choiceObjs.map((b) => b.labelText)))); await h.pick(0); }
      else if (s.dlg) {
        const line = await W(() => window.__game.scene.getScene('UI').dlgState?.full ?? '');
        if (line !== lastLine) { log('  ·', line.slice(0, 90)); lastLine = line; }
        await h.adv();
      }
      await wait(200);
    }
    await playServe(`g6_b12_serve_day${n}`);
    await h.run();
    const t = await W(() => window.__G.state.time.minute / 60);
    log(`  vardiya bitti, saat ${t.toFixed(2)}`);
  };

  if (want('shift') || !only.length) {
    await W(() => { window.__G.state.time = { day: window.__G.state.time.day, minute: 7 * 60 }; });
    const satBefore = await W(() => window.__G.state.satiety);
    await doShift(1);
    const sat = await W(() => window.__G.state.satiety);
    check(sat > satBefore - 20, `vardiya sonu güveç: Tokluk ${satBefore} → ${sat}`);
    // B1: ok merdivene, alt görev "Yukarı çık ve uyu"
    const mi = await mainsInfo();
    log('  takip', mi.tracked, mi.wait, mi.guides);
    check(mi.tracked === 'm_bertram' && !!mi.wait && /yatakta/.test(mi.wait), `m_bertram bekleme metni uykuyu söylüyor: ${mi.wait}`);
    check(mi.guides.some((g) => /Yukarı çık ve uyu/.test(g)), 'alt görev: Yukarı çık ve uyu');
    const a = await arrow();
    check(!!a.t && Math.abs(a.t.x / 32 - 13.5) < 1 && Math.abs(a.t.y / 32 - 3.5) < 1, `handa ok merdivene (${a.t && (a.t.x / 32).toFixed(1)}, ${a.t && (a.t.y / 32).toFixed(1)})`);
    await shot('g6_b1_arrow_ladder');
  }

  // ================================================================ 5) tavan arası: merdiven (klavye), yatak (E), uyku
  if (want('attic') || !only.length) {
    log('== Merdiven ve yatak (B1, A7.2, A7.10)');
    await h.run([], 50, null, { start: 200 });
    const reached = await followArrow(25000, 'inn_attic');
    // merdiven karosunda yukarı bas: geçiş
    if ((await arrow()).map !== 'inn_attic') {
      await page.keyboard.down('KeyW');
      await h.until(() => window.__game.scene.getScene('World').mapData.id === 'inn_attic', null, 6000);
      await page.keyboard.up('KeyW');
    }
    check((await arrow()).map === 'inn_attic', `merdivenden tavan arasına çıkıldı (oku izleyerek: ${reached})`);
    await h.frames(10);
    const a2 = await arrow();
    check(!!a2.t, 'tavan arasında ok var (yatağa)');
    await shot('g6_b1_attic_arrow_bed');
    await followArrow(15000);
    // (5,4)'ten de "Uyu"
    await h.tp('inn_attic', 5, 4, 'right');
    await h.frames(5);
    const lab = await W(() => window.__game.scene.getScene('World').findInteractable()?.label);
    check(lab === 'Uyu', `(5,4)'ten yatak etkileşimi: ${lab}`);
    await h.tp('inn_attic', 5, 5, 'up');
    await h.frames(5);
    const lab2 = await W(() => window.__game.scene.getScene('World').findInteractable()?.label);
    check(lab2 === 'Uyu', `(5,5) yukarı bakarken: ${lab2}`);
    await shot('g6_a710_bed_reach');
    await key('KeyE');
    await h.until(() => window.__game.scene.getScene('UI').choiceObjs.length > 0, null, 5000);
    const opts = await W(() => window.__game.scene.getScene('UI').choiceObjs.map((b) => b.labelText ?? b.list?.find?.((o) => o.type === 'Text')?.text ?? ''));
    log('  uyku seçenekleri', opts);
    await shot('g6_b3_sleep_menu');
    await h.run([0]);
    const tm = await W(() => window.__G.state.time);
    check(tm.minute >= 6 * 60 && tm.minute < 6 * 60 + 5, `06:00'da uyanıldı (${tm.day}. gün ${(tm.minute / 60).toFixed(2)})`);
    const mi = await mainsInfo();
    check(!mi.wait && !mi.guides.length, 'uyanınca bekleme ve uyku alt görevi kapandı');
    const a3 = await arrow();
    check(!!a3.t, 'sabah tavan arasında ok aşağı merdivene');
    await shot('g6_a72_attic_morning_arrow');
  }

  // ================================================================ 6) 2. vardiya, ücret gecesi, Haldor beklemesi + uyku öğreticisi (B3)
  if (want('wage') || !only.length) {
    await followArrow(10000, 'inn');
    if ((await arrow()).map !== 'inn') { await page.keyboard.down('KeyW'); await h.until(() => window.__game.scene.getScene('World').mapData.id === 'inn', null, 5000); await page.keyboard.up('KeyW'); }
    await doShift(2);
    const done = await W(() => window.__G.state.quests.quests.m_bertram?.status);
    check(done === 'done', 'ücret gecesi: m_bertram bitti');
    const money = await W(() => window.__G.p.wallet.bronze + window.__G.p.wallet.silver * 100);
    check(money >= 50, `50 bronz alındı (${money})`);
    const mi = await mainsInfo();
    log('  takip', mi.tracked, mi.wait, mi.guides);
    check(mi.tracked === 'm_harvest' && /Haldor .*tarlada olur/.test(mi.wait ?? ''), `Haldor beklemesi: ${mi.wait}`);
    check(mi.guides.some((g) => /Görev saatine kadar uyu/.test(g)), 'uyku öğreticisi alt görevi (B3)');
    await shot('g6_b3_sleep_tutorial_hud');
    const a = await arrow();
    check(!!a.t, 'ok merdivene (yatağa yönlendirme)');
    await h.tp('inn_attic', 6, 4, 'right');
    await h.frames(5);
    await key('KeyE');
    await h.until(() => window.__game.scene.getScene('UI').choiceObjs.length > 0, null, 5000);
    await h.run([1]);
    const flags = await W(() => window.__G.state.flags.tut_sleep);
    check(!!flags, 'öğretici: "Görev saatine kadar uyu" seçildi, tamamlandı');
    const tm = await W(() => window.__G.state.time.minute / 60);
    check(tm >= 6 && tm < 6.1, `06:00 (${tm.toFixed(2)})`);
  }

  // ================================================================ 7) hasat (mini oyun), kayıt, silah, pano ve G görevleri
  if (want('harvest') || !only.length) {
    log('== Hasat');
    await W(() => { const w = window.__game.scene.getScene('World'); w.loadMap('world', 127, 40, 'down'); });
    await h.frames(10);
    await W(() => { const w = window.__game.scene.getScene('World'); const n = w.npc('haldor'); if (n) w.director.talk(n); });
    for (let i = 0; i < 200; i++) {
      if (await W(() => window.__game.scene.isActive('Minigame'))) break;
      const s = await h.S();
      if (s.choice) await h.pick(0); else if (s.dlg) await h.adv();
      await wait(200);
    }
    if (await W(() => window.__game.scene.isActive('Minigame'))) {
      await shot('g6_harvest_minigame');
      // hasat: tarlayı biçmek için tıkla/sürükle — süre dolana kadar başakları kes
      // zamanlama oyunu: başsız tarayıcı yavaş (3–6 FPS); işaretçi bölgedeyken basışı sayfa içinde, karede yap
      await W(() => {
        const m = window.__game.scene.getScene('Minigame');
        m.events.on('postupdate', () => { if (m.running && Math.abs(m.marker - m.zoneC) < m.zoneW / 2 * 0.7) m.press(true); });
      });
      await h.until(() => !window.__game.scene.isActive('Minigame'), null, 90000);
    }
    await h.run();
    const bread = await W(() => window.__G.p.inventory.bread ?? 0);
    check(bread >= 1, 'Haldor ekmek verdi (B13)');
  }

  if (want('guild') || !only.length) {
    log('== Lonca, silah, pano');
    await W(() => { const G = window.__G; if ((G.p.wallet.bronze + G.p.wallet.silver * 100) < 100) G.p.wallet.bronze += 100; });
    await h.tp('guild', 6, 7, 'up');
    await h.run();
    await W(() => { const w = window.__game.scene.getScene('World'); w.director.talk(w.npc('celeste')); });
    await h.run([0, 0, 0]);
    check(await W(() => !!window.__G.state.flags.guild_registered), 'loncaya kayıt');
    await shot('g6_b21_stone');
    await h.tp('inn', 4, 6, 'up');
    await h.run();
    await W(() => { const w = window.__game.scene.getScene('World'); w.director.talk(w.npc('bertram')); });
    await h.run([0]);
    await h.tp('guild', 6, 7, 'up');
    await h.run([0, 0]);
    await W(() => { const w = window.__game.scene.getScene('World'); const n = w.npc('celeste'); if (n) w.director.talk(n); });
    await h.run([1, 0]);
    const g1 = await W(() => window.__G.state.quests.quests.g1_rats?.status);
    check(g1 === 'active', `G görevleri alındı (${g1})`);
    // A7.5: m_grank takip edilirken ok alt görevin güncel hedefinde
    await W(() => window.__Q.track('m_grank'));
    const t = await W(() => { const r = window.__Q.target(); return r && { id: r.id, t: r.t }; });
    log('  m_grank hedefi', JSON.stringify(t));
    check(!!t && t.id !== 'm_grank', 'G- Rütbe oku alt görevin hedefine yönelik');
    await shot('g6_a75_grank_target');
  }

  // ================================================================ 8) Konuşmalar: Daha fazla göster (A1)
  if (want('history') || !only.length) {
    log('== Konuşmalar (A1)');
    await W(() => { const G = window.__G; for (let i = 0; i < 160; i++) G.state.history.push({ speaker: 'QA', text: `Satır ${i}`, kind: 'say' }); });
    await W(() => window.__game.scene.getScene('UI').openMenu('history'));
    await h.until(() => window.__game.scene.isActive('Menu'), null, 5000);
    await h.frames(10);
    const before = await W(() => window.__game.scene.getScene('Menu').histShown);
    // listeyi fareyle yukarı sürükle (gerçek kaydırma), sonra düğmeye tıkla
    const listRect = await W(() => { const m = window.__game.scene.getScene('Menu'); const D = window.__Display; return { x: (m.cx + 200) * D.uiZoom / D.dpr, y: (m.py + 24 + 300) * D.uiZoom / D.dpr }; });
    /** Listeyi fareyle yukarı sürükle (gerçek kaydırma) — düğme listenin en üstünde. */
    const scrollTop = async (n) => {
      for (let k = 0; k < n; k++) {
        await page.mouse.move(listRect.x, listRect.y - 150);
        await page.mouse.down();
        await page.mouse.move(listRect.x, listRect.y + 250, { steps: 8 });
        await page.mouse.up();
        await wait(200);
      }
    };
    await scrollTop(6);
    const more = await findText('Menu', 'Daha fazla göster');
    if (more) {
      const xy = await W(() => { const m = window.__game.scene.getScene('Menu'); return null; });
      void xy;
    }
    const btn = await W(() => {
      const m = window.__game.scene.getScene('Menu');
      let found = null;
      const walk = (list, ox, oy) => { for (const o of list) { if (o.type === 'Container' && o.labelText && /Daha fazla/.test(o.labelText)) found = [o.x + ox, o.y + oy]; if (o.list) walk(o.list, ox + o.x, oy + o.y); } };
      walk(m.children.list, 0, 0);
      return found;
    });
    log('  düğme', btn);
    if (btn) { await clickUi(btn[0], btn[1]); await wait(400); }
    const after = await W(() => window.__game.scene.getScene('Menu').histShown);
    check(after === before + 40, `"Daha fazla göster" çalıştı (${before} → ${after})`);
    await shot('g6_a1_history_more');
    // görünüm yerinde kaldı (düğme yukarıda, görünmüyor): yeniden yukarı kaydır, sonra bas
    await scrollTop(10);
    const btn2 = await W(() => {
      const m = window.__game.scene.getScene('Menu');
      let found = null;
      const walk = (list, ox, oy) => { for (const o of list) { if (o.type === 'Container' && o.labelText && /Daha fazla/.test(o.labelText)) found = [o.x + ox, o.y + oy]; if (o.list) walk(o.list, ox + o.x, oy + o.y); } };
      walk(m.children.list, 0, 0);
      return found;
    });
    if (btn2) { await clickUi(btn2[0], btn2[1]); await wait(400); }
    const after2 = await W(() => window.__game.scene.getScene('Menu').histShown);
    check(after2 === after + 40, `peş peşe ikinci basış (${after} → ${after2})`);
    await W(() => window.__game.scene.getScene('Menu').close());
    await h.frames(5);
  }

  // ================================================================ 9) ansiklopedi, harita, Status
  if (want('codex') || !only.length) {
    log('== Ansiklopedi ve harita');
    await W(() => window.__game.scene.getScene('UI').openMenu('codex'));
    await h.until(() => window.__game.scene.isActive('Menu'), null, 5000);
    await h.frames(10);
    await shot('g6_b15_codex_monsters');
    await W(() => { const m = window.__game.scene.getScene('Menu'); m.children.getByName?.('x'); });
    const people = await findText('Menu', 'Karakterler');
    if (people) { await clickUi(people[0] + 0, people[1]); await wait(500); }
    await shot('g6_b15_codex_people');
    await W(() => { const m = window.__game.scene.getScene('Menu'); m.tab = 'map'; m.render(); });
    await h.frames(10);
    await shot('g6_b16_map_markers');
    await W(() => { const m = window.__game.scene.getScene('Menu'); m.tab = 'status'; m.render(); });
    await h.frames(10);
    await shot('g6_b9_status_stats');
    await W(() => window.__game.scene.getScene('Menu').close());
    await h.frames(5);
  }

  // ================================================================ 10) dövüş: fare, sopa ile 2 vuruş; geri bildirim (B5, B23)
  if (want('combat') || !only.length) {
    log('== Dövüş');
    await W(() => { const G = window.__G; G.p.equipment.weapon = 'cracked_stick'; G.invalidate(); window.__game.scene.getScene('World').player.refreshLayers(); });
    // gerçek bir doğma bölgesinin yanında dövüş (haritada yaratık işareti görünsün; B16)
    await h.tp('world', 60, 60, 'right');
    const sp = await W(() => { const w = window.__game.scene.getScene('World'); const m = w.mapData; const s = (m.spawns ?? []).find((x) => x.monster === 'slime') ?? m.spawns[0]; return s && { x: s.x, y: s.y, m: s.monster }; });
    log('  doğma bölgesi', JSON.stringify(sp));
    await W(([x, y]) => { const w = window.__game.scene.getScene('World'); w.loadMap('world', x - 4, y, 'right'); }, [sp.x, sp.y]);
    await h.frames(10);
    const hits = await W(([x, y]) => {
      const w = window.__game.scene.getScene('World');
      const [e] = w.spawnAt('rat', x - 2, y, 1, 0, 'qa');
      e.aware = true;
      const dmg = [];
      while (e.alive && e.c.hp > 0 && dmg.length < 10) { const b = e.c.hp; w.hitEnemy(e, { dir: new window.Phaser.Math.Vector2(1, 0), physical: true }); dmg.push(Math.round((b - Math.max(0, e.c.hp)) * 100) / 100); }
      return { dmg, max: e.d.maxHp };
    }, [sp.x, sp.y]).catch((err) => ({ err: String(err) }));
    log('  fare', JSON.stringify(hits));
    await wait(80);
    await shot('g6_b23_hit_numbers');
    check(hits.max === 1.5, `fare 1,5 HP (${hits.max})`);
    // kritiksiz sopa vuruşu 1,0 → fare 2 vuruşta ölür (kritik ×2 tek vuruşta öldürebilir)
    // (son vuruşun sayısı fareden kalan cana kırpılır)
    const crit1 = hits.dmg[0] >= 1.5;
    check(crit1 || (hits.dmg.length === 2 && hits.dmg[0] === 1), `kritiksiz: fare sopayla 2 vuruşta (vuruşlar ${hits.dmg.join(', ')})`);
    // sümüksü: tek vuruş (sayı ve sümük parçacığı), sonra kesin kritik (büyük sarı sayı + çınlama)
    await W(() => {
      const w = window.__game.scene.getScene('World');
      const p = w.player.actor;
      const [e] = w.spawnAt('slime', Math.round(p.x / 32) + 1, Math.round(p.y / 32), 1, 0, 'qa2');
      e.aware = true;
      w.hitEnemy(e, { dir: new window.Phaser.Math.Vector2(1, 0), physical: true });
    });
    await wait(120);
    await shot('g6_b23_slime_hit');
    await wait(900);
    await W(() => {
      const w = window.__game.scene.getScene('World');
      const e = w.enemies.find((x) => x.alive && x.def.id === 'slime');
      if (!e) return;
      w.player.critNext = true;
      w.hitEnemy(e, { dir: new window.Phaser.Math.Vector2(1, 0), physical: true });
    });
    const texts = await W(() => window.__game.scene.getScene('World').children.list.filter((o) => o.type === 'Text' && o.visible && o.alpha > 0).map((o) => `${o.text}|${o.style?.color}|${o.alpha.toFixed(2)}`));
    log('  kritik sonrası yazılar', JSON.stringify(texts));
    check(texts.some((t) => /!\|#ffd23a/.test(t)), 'kritik sayısı sarı ve "!"');
    await wait(250);
    await shot('g6_b23_crit');
    // kusursuz kaçış: ağır çekim ve tını
    await W(() => { const w = window.__game.scene.getScene('World'); const e = w.enemies.find((x) => x.alive); w.perfectDodge(e ?? null); });
    await wait(150);
    await shot('g6_b23_perfect_dodge');
    // düşük can vinyeti
    await W(() => { window.__G.p.hp = 2; });
    await wait(1500);
    await shot('g6_b23_low_hp');
    await W(() => { window.__G.p.hp = window.__G.d.maxHp; });
  }

  if (want('map2') || want('combat') || !only.length) {
    // dövüş bölgesinin çevresi keşfedildi: haritada toplama/yaratık işaretleri (B16)
    await W(() => window.__game.scene.getScene('UI').openMenu('map'));
    await h.until(() => window.__game.scene.isActive('Menu'), null, 5000);
    await h.frames(10);
    const mk = await W(() => (window.__game.scene.getScene('World').mapMarkerList?.() ?? []).map((m) => `${m.kind}:${m.label}${m.faded ? '(soluk ' + m.note + ')' : ''}`));
    log('  işaretler', JSON.stringify(mk));
    check(mk.some((m) => m.startsWith('spawn:')), 'haritada yaratık bölgesi işareti');
    await shot('g6_b16_map_markers2');
    await W(() => window.__game.scene.getScene('Menu').close());
    await h.frames(5);
  }

  if (want('hud') || !only.length) {
    await W(() => { window.__G.state.satiety = 20; window.__G.invalidate(); });
    await wait(600);
    await shot('g6_b13_hud_hungry');
    await W(() => { window.__G.state.satiety = 70; window.__G.invalidate(); });
  }

  log('');
  log(problems.length ? `SORUNLAR (${problems.length}):\n - ${problems.join('\n - ')}` : 'HEPSİ TAMAM');
};
