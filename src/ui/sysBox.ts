// 0.11.0 (B2): sistem bildirimi kutusu — koyu, opak zemin, ince altın kenar, türüne göre renkli başlık şeridi ve
// simge; her satırda renkli simge, "etiket · değer" (değerler hizalı ve vurgulu). Satır yükseklikleri ölçülür, kutu
// içeriğe göre büyür: üst üste binme ya da taşma yok. UIScene.showSys ve MenuScene.showNotice kullanır.
import Phaser from 'phaser';
import { COLORS, FONT, txt, uiIcon } from './kit';
import { plainMoney, richLine } from './coins';
import { SYS_THEME, lineIcon, parseSysLine, stackLines, sysTheme } from './sysLayout';

export interface SysBoxOpts {
  title: string;
  lines: string[];
  /** Kutunun genişliği. */
  width: number;
}

const PAD = 16;
const ICON = 22;
const LINE_GAP = 7;
const SIZE = 15;

/** Kutuyu (0,0 üst orta) kurar; kutunun yüksekliği `h` alanında. */
export function buildSysBox(scene: Phaser.Scene, o: SysBoxOpts): Phaser.GameObjects.Container & { h: number; w: number } {
  const theme = sysTheme(o.title);
  const th = SYS_THEME[theme];
  const w = o.width;
  const c = scene.add.container(0, 0) as Phaser.GameObjects.Container & { h: number; w: number };
  const g = scene.add.graphics();
  c.add(g);
  // başlık: simge + yazı (kutu genişliğine sığar)
  const titleT = txt(scene, 0, 0, o.title, { size: 17, font: FONT.title, color: th.text, bold: true, wrap: w - PAD * 2 - 40 }).setOrigin(0.5, 0);
  const titleIcon = uiIcon(scene, 0, 0, th.icon, 26);
  const titleW = titleT.width + 34;
  titleIcon.setPosition(-titleW / 2 + 13, 12 + titleT.height / 2);
  titleT.setPosition(17, 12).setOrigin(0.5, 0);
  titleT.x = -titleW / 2 + 34 + titleT.width / 2;
  c.add([titleIcon, titleT]);
  const headH = 12 + titleT.height + 10;

  // satırlar: etiket sütunu (en geniş etikete göre, en çok kutunun %42'si) ve hizalı değerler
  const parsed = o.lines.map((l) => parseSysLine(l));
  const textX = -w / 2 + PAD + ICON + 10;
  const inner = w / 2 - PAD - textX;
  const measure = (s: string) => {
    const t = txt(scene, 0, 0, plainMoney(s), { size: SIZE, bold: true });
    const wd = t.width;
    t.destroy();
    return wd;
  };
  const labelCol = Math.min(inner * 0.42, Math.max(0, ...parsed.filter((p) => p.value !== null).map((p) => measure(p.label))));
  const objs: { icon: Phaser.GameObjects.Image; parts: Phaser.GameObjects.GameObject[]; h: number }[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    const icon = uiIcon(scene, 0, 0, lineIcon(o.lines[i], theme), ICON);
    const parts: Phaser.GameObjects.GameObject[] = [];
    let h = SIZE + 6;
    const place = (s: string, x: number, maxW: number, opts: { color: string; bold?: boolean }) => {
      // para simgeli satır tek satıra sığıyorsa simgeli; sığmıyorsa düz yazıyla sarılır
      if (/\{[mw]:/.test(s)) {
        const r = richLine(scene, x, 0, s, { size: SIZE, color: opts.color, bold: opts.bold });
        if (r.rowWidth <= maxW) {
          (r as any).__rich = true;
          parts.push(r);
          return SIZE + 6;
        }
        r.destroy();
      }
      const t = txt(scene, x, 0, plainMoney(s), { size: SIZE, color: opts.color, bold: opts.bold, wrap: maxW });
      parts.push(t);
      return t.height;
    };
    if (p.value !== null && labelCol > 0) {
      const lh = place(p.label, textX, labelCol, { color: '#cfd8e8' });
      const vh = place(p.value, textX + labelCol + 14, inner - labelCol - 14, { color: '#ffffff', bold: true });
      h = Math.max(lh, vh);
    } else h = place(p.label, textX, inner, { color: '#e8eef8' });
    objs.push({ icon, parts, h: Math.max(h, ICON) });
  }
  const { ys, bottom } = stackLines(objs.map((x) => x.h), headH + 8, LINE_GAP);
  objs.forEach((ob, i) => {
    const y = ys[i];
    ob.icon.setPosition(-w / 2 + PAD + ICON / 2, y + Math.min(ob.h, SIZE + 6) / 2);
    c.add(ob.icon);
    for (const part of ob.parts) {
      const any = part as any;
      if (any.__rich) any.y = y + (SIZE + 6) / 2;
      else any.y = y + (ob.h > SIZE + 8 ? 0 : (SIZE + 6 - any.height) / 2);
      c.add(part);
    }
  });
  const h = Math.ceil((parsed.length ? bottom : headH) + PAD);
  // zemin: koyu, opak; ince altın kenar; başlıkta tür renginde şerit
  g.fillStyle(0x000000, 0.45);
  g.fillRoundedRect(-w / 2 + 3, 5, w, h, 8);
  g.fillStyle(0x0d0b14, 0.96);
  g.fillRoundedRect(-w / 2, 0, w, h, 8);
  g.fillStyle(th.color, 0.16);
  g.fillRoundedRect(-w / 2, 0, w, headH, { tl: 8, tr: 8, bl: 0, br: 0 });
  g.fillStyle(th.color, 0.95);
  g.fillRect(-w / 2 + 10, headH - 2, w - 20, 2);
  g.lineStyle(1.5, COLORS.gold, 0.9);
  g.strokeRoundedRect(-w / 2, 0, w, h, 8);
  g.lineStyle(1, th.color, 0.35);
  g.strokeRoundedRect(-w / 2 + 3, 3, w - 6, h - 6, 6);
  c.h = h;
  c.w = w;
  return c;
}
