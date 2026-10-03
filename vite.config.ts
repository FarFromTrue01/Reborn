import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const root = __dirname;
const versionInfo = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
const VERSION = `${versionInfo.version}+${versionInfo.build}`;

function walk(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base));
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

/** Kullanıcının kendi görselleri: assets/art altındaki dosyaların listesi. */
function artIndex(): string {
  const files = walk(path.join(root, 'assets/art')).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  const audio = walk(path.join(root, 'assets/audio')).filter((f) => /\.(ogg|mp3|wav|m4a)$/i.test(f));
  return JSON.stringify({ files, audio }, null, 0);
}

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
};

/**
 * - Geliştirmede kök dizindeki assets/ klasörünü /assets/ altında sunar.
 * - Build'de assets/ klasörünü dist/assets/ altına kopyalar.
 * - art-index.json, version.json ve sw.js (sürüm + önbellek listesi) üretir.
 */
function elonthAssets(): Plugin {
  return {
    name: 'elonth-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url || '').split('?')[0]);
        if (url.endsWith('/art-index.json')) {
          res.setHeader('Content-Type', 'application/json');
          res.end(artIndex());
          return;
        }
        if (url.endsWith('/version.json')) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ...versionInfo, full: VERSION }));
          return;
        }
        const m = url.match(/\/assets\/(.+)$/);
        if (m && !url.includes('/src/')) {
          const f = path.join(root, 'assets', m[1]);
          if (f.startsWith(path.join(root, 'assets')) && fs.existsSync(f) && fs.statSync(f).isFile()) {
            res.setHeader('Content-Type', MIME[path.extname(f).toLowerCase()] || 'application/octet-stream');
            fs.createReadStream(f).pipe(res);
            return;
          }
        }
        if (url.endsWith('/sw.js')) {
          res.setHeader('Content-Type', 'application/javascript');
          res.end('// geliştirme modunda service worker yok\nself.addEventListener("install",()=>self.skipWaiting());');
          return;
        }
        next();
      });
    },
    writeBundle(opts) {
      const out = opts.dir || path.join(root, 'dist');
      // assets kopyala
      const src = path.join(root, 'assets');
      for (const f of walk(src)) {
        const to = path.join(out, 'assets', f);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(path.join(src, f), to);
      }
      fs.writeFileSync(path.join(out, 'art-index.json'), artIndex());
      fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({ ...versionInfo, full: VERSION }));
      if (fs.existsSync(path.join(root, 'CREDITS.md'))) fs.copyFileSync(path.join(root, 'CREDITS.md'), path.join(out, 'CREDITS.md'));
      // service worker
      const files = walk(out).filter((f) => f !== 'sw.js' && f !== 'version.json' && !f.endsWith('.map'));
      const tpl = fs.readFileSync(path.join(root, 'src/sw-template.js'), 'utf8');
      const sw = tpl.replace('__VERSION__', VERSION).replace('__FILES__', JSON.stringify(['./', ...files.map((f) => './' + f)]));
      fs.writeFileSync(path.join(out, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(VERSION),
  },
  build: {
    assetsDir: 'build',
    target: 'es2020',
    chunkSizeWarningLimit: 4000,
  },
  server: { host: true, port: 5173 },
  plugins: [elonthAssets()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
} as any);
