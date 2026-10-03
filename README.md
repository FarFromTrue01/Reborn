# Reborn in Elonth

Tarayıcıda çalışan 2D aksiyon RPG. Önceki dünyasında ölen **Joseph**, her canlının Level 0 ve sıfır statla doğduğu **Elonth**'ta yeniden doğar. Elinde yırtık bir şort, Appraisal (G-) ve kimsenin göremediği bir trait vardır: **Divine Paladin (X)**.

Bu sürüm (0.2.0, Bölüm I — *Köksüz*) prologdan lonca kaydına kadar uzanır: Bertram'ın hanında dört günlük iş, Yaşlı Haldor'un hasadı ve bir gümüşlük lonca kaydı. Sonrasında başlangıç ormanında ve iki katına çıkan **Brindlewood** köyünde serbestçe dolaşmaya, avlanmaya ve antrenman yapmaya devam edebilirsin.

**Oyna:** https://farfromtrue01.github.io/Reborn/

## Kurulum (tablet / telefon)

1. Chrome'da oyunun adresini aç.
2. Menü → **Ana ekrana ekle** (veya "Uygulamayı yükle").
3. Ana ekrandaki **Elonth** simgesinden aç: tam ekran ve yatay çalışır, çevrimdışı da açılır.

Yeni sürüm yayınlandığında oyun `version.json` üzerinden bunu fark eder, yeni dosyaları indirir ve kendini bir kez yeniler.

## Kontroller

| Eylem | Dokunmatik | Klavye / Fare |
| --- | --- | --- |
| Yürü | Ekranın sol yarısında sürükle (sanal joystick; ayarlardan sol altta sabit yapılabilir) | WASD / ok tuşları |
| Koş (dayanıklılık harcar) | Joystick'i kenara kadar it | Shift |
| Saldırı | **Saldır** | J veya sol tık (tıklanan yöne) |
| Ağır saldırı | **Ağır** | K |
| Kaçış (yuvarlanma) | **Kaçış** | Boşluk veya sağ tık |
| Etkileşim (konuş, gir, topla, uyu) | **Etkileşim** (menzilde bir şey varsa parlar: Konuş mavi, diğerleri yeşil) | E / Enter |
| Hızlı yemek | Kaçış'ın solundaki yemek butonu | F |
| Appraisal | Bir NPC'ye ya da canavara **dokun**, veya 🔍 butonu (en yakın hedef) | Q, NPC'ye tıklama |
| Tam ekran harita | Sağ üstteki mini haritaya dokun | M |
| Skill 1–4 | Sağdaki küçük butonlar (skill öğrenince görünür) | 1–4 |
| Divine skill'ler | Altın butonlar (awakening sonrası) | Z / X / C |
| Menü | ☰ | Esc / Tab, Harita: M |
| Gizlice yürü | — | Ctrl |
| Konuşmayı ilerlet | Ekrana dokun | Boşluk / Enter / E |

İpuçları:
- Düşmanlar saldırmadan önce **kırmızı parlar ve önlerinde bir uyarı alanı çizilir**. Tam o anda kaçarsan **Mükemmel Kaçış**: zaman yavaşlar ve sıradaki vuruşun ×1.5 olur.
- Seni fark etmemiş bir düşmana arkadan vurmak ×1.5 (**Gizli Saldırı**). Başlarındaki **?** göstergesi dolarsa seni fark ederler.
- Level 0 Joseph için bir fare bile tehlikelidir. Bu kasıtlıdır.
- Ölünce son uyuduğun yatakta (yoksa ormanda uyandığın yerde) doğarsın; paranın %10'u ve o gün kazandığın EXP kaybolur.
- Köydeki antrenman alanında (odun kesme kütüğü, taş, koşu parkuru) günde 3 kez Divine EXP kazanabilirsin.
- Ağaç tepeleri ve çatıların arkasına geçen sen ya da bir canavar olunca o dekor yarı saydam olur.
- Yemekler bekleme süresine tabidir: her yemekten sonra 10 sn, art arda 3. yemekten sonra 60 sn. Son yemekten 60 sn geçince zincir sıfırlanır.
- Ayarlar: arayüz boyutu, metin hızı, sesler, **karakter hızı** (0.75x–2.0x, yalnızca yürüme/koşma), otomatik ilerleme, ekran sarsıntısı, FPS, grafik kalitesi, joystick modu.

