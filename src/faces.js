// Faces des cartes.
//
// Les figures (valet, dame, roi) sont les vraies cartes du portrait officiel français
// (jeu SVG de David Bellot, LGPL 2.1 ou ultérieure) : voir assets/figures/.
// Les cartes chiffrées sont composées ici, dans la même géométrie et avec les mêmes
// symboles d'enseigne, pour que l'ensemble forme un jeu cohérent.

import { RANK_LABEL, SUIT_COLOR } from './cards.js';
import { PIPS } from './pips.js';

const VUE = '0 0 167.09 242.67';
const CENTRE_X = 83.545;
const CENTRE_Y = 121.335;

const NOM_FIGURE = { V: 'Jack', D: 'Queen', R: 'King' };
const NOM_COULEUR = { pique: 'spades', coeur: 'hearts', carreau: 'diamonds', trefle: 'clubs' };

const ENCRE = { rouge: '#e6180a', noir: '#000000' };

// Contour repris des cartes d'origine ; comme sur elles, le filet intérieur est retiré.
const CADRE = `
  <path fill="#fff" stroke="#000" stroke-width=".5" d="M166.84 235.55a6.89 6.89 0 0 1-6.87 6.87H7.11a6.89 6.89 0 0 1-6.86-6.87V7.12A6.89 6.89 0 0 1 7.11.25H160a6.89 6.89 0 0 1 6.87 6.87z"/>`;

// Colonnes et lignes de la disposition classique des pips.
const COLONNES = [48, 119];
const LIGNES = [55, 77.2, 99.3, 121.3, 143.4, 165.5, 187.6];

// `lignes` : indices de lignes garnies sur les deux colonnes ; `milieu` : ordonnées
// des pips de la colonne centrale. Disposition classique d'un jeu français.
const DISPOSITIONS = {
  A: { lignes: [], milieu: [121.3], echelle: 3.9 },
  2: { lignes: [], milieu: [55, 187.6] },
  3: { lignes: [], milieu: [55, 121.3, 187.6] },
  4: { lignes: [0, 6], milieu: [] },
  5: { lignes: [0, 6], milieu: [121.3] },
  6: { lignes: [0, 3, 6], milieu: [] },
  7: { lignes: [0, 3, 6], milieu: [88] },
  8: { lignes: [0, 3, 6], milieu: [88, 154.6] },
  9: { lignes: [0, 2, 4, 6], milieu: [121.3] },
  10: { lignes: [0, 2, 4, 6], milieu: [88, 154.6] },
};

// En petite taille, les figures deviennent illisibles : on leur substitue une face
// sobre — index d'angle et grande enseigne centrale.
const FIGURE_SOBRE = { lignes: [], milieu: [121.3], echelle: 3.4 };

/** Un pip posé en (x, y) ; ceux de la moitié basse sont retournés, comme sur un vrai jeu. */
function pip(suit, x, y, echelle = 1.78, retourner = y > CENTRE_Y) {
  const rotation = retourner ? ' rotate(180)' : '';
  return `<g transform="translate(${x} ${y}) scale(${echelle})${rotation}">${PIPS[suit]}</g>`;
}

/** Index d'angle : la valeur puis un petit pip, dans la réserve blanche du coin. */
function index(carte) {
  const encre = ENCRE[SUIT_COLOR[carte.suit]];
  const valeur = RANK_LABEL[carte.rank];
  const taille = valeur.length > 1 ? 21 : 25;
  const bloc = `
    <text x="16.6" y="30" text-anchor="middle" fill="${encre}"
          font-family="Arial, Helvetica, sans-serif" font-size="${taille}" font-weight="700">${valeur}</text>
    ${pip(carte.suit, 16.6, 42.5, 0.8, false)}`;
  return `${bloc}<g transform="rotate(180 ${CENTRE_X} ${CENTRE_Y})">${bloc}</g>`;
}

export function estFigure(carte) {
  return carte.rank in NOM_FIGURE;
}

export function urlFigure(carte) {
  return `assets/figures/${NOM_FIGURE[carte.rank]}_of_${NOM_COULEUR[carte.suit]}_fr.svg`;
}

/**
 * Face complète d'une carte, en HTML prêt à insérer.
 * @param {boolean} sobre - true pour les petites tailles : pas d'illustration.
 */
export function faceCarte(carte, sobre = false) {
  if (estFigure(carte) && !sobre) {
    return `<img class="face" src="${urlFigure(carte)}" alt="" draggable="false">`;
  }

  const { lignes, milieu, echelle } = DISPOSITIONS[carte.rank] ?? FIGURE_SOBRE;
  const pips = [
    ...lignes.flatMap((i) => COLONNES.map((x) => pip(carte.suit, x, LIGNES[i]))),
    ...milieu.map((y) => pip(carte.suit, CENTRE_X, y, echelle)),
  ].join('');

  return `<svg class="face" viewBox="${VUE}" aria-hidden="true">${CADRE}${index(carte)}${pips}</svg>`;
}
