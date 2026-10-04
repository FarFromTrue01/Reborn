// Bölüm II — "G- Rütbe". Lonca kaydından sonra başlar ve şehir kapısında, giriş kartıyla biter.
// Akış: silah (Bertram) → pano (Celeste, G görevleri) → G1/G2/G3 → "Biraz hava" → yaralı Vera ve Lina →
// ertesi gün dostluk ve ilk ortak F görevi (otlaktaki fareler) → G rütbe (Terfi: Celeste o anda işler) → ilk kadeh →
// kâhyanın kesesi → ikinci ortak F görevi (değirmen bodrumu) → 10 gümüş → veda → giriş kartı ve şehir manzarası.
// Yan görevler ve pano ilanları ilk kadehten sonra açılır.
import Phaser from 'phaser';
import { G } from '../game/G';
import { Q } from '../game/questrt';
import * as R from '../game/rules';
import { Sound } from '../audio/audio';
import { TILE } from '../world/types';
import type { Npc, MarkerKind } from '../world/npc';
import type { Warp } from '../world/types';
import type { Director } from './director';
import { NPC_BY_ID } from '../data/npcs';
import { SIDE_QUESTS, SIDE_SCRIPTS, boardForDay, MAX_BOARD_QUESTS } from '../data/sidequests';
import { currentObjective, activeQuests, type QuestDef, type QuestTarget } from '../core/quests';
import { questDef } from '../data/quests';
import { canTakeQuest, riskText, QUEST_POINTS, reRegister, REREGISTER_FEE, pointsToNext } from '../core/guild';
import { subRankToString } from '../core/ranks';
import { equip, transact } from '../core/transactions';
import { walletTotal } from '../core/money';
import { buyCard, hasValidCard, CARD_PRICE, CARD_DAYS, CITY_FULL_NAMES, CITY_TITLES } from '../core/cards';
import { hourOf, whenLabel } from '../core/time';
import { absMinute } from '../core/sleep';
import { Display } from '../game/display';
import { SIDE_POSTS, atPostNow, visibleGiverMarks, type SideMark, type SideQuestView } from './sideposts';
import { ensureMainQuest } from './mainline';
import { ITEMS } from '../data/items';

const wait = (scene: Phaser.Scene, ms: number) => new Promise<void>((r) => scene.time.delayedCall(ms, r));

/** Kesenin şüphelileri (E5). Gerçek hırsız yalnızca Appraisal ile anlaşılır. */
export const THEFT_SUSPECTS: Record<string, { thief: boolean; at: string; clue: string[] }> = {
  vagrant: {
    thief: false, at: 'beggar_spot',
    clue: ['Köksüz Nim. Level 1. Statları sıradan, LUK biraz yüksek.', 'Herkes ona bakıyor. Benim gibi köksüz, benim gibi aç. Ama elleri titriyor; kese kesecek eller değil bunlar.'],
  },
  beggar: {
    thief: false, at: 'bench_w1',
    clue: ['Dilenci Moss. Level 0. Altmış üç yaşında.', 'Bastonsuz yürüyemiyor. Kâhyanın yanına bile yaklaşamaz.'],
  },
  apprentice: {
    thief: false, at: 'smithy_yard',
    clue: ['Çırak Ott. On beş yaşında, Level 1. STR 2, DEX 1.', 'Elleri kömür karası. Bütün sabah körük çekmiş; kollarındaki is taze.'],
  },
  washer: {
    thief: true, at: 'wash_line',
    clue: ['Çamaşırcı Wynn. Level 2. AGI 7, DEX 5.', 'Bir çamaşırcı için... fazla çevik. Köydeki herkesten hızlı. Ve önlüğünün cebi bir yana sarkıyor.'],
  },
};

/** Vera ve Lina'nın dostluk sonrası balonları ve konuşmaları (E4). */
const FRIEND_LINES: Record<string, { bubbles: string[]; talk: string[] }> = {
  vera: {
    bubbles: ['Köksüz! Bugün de mi fare?', 'Bak, bizim köksüz geliyor.', 'Kaburgam iyi. Sorduğun için... sormadın ama.', 'Sırtını dik tut, köksüz.'],
    talk: ['Köksüz. Otur bir dakika. ...Tamam, oturma. Ama dur.', 'Lina hâlâ seni anlatıyor. "Beni sırtında taşıdı" diye. Bıktım.', 'Kılıç almadın mı hâlâ? O sopayla bir kurt bile güler sana.', 'Şehir mi? Bir gün. Kart on gümüş. Sen önce bir gümüş biriktir, köksüz.'],
  },
  lina: {
    bubbles: ['Hihi, köksüz!', 'Kulaklarım seni uzaktan duydu~', 'Bugün kimse ölmesin, tamam mı?', 'Köksüz! Buraya!'],
    talk: ['Hihi! Sırtın rahattı, biliyor musun? Bir daha taşır mısın? Şaka şaka.', 'Vera sana "köksüz" diyor ama sesi yumuşadı. Fark ettin mi? Hihi.', 'Oklarımı saydım. On iki. Hepsi sağ. Bugün iyi bir gün.'],
  },
};

export class Chapter2 {
  /** Bu harita yüklemesinde doğurulan görev düşmanları. */
  private spawned = new Set<string>();
  private tickT = 0;

  constructor(public d: Director) {}

  get w() {
    return this.d.w;
  }

  get ui() {
    return this.d.ui;
  }

  say(id: string, text: string, expr?: any) {
    return this.d.say(id, text, expr);
  }

  think(text: string) {
    return this.d.think(text);
  }

  get day() {
    return G.state.time.day;
  }

  started() {
    return !!G.flag('guild_registered');
  }

  /** Pano açık mı? 0.6.0: silah alınınca aynı gün açılır (eski kayıtlar: kaydın ertesi günü). */
  boardOpen() {
    const s = Number(G.flag('ch2_start_day') || 0);
    return this.started() && (Q.done('m_weapon') || this.day > s);
  }

  sideUnlocked() {
    return !!G.flag('side_unlocked');
  }

  objIdx(id: string): number {
    const def = Q.def(id);
    const st = G.state.quests.quests[id];
    if (!def || !st || st.status !== 'active') return -1;
    return currentObjective(def, st);
  }

  /** Aktif görevin şu anki amacı bu tür ve hedef mi? */
  at(id: string, type: string, target?: string): boolean {
    const i = this.objIdx(id);
    if (i < 0) return false;
    const o = Q.def(id)!.objectives[i];
    return o.type === type && (target === undefined || o.target === target);
  }

  // ============================================================ başlangıç
  /** Kayıttan hemen sonra (registerScene sonunda). */
  async onRegistered() {
    G.state.guild.member = true;
    G.setFlag('ch2_start_day', this.day);
    Q.complete('m_register', { silent: true });
    await wait(this.w, 400);
    await this.think('Bir kart. Üstünde adım ve bir harf: G-. Bu dünyada sahip olduğum ilk resmî şey.');
    await this.think('Ama silahım yok. Bir fareyle bile çıplak elle mi dövüşeceğim? Bertram\'a sormalıyım.');
    Q.start('m_weapon');
    G.save('auto');
  }

  // ============================================================ E1: silah
  async weaponScene() {
    await this.say('bertram', 'Kart, ha? Göster bakayım. G-. Hah. Ben de G-\'yle başladım. Herkes başlar.');
    await this.say('bertram', 'Ama kartla fare öldürülmez, evlat. Bekle.');
    this.ui.closeDialogue();
    await wait(this.w, 700);
    Sound.sfx('pickup');
    await this.say('bertram', 'Al. Odunluğun dibinde buldum. İçini kurt yemiş ama vurunca ses çıkarır.');
    await this.say('joseph', 'Bu... bir sopa.');
    await this.say('bertram', 'Kılıç alacak paran olunca kılıç taşırsın.');
    transact(G.p as any, { label: 'Bertram\'ın sopası', give: [{ id: 'cracked_stick', qty: 1 }] });
    if (!G.p.equipment.weapon) {
      equip(G.p as any, 'cracked_stick', 'weapon');
      this.w.player.refreshLayers();
      G.invalidate();
    }
    R.sysmsg('EKİPMAN', ['Çatlak Sopa (G) [Hasar 1–1]', 'Dükkândaki en kötü silahtan bile zayıf.', 'Saygınlık −2: insanlar sopana bakıp gülümseyecek.'], { sound: 'system' });
    Q.complete('m_weapon', { silent: true });
    await this.say('bertram', 'Şimdi loncaya git. Celeste sopanı görünce burun kıvırır ama ilanını verir. Gün daha bitmedi, evlat.');
    await this.think('Bir sopa ve bir kart. Loncaya dönüp panodan bir iş alacağım.');
    if (!Q.status('m_grank')) Q.start('m_board');
    G.save('auto');
  }

  // ============================================================ E1/E2: pano açılışı
  async boardOpening() {
    G.setFlag('ch2_board_open', this.day);
    const w = this.w;
    const a = w.player.actor;
    // Vera ve Lina goblin ilanını kapar: programları ne derse desin sahnede olsunlar (kapıdan girerler)
    const cast = await this.d.ensureActors(['vera', 'lina'], { from: 'door' });
    const vera = cast.npcs.vera;
    const lina = cast.npcs.lina;
    await this.say('celeste', 'Pano açık. Sopanı gördüm; gülmeyeceğim. Merak etme, senin için de bir şey var.', 'alayci');
    await this.say('celeste', 'G görevleri. Üç tane. Senin rütbende başka bir şey yok zaten.', 'normal');
    if (vera) this.d.face(vera.actor, a);
    if (lina) this.d.face(lina.actor, a);
    await this.say('vera', 'Goblin kampı keşfi. F görevi. Seksen bronz. Bu bizim.', 'alayci');
    await this.say('lina', 'Hihi! Köksüz de gelsin mi? Yem lazım olur!', 'gulen');
    const c = await this.ui.choice(['"Henüz değil. Ölmek için buraya gelmedim."', '(Sessizce G ilanlarını al.)']);
    if (c === 0) {
      await this.say('joseph', 'Henüz değil. Ölmek için buraya gelmedim.');
      await this.say('vera', 'Hıh. Akıllı köksüz. Nadir bulunur.', 'saskin');
    } else await this.say('vera', 'Fareler seni bekliyor, bulaşıkçı. Selam söyle.', 'alayci');
    await this.say('lina', 'Hihi, yarın görüşürüz! Belki!', 'gulen');
    this.d.releaseActors(cast);
    Q.start('m_grank');
    if (Q.active('m_board')) Q.complete('m_board', { quiet: true });
    Q.start('g1_rats', true);
    Q.start('g2_herbs', true);
    Q.start('g3_letter', true);
    R.giveItems([{ id: 'guild_letter', qty: 1 }], 'Lonca mektubu');
    Q.track('g1_rats');
    R.sysmsg('G GÖREVLERİ', ['Ahırdaki Fareler · 10 Lonca Puanı · {m:20}', 'Şifacıya Ot · 10 Lonca Puanı · {m:30}', 'Kontrol Noktasına Mektup · 10 Lonca Puanı · {m:30}', 'G rütbesi için 40 Lonca Puanı gerekir.'], { big: true });
    await this.say('celeste', 'Başarısız olursan puanın gider ve ödülün iki katını ödersin. Kartın da gidebilir. İyi şanslar.', 'alayci');
    G.save('auto');
  }

