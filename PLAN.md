# Güncelleme planı — devam notu

Dört aşamalı plan. Her oturum yalnızca kendi grubunu yapar; bitince bu dosyayı günceller.

| Grup | Kapsam | Durum |
| --- | --- | --- |
| **1. Çökme, bug, altyapı** | Pages dağıtımı, sahne sıfırlama, joystick önceliği, handa donma, performans, uygulama değişiminde çökme, PWA kurulumu | ✅ 0.3.1 |
| **2. Denge ve dövüş** | Düşman/Joseph sayıları, hasar ve EXP eğrileri, yardımlı savaş, yoldaş YZ | sırada |
| **3. Arayüz** | HUD, menüler, ayarlar paneli düzeni, dokunmatik butonlar, okunurluk | bekliyor |
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

## Sonraki oturum için notlar

- **Varsayılan dal hâlâ `claude/vigilant-darwin-hcoqh5`.** Araçlarla değiştirilemiyor; kullanıcı Settings → General → Default branch → `main` yapmalı, sonra eski dal silinebilir.
- Gerçek tablet FPS'i ölçülemedi (yalnızca başsız tarayıcı). Kullanıcıdan Ayarlar → FPS göstergesi ile açık dünya / meydan / han değerlerini istemek iyi olur.
- Ayarlar paneli dolu: not satırı başlık ekranında "Kapat" düğmesine yakın, geliştirici modunda bir satır daha ekleniyor → Grup 3'te paneli iki sütunlu/kaydırılır yapmak gerek.
- Joseph'in portre dokusu her ekipman kombinasyonu için ayrı (`portrait_lpc_joseph_…`, 128×128); küçük bir birikim, kullanılan dokuyu silmek riskli olduğu için bırakıldı.
- Yoldaşlar (`companion.ts`) hâlâ kendi `findPath`'ini senkron çağırıyor (saniyede en fazla bir kez, ≤5000 adım); gerekirse `PathQueue`'ya alınabilir.
- `manifest.webmanifest` `orientation: landscape` korundu; Android'de açılışta sorun sürerse ilk aday bu.
- Geliştirici modunda menü açıkken CPU kare süresi yüksek (~140 ms, başsız) — önceden de böyleydi (~190 ms); geliştirici paneli çizimi, Grup 3'te bakılabilir.
- QA betikleri: `tools/qa/steps_g1*.mjs` (`g1flow`, `g1leak`, `g1pwa`, `g1dpr`), `steps_innhang.mjs` (donma tanısı, CDP ile yığın izi), `steps_perf.mjs`.
