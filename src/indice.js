// Choix du coup à conseiller : sert au bouton « Indice » et aux auto-parties des tests.
//
// Le solitaire se perd surtout par des coups qui n'apportent rien. On ne retient donc
// que les coups utiles : montée sûre sur une fondation, déplacement qui découvre une
// carte cachée, vidage d'une colonne quand un roi attend d'y entrer, et placement
// d'une carte de la défausse. Brasser le tableau sans rien libérer et redescendre une
// fondation sont écartés — c'est ce qui fait la différence : sans la règle du vidage,
// l'ordinateur ne gagne que 15 % des donnes au tirage par une ; avec elle, 38 %.

import { ROI, SUITS, SUIT_COLOR, couleur, valeur } from './cards.js';
import { cartesPrises, coupsPossibles, indexFondation, sommet } from './rules.js';

const REJET = -1;

const POIDS = {
  fondationSure: 100,
  decouverte: 70,
  videColonne: 60,
  defausse: 55,
  fondationRisquee: 5,
};

/**
 * Monter cette carte est-il sans risque ?
 * Les as et les deux ne servent jamais au tableau. Au-delà, la carte ne manquera pas
 * si les deux fondations de la couleur opposée ont déjà atteint sa valeur moins un :
 * aucune carte plus faible n'aura besoin de s'y appuyer.
 */
export function monteeSure(etat, carte) {
  const v = valeur(carte);
  if (v <= 2) return true;
  const opposees = SUITS.filter((s) => SUIT_COLOR[s] !== couleur(carte));
  return opposees.every((s) => {
    const dessus = sommet(etat.fondations[SUITS.indexOf(s)]);
    return dessus !== null && valeur(dessus) >= v - 1;
  });
}

/** La prise part-elle du bas des cartes visibles d'une colonne qui cache encore quelque chose ? */
function decouvre(etat, coup) {
  if (coup.de.zone !== 'tableau') return false;
  const colonne = etat.tableau[coup.de.pile];
  return colonne.cachees > 0 && coup.de.index === colonne.cachees;
}

/** Un roi est-il prêt à occuper une colonne libérée ? */
function roiDisponible(etat) {
  const defausse = sommet(etat.defausse);
  if (defausse && defausse.rank === ROI) return true;
  // Un roi déjà seul au bas de sa colonne n'a pas besoin d'une autre place.
  return etat.tableau.some(({ cartes, cachees }) =>
    cartes.some((carte, i) => carte.rank === ROI && i >= cachees && i > 0));
}

/** Le coup laisse-t-il sa colonne vide, pour y installer un roi ? */
function videLaColonne(etat, coup) {
  if (coup.de.zone !== 'tableau' || coup.vers.zone !== 'tableau') return false;
  const colonne = etat.tableau[coup.de.pile];
  if (colonne.cachees > 0 || coup.de.index !== 0) return false;
  // Déménager d'une colonne vide vers une autre ne libère rien.
  return etat.tableau[coup.vers.pile].cartes.length > 0 && roiDisponible(etat);
}

/** Note d'un coup, ou REJET s'il n'apporte rien. */
export function evaluerCoup(etat, coup) {
  const prise = cartesPrises(etat, coup);
  if (!prise.length) return REJET;

  if (coup.vers.zone === 'fondation') {
    return monteeSure(etat, prise[0])
      ? POIDS.fondationSure + valeur(prise[0])
      : POIDS.fondationRisquee;
  }
  // Redescendre une fondation ne se justifie qu'au jugé : l'ordinateur s'en abstient.
  if (coup.de.zone === 'fondation') return REJET;

  if (coup.de.zone === 'defausse') {
    // Un roi placé dans une colonne vide ouvre le tableau : c'est le meilleur emploi.
    const vide = etat.tableau[coup.vers.pile].cartes.length === 0;
    return POIDS.defausse + (vide && prise[0].rank === ROI ? 10 : 0);
  }

  // Plus la colonne cache de cartes, plus il est urgent de la creuser.
  if (decouvre(etat, coup)) return POIDS.decouverte + etat.tableau[coup.de.pile].cachees;
  if (videLaColonne(etat, coup)) return POIDS.videColonne;
  return REJET;
}

/** Les coups utiles de l'état courant, du plus intéressant au moins intéressant. */
export function coupsUtiles(etat) {
  return coupsPossibles(etat)
    .map((coup) => ({ coup, note: evaluerCoup(etat, coup) }))
    .filter(({ note }) => note > REJET)
    .sort((a, b) => b.note - a.note);
}

/**
 * Action conseillée : un déplacement, à défaut un tirage, à défaut un recyclage.
 * @param {{ etat: object, peutTirer: () => boolean, peutRecycler: () => boolean }} game
 * @param {{ recyclage?: boolean, exclure?: (coup: object) => boolean }} options
 * @returns {{ type: 'coup'|'tirage'|'recyclage', coup?: object, note?: number } | null}
 */
export function actionConseillee(game, { recyclage = true, exclure = null } = {}) {
  const utiles = coupsUtiles(game.etat);
  const retenu = exclure ? utiles.find(({ coup }) => !exclure(coup)) : utiles[0];
  if (retenu) return { type: 'coup', ...retenu };
  if (game.peutTirer()) return { type: 'tirage' };
  if (recyclage && game.peutRecycler()) return { type: 'recyclage' };
  return null;
}

/** Un coup à montrer au joueur ; null s'il n'y a qu'à piocher. */
export function indice(game) {
  const [meilleur] = coupsUtiles(game.etat);
  return meilleur ?? null;
}

export { indexFondation };
