// Hikâye yönetmeni: tetikleyiciler, sahneler ve NPC konuşmaları.
import Phaser from 'phaser';
import { G } from '../game/G';
import { Input } from '../game/input';
import { Sound } from '../audio/audio';
import type { WorldScene } from '../scenes/WorldScene';
import type { Npc } from '../world/npc';
import type { PropPlacement, Warp } from '../world/types';
import { TILE } from '../world/types';
import { NPC_BY_ID } from '../data/npcs';
import * as R from '../game/rules';
import { transact, equip } from '../core/transactions';
import { walletTotal, emptyWallet } from '../core/money';
import { nextMorning, hourOf } from '../core/time';
import { dirFromVec } from '../world/actor';
import { openShop } from '../ui/shop';
import { DIVINE_BY_ID, divineOffer } from '../data/divine';
import { SKILLS, RARITY_NAMES } from '../data/skills';
import { HIDDEN_DISCOVERIES } from '../data/skills';
import { weekOfDay } from '../core/skills';
import { panelChoice } from '../ui/panels';
import { divineStat, DIVINE_STATS, DIVINE_STAT_NAMES } from '../core/divine';
import { ensureCG } from '../ui/portraits';
import { Display } from '../game/display';

const wait = (scene: Phaser.Scene, ms: number) => new Promise<void>((r) => scene.time.delayedCall(ms, r));

const BOARD_EXCUSES = [
  'Pano yarın açılıyor. Yeni görevler sabah asılacak.',
  'Görev kuryesinin arabası yolda kırılmış. Pano yarın açılıyor.',
  'Şube müdürü ilanları henüz onaylamadı. Yarın gel.',
  'Kuzeydeki şehirden ilan torbası gelmedi. Pano yarın açılıyor.',
  'Pano mu? Yarın. Bugün kâğıt bile kalmadı.',
];

export class Director {
  musicOverride = false;
  private busy = false;
  private appraiseWaiter: ((id: string) => void) | null = null;
  private pendingCheck = 0;

  constructor(public w: WorldScene) {
    G.events.on('awakening', () => this.tryPending());
    G.events.on('discovery', () => this.tryPending());
    w.events.once('shutdown', () => {
      G.events.off('awakening');
      G.events.off('discovery');
    });
    w.time.addEvent({ delay: 1500, loop: true, callback: () => this.tryPending() });
  }

  get ui() {
    return this.w.ui;
  }

  // ============================================================ yardımcılar
  lock() {
    this.w.cutscene = true;
    this.w.player.setState('locked');
    this.w.player.actor.body2.setVelocity(0, 0);
    this.w.player.actor.play('idle');
    Input.clear();
  }

  unlock() {
    this.ui.closeDialogue();
    this.w.cutscene = false;
    if (this.w.player.state === 'locked') this.w.player.setState('free');
    Input.clear();
  }

  async scene(fn: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    this.lock();
    try {
      await fn();
    } catch (e) {
      console.error(e);
    }
    this.unlock();
    this.busy = false;
  }

  /** Bir aktörü karoya yürüt. */
  walk(actor: any, tx: number, ty: number, speed = 2.4): Promise<void> {
    return new Promise((resolve) => {
      const gx = tx * TILE + 16, gy = ty * TILE + 22;
      const step = () => {
        const dx = gx - actor.x, dy = gy - actor.y;
        const d = Math.hypot(dx, dy);
        if (d < 3) {
          actor.body2?.setVelocity(0, 0);
          actor.play('idle');
          ev.remove();
          resolve();
          return;
        }
        const v = speed * TILE;
        actor.body2?.setVelocity((dx / d) * v, (dy / d) * v);
        actor.face(dirFromVec(dx, dy));
        actor.play('walk');
      };
      const ev = this.w.time.addEvent({ delay: 16, loop: true, callback: step });
      this.w.time.delayedCall(6000, () => {
        if (ev.getProgress() < 1 && !ev.hasDispatched) {
          ev.remove();
          actor.setPosition(gx, gy);
          actor.body2?.setVelocity(0, 0);
          resolve();
        }
      });
    });
  }

  face(actor: any, target: any) {
    actor.face(dirFromVec(target.x - actor.x, target.y - actor.y));
  }

  pan(x: number, y: number, ms: number): Promise<void> {
    return new Promise((resolve) => {
      const cam = this.w.cameras.main;
      cam.stopFollow();
      cam.pan(x, y, ms, 'Sine.easeInOut', false, (_c: any, p: number) => {
        if (p >= 1) resolve();
      });
    });
  }

  follow() {
    this.w.cameras.main.startFollow(this.w.player.actor, true, 0.14, 0.14, 0, 20);
  }

  say(id: string, text: string, expr?: any) {
    return this.ui.say(id, text, { expr });
  }

  think(text: string) {
    return this.ui.think(text);
  }

  // ============================================================ yerleşim kontrolü
  /** false: bu NPC hiç doğmasın. */
  npcOverride(_id: string): boolean | undefined {
    return undefined;
  }

  /** Zorunlu yerleşim: [x,y] veya null (bu haritada olmasın) veya undefined (programa göre). */
  npcPlacement(id: string, map: string): [number, number] | null | undefined {
    if (!G.flag('inn_met') && map === 'inn' && (id === 'vera' || id === 'lina')) {
      const p = this.w.mapData.points[id === 'vera' ? 'table_vera' : 'table_lina'];
      return [p.x, p.y];
    }
    if (!G.flag('inn_met') && (id === 'vera' || id === 'lina') && map !== 'inn') return null;
    if (this.registering && map === 'guild' && (id === 'vera' || id === 'lina' || id === 'dorn')) {
      const p = this.w.mapData.points[id === 'dorn' ? 'adv1' : id];
      return [p.x, p.y];
    }
    if (map === 'inn' && id === 'bertram') {
      const p = this.w.mapData.points.bertram;
      return hourOf(G.state.time) >= 5 ? [p.x, p.y] : null;
    }
    if (map === 'guild' && id === 'celeste') {
      const h = hourOf(G.state.time);
      const p = this.w.mapData.points.celeste;
      return h >= 7 && h < 21 ? [p.x, p.y] : null;
    }
    return undefined;
  }

  private registering = false;

  // ============================================================ olaylar
  onWorldReady() {
    if (!G.flag('woke')) this.wakeScene();
    else this.ui.showZone(this.w.zone?.name ?? this.w.mapData.name);
    this.w.updateMusic();
  }

  onEnterMap(id: string) {
    if (id === 'inn' && !G.flag('inn_met')) this.innScene();
    if (id === 'guild' && !G.flag('guild_seen')) {
      G.setFlag('guild_seen');
      this.scene(async () => {
        await this.think('Maceracılar Loncası. Tahtalarda ilanlar, köşede bir taş... İçerisi ter ve demir kokuyor.');
        if (!G.flag('bertram_deal')) await this.think('Burada iş yok gibi. En azından benim gibi biri için.');
      });
    }
  }

