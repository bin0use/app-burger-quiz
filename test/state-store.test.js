const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStateStore } = require('../app/services/state-store');

test("sauvegarde puis restauration de l'état", function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-'));
    const file = path.join(dir, 'sub', 'state.json');
    const store = createStateStore(file);
    assert.strictEqual(store.load(), null);
    store.save({ mayo: 3, ketchup: 5, transitionIndex: 1 });
    assert.deepStrictEqual(createStateStore(file).load(), { mayo: 3, ketchup: 5, transitionIndex: 1 });
    fs.rmSync(dir, { recursive: true });
});

test('fichier corrompu ou absence de fichier : aucun état', function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-'));
    const file = path.join(dir, 'state.json');
    fs.writeFileSync(file, '{pas du json');
    assert.strictEqual(createStateStore(file).load(), null);
    assert.strictEqual(createStateStore(null).load(), null);
    createStateStore(null).save({ mayo: 1 });
    fs.rmSync(dir, { recursive: true });
});
