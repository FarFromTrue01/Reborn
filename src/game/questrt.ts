// Görev ve lonca sistemlerinin oyun içi katmanı: bildirimler, ödüller, cezalar, terfi, hedef konumları.
import { G } from './G';
import * as R from './rules';
import {
  startQuest, advance, setProgress, notify, finishQuest, isActive, isDone, allObjectivesDone, currentObjective, pickNextTracked,
  type QuestDef, type ObjectiveType, type QuestTarget,
} from '../core/quests';
import { questDef, rankupQuest } from '../data/quests';
import { QUEST_POINTS, applyReward, applyPenalty, earnedRank, examRequired, riskText, isRankupQuest } from '../core/guild';
import { activeQuests, questExp } from '../core/quests';
import type { SubRank } from '../core/ranks';
import { subRankToString } from '../core/ranks';
import { walletTotal } from '../core/money';
import { pay } from './rules';
import type { QuestDoneInfo } from '../ui/celebrations';
import { addExp } from '../core/formulas';

const lookup = (id: string) => G.state.quests.quests[id]?.def ?? questDef(id);

export const KIND_NAMES: Record<string, string> = { main: 'Ana görev', side: 'Yan görev', board: 'Pano görevi' };

export { questExp };

/**
 * Ara sahnenin ortasında sessiz tamamlanan görevlerin bitiş animasyonları (0.6.0): sahne bitince (diyalog
 * kapandı, cutscene false) sırayla oynar. Oturum içi; kayda yazılmaz.
 */
const deferredDone: QuestDoneInfo[] = [];

function changed() {
  G.events.emit('quests');
  G.scheduleSave();
}

