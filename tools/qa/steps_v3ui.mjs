// 0.3.0 arayüz turu: HUD (Level/rütbe kutuları, Görevler kutusu, yön oku), Appraisal paneli (NPC + kendine),
// diyalog isim satırı, Status (Saygınlık, lonca kartı), envanter (Giriş Kartları), Görevler sekmesi, harita simgeleri,
// ayarlar, geliştirici paneli, rütbe rozetleri.
export default async ({ page, wait, shot, evalG }) => {
  await evalG(() => {
    const G = window.__G;
    G.newGame();
    for (const f of ['woke', 'inn_met', 'village_entered', 'bertram_deal', 'bertram_done', 'farm_done', 'guild_registered', 'checkpoint_seen', 'camp_seen', 'steward_met']) G.setFlag(f);
    G.p.equipment = { chest: 'linen_shirt', pants: 'linen_pants', boots: 'cloth_shoes', weapon: 'cracked_stick' };
    G.p.inventory = { bread: 3, hot_stew: 1, herb: 2, guild_card: 1, leather_vest: 1 };
    G.p.guildRank = 0;
    G.state.guild.member = true;
    G.state.guild.points = 30;
    G.p.wallet.bronze = 64;
    G.p.skills[0].exp = 2.5;
    G.state.cards.push({ city: 'capital', from: 3, until: 86, boughtDay: 3 });
    G.state.time = { day: 3, minute: 11 * 60 };
    G.settings.devMode = true;
    const Q = window.__Q;
    Q.start('m_grank', true);
    Q.start('g2_herbs', true);
    Q.advance('g2_herbs', 0, 2);
    Q.start('m_inn', true);
    window.__game.scene.getScene('Title').scene.start('World', { map: 'world', x: 84, y: 64, facing: 'down' });
  });
  await wait(3500);
  await shot('v3ui_01_hud');
  // yön oku: takip = m_inn (hana git)
  console.log('target', JSON.stringify(await evalG(() => window.__game.scene.getScene('World').questTargetPx())));
  // Appraisal: en yakın NPC
  await evalG(() => { const w = window.__game.scene.getScene('World'); const n = w.npcs.find((n) => n.def.id !== 'captain'); w.player.actor.setPosition(n.x, n.y + 40); w.appraise(n.def.creature, n.def, n, true); });
  await wait(900);
  await shot('v3ui_02_appraisal_npc');
  console.log('frozen', await evalG(() => window.__game.scene.getScene('World').frozen));
  await evalG(() => window.__game.scene.getScene('UI').closeAppraisal());
  await wait(400);
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.lastAppraiseAt = null; w.appraiseSelf(); });
  await wait(900);
  await shot('v3ui_03_appraisal_self');
  await evalG(() => window.__game.scene.getScene('UI').closeAppraisal());
  // Diyalog isim satırı
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.director.scene(async () => { await w.ui.say('bertram', 'Kılıç alacak paran olunca kılıç taşırsın.'); }); });
  await wait(1500);
  await shot('v3ui_04_dialogue_bertram');
  await evalG(() => window.__game.scene.getScene('UI').advanceDialogue());
  await evalG(() => window.__game.scene.getScene('UI').advanceDialogue());
  await wait(500);
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.director.scene(async () => { await w.ui.say('captain', 'Dur. Bu yol kraliyet şehrine çıkar.'); }); });
  await wait(1500);
  await shot('v3ui_05_dialogue_captain');
  await evalG(() => window.__game.scene.getScene('UI').advanceDialogue());
  await evalG(() => window.__game.scene.getScene('UI').advanceDialogue());
  await wait(500);
  // Menü
  const menu = async (tab, name, extra) => {
    await evalG(([tab, extra]) => { const ui = window.__game.scene.getScene('UI'); if (!ui.menuIsOpen) ui.openMenu(tab); else { const m = window.__game.scene.getScene('Menu'); m.tab = tab; if (extra) Object.assign(m, extra); m.render(); } }, [tab, extra]);
    await wait(1200);
    await shot(name);
  };
  await menu('status', 'v3ui_06_status');
  console.log('world visible in menu', await evalG(() => window.__game.scene.isVisible('World')), 'frozen', await evalG(() => window.__game.scene.getScene('World').frozen));
  await menu('inventory', 'v3ui_07_inventory', { selItem: 'leather_vest' });
  await menu('inventory', 'v3ui_08_cards', { invCat: 'cards' });
  await menu('quests', 'v3ui_09_quests', { selQuest: 'g2_herbs' });
  await menu('map', 'v3ui_10_map');
  await menu('settings', 'v3ui_11_settings');
  await menu('dev', 'v3ui_12_dev');
  await evalG(() => window.__game.scene.getScene('Menu').close());
  await wait(800);
  console.log('after close: visible', await evalG(() => window.__game.scene.isVisible('World')), 'frozen', await evalG(() => window.__game.scene.getScene('World').frozen));
  // Geliştirici modu NPC Saygınlık etiketleri
  await evalG(() => { const w = window.__game.scene.getScene('World'); const n = w.npcs[0]; w.player.actor.setPosition(n.x + 40, n.y + 10); });
  await wait(1200);
  await shot('v3ui_13_dev_tags');
};
