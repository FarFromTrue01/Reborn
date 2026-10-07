// 0.11.0 (B4, E): geliştirici hata kaydı. Yakalanmamış hatalar ve Director.scene hataları burada tutulur;
// geliştirici modunda ekranın köşesinde kırmızı sayaç, dokununca yığın iziyle liste ve "Kopyala". window.__qa.errors().

export interface ErrorEntry {
  at: number;
  source: string;
  message: string;
  stack: string;
  /** Oyun saati (gün, dakika) — olay anı. */
  game?: string;
}

const MAX = 60;
const list: ErrorEntry[] = [];
const listeners = new Set<() => void>();

export function logError(source: string, err: unknown, game?: string): ErrorEntry {
  const e = err as { message?: string; stack?: string } | undefined;
  const entry: ErrorEntry = {
    at: Date.now(),
    source,
    message: String(e?.message ?? err ?? 'bilinmeyen hata'),
    stack: String(e?.stack ?? ''),
    game,
  };
  list.push(entry);
  while (list.length > MAX) list.shift();
  for (const l of listeners) l();
  return entry;
}

export function errors(): ErrorEntry[] {
  return [...list];
}

export function errorCount(): number {
  return list.length;
}

export function clearErrors() {
  list.length = 0;
  for (const l of listeners) l();
}

export function onErrorsChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Panoya kopyalanacak metin. */
export function errorsText(): string {
  return list.map((e) => `[${new Date(e.at).toISOString()}] ${e.source}${e.game ? ' @' + e.game : ''}: ${e.message}\n${e.stack}`).join('\n\n');
}

let installed = false;
/** Yakalanmamış hataları ve reddedilen sözleri kaydet (bir kez). */
export function installGlobalErrorLog() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (ev) => logError('window', ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', (ev) => logError('promise', ev.reason));
}
