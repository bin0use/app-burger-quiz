const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const messages = require('../config/messages-socket');
const { startServer, loginAdmin, waitFor, waitForMatch, pause } = require('./helpers');

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
        // Polices hébergées localement (la partie marche sans internet)
        assert.strictEqual((await get('/vendors/fonts/bangers/files/bangers-latin-400-normal.woff2')).status, 200);
        assert.strictEqual((await get('/vendors/fonts/fredoka/files/fredoka-latin-wght-normal.woff2')).status, 200);
        assert.strictEqual((await get('/css/fonts.css')).status, 200);
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
            questions: [{ round: 'nuggets', theme: '', question: 'Q1 bis', choices: [], answer: 'R', points: 1, note: '' }]
        });
        const imported = (await call('POST', '/import', exported)).body;
        assert.notStrictEqual(imported.id, party.id);
        assert.strictEqual((await call('POST', '/' + party.id + '/duplicate', {})).status, 201);
        assert.strictEqual((await call('GET', '')).body.length, 3);

        // Copie / déplacement vers une autre partie
        const transfer = function (questionIds, mode) {
            return call('POST', '/' + party.id + '/questions/transfer', { questionIds: questionIds, targetId: imported.id, mode: mode });
        }
        assert.strictEqual((await transfer([question.id], 'swap')).status, 400);
        assert.strictEqual((await transfer(['inconnue'], 'copy')).status, 404);
        response = await transfer([question.id], 'copy');
        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(response.body.questions.map(function (q) { return q.question; }), ['Q1 bis', 'Q1 bis']);
        assert.strictEqual((await transfer([question.id], 'move')).body.questions.length, 3);
        assert.strictEqual((await call('GET', '/' + party.id)).body.questions.length, 0);
        assert.strictEqual((await call('DELETE', '/' + party.id + '/questions/' + question.id)).status, 404);
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
        assert.deepStrictEqual(await waitFor(player, messages.messageToClientReceiveStateBuzzer), [true, null, []]);
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
        assert.deepStrictEqual(await waitFor(admin, messages.messageToClientReceiveStateBuzzer), [true, 'team-ketchup', []]);
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
    await api('POST', '/' + party.id + '/questions', { round: 'nuggets', question: 'N1', choices: ['R1', 'Faux'], answer: 'R1' });
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
    const firstScreen = waitForMatch(player, messages.messageToClientReceiveScreenQuestion, Boolean);
    admin.emit(messages.messageNextTransition);
    await firstScreen;
    let current = (await state)[0];
    assert.strictEqual(current.round, 'Nuggets');
    assert.strictEqual(current.total, 2);
    assert.strictEqual(current.question.question, 'N1');
    assert.strictEqual(current.question.answer, 'R1');

    // Nuggets : la question et les propositions s'affichent à l'écran, sans la réponse
    player.emit(messages.messageClientNeedScreenQuestion);
    assert.deepStrictEqual(await waitFor(player, messages.messageToClientReceiveScreenQuestion), [{
        round: 'Nuggets', theme: '', question: 'N1', choices: ['R1', 'Faux'], points: 1, answer: null
    }]);
    let screen = waitForMatch(player, messages.messageToClientReceiveScreenQuestion, function (value) {
        return value && value.answer;
    });
    admin.emit(messages.messageToggleRevealAnswer);
    assert.strictEqual((await screen).answer, 'R1');
    screen = waitFor(player, messages.messageToClientReceiveScreenQuestion);
    admin.emit(messages.messageToggleScreenQuestion);
    assert.deepStrictEqual(await screen, [null]);
    // Un joueur ne peut ni afficher ni révéler
    player.emit(messages.messageToggleScreenQuestion);
    player.emit(messages.messageToggleRevealAnswer);
    await pause(100);
    player.emit(messages.messageClientNeedScreenQuestion);
    assert.deepStrictEqual(await waitFor(player, messages.messageToClientReceiveScreenQuestion), [null]);

    // Question suivante : de nouveau affichée, réponse cachée
    state = waitFor(admin, messages.messageToClientReceiveStateQuestion);
    screen = waitFor(player, messages.messageToClientReceiveScreenQuestion);
    admin.emit(messages.messageNextQuestion);
    assert.strictEqual((await state)[0].question.question, 'N2');
    assert.strictEqual((await screen)[0].question, 'N2');
    assert.strictEqual((await screen)[0].answer, null);

    // Nouvelle manche : retour à la première question
    // Sel ou Poivre n'affiche que le thème et les propositions : rien ici (S1 n'en a pas)
    state = waitFor(admin, messages.messageToClientReceiveStateQuestion);
    screen = waitFor(player, messages.messageToClientReceiveScreenQuestion);
    admin.emit(messages.messageNextTransition);
    current = (await state)[0];
    assert.strictEqual(current.round, 'Sel ou Poivre');
    assert.strictEqual(current.question.question, 'S1');
    assert.strictEqual(current.screenMode, 'choices');
    assert.deepStrictEqual(await screen, [null]);

    // Suppression de la partie active depuis la page de gestion
    state = waitFor(admin, messages.messageToClientReceiveStateQuestion);
    await fetch(server.baseUrl + '/admin/api/parties/' + party.id, { method: 'DELETE', headers: { Cookie: cookie } });
    current = (await state)[0];
    assert.strictEqual(current.activePartyId, null);
    assert.deepStrictEqual(current.parties, []);

    await pause(100);
    assert.strictEqual(playerReceived, false);
});

