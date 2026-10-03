// Görev ve lonca sistemlerinin oyun içi katmanı: bildirimler, ödüller, cezalar, terfi, hedef konumları.
import { G } from './G';
import * as R from './rules';
import {
  startQuest, advance, setProgress, notify, finishQuest, isActive, isDone, allObjectivesDone, currentObjective, pickNextTracked,
  type QuestDef, type ObjectiveType, type QuestTarget,
} from '../core/quests';
import { questDef } from '../data/quests';
import { QUEST_POINTS, applyReward, applyPenalty, earnedRank, examRequired, riskText } from '../core/guild';
import { subRankToString } from '../core/ranks';
import { walletTotal } from '../core/money';
import { pay } from './rules';
import { ITEMS } from '../data/items';

const lookup = (id: string) => G.state.quests.quests[id]?.def ?? questDef(id);

export const KIND_NAMES: Record<string, string> = { main: 'Ana görev', side: 'Yan görev', board: 'Pano görevi' };

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
   * Döner: gerçekten ödenen para.
   */
  complete(id: string, opts: { money?: number; silent?: boolean } = {}): number {
    const def = lookup(id);
    if (!def || !finishQuest(G.state.quests, id, 'done', G.state.time.day)) return 0;
    const money = opts.money ?? def.reward.money ?? 0;
    let paid = money;
    const lines: string[] = [def.title];
    if (def.guild && def.rank) {
      const r = applyReward(G.state.guild, def.reward.points ?? QUEST_POINTS[def.rank], money, !!def.group);
      paid = r.paid;
      lines.push(`+${r.points} Lonca Puanı${def.group ? ' (grup görevi: yarısı)' : ''} · Toplam ${G.state.guild.points}`);
      if (r.toDebt) lines.push(`Loncaya borçtan düşüldü: {m:${r.toDebt}}`);
      Q.checkPromotion(true);
    }
    if (paid > 0) {
      R.giveMoney(paid, 'Görev ödülü: ' + def.title, true);
      lines.push(`Ödül: {m:${paid}}`);
    }
    if (def.reward.items?.length) {
      R.giveItems(def.reward.items, 'Görev ödülü', true);
      for (const it of def.reward.items) lines.push(`+${it.qty} ${ITEMS[it.id]?.name ?? it.id}`);
    }
    if (def.reward.text && !paid) lines.push(def.reward.text);
    if (!opts.silent) R.sysmsg('GÖREV TAMAMLANDI', lines, { sound: 'title' });
    G.state.quests.tracked = G.state.quests.tracked ?? pickNextTracked(G.state.quests, lookup);
    changed();
    return paid;
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
  /**
   * Terfi: puan eşiği geçildiyse ertesi gün işlenir ("Kayıtlar yarın işlenir.").
   * schedule: yeni bekleyen terfi oluştur; aksi hâlde günü gelen terfiyi uygula.
   */
  checkPromotion(schedule = false): string | null {
    const g = G.state.guild;
    if (!g.member || G.p.guildRank === null) return null;
    const cur = G.p.guildRank;
    if (schedule) {
      const target = earnedRank(g.points, cur, G.p.level);
      if (target > cur && (!g.pending || g.pending.rank < target)) g.pending = { rank: target, day: G.state.time.day + 1 };
      if (target === cur && examRequired(cur + 1) && g.points >= 0) return 'exam';
      return g.pending ? 'pending' : null;
    }
    if (g.pending && G.state.time.day >= g.pending.day) {
      const to = g.pending.rank;
      g.pending = null;
      G.p.guildRank = to;
      R.sysmsg('TERFİ', [`Maceracılar Loncası: ${subRankToString(cur)} → ${subRankToString(to)}`, `Lonca Puanı: ${g.points}`], { sound: 'levelup', big: true });
      G.events.emit('rank', to);
      G.scheduleSave();
      return 'promoted';
    }
    return null;
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
