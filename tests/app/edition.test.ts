/**
 * Tests d'acceptation de T1 (lot 8.6) : graphe de l'editeur commun tire de la
 * saisie, outils de creation, glisse, suppression, edition des champs.
 */

import { describe, expect, it } from 'vitest';
import type { ActionEditeur } from 'aedificium-ui';
import { EXEMPLES, charge, type Saisie } from '../../app/src/modele';
import {
  abandonner,
  appliquer,
  choixDeSelection,
  etatInitial,
  grapheDeSaisie,
  modifierChamp,
  outilEditeur,
  selectionDeChoix,
  texteNombre,
  type EtatEdition,
  type OutilEquilibre,
} from '../../app/src/edition';

const murPoids = (): Saisie => structuredClone(EXEMPLES['mur-poids'].saisie);
const clic = (x: number, y: number): ActionEditeur => ({ type: 'ajouter-noeud', point: { x, y } });

/** Enchaine des actions avec un outil ; renvoie l'etat final et les `avant` successifs. */
function jouer(e: EtatEdition, outil: OutilEquilibre, actions: ActionEditeur[]) {
  const avants: (Saisie | null)[] = [];
  for (const a of actions) {
    const r = appliquer(e, a, outil);
    avants.push(r.avant);
    e = r.etat;
  }
  return { etat: e, avants };
}

describe('texteNombre', () => {
  it('millimetre, virgule, sans zero inutile ni -0', () => {
    expect([0.6, 2, -0.25, 1 / 3, -0.0001, 1.5, 2.0004].map(texteNombre)).toEqual(['0,6', '2', '-0,25', '0,333', '0', '1,5', '2']);
  });
});

describe('grapheDeSaisie', () => {
  it('mur poids : un noeud par position, le premier accroche donne l id', () => {
    const g = grapheDeSaisie(murPoids());
    expect(g.noeuds.map((n) => [n.id, n.x, n.y])).toEqual([
      ['S0.1', 0.5, 0],
      ['S0.2', 0.5, 3],
      ['C0.a', 0, 0],
      ['C0.b', 0, 3],
      ['B.d', 1, 0],
    ]);
    expect(g.noeuds[2].donnees).toEqual([
      { liste: 'charges', index: 0, bout: 'a' },
      { liste: 'base', bout: 'g' },
    ]);
    expect(g.barres).toEqual([
      { id: 'S0', de: 'S0.1', a: 'S0.2', donnees: { liste: 'segments', index: 0 } },
      { id: 'C0', de: 'C0.a', a: 'C0.b', donnees: { liste: 'charges', index: 0 } },
      { id: 'B', de: 'C0.a', a: 'B.d', donnees: { liste: 'base' } },
    ]);
  });

  it('force et moment : une accroche p ; une coordonnee illisible est ignoree', () => {
    const s = murPoids();
    s.charges.push(charge({ type: 'ponctuelle', id: 'F', x: '0,5', z: '3', Fz: '10' }), charge({ type: 'moment', id: 'M', x: '2', z: '2', M: '5' }));
    s.segments[0].x1 = 'abc';
    const g = grapheDeSaisie(s);
    expect(g.noeuds.map((n) => n.id)).toEqual(['S0.2', 'C0.a', 'C0.b', 'C2.p', 'B.d']);
    expect(g.noeuds[0].donnees).toEqual([
      { liste: 'segments', index: 0, bout: 2 },
      { liste: 'charges', index: 1, bout: 'p' },
    ]);
    expect(g.barres.map((b) => b.id)).toEqual(['C0', 'B']);
  });

  it('barre de longueur nulle omise', () => {
    const s = murPoids();
    s.segments[0].z2 = '0';
    expect(grapheDeSaisie(s).barres.map((b) => b.id)).toEqual(['C0', 'B']);
  });
});

