/**
 * Mise en forme des resultats. PUR. L'ecran et la note appellent ces memes
 * fonctions ; le CSV lit `lignesCsv`, la meme matiere en cellules.
 */

import { nombreAffiche, notationHtml, tauxAffiche } from 'aedificium-ui';
import type { Charge, DonneesEquilibre, ProfilEquilibre, Renversement, ResultatEquilibre } from '../../src/index';
import { phrase, textes } from './textes';

export function messageDErreur(e: unknown): string {
  return phrase(e instanceof Error ? e.message : String(e));
}

/** Nombre affiche : trois decimales au plus, sans zeros inutiles. */
const f = (x: number, d = 2) => nombreAffiche(x, Math.min(d, 3));

function celluleTaux(t: number): string {
  if (!Number.isFinite(t)) return `<td class="valeur refus">${textes().infini}</td>`;
  return `<td class="valeur ${t <= 1 ? 'ok' : 'refus'}">${tauxAffiche(t)}</td>`;
}

export function verdictHtml(r: ResultatEquilibre): string {
  const t = textes().verdict;
  return `<p class="verdict verdict-${r.verdict}">${r.verdict === 'conforme' ? t.assure : t.nonAssure}</p><p class="motif">${notationHtml(phrase(r.motif))}</p>`;
}

/** Une carte de verdict : etat, jauge, taux et detail. Les etats valent ok ou refus. */
function carteVerdict(cle: string, titre: string, clause: string, taux: number | null, detail: string): string {
  const etat = taux === null ? '' : taux <= 1 ? ' ok' : ' refus';
  const jauge =
    taux === null
      ? ''
      : `<div class="jauge"><i style="width:${Math.round(Math.min(100, taux * 100))}%"></i></div><span class="taux">${tauxAffiche(taux)}</span>`;
  return `<div class="verdict${etat}" data-verif="${cle}"><h3>${titre} <span class="clause">${clause}</span></h3>${jauge}<p>${detail}</p></div>`;
}

/** Les cartes de verdicts, dans l'ordre de l'ecran : renversement, glissement, soulevement, resultante. */
export function verdictsHtml(r: ResultatEquilibre): string {
  const t = textes();
  const renversement = (pivot: 'gauche' | 'droite'): string => {
    const x = r.renversement.find((y) => y.pivot === pivot);
    if (x === undefined) return '';
    return carteVerdict(
      `renversement-${pivot}`,
      t.cartes.renversement(pivot),
      'EQU',
      x.taux,
      notationHtml(`M_dst,d = ${f(x.M_dst_d)} kN.m ; M_stb,d = ${f(x.M_stb_d)} kN.m`)
    );
  };
  const g = r.glissement;
  return (
    renversement('gauche') +
    renversement('droite') +
    carteVerdict(
      'glissement',
      t.verifications.glissementVers(g.sens > 0 ? '+x' : '−x'),
      'STR/GEO',
      g.taux,
      notationHtml(`H_d = ${f(g.H_d)} kN ; R_d = ${f(g.R_d)} kN`)
    ) +
    carteVerdict(
      'soulevement',
      t.verifications.soulevement,
      'UPL',
      r.soulevement.taux,
      notationHtml(`V_dst,d = ${f(r.soulevement.V_dst_d)} kN ; V_stb,d = ${f(r.soulevement.V_stb_d)} kN`)
    ) +
    `<div class="verdict" data-verif="resultante"><h3>${t.cartes.resultante} <span class="clause">${t.cartes.indication}</span></h3><p>${notationHtml(texteExcentricite(r))}</p></div>`
  );
}

/** Tableau de synthese des verifications. */
export function tableauSynthese(r: ResultatEquilibre): string {
  const g = r.glissement;
  const t = textes();
  const lignes = [
    ...r.renversement.map(
      (x) =>
        `<tr><td>${t.note.renversementLigne(x.pivot, f(x.x))}</td><td>EQU, ${t.clauses.renversementCourt}</td>` +
        `<td class="valeur">${f(x.M_dst_d)} kN.m</td><td class="valeur">${f(x.M_stb_d)} kN.m</td>${celluleTaux(x.taux)}</tr>`
    ),
    `<tr><td>${t.verifications.glissementVers(g.sens > 0 ? '+x' : '-x')}</td><td>STR/GEO, ${t.clauses.glissementCourt}, ${notationHtml('R_d = mu_d N_d')}</td>` +
      `<td class="valeur">${f(g.H_d)} kN</td><td class="valeur">${f(g.R_d)} kN (${notationHtml('N_d')} = ${f(g.N_d)})</td>${celluleTaux(g.taux)}</tr>`,
    `<tr><td>${t.verifications.soulevement}</td><td>UPL, ${t.clauses.soulevementCourt}</td><td class="valeur">${f(r.soulevement.V_dst_d)} kN</td>` +
      `<td class="valeur">${f(r.soulevement.V_stb_d)} kN</td>${celluleTaux(r.soulevement.taux)}</tr>`,
  ].join('');
  const h = t.entetes;
  return (
    `<div class="defilement"><table class="zones"><thead><tr><th>${h.verification}</th><th>${h.coefficients}</th><th>${h.destabilisant}</th><th>${h.stabilisant}</th><th>${h.taux}</th></tr></thead>` +
    `<tbody>${lignes}</tbody></table></div>`
  );
}

