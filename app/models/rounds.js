const Transition = require('./transition');

/**
 * Liste des transitions (une par manche) dans l'ordre de la partie
 */
const transitionsList = [
    new Transition('nuggets-transition.mp4', 'Nuggets', 1, 'nuggets'),
    new Transition('selt-pepper-transition.mp4', 'Sel ou Poivre', 2, 'sel-ou-poivre'),
    new Transition('menus-transition.mp4', 'Les menus', 3, 'menus'),
    new Transition('addition-transition.mp4', "L'addition", 4, 'addition'),
    new Transition('death-burger-transition.mp4', 'Burger de la mort', 5, 'burger-de-la-mort'),
].sort(function (a, b) {
    return a.order - b.order;
});

/**
 * Manches disponibles pour les questions : [{ key, label }]
 */
const rounds = transitionsList.map(function (transition) {
    return { key: transition.round, label: transition.label };
});

/**
 * Indique si la clé correspond à une manche existante
 */
const isValidRound = function (key) {
    return rounds.some(function (round) { return round.key === key; });
}

module.exports = { transitionsList, rounds, isValidRound };
