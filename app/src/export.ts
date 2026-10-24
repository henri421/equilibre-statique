/**
 * Sorties : SVG autonome, CSV, note de calcul. PUR, sans DOM.
 */

import { JETONS, csv, notationHtml, notationTexte } from 'aedificium-ui';
import type { ProfilEquilibre, ResultatEquilibre } from '../../src/index';
import { lignesCsv, rendreResultat, tableauProfil } from './vue';

/** Regles de peinture du schema, recopiees de `style.css` pour l'export. */
export const STYLES_TRACE = `${JETONS}
svg { background: var(--surface); color-scheme: light; font-family: var(--sans); }
svg .segment { fill: var(--beton); stroke: var(--texte); stroke-width: 1.2; }
svg .base { stroke: var(--texte); stroke-width: 3; }
svg .pivot { fill: var(--surface); stroke: var(--traction); stroke-width: 2; }
svg .charge { stroke: var(--traction); stroke-width: 2; }
svg .charge-Q { stroke-dasharray: 6 4; }
svg .poids { stroke: var(--compression); stroke-width: 2; }
svg .pointe { fill: var(--texte); }
svg .resultante { fill: var(--accent); }
svg .diagramme { fill: var(--traction); fill-opacity: 0.12; stroke: var(--traction); stroke-width: 1; }
svg .diagramme-Q { stroke-dasharray: 6 4; }
svg .point-resultante { fill: var(--traction); }
svg .etiquette { fill: var(--texte-doux); font-size: 11px; }`;

export function resultatEnCsv(r: ResultatEquilibre): string {
  return csv(lignesCsv(r).map((l) => l.map(notationTexte)));
}

export const HYPOTHESES = [
  'Repère : x vers la droite, z vers le haut, moments positifs dans le sens trigonométrique. Charges verticales saisies positives vers le bas.',
  "Chaque segment pesant et chaque charge sont une action distincte, classée stabilisante ou déstabilisante selon le signe de son effet ; une charge linéaire est décomposée en deux triangles.",
  "Renversement : coefficients EQU (EN 1990 tableau A1.2(A)) ; une action variable stabilisante n'est pas prise.",
  "Glissement : coefficients STR/GEO (tableau A1.2(B)) ; frottement de calcul mu_d saisi, coefficients du sol compris (tan delta_d, ou tan delta / gamma_R,h selon l'approche).",
  'Soulèvement : coefficients UPL (EN 1997-1 tableau A.15).',
  'Position de la résultante : toutes actions à leur valeur caractéristique ; indication sans verdict.',
  "Ni portance du sol, ni résistance des éléments : seul l'équilibre est vérifié.",
];

const AIDE =
  "Valeurs recommandées de l'EN 1990 et de l'EN 1997-1 ; l'annexe nationale peut les modifier. " +
  'La note rassemble les valeurs intermédiaires du calcul.';

export function noteDeCalculHtml(r: ResultatEquilibre, profil: ProfilEquilibre, svg: string, entrees: string, date: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" /><title>Note de calcul — équilibre statique</title>
<style>${STYLES_TRACE}
  body { margin: 0; padding: 24px 28px; background: var(--surface); color: var(--texte); font: 13px/1.5 var(--sans); }
  h1 { font-size: 1.15rem; font-weight: normal; margin: 0 0 .2rem; }
  h2 { font-size: .95rem; margin: 1.5rem 0 .5rem; border-bottom: 1px solid var(--bordure); padding-bottom: .25rem; }
  h3 { font-size: .85rem; margin: 1rem 0 .3rem; }
  table { border-collapse: collapse; width: 100%; font-size: .78rem; margin: .3rem 0 .6rem; }
  th, td { border-bottom: 1px solid var(--bordure-douce); padding: .2rem .4rem; text-align: left; }
  th { background: var(--surface-appui); }
  td.valeur { font-family: var(--mono); text-align: right; white-space: nowrap; }
  td.ok { color: var(--ok); } td.refus { color: var(--refus); font-weight: 600; }
  tr.destabilisant td:first-child { border-left: 3px solid var(--traction); }
  tfoot td { border-top: 2px solid var(--texte); font-weight: 600; }
  .verdict { font-weight: 600; padding: .4rem .6rem; border-left: 3px solid; }
  .verdict-conforme { color: var(--ok); background: var(--ok-fond); }
  .verdict-non-conforme { color: var(--refus); background: var(--refus-fond); }
  .note, .clause { color: var(--texte-doux); font-size: .8rem; }
  figure svg { max-width: 30rem; height: auto; }
  ul { color: var(--texte-doux); font-size: .82rem; }
  .pied { margin-top: 2rem; border-top: 1px solid var(--bordure); color: var(--texte-doux); font-size: .78rem; padding-top: .5rem; }
</style></head><body>
<h1>Note de calcul — équilibre statique</h1>
<p class="clause">${notationHtml(date)} · ${notationHtml(profil.nom)}</p>
<h2>Données</h2>${entrees}
<figure>${svg}</figure>
<h2>Coefficients partiels</h2>${tableauProfil(profil)}
<h2>Vérifications</h2>${rendreResultat(r)}
<h2>Hypothèses et limites</h2><ul>${HYPOTHESES.map((h) => `<li>${notationHtml(h)}</li>`).join('')}</ul>
<p class="pied">${AIDE}</p>
</body></html>`;
}
