// Auto-parties : l'ordinateur déroule des donnes entières avec les conseils de
// src/indice.js. On contrôle la légalité de chaque coup, les invariants du paquet
// (52 cartes, jamais de doublon, cartes cachées toujours au-dessous, fondations bien
// ordonnées) et un taux de réussite plausible.
import test from 'node:test';
import assert from 'node:assert/strict';

import { CARTES_TOTAL } from '../src/rules.js';
import { SUITS, valeur } from '../src/cards.js';
import { Game } from '../src/game.js';
import { coupsUtiles } from '../src/indice.js';

const DONNES = 200;
const COUPS_MAX = 3000;

/** Générateur reproductible : les mêmes donnes à chaque exécution. */
function mulberry32(graine) {
  let a = graine;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Empreinte d'un état : sert à refuser un coup qui ramènerait une position déjà vue. */
function empreinte(etat) {
  const colonnes = etat.tableau
    .map((c) => `${c.cachees}:${c.cartes.map((x) => x.id).join(',')}`)
    .join('|');
  const fondations = etat.fondations.map((f) => f.length).join(',');
  return `${colonnes}#${fondations}#${etat.defausse.length}#${etat.talon.length}`;
}

function verifierEtat(etat, contexte) {
  const vues = [];
  for (const { cartes, cachees } of etat.tableau) {
    assert.ok(cachees >= 0 && cachees <= cartes.length, `cachées hors bornes (${contexte})`);
    vues.push(...cartes);
  }
  for (const [i, fondation] of etat.fondations.entries()) {
    fondation.forEach((carte, k) => {
      assert.equal(carte.suit, SUITS[i], `fondation ${i} mélangée (${contexte})`);
      assert.equal(valeur(carte), k + 1, `fondation ${i} mal ordonnée (${contexte})`);
    });
    vues.push(...fondation);
  }
  vues.push(...etat.talon, ...etat.defausse);
  assert.equal(vues.length, CARTES_TOTAL, `le paquet n'a plus 52 cartes (${contexte})`);
  assert.equal(new Set(vues.map((x) => x.id)).size, CARTES_TOTAL, `carte en double (${contexte})`);
}

/**
 * Joue le meilleur coup qui ne ramène pas à une position déjà rencontrée.
 * Les coups refusés sont annulés : l'état repart intact pour le candidat suivant.
 */
function jouerMeilleur(g, vues, graine) {
  for (const { coup } of coupsUtiles(g.etat)) {
    assert.ok(g.coupValide(coup), `coup conseillé illégal (donne ${graine})`);
    assert.ok(g.jouer(coup), `coup conseillé refusé (donne ${graine})`);
    if (vues.has(empreinte(g.etat))) {
      g.annuler();
      continue;
    }
    vues.add(empreinte(g.etat));
    return true;
  }
  return false;
}

/** Joue une donne complète ; renvoie le compte rendu de la partie. */
function derouler(graine, tirage) {
  const g = new Game({ tirage, rng: mulberry32(graine) });
  const vues = new Set([empreinte(g.etat)]);
  // Recharger le talon n'a de sens que si quelque chose a bougé depuis la passe précédente.
  let progres = false;

  for (let tour = 0; tour < COUPS_MAX && !g.gagne; tour++) {
    if (jouerMeilleur(g, vues, graine)) progres = true;
    else if (g.peutTirer()) { g.tirer(); vues.add(empreinte(g.etat)); }
    else if (progres && g.peutRecycler()) { g.recycler(); progres = false; }
    else break;
    verifierEtat(g.etat, `donne ${graine}, coup ${g.coups}`);
  }
  return { gagne: g.gagne, placees: g.placees, coups: g.coups, score: g.score, game: g };
}

for (const tirage of [1, 3]) {
  test(`${DONNES} donnes déroulées au tirage par ${tirage === 1 ? 'une' : 'trois'}`, () => {
    let gagnees = 0;
    let placees = 0;
    for (let n = 1; n <= DONNES; n++) {
      const partie = derouler(n, tirage);
      assert.ok(partie.coups < COUPS_MAX, `donne ${n} : partie interminable`);
      if (partie.gagne) {
        gagnees++;
        assert.equal(partie.placees, CARTES_TOTAL, 'une partie gagnée a placé les 52 cartes');
      }
      placees += partie.placees;
    }
    // Taux observés : 35 % des donnes gagnées au tirage par une (25 cartes placées en
    // moyenne), 9,5 % au tirage par trois (11 cartes). Les bornes sont larges : elles
    // signalent une régression, pas une variation de quelques points.
    const taux = (gagnees / DONNES) * 100;
    const moyenne = placees / DONNES;
    const minimum = tirage === 1 ? { taux: 25, placees: 18 } : { taux: 5, placees: 8 };
    assert.ok(taux >= minimum.taux, `seulement ${taux.toFixed(1)} % de donnes gagnées (min ${minimum.taux} %)`);
    assert.ok(moyenne >= minimum.placees, `seulement ${moyenne.toFixed(1)} cartes placées en moyenne`);
  });
}

test('une partie gagnée se rejoue à l\'identique et s\'annule entièrement', () => {
  let graine = 1;
  while (!derouler(graine, 1).gagne) graine++;
  const premiere = derouler(graine, 1);
  const seconde = derouler(graine, 1);
  assert.ok(premiere.gagne && seconde.gagne);
  assert.equal(premiere.coups, seconde.coups, 'la même donne donne la même partie');
  assert.equal(premiere.score, seconde.score);

  const g = premiere.game;
  while (g.peutAnnuler) g.annuler();
  assert.equal(g.placees, 0, 'tout remonter ramène à la donne initiale');
  assert.equal(g.gagne, false);
  verifierEtat(g.etat, 'après annulation complète');
});
