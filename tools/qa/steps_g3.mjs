// Grup 3 (0.5.0) elle test: Appraisal (NPC / kendi / yaratık), terfi görevi ve animasyonu, görev bitiş animasyonu,
// HUD görev kategorileri, Ayarlar paneli kaydırma.
// Çalıştır: npm run build && npx vite preview --port 4173 & ; node tools/qa/shot.mjs g3
import { helpers } from './helpers.mjs';
export default async ({ page, wait, shot, evalG }) => {
  const h = helpers(page, wait, evalG);
  const log = (...a) => console.log(...a);
  const only = (process.env.ONLY || '').split(',').filter(Boolean);
  const want = (k) => !only.length || only.includes(k);
  // ---------------------------------------------------------------- 0) başlık ekranında Ayarlar (Kapat sabit, alan kayar)
  if (want('title')) {
    await evalG(() => window.__game.scene.getScene('Title').openSettings());
    await wait(1000);
    await shot('g3_00_title_settings');
    await evalG(() => {
      const t = window.__game.scene.getScene('Title');
      const find = (c) => { for (const o of c.list || []) { if (o.inner && o.setScroll) return o; const r = o.list && find(o); if (r) return r; } return null; };
      const l = find(t.panel);
      l?.setScroll(9999);
    });
    await wait(400);
    await shot('g3_00b_title_settings_bottom');
    await evalG(() => { const t = window.__game.scene.getScene('Title'); t.panel?.destroy(); t.panel = null; });
  }
  await evalG(() => {
    const G = window.__G;
    G.newGame();
    G.setFlag('woke');

    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 84, y: 62, facing: 'down' });
  });
  await wait(3500);
  const closeAppr = () => evalG(() => window.__game.scene.getScene('UI').closeAppraisal());

  // ---------------------------------------------------------------- 1) Appraisal
  if (want('appr')) {
    // NPC'ye Appraisal (en yakın NPC)
    const npc = await evalG(() => {
      const w = window.__game.scene.getScene('World');
      const pl = w.player.actor;
      const n = w.npcs.slice().sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y))[0];
      if (!n) return null;
      w.appraise(n.def.creature, n.def, n, true);
      return n.def.id;
    });
    await wait(900);
    log('NPC appraisal:', npc, await evalG(() => { const ui = window.__game.scene.getScene('UI'); const p = ui.appraisalWin?.list?.[1]; return p ? { w: p.panelW, h: p.panelH, creature: p.creature } : null; }));
    await shot('g3_01_appraisal_npc');
    await closeAppr();
    await wait(400);
    // Celeste (lonca rütbeli NPC, yüksek Appraisal → gizli bölümler)
    await evalG(() => {
      const w = window.__game.scene.getScene('World');
      const NPC = window.__NPC_BY_ID;
      const def = (NPC && NPC.celeste) || w.npcs.find((n) => n.def.id === 'celeste')?.def;
      if (def) w.ui.showAppraisal(def.creature, def);
    });
    await wait(900);
    await shot('g3_02_appraisal_celeste');
    await closeAppr();
    await wait(400);
    // Joseph kendine: birkaç eşya kuşanmış
    await evalG(() => {
      const G = window.__G;
      G.p.equipment.weapon = 'cracked_stick';
      G.p.equipment.chest = 'linen_shirt';
      G.p.equipment.boots = 'cloth_shoes';
      G.p.equipment.ring1 = 'gnawed_ring';
      G.invalidate();
      const w = window.__game.scene.getScene('World');
      w.lastAppraiseAt = null;
      w.appraiseSelf();
    });
    await wait(900);
    await shot('g3_03_appraisal_self');
    await closeAppr();
    await wait(400);
    // yaratıklar: fare (G−, drop görünür) ve goblin şefi (F+, oranlar gizli)
    for (const id of ['rat', 'wolf', 'goblin', 'goblin_chief']) {
      await evalG((id) => {
        const w = window.__game.scene.getScene('World');
        const c = window.__createMonster ? window.__createMonster(id) : null;
        const e = w.enemies.find((e) => e.def.id === id);
        const cr = e ? e.c : c;
        if (cr) w.ui.showAppraisal(cr, null);
      }, id);
      await wait(900);
      await shot('g3_04_appraisal_' + id);
      await closeAppr();
      await wait(400);
    }
  }

  // ---------------------------------------------------------------- 2) HUD görev kategorileri ve görev bitiş animasyonu
  if (want('quest')) {
    await evalG(() => {
      const Q = window.__Q;
      Q.start('m_inn', true);
      Q.start('sq_baker_apples', true);
      Q.start('sq_kids_ball', true);
    });
    await wait(1500);
    await shot('g3_10_hud_both');
    log('HUD kutusu:', await evalG(() => window.__game.scene.getScene('UI').questBox?.list.filter((o) => o.type === 'Text').map((t) => t.text).join(' | ')));
    // ana görevleri gizle (Menü → Görevler anahtarıyla aynı yol)
    await evalG(() => { localStorage.setItem('elonth.questbox.main', '0'); window.__game.scene.getScene('UI').questBox.refresh(true); });
    await wait(400);
    await shot('g3_11_hud_side_only');
    await evalG(() => { localStorage.removeItem('elonth.questbox.main'); window.__game.scene.getScene('UI').questBox.refresh(true); });
    // menü → görevler sekmesi (anahtarlar)
    await evalG(() => window.__game.scene.getScene('UI').openMenu('quests'));
    await wait(1200);
    await shot('g3_12_menu_quests');
    await evalG(() => window.__game.scene.getScene('Menu').close());
    await wait(800);
    // yan görev bitişi: para + eşya + EXP (level atlatacak kadar EXP yakın)
    await evalG(() => {
      const G = window.__G;
      G.p.exp = 98;
      window.__Q.complete('sq_baker_apples');
    });
    await wait(1600);
    await shot('g3_13_quest_anim_mid');
    await wait(3500);
    await shot('g3_14_quest_anim_end');
    log('görev sonrası', await evalG(() => ({ lv: window.__G.p.level, exp: window.__G.p.exp, money: window.__G.p.wallet, bun: window.__G.p.inventory.honey_bun })));
    // dokunarak atla: ikinci görev
    await evalG(() => { const ui = window.__game.scene.getScene('UI'); ui.sysQueue.length = 0; ui.sysOverlay?.skip(); });
    await wait(600);
  }

  // ---------------------------------------------------------------- 3) terfi görevi, Celeste'de anında terfi ve animasyon
  if (want('rank')) {
    await evalG(() => {
      const G = window.__G;
      G.setFlag('guild_registered');
      G.setFlag('ch2_start_day', 0);
      G.state.guild.member = true;
      G.p.guildRank = 0;
      G.p.inventory.guild_card = 1;
      G.state.guild.points = 36;
    });
    await wait(300);
    await evalG(() => window.__game.scene.getScene('UI').openMenu('status'));
    await wait(1200);
    await shot('g3_20_guild_card_bar');
    await evalG(() => window.__game.scene.getScene('Menu').close());
    await wait(600);
    // geliştirici modundaki "+10" ile aynı yol: puan eşiğin üstüne, Terfi görevi açılır
    const r1 = await evalG(() => { window.__G.state.guild.points += 10; return window.__Q.checkPromotion(); });
    await wait(700);
    log('eşik sonrası:', r1, 'açık terfi görevi:', await evalG(() => window.__Q.rankupActive()), 'rütbe:', await evalG(() => window.__G.p.guildRank));
    await shot('g3_21_rankup_quest');
    await evalG(() => { const ui = window.__game.scene.getScene('UI'); ui.sysQueue.length = 0; ui.dismissSys(); ui.sysOverlay?.skip(); });
    await wait(500);
    // Celeste'yle konuş
    await evalG(() => { const w = window.__game.scene.getScene('World'); w.director.scene(async () => w.director.ch2.talkCeleste()); });
    await wait(600);
    await h.adv();
    await wait(500);
    await h.adv();
    await wait(2200);
    log('konuşma sırasında rütbe:', await evalG(() => window.__G.p.guildRank), 'overlay:', await evalG(() => !!window.__game.scene.getScene('UI').sysOverlay));
    await shot('g3_22_rankup_anim_mid');
    await wait(3500);
    await shot('g3_23_rankup_anim_end');
    await evalG(() => { const ui = window.__game.scene.getScene('UI'); ui.sysOverlay?.skip(); });
    await h.run([], 40);
    log('terfi sonrası:', await evalG(() => ({ rank: window.__G.p.guildRank, open: window.__Q.rankupActive(), done: Object.keys(window.__G.state.quests.quests).filter((k) => k.startsWith('m_rankup')).map((k) => k + ':' + window.__G.state.quests.quests[k].status) })));
  }

  // ---------------------------------------------------------------- 4) Ayarlar paneli (menü ve başlık ekranı)
  if (want('settings')) {
    await evalG(() => { window.__G.settings.devMode = true; window.__game.scene.getScene('UI').openMenu('settings'); });
    await wait(1200);
    await shot('g3_30_settings_top');
    const sc = await evalG(() => {
      const m = window.__game.scene.getScene('Menu');
      const list = m.content.list.find((o) => o.constructor && o.constructor.name && o.inner && o.setScroll);
      if (!list) return null;
      list.setScroll(9999);
      return { contentH: list.contentH, h: list.h, scroll: list.scrollY };
    });
    log('ayarlar kaydırma:', JSON.stringify(sc));
    await wait(400);
    await shot('g3_31_settings_bottom');
    await evalG(() => window.__game.scene.getScene('Menu').close());
    await wait(800);
  }

  // ---------------------------------------------------------------- 5) envanter ve ekipman: rütbe rozetleri, saygınlık
  if (want('inv')) {
    await evalG(() => {
      const G = window.__G;
      Object.assign(G.p.inventory, { rat_tail: 4, wolf_pelt: 2, color_core: 1, bread: 3, leather_vest: 1, iron_cap: 1 });
      G.p.equipment.weapon = 'cracked_stick';
      G.p.equipment.chest = 'linen_shirt';
      G.invalidate();
      window.__game.scene.getScene('UI').openMenu('inventory');
    });
    await wait(1200);
    await evalG(() => { const m = window.__game.scene.getScene('Menu'); m.invCat = 'all'; m.selItem = 'leather_vest'; m.render(); });
    await wait(600);
    await shot('g3_40_inventory');
    await evalG(() => { const m = window.__game.scene.getScene('Menu'); m.selItem = 'wolf_pelt'; m.render(); });
    await wait(500);
    await shot('g3_41_inventory_material');
    await evalG(() => { const m = window.__game.scene.getScene('Menu'); m.tab = 'status'; m.section = 'equipment'; m.render(); });
    await wait(600);
    await shot('g3_42_status_equipment');
    await evalG(() => { const m = window.__game.scene.getScene('Menu'); m.section = 'all'; m.close(); });
    await wait(600);
  }
};

