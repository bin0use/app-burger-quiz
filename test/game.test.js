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