  onNewDay() {
    G.setFlag('worked_today', 0);
  }

  onHour(_h: number) {
    this.w.updateMusic();
  }

  onRespawn() {
    this.scene(async () => {
      await wait(this.w, 400);
      if (G.state.spawn.x) await this.think('...Başım. Yine yatağımdayım. Ne oldu?');
      else await this.think('...Yine bu ağaçlar. Yine bu toprak. Ölmek bu kadar kolay mı?');
    });
  }

  onSleep() {}

  onBossKilled() {
    this.scene(async () => {
      await wait(this.w, 800);
      await this.think('Şefi devirdim... Ellerim titriyor. Ama ayaktayım.');
      if (G.p.inventory.map_forest_deep) await this.think('Üstünden kaba bir harita çıktı. Ormanın derinliklerini gösteriyor.');
    });
  }

  onAppraise(id: string) {
    if (this.appraiseWaiter) this.appraiseWaiter(id);
  }

  beforeWarp(w: Warp): boolean {
    if (w.to === 'inn_attic' && !G.flag('bertram_deal') && G.flag('room_day') !== G.state.time.day) {
      this.scene(async () => {
        await this.say('bertram', 'Hey! Yukarısı boş gezenlere değil. Yatak istiyorsan on beş bronz.', 'kizgin');
      });
      return false;
    }
    return true;
  }

  // ============================================================ tetikleyiciler
  onTrigger(id: string) {
    if (this.busy) return;
    if (id === 'village_enter' && !G.flag('village_entered')) {
      G.setFlag('village_entered');
      if (this.w.josephStatus() === 'naked') this.villageReaction();
    }
    if (id === 'checkpoint_near' && !G.flag('checkpoint_seen')) {
      G.setFlag('checkpoint_seen');
      this.scene(async () => {
        await this.pan(146 * TILE, 50 * TILE, 1600);
        await this.think('Yol bir kontrol noktasında bitiyor. Ötesinde... o surlar. Kuzeydeki kraliyet şehri.');
        await this.think('Muhafızlar yolu tutmuş. Öyle elini kolunu sallayarak geçilecek gibi değil.');
        await this.pan(this.w.player.actor.x, this.w.player.actor.y, 900);
        this.follow();
      });
    }
    if (id === 'camp_near' && !G.flag('camp_seen')) {
      G.setFlag('camp_seen');
      this.scene(async () => {
        await this.think('Duman... çadırlar... ve gırtlaktan gelen gülüşmeler. Bir kamp. Goblinler.');
        await this.think('Bu hâlimle buraya girmek intihar olur. Ya da... çok dikkatli olmalıyım.');
      });
    }
  }

  // ============================================================ sahne: uyanış
  wakeScene() {
    this.scene(async () => {
      G.setFlag('woke');
      const a = this.w.player.actor;
      a.play('die', { loop: false, hold: true });
      a.animT = 10;
      a.applyFrame();
      this.w.cameras.main.fadeIn(2500, 0, 0, 0);
      Sound.play('forest');
      const cg = await ensureCG(this.ui, 'forest_wake');
      let cgImg: Phaser.GameObjects.Image | null = null;
      if (cg) {
        cgImg = this.ui.add.image(Display.uiW / 2, Display.uiH / 2, cg).setDepth(80).setAlpha(0);
        cgImg.setScale(Math.max(Display.uiW / cgImg.width, Display.uiH / cgImg.height));
        this.ui.tweens.add({ targets: cgImg, alpha: 1, duration: 1200 });
      }
      await wait(this.w, 1800);
      await this.think('...');
      await this.think('Kuş sesleri. Toprak kokusu. Rüzgâr...');
      if (cgImg) this.ui.tweens.add({ targets: cgImg, alpha: 0, duration: 1000, onComplete: () => cgImg!.destroy() });
      a.play('idle');
      this.w.tweens.add({ targets: a, y: a.y - 2, yoyo: true, duration: 200 });
      Sound.sfx('step');
      await this.think('Kalkabiliyorum. Ama bu beden... benim değil gibi. Çok hafif. Ve çok... zayıf.');
      await this.think('Üstümde yırtık bir şorttan başka hiçbir şey yok.');
      // Status penceresi kısa süre
      R.sysmsg('STATUS', ['Joseph · İnsan · Level 0', 'HP 5/5 · MP 0/0', 'STR 0 · VIT 0 · AGI 0 · DEX 0 · MNA 0 · INT 0 · LUK 0', 'Skill: Appraisal (G-)'], { sound: 'system' });
      await wait(this.w, 2600);
      await this.think('Gerçekten oradaymış. O mavi pencere... Rüya değil.');
      // Manzara
      const village = this.w.mapData.points.plaza;
      const vv = await ensureCG(this.ui, 'village_view');
      await this.pan(village.x * TILE, village.y * TILE - 60, 2600);
      let vImg: Phaser.GameObjects.Image | null = null;
      if (vv) {
        vImg = this.ui.add.image(Display.uiW / 2, Display.uiH / 2, vv).setDepth(80).setAlpha(0);
        vImg.setScale(Math.max(Display.uiW / vImg.width, Display.uiH / vImg.height));
        this.ui.tweens.add({ targets: vImg, alpha: 1, duration: 900 });
      }
      await this.think('Ağaçların arasından... bir köy görünüyor. Çatılardan duman yükseliyor.');
      await this.pan(146 * TILE, 50 * TILE, 2200);
      await this.think('Ve çok uzakta, surlarla çevrili koca bir şehir. Kuleleri sisin içinde mavi.');
      if (vImg) this.ui.tweens.add({ targets: vImg, alpha: 0, duration: 800, onComplete: () => vImg!.destroy() });
      await this.pan(a.x, a.y, 1800);
      this.follow();
      await this.think('Önce bir şeyler giymem lazım. Sonra... yemek. Bir de bu dünyanın ne olduğunu anlamam.');
      const touch = navigator.maxTouchPoints > 0;
      this.ui.toastInfo(touch ? 'Sol tarafı sürükle: yürü · kenara it: koş' : 'WASD: yürü · Shift: koş · Esc: menü');
      this.w.time.delayedCall(3000, () => this.ui.toastInfo(touch ? 'Sağdaki butonlar: saldırı, kaçış, etkileşim' : 'J: saldırı · Boşluk: kaçış · E: etkileşim · Q: Appraisal'));
      G.save('auto');
    });
  }

