// Yoldaş tanımları (C4). Yeni bir yoldaş eklemek için NPC kaydı (npcs.ts) + buraya bir satır yeterli.
// İstatistikler NPC'nin kendi Creature verisinden gelir; burada yalnızca davranış ve laflar var.

/**
 * 0.8.0 (C6): yoldaşlar Joseph'e yardım eder, işini yapmaz. Değirmen bodrumunda Vera ve Lina her vuruşta bir dev
 * fare öldürüyordu (Vera ~6–15, Dev Fare 3 HP). Hasar çarpanı, daha uzun bekleme, görünür hazırlanma ve Joseph'in o
 * an vurduğu düşmanı bitirmekten kaçınma (bkz. companionTargetScore). Çarpan ×0,35 ile başladı; QA ölçümünde (C8
 * sonrası Vera STR 8, Lina DEX 8 — 0.10.0'dan beri AGI) Joseph vurmadan bodrum 12,4 sn'de temizlendi; ×0,25'te 11,5 sn (Vera bir dev
 * fareyi hâlâ %45 olasılıkla tek vuruşta öldürüyordu) → ×0,15 (ölçümler PLAN.md'de).
 */
export const COMPANION_DMG_MULT = 0.15;
/**
 * 0.10.0 (B11): yaratık ve yoldaş saldırı sıklığı ×0,75 — bekleme süreleri ×(1/0,75). Hazırlık (windup) süreleri
 * aynı (tepki süresi). Joseph'in kendi saldırı hızına (Divine) dokunulmaz.
 */
export const ATTACK_RATE_SCALE = 0.75;
/** Yoldaş saldırı beklemesi (sn): 0.9.0'daki [2,2, 2,8] / 0,75 ≈ [2,93, 3,73]. */
export const COMPANION_COOLDOWN: [number, number] = [2.2 / ATTACK_RATE_SCALE, 2.8 / ATTACK_RATE_SCALE];
export const COMPANION_WINDUP = 0.4;
/** Joseph'in bu kadar saniye içinde vurduğu düşman "onun hedefi" sayılır. */
export const JOSEPH_TARGET_SEC = 2.5;

/**
 * Hedef puanı (küçük = önce): uzaklık; kendisine saldıran −2; Joseph'in o an vurduğu düşman +6 (başka hedef
 * varsa ona gider, yoksa yine yardım eder).
 */
export function companionTargetScore(distTiles: number, attacksMe: boolean, josephsTarget: boolean): number {
  return distTiles + (attacksMe ? -2 : 0) + (josephsTarget ? 6 : 0);
}

export interface CompanionDef {
  id: string;
  /** melee: yanaşıp vurur, yandan sarar. archer: mesafe korur, geri çekilerek ok atar. */
  role: 'melee' | 'archer';
  /** Takipte Joseph'in hangi yanında yürür (−1 sol, +1 sağ). */
  side: number;
  /** Takipte söylenen laflar (dostluk sonrası). */
  banter: string[];
  /** Savaşa girerken. */
  engage: string[];
  /** Bir düşmanı bitirince. */
  kill: string[];
  /** Yere düşünce. */
  down: string[];
  /** Savaştan sonra toparlanınca. */
  up: string[];
  /** Joseph hiç vurmadan düşman ölünce (EXP kuralı hatırlatması). */
  noExp: string[];
}

export const COMPANIONS: Record<string, CompanionDef> = {
  vera: {
    id: 'vera', role: 'melee', side: -1,
    banter: [
      'Köksüz, adımlarını kısa tut. Uzun adım dengeyi bozar.',
      'Şu kılıcı alınca ilk işin bileğini güçlendirmek olsun.',
      'Lina, kulakların bir şey duyuyor mu?',
      'Sessiz yürü. Ya da en azından Lina kadar gürültü yapma.',
      'Şehirde herkes bir rütbe takar boynuna. Burada en azından birbirimizi tanıyoruz.',
      'Yorulduysan söyle. Söyleme aslında, ben anlarım.',
    ],
    engage: ['Yan tarafa geç, ben önünü tutarım!', 'Arkamda kalma, yanımda dur!', 'Sırtını açma!'],
    kill: ['Biri eksik.', 'Hah! Sıradaki.', 'Temiz.'],
    down: ['Ah— dizim...!', 'Lanet... bir dakika...'],
    up: ['İyiyim, iyiyim. Bakma öyle.', 'Kalkıyorum. Bir şey olmadı.'],
    noExp: ['Ben vurdum, ben öğrendim. Sen de bir kere vur bari.'],
  },
  lina: {
    id: 'lina', role: 'archer', side: 1,
    banter: [
      'Hihi, köksüz yine yere bakarak yürüyor~',
      'Rüzgâr batıdan. Kokunu taşıyor, haberin olsun.',
      'Vera homurdanıyor ama aslında seni seviyor. Hihi.',
      'Kulaklarım bir şey duydu... Yok, sadece midendi.',
      'Şehre gidince ilk iş bal çöreği. Söz verdim kendime.',
      'Adımlarını say, sonra unut. Ben öyle yaparım.',
    ],
    engage: ['Arkadan atıyorum, eğil!', 'Bende! Bende!', 'Yaklaştırmayın bana!'],
    kill: ['Tam gözünden! ...Sanırım.', 'Hihi, bir tane daha!', 'Gördün mü onu?'],
    down: ['Ayy! Kuyruğum...!', 'Vera... biraz... uzanacağım...'],
    up: ['Hihi, ölmedim. Şaşırdın mı?', 'Oklarımı toplasana, köksüz.'],
    noExp: ['Hihi, o benimdi. Sana bir şey kalmadı~'],
  },
};
