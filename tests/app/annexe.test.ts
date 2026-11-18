/**
 * Tests d'acceptation du lot E (audit R4) : annexe nationale luxembourgeoise,
 * coefficients modifiables, annexe enregistree et relue, note qui montre l'annexe.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { avertissementAnnexeLu, definirLangue, noteDeCalculHtml, texteVisible } from 'aedificium-ui';
import { profilRecommande, verifierEquilibre } from '../../src/index';
import { COEFS, coefsDeLAnnexe, profilDeCalcul, profilDeLAnnexe, profilLu, valeursDeLAnnexe, type ValeursCoefs } from '../../app/src/annexe';
import { lireSaisie, relire, saisieParDefaut, serialiser, type Saisie } from '../../app/src/modele';
import { noteDuCalcul, tableauAnnexe } from '../../app/src/note';
import { STYLES_TRACE } from '../../app/src/export';
import { phrase } from '../../app/src/textes';

const lire = (chemin: string): string => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');
const CARTOUCHE = { projet: 'P', element: 'E', date: '2026-11-18' };

afterEach(() => definirLangue('fr'));

/** Saisie par defaut passee a l'annexe luxembourgeoise, coefficients pris de l'annexe. */
function saisieLu(): Saisie {
  return { ...saisieParDefaut(), annexe: 'lu', coefs: coefsDeLAnnexe('lu') };
}

describe('profil luxembourgeois', () => {
  it('chaque valeur sourcee passe par valeurLu : sources ILNAS, valeurs presumees egales aux recommandees', () => {
    const lu = profilLu();
    const rec = profilRecommande();
    expect(lu.nom).toMatch(/Luxembourg/);
    expect(lu.nom).toMatch(/ILNAS-EN 1990\/AN-LU:2020/);
    expect(lu.equ.gG_dst.valeur).toBe(1.1);
    expect(lu.equ.gG_dst.source).toBe('ILNAS-EN 1990/AN-LU:2020, tableau A1.2(A) : valeur recommandée présumée retenue, non vérifiée sur l’annexe');
    expect(lu.glissement.gG_dst.valeur).toBe(1.35);
    expect(lu.glissement.gG_dst.source).toMatch(/^ILNAS-EN 1990\/AN-LU:2020, tableau A1\.2\(B\) : valeur recommandée présumée retenue/);
    expect(lu.upl.gG_dst.valeur).toBe(1);
    expect(lu.upl.gG_dst.source).toMatch(/^ILNAS-EN 1997-1\/AN-LU:2020, tableau A\.15 :/);
    expect(lu.equ.gQ_stb.valeur).toBe(0);
    expect(lu.equ.gQ_stb.source).toMatch(/tableau A1\.2\(A\) \(action variable favorable : 0\) : valeur recommandée présumée retenue/);
    for (const g of ['equ', 'glissement', 'upl'] as const) {
      for (const c of ['gG_dst', 'gG_stb', 'gQ_dst', 'gQ_stb'] as const) expect(lu[g][c].valeur).toBe(rec[g][c].valeur);
    }
  });

  it('une valeur changee par l utilisateur est marquee imposee, les autres gardent leur source ILNAS', () => {
    const valeurs = { ...valeursDeLAnnexe('lu'), 'equ.gG_dst': 1.2 } as ValeursCoefs;
    const p = profilDeCalcul('lu', valeurs);
    expect(p.equ.gG_dst.valeur).toBe(1.2);
    expect(p.equ.gG_dst.source).toMatch(/valeur imposée par l’utilisateur/);
    expect(p.equ.gG_dst.source).toContain('valeur recommandée présumée retenue');
    expect(p.equ.gG_stb).toEqual(profilLu().equ.gG_stb);
    expect(p.upl.gQ_dst).toEqual(profilLu().upl.gQ_dst);
  });

  it('en anglais, la source luxembourgeoise et le nom du profil ne gardent aucun mot francais', () => {
    definirLangue('en');
    const source = phrase(profilLu().equ.gQ_stb.source);
    expect(source).toBe('ILNAS-EN 1990/AN-LU:2020, Table A1.2(A) (favourable variable action: 0): recommended value presumed retained, not checked against the annex');
    expect(phrase(profilLu().nom)).toBe('Luxembourg, ILNAS-EN 1990/AN-LU:2020 and ILNAS-EN 1997-1/AN-LU:2020: presumed values, to be checked');
  });
});

