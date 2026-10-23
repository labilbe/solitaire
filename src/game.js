// Moteur du solitaire Klondike : distribution, coups, annulation, score.
//
// L'état est une donnée simple et clonable :
//   tableau    — 7 colonnes { cartes, cachees } ; les cartes cachées sont toujours au-dessous.
//   fondations — 4 piles, une par enseigne, de l'as au roi.
//   talon      — pioche face cachée ; on tire depuis sa fin.
//   defausse   — cartes tirées, la dernière est visible et jouable.

import { cardLabel, newDeck, shuffle } from './cards.js';
import {
  CARTES_TOTAL, NB_COLONNES, NB_FONDATIONS, POINTS,
  cartesPlacees, cartesPrises, coupValide, coupsPossibles, destinationAccepte,
  estDeroulable, estGagne, indexFondation, peutRecycler, peutTirer, sommet,
} from './rules.js';

export const TIRAGES = [1, 3];
const JOURNAL_MAX = 40;

const ZONE_LABEL = {
  tableau: 'le tableau',
  fondation: 'une fondation',
  defausse: 'la défausse',
};

function cloner(etat) {
  return {
    tableau: etat.tableau.map((c) => ({ cartes: c.cartes.slice(), cachees: c.cachees })),
    fondations: etat.fondations.map((f) => f.slice()),
    talon: etat.talon.slice(),
    defausse: etat.defausse.slice(),
    score: etat.score,
    coups: etat.coups,
    passes: etat.passes,
  };
}

export class Game {
  /**
   * @param {{ tirage?: 1|3, rng?: () => number }} options
   */
  constructor({ tirage = 1, rng = Math.random } = {}) {
    this.tirage = TIRAGES.includes(tirage) ? tirage : 1;
    this.rng = rng;
    this.nouvellePartie();
  }

  /** Nouvelle donne ; `donne` permet de rejouer un paquet connu (tests, parties fixées). */
  nouvellePartie(donne = shuffle(newDeck(), this.rng)) {
    const cartes = donne.slice();
    const tableau = [];
    // Distribution classique : 1 carte dans la 1re colonne, 2 dans la 2e, … 7 dans la 7e.
    for (let i = 0; i < NB_COLONNES; i++) {
      const paquet = cartes.splice(0, i + 1);
      tableau.push({ cartes: paquet, cachees: paquet.length - 1 });
    }
    this.etat = {
      tableau,
      fondations: Array.from({ length: NB_FONDATIONS }, () => []),
      talon: cartes,
      defausse: [],
      score: 0,
      coups: 0,
      passes: 0,
    };
    this.historique = [];
    this.journal = [];
    this.gagne = false;
    this.debut = null;
    this.fin = null;
    return this.etat;
  }

  // ---------------------------------------------------------------- Lecture

  get score() { return Math.max(0, this.etat.score); }
  get coups() { return this.etat.coups; }
  get passes() { return this.etat.passes; }
  get placees() { return cartesPlacees(this.etat); }
  get restantes() { return CARTES_TOTAL - this.placees; }
  get peutAnnuler() { return this.historique.length > 0; }

  coupsPossibles() { return coupsPossibles(this.etat); }
  peutTirer() { return peutTirer(this.etat); }
  peutRecycler() { return peutRecycler(this.etat); }
  estDeroulable() { return estDeroulable(this.etat); }
  cartesPrises(coup) { return cartesPrises(this.etat, coup); }
  coupValide(coup) { return coupValide(this.etat, coup); }

  /** Y a-t-il encore quelque chose à tenter ? Sinon la partie est perdue. */
  estBloquee() {
    if (this.gagne) return false;
    return !this.peutTirer() && !this.peutRecycler() && this.coupsPossibles().length === 0;
  }

  // --------------------------------------------------------------- Écriture

  noter(texte) {
    this.journal.push(texte);
    if (this.journal.length > JOURNAL_MAX) this.journal.shift();
  }

  /** Mémorise l'état avant un coup ; le premier coup lance le chronomètre. */
  memoriser() {
    this.historique.push(cloner(this.etat));
    if (this.debut === null) this.debut = Date.now();
  }

  /** Retourne la carte devenue visible au bas d'une colonne découverte. */
  decouvrir(pile) {
    const colonne = this.etat.tableau[pile];
    if (colonne.cachees > 0 && colonne.cachees >= colonne.cartes.length) {
      colonne.cachees -= 1;
      this.etat.score += POINTS.retournement;
      return sommet(colonne.cartes);
    }
    return null;
  }

