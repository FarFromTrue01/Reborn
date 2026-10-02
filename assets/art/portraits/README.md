# Portreler

Buraya kendi ürettiğin portreleri koy: `<karakter>_<ifade>.png`

- Karakterler: `joseph`, `bertram`, `vera`, `lina`, `celeste`, `system` (isteğe bağlı) ve köylüler için NPC kimliği (`data/npcs.ts`).
- İfadeler: `normal`, `gulen`, `kizgin`, `saskin`, `uzgun`, `alayci`

Örnek: `vera_alayci.png`. Önerilen boyut: 256×256 veya 512×512, kare, şeffaf arka plan.
Dosya yoksa oyun LPC sprite'ından üretilmiş piksel portreyi kullanır.
Yeni dosya ekledikten sonra yeniden build gerekir (GitHub Actions bunu her push'ta yapar).
