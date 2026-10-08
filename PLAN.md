# Güncelleme planı — devam notu

Dört aşamalı plan — **tamamlandı (0.7.0)**. Her oturum yalnızca kendi grubunu yaptı ve bu dosyayı güncelledi.
0.7.0 sonrası plan iki yarı: **Grup 5A** (hatalar, dünya, denge, silah görselleri) — ✅ 0.8.0; **Grup 5B** (arayüz ve beceri sistemi) — ✅ 0.9.0. Ardından **Grup 6** (hatalar, oyuncu notları, denge ve yeni sistemler) — ✅ 0.10.0; **Grup 7** (yeni dövüş sistemi, hatalar, oyuncu notları, kayıt yuvaları, geliştirici modu) — ✅ 0.11.0.

| Grup | Kapsam | Durum |
| --- | --- | --- |
| **1. Çökme, bug, altyapı** | Pages dağıtımı, sahne sıfırlama, joystick önceliği, handa donma, performans, uygulama değişiminde çökme, PWA kurulumu | ✅ 0.3.1 |
| **2. Denge ve dövüş** | Düşman/Joseph sayıları, hasar ve EXP eğrileri, dövüş mekanikleri | ✅ 0.4.0 |
| **3. Arayüz** | Appraisal paneli (NPC/kendi/yaratık), eşya rütbeleri, saygınlık gösterimi, HUD görev kategorileri, Lonca Kartı barı, terfi görevi ve animasyonu, görev bitiş animasyonu, görev EXP kuralı, Ayarlar paneli | ✅ 0.5.0 |
| **4A. Görevler ve içerik** | Ana görev güvencesi, pano akışı, NPC hedefli amaçlar, şifalı ot, yaralılar, sahne karakterleri, kâhyanın kesesi, yan görev iş yerleri ve mavi işaretler, lonca/pano, görev saatine kadar uyku, han oturma yerleri, yoldaş takibi, Dorn, Eros ve soylu adı, Grup 3'ten kalan dört düzeltme | ✅ 0.6.0 |
| **4B. Animasyon ve silahlar** | Silah modelleri, saldırı animasyonları, kılıcı sırta koyma, konuşurken yürüme animasyonu | ✅ 0.7.0 |
| **5A. Hatalar, dünya, denge, silah görselleri** | Sistem bildirimi, kapı amacı, QA yoklaması; elmalar, görev eşyası, otlar, Dorn/muhafız yürüyüşü, Varg, dükkânlar, şort, doğu suru, mini oyun müziği ve servis hedefi, karartma, savaş ganimeti, satış aralığı, sabit joystick; hız, kaçış, hasar sayıları, yoldaşlar, NPC statları; silah kareleri | ✅ 0.8.0 |
| **5B. Arayüz ve beceri sistemi** | Kısım 1: dükkân/yan görev seçenekleri, mavi ünlem, mini harita, Görevler düğmeleri, Konuşmalar, lonca barı, prolog Status, Appraisal, renkli artılar, savunma, kaydırma, sıralama, satın alma animasyonu · Kısım 2: skill sistemi | ✅ 0.9.0 |
| **6. Hatalar, denge, yeni sistemler** | Kaydırma jesti, saat ilerletme, zincir saat denetimi, haritalar arası ok ve uyku yönlendirmesi, isteğe bağlı amaçlar; beş stat, yaratık HP ×1,5, görev EXP ×2, saldırı sıklığı, orman açıklıkları; Tokluk, Ansiklopedi, harita işaretleri, pano süre uyarıları, Bertram 2 gün ve çöp kutusu, skill yalnızca SP, ücretsiz koşu, dövüş geri bildirimi; trait çarkı, Divine uyanışı, trait metinleri | ✅ 0.10.0 |
| **7. Dövüş sistemi, oyuncu notları, hatalar** | Hamle ve karşı hamle (kırmızı alan = hasar alanı, sendeleme ve sersemleme, saldırı sırası, 3 vuruşluk ritim, basılı tutulan ağır saldırı, karşı saldırı); bildirim, balon, sahne koruması, Appraisal anahtarı, lonca kamerası, kart paneli; ziyafet ve harcama kilidi, kendiliğinden akan prolog, ayarlar, rütbe paleti, İlk Kadeh/hırsızlık saatleri, Divine ışığı, yoldaş bölgeleri, Appraisal/Divine EXP, mini oyunlar, Sistem Teklifi öğreticisi, Ansiklopedi, lonca puanı, ganimet ışığı; 3 kayıt yuvası; kontrol noktaları ve `window.__qa` | ✅ 0.11.0 |

## Grup 1'de yapılanlar (0.3.1)

