/**
 * Balisage des editeurs de la saisie : tableaux des segments et des charges,
 * et element choisi. PUR, sans DOM : l'ecran pose ces chaines.
 *
 * Les champs portent data-liste, data-index, data-champ ou data-fixe : un seul
 * gestionnaire traite les tableaux et l'element choisi.
 */

import { echapper, notationHtml } from 'aedificium-ui';
import type { Choix } from './edition';
import type { LigneCharge, LigneSegment, Saisie, TypeCharge } from './modele';
import { textes } from './textes';

function champ(liste: string, i: number, nom: string, valeur: string, largeur = ''): string {
  return `<input type="text" inputmode="decimal" class="${largeur}" data-liste="${liste}" data-index="${i}" data-champ="${nom}" value="${echapper(valeur)}" aria-label="${nom}" />`;
}

function champFixe(nom: string, valeur: string): string {
  return `<input type="text" inputmode="decimal" data-fixe="${nom}" value="${echapper(valeur)}" aria-label="${nom}" />`;
}

const CHAMPS_CHARGE: Record<TypeCharge, [keyof LigneCharge, string][]> = {
  ponctuelle: [['x', 'x'], ['z', 'z'], ['Fx', 'F_x →'], ['Fz', 'F_z ↓']],
  lineaire: [['xa', 'x_A'], ['za', 'z_A'], ['xb', 'x_B'], ['zb', 'z_B'], ['qa', 'q_A'], ['qb', 'q_B']],
  moment: [['M', 'M ↺ (kN.m)']],
};

/** Libelle d'un type de charge, jamais son identifiant. */
const libelleType = (t: TypeCharge): string => textes().form.types[t];

/** Le choix de la direction d'une charge lineaire. */
function selectDirection(i: number, ch: LigneCharge): string {
  const d = textes().form.directions;
  return (
    `<select data-liste="charges" data-index="${i}" data-champ="direction" aria-label="direction">` +
    `<option value="verticale"${ch.direction === 'verticale' ? ' selected' : ''}>${d.verticale}</option>` +
    `<option value="horizontale"${ch.direction === 'horizontale' ? ' selected' : ''}>${d.horizontale}</option></select>`
  );
}

/** L'element de liste designe par le choix, s'il y en a un. */
function estChoisi(c: Choix, liste: 'segments' | 'charges', index: number): boolean {
  return c !== null && c.liste === liste && c.index === index;
}

/** Le tableau des segments, une ligne par segment. */
export function tableSegmentsHtml(s: Saisie, c: Choix): string {
  const lignes = s.segments
    .map(
      (seg: LigneSegment, i) =>
        `<tr${estChoisi(c, 'segments', i) ? ' class="choisi"' : ''} data-choix="segments:${i}"><td>${champ('segments', i, 'id', seg.id, 'id')}</td>` +
        (['x1', 'z1', 'x2', 'z2', 'e', 'gamma'] as const).map((k) => `<td>${champ('segments', i, k, String(seg[k]))}</td>`).join('') +
        `<td><button type="button" class="retirer" data-action="retirer" data-liste="segments" data-index="${i}" aria-label="${textes().form.retirer}">×</button></td></tr>`
    )
    .join('');
  return (
    '<table class="actions"><thead><tr><th>Id</th>' +
    ['x_1', 'z_1', 'x_2', 'z_2'].map((t) => `<th>${notationHtml(t)}</th>`).join('') +
    `<th>e (m)</th><th>${notationHtml('gamma (kN/m3)')}</th><th></th></tr></thead>` +
    `<tbody>${lignes}</tbody></table>`
  );
}

/** La liste des charges, un bloc par charge. */
export function chargesHtml(s: Saisie, c: Choix): string {
  return s.charges
    .map((ch: LigneCharge, i) => {
      const nature = `<select data-liste="charges" data-index="${i}" data-champ="nature" aria-label="nature">${['G', 'Q'].map((n) => `<option${n === ch.nature ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
      const direction = ch.type === 'lineaire' ? selectDirection(i, ch) : '';
      const champs = CHAMPS_CHARGE[ch.type]
        .map(([k, lib]) => `<label class="mini"><span>${notationHtml(lib)}</span>${champ('charges', i, k, String(ch[k]))}</label>`)
        .join('');
      return (
        `<div class="ligne-charge${estChoisi(c, 'charges', i) ? ' choisi' : ''}" data-choix="charges:${i}">` +
        `<div class="tete">${champ('charges', i, 'id', ch.id, 'id')}<span class="type">${libelleType(ch.type)}</span>${nature}${direction}` +
        `<button type="button" class="retirer" data-action="retirer" data-liste="charges" data-index="${i}" aria-label="${textes().form.retirer}">×</button></div>` +
        `<div class="champs">${champs}</div></div>`
      );
    })
    .join('');
}

/** Le contenu du fieldset de l'element choisi, legend comprise. */
export function elementChoisiHtml(s: Saisie, c: Choix): string {
  const t = textes().form;
  if (c === null) {
    return `<legend>${t.choisi}</legend><p class="note">${t.aucunChoix}</p>`;
  }
  if (c.liste === 'base') {
    return (
      `<legend>${t.choisiBase}</legend>` +
      champFixe('xg', s.xg) +
      champFixe('xd', s.xd) +
      champFixe('zb', s.zb)
    );
  }
  if (c.liste === 'segments') {
    const seg = s.segments[c.index];
    return (
      `<legend>${t.choisiSegment(echapper(seg.id))}</legend>` +
      champ('segments', c.index, 'id', seg.id, 'id') +
      champ('segments', c.index, 'e', String(seg.e)) +
      champ('segments', c.index, 'gamma', String(seg.gamma))
    );
  }
  const ch = s.charges[c.index];
  const nature = `<select data-liste="charges" data-index="${c.index}" data-champ="nature" aria-label="nature">${['G', 'Q'].map((n) => `<option${n === ch.nature ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
  const direction = ch.type === 'lineaire' ? selectDirection(c.index, ch) : '';
  const debut = ch.type === 'moment' ? ['x', 'z'] : [];
  const champs = (debut as (keyof LigneCharge)[])
    .map((k) => `<label class="mini"><span>${notationHtml(String(k))}</span>${champ('charges', c.index, k, String(ch[k]))}</label>`)
    .join('') +
    CHAMPS_CHARGE[ch.type]
      .map(([k, lib]) => `<label class="mini"><span>${notationHtml(lib)}</span>${champ('charges', c.index, k, String(ch[k]))}</label>`)
      .join('');
  return (
    `<legend>${t.choisiCharge(echapper(ch.id), libelleType(ch.type))}</legend>` + nature + direction + champs
  );
}
