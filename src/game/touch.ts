// Dokunuşun niyeti: hareket (joystick) mi, dünyadaki bir şeye dokunmak mı?
// Phaser'a bağımlı değil (testlerde sınanır).

export interface TouchCtx {
  /** Dokunuş, arayüz biriminde. */
  x: number;
  y: number;
  /** Arayüz genişliği. */
  uiW: number;
  /** Başka bir parmak joystick'i zaten kullanıyor. */
  joyActive: boolean;
  /** Sabit joystick tabanı (sabit modda) ya da null (serbest mod). */
  fixed: { x: number; y: number; r: number } | null;
}

/**
 * 1. Sabit joystick tabanının yarıçapı içi: her zaman joystick (altında NPC olsa bile).
 * 2. Ekranın sol yarısı ve joystick boşta: joystick (hareket niyeti).
 * 3. Diğer durumlar: dünyaya dokunuş (NPC/canavar Appraisal'ı). Appraisal için büyüteç butonu
 *    ve ekranın sağ yarısı var.
 */
export function touchIntent(c: TouchCtx): 'joystick' | 'world' {
  if (c.fixed && Math.hypot(c.x - c.fixed.x, c.y - c.fixed.y) <= c.fixed.r) return 'joystick';
  if (c.x < c.uiW / 2 && !c.joyActive) return 'joystick';
  return 'world';
}
