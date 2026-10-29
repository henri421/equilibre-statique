/**
 * Edition de la saisie graphique : passage entre la saisie (chaines) et le
 * graphe de l'editeur commun, et actions de l'editeur appliquees a la saisie.
 *
 * Module PUR, sans DOM : la saisie n'est jamais modifiee en place.
 */

import { lireNombre, prochainId } from 'aedificium-ui';
import type {
  ActionEditeur,
  BarreGraphe,
  Graphe,
  NoeudGraphe,
  Outil,
  Point,
  Selection,
} from 'aedificium-ui';
import { charge } from './modele';
import type { LigneCharge, LigneSegment, Saisie } from './modele';

export type OutilEquilibre = 'selection' | 'segment' | 'ponctuelle' | 'lineaire' | 'moment' | 'base' | 'supprimer';

/** Element designe : segment ou charge par son rang, ou la base. */
export type Choix = { liste: 'segments' | 'charges'; index: number } | { liste: 'base' } | null;

/** Un bout d'element accroche a un point. p : force ponctuelle ou moment. */
export type Ancre =
  | { liste: 'segments'; index: number; bout: 1 | 2 }
  | { liste: 'charges'; index: number; bout: 'p' | 'a' | 'b' }
  | { liste: 'base'; bout: 'g' | 'd' };

export interface EtatEdition {
  saisie: Saisie;
  choix: Choix;
  /** Premier point d'un trace en deux clics (segment, lineaire, base). */
  enCours: Point | null;
  /** Ancres saisies au debut d'un glisse ; la saisie d'avant le glisse. */
  glisse: { ancres: Ancre[]; avant: Saisie } | null;
}

export interface Resultat {
  etat: EtatEdition;
  avant: Saisie | null;
}

/** Deux coordonnees lues a moins de cela l'une de l'autre sont le meme point. */
const TOLERANCE = 1e-9;

const CHAMPS_SEGMENT = ['id', 'x1', 'z1', 'x2', 'z2', 'e', 'gamma'];
const CHAMPS_CHARGE = ['id', 'nature', 'x', 'z', 'Fx', 'Fz', 'xa', 'za', 'xb', 'zb', 'qa', 'qb', 'direction', 'M'];
const CHAMPS_FIXE = ['xg', 'xd', 'zb', 'mu', 'profondeur'];

/** Arrondi au millieme, virgule decimale, sans zeros inutiles ni « -0 ». */
export function texteNombre(v: number): string {
  if (!Number.isFinite(v)) return String(v).replace('.', ',');
  let t = v.toFixed(3);
  if (t.includes('.')) t = t.replace(/0+$/, '').replace(/\.$/, '');
  if (t === '-0') t = '0';
  return t.replace('.', ',');
}

function memePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= TOLERANCE && Math.abs(a.y - b.y) <= TOLERANCE;
}

interface AccrocheLue {
  cle: string;
  ancre: Ancre;
  point: Point;
}

/** Accroches de la saisie, dans l'ordre du dessin, coordonnees illisibles omises. */
function accrochesDeSaisie(s: Saisie): AccrocheLue[] {
  const out: AccrocheLue[] = [];
  const pousser = (cle: string, ancre: Ancre, xs: string, zs: string): void => {
    const x = lireNombre(xs);
    const z = lireNombre(zs);
    if (x === null || z === null) return;
    out.push({ cle, ancre, point: { x, y: z } });
  };
  s.segments.forEach((seg, i) => {
    pousser(`S${i}.1`, { liste: 'segments', index: i, bout: 1 }, seg.x1, seg.z1);
    pousser(`S${i}.2`, { liste: 'segments', index: i, bout: 2 }, seg.x2, seg.z2);
  });
  s.charges.forEach((c, i) => {
    if (c.type === 'lineaire') {
      pousser(`C${i}.a`, { liste: 'charges', index: i, bout: 'a' }, c.xa, c.za);
      pousser(`C${i}.b`, { liste: 'charges', index: i, bout: 'b' }, c.xb, c.zb);
    } else {
      pousser(`C${i}.p`, { liste: 'charges', index: i, bout: 'p' }, c.x, c.z);
    }
  });
  pousser('B.g', { liste: 'base', bout: 'g' }, s.xg, s.zb);
  pousser('B.d', { liste: 'base', bout: 'd' }, s.xd, s.zb);
  return out;
}

