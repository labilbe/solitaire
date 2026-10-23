// Jeu de 52 cartes : enseignes, rangs et valeurs du solitaire.
//
// Au solitaire, une carte n'a pas de « points » : seule compte sa valeur de rang
// (A = 1 … R = 13), croissante sur les fondations et décroissante sur le tableau.

export const SUITS = ['pique', 'coeur', 'carreau', 'trefle'];

export const SUIT_SYMBOL = { pique: '♠', coeur: '♥', carreau: '♦', trefle: '♣' };
export const SUIT_LABEL = { pique: 'Pique', coeur: 'Cœur', carreau: 'Carreau', trefle: 'Trèfle' };
export const SUIT_COLOR = { pique: 'noir', coeur: 'rouge', carreau: 'rouge', trefle: 'noir' };

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R'];
export const RANK_LABEL = Object.fromEntries(RANKS.map((r) => [r, r]));

/** Valeur de rang : A = 1, 2 … 10, V = 11, D = 12, R = 13. */
export const RANK_VALUE = Object.fromEntries(RANKS.map((r, i) => [r, i + 1]));

export const AS = 'A';
export const ROI = 'R';

export function newDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}${SUIT_SYMBOL[suit]}` });
    }
  }
  return deck;
}

export function shuffle(deck, rng = Math.random) {
  const cards = deck.slice();
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function valeur(carte) {
  return RANK_VALUE[carte.rank];
}

export function couleur(carte) {
  return SUIT_COLOR[carte.suit];
}

export function sameCard(a, b) {
  return Boolean(a) && Boolean(b) && a.suit === b.suit && a.rank === b.rank;
}

export function cardLabel(carte) {
  return `${RANK_LABEL[carte.rank]}${SUIT_SYMBOL[carte.suit]}`;
}

export function cardName(carte) {
  return `${RANK_LABEL[carte.rank]} de ${SUIT_LABEL[carte.suit]}`;
}