  // ============================================================ Celeste
  async talkCeleste(): Promise<boolean> {
    if (!this.started()) return false;
    const g = G.state.guild;
    // kart alınmışsa: yeniden kayıt
    if (!g.member || G.p.guildRank === null) {
      await this.say('celeste', 'Kartın alınmıştı, hatırlıyor musun? Yeniden kayıt bir gümüş. G-\'den, sıfır puandan başlarsın.', 'alayci');
      const c = await this.ui.choice([`Yeniden kaydol ({m:${REREGISTER_FEE}})`, 'Sonra.']);
      if (c !== 0) return true;
      const r = R.pay(REREGISTER_FEE, 'Lonca yeniden kayıt', true);
      if (!r.ok) {
        await this.say('celeste', 'Bir gümüş. Yok mu? Kapı arkanda.', 'alayci');
        return true;
      }
      reRegister(g);
      G.p.guildRank = 0;
      R.giveItems([{ id: 'guild_card', qty: 1 }], 'Lonca kartı');
      R.sysmsg('LONCA KAYDI', ['Rütbe: G-', 'Lonca Puanı: 0', g.debt ? `Borç: {m:${g.debt}}` : 'Borç yok']);
      return true;
    }
    // terfi: puan eşiği geçildiyse "Terfi" görevi açıktır; konuşunca terfi o anda işlenir
    if (Q.rankupActive()) {
      await this.promotionTalk();
      return true;
    }
    // teslimler
    for (const id of activeQuests(G.state.quests)) {
      if (this.at(id, 'talk', 'celeste')) {
        await this.turnIn(id);
        return true;
      }
    }
    if (!this.boardOpen()) {
      await this.say('celeste', 'Eli boş maceracıya ilan vermem. Fare seni yer, ceza bana kalır. Önce kendine bir silah bul.', 'alayci');
      return true;
    }
    if (!Q.status('m_grank')) {
      await this.boardOpening();
      return true;
    }
    const opts: string[] = [];
    const acts: (() => Promise<void>)[] = [];
    if (this.sideUnlocked()) {
      opts.push('Pano ilanlarına bak');
      acts.push(async () => this.boardMenu());
    }
    opts.push('Lonca Puanım ne durumda?');
    acts.push(async () => {
      const nx = pointsToNext(g.points, G.p.guildRank!);
      await this.say('celeste', `Lonca Puanı ${g.points}.${nx !== null ? ` Bir sonraki kademeye ${nx} puan.` : ''}${g.debt ? ` Loncaya ${g.debt} bronz borcun var; sonraki ödüllerinden keseriz.` : ''}`, 'normal');
    });
    opts.push('Hoşça kal.');
    acts.push(async () => {});
    await this.say('celeste', this.sideUnlocked() ? 'Pano orada. Okumayı biliyorsun, değil mi?' : 'G görevlerini bitir. Sonra konuşuruz.', 'normal');
    const c = await this.ui.choice(opts);
    await acts[c]();
    return true;
  }

  /**
   * Terfi (0.5.0): Celeste kayıtları işler ve terfi o anda gerçekleşir; ekranda rütbe atlama animasyonu oynar.
   * inline: başka bir teslimin ortasında (Celeste zaten konuşuyor), giriş cümlesi atlanır.
   */
  async promotionTalk(inline = false) {
    if (!inline) await this.say('celeste', 'Lonca Puanın eşiği geçmiş. Kartını ver, kayıtlarını işleyeyim.', 'normal');
    const r = Q.promote();
    if (!r) {
      await this.say('celeste', 'Hm. Puanın eşiğin altına düşmüş. Bu kayıt işlenmez.', 'normal');
      return;
    }
    // animasyon bitene (ya da oyuncu dokunup geçene) kadar bekle
    this.ui.closeDialogue();
    await this.ui.whenOverlaysIdle();
    const to = subRankToString(r.to);
    await this.say('celeste', r.to === 1 ? 'G. Kartını damgaladım. ...Tebrikler. Sanırım.' : `${to}. Damgalandı. Tebrikler, maceracı.`, r.to === 1 ? 'normal' : 'gulen');
    // eski kayıtlarda (0.4.x) açık kalan "Kayıtlar Yarın İşlenir" görevi: hikâye ilk kadehle sürer
    if (Q.active('m_promotion')) {
      Q.complete('m_promotion', { quiet: true });
      if (!Q.status('m_celebrate')) Q.start('m_celebrate');
    }
  }

  /** Görevi Celeste'ye teslim et. */
  async turnIn(id: string) {
    const def = Q.def(id)!;
    // toplama amaçlarının eşyalarını al
    for (const o of def.objectives) if (o.type === 'collect' && o.target && o.count) R.takeItem(o.target, o.count, 'Görev teslimi');
    switch (id) {
      case 'g1_rats':
        await this.say('celeste', 'Kuyruklar. Bir, iki... altı. Haldor\'un ahırı bu gece sessiz uyur.', 'normal');
        Q.complete(id);
        break;
      case 'g2_herbs':
        await this.say('celeste', 'Ilse Nine otları almış. Ödülün yirmi bronz.', 'normal');
        await this.say('joseph', 'İlanda otuz yazıyordu.');
        await this.say('celeste', 'On bronz kayıt masrafı. Lonca kâğıdı bedava değil. Mürekkep de. Benim zamanım hiç değil.', 'alayci');
        Q.complete(id, { money: 20 });
        break;
      case 'g3_letter':
        await this.say('celeste', 'Kaptan mührü gördü mü? Güzel. Otuz bronz. Bu sefer masraf yok; kaptanın imzası pahalı.', 'normal');
        Q.complete(id);
        break;
      case 'f_wolves':
        await this.say('lina', 'Yüz yirmi bronz, üçe bölünür. Kırk, kırk, kırk. Hihi, matematik kolay!', 'gulen');
        await this.say('vera', 'Celeste kayıt masrafı kesmeye kalkmasın. Grup görevi, ödül paylaşılır, kesilmez.', 'alayci');
        await this.say('celeste', '...Kırk bronz. Ve grup görevi: puanın yarısı. On beş.', 'normal');
        Q.complete(id);
        await this.think('Kimse benim payımdan kesmedi. İlk kez.');
        for (const c of ['vera', 'lina']) this.w.removeCompanion(c);
        this.w.player.burden = 1;
        if (Q.rankupActive()) {
          await this.say('celeste', 'Kırk beş puan. G eşiğini geçtin. Dur, kaydını hemen işleyeyim.', 'normal');
          await this.promotionTalk(true);
        }
        if (G.p.guildRank !== null && G.p.guildRank >= 1) {
          await this.say('vera', 'G oldun, köksüz. Akşam handa ol. Kutlarız. Geç kalma.', 'normal');
          if (!Q.status('m_celebrate')) Q.start('m_celebrate');
        } else await this.say('vera', 'G eşiğine az kaldı, köksüz. Akşam handa ol yine de. Geç kalma.', 'normal');
        break;
      case 'f_cellar':
        await this.say('celeste', 'Değirmen bodrumu. Dört dev fare. Otuz bronz kişi başı, on beş puan.', 'normal');
        Q.complete(id);
        for (const c of ['vera', 'lina']) this.w.removeCompanion(c);
        await this.say('vera', 'Dinle köksüz. Şehre gideceksen giriş kartı lazım. Kaptan Roderick satar. On gümüş, üç ay geçerli.', 'normal');
        await this.say('lina', 'Üç ay sonra yenisini alırsın. Ya da bir iş bulursun ve kalırsın! Hihi.', 'gulen');
        await this.say('vera', 'On gümüş. Bin bronz. Fare kuyruğuyla birikmez ama birikir.', 'normal');
        Q.start('m_silver');
        break;
      case 'm_promotion':
        // eski kayıtlar (0.4.x): terfi zaten işlendiyse yalnızca hikâye sürer
        await this.say('celeste', 'Kartın damgalı. Tebrikler. Sanırım.', 'normal');
        Q.complete(id, { quiet: true });
        if (!Q.status('m_celebrate')) Q.start('m_celebrate');
        break;
      default:
        if (def.kind === 'board') {
          await this.say('celeste', def.rank === 'F' ? 'Bir F ilanı. Köksüzden. Hm. Teslim alındı.' : 'Teslim alındı.', 'normal');
          Q.complete(id);
        } else Q.complete(id);
    }
    // üst görevin amacı (ör. G- Rütbe → "G görevi: Ahırdaki Fareler")
    if (Q.done(id)) Q.notify('custom', id);
    // üç G görevi bitince
    if (Q.active('m_grank') && ['g1_rats', 'g2_herbs', 'g3_letter'].every((g) => Q.done(g))) {
      Q.complete('m_grank');
      R.sysmsg('G GÖREVLERİ TAMAM', [`Lonca Puanı: ${G.state.guild.points}/40`, 'G rütbesine 10 puan kaldı.'], { sound: 'title' });
      this.ui.closeDialogue();
      await this.think('Yetmiş bronz. Hayatımda kazandığım en çok para. Bu paraya şimdi dokunamam; bir sonraki iş için lazım.');
      await this.think('Biraz hava alayım. Ormanın kenarı sakin olur.');
      G.setFlag('spend_lock');
      Q.start('m_air');
    }
    G.save('auto');
  }

