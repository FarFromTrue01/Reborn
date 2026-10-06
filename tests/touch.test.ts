// Joystick'in altındaki NPC Appraisal açmasın: dokunuş niyeti önceliği.
import { describe, it, expect } from 'vitest';
import { touchIntent, type TouchCtx } from '../src/game/touch';

const uiW = 1280;
const fixed = { x: 150, y: 570, r: 95 };
const ctx = (o: Partial<TouchCtx>): TouchCtx => ({ x: 0, y: 0, uiW, joyActive: false, fixed, ...o });

describe('touchIntent', () => {
  it('sabit joystick tabanı her zaman joystick (altında NPC olsa bile)', () => {
    expect(touchIntent(ctx({ x: 150, y: 570 }))).toBe('joystick');
    expect(touchIntent(ctx({ x: 150 + 90, y: 570 }))).toBe('joystick');
    // başka parmak joystick'teyken bile tabana dokunmak Appraisal açmaz
    expect(touchIntent(ctx({ x: 160, y: 560, joyActive: true }))).toBe('joystick');
  });

  it('serbest mod, sol yarı: joystick boşta ise hareket niyeti', () => {
    expect(touchIntent(ctx({ x: 400, y: 200, fixed: null }))).toBe('joystick');
    expect(touchIntent(ctx({ x: uiW / 2 - 1, y: 300, fixed: null }))).toBe('joystick');
  });

  it('sabit mod (0.8.0): daire dışındaki sol taraf dünyaya dokunuş (Appraisal yapılabilir)', () => {
    expect(touchIntent(ctx({ x: 400, y: 200 }))).toBe('world');
    expect(touchIntent(ctx({ x: 150 + 96, y: 570 }))).toBe('world');
    expect(touchIntent(ctx({ x: 60, y: 120 }))).toBe('world');
  });

  it('serbest mod, sol yarı ama joystick başka parmakta: dünyaya dokunuş', () => {
    expect(touchIntent(ctx({ x: 400, y: 200, joyActive: true, fixed: null }))).toBe('world');
  });

  it('sağ yarı: dünyaya dokunuş (NPC Appraisal)', () => {
    expect(touchIntent(ctx({ x: uiW / 2 + 1, y: 300 }))).toBe('world');
    expect(touchIntent(ctx({ x: 1000, y: 600, fixed: null }))).toBe('world');
  });
});