/** Graphe de dessin de la saisie : un noeud par position, une barre par element trace. */
export function grapheDeSaisie(s: Saisie): Graphe<Ancre[], Choix> {
  const noeuds: NoeudGraphe<Ancre[]>[] = [];
  /** Cle d'accroche -> id du noeud qui la porte. */
  const noeudDeCle = new Map<string, string>();
  for (const a of accrochesDeSaisie(s)) {
    let noeud = noeuds.find((n) => Math.abs(n.x - a.point.x) <= TOLERANCE && Math.abs(n.y - a.point.y) <= TOLERANCE);
    if (noeud === undefined) {
      noeud = { id: a.cle, x: a.point.x, y: a.point.y, donnees: [] };
      noeuds.push(noeud);
    }
    noeud.donnees.push(a.ancre);
    noeudDeCle.set(a.cle, noeud.id);
  }

  const barres: BarreGraphe<Choix>[] = [];
  const ajouter = (id: string, cleDe: string, cleA: string, donnees: Choix): void => {
    const de = noeudDeCle.get(cleDe);
    const a = noeudDeCle.get(cleA);
    if (de === undefined || a === undefined || de === a) return;
    barres.push({ id, de, a, donnees });
  };
  s.segments.forEach((_, i) => {
    ajouter(`S${i}`, `S${i}.1`, `S${i}.2`, { liste: 'segments', index: i });
  });
  s.charges.forEach((c, i) => {
    if (c.type === 'lineaire') ajouter(`C${i}`, `C${i}.a`, `C${i}.b`, { liste: 'charges', index: i });
  });
  ajouter('B', 'B.g', 'B.d', { liste: 'base' });

  return { noeuds, barres };
}

function proprietaire(a: Ancre): Choix {
  if (a.liste === 'base') return { liste: 'base' };
  return { liste: a.liste, index: a.index };
}

/** Element designe par une selection de l'editeur. */
export function choixDeSelection(g: Graphe<Ancre[], Choix>, sel: Selection): Choix {
  if (sel === null) return null;
  if (sel.type === 'barre') {
    const barre = g.barres.find((b) => b.id === sel.id);
    return barre === undefined ? null : barre.donnees;
  }
  const noeud = g.noeuds.find((n) => n.id === sel.id);
  if (noeud === undefined) return null;
  const ponctuelle = noeud.donnees.find((a) => a.liste === 'charges' && a.bout === 'p');
  if (ponctuelle !== undefined) return { liste: 'charges', index: ponctuelle.index };
  return noeud.donnees.length > 0 ? proprietaire(noeud.donnees[0]) : null;
}

/** Selection de l'editeur qui designe un element. */
export function selectionDeChoix(g: Graphe<Ancre[], Choix>, c: Choix): Selection {
  if (c === null) return null;
  if (c.liste === 'base') return g.barres.some((b) => b.id === 'B') ? { type: 'barre', id: 'B' } : null;
  const id = `${c.liste === 'segments' ? 'S' : 'C'}${c.index}`;
  if (g.barres.some((b) => b.id === id)) return { type: 'barre', id };
  if (c.liste === 'charges') {
    const noeud = g.noeuds.find((n) => n.donnees.some((a) => a.liste === 'charges' && a.index === c.index && a.bout === 'p'));
    if (noeud !== undefined) return { type: 'noeud', id: noeud.id };
  }
  return null;
}

/** Outil de l'editeur commun correspondant a un outil de l'app. */
export function outilEditeur(o: OutilEquilibre): Outil {
  if (o === 'selection') return 'selection';
  if (o === 'supprimer') return 'supprimer';
  return 'noeud';
}

export function etatInitial(s: Saisie): EtatEdition {
  return { saisie: s, choix: null, enCours: null, glisse: null };
}

/** Touche Echap : le trace en cours est abandonne. */
export function abandonner(e: EtatEdition): EtatEdition {
  return { ...e, enCours: null };
}

function pointClic(g: Graphe<Ancre[], Choix>, a: ActionEditeur): Point | null {
  if (a.type === 'ajouter-noeud') return a.point;
  if (a.type === 'choisir' && a.selection !== null && a.selection.type === 'noeud') {
    const id = a.selection.id;
    const noeud = g.noeuds.find((n) => n.id === id);
    return noeud === undefined ? null : { x: noeud.x, y: noeud.y };
  }
  return null;
}

function avecCharge(s: Saisie, c: LigneCharge): { saisie: Saisie; index: number } {
  const charges = [...s.charges, c];
  return { saisie: { ...s, charges }, index: charges.length - 1 };
}

