/**
 * Outils partagés par les tests du serveur de jeu
 */
const ioClient = require('socket.io-client');
const { createServer } = require('../app/create-server');

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

/**
 * Attend un message sur une socket dont le premier argument vérifie le prédicat
 */
const waitForMatch = function (client, message, predicate) {
    return new Promise(function (resolve) {
        const listener = function (value) {
            if (!predicate(value))
                return;
            client.off(message, listener);
            resolve(value);
        };
        client.on(message, listener);
    });
}

const pause = function (ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

module.exports = { startServer, loginAdmin, waitFor, waitForMatch, pause };
