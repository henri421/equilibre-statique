/**
 * Cablage de l'interface de l'equilibre statique.
 *
 * Ce module ne calcule RIEN : il tient la saisie, appelle le noyau, et confie
 * la mise en forme a `modele`, `vue`, `dessin` et `export`, purs.
 */

import { echapper, ouvrirOuTelecharger, svgAutonome, telecharger } from 'aedificium-ui';
import { profilRecommande, verifierEquilibre, type DonneesEquilibre, type ResultatEquilibre } from '../../src/index';
import { EXEMPLES, charge, lireSaisie, relire, saisieParDefaut, serialiser, type LigneCharge, type LigneSegment, type Saisie, type TypeCharge } from './modele';
import { messageDErreur, rendreResultat, tableauEntrees, tableauProfil } from './vue';
import { schema } from './dessin';
import { HYPOTHESES, STYLES_TRACE, noteDeCalculHtml, resultatEnCsv } from './export';
import './style.css';

const PROFIL = profilRecommande();
const CLE_STOCKAGE = 'equilibre-statique/saisie';

function exige<T extends Element>(selecteur: string): T {
  const e = document.querySelector<T>(selecteur);
  if (e === null) throw new Error(`Element absent de la page : ${selecteur}`);
  return e;
}

const formulaire = exige<HTMLFormElement>('#formulaire');
const zones = {
  segments: exige<HTMLElement>('[data-role="segments"]'),
  charges: exige<HTMLElement>('[data-role="charges"]'),
  erreur: exige<HTMLElement>('[data-role="erreur"]'),
  schema: exige<HTMLElement>('[data-role="schema"]'),
  resultat: exige<HTMLElement>('[data-role="resultat"]'),
  profil: exige<HTMLElement>('[data-role="profil"]'),
  hypotheses: exige<HTMLElement>('[data-role="hypotheses"]'),
};
const selecteurExemple = exige<HTMLSelectElement>('[data-role="exemple"]');

function charger(): Saisie | null {
  try {
    const t = window.localStorage.getItem(CLE_STOCKAGE);
    return t === null ? null : relire(t);
  } catch {
    return null;
  }
}

function memoriser(): void {
  try {
    window.localStorage.setItem(CLE_STOCKAGE, serialiser(saisie));
  } catch {
    // Stockage indisponible : la page fonctionne sans.
  }
}

let saisie: Saisie = charger() ?? saisieParDefaut();
let dernier: { donnees: DonneesEquilibre; resultat: ResultatEquilibre; svg: string } | null = null;

// --- Editeurs -------------------------------------------------------------------

function champ(liste: string, i: number, nom: string, valeur: string, largeur = ''): string {
  return `<input type="text" inputmode="decimal" class="${largeur}" data-liste="${liste}" data-index="${i}" data-champ="${nom}" value="${echapper(valeur)}" aria-label="${nom}" />`;
}

function rendreSegments(): void {
  const lignes = saisie.segments
    .map(
      (s: LigneSegment, i) =>
        `<tr><td>${champ('segments', i, 'id', s.id, 'id')}</td>` +
        (['x1', 'z1', 'x2', 'z2', 'e', 'gamma'] as const).map((k) => `<td>${champ('segments', i, k, s[k])}</td>`).join('') +
        `<td><button type="button" class="retirer" data-action="retirer" data-liste="segments" data-index="${i}" aria-label="retirer">×</button></td></tr>`
    )
    .join('');
  zones.segments.innerHTML =
    '<table class="actions"><thead><tr><th>Id</th><th>x1</th><th>z1</th><th>x2</th><th>z2</th><th>e (m)</th><th>&gamma; (kN/m³)</th><th></th></tr></thead>' +
    `<tbody>${lignes}</tbody></table>`;
}

const CHAMPS_CHARGE: Record<TypeCharge, [keyof LigneCharge, string][]> = {
  ponctuelle: [['x', 'x'], ['z', 'z'], ['Fx', 'F_x →'], ['Fz', 'F_z ↓']],
  lineaire: [['xa', 'x_A'], ['za', 'z_A'], ['xb', 'x_B'], ['zb', 'z_B'], ['qa', 'q_A'], ['qb', 'q_B']],
  moment: [['M', 'M ↺ (kN.m)']],
};

