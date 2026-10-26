const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMediaStore, isAcceptedType, pruneDelay } = require('../app/services/media-store');

test('enregistrement des sons et vidéos', function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-'));
    const store = createMediaStore(path.join(dir, 'media'));
    assert.strictEqual(isAcceptedType('audio/mpeg; charset=binary'), true);
    assert.strictEqual(isAcceptedType('text/html'), false);
    assert.strictEqual(isAcceptedType(undefined), false);

    assert.strictEqual(store.save(Buffer.from('x'), 'text/html'), null);
    assert.strictEqual(store.save(Buffer.alloc(0), 'audio/mpeg'), null);
    const sound = store.save(Buffer.from('son'), 'audio/mpeg');
    assert.strictEqual(sound.type, 'audio');
    assert.match(sound.file, /\.mp3$/);
    const video = store.save(Buffer.from('vidéo'), 'video/mp4');
    assert.strictEqual(video.type, 'video');
    assert.strictEqual(store.exists(sound.file), true);
    // Pas de sortie du dossier
    assert.strictEqual(store.exists('../parties.json'), false);

    // Seuls les fichiers inutilisés et anciens sont supprimés
    const old = (Date.now() - pruneDelay - 1000) / 1000;
    fs.utimesSync(path.join(store.dir, sound.file), old, old);
    fs.utimesSync(path.join(store.dir, video.file), old, old);
    const recent = store.save(Buffer.from('récent'), 'audio/ogg');
    store.prune(new Set([video.file]));
    assert.strictEqual(store.exists(sound.file), false);
    assert.strictEqual(store.exists(video.file), true);
    assert.strictEqual(store.exists(recent.file), true);
    fs.rmSync(dir, { recursive: true });
});

test('médias fournis avec les parties', function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-'));
    const library = path.join(dir, 'library');
    fs.mkdirSync(library);
    const file = '6b1c3f0e-5a7d-4e2b-9a61-0c2f8d4b7e11.mp3';
    fs.writeFileSync(path.join(library, file), 'son');
    fs.writeFileSync(path.join(dir, 'secret.mp3'), 'secret');
    const store = createMediaStore(path.join(dir, 'media'), library);

    assert.strictEqual(store.exists(file), false);
    assert.strictEqual(store.restore(file), true);
    assert.strictEqual(store.exists(file), true);
    assert.strictEqual(fs.readFileSync(path.join(store.dir, file), 'utf8'), 'son');
    assert.strictEqual(store.restore('7b1c3f0e-5a7d-4e2b-9a61-0c2f8d4b7e11.mp3'), false);
    assert.strictEqual(store.restore('../secret.mp3'), false);
    // Sans dossier de médias fournis
    assert.strictEqual(createMediaStore(path.join(dir, 'other')).restore(file), false);
    fs.rmSync(dir, { recursive: true });
});
