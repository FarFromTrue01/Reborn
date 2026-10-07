// 0.11.0 (C1): harcama kilidi. Maceracılar Loncası'na kaydolana kadar para harcanamaz (dükkân alışları, handaki
// yiyecek, yatak kiralama ve benzeri bütün ödemeler). Lonca kayıt ücreti ve satış serbest. Kayıt olunca kilit
// kalkar; kayıtlı olmayan eski kayıtlarda (göç) kilit açık. Hikâyenin kısa süreli kilidi (E3: G3 ödülünden şifacıya
// kadar, `spend_lock`) ayrı ve önce gelir.

export const GUILD_LOCK_TITLE = 'ÖNCE LONCA';
export const GUILD_LOCK_TEXT = "Maceracılar Loncası'na kaydolana kadar paranı harcayamazsın. Kayıt ücreti bir gümüş.";
/** Kilide rağmen serbest ödemeler (etiket). */
export const SPEND_ALWAYS_OK = new Set(['Lonca kaydı']);

export interface SpendLockState {
  /** Lonca üyesi mi? */
  member: boolean;
  /** Eski kayıttan gelen muafiyet (göç). */
  exempt: boolean;
  /** Hikâye kilidi (spend_lock bayrağı). */
  storyLock: boolean;
}

/** null: serbest; 'story': hikâye kilidi; 'guild': kayıt öncesi kilit. */
export function spendLock(s: SpendLockState, label: string, allow = false): 'story' | 'guild' | null {
  if (allow || SPEND_ALWAYS_OK.has(label)) return null;
  if (s.storyLock) return 'story';
  if (!s.member && !s.exempt) return 'guild';
  return null;
}
