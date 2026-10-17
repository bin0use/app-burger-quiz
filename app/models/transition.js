/**
 * Entité permettant de stocker une transition
 * @param {*} filename le nom du fichier de transition
 * @param {*} label le nom de la transition
 * @param {*} order l'ordre d'affichage
 * @param {*} round la clé de la manche associée (utilisée par les questions)
 */
function Transition(filename, label, order, round) {
    this.filename = filename;
    this.order = order;
    this.label = label;
    this.round = round;
}

module.exports = Transition;