  /** Pano: günün ilanları (3–4). En fazla üç pano görevi aynı anda (MAX_BOARD_QUESTS). */
  async boardMenu() {
    const posts = boardForDay(this.day).filter((q) => !Q.status(q.id));
    const activeBoard = activeQuests(G.state.quests).filter((id) => Q.def(id)?.kind === 'board');
    if (!posts.length) {
      await this.say('celeste', 'Bugünün ilanları bitti. Yarın sabah yenileri asılır.', 'normal');
      return;
    }
    if (activeBoard.length >= MAX_BOARD_QUESTS) {
      await this.say('celeste', 'Elinde üç ilan var. Önce onları bitir. Lonca açgözlü maceracı sevmez.', 'alayci');
      return;
    }
    const opts = posts.map((q) => `${q.rank} · ${q.title} · {m:${q.reward.money}}`);
    opts.push('Vazgeç');
    const c = await this.ui.choice(opts);
    if (c >= posts.length) return;
    const q = posts[c];
    if (!canTakeQuest(G.p.guildRank ?? 0, q.rank!)) {
      await this.say('celeste', 'Bu ilan senin rütbene göre değil.', 'normal');
      return;
    }
    await this.say('celeste', `${q.title}. ${q.desc}`, 'normal');
    await this.say('celeste', `${riskText(q.reward.points ?? QUEST_POINTS[q.rank!], q.reward.money ?? 0)} Üç gün içinde teslim etmezsen başarısız sayılır.`, q.rank === 'F' ? 'alayci' : 'normal');
    const ok = await this.ui.choice(['İlanı al', 'Vazgeç']);
    if (ok !== 0) return;
    Q.start(q.id, false, q);
    if (q.objectives.some((o) => o.type === 'deliver')) R.giveItems([{ id: 'guild_letter', qty: 1 }], 'Lonca mektubu');
  }

  /** Lonca panosu (prop). */
  async board(): Promise<boolean> {
    if (!this.started()) return false;
    if (!this.boardOpen()) {
      await this.think('Panoda ilanlar var. Ama elimde silah yokken Celeste bana hiçbirini vermez. Bertram\'a sormalıyım.');
      return true;
    }
    if (!Q.status('m_grank')) {
      if (this.w.npc('celeste')) await this.boardOpening();
      else await this.think('Pano açılmış ama ilanları Celeste dağıtıyor. Görevli masasında yok.');
      return true;
    }
    if (!this.sideUnlocked()) {
      await this.think('Panoda F ilanları da var. Ama Celeste bana yalnızca G görevlerini veriyor. Önce onları bitirmeliyim.');
      return true;
    }
    await this.boardMenu();
    return true;
  }

  // ============================================================ NPC konuşmaları
  async talk(n: Npc): Promise<boolean> {
    if (!G.flag('woke')) return false;
    const id = n.def.id;
    if (await this.deliverTo(n)) return true;
    switch (id) {
      case 'bertram':
        if (Q.active('m_weapon')) {
          await this.weaponScene();
          return true;
        }
        if (Q.active('m_farewell')) {
          await this.farewellScene();
          return true;
        }
        break;
      case 'celeste':
        return this.talkCeleste();
      case 'captain':
        return this.talkCaptain();
      case 'oswin':
        if (Q.active('f_cellar') && this.objIdx('f_cellar') <= 1) {
          await this.say('oswin', 'Bodrum kapısı açık. Fareler... köpek kadar. Ben burada beklerim.');
          return true;
        }
        break;
      case 'healer':
        if (Q.active('m_wounded') && this.objIdx('m_wounded') === 1) {
          await this.healerPay();
          return true;
        }
        break;
      case 'vera':
      case 'lina':
        if (await this.talkFriends(n)) return true;
        break;
      case 'guard_hob':
      case 'guard_wil':
      case 'guard_pell':
        if (Q.active('m_theft') && this.objIdx('m_theft') === 1) {
          await this.accuse(id);
          return true;
        }
        break;
      case 'shepherd':
        if (Q.active('f_wolves')) {
          await this.say('shepherd', this.objIdx('f_wolves') <= 1 ? 'Fareler tarladan taştı, otlağa indi. Kedi kadar, bir sürü! Kuzularımın bacaklarını ısırıyorlar, maceracı!' : 'Sağ olun! Sürüm sağ olsun! Kuzuların biri size, ...şaka. Ama sağ olun.');
          return true;
        }
        break;
    }
    if (await this.sideTalk(n)) return true;
    if (G.flag('friends_vl') && (id === 'vera' || id === 'lina')) {
      const t = FRIEND_LINES[id].talk;
      await this.say(id, t[Math.floor(Math.random() * t.length)], id === 'lina' ? 'gulen' : 'normal');
      return true;
    }
    return false;
  }

  /** Teslim amaçları: mektup, paket, ekmek, kese. */
  async deliverTo(n: Npc): Promise<boolean> {
    const id = n.def.id;
    for (const qid of activeQuests(G.state.quests)) {
      if (!this.at(qid, 'deliver', id)) continue;
      const i = this.objIdx(qid);
      if (qid === 'g3_letter') {
        R.takeItem('guild_letter');
        await this.say('captain', 'Lonca mührü. Celeste\'nin el yazısı... her zamanki gibi kibirli. Tamam, köksüz. Aldım.');
        await this.say('captain', 'Söyle ona, mektup ulaştı. Ve sana bir tavsiye: bu yoldan şehre G- rütbeyle geçilmez.');
        Q.advance(qid, i);
        return true;
      }
      if (qid === 'sq_tailor_parcel') {
        const p = R.josephPrestige();
        if (p < 3) {
          await this.say(id, 'Köksüz. Bir terzi paketi mi? Arka kapıya. Hayır, arka kapı da sana göre değil. Defol.', 'kizgin');
          await this.think(`Saygınlığım ${p > 0 ? '+' : ''}${p}. Bu kılıkla beni dinlemiyor bile. Daha düzgün giyinmeliyim (en az +3).`);
          return true;
        }
        R.takeItem('side_parcel');
        await this.say(id, 'Mirelle\'in kumaşı. Hm. Kabul edilebilir. Git, ona söyle.');
        Q.advance(qid, i);
        return true;
      }
      if (qid === 'sq_mill_sacks') {
        R.takeItem('side_parcel');
        await this.say(id, 'Oswin\'in unu mu? Kendisi gelemedi mi? Borcundan kaçıyor, biliyorum. Neyse, sağ ol.');
        Q.advance(qid, i);
        return true;
      }
      if (qid === 'sq_nim_bread') {
        if (await this.awayFromPost(n)) return true;
        if (!G.p.inventory.bread) {
          await this.think('Elimde ekmek yok. Fırından ya da handan almalıyım.');
          return true;
        }
        R.takeItem('bread');
        for (const l of SIDE_SCRIPTS.sq_nim_bread.done) await this.say(id, l);
        Q.complete(qid);
        G.affinity('vagrant', 3);
        return true;
      }
      if (Q.def(qid)?.kind === 'board') {
        if (G.p.inventory.guild_letter) R.takeItem('guild_letter');
        await this.say(id, 'Lonca mı gönderdi? Tamam, aldım. Söyle onlara, ulaştı.');
        Q.advance(qid, i);
        return true;
      }
    }
    // E2: şifacıya ot
    if (id === 'healer' && Q.active('g2_herbs') && this.objIdx('g2_herbs') === 1) {
      R.takeItem('herb', 5, 'Görev teslimi');
      await this.say('healer', 'Beş ot. Güzel, yavrum. Taze. Celeste\'ye söyle, aldım. Ödülü o verir. ...Verir mi bakalım.');
      Q.advance('g2_herbs', 1);
      return true;
    }
    return false;
  }

  // ============================================================ yan görev iş yerleri (0.6.0)
  sideView(): SideQuestView {
    return {
      status: (id) => Q.status(id),
      objective: (id) => this.objIdx(id),
      unlocked: this.sideUnlocked(),
      declinedToday: (id) => G.flag('decline_' + id) === this.day,
      has: (item) => (G.p.inventory[item] ?? 0) > 0,
    };
  }

  /** Görev işaretleri: iş yerinde olan (programa göre) verenler. */
  sideMarks(): Record<string, SideMark> {
    return visibleGiverMarks(this.sideView(), NPC_BY_ID, this.day, G.state.time.minute / 60, (m) => this.w.pointsOf(m));
  }

  /** Bu NPC şu an gerçekten iş yerinde mi (bu haritada, bu konumda, bu saatte)? */
  atPost(n: Npc): boolean {
    return atPostNow(n.def.id, this.w.mapData.id, { x: n.x / TILE, y: n.y / TILE }, G.state.time.minute / 60, (m) => this.w.pointsOf(m));
  }

  /** Bu kişinin yan görevle ilgili söyleyecek bir şeyi var mı (teklif, bekleyen ya da teslim)? */
  hasSideBusiness(id: string): boolean {
    return SIDE_QUESTS.some((q) => q.giver === id && (Q.status(q.id) === 'active' || (!Q.status(q.id) && this.sideUnlocked() && G.flag('decline_' + q.id) !== this.day)));
  }

  /** İş yeri dışında: görevden bahsetmez, kısa bir yönlendirme söyler. */
  async awayFromPost(n: Npc): Promise<boolean> {
    const gp = SIDE_POSTS[n.def.id];
    if (!gp || !this.hasSideBusiness(n.def.id) || this.atPost(n)) return false;
    await this.say(n.def.id, gp.away);
    return true;
  }

  /** Yan görev teklifleri ve teslimleri (yalnızca verenin iş yerinde). */
  async sideTalk(n: Npc): Promise<boolean> {
    const id = n.def.id;
    if (await this.awayFromPost(n)) return true;
    for (const q of SIDE_QUESTS) {
      if (q.giver !== id) continue;
      const sc = SIDE_SCRIPTS[q.id];
      const st = Q.status(q.id);
      if (st === 'active') {
        const i = this.objIdx(q.id);
        const o = q.objectives[i];
        if (o?.type === 'talk' && o.target === id) {
          for (const oo of q.objectives) if (oo.type === 'collect' && oo.target && oo.count) R.takeItem(oo.target, oo.count, 'Görev teslimi');
          for (const l of sc.done) await this.say(id, l);
          Q.complete(q.id);
          return true;
        }
        await this.say(id, sc.waiting);
        return true;
      }
      if (st || !this.sideUnlocked()) continue;
      if (G.flag('decline_' + q.id) === this.day) continue;
      for (const l of sc.offer) await this.say(id, l);
      const c = await this.ui.choice(['"Tamam, yaparım."', '"Şimdi olmaz."']);
      if (c !== 0) {
        G.setFlag('decline_' + q.id, this.day);
        return true;
      }
      await this.say(id, sc.accept);
      Q.start(q.id);
      if (q.id === 'sq_tailor_parcel' || q.id === 'sq_mill_sacks') R.giveItems([{ id: 'side_parcel', qty: 1 }], 'Paket');
      return true;
    }
    return false;
  }

