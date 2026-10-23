# equilibre-statique

Équilibre statique d'un élément plan à l'ELU : **bras de levier**, actions **stabilisantes et
déstabilisantes**, **renversement** (EQU), **glissement**, **soulèvement** (UPL) et position de la
résultante sur la base.

Fait partie de la suite [Aedificium web](https://henri421.github.io/WebAedificium/).
Page publiée : <https://henri421.github.io/equilibre-statique/>.

> **Aide au calcul. L'outil constate, il ne prescrit pas.** Coefficients recommandés de
> l'EN 1990 et de l'EN 1997-1, sans annexe nationale. Seul l'équilibre est vérifié : ni portance
> du sol, ni résistance des éléments.

## Saisie

- **Segments pesants** (L, U, cadres, formes quelconques représentées en 1D) : axe, épaisseur,
  poids volumique ; le poids propre est calculé.
- **Base** : arêtes gauche et droite, cote, frottement de calcul μ_d.
- **Charges** : ponctuelles, réparties, triangulaires, trapézoïdales (deux intensités le long
  d'un segment, verticales ou horizontales), moments ; chacune permanente G ou variable Q.

## Ce que l'outil rend

- Chaque action élémentaire (poids d'un segment, charge ponctuelle, chaque triangle d'une charge
  linéaire, moment) avec son **bras de levier** par rapport à chaque arête, son moment, son
  **rôle** (stabilisant ou déstabilisant) et son coefficient.
- **Renversement** autour de chaque arête de la base : EN 1990 tableau A1.2(A), γ_G = 1,10 / 0,90,
  γ_Q = 1,5 / 0.
- **Glissement** dans les deux sens : tableau A1.2(B), H_d ≤ μ_d N_d, μ_d saisi (coefficients du
  sol compris).
- **Soulèvement** : EN 1997-1 tableau A.15 (UPL).
- **Position de la résultante** caractéristique sur la base : excentricité, noyau central,
  décollement (indication sans verdict).
- Schéma (SVG), résultats (CSV), note de calcul produite par les mêmes fonctions que l'écran.

## Développement

```bash
npm install
npm run typecheck
npm test
npm run build
```
