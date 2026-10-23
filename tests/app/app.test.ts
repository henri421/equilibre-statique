import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JETONS, valeursDesJetons } from 'aedificium-ui';
import { profilRecommande, verifierEquilibre } from '../../src/index';
import { EXEMPLES, lireSaisie, relire, saisieParDefaut, serialiser } from '../../app/src/modele';
import { rendreResultat, tableauEntrees } from '../../app/src/vue';
import { schema } from '../../app/src/dessin';
import { noteDeCalculHtml } from '../../app/src/export';

const P = profilRecommande();

describe('saisie', () => {
  it('chaque exemple se lit et se calcule', () => {
    for (const [nom, ex] of Object.entries(EXEMPLES)) {
      const l = lireSaisie(ex.saisie);
      expect(l.ok, nom).toBe(true);
      if (l.ok) expect(() => verifierEquilibre(l.donnees, P)).not.toThrow();
    }
  });

  it('un champ illisible est refuse en le nommant', () => {
    const s = saisieParDefaut();
    s.segments[0].e = 'abc';
    const l = lireSaisie(s);
    expect(!l.ok && l.message).toMatch(/mur, e/);
  });

  it('enregistrer puis relire rend la meme saisie', () => {
    const s = structuredClone(EXEMPLES['mur-en-l'].saisie);
    expect(relire(serialiser(s))).toEqual(s);
  });
});

describe('sorties', () => {
  it('la note porte les tableaux de l ecran', () => {
    const l = lireSaisie(saisieParDefaut());
    if (!l.ok) throw new Error(l.message);
    const r = verifierEquilibre(l.donnees, P);
    const svg = schema(l.donnees, r);
    expect(svg).not.toContain('NaN');
    const note = noteDeCalculHtml(r, P, svg, tableauEntrees(l.donnees), '2026-10-23');
    expect(note).toContain(rendreResultat(r));
  });

  it('le :root de style.css concorde avec les jetons communs', () => {
    const css = readFileSync(fileURLToPath(new URL('../../app/src/style.css', import.meta.url)), 'utf8');
    const page = valeursDesJetons(css);
    for (const [nom, valeur] of valeursDesJetons(JETONS)) expect(page.get(nom)).toBe(valeur);
  });
});