export const Q = {
  def(id: string): QuestDef | undefined {
    return lookup(id);
  },
  active(id: string) {
    return isActive(G.state.quests, id);
  },
  done(id: string) {
    return isDone(G.state.quests, id);
  },
  /** Görev durumu (yok / aktif / bitti / başarısız). */
  status(id: string) {
    return G.state.quests.quests[id]?.status ?? null;
  },
  progress(id: string, i = 0) {
    return G.state.quests.quests[id]?.progress[i] ?? 0;
  },
  start(id: string, silent = false, dynamic?: QuestDef): boolean {
    const def = dynamic ?? questDef(id);
    if (!def) return false;
    if (!startQuest(G.state.quests, def, G.state.time.day, !!dynamic)) return false;
    if (!silent) {
      const lines = [def.title, def.objectives[0]?.label ?? ''];
      if (def.guild && def.rank) lines.push(`Rütbe ${def.rank} · ${QUEST_POINTS[def.rank]} Lonca Puanı${def.group ? ' (grup: yarısı)' : ''}`);
      R.sysmsg(def.kind === 'main' ? 'YENİ ANA GÖREV' : def.kind === 'board' ? 'PANO GÖREVİ ALINDI' : 'YENİ YAN GÖREV', lines, { sound: 'system' });
    }
    changed();
    return true;
  },
  advance(id: string, idx: number, n = 1) {
    if (!advance(G.state.quests, id, idx, n, lookup)) return false;
    const def = lookup(id)!;
    const st = G.state.quests.quests[id];
    const o = def.objectives[idx];
    if (o.count && o.count > 1) R.toast(`${o.label}: ${st.progress[idx]}/${o.count}`, 'info');
    else R.toast(`✓ ${o.label}`, 'info');
    changed();
    return true;
  },
  set(id: string, idx: number, v: number) {
    if (setProgress(G.state.quests, id, idx, v, lookup)) changed();
  },
  /** Bir amaç tamamlandı mı? */
  objDone(id: string, idx: number) {
    const st = G.state.quests.quests[id];
    const def = lookup(id);
    if (!st || !def) return false;
    return st.progress[idx] >= (def.objectives[idx].count ?? 1);
  },
  ready(id: string) {
    const st = G.state.quests.quests[id];
    const def = lookup(id);
    return !!st && !!def && st.status === 'active' && allObjectivesDone(def, st);
  },
  /** Olay bildir: kill/collect/talk/deliver/go. */
  notify(type: ObjectiveType, target: string, n = 1) {
    const ch = notify(G.state.quests, type, target, n, lookup);
    for (const id of ch) {
      const def = lookup(id)!;
      const st = G.state.quests.quests[id];
      const i = def.objectives.findIndex((o) => o.type === type && o.target === target);
      const o = def.objectives[i];
      if (o) R.toast(o.count && o.count > 1 ? `${o.label}: ${st.progress[i]}/${o.count}` : `✓ ${o.label}`, 'info');
    }
    if (ch.length) changed();
    return ch;
  },
  /**
   * Görevi bitir ve ödülü ver. Lonca görevlerinde puan eklenir ve önce loncaya olan borç kapatılır.
   * silent: bitiş animasyonu sahne bitince oynar (ertelenir). quiet: hiç oynamaz (terfi animasyonu yerine geçer ya
   * da yalnızca bir bekleme adımıydı).
   * Döner: gerçekten ödenen para.
   */
  complete(id: string, opts: { money?: number; silent?: boolean; quiet?: boolean } = {}): number {
    const def = lookup(id);
    if (!def || !finishQuest(G.state.quests, id, 'done', G.state.time.day)) return 0;
    const money = opts.money ?? def.reward.money ?? 0;
    let paid = money;
    let toDebt = 0;
    let points = 0;
    if (def.guild && def.rank) {
      const r = applyReward(G.state.guild, def.reward.points ?? QUEST_POINTS[def.rank], money, !!def.group);
      paid = r.paid;
      toDebt = r.toDebt;
      points = r.points;
    }
    // Ödül animasyonu önce kuyruğa girsin: arkasından gelen "LEVEL ATLADIN" ve "YENİ ANA GÖREV: Terfi" sırayı bozmasın
    const info: QuestDoneInfo = { title: def.title, kind: def.kind, money: paid, toDebt, points, pointsTotal: G.state.guild.points, items: def.reward.items ?? [], exp: null, text: def.reward.text };
    const expReward = questExp(def);
    if (expReward > 0) {
      // gainExp ile aynı hesap (çarpan dahil); sahne sonucu önceden bilsin, level bildirimi sahneden sonra gelsin
      const amount = Math.round(expReward * G.d.expMult);
      const r = addExp(G.p.level, G.p.exp, amount);
      info.exp = { amount, levelBefore: G.p.level, expBefore: G.p.exp, levelAfter: r.level, expAfter: r.exp };
    }
    if (opts.quiet) { /* animasyon yok */ }
    else if (opts.silent) deferredDone.push(info);
    else G.events.emit('questdone', info);
    if (paid > 0) R.giveMoney(paid, 'Görev ödülü: ' + def.title, true);
    if (def.reward.items?.length) R.giveItems(def.reward.items, 'Görev ödülü', true);
    if (expReward > 0) R.gainExp(expReward);
    if (def.guild && def.rank) Q.checkPromotion();
    G.state.quests.tracked = G.state.quests.tracked ?? pickNextTracked(G.state.quests, lookup);
    changed();
    return paid;
  },
  /** Ertelenmiş bitiş animasyonlarını kuyruğa al (sahne bitince WorldScene çağırır). */
  flushDeferred(): number {
    const n = deferredDone.length;
    while (deferredDone.length) G.events.emit('questdone', deferredDone.shift());
    return n;
  },
  /** Bekleyen ertelenmiş bitişler (testler ve oturum sıfırlama). */
  deferredCount(): number {
    return deferredDone.length;
  },
  clearDeferred() {
    deferredDone.length = 0;
  },
  /** Başarısızlık ya da yarıda bırakma: lonca görevlerinde ceza, borç, gerekirse kartın alınması. */
  fail(id: string, abandoned = false) {
    const def = lookup(id);
    if (!def || !finishQuest(G.state.quests, id, abandoned ? 'abandoned' : 'failed', G.state.time.day)) return;
    const lines = [def.title];
    if (def.guild && def.rank) {
      const pts = def.reward.points ?? QUEST_POINTS[def.rank];
      const reward = def.reward.money ?? 0;
      const r = applyPenalty(G.state.guild, pts, reward, walletTotal(G.p.wallet));
      if (r.paid > 0) pay(r.paid, 'Lonca cezası');
      lines.push(`−${r.points} Lonca Puanı · Ceza {m:${r.fine}}`);
      if (r.addedDebt) lines.push(`Loncaya borç: {m:${r.addedDebt}} (sonraki ödüllerden düşülür)`);
      if (r.cardRevoked) {
        G.p.guildRank = null;
        if (G.p.inventory.guild_card) R.takeItem('guild_card');
        lines.push('Puanın sıfırın altına düştü. Lonca kartın elinden alındı. Yeniden kayıt: 1 gümüş.');
      }
    }
    R.sysmsg(abandoned ? 'GÖREV BIRAKILDI' : 'GÖREV BAŞARISIZ', lines, { sound: 'alert' });
    changed();
  },
  track(id: string | null) {
    G.state.quests.tracked = id;
    changed();
  },
  risk(def: QuestDef): string {
    if (!def.guild || !def.rank) return '';
    return riskText(def.reward.points ?? QUEST_POINTS[def.rank], def.reward.money ?? 0);
  },
  /** Açık Terfi görevi (varsa). */
  rankupActive(): string | null {
    return activeQuests(G.state.quests).find(isRankupQuest) ?? null;
  },
  /**
   * Terfi hakkı: puan eşiği (ve Level şartı) sağlandıysa "Terfi" görevi açılır ve duyurulur; terfi Celeste'yle
   * konuşunca o anda işlenir (Q.promote). Sınavlı kademeler bu akışın dışında ('exam' döner, görev açılmaz).
   */
  checkPromotion(): 'quest' | 'exam' | null {
    const g = G.state.guild;
    if (!g.member || G.p.guildRank === null) return null;
    const cur = G.p.guildRank;
    const target = earnedRank(g.points, cur, G.p.level);
    if (target > cur) {
      if (!Q.rankupActive()) Q.start(rankupQuest(target).id, false, rankupQuest(target));
      return 'quest';
    }
    if (examRequired(cur + 1) && cur + 1 < 26) return 'exam';
    return null;
  },
  /**
   * Terfiyi şimdi uygula (Celeste): ulaşılabilen en yüksek kademeye çıkar, Terfi görevini kapatır, rütbe atlama
   * animasyonu için 'promotion' olayını yayar. Puan eşiğin altına düştüyse görevi bırakır ve null döner.
   */
  promote(): { from: SubRank; to: SubRank } | null {
    const g = G.state.guild;
    const open = Q.rankupActive();
    if (!g.member || G.p.guildRank === null) return null;
    const from = G.p.guildRank;
    const to = earnedRank(g.points, from, G.p.level);
    if (to <= from) {
      if (open && finishQuest(G.state.quests, open, 'abandoned', G.state.time.day)) changed();
      return null;
    }
    G.p.guildRank = to;
    if (open) Q.complete(open, { quiet: true });
    G.state.history.push({ speaker: 'Sistem', text: `Terfi: ${subRankToString(from)} → ${subRankToString(to)}`, kind: 'system' });
    G.events.emit('rank', to);
    G.events.emit('promotion', { from, to, points: g.points });
    G.scheduleSave();
    return { from, to };
  },
  /** Takip edilen görevin şu anki amacının hedefi. */
  target(): { id: string; def: QuestDef; t: QuestTarget } | null {
    const id = G.state.quests.tracked;
    if (!id || !Q.active(id)) return null;
    const def = lookup(id);
    const st = G.state.quests.quests[id];
    if (!def || !st) return null;
    const i = currentObjective(def, st);
    const t = def.objectives[i]?.where;
    return t ? { id, def, t } : null;
  },
};

(globalThis as any).__Q = Q;
