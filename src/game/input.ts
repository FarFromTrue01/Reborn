// Ortak giriş durumu: dokunmatik joystick/butonlar (UIScene) ve klavye/fare (WorldScene) burayı doldurur.

export type Action = 'attack' | 'heavy' | 'dodge' | 'interact' | 'skill1' | 'skill2' | 'skill3' | 'skill4' | 'div1' | 'div2' | 'div3' | 'menu' | 'appraise' | 'map' | 'eat';

class InputState {
  moveX = 0;
  moveY = 0;
  run = false;
  touchMove = false;
  /** Joystick'in son konumu: etkileşim (diyalog, menü) bitince yürüme, parmak kaldırılmadan sürsün. */
  touchX = 0;
  touchY = 0;
  /** Fare ile hedef yönü (dünya koordinatı); null ise hareket yönü kullanılır. */
  aim: { x: number; y: number } | null = null;
  private pressed = new Set<Action>();
  held = new Set<Action>();
  enabled = true;

  press(a: Action) {
    if (!this.enabled && a !== 'menu') return;
    this.pressed.add(a);
  }

  consume(a: Action): boolean {
    if (this.pressed.has(a)) {
      this.pressed.delete(a);
      return true;
    }
    return false;
  }

  peek(a: Action) {
    return this.pressed.has(a);
  }

  clear() {
    this.pressed.clear();
    this.held.clear();
    this.moveX = 0;
    this.moveY = 0;
    this.run = false;
  }
}

export const Input = new InputState();

(window as any).__IN = Input;
