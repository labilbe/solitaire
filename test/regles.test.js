// Règles et moteur : empilements, distribution, tirage, score, annulation.
import test from 'node:test';
import assert from 'node:assert/strict';

import { RANK_VALUE, SUITS, newDeck, valeur } from '../src/cards.js';
import {
  CARTES_TOTAL, POINTS, cartesPrises, coupsPossibles, coupValide,
  estDeroulable, estGagne, indexFondation, peutEmpilerFondation, peutEmpilerTableau,
  prisePossible, sequenceValide,
} from '../src/rules.js';
import { Game } from '../src/game.js';
import { coupsUtiles, monteeSure } from '../src/indice.js';

const c = (rank, suit) => ({ rank, suit, id: `${rank}${suit}` });
const colonne = (cartes, cachees = 0) => ({ cartes, cachees });

test('le paquet compte 52 cartes distinctes', () => {
  const deck = newDeck();
  assert.equal(deck.length, CARTES_TOTAL);
  assert.equal(new Set(deck.map((x) => `${x.rank}${x.suit}`)).size, CARTES_TOTAL);
  assert.equal(valeur(c('A', 'pique')), 1);
  assert.equal(valeur(c('R', 'pique')), 13);
  assert.equal(RANK_VALUE['10'], 10);
});

test('le tableau empile en descendant et en alternant les couleurs', () => {
  const dix = colonne([c('10', 'pique')]);
  assert.ok(peutEmpilerTableau(c('9', 'coeur'), dix), '9 rouge sur 10 noir');
  assert.ok(!peutEmpilerTableau(c('9', 'trefle'), dix), 'pas deux noires');
  assert.ok(!peutEmpilerTableau(c('8', 'coeur'), dix), 'il faut la valeur juste en dessous');
});

test('une colonne vide n\'accepte qu\'un roi', () => {
  const vide = colonne([]);
  assert.ok(peutEmpilerTableau(c('R', 'coeur'), vide));
  assert.ok(!peutEmpilerTableau(c('D', 'coeur'), vide));
});

test('on ne pose rien sur une carte face cachée', () => {
  const cachee = colonne([c('10', 'pique')], 1);
  assert.ok(!peutEmpilerTableau(c('9', 'coeur'), cachee));
});

test('les fondations montent de l\'as au roi, par enseigne', () => {
  assert.ok(peutEmpilerFondation(c('A', 'coeur'), []));
  assert.ok(!peutEmpilerFondation(c('2', 'coeur'), []), 'une fondation vide commence par un as');
  const as = [c('A', 'coeur')];
  assert.ok(peutEmpilerFondation(c('2', 'coeur'), as));
  assert.ok(!peutEmpilerFondation(c('2', 'carreau'), as), 'une seule enseigne par fondation');
  assert.ok(!peutEmpilerFondation(c('3', 'coeur'), as), 'on ne saute pas de valeur');
  assert.equal(indexFondation(c('A', SUITS[2])), 2);
});

test('une suite déplaçable descend en alternant les couleurs', () => {
  assert.ok(sequenceValide([c('10', 'pique'), c('9', 'coeur'), c('8', 'trefle')]));
  assert.ok(!sequenceValide([c('10', 'pique'), c('9', 'trefle')]));
  assert.ok(sequenceValide([c('5', 'coeur')]), 'une carte seule est une suite');

  const pile = colonne([c('R', 'trefle'), c('10', 'pique'), c('9', 'coeur')], 1);
  assert.ok(prisePossible(pile, 1), 'la suite visible se prend par sa tête');
  assert.ok(prisePossible(pile, 2));
  assert.ok(!prisePossible(pile, 0), 'une carte cachée ne se prend pas');
});

