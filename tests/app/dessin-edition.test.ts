/**
 * Tests d'acceptation de T3 (lot 8.6) : vue et dessin de la zone d'edition.
 * Le trace fin se verifie a l'oeil ; ici, la structure et le cadrage.
 */

import { describe, expect, it } from 'vitest';
import { constatsAffichage, texteVisible, versEcran } from 'aedificium-ui';
import { profilRecommande, verifierEquilibre } from '../../src/index';
import { EXEMPLES, charge, lireSaisie, type Saisie } from '../../app/src/modele';
import { grapheDeSaisie } from '../../app/src/edition';
import { MARGE_DESSIN, OPTIONS_EDITION, dessinSaisie, vueDeSaisie } from '../../app/src/dessin';
import { STYLES_TRACE } from '../../app/src/export';

const L = 640;
const H = 520;
const murEnL = (): Saisie => {
  const s = structuredClone(EXEMPLES['mur-en-l'].saisie);
  s.charges.push(charge({ type: 'ponctuelle', id: 'F1', x: '1,46', z: '3,4', Fz: '15' }), charge({ type: 'moment', id: 'M1', x: '1', z: '1', M: '5' }));
  return s;
};
const resultat = (s: Saisie) => {
  const l = lireSaisie(s);
  if (!l.ok) throw new Error(l.message);
  return verifierEquilibre(l.donnees, profilRecommande());
};