describe('choix et selection', () => {
  const s = murPoids();
  s.charges.push(charge({ type: 'ponctuelle', id: 'F', x: '0,5', z: '3', Fz: '10' }));
  const g = grapheDeSaisie(s);

  it('choixDeSelection', () => {
    expect(choixDeSelection(g, { type: 'barre', id: 'S0' })).toEqual({ liste: 'segments', index: 0 });
    expect(choixDeSelection(g, { type: 'barre', id: 'B' })).toEqual({ liste: 'base' });
    expect(choixDeSelection(g, { type: 'noeud', id: 'S0.2' })).toEqual({ liste: 'charges', index: 1 });
    expect(choixDeSelection(g, { type: 'noeud', id: 'C0.a' })).toEqual({ liste: 'charges', index: 0 });
    expect(choixDeSelection(g, { type: 'noeud', id: 'B.d' })).toEqual({ liste: 'base' });
    expect(choixDeSelection(g, { type: 'noeud', id: 'X' })).toBeNull();
    expect(choixDeSelection(g, null)).toBeNull();
  });

  it('selectionDeChoix', () => {
    expect(selectionDeChoix(g, { liste: 'segments', index: 0 })).toEqual({ type: 'barre', id: 'S0' });
    expect(selectionDeChoix(g, { liste: 'charges', index: 0 })).toEqual({ type: 'barre', id: 'C0' });
    expect(selectionDeChoix(g, { liste: 'charges', index: 1 })).toEqual({ type: 'noeud', id: 'S0.2' });
    expect(selectionDeChoix(g, { liste: 'base' })).toEqual({ type: 'barre', id: 'B' });
    expect(selectionDeChoix(g, { liste: 'segments', index: 7 })).toBeNull();
    expect(selectionDeChoix(g, null)).toBeNull();
  });

  it('outilEditeur', () => {
    const o: OutilEquilibre[] = ['selection', 'segment', 'ponctuelle', 'lineaire', 'moment', 'base', 'supprimer'];
    expect(o.map(outilEditeur)).toEqual(['selection', 'noeud', 'noeud', 'noeud', 'noeud', 'noeud', 'supprimer']);
  });
});

describe('outils de creation', () => {
  it('segment : deux clics, puis on enchaine ; un clic sur un noeud vaut sa position', () => {
    const s = murPoids();
    const intact = structuredClone(s);
    const r1 = appliquer(etatInitial(s), clic(2, 0), 'segment');
    expect(r1.avant).toBeNull();
    expect(r1.etat.enCours).toEqual({ x: 2, y: 0 });
    expect(r1.etat.saisie).toEqual(intact);
    const { etat, avants } = jouer(r1.etat, 'segment', [clic(2, 1.5), { type: 'choisir', selection: { type: 'noeud', id: 'S0.2' } }]);
    expect(etat.saisie.segments.slice(1)).toEqual([
      { id: 'S1', x1: '2', z1: '0', x2: '2', z2: '1,5', e: '0,2', gamma: '25' },
      { id: 'S2', x1: '2', z1: '1,5', x2: '0,5', z2: '3', e: '0,2', gamma: '25' },
    ]);
    expect(avants[0]).toEqual(intact);
    expect(etat.enCours).toEqual({ x: 0.5, y: 3 });
    expect(etat.choix).toEqual({ liste: 'segments', index: 2 });
    expect(s).toEqual(intact);
  });

  it('segment : le meme point deux fois arrete la chaine', () => {
    const { etat, avants } = jouer(etatInitial(murPoids()), 'segment', [clic(2, 0), clic(2, 0)]);
    expect(etat.enCours).toBeNull();
    expect(etat.saisie.segments).toHaveLength(1);
    expect(avants).toEqual([null, null]);
  });

  it('ponctuelle, moment : un clic', () => {
    const p = jouer(etatInitial(murPoids()), 'ponctuelle', [clic(0.5, 3)]);
    expect(p.etat.saisie.charges[1]).toEqual(charge({ type: 'ponctuelle', id: 'C1', x: '0,5', z: '3', Fx: '0', Fz: '10' }));
    expect(p.etat.choix).toEqual({ liste: 'charges', index: 1 });
    expect(p.avants[0]).toEqual(murPoids());
    const m = jouer(etatInitial(murPoids()), 'moment', [clic(1, 2)]);
    expect(m.etat.saisie.charges[1]).toEqual(charge({ type: 'moment', id: 'C1', x: '1', z: '2', M: '10' }));
  });

  it('lineaire : deux clics, sans enchainer', () => {
    const { etat, avants } = jouer(etatInitial(murPoids()), 'lineaire', [clic(1, 0), clic(1, 3)]);
    expect(etat.saisie.charges[1]).toEqual(charge({ type: 'lineaire', id: 'C1', xa: '1', za: '0', xb: '1', zb: '3', qa: '10', qb: '10' }));
    expect(etat.enCours).toBeNull();
    expect(avants).toEqual([null, murPoids()]);
  });

  it('base : deux clics, x ordonnes, z du premier ; deux x egaux annulent', () => {
    const { etat } = jouer(etatInitial(murPoids()), 'base', [clic(2, 0.5), clic(-1, 0)]);
    expect([etat.saisie.xg, etat.saisie.xd, etat.saisie.zb]).toEqual(['-1', '2', '0,5']);
    expect(etat.choix).toEqual({ liste: 'base' });
    const nul = jouer(etatInitial(murPoids()), 'base', [clic(1, 0), clic(1, 2)]);
    expect(nul.etat.saisie).toEqual(murPoids());
    expect(nul.etat.enCours).toBeNull();
  });

  it('abandonner', () => {
    const r = appliquer(etatInitial(murPoids()), clic(2, 0), 'segment');
    expect(abandonner(r.etat).enCours).toBeNull();
  });
});

