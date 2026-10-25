const Transition = require('./transition');

/**
 * Clé de la manche du Burger de la mort (compteur de 10 bonnes réponses d'affilée)
 */
const deathBurgerRound = 'burger-de-la-mort';

/**
 * Liste des transitions (une par manche) dans l'ordre de la partie
 * Comme dans l'émission, les questions des Nuggets et des menus s'affichent à l'écran,
 * et pour Sel ou Poivre seulement le thème et les propositions (masqués par défaut)
 * Les menus : l'écran affiche d'abord les noms des menus, puis les questions du menu choisi
 */
const transitionsList = [
    new Transition('nuggets-transition.mp4', 'Nuggets', 1, 'nuggets', {
        screenMode: 'question',
        rules: 'Quatre propositions, une seule bonne réponse : buzzez dès que vous la tenez !'
    }),
    new Transition('selt-pepper-transition.mp4', 'Sel ou Poivre', 2, 'sel-ou-poivre', {
        screenMode: 'choices', screenHidden: true,
        rules: 'Pour chaque proposition : l\'un, l\'autre… ou les deux ?'
    }),
    new Transition('menus-transition.mp4', 'Les menus', 3, 'menus', {
        screenMode: 'question', menus: true,
        rules: 'Chaque équipe choisit un menu et répond à toutes ses questions.'
    }),
    new Transition('addition-transition.mp4', "L'addition", 4, 'addition', {
        timerSeconds: 60,
        rules: 'Un maximum de questions en un temps record : buzzez vite !'
    }),
    new Transition('death-burger-transition.mp4', 'Burger de la mort', 5, deathBurgerRound, {
        rules: '10 bonnes réponses d\'affilée pour gagner. Une erreur, et tout est à refaire !'
    }),
].sort(function (a, b) {
    return a.order - b.order;
});

/**
 * Manches disponibles pour les questions : [{ key, label }]
 */
const rounds = transitionsList.map(function (transition) {
    return { key: transition.round, label: transition.label, screenMode: transition.screenMode };
});

/**
 * Indique si la clé correspond à une manche existante
 */
const isValidRound = function (key) {
    return rounds.some(function (round) { return round.key === key; });
}

module.exports = { transitionsList, rounds, isValidRound, deathBurgerRound };
