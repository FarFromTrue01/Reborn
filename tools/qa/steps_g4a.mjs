// Grup 4A (0.6.0) uçtan uca QA: ana görev zinciri (her adımda aktif ana görev), Vera/Lina sahnelerde, Haldor oku,
// kâhyanın kesesi, şifa evi gece açık, görev saatine kadar uyu, yan görevler (iş yeri, mavi işaretler), şifalı ot,
// handa kalabalık.
// Çalıştır: npm run build && npx vite preview --port 4173 & ; URL='http://localhost:4173/?qa=1' node tools/qa/shot.mjs g4a
// ONLY=chain,haldor,side,herbs,inn ile bölüm seçilebilir.
import { helpers } from './helpers.mjs';

export default async ({ page, wait, shot, evalG }) => {
  const h = helpers(page, wait, evalG);
  const log = (...a) => console.log(...a);
  const only = (process.env.ONLY || '').split(',').filter(Boolean);
  const want = (k) => !only.length || only.includes(k);
  const problems = [];
  const check = (ok, what) => { log(ok ? '  ✓' : '  ✗', what); if (!ok) problems.push(what); };

  // ---------------------------------------------------------------- ortak yardımcılar
  const W = (fn, arg) => evalG(fn, arg);
  /** Aktif ana görevler, takip edilen ve HUD'daki bekleme metni. */
  const mains = () => W(() => {
    const G = window.__G, Q = window.__Q;
    const log = G.state.quests;
    const act = log.order.filter((id) => log.quests[id]?.status === 'active');
    const m = act.filter((id) => Q.def(id)?.kind === 'main');
    return { act: m, tracked: log.tracked, wait: log.tracked ? Q.wait(log.tracked) : null, label: (() => { const d = Q.def(log.tracked); const st = log.quests[log.tracked]; if (!d || !st) return null; const i = d.objectives.findIndex((o, k) => st.progress[k] < (o.count ?? 1)); return d.objectives[i]?.label ?? null; })() };
  });
  const setTime = (day, hour, min = 0) => W(([d, hh, mm]) => { window.__G.state.time = { day: d, minute: hh * 60 + mm }; }, [day, hour, min]);
  const day = () => W(() => window.__G.state.time.day);
  const npcHere = (id) => W((id) => !!window.__game.scene.getScene('World').npc(id) || !!window.__game.scene.getScene('World').companion(id), id);
  const talk = async (id, choices = []) => {
    await W((id) => { const w = window.__game.scene.getScene('World'); const n = w.npc(id); if (n) w.director.talk(n); }, id);
    return h.run(choices);
  };
  const ensureMainNow = () => W(() => window.__game.scene.getScene('World').director.ch2.ensureMain());
  const step = async (name) => {
    await h.frames(6);
    await ensureMainNow();
    const m = await mains();
    log(`[${name}] ana: ${m.act.join(', ') || '—'} · takip: ${m.tracked} · "${m.label}"${m.wait ? ` · ⏳ ${m.wait}` : ''}`);
    check(m.act.length > 0, `${name}: en az bir aktif ana görev`);
    return m;
  };
  const tpPoint = async (map, name) => { await W(([map, name]) => { const w = window.__game.scene.getScene('World'); const p = w.pointsOf(map)[name]; w.loadMap(map, p.x, p.y, 'down'); }, [map, name]); await h.frames(3); };
  const devComplete = (id) => W((id) => window.__Q.complete(id), id);
  const finishObjectives = (id) => W((id) => { const Q = window.__Q; const d = Q.def(id); d.objectives.forEach((o, i) => Q.advance(id, i, o.count ?? 1)); }, id);

  await W(() => {
    const G = window.__G;
    G.newGame();
    G.setFlag('woke');
   
    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 84, y: 62, facing: 'down' });
  });
  await h.until(() => { const w = window.__game.scene.getScene('World'); return w.sys.isActive() && !!w.player && !!w.director; }, null, 20000);
  await h.frames(10);

  // ================================================================ 1) ana görev zinciri
  if (want('chain')) {
    log('== Ana görev zinciri');
    // Bölüm I sahneleri (iş, hasat) mini oyunlu: geliştirici "Tamamla" ile geç, güvence sonraki halkayı açsın
    await step('başlangıç');
    for (const id of ['m_inn', 'm_bertram', 'm_harvest']) {
      await devComplete(id);
      await step(`${id} bitti`);
    }
    // Lonca kaydı: kayıt sahnesi (gerçek)
    await W(() => { const G = window.__G; G.setFlag('inn_met'); G.setFlag('bertram_deal'); G.setFlag('bertram_done'); G.setFlag('farm_done'); window.__R?.giveMoney?.(100, 'QA', true); G.p.wallet.silver = (G.p.wallet.silver || 0) + 1; G.p.equipment.chest = 'linen_shirt'; G.p.equipment.pants = 'linen_pants'; });
    await setTime(4, 10);
    await h.tp('guild', 6, 8);
    await h.run();
    await talk('celeste', [0]);
    await step('kayıt');
    // Silah: Bertram (gerçek sahne)
    await h.tp('inn', 4, 6);
    await h.run();
    await talk('bertram');
    let m = await step('silah alındı');
    check(m.act.includes('m_board'), 'sopadan sonra "Pano" ana görevi: ' + m.label);
    await shot('g4a_01_board_quest');
    // Loncaya girince pano aynı gün; Vera ve Lina sahnede
    let sawVL = false;
    await h.tp('world', 92, 56);
    await h.frames(8);
    await h.tp('guild', 6, 10);
    await h.run([1], 400, async (s) => { if (s.dlg && (await npcHere('vera')) && (await npcHere('lina'))) sawVL = true; });
    check(sawVL, 'pano açılışında Vera ve Lina sahnede');
    m = await step('pano açıldı');
    check(m.act.includes('m_grank'), 'G- Rütbe açık');
    // G görevleri: amaçları bitir, Celeste'ye teslim (gerçek teslim konuşması)
    await W(() => { window.__G.setFlag('dorn_steal', 1); window.__G.setFlag('yield_done', 1); });
    for (const id of ['g1_rats', 'g2_herbs', 'g3_letter']) {
      await W((id) => { const Q = window.__Q; const d = Q.def(id); d.objectives.forEach((o, i) => { if (o.target !== 'celeste') Q.advance(id, i, o.count ?? 1); }); }, id);
      await talk('celeste');
    }
    m = await step('G görevleri teslim');
    check(m.act.includes('m_air'), 'Biraz Hava açık');
    // Biraz hava → yaralılar (gerçek sahne)
    await tpPoint('world', 'forest_edge');
    await h.run([0]);
    m = await step('yaralılar');
    // gece: şifa evi saatten bağımsız açık, Ilse Nine içeride
    await setTime(await day(), 22);
    await W(() => { const w = window.__game.scene.getScene('World'); const d = w.pointsOf('world').door_healer; w.loadMap('world', d.x, d.y + 1, 'up'); });
    await h.frames(5);
    await h.warp('healer');
    const hs = await h.S();
    check(hs.map === 'healer', 'gece 22:00 şifa evine girildi (yaralılar görevi): ' + hs.map);
    check(await npcHere('healer'), 'Ilse Nine şifa evinde');
    await h.run([0]);
    m = await step('şifacı ödendi');
    check(m.act.includes('m_vl_rest') && !!m.wait, 'Vera ve Lina adımı bekleme metniyle: ' + m.wait);
    await shot('g4a_02_vl_rest_wait');
    // görev saatine kadar uyu
    await h.tp('inn_attic', 6, 4);
    await h.frames(8);
    await W(() => { const w = window.__game.scene.getScene('World'); w.director.scene(async () => w.director.sleepAttic()); });
    await h.until(() => window.__game.scene.getScene('UI').choiceObjs.length > 0, null, 6000);
    const ch = await W(() => window.__game.scene.getScene('UI').choiceObjs.map((b) => b.label?.text ?? b.list?.find?.((o) => o.text)?.text ?? ''));
    log('  uyku menüsü:', JSON.stringify(ch));
    await shot('g4a_03_sleep_menu');
    await h.run([1]);
    const t = await W(() => window.__G.state.time);
    check(t.minute >= 8 * 60 && t.minute <= 8 * 60 + 10, `görev saatine kadar uyundu: ${t.day}. gün ${Math.floor(t.minute / 60)}:${String(t.minute % 60).padStart(2, '0')}`);
    m = await step('uyandı');
    check(!m.wait, 'uyanınca bekleme bitti (ok görünür)');
    // Vera'yla konuş: ilk ortak F görevi
    await h.tp('inn', 7, 9);
    await h.run();
    await W(() => { const w = window.__game.scene.getScene('World'); if (!w.npc('vera')) w.addNpc(window.__NPC_BY_ID.vera, 5, 10); });
    await talk('vera', [0]);
    m = await step('otlak görevi');
    check(m.act.includes('f_wolves'), 'Otlaktaki Fareler açık');
    // otlak: yoldaşlar orada
    await tpPoint('world', 'pasture');
    await h.frames(8);
    let sawParty = false;
    await h.run([0], 400, async () => { if ((await npcHere('vera')) && (await npcHere('lina'))) sawParty = true; });
    check(sawParty, 'otlakta Vera ve Lina sahnede');
    await finishObjectives('f_wolves');
    await W(() => { const Q = window.__Q; Q.def('f_wolves'); });
    // teslim (gerçek): Celeste
    await W(() => { const st = window.__G.state.quests.quests.f_wolves; st.progress[2] = 0; });
    await h.tp('guild', 6, 8);
    await h.run();
    await talk('celeste');
    m = await step('otlak teslim');
    check(m.act.includes('m_celebrate'), 'İlk Kadeh açık: ' + m.label);
    // 18:00 öncesi bekleme
    await setTime(await day(), 15);
    m = await step('kutlama öncesi');
    check(!!m.wait, 'kutlamadan önce bekleme: ' + m.wait);
    await setTime(await day(), 18, 5);
    await tpPoint('world', 'door_inn');
    await h.frames(8);
    await h.tp('inn', 7, 11);
    await h.run();
    m = await step('handa');
    check(m.label === 'Vera\'yla masaya otur', 'ana görev "Vera\'yla masaya otur": ' + m.label);
    const ctx = await W(() => { const w = window.__game.scene.getScene('World'); const p = w.pointsOf('inn').table_joseph; w.player.actor.setPosition(p.x * 32 + 16, p.y * 32 + 22); w.player.actor.body2.reset(w.player.actor.x, w.player.actor.y); w.player.actor.face('right'); return true; });
    await h.frames(3);
    const it = await W(() => window.__game.scene.getScene('World').findInteractable()?.label ?? null);
    check(it === 'Otur', 'masada etkileşim "Otur": ' + it);
    await shot('g4a_04_sit');
    await W(() => window.__game.scene.getScene('World').interact());
    await h.run();
    m = await step('kutlama');
    check(m.act.includes('m_next_day'), '"Ertesi Gün" adımı: ' + m.wait);
    // kâhyanın kesesi: ertesi gün meydanda
    await setTime((await day()) + 1, 9);
    await W(() => window.__game.scene.getScene('World').director.ch2.onNewDay());
    await tpPoint('world', 'plaza');
    await h.run([0]);
    m = await step('kese çalındı');
    check(m.act.includes('m_theft'), 'Kâhyanın Kesesi kendiliğinden başladı');
    const marks = await W(() => window.__game.scene.getScene('World').npcs.filter((n) => n.markerKind === 'suspect').map((n) => n.def.id));
    check(marks.length === 4, 'şüphelilerin başında işaret: ' + marks.join(','));
    const tgt = await W(() => window.__game.scene.getScene('World').director.ch2.targetOverride('m_theft')?.npc ?? null);
    check(!!tgt, 'ok sıradaki şüpheliyi gösteriyor: ' + tgt);
    await shot('g4a_05_suspects');
    for (const sid of ['vagrant', 'beggar', 'apprentice', 'washer']) {
      await W((sid) => { const w = window.__game.scene.getScene('World'); const n = w.npc(sid); if (n) w.appraise(n.def.creature, n.def, n, true); w.ui.closeAppraisal(); }, sid);
      await h.run([], 400, undefined, { start: 4000 });
    }
    const marks2 = await W(() => window.__game.scene.getScene('World').npcs.filter((n) => n.markerKind === 'suspect').length);
    check(marks2 === 0, 'Appraisal sonrası işaretler kalktı');
    m = await step('şüpheliler incelendi');
    // muhafıza söyle: Joseph muhafızı izler
    const before = await W(() => { const w = window.__game.scene.getScene('World'); const g = w.npc('guard_hob') ?? w.npc('guard_wil'); const p = w.player.actor; if (g) { p.setPosition(g.x + 40, g.y); p.body2.reset(p.x, p.y); } return g?.def.id; });
    await h.frames(3);
    let maxGap = 0;
    await W((gid) => { const w = window.__game.scene.getScene('World'); w.director.talk(w.npc(gid)); }, before);
    await h.run([3], 600, async () => {
      const g = await W((gid) => { const w = window.__game.scene.getScene('World'); const n = w.npc(gid); const p = w.player.actor; return n ? Math.hypot(n.x - p.x, n.y - p.y) / 32 : 0; }, before);
      maxGap = Math.max(maxGap, g);
    });
    const after = await W(() => { const w = window.__game.scene.getScene('World'); const wn = w.pointsOf('world').wash_line; const p = w.player.actor; return Math.hypot(p.x / 32 - wn.x, p.y / 32 - wn.y); });
    check(after < 6, `Joseph muhafızı şüphelinin yanına kadar izledi (çamaşır iplerine ${after.toFixed(1)} karo, en büyük ara ${maxGap.toFixed(1)})`);
    m = await step('kese döndü');
    check(m.act.includes('m_vl_cellar'), '"Yeni İş" adımı: ' + m.wait);
    // geri kalan: ertesi gün Vera → bodrum → 10 gümüş → veda → kart
    await setTime((await day()) + 1, 9);
    await h.tp('inn', 7, 9);
    await h.run();
    await W(() => { const w = window.__game.scene.getScene('World'); if (!w.npc('vera')) w.addNpc(window.__NPC_BY_ID.vera, 5, 10); });
    await talk('vera', [0]);
    m = await step('bodrum');
    check(m.act.includes('f_cellar'), 'Değirmen Bodrumu açık');
    await finishObjectives('f_cellar');
    await W(() => { const st = window.__G.state.quests.quests.f_cellar; st.progress[2] = 0; });
    await h.tp('guild', 6, 8);
    await h.run();
    await talk('celeste');
    m = await step('bodrum teslim');
    await W(() => { const G = window.__G; G.p.wallet.gold = (G.p.wallet.gold || 0) + 1; });
    await h.run();
    m = await step('10 gümüş');
    await h.tp('inn', 4, 6);
    await h.run();
    await talk('bertram', [0]);
    m = await step('veda');
    await tpPoint('world', 'checkpoint');
    await h.run();
    await talk('captain', [0]);
    await h.until(() => !!window.__G.state.flags.ch2_done, null, 6000);
    const fin = await W(() => ({ done: window.__G.state.flags.ch2_done, gate: window.__G.state.quests.quests.m_gate?.status }));
    check(!!fin.done && fin.gate === 'done', 'bölüm bitti (giriş kartı)');
  }

  // ================================================================ 2) Haldor oku
  if (want('haldor')) {
    log('== Haldor');
    await W(() => { const G = window.__G; const Q = window.__Q; G.state.quests.quests = {}; G.state.quests.order = []; G.state.quests.tracked = null; G.state.flags.ch2_done = 1; Q.start('m_harvest', true); G.setFlag('bertram_done'); });
    // temel programlı bir gün
    const d = await W(() => { const H = window.__NPC_BY_ID.haldor; for (let d = 1; d < 30; d++) { const s = H.schedule; void s; } return 1; });
    for (const [hh, mm] of [[8, 0], [12, 30], [23, 0]]) {
      await setTime(d, hh, mm);
      await tpPoint('world', 'plaza');
      await h.frames(8);
      const r = await W(() => { const w = window.__game.scene.getScene('World'); const t = w.questTargetPx(); const hal = w.npc('haldor'); return { t: t ? [Math.round(t.x / 32), Math.round(t.y / 32)] : null, wait: window.__Q.wait('m_harvest'), haldor: hal ? [Math.round(hal.x / 32), Math.round(hal.y / 32)] : null, farmDoor: w.pointsOf('world').door_farmhouse }; });
      log(`  ${hh}:${String(mm).padStart(2, '0')} ok→${JSON.stringify(r.t)} haldor=${JSON.stringify(r.haldor)} kapı=${JSON.stringify(r.farmDoor)} bekle="${r.wait ?? ''}"`);
      if (hh === 23) check(!r.t && /Haldor yarın 06:00'da/.test(r.wait ?? ''), 'gece: ok yok, "Haldor yarın 06:00\'da tarlada olur"');
      else check(!!r.t && !r.wait, `${hh}:${mm}: ok Haldor'a (ya da bulunduğu binaya)`);
      if (hh === 12) await shot('g4a_06_haldor_noon');
      if (hh === 23) await shot('g4a_07_haldor_night');
    }
  }

  // ================================================================ 3) yan görevler: iş yeri ve mavi işaretler
  if (want('side')) {
    log('== Yan görevler');
    await W(() => { const G = window.__G; G.setFlag('side_unlocked', 1); G.setFlag('woke'); G.state.flags.ch2_done = 1; G.setFlag('guild_registered'); G.p.guildRank = 1; G.state.guild.member = true; });
    // demirci handa (19:00): görevden bahsetmez
    let dd = await W(() => { const S = window.__NPC_BY_ID.smith; for (let d = 1; d < 40; d++) { const e = S.schedule; void e; } return 1; });
    let found = false;
    for (let d = 1; d < 20 && !found; d++) {
      await setTime(d, 19);
      const inInn = await W(() => { const S = window.__NPC_BY_ID.smith; const G = window.__G; return true; });
      void inInn;
      await h.tp('inn', 7, 9);
      await h.frames(8);
      if (await npcHere('smith')) { found = true; dd = d; }
    }
    if (found) {
      await h.run();
      await W(() => { const w = window.__game.scene.getScene('World'); const n = w.npc('smith'); const p = w.player.actor; p.setPosition(n.x + 30, n.y); p.body2.reset(p.x, p.y); w.director.talk(n); });
      await h.until(() => !!window.__game.scene.getScene('UI').dlgState?.full, null, 6000);
      const line = await W(() => window.__game.scene.getScene('UI').dlgState?.full ?? '');
      check(/demirhaneye gel/.test(line ?? ''), 'demirci handa: yönlendirme repliği — ' + line);
      await shot('g4a_08_smith_inn');
      await h.run([1]);
    } else log('  (demirci handa olduğu bir akşam bulunamadı)');
    // demirhanede (10:00): teklif
    await setTime(dd, 10);
    await h.tp('world', 70, 68);
    await h.frames(8);
    await shot('g4a_09_world_markers');
    const spots = await W(() => window.__game.scene.getScene('World').sideMarkSpots().map((s) => `${s.id}:${s.kind}${s.building ? '@' + s.building : ''}`));
    log('  işaret yerleri:', spots.join(' '));
    check(spots.some((s) => s.startsWith('smith:offer@smithy')), 'demirci demirhanede: bina işaretli');
    const bm = await W(() => [...window.__game.scene.getScene('World').buildingMarks.keys()]);
    check(bm.includes('smithy'), 'dünyada demirhanenin üstünde mavi işaret: ' + bm.join(','));
    const mm = await W(() => window.__game.scene.getScene('UI').mmMarks.length);
    check(mm > 0, 'mini haritada mavi ışık: ' + mm);
    await W(() => window.__game.scene.getScene('UI').openMenu('map'));
    await h.frames(10);
    await shot('g4a_10_full_map');
    await W(() => window.__game.scene.getScene('UI').closeMenu?.());
    await h.frames(3);
    await h.warp('smithy');
    await h.until(() => window.__game.scene.getScene('World').npc('smith')?.markerKind === 'offer', null, 6000);
    const mk = await W(() => window.__game.scene.getScene('World').npc('smith')?.markerKind ?? null);
    check(mk === 'offer', 'demirhanede demircinin başında mavi "!"');
    await shot('g4a_11_smith_marker');
    await h.run();
    await W(() => { const w = window.__game.scene.getScene('World'); const n = w.npc('smith'); const p = w.player.actor; p.setPosition(n.x, n.y + 34); p.body2.reset(p.x, p.y); w.director.talk(n); });
    // 0.9.0: görev konuşmanın başında açılmaz; seçeneklerde mavi ünlemle "Su Verme Jölesi"
    for (let i = 0; i < 90; i++) {
      const s = await h.S();
      if (s.choice) break;
      if (s.dlg) await h.adv();
      await wait(250);
    }
    const opts = await W(() => window.__game.scene.getScene('UI').choiceObjs.map((b) => b.labelText ?? ''));
    const qi = opts.findIndex((l) => /Jöle/i.test(l));
    check(qi >= 0, 'demirhanede seçeneklerde görev — ' + opts.join(' / '));
    if (qi >= 0) await h.pick(qi);
    await h.until(() => !!window.__game.scene.getScene('UI').dlgState?.full, null, 6000);
    const line2 = await W(() => window.__game.scene.getScene('UI').dlgState?.full ?? '');
    check(/jöle/i.test(line2), 'demirhanede görev teklifi — ' + line2);
    await h.run([1]);
  }

  // ================================================================ 4) şifalı ot
  if (want('herbs')) {
    log('== Şifalı ot');
    await W(() => { window.__Q.start('g2_herbs', true); window.__Q.track('g2_herbs'); });
    await tpPoint('world', 'forest_edge');
    await h.frames(8);
    await shot('g4a_12_herbs');
    const got = await W(async () => {
      const w = window.__game.scene.getScene('World');
      const fe = w.pointsOf('world').forest_edge;
      const hs = w.mapData.gathers.filter((g) => g.kind === 'herb' && Math.hypot(g.x - fe.x, g.y - fe.y) <= 6);
      let n = 0;
      for (const g of hs) { const img = w.gatherImg(g.id); if (img && img.alpha === 1) { w.gather(g); n++; } }
      return { inside: hs.length, picked: n, inv: window.__G.p.inventory.herb ?? 0, faded: hs.filter((g) => w.gatherImg(g.id)?.alpha < 1).length };
    });
    log('  ', JSON.stringify(got));
    check(got.inside >= 7 && got.inv >= 6, 'işaretli bölgede 6+ ot toplandı');
    // harita yeniden yüklenince toplananlar soluk kalır
    await tpPoint('world', 'forest_edge');
    await h.frames(8);
    const faded = await W(() => { const w = window.__game.scene.getScene('World'); const fe = w.pointsOf('world').forest_edge; return w.mapData.gathers.filter((g) => g.kind === 'herb' && Math.hypot(g.x - fe.x, g.y - fe.y) <= 6 && w.gatherImg(g.id)?.alpha < 1).length; });
    check(faded === got.picked, `yeniden yüklemede toplanan ${got.picked} ot soluk (${faded})`);
  }

  // ================================================================ 5) handa akşam kalabalığı
  if (want('inn')) {
    log('== Han kalabalığı');
    for (const hh of [19, 20]) {
      await setTime(3, hh - 1, 58);
      await h.tp('inn', 7, 11);
      await h.gameSec(9);
      const r = await W(() => {
        const w = window.__game.scene.getScene('World');
        const ns = w.npcs.filter((n) => n.state !== 'walk' && !n.pathPending);
        let close = 0; const pairs = [];
        for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) { const d = Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y); if (d < 20) { close++; pairs.push(`${ns[i].def.id}/${ns[j].def.id}`); } }
        return { n: w.npcs.length, still: ns.length, close, pairs };
      });
      log(`  ${hh}:00 NPC ${r.n} (duran ${r.still}), iç içe ${r.close} ${r.pairs.join(' ')}`);
      check(r.close === 0, `${hh}:00 handa iç içe NPC yok`);
      await shot(`g4a_13_inn_${hh}`);
    }
  }

  log(problems.length ? `SORUNLAR (${problems.length}):\n - ${problems.join('\n - ')}` : 'Hepsi tamam.');
};
