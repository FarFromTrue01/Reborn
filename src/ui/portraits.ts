// Portreler: kullanıcının kendi görseli varsa onu, yoksa LPC sprite'ından üretilmiş piksel portreyi kullanır.
import Phaser from 'phaser';
import { G } from '../game/G';
import type { Expression } from '../data/manifest';

/** Portre kimliği → LPC sayfa anahtarı. */
const SHEET_OF: Record<string, string> = {
  joseph: '__joseph',
  captain: 'gate_captain',
};

const BG: Record<string, [string, string]> = {
  joseph: ['#2a3550', '#141a2a'],
  vera: ['#5a2626', '#2a1010'],
  lina: ['#3d4f22', '#1a220e'],
  celeste: ['#2e3f63', '#141c30'],
  bertram: ['#4f3a24', '#21170c'],
  system: ['#0e2b57', '#061428'],
};

export function portraitSheet(id: string) {
  return SHEET_OF[id] ?? id;
}

/** Joseph'in o anki görünümünden (katmanlardan) portre dokusu. */
function josephCanvas(scene: Phaser.Scene, layers: string[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  for (const k of layers) {
    const fr = scene.textures.getFrame(k, 130);
    if (!fr) continue;
    const src = fr.source.image as HTMLImageElement;
    ctx.drawImage(src, fr.cutX + 16, fr.cutY + 10, 32, 32, 0, 0, 32, 32);
  }
  return c;
}

export function lpcPortraitKey(scene: Phaser.Scene, id: string, josephLayers?: string[]): string {
  const key = 'portrait_lpc_' + id + (josephLayers ? '_' + josephLayers.join('.') : '');
  if (scene.textures.exists(key)) return key;
  const S = 128;
  const tex = scene.textures.createCanvas(key, S, S)!;
  const ctx = tex.getContext();
  const [c1, c2] = BG[id] ?? ['#3a3046', '#17121e'];
  const g = ctx.createRadialGradient(S / 2, S * 0.4, 8, S / 2, S / 2, S * 0.75);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.imageSmoothingEnabled = false;
  if (id === 'system') {
    ctx.strokeStyle = '#9fd6ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#d9f1ff';
    ctx.font = 'bold 40px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✦', S / 2, S / 2 + 2);
  } else {
    let src: CanvasImageSource | null = null;
    let sx = 0, sy = 0;
    if (josephLayers) {
      src = josephCanvas(scene, josephLayers);
    } else {
      const sheet = portraitSheet(id);
      const fr = scene.textures.exists(sheet) ? scene.textures.getFrame(sheet, 130) : null;
      if (fr) {
        src = fr.source.image as HTMLImageElement;
        sx = fr.cutX + 16;
        sy = fr.cutY + 10;
      }
    }
    if (src) {
      // gölge
      ctx.globalAlpha = 0.35;
      ctx.filter = 'brightness(0)';
      ctx.drawImage(src, sx, sy, 32, 32, 6, 14, 128, 128);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.drawImage(src, sx, sy, 32, 32, 0, 8, 128, 128);
    }
  }
  // vinyet
  const v = ctx.createRadialGradient(S / 2, S / 2, S * 0.35, S / 2, S / 2, S * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, S, S);
  tex.refresh();
  return key;
}

/** Kullanıcı portresi varsa yolu. */
export function userPortraitPath(id: string, expr: Expression): string | null {
  const exact = `portraits/${id}_${expr}.png`;
  if (G.hasArt(exact)) return 'assets/art/' + exact;
  const normal = `portraits/${id}_normal.png`;
  if (G.hasArt(normal)) return 'assets/art/' + normal;
  return null;
}

/** Portre dokusu anahtarı: gerekirse yükler (Promise). */
export function ensurePortrait(scene: Phaser.Scene, id: string, expr: Expression, josephLayers?: string[]): Promise<{ key: string; user: boolean }> {
  const path = userPortraitPath(id, expr);
  if (!path) return Promise.resolve({ key: lpcPortraitKey(scene, id, josephLayers), user: false });
  const key = 'uportrait_' + path;
  if (scene.textures.exists(key)) return Promise.resolve({ key, user: true });
  return new Promise((res) => {
    scene.load.image(key, path);
    scene.load.once('complete', () => res({ key: scene.textures.exists(key) ? key : lpcPortraitKey(scene, id, josephLayers), user: scene.textures.exists(key) }));
    scene.load.start();
  });
}

