// Service worker kurulumunda önbelleğe alınacak çekirdek dosyalar (vite.config.ts kullanır).
// Phaser'a ve tarayıcıya bağımlı değil: testlerde sınanır.

/** Oyunun çalışması için gerekmeyen, hiç önbelleğe alınmayacak dosyalar. */
export function isNeverCached(f: string): boolean {
  return f === 'sw.js' || f === 'version.json' || f.endsWith('.map') || f === 'CREDITS.md'
    || f.startsWith('assets/licenses/') || /\.(md|txt)$/i.test(f);
}

/**
 * Oyunun açılması için zorunlu olanlar: sayfa, JS/CSS paketi, manifest, simgeler, yazı tipleri,
 * görsel listesi ve başlık ekranı görseli. Gerisi ilk istendiğinde önbelleğe girer.
 */
export function isCoreFile(f: string): boolean {
  if (isNeverCached(f)) return false;
  return f === 'index.html' || f === 'manifest.webmanifest' || f === 'art-index.json'
    || /^build\/[^/]+\.(js|css)$/.test(f)
    || f.startsWith('icons/')
    || /^assets\/fonts\/[^/]+\.(ttf|otf|woff2?)$/i.test(f)
    || /^assets\/art\/cg\/title\.(png|jpe?g|webp)$/i.test(f);
}

/** dist içindeki dosya listesinden ('/' ayraçlı, göreli) SW'nin kurulumda indireceği liste. */
export function precacheList(files: string[]): string[] {
  return ['./', ...files.filter(isCoreFile).map((f) => './' + f)];
}
