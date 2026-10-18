const test = require('node:test');
const assert = require('node:assert');
const messages = require('../config/messages-socket');
const { startServer, loginAdmin, waitFor, waitForMatch, pause } = require('./helpers');

/**
 * Prépare un serveur avec un admin, un écran de jeu et une partie
 * @param {*} questions Les questions de la partie
 */
const setup = async function (t, questions) {
    const server = await startServer(null);
    t.after(server.close);
    const { cookie } = await loginAdmin(server.baseUrl);
    const admin = await server.connect(cookie);
    const screen = await server.connect();
    const api = function (method, url, body) {
        return fetch(server.baseUrl + '/admin/api/parties' + url, {
            method: method,
            headers: { Cookie: cookie, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (response) { return response.json(); });
    }
    const party = await api('POST', '', { name: 'Soirée' });
    for (const question of questions || [])
        await api('POST', '/' + party.id + '/questions', question);
    const selected = waitFor(admin, messages.messageToClientReceiveStateQuestion);
    admin.emit(messages.messageSelectParty, party.id);
    await selected;
    /**
     * Joue les transitions jusqu'à la manche donnée (1 : Nuggets)
     */
    const goToRound = async function (count) {
        for (let index = 0; index < count; index++) {
            const played = waitFor(admin, messages.messageToClientReceiveStateTransition);
            admin.emit(messages.messageNextTransition);
            await played;
        }
    }
    const buzzerState = function (target) {
        const client = target || admin;
        client.emit(messages.messageClientNeedStateBuzzer);
        return waitFor(client, messages.messageToClientReceiveStateBuzzer);
    }
    const points = function () {
        screen.emit(messages.messageClientsNeedPointsInformations);
        return waitFor(screen, messages.messageToClientReceivePoints);
    }
    const unlock = async function () {
        const unlocked = waitFor(screen, messages.messageToClientUnLockBuzz);
        admin.emit(messages.messageUnLockBuzz);
        await unlocked;
    }
    const buzz = async function (team) {
        const buzzed = waitFor(screen, messages.messageToClientReceiveBuzz);
        screen.emit(messages.messageClientSendBuzz, team);
        await buzzed;
    }
    return { server, admin, screen, goToRound, buzzerState, points, unlock, buzz };
}

test('bonne réponse en une touche', async function (t) {
    const game = await setup(t, [
        { round: 'nuggets', question: 'N1', answer: 'R1', points: 3 },
        { round: 'nuggets', question: 'N2', answer: 'R2' }
    ]);
    await game.goToRound(1);

    // Sans buzz, rien ne se passe (hors Burger de la mort)
    game.admin.emit(messages.messageGoodAnswer);
    await pause(100);
    assert.deepStrictEqual(await game.points(), [0, 0]);

    await game.unlock();
    await game.buzz('team-ketchup');
    const screenQuestion = waitForMatch(game.screen, messages.messageToClientReceiveScreenQuestion, function (value) {
        return value && value.answer;
    });
    const ketchup = waitFor(game.screen, messages.messageToClientKetchup);
    game.admin.emit(messages.messageGoodAnswer);
    // Les points de la question, la réponse révélée et les buzzers bloqués
    assert.deepStrictEqual(await ketchup, [3]);
    assert.strictEqual((await screenQuestion).answer, 'R1');
    assert.deepStrictEqual(await game.buzzerState(), [true, null, []]);

    // Points attribués à une équipe sans buzz
    const mayo = waitFor(game.screen, messages.messageToClientMayo);
    game.admin.emit(messages.messageGoodAnswer, 'team-mayo');
    assert.deepStrictEqual(await mayo, [3]);
});

test('mauvaise réponse : la main passe à l\'autre équipe', async function (t) {
    const game = await setup(t, []);
    await game.unlock();
    await game.buzz('team-mayo');

    const bad = waitFor(game.screen, messages.messageToClientReceiveBadResponse);
    const state = waitFor(game.screen, messages.messageToClientReceiveStateBuzzer);
    game.admin.emit(messages.messageBuzzBadResponse);
    await bad;
    assert.deepStrictEqual(await state, [false, null, ['team-mayo']]);

    // Mayo ne peut plus buzzer, Ketchup oui
    const buzzes = [];
    game.screen.on(messages.messageToClientReceiveBuzz, function (team) { buzzes.push(team); });
    game.screen.emit(messages.messageClientSendBuzz, 'team-mayo');
    await pause(100);
    await game.buzz('team-ketchup');
    assert.deepStrictEqual(buzzes, ['team-ketchup']);

    // Les deux équipes se sont trompées : plus personne ne buzze
    const last = waitFor(game.screen, messages.messageToClientReceiveStateBuzzer);
    game.admin.emit(messages.messageBuzzBadResponse);
    assert.deepStrictEqual(await last, [true, null, ['team-mayo', 'team-ketchup']]);

    // Débloquer redonne la main à tout le monde
    await game.unlock();
    assert.deepStrictEqual(await game.buzzerState(), [false, null, []]);
});

test("écart entre les deux buzz", async function (t) {
    const game = await setup(t, []);
    await game.unlock();
    await game.buzz('team-mayo');
    const gap = waitFor(game.screen, messages.messageToClientReceiveBuzzGap);
    game.screen.emit(messages.messageClientSendBuzz, 'team-ketchup');
    const [team, delay] = await gap;
    assert.strictEqual(team, 'team-ketchup');
    assert.ok(delay >= 0 && delay <= 2000);
});

test('annuler la dernière action', async function (t) {
    const game = await setup(t, []);
    let adminState = waitFor(game.admin, messages.messageToClientReceiveStateAdmin);
    game.admin.emit(messages.messageClientNeedStateAdmin);
    assert.strictEqual((await adminState)[0].canUndo, false);

    const ketchup = waitFor(game.screen, messages.messageToClientKetchup);
    game.admin.emit(messages.messageKetchupTeam, messages.messageAdd);
    await ketchup;
    await game.unlock();
    await game.buzz('team-mayo');

    // Annule le déblocage (et donc le buzz)
    let state = waitFor(game.screen, messages.messageToClientReceiveStateBuzzer);
    game.admin.emit(messages.messageUndo);
    assert.deepStrictEqual(await state, [true, null, []]);
    // Annule le point
    const undone = waitForMatch(game.screen, messages.messageToClientKetchup, function (points) { return points === 0; });
    adminState = waitForMatch(game.admin, messages.messageToClientReceiveStateAdmin, function (value) { return !value.canUndo; });
    game.admin.emit(messages.messageUndo);
    await undone;
    await adminState;

    // Un joueur ne peut pas annuler
    game.admin.emit(messages.messageMayoTeam, messages.messageAdd);
    await pause(100);
    game.screen.emit(messages.messageUndo);
    await pause(100);
    assert.deepStrictEqual(await game.points(), [1, 0]);
});

test('chrono', async function (t) {
    const game = await setup(t, []);
    let timer = waitFor(game.screen, messages.messageToClientReceiveTimer);
    game.admin.emit(messages.messageTimerStart, 60);
    let state = (await timer)[0];
    assert.strictEqual(state.visible, true);
    assert.strictEqual(state.running, true);
    assert.strictEqual(state.duration, 60);

    timer = waitFor(game.screen, messages.messageToClientReceiveTimer);
    game.admin.emit(messages.messageTimerPause);
    state = (await timer)[0];
    assert.strictEqual(state.running, false);
    assert.ok(state.remaining > 59000 && state.remaining <= 60000);

    // Reprise là où il s'était arrêté
    timer = waitFor(game.screen, messages.messageToClientReceiveTimer);
    game.admin.emit(messages.messageTimerStart, 60);
    assert.ok((await timer)[0].remaining <= state.remaining);

    timer = waitFor(game.screen, messages.messageToClientReceiveTimer);
    game.admin.emit(messages.messageTimerReset);
    assert.strictEqual((await timer)[0].visible, false);

    // Fin du chrono
    const ended = waitFor(game.screen, messages.messageToClientTimerEnded);
    game.admin.emit(messages.messageTimerStart, 1);
    await ended;

    // Un joueur ne peut pas lancer le chrono
    let received = false;
    game.screen.on(messages.messageToClientReceiveTimer, function () { received = true; });
    game.screen.emit(messages.messageTimerStart, 30);
    await pause(100);
    assert.strictEqual(received, false);
});

test('chrono de réponse après un buzz', async function (t) {
    const game = await setup(t, []);
    const adminState = waitForMatch(game.admin, messages.messageToClientReceiveStateAdmin, function (value) {
        return value.buzzTimerSeconds === 5;
    });
    game.admin.emit(messages.messageSetBuzzTimer, 5);
    await adminState;
    await game.unlock();
    const timer = waitFor(game.screen, messages.messageToClientReceiveTimer);
    await game.buzz('team-mayo');
    assert.strictEqual((await timer)[0].duration, 5);
    // La réponse donnée, le chrono disparait
    const hidden = waitForMatch(game.screen, messages.messageToClientReceiveTimer, function (value) { return !value.visible; });
    game.admin.emit(messages.messageBuzzBadResponse);
    await hidden;
});

test('compteur du Burger de la mort', async function (t) {
    const game = await setup(t, []);
    let death = waitForMatch(game.screen, messages.messageToClientReceiveDeathBurger, function (value) { return value.active; });
    await game.goToRound(5);
    assert.deepStrictEqual(await death, { active: true, count: 0, total: 10 });

    for (let index = 1; index <= 3; index++) {
        death = waitFor(game.screen, messages.messageToClientReceiveDeathBurger);
        game.admin.emit(messages.messageGoodAnswer);
        assert.strictEqual((await death)[0].count, index);
    }
    death = waitFor(game.screen, messages.messageToClientReceiveDeathBurger);
    game.admin.emit(messages.messageBuzzBadResponse);
    assert.strictEqual((await death)[0].count, 0);
    // Aucun point sans équipe désignée
    assert.deepStrictEqual(await game.points(), [0, 0]);
});

test('Sel ou Poivre : thème et propositions à l\'écran', async function (t) {
    const game = await setup(t, [
        { round: 'sel-ou-poivre', theme: 'Johnny ou Eddy', question: 'A chanté Allumer le feu', choices: ['Johnny', 'Eddy', 'Les deux'], answer: 'Johnny' }
    ]);
    const screen = waitForMatch(game.screen, messages.messageToClientReceiveScreenQuestion, Boolean);
    await game.goToRound(2);
    assert.deepStrictEqual(await screen, {
        round: 'Sel ou Poivre', theme: 'Johnny ou Eddy', question: '', choices: ['Johnny', 'Eddy', 'Les deux'], points: 1, answer: null
    });
});

test('écran de victoire et lancement de la partie', async function (t) {
    const game = await setup(t, []);
    const mayo = waitFor(game.screen, messages.messageToClientMayo);
    game.admin.emit(messages.messageMayoTeam, messages.messageAdd);
    await mayo;
    const victory = waitFor(game.screen, messages.messageToClientReceiveVictory);
    game.admin.emit(messages.messageToggleVictory);
    assert.deepStrictEqual(await victory, [{ visible: true, winner: 'team-mayo', mayo: 1, ketchup: 0 }]);

    const started = waitFor(game.screen, messages.messageToClientStartGame);
    game.admin.emit(messages.messageStartGame);
    await started;
    // Un écran qui se connecte ensuite passe directement au jeu
    const tv = await game.server.connect();
    const startedLater = waitFor(tv, messages.messageToClientStartGame);
    tv.emit(messages.messageClientNeedStateGame);
    await startedLater;
});

test('buzzers connectés par équipe', async function (t) {
    const game = await setup(t, []);
    const phone = await game.server.connect();
    let state = waitForMatch(game.admin, messages.messageToClientReceiveStateAdmin, function (value) {
        return value.buzzers['team-ketchup'] === 1;
    });
    phone.emit(messages.messageClientRegisterBuzzer, 'team-ketchup');
    phone.emit(messages.messageClientRegisterBuzzer, 'team-inconnue');
    assert.deepStrictEqual((await state).buzzers, { 'team-mayo': 0, 'team-ketchup': 1 });
    state = waitForMatch(game.admin, messages.messageToClientReceiveStateAdmin, function (value) {
        return value.buzzers['team-ketchup'] === 0;
    });
    phone.close();
    await state;
});

test('nouvelle manche ou nouvelle question : le buzz précédent ne compte plus', async function (t) {
    const game = await setup(t, [
        { round: 'nuggets', question: 'N1' },
        { round: 'nuggets', question: 'N2' }
    ]);
    await game.goToRound(1);
    await game.unlock();
    await game.buzz('team-mayo');
    let state = waitFor(game.screen, messages.messageToClientReceiveStateBuzzer);
    game.admin.emit(messages.messageNextQuestion);
    assert.deepStrictEqual(await state, [true, null, []]);

    await game.unlock();
    await game.buzz('team-ketchup');
    state = waitFor(game.screen, messages.messageToClientReceiveStateBuzzer);
    game.admin.emit(messages.messageNextTransition);
    assert.deepStrictEqual(await state, [true, null, []]);
});
