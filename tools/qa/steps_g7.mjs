// Grup 7 (0.11.0) uçtan uca QA: window.__qa betik API'si ile (kontrol noktaları, ışınlanma, yaratık doğurma,
// ölümsüzlük). Dövüş (A1–A9), hatalar (B1–B3, B7, B8), oyuncu notları (C1–C16), kayıt yuvaları (D), kontrol
// noktaları (E). Ekran görüntüleri tools/qa/g7/.
// Çalıştır: npm run build && npx vite preview --port 4173 & ;
//   URL='http://localhost:4173/?qa=1' DPR=1 OUT=tools/qa/g7 node tools/qa/shot.mjs g7
// ONLY=cp,combat,b,c,d ile bölüm seçilebilir.
import { helpers } from './helpers.mjs';

export default async ({ page, wait, shot, evalG }) => {
  const h = helpers(page, wait, evalG);
  const log = (...a) => console.log(...a);
  const only = (process.env.ONLY || '').split(',').filter(Boolean);
  const want = (k) => !only.length || only.includes(k);
  const problems = [];
  const check = (ok, what) => { log(ok ? '  ✓' : '  ✗', what); if (!ok) problems.push(what); };
  const W = (fn, arg) => evalG(fn, arg);
  const qa = (name, ...args) => W(([n, a]) => window.__qa[n](...a), [name, args]);
  const cp = async (id) => {
    const ok = await W((id) => window.__qa.checkpoint(id), id);
    await h.frames(8);
    return ok;
  };
  const key = async (k, ms = 80) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); };
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
  const uiToScreen = async (x, y) => W(([x, y]) => { const D = window.__Display; return [x * D.uiZoom / D.dpr, y * D.uiZoom / D.dpr]; }, [x, y]);
  const clickUi = async (x, y) => { const [sx, sy] = await uiToScreen(x, y); await page.mouse.click(sx, sy); };
  const clickText = async (sceneKey, re) => { const t = await findText(sceneKey, re); if (t) await clickUi(t[0], t[1]); return !!t; };
  /** Görevin oku (dünya pikseli) ve oyuncu. */
  const arrow = () => W(() => {
    const w = window.__game.scene.getScene('World');
    const t = w.questTargetPx();
    return { map: w.mapData.id, t };
  });
  /** Oyuncuyu bir düşmana göre konumla (karo cinsinden kayma) ve tut. */
  const placeJoseph = (x, y) => W(([x, y]) => {
    const w = window.__game.scene.getScene('World');
    const a = w.player.actor;
    a.body.reset(x, y);
  }, [x, y]);
  const enemy = (uid) => W((uid) => {
    const w = window.__game.scene.getScene('World');
    const e = w.enemies.find((e) => e.uid === uid);
    return e ? { state: e.state, hp: e.c.hp, x: e.x, y: e.y, alive: e.alive, stagger: e.stagger.fill, stunned: e.stunned, shape: e.shape } : null;
  }, uid);
  const clearEnemies = () => W(() => {
    const w = window.__game.scene.getScene('World');
    for (const e of w.enemies) { e.setState('dead'); e.destroy(); }
    w.enemies.length = 0;
  });

  /** Dünya haritasında 9×5 karelik boş (yürünebilir, ağaçsız) bir alana ışınlan (dövüş denemeleri için). */
  const tpOpen = async () => {
    const [x, y] = await W(() => {
      const w = window.__game.scene.getScene('World');
      const m = w.mapData.id === 'world' ? w.mapData : null;
      return [m ? 1 : 0, 0];
    });
    if (!x) await h.tp('world', 60, 48, 'down');
    const spot = await W(() => {
      const w = window.__game.scene.getScene('World');
      const m = w.mapData;
      const free = (x, y) => x > 0 && y > 0 && x < m.w && y < m.h && !m.solid[y * m.w + x] && m.terrain[y * m.w + x] !== 8 && !w.r.occluders.covers(x * 32 + 16, y * 32 + 22, 6);
      for (let r = 0; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const cx = 60 + dx, cy = 48 + dy;
        let ok = true;
        for (let yy = -2; yy <= 2 && ok; yy++) for (let xx = -4; xx <= 4 && ok; xx++) if (!free(cx + xx, cy + yy)) ok = false;
        if (ok) return [cx, cy];
      }
      return [60, 48];
    });
    await h.tp('world', spot[0], spot[1], 'down');
    return spot;
  };
  /** Adıyla (setName) bir Button'a bas. */
  const pressNamed = (sceneKey, name) => W(([k, name]) => {
    const sc = window.__game.scene.getScene(k);
    let hit = null;
    const walk = (list) => { for (const o of list) { if (o.name === name) hit = o; if (o.list) walk(o.list); } };
    walk(sc.children.list);
    if (!hit) return false;
    const ev = { stopPropagation() {} };
    hit.emit('pointerdown', {}, 0, 0, ev); hit.emit('pointerup', {}, 0, 0, ev);
    return true;
  }, [sceneKey, name]);
  /** Metni içeren Button'a bas (Button kapsayıcısı metnin ebeveyni). */
  const pressText = (sceneKey, re) => W(([k, re]) => {
    const sc = window.__game.scene.getScene(k);
    let hit = null;
    const walk = (list, parent) => { for (const o of list) { if (!hit && o.type === 'Text' && new RegExp(re).test(o.text) && parent && parent.emit && parent.listenerCount('pointerup')) hit = parent; if (o.list) walk(o.list, o); } };
    walk(sc.children.list, null);
    if (!hit) return false;
    const ev = { stopPropagation() {} };
    hit.emit('pointerdown', {}, 0, 0, ev); hit.emit('pointerup', {}, 0, 0, ev);
    return true;
  }, [sceneKey, re]);
  /** Kapsayıcıdaki metinler üst üste biniyor mu / kutudan taşıyor mu? */
  const textOverlaps = (getter) => W((src) => {
    const c = new Function('return ' + src)()();
    if (!c) return { n: 0, overlaps: -1 };
    const texts = [];
    const walk = (list) => { for (const o of list) { if (o.type === 'Text' && o.visible && o.text) texts.push(o.getBounds()); if (o.list) walk(o.list); } };
    walk(c.list);
    let overlaps = 0;
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if (a.x < b.right - 1 && b.x < a.right - 1 && a.y < b.bottom - 1 && b.y < a.bottom - 1) overlaps++;
    }
    const box = c.getBounds();
    const outside = texts.filter((t) => t.bottom > box.bottom + 1 || t.right > box.right + 1 || t.x < box.x - 1).length;
    return { n: texts.length, overlaps, outside, box: { x: box.x, y: box.y, w: box.width, h: box.height } };
  }, getter.toString());

  // =========================================================================== D: kayıt yuvaları (başlık ekranından)
  if (want('d')) await sectionD();

  // =========================================================================== E: kontrol noktaları
  if (want('cp')) {
    log('== E: kontrol noktaları');
    const list = await W(() => window.__qa.checkpoints());
    check(list.length === 8, `8 kontrol noktası (${list.length})`);
    for (const c of list) {
      const ok = await cp(c.id);
      await h.frames(20);
      const s = await qa('state');
      const ar = await arrow();
      const objective = s.quests.find((q) => q.id.startsWith('m_'))?.objective ?? s.quests[0]?.objective ?? null;
      check(ok && !!s.map, `${c.name}: başladı (${s.map} ${s.x},${s.y}, ${s.time})`);
      check(!!objective, `${c.name}: sıradaki görev amacı "${objective}"`);
      check(!!ar.t || s.map !== 'world', `${c.name}: ok hedefi var (${ar.t ? Math.round(ar.t.x / 32) + ',' + Math.round(ar.t.y / 32) : '-'})`);
      await shot(`g7_e_cp_${c.id}`);
      // açılış sahnesi varsa bitsin (sonraki noktaya temiz geçilsin)
      await h.run([], 120, null, { start: 600 });
    }
    check((await qa('errors')).length === 0, 'kontrol noktalarında hata kaydı boş');
  }

  // =========================================================================== A: dövüş
  if (want('combat')) {
    log('== A: dövüş');
    await cp('registered');
    await tpOpen();
    await h.run([], 60, null, { start: 300 });
    await qa('clock', 1, true);
    await clearEnemies();
    // yumruk (A9): silahı çıkar
    await W(() => { const G = window.__G; G.p.equipment.weapon = null; G.invalidate(); });
    const me = await qa('state');
    const px = me.x * 32 + 16, py = me.y * 32 + 22;

    // A1: hazırlanırken vurulan fare saldırısına devam eder
    {
      await qa('god', true);
      const [uid] = await qa('spawn', 'rat', me.x + 1, me.y);
      await W((uid) => { const e = window.__game.scene.getScene('World').enemies.find((e) => e.uid === uid); e.becomeAware(false); }, uid);
      const gotWindup = await h.until((uid) => window.__game.scene.getScene('World').enemies.find((e) => e.uid === uid)?.state === 'windup', uid, 8000, 30);
      check(gotWindup, 'A1: fare hazırlığa geçti');
      await W((uid) => {
        const w = window.__game.scene.getScene('World');
        const e = w.enemies.find((e) => e.uid === uid);
        w.__states = [];
        w.__hook = () => w.__states.push(e.state);
        w.events.on('postupdate', w.__hook);
        w.hitEnemy(e, { dir: new window.Phaser.Math.Vector2(e.x - w.player.actor.x, e.y - w.player.actor.y).normalize(), physical: true });
      }, uid);
      await h.until(() => window.__game.scene.getScene('World').__states.includes('strike') || window.__game.scene.getScene('World').__states.includes('recover'), null, 4000, 50);
      const states = await W(() => { const w = window.__game.scene.getScene('World'); w.events.off('postupdate', w.__hook); return [...new Set(w.__states)]; });
      check(states.includes('strike') && !states.includes('hurt'), `A1: vurulan fare saldırısına devam etti (${states.join('→')})`);
      await clearEnemies();
    }

    // A2: kırmızı alanın dışı vurulmaz, içi vurulur (kare kare postupdate ile Joseph yerinde tutulur)
    for (const where of ['side', 'back', 'inside']) {
      await qa('god', true);
      await placeJoseph(px, py);
      const [uid] = await qa('spawn', 'rat', me.x + 1, me.y);
      await W((uid) => { const e = window.__game.scene.getScene('World').enemies.find((e) => e.uid === uid); e.becomeAware(false); }, uid);
      await h.until((uid) => window.__game.scene.getScene('World').enemies.find((e) => e.uid === uid)?.state === 'windup', uid, 8000, 20);
      const r = await W(([uid, where]) => {
        const w = window.__game.scene.getScene('World');
        const e = w.enemies.find((e) => e.uid === uid);
        const s = e.shape;
        const dx = Math.cos(s.angle ?? 0), dy = Math.sin(s.angle ?? 0);
        const R = s.r ?? 40;
        // yan: yöne dik 1,2 karo; arka: düşmanın 1 karo arkası; iç: yön boyunca yarıçapın yarısı
        const off = where === 'side' ? [-dy * 1.2 * 32, dx * 1.2 * 32] : where === 'back' ? [-dx * 32, -dy * 32] : [dx * R * 0.5, dy * R * 0.5];
        const tx = s.x + off[0], ty = s.y + off[1];
        w.__inc = 0; w.__frames = 0;
        if (!w.__origInc) w.__origInc = w.resolveIncoming;
        w.resolveIncoming = (...a) => { w.__inc++; return w.__origInc.apply(w, a); };
        w.__hold = () => {
          const a = w.player.actor;
          a.body.reset(tx, ty);
          if (e.state === 'windup' || e.state === 'strike') w.__frames++;
        };
        w.events.on('postupdate', w.__hold);
        return { tx, ty, kind: s.kind };
      }, [uid, where]);
      await h.until((uid) => { const e = window.__game.scene.getScene('World').enemies.find((e) => e.uid === uid); return e && (e.state === 'recover' || e.state === 'chase'); }, uid, 6000, 30);
      if (where === 'inside') await shot('g7_a2_inside_hit');
      const res = await W(() => {
        const w = window.__game.scene.getScene('World');
        w.events.off('postupdate', w.__hold);
        w.resolveIncoming = w.__origInc;
        return { inc: w.__inc, frames: w.__frames };
      });
      check(where === 'inside' ? res.inc === 1 : res.inc === 0, `A2: Joseph ${where === 'inside' ? 'alanın içinde → vuruldu' : (where === 'side' ? 'yanda' : 'arkada') + ' (alan dışı) → vurulmadı'} (isabet ${res.inc}, ${res.frames} kare, ${r.kind})`);
      await clearEnemies();
    }

    // A4: üç fareden yalnızca biri saldırır, ikisi çevrede dolaşır
    {
      await qa('god', true);
      await placeJoseph(px, py);
      const uids = await qa('spawn', 'rat', me.x + 3, me.y, 3);
      await W((uids) => { for (const e of window.__game.scene.getScene('World').enemies) if (uids.includes(e.uid)) e.becomeAware(false); }, uids);
      await W(() => {
        const w = window.__game.scene.getScene('World');
        w.__maxAtk = 0; w.__circ = 0; w.__n = 0;
        w.__q = () => {
          const atk = w.enemies.filter((e) => e.alive && (e.state === 'windup' || e.state === 'strike')).length;
          w.__maxAtk = Math.max(w.__maxAtk, atk);
          if (w.enemies.some((e) => e.state === 'circle')) w.__circ++;
          w.__n++;
        };
        w.events.on('postupdate', w.__q);
      });
      await h.until(() => window.__game.scene.getScene('World').enemies.filter((e) => e.state === 'circle').length >= 2, null, 8000, 50);
      await qa('debug', true);
      await h.frames(4);
      await shot('g7_a4_queue_circling_debug');
      await qa('debug', false);
      await h.frames(4);
      await shot('g7_a4_queue_circling');
      await h.gameSec(4);
      const q = await W(() => { const w = window.__game.scene.getScene('World'); w.events.off('postupdate', w.__q); return { max: w.__maxAtk, circ: w.__circ, n: w.__n, limit: w.queueLimit() }; });
      check(q.limit === 1 && q.max <= 1, `A4: aynı anda en çok bir saldırı (en çok ${q.max}, sınır ${q.limit})`);
      check(q.circ > q.n * 0.3, `A4: sırada bekleyenler çevrede dolaşıyor (${q.circ}/${q.n} kare)`);
      await clearEnemies();
    }

    // A3/A5: sendeleme ve sersemleme; 3. vuruş; tuşa sürekli basmak zinciri hızlandırmaz
    {
      await qa('god', true);
      await W(() => { const G = window.__G; G.p.equipment.weapon = 'cracked_stick'; G.invalidate(); });
      await placeJoseph(px, py);
      const [uid] = await qa('spawn', 'slime', me.x + 1, me.y);
      await W((uid) => { const w = window.__game.scene.getScene('World'); const e = w.enemies.find((e) => e.uid === uid); e.setState('idle'); e.aware = false; w.__heal = () => { e.c.hp = e.d.maxHp; }; w.events.on('postupdate', w.__heal); }, uid);
      // oyuncu sağa baksın
      await W(() => { const w = window.__game.scene.getScene('World'); w.player.actor.face('right'); });
      // spam: 2 sn boyunca her 40 ms J — 3 vuruşluk zincirin süresi ~3 sn'den kısa olmamalı
      await W(() => {
        const w = window.__game.scene.getScene('World');
        w.__sw = [];
        if (!w.__origStrike) w.__origStrike = w.playerStrike;
        w.playerStrike = (heavy, dir) => { w.__sw.push({ t: w.playClock, step: w.player.swingStep, heavy, dur: w.player.attackDur }); return w.__origStrike.call(w, heavy, dir); };
      });
      // oyun saatiyle 3,5 sn boyunca sürekli bas (başsız tarayıcıda kare hızı düşük olabilir)
      const c0 = await W(() => window.__game.scene.getScene('World').playClock);
      for (let i = 0; i < 400; i++) {
        await key('KeyJ', 15);
        await wait(15);
        if ((await W(() => window.__game.scene.getScene('World').playClock)) - c0 > 3.5) break;
      }
      const sw = await W(() => { const w = window.__game.scene.getScene('World'); return w.__sw; });
      const gaps = sw.slice(1).map((s, i) => +(s.t - sw[i].t).toFixed(2));
      check(sw.length >= 3 && sw.length <= 6, `A5: 3,5 sn (oyun saati) spam ile ${sw.length} vuruş (aralar ${gaps.join(', ')} sn)`);
      check(gaps.every((g, i) => g >= sw[i].dur - 0.06), `A5: spam zinciri hızlandırmıyor (her ara ≥ savuruş süresi: ${sw.map((x) => x.dur.toFixed(2)).join(', ')} sn; bir kare payı)`);
      check(sw.some((s) => s.step === 2), 'A5: 3. vuruş (bitirici) geldi');
      // sersemlet: sendeleme doldur
      await h.gameSec(1);
      await W((uid) => { const w = window.__game.scene.getScene('World'); const e = w.enemies.find((e) => e.uid === uid); const dir = new window.Phaser.Math.Vector2(1, 0); for (let i = 0; i < 6 && !e.stunned; i++) { w.hitEnemy(e, { dir, physical: true, stagger: 3 }); e.c.hp = e.d.maxHp; } }, uid);
      await h.frames(10);
      const e1 = await enemy(uid);
      check(e1?.stunned, `A3: sendeleme barı doldu → sersemledi (${e1?.state})`);
      await shot('g7_a3_stunned');
      await W(() => { const w = window.__game.scene.getScene('World'); w.playerStrike = w.__origStrike; w.events.off('postupdate', w.__heal); });
      await clearEnemies();
    }

    // A6: ağır şarj (basılı tut → halka; erken bırak → boşa)
    {
      await placeJoseph(px, py);
      await W(() => { window.__G.p.stamina = window.__G.d.maxStamina; });
      await page.keyboard.down('KeyK');
      await h.gameSec(0.3);
      const st = await W(() => window.__game.scene.getScene('World').player.state);
      await shot('g7_a6_charge_ring');
      await h.gameSec(0.4);
      await W(() => { const w = window.__game.scene.getScene('World'); w.__heavy = 0; if (!w.__origStrike) w.__origStrike = w.playerStrike; w.playerStrike = (heavy, dir) => { if (heavy) w.__heavy++; return w.__origStrike.call(w, heavy, dir); }; });
      await page.keyboard.up('KeyK');
      await h.gameSec(1.2);
      const heavy = await W(() => { const w = window.__game.scene.getScene('World'); w.playerStrike = w.__origStrike; return w.__heavy; });
      check(st === 'charge', `A6: K basılıyken şarj (${st})`);
      check(heavy === 1, 'A6: dolunca bırakınca ağır vuruş');
    }

    // A7: kusursuz kaçış → karşı pencerede kesin kritik
    {
      await qa('god', false);
      await placeJoseph(px, py);
      const [uid] = await qa('spawn', 'rat', me.x + 1, me.y);
      await W((uid) => { const w = window.__game.scene.getScene('World'); const e = w.enemies.find((e) => e.uid === uid); e.c.hp = 9999; e.becomeAware(false); }, uid);
      await h.until((uid) => window.__game.scene.getScene('World').enemies.find((e) => e.uid === uid)?.state === 'windup', uid, 8000, 20);
      // vuruş anına kadar bekle, sonra kaç: pencereyi doğrudan çağırarak (kare hızından bağımsız)
      const r = await W((uid) => {
        const w = window.__game.scene.getScene('World');
        const e = w.enemies.find((e) => e.uid === uid);
        w.perfectDodge(e);
        const before = w.player.counterT;
        let crit = false;
        const orig = w.fx.number.bind(w.fx);
        w.fx.number = (x, y, t, k) => { if (k === 'crit') crit = true; return orig(x, y, t, k); };
        w.hitEnemy(e, { dir: new window.Phaser.Math.Vector2(1, 0), physical: true });
        w.fx.number = orig;
        return { before, crit, after: w.player.counterT };
      }, uid);
      check(r.before >= 0.59 && r.crit, `A7: kusursuz kaçış sonrası ${r.before.toFixed(2)} sn pencere, ilk vuruş kesin kritik`);
      await clearEnemies();
    }

    // A9: yumrukla fare 3 vuruş, sümüksü 6 vuruş
    {
      await W(() => { const G = window.__G; G.p.equipment.weapon = null; G.invalidate(); });
      for (const [m, n] of [['rat', 3], ['slime', 6]]) {
        await placeJoseph(px, py);
        // level 0 yaratık (sümüksü 0–1 level doğar): olana kadar yeniden doğur
        let uid = null;
        for (let k = 0; k < 20 && uid === null; k++) {
          const [u] = await qa('spawn', m, me.x + 1, me.y);
          const lv = await W((u) => window.__game.scene.getScene('World').enemies.find((e) => e.uid === u).level, u);
          if (lv === 0) uid = u;
          else await clearEnemies();
        }
        // ıskalar ve kritikler sayılmaz: tipik (en sık) hasarla kaç vuruşta düştüğü
        const r = await W((uid) => {
          const w = window.__game.scene.getScene('World');
          const e = w.enemies.find((e) => e.uid === uid);
          const max = e.d.maxHp;
          const dmg = [];
          for (let i = 0; i < 40; i++) {
            const hp = e.c.hp;
            w.hitEnemy(e, { dir: new window.Phaser.Math.Vector2(1, 0), physical: true });
            if (e.c.hp < hp) dmg.push(+(hp - e.c.hp).toFixed(2));
            e.c.hp = max;
            e.stagger.fill = 0;
            if (e.state === 'stunned' || e.state === 'hurt') e.setState('idle');
          }
          const freq = {};
          for (const d of dmg) freq[d] = (freq[d] ?? 0) + 1;
          const mode = +Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
          e.c.hp = 0.01;
          w.hitEnemy(e, { dir: new window.Phaser.Math.Vector2(1, 0), physical: true });
          return { max, mode };
        }, uid);
        const hits = Math.ceil(r.max / r.mode);
        check(hits === n, `A9: yumrukla level 0 ${m} ${hits} vuruşta düşer (HP ${r.max}, vuruş ${r.mode}; beklenen ${n})`);
        await h.frames(30);
        await clearEnemies();
      }
    }
    await qa('clock', 1, false);
    await qa('god', false);
  }

  // =========================================================================== B: hatalar
  if (want('b')) {
    log('== B: hatalar');
    await cp('registered');
    await h.run([], 60, null, { start: 300 });
    // B1: kaybolan bildirim HUD yüksekliği değişse de yok olur
    {
      await W(() => window.__G.events.emit('toast', { text: 'Ekmek yendi', kind: 'info', icon: 'bread' }));
      await h.until(() => window.__game.scene.getScene('UI').toastStack.entries.some((e) => e.fading), null, 8000, 50);
      // kaybolurken HUD boyunu değiştir (Tokluk uyarısı aç/kapa)
      for (let i = 0; i < 6; i++) {
        await W((i) => { window.__G.state.satiety = i % 2 ? 90 : 10; }, i);
        await h.frames(2);
      }
      await W(() => { window.__G.state.satiety = 90; });
      await h.until(() => window.__game.scene.getScene('UI').toasts.length === 0, null, 6000, 100);
      const left = await W(() => window.__game.scene.getScene('UI').toasts.length);
      check(left === 0, `B1: HUD yüksekliği değişirken kaybolan bildirim yok oldu (kalan ${left})`);
    }
    // B2: uzun satırlı bildirim, art arda üç bildirim, menüde bildirim
    {
      const sys = (title, lines) => W(([t, l]) => window.__G.events.emit('sysmsg', { title: t, lines: l }), [title, lines]);
      const cur = () => window.__game.scene.getScene('UI').sysFlow.current;
      const placement = () => W(() => {
        const ui = window.__game.scene.getScene('UI');
        const c = ui.sysFlow.current;
        if (!c) return null;
        const b = c.getBounds();
        return { x: b.x, y: b.y, r: b.right, b: b.bottom, panelR: 316, panelB: ui.hudPanelH + 12, clockX: ui.hudClockX };
      });
      await sys('APPRAISAL', ['Fare (G-) — küçük, ürkek bir kemirgen. Ahırlarda ve tarlalarda sürüler hâlinde yaşar; tek başına zararsızdır ama kalabalıkken tehlikeli olabilir.', 'Appraisal EXP · +2', 'Yeni hedef: Ansiklopediye eklendi']);
      await h.frames(12);
      const o1 = await textOverlaps(cur);
      const p1 = await placement();
      await shot('g7_b2_long_line');
      check(o1.n >= 3 && o1.overlaps === 0 && o1.outside === 0, `B2: uzun satırlı bildirimde üst üste binme/taşma yok (${o1.n} yazı, ${o1.overlaps} çakışma, ${o1.outside} taşma)`);
      check(!!p1 && (p1.x >= p1.panelR || p1.y >= p1.panelB) && (p1.r <= p1.clockX || p1.y >= 100), `B2: kutu sol panel ve saat kutusuna binmiyor (${p1 && Math.round(p1.x)}–${p1 && Math.round(p1.r)}, saat ${p1?.clockX})`);
      await W(() => window.__game.scene.getScene('UI').sysFlow.dismiss());
      await h.until(() => !window.__game.scene.getScene('UI').sysFlow.current, null, 4000, 50);
      await sys('LEVEL ATLADIN!', ['Level · 1 → 2', 'Stat puanı · +4', 'SP · +1', 'Max HP · 10 → 18']);
      await sys('SKILL RÜTBESİ', ['Kaçınma · G- → G']);
      await sys('DIVINE LEVEL', ['Divine level · 1 → 2', 'Max Işık · 100 → 110']);
      for (const name of ['level', 'skill', 'divine']) {
        await h.frames(10);
        const o = await textOverlaps(cur);
        await shot(`g7_b2_seq_${name}`);
        check(o.overlaps === 0 && o.outside === 0, `B2: art arda bildirim (${name}): çakışma ${o.overlaps}, taşma ${o.outside}`);
        await W(() => window.__game.scene.getScene('UI').sysFlow.dismiss());
        await h.frames(6);
      }
      await W(() => window.__game.scene.getScene('UI').openMenu('status'));
      await h.until(() => window.__game.scene.isActive('Menu'), null, 5000);
      await h.frames(10);
      await W(() => window.__game.scene.getScene('Menu').showNotice({ title: 'YENİ SKILL', lines: ['Kılıç Ustalığı · G-', 'Sistem Teklifi ile öğrenildi.'] }));
      await h.frames(10);
      const o3 = await textOverlaps(() => window.__game.scene.getScene('Menu').notices.at(-1));
      await shot('g7_b2_menu_notice');
      check(o3.n >= 2 && o3.overlaps === 0, `B2: menüde bildirim aynı tasarımda, çakışma yok (${o3.n} yazı)`);
      await W(() => window.__game.scene.getScene('UI').closeMenu());
      await h.until(() => !window.__game.scene.isActive('Menu'), null, 5000);
    }
    // B3: level ve Divine level birlikte atlayınca iki iç ses sırayla
    {
      await tpOpen();
      await h.run([], 60, null, { start: 300 });
      await W(() => {
        const w = window.__game.scene.getScene('World');
        const G = window.__G;
        delete G.state.flags.thought_level; delete G.state.flags.thought_divine;
        w.__bub = [];
        w.__bh = () => {
          const v = [...w.bubbleViews.entries()].filter(([a]) => a === w.player.actor).map(([, c]) => c.list.find((o) => o.type === 'Text')?.text);
          if (v.length) w.__bub.push(v.length + ':' + v[0].slice(0, 12));
        };
        w.events.on('postupdate', w.__bh);
        window.__R.gainExp(1000);
        window.__R.gainDivineExp(1000, 'qa');
      });
      await h.gameSec(3);
      await shot('g7_b3_first_bubble');
      await h.until(() => { const w = window.__game.scene.getScene('World'); return new Set(w.__bub.map((b) => b.slice(2))).size >= 2; }, null, 20000, 100);
      await shot('g7_b3_second_bubble');
      const bub = await W(() => { const w = window.__game.scene.getScene('World'); w.events.off('postupdate', w.__bh); return w.__bub; });
      const seq = [...new Set(bub.map((b) => b.slice(2)))];
      check(bub.every((b) => b.startsWith('1:')), 'B3: aynı anda tek balon');
      check(seq.length >= 2, `B3: iki iç ses sırayla: ${seq.join(' → ')}`);
    }
    // B7: lonca panosu ve rütbe tahtası HUD'un altında kalmıyor
    {
      for (const [x, y, nm] of [[11, 3, 'board'], [6, 3, 'ranks']]) {
        await h.tp('guild', x, y, 'up');
        await h.frames(30);
        const r = await W(() => {
          const w = window.__game.scene.getScene('World');
          const ui = window.__game.scene.getScene('UI');
          const D = window.__Display;
          const cam = w.cameras.main;
          const toCss = (wx, wy) => [(wx - cam.worldView.x) * cam.zoom / D.dpr, (wy - cam.worldView.y) * cam.zoom / D.dpr];
          const uiCss = (x, y) => [x * D.uiZoom / D.dpr, y * D.uiZoom / D.dpr];
          const W2 = D.uiW;
          const huds = [
            [uiCss(0, 0), uiCss(316, ui.hudPanelH + 12)],
            [uiCss(ui.hudClockX, 0), uiCss(W2, 104)],
            [uiCss(W2 - 196, 0), uiCss(W2, 252)],
          ];
          const boards = [[11, 1], [6, 1]].map(([tx, ty]) => [toCss(tx * 32, ty * 32), toCss(tx * 32 + 32, ty * 32 + 32)]);
          const hit = (a, b) => a[0][0] < b[1][0] && b[0][0] < a[1][0] && a[0][1] < b[1][1] && b[0][1] < a[1][1];
          return boards.map((b) => huds.filter((hh) => hit(b, hh)).length);
        });
        await shot(`g7_b7_guild_${nm}`);
        check(r.every((n) => n === 0), `B7: oyuncu ${nm} önündeyken pano ve rütbe tahtası HUD'a binmiyor (${r.join(',')})`);
      }
      const zone = await W(() => { const ui = window.__game.scene.getScene('UI'); let t = null; const walk = (l) => { for (const o of l) { if (o.type === 'Text' && /Loncası/.test(o.text)) t = o.text; if (o.list) walk(o.list); } }; walk(ui.children.list); return t; });
      check(zone === 'Maceracılar Loncası', `B7: iç mekânda kısa bölge adı ("${zone}")`);
    }
  }

  // =========================================================================== C: oyuncu notları
  if (want('c')) {
    log('== C: oyuncu notları');
    // C1: kayıt öncesi harcama bildirimi
    {
      await cp('bertram_done');
      await h.run([], 120, null, { start: 600 });
      await W(() => { window.__G.p.wallet = { gold: 0, silver: 1, bronze: 0 }; });
      const why = await W(() => window.__R.spendBlocked(false, 'Ekmek'));
      check(!!why, `C1: loncaya kayıt öncesi harcama engelli ("${why}")`);
      const sat = await W(() => window.__G.state.satiety);
      check(sat >= 99, `C1: Bertram'ın işi bitince Tokluk dolu (${sat})`);
    }
    // C6: İlk Kadeh herhangi bir saatte; hırsızlık handan çıkınca
    {
      await cp('celebrate');
      await qa('setTime', 6, 10 * 60);
      await h.warp('inn');
      const started = await h.until(() => { const w = window.__game.scene.getScene('World'); return !!(w.cutscene || w.director?.busy); }, null, 8000, 100);
      check(started, 'C6: İlk Kadeh sahnesi sabah 10:00\'da da başladı');
      await shot('g7_c6_celebrate_morning');
      await h.run([0, 0, 0, 0], 600);
      // Vera yer gösterdi: masaya otur
      await W(() => { const w = window.__game.scene.getScene('World'); const p = w.mapData.props.find((x) => x.interact === 'sit_table'); if (p) w.director.interactProp('sit_table', p); });
      await h.run([0, 0, 0, 0], 800);
      const st = await qa('state');
      log('   görevler:', st.quests.map((q) => q.id).join(','));
      check(st.quests.some((q) => q.id === 'm_theft' || q.id === 'm_next_day') || (await W(() => window.__Q.status('m_celebrate'))) === 'done', 'C6: kutlama bitti, sıradaki adım açık');
      await h.warp('world');
      const theft = await h.until(() => { const w = window.__game.scene.getScene('World'); return !!(w.cutscene || w.director?.busy); }, null, 8000, 100);
      check(theft, 'C6: handan çıkınca hırsızlık sahnesi başladı (saat beklemesi yok)');
      await shot('g7_c6_theft_start');
      await h.run([0, 0, 0, 0], 600);
    }
    // C7: Divine level aurası
    {
      await tpOpen();
      await W(() => {
        const w = window.__game.scene.getScene('World');
        w.__fx = 0;
        const orig = w.director.divineLevelFx.bind(w.director);
        w.director.divineLevelFx = (lv) => { w.__fx++; return orig(lv); };
        const G = window.__G;
        window.__R.gainDivineExp(100000, 'qa');
      });
      await h.gameSec(0.6);
      await shot('g7_c7_divine_aura');
      const aura = await W(() => window.__game.scene.getScene('World').__fx > 0);
      check(aura, 'C7: Divine level atlayınca altın ışık');
    }
    // C8: yoldaşlıyken kilitli kapı
    {
      await cp('vl_friends');
      await h.run([], 120, null, { start: 600 });
      await W(() => {
        const G = window.__G, Q = window.__Q;
        if (!Q.active('f_wolves')) Q.start('f_wolves');
        G.state.party = ['vera', 'lina'];
        window.__game.scene.getScene('World').spawnParty?.();
      });
      await h.tp('world', 77, 54, 'up');
      await h.frames(10);
      const blocked = await W(() => {
        const w = window.__game.scene.getScene('World');
        const wp = w.mapData.warps.find((x) => x.to === 'inn');
        return wp ? w.director.beforeWarp(wp) === false : null;
      });
      check(blocked === true, 'C8: yoldaşlıyken görev dışı kapı (han) kilitli');
      await h.frames(6);
      await shot('g7_c8_party_door');
      await W(() => { window.__G.state.party = []; });
    }
    // C9: Appraisal EXP — aynı tür ikinci kez 1/5
    {
      await cp('registered');
      await tpOpen();
      await h.run([], 60, null, { start: 300 });
      await qa('god', true);
      const r = await W(() => {
        const w = window.__game.scene.getScene('World');
        const G = window.__G;
        const sk = () => G.p.skills.find((s) => s.id === 'appraisal').exp;
        const [e1, e2] = w.spawnAt('rat', Math.round(w.player.actor.x / 32) + 2, Math.round(w.player.actor.y / 32), 2, 1, 'qa');
        const a = sk();
        w.appraise(e1.c, null, e1, true);
        const b = sk();
        w.ui.appraisalWin?.destroy?.(); w.ui.appraisalWin = null;
        w.appraise(e2.c, null, e2, true);
        const c = sk();
        return { first: +(b - a).toFixed(3), second: +(c - b).toFixed(3), keys: Object.keys(G.state.appraised).filter((k) => k.startsWith('m_')) };
      });
      check(r.keys.includes('m_rat') && !r.keys.some((k) => /m_\d/.test(k)), `C9/B5: yaratık anahtarı türden (${r.keys.join(',')})`);
      check(r.first > 0 && r.second < r.first, `C9: aynı tür ikinci kez daha az EXP (${r.first} → ${r.second})`);
      await h.frames(10);
      await shot('g7_c14_appraisal_rat');
      await W(() => { const ui = window.__game.scene.getScene('UI'); ui.appraisalWin?.destroy?.(); ui.appraisalWin = null; });
      await clearEnemies();
    }
    // C13: Ansiklopedi
    {
      await W(() => window.__game.scene.getScene('UI').openMenu('codex'));
      await h.until(() => window.__game.scene.isActive('Menu'), null, 5000);
      await h.frames(15);
      const by = await findText('Menu', 'ile incelendi');
      const counter = await findText('Menu', '\\d+ ?/ ?\\d+');
      await shot('g7_c13_codex');
      check(!!counter, `C13: Ansiklopedide sayaç (${counter?.[2]})`);
      // yaratıklar sekmesi: incelenen fare kartında "G- ile incelendi"
      await pressText('Menu', '^Yaratıklar$');
      await h.frames(10);
      await pressText('Menu', '^Fare');
      await h.frames(10);
      const by2 = await findText('Menu', 'ile incelendi');
      await shot('g7_c13_codex_rat');
      check(!!(by || by2), `C13: Appraisal anlık kaydı ("${(by2 || by)?.[2]}")`);
      const bang = await W(() => { const m = window.__game.scene.getScene('Menu'); let n = 0; const walk = (l) => { for (const o of l) { if (o.type === 'Text' && o.text === '!' && o.visible) n++; if (o.list) walk(o.list); } }; walk(m.children.list); return n; });
      log('   yeni keşif işareti (!):', bang);
      await W(() => window.__game.scene.getScene('UI').closeMenu());
      await h.frames(10);
    }
    // C11: mini oyun kaybı ve "Tekrar dene"
    {
      await W(() => {
        const sm = window.__game.scene;
        window.__mg = null;
        sm.getScene('World').scene.pause();
        sm.getScene('World').scene.launch('Minigame', { kind: 'chop', allowQuit: true, done: (p, won) => { window.__mg = { p, won }; } });
      });
      await h.until(() => window.__game.scene.isActive('Minigame'), null, 5000);
      await h.frames(10);
      // süreyi bitir: kaybet
      const lose = await h.until(() => { const m = window.__game.scene.getScene('Minigame'); if (m.running) m.t = Math.max(m.t, m.dur + 1); let ok = false; const walk = (l) => { for (const o of l) { if (o.type === 'Text' && /Tekrar dene/.test(o.text)) ok = true; if (o.list) walk(o.list); } }; walk(m.children.list); return ok; }, null, 40000, 200);
      await shot('g7_c11_minigame_lose');
      check(lose, 'C11: mini oyun kaybında "Tekrar dene" ve "Bırak"');
      await pressText('Minigame', '^Bırak$');
      await h.until(() => !window.__game.scene.isActive('Minigame'), null, 5000);
      await W(() => window.__game.scene.getScene('World').scene.resume());
    }
    // C12: Sistem Teklifi öğreticisi ve yeni kartlar
    {
      await cp('vl_friends');
      await h.run([], 120, null, { start: 600 });
      await W(() => { delete window.__G.state.flags.tut_offer; window.__G.p.sp = 3; });
      await h.frames(10);
      await shot('g7_c12_menu_button_glow');
      await W(() => window.__game.scene.getScene('UI').openMenu('status'));
      await h.until(() => window.__game.scene.isActive('Menu'), null, 5000);
      await h.frames(10);
      await shot('g7_c12_status_offer_button');
      await W(() => { window.__game.scene.getScene('Menu').systemOffer(); });
      await h.frames(10);
      const intro = await findText('Menu', 'harcadığın SP kadar');
      check(!!intro, 'C12: ilk teklifte sistem açıklaması');
      await shot('g7_c12_offer_intro');
      await pressText('Menu', '^(Anladım|Tamam)$');
      await h.frames(10);
      await shot('g7_b8_offer_cards');
      const o = await textOverlaps(() => window.__game.scene.getScene('Menu').children.list.filter((c) => c.depth === 150).at(-1));
      check(o.n > 5 && o.overlaps === 0, `B8/C12: teklif kartlarında yazı çakışması yok (${o.n} yazı, ${o.overlaps} çakışma)`);
      await pressText('Menu', 'Hiçbirini seçme|^Vazgeç$');
      await h.frames(10);
      await W(() => window.__game.scene.getScene('UI').closeMenu());
      await h.frames(10);
    }
    // C4: rütbe tahtası (9 rozet) ve pano
    {
      await cp('registered');
      await h.tp('guild', 6, 3, 'up');
      await h.frames(10);
      await W(() => window.__game.scene.getScene('World').director.onTrigger?.('noop'));
      await W(() => { const w = window.__game.scene.getScene('World'); const p = w.mapData.props?.find((x) => x.interact === 'rank_table'); if (p) w.director.interactProp('rank_table', p); });
      await h.frames(20);
      await shot('g7_c4_rank_table');
      await h.run([], 40, null, { start: 300 });
      await W(() => { for (const k of ['Menu']) if (window.__game.scene.isActive(k)) window.__game.scene.stop(k); });
      await h.tp('guild', 11, 3, 'up');
      await h.frames(20);
      await shot('g7_c4_board');
    }
    // C16: ganimet ışığı ve yanıp sönme
    {
      await tpOpen();
      await h.frames(5);
      await W(() => {
        const w = window.__game.scene.getScene('World');
        const a = w.player.actor;
        w.dropPickup(a.x - 70, a.y + 60, 'bread', 1, 0, 0);
        w.dropPickup(a.x, a.y + 70, '', 0, 5, 1);
        w.dropPickup(a.x + 70, a.y + 60, 'bread', 1, 0, 2, true);
      });
      await h.gameSec(1);
      await shot('g7_c16_loot_glow');
      const blink = await W(() => {
        const w = window.__game.scene.getScene('World');
        for (const p of w.pickups) p.t = 110;
        return true;
      });
      const seen = new Set();
      for (let i = 0; i < 20; i++) { seen.add(await W(() => window.__game.scene.getScene('World').pickups[0]?.img.visible)); await wait(60); }
      check(blink && seen.has(true) && seen.has(false), 'C16: son 15 sn\'de ganimet yanıp sönüyor');
      await W(() => { const w = window.__game.scene.getScene('World'); for (const p of w.pickups) p.t = 130; });
      await h.frames(10);
      const left = await W(() => window.__game.scene.getScene('World').pickups.length);
      check(left === 0, `C16: ömrü dolan ganimet kalktı (kalan ${left})`);
    }
    // C2: prolog etkileşimsiz akar; atla düğmesi yok, dokunmak ilerletmez
    {
      await W(() => { const sm = window.__game.scene; for (const k of ['World', 'UI', 'Menu', 'Minigame']) if (sm.isActive(k)) sm.stop(k); window.__G.newGame(); sm.start('Prologue'); });
      await h.until(() => window.__game.scene.isActive('Prologue'), null, 10000);
      await h.frames(20);
      const skip = await findText('Prologue', '^Atla');
      check(!skip, 'C2: prologda "Atla" yok');
      const txtNow = () => W(() => { const p = window.__game.scene.getScene('Prologue'); const t = []; const walk = (l) => { for (const o of l) { if (o.type === 'Text' && o.visible && o.alpha > 0.5) t.push(o.text); if (o.list) walk(o.list); } }; walk(p.children.list); return t.join('|'); });
      const a = await txtNow();
      const vp = page.viewportSize();
      await page.mouse.click(vp.width / 2, vp.height / 2);
      await h.frames(3);
      const b = await txtNow();
      check(a === b, 'C2: dokunmak yazıyı ilerletmiyor');
      const flowed = await h.until(() => { const p = window.__game.scene.getScene('Prologue'); let ok = false; const walk = (l) => { for (const o of l) { if (o.type === 'Text' && /TRAIT BELİRLENİYOR/.test(o.text)) ok = true; if (o.list) walk(o.list); } }; walk(p.children.list); return ok; }, null, 240000, 500);
      check(flowed, 'C2: prolog kendiliğinden trait çarkına kadar aktı');
      await shot('g7_c2_trait_wheel');
    }
  }

  // D: başlık ekranından yuva akışı (QA başında localStorage temizlenmiş varsayılmaz: önce yuvalar silinir)
  async function sectionD() {
    log('== D: kayıt yuvaları');
    await W(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('elonth.slot.') && !k.endsWith('migrated')) localStorage.removeItem(k); window.__game.scene.getScene('Title').scene.restart(); });
    await h.until(() => window.__game.scene.isActive('Title'), null, 10000);
    await wait(1500);
    // boş yuvaya yeni oyun: onaysız başlar
    await pressText('Title', '^Yeni Oyun$');
    await h.frames(6);
    await shot('g7_d_slot_picker_empty');
    await pressNamed('Title', 'slot_2');
    const started = await h.until(() => window.__game.scene.isActive('Prologue'), null, 8000);
    check(started, 'D: boş yuvaya yeni oyun doğrudan başladı');
    const slot = await W(() => window.__G.slot);
    check(slot === 2, `D: oynanan yuva 2 (${slot})`);
    // kontrol noktasıyla dünyaya geç, otomatik kayıt Yuva 2'ye
    await W(() => window.__qa.checkpoint('registered'));
    await h.frames(10);
    await W(() => window.__G.save('auto'));
    const meta = await W(() => ({ s1: !!localStorage.getItem('elonth.slot.1'), s2: localStorage.getItem('elonth.slot.2') }));
    check(!meta.s1 && !!meta.s2 && JSON.parse(meta.s2).meta.day === 4, 'D: otomatik kayıt doğru yuvada (Yuva 2, 4. gün)');
    // başlığa dön, dolu yuvaya yeni oyun: onay
    await W(() => { const sm = window.__game.scene; for (const k of ['World', 'UI', 'Menu']) if (sm.isActive(k)) sm.stop(k); sm.start('Title'); });
    await h.until(() => window.__game.scene.isActive('Title'), null, 10000);
    await wait(1200);
    await pressText('Title', '^Yeni Oyun$');
    await h.frames(6);
    await shot('g7_d_slot_picker_filled');
    await pressNamed('Title', 'slot_2');
    await h.frames(6);
    const ask = await findText('Title', 'kayıt silinecek');
    await shot('g7_d_overwrite_confirm');
    check(!!ask && /Yuva 2'deki/.test(ask[2]), `D: dolu yuvaya yeni oyun → onay ("${ask?.[2]}")`);
    await pressText('Title', '^Vazgeç$');
    await h.frames(6);
    check(!(await W(() => window.__game.scene.isActive('Prologue'))), 'D: Vazgeç → yeni oyun başlamadı');
  }

  log('\n== SORUNLAR:', problems.length ? '\n - ' + problems.join('\n - ') : 'yok');
};