## Sistemler (özet)

- **Statlar:** STR, VIT, AGI, DEX, MNA, INT, LUK; Max HP = 5 + 5×Level + 5×VIT, Max MP = Level + 2×MNA. Her level +4 stat puanı, +1 SP. Tüm formüller `src/core/formulas.ts` içinde ve birim testli.
- **Rütbeler:** G → F → E → D → C → B → A → S → X (skill ve lonca rütbelerinde alt kademeler: G-, G, G+ …).
- **Appraisal:** Gördüğün bilgi, senin ve hedefin Appraisal harfleri arasındaki farka bağlı. Trait'ler hiçbir rütbede görünmez.
- **Skill'ler:** Kullanarak (yavaş) ve zor başarılarla (ani) gelişir. Yeni skill: Sistem Teklifi (SP), öğretmen, kitap/parşömen veya gizli keşif. Haftada en fazla 1 yeni skill.
- **Divine Paladin:** Ayrı level/EXP; Güç, Dayanıklılık, Hız, Öğrenme, Adaptasyon katsayıları `0.5 × 1.15^L × 1.5^⌊L/3⌋`. Her 3 levelde awakening ve Divine skill seçimi (Işık barı ile kullanılır).
- **Ekonomi:** Bronz → Gümüş → Platin → Altın → Elmas (her biri ×100), her biri kendi simgesiyle gösterilir. Her alım/satım/ödül bir işlemdir: doğrulanır, eksiksiz uygulanır, kaydedilir; yetmezse hiçbir şey değişmez.
- **Köy fiyatları:** Ekmek 4, Elma 3, Sıcak Güveç 12, Bez Sargı 15, Küçük HP İksiri 60, Küçük MP İksiri 90, Panzehir 45, Brindlewood Haritası 60 bronz; silah ve zırhlar ~×2.5, kitaplar ×2 (0.1.0'a göre). Han yatağı 40, şifacının yara sarması 15 bronz. Skill dersleri: Okçuluk (Garrick) 2 gümüş, İlk Yardım (Ilse Nine) 1 gümüş 50 bronz, Kılıç (Bertram) 7 gümüş 50 bronz. Tüccarlar eşyayı fiyatının %30–40'ına alır; canavar drop'larının satış değeri sabittir, al-sat ile para kasılamaz. Bkz. `src/data/economy.ts`, `src/data/items.ts`, `src/data/shops.ts`.
- **Hikâye işleri (tek seferlik):** Bertram'ın hanı 4 vardiya (günde en fazla 1), ödeme 4. günün sonunda 50 bronz; ilk günün yemeği bedava. Ardından Yaşlı Haldor'un hasadı: 50 bronz. İkisi bir gümüş = lonca kaydı. Sonrasında para avdan ve drop satışından gelir.
- **Dükkânlar:** Alışveriş, satış ve dersler yalnızca esnaf kendi dükkânında ve çalışma saatindeyken açılır (Gunnar'ın Demirhanesi, Marta'nın Genel Dükkânı, Ilse Nine'nin Şifa Evi, Brunhild'in Fırını, Terzi Mirelle, Gorm'un Tabakhanesi, Garrick'in Avcı Kulübesi, Bertram'ın hanı).
- **Kast:** Soylular → yüksek rütbeli maceracılar → tüccar ve zanaatkârlar → köylüler → köksüzler. Joseph en alttadır. NPC'ler kasta göre konuşur; köylüler soylu kâhyanın önünde eğilir, yüksek rütbeli maceracılara yol verir; handa şöminenin önündeki masalar üst kastlara ayrılır, köksüzler arkada oturur; dükkânda üst kasttan biri gelirse sıra ona geçer.
- **Zaman:** 1 oyun günü ≈ 24 gerçek dakika. Gece-gündüz, dükkân saatleri, NPC günlük programları.
- **Kayıt:** Otomatik (uyurken, bölge değişince, işlemlerden sonra) + 3 elle kayıt yuvası. Sürüm numaralı, göç destekli.

## Kendi görsellerini ekleme

- Portreler: `assets/art/portraits/<karakter>_<ifade>.png` — ifadeler: `normal`, `gulen`, `kizgin`, `saskin`, `uzgun`, `alayci`. Karakterler: `joseph`, `bertram`, `vera`, `lina`, `celeste` ve `src/data/npcs.ts` içindeki `portrait` kimlikleri.
- Sahne görselleri: `assets/art/cg/<sahne>.png` — `title`, `void`, `forest_wake`, `village_view`.
- Sesler: `assets/audio/car_crash.(ogg|mp3|wav)` eklenirse prologdaki araba kazası sesi olarak çalınır; yoksa WebAudio ile üretilir.
- Dosya yoksa oyun LPC sprite'ından üretilmiş piksel portreyi veya kodla çizilmiş sahneyi kullanır. Dosyayı ekleyip pushlaman yeter; GitHub Actions yeniden build eder.

## Geliştirme

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # formül, ekonomi, skill, Divine, Appraisal, kayıt, yemek, kapı ve köy/NPC testleri
npm run build      # dist/
```

Görseller önceden üretilmiş olarak depodadır (`assets/gfx`). Yeniden üretmek için:

```bash
tools/fetch_sources.sh                                   # LPC kaynaklarını indirir (tools/.cache)
python3 tools/lpc_chars.py tools/.cache/lpc-repo         # karakter sprite sheet'leri
python3 tools/build_terrain.py && python3 tools/build_props.py && python3 tools/build_buildings.py
python3 tools/build_monsters.py && python3 tools/build_icons.py && python3 tools/build_credits.py
```

### Yapı

```
src/core/      Saf oyun kuralları (formüller, para, işlemler, skill, Divine, Appraisal, kayıt, zaman) — testli
src/data/      Veri: eşyalar, canavarlar, skill'ler, NPC'ler (stat blokları, program, replikler), dükkânlar, title'lar
src/world/     Harita üretimi, iç mekânlar, çizim, aktörler, oyuncu, düşman YZ, NPC, ışık, efektler
src/scenes/    Boot, Başlık, Prolog, Dünya, Arayüz, Menü, Mini oyun, Emeği Geçenler
src/story/     Hikâye yönetmeni (sahneler, konuşmalar, tetikleyiciler)
src/ui/        Arayüz bileşenleri, dükkân, paneller, portreler
src/audio/     WebAudio: efektler, prosedürel müzik, konuşma "dıt" sesleri
tools/         Görsel üretim hattı (Python) ve QA ekran görüntüsü betikleri
assets/        Üretilmiş görseller, yazı tipleri, lisanslar, kullanıcı görselleri (art/)
```

Yeni içerik eklemek için genellikle sadece `src/data/` altındaki dosyaya bir kayıt eklemek yeterlidir (ör. yeni eşya `items.ts`, yeni canavar `monsters.ts` + `worldgen.ts` içinde bir spawn).

Yeni bina eklerken: `tools/build_buildings.py` içinde tarif, `src/data/manifest.ts` içinde `BUILDINGS`, `worldgen.ts` içinde `place(...)` ve gerekiyorsa `interiors.ts` içinde oda. `tests/doors.test.ts` dünya haritasını ve tüm iç mekânları tarar: her kapının görünür bir görseli olmalı, yönüne uygun duvarda durmalı ve önündeki kare yürünebilir olmalı. `tests/world.test.ts` her NPC'nin program hedeflerinin var olan, yürünebilir kareler olduğunu doğrular.

## Sürüm notları

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
