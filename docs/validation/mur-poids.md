# Cas de validation : mur poids sous poussée triangulaire

Mur 1 m × 3 m, béton 24 kN/m³, base de x = 0 à 1 m à z = 0 ; poussée horizontale vers +x sur la
face gauche, 30 kN/m au pied, nulle en tête. μ_d = 0,5.

- Poids W = 24 × 1 × 3 = 72 kN en (0,5 ; 1,5) ; poussée R = 30 × 3 / 2 = 45 kN à z = 1 m.
- Renversement autour de l'arête droite (x = 1 m) :
  - poussée : M = −1 × 45 = −45 kN·m, déstabilisante, × 1,1 = **49,5 kN·m** ;
  - poids : M = (0,5 − 1) × (−72) = +36 kN·m, stabilisant, × 0,9 = **32,4 kN·m** ;
  - taux 49,5 / 32,4 = **1,528** : non conforme.
- Glissement vers +x : H_d = 1,35 × 45 = 60,75 kN ; R_d = 0,5 × 72 = 36 kN ; taux **1,688**.
- Résultante caractéristique : x_R = 0,5 + 45 / 72 = **1,125 m**, hors de la base.

Tests : `tests/equilibre.test.ts`.