describe('vueDeSaisie', () => {
  it('tous les noeuds dans la zone, a la marge pres', () => {
    for (const ex of Object.values(EXEMPLES)) {
      const v = vueDeSaisie(ex.saisie, L, H);
      for (const n of grapheDeSaisie(ex.saisie).noeuds) {
        const p = versEcran(n, v);
        expect(p.x).toBeGreaterThanOrEqual(MARGE_DESSIN - 1e-6);
        expect(p.x).toBeLessThanOrEqual(L - MARGE_DESSIN + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(MARGE_DESSIN - 1e-6);
        expect(p.y).toBeLessThanOrEqual(H - MARGE_DESSIN + 1e-6);
      }
    }
  });

  it('l epaisseur des segments compte dans le cadrage', () => {
    const s = structuredClone(EXEMPLES['mur-poids'].saisie);
    // Axe x = 0 de z = 0 a z = 0,5, e = 3 : faces en x = -1,5 et x = 1,5, loin de tout noeud.
    s.segments = [{ id: 'bloc', x1: '0', z1: '0', x2: '0', z2: '0,5', e: '3', gamma: '24' }];
    s.charges = [];
    s.xg = '-0,2';
    s.xd = '0,2';
    const v = vueDeSaisie(s, L, H);
    for (const p of [{ x: -1.5, y: 0.5 }, { x: 1.5, y: 0 }].map((q) => versEcran(q, v))) {
      expect(p.x).toBeGreaterThanOrEqual(MARGE_DESSIN - 1e-6);
      expect(p.x).toBeLessThanOrEqual(L - MARGE_DESSIN + 1e-6);
    }
  });

  it('saisie illisible : le carre unite', () => {
    const s = structuredClone(EXEMPLES['mur-poids'].saisie);
    s.segments = [];
    s.charges = [];
    s.xg = 'a';
    const v = vueDeSaisie(s, L, H);
    expect(v.echelle).toBeGreaterThan(0);
    expect(Number.isFinite(v.x0) && Number.isFinite(v.y0)).toBe(true);
  });
});

describe('dessinSaisie', () => {
  const s = murEnL();
  const r = resultat(s);
  const v = vueDeSaisie(s, L, H);
  const d = dessinSaisie(s, r, v, L, H, OPTIONS_EDITION);

  it('contenu de la zone, sans balise svg ni couleur en dur', () => {
    expect(d.startsWith('<svg')).toBe(false);
    expect(d).toContain('id="pointe-edition"');
    expect(d).not.toMatch(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?!-)/);
    expect(d).not.toMatch(/(fill|stroke)="(?!none|url)/);
  });

  it('segments, axes, base, charges, points', () => {
    expect(d.match(/<polygon class="segment" data-segment="\d+"/g)).toHaveLength(3);
    expect(d.match(/class="axe"/g)).toHaveLength(3);
    expect(d).toMatch(/<line class="base" data-base=""/);
    for (let i = 0; i < s.charges.length; i++) expect(d, `charge ${i}`).toContain(`data-charge="${i}"`);
    const g = grapheDeSaisie(s);
    expect(d.match(/<circle class="point" data-noeud="[^"]+"/g)).toHaveLength(g.noeuds.length);
    for (const n of g.noeuds) expect(d).toContain(`data-noeud="${n.id}"`);
    expect(d).toMatch(/<circle class="resultante"/);
    expect(d).toMatch(/class="grille"/);
  });

  it('options : choix, grille, resultante, trace en cours, cotes', () => {
    const choisi = dessinSaisie(s, r, v, L, H, { ...OPTIONS_EDITION, choix: { liste: 'segments', index: 1 } });
    expect(choisi).toMatch(/<polygon class="segment choisi" data-segment="1"/);
    expect(choisi.match(/choisi/g)).toHaveLength(1);
    const base = dessinSaisie(s, r, v, L, H, { ...OPTIONS_EDITION, choix: { liste: 'base' } });
    expect(base).toMatch(/<line class="base choisi" data-base=""/);
    const sans = dessinSaisie(s, r, v, L, H, { ...OPTIONS_EDITION, grille: null, resultante: false });
    expect(sans).not.toMatch(/class="grille"/);
    expect(sans).not.toMatch(/class="resultante"/);
    expect(dessinSaisie(s, null, v, L, H, OPTIONS_EDITION)).not.toMatch(/class="resultante"/);
    const trace = dessinSaisie(s, r, v, L, H, { ...OPTIONS_EDITION, enCours: { x: 0, y: 0 }, survol: { x: 1, y: 1 } });
    expect(trace).toMatch(/<circle class="en-cours"/);
    expect(trace).toMatch(/<line class="elastique"/);
    expect(dessinSaisie(s, r, v, L, H, { ...OPTIONS_EDITION, enCours: { x: 0, y: 0 } })).not.toMatch(/class="elastique"/);
    const cotes = dessinSaisie(s, r, v, L, H, { ...OPTIONS_EDITION, cotes: true });
    expect(cotes).toMatch(/<text class="cote"/);
    expect(d).not.toMatch(/class="cote"/);
  });

  it('une charge choisie est surlignee', () => {
    const c = dessinSaisie(s, r, v, L, H, { ...OPTIONS_EDITION, choix: { liste: 'charges', index: 2 } });
    expect(c.match(/choisi/g)).toHaveLength(1);
    expect(c).toMatch(/class="[^"]*choisi[^"]*"[^>]*data-charge="2"|data-charge="2"[^>]*class="[^"]*choisi/);
  });

  it('saisie partiellement illisible : on dessine ce qui se lit', () => {
    const t = murEnL();
    t.segments[0].x1 = 'abc';
    const h = dessinSaisie(t, null, vueDeSaisie(t, L, H), L, H, OPTIONS_EDITION);
    expect(h).not.toContain('data-segment="0"');
    expect(h).toContain('data-segment="1"');
  });

  it('textes visibles accentues', () => {
    expect(constatsAffichage(texteVisible(dessinSaisie(s, r, v, L, H, { ...OPTIONS_EDITION, cotes: true })))).toEqual([]);
  });
});

describe('styles du trace', () => {
  it('classes de l edition', () => {
    for (const c of ['.point', '.choisi', '.grille', '.axe', '.en-cours', '.elastique', '.cote', '.segment', '.base', '.charge', '.resultante']) {
      expect(STYLES_TRACE, c).toContain(c);
    }
  });
});
