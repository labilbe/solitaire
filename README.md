# Solitaire

Le **solitaire Klondike** — la réussite du jeu de 52 cartes —, jouable directement dans le
navigateur. Aucun serveur, aucune dépendance : du HTML, du CSS et des modules JavaScript natifs.

▶️ **Jouer : https://labilbe.github.io/solitaire/**

## Règles appliquées

- Sept colonnes reçoivent 1, 2, … 7 cartes ; seule la dernière de chaque colonne est retournée.
  Les 24 cartes restantes forment le **talon**.
- But : monter les quatre **fondations**, une par enseigne, de l'as au roi.
- Sur le **tableau**, on empile en descendant et en alternant les couleurs (un 9 rouge sur un
  10 noir). Une colonne vide n'accepte qu'un roi.
- Une suite déjà ordonnée se déplace d'un bloc, en la prenant par la carte voulue.
- Découvrir la carte du bas d'une colonne la retourne aussitôt.
- Le talon se tire **carte par carte** ou **par trois**, au choix ; seule la carte du dessus de la
  défausse est jouable. Le talon épuisé se recharge avec la défausse, autant de fois qu'on veut.
- Une carte peut redescendre d'une fondation vers le tableau si elle y est utile.
- **Score** (barème classique) : +10 par carte montée sur une fondation, +5 pour une carte de la
  défausse posée sur le tableau, +5 par carte retournée, −15 pour une carte redescendue d'une
  fondation, −100 (tirage 1) ou −20 (tirage 3) à chaque rechargement du talon. Le score ne
  descend pas sous zéro. Une partie gagnée vaut 600 points et plus.
- Quand toutes les cartes sont visibles et le talon vide, la fin est mécanique : le jeu monte
  les dernières cartes tout seul.

## Jouer

- **Un clic** envoie la carte à sa place évidente : sa fondation d'abord, sinon une colonne qui
  l'accepte (une colonne garnie avant une colonne vide, qu'on garde pour les rois).
- **Le glisser-déposer** permet de choisir soi-même la destination ; les emplacements qui
  acceptent la prise s'allument pendant le déplacement. C'est le seul moyen de faire redescendre
  une carte d'une fondation — un clic ne défait pas ce qui est rangé.
- **Annuler** revient en arrière sans limite, jusqu'à la donne initiale.
- **Indice** met en valeur un coup utile ; s'il n'y en a pas, il invite à piocher.
- Au clavier : les cartes jouables sont atteignables au `Tab`, `Entrée` ou `Espace` les joue.

## Jouer en local

Les modules ES imposent de servir les fichiers par HTTP (un simple `file://` ne suffit pas) :

```bash
npm start            # ou : npx serve . / python -m http.server 8000
```

puis ouvrir `http://localhost:1986`.

## Tests

Le moteur est vérifié par des tests unitaires (empilements du tableau et des fondations, suites
déplaçables, distribution, tirage et recyclage, barème de score, annulation, détection de la
victoire et du blocage) puis par auto-parties : 200 donnes déroulées par l'ordinateur dans chaque
mode de tirage, en contrôlant la légalité de chaque coup, les invariants du paquet (52 cartes, pas
de doublon, cartes cachées toujours au-dessous, fondations bien ordonnées) et un taux de réussite
plausible — **35 %** des donnes au tirage par une, **9,5 %** au tirage par trois.

```bash
npm test
```

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `src/cards.js` | Jeu de 52 cartes, enseignes, rangs et valeurs. |
| `src/rules.js` | Empilements autorisés, suites déplaçables, coups légaux, barème de score. |
| `src/game.js` | Moteur : distribution, coups, tirage, annulation, déroulé final. |
| `src/indice.js` | Choix du coup utile : bouton « Indice » et auto-parties des tests. |
| `src/faces.js` | Faces des cartes : figures du portrait français, chiffrées composées. |
| `src/pips.js` | Symboles d'enseigne (pique, cœur, carreau, trèfle). |
| `src/ui.js` | Rendu du tapis, clic, glisser-déposer, chronomètre. |

L'état tient dans une donnée simple et clonable : sept colonnes `{ cartes, cachees }` — les cartes
cachées étant toujours au-dessous, un seul compteur suffit —, quatre fondations, le talon et la
défausse. L'annulation se contente d'empiler des copies de cet état.

Le conseiller n'examine que les coups qui apportent quelque chose : montée **sûre** sur une
fondation (la carte ne peut plus servir au tableau), déplacement qui découvre une carte cachée,
vidage d'une colonne quand un roi attend d'y entrer, et placement d'une carte de la défausse.
Cette dernière règle fait toute la différence : sans elle, l'ordinateur ne gagne que 15 % des
donnes au tirage par une, contre 35 % avec.

## Cartes

Les figures sont les vraies cartes du **portrait officiel français** (jeu SVG de David Bellot,
récupérées sur Wikimedia Commons) ; les cartes chiffrées sont composées dans la même géométrie
et avec les mêmes symboles d'enseigne, pour que le jeu reste cohérent.
En dessous de 900 px de large, les cartes rétrécissent et les figures illustrées cèdent la place
à une face sobre (index et grande enseigne), plus lisible — les images ne sont alors pas chargées.
Crédits et licence (LGPL 2.1 ou ultérieure) : `assets/figures/CREDITS.md`.

Publié via GitHub Pages depuis la branche `main` (fichier `.nojekyll` pour servir le dossier tel quel).
