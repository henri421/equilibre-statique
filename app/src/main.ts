/**
 * Cablage de l'interface de l'equilibre statique.
 *
 * Ce module ne calcule RIEN : il tient la saisie, appelle le noyau, et confie
 * la mise en forme a `modele`, `vue`, `form`, `dessin` et `export`, purs.
 */

import {
  annuler as annulerHistorique,
  brancherEditeur,
  historique,
  noteDeCalculHtml,
  notationHtml,
  notationTexte,
  ouvrirOuTelecharger,
  pousser,
  retablir as retablirHistorique,
  svgAutonome,
  telecharger,
  type ActionEditeur,
  type Vue,
} from 'aedificium-ui';
import { profilRecommande, verifierEquilibre, type DonneesEquilibre, type ResultatEquilibre } from '../../src/index';
import { EXEMPLES, charge, lireSaisie, relire, saisieParDefaut, serialiser, type Saisie, type TypeCharge } from './modele';
import { messageDErreur, rendreResultat, tableauProfil, verdictsHtml } from './vue';
import { OPTIONS_EDITION, dessinSaisie, vueDeSaisie } from './dessin';
import { STYLES_TRACE, resultatEnCsv } from './export';
import { HYPOTHESES, noteDuCalcul } from './note';
import {
  abandonner,
  appliquer,
  etatInitial,
  grapheDeSaisie,
  modifierChamp,
  outilEditeur,
  selectionDeChoix,
  texteNombre,
  type Choix,
  type EtatEdition,
  type OutilEquilibre,
} from './edition';
import { chargesHtml, elementChoisiHtml, tableSegmentsHtml } from './form';
import './style.css';

const PROFIL = profilRecommande();
const CLE_STOCKAGE = 'equilibre-statique/saisie';
const CLE_CARTOUCHE = 'equilibre-statique:cartouche';
const LARGEUR = 640;
const HAUTEUR = 520;
/** Pas de la grille aimantee, en m. */
const PAS_GRILLE = 0.1;

function exige<T extends Element>(selecteur: string): T {
  const e = document.querySelector<T>(selecteur);
  if (e === null) throw new Error(`Élément absent de la page : ${selecteur}`);
  return e;
}

const formulaire = exige<HTMLFormElement>('#formulaire');
const sectionDessin = exige<HTMLElement>('#dessin');
const sectionSorties = exige<HTMLElement>('#sorties');
const zones = {
  segments: exige<HTMLElement>('[data-role="segments"]'),
  charges: exige<HTMLElement>('[data-role="charges"]'),
  elementChoisi: exige<HTMLElement>('[data-role="element-choisi"]'),
  erreur: exige<HTMLElement>('[data-role="erreur"]'),
  zone: exige<SVGSVGElement>('[data-role="zone"]'),
  statut: exige<HTMLElement>('[data-role="statut"]'),
  resultat: exige<HTMLElement>('[data-role="resultat"]'),
  profil: exige<HTMLElement>('[data-role="profil"]'),
  hypotheses: exige<HTMLElement>('[data-role="hypotheses"]'),
  verdicts: exige<HTMLElement>('[data-role="liste-verdicts"]'),
} as const;
const selecteurExemple = exige<HTMLSelectElement>('[data-role="exemple"]');
const champProjet = exige<HTMLInputElement>('[data-role="projet"]');
const champElement = exige<HTMLInputElement>('[data-role="element"]');

// --- Cartouche de la note (hors formulaire : ne relance pas le calcul) -------------

function lireCartouche(): { projet: string; element: string } {
  try {
    const t = window.localStorage.getItem(CLE_CARTOUCHE);
    if (t === null) return { projet: '', element: '' };
    const v: unknown = JSON.parse(t);
    if (typeof v !== 'object' || v === null) return { projet: '', element: '' };
    const o = v as Record<string, unknown>;
    return {
      projet: typeof o.projet === 'string' ? o.projet : '',
      element: typeof o.element === 'string' ? o.element : '',
    };
  } catch {
    return { projet: '', element: '' };
  }
}

function memoriserCartouche(): void {
  try {
    window.localStorage.setItem(CLE_CARTOUCHE, JSON.stringify({ projet: champProjet.value, element: champElement.value }));
  } catch {
    // Stockage indisponible : la page fonctionne sans.
  }
}

const cartouche = lireCartouche();
champProjet.value = cartouche.projet;
champElement.value = cartouche.element;
sectionSorties.addEventListener('input', memoriserCartouche);

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
    window.localStorage.setItem(CLE_STOCKAGE, serialiser(hist.present));
  } catch {
    // Stockage indisponible : la page fonctionne sans.
  }
}

