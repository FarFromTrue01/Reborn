# Reborn in Elonth

Tarayıcıda çalışan 2D aksiyon RPG. Önceki dünyasında ölen **Joseph**, her canlının Level 0 ve sıfır statla doğduğu **Elonth**'ta yeniden doğar. Elinde yırtık bir şort, Appraisal (G-) ve kimsenin göremediği bir trait vardır: **Divine Paladin (X)**.

Bu sürüm (0.3.0) iki bölümdür. **Bölüm I — *Köksüz*:** prologdan lonca kaydına; Bertram'ın hanında üç günlük iş (her akşam *Servis Koşturmacası*), Yaşlı Haldor'un hasadı ve bir gümüşlük lonca kaydı. **Bölüm II — *G- Rütbe*:** Bertram'ın çatlak sopası, lonca panosu ve üç G görevi, yaralı Vera ile Lina, ilk ortak F görevi ve G rütbesi, kâhyanın çalınan kesesi, değirmen bodrumu, on gümüşlük şehir giriş kartı ve kraliyet şehrinin manzarası. Ardından **Brindlewood**'da pano ilanları ve yan görevlerle serbestçe oynamaya devam edebilirsin.

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
| Appraisal | Bir NPC'ye, canavara ya da **Joseph'e** dokun, veya büyüteç butonu (en yakın hedef). Panel açıkken zaman durur; kapatmak için ekrana dokun | Q, NPC'ye tıklama |
| Görev takibi | HUD'daki **Görevler** kutusunda bir göreve dokun (yön oku onu gösterir); kutunun başlığına dokun: aç/kapat | Menü → Görevler |
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
- Dayanıklılık biterse Joseph **nefes nefese** kalır: joystick'i eşiğin altına çekene ya da bırakana (klavyede Shift'i bırakana) kadar koşamaz.
- **Yardımlı savaş** (varsayılan açık): saldırı tuşu menzildeki en yakın düşmana döner ve vurur (arkandaki dahil); hedefin altında bir işaret belirir. Kapalıyken eski davranış: baktığın yöne, küçük bir nişan düzeltmesiyle.
- Ayarlar: arayüz boyutu, metin hızı, sesler, **karakter hızı** (0.75x–2.0x, yalnızca yürüme/koşma), otomatik ilerleme, ekran sarsıntısı, FPS, grafik kalitesi, joystick modu (dokunmatikte varsayılan: sol altta sabit), **tam ekran** (iPhone'da: "Tam ekran için oyunu ana ekrana ekle"), yardımlı savaş.
- Menü ve Appraisal paneli açıkken oyun zamanı durur (müzik sürer). Mini oyunlar ve konuşmalar eski davranışını korur.
- **Geliştirici modu:** başlık ekranında sürüm numarasına 7 kez dokun. Menüde *Geliştirici* sekmesi açılır (Level/stat/HP/MP/para, skill rütbesi ve EXP, saat/gün, ışınlanma, görev ilerletme, Lonca Puanı); NPC'lerin başında Saygınlık değerleri görünür. Ayarlar'dan kapatılır. Normal oyuncu hiçbirini görmez.

## Sistemler (özet)

- **Statlar:** STR, VIT, AGI, DEX, MNA, INT, LUK; Max HP = 5 + 5×Level + 5×VIT, Max MP = Level + 2×MNA. Her level +4 stat puanı, +1 SP. Tüm formüller `src/core/formulas.ts` içinde ve birim testli.
- **Rütbeler:** G → F → E → D → C → B → A → S → X (skill ve lonca rütbelerinde alt kademeler: G-, G, G+ …).
- **Appraisal:** Gördüğün bilgi, senin ve hedefin Appraisal harfleri arasındaki farka bağlı. Trait'ler hiçbir rütbede görünmez.
- **Skill'ler:** Kullanarak (yavaş) ve zor başarılarla (ani) gelişir. Yeni skill: Sistem Teklifi (SP), öğretmen, kitap/parşömen veya gizli keşif. Haftada en fazla 1 yeni skill.
- **Divine Paladin:** Ayrı level/EXP; Güç, Dayanıklılık, Hız, Öğrenme, Adaptasyon katsayıları `0.5 × 1.15^L × 1.5^⌊L/3⌋`. Her 3 levelde awakening ve Divine skill seçimi (Işık barı ile kullanılır).
- **Ekonomi:** Bronz → Gümüş → Platin → Altın → Elmas (her biri ×100), her biri kendi simgesiyle gösterilir. Her alım/satım/ödül bir işlemdir: doğrulanır, eksiksiz uygulanır, kaydedilir; yetmezse hiçbir şey değişmez.
- **Köy fiyatları:** Ekmek 4, Elma 3, Sıcak Güveç 12, Bez Sargı 15, Küçük HP İksiri 60, Küçük MP İksiri 90, Panzehir 45, Brindlewood Haritası 60 bronz; silah ve zırhlar ~×2.5, kitaplar ×2 (0.1.0'a göre). Han yatağı 40, şifacının yara sarması 15 bronz. Skill dersleri: Okçuluk (Garrick) 2 gümüş, İlk Yardım (Ilse Nine) 1 gümüş 50 bronz, Kılıç (Bertram) 7 gümüş 50 bronz. Tüccarlar eşyayı fiyatının %30–40'ına alır; canavar drop'larının satış değeri sabittir, al-sat ile para kasılamaz. Bkz. `src/data/economy.ts`, `src/data/items.ts`, `src/data/shops.ts`.
- **Hikâye işleri (tek seferlik):** Bertram'ın hanı 3 vardiya (günde en fazla 1), ödeme 3. günün sonunda 50 bronz; ilk günün yemeği bedava. Her akşam **Servis Koşturmacası**: masalarda bira/güveç/ekmek siparişleri, süre bitmeden tezgâhtan alıp götür, kirli tabakları topla ve bulaşığa bırak; her gün daha çok masa ve daha sabırsız müşteri. Sonuç yalnızca Bertram'ın yorumunu değiştirir. Ardından Yaşlı Haldor'un hasadı: 50 bronz. İkisi bir gümüş = lonca kaydı.
- **Görevler (C2):** Veriyle tanımlı ana görevler, yan görevler ve pano görevleri (`src/data/quests.ts`, `src/data/sidequests.ts`). Amaç türleri: konuş, git, topla, öldür, teslim et (+ hikâyeye özel). Ödüller: para, eşya, Lonca Puanı. Yeni ana görev otomatik takip edilir; HUD'daki *Görevler* kutusu ve Menü → *Görevler* sekmesi (açıklama, amaçlar, ödül, rütbe, puan, risk). Yön oku takip edilen hedefi gösterir; iç mekânda yalnızca hedef aynı mekândaysa. Joseph G olana kadar her şey ana görevdir; G'den sonra yan görevler (10 elle yazılmış) ve isteğe bağlı pano ilanları açılır.
- **Lonca Puanı (C3):** G görevi 10, F 30 puan (her harfte belirgin artar). Grup görevlerinde herkes puanın %50'sini alır. Eşikler: G 40, G+ 100, F- 180 (ve en az Level 1). G, F ve E harflerinin içindeki terfiler sınavsızdır; E-'den itibaren harf atlamak sınav ister (sınav henüz oyunda yok). Joseph kendi harfinin ve bir üstünün görevini alabilir. Terfi ertesi gün işlenir ("Kayıtlar yarın işlenir."), bir bildirim ve yeni HUD rozetiyle. **Başarısızlık/bırakma:** görevin puanı kadar puan ve ödülünün iki katı para cezası; para yetmezse loncaya borç yazılır ve sonraki ödüllerden düşülür. Risk görev alınırken gösterilir. Puan 0'ın altına düşerse kart alınır; yeniden kayıt 1 gümüş, G-'den ve 0 puandan.
- **Pano (E7):** Her sabah 15 şablondan 3–4 ilan (en az ikisi G). G 15–40, F 60–90 bronz. Aynı anda en fazla iki pano görevi; üç gün içinde teslim edilmeyen ilan başarısız sayılır.
- **Saygınlık (C1):** Bir stat değil; kuşanılan eşyaların `saygınlık` değerlerinin toplamı (boş gövde/bacak eksi). Status'ta ve envanterde görünür, eşya ayrıntısında katkısı yazar. NPC'lerin de Saygınlık'ı var (konum/itibar + kıyafet); kendi Saygınlık'ı yüksek olan daha az etkilenir. Karşılaştırma tonu değiştirir: küçümseme / nötr / saygı. Kast ortadan kalkmaz. Appraisal'da görünmez; NPC değerleri yalnızca geliştirici modunda.
- **Yoldaşlar (C4):** Vera (kılıç) ve Lina (yay) ortak görevlerde Joseph'i kapılardan ve haritalardan geçerek izler, yolunu kesmez, uzak kalınca ya da takılınca yanına ışınlanır. Kendi başlarına dövüşürler: Vera yanaşır ve yandan sarar, Lina mesafe koruyup geri çekilerek atar. Dost ateşi yok. Yere düşen yoldaş ölmez, savaş bitince kalkar. HP çubukları HUD'da Görevler kutusunun altında. **Joseph yalnızca kendi vurduğu düşmandan EXP alır.**
- **Giriş kartı (C8):** Şehre giriş için rütbe gerekmez: 10 gümüş, 3 ay (84 oyun günü). Kaptan Roderick satar. Envanterde *Giriş Kartları* sekmesinde şehir başına kalan gün; süre dolmadan yenisi alınırsa arka arkaya eklenir.
- **Uyku (C9):** Her "Uyu" yeniden doğma noktasını ayarlar, kaydeder ve bildirir. Gerçek uyku yalnızca 20:00'den sonra ya da 8 saat uyanık kaldıktan sonra; yoksa "Uykum yok" (yine de kayıt).
- **Otomatik kayıt (C7):** Savaşta, ara sahnede, diyalogda, menüde ve mini oyunda değilken her 3 dakikada bir; köşede küçük bir "Kaydedildi" simgesi. Olay kayıtları da sürer.
- **Dükkânlar:** Alışveriş, satış ve dersler yalnızca esnaf kendi dükkânında ve çalışma saatindeyken açılır (Gunnar'ın Demirhanesi, Marta'nın Genel Dükkânı, Ilse Nine'nin Şifa Evi, Brunhild'in Fırını, Terzi Mirelle, Gorm'un Tabakhanesi, Garrick'in Avcı Kulübesi, Bertram'ın hanı).
- **Kast:** Soylular → yüksek rütbeli maceracılar → tüccar ve zanaatkârlar → köylüler → köksüzler. Joseph en alttadır. NPC'ler kasta göre konuşur; köylüler soylu kâhyanın önünde eğilir, yüksek rütbeli maceracılara yol verir; handa şöminenin önündeki masalar üst kastlara ayrılır, köksüzler arkada oturur; dükkânda üst kasttan biri gelirse sıra ona geçer.
- **Zaman:** 1 oyun günü ≈ 24 gerçek dakika. Gece-gündüz, dükkân saatleri, NPC günlük programları.
- **Kayıt:** Otomatik (uyurken, bölge değişince, işlemlerden sonra, 3 dakikada bir) + 3 elle kayıt yuvası. Sürüm numaralı, göç destekli (0.3.0: kayıt sürümü 4).
- **EXP gösterimi:** En fazla bir ondalık, virgülle ve kesilerek (3,3555 → 3,3); tam sayılar ondalıksız. Her yerde aynı (`src/ui/format.ts`).

## Ekonomi hesabı (Bölüm II)

On gümüşlük giriş kartına (1.000 bronz) giden yol kasıtlı olarak uzun tutuldu:

| Kaynak | Bronz |
| --- | --- |
| Kayıttan sonra cepte kalan | ~12 |
| G görevleri: Fareler 20 + Ot 20 (Celeste 10 "kayıt masrafı" keser) + Mektup 30 | 70 |
| Şifacı (Vera ve Lina) | −30 |
| Kurtlar (120 / 3) + kese (kâhyanın attığı) + bodrum (90 / 3) | 40 + 5 + 30 |
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

## Kararlar

Belirsiz kalan yerlerde verilen kararlar (her biri bir satır):

- Köy: dünya 169×120 karo; köy bölgesi 0.2.0'ın ~%60'ı, bina sayısı aynı (32), yerleşim elle çizildi; nehir, köprü, orman kenarı, tarlalar, mera ve gölet aynı yönlerde kaldı.
- Şehir yolu kısaldı: meydandan kontrol noktasına ~65 karo (0.2.0: ~115).
- A1: Nefes nefese kilidi joystick eşiğin altına inince/bırakılınca ya da Shift bırakılınca açılır; dayanıklılığın dolması tek başına açmaz.
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
- C8: Şehrin adı "Kraliyet Şehri Valmont" (baronun adından); 3 ay = 84 oyun günü.
- C9: "8 saat uyanık" en son uyanılan andan sayılır.
- D2: NPC'lerin günlük planı gün numarasından seçilir; handaki akşam kalabalığı her gün değişir; esnaf çalışma saatinde dükkânından çıkmaz.
- D4: Servis Koşturmacası 42 saniye, tepsi 2; masa sayısı 4/5/6, sabır 15/12,5/10,5 sn.
- E2: Yol vermemenin cezası Saygınlığa göre: +4 ve üstü ceza yok, +1–3 üç bronz, daha azı beş bronz.
- E3: Harcama kilidi alışverişi engeller; lonca cezası ve şifacı ödemesi gibi zorunlu ödemeler geçer.
- E5: Gerçek hırsız Çamaşırcı Wynn (AGI 7, DEX 5; Appraisal ile statları görülür). Yanlış suçlama 5 bronz ceza; tekrar denenebilir.
- E6: İkinci ortak F görevi yeni bir iç mekân: değirmen bodrumu, dev fareler.
- E7: Aynı anda en fazla iki pano görevi; ilan üç gün içinde teslim edilmezse başarısız sayılır.
- E8: Şehir manzarası kodla çizildi (sur, kalabalık, kale silueti); şehir kapısı "Şehir bölümü yakında" der; kart süresi işlemeye devam eder.
- 0.2.0 kayıtları: Bertram işinin ortasındaki kayıtlar yeni 3 günlük işe taşınır (yapılmış vardiya en fazla 2 sayılır, son vardiya ödemeyle biter); lonca kaydı yapılmışsa Bölüm II "Eli Boş Maceracı" ile başlar ve pano ertesi sabah açılır; bitiş kartı bayrağı silinir.
- Divine Paladin dengesi (başlangıç çarpanları, hız/hasar cezaları, 5 kat zor level) değişmedi.
- QA: `?qa=1` adresinde Phaser kare süresi kırpması kapalıdır (başsız tarayıcıda 5 FPS altındaki kareler 16 ms sayılıyor, oyun zamanı sürünüyordu). Oyuncu sürümünü etkilemez.

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
node tools/qa/shot.mjs perf              # FPS ve çizilen nesne sayıları
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

- **0.3.0** — Büyük güncelleme.
  - *Bölüm II — G- Rütbe:* Bertram'ın çatlak sopası; ertesi sabah açılan pano ve üç G görevi (Ahırdaki Fareler — Dorn son kanıtı çalar; Şifacıya Ot — Celeste "kayıt masrafı" keser; Kontrol Noktasına Mektup); kâhyaya yol verme ve ceza; handa "dolu" masalar; Vera ve Lina'nın goblin ilanı. "Biraz hava": yaralı Vera ve Lina, ceza kuralları onların ağzından, Lina sırtta yavaş eşlik, şifacıya otuz bronz. Ertesi gün dostluk ve ilk ortak F görevi (Otlaktaki Kurtlar, Vera'nın savaş dersi), G rütbesi ertesi gün, handa ilk kadeh. Kâhyanın kesesi (Appraisal ile hırsız avı), değirmen bodrumundaki dev fareler, On Gümüş, Bertram'a veda, giriş kartı ve kraliyet şehrinin manzarası. 10 yan görev, her sabah değişen pano.
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
