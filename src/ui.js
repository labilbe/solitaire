// Interface : rendu du tapis, clic pour jouer d'évidence, glisser-déposer pour choisir.

import { SUITS, SUIT_COLOR, SUIT_SYMBOL, cardName } from './cards.js';
import { faceCarte } from './faces.js';
import { Game, TIRAGES } from './game.js';
import { indice, indexFondation } from './indice.js';
import { NB_COLONNES, NB_FONDATIONS, CARTES_TOTAL } from './rules.js';

// Déroulé final : une carte toutes les 140 ms, le temps de voir la cascade.
const DELAI_DEROULE = 140;
// Au-delà de ce déplacement, le geste est un glissement et non un clic.
const SEUIL_GLISSEMENT = 5;

// En dessous de cette largeur les cartes rétrécissent : les figures illustrées
// laissent la place à des faces sobres, plus lisibles.
const PETITES_CARTES = window.matchMedia('(max-width: 900px)');

const $ = (id) => document.getElementById(id);
let game = new Game();
let glissement = null;
let deroule = null;

// ------------------------------------------------------- Mise en place du DOM

function construireEmplacements() {
  $('fondations').innerHTML = SUITS.map((suit, i) => `
    <div class="pile pile-fondation" data-zone="fondation" data-pile="${i}"
         data-enseigne="${SUIT_SYMBOL[suit]}" aria-label="Fondation ${suit}"></div>`).join('');
  $('colonnes').innerHTML = Array.from({ length: NB_COLONNES }, (_, i) => `
    <div class="colonne" data-zone="tableau" data-pile="${i}" aria-label="Colonne ${i + 1}"></div>`).join('');
}

// ------------------------------------------------------------- Fabrication

function elCarte(carte, { dos = false, origine = null, decalage = 0 } = {}) {
  const el = document.createElement('div');
  el.className = 'carte';
  el.style.top = `${decalage}px`;
  if (dos) {
    el.classList.add('dos');
    return el;
  }
  el.classList.add(SUIT_COLOR[carte.suit]);
  el.innerHTML = faceCarte(carte, PETITES_CARTES.matches);
  el.setAttribute('aria-label', cardName(carte));
  if (origine) {
    el.dataset.zone = origine.zone;
    if (origine.pile !== undefined) el.dataset.pile = String(origine.pile);
    if (origine.index !== undefined) el.dataset.index = String(origine.index);
    el.classList.add('prenable');
    el.tabIndex = 0;
  }
  return el;
}

/** Destination évidente d'une prise : sa fondation, sinon une colonne qui l'accepte. */
function destinationEvidente(origine) {
  const prise = game.cartesPrises({ de: origine, vers: { zone: 'fondation', pile: 0 } });
  if (!prise.length) return null;
  const candidates = [
    { zone: 'fondation', pile: indexFondation(prise[0]) },
    // Une colonne garnie avant une colonne vide : on garde les places libres pour les rois.
    ...game.etat.tableau
      .map((colonne, pile) => ({ vers: { zone: 'tableau', pile }, vide: colonne.cartes.length === 0 }))
      .sort((a, b) => Number(a.vide) - Number(b.vide))
      .map((x) => x.vers),
  ];
  for (const vers of candidates) {
    if (game.coupValide({ de: origine, vers })) return vers;
  }
  return null;
}

function origineDe(el) {
  if (!el?.dataset?.zone) return null;
  const origine = { zone: el.dataset.zone };
  if (el.dataset.pile !== undefined) origine.pile = Number(el.dataset.pile);
  if (el.dataset.index !== undefined) origine.index = Number(el.dataset.index);
  return origine;
}

// ----------------------------------------------------------------- Rendu

/**
 * Une pile n'est refaite que si son contenu a changé : sans cela, piocher rebâtirait
 * aussi les fondations et les colonnes, qui rejoueraient leur animation de pose.
 * La signature décrit tout ce que le rendu de la pile dépend.
 */
function aChange(zone, signature) {
  const complete = `${signature}|${PETITES_CARTES.matches}`;
  if (zone.dataset.signature === complete) return false;
  zone.dataset.signature = complete;
  return true;
}

