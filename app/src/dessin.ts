/**
 * Schema de l'element : segments a leur epaisseur, base, aretes de
 * basculement, charges, resultante caracteristique. PUR.
 *
 * Coordonnees du modele en m, z vers le haut ; le SVG a y vers le bas.
 */

import { lireNombre, nombreAffiche, notationSvg, versEcran, vueAjustee } from 'aedificium-ui';
import type { Point, Vue } from 'aedificium-ui';
import type { DonneesEquilibre, ResultatEquilibre } from '../../src/index';
import { grapheDeSaisie } from './edition';
import type { Choix } from './edition';
import type { Saisie } from './modele';
import { phrase, textes } from './textes';

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
  for (const [x, nom] of [[d.base.xg, textes().arete('gauche')], [d.base.xd, textes().arete('droite')]] as const) {
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
        parts.push(`<circle class="point-resultante" cx="${X(e.x).toFixed(1)}" cy="${Y(e.z).toFixed(1)}" r="3"><title>${notationSvg(phrase(e.origine))}</title></circle>`);
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
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeur.toFixed(0)} ${hauteur.toFixed(0)}" role="img" aria-label="${textes().dessin.schema}">` +
    '<defs><marker id="pointe" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="pointe" /></marker></defs>' +
    parts.join('') +
    '</svg>'
  );
}

// ---------------------------------------------------------------------------
// Dessin de la zone d'edition : la saisie brute (chaines), sans conversion en
// donnees validees. Les elements illisibles sont simplement omis.

/** Marge, en pixels, entre le contenu et le bord de la zone d'edition. */
export const MARGE_DESSIN = 40;

export interface OptionsEdition {
  choix: Choix;
  /** Pas de la grille en m, ou null pour aucune grille. */
  grille: number | null;
  cotes: boolean;
  resultante: boolean;
  enCours: Point | null;
  survol: Point | null;
}

export const OPTIONS_EDITION: OptionsEdition = {
  choix: null,
  grille: 0.1,
  cotes: false,
  resultante: true,
  enCours: null,
  survol: null,
};

type Champs = Record<string, unknown>;

/** Nombre lu depuis une saisie (chaine ou nombre), ou null si illisible. */
function lu(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const n = lireNombre(v);
  return n === null || !Number.isFinite(n) ? null : n;
}

interface SegmentLu {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  e: number;
}

function segmentLu(r: Champs): SegmentLu | null {
  const x1 = lu(r.x1);
  const z1 = lu(r.z1);
  const x2 = lu(r.x2);
  const z2 = lu(r.z2);
  const e = lu(r.e);
  if (x1 === null || z1 === null || x2 === null || z2 === null || e === null) return null;
  return { x1, z1, x2, z2, e };
}

/** Les quatre coins d'un segment, a son epaisseur (comme `schema`). */
function coins(s: SegmentLu): Point[] {
  const dx = s.x2 - s.x1;
  const dz = s.z2 - s.z1;
  const l = Math.hypot(dx, dz) || 1;
  const nx = (-dz / l) * (s.e / 2);
  const nz = (dx / l) * (s.e / 2);
  return [
    { x: s.x1 + nx, y: s.z1 + nz },
    { x: s.x2 + nx, y: s.z2 + nz },
    { x: s.x2 - nx, y: s.z2 - nz },
    { x: s.x1 - nx, y: s.z1 - nz },
  ];
}

/** Vue qui cadre la saisie dans une zone de `largeur` x `hauteur`. */
export function vueDeSaisie(s: Saisie, largeur: number, hauteur: number): Vue {
  const points: Point[] = grapheDeSaisie(s).noeuds.map((n) => ({ x: n.x, y: n.y }));
  for (const seg of (s as unknown as { segments?: unknown[] }).segments ?? []) {
    const l = segmentLu(seg as Champs);
    if (l !== null) points.push(...coins(l));
  }
  // Sans aucun repere, on cadre le carre unite.
  if (points.length === 0) points.push({ x: 0, y: 0 }, { x: 1, y: 1 });
  return vueAjustee(points, largeur, hauteur, MARGE_DESSIN);
}

const px = (n: number): string => n.toFixed(1);

function estChoisi(o: OptionsEdition, liste: 'segments' | 'charges', index: number): boolean {
  const c = o.choix;
  return c !== null && c.liste === liste && c.index === index;
}

