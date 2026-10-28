/**
 * Contenu de la note de calcul commune (`noteDeCalculHtml` d'aedificium-ui).
 *
 * Module PUR. La note refait le calcul depuis les donnees lues, avec les
 * memes fonctions que `main.ts` (noyau, `dessin`, `vue`) : elle porte donc
 * les memes grandeurs que l'ecran et le CSV, en cellules de texte.
 */

import { nombreAffiche, tauxAffiche, type ElementNote, type NoteDeCalcul, type VerificationNote } from 'aedificium-ui';
import { verifierEquilibre, type DonneesEquilibre, type ProfilEquilibre, type Renversement, type ResultatEquilibre } from '../../src/index';
import { schema } from './dessin';
import { sens, texteExcentricite } from './vue';

/** Hypotheses et limites, rappelees a l'ecran et dans la note. */
export const HYPOTHESES = [
  'Repère : x vers la droite, z vers le haut, moments positifs dans le sens trigonométrique. Charges verticales saisies positives vers le bas.',
  "Chaque segment pesant et chaque charge sont une action distincte, classée stabilisante ou déstabilisante selon le signe de son effet ; une charge linéaire est décomposée en deux triangles.",
  "Renversement : coefficients EQU (EN 1990 tableau A1.2(A)) ; une action variable stabilisante n'est pas prise.",
  "Glissement : coefficients STR/GEO (tableau A1.2(B)) ; frottement de calcul mu_d saisi, coefficients du sol compris (tan delta_d, ou tan delta / gamma_R,h selon l'approche).",
  'Soulèvement : coefficients UPL (EN 1997-1 tableau A.15).',
  'Position de la résultante : toutes actions à leur valeur caractéristique ; indication sans verdict.',
  "Ni portance du sol, ni résistance des éléments : seul l'équilibre est vérifié.",
];

/** Nom de l'element quand il n'est pas renseigne. */
export const ELEMENT_PAR_DEFAUT = 'Équilibre statique';

const f = (x: number, d = 2) => nombreAffiche(x, Math.min(d, 3));
const taux = (t: number) => (Number.isFinite(t) ? tauxAffiche(t) : 'infini');

const CLAUSES = {
  renversement: 'EN 1990, tableau A1.2(A)',
  glissement: 'EN 1990, tableau A1.2(B)',
  soulevement: 'EN 1997-1, tableau A.15',
};

/** Les segments, en cellules. */
export function tableauSegments(d: DonneesEquilibre): ElementNote {
  return {
    type: 'tableau',
    titre: 'Segments',
    entetes: ['Id', 'Axe (m)', 'e (m)', 'gamma (kN/m3)'],
    lignes: d.segments.map((s) => [s.id, `(${f(s.x1)} ; ${f(s.z1)}) → (${f(s.x2)} ; ${f(s.z2)})`, f(s.e), f(s.gamma, 1)]),
  };
}

/** Les charges saisies, en cellules. */
export function tableauCharges(d: DonneesEquilibre): ElementNote {
  return {
    type: 'tableau',
    titre: 'Charges',
    entetes: ['Id', 'G/Q', 'Description'],
    lignes: d.charges.map((c) => [
      c.id,
      c.nature,
      c.type === 'ponctuelle'
        ? `ponctuelle en (${f(c.x)} ; ${f(c.z)}) : F_x = ${f(c.Fx)} kN, F_z = ${f(c.Fz)} kN vers le bas`
        : c.type === 'moment'
          ? `moment ${f(c.M)} kN.m (trigonométrique)`
          : `${c.direction} de (${f(c.xa)} ; ${f(c.za)}) à (${f(c.xb)} ; ${f(c.zb)}) : q = ${f(c.qa)} à ${f(c.qb)} kN/m`,
    ]),
  };
}

/** Les coefficients partiels du profil, en cellules. */
export function tableauCoefficients(p: ProfilEquilibre): ElementNote {
  const ligne = (nom: string, j: ProfilEquilibre['equ']) => [nom, f(j.gG_dst.valeur), f(j.gG_stb.valeur), f(j.gQ_dst.valeur), f(j.gQ_stb.valeur), j.gG_dst.source];
  return {
    type: 'tableau',
    titre: 'Coefficients partiels',
    entetes: ['Vérification', 'G dst', 'G stb', 'Q dst', 'Q stb', 'Source'],
    lignes: [ligne('Renversement (EQU)', p.equ), ligne('Glissement', p.glissement), ligne('Soulèvement (UPL)', p.upl)],
  };
}

