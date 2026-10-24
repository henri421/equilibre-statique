/**
 * Tests d'acceptation de l'etape 8.2 (finitions) : notations, arrondis,
 * accents, titre, phrases types, sur le texte VISIBLE (ecran, schema, note,
 * CSV, page). Le controle lui-meme vit dans aedificium-ui (`constatsAffichage`).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NOMS_GRECS, constatsAffichage, contenuBalise, texteVisible } from 'aedificium-ui';
import { profilRecommande, verifierEquilibre } from '../../src/index';
import { EXEMPLES, lireSaisie, saisieParDefaut } from '../../app/src/modele';
import { rendreResultat, tableauEntrees, tableauProfil } from '../../app/src/vue';
import { schema } from '../../app/src/dessin';
import { resultatEnCsv, noteDeCalculHtml } from '../../app/src/export';

const P = profilRecommande();
const TITRE = 'Équilibre statique';
const lire = (chemin: string): string => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');
const controler = (nom: string, html: string): string[] => constatsAffichage(texteVisible(html)).map((c) => `${nom} : ${c}`);

function sorties() {
  const ecran: string[] = [tableauProfil(P)];
  const notes: string[] = [];
  const csv: string[] = [];
  for (const [nom, ex] of Object.entries(EXEMPLES)) {
    const l = lireSaisie(ex.saisie);
    if (!l.ok) throw new Error(`${nom} : ${l.message}`);
    const r = verifierEquilibre(l.donnees, P);
    const svg = schema(l.donnees, r);
    ecran.push(ex.libelle, schema(l.donnees, null), svg, rendreResultat(r), tableauEntrees(l.donnees));
    notes.push(noteDeCalculHtml(r, P, svg, tableauEntrees(l.donnees), '2026-10-24'));
    csv.push(resultatEnCsv(r));
  }
  return { ecran, notes, csv };
}

describe('texte visible : notations, arrondis, accents, phrases types', () => {
  const s = sorties();

  it('ecran et schemas', () => {
    expect(s.ecran.flatMap((h, i) => controler(`ecran ${i}`, h))).toEqual([]);
  });

  it('note de calcul', () => {
    expect(s.notes.flatMap((h, i) => controler(`note ${i}`, h))).toEqual([]);
  });

  it('page (index.html)', () => {
    expect(controler('page', lire('../../app/index.html'))).toEqual([]);
  });

  it('messages d erreur affiches', () => {
    const saisie = saisieParDefaut();
    saisie.segments[0].e = 'abc';
    const l = lireSaisie(saisie);
    expect(l.ok).toBe(false);
    if (!l.ok) expect(constatsAffichage(texteVisible(l.message))).toEqual([]);
  });

  it('CSV : texte brut, ni « _ » ni nom de lettre grecque ni balise', () => {
    for (const c of s.csv) {
      expect(c).not.toContain('_');
      expect(c).not.toMatch(NOMS_GRECS);
      expect(c).not.toContain('<');
    }
  });
});

describe('titre', () => {
  const page = lire('../../app/index.html');

  it('titre de la page sans tiret, majuscule initiale', () => {
    expect(contenuBalise(page, 'h1')).toBe(TITRE);
    expect(contenuBalise(page, 'title')?.startsWith(TITRE)).toBe(true);
  });

  it('titre en grand', () => {
    const regle = /(^|\n)h1\s*\{([^}]*)\}/.exec(lire('../../app/src/style.css'))?.[2] ?? '';
    expect(regle).toMatch(/font-size:\s*1\.75rem/);
    expect(regle).toMatch(/font-weight:\s*600/);
  });
});
