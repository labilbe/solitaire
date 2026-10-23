// Règles du Klondike : empilements autorisés, séquences déplaçables, coups légaux
// et barème de score. Fonctions pures — aucune ne modifie l'état reçu.

import { AS, ROI, SUITS, couleur, valeur } from './cards.js';

export const NB_COLONNES = 7;
export const NB_FONDATIONS = 4;
export const CARTES_TOTAL = 52;

// Barème « standard » (celui du solitaire de Windows), appliqué à chaque coup.
export const POINTS = {
  defausseVersTableau: 5,
  versFondation: 10,
  retournement: 5,
  fondationVersTableau: -15,
  recyclage: { 1: -100, 3: -20 },
};

/** Fondation d'une carte : une par enseigne, dans l'ordre de SUITS. */
export function indexFondation(carte) {
  return SUITS.indexOf(carte.suit);
}

export function sommet(pile) {
  return pile.length ? pile[pile.length - 1] : null;
}

/** Sur le tableau, on empile en descendant et en alternant les couleurs ; une colonne vide n'accepte qu'un roi. */
export function peutEmpilerTableau(carte, colonne) {
  const cible = sommet(colonne.cartes);
  if (!cible) return carte.rank === ROI;
  if (colonne.cachees >= colonne.cartes.length) return false;
  return couleur(carte) !== couleur(cible) && valeur(carte) === valeur(cible) - 1;
}

/** Sur une fondation, on monte de l'as au roi dans une seule enseigne. */
export function peutEmpilerFondation(carte, fondation) {
  const cible = sommet(fondation);
  if (!cible) return carte.rank === AS;
  return carte.suit === cible.suit && valeur(carte) === valeur(cible) + 1;
}

/** Une suite déplaçable : valeurs décroissantes et couleurs alternées. */
export function sequenceValide(cartes) {
  for (let i = 1; i < cartes.length; i++) {
    const haut = cartes[i - 1];
    const bas = cartes[i];
    if (valeur(bas) !== valeur(haut) - 1 || couleur(bas) === couleur(haut)) return false;
  }
  return true;
}

/** La carte d'index `i` d'une colonne est-elle visible et en tête d'une suite déplaçable ? */
export function prisePossible(colonne, i) {
  if (i < colonne.cachees || i >= colonne.cartes.length) return false;
  return sequenceValide(colonne.cartes.slice(i));
}

/** Les cartes qu'un coup emporte, sans toucher à l'état : [] si la prise est illégale. */
export function cartesPrises(etat, coup) {
  const { zone, pile = 0, index = 0 } = coup.de;
  if (zone === 'defausse') {
    const carte = sommet(etat.defausse);
    return carte ? [carte] : [];
  }
  if (zone === 'fondation') {
    const carte = sommet(etat.fondations[pile]);
    return carte ? [carte] : [];
  }
  if (zone === 'tableau') {
    const colonne = etat.tableau[pile];
    return prisePossible(colonne, index) ? colonne.cartes.slice(index) : [];
  }
  return [];
}

/** La destination accepte-t-elle cette prise ? */
export function destinationAccepte(etat, coup, prise) {
  if (!prise.length) return false;
  const { zone, pile = 0 } = coup.vers;
  if (zone === 'fondation') {
    // Les fondations ne reçoivent qu'une carte à la fois, et dans leur enseigne.
    if (prise.length !== 1 || pile !== indexFondation(prise[0])) return false;
    return peutEmpilerFondation(prise[0], etat.fondations[pile]);
  }
  if (zone === 'tableau') {
    if (coup.de.zone === 'tableau' && coup.de.pile === pile) return false;
    return peutEmpilerTableau(prise[0], etat.tableau[pile]);
  }
  return false;
}

export function coupValide(etat, coup) {
  const prise = cartesPrises(etat, coup);
  return destinationAccepte(etat, coup, prise);
}

/** Toutes les origines jouables : sommet de la défausse, des fondations, suites du tableau. */
function origines(etat) {
  const liste = [];
  if (etat.defausse.length) liste.push({ zone: 'defausse' });
  etat.fondations.forEach((f, pile) => {
    if (f.length) liste.push({ zone: 'fondation', pile });
  });
  etat.tableau.forEach((colonne, pile) => {
    for (let index = colonne.cachees; index < colonne.cartes.length; index++) {
      if (prisePossible(colonne, index)) liste.push({ zone: 'tableau', pile, index });
    }
  });
  return liste;
}

/** Tous les déplacements de cartes légaux dans l'état courant (hors tirage et recyclage). */
export function coupsPossibles(etat) {
  const coups = [];
  for (const de of origines(etat)) {
    const prise = cartesPrises(etat, { de });
    if (!prise.length) continue;
    const cible = { zone: 'fondation', pile: indexFondation(prise[0]) };
    if (destinationAccepte(etat, { de, vers: cible }, prise)) {
      coups.push({ de, vers: cible, n: prise.length });
    }
    for (let pile = 0; pile < NB_COLONNES; pile++) {
      const vers = { zone: 'tableau', pile };
      if (destinationAccepte(etat, { de, vers }, prise)) coups.push({ de, vers, n: prise.length });
    }
  }
  return coups;
}

export function peutTirer(etat) {
  return etat.talon.length > 0;
}

/** Le talon épuisé se recharge avec la défausse retournée, autant de fois qu'on veut. */
export function peutRecycler(etat) {
  return etat.talon.length === 0 && etat.defausse.length > 0;
}

export function estGagne(etat) {
  return etat.fondations.reduce((n, f) => n + f.length, 0) === CARTES_TOTAL;
}

/** Plus aucune carte cachée : la fin de partie est mécanique, on peut la dérouler. */
export function estDeroulable(etat) {
  return (
    !estGagne(etat) &&
    etat.talon.length === 0 &&
    etat.defausse.length <= 1 &&
    etat.tableau.every((c) => c.cachees === 0)
  );
}

/** Nombre de cartes posées sur les fondations. */
export function cartesPlacees(etat) {
  return etat.fondations.reduce((n, f) => n + f.length, 0);
}