test('sons et vidéos des questions', async function (t) {
    const server = await startServer(null);
    t.after(server.close);
    const { cookie } = await loginAdmin(server.baseUrl);
    const upload = async function (body, type, headers) {
        const response = await fetch(server.baseUrl + '/admin/api/media', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': type }, headers),
            body: body
        });
        return { status: response.status, body: await response.json().catch(function () { return null; }) };
    }

    // Réservé à l'admin, formats audio / vidéo uniquement
    assert.strictEqual((await upload('son', 'audio/mpeg')).status, 401);
    assert.strictEqual((await upload('<html>', 'text/html', { Cookie: cookie })).status, 415);
    const sound = await upload('contenu du son', 'audio/mpeg', { Cookie: cookie, 'X-File-Name': encodeURIComponent('générique.mp3') });
    assert.strictEqual(sound.status, 201);
    assert.strictEqual(sound.body.type, 'audio');
    assert.strictEqual(sound.body.name, 'générique.mp3');
    const video = (await upload('contenu de la vidéo', 'video/mp4', { Cookie: cookie })).body;

    // Les médias sont servis aux écrans de jeu (lecture partielle pour les vidéos)
    let response = await fetch(server.baseUrl + '/media/' + sound.body.file, { headers: { Range: 'bytes=0-6' } });
    assert.strictEqual(response.status, 206);
    assert.strictEqual(await response.text(), 'contenu');
    response = await fetch(server.baseUrl + '/media/inconnu.mp3', { redirect: 'manual' });
    await response.text();
    assert.strictEqual(response.status, 404);

    const api = function (method, url, body) {
        return fetch(server.baseUrl + '/admin/api/parties' + url, {
            method: method,
            headers: { Cookie: cookie, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (response) { return response.json(); });
    }
    const party = await api('POST', '', { name: 'Blind test' });
    const question = await api('POST', '/' + party.id + '/questions', {
        round: 'nuggets', question: 'Quel est ce générique ?', answer: 'Friends',
        questionMedia: sound.body, answerMedia: video
    });
    assert.strictEqual(question.questionMedia.file, sound.body.file);
    assert.strictEqual(question.answerMedia.type, 'video');
    const exported = await (await fetch(server.baseUrl + '/admin/api/parties/' + party.id + '/export', { headers: { Cookie: cookie } })).json();
    assert.deepStrictEqual(exported.questions[0].answerMedia, question.answerMedia);

    const admin = await server.connect(cookie);
    const player = await server.connect();
    admin.emit(messages.messageSelectParty, party.id);
    let stop = waitFor(player, messages.messageToClientStopMedia);
    admin.emit(messages.messageNextTransition);
    await stop;
    await pause(100);

    // Un joueur ne peut pas lancer de média
    let played = null;
    player.on(messages.messageToClientPlayMedia, function (media) { played = media; });
    player.emit(messages.messagePlayMedia, 'questionMedia');
    await pause(100);
    assert.strictEqual(played, null);

    let play = waitFor(player, messages.messageToClientPlayMedia);
    admin.emit(messages.messagePlayMedia, 'questionMedia');
    assert.deepStrictEqual(await play, [{ url: '/media/' + sound.body.file, type: 'audio' }]);
    play = waitFor(player, messages.messageToClientPlayMedia);
    admin.emit(messages.messagePlayMedia, 'answerMedia');
    assert.deepStrictEqual(await play, [{ url: '/media/' + video.file, type: 'video' }]);
    stop = waitFor(player, messages.messageToClientStopMedia);
    admin.emit(messages.messageStopMedia);
    await stop;
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
