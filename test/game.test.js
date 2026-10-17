const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ioClient = require('socket.io-client');
const { createServer } = require('../app/create-server');
const messages = require('../config/messages-socket');

/**
 * Démarre un serveur sur un port libre
 */
const startServer = async function (stateFile) {
    const server = createServer({ stateFile: stateFile });
    await new Promise(function (resolve) {
        server.httpServer.listen(0, resolve);
    });
    const baseUrl = 'http://localhost:' + server.httpServer.address().port;
    const clients = [];
    return {
        baseUrl,
        connect: async function (cookie) {
            const client = ioClient(baseUrl, {
                extraHeaders: cookie ? { Cookie: cookie } : {},
                forceNew: true
            });
            clients.push(client);
            await new Promise(function (resolve) {
                client.on('connect', resolve);
            });
            return client;
        },
        close: async function () {
            clients.forEach(function (client) { client.close(); });
            server.io.close();
            await new Promise(function (resolve) {
                server.httpServer.close(resolve);
            });
        }
    };
}

/**
 * Se connecte en admin et renvoie le cookie de session
 */
const loginAdmin = async function (baseUrl, password) {
    const response = await fetch(baseUrl + '/login', {
        method: 'POST',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'username=admin&password=' + encodeURIComponent(password || 'burger2018')
    });
    return {
        location: response.headers.get('location'),
        cookie: (response.headers.get('set-cookie') || '').split(';')[0]
    };
}

/**
 * Attend un message sur une socket
 */
const waitFor = function (client, message) {
    return new Promise(function (resolve) {
        client.once(message, function () {
            resolve(Array.from(arguments));
        });
    });
}

const pause = function (ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

test('routes http', async function (t) {
    const server = await startServer(null);
    t.after(server.close);

    const get = function (url, cookie) {
        return fetch(server.baseUrl + url, { redirect: 'manual', headers: cookie ? { Cookie: cookie } : {} });
    }

    await t.test('/admin redirige vers /login sans authentification', async function () {
        const response = await get('/admin');
        assert.strictEqual(response.headers.get('location'), '/login');
    });

    await t.test('mauvais mot de passe : retour au login avec message', async function () {
        const login = await loginAdmin(server.baseUrl, 'faux');
        assert.strictEqual(login.location, '/login');
        const page = await (await get('/login', login.cookie)).text();
        assert.match(page, /Identifiant ou mot de passe incorrect/);
    });

    await t.test('connexion admin puis déconnexion', async function () {
        const login = await loginAdmin(server.baseUrl);
        assert.strictEqual(login.location, '/admin');
        assert.strictEqual((await get('/admin', login.cookie)).status, 200);
        await get('/logout', login.cookie);
        assert.strictEqual((await get('/admin', login.cookie)).headers.get('location'), '/login');
    });

    await t.test('/buzzer refuse une équipe inconnue', async function () {
        assert.strictEqual((await get('/buzzer?team=<script>')).headers.get('location'), '/');
        assert.strictEqual((await get('/buzzer?team=team-mayo')).status, 200);
    });

    await t.test('/game contient le QR code', async function () {
        const page = await (await get('/game')).text();
        assert.match(page, /data:image\/png;base64/);
    });

    await t.test('librairies front et messages partagés servis', async function () {
        assert.strictEqual((await get('/vendors/jquery/jquery.min.js')).status, 200);
        assert.strictEqual((await get('/vendors/bootstrap/css/bootstrap.min.css')).status, 200);
        assert.strictEqual((await get('/vendors/bootstrap/js/bootstrap.bundle.min.js')).status, 200);
        assert.match(await (await get('/js/messages-socket.js')).text(), /BQ_MESSAGES/);
    });

    await t.test('gestion des parties réservée à l\'admin', async function () {
        assert.strictEqual((await get('/admin/parties')).headers.get('location'), '/login');
        assert.strictEqual((await get('/admin/api/parties')).status, 401);
        const { cookie } = await loginAdmin(server.baseUrl);
        const page = await (await get('/admin/parties', cookie)).text();
        assert.match(page, /Gestion des parties/);
        assert.match(page, /Burger de la mort/);
    });

    await t.test('API des parties et questions', async function () {
        const { cookie } = await loginAdmin(server.baseUrl);
        const call = async function (method, url, body, type) {
            const response = await fetch(server.baseUrl + '/admin/api/parties' + url, {
                method: method,
                headers: { Cookie: cookie, 'Content-Type': type || 'application/json' },
                body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body))
            });
            return { status: response.status, body: response.status === 204 ? null : await response.json() };
        }

        // Un formulaire (non JSON) est refusé
        assert.strictEqual((await call('POST', '', 'name=Pirate', 'application/x-www-form-urlencoded')).status, 415);
        assert.strictEqual((await call('POST', '', { name: '' })).status, 400);

        const party = (await call('POST', '', { name: 'Soirée' })).body;
        let response = await call('POST', '/' + party.id + '/questions', { round: 'nuggets', question: 'Q1', answer: 'R1' });
        assert.strictEqual(response.status, 201);
        const question = response.body;
        assert.strictEqual((await call('POST', '/' + party.id + '/questions', { round: 'x', question: 'Q' })).status, 400);

        response = await call('PUT', '/' + party.id + '/questions/' + question.id, { round: 'nuggets', question: 'Q1 bis', answer: 'R' });
        assert.strictEqual(response.body.question, 'Q1 bis');
        assert.strictEqual((await call('PUT', '/' + party.id, { name: 'Soirée 2' })).body.name, 'Soirée 2');

        const exported = await (await get('/admin/api/parties/' + party.id + '/export', cookie)).json();
        assert.deepStrictEqual(exported, {
            name: 'Soirée 2',
            questions: [{ round: 'nuggets', theme: '', question: 'Q1 bis', answer: 'R' }]
        });
        const imported = (await call('POST', '/import', exported)).body;
        assert.notStrictEqual(imported.id, party.id);
        assert.strictEqual((await call('POST', '/' + party.id + '/duplicate', {})).status, 201);
        assert.strictEqual((await call('GET', '')).body.length, 3);

        assert.strictEqual((await call('DELETE', '/' + party.id + '/questions/' + question.id)).status, 204);
        assert.strictEqual((await call('DELETE', '/' + party.id)).status, 204);
        assert.strictEqual((await call('GET', '/' + party.id)).status, 404);
    });
});

