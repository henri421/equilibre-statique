/**
 * Tests d'acceptation du lot 8.7 : la note de calcul passe sur la note
 * commune d'aedificium-ui (cartouche, sections dans l'ordre fixe, schema dans
 * la geometrie, conclusions sans verdict global).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { noteDeCalculHtml, texteVisible, type ElementNote } from 'aedificium-ui';
import { profilRecommande, verifierEquilibre, type DonneesEquilibre } from '../../src/index';
import { EXEMPLES, lireSaisie, saisieParDefaut } from '../../app/src/modele';
import { schema } from '../../app/src/dessin';
import { lignesCsv } from '../../app/src/vue';
import { HYPOTHESES, noteDuCalcul } from '../../app/src/note';
import { STYLES_TRACE } from '../../app/src/export';

const P = profilRecommande();
const lire = (chemin: string): string => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');
const CARTOUCHE = { projet: 'Quai', element: 'Mur M1', date: '2026-10-28' };

function donnees(s = saisieParDefaut()): DonneesEquilibre {
  const l = lireSaisie(s);
  if (!l.ok) throw new Error(l.message);
  return l.donnees;
}

const D = donnees();
const R = verifierEquilibre(D, P);
const note = noteDuCalcul(P, D, CARTOUCHE);
const html = noteDeCalculHtml(note, STYLES_TRACE);
const tableaux = (els: ElementNote[] | undefined) => (els ?? []).flatMap((e) => (e.type === 'tableau' ? [e] : []));
const textes = (els: ElementNote[] | undefined) => (els ?? []).flatMap((e) => (e.type === 'texte' ? [e.texte] : []));

describe('cartouche', () => {
  it('projet, element, date, norme et outil', () => {
    expect(note.cartouche).toEqual({ ...CARTOUCHE, norme: 'EN 1990:2002, EN 1997-1:2004', outil: 'équilibre-statique' });
  });

  it('element vide : Équilibre statique', () => {
    expect(noteDuCalcul(P, D, { ...CARTOUCHE, element: ' ' }).cartouche.element).toBe('Équilibre statique');
  });

  it('le texte du cartouche est echappe', () => {
    const h = noteDeCalculHtml(noteDuCalcul(P, D, { ...CARTOUCHE, projet: 'Quai <x>' }), STYLES_TRACE);
    expect(h).toContain('Quai &lt;x&gt;');
    expect(h).not.toContain('Quai <x>');
  });
});

describe('sections', () => {
  it('ordre fixe, sans materiaux ni combinaisons', () => {
    const titres = [...html.matchAll(/<h2>([^<]*)<\/h2>/g)].map((x) => x[1]);
    expect(titres).toEqual(['1. Géométrie', '2. Hypothèses', '3. Cas de charges', '4. Calculs et vérifications', '5. Conclusions']);
  });

  it('geometrie : segments, base, puis le schema du calcul', () => {
    const g = note.sections.geometrie ?? [];
    const t = tableaux(g);
    expect(t.map((x) => x.titre)).toEqual(['Segments']);
    expect(t[0].lignes.map((l) => l[0])).toEqual(D.segments.map((s) => s.id));
    expect(textes(g)[0]).toContain('Base de x = ');
    const fig = g.flatMap((e) => (e.type === 'figure' ? [e] : []));
    expect(fig).toHaveLength(1);
    expect(fig[0].svg).toBe(schema(D, R));
  });

  it('hypotheses : profil, coefficients partiels, frottement, liste', () => {
    const h = note.sections.hypotheses ?? [];
    expect(textes(h).some((x) => x.includes(P.nom) && x.includes(P.date))).toBe(true);
    expect(textes(h).some((x) => x.includes('mu_d ='))).toBe(true);
    const t = tableaux(h);
    expect(t[0].entetes).toEqual(['Vérification', 'G dst', 'G stb', 'Q dst', 'Q stb', 'Source']);
    expect(t[0].lignes.map((l) => l.slice(0, 4))).toEqual([
      ['Renversement (EQU)', '1,1', '0,9', '1,5'],
      ['Glissement', '1,35', '1', '1,5'],
      ['Soulèvement (UPL)', '1', '0,9', '1,5'],
    ]);
    expect(h.flatMap((e) => (e.type === 'liste' ? [e.items] : []))).toEqual([HYPOTHESES]);
  });

  it('cas de charges : une ligne par charge saisie', () => {
    const t = tableaux(note.sections.charges);
    expect(t).toHaveLength(1);
    expect(t[0].entetes).toEqual(['Id', 'G/Q', 'Description']);
    expect(t[0].lignes.map((l) => l.slice(0, 2))).toEqual(D.charges.map((c) => [c.id, c.nature]));
  });
});

describe('calculs', () => {
  const t = tableaux(note.sections.calculs);

  it('synthese, puis un tableau de moments par arete', () => {
    expect(t.map((x) => (x.titre ?? '').split(' (')[0])).toEqual(['Synthèse des vérifications', ...R.renversement.map((x) => `Renversement autour de l'arête ${x.pivot}`)]);
  });

  it('memes deplacements, resistances et taux que le CSV', () => {
    const csv = lignesCsv(R).slice(1, 2 + R.renversement.length + 1);
    const synthese = t[0].lignes;
    expect(synthese).toHaveLength(csv.length);
    for (let i = 0; i < csv.length; i++) {
      expect(synthese[i][2].startsWith(csv[i][1])).toBe(true);
      expect(synthese[i][3].startsWith(csv[i][2])).toBe(true);
      expect(synthese[i][4]).toBe(csv[i][3]);
    }
  });

  it('moments : une ligne par action elementaire, la somme en pied', () => {
    for (let k = 0; k < R.renversement.length; k++) {
      const x = R.renversement[k];
      const m = t[1 + k];
      expect(m.entetes).toEqual(['Charge', 'G/Q', 'F (kN)', 'Distance d (m)', 'gamma_f', 'M stabilisant (kN.m)', 'M déstabilisant (kN.m)']);
      expect(m.lignes).toHaveLength(x.lignes.length + 1);
      expect(m.lignes[m.lignes.length - 1][0]).toBe('Somme');
    }
  });

  it('position de la resultante, sans le motif global', () => {
    const tx = textes(note.sections.calculs);
    expect(tx.some((x) => x.startsWith('Résultante caractéristique') || x.startsWith('Aucun effort normal'))).toBe(true);
    expect(texteVisible(html)).not.toContain('Équilibre assuré');
    expect(texteVisible(html)).not.toContain('Équilibre non assuré');
  });

  it('calcul impossible : leve, comme le noyau', () => {
    const d = { ...D, profondeur: 0 };
    expect(() => noteDuCalcul(P, d, CARTOUCHE)).toThrow();
  });
});

describe('conclusions', () => {
  it('une verification par arete, le glissement et le soulevement', () => {
    const v = note.verifications;
    expect(v.map((x) => x.nom)).toEqual([...R.renversement.map((x) => `Renversement autour de l'arête ${x.pivot}`), `Glissement vers ${R.glissement.sens > 0 ? '+x' : '-x'}`, 'Soulèvement']);
    expect(v.map((x) => x.clause)).toEqual([...R.renversement.map(() => 'EN 1990, tableau A1.2(A)'), 'EN 1990, tableau A1.2(B)', 'EN 1997-1, tableau A.15']);
    expect(v.map((x) => x.taux)).toEqual([...R.renversement.map((x) => x.taux), R.glissement.taux, R.soulevement.taux]);
    for (const x of v) expect(x.ok).toBe((x.taux as number) <= 1);
  });

  it('chaque exemple : verification determinante, aucun verdict global', () => {
    for (const ex of Object.values(EXEMPLES)) {
      const t = texteVisible(noteDeCalculHtml(noteDuCalcul(P, donnees(ex.saisie), CARTOUCHE), STYLES_TRACE));
      expect(t).toContain('Vérification déterminante');
      expect(t).not.toContain('Conforme');
      expect(t).not.toContain('Équilibre assuré');
    }
  });
});

describe('cablage', () => {
  const main = lire('../../app/src/main.ts');
  const page = lire('../../app/index.html');
  const sorties = page.slice(page.indexOf('id="sorties"'), page.indexOf('</section>', page.indexOf('id="sorties"')));

  it('la note passe par noteDuCalcul et la note commune', () => {
    expect(main).toContain('noteDuCalcul(');
    expect(main).toMatch(/import \{[^}]*\bnoteDeCalculHtml\b[^}]*\} from 'aedificium-ui'/);
    expect(main).not.toMatch(/import \{[^}]*\bnoteDeCalculHtml\b[^}]*\} from '\.\/export'/);
  });

  it('champs projet et element dans les sorties, memorises', () => {
    expect(sorties).toContain('data-role="projet"');
    expect(sorties).toContain('data-role="element"');
    expect(main).toContain("'equilibre-statique:cartouche'");
  });

  it('l ancienne note locale a disparu', () => {
    const exp = lire('../../app/src/export.ts');
    expect(exp).not.toContain('function noteDeCalculHtml');
    expect(exp).not.toContain('HYPOTHESES');
    expect(exp).toContain('export const STYLES_TRACE');
    expect(exp).toContain('export function resultatEnCsv');
  });
});
