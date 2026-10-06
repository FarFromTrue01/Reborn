# Güncelleme planı — devam notu

Dört aşamalı plan — **tamamlandı (0.7.0)**. Her oturum yalnızca kendi grubunu yaptı ve bu dosyayı güncelledi.
0.7.0 sonrası plan iki yarı: **Grup 5A** (hatalar, dünya, denge, silah görselleri) — ✅ 0.8.0; **Grup 5B** (arayüz ve beceri sistemi) — sırada.

| Grup | Kapsam | Durum |
| --- | --- | --- |
| **1. Çökme, bug, altyapı** | Pages dağıtımı, sahne sıfırlama, joystick önceliği, handa donma, performans, uygulama değişiminde çökme, PWA kurulumu | ✅ 0.3.1 |
| **2. Denge ve dövüş** | Düşman/Joseph sayıları, hasar ve EXP eğrileri, dövüş mekanikleri | ✅ 0.4.0 |
| **3. Arayüz** | Appraisal paneli (NPC/kendi/yaratık), eşya rütbeleri, saygınlık gösterimi, HUD görev kategorileri, Lonca Kartı barı, terfi görevi ve animasyonu, görev bitiş animasyonu, görev EXP kuralı, Ayarlar paneli | ✅ 0.5.0 |
| **4A. Görevler ve içerik** | Ana görev güvencesi, pano akışı, NPC hedefli amaçlar, şifalı ot, yaralılar, sahne karakterleri, kâhyanın kesesi, yan görev iş yerleri ve mavi işaretler, lonca/pano, görev saatine kadar uyku, han oturma yerleri, yoldaş takibi, Dorn, Eros ve soylu adı, Grup 3'ten kalan dört düzeltme | ✅ 0.6.0 |
| **4B. Animasyon ve silahlar** | Silah modelleri, saldırı animasyonları, kılıcı sırta koyma, konuşurken yürüme animasyonu | ✅ 0.7.0 |
| **5A. Hatalar, dünya, denge, silah görselleri** | Sistem bildirimi, kapı amacı, QA yoklaması; elmalar, görev eşyası, otlar, Dorn/muhafız yürüyüşü, Varg, dükkânlar, şort, doğu suru, mini oyun müziği ve servis hedefi, karartma, savaş ganimeti, satış aralığı, sabit joystick; hız, kaçış, hasar sayıları, yoldaşlar, NPC statları; silah kareleri | ✅ 0.8.0 |
| **5B. Arayüz ve beceri sistemi** | (ayrı talimat) | ⏳ |

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

## Sonraki oturum için notlar

- **Sırada Grup 5B** (arayüz ve beceri sistemi; 5A bunlara dokunmadı). 4B'nin "tatmin edici olmayanlar" listesindeki kabza, yay/mızrak yürüyüşü, hançer yukarı saplama, pala vurulma, sırttaki görünümler, süzülen yay ve çatlak sopa 5A'da (D1–D7) ele alındı.
- 4B'den açık kalanlar: ileride gürz/topuz için `w_club` hazır, uzun kılıç için LPC `longsword` saldırı sayfaları (192 px, klasik gövdeyle birebir uyumlu) kullanılabilir. Terfi animasyonu için ayrı bir ses bestesi hâlâ yok (mevcut `levelup` + `holy`). `fmtHp` 10 altını hep bir ondalık gösterir ("HP 5,0 / 5,0").
- **4A'dan kalanlar / karar bekleyenler:** tam haritada mavi işaretler henüz keşfedilmemiş (sisli) yerlerde de görünür — yön bulmak için bilerek bırakıldı, istenirse sise bağlanabilir. Kâhyanın kesesinde 4 şüpheli var (ilerleme 0/4). Bölüm I'in mini oyunlu adımları (iş, hasat) geliştirici "Tamamla" ile geçilince güvence bir sonraki görevi açar ama sahne bayraklarını (ör. `bertram_done`) kurmaz; gerçek oyunda bu yol kullanılmaz.
- Eski plandaki "yardımlı savaş, yoldaş YZ" maddeleri Grup 2 talimatında yoktu, dokunulmadı (yoldaşlar silah ×2'den dolaylı güçlendi: düşük HP'li ilk yaratıkları hızlı bitirirler, Joseph'in EXP'si yalnızca kendi vurduklarından gelir). 0.8.0'da (C6) yoldaşların hasarı, temposu ve hedef seçimi ayarlandı; yardımlı savaşa dokunulmadı.
- **Grup 4 için:** Tarla Faresi yalnızca otlak görevinde doğuyor; dünyaya (güney tarlaları) yerleştirmek içerik işi. `pack_hunter` title'ı artık otlak görevinden değil, ormandaki kurtlardan gelir.

- **Varsayılan dal hâlâ `claude/vigilant-darwin-hcoqh5`.** Araçlarla değiştirilemiyor; kullanıcı Settings → General → Default branch → `main` yapmalı, sonra eski dal silinebilir.
- Gerçek tablet FPS'i ölçülemedi (yalnızca başsız tarayıcı). Oyuncu için liste: yukarıda "D8: Tablette FPS ölçüm listesi" — doldurulunca bu dosyaya eklenmeli.
- Joseph'in portre dokusu her ekipman kombinasyonu için ayrı (`portrait_lpc_joseph_…`, 128×128); küçük bir birikim, kullanılan dokuyu silmek riskli olduğu için bırakıldı.
- Yoldaşlar (`companion.ts`) hâlâ kendi `findPath`'ini senkron çağırıyor (saniyede en fazla bir kez, ≤5000 adım); gerekirse `PathQueue`'ya alınabilir.
- `manifest.webmanifest` `orientation: landscape` korundu; Android'de açılışta sorun sürerse ilk aday bu.
- Geliştirici modunda menü açıkken CPU kare süresi yüksek (~140 ms, başsız) — önceden de böyleydi (~190 ms); geliştirici paneli çizimi, Grup 3'te bakılabilir.
- QA betikleri: `tools/qa/steps_g1*.mjs` (`g1flow`, `g1leak`, `g1pwa`, `g1dpr`), `steps_innhang.mjs` (donma tanısı, CDP ile yığın izi), `steps_perf.mjs`.
