const test = require('node:test');
const assert = require('node:assert');
const credentials = require('../config/credentials');

test('identifiants par défaut acceptés, casse du login ignorée', function () {
    assert.ok(credentials.check('admin', 'burger2018'));
    assert.ok(credentials.check('ADMIN', 'burger2018'));
    assert.ok(credentials.isUsingDefaultPassword());
});

test('mauvais identifiants refusés', function () {
    assert.ok(!credentials.check('admin', 'Burger2018'));
    assert.ok(!credentials.check('root', 'burger2018'));
    assert.ok(!credentials.check(undefined, undefined));
});
