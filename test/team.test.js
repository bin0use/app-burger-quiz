const test = require('node:test');
const assert = require('node:assert');
const Team = require('../app/models/team');

test('les points restent entre 0 et le maximum', function () {
    const team = new Team('mayo');
    team.decrementPoints();
    assert.strictEqual(team.points, 0);
    for (let i = 0; i < Team.maxPoints + 5; i++)
        team.incrementPoints();
    assert.strictEqual(team.points, Team.maxPoints);
});

test('setPoints borne la valeur et ignore les valeurs invalides', function () {
    const team = new Team('ketchup');
    team.setPoints(12);
    assert.strictEqual(team.points, 12);
    team.setPoints(-3);
    assert.strictEqual(team.points, 0);
    team.setPoints(1000);
    assert.strictEqual(team.points, Team.maxPoints);
    team.setPoints('7');
    assert.strictEqual(team.points, Team.maxPoints);
});