  // ============================================================ sahne: köye giriş
  villageReaction() {
    this.scene(async () => {
      const a = this.w.player.actor;
      const ax = Math.floor(a.x / TILE), ay = Math.floor(a.y / TILE);
      const extras: Npc[] = [];
      const add = (id: string, x: number, y: number) => {
        let n = this.w.npc(id);
        if (!n) {
          n = this.w.addNpc(NPC_BY_ID[id], x, y, true);
          extras.push(n);
        } else n.scripted = true;
        return n;
      };
      const greta = add('greta', ax + 6, ay - 2);
      const tobin = add('tobin', ax + 7, ay + 1);
      const anna = add('anna', ax + 5, ay + 3);
      const pip = add('pip', ax + 5, ay + 2);
      for (const n of [greta, tobin, anna, pip]) this.face(n.actor, a);
      await wait(this.w, 500);
      greta.say('Kim bu adam?', 2.5);
      await wait(this.w, 1100);
      tobin.say('Haydut mu soydu bunu?', 2.5);
      await wait(this.w, 1200);
      anna.say('Pip! Bakma! Kapat gözlerini!', 2.8);
      anna.actor.face('up');
      await wait(this.w, 900);
      pip.say('Anne, göremiyorum!', 2.4);
      await wait(this.w, 1400);
      greta.say('Fısır fısır...', 2);
      tobin.say('Ormandan mı gelmiş?', 2);
      await wait(this.w, 1500);
      await this.think('Herkes bakıyor. Haklılar. Yarı çıplağım.');
      await this.think('Bir han bulmalıyım. Han varsa iş de vardır.');
      for (const n of extras) {
        n.scripted = false;
        n.entry = null;
      }
      for (const n of [greta, tobin, anna, pip]) n.scripted = false;
    });
  }

  // ============================================================ sahne: han
  innScene() {
    this.scene(async () => {
      G.setFlag('inn_met');
      const vera = this.w.npc('vera');
      const lina = this.w.npc('lina');
      const bert = this.w.npc('bertram');
      const a = this.w.player.actor;
      await wait(this.w, 500);
      if (vera) this.face(vera.actor, a);
      if (lina) this.face(lina.actor, a);
      const naked = this.w.josephStatus() === 'naked';
      Sound.sfx('laugh', 0.6);
      if (naked) {
        await this.say('vera', 'Lina, bak! Ormandan bir haydut kurbanı gelmiş!', 'alayci');
        await this.say('lina', 'Hihi! Pantolonu bile yok! Şort mu o?', 'gulen');
      } else {
        await this.say('vera', 'Bak sen, yeni bir yüz. Kimin nesisin?', 'alayci');
      }
      await this.say('bertram', 'Kapıyı kapat, içerisi soğuyor.');
      await this.say('joseph', 'Ben... iş arıyorum. Herhangi bir iş.');
      await this.say('vera', 'İş mi? Önce bir gömlek bulsana. Lonca bile böyle adamı kapıdan çevirir. Kayıt bir gümüş, biliyor musun?', 'alayci');
      await this.say('lina', 'Hihi! Bir gümüşü olsa üstüne bir şey alırdı!', 'gulen');
      await this.think('Bu ikisi... Üzerlerinde bir şey var. Sanki bir şeyleri okuyabilirim.');
      await this.ui.system('Appraisal kullanılabilir. Q tuşuna ya da sağ alttaki göz simgesine dokunarak önündeki kişiyi incele. Vera\'ya bak.');
      this.ui.closeDialogue();
      // oyuncunun Appraisal kullanmasını bekle
      this.w.cutscene = false;
      if (vera) this.face(a, vera.actor);
      const got = await new Promise<string>((resolve) => {
        this.appraiseWaiter = resolve;
        this.w.time.delayedCall(25000, () => resolve('timeout'));
      });
      this.appraiseWaiter = null;
      if (got === 'timeout' && vera) this.w.appraise(vera.def.creature, vera.def, vera);
      this.w.cutscene = true;
      await wait(this.w, 2600);
      this.ui.closeAppraisal();
      await this.think('Vera. İnsan, on dokuz yaşında. F- rütbe. Level 3.');
      await this.think('Statlarını göremiyorum. Rütbesi benimkinden bir harf yüksek. Aradaki farkı... hissediyorum.');
      if (lina) {
        this.w.appraise(lina.def.creature, lina.def, lina);
        await wait(this.w, 2200);
        this.ui.closeAppraisal();
        await this.think('Lina. Kedi soylu. O kulaklar gerçek. O da Level 3.');
      }
      await this.think('Ve ben Level 0\'ım.');
      await this.say('vera', 'Ne o, bize mi bakıyorsun? Appraisal\'ın G- değil mi? Hah! Hiçbir şey göremezsin!', 'alayci');
      const c = await this.ui.choice(['(Sessiz kal.)', '"Görecek pek bir şey yok zaten."', '"Dilin kadar kılıcın da keskin mi bakalım?"']);
      if (c === 0) {
        G.affinity('vera', -1);
        await this.say('vera', 'Dili de yokmuş.', 'alayci');
        await this.say('lina', 'Hihi.', 'gulen');
      } else if (c === 1) {
        G.affinity('vera', 1);
        G.affinity('lina', 2);
        await this.say('lina', 'Hihihi! Vera, bu komikti!', 'gulen');
        await this.say('vera', '...Hıh. En azından mizah anlayışı var.', 'saskin');
      } else {
        G.affinity('vera', -2);
        G.affinity('lina', -1);
        G.affinity('bertram', 1);
        await this.say('vera', 'Bana bak, çıplak! Bir kelime daha et, seni şu kapıdan fırlatırım!', 'kizgin');
        await this.say('bertram', 'Vera! Benim hanımda kavga yok. Otur yerine.', 'kizgin');
        await this.say('vera', '...Tch.', 'kizgin');
      }
      await this.say('bertram', 'Sen. Buraya gel.');
      if (bert) {
        const bf = this.w.mapData.points.bar_front;
        await this.walk(a, bf.x, bf.y);
        this.face(a, bert.actor);
        this.face(bert.actor, a);
      }
      await this.bertramDeal();
    });
  }

