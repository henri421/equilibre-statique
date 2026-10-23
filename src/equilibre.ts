/**
 * Equilibre statique d'un element plan a l'ELU : renversement, glissement,
 * soulevement, et position de la resultante sur la base.
 *
 * Unites : m, kN, kN.m, kN/m3 ; efforts par metre de profondeur si
 * `profondeur` vaut 1.
 *
 * Repere : x horizontal vers la droite, z vertical vers le HAUT. Moments
 * positifs dans le sens trigonometrique (vu avec x a droite et z en haut).
 * Saisie : charges verticales positives VERS LE BAS, horizontales positives
 * vers +x.
 *
 * Geometrie : des segments (voile, semelle, patin...) d'epaisseur et de poids
 * volumique donnes, dont le poids propre est calcule ; la base est le
 * segment horizontal [x_g ; x_d] a la cote z_b sur lequel l'element repose.
 *
 * Chaque action elementaire — poids d'un segment, charge ponctuelle, chaque
 * triangle d'une charge lineaire, moment — est classee STABILISANTE ou
 * DESTABILISANTE selon le signe de son effet dans la verification
 * consideree, puis ponderee en consequence. Choix declare : un segment ou
 * une charge sont une action chacun, meme s'ils proviennent de la meme
 * source (EN 1990 §6.4.3.1(4) laisse ce choix a l'ingenieur pour l'EQU).
 */

import type { JeuEquilibre, ProfilEquilibre } from './profil';
import { verifierProfil } from './profil';

export type NatureAction = 'G' | 'Q';

export interface Segment {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  /** Epaisseur (m). */
  e: number;
  /** Poids volumique (kN/m3). */
  gamma: number;
}

export type Charge =
  | { type: 'ponctuelle'; id: string; nature: NatureAction; x: number; z: number; /** vers +x (kN) */ Fx: number; /** vers le bas (kN) */ Fz: number }
  | {
      type: 'lineaire';
      id: string;
      nature: NatureAction;
      xa: number;
      za: number;
      xb: number;
      zb: number;
      /** Intensites en A et en B, par metre de longueur du segment AB (kN/m). */
      qa: number;
      qb: number;
      direction: 'verticale' | 'horizontale';
    }
  | { type: 'moment'; id: string; nature: NatureAction; /** sens trigonometrique (kN.m) */ M: number };

export interface Base {
  xg: number;
  xd: number;
  z: number;
}

export interface DonneesEquilibre {
  segments: Segment[];
  charges: Charge[];
  base: Base;
  /** Coefficient de frottement DE CALCUL a la base (tan delta_d, coefficients du sol compris). */
  mu: number;
  /** Profondeur prise en compte (m) : 1 pour un calcul par metre. */
  profondeur: number;
}

/** Action elementaire : force (ou couple) et son point d'application. */
export interface Elementaire {
  /** Origine lisible : « poids de voile », « C2, triangle en A »... */
  origine: string;
  nature: NatureAction;
  /** Composantes, z vers le HAUT (kN). */
  Fx: number;
  Fz: number;
  x: number;
  z: number;
  /** Couple pur (kN.m), pour une charge de type moment. */
  C: number;
}

export interface LigneMoment {
  elementaire: Elementaire;
  /** Bras de levier par rapport au pivot (m). */
  dx: number;
  dz: number;
  /** Moment caracteristique autour du pivot, signe (kN.m). */
  M: number;
  role: 'destabilisant' | 'stabilisant' | 'nul';
  gamma: number;
  /** Valeur absolue de calcul (kN.m). */
  Md: number;
}

export interface Renversement {
  pivot: 'gauche' | 'droite';
  x: number;
  z: number;
  lignes: LigneMoment[];
  M_dst_d: number;
  M_stb_d: number;
  taux: number;
}

export interface Glissement {
  /** Sens du glissement verifie : +1 vers +x, -1 vers -x. */
  sens: 1 | -1;
  H_d: number;
  N_d: number;
  R_d: number;
  taux: number;
}

export interface Soulevement {
  V_dst_d: number;
  V_stb_d: number;
  taux: number;
}

export interface Excentricite {
  /** Effort normal caracteristique sur la base, compression positive (kN). */
  N: number;
  /** Abscisse de la resultante (m) et excentricite par rapport au milieu de la base (m). */
  xR: number;
  e: number;
  B: number;
  /** e <= B/6 : base entierement comprimee (repartition lineaire). */
  noyauCentral: boolean;
  /** La resultante tombe dans la base. */
  dansLaBase: boolean;
}

export interface ResultatEquilibre {
  elementaires: Elementaire[];
  renversement: Renversement[];
  glissement: Glissement;
  soulevement: Soulevement;
  excentricite: Excentricite | null;
  verdict: 'conforme' | 'non-conforme';
  motif: string;
}