  // ============================================================ kaptan (G3 ve E8)
  async talkCaptain(): Promise<boolean> {
    if (Q.active('m_gate')) {
      await this.gateScene();
      return true;
    }
    const valid = hasValidCard(G.state.cards, 'capital', this.day);
    await this.say('captain', 'Dur. Bu yol Eros\'a çıkar.');
    if (valid) {
      await this.say('captain', 'Kartın geçerli. Ama kapı bugün de kapalı. Kral emri. Bekle.');
      return true;
    }
    await this.say('captain', 'Şehre girmek için giriş kartı lazım. On gümüş, üç ay geçerli. Rütbe sormam; paranı sorarım.');
    if (!Q.status('m_silver')) await this.think('On gümüş. Bin bronz. Şu an hayal bile edemiyorum.');
    return true;
  }

  // ============================================================ E3: biraz hava, yaralılar
  async woundedScene() {
    const w = this.w;
    const a = w.player.actor;
    const fe = w.mapData.points.forest_edge;
    const vx = Math.floor(a.x / TILE) - 3, vy = Math.floor(a.y / TILE);
    const vera = w.addNpc(NPC_BY_ID.vera, vx, vy, true);
    const lina = w.addNpc(NPC_BY_ID.lina, vx - 1, vy + 1, true);
    vera.actor.play('hurt', { loop: false, hold: true });
    lina.actor.play('die', { loop: false, hold: true });
    void fe;
    await wait(w, 500);
    await this.think('...Bir inilti. Ağaçların dibinde iki kişi.');
    this.d.face(a, vera.actor);
    Sound.sfx('hurt', 0.5);
    await this.say('vera', 'Bakma öyle. ...Köksüz. Tabii ki sen.', 'kizgin');
    await this.say('joseph', 'Ne oldu?');
    await this.say('vera', 'Goblinler. Kampın dışında bir avuç sanıyorduk. Değillermiş.', 'uzgun');
    await this.say('lina', 'Sekiz... tane... vardı. Hihi... hi.', 'uzgun');
    await this.say('vera', 'Görev başarısız. Lonca otuz puan keser. Bir de ödülün iki katı ceza: yüz altmış bronz.', 'uzgun');
    await this.say('vera', 'Cebimizde yirmi bronz kaldı. Gerisi borç. Sonraki ödüllerimizden düşecekler.', 'uzgun');
    await this.say('lina', 'Puanımız... sıfırın altına inmedi. Kartımız duruyor. Ucu ucuna.', 'uzgun');
    await this.say('vera', 'Şimdi bana öyle bakma. Kimse senden yardım istemedi.', 'kizgin');
    const c = await this.ui.choice(['(İç çek.) "...Kalk. Lina\'yı ben taşırım."', '"Burada mı kalacaksınız? Gece kurtlar iner."']);
    if (c === 0) await this.say('joseph', '...Kalk. Seni taşıyamam ama Lina\'yı taşırım.');
    else {
      await this.say('joseph', 'Burada mı kalacaksınız? Gece kurtlar iner.');
      await this.say('vera', '...Lanet olsun. Haklısın.', 'uzgun');
    }
    await this.say('vera', 'Bir kelime etme. Kimseye. Hiç.', 'kizgin');
    await this.say('lina', 'Hihi... köksüzün sırtı... sıcakmış...', 'gulen');
    w.removeNpc(vera);
    w.removeNpc(lina);
    const cv = w.addCompanion('vera');
    cv.actor.setPosition(vera.x, vera.y);
    cv.actor.body2.reset(vera.x, vera.y);
    cv.speedMult = 0.42;
    cv.fights = false;
    cv.hp = Math.round(cv.maxHp * 0.25);
    const cl = w.addCompanion('lina');
    cl.carried = true;
    cl.fights = false;
    cl.hp = Math.round(cl.maxHp * 0.15);
    w.player.burden = 0.5;
    Q.complete('m_air', { silent: true });
    Q.start('m_wounded');
    R.toast('Lina\'yı sırtında taşıyorsun: yavaşsın, koşamazsın.', 'info');
    G.save('auto');
  }

  /** Eşlik sırasında: yük ve yoldaş ayarları (harita değişince yeniden kurulur). */
  applyEscort() {
    if (!Q.active('m_wounded')) return;
    const v = this.w.companion('vera');
    const l = this.w.companion('lina');
    if (v) {
      v.speedMult = 0.42;
      v.fights = false;
    }
    if (l) {
      l.carried = true;
      l.fights = false;
    }
    this.w.player.burden = 0.5;
  }

  async healerPay() {
    const w = this.w;
    await this.say('healer', 'Tanrılar! Getirin, getirin. Şuraya yatırın.');
    this.ui.closeDialogue();
    for (const id of ['vera', 'lina']) w.removeCompanion(id, true);
    w.player.burden = 1;
    await wait(w, 600);
    await this.say('healer', 'Kaburga çatlamış, bilek burkulmuş. Kızın omzunda ok sıyrığı... goblin oku, kirli. Temizlemem lazım.');
    await this.say('healer', 'Otuz bronz. Ne eksik ne fazla. Merhem, sargı, bir de gece burada kalırlar.');
    await this.say('vera', 'Bizde... yirmi var. Gerisini...', 'uzgun');
    await this.ui.choice(['"Ben öderim." (30 bronz)']);
    await this.say('joseph', 'Ben öderim.');
    const r = R.pay(30, 'Şifacı: Vera ve Lina', true);
    if (!r.ok) {
      await this.say('healer', 'Paran yetmiyor mu, yavrum? Neyse. Sonra getirirsin. Ilse Nine unutmaz ama bekler.');
    } else Sound.sfx('coin');
    G.setFlag('spend_lock', 0);
    await this.say('vera', '...Neden?', 'saskin');
    await this.say('joseph', 'Bilmiyorum. Sanırım biri bana da iş vermişti.');
    await this.say('lina', 'Hihi... köksüz... iyi biriymiş. Vera, duydun mu? İyi biri.', 'gulen');
    await this.say('vera', 'Uyu, Lina.', 'normal');
    Q.advance('m_wounded', 1);
    Q.complete('m_wounded', { silent: true });
    G.setFlag('vl_healed_day', this.day);
    await this.think('Cebimdeki paranın yarısı gitti. Ama bu sefer... dokunmama gerek kalmadı. Kendiliğinden gitti.');
    G.save('auto');
  }

  // ============================================================ E4/E6: Vera ve Lina
  async talkFriends(n: Npc): Promise<boolean> {
    const id = n.def.id;
    if (!G.flag('friends_vl')) return false;
    // ilk ortak F görevi: otlaktaki fareler
    if (!Q.status('f_wolves') && Q.done('m_wounded')) {
      if (id === 'lina') {
        await this.say('lina', 'Köksüz! Dur! Bir şey diyeceğim. Vera, sen söyle. ...Peki, ben söylerim.', 'gulen');
        await this.say('lina', 'Çoban Tam\'ın otlağını tarla fareleri basmış. Bir sürü! F görevi. Yüz yirmi bronz. Üçümüz.', 'normal');
        await this.say('lina', 'Borcumuzu ödüyoruz, yanlış anlama. Hihi.', 'gulen');
      } else {
        await this.say('vera', 'Köksüz. Lina sana bir şey soracaktı. Ben soruyorum: otlaktaki fare sürüsü. F görevi, üçümüz.', 'normal');
        await this.say('vera', 'Borcumuzu ödüyoruz, yanlış anlama.', 'normal');
      }
      await this.say('vera', 'Grup görevi: Lonca Puanının yarısını alırsın. Ama F görevi, G\'ninkinden çok eder.', 'normal');
      const c = await this.ui.choice(['"Tamam. Gidelim."', '"Biraz sonra."']);
      if (c !== 0) {
        await this.say(id, id === 'vera' ? 'Fareler beklemez, köksüz. Ama biz bekleriz. Biraz.' : 'Hihi, tamam! Buradayız!', 'normal');
        return true;
      }
      Q.start('f_wolves');
      this.w.addCompanion('vera');
      this.w.addCompanion('lina');
      R.sysmsg('YOLDAŞLAR', ['Vera (kılıç) ve Lina (yay) seninle.', 'Kapılardan ve haritalardan seninle geçerler; kendi başlarına dövüşürler.', 'Yalnızca kendi vurduğun düşmandan EXP alırsın.'], { sound: 'system' });
      return true;
    }
    // ikinci ortak F görevi: değirmen bodrumu
    if (!Q.status('f_cellar') && Q.done('m_theft') && this.day >= Number(G.flag('cellar_offer_day') || 0)) {
      await this.say('vera', 'Köksüz. Değirmenci Oswin\'in bodrumuna dev fareler dadanmış. Köpek kadar.', 'normal');
      await this.say('lina', 'Goblin değil! Söz! Hihi. Doksan bronz, otuz otuz otuz.', 'gulen');
      const c = await this.ui.choice(['"Gidelim."', '"Sonra."']);
      if (c !== 0) return true;
      Q.start('f_cellar');
      this.w.addCompanion('vera');
      this.w.addCompanion('lina');
      return true;
    }
    return false;
  }

  /** E4: Vera'nın savaş dersi (fareler gelmeden önce). */
  async veraLesson() {
    const hints: [string, string, string][] = [
      ['vera', 'Dinle köksüz. Dört şey. Bir: saldırı gelmeden kırmızı parlar. O an Kaçış\'a bas. Doğru anda kaçarsan zaman yavaşlar.', 'İPUCU: Düşman kırmızı parlayınca Kaçış — mükemmel kaçış zamanı yavaşlatır ve karşı saldırı açar.'],
      ['vera', 'İki: sürünün önünde durma. Ben önünü tutarım, sen yanına geç. Yandan ve arkadan vurmak kolaydır.', 'İPUCU: Kuşat — yoldaşın önü tutarken yandan ya da arkadan vur.'],
      ['lina', 'Üç: koşmak dayanıklılık yer! Biterse nefes nefese kalırsın, kaçamazsın. Hihi, Vera\'ya olmuştu.', 'İPUCU: Dayanıklılık bitince koşamazsın; joystick\'i bırak ya da yavaşla, dolsun.'],
      ['vera', 'Dört: elin titriyorsa Ayarlar\'daki "Yardımlı savaş" seni en yakın düşmana çevirir. Utanılacak bir şey değil.', 'İPUCU: Ayarlar → Yardımlı savaş: menzildeki en yakın düşmana otomatik dönersin.'],
    ];
    for (const [who, line, hint] of hints) {
      await this.say(who, line, 'normal');
      this.ui.toastInfo(hint);
    }
  }

