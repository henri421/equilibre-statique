/**
 * Les textes affiches, en francais et en anglais. PUR.
 *
 * Deux sources :
 * - les textes de l'app (`FR`, `EN`), types : une cle oubliee en anglais ne
 *   compile pas ;
 * - les phrases du noyau (`src/`), ecrites en francais, traduites a
 *   l'affichage par `phrase`.
 *
 * ⚠ Aucun texte ne se lit au chargement d'un module : toujours `textes()` ou
 * `phrase()` AU MOMENT DU RENDU, apres `definirLangue` (main.ts).
 */

import { langueCourante, traducteur } from 'aedificium-ui';

type Pivot = 'gauche' | 'droite';
type TypeCharge = 'ponctuelle' | 'lineaire' | 'moment';
type Direction = 'verticale' | 'horizontale';

const FR = {
  verdict: { assure: 'Équilibre assuré', nonAssure: 'Équilibre non assuré' },
  infini: 'infini',
  /** « gauche » dans « l'arête gauche ». */
  pivot: { gauche: 'gauche', droite: 'droite' } as Record<Pivot, string>,
  arete: (p: Pivot) => `arête ${p === 'gauche' ? 'gauche' : 'droite'}`,
  cartes: {
    renversement: (p: Pivot): string => (p === 'gauche' ? 'Renversement, arête gauche' : 'Renversement, arête droite'),
    resultante: 'Résultante sur la base',
    indication: 'indication',
  },
  verifications: {
    renversementAutour: (p: Pivot) => `Renversement autour de l'arête ${p}`,
    glissementVers: (sens: string) => `Glissement vers ${sens}`,
    soulevement: 'Soulèvement',
    renversementEqu: 'Renversement (EQU)',
    glissement: 'Glissement',
    soulevementUpl: 'Soulèvement (UPL)',
  },
  clauses: {
    renversement: 'EN 1990, tableau A1.2(A)',
    glissement: 'EN 1990, tableau A1.2(B)',
    soulevement: 'EN 1997-1, tableau A.15',
    /** Formes courtes du tableau de synthese a l'ecran. */
    glissementCourt: 'tableau A1.2(B)',
    soulevementCourt: 'EN 1997-1 tableau A.15',
    renversementCourt: 'EN 1990 tableau A1.2(A)',
  },
  entetes: {
    verification: 'Vérification',
    coefficients: 'Coefficients',
    destabilisant: 'Déstabilisant',
    stabilisant: 'Stabilisant',
    taux: 'Taux',
    charge: 'Charge',
    distance: 'Distance d',
    mStabilisant: 'M stabilisant',
    mDestabilisant: 'M déstabilisant',
    couple: 'couple',
    source: 'Source',
    axe: 'Axe (m)',
    description: 'Description',
  },
  somme: 'Somme',
  tauxSomme: 'Taux = somme déstabilisante / somme stabilisante',
  couple: (v: string) => `couple ${v} kN.m`,
  noteMoments: "M = F × d × gamma_f ; d désigne la distance du pivot à la ligne d'action de la charge.",
  excentricite: {
    aucune: 'Aucun effort normal de compression sur la base : position de la résultante sans objet.',
    noyau: 'dans le noyau central : base entièrement comprimée',
    horsNoyau: 'hors du noyau central : décollement partiel de la base',
    horsBase: "HORS DE LA BASE : l'élément bascule",
    texte: (N: string, xR: string, e: string, b6: string, situation: string) =>
      `Résultante caractéristique (toutes actions à 1) : N = ${N} kN, x_R = ${xR} m, e = ${e} m pour B / 6 = ${b6} m, ${situation}. Indication, sans verdict.`,
  },
  entrees: {
    segments: 'Segments',
    charges: 'Charges',
    ponctuelle: (x: string, z: string, Fx: string, Fz: string) => `ponctuelle en (${x} ; ${z}) : F_x = ${Fx} kN, F_z = ${Fz} kN vers le bas`,
    moment: (M: string) => `moment ${M} kN.m (trigonométrique)`,
    lineaire: (dir: Direction, xa: string, za: string, xb: string, zb: string, qa: string, qb: string) =>
      `${dir} de (${xa} ; ${za}) à (${xb} ; ${zb}) : q = ${qa} à ${qb} kN/m`,
    base: (xg: string, xd: string, z: string, mu: string, prof: string) =>
      `Base de x = ${xg} à ${xd} m, z = ${z} m ; mu_d = ${mu} ; profondeur ${prof} m.`,
  },
  note: {
    hypotheses: [
      'Repère : x vers la droite, z vers le haut, moments positifs dans le sens trigonométrique. Charges verticales saisies positives vers le bas.',
      "Chaque segment pesant et chaque charge sont une action distincte, classée stabilisante ou déstabilisante selon le signe de son effet ; une charge linéaire est décomposée en deux triangles.",
      "Renversement : coefficients EQU (EN 1990 tableau A1.2(A)) ; une action variable stabilisante n'est pas prise.",
      "Glissement : coefficients STR/GEO (tableau A1.2(B)) ; frottement de calcul mu_d saisi, coefficients du sol compris (tan delta_d, ou tan delta / gamma_R,h selon l'approche).",
      'Soulèvement : coefficients UPL (EN 1997-1 tableau A.15).',
      'Position de la résultante : toutes actions à leur valeur caractéristique ; indication sans verdict.',
      "Ni portance du sol, ni résistance des éléments : seul l'équilibre est vérifié.",
    ],
    element: 'Équilibre statique',
    outil: 'équilibre-statique',
    coefficientsPartiels: 'Coefficients partiels',
    synthese: 'Synthèse des vérifications',
    renversementTitre: (p: Pivot, x: string, z: string) => `Renversement autour de l'arête ${p} (x = ${x} m, z = ${z} m)`,
    renversementLigne: (p: Pivot, x: string) => `Renversement autour de l'arête ${p} (x = ${x} m)`,
    base: (xg: string, xd: string, z: string, prof: string) => `Base de x = ${xg} à ${xd} m, z = ${z} m ; profondeur prise en compte ${prof} m.`,
    legende: "Schéma de l'élément, des charges et de la résultante",
    profil: (nom: string, date: string) => `Profil normatif : ${nom}, données consultées le ${date}. L'annexe nationale peut modifier ces valeurs.`,
    frottement: (mu: string) => `Frottement de calcul à la base : mu_d = ${mu}.`,
  },
  form: {
    types: { ponctuelle: 'ponctuelle', lineaire: 'linéaire', moment: 'moment' } as Record<TypeCharge, string>,
    directions: { verticale: 'verticale ↓', horizontale: 'horizontale →' } as Record<Direction, string>,
    /** Sens d'une charge lineaire dans la description des entrees. */
    direction: { verticale: 'verticale', horizontale: 'horizontale' } as Record<Direction, string>,
    choisi: 'Élément choisi',
    aucunChoix: 'Aucun élément choisi : cliquer un élément du dessin ou une ligne de tableau.',
    choisiBase: 'Élément choisi : base',
    choisiSegment: (id: string) => `Élément choisi : ${id}, segment`,
    choisiCharge: (id: string, type: string) => `Élément choisi : ${id}, ${type}`,
    retirer: 'retirer',
  },
  dessin: { schema: "schéma de l'élément" },
  messages: {
    aimante: (noeud: string) => `aimanté sur ${noeud}`,
    rienAExporter: 'Aucun calcul valide à exporter : corriger la saisie.',
    exemple: '— exemple —',
    nombreAttendu: (quoi: string, v: string) => `${quoi} : nombre attendu, reçu « ${v} ».`,
    profondeur: 'profondeur',
    format: (lu: string, attendu: string) => `Fichier de format ${lu} : attendu ${attendu}.`,
    nouvelleVersion: 'Une nouvelle version est disponible. Recharger maintenant ?',
  },
  exemples: {
    'mur-poids': 'Mur poids 1 × 3 m sous poussée triangulaire',
    'mur-en-l': 'Mur en L : voile, semelle, terre sur le talon, poussée et surcharge',
  } as Record<string, string>,
  /** Identifiants des exemples, pour la page anglaise. */
  ids: {} as Record<string, string>,
};

