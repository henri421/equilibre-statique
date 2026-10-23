/**
 * Mise en forme des resultats. PUR. L'ecran et la note appellent ces memes
 * fonctions ; le CSV lit `lignesCsv`, la meme matiere en cellules.
 */

import { echapper, nombreFr, tauxFr } from 'aedificium-ui';
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
  return `<p class="verdict verdict-${r.verdict}">${r.verdict === 'conforme' ? 'Equilibre assure' : 'Equilibre non assure'}</p><p class="motif">${echapper(r.motif)}</p>`;
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
    `<tr><td>Glissement vers ${g.sens > 0 ? '+x' : '-x'}</td><td>STR/GEO, tableau A1.2(B), R_d = mu_d N_d</td>` +
      `<td class="valeur">${f(g.H_d)} kN</td><td class="valeur">${f(g.R_d)} kN (N_d = ${f(g.N_d)})</td>${celluleTaux(g.taux)}</tr>`,
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
export function tableauMoments(x: Renversement): string {
  const lignes = x.lignes
    .map((l) => {
      const e = l.elementaire;
      const effort = e.C !== 0 ? `couple ${f(e.C)} kN.m` : `F_x ${f(e.Fx)} ; F_z ${f(-e.Fz)} vers le bas`;
      return (
        `<tr class="${l.role}"><td>${echapper(e.origine)}</td><td>${e.nature}</td><td>${effort}</td>` +
        `<td class="valeur">${e.C !== 0 ? '—' : `${f(l.dx)} ; ${f(l.dz)}`}</td><td class="valeur">${f(l.M)}</td>` +
        `<td>${l.role}</td><td class="valeur">${f(l.gamma)}</td><td class="valeur">${f(l.Md)}</td></tr>`
      );
    })
    .join('');
  return (
    `<h3>Moments autour de l arete ${x.pivot} (x = ${f(x.x)} m, z = ${f(x.z)} m)</h3>` +
    '<div class="defilement"><table class="zones"><thead><tr><th>Action</th><th>G/Q</th><th>Effort (kN)</th><th>Bras dx ; dz (m)</th>' +
    `<th>M (kN.m)</th><th>Role</th><th>gamma</th><th>M_d (kN.m)</th></tr></thead><tbody>${lignes}</tbody></table></div>`
  );
}

export function tableauProfil(p: ProfilEquilibre): string {
  const ligne = (nom: string, j: ProfilEquilibre['equ']) =>
    `<tr><td>${nom}</td><td class="valeur">${f(j.gG_dst.valeur)}</td><td class="valeur">${f(j.gG_stb.valeur)}</td><td class="valeur">${f(j.gQ_dst.valeur)}</td>` +
    `<td class="valeur">${f(j.gQ_stb.valeur)}</td><td class="clause">${echapper(j.gG_dst.source)}</td></tr>`;
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
    `<p class="note">${echapper(texteExcentricite(r))}</p>` +
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
  lignes.push(['Arete', 'Action', 'G/Q', 'F_x (kN)', 'F_z bas (kN)', 'couple (kN.m)', 'dx (m)', 'dz (m)', 'M (kN.m)', 'role', 'gamma', 'M_d (kN.m)']);
  for (const x of r.renversement) {
    for (const l of x.lignes) {
      const e = l.elementaire;
      lignes.push([x.pivot, e.origine, e.nature, f(e.Fx), f(-e.Fz), f(e.C), f(l.dx), f(l.dz), f(l.M), l.role, f(l.gamma), f(l.Md)]);
    }
  }
  return lignes;
}

/** Les donnees lues, pour la note : segments, charges, base. */
export function tableauEntrees(d: DonneesEquilibre): string {
  const seg = d.segments
    .map((s) => `<tr><td>${echapper(s.id)}</td><td class="valeur">(${f(s.x1)} ; ${f(s.z1)}) → (${f(s.x2)} ; ${f(s.z2)})</td><td class="valeur">${f(s.e)}</td><td class="valeur">${f(s.gamma, 1)}</td></tr>`)
    .join('');
  const ch = d.charges
    .map((c) => {
      const desc =
        c.type === 'ponctuelle'
          ? `ponctuelle en (${f(c.x)} ; ${f(c.z)}) : F_x = ${f(c.Fx)} kN, F_z = ${f(c.Fz)} kN vers le bas`
          : c.type === 'moment'
            ? `moment ${f(c.M)} kN.m (trigonometrique)`
            : `${c.direction} de (${f(c.xa)} ; ${f(c.za)}) a (${f(c.xb)} ; ${f(c.zb)}) : q = ${f(c.qa)} a ${f(c.qb)} kN/m`;
      return `<tr><td>${echapper(c.id)}</td><td>${c.nature}</td><td>${echapper(desc)}</td></tr>`;
    })
    .join('');
  return (
    '<h3>Segments</h3><div class="defilement"><table class="zones"><thead><tr><th>Id</th><th>Axe (m)</th><th>e (m)</th><th>gamma (kN/m3)</th></tr></thead>' +
    `<tbody>${seg}</tbody></table></div>` +
    '<h3>Charges</h3><div class="defilement"><table class="zones"><thead><tr><th>Id</th><th>G/Q</th><th>Description</th></tr></thead>' +
    `<tbody>${ch}</tbody></table></div>` +
    `<p class="note">Base de x = ${f(d.base.xg)} a ${f(d.base.xd)} m, z = ${f(d.base.z)} m ; mu_d = ${f(d.mu, 3)} ; profondeur ${f(d.profondeur)} m.</p>`
  );
}
