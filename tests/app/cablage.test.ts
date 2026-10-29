/**
 * Tests d'acceptation de T4 (lot 8.6) : la page (app/index.html), sa feuille
 * de style et son cablage (app/src/main.ts). Controles statiques du source :
 * le comportement se verifie dans la page.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { constatsAffichage, texteVisible } from 'aedificium-ui';

const lire = (c: string): string => readFileSync(fileURLToPath(new URL(c, import.meta.url)), 'utf8');
const page = lire('../../app/index.html');
const main = lire('../../app/src/main.ts');
const style = lire('../../app/src/style.css');
const section = (id: string) => {
  const i = page.indexOf(`<section id="${id}"`);
  return i < 0 ? '' : page.slice(i, page.indexOf('</section>', i));
};

describe('page', () => {
  it('trois colonnes : saisie, dessin, verdicts', () => {
    for (const id of ['saisie', 'dessin', 'verdicts']) expect(page, id).toContain(`<section id="${id}"`);
    for (const r of ['exemple', 'ouvrir', 'segments', 'charges', 'element-choisi', 'erreur']) expect(section('saisie'), r).toContain(`data-role="${r}"`);
    for (const f of ['xg', 'xd', 'zb', 'mu', 'profondeur']) expect(section('saisie'), f).toContain(`data-fixe="${f}"`);
    for (const r of ['outils', 'zone', 'geste', 'statut', 'volets']) expect(section('dessin'), r).toContain(`data-role="${r}"`);
    for (const r of ['liste-verdicts', 'projet', 'element']) expect(section('verdicts'), r).toContain(`data-role="${r}"`);
  });

  it('outils, annuler, options, zone', () => {
    const d = section('dessin');
    for (const o of ['selection', 'segment', 'ponctuelle', 'lineaire', 'moment', 'base', 'supprimer']) expect(d, o).toContain(`data-outil="${o}"`);
    for (const a of ['annuler', 'retablir']) expect(d, a).toContain(`data-action="${a}"`);
    for (const o of ['grille', 'cotes', 'resultante']) expect(d, o).toContain(`data-option="${o}"`);
    expect(d).toMatch(/<svg[^>]*data-role="zone"[^>]*viewBox="0 0 640 520"|<svg[^>]*viewBox="0 0 640 520"[^>]*data-role="zone"/);
  });

  it('sorties et boutons de saisie gardes', () => {
    for (const a of ['exporter-schema', 'exporter-csv', 'exporter-note']) expect(section('verdicts'), a).toContain(`data-action="${a}"`);
    for (const a of ['enregistrer', 'ajouter-segment', 'ajouter-ponctuelle', 'ajouter-lineaire', 'ajouter-moment']) expect(section('saisie'), a).toContain(`data-action="${a}"`);
    expect(page).toContain('<section id="sorties"');
  });

  it('textes visibles accentues', () => {
    expect(constatsAffichage(texteVisible(page))).toEqual([]);
  });

  it('style : trois colonnes, une seule sur ecran etroit', () => {
    expect(style).toMatch(/grid-template-columns:\s*[^;\s]+\s+minmax\(0, 1fr\)\s+[^;\s]+;/);
    expect(style).toMatch(/@media \(max-width:[^)]*\)\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/);
    expect(style).not.toMatch(/prefers-color-scheme:\s*dark/);
  });
});

describe('cablage', () => {
  it('passe par l editeur commun et les modules purs', () => {
    for (const f of [
      'brancherEditeur(',
      'historique(',
      'pousser(',
      'annuler(',
      'retablir(',
      'appliquer(',
      'abandonner(',
      'grapheDeSaisie(',
      'selectionDeChoix(',
      'outilEditeur(',
      'modifierChamp(',
      'vueDeSaisie(',
      'dessinSaisie(',
      'verdictsHtml(',
      'rendreResultat(',
      'tableSegmentsHtml(',
      'chargesHtml(',
      'elementChoisiHtml(',
      'definirEtat(',
    ]) {
      expect(main, f).toContain(f);
    }
  });

  it('sorties, fichiers et memoire gardes', () => {
    for (const f of ['noteDuCalcul(', 'noteDeCalculHtml(', 'svgAutonome(', 'resultatEnCsv(', 'serialiser(', 'relire(', 'ouvrirOuTelecharger(', 'telecharger(', 'localStorage']) {
      expect(main, f).toContain(f);
    }
    expect(main).toContain('STYLES_TRACE');
    expect(main).toMatch(/import\('\.\/pwa'\)/);
  });

  it('la saisie n est plus modifiee en place', () => {
    expect(main).not.toMatch(/\bsaisie\.(segments|charges)(\[[^\]]+\])?(\.\w+)?\s*=[^=]|\bsaisie\.(segments|charges)\.(push|splice)\(/);
    expect(main).not.toContain('rendreSegments');
    expect(main).not.toContain('rendreCharges');
  });
});