type Textes = typeof FR;

const EN: Textes = {
  verdict: { assure: 'Equilibrium ensured', nonAssure: 'Equilibrium not ensured' },
  infini: 'infinite',
  pivot: { gauche: 'left', droite: 'right' },
  arete: (p) => `${p === 'gauche' ? 'left' : 'right'} edge`,
  cartes: {
    renversement: (p) => (p === 'gauche' ? 'Overturning, left edge' : 'Overturning, right edge'),
    resultante: 'Resultant on the base',
    indication: 'indication',
  },
  verifications: {
    renversementAutour: (p) => `Overturning about the ${p === 'gauche' ? 'left' : 'right'} edge`,
    glissementVers: (sens) => `Sliding towards ${sens}`,
    soulevement: 'Uplift',
    renversementEqu: 'Overturning (EQU)',
    glissement: 'Sliding',
    soulevementUpl: 'Uplift (UPL)',
  },
  clauses: {
    renversement: 'EN 1990, Table A1.2(A)',
    glissement: 'EN 1990, Table A1.2(B)',
    soulevement: 'EN 1997-1, Table A.15',
    glissementCourt: 'Table A1.2(B)',
    soulevementCourt: 'EN 1997-1 Table A.15',
    renversementCourt: 'EN 1990 Table A1.2(A)',
  },
  entetes: {
    verification: 'Verification',
    coefficients: 'Factors',
    destabilisant: 'Destabilising',
    stabilisant: 'Stabilising',
    taux: 'Ratio',
    charge: 'Load',
    distance: 'Distance d',
    mStabilisant: 'M stabilising',
    mDestabilisant: 'M destabilising',
    couple: 'couple',
    source: 'Source',
    axe: 'Axis (m)',
    description: 'Description',
  },
  somme: 'Sum',
  tauxSomme: 'Ratio = destabilising sum / stabilising sum',
  couple: (v) => `couple ${v} kN.m`,
  noteMoments: 'M = F × d × gamma_f; d is the distance from the pivot to the line of action of the load.',
  excentricite: {
    aucune: 'No compressive axial force on the base: position of the resultant not applicable.',
    noyau: 'within the middle third: base fully compressed',
    horsNoyau: 'outside the middle third: partial uplift of the base',
    horsBase: 'OUTSIDE THE BASE: the element overturns',
    texte: (N, xR, e, b6, situation) =>
      `Characteristic resultant (all actions at 1): N = ${N} kN, x_R = ${xR} m, e = ${e} m against B / 6 = ${b6} m, ${situation}. Indication, without verdict.`,
  },
  entrees: {
    segments: 'Segments',
    charges: 'Loads',
    ponctuelle: (x, z, Fx, Fz) => `point load at (${x} ; ${z}): F_x = ${Fx} kN, F_z = ${Fz} kN downwards`,
    moment: (M) => `moment ${M} kN.m (anticlockwise)`,
    lineaire: (dir, xa, za, xb, zb, qa, qb) =>
      `${dir === 'verticale' ? 'vertical' : 'horizontal'} from (${xa} ; ${za}) to (${xb} ; ${zb}): q = ${qa} to ${qb} kN/m`,
    base: (xg, xd, z, mu, prof) => `Base from x = ${xg} to ${xd} m, z = ${z} m; mu_d = ${mu}; depth ${prof} m.`,
  },
  note: {
    hypotheses: [
      'Axes: x to the right, z upwards, moments positive anticlockwise. Vertical loads entered positive downwards.',
      'Each weighted segment and each load is a separate action, classed as stabilising or destabilising by the sign of its effect; a linear load is split into two triangles.',
      'Overturning: EQU factors (EN 1990 Table A1.2(A)); a stabilising variable action is not taken into account.',
      'Sliding: STR/GEO factors (Table A1.2(B)); design friction coefficient mu_d entered, soil factors included (tan delta_d, or tan delta / gamma_R,h depending on the design approach).',
      'Uplift: UPL factors (EN 1997-1 Table A.15).',
      'Position of the resultant: all actions at their characteristic value; indication without verdict.',
      'Neither the bearing resistance of the ground nor the resistance of the members: only equilibrium is verified.',
    ],
    element: 'Static equilibrium',
    outil: 'equilibre-statique',
    coefficientsPartiels: 'Partial factors',
    synthese: 'Summary of the verifications',
    renversementTitre: (p, x, z) => `Overturning about the ${p === 'gauche' ? 'left' : 'right'} edge (x = ${x} m, z = ${z} m)`,
    renversementLigne: (p, x) => `Overturning about the ${p === 'gauche' ? 'left' : 'right'} edge (x = ${x} m)`,
    base: (xg, xd, z, prof) => `Base from x = ${xg} to ${xd} m, z = ${z} m; depth taken into account ${prof} m.`,
    legende: 'Diagram of the element, the loads and the resultant',
    profil: (nom, date) => `Code profile: ${nom}, data checked on ${date}. The National Annex may modify these values.`,
    frottement: (mu) => `Design friction at the base: mu_d = ${mu}.`,
  },
  form: {
    types: { ponctuelle: 'point', lineaire: 'linear', moment: 'moment' },
    directions: { verticale: 'vertical ↓', horizontale: 'horizontal →' },
    direction: { verticale: 'vertical', horizontale: 'horizontal' },
    choisi: 'Selected element',
    aucunChoix: 'No element selected: click an element of the drawing or a table row.',
    choisiBase: 'Selected element: base',
    choisiSegment: (id) => `Selected element: ${id}, segment`,
    choisiCharge: (id, type) => `Selected element: ${id}, ${type}`,
    retirer: 'remove',
  },
  dessin: { schema: 'diagram of the element' },
  messages: {
    aimante: (noeud) => `snapped to ${noeud}`,
    rienAExporter: 'No valid calculation to export: correct the input.',
    exemple: '— example —',
    nombreAttendu: (quoi, v) => `${quoi}: number expected, got “${v}”.`,
    profondeur: 'depth',
    format: (lu, attendu) => `File of format ${lu}: expected ${attendu}.`,
    nouvelleVersion: 'A new version is available. Reload now?',
  },
  exemples: {
    'mur-poids': 'Gravity wall 1 × 3 m under triangular earth pressure',
    'mur-en-l': 'L-shaped wall: stem, footing, soil on the heel, earth pressure and surcharge',
  },
  ids: { mur: 'wall', voile: 'stem', semelle: 'footing', terre: 'soil', poussee: 'thrust', surcharge: 'surcharge' },
};