function rendreTalon() {
  const zone = $('talon');
  if (!aChange(zone, `${game.etat.talon.length}|${game.peutRecycler()}`)) return;
  zone.innerHTML = '';
  zone.classList.toggle('vide', game.etat.talon.length === 0);
  zone.classList.toggle('rechargeable', game.peutRecycler());
  // Quelques dos décalés suffisent à suggérer l'épaisseur du paquet.
  const epaisseur = Math.min(3, game.etat.talon.length);
  for (let i = 0; i < epaisseur; i++) {
    zone.appendChild(elCarte(null, { dos: true, decalage: -i * 2 }));
  }
  zone.setAttribute('aria-label',
    game.etat.talon.length ? `Talon : ${game.etat.talon.length} cartes` : 'Talon vide : recharger');
}

function rendreDefausse() {
  const zone = $('defausse');
  // On montre les dernières cartes en éventail, mais seule celle du dessus est jouable.
  const visibles = game.etat.defausse.slice(-Math.min(3, game.tirage));
  if (!aChange(zone, visibles.map((x) => x.id).join(','))) return;
  zone.innerHTML = '';
  visibles.forEach((carte, i) => {
    const dernier = i === visibles.length - 1;
    const el = elCarte(carte, { origine: dernier ? { zone: 'defausse' } : null });
    el.style.left = `${i * 14}px`;
    if (dernier) el.classList.add('posee');
    zone.appendChild(el);
  });
}

function rendreFondations() {
  for (let pile = 0; pile < NB_FONDATIONS; pile++) {
    const zone = $('fondations').children[pile];
    const fondation = game.etat.fondations[pile];
    const carte = fondation[fondation.length - 1];
    if (!aChange(zone, `${fondation.length}:${carte?.id ?? ''}`)) continue;
    zone.innerHTML = '';
    if (carte) {
      const el = elCarte(carte, { origine: { zone: 'fondation', pile } });
      el.classList.add('posee');
      zone.appendChild(el);
    }
  }
}

function rendreColonnes() {
  const pas = getComputedStyle(document.documentElement);
  const pasCache = parseFloat(pas.getPropertyValue('--pas-cache'));
  const pasVisible = parseFloat(pas.getPropertyValue('--pas-visible'));

  game.etat.tableau.forEach((colonne, pile) => {
    const zone = $('colonnes').children[pile];
    // Ce que montre une colonne — cartes, dos, prises possibles — ne tient qu'à elle.
    if (!aChange(zone, `${colonne.cachees}:${colonne.cartes.map((x) => x.id).join(',')}`)) return;
    zone.innerHTML = '';
    let decalage = 0;
    colonne.cartes.forEach((carte, index) => {
      const cachee = index < colonne.cachees;
      const el = cachee
        ? elCarte(null, { dos: true, decalage })
        : elCarte(carte, { origine: { zone: 'tableau', pile, index }, decalage });
      // Une carte cachée n'est pas prenable, mais la suite visible qui la suit le reste.
      if (!cachee && !game.cartesPrises({ de: { zone: 'tableau', pile, index }, vers: {} }).length) {
        el.classList.remove('prenable');
        el.removeAttribute('tabindex');
      }
      zone.appendChild(el);
      decalage += cachee ? pasCache : pasVisible;
    });
    // La colonne garde la hauteur de sa pile pour rester cliquable sur toute sa longueur.
    zone.style.minHeight = `calc(var(--h-carte) + ${Math.max(decalage - pasVisible, pasVisible * 2)}px)`;
  });
}

function rendreEntetes() {
  $('score').textContent = game.score;
  $('coups').textContent = game.coups;
  $('temps').textContent = formatDuree(game.duree());
  $('info-fondations').textContent = `${game.placees} / ${CARTES_TOTAL} cartes placées`;
  $('btn-annuler').disabled = !game.peutAnnuler;
  for (const t of TIRAGES) $(`btn-tirage-${t}`).classList.toggle('actif', game.tirage === t);
}

function formatDuree(secondes) {
  const m = Math.floor(secondes / 60);
  return `${m}:${String(secondes % 60).padStart(2, '0')}`;
}

function rendreJournal() {
  $('journal').innerHTML = game.journal.slice(-9).map((l) => `<p>${l}</p>`).join('');
}

