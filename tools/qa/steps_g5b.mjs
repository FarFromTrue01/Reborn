// Grup 5B (0.9.0) QA: arayüz (Kısım 1) ve skill sistemi (Kısım 2) ekran görüntüleri ve denetimler.
// Çalıştır: npm run build && npx vite preview --port 4173 & ; URL='http://localhost:4173/?qa=1' DPR=1 OUT=screens/g5b node tools/qa/shot.mjs g5b
// ONLY=shop,marks,minimap,qbtn,hist,guildbar,prologue,appr,stats,scroll,sort,buy,offer,slot,skills,fx ile bölüm seçilebilir.
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
  const look = async (tx, ty) => { await W(([x, y]) => { const w = window.__game.scene.getScene('World'); w.camFollow = false; w.cameras.main.centerOn(x * 32 + 16, y * 32 + 16); }, [tx, ty]); await h.frames(6); };
  const follow = () => W(() => window.__game.scene.getScene('World').followPlayer());
  /** Bir NPC'yle konuşmayı başlat (Director.talk). */
  const talkTo = (id) => W((id) => { const w = window.__game.scene.getScene('World'); const n = w.npc(id); if (!n) return false; w.director.talk(n); return true; }, id);
  /** Diyaloğu bitir (yazı makinesini atla) ve seçenekler gelene kadar ilerle. */
  const toChoice = async (max = 90) => {
    for (let i = 0; i < max; i++) {
      const s = await h.S();
      if (s.choice) return true;
      if (s.dlg) await h.adv();
      await wait(250);
    }
    return false;
  };
  const choiceLabels = () => W(() => window.__game.scene.getScene('UI').choiceObjs.map((b) => b.labelText ?? ''));
  const openMenu = async (tab, section) => {
    await W(([tab, section]) => { const ui = window.__game.scene.getScene('UI'); const m = window.__game.scene.getScene('Menu'); if (section) m.section = section; ui.openMenu(tab); }, [tab, section]);
    await h.until(() => window.__game.scene.isActive('Menu'), null, 5000);
    await h.frames(4);
  };
  const closeMenu = async () => { await W(() => { const m = window.__game.scene.getScene('Menu'); if (window.__game.scene.isActive('Menu')) m.close(); }); await h.frames(4); };

  await W(() => {
    const G = window.__G;
    G.newGame();
    G.setFlag('woke');
    G.setFlag('side_unlocked');
    G.setFlag('guild_registered');
    for (const k of ['stealth', 'evasion', 'athletics', 'archery', 'first_aid', 'iron_body', 'sword_mastery', 'spear_mastery', 'gathering']) G.state.flags['declined_' + k] = true;
    G.p.equipment.chest = 'linen_shirt';
    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 84, y: 62, facing: 'down' });
  });
  await h.until(() => { const w = window.__game.scene.getScene('World'); return w.sys.isActive() && !!w.player && !!w.director; }, null, 20000);
  await h.frames(10);
  await setTime(3, 10);

  // ================================================================ 1: dükkân seçenekleri + yan görev
  if (want('shop')) {
    log('== 1 dükkân seçenekleri ve yan görev');
    await tpPoint('bakery', 'counter_front', 0, 0, 'up');
    await h.until(() => !!window.__game.scene.getScene('World').npc('baker'), null, 6000);
    await W(() => { const w = window.__game.scene.getScene('World'); const n = w.npc('baker'); w.player.actor.setPosition(n.x, n.y + 40); w.player.actor.body2.reset(n.x, n.y + 40); });
    await h.frames(4);
    await talkTo('baker');
    check(await toChoice(), '1: fırıncıyla konuşunca önce seçenekler geldi');
    const labels = await choiceLabels();
    log('  seçenekler:', JSON.stringify(labels));
    check(labels[0] === 'Alışveriş' && labels.some((l) => l.includes('Elmalı Çörek')), '1: Alışveriş + yan görev seçeneği');
    await wait(700);
    await shot('g5b_1_shop_options_offer');
    // yan görevi seç → teklif → kabul
    const qi = labels.findIndex((l) => l.includes('Elmalı Çörek'));
    await h.pick(qi);
    await wait(300);
    await shot('g5b_1_offer_money_typing');
    for (let i = 0; i < 30; i++) {
      const st = await W(() => { const ui = window.__game.scene.getScene('UI'); return ui.dlgState ? (ui.dlgState.rich ? 'rich' : 'plain') : 'none'; });
      if (st === 'rich') break;
      if (st === 'plain') await h.adv();
      await wait(250);
    }
    await W(() => { const ui = window.__game.scene.getScene('UI'); if (!ui.dlgState.done) ui.advanceDialogue(); });
    await wait(300);
    const rich = await W(() => { const s = window.__game.scene.getScene('UI').dlgState; return s?.rich ? { done: s.done, coins: s.rich.container.list.filter((o) => o.type === 'Container' && o.visible).length } : null; });
    check(!!rich && rich.coins > 0, '1: ödül repliğinde para simgeleri (' + JSON.stringify(rich) + ')');
    await shot('g5b_1_offer_money_icons');
    await h.run([0], 60, undefined, { start: 500 });
    const active = await W(() => window.__Q.status('sq_baker_apples'));
    check(active === 'active', '1: görev kabul edildi');
    // görev aktifken: alışveriş yine açık + görev seçeneği (bekleme)
    await talkTo('baker');
    await toChoice();
    const labels2 = await choiceLabels();
    log('  aktif görevde seçenekler:', JSON.stringify(labels2));
    check(labels2[0] === 'Alışveriş' && labels2.some((l) => l.includes('Elmalı Çörek')), '1: görev aktifken Alışveriş ve görev seçeneği birlikte');
    await wait(700);
    await shot('g5b_1_shop_options_active');
    await h.pick(0);
    await h.until(() => !!window.__game.scene.getScene('UI').shopClose, null, 4000);
    await wait(500);
    await shot('g5b_1_shop_open_while_active');
    await W(() => window.__game.scene.getScene('UI').shopClose?.());
    await h.run([], 40, undefined, { start: 300 });
  }

  // ================================================================ 2–3: mavi ünlemler, mini harita dükkân simgeleri
  if (want('marks') || want('minimap')) {
    log('== 2-3 mavi ünlemler ve mini harita');
    await setTime(3, 10);
    await tpPoint('world', 'plaza', 0, 2, 'down');
    await h.frames(30);
    await W(() => window.__game.scene.getScene('World').updateMarkers());
    await h.frames(10);
    const mk = await W(() => { const w = window.__game.scene.getScene('World'); return { buildings: [...w.buildingMarks.values()].map((t) => t.frame.name), npcs: w.npcs.filter((n) => n.marker).map((n) => n.def.id + ':' + n.marker.frame.name) }; });
    log('  işaretler:', JSON.stringify(mk));
    check(mk.buildings.every((f) => f.startsWith('side_')) && mk.buildings.length > 0, '2: bina işaretleri mavi ünlem simgesi');
    await shot('g5b_2_world_marks');
    const mm = await W(() => { const ui = window.__game.scene.getScene('UI'); ui.drawMinimap(true); return ui.minimapIcons.list.filter((i) => i.visible).map((i) => i.frame.name); });
    log('  mini harita simgeleri:', JSON.stringify(mm));
    check(mm.some((k) => k.startsWith('m_')), '3: mini haritada dükkân simgeleri');
    check(mm.some((k) => k.startsWith('side_')), '2: mini haritada mavi ünlem');
    await page.screenshot({ path: `${process.env.OUT || 'screens'}/g5b_3_minimap.png`, clip: { x: 1060, y: 0, width: 220, height: 220 } });
    await openMenu('map');
    await wait(400);
    await shot('g5b_2_bigmap_marks');
    await closeMenu();
  }

  /** Bir menü nesnesinin (ada göre) ekran koordinatındaki merkezine gerçek fare tıklaması. */
  const clickNamed = async (name) => {
    const pos = await W((name) => {
      const m = window.__game.scene.getScene('Menu');
      const find = (list) => { for (const o of list) { if (o.name === name) return o; if (o.list) { const r = find(o.list); if (r) return r; } } return null; };
      const b = find(m.children.list);
      if (!b) return null;
      const r = b.getBounds();
      const z = window.__Display.uiZoom;
      const canvas = window.__game.canvas.getBoundingClientRect();
      const sx = canvas.width / window.__game.canvas.width;
      return { x: (r.centerX * z) * (canvas.width / (window.__game.scale.width)) / 1 , y: (r.centerY * z) * (canvas.height / window.__game.scale.height) };
    }, name);
    if (!pos) return false;
    await page.mouse.click(pos.x, pos.y);
    await h.frames(4);
    return true;
  };

  // ================================================================ 4: Görevler menüsündeki düğmeler
  if (want('qbtn')) {
    log('== 4 Görevler menüsü düğmeleri');
    await W(() => {
      const G = window.__G; const Q = window.__Q;
      for (const id of ['sq_tanner_pelts', 'sq_smith_jelly', 'sq_healer_salve', 'sq_tailor_parcel', 'sq_mill_sacks', 'sq_hunter_fangs', 'sq_kids_ball', 'sq_merchant_guard', 'sq_nim_bread']) if (!Q.status(id)) Q.start(id, true);
      localStorage.setItem('elonth.questbox.main', '1'); localStorage.setItem('elonth.questbox.side', '1');
    });
    await openMenu('quests');
    const before = await W(() => ({ sel: window.__game.scene.getScene('Menu').selQuest, main: localStorage.getItem('elonth.questbox.main') }));
    await shot('g5b_4_quests_buttons');
    const ok = await clickNamed('hud_main');
    const after = await W(() => ({ sel: window.__game.scene.getScene('Menu').selQuest, main: localStorage.getItem('elonth.questbox.main') }));
    log('  önce', JSON.stringify(before), 'sonra', JSON.stringify(after));
    check(ok && after.main !== before.main && after.sel === before.sel, '4: kaydırmadan "Ana görevleri göster" çalıştı, altındaki satır seçilmedi');
    await shot('g5b_4_quests_buttons_toggled');
    await clickNamed('hud_main');
    await closeMenu();
  }

  // ================================================================ 5: Konuşmalar menüsü
  if (want('hist')) {
    log('== 5 Konuşmalar');
    await W(() => { const G = window.__G; G.state.history = []; for (let i = 0; i < 400; i++) G.state.history.push({ speaker: i % 3 ? 'Fırıncı Brunhild' : 'Joseph', text: `(${i + 1}) Elmalar? Altı tane dedim. Çürüğünü getirme, köksüz. Anlarım. Ağaçlar köyün kenarında, kimse toplamıyor; {m:30} veririm.`, kind: i % 3 ? 'say' : 'choice' }); });
    const t = await W(async () => {
      const ui = window.__game.scene.getScene('UI');
      const t0 = performance.now();
      ui.openMenu('history');
      const m = window.__game.scene.getScene('Menu');
      await new Promise((r) => { const chk = () => (m.sys.isActive() && m.content ? r() : requestAnimationFrame(chk)); chk(); });
      const t1 = performance.now();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const t2 = performance.now();
      const r0 = performance.now(); m.render(); const r1 = performance.now();
      return { create: Math.round(t1 - t0), firstFrames: Math.round(t2 - t0), render: Math.round(r1 - r0), texts: m.content.list.length };
    });
    log('  açılış ölçümü (ms):', JSON.stringify(t));
    await h.frames(4);
    await shot('g5b_5_history_open');
    const st = await W(() => { const m = window.__game.scene.getScene('Menu'); const l = m.content.list.find((o) => o.constructor.name === 'ScrollList' || o.inner); return { scroll: Math.round(l.scrollY), max: Math.round(l.contentH - l.h), shown: m.histShown }; });
    check(st.scroll === st.max && st.max > 0, '5: liste en yeni konuşmada açıldı (' + JSON.stringify(st) + ')');
    await W(() => { const m = window.__game.scene.getScene('Menu'); const l = m.content.list.find((o) => o.inner); l.setScroll(0); });
    await h.frames(3);
    await shot('g5b_5_history_top_more');
    await W(() => { const m = window.__game.scene.getScene('Menu'); const l = m.content.list.find((o) => o.inner); const b = l.inner.list.find((o) => o.labelText?.includes('Daha fazla')); const ev = { stopPropagation() {} }; b.emit('pointerdown', {}, 0, 0, ev); b.emit('pointerup', {}, 0, 0, ev); });
    await h.frames(3);
    const st2 = await W(() => { const m = window.__game.scene.getScene('Menu'); const l = m.content.list.find((o) => o.inner); return { scroll: Math.round(l.scrollY), shown: m.histShown }; });
    check(st2.shown === 80 && st2.scroll > 0, '5: "Daha fazla göster" 40 satır ekledi, görünen yer korundu (' + JSON.stringify(st2) + ')');
    await shot('g5b_5_history_more_loaded');
    await closeMenu();
  }

  // ================================================================ 6: lonca puanı barı
  if (want('guildbar')) {
    log('== 6 lonca puan barı');
    await W(() => { const G = window.__G; G.state.guild.member = true; G.p.guildRank = 0; G.state.guild.points = 52; });
    await W(() => window.__G.events.emit('questdone', { title: 'Orman Kenarındaki Fareler', kind: 'board', money: 20, toDebt: 0, points: 20, pointsTotal: 52, rank: 0, items: [], exp: null }));
    await wait(1400);
    await shot('g5b_6_guildbar_mid');
    await wait(1600);
    await shot('g5b_6_guildbar_end');
    await W(() => { const ui = window.__game.scene.getScene('UI'); ui.dismissSys?.(); });
    await wait(1500);
  }

  log('\nSORUNLAR:', problems.length ? problems.join(' | ') : 'yok');
};
