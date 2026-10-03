// Sahne alanları yeniden başlatmada sıfırlanıyor mu?
// Phaser sahne nesnesi bir kez kurulur; alan başlangıç değerleri stop()+launch() / restart() sonrasında
// yeniden atanmaz. Her sahne create() (ya da init()) başında resetState() çağırmalı ve başlangıç
// değeri olan her alanı orada sıfırlamalı.
import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { leaveGame, type SceneOps } from '../src/game/sceneFlow';
import uiSrc from '../src/scenes/UIScene.ts?raw';
import titleSrc from '../src/scenes/TitleScene.ts?raw';
import menuSrc from '../src/scenes/MenuScene.ts?raw';
import worldSrc from '../src/scenes/WorldScene.ts?raw';
import miniSrc from '../src/scenes/MinigameScene.ts?raw';
import prologueSrc from '../src/scenes/PrologueScene.ts?raw';

const SOURCES: Record<string, string> = {
  UIScene: uiSrc, TitleScene: titleSrc, MenuScene: menuSrc, WorldScene: worldSrc, MinigameScene: miniSrc, PrologueScene: prologueSrc,
};
const SCENES = Object.keys(SOURCES);
/** Bilerek oturumlar arası hatırlanan alanlar (oyuncu tercihi gibi). */
const KEEP: Record<string, string[]> = {
  MenuScene: ['tab', 'section', 'invCat'],
};

function analyse(name: string) {
  const sf = ts.createSourceFile(name + '.ts', SOURCES[name], ts.ScriptTarget.ES2020, true);
  let cls: ts.ClassDeclaration | undefined;
  sf.forEachChild((n) => {
    if (ts.isClassDeclaration(n) && n.name?.text === name) cls = n;
  });
  if (!cls) throw new Error('sınıf yok: ' + name);
  const fields: string[] = [];
  const assigned = new Set<string>();
  let firstInEntry = '';
  for (const m of cls.members) {
    if (ts.isPropertyDeclaration(m) && m.initializer && !m.modifiers?.some((x) => x.kind === ts.SyntaxKind.StaticKeyword)) {
      fields.push((m.name as ts.Identifier).text);
    }
    if (ts.isMethodDeclaration(m) && m.body) {
      const mname = (m.name as ts.Identifier).text;
      if (mname === 'resetState') {
        const visit = (n: ts.Node) => {
          if (ts.isPropertyAccessExpression(n) && n.expression.kind === ts.SyntaxKind.ThisKeyword && ts.isBinaryExpression(n.parent) && n.parent.left === n) {
            assigned.add(n.name.text);
          }
          n.forEachChild(visit);
        };
        visit(m.body);
      }
      if ((mname === 'create' || mname === 'init') && !firstInEntry) {
        const st = m.body.statements[0];
        if (st && ts.isExpressionStatement(st) && /^this\.resetState\(\)$/.test(st.expression.getText())) firstInEntry = mname;
      }
    }
  }
  return { fields, assigned, firstInEntry };
}

describe('sahne durumu sıfırlama (resetState)', () => {
  for (const name of SCENES) {
    it(`${name}: create()/init() resetState() ile başlar ve tüm alanları sıfırlar`, () => {
      const { fields, assigned, firstInEntry } = analyse(name);
      expect(firstInEntry, `${name}.create() ya da init() ilk satırı this.resetState() olmalı`).not.toBe('');
      const keep = KEEP[name] ?? [];
      const missing = fields.filter((f) => !assigned.has(f) && !keep.includes(f));
      expect(missing, `${name}.resetState() içinde sıfırlanmayan alanlar`).toEqual([]);
    });
  }
});

describe('Ana Menüye Dön akışı', () => {
  const fake = () => {
    const calls: string[] = [];
    const ops: SceneOps = {
      stop: (k) => calls.push('stop:' + k),
      start: (k) => calls.push('start:' + k),
    };
    return { ops, calls };
  };

  it('UI menü bayrağını kapatır, Menu/UI/World durur ve Title başlar', () => {
    const ui = { menuIsOpen: true };
    const { ops, calls } = fake();
    leaveGame(ops, ui, 'Title');
    expect(ui.menuIsOpen).toBe(false);
    expect(calls).toEqual(['stop:Menu', 'stop:UI', 'stop:World', 'start:Title']);
  });

  it('kayıt yüklemede de bayrak kapanır ve World yeniden başlar', () => {
    const ui = { menuIsOpen: true };
    const { ops, calls } = fake();
    leaveGame(ops, ui, 'World');
    expect(ui.menuIsOpen).toBe(false);
    expect(calls[calls.length - 1]).toBe('start:World');
  });

  it('UI sahnesi hiç kurulmamışsa da çalışır', () => {
    const { ops, calls } = fake();
    expect(() => leaveGame(ops, null, 'Title')).not.toThrow();
    expect(calls).toContain('start:Title');
  });

  it('Menü → Ana Menü → Devam: HUD gizleme koşulu (hideHud || menuIsOpen) yeniden oyunda yanlış', () => {
    // UIScene.update(): const hide = this.hideHud || this.menuIsOpen;
    const ui = { menuIsOpen: true, hideHud: false };
    leaveGame(fake().ops, ui, 'Title');
    expect(ui.hideHud || ui.menuIsOpen).toBe(false);
  });
});