test('déroulement du jeu', async function (t) {
    const server = await startServer(null);
    t.after(server.close);
    const { cookie } = await loginAdmin(server.baseUrl);
    const admin = await server.connect(cookie);
    const player = await server.connect();

    await t.test('un joueur ne peut pas piloter le jeu', async function () {
        let received = false;
        player.on(messages.messageToClientMayo, function () { received = true; });
        player.emit(messages.messageMayoTeam, messages.messageAdd);
        player.emit(messages.messageUnLockBuzz);
        player.emit(messages.messageNextTransition);
        await pause(200);
        assert.strictEqual(received, false);
        player.emit(messages.messageClientNeedStateBuzzer);
        assert.deepStrictEqual(await waitFor(player, messages.messageToClientReceiveStateBuzzer), [true, null]);
    });

    await t.test("l'admin modifie les points", async function () {
        const points = waitFor(player, messages.messageToClientMayo);
        admin.emit(messages.messageMayoTeam, messages.messageAdd);
        assert.deepStrictEqual(await points, [1]);
    });

    await t.test('seul le premier buzz est pris en compte', async function () {
        const unlocked = waitFor(player, messages.messageToClientUnLockBuzz);
        admin.emit(messages.messageUnLockBuzz);
        await unlocked;

        const buzzes = [];
        player.on(messages.messageToClientReceiveBuzz, function (team) { buzzes.push(team); });
        player.emit(messages.messageClientSendBuzz, 'team-inconnue');
        player.emit(messages.messageClientSendBuzz, 'team-ketchup');
        player.emit(messages.messageClientSendBuzz, 'team-mayo');
        await pause(200);
        assert.deepStrictEqual(buzzes, ['team-ketchup']);

        admin.emit(messages.messageClientNeedStateBuzzer);
        assert.deepStrictEqual(await waitFor(admin, messages.messageToClientReceiveStateBuzzer), [true, 'team-ketchup']);
    });

    await t.test('transitions suivante et précédente', async function () {
        let video = waitFor(player, messages.messageToClientNextTransition);
        admin.emit(messages.messageNextTransition);
        assert.deepStrictEqual(await video, ['nuggets-transition.mp4']);

        video = waitFor(player, messages.messageToClientNextTransition);
        const state = waitFor(admin, messages.messageToClientReceiveStateTransition);
        admin.emit(messages.messageNextTransition);
        assert.deepStrictEqual(await video, ['selt-pepper-transition.mp4']);
        assert.deepStrictEqual(await state, [{ current: 'Sel ou Poivre', next: 'Les menus', hasPrevious: true }]);

        video = waitFor(player, messages.messageToClientNextTransition);
        admin.emit(messages.messagePreviousTransition);
        assert.deepStrictEqual(await video, ['nuggets-transition.mp4']);
    });

    await t.test('recharger la partie remet tout à zéro', async function () {
        const reload = waitFor(player, messages.messageToClientReloadPart);
        admin.emit(messages.messageReloadPart);
        await reload;
        player.emit(messages.messageClientsNeedPointsInformations);
        assert.deepStrictEqual(await waitFor(player, messages.messageToClientReceivePoints), [0, 0]);
        player.emit(messages.messageClientNeedStateTransition);
        assert.deepStrictEqual(await waitFor(player, messages.messageToClientReceiveStateTransition),
            [{ current: null, next: 'Nuggets', hasPrevious: false }]);
    });
});