function rendrePanneau() {
  const panneau = $('panneau-fin');
  if (game.gagne) {
    $('fin-titre').textContent = 'Partie gagnée !';
    $('fin-detail').textContent =
      `${game.score} points en ${game.coups} coups et ${formatDuree(game.duree())}.`;
    panneau.hidden = false;
  } else if (game.estBloquee()) {
    $('fin-titre').textContent = 'Plus aucun coup possible';
    $('fin-detail').textContent =
      `${game.placees} cartes placées, ${game.score} points. Cette donne est perdue.`;
    panneau.hidden = false;
  } else {
    panneau.hidden = true;
  }
}

function rendre() {
  // Les piles inchangées ne sont plus refaites : la mise en avant d'un indice doit
  // donc être retirée explicitement.
  for (const el of document.querySelectorAll('.carte.conseil')) el.classList.remove('conseil');
  rendreEntetes();
  rendreTalon();
  rendreDefausse();
  rendreFondations();
  rendreColonnes();
  rendreJournal();
  rendrePanneau();
  lancerDeroule();
}

// --------------------------------------------------------------- Actions

function jouerCoup(coup) {
  if (!game.jouer(coup)) return false;
  rendre();
  return true;
}

function cliquerCarte(origine) {
  // Redescendre une fondation se fait exprès, au glisser : un clic ne doit pas la défaire.
  if (origine.zone === 'fondation') return;
  const vers = destinationEvidente(origine);
  if (vers) jouerCoup({ de: origine, vers });
}

function cliquerTalon() {
  if (game.peutTirer()) game.tirer();
  else if (game.peutRecycler()) game.recycler();
  else return;
  rendre();
}

function montrerIndice() {
  const conseil = indice(game);
  if (!conseil) {
    game.noter(game.peutTirer() || game.peutRecycler()
      ? 'Rien à placer : piochez.'
      : 'Aucun coup utile — à vous de juger.');
    rendre();
    return;
  }
  game.noter(`Indice : ${game.libelleCoup(conseil.coup)}`);
  rendre();
  const { zone, pile, index } = conseil.coup.de;
  const cible = zone === 'tableau'
    ? $('colonnes').children[pile].children[index]
    : zone === 'fondation' ? $('fondations').children[pile].lastElementChild
    : $('defausse').lastElementChild;
  cible?.classList.add('conseil');
}

/** Fin de partie mécanique : toutes les cartes sont visibles, on monte le reste tout seul. */
function lancerDeroule() {
  if (deroule || !game.estDeroulable()) return;
  deroule = setInterval(() => {
    if (!game.estDeroulable() || !game.deroulerUnCoup()) {
      clearInterval(deroule);
      deroule = null;
      rendre();
      return;
    }
    rendreEntetes();
    rendreTalon();
    rendreDefausse();
    rendreFondations();
    rendreColonnes();
    rendrePanneau();
  }, DELAI_DEROULE);
}

function arreterDeroule() {
  if (deroule) {
    clearInterval(deroule);
    deroule = null;
  }
}

function nouvellePartie(tirage = game.tirage) {
  arreterDeroule();
  game = new Game({ tirage });
  rendre();
}

function changerTirage(tirage) {
  if (tirage === game.tirage) return;
  const enCours = game.coups > 0 && !game.gagne && !game.estBloquee();
  if (enCours && !confirm('Changer de tirage commence une nouvelle partie. Continuer ?')) return;
  nouvellePartie(tirage);
}

// ------------------------------------------------------- Glisser-déposer

function conteneurDe(el) {
  return el?.closest('.colonne, .pile') ?? null;
}

/** Allume les emplacements qui accepteraient la prise en cours. */
function marquerCibles(origine) {
  const zones = [...$('fondations').children, ...$('colonnes').children];
  for (const zone of zones) {
    const vers = { zone: zone.dataset.zone, pile: Number(zone.dataset.pile) };
    zone.classList.toggle('cible', game.coupValide({ de: origine, vers }));
  }
}

function effacerCibles() {
  for (const zone of document.querySelectorAll('.cible')) zone.classList.remove('cible');
}