/** Classe de la forme principale, avec `choisi` le cas echeant. */
function classe(base: string, choisi: boolean): string {
  return choisi ? `${base} choisi` : base;
}

/** Lignes de grille a chaque multiple du pas, dans la zone visible. */
function grille(vue: Vue, largeur: number, hauteur: number, pas: number): string[] {
  if (!(pas > 0)) return [];
  const X = (x: number) => px(versEcran({ x, y: 0 }, vue).x);
  const Y = (z: number) => px((vue.y0 - z) * vue.echelle);
  const xmin = vue.x0;
  const xmax = vue.x0 + largeur / vue.echelle;
  const zmin = vue.y0 - hauteur / vue.echelle;
  const zmax = vue.y0;
  const parts: string[] = [];
  const eps = 1e-9;
  let n = Math.ceil((xmin - eps) / pas);
  for (let k = 0; k < 1000 && n * pas <= xmax + eps; k++, n++) {
    const x = X(n * pas);
    parts.push(`<line class="grille" x1="${x}" y1="0" x2="${x}" y2="${px(hauteur)}" />`);
  }
  n = Math.ceil((zmin - eps) / pas);
  for (let k = 0; k < 1000 && n * pas <= zmax + eps; k++, n++) {
    const y = Y(n * pas);
    parts.push(`<line class="grille" x1="0" y1="${y}" x2="${px(largeur)}" y2="${y}" />`);
  }
  return parts;
}