  // ============================================================ E5: kâhyanın kesesi
  async theftScene() {
    const w = this.w;
    const a = w.player.actor;
    G.setFlag('theft_started', this.day);
    const ax = Math.floor(a.x / TILE), ay = Math.floor(a.y / TILE);
    const take = (id: string, x: number, y: number) => {
      let n = w.npc(id);
      if (!n) n = w.addNpc(NPC_BY_ID[id], x, y, true);
      n.scripted = true;
      return n;
    };
    const st = take('steward', ax + 4, ay);
    const hob = take('guard_hob', ax - 3, ay + 1);
    const wil = take('guard_wil', ax + 1, ay + 3);
    for (const n of [st, hob, wil]) this.d.face(n.actor, a);
    await this.say('steward', 'Kesem! İşlemeli kesem! Kemerimden kesip almışlar!', 'kizgin');
    await this.say('guard_hob', 'Köksüz. Sen. Dün gece neredeydin?', 'kizgin');
    await this.say('joseph', 'Handa. Tavan arasında.');
    await this.say('guard_wil', 'Tavan arası. Hah. Kim gördü?', 'alayci');
    // köylüler fısıldaşır
    const whispers = ['Köksüzdür, kim olacak?', 'Ormandan çıplak gelmişti...', 'Bunlar hep böyle başlar.', 'Bertram\'ın yanında çalıştı, ama yine de...'];
    let i = 0;
    for (const n of w.npcs) {
      if (n === st || n === hob || n === wil || n.prestige > 3) continue;
      if (Math.hypot(n.x - a.x, n.y - a.y) < 12 * TILE && i < whispers.length) {
        n.say(whispers[i++], 2.6);
        this.d.face(n.actor, a);
      }
    }
    await wait(w, 1600);
    await this.say('steward', 'Bulun onu. Bulamazsanız köksüzü kapıya asarız; ibret olsun.', 'kizgin');
    await this.think('Herkes bana bakıyor. Benim gibi köksüz Nim\'e de. Ama ben almadım.');
    await this.think('Kâhyanın kemerini kesip kaçabilen biri hızlı ve çevik olmalı. Ve kimsenin dikkat etmediği biri.');
    await this.think('Appraisal. Düşük rütbeli birinin statlarını okuyabilirim. Şüphelileri incelemeliyim.');
    for (const n of [st, hob, wil]) n.scripted = false;
    // şüpheliler yerlerine
    for (const [sid, info] of Object.entries(THEFT_SUSPECTS)) {
      const p = w.mapData.points[info.at];
      if (!p) continue;
      let n = w.npc(sid);
      if (!n) n = w.addNpc(NPC_BY_ID[sid], p.x, p.y, true);
      else {
        n.actor.setPosition(p.x * TILE + 16, p.y * TILE + 22);
        n.actor.body2.reset(n.actor.x, n.actor.y);
        n.stopWalking();
      }
      n.scripted = true;
    }
    Q.start('m_theft');
    R.sysmsg('ŞÜPHELİLER', ['Köksüz Nim (meydanın kenarı)', 'Dilenci Moss (bank)', 'Çırak Ott (demirci avlusu)', 'Çamaşırcı Wynn (çamaşır ipleri)', 'Appraisal ile incele, sonra bir muhafıza söyle.'], { big: true });
    G.save('auto');
  }

  onAppraise(id: string) {
    if (Q.active('m_theft') && THEFT_SUSPECTS[id]) {
      const key = 'sus_' + id;
      const st = G.state.quests.quests.m_theft;
      st.data ??= {};
      const first = !st.data[key];
      st.data[key] = true;
      if (first) Q.advance('m_theft', 0);
      const clue = THEFT_SUSPECTS[id].clue;
      this.w.time.delayedCall(900, () => {
        if (this.w.cutscene) return;
        this.d.scene(async () => {
          for (const l of clue) await this.think(l);
        });
      });
    }
    if (id === 'merc_guard' && Q.active('sq_merchant_guard') && this.objIdx('sq_merchant_guard') === 0) {
      Q.advance('sq_merchant_guard', 0);
      this.w.time.delayedCall(900, () => this.d.scene(async () => {
        await this.think('Paralı Asker Varg. F rütbe. E değil. Aurelio haklıymış.');
      }));
    }
  }

  async accuse(guard: string) {
    await this.say(guard, 'Ne var, köksüz? Bir şey mi biliyorsun?', 'alayci');
    const ids = Object.keys(THEFT_SUSPECTS);
    const names = ids.map((i) => NPC_BY_ID[i].name);
    const c = await this.ui.choice([...names.map((n) => `"Hırsız ${n}."`), '"Henüz bilmiyorum."']);
    if (c >= ids.length) return;
    const sid = ids[c];
    if (!THEFT_SUSPECTS[sid].thief) {
      const n = this.w.npc(sid);
      await this.say(guard, `${names[c]} mi? Üstünü aradık. Hiçbir şey yok.`, 'kizgin');
      if (n) n.say(sid === 'vagrant' ? '...Ben mi? Yine mi ben?' : 'Utan, köksüz! Utan!', 2.6);
      await this.say(guard, 'İftira ucuz değil, köksüz. Beş bronz ceza. Bir daha boş konuşursan zindana.', 'kizgin');
      R.pay(5, 'Ceza: yanlış suçlama', true);
      const whisper = this.w.npcs.find((x) => x.def.id !== sid && x.def.id !== guard && Math.hypot(x.x - this.w.player.actor.x, x.y - this.w.player.actor.y) < 10 * TILE);
      whisper?.say('Hah! Köksüz, köksüzü satıyor.', 2.4);
      await this.think('Yüzüm yanıyor. Bir daha yanlış birini gösterirsem... Daha dikkatli bakmalıyım.');
      return;
    }
    await this.say(guard, 'Çamaşırcı Wynn mi? O kadın elli yaşında, köksüz. ...Gerçi. Bir bakalım.', 'saskin');
    this.ui.closeDialogue();
    const wynn = this.w.npc('washer');
    const g = this.w.npc(guard);
    if (wynn && g) {
      wynn.scripted = true;
      g.scripted = true;
      // Joseph muhafızı kendiliğinden izler (kontroller kapalı, kamera onu takip eder); muhafızın yanına varınca biter
      const guardWalk = this.d.walkPath(g.actor, Math.floor(wynn.x / TILE) - 1, Math.floor(wynn.y / TILE), 3);
      await this.d.followUntilNear(this.w.player.actor, g.actor, 1.6, guardWalk);
      this.d.face(g.actor, wynn.actor);
      this.d.face(this.w.player.actor, wynn.actor);
      wynn.say('Ne? Ne yapıyorsun? Bırak!', 2);
      await wait(this.w, 1200);
    }
    Sound.sfx('coin');
    await this.say(guard, 'Önlüğünün cebinde... işlemeli bir kese. Hah! Kâhyanın arması.', 'saskin');
    if (wynn) wynn.say('...On yıl. On yıl kimse fark etmedi.', 2.8);
    await this.say(guard, 'Al, köksüz. Keseyi kâhyaya sen götür. Ben bunu karakola götürüyorum.', 'normal');
    R.giveItems([{ id: 'steward_purse', qty: 1 }], 'Kâhyanın kesesi');
    if (wynn) {
      this.w.removeNpc(wynn);
      G.setFlag('wynn_jailed', this.day);
    }
    Q.advance('m_theft', 1);
    await this.returnPurse();
  }

  async returnPurse() {
    const w = this.w;
    let st = w.npc('steward');
    const a = w.player.actor;
    if (!st) st = w.addNpc(NPC_BY_ID.steward, Math.floor(a.x / TILE) + 3, Math.floor(a.y / TILE), true);
    st.scripted = true;
    await this.d.walk(st.actor, Math.floor(a.x / TILE) + 2, Math.floor(a.y / TILE), 2.6);
    this.d.face(st.actor, a);
    this.d.face(a, st.actor);
    R.takeItem('steward_purse');
    await this.say('steward', 'Kesem. ...Hepsi burada. Bir köksüz buldu, demek.', 'saskin');
    Sound.sfx('coin');
    await this.ui.narrate('Kâhya kesesinden birkaç bronz alıp ayağının dibine fırlatıyor. Paralar tozun içinde yuvarlanıyor.');
    await this.say('steward', 'Dikkatli ol, köksüz.', 'normal');
    Q.complete('m_theft', { money: 5 });
    st.scripted = false;
    for (const sid of Object.keys(THEFT_SUSPECTS)) {
      const n = w.npc(sid);
      if (n) n.scripted = false;
    }
    await this.think('Beş bronz. Tozun içinden topladım. Kimse bana teşekkür etmedi. Ama kimse de asmadı.');
    G.setFlag('cellar_offer_day', this.day + 1);
    G.save('auto');
  }

  // ============================================================ E8: veda ve kapı
  async farewellScene() {
    await this.say('bertram', 'On gümüş mü? Göster. ...Hah. Biriktirmişsin. Fare kuyruğundan, ot demetinden.', 'saskin');
    await this.say('bertram', 'Şehre gidiyorsun demek. Kaptan Roderick sana kart satar. Üç ay. Sonra ya bir iş bulursun ya geri dönersin.', 'normal');
    const c = await this.ui.choice(['"Geri dönersem tavan arası hâlâ benim mi?"', '"Teşekkür ederim, Bertram. Her şey için."']);
    if (c === 0) await this.say('bertram', 'Tavan arası her zaman senin, evlat. Kira istemem. Yemeğini öder, yatağını yaparsın.', 'gulen');
    else await this.say('bertram', 'Teşekkürü bırak. Bana değil, bir gün kapının önünde aç duran birine öde. Hatırlıyor musun?', 'normal');
    await this.say('bertram', 'Bir şey daha. O sopa...', 'normal');
    await this.say('joseph', 'Kılıç alacak param olunca kılıç taşırım.');
    await this.say('bertram', 'Hah! Öğrenmişsin. Hadi. Yol uzun değil ama kapı dar.', 'gulen');
    R.giveItems([{ id: 'bread', qty: 2 }, { id: 'cheese', qty: 1 }], 'Bertram\'ın azığı');
    Q.complete('m_farewell', { silent: true });
    Q.start('m_gate');
    G.save('auto');
  }