function creer(e: EtatEdition, p: Point, outil: OutilEquilibre): Resultat {
  const s = e.saisie;
  switch (outil) {
    case 'segment': {
      if (e.enCours === null) return { etat: { ...e, enCours: p }, avant: null };
      if (memePoint(e.enCours, p)) return { etat: { ...e, enCours: null }, avant: null };
      const segment: LigneSegment = {
        id: prochainId(s.segments.map((x) => x.id), 'S'),
        x1: texteNombre(e.enCours.x),
        z1: texteNombre(e.enCours.y),
        x2: texteNombre(p.x),
        z2: texteNombre(p.y),
        e: '0,2',
        gamma: '25',
      };
      const segments = [...s.segments, segment];
      return {
        etat: { ...e, saisie: { ...s, segments }, choix: { liste: 'segments', index: segments.length - 1 }, enCours: p },
        avant: s,
      };
    }
    case 'lineaire': {
      if (e.enCours === null) return { etat: { ...e, enCours: p }, avant: null };
      if (memePoint(e.enCours, p)) return { etat: { ...e, enCours: null }, avant: null };
      const c = charge({
        type: 'lineaire',
        id: prochainId(s.charges.map((x) => x.id), 'C'),
        xa: texteNombre(e.enCours.x),
        za: texteNombre(e.enCours.y),
        xb: texteNombre(p.x),
        zb: texteNombre(p.y),
        qa: '10',
        qb: '10',
      });
      const ajout = avecCharge(s, c);
      return {
        etat: { ...e, saisie: ajout.saisie, choix: { liste: 'charges', index: ajout.index }, enCours: null },
        avant: s,
      };
    }
    case 'base': {
      if (e.enCours === null) return { etat: { ...e, enCours: p }, avant: null };
      if (Math.abs(e.enCours.x - p.x) <= TOLERANCE) return { etat: { ...e, enCours: null }, avant: null };
      const saisie: Saisie = {
        ...s,
        xg: texteNombre(Math.min(e.enCours.x, p.x)),
        xd: texteNombre(Math.max(e.enCours.x, p.x)),
        zb: texteNombre(e.enCours.y),
      };
      return { etat: { ...e, saisie, choix: { liste: 'base' }, enCours: null }, avant: s };
    }
    case 'ponctuelle': {
      const c = charge({
        type: 'ponctuelle',
        id: prochainId(s.charges.map((x) => x.id), 'C'),
        x: texteNombre(p.x),
        z: texteNombre(p.y),
        Fx: '0',
        Fz: '10',
      });
      const ajout = avecCharge(s, c);
      return { etat: { ...e, saisie: ajout.saisie, choix: { liste: 'charges', index: ajout.index } }, avant: s };
    }
    case 'moment': {
      const c = charge({
        type: 'moment',
        id: prochainId(s.charges.map((x) => x.id), 'C'),
        x: texteNombre(p.x),
        z: texteNombre(p.y),
        M: '10',
      });
      const ajout = avecCharge(s, c);
      return { etat: { ...e, saisie: ajout.saisie, choix: { liste: 'charges', index: ajout.index } }, avant: s };
    }
    default:
      return { etat: e, avant: null };
  }
}

/** Ecrit toutes les accroches au point p. */
function appliquerAncres(s: Saisie, ancres: readonly Ancre[], p: Point): Saisie {
  const x = texteNombre(p.x);
  const z = texteNombre(p.y);
  const segments = s.segments.map((seg) => ({ ...seg }));
  const charges = s.charges.map((c) => ({ ...c }));
  let xg = s.xg;
  let xd = s.xd;
  let zb = s.zb;
  for (const ancre of ancres) {
    if (ancre.liste === 'segments') {
      const seg = segments[ancre.index];
      if (seg === undefined) continue;
      if (ancre.bout === 1) {
        seg.x1 = x;
        seg.z1 = z;
      } else {
        seg.x2 = x;
        seg.z2 = z;
      }
    } else if (ancre.liste === 'charges') {
      const c = charges[ancre.index];
      if (c === undefined) continue;
      if (ancre.bout === 'p') {
        c.x = x;
        c.z = z;
      } else if (ancre.bout === 'a') {
        c.xa = x;
        c.za = z;
      } else {
        c.xb = x;
        c.zb = z;
      }
    } else {
      if (ancre.bout === 'g') xg = x;
      else xd = x;
      zb = z;
    }
  }
  return { ...s, segments, charges, xg, xd, zb };
}

function deplacer(e: EtatEdition, a: Extract<ActionEditeur, { type: 'deplacer' }>): Resultat {
  let glisse = e.glisse;
  if (glisse === null) {
    const noeud = grapheDeSaisie(e.saisie).noeuds.find((n) => n.id === a.id);
    if (noeud === undefined) return { etat: e, avant: null };
    glisse = { ancres: [...noeud.donnees], avant: e.saisie };
  }
  const saisie = appliquerAncres(e.saisie, glisse.ancres, a.point);
  if (a.fin) return { etat: { ...e, saisie, glisse: null }, avant: glisse.avant };
  return { etat: { ...e, saisie, glisse }, avant: null };
}

