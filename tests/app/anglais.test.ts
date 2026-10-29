/**
 * Version anglaise (lot 8.8) : page `en/index.html` de meme squelette que la
 * page francaise, et AUCUN reste de francais dans ce qui s'affiche en anglais
 * (ecran, formulaires, schema, note, CSV, messages). Le francais, lui, est
 * couvert par `finitions.test.ts`, inchange.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { constatsAffichage, contenuBalise, definirLangue, noteDeCalculHtml, notationHtml, texteVisible } from 'aedificium-ui';
import { profilRecommande, verifierEquilibre, type DonneesEquilibre } from '../../src/index';
import { EXEMPLES, charge, exemple, lireSaisie, relire, saisieParDefaut, type Saisie } from '../../app/src/modele';
import { messageDErreur, rendreResultat, tableauEntrees, tableauProfil, verdictsHtml } from '../../app/src/vue';
import { schema } from '../../app/src/dessin';
import { STYLES_TRACE, resultatEnCsv } from '../../app/src/export';
import { noteDuCalcul } from '../../app/src/note';
import { chargesHtml, elementChoisiHtml, tableSegmentsHtml } from '../../app/src/form';
import { texteNombre } from '../../app/src/edition';
import { textes } from '../../app/src/textes';

const P = profilRecommande();
const lire = (chemin: string): string => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');
const controler = (nom: string, html: string): string[] => constatsAffichage(texteVisible(html), { langue: 'en' }).map((c) => `${nom} : ${c}`);
/** CSV : la virgule y est le separateur, pas une virgule decimale. */
const controlerCsv = (nom: string, csv: string): string[] =>
  constatsAffichage(csv, { langue: 'en' })
    .filter((c) => !c.startsWith('virgule decimale'))
    .map((c) => `${nom} : ${c}`);

/** Squelette d'une page : les attributs que lit le script, dans l'ordre. */
function squelette(html: string): string[] {
  return [...html.matchAll(/\s(id|data-[a-z-]+|type|inputmode|accept|value)="([^"]*)"/g)].map((m) => `${m[1]}=${m[2]}`);
}

/** Les exemples, plus des cas qui passent par les autres phrases. */
function saisies(): Saisie[] {
  const liste = Object.keys(EXEMPLES).map((k) => (exemple(k) as { saisie: Saisie }).saisie);
  // Charges ponctuelle et moment, arete gauche determinante.
  const s = saisieParDefaut();
  s.charges.push(charge({ type: 'ponctuelle', id: 'P1', nature: 'Q', x: '1', z: '3', Fx: '-40', Fz: '10' }));
  s.charges.push(charge({ type: 'moment', id: 'M1', M: '5' }));
  s.charges.push(charge({ type: 'lineaire', id: 'q1', xa: '0', za: '3', xb: '1', zb: '3', qa: '5', qb: '0', direction: 'verticale' }));
  liste.push(s);
  // Resultante hors de la base : l'element bascule.
  const b = saisieParDefaut();
  b.charges[0].qa = '200';
  liste.push(b);
  // Resultante hors du noyau central, dans la base.
  const n = saisieParDefaut();
  n.charges[0].qa = '15';
  liste.push(n);
  return liste;
}

function erreur(f: () => unknown): string {
  try {
    f();
  } catch (e) {
    return messageDErreur(e);
  }
  throw new Error('une erreur etait attendue');
}

describe('page anglaise', () => {
  const fr = lire('../../app/index.html');
  const en = lire('../../app/en/index.html');

  it('meme squelette que la page francaise', () => {
    expect(squelette(en)).toEqual(squelette(fr));
  });

  it('langue, script commun, liens entre les deux versions', () => {
    expect(en).toContain('<html lang="en">');
    expect(en).toContain('src="../src/main.ts"');
    expect(en).toMatch(/class="barre-langue" href="\.\.\/"/);
    expect(fr).toMatch(/class="barre-langue" href="en\/"/);
  });

  it('titre anglais, aucun reste de francais', () => {
    expect(contenuBalise(en, 'h1')).toBe('Static equilibrium');
    expect(controler('page', en.replace(/lang="fr"[^>]*>FR</, '>'))).toEqual([]);
  });
});

