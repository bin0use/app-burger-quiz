/**
 * Entité permettant de stocker une transition
 * @param {*} filename le nom du fichier de transition
 * @param {*} label le nom de la transition
 * @param {*} order l'ordre d'affichage
 * @param {*} round la clé de la manche associée (utilisée par les questions)
 * @param {*} questionsOnScreen indique si les questions de la manche s'affichent sur l'écran de jeu
 */
function Transition(filename, label, order, round, questionsOnScreen) {
    this.filename = filename;
    this.order = order;
    this.label = label;
    this.round = round;
    this.questionsOnScreen = !!questionsOnScreen;
}

module.exports = Transition;
