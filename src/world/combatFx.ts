// Dövüş geri bildirimi (B23, 0.10.0): vuruş donması, havuzlu hasar sayıları, yerinde tepki (sarsılma + ezilip açılma),
// silaha/hedefe göre parçacık, katmanlı ses, saldırı uyarısı (geri çekilme pozu), kaçış hissi, vurulunca kenar kızarması
// ve düşük canda kalp atışı + vinyet. Titreşim (haptik) yok. Sayılar burada; saf kısımlar tests/g6.test.ts.
// Saf kısımlar testte Phaser'sız yüklensin diye: Phaser yalnızca tür, ses ve yazı tipi kurucudan gelir.
import type Phaser from 'phaser';

type Sfx = (name: string, vol?: number) => void;
interface Fonts { ui: string; body: string }

/** Vuruş donması (sn): isabet / kritik. Ayarlar → "Ekran sarsıntısı ve vuruş donması" kapalıysa 0. */
export const HITSTOP = { hit: 0.05, crit: 0.09 } as const;
/** Yerinde tepki süresi (sn): geri itme yok; düşman yerinde sarsılır ve ezilip açılır. */
export const REACT_TIME = 0.1;
export const SQUASH = { x: 1.14, y: 0.84 } as const;
/** Kusursuz kaçışta ağır çekim (sn). */
export const PERFECT_DODGE_SLOWMO = 0.2;
/** Can bu oranın altındayken kalp atışı ve kırmızı vinyet. */
export const LOW_HP = 0.25;
/** Kalp atışı aralığı (sn). */
export const HEARTBEAT_EVERY = 1.1;
/** Saldırı uyarısında geri çekilme (piksel, hazırlığın sonunda). */
export const WINDUP_PULLBACK = 4;
/** Havuzdaki en fazla sayı (tablet performansı). */
export const NUMBER_POOL = 24;

export function hitstopFor(crit: boolean, enabled: boolean): number {
  if (!enabled) return 0;
  return crit ? HITSTOP.crit : HITSTOP.hit;
}

export type NumberKind = 'dmg' | 'crit' | 'low' | 'miss' | 'hurt' | 'heal' | 'exp' | 'info' | 'sneak' | 'divine';

/** Sayı stili: normal beyaz, kritik büyük ve sarı, düşük/direnilen gri, ıska, Joseph'in aldığı hasar kırmızı. */
export const NUMBER_STYLE: Record<NumberKind, { size: number; color: string; italic?: boolean; stroke: string }> = {
  dmg: { size: 16, color: '#ffffff', stroke: '#2a1a10' },
  crit: { size: 23, color: '#ffd23a', stroke: '#5a1a00' },
  low: { size: 13, color: '#9aa0a8', stroke: '#1a1f2a' },
  miss: { size: 12, color: '#c8d0e0', italic: true, stroke: '#1a1f2a' },
  hurt: { size: 17, color: '#ff5a4a', stroke: '#2a0505' },
  heal: { size: 16, color: '#7dff8a', stroke: '#0a2a10' },
  exp: { size: 12, color: '#bfe4ff', stroke: '#0a1a2a' },
  info: { size: 12, color: '#f0e6c8', stroke: '#1a140a' },
  sneak: { size: 13, color: '#d9a8ff', stroke: '#200a2a' },
  divine: { size: 13, color: '#ffe9a0', stroke: '#3a2a00' },
};

/** Vuruşun sayı türü: kritik, ham hasarın yarısından azı işlediyse (direnç/zırh) "düşük", yoksa normal. */
export function hitNumberKind(damage: number, raw: number, crit: boolean): NumberKind {
  if (crit) return 'crit';
  if (raw > 0 && damage < raw * 0.5) return 'low';
  return 'dmg';
}

export type Material = 'flesh' | 'slime' | 'armor';

/** Hedefin malzemesi (isabet sesi ve parçacığı). */
export function materialOf(monsterId: string | null): Material {
  if (!monsterId) return 'flesh';
  if (monsterId.startsWith('slime')) return 'slime';
  if (monsterId === 'goblin_chief') return 'armor';
  return 'flesh';
}

export const MATERIAL_FX: Record<Material, { color: number; sound: string; n: number }> = {
  flesh: { color: 0xc8a070, sound: 'impact_flesh', n: 6 },
  slime: { color: 0x7ad85a, sound: 'impact_slime', n: 8 },
  armor: { color: 0xfff0b0, sound: 'impact_armor', n: 9 },
};

