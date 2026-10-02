import Phaser from 'phaser';
import { Display } from '../game/display';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  create() {
    const boot = document.getElementById('boot');
    if (boot) {
      boot.style.opacity = '0';
      setTimeout(() => boot.remove(), 700);
    }
    const t = this.add.text(Display.w / 2, Display.h / 2, 'REBORN IN ELONTH', {
      fontFamily: 'Cinzel', fontSize: Math.round(48 * Display.uiZoom) + 'px', color: '#d9b45a',
    }).setOrigin(0.5);
    t.setResolution(1);
  }
}
