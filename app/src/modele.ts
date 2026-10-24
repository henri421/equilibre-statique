/**
 * La saisie (chaines) et sa lecture en donnees du noyau. PUR, sans DOM.
 */

import { lireNombre } from 'aedificium-ui';
import type { Charge, DonneesEquilibre, NatureAction, Segment } from '../../src/index';

export interface LigneSegment {
  id: string;
  x1: string;
  z1: string;
  x2: string;
  z2: string;
  e: string;
  gamma: string;
}

export type TypeCharge = 'ponctuelle' | 'lineaire' | 'moment';

export interface LigneCharge {
  type: TypeCharge;
  id: string;
  nature: NatureAction;
  /** Ponctuelle. */
  x: string;
  z: string;
  Fx: string;
  Fz: string;
  /** Lineaire. */
  xa: string;
  za: string;
  xb: string;
  zb: string;
  qa: string;
  qb: string;
  direction: 'verticale' | 'horizontale';
  /** Moment. */
  M: string;
}

export interface Saisie {
  segments: LigneSegment[];
  charges: LigneCharge[];
  xg: string;
  xd: string;
  zb: string;
  mu: string;
  profondeur: string;
}

export function charge(partiel: Partial<LigneCharge> & { type: TypeCharge; id: string }): LigneCharge {
  return { nature: 'G', x: '0', z: '0', Fx: '0', Fz: '0', xa: '0', za: '0', xb: '0', zb: '1', qa: '10', qb: '10', direction: 'verticale', M: '0', ...partiel };
}

/** Exemples : la page s'ouvre sur un cas relisible a la main. */
export const EXEMPLES: Record<string, { libelle: string; saisie: Saisie }> = {
  'mur-poids': {
    libelle: 'Mur poids 1 × 3 m sous poussée triangulaire',
    saisie: {
      segments: [{ id: 'mur', x1: '0,5', z1: '0', x2: '0,5', z2: '3', e: '1', gamma: '24' }],
      charges: [charge({ type: 'lineaire', id: 'poussee', xa: '0', za: '0', xb: '0', zb: '3', qa: '30', qb: '0', direction: 'horizontale' })],
      xg: '0',
      xd: '1',
      zb: '0',
      mu: '0,5',
      profondeur: '1',
    },
  },
  'mur-en-l': {
    libelle: 'Mur en L : voile, semelle, terre sur le talon, poussée et surcharge',
    saisie: {
      segments: [
        { id: 'voile', x1: '0,6', z1: '0,4', x2: '0,6', z2: '3,4', e: '0,25', gamma: '25' },
        { id: 'semelle', x1: '0', z1: '0,2', x2: '2,2', z2: '0,2', e: '0,4', gamma: '25' },
        { id: 'terre', x1: '1,46', z1: '0,4', x2: '1,46', z2: '3,4', e: '1,48', gamma: '18' },
      ],
      charges: [
        charge({ type: 'lineaire', id: 'poussee', xa: '2,2', za: '0', xb: '2,2', zb: '3,4', qa: '-20,4', qb: '0', direction: 'horizontale' }),
        charge({ type: 'lineaire', id: 'surcharge', nature: 'Q', xa: '2,2', za: '0', xb: '2,2', zb: '3,4', qa: '-3,3', qb: '-3,3', direction: 'horizontale' }),
      ],
      xg: '0',
      xd: '2,2',
      zb: '0',
      mu: '0,5',
      profondeur: '1',
    },
  },
};

export function saisieParDefaut(): Saisie {
  return structuredClone(EXEMPLES['mur-poids'].saisie);
}

export type Lecture = { ok: true; donnees: DonneesEquilibre } | { ok: false; message: string };

function n(v: string, quoi: string): number {
  const x = lireNombre(v);
  if (x === null) throw new Error(`${quoi} : nombre attendu, reçu « ${v} ».`);
  return x;
}

export function lireSaisie(s: Saisie): Lecture {
  try {
    const segments: Segment[] = s.segments.map((l, i) => {
      const id = l.id.trim() || `S${i + 1}`;
      return { id, x1: n(l.x1, `${id}, x1`), z1: n(l.z1, `${id}, z1`), x2: n(l.x2, `${id}, x2`), z2: n(l.z2, `${id}, z2`), e: n(l.e, `${id}, e`), gamma: n(l.gamma, `${id}, gamma`) };
    });
    const charges: Charge[] = s.charges.map((l, i) => {
      const id = l.id.trim() || `C${i + 1}`;
      if (l.type === 'ponctuelle') return { type: 'ponctuelle', id, nature: l.nature, x: n(l.x, `${id}, x`), z: n(l.z, `${id}, z`), Fx: n(l.Fx, `${id}, F_x`), Fz: n(l.Fz, `${id}, F_z`) };
      if (l.type === 'moment') return { type: 'moment', id, nature: l.nature, M: n(l.M, `${id}, M`) };
      return {
        type: 'lineaire',
        id,
        nature: l.nature,
        xa: n(l.xa, `${id}, x_A`),
        za: n(l.za, `${id}, z_A`),
        xb: n(l.xb, `${id}, x_B`),
        zb: n(l.zb, `${id}, z_B`),
        qa: n(l.qa, `${id}, q_A`),
        qb: n(l.qb, `${id}, q_B`),
        direction: l.direction,
      };
    });
    return {
      ok: true,
      donnees: {
        segments,
        charges,
        base: { xg: n(s.xg, 'x_g'), xd: n(s.xd, 'x_d'), z: n(s.zb, 'z_b') },
        mu: n(s.mu, 'mu_d'),
        profondeur: n(s.profondeur, 'profondeur'),
      },
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

const FORMAT = 'equilibre-statique/1';

export function serialiser(s: Saisie): string {
  return JSON.stringify({ format: FORMAT, ...s }, null, 2);
}

export function relire(texte: string): Saisie {
  const brut = JSON.parse(texte) as Record<string, unknown>;
  if (brut.format !== FORMAT) throw new Error(`Fichier de format ${JSON.stringify(brut.format)} : attendu ${FORMAT}.`);
  const d = saisieParDefaut();
  const t = (v: unknown, def: string) => (typeof v === 'string' ? v : def);
  const segs = Array.isArray(brut.segments) ? (brut.segments as Record<string, unknown>[]) : [];
  const chs = Array.isArray(brut.charges) ? (brut.charges as Record<string, unknown>[]) : [];
  return {
    segments: segs.map((x, i) => ({ id: t(x.id, `S${i + 1}`), x1: t(x.x1, '0'), z1: t(x.z1, '0'), x2: t(x.x2, '0'), z2: t(x.z2, '1'), e: t(x.e, '0,2'), gamma: t(x.gamma, '25') })),
    charges: chs.map((x, i) => {
      const type: TypeCharge = x.type === 'ponctuelle' || x.type === 'moment' ? x.type : 'lineaire';
      const base = charge({ type, id: t(x.id, `C${i + 1}`) });
      const sortie: LigneCharge = { ...base, nature: x.nature === 'Q' ? 'Q' : 'G', direction: x.direction === 'horizontale' ? 'horizontale' : 'verticale' };
      for (const k of ['x', 'z', 'Fx', 'Fz', 'xa', 'za', 'xb', 'zb', 'qa', 'qb', 'M'] as const) sortie[k] = t(x[k], base[k]);
      return sortie;
    }),
    xg: t(brut.xg, d.xg),
    xd: t(brut.xd, d.xd),
    zb: t(brut.zb, d.zb),
    mu: t(brut.mu, d.mu),
    profondeur: t(brut.profondeur, d.profondeur),
  };
}
