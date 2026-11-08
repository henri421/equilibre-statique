// Lot 9.5 : barre des feuilles de calcul (projets de la suite).
// Tests d'acceptation ecrits par Claude : ne pas les modifier.
// Consigne : plan-webaedificium/lot-9.5-feuilles.md.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { relire, saisieParDefaut, serialiser } from '../../app/src/modele';

const APP = 'equilibre-statique';
const lire = (f: string): string => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');

describe('feuilles de calcul (etape 9.5)', () => {
  it('saisie -> JSON de feuille -> saisie : identique', () => {
    const s = saisieParDefaut();
    const feuille = JSON.parse(serialiser(s));
    expect(relire(JSON.stringify(feuille))).toEqual(s);
  });

  it('depend d aedificium-ui v1.6 (brancherFeuilles)', () => {
    expect(lire('package.json')).toContain('github:henri421/aedificium-ui#v1.6.');
  });

  it('les pages francaise et anglaise ont la zone de la barre, sous l en-tete', () => {
    for (const page of ['app/index.html', 'app/en/index.html']) {
      const html = lire(page);
      const zone = html.indexOf('data-role="feuilles"');
      expect(zone, page).toBeGreaterThan(html.indexOf('</header>'));
      expect(zone, page).toBeLessThan(html.indexOf('<main'));
    }
  });

  it('main.ts branche la barre avec l identifiant de l app', () => {
    const m = lire('app/src/main.ts');
    expect(m).toMatch(/brancherFeuilles\(\{/);
    expect(m).toContain(`app: '${APP}'`);
    expect(m).toMatch(/lire: \(\) => JSON\.parse\(serialiser\(/);
    expect(m).toMatch(/charger: \(d\) =>/);
  });

  it('dans un projet, la saisie va dans la feuille, pas dans la memoire hors projet', () => {
    const m = lire('app/src/main.ts');
    expect(m).toMatch(/let barre: BarreFeuilles \| null = null;/);
    expect(m).toMatch(/if \(barre\?\.dansUnProjet\(\)\) barre\.signaler\(\);\s*else memoriser\(\);/);
  });

  it('la barre est alignee sur la page', () => {
    expect(lire('app/src/style.css')).toMatch(/\.feuilles\s*\{/);
  });
});