// --- Etat ------------------------------------------------------------------------

// `hist.present` est la saisie courante : elle n'est jamais modifiee en place.
let hist = historique(charger() ?? saisieParDefaut());
let etat: EtatEdition = etatInitial(hist.present);
let outil: OutilEquilibre = 'selection';
const options = { grille: true, cotes: false, resultante: true };
let survol: EtatEdition['enCours'] = null;
let dernier: { donnees: DonneesEquilibre; resultat: ResultatEquilibre; svg: string } | null = null;

// --- Rendu -----------------------------------------------------------------------

function afficherSegments(): void {
  zones.segments.innerHTML = tableSegmentsHtml(hist.present, etat.choix);
}

function afficherCharges(): void {
  zones.charges.innerHTML = chargesHtml(hist.present, etat.choix);
}

function afficherElementChoisi(): void {
  zones.elementChoisi.innerHTML = elementChoisiHtml(hist.present, etat.choix);
}

function ecrireChampsFixes(): void {
  for (const e of formulaire.querySelectorAll<HTMLInputElement>('[data-fixe]')) {
    const nom = e.dataset.fixe as 'xg' | 'xd' | 'zb' | 'mu' | 'profondeur';
    e.value = hist.present[nom];
  }
}

function montrerErreur(m: string | null): void {
  zones.erreur.hidden = m === null;
  zones.erreur.innerHTML = m === null ? '' : notationHtml(m);
}

// Pendant un glisse, la vue reste celle du debut : recadree a chaque
// deplacement, elle ferait courir le point moins vite que le pointeur.
let vueFigee: Vue | null = null;

function vueCourante(): Vue {
  if (etat.glisse === null || vueFigee === null) vueFigee = vueDeSaisie(hist.present, LARGEUR, HAUTEUR);
  return vueFigee;
}

function dessinCourant(resultat: ResultatEquilibre | null): string {
  const s = hist.present;
  return dessinSaisie(s, resultat, vueCourante(), LARGEUR, HAUTEUR, {
    ...OPTIONS_EDITION,
    choix: etat.choix,
    grille: options.grille ? PAS_GRILLE : null,
    cotes: options.cotes,
    resultante: options.resultante,
    enCours: etat.enCours,
    survol,
  });
}

function recalculer(): void {
  const l = lireSaisie(hist.present);
  if (!l.ok) {
    dernier = null;
    montrerErreur(l.message);
    zones.resultat.innerHTML = '';
    zones.verdicts.innerHTML = '';
    zones.zone.innerHTML = dessinCourant(null);
    return;
  }
  let resultat: ResultatEquilibre;
  try {
    resultat = verifierEquilibre(l.donnees, PROFIL);
  } catch (e) {
    dernier = null;
    montrerErreur(messageDErreur(e));
    zones.resultat.innerHTML = '';
    zones.verdicts.innerHTML = '';
    zones.zone.innerHTML = dessinCourant(null);
    return;
  }
  montrerErreur(null);
  const svg = dessinCourant(resultat);
  dernier = { donnees: l.donnees, resultat, svg };
  zones.zone.innerHTML = svg;
  zones.resultat.innerHTML = rendreResultat(resultat);
  zones.verdicts.innerHTML = verdictsHtml(resultat);
}

function redessinerSvg(): void {
  zones.zone.innerHTML = dessinCourant(dernier === null ? null : dernier.resultat);
}

function toutRedessiner(): void {
  memoriser();
  afficherSegments();
  afficherCharges();
  afficherElementChoisi();
  ecrireChampsFixes();
  recalculer();
}

// --- Editeur ---------------------------------------------------------------------

function synchroniserSelection(): void {
  editeur.definirEtat({
    ...editeur.etat(),
    selection: selectionDeChoix(grapheDeSaisie(hist.present), etat.choix),
  });
}

function adopter(suivante: Saisie): void {
  hist = pousser(hist, suivante);
  etat = { ...etat, saisie: suivante, enCours: null, glisse: null };
  synchroniserSelection();
  toutRedessiner();
}

function annuler(): void {
  hist = annulerHistorique(hist);
  etat = { ...etat, saisie: hist.present, enCours: null, glisse: null };
  synchroniserSelection();
  toutRedessiner();
}

function retablir(): void {
  hist = retablirHistorique(hist);
  etat = { ...etat, saisie: hist.present, enCours: null, glisse: null };
  synchroniserSelection();
  toutRedessiner();
}

