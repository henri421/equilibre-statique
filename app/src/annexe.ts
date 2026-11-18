/**
 * Annexe nationale (lot E, audit R4) : profil de calcul selon l'annexe choisie et
 * les coefficients saisis. Module PUR, sans DOM.
 *
 * Le noyau ne connait aucune annexe : le profil luxembourgeois est construit ici a
 * partir du profil recommande et de `valeurLu` (aedificium-ui), qui presume egales
 * aux valeurs recommandees les valeurs non relues sur l'annexe. Chaque coefficient
 * est prerempli par l'annexe et reste modifiable ; une valeur changee est marquee
 * « valeur imposee par l'utilisateur » dans sa source.
 *
 * Partie d'Eurocode : EN 1990 pour les verifications EQU et STR/GEO, EN 1997-1 pour
 * le soulevement (UPL, tableau A.15).
 */

import { nombreAffiche, valeurLu, type AnnexeNationale } from 'aedificium-ui';
import { profilRecommande, type JeuEquilibre, type ProfilEquilibre, type ValeurSourcee } from '../../src/index';
import { textes } from './textes';

export type GroupeCoef = 'equ' | 'glissement' | 'upl';
export type ChampCoef = 'gG_dst' | 'gG_stb' | 'gQ_dst' | 'gQ_stb';
/** Cle d'un coefficient : groupe puis champ, par exemple `equ.gG_dst`. */
export type CleCoef = `${GroupeCoef}.${ChampCoef}`;

const GROUPES: readonly GroupeCoef[] = ['equ', 'glissement', 'upl'];
const CHAMPS: readonly ChampCoef[] = ['gG_dst', 'gG_stb', 'gQ_dst', 'gQ_stb'];

/** Les douze coefficients du profil, dans l'ordre de l'ecran et de la note. */
export const COEFS: readonly CleCoef[] = GROUPES.flatMap((g) => CHAMPS.map((c) => `${g}.${c}` as CleCoef));

/** Partie d'Eurocode de chaque groupe, pour la source ILNAS. */
export const PARTIE: Record<GroupeCoef, string> = { equ: 'EN 1990', glissement: 'EN 1990', upl: 'EN 1997-1' };

/** Nom du profil luxembourgeois, tel qu'il s'ecrit dans la note. */
export const NOM_PROFIL_LU = 'Luxembourg, ILNAS-EN 1990/AN-LU:2020 et ILNAS-EN 1997-1/AN-LU:2020 : valeurs présumées, à vérifier';

/** Coefficients en chaines, comme la saisie : `1,1`. */
export type Coefs = Record<CleCoef, string>;
/** Coefficients en nombres, comme le profil de calcul. */
export type ValeursCoefs = Record<CleCoef, number>;

const SYMBOLES: Record<ChampCoef, string> = { gG_dst: 'gamma_G,dst', gG_stb: 'gamma_G,stb', gQ_dst: 'gamma_Q,dst', gQ_stb: 'gamma_Q,stb' };

function groupeDe(c: CleCoef): GroupeCoef {
  return c.split('.')[0] as GroupeCoef;
}

function champDe(c: CleCoef): ChampCoef {
  return c.split('.')[1] as ChampCoef;
}

/** Symbole d'un coefficient, par exemple `gamma_G,dst`. */
export function symboleCoef(c: CleCoef): string {
  return SYMBOLES[champDe(c)];
}

/** Libelle d'un coefficient : groupe de verification puis nature de l'action. */
export function libelleCoef(c: CleCoef): string {
  const t = textes().coefficients;
  return `${t.groupes[groupeDe(c)]}, ${t.actions[champDe(c)]}`;
}

/** La valeur sourcee d'un coefficient dans un profil. */
export function valeurDuProfil(p: ProfilEquilibre, c: CleCoef): ValeurSourcee {
  return p[groupeDe(c)][champDe(c)];
}

/**
 * Clause citee par la source recommandee, reprise dans la source ILNAS :
 * « tableau A1.2(A) », suivie de la mention « action variable favorable » si elle existe.
 */
export function clauseDeSource(source: string): string {
  const tableau = /tableau [^,]+/.exec(source);
  const clause = tableau === null ? source : tableau[0];
  return source.includes('action variable favorable') ? `${clause} (action variable favorable : 0)` : clause;
}

/** Profil luxembourgeois : chaque valeur sourcee du profil recommande passe par `valeurLu`. */
export function profilLu(): ProfilEquilibre {
  const rec = profilRecommande();
  const jeu = (g: GroupeCoef): JeuEquilibre => {
    const j = {} as JeuEquilibre;
    for (const c of CHAMPS) j[c] = valeurLu(PARTIE[g], `${g}.${c}`, rec[g][c], clauseDeSource(rec[g][c].source));
    return j;
  };
  return { nom: NOM_PROFIL_LU, date: rec.date, equ: jeu('equ'), glissement: jeu('glissement'), upl: jeu('upl') };
}

/** Profil de l'annexe choisie, sans modification de l'utilisateur. */
export function profilDeLAnnexe(a: AnnexeNationale): ProfilEquilibre {
  return a === 'lu' ? profilLu() : profilRecommande();
}

/** Valeurs numeriques des coefficients d'une annexe. */
export function valeursDeLAnnexe(a: AnnexeNationale): ValeursCoefs {
  const p = profilDeLAnnexe(a);
  return Object.fromEntries(COEFS.map((c) => [c, valeurDuProfil(p, c).valeur])) as ValeursCoefs;
}

/** Coefficients d'une annexe en chaines, comme la saisie (`1,1`), pour prefremplir les champs. */
export function coefsDeLAnnexe(a: AnnexeNationale): Coefs {
  const v = valeursDeLAnnexe(a);
  return Object.fromEntries(COEFS.map((c) => [c, nombreAffiche(v[c], 4)])) as Coefs;
}

/**
 * Profil de calcul : celui de l'annexe, chaque valeur changee par l'utilisateur
 * marquee « imposee » dans sa source ; les autres gardent la source de l'annexe.
 */
export function profilDeCalcul(a: AnnexeNationale, valeurs: ValeursCoefs): ProfilEquilibre {
  const base = profilDeLAnnexe(a);
  const p: ProfilEquilibre = { ...base, equ: { ...base.equ }, glissement: { ...base.glissement }, upl: { ...base.upl } };
  for (const c of COEFS) {
    const b = valeurDuProfil(base, c);
    const x = valeurs[c];
    if (x !== b.valeur) p[groupeDe(c)][champDe(c)] = { valeur: x, source: textes().messages.imposee(nombreAffiche(b.valeur, 4), b.source) };
  }
  return p;
}