describe('affichage en anglais', () => {
  beforeEach(() => definirLangue('en'));
  afterEach(() => definirLangue('fr'));

  it('ecran, schema, note et CSV', () => {
    const constats: string[] = [...controler('profil', tableauProfil(P))];
    constats.push(...controler('hypotheses', textes().note.hypotheses.map((h) => `<li>${notationHtml(h)}</li>`).join('')));
    saisies().forEach((s, i) => {
      const l = lireSaisie(s);
      if (!l.ok) throw new Error(l.message);
      const r = verifierEquilibre(l.donnees, P);
      constats.push(...controler(`cas ${i} ecran`, rendreResultat(r) + verdictsHtml(r) + tableauEntrees(l.donnees)));
      constats.push(...controler(`cas ${i} schema`, schema(l.donnees, null) + schema(l.donnees, r)));
      constats.push(...controler(`cas ${i} note`, noteDeCalculHtml(noteDuCalcul(P, l.donnees, { projet: 'Quay', element: '', date: '2026-10-29' }), STYLES_TRACE)));
      constats.push(...controlerCsv(`cas ${i} csv`, resultatEnCsv(r)));
    });
    expect(constats).toEqual([]);
  });

  it('aucun effort normal sur la base : phrase sans objet', () => {
    const d: DonneesEquilibre = {
      segments: [],
      charges: [{ type: 'ponctuelle', id: 'H', nature: 'G', x: 0.5, z: 1, Fx: 10, Fz: 0 }],
      base: { xg: 0, xd: 1, z: 0 },
      mu: 0.5,
      profondeur: 1,
    };
    const r = verifierEquilibre(d, P);
    expect(controler('sans N', rendreResultat(r) + verdictsHtml(r))).toEqual([]);
  });

  it('formulaires et element choisi', () => {
    const s = saisies()[2];
    const html = [
      tableSegmentsHtml(s, null),
      chargesHtml(s, null),
      elementChoisiHtml(s, null),
      elementChoisiHtml(s, { liste: 'base' }),
      elementChoisiHtml(s, { liste: 'segments', index: 0 }),
      ...s.charges.map((_c, i) => elementChoisiHtml(s, { liste: 'charges', index: i })),
    ].join('');
    expect(controler('formulaires', html)).toEqual([]);
  });

  it('exemples a point decimal, nombres du dessin a point', () => {
    const libelles = Object.keys(EXEMPLES).map((k) => `<p>${notationHtml((exemple(k) as { libelle: string }).libelle)}</p>`);
    expect(controler('exemples', libelles.join(''))).toEqual([]);
    expect(saisieParDefaut().mu).toBe('0.5');
    expect(texteNombre(0.25)).toBe('0.25');
  });

  it('messages et erreurs', () => {
    const d = (): DonneesEquilibre => {
      const l = lireSaisie(saisieParDefaut());
      if (!l.ok) throw new Error(l.message);
      return l.donnees;
    };
    const lecture = (() => {
      const s = saisieParDefaut();
      s.segments[0].e = 'abc';
      const l = lireSaisie(s);
      return l.ok ? '' : l.message;
    })();
    const profondeur = (() => {
      const s = saisieParDefaut();
      s.profondeur = '';
      const l = lireSaisie(s);
      return l.ok ? '' : l.message;
    })();
    const messages = [
      lecture,
      profondeur,
      erreur(() => relire('{"format":"autre"}')),
      erreur(() => verifierEquilibre({ ...d(), base: { xg: 1, xd: 0, z: 0 } }, P)),
      erreur(() => verifierEquilibre({ ...d(), mu: -1 }, P)),
      erreur(() => verifierEquilibre({ ...d(), segments: [], charges: [] }, P)),
      erreur(() => verifierEquilibre({ ...d(), segments: [{ ...d().segments[0], e: 0 }] }, P)),
      erreur(() => verifierEquilibre({ ...d(), segments: [{ ...d().segments[0], gamma: -1 }] }, P)),
      erreur(() => verifierEquilibre({ ...d(), segments: [{ ...d().segments[0], x1: Number.NaN }] }, P)),
      erreur(() => verifierEquilibre({ ...d(), segments: [{ ...d().segments[0], x2: d().segments[0].x1, z2: d().segments[0].z1 }] }, P)),
      erreur(() => verifierEquilibre({ ...d(), profondeur: 0 }, P)),
      erreur(() => verifierEquilibre({ ...d(), charges: [{ type: 'moment', id: 'M1', nature: 'G', M: Number.NaN }] }, P)),
      textes().messages.rienAExporter,
      textes().messages.nouvelleVersion,
      textes().messages.aimante('S1'),
      textes().messages.exemple,
    ];
    expect(messages.flatMap((m, i) => controler(`message ${i}`, notationHtml(m)))).toEqual([]);
  });
});
