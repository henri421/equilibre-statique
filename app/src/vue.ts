/**
 * Mise en forme des resultats. PUR. L'ecran et la note appellent ces memes
 * fonctions ; le CSV lit `lignesCsv`, la meme matiere en cellules.
 */

import { nombreFr, notationHtml, tauxFr } from 'aedificium-ui';
import type { DonneesEquilibre, ProfilEquilibre, Renversement, ResultatEquilibre } from '../../src/index';

export function messageDErreur(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const f = (x: number, d = 2) => nombreFr(x, d);

function celluleTaux(t: number): string {
  if (!Number.isFinite(t)) return '<td class="valeur refus">infini</td>';
  return `<td class="valeur ${t <= 1 ? 'ok' : 'refus'}">${tauxFr(t)}</td>`;
}

export function verdictHtml(r: ResultatEquilibre): string {
  return `<p class="verdict verdict-${r.verdict}">${r.verdict === 'conforme' ? 'Equilibre assure' : 'Equilibre non assure'}</p><p class="motif">${notationHtml(r.motif)}</p>`;
}

/** Tableau de synthese des verifications. */
export function tableauSynthese(r: ResultatEquilibre): string {
  const g = r.glissement;
  const lignes = [
    ...r.renversement.map(
      (x) =>
        `<tr><td>Renversement autour de l arete ${x.pivot} (x = ${f(x.x)} m)</td><td>EQU, EN 1990 tableau A1.2(A)</td>` +
        `<td class="valeur">${f(x.M_dst_d)} kN.m</td><td class="valeur">${f(x.M_stb_d)} kN.m</td>${celluleTaux(x.taux)}</tr>`
    ),
    `<tr><td>Glissement vers ${g.sens > 0 ? '+x' : '-x'}</td><td>STR/GEO, tableau A1.2(B), ${notationHtml('R_d = mu_d N_d')}</td>` +
      `<td class="valeur">${f(g.H_d)} kN</td><td class="valeur">${f(g.R_d)} kN (${notationHtml('N_d')} = ${f(g.N_d)})</td>${celluleTaux(g.taux)}</tr>`,
    `<tr><td>Soulevement</td><td>UPL, EN 1997-1 tableau A.15</td><td class="valeur">${f(r.soulevement.V_dst_d)} kN</td>` +
      `<td class="valeur">${f(r.soulevement.V_stb_d)} kN</td>${celluleTaux(r.soulevement.taux)}</tr>`,
  ].join('');
  return (
    '<div class="defilement"><table class="zones"><thead><tr><th>Verification</th><th>Coefficients</th><th>Destabilisant</th><th>Stabilisant</th><th>Taux</th></tr></thead>' +
    `<tbody>${lignes}</tbody></table></div>`
  );
}

/** Position de la resultante caracteristique sur la base. */
export function texteExcentricite(r: ResultatEquilibre): string {
  const e = r.excentricite;
  if (e === null) return 'Aucun effort normal de compression sur la base : position de la resultante sans objet.';
  const situation = e.noyauCentral
    ? 'dans le noyau central : base entierement comprimee'
    : e.dansLaBase
      ? 'hors du noyau central : decollement partiel de la base'
      : 'HORS DE LA BASE : l element bascule';
  return (
    `Resultante caracteristique (toutes actions a 1,0) : N = ${f(e.N)} kN, x_R = ${f(e.xR, 3)} m, ` +
    `e = ${f(e.e, 3)} m pour B / 6 = ${f(e.B / 6, 3)} m, ${situation}. Indication, sans verdict.`
  );
}

/** Le detail des moments autour d'une arete : bras de levier, role, coefficient. */
/** Sens de la charge en une fleche : →, ←, ↓, ↑, ou oblique. */
function sens(Fx: number, Fz: number): string {
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
  const lignes = x.lignes
    .map((l) => {
      const e = l.elementaire;
      const charge = e.C !== 0 ? `couple ${f(Math.abs(e.C))} kN.m` : `${f(l.F)} ${sens(e.Fx, e.Fz)}`;
      const stb = l.role === 'stabilisant' ? f(l.Md) : '';
      const dst = l.role === 'destabilisant' ? f(l.Md) : '';
      return (
        `<tr class="${l.role}"><td>${notationHtml(e.origine)}</td><td>${e.nature}</td><td class="valeur">${charge}</td>` +
        `<td class="valeur">${l.d === null ? '—' : f(l.d, 3)}</td><td class="valeur">${f(l.gamma)}</td>` +
        `<td class="valeur">${stb}</td><td class="valeur">${dst}</td></tr>`
      );
    })
    .join('');
  const somme =
    `<tr class="somme"><td colspan="5">Somme</td><td class="valeur">${f(x.M_stb_d)}</td><td class="valeur">${f(x.M_dst_d)}</td></tr>` +
    `<tr class="somme"><td colspan="5">Taux = somme destabilisante / somme stabilisante</td><td colspan="2" class="valeur ${x.taux <= 1 ? 'ok' : 'refus'}">` +
    `${Number.isFinite(x.taux) ? tauxFr(x.taux) : 'infini'}</td></tr>`;
  return (
    `<h3>Renversement autour de l arete ${x.pivot} (x = ${f(x.x)} m, z = ${f(x.z)} m)</h3>` +
    '<div class="defilement"><table class="zones moments"><thead><tr><th>Charge</th><th>G/Q</th><th>F<br>(kN)</th><th>Distance d<br>(m)</th>' +
    `<th>${notationHtml('gamma_f')}</th><th>M stabilisant<br>(kN.m)</th><th>M destabilisant<br>(kN.m)</th></tr></thead>` +
    `<tbody>${lignes}</tbody><tfoot>${somme}</tfoot></table></div>` +
    `<p class="note">${notationHtml('M = F × d × gamma_f ; d est la distance du pivot a la ligne d action de la charge.')}</p>`
  );
}

export function tableauProfil(p: ProfilEquilibre): string {
  const ligne = (nom: string, j: ProfilEquilibre['equ']) =>
    `<tr><td>${nom}</td><td class="valeur">${f(j.gG_dst.valeur)}</td><td class="valeur">${f(j.gG_stb.valeur)}</td><td class="valeur">${f(j.gQ_dst.valeur)}</td>` +
    `<td class="valeur">${f(j.gQ_stb.valeur)}</td><td class="clause">${notationHtml(j.gG_dst.source)}</td></tr>`;
  return (
    '<div class="defilement"><table class="zones"><thead><tr><th>Verification</th><th>G dst</th><th>G stb</th><th>Q dst</th><th>Q stb</th><th>Source</th></tr></thead><tbody>' +
    ligne('Renversement (EQU)', p.equ) +
    ligne('Glissement', p.glissement) +
    ligne('Soulevement (UPL)', p.upl) +
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
  const t = (x: number) => (Number.isFinite(x) ? tauxFr(x) : 'infini');
  const lignes: string[][] = [['Verification', 'Destabilisant', 'Stabilisant', 'Taux']];
  for (const x of r.renversement) lignes.push([`Renversement, arete ${x.pivot}`, f(x.M_dst_d), f(x.M_stb_d), t(x.taux)]);
  lignes.push([`Glissement vers ${r.glissement.sens > 0 ? '+x' : '-x'}`, f(r.glissement.H_d), f(r.glissement.R_d), t(r.glissement.taux)]);
  lignes.push(['Soulevement', f(r.soulevement.V_dst_d), f(r.soulevement.V_stb_d), t(r.soulevement.taux)]);
  lignes.push([]);
  for (const x of r.renversement) {
    lignes.push([]);
    lignes.push([`Renversement autour de l arete ${x.pivot}`]);
    lignes.push(['Charge', 'G/Q', 'F (kN)', 'couple (kN.m)', 'Distance d (m)', 'gamma_f', 'M stabilisant (kN.m)', 'M destabilisant (kN.m)']);
    for (const l of x.lignes) {
      const e = l.elementaire;
      lignes.push([
        e.origine,
        e.nature,
        e.C !== 0 ? '' : f(l.F),
        e.C !== 0 ? f(Math.abs(e.C)) : '',
        l.d === null ? '' : f(l.d, 3),
        f(l.gamma),
        l.role === 'stabilisant' ? f(l.Md) : '',
        l.role === 'destabilisant' ? f(l.Md) : '',
      ]);
    }
    lignes.push(['Somme', '', '', '', '', '', f(x.M_stb_d), f(x.M_dst_d)]);
  }
  return lignes;
}

/** Les donnees lues, pour la note : segments, charges, base. */
export function tableauEntrees(d: DonneesEquilibre): string {
  const seg = d.segments
    .map((s) => `<tr><td>${notationHtml(s.id)}</td><td class="valeur">(${f(s.x1)} ; ${f(s.z1)}) → (${f(s.x2)} ; ${f(s.z2)})</td><td class="valeur">${f(s.e)}</td><td class="valeur">${f(s.gamma, 1)}</td></tr>`)
    .join('');
  const ch = d.charges
    .map((c) => {
      const desc =
        c.type === 'ponctuelle'
          ? `ponctuelle en (${f(c.x)} ; ${f(c.z)}) : F_x = ${f(c.Fx)} kN, F_z = ${f(c.Fz)} kN vers le bas`
          : c.type === 'moment'
            ? `moment ${f(c.M)} kN.m (trigonometrique)`
            : `${c.direction} de (${f(c.xa)} ; ${f(c.za)}) a (${f(c.xb)} ; ${f(c.zb)}) : q = ${f(c.qa)} a ${f(c.qb)} kN/m`;
      return `<tr><td>${notationHtml(c.id)}</td><td>${c.nature}</td><td>${notationHtml(desc)}</td></tr>`;
    })
    .join('');
  return (
    `<h3>Segments</h3><div class="defilement"><table class="zones"><thead><tr><th>Id</th><th>Axe (m)</th><th>e (m)</th><th>${notationHtml('gamma (kN/m3)')}</th></tr></thead>` +
    `<tbody>${seg}</tbody></table></div>` +
    '<h3>Charges</h3><div class="defilement"><table class="zones"><thead><tr><th>Id</th><th>G/Q</th><th>Description</th></tr></thead>' +
    `<tbody>${ch}</tbody></table></div>` +
    `<p class="note">${notationHtml(`Base de x = ${f(d.base.xg)} a ${f(d.base.xd)} m, z = ${f(d.base.z)} m ; mu_d = ${f(d.mu, 3)} ; profondeur ${f(d.profondeur)} m.`)}</p>`
  );
}
