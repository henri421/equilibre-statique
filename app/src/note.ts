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
import { descriptionCharge, sens, texteExcentricite } from './vue';
import { phrase, textes } from './textes';

/** Hypotheses et limites, en francais (tests) ; l'ecran lit `textes().note.hypotheses`. */
export const HYPOTHESES = textes().note.hypotheses;

/** Nom de l'element quand il n'est pas renseigne, en francais (tests). */
export const ELEMENT_PAR_DEFAUT = textes().note.element;

const f = (x: number, d = 2) => nombreAffiche(x, Math.min(d, 3));
const taux = (t: number) => (Number.isFinite(t) ? tauxAffiche(t) : textes().infini);

/** Les segments, en cellules. */
export function tableauSegments(d: DonneesEquilibre): ElementNote {
  const t = textes();
  return {
    type: 'tableau',
    titre: t.entrees.segments,
    entetes: ['Id', t.entetes.axe, 'e (m)', 'gamma (kN/m3)'],
    lignes: d.segments.map((s) => [s.id, `(${f(s.x1)} ; ${f(s.z1)}) → (${f(s.x2)} ; ${f(s.z2)})`, f(s.e), f(s.gamma, 1)]),
  };
}

/** Les charges saisies, en cellules. */
export function tableauCharges(d: DonneesEquilibre): ElementNote {
  const t = textes();
  return {
    type: 'tableau',
    titre: t.entrees.charges,
    entetes: ['Id', 'G/Q', t.entetes.description],
    lignes: d.charges.map((c) => [c.id, c.nature, descriptionCharge(c)]),
  };
}

/** Les coefficients partiels du profil, en cellules. */
export function tableauCoefficients(p: ProfilEquilibre): ElementNote {
  const t = textes();
  const ligne = (nom: string, j: ProfilEquilibre['equ']) => [nom, f(j.gG_dst.valeur), f(j.gG_stb.valeur), f(j.gQ_dst.valeur), f(j.gQ_stb.valeur), phrase(j.gG_dst.source)];
  return {
    type: 'tableau',
    titre: t.note.coefficientsPartiels,
    entetes: [t.entetes.verification, 'G dst', 'G stb', 'Q dst', 'Q stb', t.entetes.source],
    lignes: [ligne(t.verifications.renversementEqu, p.equ), ligne(t.verifications.glissement, p.glissement), ligne(t.verifications.soulevementUpl, p.upl)],
  };
}

/** Synthese des verifications, comme a l'ecran. */
export function tableauSyntheseNote(r: ResultatEquilibre): ElementNote {
  const g = r.glissement;
  const t = textes();
  const c = t.clauses;
  return {
    type: 'tableau',
    titre: t.note.synthese,
    entetes: [t.entetes.verification, t.entetes.coefficients, t.entetes.destabilisant, t.entetes.stabilisant, t.entetes.taux],
    lignes: [
      ...r.renversement.map((x) => [t.note.renversementLigne(x.pivot, f(x.x)), `EQU, ${c.renversement}`, `${f(x.M_dst_d)} kN.m`, `${f(x.M_stb_d)} kN.m`, taux(x.taux)]),
      [t.verifications.glissementVers(g.sens > 0 ? '+x' : '-x'), `STR/GEO, ${c.glissement}, R_d = mu_d N_d`, `${f(g.H_d)} kN`, `${f(g.R_d)} kN (N_d = ${f(g.N_d)})`, taux(g.taux)],
      [t.verifications.soulevement, `UPL, ${c.soulevement}`, `${f(r.soulevement.V_dst_d)} kN`, `${f(r.soulevement.V_stb_d)} kN`, taux(r.soulevement.taux)],
    ],
  };
}

/** Detail du renversement autour d'une arete, sommes en pied. */
export function tableauMomentsNote(x: Renversement): ElementNote {
  const t = textes();
  const h = t.entetes;
  const lignes = x.lignes.map((l) => {
    const e = l.elementaire;
    return [
      phrase(e.origine),
      e.nature,
      e.C !== 0 ? t.couple(f(Math.abs(e.C))) : `${f(l.F)} ${sens(e.Fx, e.Fz)}`,
      l.d === null ? '—' : f(l.d, 3),
      f(l.gamma),
      l.role === 'stabilisant' ? f(l.Md) : '',
      l.role === 'destabilisant' ? f(l.Md) : '',
    ];
  });
  return {
    type: 'tableau',
    titre: t.note.renversementTitre(x.pivot, f(x.x), f(x.z)),
    entetes: [h.charge, 'G/Q', 'F (kN)', `${h.distance} (m)`, 'gamma_f', `${h.mStabilisant} (kN.m)`, `${h.mDestabilisant} (kN.m)`],
    lignes: [...lignes, [t.somme, '', '', '', '', f(x.M_stb_d), f(x.M_dst_d)]],
  };
}

/** Une ligne par verification, avec son taux ; pas de verdict global. */
export function verificationsDeLaNote(r: ResultatEquilibre): VerificationNote[] {
  const t = textes();
  const v = (nom: string, clause: string, tx: number): VerificationNote => ({ nom, clause, taux: tx, ok: tx <= 1 });
  return [
    ...r.renversement.map((x) => v(t.verifications.renversementAutour(x.pivot), t.clauses.renversement, x.taux)),
    v(t.verifications.glissementVers(r.glissement.sens > 0 ? '+x' : '-x'), t.clauses.glissement, r.glissement.taux),
    v(t.verifications.soulevement, t.clauses.soulevement, r.soulevement.taux),
  ];
}

/** Note du calcul des donnees `d`. Leve si le calcul est impossible, comme `verifierEquilibre`. */
export function noteDuCalcul(profil: ProfilEquilibre, d: DonneesEquilibre, cartouche: { projet: string; element: string; date: string }): NoteDeCalcul {
  const r = verifierEquilibre(d, profil);
  const t = textes();
  return {
    cartouche: {
      projet: cartouche.projet,
      element: cartouche.element.trim() === '' ? t.note.element : cartouche.element,
      date: cartouche.date,
      norme: 'EN 1990:2002, EN 1997-1:2004',
      outil: t.note.outil,
    },
    sections: {
      geometrie: [
        tableauSegments(d),
        { type: 'texte', texte: t.note.base(f(d.base.xg), f(d.base.xd), f(d.base.z), f(d.profondeur)) },
        { type: 'figure', svg: schema(d, r), legende: t.note.legende },
      ],
      hypotheses: [
        { type: 'texte', texte: t.note.profil(phrase(profil.nom), profil.date) },
        tableauCoefficients(profil),
        { type: 'texte', texte: t.note.frottement(f(d.mu, 3)) },
        { type: 'liste', items: t.note.hypotheses },
      ],
      charges: [tableauCharges(d)],
      calculs: [
        tableauSyntheseNote(r),
        { type: 'texte', texte: texteExcentricite(r) },
        ...r.renversement.map(tableauMomentsNote),
        { type: 'texte', texte: t.noteMoments },
      ],
    },
    verifications: verificationsDeLaNote(r),
  };
}
