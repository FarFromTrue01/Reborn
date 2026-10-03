// 0.3.0 Bölüm II uçtan uca: kayıt → sopa → pano → G1/G2/G3 → yaralılar → kurtlar → G rütbe → kadeh →
// kese → bodrum → 10 gümüş → veda → giriş kartı ve şehir manzarası.
// Çalıştır: URL='http://localhost:4173/?qa=1' node tools/qa/shot.mjs v3ch2
import { helpers } from './helpers.mjs';
export default async ({ page, wait, shot, evalG }) => {
  const h = helpers(page, wait, evalG);
  const state = () => evalG(() => {
    const G = window.__G; const w = window.__game.scene.getScene('World');
    const q = G.state.quests.quests;
    return { day: G.state.time.day, t: G.state.time.minute, map: w.mapData.id, stage: w.director.ch2.stage(), money: G.p.wallet, pts: G.state.guild.points, rank: G.p.guildRank, pend: G.state.guild.pending, party: G.state.party,
      active: Object.values(q).filter((s) => s.status === 'active').map((s) => s.id + ':' + s.progress.join('/')), lock: G.state.flags.spend_lock };
  });
  const log = async (tag) => console.log(tag, JSON.stringify(await state()));
  const setTime = (day, hour) => evalG(([d, hh]) => { const G = window.__G; const w = window.__game.scene.getScene('World'); const nd = d !== G.state.time.day; G.state.time = { day: d, minute: hh * 60 }; if (nd) { window.__R.onNewDay(); w.director.onNewDay(); } }, [day, hour]);
  const load = async (map, x, y) => { await evalG(([m, x, y]) => window.__game.scene.getScene('World').loadMap(m, x, y, 'up'), [map, x, y]); await wait(900); await h.run([], 60); };
  const loadPt = async (pt) => { await evalG((pt) => { const w = window.__game.scene.getScene('World'); const p = w.getWorldPoint(pt); w.loadMap('world', p.x, p.y + 1, 'up'); }, pt); await wait(900); await h.run([], 60); };
  const talk = async (id, choices = []) => {
    const ok = await evalG((id) => { const w = window.__game.scene.getScene('World'); const n = w.npc(id); if (!n) return false; w.player.actor.setPosition(n.x, n.y + 40); w.director.talk(n); return true; }, id);
    if (!ok) { console.log('NPC yok', id); return; }
    await wait(400);
    return h.run(choices, 600);
  };
  const killAll = async (key) => {
    await evalG((key) => { const w = window.__game.scene.getScene('World'); for (const e of w.enemies.filter((e) => e.alive && e.spawnId.startsWith(key))) { e.damageBy.joseph = 1; w.killEnemy(e, null); } }, key);
    await wait(600);
  };

  // ------------------------------------------------------------ kayıt
  await evalG(() => {
    const G = window.__G;
    G.newGame();
    for (const f of ['woke', 'inn_met', 'village_entered', 'bertram_deal', 'bertram_done', 'farm_done', 'guild_seen', 'steward_met', 'checkpoint_seen']) G.setFlag(f);
    G.p.equipment = { chest: 'linen_shirt', pants: 'linen_pants', boots: 'cloth_shoes' };
    G.p.inventory = { linen_shirt: 1, linen_pants: 1, cloth_shoes: 1, torn_shorts: 1 };
    G.p.wallet = { bronze: 112, silver: 0, platinum: 0, gold: 0, diamond: 0 };
    G.state.time = { day: 6, minute: 10 * 60 };
    window.__Q.start('m_register', true);
    window.__game.scene.getScene('Title').scene.start('World', { map: 'guild', x: 7, y: 9, facing: 'up' });
  });
  await wait(3500);
  await h.run([], 40);
  await talk('celeste', [0]);
  await log('kayıt');
  // ------------------------------------------------------------ E1 sopa
  await load('inn', 7, 8);
  await talk('bertram');
  console.log('silah', JSON.stringify(await evalG(() => window.__G.p.equipment.weapon)));
  await setTime(7, 9);
  await load('guild', 7, 9);
  await talk('celeste', [0]);
  await log('pano');
  await shot('ch2_01_board');
  // ------------------------------------------------------------ G1 fareler
  await loadPt('barn_yard');
  await wait(1500);
  console.log('ahır fareleri', await evalG(() => window.__game.scene.getScene('World').enemies.filter((e) => e.spawnId.startsWith('g1')).length));
  await killAll('g1');
  await wait(800);
  await shot('ch2_02_dorn');
  await h.run([0], 300);
  await killAll('g1b');
  await log('G1');
  // ------------------------------------------------------------ G2 otlar
  await evalG(() => { window.__G.p.inventory.herb = 5; });
  await wait(800);
  await load('healer', 4, 6);
  await talk('healer');
  // ------------------------------------------------------------ G3 mektup
  await loadPt('checkpoint');
  await talk('captain');
  await load('guild', 7, 9);
  await talk('celeste'); // G1
  await talk('celeste'); // G2
  await shot('ch2_03_cut');
  await talk('celeste'); // G3
  await log('G bitti');
  // ------------------------------------------------------------ E3 hava, yaralılar
  await loadPt('forest_edge');
  await wait(1500);
  await h.run([0], 400);
  await wait(800);
  await shot('ch2_04_escort');
  await log('yaralılar');
  await evalG(() => { const w = window.__game.scene.getScene('World'); const b = w.director.ch2; void b; });
  await loadPt('door_healer');
  await wait(1200);
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.loadMap('healer', 4, 7, 'up'); });
  await wait(1200);
  await h.run([0], 300);
  await log('şifacı');
  // ------------------------------------------------------------ E4 dostluk, kurtlar
  await setTime(8, 13);
  await load('guild', 7, 9);
  await talk('lina', [0]);
  await log('kurt görevi');
  await loadPt('pasture');
  await wait(1500);
  await h.run([], 300);
  await shot('ch2_05_wolves');
  await wait(2500);
  await shot('ch2_06_wolves_fight');
  await killAll('fw');
  await log('kurtlar');
  await load('guild', 7, 9);
  await talk('celeste');
  await log('rapor');
  await setTime(9, 10);
  await wait(500);
  await h.run([], 100);
  await talk('celeste');
  await log('terfi');
  await setTime(9, 18.5);
  await load('inn', 7, 10);
  await wait(800);
  await h.run([], 300);
  await shot('ch2_07_celebrate');
  await log('kadeh');
  // ------------------------------------------------------------ E5 kese
  await setTime(10, 9);
  await loadPt('plaza');
  await wait(2000);
  await h.run([], 300);
  await log('hırsızlık');
  for (const id of ['vagrant', 'beggar', 'apprentice', 'washer']) {
    await evalG((id) => { const w = window.__game.scene.getScene('World'); const n = w.npc(id); if (!n) return; w.player.actor.setPosition(n.x, n.y + 40); w.lastAppraiseAt = null; w.appraise(n.def.creature, n.def, n, true); }, id);
    await wait(900);
    if (id === 'washer') await shot('ch2_08_appraise_thief');
    await evalG(() => window.__game.scene.getScene('UI').closeAppraisal());
    await wait(1200);
    await h.run([], 60);
  }
  await log('incelendi');
  await talk('guard_hob', [0]);
  await talk('guard_hob', [3]);
  await log('kese');
  // ------------------------------------------------------------ E6 bodrum
  await setTime(11, 13);
  await load('guild', 7, 9);
  await talk('vera', [0]);
  await loadPt('mill_yard');
  await wait(1200);
  await h.run([], 100);
  await evalG(() => { const w = window.__game.scene.getScene('World'); w.loadMap('mill_cellar', 4, 8, 'up'); });
  await wait(1500);
  await h.run([], 200);
  await shot('ch2_09_cellar');
  await killAll('fc');
  await load('guild', 7, 9);
  await talk('celeste');
  await log('bodrum');
  // ------------------------------------------------------------ E7/E8
  await evalG(() => { window.__R.giveMoney(1000, 'QA', true); });
  await wait(1500);
  await h.run([], 60);
  await load('inn', 7, 8);
  await talk('bertram', [1]);
  await log('veda');
  await loadPt('checkpoint');
  await talk('captain', [0], 900);
  const r = h.run([0], 900, async (s, i) => { if (i === 30) await shot('ch2_10_city'); });
  await r;
  await log('son');
  console.log('kartlar', JSON.stringify(await evalG(() => window.__G.state.cards)));
};
