/**
 * Sorties : SVG autonome, CSV. PUR, sans DOM.
 */

import { JETONS, csv, notationTexte } from 'aedificium-ui';
import type { ResultatEquilibre } from '../../src/index';
import { lignesCsv } from './vue';

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