function traiterAction(action: ActionEditeur): void {
  if (action.type === 'annuler') return annuler();
  if (action.type === 'retablir') return retablir();
  if (action.type === 'survol') {
    const p = action.point;
    survol = action.point;
    const texte = `x = ${texteNombre(p.x)} m · z = ${texteNombre(p.y)} m`;
    zones.statut.textContent = action.noeud === null || action.noeud === undefined ? texte : `${texte} · aimanté sur ${action.noeud}`;
    redessinerSvg();
    return;
  }
  const resultat = appliquer(etat, action, outil);
  if (resultat.avant !== null) hist = pousser({ ...hist, present: resultat.avant }, resultat.etat.saisie);
  else hist = { ...hist, present: resultat.etat.saisie };
  etat = resultat.etat;
  synchroniserSelection();
  toutRedessiner();
}

const editeur = brancherEditeur(zones.zone, {
  contexte: () => ({
    vue: vueCourante(),
    outil: outilEditeur(outil),
    graphe: grapheDeSaisie(hist.present),
    pas: options.grille ? PAS_GRILLE : null,
    tolerancePx: 8,
  }),
  surAction: (action) => traiterAction(action),
});

// --- Choix dans les tableaux -----------------------------------------------------

/** Index de la ligne cliquee parmi les lignes du tableau du conteneur. */
function indexDeLigne(porteur: HTMLElement, cible: HTMLElement): number {
  const ligne = cible.closest('tr') ?? porteur.closest('tr');
  const table = ligne === null ? null : ligne.closest('table');
  if (ligne === null || table === null) return -1;
  return [...table.querySelectorAll('tbody tr')].indexOf(ligne);
}

function choixDeLigne(porteur: HTMLElement, cible: HTMLElement): Choix {
  const conteneur = porteur.closest<HTMLElement>('[data-role="segments"], [data-role="charges"]');
  const liste = conteneur === null ? null : (conteneur.getAttribute('data-role') as 'segments' | 'charges');
  const depuisListe = (i: number): Choix => (liste === null || !Number.isFinite(i) ? null : { liste, index: i });
  const brut = (porteur.dataset.choix ?? '').trim();

  if (brut === 'base') return { liste: 'base' };
  if (/^\d+$/.test(brut)) {
    const encode = depuisListe(Number(brut));
    if (encode !== null) return encode;
  }
  if ((brut === 'segments' || brut === 'charges') && porteur.dataset.index !== undefined) {
    return { liste: brut, index: Number(porteur.dataset.index) };
  }
  if (brut !== '') {
    try {
      const v: unknown = JSON.parse(brut);
      if (typeof v === 'number') {
        const parPosition = depuisListe(v);
        if (parPosition !== null) return parPosition;
      } else if (Array.isArray(v) && v.length === 2) {
        const [l, i] = v;
        if ((l === 'segments' || l === 'charges') && typeof i === 'number') return { liste: l, index: i };
        if (l === 'base') return { liste: 'base' };
      } else if (typeof v === 'object' && v !== null) {
        const o = v as Record<string, unknown>;
        if (o.liste === 'base') return { liste: 'base' };
        if ((o.liste === 'segments' || o.liste === 'charges') && typeof o.index === 'number') {
          return { liste: o.liste, index: o.index };
        }
      }
    } catch {
      // Pas du JSON : on tente les autres ecritures.
    }
    const m = /^(segments|charges)\s*[:/#-]\s*(\d+)$/.exec(brut);
    if (m !== null) return { liste: m[1] as 'segments' | 'charges', index: Number(m[2]) };
  }
  return depuisListe(indexDeLigne(porteur, cible));
}

// --- Evenements ------------------------------------------------------------------

function traiterBouton(c: HTMLElement, action: string): void {
  if (action === 'annuler') return annuler();
  if (action === 'retablir') return retablir();
  if (action === 'ajouter-segment') {
    const suivante = structuredClone(hist.present);
    suivante.segments.push({ id: `S${suivante.segments.length + 1}`, x1: '0', z1: '0', x2: '0', z2: '1', e: '0,2', gamma: '25' });
    return adopter(suivante);
  }
  if (action.startsWith('ajouter-')) {
    const type = action.slice('ajouter-'.length) as TypeCharge;
    const suivante = structuredClone(hist.present);
    suivante.charges.push(charge({ type, id: `C${suivante.charges.length + 1}` }));
    return adopter(suivante);
  }
  if (action === 'retirer') {
    const i = Number(c.dataset.index);
    const suivante = structuredClone(hist.present);
    if (c.dataset.liste === 'segments') suivante.segments.splice(i, 1);
    else suivante.charges.splice(i, 1);
    return adopter(suivante);
  }
  if (action === 'enregistrer') {
    memoriser();
    return telecharger('equilibre-statique.json', serialiser(hist.present), 'application/json;charset=utf-8');
  }
  if (!action.startsWith('exporter-')) return;
  if (dernier === null) return montrerErreur('Aucun calcul valide à exporter : corriger la saisie.');
  if (action === 'exporter-schema') telecharger('equilibre-schema.svg', svgAutonome(dernier.svg, STYLES_TRACE), 'image/svg+xml;charset=utf-8');
  else if (action === 'exporter-csv') telecharger('equilibre-resultats.csv', resultatEnCsv(dernier.resultat), 'text/csv;charset=utf-8');
  else if (action === 'exporter-note') {
    ouvrirOuTelecharger(
      'equilibre-note.html',
      noteDeCalculHtml(
        noteDuCalcul(PROFIL, dernier.donnees, {
          projet: champProjet.value,
          element: champElement.value,
          date: new Date().toISOString().slice(0, 10),
        }),
        STYLES_TRACE
      )
    );
  }
}

document.addEventListener('click', (ev) => {
  const c = ev.target;
  if (!(c instanceof HTMLElement)) return;
  const action = c.dataset.action;
  if (action !== undefined) return traiterBouton(c, action);
  if (c.closest('button, input, select, textarea, a, label') !== null) return;
  const porteur = c.closest<HTMLElement>('[data-choix]');
  if (porteur === null) return;
  const choix = choixDeLigne(porteur, c);
  if (choix === null) return;
  etat = { ...etat, choix };
  synchroniserSelection();
  toutRedessiner();
});

formulaire.addEventListener('change', (ev) => {
  const c = ev.target;
  if (!(c instanceof HTMLInputElement || c instanceof HTMLSelectElement)) return;
  const fixe = c.dataset.fixe;
  if (fixe !== undefined) {
    return adopter(modifierChamp(hist.present, 'fixe', 0, fixe, c.value));
  }
  const liste = c.dataset.liste;
  const champNom = c.dataset.champ;
  if (liste === undefined || champNom === undefined) return;
  const i = Number(c.dataset.index);
  return adopter(modifierChamp(hist.present, liste as 'segments' | 'charges' | 'fixe', i, champNom, c.value));
});

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-outil]')) {
  b.addEventListener('click', () => {
    outil = b.dataset.outil as OutilEquilibre;
    for (const autre of document.querySelectorAll<HTMLElement>('[data-outil]')) {
      autre.setAttribute('aria-pressed', String(autre === b));
    }
  });
}