test('questions sur la télécommande', async function (t) {
    const server = await startServer(null);
    t.after(server.close);
    const { cookie } = await loginAdmin(server.baseUrl);
    const admin = await server.connect(cookie);
    const player = await server.connect();

    const api = function (method, url, body) {
        return fetch(server.baseUrl + '/admin/api/parties' + url, {
            method: method,
            headers: { Cookie: cookie, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (response) { return response.json(); });
    }
    const party = await api('POST', '', { name: 'Soirée' });
    await api('POST', '/' + party.id + '/questions', { round: 'nuggets', question: 'N1', answer: 'R1' });
    await api('POST', '/' + party.id + '/questions', { round: 'nuggets', question: 'N2', answer: 'R2' });
    await api('POST', '/' + party.id + '/questions', { round: 'sel-ou-poivre', question: 'S1', answer: 'Sel' });

    // Les joueurs ne reçoivent jamais les questions (ni les réponses)
    let playerReceived = false;
    player.on(messages.messageToClientReceiveStateQuestion, function () { playerReceived = true; });
    player.emit(messages.messageClientNeedStateQuestion);
    player.emit(messages.messageSelectParty, party.id);

    let state = waitFor(admin, messages.messageToClientReceiveStateQuestion);
    admin.emit(messages.messageSelectParty, party.id);
    assert.strictEqual((await state)[0].activePartyId, party.id);
    assert.strictEqual((await state)[0].question, null);

    state = waitFor(admin, messages.messageToClientReceiveStateQuestion);
    admin.emit(messages.messageNextTransition);
    let current = (await state)[0];
    assert.strictEqual(current.round, 'Nuggets');
    assert.strictEqual(current.total, 2);
    assert.strictEqual(current.question.question, 'N1');
    assert.strictEqual(current.question.answer, 'R1');

    state = waitFor(admin, messages.messageToClientReceiveStateQuestion);
    admin.emit(messages.messageNextQuestion);
    assert.strictEqual((await state)[0].question.question, 'N2');

    // Nouvelle manche : retour à la première question
    state = waitFor(admin, messages.messageToClientReceiveStateQuestion);
    admin.emit(messages.messageNextTransition);
    current = (await state)[0];
    assert.strictEqual(current.round, 'Sel ou Poivre');
    assert.strictEqual(current.question.question, 'S1');

    // Suppression de la partie active depuis la page de gestion
    state = waitFor(admin, messages.messageToClientReceiveStateQuestion);
    await fetch(server.baseUrl + '/admin/api/parties/' + party.id, { method: 'DELETE', headers: { Cookie: cookie } });
    current = (await state)[0];
    assert.strictEqual(current.activePartyId, null);
    assert.deepStrictEqual(current.parties, []);

    await pause(100);
    assert.strictEqual(playerReceived, false);
});

test('la partie survit à un redémarrage du serveur', async function (t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-'));
    const stateFile = path.join(dir, 'state.json');
    t.after(function () { fs.rmSync(dir, { recursive: true }); });

    let server = await startServer(stateFile);
    const { cookie } = await loginAdmin(server.baseUrl);
    const admin = await server.connect(cookie);
    const points = waitFor(admin, messages.messageToClientKetchup);
    admin.emit(messages.messageKetchupTeam, messages.messageAdd);
    await points;
    const video = waitFor(admin, messages.messageToClientNextTransition);
    admin.emit(messages.messageNextTransition);
    await video;
    await server.close();

    server = await startServer(stateFile);
    t.after(server.close);
    const player = await server.connect();
    player.emit(messages.messageClientsNeedPointsInformations);
    assert.deepStrictEqual(await waitFor(player, messages.messageToClientReceivePoints), [0, 1]);
    player.emit(messages.messageClientNeedStateTransition);
    assert.deepStrictEqual(await waitFor(player, messages.messageToClientReceiveStateTransition),
        [{ current: 'Nuggets', next: 'Sel ou Poivre', hasPrevious: false }]);
});