export function textes(): Textes {
  return langueCourante() === 'en' ? EN : FR;
}

/** Nom d'une verification dans le motif du noyau. */
function verificationEn(nom: string): string {
  if (nom === 'glissement') return 'sliding';
  if (nom === 'soulèvement') return 'uplift';
  return nom.replace(/^renversement autour de l'arête (gauche|droite)$/, (_t, p: string) => `overturning about the ${p === 'gauche' ? 'left' : 'right'} edge`);
}

/** Nom d'une grandeur dans les messages d'erreur du noyau. */
function grandeurEn(nom: string): string {
  return nom
    .replace(/^La profondeur$/, 'The depth')
    .replace(/^Le segment (.+) : épaisseur$/, 'Segment $1: thickness')
    .replace(/^Le segment (.+) : longueur$/, 'Segment $1: length')
    .replace(' : ', ': ');
}

const EXACTES: Record<string, string> = {
  'EN 1990:2002 et EN 1997-1:2004, valeurs recommandées': 'EN 1990:2002 and EN 1997-1:2004, recommended values',
  'La base doit avoir x_d > x_g (m).': 'The base must have x_d > x_g (m).',
  'Le frottement de calcul mu doit être un nombre positif ou nul (-).': 'The design friction coefficient mu must be a positive number or zero (-).',
  'Aucune action : saisir au moins un segment pesant ou une charge.': 'No action: enter at least one weighted segment or one load.',
};

/**
 * Traduit une phrase du noyau (profil, sources, motif, origine des actions,
 * erreurs). En francais, la phrase sort intacte.
 */
export const phrase = traducteur(EXACTES, [
  [
    /^(EN [^,]+), tableau ([^,]+), valeur recommandée( \(action variable favorable : 0\))?$/,
    (_t, norme: string, tableau: string, favorable?: string) =>
      `${norme}, Table ${tableau}, recommended value${favorable ? ' (favourable variable action: 0)' : ''}`,
  ],
  [
    /^Équilibre (assuré|non assuré) : taux maximal (.+) \((.+)\)\.$/,
    (_t, etat: string, taux: string, nom: string) =>
      `Equilibrium ${etat === 'assuré' ? 'ensured' : 'not ensured'}: maximum ratio ${taux} (${verificationEn(nom)}).`,
  ],
  [/^poids de (.+)$/, 'self-weight of $1'],
  [/^(.+), triangle en ([AB])$/, '$1, triangle at $2'],
  [/^(.+) doit être un nombre strictement positif \((.+)\)\.$/, (_t, nom: string, u: string) => `${grandeurEn(nom)} must be a strictly positive number (${u}).`],
  [/^(.+) doit être un nombre \((.+)\)\.$/, (_t, nom: string, u: string) => `${grandeurEn(nom)} must be a number (${u}).`],
  [/^Le segment (.+) : poids volumique positif ou nul attendu \(kN\/m3\)\.$/, 'Segment $1: unit weight expected positive or zero (kN/m3).'],
]);