sectionDessin.addEventListener('change', (ev) => {
  const c = ev.target;
  if (!(c instanceof HTMLInputElement)) return;
  const nom = c.dataset.option;
  if (nom !== 'grille' && nom !== 'cotes' && nom !== 'resultante') return;
  options[nom] = c.checked;
  redessinerSvg();
});

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  etat = abandonner(etat);
  synchroniserSelection();
  toutRedessiner();
});

selecteurExemple.innerHTML =
  '<option value="">— exemple —</option>' + Object.entries(EXEMPLES).map(([k, e]) => `<option value="${k}">${notationTexte(e.libelle)}</option>`).join('');
selecteurExemple.addEventListener('change', () => {
  const ex = EXEMPLES[selecteurExemple.value];
  if (ex === undefined) return;
  const copie = structuredClone(ex.saisie);
  historiser(copie);
  selecteurExemple.value = '';
});

function historiser(copie: Saisie): void {
  hist = pousser(hist, copie);
  etat = etatInitial(copie);
  synchroniserSelection();
  toutRedessiner();
}

exige<HTMLInputElement>('[data-role="ouvrir"]').addEventListener('change', async (e) => {
  const entree = e.target as HTMLInputElement;
  const f = entree.files?.[0];
  entree.value = '';
  if (f === undefined) return;
  try {
    historiser(relire(await f.text()));
  } catch (err) {
    montrerErreur(messageDErreur(err));
  }
});

// Styles du trace dans la page, comme le reste de la suite.
document.head.insertAdjacentHTML('beforeend', `<style>${STYLES_TRACE}</style>`);

zones.profil.innerHTML = tableauProfil(PROFIL);
zones.hypotheses.innerHTML = HYPOTHESES.map((h) => `<li>${notationHtml(h)}</li>`).join('');
toutRedessiner();
synchroniserSelection();

// Hors navigateur (tests), pas de service worker.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  void import('./pwa').then((m) => m.enregistrerServiceWorker());
}