function rendreCharges(): void {
  zones.charges.innerHTML = saisie.charges
    .map((c: LigneCharge, i) => {
      const nature = `<select data-liste="charges" data-index="${i}" data-champ="nature" aria-label="nature">${['G', 'Q'].map((n) => `<option${n === c.nature ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
      const direction =
        c.type === 'lineaire'
          ? `<select data-liste="charges" data-index="${i}" data-champ="direction" aria-label="direction"><option value="verticale"${c.direction === 'verticale' ? ' selected' : ''}>verticale ↓</option><option value="horizontale"${c.direction === 'horizontale' ? ' selected' : ''}>horizontale →</option></select>`
          : '';
      const champs = CHAMPS_CHARGE[c.type]
        .map(([k, lib]) => `<label class="mini"><span>${lib}</span>${champ('charges', i, k, String(c[k]))}</label>`)
        .join('');
      return (
        `<div class="ligne-charge"><div class="tete">${champ('charges', i, 'id', c.id, 'id')}<span class="type">${c.type}</span>${nature}${direction}` +
        `<button type="button" class="retirer" data-action="retirer" data-liste="charges" data-index="${i}" aria-label="retirer">×</button></div>` +
        `<div class="champs">${champs}</div></div>`
      );
    })
    .join('');
}

function ecrireChampsFixes(): void {
  for (const e of formulaire.querySelectorAll<HTMLInputElement>('[data-fixe]')) {
    e.value = saisie[e.dataset.fixe as 'xg' | 'xd' | 'zb' | 'mu' | 'profondeur'];
  }
}

// --- Calcul ---------------------------------------------------------------------

function montrerErreur(m: string | null): void {
  zones.erreur.hidden = m === null;
  zones.erreur.textContent = m ?? '';
}

function recalculer(): void {
  memoriser();
  const l = lireSaisie(saisie);
  if (!l.ok) return montrerErreur(l.message);
  let resultat: ResultatEquilibre;
  try {
    resultat = verifierEquilibre(l.donnees, PROFIL);
  } catch (e) {
    zones.schema.innerHTML = schema(l.donnees, null);
    return montrerErreur(messageDErreur(e));
  }
  montrerErreur(null);
  const svg = schema(l.donnees, resultat);
  dernier = { donnees: l.donnees, resultat, svg };
  zones.schema.innerHTML = svg;
  zones.resultat.innerHTML = rendreResultat(resultat);
}

// --- Evenements -------------------------------------------------------------------

formulaire.addEventListener('input', (ev) => {
  const c = ev.target;
  if (!(c instanceof HTMLInputElement || c instanceof HTMLSelectElement)) return;
  if (c.dataset.fixe !== undefined) {
    saisie[c.dataset.fixe as 'xg' | 'xd' | 'zb' | 'mu' | 'profondeur'] = c.value;
    return recalculer();
  }
  const i = Number(c.dataset.index);
  const champNom = c.dataset.champ;
  if (champNom === undefined) return;
  if (c.dataset.liste === 'segments') {
    const s = saisie.segments[i];
    if (s !== undefined) s[champNom as keyof LigneSegment] = c.value;
  } else if (c.dataset.liste === 'charges') {
    const ch = saisie.charges[i];
    if (ch === undefined) return;
    if (champNom === 'nature') ch.nature = c.value === 'Q' ? 'Q' : 'G';
    else if (champNom === 'direction') ch.direction = c.value === 'horizontale' ? 'horizontale' : 'verticale';
    else (ch as unknown as Record<string, string>)[champNom] = c.value;
  }
  recalculer();
});
formulaire.addEventListener('change', (ev) => {
  if (ev.target instanceof HTMLSelectElement && ev.target !== selecteurExemple) ev.target.dispatchEvent(new Event('input', { bubbles: true }));
});

function toutRendre(): void {
  rendreSegments();
  rendreCharges();
  ecrireChampsFixes();
  recalculer();
}

document.addEventListener('click', (ev) => {
  const c = ev.target;
  if (!(c instanceof HTMLElement)) return;
  const action = c.dataset.action;
  if (action === undefined) return;
  if (action === 'ajouter-segment') {
    saisie.segments.push({ id: `S${saisie.segments.length + 1}`, x1: '0', z1: '0', x2: '0', z2: '1', e: '0,2', gamma: '25' });
    return toutRendre();
  }
  if (action.startsWith('ajouter-')) {
    const type = action.slice(8) as TypeCharge;
    saisie.charges.push(charge({ type, id: `C${saisie.charges.length + 1}` }));
    return toutRendre();
  }
  if (action === 'retirer') {
    const i = Number(c.dataset.index);
    if (c.dataset.liste === 'segments') saisie.segments.splice(i, 1);
    else saisie.charges.splice(i, 1);
    return toutRendre();
  }
  if (action === 'enregistrer') return telecharger('equilibre-statique.json', serialiser(saisie), 'application/json;charset=utf-8');
  if (!action.startsWith('exporter-')) return;
  if (dernier === null) return montrerErreur('Aucun calcul valide a exporter : corriger la saisie.');
  if (action === 'exporter-schema') telecharger('equilibre-schema.svg', svgAutonome(dernier.svg, STYLES_TRACE), 'image/svg+xml;charset=utf-8');
  else if (action === 'exporter-csv') telecharger('equilibre-resultats.csv', resultatEnCsv(dernier.resultat), 'text/csv;charset=utf-8');
  else if (action === 'exporter-note') {
    ouvrirOuTelecharger(
      'equilibre-note.html',
      noteDeCalculHtml(dernier.resultat, PROFIL, dernier.svg, tableauEntrees(dernier.donnees), new Date().toISOString().slice(0, 10))
    );
  }
});

selecteurExemple.innerHTML =
  '<option value="">— exemple —</option>' + Object.entries(EXEMPLES).map(([k, e]) => `<option value="${k}">${echapper(e.libelle)}</option>`).join('');
selecteurExemple.addEventListener('change', () => {
  const ex = EXEMPLES[selecteurExemple.value];
  if (ex === undefined) return;
  saisie = structuredClone(ex.saisie);
  selecteurExemple.value = '';
  toutRendre();
});

exige<HTMLInputElement>('[data-role="ouvrir"]').addEventListener('change', async (e) => {
  const entree = e.target as HTMLInputElement;
  const f = entree.files?.[0];
  entree.value = '';
  if (f === undefined) return;
  try {
    saisie = relire(await f.text());
  } catch (err) {
    return montrerErreur(messageDErreur(err));
  }
  toutRendre();
});

zones.profil.innerHTML = tableauProfil(PROFIL);
zones.hypotheses.innerHTML = HYPOTHESES.map((h) => `<li>${echapper(h)}</li>`).join('');
toutRendre();

// Hors navigateur (tests), pas de service worker.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  void import('./pwa').then((m) => m.enregistrerServiceWorker());
}