  async bertramDeal() {
    await this.say('bertram', 'İş istiyorsun demek. Görünüşe bakılırsa paran da yok, adın da yok.');
    await this.say('joseph', 'Adım Joseph. Ama gerisi... doğru.');
    await this.say('bertram', 'Bulaşık, odun, masa. Ağır iş. Sızlanmak yok. Hırsızlık hiç yok.');
    const c = await this.ui.choice(['"Ne kadar ödersin?"', '"Kabul. Ne olursa."']);
    if (c === 0) {
      await this.say('bertram', 'Günde elli bronz. Yemek benden. Tavan arasında bir yatak var.');
      const c2 = await this.ui.choice(['"Biraz daha olmaz mı?"', '"Bir de... kıyafet lazım."', '"Anlaştık."']);
      if (c2 === 0) {
        await this.say('bertram', 'Daha mı? Seni giydireceğim, besleyeceğim, yatıracağım. Elli. O kadar.', 'kizgin');
        await this.say('bertram', 'Ama haklısın, üstüne bir şey lazım. Öyle çalışamazsın.');
      } else if (c2 === 1) {
        G.affinity('bertram', 1);
        await this.say('bertram', 'Gözüm var, görüyorum. Eski gömleğim, bir pantolon, bez ayakkabı. Maaşından kesmem.');
        await this.say('bertram', 'Ama çalarsan, bacağımın sağlam olanıyla tekmelerim.');
      } else {
        await this.say('bertram', 'Akıllıca. Ama üstüne bir şey lazım. Öyle çalışamazsın.');
      }
    } else {
      G.affinity('bertram', 1);
      await this.say('bertram', 'Hah. Pazarlık bile etmedin. Ya çok akıllısın ya çok aç.');
      await this.say('bertram', 'Günde elli bronz. Yemek benden. Tavan arasında bir yatak. Bir de şu hâlini düzeltelim.');
    }
    // Kıyafet işlemi
    const r = transact(G.p as any, { label: 'Bertram\'ın kıyafetleri', give: [{ id: 'linen_shirt', qty: 1 }, { id: 'linen_pants', qty: 1 }, { id: 'cloth_shoes', qty: 1 }] });
    if (r.ok) {
      R.toast('+1 Keten Gömlek (G)', 'item', 'shirt');
      R.toast('+1 Keten Pantolon (G)', 'item', 'pants');
      R.toast('+1 Bez Ayakkabı (G)', 'item', 'shoes');
      Sound.sfx('pickup');
      await this.ui.curtain(1, 500);
      equip(G.p as any, 'linen_shirt', 'chest');
      equip(G.p as any, 'linen_pants', 'pants');
      equip(G.p as any, 'cloth_shoes', 'boots');
      this.w.player.refreshLayers();
      G.invalidate();
      await wait(this.w, 500);
      await this.ui.curtain(0, 500);
      R.sysmsg('EKİPMAN', ['Keten Gömlek (G) [DEF: +0]', 'Keten Pantolon (G) [DEF: +1]', 'Bez Ayakkabı (G) [DEF: +0]', 'Yırtık Şort envantere kaldırıldı.']);
    }
    G.setFlag('bertram_deal');
    await this.say('bertram', 'Biraz büyük ama idare eder. Tavan arasındaki yatak artık senin. Merdiven arkada.');
    await this.say('bertram', 'İşe hazır olunca bana söyle. Sabah erken gelirsen tam gün çalışırsın.');
    await this.say('vera', 'Bulaşıkçı! Ne yakışmış!', 'alayci');
    await this.say('lina', 'Hihi! Bulaşık prensi!', 'gulen');
    await this.think('...Bir iş, bir yatak, bir gömlek. Bu dünyadaki ilk sahip olduklarım.');
    R.sysmsg('BİLGİ', ['Tavan arasındaki yatakta uyuduğunda orası yeniden doğma noktan olur.', 'Bertram\'la konuşarak çalışabilirsin (günde 50 bronz).']);
    G.save('auto');
  }

  // ============================================================ NPC konuşmaları
  talk(n: Npc) {
    const id = n.def.id;
    if (this.busy) return;
    this.scene(async () => {
      this.face(n.actor, this.w.player.actor);
      this.face(this.w.player.actor, n.actor);
      switch (id) {
        case 'bertram': return this.talkBertram();
        case 'celeste': return this.talkCeleste();
        case 'captain': return this.talkCaptain();
        case 'smith': return this.talkShop(n, 'smith');
        case 'shopkeeper': return this.talkShop(n, 'shop');
        case 'healer': return this.talkShop(n, 'healer');
        case 'hunter': return this.talkHunter(n);
        default: return this.talkGeneric(n);
      }
    });
  }

  async talkGeneric(n: Npc) {
    const st = this.w.josephStatus();
    const pool = [...(n.def.talk[st] ?? []), ...(n.def.talk.any ?? [])];
    const line = pool.length ? pool[Math.floor(Math.random() * pool.length)] : '...';
    const expr = n.def.personality === 'rude' ? 'kizgin' : n.def.personality === 'gossip' ? 'gulen' : n.def.personality === 'drunk' ? 'gulen' : 'normal';
    await this.say(id(n), line, expr);
    if (n.def.id === 'hilda' && st === 'naked' && !G.flag('hilda_apple')) {
      G.setFlag('hilda_apple');
      R.giveItems([{ id: 'apple', qty: 1 }], 'Hilda\'nın elması');
      G.affinity('hilda', 1);
      await this.think('Bu dünyada ilk iyilik. Bir elma.');
    }
    if (n.def.id === 'healer' && st === 'naked' && G.p.hp < G.d.maxHp) {
      G.p.hp = G.d.maxHp;
      Sound.sfx('heal');
      await this.think('Yaralarım sızlamıyor artık.');
    }
    function id(x: Npc) {
      return x.def.id;
    }
  }

  async talkBertram() {
    const st = this.w.josephStatus();
    const deal = !!G.flag('bertram_deal');
    const h = G.state.time.minute / 60;
    if (!G.flag('inn_met')) {
      await this.say('bertram', 'Ne istiyorsun?');
      return;
    }
    const opts: string[] = [];
    const acts: (() => Promise<void>)[] = [];
    if (deal) {
      const worked = G.flag('worked_today') === G.state.time.day;
      if (!worked) {
        opts.push(h < 15 ? 'Çalışmaya hazırım.' : 'Çalışmaya hazırım. (geç oldu)');
        acts.push(async () => {
          if (h >= 15) {
            await this.say('bertram', 'Bu saatte mi? Gün bitti sayılır. Yarın sabah gel.');
            return;
          }
          await this.workMontage();
        });
      }
    } else {
      opts.push('İş var mı?');
      acts.push(async () => this.bertramDeal());
      opts.push('Yatak kirala (15 bronz)');
      acts.push(async () => {
        const r = R.pay(15, 'Han yatağı');
        if (!r.ok) {
          await this.say('bertram', 'Paran yok. Yatak da yok.');
          return;
        }
        G.setFlag('room_day', G.state.time.day);
        Sound.sfx('coin');
        await this.say('bertram', 'Tavan arası. Merdiven arkada. Sabah çık.');
      });
    }
    opts.push('Yiyecek ve içecek');
    acts.push(async () => {
      await this.say('bertram', deal ? 'Çalışanıma yemek bedava. Ama fazlası için para.' : 'Sıcak güveç dört bronz. Ekmek bir.');
      this.ui.closeDialogue();
      await openShop(this.ui, 'inn');
    });
    if (G.flag('guild_registered') && !R.hasSkill('sword_mastery')) {
      opts.push('Bana kılıç öğretir misin?');
      acts.push(async () => {
        await this.say('bertram', 'Kılıç mı? Hmm. Eski alışkanlıklar... Bir gümüş elli bronz. Ve üç saat terlersin.');
        const c = await this.ui.choice(['Öde (1 Gümüş 50 Bronz)', 'Vazgeç']);
        if (c !== 0) return;
        const can = R.canLearnSkill();
        if (!can.ok) {
          await this.say('bertram', 'Kafan dolu gibi. Bu hafta başka bir şey öğrenmişsin. Haftaya gel.');
          return;
        }
        const r = R.pay(150, 'Kılıç dersi');
        if (!r.ok) {
          await this.say('bertram', 'Para yoksa ders de yok.');
          return;
        }
        await this.trainingTime(180, 'Bertram seni arka bahçede bir sopayla saatlerce koşturuyor.');
        R.learnSkill('sword_mastery', 'Öğretmen: Bertram');
      });
    }
    opts.push('Kendin hakkında anlat.');
    acts.push(async () => {
      const lines = [
        'Ben mi? Eskiden maceracıydım. E rütbe. Bir kurt sürüsü bacağımı aldı, ben de sürüyü aldım. Sonra bu hanı.',
        'Lonca kartı bir kâğıttır, evlat. Asıl rütbe bacaklarında, ellerinde ve kafandadır.',
        'Brindlewood küçük ama dürüst bir köy. Çoğu. Wilmer hariç.',
        'Kuzeydeki şehre mi? Orası soylularla dolu. Senin gibi köksüz birini kapıdan sokmazlar.',
      ];
      await this.say('bertram', lines[Math.floor(Math.random() * lines.length)]);
    });
    opts.push('Hoşça kal.');
    acts.push(async () => {});
    await this.say('bertram', st === 'naked' ? 'Hâlâ o şortla mısın?' : deal ? 'Ne var, evlat?' : 'Ne istiyorsun?');
    const c = await this.ui.choice(opts);
    await acts[c]();
  }

