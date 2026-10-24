/**
 * Coefficients partiels de l'equilibre statique.
 *
 * Valeurs RECOMMANDEES, que l'annexe nationale peut modifier. Chaque valeur
 * porte sa source ; une valeur sans source bloque le calcul.
 *
 * Grandeurs sans dimension.
 */

export interface ValeurSourcee {
  valeur: number;
  source: string;
}

/** Coefficients d'une verification : actions destabilisantes et stabilisantes. */
export interface JeuEquilibre {
  gG_dst: ValeurSourcee;
  gG_stb: ValeurSourcee;
  gQ_dst: ValeurSourcee;
  /** Une action variable favorable n'est pas prise : 0. */
  gQ_stb: ValeurSourcee;
}

export interface ProfilEquilibre {
  nom: string;
  date: string;
  /** Renversement : EQU, EN 1990 tableau A1.2(A). */
  equ: JeuEquilibre;
  /** Glissement : STR/GEO, EN 1990 tableau A1.2(B). */
  glissement: JeuEquilibre;
  /** Soulevement : UPL, EN 1997-1 tableau A.15. */
  upl: JeuEquilibre;
}

function jeu(source: string, gG_dst: number, gG_stb: number, gQ_dst: number): JeuEquilibre {
  return {
    gG_dst: { valeur: gG_dst, source },
    gG_stb: { valeur: gG_stb, source },
    gQ_dst: { valeur: gQ_dst, source },
    gQ_stb: { valeur: 0, source: `${source} (action variable favorable : 0)` },
  };
}

export function profilRecommande(): ProfilEquilibre {
  return {
    nom: 'EN 1990:2002 et EN 1997-1:2004, valeurs recommandées',
    date: '2026-10-23',
    equ: jeu('EN 1990:2002, tableau A1.2(A), valeur recommandée', 1.1, 0.9, 1.5),
    glissement: jeu('EN 1990:2002, tableau A1.2(B), valeur recommandée', 1.35, 1.0, 1.5),
    upl: jeu('EN 1997-1:2004, tableau A.15, valeur recommandée', 1.0, 0.9, 1.5),
  };
}

/** Leve en nommant la premiere valeur non numerique ou sans source. */
export function verifierProfil(p: ProfilEquilibre): void {
  for (const [nom, j] of [['EQU', p.equ], ['glissement', p.glissement], ['UPL', p.upl]] as const) {
    for (const [cle, v] of Object.entries(j) as [string, ValeurSourcee][]) {
      if (!Number.isFinite(v.valeur) || v.valeur < 0) throw new Error(`Profil : ${cle} (${nom}) n'est pas un nombre positif.`);
      if (v.source.trim() === '') throw new Error(`Profil : ${cle} (${nom}) n'a pas de source ; une valeur sans provenance bloque le calcul.`);
    }
  }
}
