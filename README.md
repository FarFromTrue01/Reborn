# Reborn in Elonth

Tarayıcıda çalışan 2D aksiyon RPG. Önceki dünyasında ölen **Joseph**, her canlının Level 0 ve sıfır statla doğduğu **Elonth**'ta yeniden doğar. Elinde yırtık bir şort, Appraisal (G-) ve kimsenin göremediği bir trait vardır: **Divine Paladin (X)**.

Bu sürüm (0.10.0) iki bölümdür. **Bölüm I — *Köksüz*:** prologdan lonca kaydına; Bertram'ın hanında iki günlük iş (her akşam *Servis Koşturmacası*), Yaşlı Haldor'un hasadı ve bir gümüşlük lonca kaydı. **Bölüm II — *G- Rütbe*:** Bertram'ın çatlak sopası, lonca panosu ve üç G görevi, yaralı Vera ile Lina, ilk ortak F görevi (otlağı basan fare sürüsü) ve G rütbesi, kâhyanın çalınan kesesi, değirmen bodrumu, on gümüşlük şehir giriş kartı ve Eros şehrinin manzarası. Ardından **Brindlewood**'da pano ilanları ve yan görevlerle serbestçe oynamaya devam edebilirsin.

**Oyna:** https://farfromtrue01.github.io/Reborn/

## Kurulum (tablet / telefon)

1. Chrome'da oyunun adresini aç.
2. Menü → **Ana ekrana ekle** (veya "Uygulamayı yükle").
3. Ana ekrandaki **Elonth** simgesinden aç: yatay çalışır, **Devam** ya da **Yeni Oyun**'a basınca tam ekrana geçer; çevrimdışı da açılır.

Kurulumda yalnızca açılış için gerekenler (sayfa, oyun paketi, yazı tipleri, simgeler; ~4 MB) indirilir; karakter ve bina görselleri ilk açılışta önbelleğe girer. Yeni sürüm yayınlandığında oyun `version.json` üzerinden bunu fark eder, yeni dosyaları arka planda indirir ve **oyun dışındayken** (başlık ekranında) kendini bir kez yeniler; oyun ortasında yenilemez.

Başka bir uygulamaya geçince oyun durur, ses susar ve otomatik kaydedilir. Tarayıcı arka planda grafik bağlamını bırakırsa ya da sekmeyi kapatırsa, geri dönünce kısa bir "Oyun yeniden yükleniyor…" perdesinden sonra son kayıttan devam edilir.

## Kontroller