  async trainingTime(minutes: number, text: string) {
    await this.ui.curtain(1, 500);
    const t = this.ui.overlayText(text, { size: 24 });
    await wait(this.w, 2400);
    t.destroy();
    G.state.time.minute += minutes;
    while (G.state.time.minute >= 1440) {
      G.state.time.minute -= 1440;
      G.state.time.day++;
    }
    await this.ui.curtain(0, 500);
  }

  async workMontage() {
    const day = G.state.time.day;
    const workCount = (G.state.counters.workDays ?? 0) + 1;
    await this.say('bertram', workCount === 1 ? 'Güzel. Önce bulaşıklar. Mutfak arkada. Sonra odun.' : 'Aynı iş. Bulaşık, odun, masa. Hadi.');
    await this.ui.curtain(1, 700);
    Sound.play('inn');
    const scenes = workCount === 1
      ? [
          ['Bulaşıklar. Tabak, tabak, tabak... Suyun soğuğu parmaklarıma işliyor.', 'click', 12],
          ['Odun taşımak. Her kütük bir öncekinden ağır. Kollarım titriyor.', 'chop', 13],
          ['Sarhoş Fenn masaya devrildi. "Hık! Sen iyi çocuksun!" Bertram onu kapı dışarı taşıyor.', 'laugh', 12],
          ['Masaları silmek. Bira lekeleri, ekmek kırıntıları, bir yerde... bir diş?', 'click', 13],
        ]
      : [
          ['Bulaşıklar yine. Bu sefer daha hızlıyım. Biraz.', 'click', 12],
          ['Avcı Garrick bir tavşan getirdi. Derisini yüzmeyi seyrettim. Mide bulandırıcı ve... öğretici.', 'chop', 13],
          ['Vera ve Lina akşam yemeğinde. "Bulaşıkçı! Bira!" Getirdim. Döktüm. Gülüştüler.', 'laugh', 12],
          ['Kapanış. Bertram tek kelime etmeden omzuma vurdu.', 'click', 13],
        ];
    let coins = 0;
    const counter = this.ui.overlayText('0 Bronz', { size: 30, y: Display.uiH * 0.72, color: '#f3dc95', font: 'Cinzel, serif' });
    for (const [text, sfx, add] of scenes as [string, string, number][]) {
      const t = this.ui.overlayText(text, { size: 23 });
      t.setAlpha(0);
      this.ui.tweens.add({ targets: t, alpha: 1, duration: 400 });
      Sound.sfx(sfx, 0.7);
      await wait(this.w, 2300);
      for (let k = 0; k < add; k++) {
        coins++;
        counter.setText(`${coins} Bronz`);
        if (k % 3 === 0) Sound.sfx('coin', 0.4);
        await wait(this.w, 45);
      }
      await wait(this.w, 500);
      this.ui.tweens.add({ targets: t, alpha: 0, duration: 300, onComplete: () => t.destroy() });
      await wait(this.w, 350);
    }
    counter.destroy();
    // Ödeme işlemi
    R.giveMoney(50, 'Han ücreti');
    G.state.counters.workDays = workCount;
    G.setFlag('worked_today', day);
    G.state.time.minute = Math.max(G.state.time.minute, 18 * 60);
    G.p.hp = G.d.maxHp;
    G.p.stamina = G.d.maxStamina;
    await this.ui.curtain(0, 700);
    this.w.updateMusic();
    await this.say('bertram', workCount === 1 ? 'Fena değildi. Elli bronz. Say istersen.' : 'Elli bronz daha.');
    if (workCount >= 2 && G.p.wallet.bronze >= 100 && !G.flag('silver_exchanged')) {
      await this.say('bertram', 'Yüz bronz cebinde şıngırdıyor. Ver şunları, bir gümüşe çevireyim. Taşıması kolay olur.');
      const r = transact(G.p as any, { label: 'Bozdurma', pay: 100, receive: { ...emptyWallet(), silver: 1 } });
      if (r.ok) {
        G.setFlag('silver_exchanged');
        Sound.sfx('coin');
        R.toast('100 Bronz → 1 Gümüş', 'money', 'coin_silver');
        await this.think('Bir gümüş. Avucumda soğuk ve ağır. Lonca kaydı tam bu kadar tutuyor.');
      }
    }
    await this.say('bertram', 'Yemeğini ye, sonra yukarı çık ve uyu. Yarın da aynı saatte.');
    G.save('auto');
  }

  async talkCeleste() {
    const st = this.w.josephStatus();
    if (st === 'naked') {
      await this.say('celeste', '...Önce giyin. Sonra konuşuruz. Belki.', 'kizgin');
      return;
    }
    if (!G.flag('guild_registered')) {
      await this.say('celeste', 'Evet? Görev teslimi mi, yoksa yolunu mu kaybettin?', 'alayci');
      const c = await this.ui.choice(['"Maceracı olarak kaydolmak istiyorum."', '"Sadece bakıyordum."']);
      if (c === 1) {
        await this.say('celeste', 'Bakmak bedava. Şimdilik.', 'alayci');
        return;
      }
      await this.say('celeste', 'Kayıt.', 'saskin');
      await this.say('celeste', 'Kayıt ücreti bir gümüş. Gerçekten bir gümüşün var mı?', 'alayci');
      if (walletTotal(G.p.wallet) < 100) {
        await this.say('joseph', '...Şu an yok.');
        await this.say('celeste', 'Sanmıştım. Kapı arkanda.', 'alayci');
        return;
      }
      await this.say('joseph', 'Var.');
      await this.registerScene();
      return;
    }
    const lines = [
      BOARD_EXCUSES[(G.state.time.day - 1) % BOARD_EXCUSES.length],
      'G- rütbe görevler panoya asılınca haberin olur. Şimdilik... yarın.',
      'Kartını kaybetme. Yenisi beş gümüş.',
    ];
    await this.say('celeste', lines[Math.floor(Math.random() * lines.length)], 'normal');
  }

