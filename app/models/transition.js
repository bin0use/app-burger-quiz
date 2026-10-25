/**
 * Entité permettant de stocker une transition
 * @param {*} filename le nom du fichier de transition
 * @param {*} label le nom de la transition
 * @param {*} order l'ordre d'affichage
 * @param {*} round la clé de la manche associée (utilisée par les questions)
 * @param {*} options.screenMode ce qui s'affiche sur l'écran de jeu :
 *  'question' (question et propositions), 'choices' (thème et propositions seulement) ou null (rien)
 * @param {*} options.screenHidden la question n'est pas affichée à l'écran par défaut (l'admin l'affiche)
 * @param {*} options.menus les questions sont regroupées par thème (menus) : l'écran affiche d'abord les menus,
 *  puis les questions du menu choisi (un menu déjà joué ne peut plus être choisi)
 * @param {*} options.timerSeconds durée proposée pour le chrono de la manche
 */
function Transition(filename, label, order, round, options) {
    options = options || {};
    this.filename = filename;
    this.order = order;
    this.label = label;
    this.round = round;
    this.screenMode = options.screenMode || null;
    this.questionsOnScreen = !!this.screenMode;
    this.screenHidden = !!options.screenHidden;
    this.menus = !!options.menus;
    this.timerSeconds = options.timerSeconds || 30;
}

module.exports = Transition;