  /** Tire une carte du talon (trois en tirage par trois) vers la défausse. */
  tirer() {
    if (!this.peutTirer()) return false;
    this.memoriser();
    const n = Math.min(this.tirage, this.etat.talon.length);
    for (let i = 0; i < n; i++) this.etat.defausse.push(this.etat.talon.pop());
    this.etat.coups += 1;
    return true;
  }

  /** Remet la défausse dans le talon, dans son ordre d'origine. */
  recycler() {
    if (!this.peutRecycler()) return false;
    this.memoriser();
    this.etat.talon = this.etat.defausse.reverse();
    this.etat.defausse = [];
    this.etat.passes += 1;
    this.etat.score += POINTS.recyclage[this.tirage];
    this.etat.coups += 1;
    this.noter(`Talon rechargé — passe ${this.etat.passes + 1}`);
    return true;
  }

  /**
   * Joue un déplacement.
   * @param {{ de: {zone: string, pile?: number, index?: number}, vers: {zone: string, pile?: number} }} coup
   * @returns {boolean} false si le coup est illégal — l'état n'a alors pas bougé.
   */
  jouer(coup) {
    const prise = this.cartesPrises(coup);
    if (!destinationAccepte(this.etat, coup, prise)) return false;
    this.memoriser();

    // Retrait de l'origine.
    if (coup.de.zone === 'defausse') this.etat.defausse.pop();
    else if (coup.de.zone === 'fondation') this.etat.fondations[coup.de.pile].pop();
    else this.etat.tableau[coup.de.pile].cartes.length = coup.de.index;

    // Dépôt sur la destination.
    if (coup.vers.zone === 'fondation') this.etat.fondations[coup.vers.pile].push(prise[0]);
    else this.etat.tableau[coup.vers.pile].cartes.push(...prise);

    this.etat.score += this.pointsDu(coup);
    this.etat.coups += 1;
    if (coup.de.zone === 'tableau') this.decouvrir(coup.de.pile);

    if (coup.vers.zone === 'fondation') {
      this.noter(`${cardLabel(prise[0])} → fondation`);
      if (estGagne(this.etat)) {
        this.gagne = true;
        this.fin = Date.now(); // Le chronomètre s'arrête sur la dernière carte.
        this.noter(`Partie gagnée en ${this.etat.coups} coups !`);
      }
    }
    return true;
  }

  pointsDu(coup) {
    if (coup.vers.zone === 'fondation') return POINTS.versFondation;
    if (coup.de.zone === 'defausse') return POINTS.defausseVersTableau;
    if (coup.de.zone === 'fondation') return POINTS.fondationVersTableau;
    return 0;
  }

  /** Monte sur sa fondation la première carte qui le peut : un coup du déroulé final. */
  deroulerUnCoup() {
    const sources = [
      { zone: 'defausse' },
      ...this.etat.tableau.map((_, pile) => ({ zone: 'tableau', pile })),
    ];
    for (const de of sources) {
      const pile = de.zone === 'defausse' ? this.etat.defausse : this.etat.tableau[de.pile].cartes;
      const carte = sommet(pile);
      if (!carte) continue;
      const origine = de.zone === 'defausse' ? de : { ...de, index: pile.length - 1 };
      const coup = { de: origine, vers: { zone: 'fondation', pile: indexFondation(carte) } };
      if (this.jouer(coup)) return coup;
    }
    return null;
  }

  annuler() {
    if (!this.peutAnnuler) return false;
    this.etat = this.historique.pop();
    this.gagne = estGagne(this.etat);
    // Reprendre une partie gagnée relance le chronomètre.
    if (!this.gagne) this.fin = null;
    return true;
  }

  /** Durée en secondes du premier coup à la victoire — ou à maintenant si la partie court. */
  duree() {
    if (this.debut === null) return 0;
    return Math.floor(((this.fin ?? Date.now()) - this.debut) / 1000);
  }

  /** Libellé d'un coup, pour le journal et les infobulles. */
  libelleCoup(coup) {
    const prise = this.cartesPrises(coup);
    if (!prise.length) return '';
    const quoi = prise.length > 1
      ? `${cardLabel(prise[0])} + ${prise.length - 1}`
      : cardLabel(prise[0]);
    const ou = coup.vers.zone === 'tableau'
      ? `colonne ${coup.vers.pile + 1}`
      : ZONE_LABEL[coup.vers.zone] ?? coup.vers.zone;
    return `${quoi} → ${ou}`;
  }
}