  async registerScene() {
    this.registering = true;
    // Vera, Lina ve Dorn salonda
    for (const id of ['vera', 'lina', 'dorn']) {
      if (!this.w.npc(id)) {
        const p = this.w.mapData.points[id === 'dorn' ? 'adv1' : id];
        this.w.addNpc(NPC_BY_ID[id], p.x, p.y, true);
      } else this.w.npc(id)!.scripted = true;
    }
    const r = R.pay(100, 'Lonca kaydı');
    if (!r.ok) {
      this.registering = false;
      return;
    }
    Sound.sfx('coin');
    await this.ui.narrate('Celeste gümüşü iki parmağıyla, sanki kirliymiş gibi alıp kasaya bırakıyor.');
    const vera = this.w.npc('vera')!;
    const lina = this.w.npc('lina')!;
    const dorn = this.w.npc('dorn')!;
    const a = this.w.player.actor;
    for (const n of [vera, lina, dorn]) this.face(n.actor, a);
    await this.say('vera', 'Lina, bak! Bulaşıkçı maceracı olmaya gelmiş!', 'alayci');
    await this.say('lina', 'Hihihi! Bulaşık bezini kılıç diye mi kullanacak?', 'gulen');
    await this.say('celeste', 'Sessizlik. Elini Appraisal taşına koy. Taş, Level\'ını, skill\'lerini ve statlarını gösterir.', 'normal');
    const sp = this.w.mapData.points.stone;
    await this.walk(a, sp.x, sp.y);
    a.face('right');
    Sound.sfx('appraise');
    const stone = this.w.r.propImages.find((p) => p.p.interact === 'appraisal_stone');
    if (stone) this.w.fx.glow(stone.p.x, stone.p.y - 20, 0x7cc8ff, 90, 1500);
    await wait(this.w, 800);
    await this.stoneReveal();
    Sound.sfx('laugh', 0.8);
    dorn.say('Sıfır! Hepsi sıfır!', 3);
    await wait(this.w, 600);
    lina.say('Hihihihi!', 2.5);
    await wait(this.w, 600);
    vera.say('Level 0! Fareler bile seni döver!', 3);
    await wait(this.w, 1800);
    await this.think('Kahkahalar. Haklılar. Bir fareyle bile dövüşsem kaybedebilirim.');
    await this.think('Taş, o mavi pencerede gördüğüm her şeyi göstermedi. Divine Paladin... Onu kimse göremiyor.');
    await this.say('celeste', 'Gördüğün gibi. Brindlewood şubesi. Rütben G-.', 'alayci');
    // kart
    transact(G.p as any, { label: 'Lonca kartı', give: [{ id: 'guild_card', qty: 1 }] });
    G.p.guildRank = 0;
    G.setFlag('guild_registered');
    R.toast('+1 Lonca Kartı (G-)', 'item', 'card');
    R.sysmsg('LONCA KAYDI', ['Maceracılar Loncası — Brindlewood Şubesi', 'Rütbe: G-', 'Görevler: kendi harfin ve bir üstü (G, F)'], { big: true });
    await this.say('celeste', 'Kartını kaybetme. Yenisi beş gümüş. Görev panosu...', 'normal');
    await this.say('celeste', BOARD_EXCUSES[0], 'normal');
    await this.say('vera', 'Hoş geldin, G- maceracı! Dikkat et, fareler ısırır!', 'alayci');
    this.registering = false;
    for (const n of [vera, lina, dorn]) n.scripted = false;
    await this.endCard();
  }

  async stoneReveal() {
    const W = Display.uiW;
    const c = this.ui.add.container(W / 2 - 300, 70).setDepth(70);
    const g = this.ui.add.graphics();
    const { drawBlue, txt, FONT } = await import('../ui/kit');
    drawBlue(g, 0, 0, 600, 360, 0.88);
    c.add(g);
    c.add(txt(this.ui, 300, 16, '【 APPRAISAL TAŞI — LONCA KAYDI 】', { size: 19, font: FONT.title, color: '#e6f6ff', bold: true }).setOrigin(0.5, 0));
    const rows = [
      ['İsim', 'Joseph'], ['Irk', 'İnsan'], ['Cinsiyet', 'Erkek'], ['Yaş', '18'],
      ['Level', '0'], ['HP', `${G.d.maxHp}`], ['MP', `${G.d.maxMp}`],
      ['Statlar', 'STR 0 · VIT 0 · AGI 0 · DEX 0 · MNA 0 · INT 0 · LUK 0'],
      ['Skill', 'Appraisal (G-)'],
    ];
    rows.forEach(([k, v], i) => {
      c.add(txt(this.ui, 30, 60 + i * 30, k, { size: 17, bold: true, color: '#cfeaff' }));
      const t = txt(this.ui, 170, 60 + i * 30, v, { size: 17, color: '#ffffff' });
      t.setAlpha(0);
      this.ui.tweens.add({ targets: t, alpha: 1, delay: 300 + i * 220, duration: 200, onStart: () => Sound.sfx('click', 0.3) });
      c.add(t);
    });
    c.setAlpha(0);
    this.ui.tweens.add({ targets: c, alpha: 1, duration: 300 });
    await wait(this.w, 4200);
    this.ui.tweens.add({ targets: c, alpha: 0, duration: 400, onComplete: () => c.destroy() });
  }

  async endCard() {
    if (G.flag('ending_shown')) return;
    G.setFlag('ending_shown');
    await wait(this.w, 600);
    await this.ui.curtain(1, 1200);
    Sound.play('title');
    const t1 = this.ui.overlayText('REBORN IN ELONTH', { size: 46, y: Display.uiH / 2 - 60, color: '#d9b45a', font: 'Cinzel, serif' });
    const t2 = this.ui.overlayText('Bölüm I — Köksüz', { size: 24, y: Display.uiH / 2, color: '#a89c84' });
    const t3 = this.ui.overlayText('Devam edecek...', { size: 26, y: Display.uiH / 2 + 60, color: '#efe6d2', font: 'Alegreya, serif' });
    for (const t of [t1, t2, t3]) {
      t.setAlpha(0);
      this.ui.tweens.add({ targets: t, alpha: 1, duration: 1200 });
    }
    await wait(this.w, 5200);
    const t4 = this.ui.overlayText('Brindlewood\'da ve ormanda serbestçe dolaşmaya, avlanmaya ve antrenman yapmaya devam edebilirsin.', { size: 18, y: Display.uiH / 2 + 130, color: '#a89c84' });
    t4.setAlpha(0);
    this.ui.tweens.add({ targets: t4, alpha: 1, duration: 800 });
    await wait(this.w, 3800);
    for (const t of [t1, t2, t3, t4]) this.ui.tweens.add({ targets: t, alpha: 0, duration: 800, onComplete: () => t.destroy() });
    await wait(this.w, 900);
    await this.ui.curtain(0, 1200);
    this.w.updateMusic();
    G.save('auto');
  }

