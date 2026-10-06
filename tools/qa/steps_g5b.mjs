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

  // ================================================================ 7: prologdaki Status ekranı
  if (want('prologue')) {
    log('== 7 prolog Status');
    await W(() => {
      const g = window.__game;
      const P = g.scene.getScene('Prologue');
      P.run = async function () { await this.statusReveal(); };
      g.scene.getScene('World').scene.sleep('UI');
      g.scene.getScene('World').scene.launch('Prologue');
      g.scene.getScene('World').scene.bringToTop('Prologue');
      g.scene.getScene('World').scene.setVisible(false);
    });
    await h.until(() => window.__game.scene.isActive('Prologue'), null, 5000);
    await wait(300);
    await shot('g5b_7_prologue_opening');
    await wait(1100);
    await shot('g5b_7_prologue_scan');
    await wait(2200);
    await shot('g5b_7_prologue_status');
    const vals = await W(() => { const P = window.__game.scene.getScene('Prologue'); const texts = []; const walk = (l) => { for (const o of l) { if (o.type === 'Text') texts.push(o.text); if (o.list) walk(o.list); } }; walk(P.children.list); return texts; });
    check(vals.some((t) => t === '0,75x') && !vals.some((t) => t === '0.50x'), '7: Divine statları gerçek veriden (0,75x var, 0.50x yok)');
    await W(() => { const g = window.__game; g.scene.stop('Prologue'); g.scene.getScene('World').scene.wake('UI'); g.scene.getScene('World').scene.setVisible(true); });
    await h.frames(5);
  }

  // ================================================================ 8–11: Appraisal kartları ve renkli artılar
  if (want('appr') || want('stats')) {
    log('== 8-11 Appraisal ve statlar');
    await W(() => {
      const G = window.__G;
      G.p.titles = ['camp_breaker'];
      G.p.equipment.belt = 'rope_belt';
      G.p.equipment.helmet = 'leather_cap';
      G.p.skills.push({ id: 'iron_body', rank: 1, exp: 6 }, { id: 'sword_mastery', rank: 4, exp: 22 }, { id: 'fire_magic', rank: 9, exp: 120 }, { id: 'stealth', rank: 25, exp: 0 });
      G.p.alloc.VIT = 5; G.p.alloc.STR = 3;
      G.invalidate();
    });
    await W(() => window.__game.scene.getScene('World').appraiseSelf());
    await wait(900);
    await shot('g5b_8_appr_self');
    await W(() => window.__game.scene.getScene('UI').closeAppraisal());
    await wait(400);
    // NPC: ekipmanı görünen (Joseph'in Appraisal'ı yüksek) ve görünmeyen
    await W(() => { const G = window.__G; G.p.skills.find((s) => s.id === 'appraisal').rank = 12; });
    await W(() => { const w = window.__game.scene.getScene('World'); const d = window.__NPC_BY_ID?.guard_hob ?? w.npcs.find((n) => n.def.id === 'guard_hob')?.def; w.ui.showAppraisal(d.creature, d); });
    await wait(900);
    await shot('g5b_8_appr_npc_visible');
    await W(() => window.__game.scene.getScene('UI').closeAppraisal());
    await wait(300);
    await W(() => { const G = window.__G; G.p.skills.find((s) => s.id === 'appraisal').rank = 0; });
    await W(() => { const w = window.__game.scene.getScene('World'); const d = window.__NPC_BY_ID?.celeste ?? w.npcs.find((n) => n.def.id === 'celeste')?.def; w.ui.showAppraisal(d.creature, d); });
    await wait(900);
    await shot('g5b_8_appr_npc_hidden');
    await W(() => window.__game.scene.getScene('UI').closeAppraisal());
    await W(() => { const G = window.__G; G.p.skills.find((s) => s.id === 'appraisal').rank = 3; });
    await W(() => { const w = window.__game.scene.getScene('World'); const d = window.__NPC_BY_ID?.vera ?? w.npcs.find((n) => n.def.id === 'vera')?.def; w.ui.showAppraisal(d.creature, d); });
    await wait(900);
    await shot('g5b_8_appr_npc_partial');
    await W(() => window.__game.scene.getScene('UI').closeAppraisal());
    await W(() => { const G = window.__G; G.p.skills.find((s) => s.id === 'appraisal').rank = 0; });
    await wait(300);
    await openMenu('status', 'stats');
    await shot('g5b_10_status_stats');
    await closeMenu();
  }

  /** Sahnede ada göre düğmeye bas (emit). */
  const pressNamed = (scene, name) => W(([scene, name]) => {
    const sc = window.__game.scene.getScene(scene);
    const find = (list) => { for (const o of list) { if (o.name === name) return o; if (o.list) { const r = find(o.list); if (r) return r; } } return null; };
    const b = find(sc.children.list);
    if (!b) return false;
    const ev = { stopPropagation() {} };
    b.emit('pointerdown', {}, 0, 0, ev); b.emit('pointerup', {}, 0, 0, ev);
    return true;
  }, [scene, name]);

  // ================================================================ 12: puan dağıtırken kaydırma
  if (want('scroll')) {
    log('== 12 puan dağıtırken kaydırma');
    await W(() => { const G = window.__G; G.p.unspent = 6; G.invalidate(); });
    await openMenu('status', 'all');
    const before = await W(() => { const m = window.__game.scene.getScene('Menu'); const l = m.content.list.find((o) => o.inner); l.setScroll(420); return Math.round(l.scrollY); });
    await h.frames(3);
    await shot('g5b_12_scroll_before');
    await W(() => { const m = window.__game.scene.getScene('Menu'); const l = m.content.list.find((o) => o.inner); const b = l.inner.list.find((o) => o.labelText === '+'); const ev = { stopPropagation() {} }; b.emit('pointerdown', {}, 0, 0, ev); b.emit('pointerup', {}, 0, 0, ev); });
    await h.frames(3);
    const after = await W(() => { const m = window.__game.scene.getScene('Menu'); const l = m.content.list.find((o) => o.inner); return { scroll: Math.round(l.scrollY), unspent: window.__G.p.unspent }; });
    log('  önce', before, 'sonra', JSON.stringify(after));
    check(after.unspent === 5 && after.scroll === before, '12: "+" sonrası kaydırma korundu');
    await shot('g5b_12_scroll_after');
    await closeMenu();
  }

  // ================================================================ 13: envanter sıralaması
  if (want('sort')) {
    log('== 13 envanter sıralaması');
    await W(() => { const G = window.__G; for (const [id, n] of [['apple', 4], ['herb', 6], ['iron_spear', 1], ['rusty_shortsword', 1], ['rabbit_pelt', 3], ['slime_jelly', 2], ['hp_potion_s', 2], ['bread', 2], ['wolf_fang', 3], ['leather_boots', 1]]) if (window.__ITEMS?.[id] ?? true) G.p.inventory[id] = n; G.invalidate(); });
    await openMenu('inventory');
    await W(() => { window.__game.scene.getScene('Menu').invCat = 'all'; window.__game.scene.getScene('Menu').render(); });
    await h.frames(3);
    await pressNamed('Menu', 'sort_key'); // Fiyat
    await h.frames(3);
    const order1 = await W(() => window.__game.scene.getScene('Menu').inventoryIds('all'));
    await shot('g5b_13_inventory_sort_price_desc');
    await pressNamed('Menu', 'sort_dir'); // artan
    await h.frames(3);
    const order2 = await W(() => window.__game.scene.getScene('Menu').inventoryIds('all'));
    check(JSON.stringify(order1) === JSON.stringify([...order2].reverse()) || order1[0] !== order2[0], '13: artan/azalan değişti');
    await shot('g5b_13_inventory_sort_price_asc');
    await pressNamed('Menu', 'sort_key'); // Rütbe
    await h.frames(3);
    await shot('g5b_13_inventory_sort_rank');
    await closeMenu();
    await openMenu('inventory');
    const kept = await W(() => { const m = window.__game.scene.getScene('Menu'); const find = (list) => { for (const o of list) { if (o.name === 'sort_key') return o; if (o.list) { const r = find(o.list); if (r) return r; } } return null; }; return find(m.children.list)?.labelText; });
    check(/Rütbe/.test(kept ?? ''), '13: seçim menü kapanıp açılınca hatırlandı (' + kept + ')');
    await closeMenu();
  }

  // ================================================================ 14: dükkân sıralaması ve satın alma animasyonu
  if (want('buy')) {
    log('== 14 dükkân sıralaması ve satın alma');
    await setTime(3, 10);
    await tpPoint('smithy', 'counter_front', 0, 0, 'up');
    await h.until(() => !!window.__game.scene.getScene('World').npc('smith'), null, 6000);
    await W(() => { const G = window.__G; G.p.wallet = { bronze: 0, silver: 40, platinum: 0, gold: 0, diamond: 0 }; });
    await talkTo('smith');
    await toChoice();
    await h.pick(0);
    await h.until(() => !!window.__game.scene.getScene('UI').shopClose, null, 6000);
    await wait(500);
    await pressNamed('UI', 'sort_key');
    await h.frames(3);
    await shot('g5b_14_shop_sort_price');
    await pressNamed('UI', 'sort_key');
    await h.frames(3);
    await shot('g5b_14_shop_sort_rank');
    // ilk eşyayı seç ve iki kez art arda satın al
    await W(() => { const ui = window.__game.scene.getScene('UI'); const find = (list) => { for (const o of list) { if (o.type === 'Zone' && o.height === 58) return o; if (o.list) { const r = find(o.list); if (r) return r; } } return null; }; const z = find(ui.children.list); z.emit('pointerup', {}); });
    await h.frames(3);
    const buy = () => W(() => { const ui = window.__game.scene.getScene('UI'); const find = (list) => { for (const o of list) { if (o.labelText === 'Satın Al' && o.w > 200) return o; if (o.list) { const r = find(o.list); if (r) return r; } } return null; }; const b = find(ui.children.list); const ev = { stopPropagation() {} }; b.emit('pointerdown', {}, 0, 0, ev); b.emit('pointerup', {}, 0, 0, ev); return true; });
    const inv0 = await W(() => Object.values(window.__G.p.inventory).reduce((a, b) => a + b, 0));
    await buy();
    await wait(120);
    await buy();
    await wait(200);
    await shot('g5b_14_buy_anim');
    await wait(400);
    await shot('g5b_14_buy_anim_bag');
    const inv1 = await W(() => Object.values(window.__G.p.inventory).reduce((a, b) => a + b, 0));
    check(inv1 - inv0 === 2, '14: art arda iki alım engellenmedi (' + (inv1 - inv0) + ')');
    await W(() => window.__game.scene.getScene('UI').shopClose?.());
    await h.run([], 40, undefined, { start: 300 });
  }

  // ================================================================ KISIM 2 — S3: Sistem Teklifi
  const giveSkills = (list) => W((list) => { const G = window.__G; for (const [id, rank] of list) { const s = G.p.skills.find((x) => x.id === id); if (s) s.rank = rank; else G.p.skills.push({ id, rank, exp: 0 }); } G.invalidate(); }, list);
  const pressAny = async (name) => (await pressNamed('Menu', name)) || pressNamed('UI', name);
  if (want('offer')) {
    log('== S3 Sistem Teklifi');
    await W(() => { const G = window.__G; G.p.sp = 9; G.state.lastSkillLearnWeek = null; G.p.skills = G.p.skills.filter((s) => s.id === 'appraisal'); G.invalidate(); });
    await openMenu('status', 'skills');
    await pressNamed('Menu', 'offer_btn');
    await wait(900);
    await shot('g5b_s3_offer_choice');
    const labels = await W(() => { const m = window.__game.scene.getScene('Menu'); const out = []; const walk = (l) => { for (const o of l) { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); } }; walk(m.children.list); return out.filter((t) => /SP ·|%/.test(t)); });
    check(labels.some((t) => t.includes('1 SP · Basic chance')) && labels.some((t) => t.includes('3 SP · High chance')) && labels.some((t) => t.includes('Sıradan: %80')), '3: seçim ekranında oranlar (' + labels.slice(0, 4).join(' | ') + ')');
    for (const sp of [3, 2, 1]) {
      await W(() => { window.__G.state.lastSkillLearnWeek = null; });
      if (sp !== 3) { await pressNamed('Menu', 'offer_btn'); await wait(700); }
      await pressNamed('Menu', 'card_' + (sp - 1));
      await wait(1000);
      const n = await W(() => { const m = window.__game.scene.getScene('Menu'); let c = 0; const walk = (l) => { for (const o of l) { if (/^card_\d$/.test(o.name ?? '')) c++; if (o.list) walk(o.list); } }; walk(m.children.list); return c; });
      check(n === sp, `S3: ${sp} SP → ${sp} kart (${n})`);
      await shot(`g5b_s3_offer_${sp}cards`);
      await pressNamed('Menu', sp === 1 ? 'card_0' : 'card_cancel');
      await wait(500);
    }
    // boş kart: yalnızca bir sıradan skill kalmış
    await W(() => { const G = window.__G; G.state.lastSkillLearnWeek = null; G.p.sp = 3; const all = Object.keys(window.__SKILLS ?? {}); });
    await W(() => { const G = window.__G; const S = window.__game.scene.getScene('Menu'); void S; });
    await W(() => { const G = window.__G; for (const id of ['stealth', 'evasion', 'archery', 'first_aid', 'athletics', 'sword_mastery', 'spear_mastery', 'fire_magic', 'healing_magic', 'ice_magic', 'war_cry', 'storm_blade', 'thunder_magic', 'iron_body']) if (!G.p.skills.some((s) => s.id === id)) G.p.skills.push({ id, rank: 0, exp: 0 }); G.invalidate(); window.__game.scene.getScene('Menu').render(); });
    await h.frames(3);
    await pressNamed('Menu', 'offer_btn');
    await wait(700);
    await pressNamed('Menu', 'card_2');
    await wait(1000);
    const st = await W(() => window.__G.p.sp);
    await shot('g5b_s3_offer_empty_cards');
    check(st === 2, 'S3: 3 SP teklif, 2 boş kart → 2 SP iade (SP ' + st + ')');
    await pressNamed('Menu', 'card_cancel');
    await wait(600);
    // haftalık sınır bildirimi menünün üstünde
    await W(() => { window.__G.p.sp = 3; window.__game.scene.getScene('Menu').render(); });
    await h.frames(3);
    await pressNamed('Menu', 'offer_btn');
    await wait(500);
    const notices = await W(() => window.__game.scene.getScene('Menu').notices.length);
    check(notices > 0, 'S3: "bu hafta zaten" bildirimi menünün üstünde');
    await shot('g5b_s3_weekly_notice_on_menu');
    await closeMenu();
    await W(() => { const G = window.__G; G.p.skills = G.p.skills.filter((s) => s.id === 'appraisal'); G.invalidate(); });
  }

  // ================================================================ S5: yetenek slotu; S1: nadirlik çerçeveli liste
  if (want('slot') || want('skills')) {
    log('== S5 yetenek slotu ve S1 skill listesi');
    await giveSkills([['sword_mastery', 9], ['fire_magic', 3], ['ice_magic', 6], ['war_cry', 0], ['storm_blade', 2], ['stealth', 25]]);
    await W(() => { const G = window.__G; G.state.skillSlots = [null, null]; G.p.equipment.weapon = 'rusty_shortsword'; G.p.level = 6; G.p.alloc.MNA = 60; G.invalidate(); G.p.mp = G.d.maxMp; });
    await openMenu('status', 'skills');
    await shot('g5b_s5_slots_empty');
    await pressNamed('Menu', 'slot_double_slash');
    await h.frames(3);
    const sl = await W(() => window.__G.state.skillSlots);
    check(sl[0] === 'double_slash' && sl[1] === null, 'S5: Tak → 1. slotta (' + JSON.stringify(sl) + ')');
    await shot('g5b_s5_slots_equipped');
    await W(() => { const m = window.__game.scene.getScene('Menu'); const l = m.content.list.find((o) => o.inner); l.setScroll(400); });
    await h.frames(3);
    await shot('g5b_s1_skill_list_frames');
    await closeMenu();
    await h.frames(5);
    const hud = await W(() => { const ui = window.__game.scene.getScene('UI'); ui.refreshButtons(); return ui.skillBtns.filter((b) => b.visible).length; });
    check(hud === 1, 'S5: HUD\'da yalnızca takılı yetenek (' + hud + ')');
    await shot('g5b_s5_hud_one_skill');
  }

  // ================================================================ S6/S7: buz, nara, karşı saldırı, yanma
  if (want('fx')) {
    log('== S6/S7 durum etkileri');
    await giveSkills([['sword_mastery', 15], ['fire_magic', 3], ['ice_magic', 12], ['war_cry', 0]]);
    await W(() => { const G = window.__G; G.p.equipment.weapon = 'rusty_shortsword'; G.p.level = 6; G.p.alloc.MNA = 60; G.p.alloc.VIT = 30; G.invalidate(); G.p.mp = G.d.maxMp; G.p.hp = G.d.maxHp; });
    await tpPoint('world', 'forest_edge', 0, 0, 'right');
    const spawn = (m, n = 3) => W(([m, n]) => { const w = window.__game.scene.getScene('World'); for (const e of w.enemies) { e.destroy(); } w.enemies = []; const a = w.player.actor; const es = w.spawnAt(m, Math.floor(a.x / 32) + 2, Math.floor(a.y / 32), n, 1); for (const e of es) { e.becomeAware(false); e.cooldownT = 99; } return es.length; }, [m, n]);
    const use = (tech) => W((tech) => { const G = window.__G; const w = window.__game.scene.getScene('World'); G.state.skillSlots = [tech, null]; w.player.skillCd = {}; G.p.mp = G.d.maxMp; w.player.setState('free'); w.useSkillSlot(0); }, tech);
    const sts = () => W(() => window.__game.scene.getScene('World').enemies.filter((e) => e.alive).map((e) => e.statuses.map((s) => s.kind).join('+') || '-'));
    const closeLook = async (name) => {
      await W(() => { const w = window.__game.scene.getScene('World'); const c = w.cameras.main; w.camFollow = false; c.setZoom(3); c.centerOn(w.player.actor.x + 50, w.player.actor.y - 10); });
      await h.frames(2);
      await shot(name);
      await W(() => { const w = window.__game.scene.getScene('World'); w.cameras.main.setZoom(window.__Display.worldZoom); w.followPlayer(); });
    };
    // buz kıymığı: yavaşlatma
    await spawn('goblin', 1);
    await use('ice_shard');
    await h.until(() => window.__game.scene.getScene('World').enemies.some((e) => e.statuses.some((s) => s.kind === 'slow')), null, 4000);
    log('  buz kıymığı:', JSON.stringify(await sts()));
    check((await sts()).some((x) => x.includes('slow')), 'S6: Buz Kıymığı yavaşlattı');
    await closeLook('g5b_s6_ice_shard_slow');
    // donduran halka: dondurma
    await spawn('goblin', 3);
    await W(() => { const w = window.__game.scene.getScene('World'); const a = w.player.actor; for (const e of w.enemies) { e.actor.setPosition(a.x + 40 + Math.random() * 20, a.y + (Math.random() - 0.5) * 40); e.actor.body2.reset(e.actor.x, e.actor.y); } });
    await use('frost_ring');
    await h.frames(3);
    log('  donduran halka:', JSON.stringify(await sts()));
    check((await sts()).some((x) => x.includes('freeze')), 'S6: Donduran Halka dondurdu');
    await closeLook('g5b_s6_frost_ring_freeze');
    // nara: sendeleme (eşit/düşük level)
    await spawn('rat', 3);
    await W(() => { const w = window.__game.scene.getScene('World'); const a = w.player.actor; for (const e of w.enemies) { e.actor.setPosition(a.x + 30 + Math.random() * 30, a.y + (Math.random() - 0.5) * 40); e.actor.body2.reset(e.actor.x, e.actor.y); } });
    await use('war_shout');
    await h.frames(3);
    log('  nara:', JSON.stringify(await sts()));
    check((await sts()).some((x) => x.includes('stagger')), 'S6: Nara sendeletti');
    await closeLook('g5b_s6_war_shout_stagger');
    // nara bossa işlemez
    await spawn('goblin_chief', 1);
    await W(() => { const w = window.__game.scene.getScene('World'); const a = w.player.actor; const e = w.enemies[0]; e.actor.setPosition(a.x + 40, a.y); e.actor.body2.reset(e.actor.x, e.actor.y); });
    await use('war_shout');
    await h.frames(3);
    check(!(await sts()).some((x) => x.includes('stagger')), 'S6: Nara bossa işlemedi');
    // kıvılcım: yanma
    await spawn('goblin', 1);
    await use('spark');
    await h.until(() => window.__game.scene.getScene('World').enemies.some((e) => e.statuses.some((s) => s.kind === 'burn')), null, 4000);
    log('  kıvılcım:', JSON.stringify(await sts()));
    check((await sts()).some((x) => x.includes('burn')), 'S6: Kıvılcım yaktı');
    await closeLook('g5b_s6_spark_burn');
    // karşı saldırı: gerçek savuşturma
    await spawn('goblin', 1);
    await W(() => { const w = window.__game.scene.getScene('World'); const a = w.player.actor; const e = w.enemies[0]; e.actor.setPosition(a.x + 30, a.y); e.actor.body2.reset(e.actor.x, e.actor.y); e.cooldownT = 0; });
    const hp0 = await W(() => { const e = window.__game.scene.getScene('World').enemies[0]; return { joseph: window.__G.p.hp, enemy: e.c.hp }; });
    await use('counter');
    await h.until(() => { const w = window.__game.scene.getScene('World'); return w.player.parryT <= 0; }, null, 6000);
    await wait(200);
    const hp1 = await W(() => { const e = window.__game.scene.getScene('World').enemies[0]; return { joseph: window.__G.p.hp, enemy: e?.c.hp ?? 0, parry: window.__game.scene.getScene('World').player.parryT }; });
    log('  karşı saldırı:', JSON.stringify(hp0), '→', JSON.stringify(hp1));
    check(hp1.joseph >= hp0.joseph && hp1.enemy < hp0.enemy, 'S7: Karşı Saldırı darbeyi engelledi ve karşılık verdi');
    await closeLook('g5b_s7_counter');
    await W(() => { const w = window.__game.scene.getScene('World'); for (const e of w.enemies) e.destroy(); w.enemies = []; });
  }

  log('\nSORUNLAR:', problems.length ? problems.join(' | ') : 'yok');
};
