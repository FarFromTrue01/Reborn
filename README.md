# Reborn in Elonth

Tarayıcıda çalışan 2D aksiyon RPG. Önceki dünyasında ölen **Joseph**, her canlının Level 0 ve sıfır statla doğduğu **Elonth**'ta yeniden doğar. Elinde yırtık bir şort, Appraisal (G-) ve kimsenin göremediği bir trait vardır: **Divine Paladin (X)**.

Bu sürüm (Bölüm I — *Köksüz*) prologdan lonca kaydına kadar uzanır; sonrasında başlangıç ormanında ve **Brindlewood** köyünde serbestçe dolaşmaya, avlanmaya ve antrenman yapmaya devam edebilirsin.

**Oyna:** https://farfromtrue01.github.io/Reborn/

## Kurulum (tablet / telefon)

1. Chrome'da oyunun adresini aç.
2. Menü → **Ana ekrana ekle** (veya "Uygulamayı yükle").
3. Ana ekrandaki **Elonth** simgesinden aç: tam ekran ve yatay çalışır, çevrimdışı da açılır.

Yeni sürüm yayınlandığında oyun `version.json` üzerinden bunu fark eder, yeni dosyaları indirir ve kendini bir kez yeniler.

## Kontroller

| Eylem | Dokunmatik | Klavye / Fare |
| --- | --- | --- |
| Yürü | Ekranın sol yarısında sürükle (sanal joystick) | WASD / ok tuşları |
| Koş (dayanıklılık harcar) | Joystick'i kenara kadar it | Shift |
| Saldırı | **Saldır** | J veya sol tık (tıklanan yöne) |
| Ağır saldırı | **Ağır** | K |
| Kaçış (yuvarlanma) | **Kaçış** | Boşluk veya sağ tık |
| Etkileşim (konuş, gir, topla, uyu) | **Etkileşim** (etiket bağlama göre değişir) | E / Enter |
| Appraisal | 🔍 butonu | Q |
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

## Sistemler (özet)

- **Statlar:** STR, VIT, AGI, DEX, MNA, INT, LUK; Max HP = 5 + 5×Level + 5×VIT, Max MP = Level + 2×MNA. Her level +4 stat puanı, +1 SP. Tüm formüller `src/core/formulas.ts` içinde ve birim testli.
- **Rütbeler:** G → F → E → D → C → B → A → S → X (skill ve lonca rütbelerinde alt kademeler: G-, G, G+ …).
- **Appraisal:** Gördüğün bilgi, senin ve hedefin Appraisal harfleri arasındaki farka bağlı. Trait'ler hiçbir rütbede görünmez.
- **Skill'ler:** Kullanarak (yavaş) ve zor başarılarla (ani) gelişir. Yeni skill: Sistem Teklifi (SP), öğretmen, kitap/parşömen veya gizli keşif. Haftada en fazla 1 yeni skill.
- **Divine Paladin:** Ayrı level/EXP; Güç, Dayanıklılık, Hız, Öğrenme, Adaptasyon katsayıları `0.5 × 1.15^L × 1.5^⌊L/3⌋`. Her 3 levelde awakening ve Divine skill seçimi (Işık barı ile kullanılır).
- **Ekonomi:** Bronz → Gümüş → Platin → Altın → Elmas (her biri ×100). Her alım/satım/ödül bir işlemdir: doğrulanır, eksiksiz uygulanır, kaydedilir; yetmezse hiçbir şey değişmez.
- **Zaman:** 1 oyun günü ≈ 24 gerçek dakika. Gece-gündüz, dükkân saatleri, NPC günlük programları.
- **Kayıt:** Otomatik (uyurken, bölge değişince, işlemlerden sonra) + 3 elle kayıt yuvası. Sürüm numaralı, göç destekli.

## Kendi görsellerini ekleme

- Portreler: `assets/art/portraits/<karakter>_<ifade>.png` — ifadeler: `normal`, `gulen`, `kizgin`, `saskin`, `uzgun`, `alayci`. Karakterler: `joseph`, `bertram`, `vera`, `lina`, `celeste` ve `src/data/npcs.ts` içindeki `portrait` kimlikleri.
- Sahne görselleri: `assets/art/cg/<sahne>.png` — `title`, `void`, `battlefield`, `forest_wake`, `village_view`.
- Dosya yoksa oyun LPC sprite'ından üretilmiş piksel portreyi veya kodla çizilmiş sahneyi kullanır. Dosyayı ekleyip pushlaman yeter; GitHub Actions yeniden build eder.

## Geliştirme

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # formül, ekonomi, skill, Divine, Appraisal, kayıt testleri
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

## Sürüm notları

- **0.1.0** — İlk sürüm. Prolog (ölüm, uzak savaş alanı, beyaz boşluk, Status'un oluşması), ormanda uyanış, Brindlewood köyü (han, lonca, demirci, dükkân, şifacı, antrenman alanı, tarlalar, değirmen, şehir yolu kontrol noktası), Vera & Lina sahnesi ve Appraisal öğreticisi, Bertram'la pazarlık, çalışma montajı, lonca kaydı. Gerçek zamanlı dövüş (uyarılı düşman saldırıları, mükemmel kaçış, gizli saldırı, hit-stop, hasar sayıları), 7 canavar türü + goblin kampı ve şefi, NPC günlük programları, kast tepkileri, gece-gündüz ve ışıklar, prosedürel müzik, karakter sesleri, PWA.

## Emeği Geçenler

Görsellerin büyük kısmı Liberated Pixel Cup (LPC) sanatçılarının eserleridir. Tüm yazarlar ve lisanslar için [CREDITS.md](CREDITS.md) dosyasına ve oyundaki **Emeği Geçenler** ekranına bak.