  async talkCaptain() {
    const hasCard = !!G.p.inventory.guild_card;
    await this.say('captain', 'Dur. Bu yol kraliyet şehrine çıkar. Kimsin, nereye?');
    if (!hasCard) {
      await this.say('captain', 'Lonca kartın yok, soyadın yok, paran yok. Geçiş ücreti beş gümüş, kartlı olsan bile. Geri dön.', 'kizgin');
      return;
    }
    await this.say('captain', 'Lonca kartı... G-. Hm. Geçiş ücreti beş gümüş. Ve şehir yolu G- biri için bir haftalık ölüm yürüyüşüdür.');
    const c = await this.ui.choice(['"Ücreti ödemek istiyorum." ', '"Anladım. Dönüyorum."']);
    if (c === 0) {
      if (walletTotal(G.p.wallet) < 500) {
        await this.say('captain', 'Beş gümüş dedim. Cebindekiyle bu kapıdan bir tavuk bile geçmez.');
      } else {
        await this.say('captain', 'Paran var ama rütben yok. Şehre en az E rütbe maceracılar alınıyor bu aralar. Kral emri. Geri dön, evlat.');
      }
    } else await this.say('captain', 'Akıllıca.');
  }

  async talkHunter(n: Npc) {
    await this.say('hunter', n.def.talk.any![Math.floor(Math.random() * n.def.talk.any!.length)]);
    if (G.flag('guild_registered') || this.w.josephStatus() !== 'naked') {
      if (!R.hasSkill('archery')) {
        const c = await this.ui.choice(['"Bana okçuluk öğretir misin?" (40 bronz, 2 saat)', '"Teşekkürler."']);
        if (c === 0) {
          const can = R.canLearnSkill();
          if (!can.ok) {
            await this.say('hunter', 'Bu hafta kafan başka şeylerle dolu gibi. Haftaya.');
            return;
          }
          const r = R.pay(40, 'Okçuluk dersi');
          if (!r.ok) {
            await this.say('hunter', '...Kırk bronz. Ok ucu bedava değil.');
            return;
          }
          await this.trainingTime(120, 'Garrick sana yayı nasıl gereceğini, nefesini nasıl tutacağını gösteriyor. Parmakların kanıyor.');
          R.learnSkill('archery', 'Öğretmen: Garrick');
          await this.say('hunter', 'Yayın yok ama. Demircide kısa yay var. Ya da kendi yolunu bul.');
        }
      }
    }
  }

  async talkShop(n: Npc, kind: 'smith' | 'shop' | 'healer') {
    const st = this.w.josephStatus();
    const pool = [...(n.def.talk[st] ?? []), ...(n.def.talk.any ?? [])];
    if (st === 'naked' && kind !== 'healer') {
      await this.say(n.def.id, pool[0] ?? 'Önce bir şey giy.', 'kizgin');
      return;
    }
    await this.say(n.def.id, pool[Math.floor(Math.random() * pool.length)] ?? 'Buyur.');
    const opts = ['Alışveriş', 'Bir şey satmak istiyorum'];
    const acts: (() => Promise<void>)[] = [async () => openShop(this.ui, kind, 'buy'), async () => openShop(this.ui, kind, 'sell')];
    if (kind === 'healer' && !R.hasSkill('first_aid')) {
      opts.push('İlk yardım öğret (30 bronz, 1 saat)');
      acts.push(async () => {
        const can = R.canLearnSkill();
        if (!can.ok) {
          await this.say('healer', 'Bir haftada bir şey öğrenmek yeter, yavrum. Haftaya gel.');
          return;
        }
        const r = R.pay(30, 'İlk yardım dersi');
        if (!r.ok) {
          await this.say('healer', 'Otuz bronz, yavrum. Otlar kendiliğinden yetişmiyor.');
          return;
        }
        await this.trainingTime(60, 'Ilse Nine sana sargı sarmayı, yarayı temizlemeyi ve merhem yapmayı gösteriyor.');
        R.learnSkill('first_aid', 'Öğretmen: Ilse Nine');
      });
    }
    if (kind === 'healer' && G.p.hp < G.d.maxHp) {
      opts.push('Yaralarımı sar (5 bronz)');
      acts.push(async () => {
        const r = R.pay(5, 'Şifacı');
        if (!r.ok) {
          await this.say('healer', 'Paran yoksa otur, yine de sararım. Ama söyleme kimseye.');
        } else Sound.sfx('coin');
        G.p.hp = G.d.maxHp;
        Sound.sfx('heal');
      });
    }
    opts.push('Hoşça kal');
    acts.push(async () => {});
    const c = await this.ui.choice(opts);
    this.ui.closeDialogue();
    await acts[c]();
  }

  // ============================================================ prop etkileşimi
  interactProp(id: string, p: PropPlacement) {
    if (this.busy) return;
    if (id.startsWith('train_')) return this.training(id.slice(6) as any);
    switch (id) {
      case 'bed_attic':
        return this.scene(async () => this.sleepAttic());
      case 'quest_board':
        return this.scene(async () => {
          await this.think('Pano... boş. Kenarlarda eski raptiye delikleri. Altta bir not: "Yeni ilanlar yarın."');
          if (this.w.npc('celeste')) await this.say('celeste', BOARD_EXCUSES[(G.state.time.day - 1) % BOARD_EXCUSES.length]);
        });
      case 'rank_table':
        return this.scene(async () => {
          await this.ui.system('RÜTBE TABLOSU: G → F → E → D → C → B → A → S → X. Görev alabileceğin rütbeler: kendi harfin ve bir üstü. D-\'den itibaren terfi sınavı.');
          await this.think('S rütbede sadece iki üç kişi varmış. X... sadece efsanelerde.');
        });
      case 'appraisal_stone':
        return this.scene(async () => {
          if (!G.flag('guild_registered')) await this.think('Mavi bir taş. İçinde ışık dönüyor. Kayıt için kullanıyorlarmış.');
          else await this.think('Taş artık sessiz. Kayıttan sonra bir daha dokunmama izin vermezler herhalde.');
        });
      case 'archery_target':
        return this.scene(async () => {
          await this.think(R.hasSkill('archery') ? 'Bir yayım olsa burada atış çalışabilirim.' : 'Ok izleriyle dolu bir hedef. Biri sık sık çalışıyor.');
        });
    }
  }