function commencerGlissement(e, carte, origine) {
  const prise = game.cartesPrises({ de: origine, vers: {} });
  if (!prise.length) return;
  const rect = carte.getBoundingClientRect();
  const pasVisible = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pas-visible'));

  const vol = document.createElement('div');
  vol.className = 'vol';
  prise.forEach((c, i) => vol.appendChild(elCarte(c, { decalage: i * pasVisible })));
  vol.style.height = `calc(var(--h-carte) + ${(prise.length - 1) * pasVisible}px)`;
  document.body.appendChild(vol);

  glissement = {
    origine,
    vol,
    dx: e.clientX - rect.left,
    dy: e.clientY - rect.top,
    cartes: [...document.querySelectorAll('.carte')].filter((el) => {
      const o = origineDe(el);
      return o && o.zone === origine.zone && o.pile === origine.pile
        && (origine.index === undefined || Number(el.dataset.index) >= origine.index);
    }),
  };
  for (const el of glissement.cartes) el.classList.add('en-vol');
  marquerCibles(origine);
  deplacerVol(e);
}

function deplacerVol(e) {
  glissement.vol.style.left = `${e.clientX - glissement.dx}px`;
  glissement.vol.style.top = `${e.clientY - glissement.dy}px`;
}

function terminerGlissement(e) {
  const { origine, vol, cartes } = glissement;
  glissement = null;
  vol.remove();
  for (const el of cartes) el.classList.remove('en-vol');
  effacerCibles();

  const conteneur = conteneurDe(document.elementFromPoint(e.clientX, e.clientY));
  const zone = conteneur?.dataset.zone;
  if (zone === 'tableau' || zone === 'fondation') {
    jouerCoup({ de: origine, vers: { zone, pile: Number(conteneur.dataset.pile) } });
  }
}

// Un même geste sert aux deux : relâché sur place c'est un clic, déplacé c'est un glissement.
document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const carte = e.target.closest('.carte.prenable');
  if (carte) {
    const origine = origineDe(carte);
    if (!origine) return;
    arreterDeroule();
    e.preventDefault();
    const depart = { x: e.clientX, y: e.clientY, carte, origine };

    const bouger = (ev) => {
      if (!glissement) {
        const loin = Math.hypot(ev.clientX - depart.x, ev.clientY - depart.y) > SEUIL_GLISSEMENT;
        if (!loin) return;
        commencerGlissement(ev, depart.carte, depart.origine);
      }
      deplacerVol(ev);
    };
    const lacher = (ev) => {
      document.removeEventListener('pointermove', bouger);
      document.removeEventListener('pointerup', lacher);
      if (glissement) terminerGlissement(ev);
      else cliquerCarte(depart.origine);
    };
    document.addEventListener('pointermove', bouger);
    document.addEventListener('pointerup', lacher);
    return;
  }
  if (conteneurDe(e.target)?.id === 'talon') cliquerTalon();
});

// Au clavier : Entrée ou Espace sur une carte la joue à sa place évidente.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const carte = e.target.closest?.('.carte.prenable');
  if (carte) {
    e.preventDefault();
    const origine = origineDe(carte);
    if (origine) cliquerCarte(origine);
    return;
  }
  if (e.target.id === 'talon') {
    e.preventDefault();
    cliquerTalon();
  }
});

$('btn-annuler').addEventListener('click', () => {
  arreterDeroule();
  game.annuler();
  rendre();
});
$('btn-annuler-fin').addEventListener('click', () => {
  arreterDeroule();
  game.annuler();
  rendre();
});
$('btn-indice').addEventListener('click', montrerIndice);
$('btn-nouvelle').addEventListener('click', () => nouvellePartie());
$('btn-rejouer').addEventListener('click', () => nouvellePartie());
for (const t of TIRAGES) $(`btn-tirage-${t}`).addEventListener('click', () => changerTirage(t));
$('btn-regles').addEventListener('click', () => $('dlg-regles').showModal());
$('btn-fermer-regles').addEventListener('click', () => $('dlg-regles').close());
PETITES_CARTES.addEventListener('change', rendre);
// Le chronomètre tourne tout seul ; le reste ne bouge qu'après un coup.
setInterval(() => { $('temps').textContent = formatDuree(game.duree()); }, 1000);

construireEmplacements();
rendre();