/** Synthese des verifications, comme a l'ecran. */
export function tableauSyntheseNote(r: ResultatEquilibre): ElementNote {
  const g = r.glissement;
  return {
    type: 'tableau',
    titre: 'Synthèse des vérifications',
    entetes: ['Vérification', 'Coefficients', 'Déstabilisant', 'Stabilisant', 'Taux'],
    lignes: [
      ...r.renversement.map((x) => [`Renversement autour de l'arête ${x.pivot} (x = ${f(x.x)} m)`, `EQU, ${CLAUSES.renversement}`, `${f(x.M_dst_d)} kN.m`, `${f(x.M_stb_d)} kN.m`, taux(x.taux)]),
      [`Glissement vers ${g.sens > 0 ? '+x' : '-x'}`, `STR/GEO, ${CLAUSES.glissement}, R_d = mu_d N_d`, `${f(g.H_d)} kN`, `${f(g.R_d)} kN (N_d = ${f(g.N_d)})`, taux(g.taux)],
      ['Soulèvement', `UPL, ${CLAUSES.soulevement}`, `${f(r.soulevement.V_dst_d)} kN`, `${f(r.soulevement.V_stb_d)} kN`, taux(r.soulevement.taux)],
    ],
  };
}

/** Detail du renversement autour d'une arete, sommes en pied. */
export function tableauMomentsNote(x: Renversement): ElementNote {
  const lignes = x.lignes.map((l) => {
    const e = l.elementaire;
    return [
      e.origine,
      e.nature,
      e.C !== 0 ? `couple ${f(Math.abs(e.C))} kN.m` : `${f(l.F)} ${sens(e.Fx, e.Fz)}`,
      l.d === null ? '—' : f(l.d, 3),
      f(l.gamma),
      l.role === 'stabilisant' ? f(l.Md) : '',
      l.role === 'destabilisant' ? f(l.Md) : '',
    ];
  });
  return {
    type: 'tableau',
    titre: `Renversement autour de l'arête ${x.pivot} (x = ${f(x.x)} m, z = ${f(x.z)} m)`,
    entetes: ['Charge', 'G/Q', 'F (kN)', 'Distance d (m)', 'gamma_f', 'M stabilisant (kN.m)', 'M déstabilisant (kN.m)'],
    lignes: [...lignes, ['Somme', '', '', '', '', f(x.M_stb_d), f(x.M_dst_d)]],
  };
}

/** Une ligne par verification, avec son taux ; pas de verdict global. */
export function verificationsDeLaNote(r: ResultatEquilibre): VerificationNote[] {
  const v = (nom: string, clause: string, t: number): VerificationNote => ({ nom, clause, taux: t, ok: t <= 1 });
  return [
    ...r.renversement.map((x) => v(`Renversement autour de l'arête ${x.pivot}`, CLAUSES.renversement, x.taux)),
    v(`Glissement vers ${r.glissement.sens > 0 ? '+x' : '-x'}`, CLAUSES.glissement, r.glissement.taux),
    v('Soulèvement', CLAUSES.soulevement, r.soulevement.taux),
  ];
}

/** Note du calcul des donnees `d`. Leve si le calcul est impossible, comme `verifierEquilibre`. */
export function noteDuCalcul(profil: ProfilEquilibre, d: DonneesEquilibre, cartouche: { projet: string; element: string; date: string }): NoteDeCalcul {
  const r = verifierEquilibre(d, profil);
  return {
    cartouche: {
      projet: cartouche.projet,
      element: cartouche.element.trim() === '' ? ELEMENT_PAR_DEFAUT : cartouche.element,
      date: cartouche.date,
      norme: 'EN 1990:2002, EN 1997-1:2004',
      outil: 'équilibre-statique',
    },
    sections: {
      geometrie: [
        tableauSegments(d),
        { type: 'texte', texte: `Base de x = ${f(d.base.xg)} à ${f(d.base.xd)} m, z = ${f(d.base.z)} m ; profondeur prise en compte ${f(d.profondeur)} m.` },
        { type: 'figure', svg: schema(d, r), legende: "Schéma de l'élément, des charges et de la résultante" },
      ],
      hypotheses: [
        { type: 'texte', texte: `Profil normatif : ${profil.nom}, données consultées le ${profil.date}. L'annexe nationale peut modifier ces valeurs.` },
        tableauCoefficients(profil),
        { type: 'texte', texte: `Frottement de calcul à la base : mu_d = ${f(d.mu, 3)}.` },
        { type: 'liste', items: HYPOTHESES },
      ],
      charges: [tableauCharges(d)],
      calculs: [
        tableauSyntheseNote(r),
        { type: 'texte', texte: texteExcentricite(r) },
        ...r.renversement.map(tableauMomentsNote),
        { type: 'texte', texte: "M = F × d × gamma_f ; d désigne la distance du pivot à la ligne d'action de la charge." },
      ],
    },
    verifications: verificationsDeLaNote(r),
  };
}