function fini(v: number, nom: string, unite: string): number {
  if (!Number.isFinite(v)) throw new Error(`${nom} doit etre un nombre (${unite}).`);
  return v;
}

function positif(v: number, nom: string, unite: string): number {
  if (!(Number.isFinite(v) && v > 0)) throw new Error(`${nom} doit etre un nombre strictement positif (${unite}).`);
  return v;
}

/** Les actions elementaires de la saisie, efforts multiplies par la profondeur. */
export function actionsElementaires(d: DonneesEquilibre): Elementaire[] {
  const p = positif(d.profondeur, 'La profondeur', 'm');
  const liste: Elementaire[] = [];
  for (const s of d.segments) {
    const L = Math.hypot(s.x2 - s.x1, s.z2 - s.z1);
    positif(L, `Le segment ${s.id} : longueur`, 'm');
    positif(s.e, `Le segment ${s.id} : epaisseur`, 'm');
    if (!(Number.isFinite(s.gamma) && s.gamma >= 0)) throw new Error(`Le segment ${s.id} : poids volumique positif ou nul attendu (kN/m3).`);
    const W = s.gamma * s.e * L * p;
    liste.push({ origine: `poids de ${s.id}`, nature: 'G', Fx: 0, Fz: -W, x: (s.x1 + s.x2) / 2, z: (s.z1 + s.z2) / 2, C: 0 });
  }
  for (const c of d.charges) {
    if (c.type === 'ponctuelle') {
      liste.push({
        origine: c.id,
        nature: c.nature,
        Fx: fini(c.Fx, `${c.id} : F_x`, 'kN') * p,
        Fz: -fini(c.Fz, `${c.id} : F_z`, 'kN') * p,
        x: fini(c.x, `${c.id} : x`, 'm'),
        z: fini(c.z, `${c.id} : z`, 'm'),
        C: 0,
      });
    } else if (c.type === 'moment') {
      liste.push({ origine: c.id, nature: c.nature, Fx: 0, Fz: 0, x: 0, z: 0, C: fini(c.M, `${c.id} : M`, 'kN.m') * p });
    } else {
      const L = Math.hypot(c.xb - c.xa, c.zb - c.za);
      positif(L, `${c.id} : longueur du segment AB`, 'm');
      // Trapeze = deux triangles : q_a en A decroissant a 0 en B (resultante
      // au tiers depuis A), et 0 en A croissant a q_b en B (au tiers depuis
      // B). Le decoupage reste exact quand q_a et q_b sont de signes opposes.
      for (const [q, t, nom] of [
        [fini(c.qa, `${c.id} : q_a`, 'kN/m'), 1 / 3, 'triangle en A'],
        [fini(c.qb, `${c.id} : q_b`, 'kN/m'), 2 / 3, 'triangle en B'],
      ] as const) {
        if (q === 0) continue;
        const R = (q * L * p) / 2;
        liste.push({
          origine: `${c.id}, ${nom}`,
          nature: c.nature,
          Fx: c.direction === 'horizontale' ? R : 0,
          Fz: c.direction === 'verticale' ? -R : 0,
          x: c.xa + t * (c.xb - c.xa),
          z: c.za + t * (c.zb - c.za),
          C: 0,
        });
      }
    }
  }
  return liste;
}

function coefficient(j: JeuEquilibre, nature: NatureAction, destabilisant: boolean): number {
  if (nature === 'G') return destabilisant ? j.gG_dst.valeur : j.gG_stb.valeur;
  return destabilisant ? j.gQ_dst.valeur : j.gQ_stb.valeur;
}

/**
 * Renversement autour d'une arete de la base. Autour de l'arete gauche,
 * l'element bascule vers la gauche : les moments trigonometriques (positifs)
 * sont destabilisants ; autour de l'arete droite, les moments negatifs.
 */
function renverser(el: Elementaire[], pivot: 'gauche' | 'droite', b: Base, j: JeuEquilibre): Renversement {
  const x = pivot === 'gauche' ? b.xg : b.xd;
  const sens = pivot === 'gauche' ? 1 : -1;
  const lignes = el.map((e): LigneMoment => {
    const dx = e.x - x;
    const dz = e.z - b.z;
    const M = e.C !== 0 ? e.C : dx * e.Fz - dz * e.Fx;
    const role = Math.abs(M) < 1e-12 ? 'nul' : sens * M > 0 ? 'destabilisant' : 'stabilisant';
    const gamma = role === 'nul' ? 0 : coefficient(j, e.nature, role === 'destabilisant');
    return { elementaire: e, dx, dz, M, role, gamma, Md: gamma * Math.abs(M) };
  });
  const M_dst_d = lignes.filter((l) => l.role === 'destabilisant').reduce((s, l) => s + l.Md, 0);
  const M_stb_d = lignes.filter((l) => l.role === 'stabilisant').reduce((s, l) => s + l.Md, 0);
  return { pivot, x, z: b.z, lignes, M_dst_d, M_stb_d, taux: M_stb_d > 0 ? M_dst_d / M_stb_d : M_dst_d > 0 ? Infinity : 0 };
}

