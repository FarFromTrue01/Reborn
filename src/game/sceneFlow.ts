// Oyundan çıkış akışları. Phaser'a bağımlı değil: testlerde sahte sahne yöneticisiyle sınanır.
//
// Phaser sahne nesneleri bir kez kurulur; sınıf alanlarının başlangıç değerleri yalnızca kurulumda
// atanır. stop() + launch() / restart() sonrasında create() yeniden çalışsa bile alanlar eski
// değerini korur. Bu yüzden her sahne create() (ya da init()) başında resetState() çağırır;
// buradaki akışlar da çıkarken diğer sahnelerde kalan bayrakları açıkça kapatır.

export interface SceneOps {
  stop(key: string): unknown;
  start(key: string, data?: object): unknown;
}

export interface MenuFlag {
  menuIsOpen: boolean;
}

/**
 * Oyun içinden çık (Ana Menüye Dön / kayıt yükle): Menu, UI ve World durur, sonra `next` başlar.
 * UI'nin menü bayrağı kapatılır; açık kalırsa HUD ve dokunmatik butonlar bir daha görünmez.
 */
export function leaveGame(ops: SceneOps, ui: MenuFlag | null | undefined, next: 'Title' | 'World', data?: object) {
  if (ui) ui.menuIsOpen = false;
  ops.stop('Menu');
  ops.stop('UI');
  ops.stop('World');
  ops.start(next, data ?? {});
}
