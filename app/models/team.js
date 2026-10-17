/**
 * Nombre de points maximum (correspond aux éléments du burger à l'écran)
 */
const maxPoints = 25;

/**
 * Entité équipe
 */
function Team(name) {
    this.points = 0;
    this.name = name;
    /**
     * Incrémente les points de l'équipe
     */
    this.incrementPoints = function () {
        if (this.points >= maxPoints)
            return;
        this.points++;
    }
    /**
     * décrémente les points de l'équipe
     */
    this.decrementPoints = function () {
        if (this.points <= 0)
            return;
        this.points--;
    }
    /**
     * Fixe les points de l'équipe (valeur bornée entre 0 et le maximum)
     */
    this.setPoints = function (points) {
        if (!Number.isInteger(points))
            return;
        this.points = Math.min(Math.max(points, 0), maxPoints);
    }
}

Team.maxPoints = maxPoints;

module.exports = Team;