test('la distribution suit le Klondike : 1 à 7 cartes, une seule retournée', () => {
  const g = new Game();
  assert.deepEqual(g.etat.tableau.map((x) => x.cartes.length), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(g.etat.tableau.map((x) => x.cachees), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(g.etat.talon.length, 24);
  assert.equal(g.etat.defausse.length, 0);
  assert.equal(g.placees, 0);
  assert.equal(g.score, 0);
});

test('le tirage par trois sort trois cartes, le recyclage les rend dans l\'ordre', () => {
  const g = new Game({ tirage: 3 });
  const talon = g.etat.talon.slice();
  g.tirer();
  assert.equal(g.etat.defausse.length, 3);
  assert.deepEqual(g.etat.defausse, talon.slice(-3).reverse());

  while (g.peutTirer()) g.tirer();
  assert.equal(g.etat.defausse.length, 24);
  assert.ok(g.peutRecycler());
  g.recycler();
  assert.deepEqual(g.etat.talon, talon, 'le talon retrouve son ordre d\'origine');
  assert.equal(g.etat.passes, 1);
  assert.equal(g.etat.score, POINTS.recyclage[3], 'le rechargement coûte des points');
  assert.equal(g.score, 0, 'le score affiché ne descend pas sous zéro');
});

test('monter une carte vaut 10 points, retourner une carte en vaut 5', () => {
  const g = new Game();
  // Donne fabriquée : un as seul en tête de colonne 1, un 2 posé sur une carte cachée.
  g.etat.tableau = [
    colonne([c('A', 'coeur')]),
    colonne([c('R', 'pique'), c('2', 'coeur')], 1),
    ...Array.from({ length: 5 }, () => colonne([])),
  ];
  g.etat.talon = [];

  assert.ok(g.jouer({ de: { zone: 'tableau', pile: 0, index: 0 }, vers: { zone: 'fondation', pile: 1 } }));
  assert.equal(g.score, POINTS.versFondation);
  assert.equal(g.coups, 1);

  assert.ok(g.jouer({ de: { zone: 'tableau', pile: 1, index: 1 }, vers: { zone: 'fondation', pile: 1 } }));
  assert.equal(
    g.score,
    POINTS.versFondation * 2 + POINTS.retournement,
    'la carte découverte au bas de la colonne 2 rapporte 5 points',
  );
  assert.equal(g.etat.tableau[1].cachees, 0, 'le roi est retourné');
  assert.deepEqual(g.etat.fondations[1].map((x) => x.rank), ['A', '2']);
});

test('redescendre une fondation coûte 15 points', () => {
  const g = new Game();
  g.etat.fondations = [[], [c('A', 'coeur'), c('2', 'coeur')], [], []];
  g.etat.tableau = [colonne([c('3', 'pique')]), ...Array.from({ length: 6 }, () => colonne([]))];
  g.etat.score = 100;
  assert.ok(g.jouer({ de: { zone: 'fondation', pile: 1 }, vers: { zone: 'tableau', pile: 0 } }));
  assert.equal(g.score, 100 + POINTS.fondationVersTableau);
  assert.equal(g.etat.tableau[0].cartes.map((x) => x.rank).join(''), '32');
});

test('un coup illégal ne change rien', () => {
  const g = new Game();
  g.etat.tableau = [
    colonne([c('R', 'pique'), c('5', 'coeur')]),
    colonne([c('9', 'trefle')]),
    ...Array.from({ length: 5 }, () => colonne([])),
  ];
  const avant = JSON.stringify(g.etat);
  const illegaux = [
    { de: { zone: 'tableau', pile: 0, index: 1 }, vers: { zone: 'tableau', pile: 1 } }, // 5 sur 9
    { de: { zone: 'tableau', pile: 0, index: 1 }, vers: { zone: 'fondation', pile: 1 } }, // 5 sans as
    { de: { zone: 'tableau', pile: 0, index: 0 }, vers: { zone: 'tableau', pile: 1 } }, // suite invalide
    { de: { zone: 'tableau', pile: 1, index: 0 }, vers: { zone: 'tableau', pile: 2 } }, // colonne vide sans roi
    { de: { zone: 'defausse' }, vers: { zone: 'tableau', pile: 2 } }, // défausse vide
  ];
  for (const coup of illegaux) assert.equal(g.jouer(coup), false, JSON.stringify(coup));
  assert.equal(JSON.stringify(g.etat), avant);
  assert.equal(g.coups, 0);
  assert.equal(g.peutAnnuler, false, 'un coup refusé ne remplit pas l\'historique');
});

test('l\'annulation remonte coup par coup jusqu\'à la donne initiale', () => {
  const g = new Game();
  const depart = JSON.stringify(g.etat);
  let joues = 0;
  for (let i = 0; i < 25; i++) {
    const [meilleur] = coupsUtiles(g.etat);
    if (meilleur) { g.jouer(meilleur.coup); joues++; }
    else if (g.peutTirer()) { g.tirer(); joues++; }
    else break;
  }
  assert.ok(joues > 0);
  while (g.peutAnnuler) g.annuler();
  assert.equal(JSON.stringify(g.etat), depart);
  assert.equal(g.peutAnnuler, false);
});

test('une partie gagnée est détectée, et le déroulé final la termine seul', () => {
  const g = new Game();
  // Toutes les cartes visibles, rangées par enseigne : la fin est mécanique.
  g.etat.talon = [];
  g.etat.defausse = [];
  g.etat.fondations = [[], [], [], []];
  g.etat.tableau = SUITS.map((suit) => colonne(
    ['R', 'D', 'V', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A'].map((r) => c(r, suit)),
  )).concat(Array.from({ length: 3 }, () => colonne([])));

  assert.ok(estDeroulable(g.etat));
  assert.ok(!estGagne(g.etat));
  let coups = 0;
  while (g.deroulerUnCoup()) coups++;
  assert.equal(coups, CARTES_TOTAL);
  assert.ok(g.gagne);
  assert.equal(g.placees, CARTES_TOTAL);
  assert.ok(!estDeroulable(g.etat), 'rien à dérouler sur une partie gagnée');
  assert.notEqual(g.fin, null, 'le chronomètre s\'arrête sur la dernière carte');
  assert.equal(g.duree(), g.duree(), 'la durée ne bouge plus après la victoire');
});

test('une donne sans coup possible est déclarée bloquée', () => {
  const g = new Game();
  g.etat.talon = [];
  g.etat.defausse = [];
  // Quatre rois de même couleur alternée impossible : aucun empilement, aucune fondation.
  g.etat.tableau = [
    colonne([c('R', 'pique')]), colonne([c('R', 'trefle')]),
    colonne([c('D', 'pique')]), colonne([c('D', 'trefle')]),
    colonne([c('5', 'pique')]), colonne([c('7', 'trefle')]), colonne([c('9', 'pique')]),
  ];
  assert.equal(coupsPossibles(g.etat).length, 0);
  assert.ok(g.estBloquee());
});

test('la montée est jugée sûre quand la carte ne peut plus servir au tableau', () => {
  const etat = { fondations: [[], [], [], []] };
  assert.ok(monteeSure(etat, c('A', 'pique')), 'un as ne sert jamais au tableau');
  assert.ok(monteeSure(etat, c('2', 'pique')));
  assert.ok(!monteeSure(etat, c('5', 'pique')), 'un 5 peut encore recevoir un 4 rouge');

  // Les deux fondations rouges ont atteint 4 : plus aucun 4 rouge n'a besoin du 5 noir.
  const rouge = [c('A', 'coeur'), c('2', 'coeur'), c('3', 'coeur'), c('4', 'coeur')];
  const carreau = [c('A', 'carreau'), c('2', 'carreau'), c('3', 'carreau'), c('4', 'carreau')];
  const place = { fondations: [[], rouge, carreau, []] };
  assert.ok(monteeSure(place, c('5', 'pique')));
  assert.ok(!monteeSure(place, c('6', 'pique')));
});

test('les coups énumérés sont tous légaux', () => {
  const g = new Game();
  for (let i = 0; i < 30; i++) {
    for (const coup of coupsPossibles(g.etat)) {
      assert.ok(coupValide(g.etat, coup), 'coup énuméré mais refusé');
      assert.equal(cartesPrises(g.etat, coup).length, coup.n);
    }
    if (!g.tirer()) break;
  }
});
