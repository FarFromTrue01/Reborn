// Başka uygulamaya geçiş / WebGL bağlam kaybı: kayıt alınır, yenilemeden sonra otomatik devam edilir.
import { describe, it, expect } from 'vitest';
import { canAutoReload, takeResumeFlag, onPageHidden, onContextLost, RELOAD_MIN_GAP_MS, type KV } from '../src/game/lifecycle';

function mem(): KV & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  };
}

describe('lifecycle', () => {
  it('sayfa gizlenince oyun içindeyse kayıt alınır; ana ekrandaysa alınmaz', () => {
    const ss = mem();
    let saves = 0;
    onPageHidden(ss, { inGame: () => true, snapshot: () => (saves++, true) });
    expect(saves).toBe(1);
    // sekme atılıp yeniden açılırsa son kayıttan devam
    expect(takeResumeFlag(ss, true)).toBe(true);
    onPageHidden(ss, { inGame: () => false, snapshot: () => (saves++, true) });
    expect(saves).toBe(1);
    expect(takeResumeFlag(ss, true)).toBe(false);
  });

  it('normal açılışta (sekme atılmadıysa) otomatik devam yok', () => {
    const ss = mem();
    onPageHidden(ss, { inGame: () => true, snapshot: () => true });
    expect(takeResumeFlag(ss, false)).toBe(false);
  });

  it('bağlam kaybında kayıt + yenilemeden sonra bir kez otomatik devam', () => {
    const ss = mem();
    let saves = 0;
    onContextLost(ss, { inGame: () => true, snapshot: () => (saves++, true) });
    expect(saves).toBe(1);
    expect(takeResumeFlag(ss, false)).toBe(true);
    // bayrak tüketildi: ikinci açılışta tekrar devam etmez
    expect(takeResumeFlag(ss, false)).toBe(false);
  });

  it('ana ekrandayken bağlam kaybı otomatik devam istemez', () => {
    const ss = mem();
    onContextLost(ss, { inGame: () => false, snapshot: () => true });
    expect(takeResumeFlag(ss, false)).toBe(false);
  });

  it('otomatik yenileme döngüye girmez', () => {
    const now = 1_000_000;
    expect(canAutoReload(now, null)).toBe(true);
    expect(canAutoReload(now, now - RELOAD_MIN_GAP_MS - 1)).toBe(true);
    expect(canAutoReload(now, now - 5000)).toBe(false);
  });

  it('sessionStorage yoksa sessizce çalışır', () => {
    expect(takeResumeFlag(null, true)).toBe(false);
    expect(() => onPageHidden(null, { inGame: () => true, snapshot: () => true })).not.toThrow();
  });
});
