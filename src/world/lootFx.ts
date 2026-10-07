// 0.11.0 (C16): yere düşen ganimetin ışıltısı. Altında yumuşak, nabız gibi atan bir ışık halkası ve ara sıra küçük
// parıltılar; renk nadirliğe göre (sıradan beyaz-sarı, para altın, özel drop'ta altın ışık sütunu). 120 sn'lik
// ömrün son 15 sn'sinde yanıp söner. Tablet için efektler havuzlanır: aynı anda en fazla LOOT_FX_MAX ganimet ışır.
import Phaser from 'phaser';

export const LOOT_LIFE_SEC = 120;
export const LOOT_BLINK_SEC = 15;
export const LOOT_FX_MAX = 20;

export type LootKind = 'common' | 'money' | 'special';

export const LOOT_COLOR: Record<LootKind, number> = { common: 0xfff2b0, money: 0xffd040, special: 0xffc030 };

/** Yanıp sönme: son 15 sn'de görünür mü (giderek hızlanır)? */
export function lootVisible(t: number, life = LOOT_LIFE_SEC): boolean {
  const left = life - t;
  if (left > LOOT_BLINK_SEC) return true;
  const rate = left > 5 ? 3 : 6;
  return Math.floor(t * rate * 2) % 2 === 0;
}

/** Nabız (0..1). */
export function lootPulse(t: number): number {
  return 0.5 + 0.5 * Math.sin(t * 3.2);
}

interface FxSlot {
  ring: Phaser.GameObjects.Image;
  column: Phaser.GameObjects.Image;
  used: boolean;
}

/** Ganimet efekt havuzu: halka + (özelde) ışık sütunu; parıltılar ara sıra. */
export class LootFxPool {
  private slots: FxSlot[] = [];

  constructor(private scene: Phaser.Scene) {}

  take(): FxSlot | null {
    let s = this.slots.find((x) => !x.used);
    if (!s) {
      if (this.slots.length >= LOOT_FX_MAX) return null;
      const ring = this.scene.add.image(0, 0, 'soft').setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      const column = this.scene.add.image(0, 0, 'soft').setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      s = { ring, column, used: false };
      this.slots.push(s);
    }
    s.used = true;
    return s;
  }

  give(s: FxSlot | null | undefined) {
    if (!s) return;
    s.used = false;
    s.ring.setVisible(false);
    s.column.setVisible(false);
  }

  /** Bir ganimetin efektini çiz. */
  draw(s: FxSlot, x: number, y: number, kind: LootKind, t: number, visible: boolean) {
    const k = lootPulse(t);
    const col = LOOT_COLOR[kind];
    s.ring.setVisible(visible).setTint(col).setPosition(x, y + 2).setDepth(y - 1);
    s.ring.setScale(0.32 + 0.06 * k, (0.32 + 0.06 * k) * 0.45).setAlpha((kind === 'common' ? 0.35 : 0.5) + 0.3 * k);
    if (kind === 'special') {
      s.column.setVisible(visible).setTint(col).setPosition(x, y - 26).setDepth(y + 2);
      s.column.setScale(0.18, 1.5 + 0.3 * k).setAlpha(0.35 + 0.25 * k);
    } else s.column.setVisible(false);
  }

  destroy() {
    for (const s of this.slots) {
      s.ring.destroy();
      s.column.destroy();
    }
    this.slots = [];
  }
}