/** Position de la resultante caracteristique sur la base. */
export function texteExcentricite(r: ResultatEquilibre): string {
  const e = r.excentricite;
  const t = textes().excentricite;
  if (e === null) return t.aucune;
  const situation = e.noyauCentral ? t.noyau : e.dansLaBase ? t.horsNoyau : t.horsBase;
  return t.texte(f(e.N), f(e.xR, 3), f(e.e, 3), f(e.B / 6, 3), situation);
}

/** Sens de la charge en une fleche : →, ←, ↓, ↑, ou oblique. */
export function sens(Fx: number, Fz: number): string {
  if (Fz === 0) return Fx > 0 ? '→' : '←';
  if (Fx === 0) return Fz < 0 ? '↓' : '↑';
  return `${Fx > 0 ? '→' : '←'}${Fz < 0 ? '↓' : '↑'}`;
}

/**
 * Le detail du renversement autour d'une arete, ligne par ligne :
 * charge F, distance d du pivot a sa ligne d'action, coefficient gamma_f,
 * moment de calcul F d gamma_f range en stabilisant ou destabilisant ; les
 * sommes en pied. Chaque ligne se recalcule a la main.
 */
export function tableauMoments(x: Renversement): string {
  const t = textes();
  const lignes = x.lignes
    .map((l) => {
      const e = l.elementaire;
      const charge = e.C !== 0 ? t.couple(f(Math.abs(e.C))) : `${f(l.F)} ${sens(e.Fx, e.Fz)}`;
      const stb = l.role === 'stabilisant' ? f(l.Md) : '';
      const dst = l.role === 'destabilisant' ? f(l.Md) : '';
      return (
        `<tr class="${l.role}"><td>${notationHtml(phrase(e.origine))}</td><td>${e.nature}</td><td class="valeur">${charge}</td>` +
        `<td class="valeur">${l.d === null ? '—' : f(l.d, 3)}</td><td class="valeur">${f(l.gamma)}</td>` +
        `<td class="valeur">${stb}</td><td class="valeur">${dst}</td></tr>`
      );
    })
    .join('');
  const somme =
    `<tr class="somme"><td colspan="5">${t.somme}</td><td class="valeur">${f(x.M_stb_d)}</td><td class="valeur">${f(x.M_dst_d)}</td></tr>` +
    `<tr class="somme"><td colspan="5">${t.tauxSomme}</td><td colspan="2" class="valeur ${x.taux <= 1 ? 'ok' : 'refus'}">` +
    `${Number.isFinite(x.taux) ? tauxAffiche(x.taux) : t.infini}</td></tr>`;
  const h = t.entetes;
  return (
    `<h3>${t.note.renversementTitre(x.pivot, f(x.x), f(x.z))}</h3>` +
    `<div class="defilement"><table class="zones moments"><thead><tr><th>${h.charge}</th><th>G/Q</th><th>F<br>(kN)</th><th>${h.distance}<br>(m)</th>` +
    `<th>${notationHtml('gamma_f')}</th><th>${h.mStabilisant}<br>(kN.m)</th><th>${h.mDestabilisant}<br>(kN.m)</th></tr></thead>` +
    `<tbody>${lignes}</tbody><tfoot>${somme}</tfoot></table></div>` +
    `<p class="note">${notationHtml(t.noteMoments)}</p>`
  );
}

export function tableauProfil(p: ProfilEquilibre): string {
  const t = textes();
  const ligne = (nom: string, j: ProfilEquilibre['equ']) =>
    `<tr><td>${nom}</td><td class="valeur">${f(j.gG_dst.valeur)}</td><td class="valeur">${f(j.gG_stb.valeur)}</td><td class="valeur">${f(j.gQ_dst.valeur)}</td>` +
    `<td class="valeur">${f(j.gQ_stb.valeur)}</td><td class="clause">${notationHtml(phrase(j.gG_dst.source))}</td></tr>`;
  return (
    `<div class="defilement"><table class="zones"><thead><tr><th>${t.entetes.verification}</th><th>G dst</th><th>G stb</th><th>Q dst</th><th>Q stb</th><th>${t.entetes.source}</th></tr></thead><tbody>` +
    ligne(t.verifications.renversementEqu, p.equ) +
    ligne(t.verifications.glissement, p.glissement) +
    ligne(t.verifications.soulevementUpl, p.upl) +
    '</tbody></table></div>'
  );
}

