const test = require('node:test');
const assert = require('node:assert');
const network = require('../utils/network');
const { retrieveUrlForQrCodeGeneration } = require('../app/services/url-resolver');

const fakeRequest = function (host) {
    return {
        protocol: 'http',
        hostname: host.split(':')[0],
        headers: { host: host },
        get: function () { return host; }
    };
}

test("une url publique est renvoyée telle quelle", function () {
    assert.strictEqual(retrieveUrlForQrCodeGeneration(fakeRequest('quiz.example.com')), 'http://quiz.example.com');
});

test("localhost est remplacé par l'ip de la machine (en gardant le port)", function () {
    const [ip] = network.getIpAddressServer();
    const url = retrieveUrlForQrCodeGeneration(fakeRequest('localhost:3000'));
    assert.strictEqual(url, ip ? `http://${ip}:3000` : '');
});
