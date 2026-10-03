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

/** Skill öğretmenleri (0.2.0'da 5 katına çıktı). */
export const LESSONS = {
  archery: { price: 200, minutes: 120, teacher: 'hunter' },
  first_aid: { price: 150, minutes: 60, teacher: 'healer' },
  sword_mastery: { price: 750, minutes: 180, teacher: 'bertram' },
} as const;

/** Hikâye işleri: tek seferlik, kolay para kaynağı değildir. */
export const JOBS = {
  /** Bertram'ın hanında çalışılacak vardiya (gün) sayısı. */
  bertramShifts: 4,
  /** 4. günün sonunda tek seferde ödenen toplam ücret. */
  bertramPay: 50,
  /** Haldor'un hasadı (tek seferlik). */
  harvestPay: 50,
  /** Hasat süresi (oyun dakikası). */
  harvestMinutes: 240,
};