/**
 * Glissement sur la base dans le sens s : H_d = somme ponderee des
 * composantes horizontales (defavorables a gamma_dst, favorables a
 * gamma_stb) ; R_d = mu_d N_d, N_d somme ponderee des composantes
 * verticales (descendantes favorables, montantes defavorables).
 */
function glisser(el: Elementaire[], s: 1 | -1, mu: number, j: JeuEquilibre): Glissement {
  let H_d = 0;
  let N_d = 0;
  for (const e of el) {
    const h = s * e.Fx;
    if (h > 0) H_d += coefficient(j, e.nature, true) * h;
    else if (h < 0) H_d += coefficient(j, e.nature, false) * h;
    // Descendant (Fz < 0) : stabilisant, augmente N ; montant : destabilisant.
    if (e.Fz < 0) N_d += coefficient(j, e.nature, false) * -e.Fz;
    else if (e.Fz > 0) N_d -= coefficient(j, e.nature, true) * e.Fz;
  }
  const R_d = Math.max(0, mu * N_d);
  const taux = H_d <= 0 ? 0 : R_d > 0 ? H_d / R_d : Infinity;
  return { sens: s, H_d, N_d, R_d, taux };
}

function soulever(el: Elementaire[], j: JeuEquilibre): Soulevement {
  let V_dst_d = 0;
  let V_stb_d = 0;
  for (const e of el) {
    if (e.Fz > 0) V_dst_d += coefficient(j, e.nature, true) * e.Fz;
    else if (e.Fz < 0) V_stb_d += coefficient(j, e.nature, false) * -e.Fz;
  }
  return { V_dst_d, V_stb_d, taux: V_stb_d > 0 ? V_dst_d / V_stb_d : V_dst_d > 0 ? Infinity : 0 };
}

/** Position de la resultante caracteristique (toutes actions a 1,0) sur la base. */
function excentricite(el: Elementaire[], b: Base): Excentricite | null {
  const xc = (b.xg + b.xd) / 2;
  const B = b.xd - b.xg;
  const N = el.reduce((s, e) => s - e.Fz, 0);
  if (N <= 0) return null;
  const Mc = el.reduce((s, e) => s + (e.C !== 0 ? e.C : (e.x - xc) * e.Fz - (e.z - b.z) * e.Fx), 0);
  // Une force descendante N appliquee en x_R donne Mc = (x_R - x_c)(-N).
  const xR = xc - Mc / N;
  const e = Math.abs(xR - xc);
  return { N, xR, e, B, noyauCentral: e <= B / 6 + 1e-12, dansLaBase: e < B / 2 };
}

export function verifierEquilibre(d: DonneesEquilibre, profil: ProfilEquilibre): ResultatEquilibre {
  verifierProfil(profil);
  const b = d.base;
  fini(b.xg, 'x_g', 'm');
  fini(b.xd, 'x_d', 'm');
  fini(b.z, 'z_b', 'm');
  if (!(b.xd > b.xg)) throw new Error('La base doit avoir x_d > x_g (m).');
  if (!(Number.isFinite(d.mu) && d.mu >= 0)) throw new Error('Le frottement de calcul mu doit etre un nombre positif ou nul (-).');

  const el = actionsElementaires(d);
  if (el.length === 0) throw new Error('Aucune action : saisir au moins un segment pesant ou une charge.');
  const renversement = [renverser(el, 'gauche', b, profil.equ), renverser(el, 'droite', b, profil.equ)];
  const g = [glisser(el, 1, d.mu, profil.glissement), glisser(el, -1, d.mu, profil.glissement)];
  const glissement = g[0].taux >= g[1].taux ? g[0] : g[1];
  const soulevement = soulever(el, profil.upl);

  const verifs: [string, number][] = [
    ...renversement.map((r): [string, number] => [`renversement autour de l arete ${r.pivot}`, r.taux]),
    ['glissement', glissement.taux],
    ['soulevement', soulevement.taux],
  ];
  const [nom, max] = verifs.reduce((a, v) => (v[1] > a[1] ? v : a));
  const ok = max <= 1;
  return {
    elementaires: el,
    renversement,
    glissement,
    soulevement,
    excentricite: excentricite(el, b),
    verdict: ok ? 'conforme' : 'non-conforme',
    motif: `${ok ? 'Equilibre assure' : 'Equilibre non assure'} : taux maximal ${Number.isFinite(max) ? max.toFixed(3) : 'infini'} (${nom}).`,
  };
}
