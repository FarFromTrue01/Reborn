import type { SkillDef, TechniqueDef } from '../core/types';

// Skill'ler: kaliteli ve az. Her skill'in kendi gelişim tablosu var (0.9.0, Grup 5B — S7).
// 'at' alanı o tabloya ulaşılan kilometre taşıdır (her harfin "-" kademesi: G-, F-, … X-).
// Tablolardaki sayılar o rütbedeki TOPLAM değerdir: core/skills mergedPassive tabloları sırayla alan alan birleştirir
// (aynı alanda son değer geçerli; anılmayan alan önceki değerini korur). Ara kademelerde (G, G+) sayısal pasifler
// bir sonraki kilometre taşına doğru üçte bir ilerler.

const skills: SkillDef[] = [
  // --------------------------------------------------------------- Doğuştan (gri çerçeve)
  {
    id: 'appraisal', name: 'Appraisal', rarity: 'innate', icon: 'sk_appraisal',
    desc: 'Bir canlının bilgisini okur. Rütbe farkı ne kadar büyükse o kadar çok şey görülür. Trait\'ler hiçbir rütbede görünmez.',
    tiers: [
      { at: 'G-', note: 'Hedefin Appraisal rütbesiyle karşılaştırarak bilgi gösterir.' },
      { at: 'F-', note: 'Bir harf daha yükseğe kadar daha çok bilgi görülür.' },
      { at: 'E-', note: 'Lonca görevlileri gibi insanları okuyabilirsin.' },
    ],
  },
  // --------------------------------------------------------------- Sıradan (gri) — aktif yetenek yok
  {
    id: 'stealth', name: 'Gizlilik', rarity: 'common', icon: 'sk_stealth',
    desc: 'Fark edilmeden hareket etme sanatı.',
    tiers: [
      { at: 'G-', passive: { detectionPct: -0.1 }, note: 'Fark edilme mesafesi -%10.' },
      { at: 'F-', passive: { detectionPct: -0.2 }, note: 'Fark edilme -%20.' },
      { at: 'E-', passive: { detectionPct: -0.25, sneakMult: 1.75 }, note: 'Fark edilme -%25, gizli saldırı ×1,75.' },
      { at: 'D-', passive: { detectionPct: -0.35, sneakMult: 2 }, note: 'Fark edilme -%35, gizli saldırı ×2.' },
      { at: 'C-', passive: { detectionPct: -0.4, sneakMult: 2.25 }, note: 'Fark edilme -%40, gizli saldırı ×2,25.' },
      { at: 'B-', passive: { detectionPct: -0.45, sneakMult: 2.5, noticeDelay: 1 }, note: 'Fark edilme -%45, gizli saldırı ×2,5. Düşmanlar seni 1 sn geç fark eder.' },
      { at: 'A-', passive: { detectionPct: -0.5, sneakMult: 2.75 }, note: 'Fark edilme -%50, gizli saldırı ×2,75.' },
      { at: 'S-', awakening: true, passive: { shadow: true }, note: 'Awakening: Gölge. 3 sn hareketsiz kalınca saldırana kadar görünmez olursun.' },
      { at: 'X-', awakening: true, passive: { sneakMult: 3.5, ghost: true }, note: 'Awakening: Hayalet. Gizli saldırı ×3,5. Öldürünce gizlilik bozulmaz.' },
    ],
  },
  {
    id: 'evasion', name: 'Kaçınma', rarity: 'common', icon: 'sk_evasion',
    desc: 'Darbeyi son anda savuşturma içgüdüsü.',
    tiers: [
      { at: 'G-', passive: { dodgeWindowPct: 0.1 }, note: 'Mükemmel kaçış penceresi +%10.' },
      { at: 'F-', passive: { dodgeWindowPct: 0.2, dodgeCostPct: -0.1 }, note: 'Pencere +%20, kaçış maliyeti -%10.' },
      { at: 'E-', passive: { dodgeWindowPct: 0.3, dodgeCostPct: -0.2 }, note: 'Pencere +%30, maliyet -%20.' },
      { at: 'D-', passive: { dodgeWindowPct: 0.35, dodgeCostPct: -0.25 }, note: 'Pencere +%35, maliyet -%25.' },
      { at: 'C-', passive: { perfectDodgeStamina: 0.05 }, note: 'Mükemmel kaçış max dayanıklılığın %5\'ini geri verir.' },
      { at: 'B-', passive: { dodgeWindowPct: 0.5, dodgeCostPct: -0.3 }, note: 'Pencere +%50, maliyet -%30.' },
      { at: 'A-', passive: { critAfterPerfect: true }, note: 'Mükemmel kaçıştan sonraki ilk vuruş kesin kritik.' },
      { at: 'S-', awakening: true, passive: { freeDodge: true }, note: 'Awakening: Rüzgâr Gibi. 6 sn\'de bir, bir kaçış bedava olur ve 0,8 sn kaçış beklemesini yok sayar.' },
      { at: 'X-', awakening: true, passive: { dodgeWindowPct: 1, dodgeCostPct: -0.5 }, note: 'Awakening: Dokunulmaz. Mükemmel kaçış penceresi ×2, maliyet -%50.' },
    ],
  },
  {
    id: 'archery', name: 'Okçuluk', rarity: 'common', weapon: 'bow', icon: 'sk_archery',
    desc: 'Yay kullanımı. Tamamen pasif: yay kullanmak için skill gerekmez.',
    tiers: [
      { at: 'G-', passive: { dmg: { bow: 0.05 } }, note: 'Yay hasarı +%5.' },
      { at: 'F-', passive: { dmg: { bow: 0.1 } }, note: 'Yay hasarı +%10.' },
      { at: 'E-', passive: { arrowSpeedPct: 0.15 }, note: 'Oklar %15 daha hızlı uçar.' },
      { at: 'D-', passive: { dmg: { bow: 0.2 } }, note: 'Yay hasarı +%20.' },
      { at: 'C-', passive: { range: { bow: 0.2 } }, note: 'Menzil +%20.' },
      { at: 'B-', passive: { dmg: { bow: 0.25 }, atkSpd: { bow: 0.1 } }, note: 'Yay hasarı +%25, yay saldırı hızı +%10.' },
      { at: 'A-', passive: { dmg: { bow: 0.3 }, crit: { bow: 0.05 } }, note: 'Yay hasarı +%30, kritik şansı +%5.' },
      { at: 'S-', awakening: true, passive: { stillBowPct: 0.2 }, note: 'Awakening: Keskin Göz. Hareketsizken atılan oklar +%20 hasar.' },
      { at: 'X-', awakening: true, passive: { dmg: { bow: 0.45 }, atkSpd: { bow: 0.2 } }, note: 'Awakening: Usta Okçu. Yay hasarı +%45, yay saldırı hızı +%20.' },
    ],
  },
  {
    id: 'first_aid', name: 'İlk Yardım', rarity: 'common', icon: 'sk_firstaid',
    desc: 'Sargı, merhem ve dinlenmeyi bilmek.',
    tiers: [
      { at: 'G-', passive: { healPct: 0.2 }, note: 'Sargı ve iksirler +%20 iyileştirir.' },
      { at: 'F-', passive: { healPct: 0.3, regenPct: 0.1 }, note: 'İyileşme +%30, savaş dışı yenilenme +%10.' },
      { at: 'E-', passive: { healPct: 0.45, regenPct: 0.2 }, note: 'İyileşme +%45, yenilenme +%20.' },
      { at: 'D-', passive: { healPct: 0.55, regenPct: 0.25, bandageTimePct: -0.5 }, note: 'İyileşme +%55, yenilenme +%25, sargı süresi yarıya iner.' },
      { at: 'C-', passive: { afterCombatRegen: true }, note: 'Savaştan çıkınca 5 sn hızlı yenilenme.' },
      { at: 'B-', passive: { healPct: 0.75, debuffDurPct: -0.25 }, note: 'İyileşme +%75, olumsuz etkiler %25 kısa sürer.' },
      { at: 'A-', passive: { healPct: 0.9, regenPct: 0.45 }, note: 'İyileşme +%90, yenilenme +%45.' },
      { at: 'S-', awakening: true, passive: { healShare: 0.5 }, note: 'Awakening: Saha Hekimi. İyileşmenin %50\'si yanındaki yoldaşlara da yansır.' },
      { at: 'X-', awakening: true, passive: { secondWind: true }, note: 'Awakening: İkinci Nefes. Günde bir kez ölümcül darbede 1 HP ile kalırsın.' },
    ],
  },
  {
    id: 'athletics', name: 'Atletizm', rarity: 'common', icon: 'sk_athletics',
    desc: 'Koşmak, tırmanmak, yorulmamak. Hareket hızına dokunmaz.',
    tiers: [
      { at: 'G-', passive: { staminaFlat: 5 }, note: 'Dayanıklılık +5.' },
      { at: 'F-', passive: { staminaFlat: 10, runCostPct: -0.15 }, note: 'Dayanıklılık +10, koşu maliyeti -%15.' },
      { at: 'E-', passive: { staminaFlat: 20, runCostPct: -0.25 }, note: 'Dayanıklılık +20, koşu -%25.' },
      { at: 'D-', passive: { staminaFlat: 30, runCostPct: -0.3, staminaRegenPct: 0.1 }, note: 'Dayanıklılık +30, koşu -%30, dayanıklılık yenilenmesi +%10.' },
      { at: 'C-', passive: { staminaFlat: 40, runCostPct: -0.35, staminaRegenPct: 0.15 }, note: 'Dayanıklılık +40, koşu -%35, yenilenme +%15.' },
      { at: 'B-', passive: { staminaFlat: 55, runCostPct: -0.4, staminaRegenPct: 0.2 }, note: 'Dayanıklılık +55, koşu -%40, yenilenme +%20.' },
      { at: 'A-', passive: { staminaFlat: 70, runCostPct: -0.45, staminaRegenPct: 0.25 }, note: 'Dayanıklılık +70, koşu -%45, yenilenme +%25.' },
      { at: 'S-', awakening: true, passive: { freeRun: true }, note: 'Awakening: Sonsuz Adım. Savaş dışında koşmak dayanıklılık harcamaz.' },
      { at: 'X-', awakening: true, passive: { staminaRegenPct: 0.6 }, note: 'Awakening: Yorulmaz. Dayanıklılık yenilenmesi +%60.' },
    ],
  },
  {
    id: 'gathering', name: 'Toplayıcılık', rarity: 'common', icon: 'sk_gather',
    desc: 'Ormanın verdiklerini tanımak.',
    tiers: [
      { at: 'G-', passive: { gatherBonus: 0.15 }, note: 'Ek ürün şansı %15.' },
      { at: 'F-', passive: { gatherBonus: 0.3 }, note: 'Ek ürün şansı %30.' },
      { at: 'E-', passive: { gatherBonus: 0.5 }, note: 'Ek ürün şansı %50.' },
      { at: 'D-', passive: { gatherBonus: 0.65, rareGatherPct: 0.1 }, note: 'Ek ürün %65, nadir malzeme şansı +%10.' },
      { at: 'C-', passive: { gatherBonus: 0.8, rareGatherPct: 0.15, gatherTimePct: -0.25 }, note: 'Ek ürün %80, nadir +%15, toplama süresi -%25.' },
      { at: 'B-', passive: { gatherBonus: 1, rareGatherPct: 0.2 }, note: 'Her toplamada kesin +1, nadir +%20.' },
      { at: 'A-', passive: { gatherExtra2: 0.3 }, note: 'Kesin +1 ve %30 ihtimalle +2.' },
      { at: 'S-', awakening: true, passive: { rareGatherPct: 0.4, gatherTimePct: -1 }, note: 'Awakening: Usta Toplayıcı. Nadir malzeme şansı +%40, toplama anında biter.' },
      { at: 'X-', awakening: true, passive: { regrowHalf: true }, note: 'Awakening: Bereket. Toplanan kaynaklar yarı sürede yeniden doğar.' },
    ],
  },
  // --------------------------------------------------------------- Nadir (mavi)
  {
    id: 'sword_mastery', name: 'Kılıç Ustalığı', rarity: 'rare', weapon: 'sword', icon: 'sk_sword',
    desc: 'Kılıcı vücudun bir uzantısı gibi kullanmak.',
    tiers: [
      { at: 'G-', passive: { atkStamina: { sword: -0.1 } }, note: 'Kılıçla saldırıların dayanıklılık maliyeti -%10.' },
      { at: 'F-', passive: { dmg: { sword: 0.05 } }, note: 'Kılıç hasarı +%5.' },
      { at: 'E-', passive: { crit: { sword: 0.03 } }, note: 'Kılıçla kritik şansı +%3.' },
      { at: 'D-', technique: 'double_slash', note: 'Çift Kesik yeteneği.' },
      { at: 'C-', passive: { dmg: { sword: 0.15 } }, note: 'Kılıç hasarı +%15.' },
      { at: 'B-', technique: 'counter', note: 'Karşı Saldırı yeteneği.' },
      { at: 'A-', awakening: true, passive: { dmg: { sword: 0.35 }, comboFinisher: 1.5 }, note: 'Awakening: Kılıç Ustası. Kılıç hasarı +%35, kombonun son vuruşu ×1,5.' },
      { at: 'S-', awakening: true, passive: { atkSpd: { sword: 0.15 } }, note: 'Awakening: Kesik Yolu (pasif). Kılıçla saldırı hızı +%15.' },
      { at: 'X-', awakening: true, passive: { dmg: { sword: 0.6 }, cdMult: 0.5 }, note: 'Awakening: Kılıç Azizi. Kılıç hasarı +%60, iki yeteneğin bekleme süresi yarıya iner.' },
    ],
  },
  {
    id: 'spear_mastery', name: 'Mızrak Ustalığı', rarity: 'rare', weapon: 'spear', icon: 'sk_spear',
    desc: 'Uzun sapın getirdiği menzil ve kontrol.',
    tiers: [
      { at: 'G-', passive: { dmg: { spear: 0.03 } }, note: 'Mızrak hasarı +%3.' },
      { at: 'F-', passive: { range: { spear: 0.05 } }, note: 'Menzil +%5.' },
      { at: 'E-', passive: { range: { spear: 0.15 } }, note: 'Menzil +%15.' },
      { at: 'D-', technique: 'piercing_thrust', note: 'Delici Hamle yeteneği.' },
      { at: 'C-', passive: { range: { spear: 0.25 }, dmg: { spear: 0.15 } }, note: 'Menzil +%25, mızrak hasarı +%15.' },
      { at: 'B-', technique: 'sweep', note: 'Süpürme yeteneği.' },
      { at: 'A-', awakening: true, passive: { range: { spear: 0.4 }, dmg: { spear: 0.35 } }, note: 'Awakening: Ejder Mızrağı (pasif). Menzil +%40, mızrak hasarı +%35.' },
      { at: 'S-', awakening: true, passive: { cdMult: 0.6 }, note: 'Awakening: Uzun Kol (pasif). İki yeteneğin bekleme süresi -%40.' },
      { at: 'X-', awakening: true, passive: { dmg: { spear: 0.6 }, range: { spear: 0.6 } }, note: 'Awakening: Göğü Delen (pasif). Mızrak hasarı +%60, menzil +%60.' },
    ],
  },
  {
    id: 'fire_magic', name: 'Ateş Büyüsü', rarity: 'rare', icon: 'sk_fire',
    desc: 'Mananı alev olarak dışa vurmak. Ateş yetenekleri vurduğu düşmanı 3 sn yakar.',
    tiers: [
      { at: 'G-', technique: 'spark', passive: { burnDur: 3 }, note: 'Kıvılcım yeteneği.' },
      { at: 'F-', passive: { burnDur: 4 }, note: 'Yanma süresi +1 sn.' },
      { at: 'E-', passive: { dmg: { fire: 0.1 } }, note: 'Ateş hasarı +%10.' },
      { at: 'D-', technique: 'fireball', note: 'Ateş Topu yeteneği.' },
      { at: 'C-', passive: { dmg: { fire: 0.25 }, areaPct: 0.3 }, note: 'Ateş hasarı +%25, alan +%30.' },
      { at: 'B-', passive: { burnMult: 1.5 }, note: 'Yanma hasarı ×1,5.' },
      { at: 'A-', awakening: true, technique: 'inferno_ring', note: 'Awakening: Cehennem Çemberi yeteneği.' },
      { at: 'S-', awakening: true, passive: { dmg: { fire: 0.6 }, areaPct: 0.8 }, note: 'Awakening: Alevlerin Efendisi. Ateş hasarı +%60, alan +%80.' },
      { at: 'X-', awakening: true, passive: { mpPct: -0.3, burnMult: 2 }, note: 'Awakening: Güneş Çekirdeği. Ateş yetenekleri MP -%30, yanma hasarı ×2.' },
    ],
  },
  {
    id: 'healing_magic', name: 'Şifa Büyüsü', rarity: 'rare', icon: 'sk_heal',
    desc: 'Mananı yaşam gücüne çevirmek.',
    tiers: [
      { at: 'G-', technique: 'minor_heal', note: 'Küçük Şifa yeteneği.' },
      { at: 'F-', passive: { mpPct: -0.15 }, note: 'Şifa yetenekleri MP -%15.' },
      { at: 'E-', passive: { healPct: 0.2 }, note: 'Tüm iyileşme +%20.' },
      { at: 'D-', technique: 'regeneration', note: 'Yenilenme yeteneği.' },
      { at: 'C-', passive: { healPct: 0.4, regenPct: 0.2 }, note: 'İyileşme +%40, yenilenme +%20.' },
      { at: 'B-', technique: 'purify', note: 'Arındırma yeteneği.' },
      { at: 'A-', awakening: true, passive: { healParty: true }, note: 'Awakening: Kutsal Işık. Şifa yakındaki yoldaşları da kapsar.' },
      { at: 'S-', awakening: true, passive: { curseBreak: true }, note: 'Awakening: Lanet Kıran. Arındırma saatler süren lanetleri de kaldırır.' },
      { at: 'X-', awakening: true, passive: { healPct: 1, mpPct: -0.4 }, note: 'Awakening: Yaşam Kaynağı. İyileşme +%100, şifa MP -%40.' },
    ],
  },
  // --------------------------------------------------------------- Epik (mor) — 0.9.0
  {
    id: 'ice_magic', name: 'Buz Büyüsü', rarity: 'epic', icon: 'sk_ice',
    desc: 'Mananı soğuğa çevirmek: yavaşlatır, dondurur, deler.',
    tiers: [
      { at: 'G-', technique: 'ice_shard', passive: { slowPct: 0.2 }, note: 'Buz Kıymığı yeteneği.' },
      { at: 'F-', passive: { slowPct: 0.3 }, note: 'Yavaşlatma %20\'den %30\'a çıkar.' },
      { at: 'E-', technique: 'ice_armor', note: 'Buz Zırhı yeteneği.' },
      { at: 'D-', passive: { dmg: { ice: 0.2 } }, note: 'Buz hasarı +%20.' },
      { at: 'C-', technique: 'frost_ring', note: 'Donduran Halka yeteneği.' },
      { at: 'B-', awakening: true, passive: { slowMult: 2 }, note: 'Awakening: Kış Nefesi. Tüm yavaşlatmalar iki katına çıkar.' },
      { at: 'A-', awakening: true, technique: 'glacier_spear', note: 'Awakening: Buzul Mızrağı yeteneği.' },
      { at: 'S-', awakening: true, passive: { freezeRadiusMult: 2, freezeDur: 3 }, note: 'Awakening: Mutlak Sıfır (pasif). Donduran Halka\'nın yarıçapı iki katına, dondurma 3 sn\'ye çıkar.' },
      { at: 'X-', awakening: true, passive: { frozenDmgMult: 2, mpPct: -0.3 }, note: 'Awakening: Kışın Kalbi. Donmuş düşmanlara vuruşlar ×2, buz yetenekleri MP -%30.' },
    ],
  },
  {
    id: 'war_cry', name: 'Savaş Narası', rarity: 'epic', icon: 'sk_warcry',
    desc: 'Sesinle savaş alanını eğmek. Nara bosslara ve senden yüksek leveldeki düşmanlara hiçbir rütbede işlemez.',
    tiers: [
      { at: 'G-', technique: 'war_shout', note: 'Nara yeteneği.' },
      { at: 'F-', passive: { allyDmgBuff: 0.1 }, note: 'Nara yoldaşlara 8 sn +%10 hasar verir.' },
      { at: 'E-', passive: { shoutRadiusPct: 0.3 }, note: 'Nara yarıçapı +%30.' },
      { at: 'D-', passive: { stats: { STR: 2 } }, note: 'Pasif STR +2.' },
      { at: 'C-', technique: 'challenge', note: 'Meydan Okuma yeteneği.' },
      { at: 'B-', awakening: true, passive: { shoutAtkSpd: 0.2 }, note: 'Awakening: Savaş Lordu. Naradan sonra 6 sn saldırı hızı +%20.' },
      { at: 'A-', awakening: true, passive: { fearLow: true }, note: 'Awakening: Korkutan Ses. Kullanıcıdan 3+ level düşük düşmanlar kaçar.' },
      { at: 'S-', awakening: true, passive: { allyDmgBuff: 0.3, allyDefBuff: 0.2 }, note: 'Awakening: Ordunun Sesi. Yoldaşlar +%30 hasar ve +%20 savunma.' },
      { at: 'X-', awakening: true, passive: { staggerDur: 1, stats: { STR: 10 } }, note: 'Awakening: Kral Narası. Sendeleme 1 sn, pasif STR +10.' },
    ],
  },
  // --------------------------------------------------------------- Efsanevi (altın)
  {
    id: 'storm_blade', name: 'Fırtına Kılıcı', rarity: 'legendary', weapon: 'sword', icon: 'sk_storm',
    desc: 'Kılıcın rüzgârı kesip uzağa taşıdığı eski bir sanat.',
    tiers: [
      { at: 'G-', technique: 'wind_cut', note: 'Rüzgâr Kesiği: kısa menzilli kesik dalgası.' },
      { at: 'F-', passive: { techRangePct: 0.25 }, note: 'Kesik menzili +%25.' },
      { at: 'E-', passive: { dmg: { sword: 0.1 }, stats: { AGI: 2 } }, note: 'Kılıç hasarı +%10, AGI +2.' },
      { at: 'D-', passive: { windWaves: 2 }, note: 'Rüzgâr Kesiği iki dalga çıkarır.' },
      { at: 'C-', awakening: true, technique: 'gale_dance', note: 'Awakening: Fırtına Dansı (ardışık dört kesik).' },
      { at: 'B-', awakening: true, passive: { deflect: 0.25 }, note: 'Awakening: Rüzgâr Zırhı. Gelen mermilerin %25\'i sapar.' },
      { at: 'A-', awakening: true, passive: { dmg: { sword: 0.4 }, stats: { AGI: 10 } }, note: 'Awakening: Fırtınanın Gözü. Kılıç hasarı +%40, AGI +10.' },
      { at: 'S-', awakening: true, technique: 'sky_sunder', note: 'Awakening: Gök Yaran.' },
      { at: 'X-', awakening: true, passive: { windOnHit: true }, note: 'Awakening: Fırtına Tanrısı. Her kılıç vuruşu bir rüzgâr dalgası çıkarır.' },
    ],
  },
  {
    id: 'thunder_magic', name: 'Yıldırım Büyüsü', rarity: 'legendary', icon: 'sk_thunder',
    desc: 'Göğün öfkesini çağırmak.',
    tiers: [
      { at: 'G-', technique: 'static_bolt', passive: { chain: 1 }, note: 'Statik Ok: hızlı, zincirlenen küçük yıldırım.' },
      { at: 'F-', passive: { chain: 2 }, note: 'Zincir +1 hedef.' },
      { at: 'E-', passive: { dmg: { spell: 0.15 } }, note: 'Büyü hasarı +%15.' },
      { at: 'D-', passive: { paralyzeChance: 0.1 }, note: 'Yıldırım vuruşları %10 ihtimalle kısa felç verir.' },
      { at: 'C-', awakening: true, technique: 'thunder_strike', note: 'Awakening: Gök Gürültüsü (alan yıldırımı).' },
      { at: 'B-', awakening: true, technique: 'lightning_step', note: 'Awakening: Yıldırım Adımı. Kısa mesafe ışınlanma.' },
      { at: 'A-', awakening: true, passive: { dmg: { spell: 0.5 } }, note: 'Awakening: Fırtına Çağıran. Büyü hasarı +%50.' },
      { at: 'S-', awakening: true, technique: 'heaven_judgement', note: 'Awakening: Göğün Hükmü.' },
      { at: 'X-', awakening: true, passive: { chainAll: true, mpPct: -0.3 }, note: 'Awakening: Yıldırımın Kendisi. Tüm yıldırım büyüleri zincirlenir, MP -%30.' },
    ],
  },
  {
    id: 'iron_body', name: 'Demir Beden', rarity: 'legendary', icon: 'sk_ironbody',
    desc: 'Bedeni bir kale gibi sertleştirmek.',
    tiers: [
      { at: 'G-', passive: { hpPct: 0.05, stats: { VIT: 1 } }, note: 'Max HP +%5, VIT +1.' },
      { at: 'F-', passive: { hpPct: 0.1, stats: { VIT: 2 } }, note: 'Max HP +%10, VIT +2.' },
      { at: 'E-', passive: { hpPct: 0.15, stats: { VIT: 3 } }, note: 'Max HP +%15, VIT +3.' },
      { at: 'D-', passive: { hpPct: 0.2, stats: { VIT: 4 }, stunDurPct: -0.25 }, note: 'Max HP +%20, VIT +4, sersemleme süresi -%25.' },
      { at: 'C-', awakening: true, technique: 'iron_skin', passive: { hpPct: 0.25, stats: { VIT: 6 } }, note: 'Awakening: Demir Deri yeteneği. Max HP +%25, VIT +6.' },
      { at: 'B-', awakening: true, passive: { noKnockback: true, hpPct: 0.3, stats: { VIT: 9 } }, note: 'Awakening: Taş Kök. Darbe alınca geri savrulmazsın. Max HP +%30, VIT +9.' },
      { at: 'A-', awakening: true, passive: { hpPct: 0.6, stats: { VIT: 20 } }, note: 'Awakening: Yıkılmaz. Max HP +%60, VIT +20.' },
      { at: 'S-', awakening: true, passive: { dmgTakenPct: -0.2 }, note: 'Awakening: Çelik Ruh. Alınan hasar -%20.' },
      { at: 'X-', awakening: true, passive: { deathGuard: true }, note: 'Awakening: Ölümsüz Kale. Günde bir kez ölümcül darbe yerine 3 sn yenilmezlik.' },
    ],
  },
];

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(skills.map((s) => [s.id, s]));