/** Contenu du `<svg data-role="zone">` : la saisie, ses reperes et ses options. */
export function dessinSaisie(
  s: Saisie,
  r: ResultatEquilibre | null,
  vue: Vue,
  largeur: number,
  hauteur: number,
  o: OptionsEdition,
): string {
  const parts: string[] = [];
  const E = (p: Point) => versEcran(p, vue);

  parts.push(
    '<defs><marker id="pointe-edition" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="pointe" /></marker></defs>'
  );

  if (o.grille !== null) parts.push(...grille(vue, largeur, hauteur, o.grille));

  const segments = (s as unknown as { segments?: unknown[] }).segments ?? [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segmentLu(segments[i] as Champs);
    if (seg === null) continue;
    const pts = coins(seg)
      .map((p) => `${px(E(p).x)},${px(E(p).y)}`)
      .join(' ');
    parts.push(`<polygon class="${classe('segment', estChoisi(o, 'segments', i))}" data-segment="${i}" points="${pts}" />`);
    const a = E({ x: seg.x1, y: seg.z1 });
    const b = E({ x: seg.x2, y: seg.z2 });
    parts.push(`<line class="axe" x1="${px(a.x)}" y1="${px(a.y)}" x2="${px(b.x)}" y2="${px(b.y)}" />`);
  }

  const fixe = s as unknown as Champs;
  const xg = lu(fixe.xg);
  const xd = lu(fixe.xd);
  const zb = lu(fixe.zb);
  if (xg !== null && xd !== null && zb !== null) {
    const g = E({ x: xg, y: zb });
    const d = E({ x: xd, y: zb });
    parts.push(`<line class="${classe('base', o.choix?.liste === 'base')}" data-base="" x1="${px(g.x)}" y1="${px(g.y)}" x2="${px(d.x)}" y2="${px(d.y)}" />`);
  }

  const charges = (s as unknown as { charges?: unknown[] }).charges ?? [];
  const long = 40;
  for (let i = 0; i < charges.length; i++) {
    const c = charges[i] as Champs;
    const nature = c.nature === 'Q' ? 'Q' : 'G';
    const choisi = estChoisi(o, 'charges', i);
    const type = c.type;
    if (type === 'lineaire') {
      const xa = lu(c.xa);
      const za = lu(c.za);
      const xb = lu(c.xb);
      const zb2 = lu(c.zb);
      const qa = lu(c.qa);
      const qb = lu(c.qb);
      if (xa === null || za === null || xb === null || zb2 === null || qa === null || qb === null) continue;
      const [ux, uz] = c.direction === 'horizontale' ? [1, 0] : [0, -1];
      const L = Math.max(largeur, hauteur) / vue.echelle;
      const qMax = Math.max(1e-9, Math.abs(qa), Math.abs(qb));
      const echelleQ = (0.15 * L) / qMax;
      const pA = E({ x: xa - ux * qa * echelleQ, y: za - uz * qa * echelleQ });
      const pB = E({ x: xb - ux * qb * echelleQ, y: zb2 - uz * qb * echelleQ });
      const pa = E({ x: xa, y: za });
      const pb = E({ x: xb, y: zb2 });
      const poly = [pa, pb, pB, pA].map((p) => `${px(p.x)},${px(p.y)}`).join(' ');
      const fils: string[] = [`<polygon class="diagramme diagramme-${nature}" points="${poly}" />`];
      for (let k = 0; k <= 4; k++) {
        const t = k / 4;
        const q = qa + t * (qb - qa);
        if (Math.abs(q) < 1e-9) continue;
        const x = xa + t * (xb - xa);
        const z = za + t * (zb2 - za);
        const a = E({ x: x - ux * q * echelleQ, y: z - uz * q * echelleQ });
        const b = E({ x, y: z });
        fils.push(`<line class="charge" x1="${px(a.x)}" y1="${px(a.y)}" x2="${px(b.x)}" y2="${px(b.y)}" marker-end="url(#pointe-edition)" />`);
      }
      parts.push(`<g class="${classe(`charge charge-${nature}`, choisi)}" data-charge="${i}">${fils.join('')}</g>`);
    } else if (type === 'ponctuelle') {
      const x = lu(c.x);
      const z = lu(c.z);
      if (x === null || z === null) continue;
      const fx = lu(c.Fx) ?? 0;
      const fz = lu(c.Fz) ?? 0;
      const n = Math.hypot(fx, fz);
      const [ux, uz] = n > 0 ? [fx / n, -fz / n] : [0, -1];
      const b = E({ x, y: z });
      const a = { x: b.x - ux * long, y: b.y - uz * long };
      const forme = `<line class="charge" x1="${px(a.x)}" y1="${px(a.y)}" x2="${px(b.x)}" y2="${px(b.y)}" marker-end="url(#pointe-edition)" />`;
      parts.push(`<g class="${classe(`charge charge-${nature}`, choisi)}" data-charge="${i}">${forme}</g>`);
    } else if (type === 'moment') {
      const x = lu(c.x);
      const z = lu(c.z);
      if (x === null || z === null) continue;
      const m = lu(c.M) ?? 0;
      const centre = E({ x, y: z });
      const R = 14;
      const a0 = -Math.PI / 2;
      const a1 = Math.PI;
      const p0 = { x: centre.x + R * Math.cos(a0), y: centre.y + R * Math.sin(a0) };
      const p1 = { x: centre.x + R * Math.cos(a1), y: centre.y + R * Math.sin(a1) };
      const balayage = m >= 0 ? 1 : 0;
      const forme = `<path class="moment" d="M ${px(p0.x)} ${px(p0.y)} A ${R} ${R} 0 1 ${balayage} ${px(p1.x)} ${px(p1.y)}" fill="none" />`;
      parts.push(`<g class="${classe(`charge charge-${nature}`, choisi)}" data-charge="${i}">${forme}</g>`);
    }
  }

  for (const n of grapheDeSaisie(s).noeuds) {
    const p = E({ x: n.x, y: n.y });
    parts.push(`<circle class="point" data-noeud="${n.id}" cx="${px(p.x)}" cy="${px(p.y)}" r="4" />`);
  }

  if (o.enCours !== null) {
    const p = E(o.enCours);
    parts.push(`<circle class="en-cours" cx="${px(p.x)}" cy="${px(p.y)}" r="5" />`);
    if (o.survol !== null) {
      const q = E(o.survol);
      parts.push(`<line class="elastique" x1="${px(p.x)}" y1="${px(p.y)}" x2="${px(q.x)}" y2="${px(q.y)}" />`);
    }
  }

  if (o.resultante && r !== null && r.excentricite !== null && zb !== null) {
    const p = E({ x: r.excentricite.xR, y: zb });
    parts.push(`<circle class="resultante" cx="${px(p.x)}" cy="${px(p.y)}" r="4" />`);
  }

  if (o.cotes && xg !== null && xd !== null && zb !== null) {
    const milieu = E({ x: (xg + xd) / 2, y: zb });
    parts.push(
      `<text class="cote" x="${px(milieu.x)}" y="${px(milieu.y + 24)}" text-anchor="middle">${notationSvg(`B = ${nombreAffiche(xd - xg, 2)} m`)}</text>`
    );
  }

  return parts.join('');
}