/** Sahne görseli (CG) varsa yükler. */
export function ensureCG(scene: Phaser.Scene, name: string): Promise<string | null> {
  const rel = `cg/${name}.png`;
  if (!G.hasArt(rel)) return Promise.resolve(null);
  const key = 'cg_' + name;
  if (scene.textures.exists(key)) return Promise.resolve(key);
  return new Promise((res) => {
    scene.load.image(key, 'assets/art/' + rel);
    scene.load.once('complete', () => res(scene.textures.exists(key) ? key : null));
    scene.load.start();
  });
}

export const EXPR_GLYPH: Record<string, { ch: string; color: string } | null> = {
  normal: null,
  gulen: { ch: '♪', color: '#ffe48a' },
  kizgin: { ch: '!!', color: '#ff5a4a' },
  saskin: { ch: '!?', color: '#ffffff' },
  uzgun: { ch: '…', color: '#9fc8ff' },
  alayci: { ch: '~', color: '#ffb0d0' },
};

/**
 * Yaratık portresi: canavar sprite sayfasının ilk karesi, saydam kenarlar kırpılıp ortalanır.
 * (Goblinler LPC karakter sayfası kullanır; onlar için lpcPortraitKey yeterli.) Sayfa yoksa null.
 */
export function monsterPortraitKey(scene: Phaser.Scene, sheet: string): string | null {
  const key = 'portrait_mon_' + sheet;
  if (scene.textures.exists(key)) return key;
  if (!scene.textures.exists(sheet)) return null;
  const fr = scene.textures.getFrame(sheet, 0);
  if (!fr) return null;
  const src = fr.source.image as HTMLImageElement;
  // ilk kareyi ayrı bir tuvale al, saydam olmayan piksellerin sınırını bul
  const tmp = document.createElement('canvas');
  tmp.width = fr.cutWidth;
  tmp.height = fr.cutHeight;
  const tctx = tmp.getContext('2d', { willReadFrequently: true })!;
  tctx.drawImage(src, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
  let x0 = tmp.width, y0 = tmp.height, x1 = -1, y1 = -1;
  try {
    const px = tctx.getImageData(0, 0, tmp.width, tmp.height).data;
    for (let y = 0; y < tmp.height; y++)
      for (let x = 0; x < tmp.width; x++)
        if (px[(y * tmp.width + x) * 4 + 3] > 20) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
  } catch {
    /* tuval okunamadı: karenin tamamı */
  }
  if (x1 < 0) {
    x0 = 0;
    y0 = 0;
    x1 = tmp.width - 1;
    y1 = tmp.height - 1;
  }
  const S = 128;
  const tex = scene.textures.createCanvas(key, S, S)!;
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(S / 2, S * 0.45, 8, S / 2, S / 2, S * 0.75);
  g.addColorStop(0, '#5a2a26');
  g.addColorStop(1, '#1e0c0c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.imageSmoothingEnabled = false;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  // tam sayı ölçek: piksel sanatı keskin kalsın; kutunun ~%80'ini doldur
  const k = Math.max(1, Math.floor((S * 0.8) / Math.max(bw, bh)));
  const dw = bw * k, dh = bh * k;
  const dx = Math.round((S - dw) / 2), dy = Math.round((S - dh) / 2 + 4);
  ctx.globalAlpha = 0.35;
  ctx.filter = 'brightness(0)';
  ctx.drawImage(tmp, x0, y0, bw, bh, dx + 4, dy + 6, dw, dh);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.drawImage(tmp, x0, y0, bw, bh, dx, dy, dw, dh);
  const v = ctx.createRadialGradient(S / 2, S / 2, S * 0.35, S / 2, S / 2, S * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, S, S);
  tex.refresh();
  return key;
}