describe('saisie', () => {
  it('par defaut : valeurs recommandees, champs prerempli en francais', () => {
    const s = saisieParDefaut();
    expect(s.annexe).toBe('recommande');
    expect(s.coefs['equ.gG_dst']).toBe('1,1');
    expect(s.coefs['glissement.gG_dst']).toBe('1,35');
    expect(s.coefs['equ.gQ_stb']).toBe('0');
  });

  it('annexe et coefficients enregistres puis relus a l identique', () => {
    const s = saisieLu();
    s.coefs['equ.gG_dst'] = '1,2';
    const relu = relire(serialiser(s));
    expect(relu.annexe).toBe('lu');
    expect(relu.coefs['equ.gG_dst']).toBe('1,2');
    expect(relu).toEqual(s);
  });

  it('un ancien fichier, sans annexe ni coefficients, se relit avec les valeurs recommandees', () => {
    const ancien = JSON.stringify({ format: 'equilibre-statique/1', ...withoutAnnexe(saisieParDefaut()) });
    const relu = relire(ancien);
    expect(relu.annexe).toBe('recommande');
    expect(relu.coefs).toEqual(coefsDeLAnnexe('recommande'));
    const l = lireSaisie(relu);
    expect(l.ok && l.profil).toEqual(profilRecommande());
  });

  it('une valeur saisie par l utilisateur modifie le calcul et se marque imposee', () => {
    const s = saisieParDefaut();
    s.coefs['equ.gG_dst'] = '1,2';
    const l = lireSaisie(s);
    if (!l.ok) throw new Error(l.message);
    expect(l.profil.equ.gG_dst.valeur).toBe(1.2);
    expect(l.profil.equ.gG_dst.source).toMatch(/imposée/);
    const base = verifierEquilibre(l.donnees, profilRecommande());
    const change = verifierEquilibre(l.donnees, l.profil);
    const moments = (r: typeof base) => r.renversement.reduce((somme, x) => somme + x.M_dst_d, 0);
    expect(moments(change)).toBeGreaterThan(moments(base));
  });

  it('une valeur de coefficient illisible est signalee nommement', () => {
    const s = saisieParDefaut();
    s.coefs['upl.gQ_dst'] = 'abc';
    const l = lireSaisie(s);
    expect(l.ok).toBe(false);
    if (!l.ok) expect(l.message).toMatch(/γ|gamma_Q,dst.*nombre attendu/);
  });

  it('les douze coefficients figurent dans la saisie', () => {
    expect(COEFS).toHaveLength(12);
    expect(Object.keys(saisieParDefaut().coefs).sort()).toEqual([...COEFS].sort());
  });
});

describe('note', () => {
  it('annexe retenue, norme AN-LU, avertissement en tete, coefficients et sources visibles', () => {
    const s = saisieLu();
    const l = lireSaisie(s);
    if (!l.ok) throw new Error(l.message);
    const note = noteDuCalcul(l.profil, l.donnees, CARTOUCHE, 'lu');
    expect(note.avertissements?.[0]).toMatch(/^Annexe nationale luxembourgeoise/);
    expect(note.cartouche.norme).toContain('ILNAS-EN 1990/AN-LU:2020');
    expect(note.cartouche.norme).toContain('ILNAS-EN 1997-1/AN-LU:2020');
    const texte = texteVisible(noteDeCalculHtml(note, STYLES_TRACE));
    expect(texte).toContain('Luxembourg');
    expect(texte).toContain('ILNAS-EN 1990/AN-LU:2020, tableau A1.2(A)');
    expect(texte).toContain('valeur recommandée présumée retenue');
    expect(texte).toContain('γG,dst');
  });

  it('une valeur imposee apparait dans la note', () => {
    const s = saisieLu();
    s.coefs['equ.gG_dst'] = '1,2';
    const l = lireSaisie(s);
    if (!l.ok) throw new Error(l.message);
    const texte = texteVisible(noteDeCalculHtml(noteDuCalcul(l.profil, l.donnees, CARTOUCHE, 'lu'), STYLES_TRACE));
    expect(texte).toContain('valeur imposée par l’utilisateur');
  });

  it('valeurs recommandees inchangees : ni avertissement, ni norme AN-LU, profil recommande', () => {
    const l = lireSaisie(saisieParDefaut());
    if (!l.ok) throw new Error(l.message);
    const note = noteDuCalcul(profilRecommande(), l.donnees, CARTOUCHE);
    expect(note.avertissements).toEqual([]);
    expect(note.cartouche.norme).toBe('EN 1990:2002, EN 1997-1:2004');
    expect(profilDeLAnnexe('recommande')).toEqual(profilRecommande());
    const tableau = tableauAnnexe(profilRecommande(), 'recommande');
    expect(tableau.type === 'tableau' && tableau.lignes).toHaveLength(12);
    expect(texteVisible(noteDeCalculHtml(note, STYLES_TRACE))).not.toContain('Luxembourg');
  });

  it('avertissement luxembourgeois a l ecran tant que l annexe n est pas verifiee', () => {
    expect(avertissementAnnexeLu()).toMatch(/^Annexe nationale luxembourgeoise/);
  });
});

describe('page', () => {
  const fr = lire('../../app/index.html');
  const en = lire('../../app/en/index.html');

  it('selecteur d annexe, bandeau cache, un champ par coefficient, sur les deux pages', () => {
    for (const page of [fr, en]) {
      expect(page).toContain('data-role="annexe"');
      expect(page).toMatch(/<p class="avertissement" data-role="bandeau-annexe" hidden>/);
      for (const c of COEFS) expect(page, c).toContain(`data-coef="${c}"`);
    }
  });
});

/** Le fichier d'avant le lot E : sans annexe ni coefficients. */
function withoutAnnexe(s: Saisie): Omit<Saisie, 'annexe' | 'coefs'> {
  const { annexe: _a, coefs: _c, ...reste } = s;
  return reste;
}