| Eylem | Dokunmatik | Klavye / Fare |
| --- | --- | --- |
| Yürü | Sanal joystick: sabit modda (dokunmatikte varsayılan) yalnızca sol alttaki daire, serbest modda ekranın sol yarısı | WASD / ok tuşları |
| Koş (dayanıklılık harcar) | Joystick'i kenara kadar it | Shift |
| Saldırı | **Saldır** | J veya sol tık (tıklanan yöne) |
| Ağır saldırı (0.11.0: **basılı tut**, halka 0,5 sn'de dolar, dolunca bırak; dolmadan bırakmak boşa gider, Kaçış iptal eder) | **Ağır** (basılı tut) | K (basılı tut) |
| Kaçış (yuvarlanma) | **Kaçış** | Boşluk veya sağ tık |
| Etkileşim (konuş, gir, topla, uyu) | **Etkileşim** (menzilde bir şey varsa parlar: Konuş mavi, diğerleri yeşil) | E / Enter |
| Hızlı yemek | Kaçış'ın solundaki yemek butonu | F |
| Appraisal | Bir NPC'ye, canavara ya da **Joseph'e** dokun, veya büyüteç butonu (en yakın hedef). Panel açıkken zaman durur; kapatmak için ekrana dokun | Q, NPC'ye tıklama |
| Görev takibi | HUD'daki **Görevler** kutusunda bir göreve dokun (yön oku onu gösterir); kutunun başlığına dokun: aç/kapat. Kutu **Ana Görevler** ve **Yan Görevler** (pano dahil) diye ikiye ayrılır; hangisinin görüneceği Menü → Görevler'deki iki anahtarla seçilir | Menü → Görevler |
| Tam ekran harita | Sağ üstteki mini haritaya dokun | M |
| Yetenek | Sağdaki küçük buton: yalnızca Status → Skills'te **takılı** yetenek (0.9.0: 1 slot) | 1 |
| Divine skill'ler | Altın butonlar (awakening sonrası) | Z / X / C |
| Menü | ☰ | Esc / Tab, Harita: M |
| Gizlice yürü | — | Ctrl |
| Konuşmayı ilerlet | Ekrana dokun | Boşluk / Enter / E |

İpuçları:
- Düşmanlar saldırmadan önce **kırmızı parlar ve önlerinde bir uyarı alanı çizilir**. 0.11.0: alanın yönü hazırlık başında kilitlenir ve hasar alanı **tam olarak** kırmızı alandır — yürüyerek dışına çıkarsan vurulmazsın. Tam vuruş anında kaçarsan **Mükemmel Kaçış**: zaman yavaşlar, kaçışın dayanıklılığı (Işık Adımı'nda ışığı) geri gelir ve 0,6 sn'lik **karşı saldırı** penceresi açılır: içindeki ilk vuruş kesin kritik ve sendeletir (Kaçınma A-: 1,0 sn, ×1,3).
- Vurmak artık hazırlığı **kesmez**. Her vuruş düşmanın **sendeleme barını** (can barının altındaki sarı çizgi) doldurur: normal 1, ritmin 3. vuruşu 2, dolu ağır saldırı 3, karşı saldırı 3. Bar dolunca düşman 1,2 sn **sersemler** (başında yıldızlar): saldıramaz, yürümez, %50 fazla hasar alır. Sersemletmek Işık barına +10 verir (normal vuruş +3).
- **Ritim:** saldırı üç vuruşluk bir zincirdir (hızlı, hızlı, yavaş ve güçlü). Sonraki basış savuruşun yarısından sonra sayılır; tuşa durmadan basmak zinciri hızlandırmaz. 3. vuruştan sonra kısa bir toparlanma (yalnızca kaçış).
- **Saldırı sırası:** aynı hedefe aynı anda yalnızca bir düşman (ormanın derinliklerinde iki) saldırır; sırasını bekleyenler çevrende dolaşır. Düşmanlar kovalarken eskisinden yavaş (×0,75).
- Seni fark etmemiş bir düşmana arkadan vurmak ×1.5 (**Gizli Saldırı**). Başlarındaki **?** göstergesi dolarsa seni fark ederler.
- Level 0 Joseph için bir fare bile tehlikelidir (Joseph 10 HP, fare 1,5 HP; sekiz ısırık Joseph'i yere serer). Bu kasıtlıdır — fare yumrukla üç, Bertram'ın çatlak sopasıyla iki vuruşta ölür (0.10.0: yaratık HP'leri ×1,5).
- Orman tavşanı kaçar; onu ~8 sn boyunca 3 karo içinde kovalarsan köşeye sıkışır ve tekmeyle karşılık verir. Uzaklaşınca yine ürker.
- Ölünce son uyuduğun yatakta (yoksa ormanda uyandığın yerde) doğarsın; paranın %10'u ve o gün kazandığın EXP kaybolur.
- Köydeki antrenman alanında (odun kesme kütüğü, taş, koşu parkuru) günde 3 kez Divine EXP kazanabilirsin (0.11.0: seans başına 4–10, performansa göre; seans yalnızca başarıda sayılır). Mini oyunlar spamlanamaz: savuruştan sonra 0,4 sn yeni basış yok, ıska süreden 1 sn düşer, hedefe ulaşamazsan "Tekrar dene" (antrenmanda "Bırak" da).
- Ağaç tepeleri ve çatıların arkasına geçen sen ya da bir canavar olunca o dekor yarı saydam olur.
- Yemekler bekleme süresine tabidir: her yemekten sonra 10 sn, art arda 3. yemekten sonra 60 sn. Son yemekten 60 sn geçince zincir sıfırlanır.
- **Koşu ücretsiz (0.10.0):** koşmak dayanıklılık harcamaz, nefes nefese kilidi yok. Dayanıklılık kaçış ve ağır vuruş içindir.
- **Tokluk (0.10.0):** 0–100; uyanıkken saatte −4, uyurken −2. 30'un altında *Aç* (dayanıklılık yenilenmesi −%50), 10'un altında *Çok aç* (HP yenilenmesi durur, en yüksek dayanıklılık −%25). Açlık öldürmez. Her yiyecek Tokluk verir (Elma 10, Ekmek 20, Ballı Çörek 25, Köy Peyniri 25, Kuru Et 30, Sıcak Güveç 40, Etli Börek 50); 95 ve üstünde "Tokum." (yenmez). Yeni oyun 40 ile başlar; Bertram'ın vardiya günlerinde öğle (+30) ve akşam güveci (+40) bedava; Haldor hasattan sonra bir ekmek verir; elma ağaçları her gün yeniden meyve verir. HUD'da dayanıklılığın altında Tokluk barı; hızlı yeme düğmesi ihtiyaca en uygun yiyeceği seçer.
- **Yardımlı savaş** (0.11.0: her zaman açık): saldırı tuşu menzildeki en yakın düşmana döner ve vurur (arkandaki dahil); hedefin altında bir işaret belirir.
- **Silah animasyonları (0.7.0):** her silah elde görünür ve kendine göre sallanır/saplanır/gerilir. Hasar, silahın düşmana değdiği **darbe karesinde** işler (kesme mekaniği de o anda). Ağır vuruş silaha göre: kılıç ve sopa geriye çekip hızlı ve geniş savurur (öne adım + savurma izi), hançer hızla saplar, mızrak uzun hazırlanıp öne atılır, yay daha uzun gerilip güçlü bırakılır (geri tepme). Hazırlanma sırasında **Kaçış** vuruşu iptal eder.
- **Silahı sırta koyma:** savaş dışında 6 sn saldırmazsan Joseph silahını sırtına (hançeri beline) koyar; düşman fark edince ya da saldırı tuşuna basınca çeker. Sırttayken saldırırsan çekme ~0,17 sn sürer ve saldırı hemen arkasından gelir. Hikâye sahnelerinde ve diyalogda silah hep sırttadır; köyün güvenli bölgelerinde ve iç mekânda ilk saldırıda çekilir, kısa süre sonra yine sırta konur.
- Konuşurken, Appraisal/menü/dükkân açıkken ya da toplarken Joseph durur; joystick basılı kaldıysa iş bitince yürüme kaldığı yerden sürer.
- Ayarlar (kaydırılabilir; Görüntü · Ses · Oynanış · Kontroller bölümleri, geliştirici modunda + Geliştirici; başlık ekranında "Kapat" sabit): arayüz boyutu, metin hızı, sesler, **hareket hızı** ("Hareket hızı (max = X)": Joseph'in doğal yürüme hızının %40'ı ile %100'ü arasında, −/+ 0,1 ya da sayı girerek; varsayılan Max — ayar Joseph'i hiçbir zaman hızlandırmaz; ayar sürümü 4), otomatik ilerleme, FPS göstergesi, **FPS sınırı** (60 / 120 / 144 / Sınırsız; varsayılan 60 — yüksek değer daha akıcı ama pili hızlı tüketir), **grafik kalitesi** (çözünürlüğü de belirler: Yüksek en fazla 2x, Orta 1,5x, Düşük 1x cihaz pikseli; ayrıca ışık geçişi, orman sisi ve parçacıklar; menü kapanınca uygulanır), joystick modu (dokunmatikte varsayılan: sol altta sabit), **tam ekran** (iPhone'da: "Tam ekran için oyunu ana ekrana ekle"). 0.11.0: yardımlı savaş, ekran sarsıntısı/vuruş donması ve silahı sırta koyma ayarları kalktı, hep açık (ayar sürümü 5).
- Menü ve Appraisal paneli açıkken oyun zamanı durur (müzik sürer). Mini oyunlar ve konuşmalar eski davranışını korur.
- **Geliştirici modu:** başlık ekranında sürüm numarasına 7 kez dokun. Menüde *Geliştirici* sekmesi açılır (Level/stat/HP/MP/para, skill rütbesi ve EXP, saat/gün, ışınlanma, görev ilerletme, Lonca Puanı); NPC'lerin başında Saygınlık değerleri görünür. 0.11.0: hikâye kontrol noktaları, görev hedefine ışınlan, ölümsüzlük, tek vuruş, yaratık doğur, bölgeyi yeniden doğur, hata ayıklama katmanı (saldırı alanları, sendeleme, sıra hakları), saat ×4/durdur, skill ve eşya ekle, Divine ±, SP +1, Sistem Teklifi, Ansiklopedi aç/sıfırla, aranabilir bayrak görüntüleyici, kaydı JSON olarak kopyala/yükle, hata kaydı (ekranın üstünde kırmızı sayaç). Ayarlar'dan kapatılır. Normal oyuncu hiçbirini görmez.
- **Kayıt yuvaları (0.11.0):** 3 yuva; oyun otomatik olarak oynanan yuvaya kaydeder. Başlıkta *Devam* son yuvayı açar, *Yeni Oyun* yuva seçtirir (dolu yuvada onay), *Yükle* istenen yuvayı açar. Eski kayıtlar ilk açılışta yuvalara taşınır (otomatik → Yuva 1, elle 1–2 → Yuva 2–3, elle 3 → "Eski kayıt").

## Sistemler (özet)

- **Statlar (0.10.0: beş stat):** STR, VIT, AGI, INT, LUK (DEX AGI'ye, MNA INT'e katıldı). Max HP = (10 + 8×Level) × (1 + 0,08×VIT), bir ondalık; Max MP = Level + 3×INT; dayanıklılık = 50 + 5×VIT + 3×AGI. Her level +4 stat puanı, +1 SP. NPC'lerde stat toplamı = 4 × Level. Sayılar tek yerde (`STAT_RULES`, `src/core/formulas.ts`) ve Status'taki ipuçları onları birebir gösterir.

  | Stat | Etki (puan başına) |
  | --- | --- |
  | STR | Fiziksel hasar +%8 |
  | VIT | Max HP +%8, dayanıklılık +5, durum etkisi süresi −%2 (en çok −%40) |
  | AGI | Hareket hızı +%1 (en çok %50), saldırı hızı +%1,5 (en çok %60), kritik +%0,4 (en çok %20), dayanıklılık +3, dayanıklılık yenilenmesi +%1, kaçış bedeli −%1 ve kusursuz kaçış penceresi +%1 (en çok %30); yay hasarı AGI'den |
  | INT | +3 MP, MP yenilenmesi +%3, büyü gücü +%6, büyü alanı +%3, skill EXP'si +%1,5 (en çok %50) |
  | LUK | Kritik +%0,6 (en çok %10), şans eseri ıskalatma +%0,5 (en çok %10), drop +%6, çift toplama +%1 (en çok %20); şans eseri olaylarda "Şans!" yazar |

  Kritik toplamı en çok %60.
- **Hasar:** Silah × (1 + 0,08×STR) × skill × trait (Divine Güç) × kritik ×2 × zayıf nokta ×1,5; savunma DEF / (DEF + 20 + 5×saldırgan Level), en çok %80. Yumruk [1,1]; silah aralıkları rütbeye göre G 2–4 · F 4–10 · E 10–20 · D 20–40 · C 40–80 · B 80–150 · A 150–300 · S 300–600 · X 600–1200. "En az 1 hasar" yok: **10'un altı bir ondalık** (0,5 · 1,0 · 3,7), **10 ve üstü tam sayı** (14 · 27 · 103), en düşük 0,1. HP havuzları ondalık taşır; hasar sayıları, HP barları, HUD ve Appraisal aynı biçimi kullanır (`fmtHp`, `src/ui/format.ts`).
- **Yaratıklar (0.10.0: HP ×1,5, level başına tablo):** Fare / Ahır Faresi / Orman Tavşanı 1,5 HP (G−), Sümüksü 3–4,5 (G−), Tarla Faresi 3 (G), Dev Fare 4,5 (G), Yaban Kurdu 9–13,5 (G+), Goblin 7,5–10,5 (G+), Goblin Şamanı 6 (F−), Goblin Şefi 22,5 (F+, boss). Yaratıklar 12 oyun saatinde yeniden doğar (Goblin Şefi dahil). Tavşan hızı 2,8; yaratıkların saldırı sıklığı ×0,75. Kimse son canında kaçmaz. Drop oranları yalnızca Appraisal rütben yaratığın rütbesine eşit ya da üstündeyse görünür. Tablo `tests/balance.test.ts`.
- **Rütbeler:** G → F → E → D → C → B → A → S → X (skill ve lonca rütbelerinde alt kademeler: G-, G, G+ …).
- **Appraisal:** Gördüğün bilgi, senin ve hedefin Appraisal harfleri arasındaki farka bağlı. Trait'ler hiçbir rütbede görünmez. Panel iki sütunlu ve kaydırmasız: solda portre (NPC/Joseph için `ensurePortrait`, yaratıkta sprite sayfasının kameraya bakan karesi: `monsterPortraitFrame`, gerekirse yaratık başına `portraitFrame`), Level, Lonca rütbesi, HP/MP; sağda kimlik kutucukları (Irk, Cinsiyet, Yaş, Title), 7 stat ve 11 slotun tamamı (boş slot kesik çizgili "—"); altta skill etiketleri. Gizli bilgi kutucuğu kaldırmaz, "???" yazar. Envanter Appraisal ile okunmaz. **Saygınlık yalnızca kendi kartında** (toplam + her eşyanın katkısı, +0 dahil); başkasına bakınca bölüm hiç çizilmez. **Yaratıklar:** koyu kırmızı zemin, sağ üstte rütbe (G−/G/G+), stat/lonca/ekipman yok, yerine drop tablosu (oranlar Appraisal rütben yaratığınkine eşit ya da üstündeyse, değilse "???"). Skill EXP'si hedef başına günde bir kez ve son EXP'den en az 10 sn sonra gelir (panel istediğin kadar açılır; panel beklemesi 1,5 sn).
- **Skill'ler (0.9.0):** Kullanarak (yavaş) ve zor başarılarla (ani) gelişir; her skill G-'den X-'e. Nadirlikler: Sıradan (gri), Nadir (mavi), Epik (mor), Efsanevi (altın); Appraisal doğuştan. Tablolar her harfin "-" kademesinde; ara kademeler (G, G+) sayısal pasiflerde bir sonraki taşa doğru üçte bir ilerler; teknik gücü alt kademe başına +%5. Alt kademe başına EXP: G 15 · F 40 · E 100 · D 250 · C 600 · B 1.500 · A 4.000 · S 10.000 · X 25.000. Yeni skill **yalnızca Sistem Teklifi** ile (0.10.0; öğretmen, kitap ve gizli keşif kalktı): 1 SP Basic / 2 SP Medium / 3 SP High chance; kart sayısı = SP, her kart nadirliğini ayrı çeker, boş kartın SP'si iade; **haftada en fazla 1** (teklif açmak hakkı kullanır). Aktif yetenekler MP harcar (nadirlik tabanı 3/5/8/12 × açıldığı harfin çarpanı, büyüler ×2) ve yalnızca **takılıysa** kullanılır (Status → Skills, savaş dışında; 2. slot yakında). Durum etkileri: yanma, yavaşlatma, dondurma, sendeleme, felç, korku, kışkırtma.
- **Divine Paladin:** Ayrı level/EXP (L → L+1: 500×(L+1)). Katsayı `0.5 × 1.20^L × 1.32^⌊L/3⌋` (L0 0,50 · L1 0,60 · L2 0,72 · L3 1,14 · L6 2,60 · L9 5,93 · L12 13,53; 3'ün katlarında eski `1.15^L × 1.5^⌊L/3⌋` ile aynı yere varır). Güç ve Öğrenme ham katsayı; Hız ve Dayanıklılık en az 1; Adaptasyon en az 0,75, en çok 5. L3'ten itibaren beşi aynı eğride. Her 3 levelde awakening ve Divine skill seçimi (Işık barı ile kullanılır).
  - *Öldürme EXP'si:* oran(d) × 500×(L+1) × 0,5^(L/5); d = yaratık leveli − Joseph'in **normal** leveli, L = **divine** level. Oran: d ≤ −3 %0 · −2 %0,3 · −1 %0,8 · 0 %2 · +1 %4 · +2 %8 · +3 %15 · ≥ +4 %25. Boss ×3, seri bonusu +%10/zafer (en çok +%50; 30 sn öldürmesiz, güvenli bölgede, ölünce ve uyuyunca sıfırlanır), en az 1. Eş seviye avla level atlamak L0'da 50, L5'te 100, L10'da 197 öldürme.
  - *Antrenman:* noktaya özgü sabit EXP (`TRAINING_SPOTS`, `src/data/props.ts`); köy alanı 12–25/seans, günde 3 seans. Tek başına L1 ≈ 8–9 gün, L2 → L3 adımı ≈ 25 gün.
- **Ekonomi:** Bronz → Gümüş → Platin → Altın → Elmas (her biri ×100), her biri kendi simgesiyle gösterilir. Her alım/satım/ödül bir işlemdir: doğrulanır, eksiksiz uygulanır, kaydedilir; yetmezse hiçbir şey değişmez. Her işlemden sonra cüzdan normalize edilir: 100 bronz 1 gümüşe, 100 gümüş 1 platine çevrilir (`normalizeWallet`).
- **Köy fiyatları:** Ekmek 4, Elma 3, Sıcak Güveç 12, Bez Sargı 15, Küçük HP İksiri 60, Küçük MP İksiri 90, Panzehir 45, Brindlewood Haritası 60 bronz; silah ve zırhlar ~×2.5 (0.1.0'a göre). Han yatağı 40, şifacının yara sarması 15 bronz. Skill kitapları ve dersleri 0.10.0'da kalktı (eski kayıtlarda kitaplar ödenen fiyatla iade edilir). Satış (0.8.0): her eşyanın satış aralığı taban değerinin ×0,8–×1,5'i; teklif aralıkta dükkânın uzmanlığı (yarı) ve esnafla yakınlık (yarı) ile kayar. Dükkân yalnızca kendi uzmanlık alanındaki eşyayı alır (satış sekmesinde teklif ve aralık görünür); canavar drop tablosunda tür ve tahmini aralık yazar. Al-sat ile para kasılamaz. Bkz. `src/data/economy.ts`, `src/data/items.ts`, `src/data/shops.ts`.
- **Hikâye işleri (tek seferlik):** Bertram'ın hanı 2 vardiya (günde en fazla 1, 06:00–15:00 arası başlar), ödeme 2. günün sonunda 50 bronz; vardiya günlerinin yemeği bedava. Serviste yanlış yiyeceği **Çöp**e atabilirsin; ilk gün daha sabırlı müşteri. Her akşam **Servis Koşturmacası**: masalarda bira/güveç/ekmek siparişleri, süre bitmeden tezgâhtan alıp götür, kirli tabakları topla ve bulaşığa bırak; her gün daha çok masa ve daha sabırsız müşteri. Sonuç yalnızca Bertram'ın yorumunu değiştirir. Ardından Yaşlı Haldor'un hasadı: 50 bronz. İkisi bir gümüş = lonca kaydı.
- **Görevler (C2):** Veriyle tanımlı ana görevler, yan görevler ve pano görevleri (`src/data/quests.ts`, `src/data/sidequests.ts`). Amaç türleri: konuş, git, topla, öldür, teslim et (+ hikâyeye özel). Ödüller: para, eşya, Lonca Puanı; yan ve pano görevleri az EXP (2–6), **ana görevler EXP vermez** — EXP'nin asıl yolu canavar avı (0.10.0: görev EXP'leri ×2). Görev bitince ödüller animasyonla gösterilir (para sayarak, EXP barı dolarak, eşyalar ve puan sırayla; dokununca atlanır). Yeni ana görev otomatik takip edilir; HUD'daki *Görevler* kutusu ve Menü → *Görevler* sekmesi (açıklama, amaçlar, ödül, rütbe, puan, risk). Yön oku takip edilen hedefi gösterir (iç mekândan dışarıdaki hedefe: çıkış). **Her amacın yönlendirmesi var (0.6.0):** NPC hedefli amaçlar kişinin kendisini gösterir (program gün içinde değişir; `src/world/reach.ts`), kişiye şu an ulaşılamıyorsa (gizli, kapalı bina) ok kaybolur ve görev metni bir sonraki saati söyler ("Haldor 14:00'te tarlada olur — o saate kadar bekle"); öldürme amaçları yaratığın en yakın doğma bölgesini, toplama amaçları eşyanın en yakın kaynağını gösterir; kapalı bina "Lonca 05:00'te açılır". **Ana görev güvencesi (0.6.0):** bölüm bitene kadar her an en az bir aktif ana görev var; bekleme gereken geçişlerde (silahtan sonra pano, yaralılardan sonraki gece, ilk kadehin ertesi günü, keseden sonraki gün) oyuncuya ne yapacağını söyleyen bir adım görevi açılır (`src/story/mainline.ts`). Ara sahnede sessiz biten görevlerin bitiş animasyonu sahne bitince sırayla oynar. Joseph G olana kadar her şey ana görevdir; G'den sonra yan görevler (10 elle yazılmış) ve isteğe bağlı pano ilanları açılır.
- **Lonca Puanı (C3):** G görevi 10, F 30 puan (her harfte belirgin artar). Grup görevlerinde herkes puanın %50'sini alır. Eşikler: G 40, G+ 100, F- 180 (ve en az Level 1). G, F ve E harflerinin içindeki terfiler sınavsızdır; E-'den itibaren harf atlamak sınav ister (sınav henüz oyunda yok). Joseph kendi harfinin ve bir üstünün görevini alabilir. **Terfi (0.5.0):** puan eşiği (ve Level şartı) sağlanınca "Terfi" görevi açılır ("Celeste ile rütben hakkında konuş"); Celeste'yle konuşunca terfi **o anda** işlenir ve ekranda rütbe atlama animasyonu oynar (eski rozet yenisine dönüşür, ışık patlaması, büyük harf). Bekleme yok. Status → Lonca Kartı'nda bir sonraki rütbeye ilerleme barı ve hedef rozet. **Başarısızlık/bırakma:** görevin puanı kadar puan ve ödülünün iki katı para cezası; para yetmezse loncaya borç yazılır ve sonraki ödüllerden düşülür. Risk görev alınırken gösterilir. Puan 0'ın altına düşerse kart alınır; yeniden kayıt 1 gümüş, G-'den ve 0 puandan.
- **Pano (E7):** Lonca 05:00–24:00 açık. Her sabah 15 şablondan 3–4 ilan (en az ikisi G). G 15–40, F 60–90 bronz. Aynı anda en fazla üç pano görevi; üç gün içinde teslim edilmeyen ilan başarısız sayılır. **0.10.0:** görevde ve HUD'da kalan süre ("2 gün kaldı", "Son gün!"), son gün sabahı ve akşamı uyarı, ceza görev alınırken yazar.
- **Saygınlık (C1):** Bir stat değil; kuşanılan eşyaların `saygınlık` değerlerinin toplamı (boş gövde/bacak eksi). Status'ta ve envanterde görünür; eşya ayrıntısında, dükkânda ve Status/Ekipman kutucuklarında her eşyanın katkısı yazar (0 ise "+0", eksi "−2"). NPC'lerin de Saygınlık'ı var (konum/itibar + kıyafet); kendi Saygınlık'ı yüksek olan daha az etkilenir. Karşılaştırma tonu değiştirir: küçümseme / nötr / saygı. Kast ortadan kalkmaz. Appraisal'da yalnızca kendi kartında görünür; NPC değerleri yalnızca geliştirici modunda.
- **Eşya rütbeleri:** Her kuşanılabilir eşya ve malzeme bir harf taşır (alt kademesiz: `N`, `N−` değil), loncadaki rozetle aynı simge; envanterde, dükkânda, eşya ayrıntısında ve Appraisal'da görünür. İksir, yemek ve görev eşyalarında yok.
- **Yoldaşlar (C4):** Vera (kılıç) ve Lina (yay) ortak görevlerde Joseph'i kapılardan ve haritalardan geçerek izler, yolunu kesmez, uzak kalınca ya da takılınca yanına ışınlanır. Takip hız eşleştirmeli ve histerezisli (0,8 karoda durur, 1,6 karoda yeniden yürür; koşu animasyonu da eşikli; `src/world/follow.ts`). Kendi başlarına dövüşürler: Vera yanaşır ve yandan sarar, Lina mesafe koruyup geri çekilerek atar. Dost ateşi yok. Yere düşen yoldaş ölmez, savaş bitince kalkar. HP çubukları HUD'da Görevler kutusunun altında. **Joseph yalnızca kendi vurduğu düşmandan EXP alır.** **0.8.0:** yoldaşlar yardım eder, işi yapmaz — hasarları ×0,15, vuruşlar arası 2,2–2,8 sn, her vuruştan önce 0,4 sn görünür hazırlanma (parlama), Joseph'in o an vurduğu düşmanı bitirmekten kaçınırlar.
- **Giriş kartı (C8):** Şehre giriş için rütbe gerekmez: 10 gümüş, 3 ay (84 oyun günü). Kaptan Roderick satar. Envanterde *Giriş Kartları* sekmesinde şehir başına kalan gün; süre dolmadan yenisi alınırsa arka arkaya eklenir.
- **Uyku (C9):** Her "Uyu" yeniden doğma noktasını ayarlar, kaydeder ve bildirir. Gerçek uyku yalnızca 20:00'den sonra ya da 8 saat uyanık kaldıktan sonra; yoksa "Uykum yok" (yine de kayıt). Bir görev bir saati bekliyorsa menüde **"Görev saatine kadar uyu (14:00)"** da çıkar; bu seçenek saat kuralına takılmaz, tam o saatte uyandırır (0.6.0). **0.10.0:** bekleme gereken ana görevlerde ok yatağa (merdivene) yönelir ve alt görev "Yukarı çık ve uyu" yazar; Haldor'u beklerken isteğe bağlı bir öğretici amaç bu seçeneği tanıtır.
- **Ansiklopedi (0.10.0):** Menü → Ansiklopedi: Yaratıklar · Karakterler · Bitkiler, bölge sayfaları (Brindlewood ve Çevresi, Eros). Yaratık Appraisal ile, kişi konuşunca, bitki toplayınca açılır; bilinmeyen kayıt karartılmış siluet ve "???".
- **Harita işaretleri (0.10.0):** Haritada ve mini haritada keşfedilmiş toplama noktaları, yaratık bölgeleri (tükenmişse soluk ve dönüş saati) ve takip edilen görevin hedefi; filtre ve lejant.
- **Otomatik kayıt (C7):** Savaşta, ara sahnede, diyalogda, menüde ve mini oyunda değilken her 3 dakikada bir; köşede küçük bir "Kaydedildi" simgesi. Olay kayıtları da sürer.
- **Yan görevler (0.6.0):** Görev veren yalnızca kendi iş yerindeyken (dükkânında ve saatinde; dükkânı olmayanlar sabit bir görev yerinde: tüccar konağın önünde, Oswin değirmende, Pip meydanda, Nim hanın önünde ya da arka köşede) görev verir, teslim alır ve görevden bahseder; başka yerde kendine özgü kısa bir yönlendirme söyler (`src/story/sideposts.ts`). Görev verebilecek durumdaki kişinin başında salınan mavi "!" (teslime hazırsa "?"), mini haritada ve tam haritada parlayan mavi nokta ve yayılan halkalar; kişi bir binadaysa dünyada binanın üstünde işaret ve haritalarda bina parlar.
- **Dükkânlar:** Alışveriş, satış ve dersler yalnızca esnaf kendi dükkânında ve çalışma saatindeyken açılır (Gunnar'ın Demirhanesi, Marta'nın Genel Dükkânı, Ilse Nine'nin Şifa Evi, Brunhild'in Fırını, Terzi Mirelle, Gorm'un Tabakhanesi, Garrick'in Avcı Kulübesi, Bertram'ın hanı).
- **Kast:** Soylular → yüksek rütbeli maceracılar → tüccar ve zanaatkârlar → köylüler → köksüzler. Joseph en alttadır. NPC'ler kasta göre konuşur; köylüler soylu kâhyanın önünde eğilir, yüksek rütbeli maceracılara yol verir; handa şöminenin önündeki masalar üst kastlara ayrılır, köksüzler arkada oturur; oturma yerleri rezervasyonlu (dolu ise aynı türden boş yer, yoksa başkalarından en az 1,5 karo uzakta ayakta; `src/world/seats.ts`); dükkânda üst kasttan biri gelirse sıra ona geçer.
- **Zaman:** 1 oyun günü ≈ 24 gerçek dakika. Gece-gündüz, dükkân saatleri, NPC günlük programları.
- **Kayıt:** Otomatik (uyurken, bölge değişince, işlemlerden sonra, 3 dakikada bir) + 3 elle kayıt yuvası. Sürüm numaralı, göç destekli (0.10.0: kayıt sürümü 9).
- **EXP gösterimi:** En fazla bir ondalık, virgülle ve kesilerek (3,3555 → 3,3); tam sayılar ondalıksız. Her yerde aynı (`src/ui/format.ts`).

## Ekonomi hesabı (Bölüm II)

On gümüşlük giriş kartına (1.000 bronz) giden yol kasıtlı olarak uzun tutuldu:

| Kaynak | Bronz |
| --- | --- |
| Kayıttan sonra cepte kalan | ~12 |
| G görevleri: Fareler 20 + Ot 20 (Celeste 10 "kayıt masrafı" keser) + Mektup 30 | 70 |
| Şifacı (Vera ve Lina) | −30 |
| Otlaktaki fareler (120 / 3) + kese (kâhyanın attığı) + bodrum (90 / 3) | 40 + 5 + 30 |
| Yemek (güveç 12 + ekmek 4, günde ~16) | günde −16 |
| **On Gümüş başlarken** | **~100** |
| 10 yan görev (bir kerelik) | 330 |
| Pano: günde iki G ilanı (ortalama ~25) − yemek | günde ~+34 |
| Pano: F ilanları (60–90) | daha hızlı ama başarısızlıkta −30 puan ve ödülün iki katı ceza |

Sadece G ilanlarıyla: (1.000 − 100 − 330) / 34 ≈ **17 oyun günü (~2,5 hafta)**; F ilanları ve av drop'larıyla ~10 gün. Hesap `tests/chapter2.test.ts` içinde de duruyor (10–28 gün aralığı).

## Performans (A3)

Ölçüm: `node tools/qa/shot.mjs perf` (başsız Chromium, SwiftShader yazılım GPU, 1280×854, DPR 1). Mutlak FPS gerçek tabletten çok düşüktür; önce/sonra kıyası içindir.

| Sahne | 0.2.0 FPS | 0.3.0 FPS | CPU kare süresi 0.2.0 → 0.3.0 | Çizilen nesne 0.2.0 → 0.3.0 |
| --- | --- | --- | --- | --- |
| Köy meydanı | 5,5 | 5,3 | 15,3 → 11,6 ms | 3.931 → 393 |
| Orman | 4,2 | 4,4 | 16,5 → 13,1 ms | 3.938 → 750 |
| Han (iç mekân) | 4,1 | 3,6 | 9,1 → 7,7 ms | 59 → 60 |
| Han + menü açık | 2,9 | 4,7 | 28,1 → 32,3 ms | Dünya ve HUD gizli/duraklatılmış |

Başsız tarayıcıda FPS'i yazılım GPU'nun ekran doldurma hızı sınırlıyor; asıl kazanç çizilen nesne sayısında (köyde ~10 kat az) ve CPU kare süresinde. Menüde CPU süresinin biraz artması Status sekmesinin yeni içeriğinden (Lonca Kartı, simgeler): bir sekmenin baştan çizilmesi 49 → 89 ms sürüyor, ama bu yalnızca sekme değişince olur; envanterde seçim değişince yalnızca ayrıntı paneli yeniden çizilir.

Yapılanlar: 256 px'lik parçalarla ekran dışı ayıklama (dekor, ağaç, çatı; yalnızca kameranın çevresindeki parçalar çizilir), menü opak olduğu için menü açıkken Dünya ve HUD sahnelerinin duraklatılıp gizlenmesi, envanterde seçim değişince yalnızca değişen kısmın yeniden çizilmesi, gereksiz bulanık yazı gölgesinin (bölge başlığı) kaldırılması.

### 0.3.1 ölçümü

**DPR 1, 1280×854** (önce = 0.3.0, sonra = 0.3.1):

| Sahne | FPS önce → sonra | NPC güncelleme ms/kare | Metin dokusu yeniden çizimi /kare |
| --- | --- | --- | --- |
| Köy meydanı (25 NPC) | 8,9 → 9,7 | 0,19 → 0,06 | 0,1 → 0,2 |
| Açık dünya (orman) | 6,8 → 6,7 | 0,07 → 0,04 | 0,2 → 0,1 |
| Han (gündüz) | 6,3 → 5,7 | — | — |
| Han, akşam 18→19→20 | **dondu** (sonsuz döngü) → 6,4 | — → 0,09 | — |
| Köy meydanı, geliştirici modu | 8,5 → 9,1 | **1,66 → 0,08** | **25,1 → 0,1** |
| Açık dünya, geliştirici modu | 6,8 → 6,8 | **1,82 → 0,02** | **25,2 → 0,2** |
| Han, geliştirici modu | 4,0 → 6,2 | — | — |

Saat başı NPC girişi: eskiden tek karede herkes + A*; şimdi `refreshNpcPresence` 0,1 ms (yalnızca sıraya koyar), karede ≤1 giriş ve ≤1 yol araması.

**DPR 3, köy meydanı** (çizim çözünürlüğü, 5c):

| Kalite | 0.3.0 canvas / FPS | 0.3.1 canvas / FPS |
| --- | --- | --- |
| Yüksek | 3840×2562 (9,8 MP) / 1,4 | 2560×1708 (4,4 MP) / 3,1 |
| Orta | aynı (9,8 MP) / 1,4 | 1920×1281 (2,5 MP) / 4,3 |
| Düşük | aynı (9,8 MP) / 1,4 | 1280×854 (1,1 MP) / 8,9 |

Başsız tarayıcıda FPS'i yazılım GPU'nun doldurma hızı sınırlıyor; DPR 1 FPS farkları gürültü düzeyinde. Asıl kazançlar kare başına iş (geliştirici modunda NPC maliyeti ~20–90 kat az, doku yüklemesi 25 → ~0), akşam hanındaki donmanın kalkması ve yüksek dpr'li ekranlarda piksel sayısı. dpr 2'lik bir tablette Yüksek kalite eskisiyle aynı çözünürlükte kalır; Orta/Düşük artık gerçekten fark yaratır.

## Kararlar

Belirsiz kalan yerlerde verilen kararlar (her biri bir satır):

- Köy: dünya 169×120 karo; köy bölgesi 0.2.0'ın ~%60'ı, bina sayısı aynı (32), yerleşim elle çizildi; nehir, köprü, orman kenarı, tarlalar, mera ve gölet aynı yönlerde kaldı.
- Şehir yolu kısaldı: meydandan kontrol noktasına ~65 karo (0.2.0: ~115).
- A1: Nefes nefese kilidi joystick eşiğin altına inince/bırakılınca ya da Shift bırakılınca açılır; 0.4.0'dan beri dayanıklılık %100 dolunca da açılır (istek sürüyorsa Joseph yeniden koşar).
- A2: Kamera 18×12 px ölü bölgeyle izler, kaydırma tamsayı ofsetle ve sprite'lar dünya pikseline hizalanarak çizilir; `roundPixels` açık kaldı (kapatınca karo dikişleri görünüyordu); fizik adımı ekran yenilemesine bağlı (`fixedStep` kapalı). QA'da yavaş yürüyüşte yön değiştirme (titreme) sayısı 0 ölçüldü.
- A3: "Bake" yerine parça ayıklama seçildi; yanan çalılar ve saydamlaşan ağaçlar gibi dinamik dekor bozulmasın diye.
- A5: Çiçek, çakıl, saman tutamı, kütük parçası gibi küçük dekorun üstünden yürünür (`WALK_OVER`); diğer dekorun çarpışma kutusu görselin tabanına oturur.
- A6: Ağaçlarda yalnızca gövde çarpışır; orman ağaçlarının ~%30'u rastgele seyreltildi (`GAP_P = 0.3`); NPC yol bulma ızgarası karo tabanlı kaldı.
- A7: Yol karolarının hiçbiri dekorla kapanmaz; tek kasıtlı engel kontrol noktasındaki bariyer. Test: `tests/collision.test.ts`.
- A8: Konuşulan NPC işini ve animasyonunu bırakır, Joseph'e döner; konuşma bitince programına kaldığı yerden döner.
- A9: Pip ve Benno "dağınık" (messed) saç, Lotte "yandan ayrılmış kâkül"; üretim betiği çocuk gövdesine yalnızca çocuk gövdesini destekleyen katman takılmasına izin verir.
- D3: Joseph: kısa dağınık siyah saç (bedhead), siyah gözler (LPC'de siyah göz yok: kahverengi iris kömür siyahına boyandı), ten "taupe" (esmer ile kumral arası, esmerden biraz açık).
- B7: Renkli simgeler Twemoji (CC-BY 4.0) — CREDITS.md'de atıf; rütbe rozetleri betikle çizildi (G ahşap/demir, F–E bronz, D–C gümüş, B altın, A–S altın ve taş, X parlayan efsanevi).
- B1: Appraisal paneli dokununca kapanır, otomatik kapanma kaldırıldı; kendine Appraisal EXP vermez.
- B2: Ayarlar sürüm 2: kullanıcı joystick modunu hiç seçmediyse dokunmatikte bir kerelik "sabit" yapılır; seçtiyse dokunulmaz.
- C1: NPC Saygınlığı = 4 × itibar (1–5) + kıyafet; nötr çizgi NPC Saygınlığının yarısı − 2; etkilenme 1 / (1 + NPC/8).
- C3: "G, F, E içinde sınavsız; E-'den itibaren sınav": F+ → E- terfisi sınavlı sayıldı; sınav henüz oyunda yok, Joseph F+'da durur.
- C3: Kart alınınca borç silinmez; yeniden kayıtta da sürer.
- C4: Yoldaş hasarı NPC statlarından gelir; vuruş aralıkları Joseph'inkinden yavaş (1,15–1,9 sn) ki savaşın yükü Joseph'te kalsın.
- C5: Yardımlı savaş menzil + 1,2 karo içindeki en yakın düşmanı seçer.
- C7: Otomatik kayıt 3 dakikada bir; harita geçişi ve olay kayıtları da sürer.
- C8: Şehrin adı **Eros** — Elonth ülkesinin şehirlerinden biri, başkent değil (0.6.0; kayıttaki kart anahtarı `capital` uyumluluk için korunuyor). Köyün soylusu Baron Merrow, kâhyası Edric Fenwick. 3 ay = 84 oyun günü.
- C9: "8 saat uyanık" en son uyanılan andan sayılır.
- D2: NPC'lerin günlük planı gün numarasından seçilir; handaki akşam kalabalığı her gün değişir; esnaf çalışma saatinde dükkânından çıkmaz.
- D4: Servis Koşturmacası 42 saniye, tepsi 2; masa sayısı 4/5/6, sabır 15/12,5/10,5 sn.
- E2: Yol vermemenin cezası Saygınlığa göre: +4 ve üstü ceza yok, +1–3 üç bronz, daha azı beş bronz.
- E3: Harcama kilidi alışverişi engeller; lonca cezası ve şifacı ödemesi gibi zorunlu ödemeler geçer.
- E5: Gerçek hırsız Çamaşırcı Wynn (AGI 7, DEX 5; Appraisal ile statları görülür). Yanlış suçlama 5 bronz ceza; tekrar denenebilir.
- E6: İkinci ortak F görevi yeni bir iç mekân: değirmen bodrumu, dev fareler.
- 0.5.0: Appraisal'da kendi kartında boş gövde/bacak slotunda saygınlık cezası da yazar (−4, −6); toplamın neden eksi olduğu görünsün.
- 0.5.0: Terfi görevi ana görev kategorisinde (`m_rankup_<kademe>`, dinamik). Otlak görevinin teslimi Celeste'nin yanında olduğu için terfi aynı konuşmada işlenir. Puan konuşmadan önce eşiğin altına düşerse görev bırakılır. Kayıt sürümü 6: eski `guild.pending` Terfi görevine dönüşür.
- 0.5.0: Görev bitiş animasyonu sessiz (`silent`) tamamlanan hikâye geçişlerinde oynamaz (ör. "Hana Git", ara sahnelerin ortasındakiler); "G- Rütbe" artık sessiz değil. Kutlama sahneleri sistem bildirimleriyle aynı kuyrukta sırayla oynar. **0.6.0:** sessiz bitişler ertelenir, sahne bitince sırayla oynar; terfi görevi ve bekleme adımları hiç oynatmaz (`quiet`).
- 0.5.0: Yan görev EXP'si en fazla "aynı süre fare avının üçte biri" (testte 3 dakika × fare EXP hızı); Kurt Dişleri 8 → 6.
- 0.5.0: Ayarlar simgeleri için atlasa 🔊 ve 🎮 eklendi; mevcut kareler ve rütbe rozetleri yeniden üretilmedi (piksel piksel aynı).
- E7: Aynı anda en fazla üç pano görevi; ilan üç gün içinde teslim edilmezse başarısız sayılır.
- E8: Şehir manzarası kodla çizildi (sur, kalabalık, kale silueti); şehir kapısı "Şehir bölümü yakında" der; kart süresi işlemeye devam eder.
- 0.2.0 kayıtları: Bertram işinin ortasındaki kayıtlar yeni 3 günlük işe taşınır (yapılmış vardiya en fazla 2 sayılır, son vardiya ödemeyle biter); lonca kaydı yapılmışsa Bölüm II "Eli Boş Maceracı" ile başlar ve pano ertesi sabah açılır; bitiş kartı bayrağı silinir.
- 0.6.0: "Pano yarın açılır" beklemesi kalktı: sopa → "Pano" ana görevi (Loncaya dön, panodan görev al) → loncaya girince pano açılışı aynı gün. Celeste kayıtta "silahsız maceracıya ilan vermem" der.
- 0.6.0: Bekleme adımları ayrı ana görevlerdir (`m_board`, `m_vl_rest`, `m_next_day`, `m_vl_cellar`, nadiren `m_gpoints`): zincirin asıl görevi açılınca sessizce kapanır. Güvence zinciri sondan başa okur; eski kayıtlarda eksik halka ilk yarım saniyede açılır.
- 0.6.0: İlk Kadeh iki adımlı: akşam hana gelince Vera yer gösterir, Vera'nın masasındaki "Otur" etkileşimiyle sahne sürer. Kayıt sürümü 7 (ilerleme dizileri yeni amaç sayısına eşitlenir, kayıttaki pano ilanlarına yönlendirme eklenir).
- 0.6.0: Kâhyanın kesesinde şüphelilerin başında sarı "?" (Appraisal yapılınca kalkar), ok sıradaki (en yakın) şüpheliyi gösterir; suçlamada muhafız yol bularak şüpheliye yürür, Joseph onu kendiliğinden izler (kontroller kapalı, kamera takipte).
- 0.6.0: Yaralılar görevi sürerken şifa evi saatten bağımsız açık ve Ilse Nine içeride. Konuşan karakter sahnede değilse ara sahne onu Joseph'in yanına getirir (sahne bitince programına döner); pano açılışında Vera ve Lina kapıdan girer.
- 0.6.0: Tüccar Aurelio'nun temel programı sabahları (09–11) konağın önünde (yan görevin yeri). Dorn F+.
- 0.6.0: Şifalı ot: her toplama noktasının bire bir görseli var (`prop.gather`), işaretli bölgede (orman kenarı, yarıçap 6) sabit 9 ot; toplanan ot o gün soluk, harita her yüklendiğinde ve yeni günde yeniden uygulanır. Şifa evindeki dekor ot saksıya döndü.
- 0.4.0: Divine Paladin dengesi değişti: Hız/Dayanıklılık tabanı 1, Adaptasyon tabanı 0,75 (L0 Joseph artık yarım hızda yürümüyor, iki kat hasar almıyor); Güç ve Öğrenme ham katsayı.
- 0.4.0: "L3 ≈ 25 gün" L2 → L3 adımı (1500 EXP) olarak okundu; köy antrenmanıyla L0'dan L3'e toplam ~50 gün.
- 0.4.0: Ondalık gösterim tek kural: 10 altı her zaman bir ondalık ("5,0 / 5,0" dahil), 10 ve üstü tam sayı. MP ve EXP kendi biçiminde kaldı (yalnızca HP ve hasar istendi).
- 0.4.0: Divine serisi oyun zamanıyla sayılır: menü/Appraisal açıkken 30 sn sayacı durur.
- 0.4.0: `f_wolves` görev kimliği kayıt uyumluluğu için kaldı; düşman 5 Tarla Faresi. Tarla Faresi şimdilik yalnızca bu görevde doğar (dünyaya yerleştirmek Grup 4 içeriği).
- 0.4.0: Goblin level aralığı 0–2 → 1–2 (tablodaki değerler). Yaratık rütbesi Appraisal direnci olarak da kullanılır (Dev Fare G+ → G, Kurt/Goblin G → G+, Şaman G+ → F−, Şef F− → F+).
- 0.4.0: Drop oranları Appraisal panelinde tek satır olarak gösterilir (LUK çarpanı dahil); panelin yaratıklara özel tasarımı Grup 3'te.
- 0.4.0: Mükemmel kaçışta iade bir kez yapılır (aynı kaçışta birden çok düşman savuşturulsa da); dash'te Işık Adımı'nın ışık bedeli iade edilir.
- 0.4.0: Haldor'un bozdurma sahnesi korundu: cüzdan zaten normalize olduğu için sahne toplam paraya (≥100 bronz) bakar.
- QA: `?qa=1` adresinde Phaser kare süresi kırpması kapalıdır (başsız tarayıcıda 5 FPS altındaki kareler 16 ms sayılıyor, oyun zamanı sürünüyordu). Oyuncu sürümünü etkilemez.
- 0.3.1: FPS sınırının varsayılanı 60 (önceden ekranın yenileme hızıydı; 120 Hz tablette pil ve ısı için). `?qa` modunda sınır yok.
- 0.3.1: WebGL bağlamı kaybolunca Phaser'ın yerinde onarımı yerine kayıt + tek yenileme + otomatik devam (dinamik dokular onarımdan sonra boş kalabiliyor). 30 sn içinde ikinci kayıpta otomatik yenilenmez, oyuncu dokunarak yeniler.
- 0.3.1: Yeni sürüm oyun ortasında uygulanmaz; başlık ekranına dönünce (ya da uygulama yeniden açılınca) uygulanır.
- 0.3.1: Menüdeki sekme, Status bölümü ve envanter kategorisi menü kapanıp açılınca bilerek hatırlanır; diğer tüm sahne alanları her açılışta sıfırlanır.
- 0.3.1: Görüş alanının dışındaki NPC'ler rastgele dolaşmaz (görünmez), program ve devriye sürer.

## Kendi görsellerini ekleme

- Portreler: `assets/art/portraits/<karakter>_<ifade>.png` — ifadeler: `normal`, `gulen`, `kizgin`, `saskin`, `uzgun`, `alayci`. Karakterler: `joseph`, `bertram`, `vera`, `lina`, `celeste` ve `src/data/npcs.ts` içindeki `portrait` kimlikleri.
- Sahne görselleri: `assets/art/cg/<sahne>.png` — `title`, `void`, `forest_wake`, `village_view`.
- Sesler: `assets/audio/car_crash.(ogg|mp3|wav)` eklenirse prologdaki araba kazası sesi olarak çalınır; yoksa WebAudio ile üretilir.
- Dosya yoksa oyun LPC sprite'ından üretilmiş piksel portreyi veya kodla çizilmiş sahneyi kullanır. Dosyayı ekleyip pushlaman yeter; GitHub Actions yeniden build eder.

## Geliştirme

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # formül, ekonomi, skill, Divine, Appraisal, kayıt, yemek, kapı, köy/NPC, çarpışma, görev/lonca ve Bölüm II testleri
npm run typecheck
npm run build      # dist/
```

QA ekran görüntüleri (önce `npm run build && npx vite preview --port 4173`):

```bash
DPR=2.5 node tools/qa/shot.mjs v3ui      # HUD, Appraisal paneli, diyalog isim satırı, Status, envanter, görevler, harita, ayarlar, geliştirici paneli
DPR=2.5 node tools/qa/shot.mjs v3comp    # yoldaşlar: izleme, savaş, yere düşme, harita geçişi
DPR=2.5 node tools/qa/shot.mjs v3serve   # Servis Koşturmacası (1. ve 3. gün)
DPR=2.5 node tools/qa/shot.mjs v3world   # yeni köy, orman, kamera titremesi ölçümü, konuşan NPC
URL='http://localhost:4173/?qa=1' node tools/qa/shot.mjs v3ch2   # Bölüm II uçtan uca
node tools/qa/shot.mjs perf              # FPS, çizilen nesne, kare başına iş (DEV=1: geliştirici modu açık)
node tools/qa/shot.mjs g1flow            # Ana Menüye Dön → Devam (HUD), yeniden boyutlanma → Ayarlar, tek dokunuşta açılış
URL='http://localhost:4173/?qa=1' node tools/qa/shot.mjs g3   # Appraisal (NPC/kendi/yaratık), HUD görev kategorileri, görev bitiş ve terfi animasyonu, Ayarlar (ONLY=appr,quest,rank,settings)
node tools/qa/shot.mjs g1leak            # iç mekân turu (doku sızıntısı) ve WebGL bağlam kaybı → yenileme → devam
node tools/qa/shot.mjs g1pwa             # SW: ilk kurulumda yenileme yok, önbellek, çevrimdışı açılış
URL='http://localhost:4173/?qa=1' DPR=1 OUT=screens/g4b node tools/qa/shot.mjs g4b && python3 tools/qa/g4b_sheets.py
                                         # silahlar: 4 yön yürüme (elde/sırtta), saldırı darbe/hazırlanma kareleri, sırta koyma/çekme,
                                         # pelerinle sırt, konuşurken idle, zamanlamalar (ONLY=walk,cape,attack,sheath,behavior,talk) → tools/qa/g4b/
URL='http://localhost:4173/?qa=1' DPR=1 node tools/qa/shot.mjs g4bperf   # meydanda silah + pelerinle FPS, saldırı sırasında FPS
```

### `window.__qa` (betik API'si, 0.11.0)

`?qa=1` adresiyle ya da geliştirici modunda açılır. Başsız tarayıcı betikleri oyunun iç alanlarına dokunmadan bunları kullanır (örnek: `tools/qa/steps_g7.mjs`).

| Çağrı | Ne yapar |
| --- | --- |
| `await __qa.checkpoint(ad)` | Hikâye kontrol noktasını yeni bir oyundan kurar (görevler, bayraklar, envanter, para, lonca, konum), World ve UI sahnelerini yeniden başlatır; hazır olunca `true`. Adlar: `awake`, `bertram_done`, `harvest_done`, `registered`, `vl_friends`, `celebrate`, `theft_done`, `gate` |
| `__qa.checkpoints()` | `{ id, name }` listesi |
| `__qa.teleport(harita, x, y, yön?)` | Haritaya ve kareye ışınlar (`'world'`, `'inn'`, `'guild'` …) |
| `__qa.spawn(yaratık, x?, y?, adet?)` | Yaratık doğurur (varsayılan: Joseph'in 3 kare sağı); `uid` listesi döner |
| `__qa.respawn()` | Bölgedeki bütün yaratıkları yeniden doğurur |
| `__qa.god(açık = true)` | Ölümsüzlük (alınan hasar gri sayı olarak görünür, uygulanmaz) |
| `__qa.oneHit(açık = true)` | Tek vuruşta öldürme |
| `__qa.debug(açık = true)` | Hata ayıklama katmanı: saldırı alanları, sendeleme barları, saldırı sırası hakları |
| `__qa.setTime(gün, dakika)` | Oyun saatini ayarlar (dakika: günün dakikası, ör. 600 = 10:00) |
| `__qa.clock(çarpan, durdur?)` | Oyun saatinin hızı (ör. 4) ve durdurma |
| `__qa.state()` | Özet: harita, kare, saat, level, HP, para, lonca, Divine, Tokluk, grup, açık görevler ve amaçları, sahne, düşmanlar (durum, HP, sendeleme), hata sayısı |
| `__qa.errors()` / `__qa.errorsText()` | Hata kaydı (yakalanmamış hatalar ve sahne hataları; yığın iziyle) |
| `__qa.exportSave()` | Aktif durum JSON olarak |
| `__qa.importSave(json, yuva?)` | JSON'u bir yuvaya yazar (varsayılan: oynanan yuva); ardından o yuvayı yükle |

```bash
npm run build && npx vite preview --port 4173 &
URL='http://localhost:4173/?qa=1' DPR=1 OUT=tools/qa/g7 node tools/qa/shot.mjs g7   # Grup 7 uçtan uca (ONLY=d,cp,combat,b,c)
```

Görseller önceden üretilmiş olarak depodadır (`assets/gfx`). Yeniden üretmek için:

```bash
tools/fetch_sources.sh                                   # LPC kaynaklarını indirir (tools/.cache)
python3 tools/lpc_chars.py tools/.cache/lpc-repo         # karakter sprite sheet'leri
python3 tools/build_terrain.py && python3 tools/build_props.py && python3 tools/build_buildings.py
python3 tools/build_weapons.py tools/.cache/lpc-repo     # silahlar: sopa, kılıçlar, satır, saldırı ve taşıma katmanları (lpc_chars'tan sonra)
python3 tools/build_monsters.py && python3 tools/build_icons.py && python3 tools/build_credits.py
```

### Yapı

```
src/core/      Saf oyun kuralları (formüller, para, işlemler, skill, Divine, Appraisal, kayıt, zaman) — testli
src/data/      Veri: eşyalar, canavarlar, skill'ler, NPC'ler (stat blokları, program, replikler), dükkânlar, title'lar
src/world/     Harita üretimi, iç mekânlar, çizim, aktörler, oyuncu, düşman YZ, NPC, ışık, efektler
src/scenes/    Boot, Başlık, Prolog, Dünya, Arayüz, Menü, Mini oyun, Emeği Geçenler
src/story/     Hikâye yönetmeni (Bölüm I: director.ts, Bölüm II: chapter2.ts)
src/ui/        Arayüz bileşenleri, dükkân, paneller, portreler
src/audio/     WebAudio: efektler, prosedürel müzik, konuşma "dıt" sesleri
tools/         Görsel üretim hattı (Python) ve QA ekran görüntüsü betikleri
assets/        Üretilmiş görseller, yazı tipleri, lisanslar, kullanıcı görselleri (art/)
```

Yeni içerik eklemek için genellikle sadece `src/data/` altındaki dosyaya bir kayıt eklemek yeterlidir (ör. yeni eşya `items.ts`, yeni canavar `monsters.ts` + `worldgen.ts` içinde bir spawn).

Yeni bina eklerken: `tools/build_buildings.py` içinde tarif, `src/data/manifest.ts` içinde `BUILDINGS`, `worldgen.ts` içinde `place(...)` ve gerekiyorsa `interiors.ts` içinde oda. `tests/doors.test.ts` dünya haritasını ve tüm iç mekânları tarar: her kapının görünür bir görseli olmalı, yönüne uygun duvarda durmalı ve önündeki kare yürünebilir olmalı. `tests/world.test.ts` her NPC'nin program hedeflerinin var olan, yürünebilir kareler olduğunu doğrular.

## Varsayılan dal

Oyun yalnızca `main` dalından yayınlanır (GitHub Actions → `github-pages` ortamı → Pages). Eski `claude/vigilant-darwin-hcoqh5` dalı artık workflow'u tetiklemez; o daldan yapılan eski dağıtım denemeleri ortam koruma kuralına takıldığı için ("Branch … is not allowed to deploy to github-pages") kırmızı görünür, siteyi etkilemez. Deponun varsayılan dalı hâlâ o eski dal ve bu oturumdaki araçlarla değiştirilemiyor. Değiştirmek için: GitHub'da depo → **Settings → General → Default branch** → ⇄ simgesi → `main` → **Update** → onayla. Sonra eski dalı silebilirsin.

## Sürüm notları

- **0.11.0** — Grup 7: dövüş sistemi, oyuncu notları ve hatalar (bkz. `PLAN.md`).
  - *Dövüş — hamle ve karşı hamle:* vurmak saldırıyı kesmez; kırmızı alanın yönü kilitlenir ve hasar alanı tam olarak kırmızı alan; sendeleme barı ve sersemleme (%50 fazla hasar); aynı hedefe sırayla saldırı, bekleyenler çevrede dolaşır; 3 vuruşluk ritim (spam hızlandırmaz); basılı tutulan ağır saldırı; kusursuz kaçıştan sonra 0,6 sn karşı saldırı (kesin kritik); kovalama ×0,75; Işık barı asıl kaçış ve sersemletmeyle dolar; yoldaşlar sersemlemiş düşmanı önceler; Vera'nın dersleri yeni sisteme göre.
  - *Hatalar:* takılı kalan bildirim, üst üste binen sistem bildirimleri (yeni tasarım: simgeli satırlar, içeriğe göre büyüyen koyu kutu), üst üste binen düşünce balonları (sıra, takip, zemin), sahne hatalarına koruma, Appraisal'da her fare ayrı hedef sayılıyordu, panoda "YARIN", lonca duvarı HUD'un altında, kart paneli.
  - *Oyuncu notları:* Bertram'ın ziyafeti ve loncaya kadar harcama kilidi; prolog ve uyanış kendiliğinden akar (atlanamaz); üç ayar kalktı; yeni pano, rütbe tahtası ve 9 ayrı rütbe rengi; terfi animasyonu atlanamaz; İlk Kadeh ve hırsızlık saat beklemez; Divine level'da altın ışık; yoldaşlarla kapılar ve görev bölgesi; Appraisal ve Divine EXP'si yavaşladı; mini oyunlar spamlanamaz; Sistem Teklifi öğreticisi ve yeni kartlar; Ansiklopedide yeni keşif işareti, rütbe rozetleri, Appraisal anlık kaydı, sayaçlar; trait satırı yalnızca görülebiliyorsa; rütbenin altındaki görevler az puan verir, yeni rütbe eşikleri; ganimet ışıldar ve kaybolmadan önce yanıp söner.
  - *Kayıt yuvaları:* 3 yuva, her biri kendi otomatik kaydıyla; Yeni Oyun yuva seçtirir.
  - *Geliştirme:* kontrol noktaları, dövüş araçları, hata kaydı ve `window.__qa` betik API'si. Kayıtlar otomatik taşınır (kayıt sürümü 10; eski kayıtlar yuvalara kopyalanır, hiçbiri silinmez).
- **0.10.0** — Grup 6: hatalar, denge, yeni sistemler (bkz. `PLAN.md`).
  - *Başlangıç:* Prologda trait çarkı (olasılık tablosu, Divine Paladin %0,0001); ilk adımda tökezleme ve Divine uyanışı; trait metinleri (Bertram, lonca taşı, Celeste, Ilse Nine, iç sesler).
  - *Yönlendirme:* Haritalar arası ok her zaman bir geçişi gösterir; beklemelerde ok yatağa ve "Yukarı çık ve uyu"; görev saatine kadar uyku öğreticisi; isteğe bağlı amaçlar; pano anlatımı; alt görevin hedefi; en yakın toplanmamış ot; yaratık kalmayınca dönüş saati. Bütün ana görev geçişleri günün her saatinde denetlendi (`tests/chainTimes.test.ts`).
  - *Denge:* Beş stat (level başına 4 puan, HP tabanı 10, VIT yüzdeli), NPC statları 4 × level, yaratık HP ×1,5, görev EXP ×2, saldırı sıklığı ×0,75, tavşan 2,8, ormanda açıklıklar, yeniden doğma 12 saat, koşu ücretsiz.
  - *Yeni:* Tokluk, Ansiklopedi, harita işaretleri, pano süre uyarıları, Bertram'ın işi 2 gün ve serviste çöp kutusu; skill yalnızca Sistem Teklifi ile.
  - *Dövüş hissi:* vuruş donması, havuzlu hasar sayıları (kritik büyük sarı, direnilen gri, alınan kırmızı), yerinde sarsılma, malzemeye göre ses ve parçacık, saldırı öncesi geri çekilme, vurulunca kenar kızarması, düşük canda kalp atışı ve vinyet. Titreşim yok.
  - *Hatalar:* Konuşmalar "Daha fazla göster" kaydırmadan sonra da çalışıyor, saat ilerletme tek yerde, Vera'nın arayüz dili, yatağa her yandan erişim, kamera HUD'un altında oyuncuyu saklamıyor, ipuçları ekranın altında. Kayıtlar otomatik taşınır (kayıt sürümü 9: statlar sıfırlanıp puanlar iade edilir, kitaplar parayla iade).

- **0.9.0** — Arayüz ve skill sistemi (Grup 5B, bkz. `PLAN.md`).
  - *Dükkân ve yan görevler:* Görev artık konuşmanın başında açılmıyor; seçeneklerde mavi ünlemle görevin adı, alışveriş görev aktifken de açık. Yan görev simgesi her yerde mavi ünlem; mini haritada dükkân simgeleri; ödül replikleri para simgeli.
  - *Menü:* Görevler düğmeleri kaydırmadan çalışıyor; Konuşmalar son 40 satırla hızlı açılıyor ("Daha fazla göster"); stat puanı verirken liste yerinde kalıyor; envanter ve dükkânda **Sırala**; satın alınca eşya çantaya uçuyor.
  - *Appraisal ve Status:* Prologdaki Status ekranı Appraisal kartı düzeninde ve gerçek değerlerle; slot simgeleri, rütbe renkli ve nadirlik çerçeveli skill satırları, skill EXP barı, statlarda renkli artılar (yeşil ekipman, sarı unvan, mor skill), ekipman savunması; görev bitişinde lonca puan barı.
  - *Skill sistemi:* Epik nadirlik ve iki yeni skill (Buz Büyüsü, Savaş Narası), bütün skill tabloları G-'den X-'e, yeni Sistem Teklifi, MP formülü ve yenilenmesi, yetenek slotu, durum etkileri; Karşı Saldırı gerçek savuşturma. Çift Ok, Alev Püskürtmesi ve Alev Duvarı kalktı. Kayıtlar otomatik taşınır (birikmiş skill EXP'si yeni eşiklere göre rütbe atlatır; ilk yetenek takılı gelir).
- **0.8.0** — Hatalar, dünya, denge ve silah görselleri (Grup 5A, bkz. `PLAN.md`).
  - *Düzeltmeler:* Sistem bildirimi kapanırken gelen yeni bildirim artık takılı kalmıyor; kapıdan hızlıca geçince "binaya git" amacı tamamlanıyor; karartma geçişleri her en-boy oranında tüm ekranı kaplıyor (sağda siyah şerit yok); sabit joystick modunda yalnızca daire joystick, sol tarafta da Appraisal yapılabiliyor.
  - *Dünya:* Elma ağacı başına 3 elma, ok elması kalan en yakın ağaca; köprüdeki ağaç kalktı; doğu kenarı boydan boya taş sur, yolun sura değdiği yerde kapı ve dört geçit şövalyesi; şifalı otlar daha büyük, yakındaki toplanabilirler parlıyor.
  - *Görevler ve NPC'ler:* Görev için gereken eşya yenmiyor ("Görev için lazım"); yan görev EXP'si ×2; Dorn ve muhafız yol bularak, önlerine bakıp yürüyerek ilerliyor; Varg F rütbesi; dükkânlarda beceri kitabı yok; yırtık şort kahverengi.
  - *Ekonomi:* Satış fiyatı aralıklı (×0,8–×1,5), teklif dükkânın uzmanlığı ve esnafla yakınlığa göre; satış sekmesinde teklif, drop tablosunda tür ve tahmini aralık. Savaş bitmeden ölünce o savaşta toplanan ganimet kaybedilir (ölüm ekranında yazar).
  - *Servis mini oyunu:* Günlük müşteri hedefi; geç kalan sipariş ya da vaktinde bulaşığa götürülmeyen kirli tabak anında kaybettirir, "Tekrar dene"; ücret yalnızca kazanınca. Mini oyunlarda tek müzik, sonra dünya müziği kaldığı yerden.
  - *Denge:* Joseph'in yürüme hızı ⅔ (taban hız aynı), koşu yürümenin ×1,6'sı; Hız ve Dayanıklılık tabanı 0,75; Ayarlar → Hareket hızı (max = X). Kaçış 7,5 dayanıklılık, 0,8 sn bekleme; Joseph'in vuruşu düşmanı geri itmiyor. Hasar sayıları okunaklı (ondalıklar ayırt ediliyor). Yoldaşlar yardım ediyor, işi yapmıyor. NPC statları 6 × level; geliştirici "+1 level" 6 puan verir. Tavşan biraz yavaş.
  - *Silah görselleri:* Kılıç kabzası geri çekişte elde; mızrak ve yay savaşta elde yürür; hançerin yukarı saplaması görünür; pala vurulunca kaybolmuyor; sırttaki silahlar sırta yakın, yüzün önünden geçmiyor; süzülen yay küçük ve elde; Çatlak Sopa'nın çatlağı belirgin.

- **0.7.0** — Silahlar ve animasyon (Grup 4B, bkz. `PLAN.md`). Güncelleme planı tamamlandı.
  - *Silah modelleri:* Sopalar artık ahşap (Çatlak Sopa açık renkli ve çatlak, Budaklı Sopa koyu ve budaklı); saldırıda sopa görünür biçimde iner. Paslı Kısa Kılıç ve Demir Kısa Kılıç gerçek kısa kılıç (paslı / çelik), Goblin Satırı mat demir bir pala. Hançer hançer olarak kaldı. Yeni silah görünümü eklemek yalnızca veri (`WEAPON_VISUALS`).
  - *Saldırılar:* Hasar darbe karesinde; normal ve ağır vuruş her silahta ayrı (hazırlanma, savurma izi, öne adım/atılma, yay çekiş efekti); hazırlanırken kaçışla iptal. Saldırı süresi formülü değişmedi.
  - *Sırta koyma:* 6 sn savaşsız kalınca silah sırta (hançer bele), savaşta ya da saldırıda çekilir; dört yönde, yürürken salınarak, pelerinin üstünde. Ayarlar → Oynanış → Silahı sırta koy.
  - *Düzeltmeler:* Konuşurken, Appraisal/menü/dükkânda Joseph yürüme pozunda kalmıyor; toplarken duruyor; etkileşimden sonra basılı joystick ile yürüme sürüyor.

- **0.6.0** — Görevler ve içerik (Grup 4A, bkz. `PLAN.md`).
  - *Ana görev:* Hiçbir an "aktif görev yok" değil; bekleme adımları, NPC'ye ulaşılabilirlik ve bekleme metni, "Görev saatine kadar uyu". Pano silahtan sonra aynı gün. İlk Kadeh'te masaya otur. Kâhyanın kesesinde şüpheli işaretleri ve muhafızı izleme.
  - *Yan görevler:* Yalnızca iş yerinde; mavi işaretler (baş, bina, mini harita, tam harita). Her amacın yönlendirmesi var (yaratık, eşya, NPC). Panodan en fazla 3 ilan; lonca 05–24.
  - *Dünya:* Şifalı ot düzeltmesi, handa oturma rezervasyonu, yoldaş takibi.
  - *Ad:* Şehir artık **Eros** (Elonth'un şehirlerinden biri); soylu aile Baron Merrow, kâhya Edric Fenwick. Eski şehir ve soylu adı oyundan tamamen kalktı.
  - *Grup 3'ten:* Appraisal kutucuklarında uzun metin küçülür/iki satır; kutlamalar gerçek zamanla; sessiz bitişler sahne sonunda; yaratık portresi kameraya bakar.
- **0.5.0** — Arayüz (Grup 3, bkz. `PLAN.md`).
  - *Appraisal:* İki sütunlu, kaydırmasız panel; portre (yaratıklarda sprite'tan, yüklenemezse baş harf), kutucuklar ve "???"; 11 slotluk ekipman ızgarası (boş slot kesik çizgili), rank rozetleri; saygınlık yalnızca kendi kartında; envanter bölümü kaldırıldı; skill etiketleri köşeli; sağ üst metin "direnç" yerine "Appraisal". Yaratıklar: koyu kırmızı zemin, rütbe, drop tablosu.
  - *Eşyalar:* Her ekipman ve malzemede rütbe rozeti (envanter, dükkân, ayrıntı, Appraisal); saygınlık katkısı her yerde, +0 dahil.
  - *Görevler:* HUD'da Ana / Yan görevler, Menü → Görevler'den gizlenebilir (kalıcı); görev bitiş animasyonu; ana görevler EXP vermez, yan/pano az verir.
  - *Lonca:* Lonca Kartı'nda ilerleme barı ve hedef rozet; terfi Terfi göreviyle Celeste'de anında, rütbe atlama animasyonuyla ("kayıtlar yarın işlenir" kalktı). Kayıt sürümü 6.
  - *Ayarlar:* Kaydırılabilir, bölümlere ayrılmış; Kapat düğmesi sabit.
- **0.4.0** — Denge ve dövüş (Grup 2, bkz. `PLAN.md`).
  - *Divine Paladin:* Yeni katsayı (level başına %20, awakening ×1,32); Hız ve Dayanıklılık 1'in, Adaptasyon 0,75'in altına inmiyor. Öldürme EXP'si level gereksiniminin yüzdesi, divine levelle azalıyor; antrenman noktası başına sabit EXP (köy 12–25). Seri bildirimi gerçek çarpanı gösteriyor ("seri ×1,4"), 30 sn öldürmesiz kalınca sıfırlanıyor.
  - *Hasar:* "En az 1" kalktı; 10 altı bir ondalık, üstü tam sayı; HP ondalık taşıyor, tüm göstergeler tek biçimde. Yumruk hariç silah hasarları ×2 (Çatlak Sopa 2).
  - *Yaratıklar:* Yeni HP tablosu (fare 1, Dev Fare 3, Şef 15), alt kademeli rütbeler ve drop görünürlüğü, yeni Tarla Faresi; kimse son canında kaçmıyor; kovalanan tavşan köşeye sıkışınca tekme atıyor. Otlak görevi artık fare sürüsü.
  - *Statlar:* Level başına 6 puan; STR +%8, VIT +8 HP, AGI +%1,5, DEX +%2, MNA +3 MP, INT +%6, LUK +%6/+%0,6.
  - *Dövüş:* Normal vuruş da hazırlıktaki saldırıyı kesiyor (1,2 sn bekleme, boss yalnızca ağır vuruşla); mükemmel kaçış bedava; joystick sonda kalırsa dayanıklılık dolunca koşu kendiliğinden sürüyor.
  - *Diğer:* Appraisal EXP'sine 10 sn genel bekleme; cüzdan her işlemden sonra bozduruluyor; kayıt sürümü 5.
- **0.3.1** — Çökme, bug ve altyapı (Grup 1, bkz. `PLAN.md`).
  - *Düzeltmeler:* Ana menüye dönüp Devam deyince HUD ve dokunmatik butonların kaybolması; tam ekrana girip çıkınca başlık ekranında Ayarlar'ın açılmaması; akşam hanında oyunun donup çökmesi (kenara çekilen NPC'nin harita dışı yol hedefi sonsuz döngüye sokuyordu); joystick'in altındaki NPC'nin Appraisal açması; başka uygulamaya geçip dönünce çökme; ana ekran uygulamasının bazen ilk dokunuşta açılmaması ve kurulumun yarıda kalması.
  - *Yenilikler:* Grafik kalitesi çözünürlüğü de belirliyor (Yüksek 2x, Orta 1,5x, Düşük 1x); FPS sınırı ayarı (60/120/144/Sınırsız); uygulamadan çıkınca otomatik kayıt ve dönüşte kaldığın yerden devam; NPC'ler hana teker teker giriyor.
  - *Performans:* Geliştirici modu etiketleri yalnızca yakındaki NPC'lerde ve değişince yenileniyor; uzaktaki NPC'ler hafif güncelleniyor; yol aramaları karede bire sınırlı.
  - *Altyapı:* GitHub Pages yalnızca `main`'den, `github-pages` ortamıyla; service worker kurulumda yalnızca 15 çekirdek dosya indiriyor.
- **0.3.0** — Büyük güncelleme.
  - *Bölüm II — G- Rütbe:* Bertram'ın çatlak sopası; aynı gün açılan pano ve üç G görevi (Ahırdaki Fareler — Dorn son kanıtı çalar; Şifacıya Ot — Celeste "kayıt masrafı" keser; Kontrol Noktasına Mektup); kâhyaya yol verme ve ceza; handa "dolu" masalar; Vera ve Lina'nın goblin ilanı. "Biraz hava": yaralı Vera ve Lina, ceza kuralları onların ağzından, Lina sırtta yavaş eşlik, şifacıya otuz bronz. Ertesi gün dostluk ve ilk ortak F görevi (Otlaktaki Kurtlar, Vera'nın savaş dersi), G rütbesi ertesi gün, handa ilk kadeh. Kâhyanın kesesi (Appraisal ile hırsız avı), değirmen bodrumundaki dev fareler, On Gümüş, Bertram'a veda, giriş kartı ve Eros şehrinin manzarası. 10 yan görev, her sabah değişen pano.
  - *Sistemler:* Veriyle tanımlı görev sistemi, Lonca Puanı (terfi, ceza, borç, kart kaybı, yeniden kayıt), Saygınlık, yeniden kullanılabilir yoldaş sistemi, yardımlı savaş, giriş kartları, uyku kuralı, otomatik kayıt, geliştirici modu.
  - *Arayüz:* Ayrı Level ve rütbe kutuları, katlanır Görevler kutusu ve yön oku, yoldaş can çubukları, kategorili Appraisal paneli (dokununca kapanır, zaman durur, kendine Appraisal), diyalogda unvan ve rütbe rozeti, okunur NPC isim etiketleri, Status'ta Saygınlık ve Lonca Kartı, envanterde Giriş Kartları, Görevler sekmesi, haritada simgeler, renkli simge atlası, G'den X'e rütbe rozetleri, tam ekran düğmesi, EXP gösterimi (bir ondalık, virgül).
  - *Dünya ve oynanış:* Köy %60'a küçüldü (bina sayısı aynı), piksel çarpışma kutuları, yolları kapatan dekor kaldırıldı, orman seyreldi, NPC'lerin günlük planları çeşitlendi; koşu kilidi, kamera titremesi düzeltmesi, menüde ve Appraisal'da zaman durur, konuşulan NPC işini bırakır; Bertram'ın işi 3 gün ve her akşam Servis Koşturmacası; çocukların saçı ve Joseph'in yeni görünüşü.
  - *Kayıt:* Kayıt sürümü 4; 0.2.0 kayıtları göç eder (görev günlüğü bayraklardan kurulur).

- **0.2.0** — Büyük güncelleme.
  - *Hikâye:* Prolog artık siyah ekranda bir araba kazası sesiyle ve "ÖLDÜN." ekranıyla açılıyor (ejderha sahnesi ve ekran sallanması kaldırıldı). Bertram'ın işi yeniden yazıldı: 4 vardiya, 4. günün sonunda 50 bronz ve kıyafet, ilk günün yemeği bedava, pazarlık yok. Dördüncü akşam Bertram dünyanın düzenini, rütbeleri ve kastları anlatıp seni Yaşlı Haldor'un hasadına yönlendiriyor. Haldor'un buğday tarlasında hasat mini oyunu (+50 bronz), ardından 1 gümüşle lonca kaydı. Soylu kâhyayla ilk karşılaşma sahnesi.
  - *Ekonomi:* Köy fiyatları yükseltildi (yiyecek/iksir ~×3, silah/zırh ×2.5, kitap ×2, ders ücretleri ×5); drop satış değerleri ve tüccar oranları sabit. Hizmetler yalnızca esnafın kendi dükkânında ve çalışma saatinde.
  - *Dünya:* Brindlewood iki katından büyük: Doğu Mahallesi (Çeşme Meydanı, fırın, terzi, tabakhane, tüccar konağı, muhtarın evi), Güney Çiftlikleri (çiftlikler, ahır, samanlık, mera, çamaşır göleti, Yaşlı Meşe buluşma yeri), Haldor'un çiftliği ve Garrick'in avcı kulübesi. Kontrol noktası köyün yeni doğu ucuna taşındı. 28 yeni NPC (toplam 51): her birinin stat bloğu, Appraisal'ı, günlük programı, kişiliği ve kasta göre replikleri var. Kast hiyerarşisi görünür hâlde: eğilen köylüler, yol açma, handa oturma düzeni, dükkânda sıra kesme, kasta göre kıyafetler.
  - *Arayüz:* Yeni HUD (EXP barı, sol üstte simgeli para, okunur saat/tarih/bölge), beş para birimi için ayrı piksel simgeler (HUD, dükkân, bildirimler, ödüller, envanter, seçenekler), kartlı Status ekranı (Status, Stats kaynaklarıyla, skill kartları, Divine Paladin çerçevesi, Title kartları, karakterin etrafında 11 ekipman kutucuğu), kategorili ve kaydırılabilir envanter, dükkânlarda sürükleyerek/tekerlekle kaydırma, parlayan ve renk değiştiren etkileşim butonu, Hızlı Yemek butonu (dairesel geri sayım), mini haritaya dokununca tam ekran harita.
  - *Kontroller:* Sabit joystick seçeneği, karakter hızı kaydırıcısı (0.75x–2.0x), dokunarak Appraisal, Appraisal bekleme süresi (~1.5 sn) ve panel açıkken yeni panel açılmaması.
  - *Düzeltmeler:* Ayarlar'daki 4 boş buton, ağaç tepeleri ve çatıların arkasında kaybolan karakterler (artık yarı saydam), ağaç gövdesine doğan canavarlar, "INN" tabelası ("HAN"), montajdaki para sayacının konuşma kutusuyla çakışması, prologdaki yarısı boş Status paneli, dikey duvardaki görünmeyen kapılar (kasa, eşik, işaret; tüm haritaları tarayan kapı testi), hanın kapısının önündeki fener ve bir evin kapısını kapatan odunluk.
  - *Kayıt:* Kayıt sürümü 3; eski kayıtlar otomatik göç eder (keşif haritası yeni boyuta taşınır).
- **0.1.0** — İlk sürüm. Prolog (ölüm, uzak savaş alanı, beyaz boşluk, Status'un oluşması), ormanda uyanış, Brindlewood köyü (han, lonca, demirci, dükkân, şifacı, antrenman alanı, tarlalar, değirmen, şehir yolu kontrol noktası), Vera & Lina sahnesi ve Appraisal öğreticisi, Bertram'la pazarlık, çalışma montajı, lonca kaydı. Gerçek zamanlı dövüş (uyarılı düşman saldırıları, mükemmel kaçış, gizli saldırı, hit-stop, hasar sayıları), 7 canavar türü + goblin kampı ve şefi, NPC günlük programları, kast tepkileri, gece-gündüz ve ışıklar, prosedürel müzik, karakter sesleri, PWA.

## Emeği Geçenler

Görsellerin büyük kısmı Liberated Pixel Cup (LPC) sanatçılarının eserleridir. Tüm yazarlar ve lisanslar için [CREDITS.md](CREDITS.md) dosyasına ve oyundaki **Emeği Geçenler** ekranına bak.