  async gateScene() {
    await this.say('captain', 'Yine sen. Bu sefer kesen dolu gibi.', 'normal');
    await this.say('captain', `Giriş kartı: on gümüş, ${CARD_DAYS} gün. Üç ay. Süre bitmeden yenisini alırsan arka arkaya eklenir.`, 'normal');
    const c = await this.ui.choice([`Kartı al ({m:${CARD_PRICE}})`, '"Sonra."']);
    if (c !== 0) return;
    const r = R.pay(CARD_PRICE, 'Giriş kartı');
    if (!r.ok) {
      await this.say('captain', 'On gümüş dedim. Saydım, eksik.', 'kizgin');
      return;
    }
    Sound.sfx('coin');
    const card = buyCard(G.state.cards, 'capital', this.day);
    R.toast(`+1 Giriş Kartı: ${CITY_FULL_NAMES.capital}`, 'item', 'card');
    R.sysmsg('GİRİŞ KARTI', [`${CITY_FULL_NAMES.capital}`, `Geçerli: ${card.from}. gün – ${card.until}. gün (${CARD_DAYS} gün)`, 'Envanter → Giriş Kartları'], { big: true });
    await this.say('captain', 'Kartın. Kaybetme, yenisi yine on gümüş. Kapıdan bak bakalım, köksüz. İşte orası.', 'normal');
    Q.complete('m_gate', { silent: true });
    G.setFlag('ch2_done', this.day);
    await this.cityView();
    G.save('auto');
  }