/** Tout le resultat, dans l'ordre de l'ecran et de la note. */
export function rendreResultat(r: ResultatEquilibre): string {
  return (
    verdictHtml(r) +
    tableauSynthese(r) +
    `<p class="note">${notationHtml(texteExcentricite(r))}</p>` +
    r.renversement.map(tableauMoments).join('')
  );
}

/** Les memes grandeurs en cellules, pour le CSV. */
export function lignesCsv(r: ResultatEquilibre): string[][] {
  const tx = textes();
  const h = tx.entetes;
  const t = (x: number) => (Number.isFinite(x) ? tauxAffiche(x) : tx.infini);
  const lignes: string[][] = [[h.verification, h.destabilisant, h.stabilisant, h.taux]];
  for (const x of r.renversement) lignes.push([tx.cartes.renversement(x.pivot), f(x.M_dst_d), f(x.M_stb_d), t(x.taux)]);
  lignes.push([tx.verifications.glissementVers(r.glissement.sens > 0 ? '+x' : '-x'), f(r.glissement.H_d), f(r.glissement.R_d), t(r.glissement.taux)]);
  lignes.push([tx.verifications.soulevement, f(r.soulevement.V_dst_d), f(r.soulevement.V_stb_d), t(r.soulevement.taux)]);
  lignes.push([]);
  for (const x of r.renversement) {
    lignes.push([]);
    lignes.push([tx.verifications.renversementAutour(x.pivot)]);
    lignes.push([h.charge, 'G/Q', 'F (kN)', `${h.couple} (kN.m)`, `${h.distance} (m)`, 'gamma_f', `${h.mStabilisant} (kN.m)`, `${h.mDestabilisant} (kN.m)`]);
    for (const l of x.lignes) {
      const e = l.elementaire;
      lignes.push([
        phrase(e.origine),
        e.nature,
        e.C !== 0 ? '' : f(l.F),
        e.C !== 0 ? f(Math.abs(e.C)) : '',
        l.d === null ? '' : f(l.d, 3),
        f(l.gamma),
        l.role === 'stabilisant' ? f(l.Md) : '',
        l.role === 'destabilisant' ? f(l.Md) : '',
      ]);
    }
    lignes.push([tx.somme, '', '', '', '', '', f(x.M_stb_d), f(x.M_dst_d)]);
  }
  return lignes;
}

/** Une charge saisie, en une phrase : ecran et note. */
export function descriptionCharge(c: Charge): string {
  const t = textes().entrees;
  if (c.type === 'ponctuelle') return t.ponctuelle(f(c.x), f(c.z), f(c.Fx), f(c.Fz));
  if (c.type === 'moment') return t.moment(f(c.M));
  return t.lineaire(c.direction, f(c.xa), f(c.za), f(c.xb), f(c.zb), f(c.qa), f(c.qb));
}

/** Les donnees lues, pour la note : segments, charges, base. */
export function tableauEntrees(d: DonneesEquilibre): string {
  const t = textes();
  const seg = d.segments
    .map((s) => `<tr><td>${notationHtml(s.id)}</td><td class="valeur">(${f(s.x1)} ; ${f(s.z1)}) → (${f(s.x2)} ; ${f(s.z2)})</td><td class="valeur">${f(s.e)}</td><td class="valeur">${f(s.gamma, 1)}</td></tr>`)
    .join('');
  const ch = d.charges.map((c) => `<tr><td>${notationHtml(c.id)}</td><td>${c.nature}</td><td>${notationHtml(descriptionCharge(c))}</td></tr>`).join('');
  return (
    `<h3>${t.entrees.segments}</h3><div class="defilement"><table class="zones"><thead><tr><th>Id</th><th>${t.entetes.axe}</th><th>e (m)</th><th>${notationHtml('gamma (kN/m3)')}</th></tr></thead>` +
    `<tbody>${seg}</tbody></table></div>` +
    `<h3>${t.entrees.charges}</h3><div class="defilement"><table class="zones"><thead><tr><th>Id</th><th>G/Q</th><th>${t.entetes.description}</th></tr></thead>` +
    `<tbody>${ch}</tbody></table></div>` +
    `<p class="note">${notationHtml(t.entrees.base(f(d.base.xg), f(d.base.xd), f(d.base.z), f(d.mu, 3), f(d.profondeur)))}</p>`
  );
}