describe('selection et glisse', () => {
  it('choisir une barre, sans historique', () => {
    const r = appliquer(etatInitial(murPoids()), { type: 'choisir', selection: { type: 'barre', id: 'C0' } }, 'selection');
    expect(r.etat.choix).toEqual({ liste: 'charges', index: 0 });
    expect(r.avant).toBeNull();
  });

  it('un noeud partage bouge d un bloc ; l historique garde la saisie d avant le glisse', () => {
    const { etat, avants } = jouer(etatInitial(murPoids()), 'selection', [
      { type: 'deplacer', id: 'C0.a', point: { x: -0.2, y: 0 }, fin: false },
      { type: 'deplacer', id: 'C0.a', point: { x: -0.3, y: 0.1 }, fin: true },
    ]);
    const c = etat.saisie.charges[0];
    expect([c.xa, c.za, etat.saisie.xg, etat.saisie.zb]).toEqual(['-0,3', '0,1', '-0,3', '0,1']);
    expect(avants).toEqual([null, murPoids()]);
    expect(etat.glisse).toBeNull();
  });

  it('les accroches retenues au debut du glisse ne changent pas en passant sur un autre point', () => {
    const { etat } = jouer(etatInitial(murPoids()), 'selection', [
      { type: 'deplacer', id: 'S0.1', point: { x: 0, y: 0 }, fin: false },
      { type: 'deplacer', id: 'S0.1', point: { x: 0.1, y: 0 }, fin: true },
    ]);
    expect([etat.saisie.segments[0].x1, etat.saisie.segments[0].z1]).toEqual(['0,1', '0']);
    expect(etat.saisie.charges[0].xa).toBe('0');
    expect(etat.saisie.xg).toBe('0');
  });

  it('id inconnu : sans effet', () => {
    const r = appliquer(etatInitial(murPoids()), { type: 'deplacer', id: 'X', point: { x: 1, y: 1 }, fin: true }, 'selection');
    expect(r.etat.saisie).toEqual(murPoids());
    expect(r.avant).toBeNull();
  });
});

describe('supprimer', () => {
  it('une barre retire son element ; la base reste', () => {
    const r = appliquer(etatInitial(murPoids()), { type: 'supprimer', selection: { type: 'barre', id: 'S0' } }, 'supprimer');
    expect(r.etat.saisie.segments).toEqual([]);
    expect(r.etat.choix).toBeNull();
    expect(r.avant).toEqual(murPoids());
    const b = appliquer(etatInitial(murPoids()), { type: 'supprimer', selection: { type: 'barre', id: 'B' } }, 'supprimer');
    expect(b.etat.saisie).toEqual(murPoids());
    expect(b.avant).toBeNull();
  });

  it('un noeud retire tout ce qui y est accroche, sauf la base', () => {
    const r = appliquer(etatInitial(murPoids()), { type: 'supprimer', selection: { type: 'noeud', id: 'C0.a' } }, 'supprimer');
    expect(r.etat.saisie.charges).toEqual([]);
    expect(r.etat.saisie.segments).toHaveLength(1);
    expect([r.etat.saisie.xg, r.etat.saisie.xd]).toEqual(['0', '1']);
  });
});

describe('modifierChamp', () => {
  it('copie modifiee, original intact', () => {
    const s = murPoids();
    const t = modifierChamp(s, 'segments', 0, 'e', '0,8');
    expect(t.segments[0].e).toBe('0,8');
    expect(s.segments[0].e).toBe('1');
    expect(modifierChamp(s, 'fixe', 0, 'mu', '0,6').mu).toBe('0,6');
    expect(modifierChamp(s, 'charges', 0, 'nature', 'Q').charges[0].nature).toBe('Q');
    expect(modifierChamp(s, 'charges', 0, 'nature', 'x').charges[0].nature).toBe('G');
    expect(modifierChamp(s, 'charges', 0, 'direction', 'verticale').charges[0].direction).toBe('verticale');
    expect(modifierChamp(s, 'segments', 5, 'e', '1')).toBe(s);
    expect(modifierChamp(s, 'segments', 0, 'inconnu', '1')).toBe(s);
  });
});