function retirer(e: EtatEdition, selection: { type: 'noeud' | 'barre'; id: string }): Resultat {
  const s = e.saisie;
  if (selection.type === 'barre') {
    if (selection.id === 'B') return { etat: e, avant: null };
    const segment = /^S(\d+)$/.exec(selection.id);
    if (segment !== null) {
      const index = Number(segment[1]);
      if (index < 0 || index >= s.segments.length) return { etat: e, avant: null };
      const segments = s.segments.filter((_, i) => i !== index);
      return { etat: { ...e, saisie: { ...s, segments }, choix: null }, avant: s };
    }
    const chargeTracee = /^C(\d+)$/.exec(selection.id);
    if (chargeTracee !== null) {
      const index = Number(chargeTracee[1]);
      if (index < 0 || index >= s.charges.length) return { etat: e, avant: null };
      const charges = s.charges.filter((_, i) => i !== index);
      return { etat: { ...e, saisie: { ...s, charges }, choix: null }, avant: s };
    }
    return { etat: e, avant: null };
  }

  const noeud = grapheDeSaisie(s).noeuds.find((n) => n.id === selection.id);
  if (noeud === undefined) return { etat: e, avant: null };
  const segmentsRetires = new Set<number>();
  const chargesRetirees = new Set<number>();
  for (const ancre of noeud.donnees) {
    if (ancre.liste === 'segments') segmentsRetires.add(ancre.index);
    else if (ancre.liste === 'charges') chargesRetirees.add(ancre.index);
  }
  const segments = s.segments.filter((_, i) => !segmentsRetires.has(i));
  const charges = s.charges.filter((_, i) => !chargesRetirees.has(i));
  if (segments.length === s.segments.length && charges.length === s.charges.length) return { etat: e, avant: null };
  return { etat: { ...e, saisie: { ...s, segments, charges }, choix: null }, avant: s };
}

/** Applique une action de l'editeur a l'etat ; `avant` va dans l'historique s'il est non nul. */
export function appliquer(e: EtatEdition, a: ActionEditeur, outil: OutilEquilibre): Resultat {
  const sansEffet: Resultat = { etat: e, avant: null };
  switch (a.type) {
    case 'annuler':
    case 'retablir':
    case 'survol':
    case 'relier':
    case 'appui':
    case 'charge':
      return sansEffet;
    case 'choisir': {
      if (outil === 'selection') {
        return { etat: { ...e, choix: choixDeSelection(grapheDeSaisie(e.saisie), a.selection) }, avant: null };
      }
      if (outil === 'supprimer') return sansEffet;
      const p = pointClic(grapheDeSaisie(e.saisie), a);
      return p === null ? sansEffet : creer(e, p, outil);
    }
    case 'ajouter-noeud': {
      if (outil === 'selection' || outil === 'supprimer') return sansEffet;
      return creer(e, a.point, outil);
    }
    case 'deplacer':
      return deplacer(e, a);
    case 'supprimer':
      return retirer(e, a.selection);
  }
}

/** Copie de la saisie avec un champ change ; un rang ou un champ inconnu renvoie `s`. */
export function modifierChamp(
  s: Saisie,
  liste: 'segments' | 'charges' | 'fixe',
  index: number,
  champ: string,
  valeur: string,
): Saisie {
  if (liste === 'fixe') {
    if (!CHAMPS_FIXE.includes(champ)) return s;
    return { ...s, [champ]: valeur } as Saisie;
  }
  if (liste === 'segments') {
    if (index < 0 || index >= s.segments.length) return s;
    if (!CHAMPS_SEGMENT.includes(champ)) return s;
    const segments = s.segments.map((seg, i) => (i === index ? ({ ...seg, [champ]: valeur } as LigneSegment) : seg));
    return { ...s, segments };
  }
  if (index < 0 || index >= s.charges.length) return s;
  if (!CHAMPS_CHARGE.includes(champ)) return s;
  const charges = s.charges.map((c, i) => {
    if (i !== index) return c;
    if (champ === 'nature') {
      const nature = valeur.trim().toUpperCase() === 'Q' ? 'Q' : 'G';
      return { ...c, nature } as LigneCharge;
    }
    if (champ === 'direction') {
      const direction = valeur.trim().toLowerCase() === 'horizontale' ? 'horizontale' : 'verticale';
      return { ...c, direction } as LigneCharge;
    }
    return { ...c, [champ]: valeur } as LigneCharge;
  });
  return { ...s, charges };
}
