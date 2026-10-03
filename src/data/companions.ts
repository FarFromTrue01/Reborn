// Yoldaş tanımları (C4). Yeni bir yoldaş eklemek için NPC kaydı (npcs.ts) + buraya bir satır yeterli.
// İstatistikler NPC'nin kendi Creature verisinden gelir; burada yalnızca davranış ve laflar var.

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
