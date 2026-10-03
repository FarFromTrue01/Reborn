import Phaser from 'phaser';
import { ATLASES, BUILDINGS, CHAR_SHEETS, IMAGES, JOSEPH_LAYERS, JSONS, MONSTER_SHEETS, LPC_FRAME } from '../data/manifest';
import { G } from '../game/G';
import { makeCoinTextures } from '../ui/coins';
import { warmCache } from '../game/pwa';

/** Tüm görselleri manifestten yükler, çalışma zamanı dokularını üretir. */
export class BootScene extends Phaser.Scene {
  private loaded: string[] = [];

  constructor() {
    super('Boot');
  }

  preload() {
    const bar = document.getElementById('bootbar');
    const msg = document.getElementById('bootmsg');
    this.load.on('progress', (v: number) => {
      if (bar) bar.style.width = `${Math.round(v * 100)}%`;
    });
    this.load.on('fileprogress', (f: any) => {
      if (msg) msg.textContent = 'Yükleniyor… ' + (f.key ?? '');
    });
    this.load.on('loaderror', (f: any) => console.warn('Yüklenemedi:', f.key, f.src));
    // yüklenen adresler: açılıştan sonra service worker önbelleğine kopyalanır (warmCache)
    this.load.on('load', (f: any) => {
      if (typeof f.src === 'string') this.loaded.push(f.src);
    });
    for (const [k, p] of Object.entries(CHAR_SHEETS)) this.load.spritesheet(k, p, { frameWidth: LPC_FRAME, frameHeight: LPC_FRAME });
    for (const [k, l] of Object.entries(JOSEPH_LAYERS)) this.load.spritesheet('j_' + k, l.file, { frameWidth: LPC_FRAME, frameHeight: LPC_FRAME });
    for (const [k, p] of Object.entries(MONSTER_SHEETS)) this.load.spritesheet(k, p, { frameWidth: 64, frameHeight: 64 });
    for (const [k, p] of Object.entries(IMAGES)) this.load.image(k, p);
    for (const b of BUILDINGS) this.load.image('b_' + b, `assets/gfx/buildings/${b}.png`);
    for (const [k, a] of Object.entries(ATLASES)) this.load.atlas(k, a.image, a.json);
    for (const [k, p] of Object.entries(JSONS)) this.load.json(k, p);
  }

  create() {
    const idx = this.cache.json.get('artIndex');
    if (idx?.files) for (const f of idx.files) G.artFiles.add(f);
    if (idx?.audio) for (const f of idx.audio) G.audioFiles.add(f);
    G.credits = this.cache.json.get('credits');
    this.makeTextures();
    // Emoji tarzı simgeler küçültülerek çizilir: yumuşak filtre (piksel sanat değil)
    this.textures.get('uiicons').setFilter(Phaser.Textures.FilterMode.LINEAR);
    makeCoinTextures(this);
    const boot = document.getElementById('boot');
    if (boot) {
      boot.style.opacity = '0';
      setTimeout(() => boot.remove(), 700);
    }
    warmCache(this.loaded);
    this.scene.start('Title');
  }