/** Vurulunca ekran kenarının kızarması: aldığın hasarın can oranıyla (0,12–0,6). */
export function hurtEdgeAlpha(damage: number, maxHp: number): number {
  return Math.max(0.12, Math.min(0.6, 0.12 + (0.6 * damage) / Math.max(0.1, maxHp)));
}

export function isLowHp(hp: number, maxHp: number): boolean {
  return hp > 0 && hp / Math.max(0.1, maxHp) < LOW_HP;
}

/** Hazırlıkta geri çekilme (0..1 ilerlemede piksel). */
export function windupOffset(t: number): number {
  return -WINDUP_PULLBACK * Math.min(1, Math.max(0, t));
}

/** Dünya sahnesindeki dövüş efektleri (sahne başına bir tane; havuzlar sahneyle yok olur). */
export class CombatFx {
  private pool: Phaser.GameObjects.Text[] = [];
  private live = 0;

  constructor(public scene: Phaser.Scene, private sfx: Sfx, private font: Fonts, private dpr = 1) {}

  /** Yukarı süzülen sayı (havuzdan). */
  number(x: number, y: number, text: string, kind: NumberKind = 'dmg') {
    const s = NUMBER_STYLE[kind];
    let t = this.pool.pop();
    if (!t || !t.scene) {
      if (this.live >= NUMBER_POOL) return;
      t = this.scene.add.text(0, 0, '', { fontFamily: this.font.ui, fontSize: '16px', fontStyle: 'bold' });
      this.live++;
    }
    const z = this.scene.cameras.main.zoom;
    t.setText(text).setPosition(x, y).setAlpha(1).setScale(1).setVisible(true).setActive(true);
    t.setStyle({ fontFamily: kind === 'miss' ? this.font.body : this.font.ui, fontSize: `${s.size}px`, color: s.color, fontStyle: s.italic ? 'italic bold' : 'bold', stroke: s.stroke, strokeThickness: 2 });
    t.setResolution(z * (this.dpr > 1 ? 1 : 1)).setOrigin(0.5, 1).setDepth(950000);
    const dx = (Math.random() - 0.5) * 18;
    const big = kind === 'crit';
    if (big) {
      t.setScale(0.4);
      this.scene.tweens.add({ targets: t, scale: 1.25, duration: 120, ease: 'Back.Out', yoyo: true, hold: 60, onComplete: () => t!.setScale(1) });
    }
    this.scene.tweens.add({ targets: t, x: x + dx, y: y - (big ? 34 : 24), duration: big ? 900 : 700, ease: 'Cubic.Out' });
    this.scene.tweens.add({
      targets: t, alpha: 0, delay: big ? 650 : 450, duration: 300,
      onComplete: () => {
        t!.setVisible(false).setActive(false);
        this.pool.push(t!);
      },
    });
  }

  /** Yerinde tepki: kısa sarsılma ve ezilip açılma (geri itme yok). */
  react(actor: Phaser.GameObjects.Container & { layers?: Phaser.GameObjects.Sprite[] }) {
    const layers = actor.layers ?? [];
    if (!layers.length) return;
    const base = layers.map((l) => ({ l, sx: l.scaleX, sy: l.scaleY, x: l.x }));
    this.scene.tweens.add({
      targets: layers, scaleX: (_t: unknown, _k: string, v: number) => v * SQUASH.x, scaleY: (_t: unknown, _k: string, v: number) => v * SQUASH.y,
      duration: (REACT_TIME * 1000) / 2, yoyo: true, ease: 'Quad.Out',
      onComplete: () => base.forEach((b) => b.l.setScale(b.sx, b.sy)),
    });
    let n = 0;
    const jitter = this.scene.time.addEvent({
      delay: 20, repeat: 4, callback: () => {
        n++;
        for (const b of base) b.l.x = b.x + (n % 2 ? 1.5 : -1.5);
        if (n >= 5) for (const b of base) b.l.x = b.x;
      },
    });
    void jitter;
  }

  /** İsabet parçacıkları ve katmanlı ses (savurma ayrı çalar; burada isabet + kritikte çınlama). */
  impact(x: number, y: number, mat: Material, crit: boolean, spark: (x: number, y: number, color: number, n: number) => void) {
    const m = MATERIAL_FX[mat];
    spark(x, y, m.color, crit ? m.n + 5 : m.n);
    this.sfx(crit ? 'crit' : 'hit', 0.45);
    this.sfx(m.sound, crit ? 0.9 : 0.7);
    if (crit) this.sfx('crit_ring', 0.8);
  }
}
