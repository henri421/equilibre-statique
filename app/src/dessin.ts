/**
 * Schema de l'element : segments a leur epaisseur, base, aretes de
 * basculement, charges, resultante caracteristique. PUR.
 *
 * Coordonnees du modele en m, z vers le haut ; le SVG a y vers le bas.
 */

import { nombreAffiche, notationSvg } from 'aedificium-ui';
import type { DonneesEquilibre, ResultatEquilibre } from '../../src/index';

interface Cadre {
  echelle: number;
  x0: number;
  z1: number;
  marge: number;
}

function bornes(d: DonneesEquilibre): { xmin: number; xmax: number; zmin: number; zmax: number } {
  const xs: number[] = [d.base.xg, d.base.xd];
  const zs: number[] = [d.base.z];
  for (const s of d.segments) {
    xs.push(s.x1 - s.e / 2, s.x2 + s.e / 2, s.x1 + s.e / 2, s.x2 - s.e / 2);
    zs.push(s.z1 - s.e / 2, s.z2 + s.e / 2, s.z1 + s.e / 2, s.z2 - s.e / 2);
  }
  for (const c of d.charges) {
    if (c.type === 'ponctuelle') {
      xs.push(c.x);
      zs.push(c.z);
    } else if (c.type === 'lineaire') {
      xs.push(c.xa, c.xb);
      zs.push(c.za, c.zb);
    }
  }
  return { xmin: Math.min(...xs), xmax: Math.max(...xs), zmin: Math.min(...zs), zmax: Math.max(...zs) };
}