  /** E8: şehir manzarası — surlar, kalabalık, kale silueti. */
  async cityView() {
    const ui = this.ui;
    await ui.curtain(1, 900);
    Sound.play('title');
    const W = Display.uiW, H = Display.uiH;
    const c = ui.add.container(0, 0).setDepth(92).setAlpha(0);
    const g = ui.add.graphics();
    // gökyüzü
    for (let i = 0; i < 40; i++) {
      const t = i / 39;
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0x2a3a6a), Phaser.Display.Color.ValueToColor(0xf2b27a), 39, i);
      g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
      g.fillRect(0, (H * 0.75 * i) / 40, W, H * 0.75 / 40 + 1);
      void t;
    }
    // uzak tepeler
    g.fillStyle(0x4a4a6a, 1);
    g.beginPath();
    g.moveTo(0, H * 0.62);
    const hill = (x: number) => H * 0.6 - Math.sin(x / 130) * 18 - Math.sin(x / 47) * 6;
    for (let x = 0; x < W; x += 40) g.lineTo(x, hill(x));
    g.lineTo(W, hill(W));
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.closePath();
    g.fillPath();
    // kale silueti
    const cx = W / 2, base = H * 0.58;
    g.fillStyle(0x2a2440, 1);
    g.fillRect(cx - 120, base - 150, 240, 150);
    for (const [ox, w, h] of [[-160, 50, 230], [110, 50, 210], [-30, 60, 290], [-90, 30, 180], [60, 30, 170]] as [number, number, number][]) {
      g.fillRect(cx + ox, base - h, w, h);
      g.fillTriangle(cx + ox - 6, base - h, cx + ox + w + 6, base - h, cx + ox + w / 2, base - h - w * 1.2);
    }
    // pencere ışıkları
    g.fillStyle(0xffd27a, 0.85);
    const wr = new Phaser.Math.RandomDataGenerator(['pencere']);
    for (let i = 0; i < 26; i++) g.fillRect(cx - 110 + Math.floor(wr.frac() * 220), base - 30 - Math.floor(wr.frac() * 110), 4, 7);
    // surlar
    g.fillStyle(0x3a3448, 1);
    g.fillRect(0, base - 30, W, 60);
    for (let x = 0; x < W; x += 28) g.fillRect(x, base - 44, 16, 16);
    // kapı
    g.fillStyle(0x1a1420, 1);
    g.fillRoundedRect(cx - 40, base - 20, 80, 50, { tl: 40, tr: 40, bl: 0, br: 0 });
    // yol ve kalabalık
    g.fillStyle(0x8a6a4a, 1);
    g.fillTriangle(cx - 40, base + 30, cx + 40, base + 30, cx + 200, H);
    g.fillTriangle(cx - 40, base + 30, cx - 200, H, cx + 200, H);
    const rnd = new Phaser.Math.RandomDataGenerator(['eros']);
    for (let i = 0; i < 90; i++) {
      const t = rnd.frac();
      const y = base + 34 + t * (H - base - 40);
      const spread = 40 + t * 180;
      const x = cx + (rnd.frac() * 2 - 1) * spread;
      const s = 2 + t * 6;
      g.fillStyle([0x3a2a2a, 0x5a3a2a, 0x2a3a4a, 0x6a5a3a][i % 4], 1);
      g.fillRect(x - s / 2, y - s * 2.4, s, s * 2.4);
      g.fillCircle(x, y - s * 2.6, s * 0.55);
    }
    c.add(g);
    const t1 = ui.add.text(W / 2, H * 0.12, CITY_TITLES.capital, { fontFamily: 'Cinzel, serif', fontSize: '40px', color: '#f3dc95', stroke: '#1a1020', strokeThickness: 6 }).setOrigin(0.5);
    const t2 = ui.add.text(W / 2, H * 0.12 + 50, 'Surlar, kuleler ve kapının önünde bekleyen bir kalabalık.', { fontFamily: 'Alegreya, serif', fontSize: '20px', color: '#efe6d2', stroke: '#1a1020', strokeThickness: 4 }).setOrigin(0.5);
    c.add([t1, t2]);
    await ui.curtain(0, 300);
    ui.tweens.add({ targets: c, alpha: 1, duration: 1400 });
    await wait(this.w, 2600);
    await this.think('İşte orası. Herkesin sıfırdan doğduğu ama kimsenin aynı yerden başlamadığı yerin kalbi.');
    await this.think('Elimde bir sopa, cebimde bir kart. Köksüzüm. Ama artık G\'yim.');
    this.ui.closeDialogue();
    const t3 = ui.add.text(W / 2, H * 0.86, 'Hikâye şehirde devam edecek.', { fontFamily: 'Cinzel, serif', fontSize: '30px', color: '#f3dc95', stroke: '#1a1020', strokeThickness: 6 }).setOrigin(0.5).setAlpha(0);
    c.add(t3);
    ui.tweens.add({ targets: t3, alpha: 1, duration: 1200 });
    await wait(this.w, 4200);
    const t4 = ui.add.text(W / 2, H * 0.86 + 44, 'Brindlewood\'da dolaşmaya, pano ilanlarına ve yan görevlere devam edebilirsin. Kartın süresi işlemeye devam ediyor.', { fontFamily: 'AlegreyaSans, sans-serif', fontSize: '17px', color: '#cfc4ae', stroke: '#1a1020', strokeThickness: 3, wordWrap: { width: W - 120 }, align: 'center' }).setOrigin(0.5, 0).setAlpha(0);
    c.add(t4);
    ui.tweens.add({ targets: t4, alpha: 1, duration: 900 });
    await wait(this.w, 3800);
    await ui.curtain(1, 900);
    c.destroy();
    await ui.curtain(0, 900);
    this.w.updateMusic();
  }

  // ============================================================ olaylar
  /** Ortak F görevlerinde Vera ve Lina hep Joseph'in yanında (eski kayıt, ara sahne ya da harita geçişi ne olursa olsun). */
  ensureParty() {
    const need = (Q.active('f_wolves') && this.objIdx('f_wolves') <= 1) || (Q.active('f_cellar') && this.objIdx('f_cellar') <= 1);
    if (!need) return;
    for (const c of ['vera', 'lina']) if (!this.w.companion(c)) this.w.addCompanion(c);
  }

  onEnterMap(id: string) {
    this.spawned.clear();
    this.applyEscort();
    this.ensureParty();
    // 0.6.0: sopayı alınca loncaya dönen Joseph'e pano aynı gün açılır
    if (id === 'guild' && Q.active('m_board') && this.w.npc('celeste')) {
      this.d.scene(async () => this.boardOpening());
      return;
    }
    if (id === 'inn' && this.canSit()) {
      this.placeAtTable('vera', 'table_vera');
      this.placeAtTable('lina', 'table_lina');
    }
    if (id === 'inn' && Q.active('m_celebrate') && this.objIdx('m_celebrate') === 0 && hourOf(G.state.time) >= 18) {
      this.d.scene(async () => this.celebrateArrive());
      return;
    }
    if (id === 'inn' && this.boardOpen() && !G.flag('inn_stand') && hourOf(G.state.time) >= 17 && !Q.done('m_celebrate')) {
      G.setFlag('inn_stand', this.day);
      this.d.scene(async () => this.innStanding());
    }
    if (id === 'healer' && Q.active('m_wounded') && this.objIdx('m_wounded') === 1) {
      this.d.scene(async () => this.healerPay());
      return;
    }
    if (id === 'mill_cellar' && Q.active('f_cellar')) {
      this.d.scene(async () => {
        await this.say('lina', 'Kokuyu duyuyor musun? Un ve... ıslak kürk. Hihi, iğrenç.', 'normal');
        await this.say('vera', 'Ben önden. Lina arkadan. Köksüz, yanlardan. Bildiğin gibi.', 'normal');
      });
    }
  }

  async innStanding() {
    const w = this.w;
    const a = w.player.actor;
    await wait(w, 500);
    const pats = w.npcs.filter((n) => n.def.caste === 'commoner' && n.def.id !== 'vera' && n.def.id !== 'lina' && n.def.id !== 'innmaid').slice(0, 2);
    if (pats[0]) {
      this.d.face(pats[0].actor, a);
      pats[0].say('Bu masa dolu.', 2.4);
    }
    await wait(w, 1200);
    if (pats[1]) {
      this.d.face(pats[1].actor, a);
      pats[1].say('Köksüzle aynı masaya oturmam. Kokusu siner.', 2.8);
    }
    await wait(w, 1500);
    await this.think('Boş sandalyeler var. Ama hepsi "dolu". Kartım olsa da olmasa da.');
    await this.think('Ayakta yerim o zaman. Duvarın dibinde.');
  }

  /** İlk kadeh, 1. kısım (0.6.0): Joseph akşam hana gelir; Vera ve Lina masada, Vera yer gösterir. */
  async celebrateArrive() {
    const w = this.w;
    const a = w.player.actor;
    const vera = this.placeAtTable('vera', 'table_vera');
    const lina = this.placeAtTable('lina', 'table_lina');
    await wait(w, 400);
    if (vera) this.d.face(vera.actor, a);
    if (lina) this.d.face(lina.actor, a);
    await this.say('vera', 'Geldin! Buraya, köksüz. Masaya otur. Hayır, burası dolu değil. Burası senin.', 'gulen');
    await this.say('lina', 'Hihi! Sandalyeyi senin için sakladık. Kimseye vermedik! Dorn bile soracaktı!', 'gulen');
    Q.advance('m_celebrate', 0);
    this.ui.toastInfo('Vera\'nın masasına git ve "Otur"a bas.');
  }

  /** Vera ve Lina'yı masadaki yerlerine koy (programları ne derse desin) ve orada tut. */
  placeAtTable(id: string, pt: string): Npc | null {
    const w = this.w;
    const p = w.mapData.points[pt];
    let n = w.npc(id);
    if (!n && p) n = w.addNpc(NPC_BY_ID[id], p.x, p.y, true);
    if (n) {
      n.scripted = true;
      n.stopWalking();
      n.state = 'idle';
    }
    return n;
  }

  /** Masaya oturma etkileşimi ("Otur"): yalnızca ilk kadehte, Vera yer gösterdikten sonra. */
  canSit(): boolean {
    return Q.active('m_celebrate') && this.objIdx('m_celebrate') === 1 && this.w.mapData.id === 'inn';
  }

  /** İlk kadeh, 2. kısım: Joseph oturunca. */
  async celebrate() {
    const w = this.w;
    const a = w.player.actor;
    const vera = this.placeAtTable('vera', 'table_vera');
    const lina = this.placeAtTable('lina', 'table_lina');
    const seat = w.mapData.points.table_joseph;
    if (seat) await this.d.walk(a, seat.x, seat.y, 2.4);
    a.face('right');
    await wait(w, 300);
    if (vera) this.d.face(vera.actor, a);
    if (lina) this.d.face(lina.actor, a);
    await this.ui.narrate('Vera bir sandalye çekiyor. Etraftaki masalar susuyor.');
    await this.say('lina', 'G rütbe köksüze! Hihi! Şerefe!', 'gulen');
    await this.say('vera', 'Şerefe. Bir ayda F olmazsan seni kendim döverim.', 'alayci');
    Sound.sfx('laugh', 0.6);
    await this.ui.narrate('Bertram tezgâhın arkasından başını salladı. Tek kelime etmedi. Etmesine gerek yoktu.');
    await this.think('İlk kez bir masada oturuyorum. Kimse "dolu" demedi.');
    Q.advance('m_celebrate', 1);
    Q.complete('m_celebrate', { silent: true });
    G.setFlag('side_unlocked', this.day);
    G.setFlag('theft_day', this.day + 1);
    R.sysmsg('YAN GÖREVLER AÇILDI', ['Köylülerin işleri artık seni bekliyor (yan görevler).', 'Lonca panosunda her sabah yeni ilanlar: G 15–40, F 60–90 bronz.', 'F ilanları risklidir: başarısızlıkta −30 puan ve ödülün iki katı ceza.'], { big: true, sound: 'title' });
    for (const n of [vera, lina]) if (n) n.scripted = false;
    G.save('auto');
  }

  onNewDay() {
    // süresi dolan görevler başarısız
    for (const id of activeQuests(G.state.quests)) {
      const def = Q.def(id);
      const st = G.state.quests.quests[id];
      if (def?.days && st && this.day > st.startedDay + def.days) Q.fail(id);
    }
    if (Q.done('m_wounded') && !G.flag('friends_vl') && this.day > Number(G.flag('vl_healed_day') || 0)) G.setFlag('friends_vl', this.day);
  }

  /** false: amacı şimdilik ilerletme. */
  onQuestGo(id: string, idx: number): boolean | void {
    if (id === 'm_air') {
      this.d.scene(async () => this.woundedScene());
      return false;
    }
    if (id === 'm_celebrate') return false;
    if (id === 'f_wolves' && idx === 0) {
      this.ensureParty();
      this.d.scene(async () => {
        await this.say('shepherd', 'Maceracılar! Tanrıya şükür! Fareler tarladan taşıp otlağa indi, bir sürü!');
        await this.veraLesson();
        await this.say('lina', 'Geliyorlar! Kulaklarım duydu!', 'saskin');
        this.spawnQuestEnemies(true);
      });
      return true;
    }
    if (id === 'f_cellar' && idx === 0) {
      this.d.scene(async () => {
        await this.say('oswin', 'Bodrum kapısı açık. Ben... ben burada beklerim. Kapıyı da arkanızdan kapatırım. Şaka. Kapatmam. Belki.');
      });
      return true;
    }
    if (id === 'sq_kids_ball') {
      this.d.scene(async () => {
        await this.think('Sazların arasında kırmızı bir bez top. Islak ama sağlam.');
      });
      return true;
    }
    return undefined;
  }

  onKill(e: any) {
    if (e.def.id === 'barn_rat' && Q.active('g1_rats') && Q.progress('g1_rats', 0) >= 6 && !G.flag('dorn_steal')) {
      G.setFlag('dorn_steal', this.day);
      this.d.scene(async () => this.dornScene());
    }
  }

  /** E2: F+ elit Dorn son fare kanıtını çalar. */
  async dornScene() {
    const w = this.w;
    const a = w.player.actor;
    const ax = Math.floor(a.x / TILE), ay = Math.floor(a.y / TILE);
    let dorn = w.npc('dorn');
    if (!dorn) dorn = w.addNpc(NPC_BY_ID.dorn, ax + 5, ay - 1, true);
    dorn.scripted = true;
    await this.d.walk(dorn.actor, ax + 1, ay, 3);
    this.d.face(dorn.actor, a);
    this.d.face(a, dorn.actor);
    await this.say('dorn', 'Oo, G- fare avcısı! Kuyruk mu topluyorsun?', 'alayci');
    if (G.p.inventory.rat_tail) R.takeItem('rat_tail', 1, 'Dorn aldı');
    Sound.sfx('pickup');
    await this.ui.narrate('Dorn yere eğilip son kuyruğu kapıyor ve havada sallıyor.');
    await this.say('dorn', 'Bu benim. Ben öldürdüm. Gördün, değil mi? Herkes gördü.', 'gulen');
    const c = await this.ui.choice(['"Ver onu."', '(Sessiz kal.)']);
    if (c === 0) {
      await this.say('dorn', 'Gel al. ...Gelmiyor musun? Akıllısın. F+ ile G- arasındaki farkı biliyorsun.', 'alayci');
    }
    await this.say('dorn', 'Ahırın arkasında başkaları da var. Duyuyorum. Git onları bul, köksüz.', 'alayci');
    Q.set('g1_rats', 0, 5);
    await this.d.walk(dorn.actor, ax + 10, ay - 3, 3);
    w.removeNpc(dorn);
    await this.think('Beş kuyruk. Bir eksik. Ahırın arkasında cıyaklamalar var...');
    const p = w.mapData.points.barn_yard;
    if (p) w.spawnAt('barn_rat', p.x + 5, p.y + 3, 2, 2, 'g1b');
  }

  /** Görev düşmanlarını doğur (harita her yüklendiğinde kalanlar). */
  spawnQuestEnemies(force = false) {
    const w = this.w;
    const m = w.mapData;
    const a = w.player.actor;
    const near = (pt: string, r: number) => {
      const p = m.points[pt];
      return p && Math.hypot(a.x / TILE - p.x, a.y / TILE - p.y) < r;
    };
    if (m.id === 'world' && Q.active('g1_rats') && this.objIdx('g1_rats') === 0 && !this.spawned.has('g1') && near('barn_yard', 28)) {
      this.spawned.add('g1');
      const left = 6 - Q.progress('g1_rats', 0);
      const p = m.points.barn_yard;
      if (left > 0) w.spawnAt('barn_rat', p.x, p.y + 1, left, 3, 'g1');
    }
    if (m.id === 'world' && Q.active('f_wolves') && this.objIdx('f_wolves') === 1 && !this.spawned.has('fw') && (force || near('pasture', 20))) {
      this.spawned.add('fw');
      const left = (questDef('f_wolves')!.objectives[1].count ?? 1) - Q.progress('f_wolves', 1);
      const p = m.points.pasture;
      if (left > 0) {
        const es = w.spawnAt('field_rat', p.x + 6, p.y - 4, left, 2.5, 'fw');
        for (const e of es) e.becomeAware(true);
      }
    }
    if (m.id === 'mill_cellar' && Q.active('f_cellar') && this.objIdx('f_cellar') === 1 && !this.spawned.has('fc')) {
      this.spawned.add('fc');
      const left = 4 - Q.progress('f_cellar', 1);
      const p = m.points.rats;
      if (left > 0) w.spawnAt('giant_rat', p.x, p.y, left, 2, 'fc');
    }
  }

  /** Düzenli kontrol (yarım saniyede bir). */
  tick(dt: number) {
    this.tickT -= dt;
    if (this.tickT > 0) return;
    this.tickT = 0.5;
    if (!this.started() || this.w.cutscene) return;
    this.spawnQuestEnemies();
    const w = this.w;
    const a = w.player.actor;
    const h = hourOf(G.state.time);
    // E2: yol verme sahnesi — G görevleri sırasında kâhya yoldan geçerken
    if (w.mapData.id === 'world' && Q.active('m_grank') && !G.flag('yield_done')) {
      const st = w.npc('steward');
      if (st && Math.hypot(st.x - a.x, st.y - a.y) < 6 * TILE) {
        G.setFlag('yield_done', this.day);
        this.d.scene(async () => this.yieldScene());
        return;
      }
    }
    // E5: hırsızlık — ilk kadehten sonraki gün, gündüz (eski kayıtta gün bayrağı yoksa bugün)
    if (Q.done('m_celebrate') && !Q.status('m_theft') && !G.flag('theft_day')) G.setFlag('theft_day', this.day);
    if (w.mapData.id === 'world' && Q.done('m_celebrate') && !Q.status('m_theft') && this.day >= Number(G.flag('theft_day') || 999) && h >= 8 && h < 18) {
      this.d.scene(async () => this.theftScene());
      return;
    }
    // ilk kadeh: Joseph akşam zaten handaysa
    if (w.mapData.id === 'inn' && Q.active('m_celebrate') && this.objIdx('m_celebrate') === 0 && h >= 18) {
      this.d.scene(async () => this.celebrateArrive());
      return;
    }
    // E7: on gümüş
    if (Q.active('m_silver') && walletTotal(G.p.wallet) >= 1000) {
      Q.set('m_silver', 0, 1000);
      Q.complete('m_silver', { silent: true });
      Q.start('m_farewell');
      this.d.scene(async () => {
        await this.think('On gümüş. Bin bronz. Saydım, bir daha saydım. Tamam.');
        await this.think('Gitmeden önce Bertram\'la konuşmalıyım.');
      });
    }
  }

  async yieldScene() {
    const w = this.w;
    const a = w.player.actor;
    const st = w.npc('steward')!;
    const kn = w.npc('knight');
    st.scripted = true;
    if (kn) kn.scripted = true;
    this.d.face(st.actor, a);
    if (kn) {
      this.d.face(kn.actor, a);
      await this.say('knight', 'Yol açın! Kâhya Efendi geçiyor!', 'kizgin');
    }
    const c = await this.ui.choice(['(Kenara çekil ve başını eğ.)', '(Yürümeye devam et.)']);
    const p = R.josephPrestige();
    if (c === 0) {
      a.play('bow', { loop: false, restart: true });
      await wait(w, 900);
      a.play('idle');
      await this.say('steward', p >= 3 ? 'Hm. Düzgün giyinmiş bir köksüz. Garip.' : 'Hiç değilse yerini biliyor.', 'normal');
    } else {
      const guard = kn ?? w.npc('guard_hob');
      if (guard) {
        await this.d.walk(guard.actor, Math.floor(a.x / TILE), Math.floor(a.y / TILE) - 1, 3);
        this.d.face(guard.actor, a);
        Sound.sfx('hit');
        a.kb.set(1, 0).scale(240);
        this.w.fx.number(a.x, a.y - 50, 'İtildin', 'miss');
        await wait(w, 500);
      }
      // Saygınlık cezayı belirler: düzgün kılıklıya ceza kesilmez
      const fine = p >= 4 ? 0 : p >= 1 ? 3 : 5;
      if (fine === 0) await this.say('knight', 'Kılığına bakılırsa bir efendinin adamısın. Bu sefer geç. Bir dahakine yol ver.', 'kizgin');
      else {
        await this.say('knight', `Kâhyanın yolunu kesmek ${fine} bronz. Öde, köksüz.`, 'kizgin');
        const r = R.pay(fine, 'Ceza: yol vermemek', true);
        if (!r.ok) await this.say('knight', 'Paran da yok. Hah. Kayda geçtin, köksüz.', 'alayci');
        else Sound.sfx('coin');
      }
      await this.think(fine ? 'Toz, itilen bir omuz ve eksilen birkaç bronz. Saygınlık... kılık kıyafet işte.' : 'Kıyafetim kurtardı. Saygınlık dedikleri bu.');
    }
    st.scripted = false;
    if (kn) kn.scripted = false;
  }

  onTrigger(id: string): boolean {
    if (id === 'city_gate') {
      const valid = hasValidCard(G.state.cards, 'capital', this.day);
      this.ui.toastInfo(valid ? 'Kartın geçerli. Ama kapı kapalı: Şehir bölümü yakında.' : 'Şehir kapısı kapalı. Şehir bölümü yakında.');
      return true;
    }
    return false;
  }

  beforeWarp(w: Warp): boolean {
    if (w.to === 'mill_cellar') {
      if (Q.active('f_cellar') && this.objIdx('f_cellar') >= 1) return true;
      this.ui.toastInfo('Değirmenci kapıyı içeriden kilitlemiş.');
      return false;
    }
    if (Q.active('m_wounded') && this.objIdx('m_wounded') === 0 && w.to && w.to !== 'healer' && w.to !== 'world') {
      this.d.scene(async () => this.think('Önce şifacı. Lina\'nın nefesi zayıflıyor.'));
      return false;
    }
    return true;
  }

  /** Bu NPC bu haritada nerede olmalı? */
  npcPlacement(id: string, map: string): [number, number] | null | undefined {
    // yaralılar görevi: Ilse Nine saat kaç olursa olsun şifa evinde
    if (id === 'healer' && Q.active('m_wounded')) {
      if (map !== 'healer') return null;
      const p = this.w.pointsOf('healer').healer;
      return p ? [p.x, p.y] : undefined;
    }
    // yaralılar iyileşme gecesi şifacıda
    if ((id === 'vera' || id === 'lina') && Number(G.flag('vl_healed_day') || -1) === this.day) {
      if (map === 'healer') return id === 'vera' ? [7, 6] : [8, 6];
      return null;
    }
    // hırsızlık: şüpheliler meydanda
    if (Q.active('m_theft') && THEFT_SUSPECTS[id]) {
      if (G.flag('wynn_jailed') && id === 'washer') return null;
      if (map !== 'world') return null;
      const p = this.w.pointsOf('world')[THEFT_SUSPECTS[id].at];
      return p ? [p.x, p.y] : undefined;
    }
    if (id === 'washer' && G.flag('wynn_jailed')) return null;
    return undefined;
  }

  bubbleFor(id: string): string | null {
    if (!G.flag('friends_vl') || (id !== 'vera' && id !== 'lina')) return null;
    const b = FRIEND_LINES[id].bubbles;
    return b[Math.floor(Math.random() * b.length)];
  }

  // ============================================================ ana görev güvencesi (0.6.0)
  /** Hiç aktif ana görev kalmasın: eksik halkayı (ya da bekleme adımını) aç, gereksiz adımları kapat. */
  ensureMain(): string | null {
    return ensureMainQuest({
      status: (id) => Q.status(id),
      flag: (k) => G.flag(k),
      rank: G.state.guild.member ? G.p.guildRank : null,
      active: () => activeQuests(G.state.quests),
      start: (id) => {
        Q.start(id);
        this.onAutoStart(id);
      },
      closeStep: (id) => Q.complete(id, { quiet: true }),
    });
  }

  /** Güvencenin açtığı görev için gereken hikâye hazırlığı (geliştirici araçlarıyla atlanan sahneler dahil). */
  onAutoStart(id: string) {
    if ((id === 'f_wolves' || id === 'f_cellar') && G.flag('friends_vl')) {
      for (const c of ['vera', 'lina']) if (!this.w.companion(c)) this.w.addCompanion(c);
    }
  }

  // ============================================================ bekleme ve hedef (0.6.0)
  /**
   * Hikâye kapıları: amaç belli bir saatten önce yapılamıyorsa bekleme metni ve saati (mutlak dakika).
   * NPC programı ve kapalı binalar WorldScene.questWait'te genel olarak hesaplanır.
   */
  objectiveWait(id: string, idx: number): { text: string; until: number } | null {
    const now = absMinute(this.day, G.state.time.minute);
    const at = (day: number, hour: number) => absMinute(day, hour * 60);
    const gate = (until: number, text: (when: string) => string) => (now < until ? { until, text: text(whenLabel(now, until)) } : null);
    switch (id) {
      case 'm_vl_rest': {
        const healed = Number(G.flag('vl_healed_day') || this.day);
        return gate(at(healed + 1, 8), (w) => `Vera ve Lina şifa evinde dinleniyor — ${w} onları bul`);
      }
      case 'm_vl_cellar': {
        const d = Number(G.flag('cellar_offer_day') || this.day);
        return gate(at(d, 8), (w) => `Vera ve Lina ${w} ortalıkta olur — o saate kadar bekle`);
      }
      case 'm_next_day': {
        const d = Number(G.flag('theft_day') || this.day);
        const h = G.state.time.minute / 60;
        let until = at(d, 8);
        if (now >= until && h >= 18) until = at(this.day + 1, 8);
        else if (now >= until && h < 8) until = at(this.day, 8);
        return gate(until, (w) => `Köy ${w} uyanır — o saate kadar bekle`);
      }
      case 'm_harvest': {
        if (idx !== 1) return null;
        const h = G.state.time.minute / 60;
        if (h >= 6 && h < 16) return null;
        const until = at(h >= 16 ? this.day + 1 : this.day, 6);
        return gate(until, (w) => `Hasat ${w} başlar — o saate kadar bekle`);
      }
      case 'm_celebrate':
        if (idx === 0) return gate(at(this.day, 18), (w) => `Vera akşamı bekliyor — ${w} hana git`);
        return null;
    }
    return null;
  }

  /** Amacın hedefini hikâye belirliyorsa (ör. sıradaki şüpheli). */
  targetOverride(id: string): QuestTarget | null {
    if (id === 'm_theft' && this.objIdx('m_theft') === 0) {
      const next = this.nextSuspect();
      return next ? { map: 'world', npc: next } : null;
    }
    return null;
  }

  /** Başı işaretli NPC'ler: incelenecek şüpheliler (yan görev işaretleri sideMarkers'tan eklenir). */
  npcMarkers(): Record<string, MarkerKind> {
    const out: Record<string, MarkerKind> = {};
    if (Q.active('m_theft') && this.objIdx('m_theft') === 0) {
      const data = G.state.quests.quests.m_theft?.data ?? {};
      for (const s of Object.keys(THEFT_SUSPECTS)) if (!data['sus_' + s]) out[s] = 'suspect';
    }
    return out;
  }

  /** Henüz Appraisal yapılmamış ilk şüpheli (yakın olan önce). */
  nextSuspect(): string | null {
    const data = G.state.quests.quests.m_theft?.data ?? {};
    const left = Object.keys(THEFT_SUSPECTS).filter((s) => !data['sus_' + s]);
    if (!left.length) return null;
    const a = this.w.player.actor;
    const dist = (s: string) => {
      const n = this.w.npc(s);
      return n ? Math.hypot(n.x - a.x, n.y - a.y) : Infinity;
    };
    return left.sort((x, y) => dist(x) - dist(y))[0];
  }

  /** Kapı istisnası: yaralılar görevi sürerken şifa evi saatten bağımsız açık. undefined: normal saatler. */
  doorOverride(w: Warp): boolean | undefined {
    if (w.to === 'healer' && Q.active('m_wounded')) return true;
    return undefined;
  }

  // ============================================================ bilgi
  /** Dev paneli ve testler için: hikâye adımının adı. */
  stage(): string {
    const order = ['m_weapon', 'm_board', 'm_grank', 'm_air', 'm_wounded', 'm_vl_rest', 'f_wolves', 'm_promotion', 'm_gpoints', 'm_celebrate', 'm_next_day', 'm_theft', 'm_vl_cellar', 'f_cellar', 'm_silver', 'm_farewell', 'm_gate'];
    for (const id of order) if (Q.active(id)) return id;
    return G.flag('ch2_done') ? 'done' : 'none';
  }
}

/** Görev tanımı yardımcısı (dev paneli). */
export function questTitle(id: string): string {
  return (Q.def(id) as QuestDef | undefined)?.title ?? ITEMS[id]?.name ?? id;
}