  async sleepAttic() {
    const ok = !!G.flag('bertram_deal') || G.flag('room_day') === G.state.time.day;
    if (!ok) {
      await this.think('Bu yatak benim değil.');
      return;
    }
    const h = G.state.time.minute / 60;
    if (h > 6 && h < 17) {
      const c = await this.ui.choice(['Akşama kadar dinlen', 'Vazgeç']);
      if (c !== 0) return;
    }
    await this.ui.curtain(1, 900);
    Sound.play('night');
    const bed = this.w.mapData.points.bed;
    this.w.sleep({ map: 'inn_attic', x: bed.x, y: bed.y });
    const t = G.state.time;
    if (h > 6 && h < 17) G.state.time = { day: t.day, minute: 18 * 60 };
    else G.state.time = nextMorning(t);
    R.onNewDay();
    this.onNewDay();
    G.p.hp = G.d.maxHp;
    G.p.mp = G.d.maxMp;
    G.p.stamina = G.d.maxStamina;
    G.state.divine.light = 0;
    const msg = this.ui.overlayText('Uyuyorsun...', { size: 26, color: '#a9c8ff' });
    await wait(this.w, 1600);
    msg.destroy();
    G.save('auto');
    R.sysmsg('KAYDEDİLDİ', ['Yeniden doğma noktası: tavan arası.', `${G.state.time.day}. gün, sabah.`]);
    await this.ui.curtain(0, 900);
    this.w.updateMusic();
    if (G.state.time.minute / 60 < 8 && !G.flag('worked_today')) await this.think('Sabah. Bertram aşağıda bekliyordur.');
  }

  async training(kind: 'chop' | 'lift' | 'run') {
    this.scene(async () => {
      if (!R.trainingAvailable()) {
        await this.think('Bugün yeterince antrenman yaptım. Bedenim daha fazlasını kaldırmaz. (Günde en fazla 3)');
        return;
      }
      const names = { chop: 'Odun Kesme', lift: 'Taş Kaldırma', run: 'Koşu Parkuru' };
      const c = await this.ui.choice([`${names[kind]} antrenmanı yap (1 saat)`, 'Vazgeç']);
      if (c !== 0) return;
      this.ui.closeDialogue();
      const perf = await new Promise<number>((resolve) => {
        this.w.scene.launch('Minigame', { kind, done: resolve });
        this.w.scene.bringToTop('Minigame');
        this.w.paused = true;
      });
      this.w.paused = false;
      G.state.time.minute += 60;
      if (G.state.time.minute >= 1440) {
        G.state.time.minute -= 1440;
        G.state.time.day++;
      }
      const e = R.completeTraining(perf);
      G.p.stamina = Math.max(0, G.p.stamina - 30);
      await this.think(perf > 0.75 ? 'Kaslarım yanıyor, ama içimde bir şey parlıyor. Divine...' : perf > 0.4 ? 'Fena değil. Biraz daha güçlendim galiba.' : 'Berbattı. Ama bir şey kazandım yine de.');
      R.sysmsg('ANTRENMAN', [`${names[kind]} · Performans %${Math.round(perf * 100)}`, `Divine EXP +${e}`, `Bugün kalan seans: ${3 - G.state.divine.trainingCount}`]);
    });
  }

  // ============================================================ awakening ve keşif teklifleri
  tryPending() {
    if (this.busy || this.w.cutscene || this.w.inBattle || this.ui.dialogueOpen() || this.ui.menuOpen() || this.w.paused) return;
    const dv = G.state.divine;
    if (dv.pendingAwakenings.length) {
      const lv = dv.pendingAwakenings.shift()!;
      this.scene(async () => this.awakening(lv));
      return;
    }
    if (G.state.pendingDiscoveries.length) {
      const sk = G.state.pendingDiscoveries.shift()!;
      this.scene(async () => this.discovery(sk));
    }
  }

  async awakening(level: number) {
    this.musicOverride = true;
    Sound.play('void');
    Sound.sfx('awaken');
    const W = Display.uiW, H = Display.uiH;
    const glow = this.ui.add.rectangle(0, 0, W, H, 0xffe9a0, 0).setOrigin(0, 0).setDepth(85).setBlendMode(Phaser.BlendModes.ADD);
    this.ui.tweens.add({ targets: glow, fillAlpha: 0.55, duration: 1400, yoyo: true, hold: 600 });
    const a = this.w.player.actor;
    for (let i = 0; i < 6; i++) this.w.time.delayedCall(i * 250, () => this.w.fx.ring(a.x, a.y - 20, 0xffe28a, 60 + i * 20, 900));
    this.w.fx.glow(a.x, a.y - 20, 0xffe28a, 140, 3000);
    await wait(this.w, 2200);
    glow.destroy();
    const lines = DIVINE_STATS.map((s) => `${DIVINE_STAT_NAMES[s]} ${divineStat(s, level).toFixed(2)}x`);
    await this.ui.system(`Divine Paladin — AWAKENING (Divine Level ${level}). Tüm Divine statları ×1.5 yükseldi. ${lines.join(' · ')}`);
    const opts = divineOffer(level, G.state.divine.skills);
    if (opts.length) {
      await this.ui.system('Sistem üç Divine skill öneriyor. Birini seç. İade yok.');
      this.ui.closeDialogue();
      const i = await panelChoice(this.ui, 'DIVINE SKILL SEÇİMİ', opts.map((o) => ({ title: o.name + (o.kind === 'passive' ? ' (Pasif)' : ` (Aktif · Işık ${o.light})`), desc: o.desc, icon: o.icon })), true);
      const pick = opts[i];
      G.state.divine.skills.push(pick.id);
      R.sysmsg('DIVINE SKILL', [`Divine Paladin: ${pick.name}`, pick.kind === 'active' ? 'Işık barı açıldı. Vuruş yaptıkça ve kaçtıkça dolar.' : 'Pasif olarak her zaman etkin.'], { big: true, sound: 'title' });
      G.invalidate();
      this.ui.refreshButtons();
    }
    this.musicOverride = false;
    this.w.updateMusic();
    G.save('auto');
  }

  async discovery(skillId: string) {
    const def = SKILLS[skillId];
    const hint = HIDDEN_DISCOVERIES.find((h) => h.skill === skillId)?.hint ?? '';
    await this.ui.system(`${hint} Sistem bir skill öneriyor: ${def.name} (${RARITY_NAMES[def.rarity]}). ${def.desc}`);
    const can = R.canLearnSkill();
    if (!can.ok) {
      await this.ui.system(`${can.reason} Teklif haftaya ertelendi.`);
      G.setFlag('postponed_' + skillId, weekOfDay(G.state.time.day));
      return;
    }
    const c = await this.ui.choice([`Kabul et: ${def.name}`, 'Reddet']);
    if (c === 0) R.learnSkill(skillId, 'Gizli keşif');
    else {
      G.setFlag('declined_' + skillId);
      R.toast('Teklif reddedildi.', 'info');
    }
  }
}
