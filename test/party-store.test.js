const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPartyStore, ValidationError } = require('../app/services/party-store');

test('création, renommage, duplication et suppression de parties', function () {
    const store = createPartyStore(null);
    const party = store.create('  Soirée  ');
    assert.strictEqual(party.name, 'Soirée');
    assert.throws(function () { store.create('   '); }, ValidationError);

    store.addQuestion(party.id, { round: 'nuggets', question: 'Q1', answer: 'R1' });
    assert.strictEqual(store.rename(party.id, 'Anniversaire').name, 'Anniversaire');
    assert.strictEqual(store.rename('inconnue', 'X'), null);

    const copy = store.duplicate(party.id);
    assert.strictEqual(copy.name, 'Anniversaire (copie)');
    assert.notStrictEqual(copy.questions[0].id, store.get(party.id).questions[0].id);
    assert.deepStrictEqual(store.list().map(function (p) { return p.questionsCount; }), [1, 1]);

    assert.strictEqual(store.remove(party.id), true);
    assert.strictEqual(store.remove(party.id), false);
    assert.strictEqual(store.list().length, 1);
});

test('questions : validation, modification et ordre au sein de la manche', function () {
    const store = createPartyStore(null);
    const party = store.create('Partie');
    assert.throws(function () { store.addQuestion(party.id, { round: 'inconnue', question: 'Q' }); }, ValidationError);
    assert.throws(function () { store.addQuestion(party.id, { round: 'menus', question: ' ' }); }, ValidationError);
    assert.throws(function () { store.addQuestion(party.id, { round: 'menus', question: 'x'.repeat(501) }); }, ValidationError);
    assert.throws(function () { store.addQuestion(party.id, { round: 'nuggets', question: 'Q', choices: 'A' }); }, ValidationError);
    assert.throws(function () { store.addQuestion(party.id, { round: 'nuggets', question: 'Q', choices: ['1', '2', '3', '4', '5'] }); }, ValidationError);
    assert.deepStrictEqual(store.addQuestion(party.id, { round: 'nuggets', question: 'Q', choices: [' A ', '', 'B'] }).choices, ['A', 'B']);

    store.removeQuestion(party.id, store.questionsOfRound(party.id, 'nuggets')[0].id);
    const q1 = store.addQuestion(party.id, { round: 'nuggets', question: 'Q1' });
    store.addQuestion(party.id, { round: 'menus', theme: 'Cinéma', question: 'M1', answer: 'R' });
    const q2 = store.addQuestion(party.id, { round: 'nuggets', question: 'Q2' });

    const texts = function (round) {
        return store.questionsOfRound(party.id, round).map(function (q) { return q.question; });
    }
    store.moveQuestion(party.id, q2.id, -1);
    assert.deepStrictEqual(texts('nuggets'), ['Q2', 'Q1']);
    // Déjà en tête : rien ne bouge
    store.moveQuestion(party.id, q2.id, -1);
    assert.deepStrictEqual(texts('nuggets'), ['Q2', 'Q1']);
    assert.throws(function () { store.moveQuestion(party.id, q2.id, 5); }, ValidationError);

    // Changement de manche : la question passe en fin de manche
    store.updateQuestion(party.id, q1.id, { round: 'menus', question: 'Q1 bis', answer: 'A' });
    assert.deepStrictEqual(texts('menus'), ['M1', 'Q1 bis']);
    assert.deepStrictEqual(store.list()[0].counts,
        { 'nuggets': 1, 'sel-ou-poivre': 0, 'menus': 2, 'addition': 0, 'burger-de-la-mort': 0 });

    assert.strictEqual(store.removeQuestion(party.id, q1.id), true);
    assert.strictEqual(store.updateQuestion(party.id, q1.id, { round: 'menus', question: 'Q' }), null);
});

test('import et persistance dans un fichier', function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-'));
    const file = path.join(dir, 'parties.json');
    let changes = 0;
    const store = createPartyStore(file);
    store.onChange(function () { changes++; });
    assert.throws(function () { store.importParty({ name: 'X' }); }, ValidationError);
    const party = store.importParty({
        name: 'Importée',
        questions: [{ round: 'addition', question: 'Combien ?', answer: '42' }]
    });
    assert.strictEqual(changes, 1);

    const reloaded = createPartyStore(file);
    assert.deepStrictEqual(reloaded.get(party.id), party);
    // Les objets renvoyés sont des copies
    reloaded.get(party.id).questions.length = 0;
    assert.strictEqual(reloaded.get(party.id).questions.length, 1);
    fs.rmSync(dir, { recursive: true });
});

test('sons et vidéos des questions', function () {
    const existing = '0f8fad5b-d9cb-469f-a165-70867728950e.mp3';
    const missing = '7c9e6679-7425-40de-944b-e07fc1f90ae7.mp4';
    const store = createPartyStore(null, { mediaExists: function (file) { return file === existing; } });
    const party = store.create('Partie');
    assert.throws(function () {
        store.addQuestion(party.id, { round: 'menus', question: 'Q', questionMedia: { file: '../secret', type: 'audio' } });
    }, ValidationError);
    assert.throws(function () {
        store.addQuestion(party.id, { round: 'menus', question: 'Q', questionMedia: { file: existing, type: 'image' } });
    }, ValidationError);

    const question = store.addQuestion(party.id, {
        round: 'menus',
        question: 'Quel est ce générique ?',
        questionMedia: { file: existing, type: 'audio', name: ' generique.mp3 ', extra: 'ignoré' },
        // Fichier absent du serveur (partie importée) : ignoré
        answerMedia: { file: missing, type: 'video' }
    });
    assert.deepStrictEqual(question.questionMedia, { file: existing, type: 'audio', name: 'generique.mp3' });
    assert.strictEqual(question.answerMedia, null);
    assert.deepStrictEqual(Array.from(store.usedMedia()), [existing]);

    store.updateQuestion(party.id, question.id, { round: 'menus', question: 'Q' });
    assert.strictEqual(store.usedMedia().size, 0);
});
