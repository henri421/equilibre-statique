/**
 * Tests d'acceptation de T2 (lot 8.6) : tableaux synchronises avec le dessin,
 * volet « Element choisi », cartes de verdicts.
 */

import { describe, expect, it } from 'vitest';
import { constatsAffichage, notationHtml, tauxAffiche, texteVisible } from 'aedificium-ui';
import { profilRecommande, verifierEquilibre } from '../../src/index';
import { EXEMPLES, charge, lireSaisie, type Saisie } from '../../app/src/modele';
import { chargesHtml, elementChoisiHtml, tableSegmentsHtml } from '../../app/src/form';
import { texteExcentricite, verdictsHtml } from '../../app/src/vue';

const murEnL = (): Saisie => structuredClone(EXEMPLES['mur-en-l'].saisie);
const avecTout = (): Saisie => {
  const s = murEnL();
  s.charges.push(charge({ type: 'ponctuelle', id: 'F1', x: '1,46', z: '3,4', Fz: '15' }), charge({ type: 'moment', id: 'M1', x: '1', z: '1', M: '5' }));
  return s;
};

describe('tableaux', () => {
  it('segments : une ligne par segment, la choisie surlignee', () => {
    const h = tableSegmentsHtml(murEnL(), { liste: 'segments', index: 2 });
    expect(h.match(/<tr[^>]*data-choix="segments:\d+"/g)).toHaveLength(3);
    expect(h).toContain('<tr class="choisi" data-choix="segments:2">');
    expect(h.match(/class="choisi"/g)).toHaveLength(1);
    expect(h).toMatch(/<input type="text" inputmode="decimal"[^>]*data-liste="segments" data-index="0" data-champ="x1" value="0,6"/);
    expect(tableSegmentsHtml(murEnL(), null)).not.toContain('choisi');
  });

  it('charges : un bloc par charge, la choisie surlignee', () => {
    const h = chargesHtml(avecTout(), { liste: 'charges', index: 1 });
    expect(h.match(/<div class="ligne-charge[^"]*" data-choix="charges:\d+"/g)).toHaveLength(4);
    expect(h).toContain('<div class="ligne-charge choisi" data-choix="charges:1">');
    expect(h).toMatch(/data-liste="charges" data-index="2" data-champ="Fz" value="15"/);
    expect(chargesHtml(avecTout(), { liste: 'segments', index: 1 })).not.toContain('choisi');
  });
});

describe('element choisi', () => {
  it('segment : nom, e, gamma', () => {
    const h = elementChoisiHtml(murEnL(), { liste: 'segments', index: 2 });
    expect(h.startsWith('<legend>Élément choisi : terre, segment</legend>')).toBe(true);
    for (const [c, v] of [['id', 'terre'], ['e', '1,48'], ['gamma', '18']]) expect(h).toMatch(new RegExp(`data-liste="segments" data-index="2" data-champ="${c}" value="${v}"`));
    expect(h).not.toContain('data-champ="x1"');
  });

  it('charges : nature, direction pour une lineaire, champs du type', () => {
    const lin = elementChoisiHtml(avecTout(), { liste: 'charges', index: 0 });
    expect(lin.startsWith('<legend>Élément choisi : poussee, linéaire</legend>')).toBe(true);
    for (const c of ['nature', 'direction', 'xa', 'za', 'xb', 'zb', 'qa', 'qb']) expect(lin, c).toContain(`data-index="0" data-champ="${c}"`);
    const f = elementChoisiHtml(avecTout(), { liste: 'charges', index: 2 });
    expect(f.startsWith('<legend>Élément choisi : F1, ponctuelle</legend>')).toBe(true);
    for (const c of ['nature', 'x', 'z', 'Fx', 'Fz']) expect(f, c).toContain(`data-index="2" data-champ="${c}"`);
    expect(f).not.toContain('data-champ="direction"');
    const m = elementChoisiHtml(avecTout(), { liste: 'charges', index: 3 });
    expect(m.startsWith('<legend>Élément choisi : M1, moment</legend>')).toBe(true);
    for (const c of ['nature', 'M', 'x', 'z']) expect(m, c).toContain(`data-index="3" data-champ="${c}"`);
  });

  it('base, aucun choix', () => {
    const b = elementChoisiHtml(murEnL(), { liste: 'base' });
    expect(b.startsWith('<legend>Élément choisi : base</legend>')).toBe(true);
    for (const c of ['xg', 'xd', 'zb']) expect(b, c).toContain(`data-fixe="${c}"`);
    expect(elementChoisiHtml(murEnL(), null)).toBe(
      '<legend>Élément choisi</legend><p class="note">Aucun élément choisi : cliquer un élément du dessin ou une ligne de tableau.</p>',
    );
  });

  it('textes visibles accentues', () => {
    const s = avecTout();
    const tous = [tableSegmentsHtml(s, null), chargesHtml(s, null), elementChoisiHtml(s, null), elementChoisiHtml(s, { liste: 'base' })];
    for (let i = 0; i < s.charges.length; i++) tous.push(elementChoisiHtml(s, { liste: 'charges', index: i }));
    expect(tous.flatMap((h) => constatsAffichage(texteVisible(h)))).toEqual([]);
  });
});

describe('verdicts', () => {
  const P = profilRecommande();
  for (const [nom, ex] of Object.entries(EXEMPLES)) {
    it(`cartes dans l ordre, etat par le taux : ${nom}`, () => {
      const l = lireSaisie(ex.saisie);
      if (!l.ok) throw new Error(l.message);
      const r = verifierEquilibre(l.donnees, P);
      const h = verdictsHtml(r);
      expect([...h.matchAll(/data-verif="([^"]+)"/g)].map((x) => x[1])).toEqual(['renversement-gauche', 'renversement-droite', 'glissement', 'soulevement', 'resultante']);
      const etat = (t: number) => (t <= 1 ? 'ok' : 'refus');
      const g = r.renversement.find((x) => x.pivot === 'gauche')!;
      expect(h).toContain(`<div class="verdict ${etat(g.taux)}" data-verif="renversement-gauche">`);
      expect(h).toContain(`<div class="verdict ${etat(r.glissement.taux)}" data-verif="glissement">`);
      expect(h).toContain('<div class="verdict" data-verif="resultante">');
      expect(h).toContain(`<span class="taux">${tauxAffiche(g.taux)}</span>`);
      expect(h).toContain(`<span class="taux">${tauxAffiche(r.soulevement.taux)}</span>`);
      const titres = [...h.matchAll(/<h3>([^<]*)<span class="clause">([^<]*)<\/span><\/h3>/g)].map((x) => [x[1].trim(), x[2]]);
      expect(titres).toEqual([
        ['Renversement, arête gauche', 'EQU'],
        ['Renversement, arête droite', 'EQU'],
        [`Glissement vers ${r.glissement.sens > 0 ? '+x' : '−x'}`, 'STR/GEO'],
        ['Soulèvement', 'UPL'],
        ['Résultante sur la base', 'indication'],
      ]);
      expect(h).toContain(notationHtml(texteExcentricite(r)));
      expect(h).not.toMatch(/data-verif="resultante">[\s\S]*class="jauge"/);
      expect(constatsAffichage(texteVisible(h))).toEqual([]);
    });
  }
});
