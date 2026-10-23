import { describe, expect, it } from 'vitest';
import { actionsElementaires, profilRecommande, verifierEquilibre, type Charge, type DonneesEquilibre } from '../src/index';

/**
 * Mur poids rectangulaire 1 m × 3 m, beton 24 kN/m3, base de x = 0 a 1 m a
 * z = 0 ; poussee triangulaire horizontale vers +x sur la face gauche,
 * 30 kN/m au pied, nulle en tete. Calcul a la main :
 *   poids W = 24 × 1 × 3 = 72 kN en (0,5 ; 1,5) ;
 *   poussee R = 30 × 3 / 2 = 45 kN a z = 1 m.
 * Renversement autour de l'arete droite (x = 1) :
 *   poussee : M = -(1 - 0) × 45 = -45 kN.m, destabilisante ; × 1,1 = 49,5
 *   poids   : M = (0,5 - 1) × (-72) = +36 kN.m, stabilisant ; × 0,9 = 32,4
 *   taux 49,5 / 32,4 = 1,5278.
 * Glissement vers +x, mu_d = 0,5 : H_d = 1,35 × 45 = 60,75 ; N_d = 72 ; R_d = 36 ; taux 1,6875.
 * Resultante caracteristique : M au milieu = -45 kN.m, x_R = 0,5 + 45/72 = 1,125 m, e = 0,625 m > B/2.
 */

const P = profilRecommande();

const poussee: Charge = { type: 'lineaire', id: 'poussee', nature: 'G', xa: 0, za: 0, xb: 0, zb: 3, qa: 30, qb: 0, direction: 'horizontale' };

function mur(charges: Charge[] = [poussee], mu = 0.5): DonneesEquilibre {
  return {
    segments: [{ id: 'mur', x1: 0.5, z1: 0, x2: 0.5, z2: 3, e: 1, gamma: 24 }],
    charges,
    base: { xg: 0, xd: 1, z: 0 },
    mu,
    profondeur: 1,
  };
}

describe('actions elementaires', () => {
  it('poids d un segment et resultante d un triangle', () => {
    const el = actionsElementaires(mur());
    expect(el[0]).toMatchObject({ Fz: -72, x: 0.5, z: 1.5 });
    expect(el[1].Fx).toBeCloseTo(45, 12);
    expect(el[1].z).toBeCloseTo(1, 12);
  });

  it('trapeze : deux triangles, resultante au centre de gravite du trapeze', () => {
    // q de 10 a 20 kN/m sur 3 m vertical : R = 45 kN ; z_G = 3 × (10 + 2 × 20) / (3 × 30) = 1,6667 m.
    const el = actionsElementaires(mur([{ ...poussee, qa: 10, qb: 20 } as Charge])).slice(1);
    const R = el.reduce((s, e) => s + e.Fx, 0);
    const zG = el.reduce((s, e) => s + e.Fx * e.z, 0) / R;
    expect(R).toBeCloseTo(45, 12);
    expect(zG).toBeCloseTo(5 / 3, 12);
  });
});

describe('mur poids sous poussee', () => {
  const r = verifierEquilibre(mur(), P);
  const droite = r.renversement.find((x) => x.pivot === 'droite')!;
  const gauche = r.renversement.find((x) => x.pivot === 'gauche')!;

  it('arete droite : 49,5 destabilisant contre 32,4 stabilisant', () => {
    expect(droite.M_dst_d).toBeCloseTo(49.5, 12);
    expect(droite.M_stb_d).toBeCloseTo(32.4, 12);
    expect(droite.taux).toBeCloseTo(49.5 / 32.4, 12);
    const p = droite.lignes.find((l) => l.elementaire.origine.startsWith('poussee'))!;
    expect([p.dx, p.dz, p.M, p.role, p.gamma]).toEqual([-1, 1, -45, 'destabilisant', 1.1]);
  });

  it('arete gauche : tout est stabilisant', () => {
    expect(gauche.M_dst_d).toBe(0);
    expect(gauche.taux).toBe(0);
  });

  it('glissement vers +x : 60,75 contre 36', () => {
    expect(r.glissement.sens).toBe(1);
    expect(r.glissement.H_d).toBeCloseTo(60.75, 12);
    expect(r.glissement.R_d).toBeCloseTo(36, 12);
  });

  it('resultante hors de la base, verdict non conforme', () => {
    expect(r.excentricite?.xR).toBeCloseTo(1.125, 12);
    expect(r.excentricite?.dansLaBase).toBe(false);
    expect(r.verdict).toBe('non-conforme');
  });
});

describe('actions variables et autres verifications', () => {
  it('une charge variable stabilisante est comptee a 0', () => {
    const q: Charge = { type: 'ponctuelle', id: 'Q', nature: 'Q', x: 0.5, z: 3, Fx: 0, Fz: 10 };
    const r = verifierEquilibre(mur([poussee, q]), P);
    const l = r.renversement[1].lignes.find((x) => x.elementaire.origine === 'Q')!;
    expect([l.role, l.gamma, l.Md]).toEqual(['stabilisant', 0, 0]);
  });

  it('une charge variable destabilisante est majoree de 1,5', () => {
    const q: Charge = { type: 'ponctuelle', id: 'Q', nature: 'Q', x: 0, z: 3, Fx: 10, Fz: 0 };
    const r = verifierEquilibre(mur([q]), P);
    // Autour de l'arete droite : M = -(3) × 10 = -30 ; × 1,5 = 45.
    expect(r.renversement[1].M_dst_d).toBeCloseTo(45, 12);
  });

  it('soulevement : action montante a 1,0 contre poids a 0,9', () => {
    const up: Charge = { type: 'ponctuelle', id: 'U', nature: 'G', x: 0.5, z: 0, Fx: 0, Fz: -50 };
    const r = verifierEquilibre(mur([up]), P);
    expect(r.soulevement.V_dst_d).toBeCloseTo(50, 12);
    expect(r.soulevement.V_stb_d).toBeCloseTo(0.9 * 72, 12);
  });

  it('sans action laterale : resultante au milieu, dans le noyau central', () => {
    const r = verifierEquilibre(mur([]), P);
    expect(r.excentricite?.e).toBeCloseTo(0, 12);
    expect(r.excentricite?.noyauCentral).toBe(true);
    expect(r.verdict).toBe('conforme');
  });

  it('refuse une base inversee et un profil sans source', () => {
    expect(() => verifierEquilibre({ ...mur(), base: { xg: 1, xd: 0, z: 0 } }, P)).toThrow(/x_d > x_g/);
    const p = profilRecommande();
    p.equ.gG_dst = { valeur: 1.1, source: '' };
    expect(() => verifierEquilibre(mur(), p)).toThrow(/source/);
  });
});
