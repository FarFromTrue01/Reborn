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
 * Sabit mod (0.8.0): yalnızca joystick dairesinin içi joystick'tir (altında NPC olsa bile); ekranın geri kalanı
 * dünyaya dokunuştur — sol tarafta da Appraisal yapılabilir.
 * Serbest mod: ekranın sol yarısı (joystick boştaysa) joystick'tir (hareket niyeti), gerisi dünyaya dokunuş.
 */
export function touchIntent(c: TouchCtx): 'joystick' | 'world' {
  if (c.fixed) return Math.hypot(c.x - c.fixed.x, c.y - c.fixed.y) <= c.fixed.r ? 'joystick' : 'world';
  if (c.x < c.uiW / 2 && !c.joyActive) return 'joystick';
  return 'world';
}