  private makeTextures() {
    const mk = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
      if (this.textures.exists(key)) return;
      const t = this.textures.createCanvas(key, w, h)!;
      draw(t.getContext());
      t.refresh();
    };
    mk('px', 2, 2, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 2, 2); });
    mk('soft', 64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
    });
    mk('light', 256, 256, (c) => {
      const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.25)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 256);
    });
    mk('shadow', 32, 12, (c) => {
      const g = c.createRadialGradient(16, 6, 0, 16, 6, 16);
      g.addColorStop(0, 'rgba(0,0,0,0.45)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.save();
      c.scale(1, 12 / 32);
      c.fillRect(0, 0, 32, 32);
      c.restore();
    });
    mk('spark', 6, 6, (c) => {
      c.fillStyle = '#fff';
      c.fillRect(2, 0, 2, 6);
      c.fillRect(0, 2, 6, 2);
    });
    mk('dot', 3, 3, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 3, 3); });
    mk('leaf', 6, 4, (c) => {
      c.fillStyle = '#7fae3a'; c.fillRect(1, 0, 4, 1); c.fillRect(0, 1, 6, 2); c.fillStyle = '#4f7d22'; c.fillRect(1, 3, 4, 1);
    });
    mk('leaf2', 6, 4, (c) => {
      c.fillStyle = '#c99a2e'; c.fillRect(1, 0, 4, 1); c.fillRect(0, 1, 6, 2); c.fillStyle = '#8d5f17'; c.fillRect(1, 3, 4, 1);
    });
    mk('ray', 64, 256, (c) => {
      const g = c.createLinearGradient(0, 0, 64, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 256);
      const v = c.createLinearGradient(0, 0, 0, 256);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(0.2, 'rgba(0,0,0,1)');
      v.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalCompositeOperation = 'destination-in';
      c.fillStyle = v;
      c.fillRect(0, 0, 64, 256);
    });
    mk('ring', 64, 64, (c) => {
      c.strokeStyle = '#fff';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(32, 32, 28, 0, Math.PI * 2);
      c.stroke();
    });
    mk('slash', 64, 64, (c) => {
      c.strokeStyle = 'rgba(255,255,255,0.95)';
      c.lineWidth = 6;
      c.lineCap = 'round';
      c.beginPath();
      c.arc(32, 32, 24, -Math.PI * 0.75, Math.PI * 0.15);
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.4)';
      c.lineWidth = 12;
      c.beginPath();
      c.arc(32, 32, 20, -Math.PI * 0.6, Math.PI * 0.05);
      c.stroke();
    });
    mk('arrow', 16, 4, (c) => {
      c.fillStyle = '#6b4a2a'; c.fillRect(0, 1, 12, 2); c.fillStyle = '#ddd'; c.fillRect(12, 0, 4, 4); c.fillStyle = '#eee'; c.fillRect(0, 0, 3, 4);
    });
    // İç mekân duvarları (32x64, yatay döşenir)
    const wall = (key: string, base: string, dark: string, kind: 'wood' | 'stone' | 'plaster') => mk(key, 64, 64, (c) => {
      c.fillStyle = base;
      c.fillRect(0, 0, 64, 64);
      if (kind === 'wood') {
        for (let x = 0; x < 64; x += 8) {
          c.fillStyle = x % 16 ? '#6b4426' : '#5e3a20';
          c.fillRect(x, 6, 8, 50);
          c.fillStyle = dark;
          c.fillRect(x, 6, 1, 50);
          c.fillStyle = 'rgba(255,220,170,0.08)';
          c.fillRect(x + 1, 6, 1, 50);
        }
        c.fillStyle = 'rgba(0,0,0,0.25)';
        for (let i = 0; i < 6; i++) c.fillRect((i * 23) % 60, 12 + ((i * 17) % 40), 2, 2);
      } else if (kind === 'stone') {
        for (let y = 6; y < 56; y += 10) {
          const off = (y / 10) % 2 ? 0 : 10;
          for (let x = -off; x < 64; x += 20) {
            c.fillStyle = ((x + y) / 10) % 3 ? '#6d6a76' : '#625f6c';
            c.fillRect(x + 1, y + 1, 18, 8);
            c.fillStyle = 'rgba(255,255,255,0.08)';
            c.fillRect(x + 1, y + 1, 18, 1);
          }
        }
      } else {
        c.fillStyle = '#d8cba6';
        c.fillRect(0, 6, 64, 50);
        c.fillStyle = 'rgba(120,90,50,0.10)';
        for (let i = 0; i < 40; i++) c.fillRect((i * 37) % 64, 8 + ((i * 13) % 46), 3, 2);
        c.fillStyle = '#5e3a20';
        c.fillRect(0, 6, 4, 50);
        c.fillRect(32, 6, 4, 50);
      }
      // üst kiriş ve süpürgelik
      c.fillStyle = '#3a2414';
      c.fillRect(0, 0, 64, 6);
      c.fillStyle = '#6b4426';
      c.fillRect(0, 1, 64, 2);
      c.fillStyle = '#2a190d';
      c.fillRect(0, 56, 64, 8);
      c.fillStyle = '#4f321b';
      c.fillRect(0, 57, 64, 2);
    });
    wall('wall_wood', '#4a2e18', '#2e1c0e', 'wood');
    wall('wall_stone', '#4a4854', '#2e2c36', 'stone');
    wall('wall_plaster', '#c8b890', '#8a7a58', 'plaster');
    // Görev panosu
    mk('board', 96, 64, (c) => {
      c.fillStyle = '#4a2e18';
      c.fillRect(0, 0, 96, 64);
      c.fillStyle = '#7a5530';
      c.fillRect(4, 4, 88, 56);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 0; i < 12; i++) c.fillRect(8 + ((i * 29) % 80), 8 + ((i * 13) % 48), 2, 2);
      // eski kâğıt kalıntıları
      c.fillStyle = '#d8cba6';
      c.fillRect(12, 10, 14, 5);
      c.fillRect(64, 40, 10, 6);
      c.fillStyle = '#e8dcc0';
      c.fillRect(36, 22, 24, 18);
      c.fillStyle = '#5a4a3a';
      c.font = 'bold 7px serif';
      c.fillText('YARIN', 38, 34);
      c.fillStyle = '#c0392b';
      c.fillRect(47, 22, 2, 2);
    });
    mk('ranks', 64, 56, (c) => {
      c.fillStyle = '#3a2414';
      c.fillRect(0, 0, 64, 56);
      c.fillStyle = '#e8dcc0';
      c.fillRect(3, 3, 58, 50);
      c.fillStyle = '#5a3a1a';
      c.font = 'bold 6px serif';
      'GFEDCBASX'.split('').forEach((l, i) => c.fillText(l, 6 + (i % 3) * 20, 14 + Math.floor(i / 3) * 14));
      c.fillStyle = '#b08a2a';
      c.fillRect(3, 3, 58, 2);
    });
    mk('stone', 40, 56, (c) => {
      c.fillStyle = '#4a4854';
      c.fillRect(6, 34, 28, 20);
      c.fillStyle = '#6d6a76';
      c.fillRect(4, 30, 32, 6);
      c.fillStyle = '#2e2c36';
      c.fillRect(6, 52, 28, 3);
      const g = c.createLinearGradient(10, 4, 30, 30);
      g.addColorStop(0, '#d9f1ff');
      g.addColorStop(0.5, '#5aa8e8');
      g.addColorStop(1, '#1a4a8a');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(20, 2);
      c.lineTo(32, 16);
      c.lineTo(20, 30);
      c.lineTo(8, 16);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.fillRect(16, 8, 3, 6);
    });
    mk('bolt', 12, 12, (c) => {
      const g = c.createRadialGradient(6, 6, 0, 6, 6, 6);
      g.addColorStop(0, '#fff7c2'); g.addColorStop(0.5, '#ff9a2e'); g.addColorStop(1, 'rgba(255,60,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, 12, 12);
    });
  }
}
