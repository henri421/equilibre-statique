/**
 * equilibre-statique — noyau de calcul.
 *
 * Equilibre statique d'un element plan a l'ELU : renversement (EQU),
 * glissement, soulevement (UPL), position de la resultante sur la base.
 */

export { profilRecommande, verifierProfil, type JeuEquilibre, type ProfilEquilibre, type ValeurSourcee } from './profil';
export {
  actionsElementaires,
  verifierEquilibre,
  type Base,
  type Charge,
  type DonneesEquilibre,
  type Elementaire,
  type Excentricite,
  type Glissement,
  type LigneMoment,
  type NatureAction,
  type Renversement,
  type ResultatEquilibre,
  type Segment,
  type Soulevement,
} from './equilibre';
