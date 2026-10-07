// Köy ekonomisi: hizmet ücretleri, ders ücretleri ve hikâye işleri. Tüm tutarlar bronz cinsindendir.
// Testler: tests/economy.test.ts

export const FEES = {
  /** Handa bir gecelik yatak. */
  innBed: 40,
  /** Şifacının yara sarması. */
  healerWrap: 15,
  /** Maceracılar Loncası kaydı (1 Gümüş). */
  guildRegistration: 100,
  /** Lonca kartı yenisi. */
  guildCardReplace: 500,
  /** Şehir yolu geçiş ücreti. */
  gatePass: 500,
};

/** Hikâye işleri: tek seferlik, kolay para kaynağı değildir. */
export const JOBS = {
  /** Bertram'ın hanında çalışılacak vardiya (gün) sayısı. */
  bertramShifts: 2,
  /** Son (2.) günün sonunda tek seferde ödenen toplam ücret (0.10.0: iş iki gün). */
  bertramPay: 50,
  /** Haldor'un hasadı (tek seferlik). */
  harvestPay: 50,
  /** Hasat süresi (oyun dakikası). */
  harvestMinutes: 240,
};