export function skillDef(id: string): SkillDef {
  const s = SKILLS[id];
  if (!s) throw new Error('Bilinmeyen skill: ' + id);
  return s;
}

export const RARITY_NAMES: Record<string, string> = {
  common: 'Sıradan',
  rare: 'Nadir',
  epic: 'Epik',
  legendary: 'Efsanevi',
  innate: 'Doğuştan',
};

/**
 * Teknikler (aktif yetenekler). mp alanı elle yazılmaz: core/skills techniqueMp — nadirlik tabanı × açıldığı harfin
 * çarpanı, büyülerde ×2 (spell: true). Hasar/iyileşme power × teknik gücü (skill'in her alt kademesinde +%5).
 * Fiziksel yetenekler normal vuruşun katı; büyüler taban hasar × büyü gücü (resolveSpell).
 */
const techniques: TechniqueDef[] = [
  // Kılıç Ustalığı
  { id: 'double_slash', name: 'Çift Kesik', desc: 'İki hızlı kesik; her biri normal vuruşun %90\'ı.', mp: 0, cooldown: 5, kind: 'melee_multi', power: 0.9, hits: 2, weapon: 'sword' },
  { id: 'counter', name: 'Karşı Saldırı', desc: '1,2 sn savunma duruşu: gelen darbe engellenir ve normal vuruşun ×2\'siyle karşılık verilir.', mp: 0, cooldown: 10, kind: 'parry', power: 2, duration: 1.2, weapon: 'sword' },
  // Mızrak Ustalığı
  { id: 'piercing_thrust', name: 'Delici Hamle', desc: '2,5 kare ileri hamle; yolundaki tüm düşmanları deler (normal vuruşun ×1,6\'sı).', mp: 0, cooldown: 6, kind: 'lunge', power: 1.6, range: 2.5, weapon: 'spear' },
  { id: 'sweep', name: 'Süpürme', desc: 'Önündeki yarım dairede herkese savurma (normal vuruşun ×1,2\'si); geri itmez.', mp: 0, cooldown: 8, kind: 'sweep', power: 1.2, weapon: 'spear' },
  // Ateş Büyüsü
  { id: 'spark', name: 'Kıvılcım', desc: '4 kare menzilli küçük ateş mermisi; vurduğunu yakar. Meşale ve ot da yakar.', mp: 0, cooldown: 1.2, kind: 'projectile', power: 1.5, element: 'fire', range: 4, ignites: true, spell: true },
  { id: 'fireball', name: 'Ateş Topu', desc: '7 kare menzilli top; çarptığı yerde 1,5 kare yarıçapta patlar.', mp: 0, cooldown: 6, kind: 'projectile', power: 8, element: 'fire', range: 7, radius: 1.5, ignites: true, spell: true },
  { id: 'inferno_ring', name: 'Cehennem Çemberi', desc: 'Etrafını 5 kare yarıçapta alevle sarar.', mp: 0, cooldown: 30, kind: 'aoe', power: 40, element: 'fire', radius: 5, ignites: true, spell: true, self: true },
  // Şifa Büyüsü
  { id: 'minor_heal', name: 'Küçük Şifa', desc: 'Anında iyileştirir (taban 4 HP; INT ve iyileşme bonuslarıyla artar).', mp: 0, cooldown: 3, kind: 'heal', power: 4, element: 'heal', spell: true },
  { id: 'regeneration', name: 'Yenilenme', desc: '8 sn boyunca saniyede 2 HP iyileştirir.', mp: 0, cooldown: 15, kind: 'buff', power: 2, duration: 8, element: 'heal', spell: true },
  { id: 'purify', name: 'Arındırma', desc: 'Savaş etkilerini (yanma, yavaşlama, …) anında siler. Lanetleri S-\'ye kadar kaldıramaz.', mp: 0, cooldown: 20, kind: 'cleanse', power: 0, element: 'heal', spell: true },
  // Buz Büyüsü
  { id: 'ice_shard', name: 'Buz Kıymığı', desc: '5 kare menzilli mermi; vurduğunu 2 sn yavaşlatır.', mp: 0, cooldown: 1.5, kind: 'projectile', power: 2, element: 'ice', range: 5, spell: true },
  { id: 'ice_armor', name: 'Buz Zırhı', desc: '6 sn boyunca gelen hasarı emen kalkan (3 + max HP\'nin %20\'si).', mp: 0, cooldown: 18, kind: 'shield', power: 3, duration: 6, element: 'ice', spell: true },
  { id: 'frost_ring', name: 'Donduran Halka', desc: 'Etrafında 2 kare yarıçapta herkesi 1,5 sn dondurur.', mp: 0, cooldown: 14, kind: 'aoe', power: 4, element: 'ice', radius: 2, spell: true, self: true },
  { id: 'glacier_spear', name: 'Buzul Mızrağı', desc: '6 kare ileri fırlayan, sıradaki tüm düşmanları delen buz mızrağı.', mp: 0, cooldown: 12, kind: 'projectile', power: 18, element: 'ice', range: 6, pierce: true, spell: true },
  // Savaş Narası (fiziksel)
  { id: 'war_shout', name: 'Nara', desc: '3 kare içindeki, senden düşük ya da eşit leveldeki düşmanlar 0,5 sn sendeler.', mp: 0, cooldown: 12, kind: 'shout', power: 0, radius: 3 },
  { id: 'challenge', name: 'Meydan Okuma', desc: 'Düşmanlar 5 sn boyunca sana yönelir, yoldaşları korur.', mp: 0, cooldown: 15, kind: 'taunt', power: 0, duration: 5, radius: 6 },
  // Fırtına Kılıcı (silah, fiziksel)
  { id: 'wind_cut', name: 'Rüzgâr Kesiği', desc: 'Kılıçtan fırlayan kısa menzilli kesik dalgası.', mp: 0, cooldown: 3, kind: 'projectile', power: 1.2, element: 'wind', range: 4, weapon: 'sword', physical: true },
  { id: 'gale_dance', name: 'Fırtına Dansı', desc: 'Ardışık dört kesik.', mp: 0, cooldown: 10, kind: 'melee_multi', power: 0.8, hits: 4, weapon: 'sword' },
  { id: 'sky_sunder', name: 'Gök Yaran', desc: 'Göğü yaran tek bir kesik.', mp: 0, cooldown: 40, kind: 'aoe', power: 10, radius: 6, element: 'wind', weapon: 'sword', physical: true },
  // Yıldırım Büyüsü
  { id: 'static_bolt', name: 'Statik Ok', desc: 'Hızlı, zincirlenen küçük yıldırım.', mp: 0, cooldown: 2, kind: 'projectile', power: 2, element: 'lightning', range: 6, spell: true },
  { id: 'thunder_strike', name: 'Gök Gürültüsü', desc: 'Hedef bölgeye yıldırım düşürür.', mp: 0, cooldown: 10, kind: 'aoe', power: 14, radius: 2.5, element: 'lightning', spell: true },
  { id: 'lightning_step', name: 'Yıldırım Adımı', desc: 'Kısa mesafe ışınlanma.', mp: 0, cooldown: 6, kind: 'dash', power: 0, range: 3, element: 'lightning', spell: true },
  { id: 'heaven_judgement', name: 'Göğün Hükmü', desc: 'Göğün öfkesi.', mp: 0, cooldown: 60, kind: 'aoe', power: 80, radius: 7, element: 'lightning', spell: true },
  // Demir Beden (fiziksel)
  { id: 'iron_skin', name: 'Demir Deri', desc: '6 sn aldığın hasarı yarıya indirir.', mp: 0, cooldown: 20, kind: 'buff', power: 0.5, duration: 6 },
];

export const TECHNIQUES: Record<string, TechniqueDef> = Object.fromEntries(techniques.map((t) => [t.id, t]));

/** 0.9.0'da kaldırılan teknikler (kayıt göçü: takılıysa slot boşalır). */
export const REMOVED_TECHNIQUES = ['double_shot', 'flame_spray', 'flame_wall'];