/** Le schema, dimensionne pour une largeur d'environ 520 px. */
export function schema(d: DonneesEquilibre, r: ResultatEquilibre | null): string {
  const b = bornes(d);
  const L = Math.max(b.xmax - b.xmin, b.zmax - b.zmin, 0.5);
  const echelle = 380 / L;
  const c: Cadre = { echelle, x0: b.xmin - 0.25 * L, z1: b.zmax + 0.25 * L, marge: 0 };
  const X = (x: number) => (x - c.x0) * echelle;
  const Y = (z: number) => (c.z1 - z) * echelle;
  const largeur = (b.xmax - b.xmin + 0.5 * L) * echelle;
  const hauteur = (b.zmax - b.zmin + 0.5 * L) * echelle;
  const parts: string[] = [];

  // Segments : rectangles d'epaisseur e autour de leur axe.
  for (const s of d.segments) {
    const dx = s.x2 - s.x1;
    const dz = s.z2 - s.z1;
    const l = Math.hypot(dx, dz) || 1;
    const nx = (-dz / l) * (s.e / 2);
    const nz = (dx / l) * (s.e / 2);
    const pts = [
      [s.x1 + nx, s.z1 + nz],
      [s.x2 + nx, s.z2 + nz],
      [s.x2 - nx, s.z2 - nz],
      [s.x1 - nx, s.z1 - nz],
    ]
      .map(([x, z]) => `${X(x).toFixed(1)},${Y(z).toFixed(1)}`)
      .join(' ');
    parts.push(`<polygon class="segment" points="${pts}" />`);
    parts.push(`<text class="etiquette" x="${X((s.x1 + s.x2) / 2).toFixed(1)}" y="${Y((s.z1 + s.z2) / 2).toFixed(1)}" text-anchor="middle">${notationSvg(s.id)}</text>`);
  }

  // Base et aretes de basculement.
  parts.push(`<line class="base" x1="${X(d.base.xg)}" y1="${Y(d.base.z)}" x2="${X(d.base.xd)}" y2="${Y(d.base.z)}" />`);
  for (const [x, nom] of [[d.base.xg, 'arete gauche'], [d.base.xd, 'arete droite']] as const) {
    parts.push(`<circle class="pivot" cx="${X(x)}" cy="${Y(d.base.z)}" r="5" /><text class="etiquette" x="${X(x)}" y="${(Y(d.base.z) + 18).toFixed(1)}" text-anchor="middle">${notationSvg(nom)}</text>`);
  }

  // Charges lineaires : leur repartition, diagramme et fleches.
  const long = 0.12 * L * echelle;
  const qMax = Math.max(1e-9, ...d.charges.flatMap((ch) => (ch.type === 'lineaire' ? [Math.abs(ch.qa), Math.abs(ch.qb)] : [])));
  for (const ch of d.charges) {
    if (ch.type !== 'lineaire') continue;
    // Direction de la charge, en coordonnees du modele (z vers le haut).
    const [ux, uz] = ch.direction === 'horizontale' ? [1, 0] : [0, -1];
    const echelleQ = (0.15 * L) / qMax;
    const pointA = [ch.xa - ux * ch.qa * echelleQ, ch.za - uz * ch.qa * echelleQ];
    const pointB = [ch.xb - ux * ch.qb * echelleQ, ch.zb - uz * ch.qb * echelleQ];
    const poly = [[ch.xa, ch.za], [ch.xb, ch.zb], pointB, pointA].map(([x, z]) => `${X(x).toFixed(1)},${Y(z).toFixed(1)}`).join(' ');
    parts.push(`<polygon class="diagramme diagramme-${ch.nature}" points="${poly}" />`);
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      const q = ch.qa + t * (ch.qb - ch.qa);
      if (Math.abs(q) < 1e-9) continue;
      const x = ch.xa + t * (ch.xb - ch.xa);
      const z = ch.za + t * (ch.zb - ch.za);
      parts.push(
        `<line class="charge charge-${ch.nature}" x1="${X(x - ux * q * echelleQ).toFixed(1)}" y1="${Y(z - uz * q * echelleQ).toFixed(1)}" x2="${X(x).toFixed(1)}" y2="${Y(z).toFixed(1)}" marker-end="url(#pointe)" />`
      );
    }
  }

  // Resultantes : fleche pour les charges ponctuelles, point pour celles des charges lineaires.
  if (r !== null) {
    for (const e of r.elementaires) {
      if (e.C !== 0 || e.origine.startsWith('poids de')) continue;
      if (e.origine.includes('triangle')) {
        parts.push(`<circle class="point-resultante" cx="${X(e.x).toFixed(1)}" cy="${Y(e.z).toFixed(1)}" r="3"><title>${notationSvg(e.origine)}</title></circle>`);
        continue;
      }
      const n = Math.hypot(e.Fx, e.Fz) || 1;
      const ux = e.Fx / n;
      const uz = -e.Fz / n; // en SVG, y vers le bas
      const xb = X(e.x);
      const yb = Y(e.z);
      const xa = xb - ux * long;
      const ya = yb - uz * long;
      parts.push(`<line class="charge charge-${e.nature}" x1="${xa.toFixed(1)}" y1="${ya.toFixed(1)}" x2="${xb.toFixed(1)}" y2="${yb.toFixed(1)}" marker-end="url(#pointe)" />`);
    }
    for (const e of r.elementaires) {
      if (!e.origine.startsWith('poids de')) continue;
      parts.push(`<line class="poids" x1="${X(e.x)}" y1="${(Y(e.z) - long / 2).toFixed(1)}" x2="${X(e.x)}" y2="${(Y(e.z) + long / 2).toFixed(1)}" marker-end="url(#pointe)" />`);
    }
    const ex = r.excentricite;
    if (ex !== null) {
      parts.push(`<circle class="resultante" cx="${X(ex.xR).toFixed(1)}" cy="${Y(d.base.z).toFixed(1)}" r="4" />`);
      parts.push(`<text class="etiquette" x="${X(ex.xR).toFixed(1)}" y="${(Y(d.base.z) + 32).toFixed(1)}" text-anchor="middle">${notationSvg(`x_R = ${nombreAffiche(ex.xR, 2)} m`)}</text>`);
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeur.toFixed(0)} ${hauteur.toFixed(0)}" role="img" aria-label="schema de l element">` +
    '<defs><marker id="pointe" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="pointe" /></marker></defs>' +
    parts.join('') +
    '</svg>'
  );
}