- **Pages:** asıl hata eski `claude/vigilant-darwin-hcoqh5` dalının dağıtımlarıydı ("Branch … is not allowed to deploy to github-pages due to environment protection rules"). `deploy` job'ına `environment: github-pages` eklendi, tetikleyici yalnızca `main`. main'in dağıtımları artık ortam kaydı oluşturuyor (yeşil).
- **Sahne sıfırlama:** UI, Title, Menu, World, Minigame, Prologue sahnelerinde `resetState()` (create/init'in ilk satırı). `tests/sceneState.test.ts` başlangıç değeri olan her alanın orada sıfırlandığını TS sözdizimi ağacıyla denetler — **yeni alan ekleyen, resetState'e de eklemeli** (bilerek hatırlananlar testteki `KEEP` listesinde: Menu'nün sekmesi, bölümü, envanter kategorisi). Çıkış akışı `leaveGame()` (`src/game/sceneFlow.ts`).
- **Joystick:** `touchIntent()` (`src/game/touch.ts`): sabit taban > sol yarı > NPC dokunuşu.
- **Handa donma:** kök neden `yieldTo()` → harita dışı hedef → `findPath` geri izlemede sonsuz döngü. Düzeltildi; ayrıca `PathQueue` (karede bir A*), `ArrivalQueue` (kapıdan teker teker, 0,3–1 sn), iç mekân yol bütçesi (karo × 4).
- **Performans:** geliştirici etiketi (yakın, ≤4/sn, yalnızca değişince), uzak NPC hafif güncelleme (görüş + 6 karo dışı), kaliteye bağlı dpr tavanı (2 / 1,5 / 1), FPS sınırı ayarı (60/120/144/Sınırsız, varsayılan 60).
- **Uygulama değişimi:** `src/game/lifecycle.ts` — gizlenince durdur/sustur/kaydet; WebGL bağlamı kaybolunca kayıt + perde + bir kez yenileme + otomatik devam; atılmış sekmede de devam.
- **PWA:** çekirdek önbellek 147 → 15 dosya, 6 paralel; açılışta yüklenenler SW önbelleğine kopyalanır; ilk kurulumda yenileme yok, güncelleme oyun ortasında uygulanmaz; manifest `standalone`; başlık ekranı tam ekran geçişinde karartmayı kesmiyor (tek dokunuşta açılış).

### Ölçümler

Başsız Chromium + SwiftShader (yazılım GPU), 1280×854, DPR 1: mutlak FPS gerçek tabletten çok düşük, yalnızca önce/sonra kıyası. Komut: `node tools/qa/shot.mjs perf` (`DEV=1` geliştirici modu).

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

## Grup 2'de yapılanlar (0.4.0)

- **Divine Paladin** (`src/core/divine.ts`): katsayı `0.5 × 1.20^L × 1.32^⌊L/3⌋`; stat tabanları `DIVINE_STAT_FLOOR` (Hız/Dayanıklılık 1, Adaptasyon 0,75, tavan 5). Öldürme EXP'si `challengeRate(d) × divineExpToNext(L) × 0.5^(L/5)` (d normal levelle, azalma divine levelle), boss ×3, seri +%50'ye kadar, en az 1. Seri bildirimi gerçek çarpanı gösterir; 30 sn öldürmesiz kalınca sıfırlanır (`WorldScene.sinceKill`, oyun zamanı). Antrenman `TRAINING_SPOTS` (`src/data/props.ts`): köy 12–25/seans — yeni şehir = yeni satır.
- **Ondalıklı hasar:** `roundDamage` (10 altı bir ondalık, üstü tam, en az 0,1), `applyDamage` (HP'yi bir ondalığa sabitler; kayan nokta artığı yaşatmaz). Gösterim tek fonksiyon: `fmtHp` (`src/ui/format.ts`) — hasar sayıları, HUD, Status, Appraisal, geliştirici paneli, prolog.
- **Silahlar:** yumruk hariç ×2 (`WEAPON_DAMAGE_BY_RANK`, `items.ts`); Çatlak Sopa [2,2].
- **Yaratıklar** (`src/data/monsters.ts`): hedef HP tablosu (`tests/balance.test.ts` her yaratık/level için doğrular), `rank: 'G-'…` alanı (Appraisal direnci de bu), `fleeAt` kaldırıldı, yeni `field_rat`, tavşanda `cornered` (core/combat `corneredStep`). Drop oranları `dropsVisible` kuralıyla Appraisal panelinde tek satır.
- **f_wolves:** kimlik korundu, düşman 5 Tarla Faresi, başlık/açıklama/diyaloglar fare sürüsü.
- **Statlar:** level başına 6 puan; STR %8, VIT 8, AGI %1,5 (≤%60), DEX %2 (≤%70), MNA 3, INT %6, LUK %6/%0,6. Kayıt v5 göçü eski levellere +2 puan/level verir, cüzdanı normalize eder.
- **Dövüş** (`src/core/combat.ts`): `canInterrupt` (yalnızca windup; boss yalnızca ağır vuruş; 1,2 sn bekleme), `refundEvade` (mükemmel kaçışta stamina/ışık iadesi + staminaDelay 0). **Ek düzeltme:** geri tepme artık düşman YZ'sini durdurmuyor (yalnızca hızını eziyor); yoksa iptal beklemesine rağmen sık vurarak düşman hiç saldırtılmayabiliyordu.
- **Koşu:** `runStep(lock, want, stamina, maxStamina)` — kilit dayanıklılık dolunca da kalkar.
- **Appraisal:** `claimAppraisalExp(..., clock, now)` 10 sn genel bekleme, oturum içi (`WorldScene.appraisalExpClock`).
- **Para:** `normalizeWallet`, her `transact` sonunda.
- Elle test betiği: `tools/qa/steps_g2.mjs` (`node tools/qa/shot.mjs g2`, `?qa=1`, başsız Chromium). Son tur sonuçları (oyun saatiyle):
  - Yeni oyun, HUD `HP 5,0 / 5,0`. Fare yumrukla 2 vuruş (0,5 + 0,5), Çatlak Sopa ile 1 vuruş (1,0).
  - Tavşan 2 karo arkasından kovalanınca 10,9 sn'de köşeye sıkıştı, 12,1 sn'de tekme attı (HP 5,0 → 4,0). İlk denemede köşeye sıkışan tavşan kaçarken evinden uzaklaştığı için "eve dön"e geçip hiç saldırmıyordu → düzeltildi (sıkıştığı yer yeni evi). Yeniden ürkekleşme birim testle doğrulandı; başsız turda oyuncuyu uzaklaştırdığım yer bir ara sahne tetiklediği için ölçülemedi.
  - Goblinin hazırlığı normal vuruşla kesildi. 12 sn boyunca 0,25 sn arayla vuruş: 7 hazırlık, 3 iptal, 4 tamamlanan saldırı — kilitlenmiyor. İlk ölçümde geri tepme ve vuruş donması düşman YZ'sini tamamen durdurduğu için iptal beklemesine rağmen düşman hiç saldıramıyordu → düzeltildi (ikisi artık yalnızca hareketi etkiliyor). Goblin Şefi normal vuruşla kesilmedi, ağır vuruşla kesildi.
  - Joystick hep sonda: koş → 0'da nefes nefese yürü → %100'de kendiliğinden koş → … döngü tekrarlıyor.

## Grup 3'te yapılanlar (0.5.0)

- **Appraisal paneli** (`src/ui/appraisalPanel.ts`): iki sütun, kaydırmasız (700 px). Sol sütun sabit 170 px: portre (`ensurePortrait`; yaratıkta `monsterPortraitKey` — sprite sayfasının ilk karesi, saydam kenarlar kırpılır; goblinler LPC; yüklenemezse baş harf + siluet), Level ve Lonca kutucukları, HP/MP. Sağ sütun: Irk/Cinsiyet/Yaş/Title, 7 stat, 11 slotluk ekipman ızgarası (boş: kesik çizgi + "—"). Skill etiketleri altta, yarıçap 6. Gizli bilgi "???". Envanter bölümü ve `core/appraisal` yorumlarındaki envanter kalktı. Sağ üst metin `appraisalDiffText` ("direnç" → "Appraisal"). Saygınlık yalnızca kendi kartında (toplam + eşya başına, +0 dahil; boş gövde/bacak cezası da yazar). **Yaratık:** koyu kırmızı zemin, sağ üstte rütbe (G−/G/G+), stat/lonca/ekipman yok, drop tablosu (`dropsVisible`), yaş/cinsiyet yoksa "—", Title yalnızca tanımlıysa.
- **Kit:** `itemRankBadge` (lonca rozeti, alt kademesiz), `drawTile`, `dashedRoundedRect`, `fitText`. Atlasa 🔊/🎮 eklendi (mevcut kareler aynı kaldı).
- **Eşya rütbeleri:** tüm malzeme ve çöp eşyalara rütbe (`items.ts`); envanter, dükkân, eşya ayrıntısı, ekipman kutucukları ve Appraisal'da rozet. Test: kuşanılabilir + malzemede zorunlu.
- **Saygınlık:** `prestigeLabel` her zaman işaretli ("+0", "−2"); Status/Ekipman kutucuklarında, eşya ayrıntısında ve dükkânda.
- **HUD görevleri:** Ana Görevler / Yan Görevler (pano dahil) başlıkları, boş kategori çizilmez (`hudQuestGroups`); Menü → Görevler'de iki anahtar, `localStorage` (`elonth.questbox.main/side`).
- **Lonca Kartı:** `RANK_THRESHOLDS` ile ilerleme barı, sonunda hedef rozet, kalan puan / "Level N gerekir" / "Terfi hazır".
- **Terfi:** `guild.pending` kalktı. Eşik + Level şartı → `Q.checkPromotion()` dinamik "Terfi" görevi açar (`m_rankup_<kademe>`, duyurulur). Celeste'de `promotionTalk` → `Q.promote()` o anda; `'promotion'` olayı → `playRankUp` (`src/ui/celebrations.ts`). Level atlayınca da kontrol edilir. Otlak görevinin tesliminde aynı konuşmada işlenir. Kayıt v6: bekleyen terfi Terfi görevine dönüşür. Sınavlı kademeler (E−'den itibaren) akış dışında. Geliştirici panelinde "Eşiğe" ve "Terfi (anında)".
- **Görev bitişi:** `Q.complete` → `'questdone'` → `playQuestComplete`: para sayarak, EXP barı (level atlarsa vurgu), eşyalar, Lonca Puanı; dokununca sona atlar, ikinci dokunuş kapatır, ~1,8 sn sonra kendiliğinden kapanır. Kutlamalar sistem bildirimleriyle aynı kuyrukta; hikâye `ui.whenOverlaysIdle()` ile bekler. Sessiz tamamlanan hikâye geçişleri animasyon oynatmaz ("G- Rütbe" artık sessiz değil).
- **Görev EXP:** `reward.exp`; ana görevler hiç vermez (`questExp`), yan 2–6, pano G 3 / F 6. Test: yan/pano EXP ≤ aynı sürede fare avının üçte biri.
- **Ayarlar:** `buildSettings(scene, c, w, h)` — ScrollList içinde Görüntü / Ses / Oynanış / Kontroller (+ Geliştirici); kaydırıcı sürüklerken liste kaymaz (`holdPointer`), maske dışındaki düğmeler tepki vermez (`containsPointer`). Başlık ekranında "Kapat" kaydırma alanının dışında.
- Testler: 428 → 446 (`tests/ui.test.ts`). QA: `URL='http://localhost:4173/?qa=1' node tools/qa/shot.mjs g3` (`ONLY=title,appr,quest,rank,settings,inv`).

### Elle test (başsız Chromium, 1280×854, DPR 1,5)

- **NPC Appraisal (Muhafız Hob):** iki sütun, LPC portre, Level 4 / Lonca "Yok", HP 93/93, 3 dolu (Demir Mızrak, Demir Miğfer, Kapitone Zırh — F rozetleri; Deri Çizme G) ve 8 kesik çizgili boş slot; saygınlık satırı yok. Celeste (Appraisal'ı iki harf üstün): yalnızca Title okunuyor ("İnsan Okuyan"); isim, kimlik, Level, Lonca, HP/MP, 7 stat, 11 slot ve skill "???" ama kutucukların hepsi yerinde.
- **Kendi Appraisal'ım:** başlığın sağında "Saygınlık −4", her dolu slotta katkı (Çatlak Sopa −2, Keten Gömlek +1, Yırtık Şort −3, Bez Ayakkabı +0, Kemirilmiş Yüzük +0).
- **Yaratık:** fare — koyu kırmızı zemin, kırpılmış sprite portresi, sağ üstte G−, Irk Canavar / Cinsiyet — / Yaş —, drop tablosu %64 / %8,5 / %1,3 (nadir), stat ve ekipman yok. Goblin Şefi — LPC portre, F+, Title "Kampın Şefi (F)", oranlar "???" ("Appraisal F+ gerekir").
- **Terfi:** G−, 36 puan → Lonca Kartı barı 36/40, "4 puan kaldı", sonda G rozeti. +10 → "Terfi" görevi açıldı (`m_rankup_1`), rütbe hâlâ G−. Celeste'yle konuşunca rütbe o anda G, animasyon oynadı (eski rozet titreyip dönüyor, ışık patlaması, büyük "G", "G− → G"), görev kapandı.
- **Görev bitişi (Elmalı Çörek, EXP 98/100):** para 0→30 sayarak, +4 EXP barı dolup "LEVEL ATLADIN!", Ballı Çörek ×1; sonra "Devam etmek için dokun". Level 1, 2/200 EXP.
- **HUD:** "ANA GÖREVLER" altında Hana Git, "YAN GÖREVLER" altında iki görev; ana görevler gizlenince yalnızca yan başlık.
- **Ayarlar:** menüde 944 px içerik 596 px alanda kayıyor; başlık ekranında Kapat sabit, en alta kaydırınca Kontroller bölümü görünüyor.
- Gerçek tablette dokunmatik kaydırma ve animasyon akıcılığı denenemedi (yalnızca başsız tarayıcı).

## Grup 4A'da yapılanlar (0.6.0)

- **Ana görev güvencesi** (`src/story/mainline.ts`): `nextMainQuest` zinciri sondan başa okur, `ensureMainQuest` (Director, sahne dışında yarım saniyede bir) eksik halkayı açar; bekleme gereken yerlerde adım görevleri: `m_board` "Pano" (Loncaya dön, panodan görev al), `m_vl_rest` "Vera ve Lina", `m_next_day` "Ertesi Gün", `m_vl_cellar` "Yeni İş", nadiren `m_gpoints` "G Rütbesi". Adımlar zincirin asıl görevi açılınca sessizce kapanır; terfi görevi adımı kapatmaz. Test: zincir geliştirici araçlarıyla (görevi doğrudan bitirerek) baştan sona, her adımda aktif ana görev.
- **Bekleme metni** (`WorldScene.questWait`): hikâye kapısı (`Chapter2.objectiveWait`: ertesi gün 08:00, akşam 18:00, hasat 06–16), kapalı bina ("Lonca 05:00'te açılır"), NPC'ye ulaşılamıyor (`src/world/reach.ts`: programdan bir sonraki erişilebilir saat ve yer). Beklemedeyken ok yok; HUD'da ve görev sekmesinde "⏳ …". `hourAt`/`whenLabel` Türkçe saat ekleri.
- **Görev saatine kadar uyu**: yatakta, bekleyen görev varsa menü "Uyu / Görev saatine kadar uyu (yarın 08:00) / Vazgeç"; saat kuralına takılmaz, geçen her gün için gün değişimi işlenir.
- **Pano**: sopa → "Pano" → loncaya girince `boardOpening` aynı gün (Vera ve Lina `ensureActors` ile kapıdan girer). Lonca 05–24 (`GUILD_HOURS`: kapı + Celeste'nin programı); panodan en fazla 3 ilan (`MAX_BOARD_QUESTS`).
- **Sahne karakterleri**: `Director.say` konuşmacı haritada değilse onu Joseph'in yanına getirir (sahne bitince programına döner); `ensureActors/releaseActors`. Otlak ve bodrumda yoldaşlar `ensureParty` ile hep yanında.
- **Yaralılar**: görev sürerken şifa evinin kapısı açık (`doorOverride`), Ilse Nine içeride.
- **Kâhyanın Kesesi**: İlk Kadeh iki adımlı (hana gel → Vera'nın masasında "Otur"); ertesi gün meydanda kese sahnesi (gün bayrağı eksikse bugün); şüphelilerde sarı "?" işareti, ok sıradaki şüpheliye, ilerleme 0/4; suçlamada muhafız yol bularak yürür, Joseph `followUntilNear` ile izler.
- **Yan görevler** (`src/story/sideposts.ts`): iş yeri tablosu + her verene özgü yönlendirme repliği; teklif, bekleyen ve teslim yalnızca iş yerinde. Mavi işaretler: NPC başında salınan "!" / "?" (`Npc.setMarker`), dünyada bina üstü işaret, mini haritada her kare çizilen ışık + halkalar (yalnızca işaret varken), tam haritada ışık, halkalar ve parlayan bina. Tüccarın temel programı sabahları konağın önünde.
- **Yönlendirme**: her ana/yan/pano amacında `where` (test). Yeni hedef türleri `monster` (en yakın doğma bölgesi) ve `item` (en yakın toplama noktası ya da düşüren yaratık). NPC hedefinde sabit nokta kullanılmaz.
- **Şifalı ot**: `prop.gather` ile bire bir; orman kenarında işaretin içinde sabit 9 ot; otun üstüne çalı/ağaç gelmez; toplandı durumu yüklemede ve yeni günde görsele uygulanır.
- **Han**: `SeatBook` (`src/world/seats.ts`) — oturma noktası tek NPC; dolu ise aynı türden boş yer, yoksa herkesten 1,5 karo uzakta ayakta. Kapıdan giriş kuyruğuyla uyumlu (yer giriş anında ayrılır).
- **Yoldaş takibi** (`src/world/follow.ts`): hız eşleştirme, 0,8/1,6 karo histerezis, yumuşak duruş, histerezisli koşu animasyonu.
- **Ad ve rütbe**: şehir Eros (`CITY_NAMES.capital` anahtarı korunuyor), Baron Merrow, kâhya Edric Fenwick; eski ad depoda hiç geçmiyor (test). Dorn F+.
- **Grup 3'ten**: `shrinkText` (Appraisal kutucukları: küçült, gerekirse iki satır), kutlamalar `RealClock` (performance.now), sessiz bitişler ertelenip sahne sonunda (`Q.flushDeferred`), yaratık portresi `monsterPortraitFrame` (aşağı bakan kare).
- Kayıt v7 (`migrateV6toV7`). Testler: 446 → 481 (`tests/g4a.test.ts`). QA: `URL='http://localhost:4173/?qa=1' node tools/qa/shot.mjs g4a` (`ONLY=chain,haldor,side,herbs,inn`).

### Uçtan uca QA (başsız Chromium, 1280×854, DPR 1)

- **Zincir:** yeni oyun → Hana Git → Bertram → Hasat (geliştirici "Tamamla") → kayıt sahnesi → Bertram'dan sopa → "Pano: Loncaya dön, panodan görev al" → loncaya girince pano açılışı (Vera ve Lina sahnede) → G görevleri teslim → Biraz Hava → yaralılar → **22:00'de şifa evine girildi, Ilse Nine içeride** → "Vera ve Lina … yarın 08:00'de onları bul" → yatakta "Görev saatine kadar uyu (yarın 08:00)" → 08:00'de uyandı → Vera'yla otlak görevi (otlakta Vera ve Lina yanında) → teslim, G → İlk Kadeh ("Vera akşamı bekliyor — 18:00'de hana git") → handa "Vera'yla masaya otur", masada "Otur" → "Ertesi Gün" → ertesi sabah meydanda kese çalındı, 4 şüphelide işaret, ok en yakın şüpheliye → hepsine Appraisal, işaretler kalktı → muhafıza Wynn: Joseph muhafızı ~60 karo izleyip çamaşır iplerine 1,8 karo kala durdu (en büyük ara 3,9 karo) → "Yeni İş" → bodrum → 10 gümüş → veda → giriş kartı. **Her adımda en az bir aktif ana görev.**
- **Haldor:** 08:00 ok tarlada Haldor'a; 12:30 ok çiftlik evinin kapısına (Haldor içeride); 23:00 ok yok, "Haldor yarın 06:00'da tarlada olur — o saate kadar bekle".
- **Yan görev:** 19:00 handaki demirci: "İş konuşacaksan demirhaneye gel. Burada içiyorum."; 10:00 demirhanenin üstünde mavi işaret, mini haritada 3 mavi ışık, tam haritada ışık + halkalar + parlayan binalar; içeride demircinin başında mavi "!", konuşunca jöle teklifi.
- **Şifalı ot:** işaretin içinde 9 ot, 9'u toplandı; harita yeniden yüklenince 9'u soluk.
- **Han:** 19:00 (13 NPC) ve 20:00 (15 NPC) iç içe duran yok.
- Başsız turda kutlama animasyonları ve sahneler çok hızlı ilerletildiği için bazı ertelenmiş bitişler (ör. "İlk Kadeh") bir sonraki sahnenin ardından oynadı; normal oyunda sahne biter bitmez oynar. Gerçek tablette denenemedi.

## Grup 4B'de yapılanlar (0.7.0)

- **Varlık üretimi** (`tools/build_weapons.py <lpc-repo>`): LPC jeneratöründen (seyrek klon) sopa/kılıç/pala sayfaları Joseph'in klasik düzenine uyarlanır. Çıktılar `assets/gfx/chars/joseph/`: el katmanları (64 px), büyük kare saldırı/yürüme sayfaları (128/192 px), sırt/bel taşıma katmanları (`*_carry`, `*_carry_bg`), süzülen silah sayfası (`*_item`, 32 açı × 80 px, RotSprite benzeri döndürme) ve `weapons.json` (tutma noktası, yöne göre sırttaki konum/açı). Krediler `tools/credits_weapons.json` → `build_credits.py`.
- **Sopa:** `w_stick` (Budaklı, koyu, budaklı) ve `w_stick_cracked` (Çatlak, açık renkli, boydan boya çatlak). Yürüme kareleri eski `w_club` (çekiç) karelerinden yeniden çizildi: tutma ucu ve yön çekiçten okunur, sap uca doğru kalınlaşan ahşap sopa olur. Saldırı: LPC `weapon/blunt/club` (bluecarrot16, 192 px); jeneratördeki gibi **ters slash** (gövde 5→0, sopa 0→5: sopa başın üstünden iner). Çatlak sopa için saldırı sayfası da açık tona boyandı. `w_club` gürz/topuz için yerinde.
- **Kılıçlar:** Paslı Kısa Kılıç = `arming` (çelik, pas tonuna kaydırılmış), Demir Kısa Kılıç = `arming` çelik, Goblin Satırı = `scimitar` (mat demir, deri kabza). Arming: universal sayfanın üst 1344 px'i (yürüme/hurt, fg z140 + bg z9) + `attack_slash` 128 px (fg z150, bg z8). Pala: yürüme ve slash 128 px (bıçak 64 px kareden taşıyor). Hançer hançer.
- **Büyük kare katmanlar** (`Actor`): `LayerDef.big = { size, anim: 'slash' | 'walk', reverse }`; karenin merkezi 64 px karenin merkeziyle çakışır, gövdenin i. karesiyle aynı anda gösterilir. Katman rolleri `base | hand | carry`; `weaponMode` (elde / sırtta / geçişte). Yeni silah = `WEAPON_VISUALS`'a bir kayıt + `build_weapons.py`'de üretim; kod değişmez.
- **Saldırı zaman çizelgesi** (`src/world/attackPlan.ts`, saf; test edilir): `pre / hold / swing` bölümleri, toplam süre `attackDur` (formül aynı). **Hasar darbe karesinde** (slash 3, thrust 5, shoot 9; yumruk eski %45/%60). Grup 2'nin kesme mekaniği `hitEnemy` içinde olduğundan darbe karesiyle birlikte çalışır.
  - Kılıç: ağırda kılıç geriye çekili karede (2) tutulur, sonra hızlı geniş savuruş, öne adım, savurma izi. Sopa: ağırda sopa başın üstünde (kare 0) tutulur. Hançer: normal slash, ağır hızlı saplama + atılma. Mızrak: normal thrust, ağır uzun hazırlanma + hamle (lunge). Yay: normal shoot, ağır tam gerili karede bekler, bırakınca çekiş halkası + geri tepme.
  - Hazırlanmada **kaçış iptal eder**; geç iptal (%75 sonrası) korunur. Beceri saldırıları eski yolla (çizelgesiz).
- **Sırta koyma / çekme** (`Player.tickSheath`): savaş ve saldırı olmadan 6 sn (`min(sinceAttack, combatT) ≥ 6`) → sırta koy (0,35 sn). Düşman fark edince (`inBattle` başlangıcı) ve `enterCombat`'ta çek (0,25 sn, oyuncuyu durdurmaz). Sırttayken saldırı: hızlı çekme 0,17 sn (`draw` durumu) + saldırı hemen arkasından. Hikâye sahnesi/diyalog (`weaponCalm() === 'scene'`): anında sırta. İç mekân ve güvenli bölge: ilk saldırıda çekilir, 1,5 sn sonra yine sırta. Silahla yapılan beceri: anında ele. Kılıç, sopa, satır, mızrak, yay sırtta; hançer belde. Dururken gövde thrust 1–3 karelerinde kolunu omza/sırta uzatır; yürürken bacaklar yürümeye devam eder. Süzülen silah Bezier yolla omzun üstünden geçer; çekince metal parıltısı + ses (`draw`, `sheathe`, `bowstring` sesleri).
  - Taşıma katmanları dört yönde, walk/idle/koşu, spellcast ve hurt (0–2) karelerinde; gövdenin salınımını (baş konumu) izler. z: önde 90 (pelerin 85'in üstü, baş 100'ün altı), arkada 6 (gövde 10'un, pelerin arkası 5'in üstü). Yay ve mızrağın elde yürüme karesi yok (LPC): yürürken/dururken sırttaki görünüm, saldırıda elde.
  - Ayar: Ayarlar → Oynanış → **Silahı sırta koy** (varsayılan açık); ayar sürümü 3, eski ayarlar açık olarak göçer.
- **Etkileşimde idle:** dünya duraklarken (Appraisal, menü, dükkân, mini oyun) `Player.holdStill` / `Companion.holdStill` — yürüme pozunda donma yok, hız sıfır. `locked` durumunda senaryo yürütmüyorsa idle. Toplarken durur ve otu koparır. Joystick son konumu `Input.touchX/Y`'de tutulur: diyalog/menü bitince basılı joystick ile yürüme kaldığı yerden sürer. NPC'ler (`talking`) ve yoldaşlar (ara sahnede) zaten idle.
- Testler: 481 → 494 (`tests/g4b.test.ts`).

### Ekran görüntüsü seti (`tools/qa/g4b/`, en yakın komşu ile büyütülmüş)

Üretim: `npm run build && npx vite preview --port 4173 &`, `URL='http://localhost:4173/?qa=1' DPR=1 OUT=screens/g4b node tools/qa/shot.mjs g4b && python3 tools/qa/g4b_sheets.py`.

- `walk_<silah>.png` — her silah, dört yönde yürüme (üst satır elde, alt satır sırtta): `cracked_stick`, `wooden_club`, `rusty_shortsword`, `iron_shortsword`, `goblin_cleaver`, `hunting_knife`, `iron_spear`, `short_bow`.
- `attack_<silah>.png` — dört yönde normal vuruşun darbe karesi, ağır vuruşun hazırlanma karesi ve ağır vuruşun darbe karesi (yukarıdaki 8 silah + `fist`).
- `sheath_<silah>.png` — dört yönde sırta koymanın ve çekmenin orta karesi.
- `cape_up.png` — pelerinliyken, yukarı bakarken sırttaki silah (8 silah).
- `talk_idle.png` — joystick basılıyken konuşma: Joseph idle, muhafıza dönük, silah sırtta.

### Ölçümler (başsız Chromium, DPR 1)

- Zamanlamalar (`ONLY=behavior`): açık alanda elde → sırta koyma 6,03 sn'de başladı, 0,35 sn sürdü; sırttayken saldırı tuşu → saldırı 0,25 sn (başsız tarayıcıda kare 50 ms; 60 FPS'te ≈0,19 sn); düşman fark edince silah 0,25 sn'de elde; ağır vuruşun hazırlanmasında kaçış → hasar uygulanmadı; diyalogda silah sırtta. Konuşma: sırasında idle (hız 0, muhafıza dönük), sonra basılı joystick ile yürüme sürdü.
- **Performans** (`node tools/qa/shot.mjs g4bperf`, köy meydanı 25 NPC, Demir Kısa Kılıç + pelerin; aynı makinede 0.6.0 ile, iki tur): meydan FPS 6,0 / 6,1 → 6,3 / 6,1, CPU kare süresi 9,8 / 9,4 → 9,6 / 10,4 ms; ormanda sürekli saldırı 4,6 / 4,8 → 4,9 / 4,8 FPS. Fark gürültü düzeyinde. Joseph'in sprite sayısı 9 → 13 (görünmeyenler çizilmez). Bu makinede mutlak FPS Grup 1 ölçümünden (9,7) düşük; kıyas aynı makinede yapıldı.

### Görsellerde tatmin edici olmayanlar

- Arming kılıç saldırı sayfası ElizaWy'nin yeni gövdesi için çizilmiş; Joseph'in klasik slash'inde sağ/yukarı yönde iyi otururken ilk 1–2 karede (geriye çekiş) kabza el ile tam çakışmıyor (1–2 piksel). Kaydırma yapılmadı.
- Yay ve mızrağın LPC'de elde yürüme karesi yok: savaşta yürürken de sırtta görünürler, saldırıda ele gelirler. Hançerin yukarı yön saplaması LPC'de gövdenin arkasında kalıyor (görünmüyor).
- Yandan bakışta sırttaki kılıç/sopa sırttan dışa açılı duruyor (stilize; gerçekte sırta yapışık olurdu). Önden bakışta yalnızca omuz üstündeki kabza görünür. Hançer sağa bakarken belin arka tarafında kaldığı için görünmez.
- Pala (Goblin Satırı) için hurt karesi yok; vurulunca kısa süre (0,28 sn) silah görünmez.
- Sırta koyarken süzülen yay büyük ve ince; 0,35 sn'lik geçişte göze batmıyor ama durağan karede iri görünüyor. Çatlak sopanın çatlağı oyun ölçeğinde zor seçilir (asıl fark renk).
- Gerçek tablette denenemedi (yalnızca başsız tarayıcı).

## Grup 5A'da yapılanlar (0.8.0)

### A. Hatalar

- **A1 Sistem bildirimi takılması** — kök neden: `sysShowing` kapanma animasyonu bitmeden sıfırlanıyordu; o arada gelen bildirim kuyruğa girip hiç gösterilmiyor, gösterilen de kapanmıyordu. Yeni `SysFlow` (`src/ui/sysFlow.ts`, Phaser'sız, test edilir): `current` / `closing` / `queue`; kapanış animasyonu bitince yalnızca hâlâ aynı bildirimse sıradakine geçer. `UIScene` bildirimleri, kaplamaları ve zamanlayıcıyı bu akışa bağlar.
- **A2 Kapıdan hızlı geçiş** — `questTick` yarım saniyede bir çalıştığı için hızlı geçişte "binaya git" amacı atlanıyordu. `tryWarp` artık geçişten hemen önce `questTick` + `completeDoorGoals(from, to)` çağırır; kapı hedefli amaç (`src/world/questGo.ts`, `doorGoal`) binaya girince tamamlanır. Haritaya yüklemede de (`loadMap`) aynı kontrol.
- **A3 QA yoklaması** — `tools/qa/helpers.mjs`: `until(fn)`, `frames(n)`, `gameSec(s)`; `run()` sahne başlangıcını bekler ve oturur; `tp`/`warp` yoklamalı. `steps_g4a.mjs` sabit beklemeler yerine koşul yoklar; uyanma kontrolü 08:00–08:10 toleranslı.

### B. Görevler, NPC'ler, dünya

- **B1** Elma ağacı başına 3 elma (`gatherQty`); ok bugün toplanmamış en yakın elma ağacına; elma kalmadıysa "Bugünlük elma kalmadı — yarın yeniden toplanır". **B2** Köprü yanındaki `apple3` ağacı kalktı (Köksüz'ü örtüyordu). **B3** Görevin istediği eşya envanterden de hızlı yemekle de yenmez: "Görev için lazım." (`questNeeded`, `QUEST_ITEM_REASON`).
- **B4** Şifalı ot görseli 14×3 px'lik yanlış kesimdi → 24×15 yaprak demeti, ×1,25 ölçek (oyunda 30×19 px). Joseph'in 3,5 karo yakınındaki toplanabilirler yumuşak, nabız gibi parlar (`updateGatherGlow`).
- **B5** Dorn sahnede `walkPath` ile yol bularak yürür; takılırsa (0,7 sn) bir sonraki yol noktasına alınır, kilitlenmez. **B6** Muhafız (ve diyalogdan sonra yürüyen diğer NPC'ler): kök neden `Npc.update`'in `talking` dalıydı — senaryo yürütürken hızı sıfırlıyor, idle'a ve Joseph'e çeviriyordu. `actor.driven` sayacı: senaryonun sürdüğü aktörü NPC/yoldaş güncellemesi bırakır; yürüme animasyonu ve yön hareketten gelir.
- **B7** Varg F rütbesi, F+ kılıç ustalığı, ucuz teçhizat (paslı kısa kılıç, dolgulu zırh, deri başlık ve çizme); "E rütbe olmadan" laflı replikler değişti (Aurelio'nunki korundu). **B8** Dükkânlarda beceri kitabı yok. **B9** Yan görev EXP'si ×2 (4–12; sınır: aynı süre fare avının ⅔'ü). **B10** Yırtık şort kahverengi (katman + simge; simge `tools/custom_icons.py`).
- **B11** Saraya benzeyen figür kalktı. Doğu kenarı boydan boya taş sur (`tools/build_eastwall.py`, LPC `base_out_atlas` tuğla + ızgara), ana yolun sura değdiği yerde kemerli kapı ve iki kule; dört **Geçit Şövalyesi** (Aldric, Bren, Osric, Ywain; L8–9, gün boyu kapıda).
- **B12** Mini oyunlarda tek müzik (`minigame`), bitince dünya müziği kaldığı yerden (`pushMusic`/`popMusic`).
- **B13** Servis: günlük hedef = mevcut tempoda gelen müşterilerin %60'ı (1. gün 5, 2. gün 6, 3. gün 8), HUD'da "Hedef x/y". Kazanma: hedef kadar müşteriye servis + tabaklar bulaşıkta. Kaybetme anında: geç kalan sipariş ya da süresi (18/16/14 sn) dolan kirli tabak → "Kaybettin" + neden + "Tekrar dene". Ücret yalnızca kazanınca.
- **B14** Sağdaki siyah şerit: karartma perdeleri oluşturuldukları andaki boyutta kalıyordu. `fullScreenRect` (16 px taşma, `Display.onResize` ile yeniden boyutlanır) bütün tam ekran karartmalarda.
- **B15** Savaşta toplanan ganimet savaş bitene kadar "risk altında"; savaş bitince "Savaş bitti. Ganimet güvende."; o arada ölünce kaybedilir ve ölüm ekranında yazar.
- **B16** Satış (`src/core/selling.ts`): aralık taban değerin ×0,8–×1,5'i; teklif = aralıkta 0,5·uzmanlık + 0,5·yakınlık. Her dükkânın uzmanlık listesi (`shops.ts`, `expertise`); satış sekmesinde teklif, aralık, uzmanlık ve yakınlık; drop tablosunda "Tür · alt–üst bronz". Al-sat kârı yok (test).
- **B17** Sabit joystick modunda yalnızca daire joystick; sol yarı kuralı yalnızca serbest modda (`touch.test.ts`).

### C. Denge ve dövüş

- **C1** `DIVINE_STAT_FLOOR.speed` 1 → 0,75; Joseph'e özel yürüme çarpanı ⅔ (`JOSEPH_WALK_MULT`, `src/core/movement.ts`), koşu = yürüme ×1,6. `BASE_SPEED` (5,2) ve kaçış mesafesi değişmedi. Tavşan 4,2 → 3,5.
- **C2** Ayarlar → **Hareket hızı (max = X)**: −/+ 0,1, dokununca sayı girişi, "Max" seçeneği (varsayılan). Değer max'a sabitlenir, en az %40; ayar hiç hızlandırmaz. Ayar sürümü 4 (eski `moveSpeed` kaydı silinir, Max olur).
- **C3** Dayanıklılık tabanı 0,75.
- **C4** Hasar sayıları: Pixelify 13 px kalın + 3 px kontur "5"in boşluklarını kapatıyordu → Alegreya Sans kalın, 16–21 px, 2 px kontur. 0,3 / 0,5 / 0,6 / 0,8 / 0,9 ayırt ediliyor (QA ekran görüntüsü `g5a_c4_dmg_variants`).
- **C5** Kaçış 20 → 7,5 dayanıklılık (`dodgeCostMult` hâlâ uygulanır), 0,8 sn bekleme (sessiz). Joseph'in vuruşu düşmanı geri itmez (hitstop, parlama, kıvılcım duruyor); Joseph'in geri itilmesi aynı.
- **C6** Yoldaşlar: hasar ×0,15 (`COMPANION_DMG_MULT`), vuruşlar arası 2,2–2,8 sn, 0,4 sn görünür hazırlanma (yavaş kare + parlama), hedef seçerken Joseph'in son 2,5 sn'de vurduğu düşmandan kaçınma (`companionTargetScore`). Ölçüm (değirmen bodrumu, 4 Dev Fare, Vera + Lina, Joseph Budaklı Sopa, hasar almaz; `ONLY=party`, oyun saniyesi):

  | Çarpan | Joseph vurmaz: bodrum temizlenme süresi | Joseph aktif: öldürmelerde Joseph'in payı |
  | --- | --- | --- |
  | ×1 (0.7.0) | her vuruş bir fare (Vera ~6–15 hasar, Dev Fare 3 HP) | — |
  | ×0,35 | 15,4 / 9,4 → ort. 12,4 sn ✗ | %63 |
  | ×0,25 | 10,3 / 12,7 / 11,5 → ort. 11,5 sn ✗ (Vera %45 tek vuruş) | %67 |
  | **×0,15** | 18,7 / 21,7 / 22,6 → **ort. 21,0 sn** ✓ (son tam turda 28,1 / 16,1) | **%67** (8/12) ✓ (son tam turda %88) |

  Ölçütler: Joseph hiç vurmazsa ≳15 sn; Joseph aktifken öldürmelerin ≥%40'ı Joseph'in.
- **C7** Saldırı temposu: dövüşen NPC'ler yalnızca yoldaşlar; temposu C6 ile yaratık temposuna yaklaştı (yaratıklar değişmedi).
- **C8** Geliştirici "+1 level" `STAT_POINTS_PER_LEVEL` (6) puan verir. Bütün NPC'lerin ve yoldaşların taban statları tam 6 × level (oranlar korunarak en büyük kalan yöntemiyle; büyücülerde MNA). Test: `tests/g5a.test.ts`.

### D. Silah görselleri

Önce/sonra tablolar `tools/qa/g5a/` (`python3 tools/qa/g5a_weapons.py <0.7.0 joseph klasörü>`, en yakın komşu ile büyütülmüş, dört yön); oyun içi pozlar `steps_g5a` → `weapons`.

- **D1** `d1_sword_hilt.png`: kısa kılıç saldırısının geri çekiş karelerinde kabza kare kare kaydırıldı (`ARMING_SLASH_OFFSET`) — sayfa ayrık kollu LPC gövdesi için çizilmiş.
- **D2** `d2_walk_spear.png`, `d2_walk_bow.png`: mızrak (dik) ve yay (yanda) için elde yürüme katmanları (`w_spear_walk`, `w_bow_walk`, 128 px); savaşta sırta düşmezler.
- **D3** `d3_dagger_up.png`: LPC'de boş olan yukarı saplama satırı çizildi (tutuş baş/gövde dışında, hazırlanmada eğik).
- **D4** `d4_cleaver_hurt.png`: pala vurulurken kaybolmaz (aşağı yöndeki yürüme karesi görünür, vurulma pozu hep aşağı bakar).
- **D5** `d5_carry.png`: yandan sırttaki kılıç sırta yakın, hançer sağa bakarken görünür, mızrak sapı yüzün önünden geçmez; önden görünüm aynı.
- **D6** `d6_bow_float.png`: süzülen yay ×0,75, elden sırta düz yolla (ele bağlı), yukarı bakarken başın arkasından — kiriş başın üstünden geçmez.
- **D7** `d7_cracked_stick.png`: Çatlak Sopa'da zikzak çatlak, kıymık ve yarık uç.
- **D8** Gerçek tablette FPS — aşağıdaki listeyi oyuncu doldurur.

### D8: Tablette FPS ölçüm listesi (oyuncu için)

1. Ayarlar → Görüntü → **FPS göstergesi** açık; FPS sınırı 60, grafik kalitesi önce **Yüksek**.
2. Her yerde 20 sn bekle, sonra 20 sn yürü; göstergedeki en düşük ve ortalama değeri not et:
   - **Açık dünya** (köyün dışındaki orman yolu): dururken ___ / yürürken ___
   - **Köy meydanı** (gündüz 10:00–16:00, kalabalıkken): dururken ___ / yürürken ___
   - **Han** (akşam 19:00–21:00, dolu): dururken ___ / yürürken ___
3. Aynı üç yeri **Orta** ve **Düşük** kalitede tekrarla.
4. Cihaz modeli, Android sürümü, tarayıcı (ya da ana ekran uygulaması) ve pil tasarrufu modu açık mı — not et.
5. 45 FPS'in altına düşen yer varsa o anın ekran görüntüsü (FPS göstergesi görünür halde).

| Yer | Yüksek | Orta | Düşük |
| --- | --- | --- | --- |
| Açık dünya | | | |
| Köy meydanı | | | |
| Han (akşam) | | | |

### Uçtan uca QA (başsız Chromium, 1280×854, DPR 1)

`npm run build && npx vite preview --port 4173 &`, sonra `URL='http://localhost:4173/?qa=1' DPR=1 OUT=screens/g5a node tools/qa/shot.mjs g5a` (`ONLY=sys,door,apples,herbs,dorn,guard,shorts,east,bridge,dmg,serve,fade,party,weapons`).

Son tam tur (0.8.0 derlemesi): **steps_g5a hepsi tamam**, **steps_g4a hepsi tamam (60 kontrol)**.

- **A1:** kapanış animasyonu sırasında gelen ikinci bildirim gösterildi, 9 sn sonra ekranda bildirim yok, kuyruk boş (`g5a_a1_second_note`, `g5a_a1_cleared`).
- **A2:** kapıdan hızlı geçişte "şifacıya git" amacı tamamlandı; içeride amaç "Ilse Nine'ye tedaviyi öde" (`g5a_a2_inside`).
- **B1/B3:** ok elması olan en yakın ağaca (iki ağaçta doğru), bir günde iki ağaçtan 6 elma; görev elması envanterden ve hızlı yemekle yenmedi, "Görev için lazım" (`g5a_b3_quest_item_warning`).
- **B4:** otun görüntüsü 30×19 px (eskiden 14×3), yakında 8 toplanabilir parlıyor (`g5a_b4_herbs_glow`, `g5a_b1_apple_tree_glow`).
- **B5:** Dorn sahnesi 34 örnekte hiç takılmadı (yürürken en uzun durma 0,00 sn), sahne bitti.
- **B6:** muhafız 172 örnekte hep yürüme animasyonuyla ve önüne bakarak yürüdü; Joseph en çok 4,1 karo geride izledi, çamaşır iplerine 2,3 karo kala durdu. `steps_g4a`'da aynı adım: 4,2 karo / en büyük ara 4,6 (önceden muhafız yavaş karede ara noktanın çevresinde gidip geliyor, sonra ışınlanıyordu — ayrı commit).
- **B10:** kahverengi şort dört yönde (`g5a_b10_shorts_*`).
- **B11:** geçitte 4 şövalye, saray figürü yok (`g5a_east_gate`, `g5a_east_wall_n/s`); köprü yolunda (64,62) ağaç yok, Köksüz görünür (`g5a_bridge_path`).
- **B13:** 1. gün hedef 5; geç sipariş → "Kaybettin", "Tekrar dene" baştan başlattı; kirli tabak süresi → kaybetme; hedefe ulaşınca kazanıldı (`g5a_b13_serve_*`).
- **B14:** perde ve kamera karartması 1280×854, 1600×720, 1920×1080, 2340×1080'de kenardan kenara (`g5a_b14_*`).
- **C4:** aynı ekranda eski (Pixelify) ve yeni yazı: eskide 0,5 ile 0,8 karışıyor, yenide 0,3 / 0,5 / 0,6 / 0,8 / 0,9 ayrı (`g5a_c4_dmg_numbers`).
- **C6:** yukarıdaki tablo (`g5a_c6_cellar_fight`).
- **D:** oyun içi pozlar `g5a_d*` (kılıç geri çekiş, mızrak/yay yürüyüşü dört yön, hançer yukarı, pala vurulma, çatlak sopa).

- Testler: 494 → 530 (`tests/g5a.test.ts` 27 test; denge/ekonomi/ayar testleri güncellendi). Kayıt şeması değişmedi (yalnızca ayarlar v4).

### Tatmin edici olmayanlar / açık kalanlar

- Silah kareleri yalnızca başsız tarayıcıda ve büyütülmüş tablolarda incelendi; gerçek tablette bakılmadı.
- Yayın yandan yürüme görünümü gövdenin arkasında (yüzün önünden geçmesin diye); önden bakışta yay elin önünde.
- Pala vurulurken görünen kare aşağı yön yürüme karesi (vurulma pozu LPC'de hep aşağı bakar).
- C6 ölçümü başsız tarayıcıda kare süresi 50 ms'ye sabitken yapıldı; oyun saniyesi olarak ölçüldü, gerçek cihazda da aynı olmalı.

## Grup 5B'de yapılanlar — Kısım 1: arayüz

- **1 Dükkân sahipleri ve yan görevler.** `chapter2.sideTalk` kalktı. Yan görev konuşmanın başında açılmaz: veren iş yerindeyken seçeneklerde mavi ünlem + görevin adı (`sideOptions`, `{i:side_quest}` önekli seçenek; teslime hazırsa mavi soru). Dükkânlarda Alışveriş/Satış'ın yanında (`Director.talkShop`, `talkHunter`); görev aktifken de alışveriş açık. Dükkânı olmayan verenler (`sideMenu`): normal replik + [görev, Hoşça kal]. Teklif, bekleme, teslim aynı seçenekten (`sideQuestTalk`). Çıplakken dükkânda yalnızca görev seçeneği. Ödül replikleri `{m:…}` ile para simgeli: diyalog kutusu para işaretli satırı `richParagraph` ile (simgeli, sarılı, yazı makinesiyle) çizer.
- **2 Yan görev simgesi** her yerde mavi ünlem (Twemoji ❗ maviye boyanmış, `tools/build_uiicons.py` `RECOLOR`): NPC başı ve bina (`MARKER_ICON`, artık metin değil simge), mini/büyük harita, HUD ve Görevler sekmesi (`KIND_ICON.side`), dükkân seçenekleri. Teslimde mavi soru, şüpheli sarı soru.
- **3 Mini harita:** dükkân/han/lonca simgeleri (`src/ui/mapIcons.ts`, büyük haritayla aynı tablo; keşfedilmişse), yan görev ışığının üstünde mavi ünlem. Simgeler havuzdan (`UIScene.placeMinimapIcons`).
- **4 Görevler menüsü:** "Ana/Yan görevleri göster" listeden sonra eklenir (üst katman); satır dokunuşu yalnızca listenin görünen alanında (`containsPointer`). QA: gerçek fare tıklamasıyla kaydırmadan çalıştı, altındaki satır seçilmedi.
- **5 Konuşmalar:** son 40 satır, üstte "Daha fazla göster" (sonraki 40; görünen yer kaymaz), en yenide açılır, para işaretleri düz metin. Ölçüm (400 satır, başsız Chromium + SwiftShader, DPR 1, üretim derlemesi, üç tur): sekmenin çizimi **428–465 ms → 46–67 ms**; menü açılışından iki kareye **848–922 ms → 550–636 ms** (kalanı menü iskeleti ve yazılım GPU'su). Geliştirme sunucusunda ilk turda 2,35 sn → 0,51 sn.
- **6 Lonca puan barı:** görev bitişinde `+x Lonca Puanı` satırında bar; mevcut rütbenin başladığı puandan sonrakinin puanına, önceki puandan yeniye dolar; eşik geçilince dolup yeni aralıkta baştan başlar, sonunda hedef rozet. Hesap `guildBar` / `guildBarSegments` (`core/guild.ts`), Lonca Kartı da `guildBar`'ı kullanır.
- **7 Prolog Status:** `buildAppraisalPanel(..., { theme: 'system', hidePortrait, traits })` — Appraisal'daki kendi kartın düzeni, mavi tema, portre "???"; değerler yeni oyunun gerçek verisi (Divine: Güç 0,50x, Dayanıklılık/Hız/Adaptasyon 0,75x, Öğrenme 0,50x). Açılış: dikey açılma + yukarıdan aşağı tarama çizgisi (maske).
- **8 Appraisal:** ekipman slot adlarının yanında slot simgesi (`slot_*`), "Trait: görülemez" satırı ve ayracı kalktı, skill satırları iki sütun; arka plan rütbe rengi (`RANK_BG`, rozetlerle aynı aile), çerçeve nadirlik rengi (`RARITY_FRAME`).
- **9 Skill EXP barı:** skill EXP'si görünürse satırın altında ince bar (`skillThreshold`), MAX'ta dolu ve altın.
- **10 Renkli artılar** (menü Status ve herkesin Appraisal'ı): temel stat (Level) + üst üste yeşil ekipman, sarı unvan, mor skill (`core/statParts.ts`: `statParts`, `plusOffsets`; çizim `ui/statPlus.ts`). Appraisal'da kaynak görülemiyorsa (ekipman/stat `v.stats`, unvan `v.title`, skill `v.skills`) artısı yok; statlar görünüyorsa temel stat görünür.
- **11 Ekipman savunması:** ekipman görünürse kutuda rozetin solunda mavi `DEF: +x`, başlığın sağında mavi toplam.
- **12 Kaydırma:** `MenuScene.render` aynı görünüm (sekme + bölüm + envanter kategorisi) yeniden çizilirken bütün `ScrollList`'lerin kaydırmasını korur (stat puanı, eşya/görev seçimi, ayarlar). Dükkân listesi de yenilemede yerinde kalır.
- **13–14 Sırala** (`core/itemSort.ts`): envanterde ortalama satış fiyatı (5A aralığının ortası), rütbe, tür, ad; dükkânda alış/satış fiyatı, rütbe, tür, ad. Düğme: sırasız → Fiyat → Rütbe → Tür → Ad; yanında Artan/Azalan. Seçim `SORT_PREFS` modül değişkeninde (oturum boyunca; kayda yazılmaz). **Satın alma animasyonu:** eşya ikonu ayrıntı panelinden çantaya yay çizerek uçar (en çok 3 kopya), çanta zıplar ve parlar, cüzdandan paralar düşer; yalnızca tween — art arda alım engellenmez (QA: 120 ms arayla iki alım).
- Diğer: Status'taki "Fiziksel hasar ×" çipi eski 0,05 katsayısını gösteriyordu → `strDamageMult`. uiicons atlasında kareler arası 2 px boşluk (küçük simgelerde komşu karenin kenarı taşıyordu).
- QA: `URL='http://localhost:4173/?qa=1' DPR=1 OUT=screens/g5b node tools/qa/shot.mjs g5b` (`ONLY=shop,marks,qbtn,hist,guildbar,prologue,appr,scroll,sort,buy`); seçili görüntüler `tools/qa/g5b/` (128 renge indirgenmiş). Son tur üretim derlemesinde **hepsi ✓**. `steps_g4a` yan görev adımı yeni seçenekli akışa göre güncellendi.

## Grup 5B'de yapılanlar — Kısım 2: skill sistemi (0.9.0)

Kurallar talimattaki gibi; sayılar değiştirilmedi. Saf kurallar `src/core/skills.ts`, `src/core/status.ts`; veri `src/data/skills.ts`; dünyadaki uygulanış `src/world/techniques.ts` (+ `WorldScene`, `Player`, `Enemy`).

- **S1 nadirlikler:** `common` / `rare` / `epic` (yeni) / `legendary` (+ `innate` Appraisal, gri). Çerçeve nadirlik rengi (`RARITY_FRAME`: gri, mavi, mor, altın), arka plan rütbe rengi (`RANK_BG`) — Appraisal'da ve Status → Skills'te. Awakening kademeleri tabloda: sıradan S-/X-, nadir A-…, epik B-…, efsanevi C-… (test). Yeni epik skill'ler **Buz Büyüsü** (`ice_magic`) ve **Savaş Narası** (`war_cry`): ikon (496 RPG icons, CC0: `S_Ice02`, `S_Buff14`), açıklama, teklif havuzunda.
- **S2 kademe kuralları:** her skill G-'den X-'e, tablolar her harfin "-" kademesinde. `mergedPassive`: ulaşılan tablolar sırayla alan alan birleşir (aynı alanda son değer; anılmayan alan korunur — Kılıç Ustalığı G-'deki dayanıklılık indirimi C-'de de geçerli). Ara kademeler (`lerpPassive`): sayılar ve eşlem değerleri bir sonraki taşa doğru üçte bir; hiç olmayan alan nötr değerinden başlar (`PASSIVE_NEUTRAL`: gizli saldırı ×1,5, çarpanlar 1 …); statlar tamsayıya yuvarlanır; bayraklar ilerlemez. Teknik gücü `techniquePower` (G- ×1,0 → X- ×2,2). EXP eğrisi 15/40/100/250/600/1.500/4.000/10.000/25.000. Bütün skill'lerin toplam etkisi `aggregateFx` → `Derived.fx` (bazı alanlar en büyüğü, çarpanlar çarpımı; MP/bekleme/menzil gibi kendi tekniklerine ait alanlar toplanmaz).
- **S3 Sistem Teklifi:** 1 SP Basic (gri) / 2 SP Medium (mavi) / 3 SP High chance (sarı); seçim kartlarında kart başına oranlar. Kart sayısı = SP, her kart nadirliğini ayrı çeker (`rollOfferCards`), aynı teklifte aynı skill yok, boş havuz **aşağı** kayar, sıradan da bitince kart boş ("Sistem uygun skill bulamadı") ve SP iade. Haftada 1 yeni skill (Teklif, öğretmen, kitap); teklif açmak hakkı kullanır (kart boş gelse ya da seçilmese bile). Gizli keşifler (`director.discovery`) sınırın dışında ve hakkı kullanmaz. **Görünmeyen bildirim:** menü açıkken `sysmsg` UI sahnesine (menünün arkasında duraklatılmış) değil `MenuScene.showNotice`'e gider — menünün üstünde mavi kutu.
- **S4 MP:** `techniqueMp` = nadirlik tabanı (3/5/8/12) × açıldığı harfin çarpanı (G 1 … X 35), büyü temelli ×2; veri dosyasında `mp: 0`, yüklenince formülle dolar. "MP -%x" pasifleri `techniqueCost`'ta (sahip skill'in birleşik pasifi). Test: Çift Kesik 20, Karşı Saldırı 45, Kıvılcım 10, Ateş Topu 40, Cehennem Çemberi 140, Buz Kıymığı 16, Buzul Mızrağı 224, Nara 8, Statik Ok 24, Göğün Hükmü 528. Diğerleri: Delici Hamle 20, Süpürme 45, Küçük Şifa 10, Yenilenme 40, Arındırma 90, Buz Zırhı 40, Donduran Halka 96, Meydan Okuma 48, Rüzgâr Kesiği 12, Fırtına Dansı 72, Gök Yaran 264, Gök Gürültüsü 144, Yıldırım Adımı 216, Demir Deri 72. Yenilenme `mpRegenPerSec`: 0,02 + max MP × 0,005, MNA +%3/puan, × Adaptasyon, savaşta ×0,3. Mana İksiri 25 MP. Max MP formülü aynı.
- **S5 yetenek slotu:** `GameState.skillSlots` (2 eleman; `SKILL_SLOTS_OPEN = 1`). Status → Skills'in başında "Yetenek Slotları": 1. slot (yetenek, MP, bekleme, güç), 2. slot kilitli "Yakında". Her aktif yeteneğin satırında Tak/Çıkar; savaşta (`inBattle` ya da `player.inCombat`) devre dışı ve uyarı. HUD yalnızca takılı yeteneği gösterir. Yeni yetenek açılınca slot boşsa kendiliğinden takılır. Divine yetenekleri dışarıda.
- **S6 durum etkileri** (`core/status.ts`, testli): yanma (taban hasarın %20'si/sn), yavaşlatma, dondurma (boss: %50 yavaşlatma), sendeleme (boss ve kullanıcıdan yüksek level muaf), felç, korku (kaçma), kışkırtma (hedef kullanıcı). Aynı etki üst üste binmez (büyük süre/güç). Düşmanda: hız, hareketsizlik (hazırlanan saldırı bozulur), kaçma, hedef; donmuşta buz mavisi, başın üstünde etki simgesi (Twemoji). Joseph'te: goblin şamanının ateşi 2 sn yakar; yavaşlatma hızına işler; İlk Yardım B- süreleri kısaltır; Arındırma siler. Lanet: `curse` bayrağı (Arındırma yalnızca Lanet Kıran ile siler).
- **S7 tablolar:** `src/data/skills.ts` talimattaki tablolarla birebir; Çift Ok, Alev Püskürtmesi, Alev Duvarı kalktı. Teknik türleri: `melee_multi`, `projectile` (pierce, element etkisi), `aoe` (self/hedef noktası, fiziksel/büyü), `heal`, `buff`, `shield`, `cleanse`, `parry`, `lunge`, `sweep`, `shout`, `taunt`, `dash`.
  - **Karşı Saldırı** gerçek savuşturma: 1,2 sn duruş (`Player.parryT`, yerinde durur; kaçış bozar), gelen darbe engellenir, saldırgana normal vuruşun ×2'si; Divine'ın `counterT`'sinden ayrı.
  - Pasif mekanikler: Gölge (3 sn hareketsiz → saldırana kadar görünmez, düşmanlar göremez), Hayalet (gizli saldırı sürüyü uyandırmaz, öldürünce Gölge geri gelir), geç fark etme (`Enemy.seeT`), mükemmel kaçışta dayanıklılık ve kesin kritik, 6 sn'de bir bedava kaçış, ok hızı/menzili/hareketsiz bonus, sargı süresi, savaştan sonra 5 sn ×3 yenilenme, Saha Hekimi (iyileşmenin %50'si yakındaki yoldaşlara; iksir/sargı için `healed` olayı), İkinci Nefes ve Ölümsüz Kale (günde bir, `onceADay`), koşu bedeli ve Sonsuz Adım, dayanıklılık yenilenmesi, ek/kesin ürün, nadir ot (**Gümüş Yapraklı Ot**, F, şifacı alır — yeni eşya), Bereket (yarı sürede yeniden doğma: `gatheredAt`, 12 oyun saati), ağır vuruş dayanıklılığı, kılıç kritik/hız, kombo (ardışık 3. normal vuruş ×1,5), bekleme yarıya, mızrak erişimi, yanma süresi/çarpanı, Kutsal Işık (şifa yoldaşlara), yavaşlatma oranı/çarpanı, Mutlak Sıfır, donmuşa ×2, Nara yoldaş hasarı/savunması (`Companion.rally`, 8 sn), Savaş Lordu, Korkutan Ses, Kral Narası, Rüzgâr Kesiği menzil/iki dalga, mermi saptırma, her kılıç vuruşunda rüzgâr dalgası, yıldırım zinciri (Statik Ok G- 1, F- 2 hedef; X- tüm yıldırım alanları), felç şansı, sersemleme süresi, Taş Kök (geri savrulmaz), Çelik Ruh.
- **Kayıt v8** (`migrateV7toV8`, testli): `skillSlots` (ilk sıradaki aktif yetenek takılı gelir; kaldırılan teknik takılıysa düşer), `gatheredAt`, `onceADay`; birikmiş skill EXP'si yeni eşiklere göre rütbe atlatır (`normalizeSkillExp`; ör. eski D- 480 → D, 230).
- Testler: 530 → 575 (`tests/g5b.test.ts` 45 test, Kısım 1 dahil: teklif oranları 40.000 çekişle ±%1,5, boş havuz, EXP eğrisi, MP örnekleri, pasif birleştirme, ara kademe, durum etkileri, slot, göç; eski skill testleri yeni kurallara göre güncellendi).

### Uçtan uca QA (başsız Chromium, 1280×854, DPR 1, üretim derlemesi)

`URL='http://localhost:4173/?qa=1' DPR=1 OUT=screens/g5b node tools/qa/shot.mjs g5b` — Kısım 2 bölümleri `ONLY=offer,slot,fx`. Son tam tur (Kısım 1 + 2): **31 denetim, hepsi ✓**, konsolda hata yok. Regresyon: `steps_g4a` (`ONLY=side,herbs`) ve `steps_g5a` (`ONLY=sys,door,apples`) tamam.

- S3: seçim ekranında 1/2/3 SP ve kart başına oranlar (`g5b_s3_offer_choice`); 3, 2 ve 1 kartlı teklifler (`g5b_s3_offer_3cards` …); yalnızca bir sıradan skill kalmışken 3 SP → 1 kart + 2 boş kart, 2 SP iade (`g5b_s3_offer_empty_cards`); aynı hafta yeniden basınca bildirim menünün üstünde (`g5b_s3_weekly_notice_on_menu`).
- S5/S1: boş ve dolu 1. slot, 2. slot "Yakında" (`g5b_s5_slots_*`), HUD'da tek yetenek düğmesi (`g5b_s5_hud_one_skill`), nadirlik çerçeveli liste (`g5b_s1_skill_list_frames`).
- S6/S7: Buz Kıymığı yavaşlattı, Donduran Halka iki goblini dondurdu, Nara üç fareyi sendeletti, bossa (Goblin Şefi) işlemedi, Kıvılcım yaktı, Karşı Saldırı goblinin darbesini engelleyip ×2 karşılık verdi (Joseph HP değişmedi) (`g5b_s6_*`, `g5b_s7_counter`).

### Yapılamayan / basitleştirilen

- **Toplama süresi** (Toplayıcılık C- -%25, S- "anında biter"): oyunda toplama zaten anlık (süre yok); alan veride duruyor, etkisi yok.
- **Lanetler:** oyunda saatler süren lanet kaynağı yok; `curse` bayrağı ve Lanet Kıran kuralı hazır (`cleanseStatuses`).
- **Durum etkisi kaynakları:** düşmanlardan Joseph'e yalnızca goblin şamanının ateşi (yanma) var; yoldaşlara durum etkisi uygulanmıyor.
- **Kombo:** oyunda kombo sistemi yoktu; "kombonun son vuruşu" = 1,3 sn içinde ardışık 3. normal kılıç vuruşu.
- **Yıldırım Adımı:** kısa atılma (dash durumu, ~2–3 kare, yenilmezlik); duvarların içinden ışınlanmaz.
- **Rüzgâr Zırhı:** yalnızca düşman mermileri (şaman ateşi) sapar; yakın dövüş vuruşları etkilenmez.
- **Korku** 4 sn, **Meydan Okuma** yarıçapı 6 kare, **Nara** sendelemesi uyarı alanı göstermez (talimatta süre/yarıçap verilmeyenler).
- **Denge notu:** MP formülü büyüleri erken oyunda pahalı yapıyor (Kıvılcım 10 MP; Level 0'da MNA'sız max MP 0, Level 6 + 4 MNA → 18). Sayılar talimattaki gibi bırakıldı.
- Gerçek tablette denenemedi (yalnızca başsız tarayıcı).

## Grup 7'de yapılanlar (0.11.0)

Talimat: yeni dövüş sistemi (A1–A12), hatalar (B1–B8), oyuncu notları (C1–C16), kayıt yuvaları (D), geliştirici modu ve QA altyapısı (E), testler ve uçtan uca QA (F). Kayıt değişikliklerinin hepsi tek göçte (v9 → v10). Talimattan ayrıldığım yerler aşağıda **Kararlar**'da.

### A. Dövüş: hamle ve karşı hamle

Tablette yeni buton yok (Saldır, Ağır, Kaçış); yardımlı savaş her zaman açık. Saf kurallar `src/core/` altında, testleri `tests/g7combat.test.ts`.

- **A1:** `canInterrupt` ve `INTERRUPT_LOCKOUT_SEC` kalktı. Normal ve ağır vuruş hazırlığı kesmez; hasar verir, sendeleme barını doldurur. Hazırlığı yalnızca sersemleme ve durum etkileri (donma, sersemletme, felç) bozar (`Enemy.cancelWindup`).
- **A2:** `src/core/telegraph.ts`: `telegraphShape` (koni: yarıçap `(attackRange + 0,4) × karo`, ±0,9 rad; ağır saldırıda daire ×1,7; büyü/okta çizgi) ve `inTelegraph`. Şekil hazırlık başında kurulur ve kilitlenir; `strike()` hedefe yeniden dönmez, atılma kilitli yönde ve hasar alanını büyütmez. Kırmızı alan (`drawTelegraph`) ve hasar (`Enemy.strikeHits`) aynı şekli kullanır; yoldaşlara saldıranlarda da.
- **A3 sendeleme:** `src/core/stagger.ts` (kapasite tablosu talimattaki gibi, tabloda olmayan 4). 2 sn vurulmazsa saniyede 1 boşalır; dolunca 1,2 sn (boss 0,8) sersemleme: saldırmaz, yürümez, hasar ×1,5, hazırlık iptal ve saldırı hakkı bırakılır, bar sıfırlanır; sonraki 3 sn dolum yarıya iner. Görsel: can barının altında ince sarı çizgi (ilk vuruştan sonra), dolunca kısa parlama, sersemken başın üstünde dönen yıldızlar ve yalpalama (`EState 'stunned'`). Dolum tablosu aşağıda.
- **A4 saldırı sırası:** `src/core/attackQueue.ts`. Hedef başına ayrı sıra (Joseph ve her yoldaş). N: `forest_mid`, `forest_deep`, `north_woods`, `goblin_camp` 2, diğer bölgeler 1; boss kendi hakkı dışında en fazla 1 yardımcı. Hak hazırlık başında alınır; saldırı bitince, ölünce, kaçınca ya da sersemleyince bırakılır; en uzun bekleyen önce, saldırısını bitiren sıranın sonuna. Aynı hedefe iki vuruş arası en az 0,5 sn (`STRIKE_GAP`). Sırasını bekleyen yeni `'circle'` durumunda hedefin 2–3 kare çevresinde yavaşça dolaşır ve hedefe döner.
- **A5 ritim:** `src/core/rhythm.ts`. 1. ve 2. vuruş süre ×0,85, 3. vuruş ×1,35, hasar ×1,4, sendeleme 2, büyük savuruş. Sonraki basış savuruşun %55'inden bitişten 0,35 sn sonrasına kadar tamponlanır; %55'ten önceki basış yok sayılır; pencere kaçarsa zincir başa döner. 3. vuruştan sonra 0,3 sn yalnızca kaçış. `combo`/`comboAt` bu ritme dönüştü; Kılıç Ustalığı A-'nın `comboFinisher`'ı 3. vuruşun üstüne. Yay ritmin dışında.
- **A6 ağır saldırı:** basılı tut (K ya da Ağır butonu; tablette basma/bırakma olayları) → 0,5 sn'de dolan halka, hareket ×0,4; dolunca bırakınca ×1,8 hasar, sendeleme 3, dayanıklılık 18 (indirimlerle). Dolmadan bırakmak bedelsiz boşa gider; vurulmak ya da kaçmak iptal eder (`chargeStep`).
- **A7:** kusursuz kaçıştan sonra karşı saldırı penceresi 0,6 sn; içindeki ilk vuruş kesin kritik ve sendeleme 3 ("Karşı Saldırı!"). Kaçınma A- artık: "Karşı saldırı penceresi 0,6 → 1,0 sn ve karşı vuruş hasarı ×1,3" (`counterSkilled`).
- **A8:** kovalama hızı `def.speed × 0,75` (`chaseSpeed`); atılma ve tavşanın kaçışı aynı. Test: başlangıç Joseph'i fare, sümüksü ve ahır faresinden yavaş değil.
- **A9:** yumrukla fare 3, sümüksü 6 vuruş; sopayla 2 ve 3 (bkz. Kararlar). `creature.ts` yumruk tabanını artık `UNARMED_DAMAGE` sabitinden alır.
- **A10:** `LIGHT_ON_HIT` 7 → 3, sersemletme +10 (`LIGHT_ON_STUN`), kusursuz kaçış 14.
- **A11:** yoldaşların hedef puanı sersemlemiş düşmanı öne alır; düşmanlar yoldaşlara da A2/A4 kurallarıyla saldırır; yoldaş hasarı aynı.
- **A12:** Vera'nın dersleri (`src/data/lessons.ts`, `VERA_LESSON`) dünya içi dille: kırmızı alandan çıkmak, son anda kaçıp hemen vurmak, ritimle vurmak, gücünü toplayıp sendeletmek.

#### Sendeleme dolum tablosu

| Kaynak | Dolum |
| --- | --- |
| Normal vuruş (1., 2.) | 1 |
| Ritmin 3. vuruşu | 2 |
| Ağır saldırı (dolu şarj) | 3 |
| Karşı saldırı penceresindeki vuruş | 3 |
| Savuşturma (Kılıç Ustalığı karşı saldırısı) | 3 |
| Çift Kesik, Süpürme, Fırtına Dansı, Ateş Topu, Gök Gürültüsü, Yargı Işığı (Divine) | 2 |
| Delici Hamle, Gök Yaran, Buzul Mızrağı, Göğün Hükmü | 3 |
| Rüzgâr Kesiği, Kıvılcım, Cehennem Çemberi, Buz Kıymığı, Donduran Halka, Statik Ok ve tabloda olmayan teknikler | 1 |
| Işık Patlaması (Divine, çevreyi iter) | barı doldurur (99) |

Kaynak: `STAGGER_FILL`, `SKILL_STAGGER` (`src/core/stagger.ts`). Alan ve sürekli hasar 1, tek hedefe güçlü vuruşlar 2–3.

### B. Hatalar

- **B1:** `src/ui/toastStack.ts` (Phaser'sız): yeniden dizme yalnızca konumu tween'ler, alpha'ya dokunmaz; kaybolan bildirim işaretli; her bildirimin ömrü var (2,6 sn görünür + 0,4 sn kaybolma, en geç 4,2 sn'de yok edilir). Test ve QA: kaybolma sırasında HUD yüksekliği değişse de bildirim gider.
- **B2:** `src/ui/sysBox.ts` + `src/ui/sysLayout.ts`: satırlar ölçülen yükseklikle dizilir, kutu içeriğe göre büyür; satır başında türüne göre renkli simge (level, stat, SP, Max HP, skill rütbesi, yeni yetenek, para, eşya, görev, uyarı); başlıkta tür şeridi (level altın, skill mavi, Divine beyaz-altın, uyarı kırmızı, görev yeşil); "etiket · değer" biçimi; koyu opak zemin, ince altın kenar. Konum sol panel ile saat kutusunun arasında, sığmazsa altlarına iner (`sysPlacement`). `MenuScene.showNotice` aynı kutuyu kullanır.
- **B3:** `src/world/bubbleQueue.ts`: karakter başına sıra, balon karakteri izler; düşünce italik, yuvarlak köşeli ve "…" kabarcıklı, konuşma normal ve kuyruklu; yarı saydam koyu zemin.
- **B4:** `Director.scene()` hatayı yakalar: sahne kapanır (cutscene iner, diyalog kapanır, kamera Joseph'e döner), hata geliştirici hata kaydına (`src/game/errorLog.ts`) yazılır, `ensureMainQuest` zinciri sürdürür. `say/face/walk/pan` yok edilmiş aktörü sessizce atlar; sahnede kullanılan NPC'ler program yüzünden ayrılmaz.
- **B5:** yaratıkta Appraisal anahtarı tür kimliği (`m_rat`), kişide NPC kimliği (`appraisalKey`); göç eski `m_<uid>` anahtarlarını türe çevirir.
- **B6/C4:** `BootScene` pano dokusu yeniden çizildi (ahşap çerçeve, iğneli ilanlar, mühürler, küçük rozetler; "YARIN" yok).
- **B7:** iç mekânda kamera sınırına sağ üst HUD yüksekliği (saat/bölge kutusu, mini harita) ve QA'dan sonra sağdaki HUD sütunu da eklendi; oyuncu panonun ya da rütbe tahtasının önündeyken iki tahta da görünür (QA ölçümü). İç mekânda bölge kutusunda kısa ad ("Maceracılar Loncası").
- **B8:** C12'deki kart paneli.

### C. Oyuncu notları

- **C1:** son vardiya gecesi ziyafet: Tokluk 100 ("Bertram'ın ziyafeti: Tokluk 100"). `src/core/spendLock.ts`: loncaya kaydolana kadar alış, yemek, yatak engelli; "ÖNCE LONCA — Maceracılar Loncası'na kaydolana kadar paranı harcayamazsın. Kayıt ücreti bir gümüş."; kayıt ücreti ve satış serbest. Göç: kayıtsız eski kayıtlarda `spend_free` (kilit yok). Test: kayda kadar vardiya yemekleri, ziyafet, Haldor'un ekmeği ve elmalarla Tokluk normale çıkar.
- **C2:** prologda "Geç »" yok; dokunma ve klavye yazıyı geçmez; satırlar `readTimeMs` (2,2 sn + harf başına 45 ms) sonra kendiliğinden ilerler, Status ~8 sn. Tek etkileşim "TRAIT ÇEVİR". Dünyada ilk yürümeye kadarki iç sesler ve uyanış sahnesi `UIScene.setAutoFlow` ile kendiliğinden akar; bu sürede menü, Appraisal ve saldırı etkisiz, joystick sahne bitince açılır.
- **C3:** Yardımlı savaş, ekran sarsıntısı/vuruş donması ve silahı sırta koyma ayarları kalktı, hep açık (`REMOVED_SETTINGS`, ayar sürümü 5).
- **C4:** rütbe paleti ayrıldı (`RANK_BG/EDGE/TEXT`, `src/ui/rankPalette.ts`): G kahverengi, F demir grisi, E bronz, D gümüş, C yeşim, B safir, A altın, S kızıl yakut, X mor. Rozet atlası `tools/build_uiicons.py --ranks-only` ile yeniden üretildi; rütbe tahtasında 9 rozet yan yana.
- **C5:** terfi animasyonu atlanamaz; bitince "Kapatmak için dokun", otomatik kapanma yok. Görev bitiş animasyonu aynı (`overlayRules`).
- **C6:** `m_celebrate` hana herhangi bir saatte girilince başlar (Vera ve Lina zorla yerleştirilir); İlk Kadeh bitip handan çıkılınca kâhyanın sahnesi ve `m_theft` (kâhya ve şüpheliler yerleştirilir, görev bitene kadar ayrılmaz). `m_next_day` başlığı "Dışarıdaki Gürültü". Zincir tablosu aşağıda.
- **C7:** her Divine level atlamada altın ışık sütunu, parçacıklar, 2 sn aura ve küçük "DIVINE LEVEL N" (`Director.divineLevelFx`); oyunu durdurmaz.
- **C8:** `src/core/partyZone.ts` (veriden görev bölgeleri: `m_wounded`, `f_wolves`, `f_cellar`). Yoldaşlıyken yalnızca görevin kapıları açık; diğerlerinde Vera'nın üç repliği sırayla. Bölgenin dışına çıkınca Vera uyarır; ~8 kare ya da 10 sn daha uzaklaşınca ekran kararır, grup rotaya döner.
- **C9:** yeni hedef (kişi ya da yaratık türü) tam EXP, beklemesiz; incelenmiş hedef 1/5, günde bir, 10 sn bekleme; taban ×0,5 (`APPRAISAL_BASE_SCALE`, `claimAppraisalExp`).
- **C10:** `challengeRate` ÷3 (talimattaki tablo), seri bonusu en fazla ×1,5 (test), antrenman [4, 10] ve performansa göre. Simülasyon sonucu aşağıda.
- **C11:** `src/core/minigameRules.ts`: 0,4 sn savuruş kilidi, ıska −1 sn ve kırmızı parlama, hasat 22 sn'de 10 demet, odun 24 sn'de 10 kütük, taş sürenin %60'ı bölgede, koşuda 0,12 sn'den sık basış hızı düşürür. Kaybedince "Kaybettin" + "Tekrar dene" (antrenmanda ayrıca "Bırak": EXP yok, seans sayılmaz). Haldor yalnızca başarıda öder.
- **C12:** ilk SP'de isteğe bağlı "Sistem Teklifi'ni dene" amacı, HUD menü düğmesi parlar, Status'taki düğme vurgulu; ilk açılışta sistem açıklaması. `panelChoice` yeniden: tam ekran karartma, 2:3 opak kartlar (simge, ad, nadirlik etiketi, açıklama, şans çubukları ya da rütbe tablosu, düğme; `cardLayout`), başlık ve "Vazgeç"/"Hiçbirini seçme" ayrı; "Hiçbirini seçme"de onay.
- **C13:** yeni kayıtta kırmızı "!" (dokununca `seen`), tür sekmelerinde ve menüdeki Ansiklopedi düğmesinde sayı rozeti; listede ad kutusunun sağında rütbe rozeti; Appraisal anlık kaydı (`personSnapshot`, kart altında "Appraisal: G- ile incelendi · 4. gün"), yeniden incelemede güncellenir, göçte bir kez oluşturulur; tür ve bölge sayaçları; bilinenler önce (alfabetik); kendi simgesi.
- **C14:** trait satırı yalnızca görülebiliyorsa (panel ve Ansiklopedi); yaratıkta hiç yok.
- **C15:** rütbenin bir harf altı %25 (aşağı yuvarlanır), iki ve daha fazla altı 0; grupta önce %50 (`questPointsFor`); pano ve bitiş animasyonunda gerçek puan ("rütbenin altında"). Yeni `RANK_THRESHOLDS` talimattaki gibi; rütbe düşürülmez.
- **C16:** `src/world/lootFx.ts` + `lootRules.ts`: nabız gibi atan halka, ara sıra parıltı; sıradan beyaz-sarı, para altın, özel altın ışık sütunu; son 15 sn yanıp söner; en çok 20 efekt (havuz).

### D. Kayıt yuvaları

`src/core/slots.ts` (Phaser'sız) + `src/ui/slotPicker.ts`. 3 yuva, otomatik kayıt oynanan yuvaya (`G.slot`, `elonth.slot.N`). Başlık: "Devam" son oynanan yuva; "Yeni Oyun" yuva seçimi (özet: level, rütbe, gün, son kayıt zamanı ya da "Boş"; dolu yuvada "Yuva 2'deki kayıt silinecek ve yerine yeni oyun yazılacak. Emin misin?"); "Yükle". Oyun içinde "Kaydet" oynanan yuvaya, diğer yuvalar "Yükle". Göç bir kez: `auto` → Yuva 1, `manual1` → 2, `manual2` → 3; `manual3` "Eski kayıt" olarak listelenir, yüklenince yuva seçtirilir; eski anahtarlar silinmez.

**v10 göçü** (`migrateV9toV10`): Appraisal anahtarları türe, kayıtsız oyuncuya `spend_free`, Ansiklopedi anlık kayıtları (o anki Appraisal rütbesiyle).

### E. Geliştirici modu ve QA altyapısı

- **Kontrol noktaları** (`src/story/checkpoints.ts`): Uyanış sonrası, Bertram'ın işi bitti, Hasat bitti, Loncaya kayıtlı (pano açık), Vera-Lina dostluğu sonrası, İlk Kadeh, Hırsızlık bitti, Kapı. Her nokta yeni oyundan kurulur: biten görevler sırayla ve `QUEST_EFFECTS` (bayraklar, eşyalar, para, lonca, Ansiklopedi), sıradaki ana görev, saat, level, puan, konum. Geliştirici "Tamamla" da `QUEST_EFFECTS`'i uygular (Grup 6'daki bilinen sorun: `bertram_done` kurulmuyordu).
- **Panel:** ışınlan (harita/nokta listesi, görev hedefine), ölümsüzlük, tek vuruş, yaratık doğur, bölgeyi yeniden doğur, hata ayıklama katmanı (saldırı alanları, sendeleme, sıra hakları), saat ×4 ve durdur, skill ekle/rütbe, Divine ±, SP +1, haftadan bağımsız Sistem Teklifi, eşya ekle, Ansiklopedi aç/sıfırla, aranabilir bayrak/sayaç görüntüleyici, kaydı JSON olarak kopyala/yapıştırıp yuvaya yükle, hata listesi (yığın izi, Kopyala, Temizle). Geliştirici modunda ekranın üstünde kırmızı hata sayacı (dokununca Geliştirici sekmesi).
- **`window.__qa`** (`src/game/qaApi.ts`; `?qa=1` ya da geliştirici modu): belgesi README'de.

### Kararlar (belirsiz kalanlar ve talimattan ayrıldığım yerler)

- **A9 yumruk:** `UNARMED_DAMAGE` [1, 1] kaldı. L0 Joseph'te Divine Güç ×0,5 uygulandığı için etkin vuruş zaten 0,5 (fare 1,5 HP → 3, sümüksü 3 HP → 6 vuruş; QA ölçümü). Taban 0,5 yapılsaydı vuruş 0,3'e yuvarlanır, fare 5 / sümüksü 10 vuruşa çıkardı; talimattaki beklenen sayılar esas alındı.
- **C15 eşikleri:** G eşiği 40 → 60 olduğundan `f_wolves` sonrası G'ye yetmeyen puan artık sık görülür; `m_gpoints` adımı (panodan G ilanları) bunu karşılar, metinler eşiği `RANK_THRESHOLDS[1]`'den alır.
- **C6:** hırsızlık sahnesi, İlk Kadeh bittikten sonra hanın kapısından dünyaya çıkıldığı anda başlar (`theft_day` kapısı tamamen kalktı). `m_next_day` adımı yalnızca "Handan çık" amacı olarak kaldı, başlığı "Dışarıdaki Gürültü".
- **Sendeleme dolumu:** yeteneklerin değerleri yukarıdaki tabloda; Işık Patlaması (Divine) barı doldurur.
- **B7:** iç mekânda kamera sağdaki HUD sütununu (196 birim) da hesaba katar; talimat yalnızca sağ üst kutuyu söylüyordu, QA'da panonun sağı yuvarlak düğmelerin altında kaldı.
- **Kontrol noktaları:** her nokta yeni bir oyundan kurulur (önceki duruma eklenmez); noktalar arası günler biten görev sayısına göre dağıtılır. `checkpoint()` UI sahnesini de yeniden kurar (önceki durumun açık panelleri taşınmaz).
- **Tek kayıt göçü (v9 → v10)** B5, C1, C13'ü kapsar; yuva göçü (D) kayıt verisi değil anahtar düzeni olduğundan ayrı ve bir kez (`elonth.slot.migrated`).

### Zincir saat denetimi (C6 sonrası)

`CHAIN_TABLE=1 npx vitest run tests/chainTimes.test.ts`. Açıklamasız kilitlenme yok.

| Geçiş | İlk amaç | Günün saatleri |
|---|---|---|
| (uyanış) → m_inn | Brindlewood'daki hana git | 00–00 hemen |
| m_inn → m_bertram | Handa çalış (Bertram'la konuş) | 00–06 bekle (uyku) · 06–15 hemen · 15–00 bekle (uyku) |
| m_bertram → m_harvest | Yaşlı Haldor'u bul | 00–06 bekle (uyku) · 06–16 hemen · 16–00 bekle (uyku) |
| m_harvest → m_register | Bir gümüş biriktir (100 bronz) | 00–05 bekle (uyku) · 05–00 hemen |
| m_register → m_weapon | Handa Bertram'la konuş | 00–05 bekle (uyku) · 05–00 hemen |
| m_weapon → m_board | Loncaya dön, panodan görev al | 00–05 bekle (uyku) · 05–00 hemen |
| m_board → g1_rats | Ahırdaki fareleri temizle | 00–00 hemen |
| m_grank → m_air | Ormanın kenarına yürü | 00–00 hemen |
| m_air → m_wounded | Lina'yı taşı; Vera'yla şifacıya git | 00–00 hemen |
| m_wounded → m_vl_rest | Vera ve Lina'yı bul | 00–00 bekle (uyku) |
| m_vl_rest → f_wolves | Vera ve Lina'yla otlağa git | 00–00 hemen |
| f_wolves → m_celebrate | Hana git | 00–00 hemen |
| m_celebrate → m_next_day | Handan çık | 00–00 hemen |
| m_next_day → m_theft | Şüphelileri incele (Appraisal) | 00–00 hemen |
| m_theft → m_vl_cellar | Vera ve Lina'yla konuş | 00–00 bekle (uyku) |
| m_vl_cellar → f_cellar | Değirmene git | 00–00 hemen |
| f_cellar → m_silver | 10 gümüş biriktir (1.000 bronz) | 00–05 bekle (uyku) · 05–00 hemen |
| m_silver → m_farewell | Handa Bertram'la konuş | 00–05 bekle (uyku) · 05–00 hemen |
| m_farewell → m_gate | Kaptan Roderick'ten giriş kartı al (10 gümüş) | 00–00 hemen |

Değişen iki satır: `f_wolves → m_celebrate` (eskiden 00–18 bekle) ve `m_celebrate → m_next_day` (eskiden ertesi güne bağlı).

### Divine simülasyonu (C10)

`tests/g7.test.ts` ("kaba simülasyon"): her gün o anki levele uygun yaratıktan 20 öldürme (seri bonusuyla), 3 antrenman (ortalama performans, [4, 10]), görevlerden 20 EXP. Sonuç: **Divine 1'e normal level ≈ 2,96'da (5. gün) ulaşılır** (test 2,5–3,5 aralığını denetler).

### Testler

653 → 747 (29 dosya). Yeni: `tests/g7combat.test.ts` (A: kırmızı alan = hasar alanı, yön kilidi, sendeleme dolum/boşalma/sersemleme/sonrası, saldırı sırası, ritim penceresi ve tampon, şarj, karşı pencere, kovalama hızı, yumruk sayıları, Işık), `tests/g7.test.ts` (B1 ömür, B2 düzen ve simgeler, B3 sıra, B5/C9 Appraisal, C1 harcama kilidi ve Tokluk, C2 okuma süresi, C3 ayarlar, C4 palet, C5, C8 bölge ve kapı, C10 oranlar ve simülasyon, C11 mini oyun kuralları, C12 kart düzeni, C13 anlık kayıt ve sayaçlar, C15 indirim ve eşikler, C16 ganimet, D yuvalar ve göç, v10 göçü, hata kaydı, Vera'nın dersi), `tests/g7dev.test.ts` (kontrol noktaları: konum, sıradaki görev, göçten geçme; "Tamamla" yan etkileri; hata sayacı). Kurallar değiştiği için güncellenenler: `combat` (kesme kuralı kalktı), `divine` (oranlar, öldürme sayıları), `systems` (Appraisal EXP), `chapter2`/`v3core`/`g5b`/`g6` (rütbe eşikleri ve puanlar), `chainTimes` (C6).

### Uçtan uca QA (başsız Chromium, 1280×854, DPR 1, üretim derlemesi)

`npm run build && npx vite preview --port 4173 &` ve `URL='http://localhost:4173/?qa=1' DPR=1 OUT=tools/qa/g7 node tools/qa/shot.mjs g7` (`ONLY=d,cp,combat,b,c`). Betik `window.__qa` kullanır. Son tam tur: **bütün denetimler ✓, konsolda hata ve uyarı yok.** Ekran görüntüleri `tools/qa/g7/` (128 renk):

- **D:** boş Yuva 2'ye Yeni Oyun onaysız başladı (`g7_d_slot_picker_empty`), otomatik kayıt Yuva 2'ye (4. gün), dolu yuvada onay (`g7_d_slot_picker_filled`, `g7_d_overwrite_confirm`), Vazgeç ile başlamadı.
- **E:** 8 kontrol noktası; her birinde sıradaki görev amacı ve ok hedefi doğru, hata kaydı boş (`g7_e_cp_*`).
- **A1** hazırlanırken vurulan fare saldırısını sürdürdü (windup → strike). **A2** Joseph her karede (postupdate) yerinde tutularak: yanda ve arkada vurulmadı, içinde vuruldu (`g7_a2_inside_hit`). **A4** üç fare: aynı anda en çok bir saldırı, diğerleri dolaşıyor (`g7_a4_queue_circling`, hata ayıklama katmanıyla `…_debug`). **A5** oyun saatiyle 3,5 sn sürekli basış: 6 vuruş, her ara ≥ savuruş süresi, 3. vuruş geldi. **A3** sersemleme (`g7_a3_stunned`). **A6** şarj halkası (`g7_a6_charge_ring`), dolu bırakınca ağır vuruş. **A7** 0,60 sn pencere, ilk vuruş kesin kritik. **A9** yumrukla level 0 fare 3, sümüksü 6 vuruş.
- **B1** kaybolan bildirim HUD boyu değişirken yok oldu. **B2** uzun satır (`g7_b2_long_line`), art arda level/skill/Divine (`g7_b2_seq_*`), menüde (`g7_b2_menu_notice`): yazılar çakışmıyor ve taşmıyor, kutu panellere binmiyor. **B3** iki iç ses sırayla, aynı anda tek balon. **B7** pano ve rütbe tahtasının önünde ikisi de HUD dışında (`g7_b7_guild_*`), kısa bölge adı.
- **C1** kayıt öncesi harcama engeli, ziyafet Tokluk 100. **C6** İlk Kadeh 10:00'da başladı (`g7_c6_celebrate_morning`), masaya oturulunca bitti, handan çıkınca hırsızlık (`g7_c6_theft_start`). **C7** Divine level ışığı (`g7_c7_divine_aura`). **C8** yoldaşlıyken han kapısı kilitli, Vera'nın repliği (`g7_c8_party_door`). **C9/B5** anahtar `m_rat`, ikinci fare daha az EXP. **C13** sayaçlar, "!" ve "Appraisal: G- ile incelendi · 4. gün" (`g7_c13_codex_rat`). **C11** "Kaybettin", "Tekrar dene", "Bırak" (`g7_c11_minigame_lose`). **C12** menü düğmesi parlıyor (`g7_c12_menu_button_glow`), Status düğmesi, ilk açıklama (`g7_c12_offer_intro`), SP kartları (`g7_b8_offer_cards`; 41 yazı, çakışma yok). **C4** rütbe tahtası ve pano (`g7_c4_*`). **C16** ışıltı ve ışık sütunu (`g7_c16_loot_glow`), son 15 sn yanıp sönme, ömür sonunda kalkma. **C2** prologda "Atla" yok, dokunmak ilerletmiyor, yazılar trait çarkına kendiliğinden aktı (`g7_c2_trait_wheel`).

QA'nın bulup düzelttikleri: loncada panonun sağı yuvarlak düğmelerin altında kalıyordu (kamera sağ HUD sütununu da hesaba katıyor); kontrol noktası önceki durumdan kalan Divine skill seçim panelini taşıyordu (UI sahnesi de yeniden kuruluyor); kontrol noktaları Sistem Teklifi açıklamasını atlatıyordu (`offer_intro` artık kurulmuyor); açıklamanın son satırı "etiket · değer" olarak bölünüp garip görünüyordu (yeniden yazıldı); `m_next_day`'in "Ertesi Gün" başlığı C6'dan sonra yanlıştı; hata ayıklama katmanında Joseph'in etiketi düşman etiketleriyle çakışıyordu (baş üstüne alındı).

### Elle denenemeyenler / basitleştirilenler

- Gerçek tablette denenmedi; Ağır butonunun dokunmatik basılı tutması yalnızca kodla (QA'da klavye K).
- Sersemleme, kusursuz kaçış ve yumruk sayıları QA'da oyunun kendi çağrılarıyla (`hitEnemy`, `perfectDodge`) zorlandı; mini oyun kaybı süre ilerletilerek. C5 terfi animasyonu, C8'in "rotaya dönüş" kararması, uyanış sahnesinin kendiliğinden akışı ve "Eski kayıt" yükleme akışı bu turda ekranda denenmedi; birim testleriyle doğrulandı.
- Geliştirici panelinin düğmeleri QA'da tek tek tıklanmadı; aynı işlevler `window.__qa` üzerinden kullanıldı.
- Divine simülasyonu kaba bir modeldir (sabit öldürme ve antrenman sayıları).

## Grup 6'da yapılanlar (0.10.0)

Talimat: hatalar (A1–A7) ve oyuncu notları/kararları (B1–B23). Dövüş sisteminin kökten değişimi bu grupta yok; yalnızca sayısal denge ve geri bildirim. Sayılar talimattaki gibi; ayrıldığım yerler aşağıda **Kararlar**'da.

### A. Hatalar

- **A1/B4 kaydırma jesti:** `src/ui/dragGesture.ts` (`DragGesture`): sürükleme bilgisi jestin basış zamanına (`pointer.downTime`) bağlı; `wasDrag()` yalnızca **aynı** jest sürüklendiyse doğru. `Button`'ın `stopPropagation`'ı artık eski jestin bayrağını taşıtmıyor. `ScrollList` (Konuşmalar, dükkân, Görevler, Ayarlar, Ansiklopedi) bunu kullanır. Konuşmalar'da "Daha fazla göster" 40 satır ekler, görünüm yerinde kalır (QA: yukarı sürükle → bas → 40 → 80 → 120).
- **A2 saat ilerletme:** `Director.advanceClock(dk)` gün değişince `R.onNewDay()` + `director.onNewDay()` çağırır; hasat ve antrenman bunu kullanır (öğretmen dersleri B17 ile kalktı).
- **A3 zincir saatleri:** aşağıda "Zincir saat denetimi". `m_bertram` beklemesi (bugün çalışıldı ya da ≥ 15:00 → "Bertram yarın 06:00'da iş verir — yatakta uyuyarak atlayabilirsin"), `m_celebrate` davet gününe bağlı (`celebrate_day`; 18:00–02:00 akşam penceresi, kaçırılırsa ertesi akşam), `weaponScene` ve `boardOpening` metinleri saate göre ya da saatten bağımsız, `BOARD_EXCUSES` ve "pano yarın" metinleri kalktı (test). Hikâye kapıları saf modülde: `src/story/gates.ts` (`storyGate`).
- **A4 stat ipuçları:** `src/core/statText.ts` ipuçlarını `STAT_RULES`'tan üretir (her sayı gerçek formülden; test).
- **A5:** Vera'nın dersi dünya içi dille (B5).
- **A7 (oynayarak bulunanlar):**
  1. Vardiya sonrası ok merdivene, alt görev "Yukarı çık ve uyu" (B1).
  2. İç mekânda ok her zaman bir geçişe yönelir: `src/world/nav.ts` `firstHop` harita geçiş grafiğinde (kapı + merdiven) BFS; tavan arasında ok merdivene. Test: bütün iç mekânlar × "hedef başka haritada" → ok null değil.
  3. Ücret gecesi: Bertram'ın metni saate göre ("yarın sabah erkenden"), Haldor kapalı saatte "Hasada başla" seçeneğini hiç sunmaz ("Sabah altıda gel, orak hazır olur."), `m_harvest` 16:00–06:00 arası açılırsa bekleme + uyku yönlendirmesi.
  4. Bekleme metni yatak varsa "— yatakta uyuyarak atlayabilirsin" ekler (her zaman); öğretici bir kez (B3).
  5. `m_grank` (ve `custom` amacı bir alt göreve bağlı her amaç) alt görevin **şu anki** amacının hedefini gösterir (`questTargetOf`, test).
  6. Ot toplama oku en yakın **toplanmamış** noktaya (`nearestSpot`), bölge noktası yedek.
  7. Kamera: küçük iç mekânlarda kamera sınırına HUD payları (sol üst panel genişliği) eklenir; harita ekrandan küçükse ortalanır. QA: `inn` (5,3) ve (2,5) — oyuncu görev panelinin altında değil.
  8. (a) Başlangıç ipuçları ekranın alt ortasında (`hintBottom`); (b) mini oyun açılırken diyalog kutusu kapanır; (c) görev ilerleme bildirimi panelin altına yeniden dizilir (`toast relayout`).
  9. `m_inn`'e "Vera'yı Appraisal ile incele" amacı eklendi; öğretici sırasında HUD'da görev var.
  10. Etkileşim alanları: prop'un kapladığı karelerin en yakını (`distToRect`), yatak için 52 px erişim (`BED_REACH`); tavan arasında (5,4) ve (5,5; yukarı) "Uyu" (QA ✓).
  11. HP/dayanıklılık/MP yenilenmesi ve hasar iki ondalığa sabit (`round2`, `regenStep`).
  12. Dövüş zorluğu: B5 + B11 (sopa ile fare 2 vuruş, QA ✓).
  13. Servis: ilk müşteri 2,8 sn gecikmeyle ve ilk siparişin sabrı ×1,35 (`firstDelay`, `firstPatienceMult`).

### B. Oyuncu notları

- **B1 uyku yönlendirmesi:** `Director.questGuides()` aktif ana görevin altına dinamik, isteğe bağlı yönlendirme amaçları ekler (adım görevi değil; `ensureMainQuest` kapatmaz). Görev bir saati bekliyorsa ve yatak varsa: handa "Yukarı çık ve uyu: merdivenden tavan arasına çık" (ok merdivene), tavan arasında "…: yatağa yat" (ok yatağa), uyanınca kapanır; sabah tavan arasında ok aşağı merdivene. Ücret gecesinden sonra aynı yönlendirme Haldor beklemesinde.
- **B2:** A3. Genel kural `tests/chainTimes.test.ts` ile denetleniyor.
- **B3 öğreticiler (isteğe bağlı, bir kez):** `ObjectiveDef.optional` (görevin bitmesini engellemez, listede "(isteğe bağlı)"; `allObjectivesDone`/`currentObjective`/`visibleObjectives`/HUD/Görevler sekmesi biliyor). Pano: yan görevler açıldıktan sonra "Lonca panosundan ilan al — her sabah yeni ilanlar, G 15–40 / F 60–90 bronz, aynı anda en fazla 3" (ok panoya), panonun menüsü açılınca biter (`tut_board`); Celeste yan görevler açılınca panoyu bir kez daha açıkça anlatır. **Uyku öğreticisi `m_harvest`'e bağlandı** (ücret gecesi, Haldor 06:00 beklemesi; ilk karşılaşılan bekleme bu): "Beklemeyi uyuyarak atla: yatakta 'Görev saatine kadar uyu'" — o seçenek seçilince biter (`tut_sleep`). `m_bertram` vardiya gecelerinde "Yukarı çık ve uyu" kullanır.
- **B5:** yaratık HP'si `hpByLevel` (level başına doğrudan değer, ×1,5 tablo, bir ondalık); Vera'nın dört dersi dünya içi dille (kaçış, kuşatma, nefes yerine "ilk vuruşu sen vur"/gözünü ayırma), "Yardımlı savaş" ipucu kalktı.
- **B6:** `guildBarLabel(points, rank)` (`core/guild.ts`): "puan / sonraki eşik", çubuk oranı aynı; Lonca Kartı ve görev bitiş animasyonu aynı etiketi kullanır.
- **B7:** yan görev EXP'leri ×2, `BOARD_EXP` G 6 / F 12. EXP kuralı testi: aynı dakikada av ≥ görev.
- **B8:** orman açıklıkları (`gladeNoise`, eşik 0,53): ormandaki ağaç 268 → 158 (−%41), toplam dekor 2573 → 2214; kenar ormanı, köy çevresi, ot kümesi, elmalar ve doğma yerleri korundu.
- **B9 beş stat:** bkz. README tablosu ve `STAT_RULES`. Max HP = (10 + 8×L) × (1 + 0,08×VIT), bir ondalık; dayanıklılık 50 + 5×VIT + 3×AGI; level başına 4 puan. LUK görünür: `luckOutcome(zar, taban, LUK'lu)` → "Şans!" (ıska, kritik, ganimet, çift toplama; yonca simgesi). NPC'ler 4×Level (DEX→AGI, MNA→INT, ×4/6, artık ana stata; test). Eşyalar/unvanlar DEX→AGI, MNA→INT. Yay hasarı AGI'den. Joseph 10 HP, fare 8 ısırıkta.
- **B10:** tavşan 2,8; `src/world/sources.ts`: yalnızca yaşayan doğma grupları (`spawnAlive`), son yaratık ölünce ok anında sonraki bölgeye, hiçbiri yoksa "<Yaratık> kalmadı. Yeniden doğuş: bugün/yarın HH:MM" (`until: null` → uyku menüsünde görünmez; test). Toplamada noktalar ve düşüren yaratıklar birlikte; ikisi de tükenince en erken dönüş.
- **B11:** `ATTACK_RATE_SCALE = 0.75` (yaratık bekleme ÷0,75, kesilme sonrası da), `COMPANION_COOLDOWN` [2,93, 3,73]; hazırlık süreleri aynı.
- **B12:** 2 vardiya; servis yeni 1. gün = eski 2. gün, yeni 2. gün = eski 3. gün; **Çöp** bölmesi (`discardFood`: yiyecekler atılır, tabak atılmaz → "Tabaklar bulaşığa!"); metinler 2 güne göre; göç (1/3 → 1/2, ≥ 2/3 → iş bitmiş, ücret sonraki Bertram konuşmasında bir kez).
- **B13 Tokluk:** `src/core/hunger.ts` (sayılar tek yerde). HUD barı, Status, eşya açıklamasında "+N Tokluk", "Tokum." (95+), hızlı yeme ve kullanım menüsü `bestFood` (ihtiyacı aşmayan en büyük). Bertram'ın vardiya günü yemeği (bkz. Kararlar), Haldor'un ekmeği. Göç: alan yoksa 80. Parasız oyuncu elma ağaçlarıyla (her gün) normale çıkabilir.
- **B14:** `boardDaysLeft`, `deadlineLabel` ("2 gün kaldı", "Son gün!"), `deadlineNotice` (son gün sabahı ve 18:00'de bir kez, gerçek ceza tutarlarıyla); HUD'da son gün başlık turuncu.
- **B15 Ansiklopedi:** `core/codex.ts` (veri, kartlar, sayfalar; genel yapı: tür + bölge + bilinme + kart), `ui/codexTab.ts`. Bölgeler: "Brindlewood ve Çevresi", "Eros" (kilitli "???"). Yaratık Appraisal ile, kişi ilk konuşmada (Appraisal ile ek bilgi), bitki ilk toplamada; "Ansiklopediye eklendi: <ad>". Göç: Appraisal geçmişi, toplama sayaçları, tanışma bayrakları.
- **B16:** yeniden doğma 720 dk (Goblin Şefi dahil); `world/mapMarkers.ts`: keşfedilmiş alanlarda toplama kümeleri (yarıçap 5 karo; tükenmişse soluk + "yarın"), yaratık bölgeleri (bilinmiyorsa "?", tükenmişse soluk + "dönüş HH:MM"), takip edilen görevin hedefi. Harita: filtre düğmeleri, lejant, dokununca bilgi balonu; mini harita aynı işaretler.
- **B17:** skill yalnızca Sistem Teklifi: öğretmen dersleri (`LESSONS`), kitaplar (dükkân ve drop; şamanın özel ganimeti artık Küçük MP İksiri), gizli keşifler (`HIDDEN_DISCOVERIES`, `pendingDiscoveries`, `declined_*`/`postponed_*`) kalktı; `learnSkill` başka kaynağı reddeder (test). Göç: envanterdeki kitaplar silinir, alış fiyatı iade edilir (`REMOVED_BOOKS`: Ateş Kitabı 450, Kıvılcım Parşömeni 100, Okçuluk 90, İlk Yardım 60 bronz), bir kez bildirilir.
- **B18:** yol bulma ve otomatik yürüme yok; yalnızca A7.2.
- **B19 trait çarkı:** `core/traitWheel.ts` (`TRAIT_ODDS` toplamı 100, sonuç hep `divine_paladin`, makara son kart X ve önünde A), `PrologueScene.traitWheel` ("Status'un oluşturuluyor…"dan sonra, `statusReveal`'dan önce). Açıklama gerçek veriden (`divineDescription`). Sonuçta olasılık tablosu ve diğer kartlar söner (QA'da kartın tabloyla çakıştığı görüldü, düzeltildi). `TRAIT_NAMES` ~21 ad (yalnızca görüntü). Status → Traits'e dokununca aynı açıklama (`ui/traitInfo.ts`).
- **B20:** ilk hareket girdisinde `divineAwaken` (tek seferlik `dp_awaken`): adım, tökezleme (eğilme + çökme), ses, sarsıntı (ayara bağlı), kenar kızarması, iç ses; altın ışık sütunu ve parçacıklar, ekranda "DIVINE PALADIN — X" kartı, 2 sn aura; doğrulma ve ikinci iç ses. Göç: `woke` olan eski kayıtlarda `dp_awaken = true`.
- **B21:** Bertram (ücret gecesi), lonca taşı ("Trait: —"), Celeste ("Trait'in yok. Çoğunun yoktur…"), Joseph'in iç sesleri (ilk koşu/yorgunluk, ilk level, ilk Divine Level, ilk Uyanış), Ilse Nine'nin masalı; birkaç NPC'ye küçük trait (Vera Gümüş Dil, Lina Keskin Kulaklar, Bertram Demir Karaciğer …); Appraisal'da trait farkı ≤ −1 ise görünür, değilse "???".
- **B22:** koşu ücretsiz (`RUN_STAMINA_PER_SEC = 0`, kilit ve yenilenme gecikmesi kalktı); Atletizm: koşu hızı +% ve dayanıklılık yenilenmesi +%.
- **B23:** `world/combatFx.ts`: vuruş donması 0,05/0,09 sn (Ayarlar → "Ekran sarsıntısı ve vuruş donması" ikisini birlikte kapatır), havuzlu sayılar (en çok 24; kritik büyük sarı, direnilen gri, ıska, Joseph'in aldığı kırmızı), yerinde sarsılma + ezilip açılma (0,1 sn, geri itme yok), malzemeye göre parçacık ve isabet sesi (et/sümük/zırh) + kritik çınlaması, saldırı hazırlığında 4 px geri çekilme ve "!", kaçış gölge izi, kusursuz kaçışta 0,2 sn ağır çekim, vurulunca kenar kızarması (hasar oranıyla), can %25 altında kalp atışı ve vinyet. Titreşim yok.

### Kararlar (belirsiz kalanlar ve talimattan ayrıldığım yerler)

- **Tek kayıt göçü (v8 → v9)** B9, B12, B13, B15, B17 ve B20'nin hepsini kapsar (talimat her birinde "+1" diyor; aynı sürümde art arda olduğundan tek sürüm yeterli).
- **Bertram'ın vardiya yemeği:** talimattaki sayılarla (40 Tokluk ile başla, saatte −4, vardiya 07:00 → 21:00) yeni oyunun Joseph'i ilk vardiyanın ortasında 0'a düşüp "Çok aç!" uyarısı alıyordu (QA'da görüldü). Vardiya günlerine bir **öğle yemeği (+30)** eklendi; akşam güveci +40 aynı (`SHIFT_LUNCH`, `shiftSatiety`; ilk gün 40 → 54, ikinci gün de "Tok" biter; test). Eski "ilk günün güveci bedava" mekanizması bu otomatik yemekle değişti.
- **Uyku öğreticisi** `m_harvest`'e bağlı (yukarıda). `m_vl_rest` beklemesinde öğretici tekrar etmez, kısa ek metin her zaman var.
- **Yay hasarı AGI** ile; Goblin Şefi de 12 saatte döner; `m_celebrate` akşam penceresi 18:00–02:00; Appraisal'da trait görünürlüğü fark ≤ −1; vuruş donması "ekran sarsıntısı" ayarıyla birlikte kapanır; yaratık dayanıklılığı kullanılmadığından eklenmedi; hızlı yeme düğmesi: atanmış yiyecek varsa o, yoksa `bestFood`.
- **Atletizm'in koşu bedeli pasifleri** koşu hızı ve dayanıklılık yenilenmesiyle değiştirildi.

### Hikâyede önemli NPC'ler (B9)

| NPC | Level | 0.9.0 statları (toplam) | 0.10.0 statları (toplam = 4×L) | Max HP 0.9.0 → 0.10.0 | Trait |
| --- | --- | --- | --- | --- | --- |
| Vera | 3 | STR 8, VIT 4, AGI 3, DEX 3 (18) | STR 5, VIT 3, AGI 4 (12) | 61 → 42,2 | Gümüş Dil |
| Lina | 3 | DEX 8, AGI 6, VIT 3, LUK 1 (18) | VIT 2, AGI 9, LUK 1 (12) | 53 → 39,4 | Keskin Kulaklar |
| Celeste | 4 | INT 9, MNA 6, DEX 4, AGI 5 (24) | AGI 6, INT 10 (16) | 37 → 42 | — |
| Bertram (örnek) | 9 | STR 18, VIT 15, AGI 4, DEX 11, INT 3, LUK 3 (54) | STR 12, VIT 10, AGI 10, INT 2, LUK 2 (36) | — → 147,6 | Demir Karaciğer |

Max HP'ler eşyasız/unvanlı türetilmiş değerdir (eşya ve unvan bonusları dahil). Yaralılar sahnesi `maxHp × 0,25` ile Vera ~10,6, Lina ~9,9 HP'de başlar.

### Zincir saat denetimi (A3/B2)

`tests/chainTimes.test.ts`: zincirdeki her geçişte (önceki görev bitti → sıradakinin ilk amacı) günün 24 saati için: amaç hemen yapılabilir mi (NPC programı `nextReach`, bina saatleri, hikâye kapıları `storyGate`), değilse bekleme saati ve metni var mı, yatak varken (`bertram_deal`) ≤ 36 saatte uyuyarak atlanabilir mi. **Açıklamasız kilitlenme (BLOCKED) yok**; bütün beklemeler yatakla atlanabiliyor. `CHAIN_TABLE=1 npx vitest run tests/chainTimes.test.ts` tabloyu yazdırır.

| Geçiş | İlk amaç | Günün saatleri |
|---|---|---|
| (uyanış) → m_inn | Brindlewood'daki hana git | 00–00 hemen |
| m_inn → m_bertram | Handa çalış (Bertram'la konuş) | 00–06 bekle (uyku) · 06–15 hemen · 15–00 bekle (uyku) |
| m_bertram → m_harvest | Yaşlı Haldor'u bul | 00–06 bekle (uyku) · 06–16 hemen · 16–00 bekle (uyku) |
| m_harvest → m_register | Bir gümüş biriktir (100 bronz) | 00–05 bekle (uyku) · 05–00 hemen |
| m_register → m_weapon | Handa Bertram'la konuş | 00–05 bekle (uyku) · 05–00 hemen |
| m_weapon → m_board | Loncaya dön, panodan görev al | 00–05 bekle (uyku) · 05–00 hemen |
| m_board → g1_rats | Ahırdaki fareleri temizle | 00–00 hemen |
| m_grank → m_air | Ormanın kenarına yürü | 00–00 hemen |
| m_air → m_wounded | Lina'yı taşı; Vera'yla şifacıya git | 00–00 hemen |
| m_wounded → m_vl_rest | Vera ve Lina'yı bul | 00–00 bekle (uyku) |
| m_vl_rest → f_wolves | Vera ve Lina'yla otlağa git | 00–00 hemen |
| f_wolves → m_celebrate | Akşam (18:00 sonrası) hana git | 00–18 bekle (uyku) · 18–00 hemen |
| m_celebrate → m_next_day | Gündüz köy meydanına uğra | 00–00 bekle (uyku) |
| m_next_day → m_theft | Şüphelileri incele (Appraisal) | 00–00 hemen |
| m_theft → m_vl_cellar | Vera ve Lina'yla konuş | 00–00 bekle (uyku) |
| m_vl_cellar → f_cellar | Değirmene git | 00–00 hemen |
| f_cellar → m_silver | 10 gümüş biriktir (1.000 bronz) | 00–05 bekle (uyku) · 05–00 hemen |
| m_silver → m_farewell | Handa Bertram'la konuş | 00–05 bekle (uyku) · 05–00 hemen |
| m_farewell → m_gate | Kaptan Roderick'ten giriş kartı al (10 gümüş) | 00–00 hemen |

"00–00 bekle (uyku)" satırları bilerek ertesi güne bağlı hikâye kapılarıdır (iyileşme gecesi, kadehin ertesi günü, keseden sonraki gün): görev biter bitmez "yarın …" beklemesi ve yatağa yönlendirme gelir. Denetimin bulup düzelttikleri: `m_bertram` beklemesi yoktu (ok Bertram'a kilitleniyordu), `m_harvest` 16:00 sonrası hemen ok veriyordu, `m_celebrate` bekleme günü uyuyunca kayıyordu, `weaponScene`/`boardOpening`/ücret gecesi metinleri saatle çelişiyordu.

### Testler

575 → 653 (26 dosya). Yeni: `tests/g6.test.ts` (56 test: jest damgası, `advanceClock`, `guildBarLabel`, iç mekân okları, `m_grank` hedefi, en yakın ot, beş stat formülleri, NPC 4×Level, `hpByLevel` her level, "Şans!" tespiti, tavşan hızı ve saldırı sıklığı, isteğe bağlı amaçlar, kaynak süzme ve bekleme, `objectiveWait m_bertram`, çöp kutusu, Tokluk ve vardiya yemeği, pano süre uyarısı, Ansiklopedi verisi ve göçü, harita işaretleri, `learnSkill` koruması, trait tablosu ve çark, uyanış bayrağı ve göçü, koşu bedeli, dövüş geri bildirimi sabitleri, v9 göçü), `tests/chainTimes.test.ts` (20).
Kurallar değiştiği için güncellenenler (geri alınmadı): `formulas` (5 stat, HP tabanı 10, VIT yüzdeli, dayanıklılık), `balance` (TABLE ×1,5; fare yumrukla 3 / sopayla 2 vuruş; Joseph 10 HP, fareye 8 ısırık; adil dövüş ve yoldaş testleri B11 ile), `systems` (trait görünürlüğü), `g5a` (NPC 4×Level, INT, tavşan 2,8), `chapter2`/`g5a` servis (2 gün, hedefler [6, 8]), `economy` (2 vardiya, kitap/ders yok), `v3core` (kayıt sürümü 9, Bertram ücreti bekleyen; koşu kilidi testi B22 ile kalktı), `g4a` (kayıt sürümü), `ui` (EXP kuralı: aynı dakikada av ≥ görev), `combat` (`runStep` testi kalktı). QA betiklerinde `declined_*` hileleri ve kitaplar temizlendi, MNA → INT.

### Uçtan uca QA (başsız Chromium, 1280×854, DPR 1, üretim derlemesi)

`URL='http://localhost:4173/?qa=1' DPR=1 OUT=screens/g6 node tools/qa/shot.mjs g6` (`ONLY=prologue,inn,shift,attic,wage,harvest,guild,history,codex,combat,map2,hud`). **Yeni oyundan** başlayıp gerçek girdiyle: başlık → prolog (dokunarak) → **TRAIT ÇEVİR** düğmesine fareyle tık → Status → dünyada **D tuşuyla ilk adım** (tökezleme, kart, aura) → han kapısına W ile gir → Appraisal **Q** → Bertram'la konuş, "Çalışmaya hazırım" → **Servis Koşturmacası** (masalara sipariş taşıma, tabak toplama, bir kez yanlış ekmeği **çöpe** atma) → ok merdivene → **oku klavyeyle izleyerek** merdivenden tavan arasına → ok yatağa → **E** ile yatak, "Uyu" → 06:00 → aşağı → 2. vardiya → ücret gecesi, Haldor beklemesi ve uyku öğreticisi → yatakta "Görev saatine kadar uyu" → hasat mini oyunu → lonca kaydı → sopa → pano → G görevleri. Ekran görüntüleri: `tools/qa/g6/`.

Son tam tur (üretim derlemesi, yeni oyundan): **43 denetim, hepsi ✓**, konsolda hata ve uyarı yok. Ekran görüntüleri (`tools/qa/g6/`, 128 renk):

- **B19** çark: olasılık tablosu (`g6_b19_wheel_table`), akan makara (`…_spin`), sonuç ve gerçek veriden açıklama (`…_result`), ardından Status (`g6_b19_status_after`).
- **B20** ilk adım: tökezleme (Joseph eğik ve basık: açı 9°, dikey ölçek 0,86; iç ses) (`g6_b20_stumble`), altın kart, ışık sütunu ve aura (`g6_b20_card_aura`). **A7.8a** ipucu ekranın alt ortasında (`g6_a78a_hint_bottom`).
- **A7.9** Appraisal öğreticisinde amaç "Vera'yı Appraisal ile incele" (`g6_a79_appraise_objective`), Vera'nın kartı (`g6_inn_appraise_vera`). Vera/Lina'nın han replikleri Türkçe ve dünya içi.
- **A7.7** kamera: `inn` (5,3) ve (2,5) — oyuncu ekranda (450, 339), görev panelinin altında değil (`g6_a77_inn_5_3`, `…_2_5`).
- **B12** servis 1. gün (5 masa, hedef 6) ve 2. gün (hedef 8), çöp kutusu (`g6_b12_serve_day1`, `…_day2`); bir kez yanlış ekmek alınıp çöpe atıldı. Vardiya sonu Tokluk 39,7 → 53,7.
- **B1/A7.1** vardiya sonrası bekleme metni "Bertram yarın 06:00'da iş verir — yatakta uyuyarak atlayabilirsin", alt görev "Yukarı çık ve uyu: merdivenden tavan arasına çık", ok merdivende (13,5; 3,5) (`g6_b1_arrow_ladder`). Ok klavyeyle izlenerek merdivenden tavan arasına çıkıldı; orada ok yatağa ve alt görev "…: yatağa yat" (`g6_b1_attic_arrow_bed`).
- **A7.10** yatağa (5,4)'ten ve (5,5; yukarı bakarak) "Uyu" (`g6_a710_bed_reach`); **E** ile uyku menüsü: Uyu · Görev saatine kadar uyu (yarın 06:00) · Vazgeç (`g6_b3_sleep_menu`). Uyanış 06:00, bekleme ve alt görev kapandı; **A7.2** sabah tavan arasında ok aşağı merdivene (`g6_a72_attic_morning_arrow`).
- Ücret gecesi: `m_bertram` bitti, 50 bronz. **B3** "Haldor yarın 06:00'da tarlada olur — yatakta uyuyarak atlayabilirsin" + isteğe bağlı "Beklemeyi uyuyarak atla: yatakta 'Görev saatine kadar uyu'" (`g6_b3_sleep_tutorial_hud`); yatakta o seçenek seçilince öğretici bitti, 06:00.
- Hasat mini oyunu (`g6_harvest_minigame`), Haldor'un ekmeği (B13); lonca kaydı bildirimi (`g6_b21_stone`; taşın "Trait: —" satırı ve Celeste'nin B21 repliği oynandı ama ekran görüntüsüne girmedi); sopa, pano, G görevleri; **A7.5** `m_grank` oku alt görevin hedefinde (`g1_rats` → `barn_yard`) (`g6_a75_grank_target`).
- **A1/B4** Konuşmalar 295 satır: fareyle yukarı sürükle → "Daha fazla göster" 40 → 80, görünüm yerinde; yeniden yukarı kaydırıp ikinci basış 80 → 120 (`g6_a1_history_more`).
- **B15** Ansiklopedi Yaratıklar ve Karakterler (Bertram kartı: rol, Appraisal farkı yetmeyen alanlar "???", görüldüğü yer, sattıkları, ilişki, notlar) (`g6_b15_codex_*`); **B9** Status'ta beş stat ve gerçek sayılı ipuçları, Tokluk satırı (`g6_b9_status_stats`).
- **B23** sopa ile fare: kritiksiz vuruş 1,0, fare 2 vuruşta (`g6_b23_hit_numbers`); sümüksü (`g6_b23_slime_hit`); kritik büyük sarı "2,9!" (`g6_b23_crit`); kusursuz kaçış (`g6_b23_perfect_dodge`); düşük can vinyeti ve kırmızı alınan hasar (`g6_b23_low_hp`).
- **B16** harita: görev hedefi; dövüş bölgesi keşfedilince yaratık bölgesi "?" (Ansiklopedide bilinmiyor) (`g6_b16_map_markers`, `…2`). **B13** HUD'da Aç/Çok aç Tokluk barı (`g6_b13_hud_hungry`).

QA'nın bulup düzelttikleri: trait çarkının sonucunda kart olasılık tablosuyla çakışıyordu (tablo ve diğer kartlar artık söner, kart aşağıda); Harita sekmesinin başlığı yeni filtre düğmelerinin altına giriyordu (başlık sığacak kadar küçülür); yeni oyunda ilk vardiyanın ortasında Tokluk 0'a düşüyordu (öğle yemeği, bkz. Kararlar).

### Elle denenemeyenler / basitleştirilenler

- Gerçek tablette denenmedi (yalnızca başsız tarayıcı, ~3–7 FPS).
- Servis mini oyununda masalara dokunuş yerine oyunun kendi hedef/eylem çağrıları (`goTo` + `pick`/`serveTable`/`discard`) kullanıldı (dokunuş aynı çağrıları yapar); hasat zamanlama oyununda basış, işaretçi bölgedeyken karede yapıldı (başsız tarayıcının düşük kare hızında gerçek tuş zamanlaması tutmuyor).
- Lonca kaydı, sopa ve pano adımlarında konumlar ışınlanarak geçildi (yürüme ve oklar ilk günlerde denendi). Görev zincirinin ilk lonca görevlerinden sonrası (Vera'nın dersi, yaralılar, İlk Kadeh, kese, bodrum) bu turda oynanmadı; birim testleri ve zincir denetimiyle doğrulandı.
- Kusursuz kaçış ve kritik vuruş dövüşte zorlanarak tetiklendi (`perfectDodge`, `critNext`); pano son gün uyarıları, Ansiklopedi bildirimleri ve eski kayıtların göçü birim testleriyle.
- Harita filtrelerine dokunma ve bilgi balonu ekran görüntüsüyle değil kodla/birim testleriyle doğrulandı.

## Sonraki oturum için notlar

- **Grup 7 tamamlandı (0.11.0).** Açık kalanlar yukarıda "Elle denenemeyenler / basitleştirilenler" altında. QA için önce `window.__qa` (README) ve kontrol noktaları; yeni hikâye adımı eklenince `src/story/checkpoints.ts`'deki `QUEST_EFFECTS`'e yan etkilerini yazmak gerekir (yoksa "Tamamla" ve kontrol noktaları bayrakları kurmaz). Eski QA betikleri (`steps_g6.mjs` vb.) `TitleScene.newGame(false)` çağırıyor; 0.11.0'da Yeni Oyun yuva seçtirdiği için bunlar `pickSlot`/`__qa.checkpoint` ile güncellenmeli. Görev bölgeleri (`PARTY_ZONES`) ve saldırı sırası sınırları (`queueLimit`) veriden; yeni bölge/görev gelince tabloya eklenmeli. Sendeleme tablosunda olmayan yeni yaratıklar 4 kapasite alır.

- **Grup 6 tamamlandı (0.10.0).** Açık kalanlar yukarıda "Elle denenemeyenler / basitleştirilenler" altında. Dövüş sisteminin kökten değişimi bir sonraki grupta (bu grupta yalnızca sayılar ve geri bildirim değişti). Ansiklopedinin "Eros" sayfası şehir içeriği gelince dolacak; yapı yeni türlere ("Eşyalar", "Yerler") açık (`CODEX_KINDS`).

- **Grup 5B tamamlandı (0.9.0).** Açık kalanlar yukarıda "Yapılamayan / basitleştirilen" altında; 2. yetenek slotu kodda hazır (`SKILL_SLOTS_OPEN`), açılış koşulu henüz yok. 4B'nin "tatmin edici olmayanlar" listesindeki kabza, yay/mızrak yürüyüşü, hançer yukarı saplama, pala vurulma, sırttaki görünümler, süzülen yay ve çatlak sopa 5A'da (D1–D7) ele alındı.
- 4B'den açık kalanlar: ileride gürz/topuz için `w_club` hazır, uzun kılıç için LPC `longsword` saldırı sayfaları (192 px, klasik gövdeyle birebir uyumlu) kullanılabilir. Terfi animasyonu için ayrı bir ses bestesi hâlâ yok (mevcut `levelup` + `holy`). `fmtHp` 10 altını hep bir ondalık gösterir ("HP 5,0 / 5,0").
- **4A'dan kalanlar / karar bekleyenler:** tam haritada mavi işaretler henüz keşfedilmemiş (sisli) yerlerde de görünür — yön bulmak için bilerek bırakıldı, istenirse sise bağlanabilir. Kâhyanın kesesinde 4 şüpheli var (ilerleme 0/4). Bölüm I'in mini oyunlu adımları geliştirici "Tamamla" ile geçilince sahne bayraklarını kurmuyordu — 0.11.0'da `QUEST_EFFECTS` ile çözüldü.
- Eski plandaki "yardımlı savaş, yoldaş YZ" maddeleri Grup 2 talimatında yoktu, dokunulmadı (yoldaşlar silah ×2'den dolaylı güçlendi: düşük HP'li ilk yaratıkları hızlı bitirirler, Joseph'in EXP'si yalnızca kendi vurduklarından gelir). 0.8.0'da (C6) yoldaşların hasarı, temposu ve hedef seçimi ayarlandı; yardımlı savaşa dokunulmadı.
- **Grup 4 için:** Tarla Faresi yalnızca otlak görevinde doğuyor; dünyaya (güney tarlaları) yerleştirmek içerik işi. `pack_hunter` title'ı artık otlak görevinden değil, ormandaki kurtlardan gelir.

- **Varsayılan dal hâlâ `claude/vigilant-darwin-hcoqh5`.** Araçlarla değiştirilemiyor; kullanıcı Settings → General → Default branch → `main` yapmalı, sonra eski dal silinebilir.
- Gerçek tablet FPS'i ölçülemedi (yalnızca başsız tarayıcı). Oyuncu için liste: yukarıda "D8: Tablette FPS ölçüm listesi" — doldurulunca bu dosyaya eklenmeli.
- Joseph'in portre dokusu her ekipman kombinasyonu için ayrı (`portrait_lpc_joseph_…`, 128×128); küçük bir birikim, kullanılan dokuyu silmek riskli olduğu için bırakıldı.
- Yoldaşlar (`companion.ts`) hâlâ kendi `findPath`'ini senkron çağırıyor (saniyede en fazla bir kez, ≤5000 adım); gerekirse `PathQueue`'ya alınabilir.
- `manifest.webmanifest` `orientation: landscape` korundu; Android'de açılışta sorun sürerse ilk aday bu.
- Geliştirici modunda menü açıkken CPU kare süresi yüksek (~140 ms, başsız) — önceden de böyleydi (~190 ms); geliştirici paneli çizimi, Grup 3'te bakılabilir.
- QA betikleri: `tools/qa/steps_g1*.mjs` (`g1flow`, `g1leak`, `g1pwa`, `g1dpr`), `steps_innhang.mjs` (donma tanısı, CDP ile yığın izi), `steps_perf.mjs`.
