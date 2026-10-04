# Güncelleme planı — devam notu

Dört aşamalı plan. Her oturum yalnızca kendi grubunu yapar; bitince bu dosyayı günceller.

| Grup | Kapsam | Durum |
| --- | --- | --- |
| **1. Çökme, bug, altyapı** | Pages dağıtımı, sahne sıfırlama, joystick önceliği, handa donma, performans, uygulama değişiminde çökme, PWA kurulumu | ✅ 0.3.1 |
| **2. Denge ve dövüş** | Düşman/Joseph sayıları, hasar ve EXP eğrileri, dövüş mekanikleri | ✅ 0.4.0 |
| **3. Arayüz** | HUD, menüler, ayarlar paneli düzeni, dokunmatik butonlar, okunurluk, yaratık Appraisal paneli | sırada |
| **4. İçerik, görevler, animasyon** | Yeni görevler/bölümler, NPC diyalogları, animasyonlar | bekliyor |

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

## Sonraki oturum için notlar

- **Grup 3 (arayüz) için Grup 2'den kalanlar:** yaratık Appraisal paneli (ayrı düzen, koyu kırmızı zemin, stat/lonca/envanter bölümleri yok, portre) — şimdilik yalnızca drop satırı eklendi. `fmtHp` 10 altını hep bir ondalık gösterir ("HP 5,0 / 5,0"); tasarımda daha sade bir HUD isteniyorsa kural tek yerden değişir.
- Eski plandaki "yardımlı savaş, yoldaş YZ" maddeleri Grup 2 talimatında yoktu, dokunulmadı (yoldaşlar silah ×2'den dolaylı güçlendi: düşük HP'li ilk yaratıkları hızlı bitirirler, Joseph'in EXP'si yalnızca kendi vurduklarından gelir). Gerekirse ayrı bir oturumda.
- **Grup 4 için:** Tarla Faresi yalnızca otlak görevinde doğuyor; dünyaya (güney tarlaları) yerleştirmek içerik işi. `pack_hunter` title'ı artık otlak görevinden değil, ormandaki kurtlardan gelir.

- **Varsayılan dal hâlâ `claude/vigilant-darwin-hcoqh5`.** Araçlarla değiştirilemiyor; kullanıcı Settings → General → Default branch → `main` yapmalı, sonra eski dal silinebilir.
- Gerçek tablet FPS'i ölçülemedi (yalnızca başsız tarayıcı). Kullanıcıdan Ayarlar → FPS göstergesi ile açık dünya / meydan / han değerlerini istemek iyi olur.
- Ayarlar paneli dolu: not satırı başlık ekranında "Kapat" düğmesine yakın, geliştirici modunda bir satır daha ekleniyor → Grup 3'te paneli iki sütunlu/kaydırılır yapmak gerek.
- Joseph'in portre dokusu her ekipman kombinasyonu için ayrı (`portrait_lpc_joseph_…`, 128×128); küçük bir birikim, kullanılan dokuyu silmek riskli olduğu için bırakıldı.
- Yoldaşlar (`companion.ts`) hâlâ kendi `findPath`'ini senkron çağırıyor (saniyede en fazla bir kez, ≤5000 adım); gerekirse `PathQueue`'ya alınabilir.
- `manifest.webmanifest` `orientation: landscape` korundu; Android'de açılışta sorun sürerse ilk aday bu.
- Geliştirici modunda menü açıkken CPU kare süresi yüksek (~140 ms, başsız) — önceden de böyleydi (~190 ms); geliştirici paneli çizimi, Grup 3'te bakılabilir.
- QA betikleri: `tools/qa/steps_g1*.mjs` (`g1flow`, `g1leak`, `g1pwa`, `g1dpr`), `steps_innhang.mjs` (donma tanısı, CDP ile yığın izi), `steps_perf.mjs`.
