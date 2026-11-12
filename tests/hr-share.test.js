const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../hr-share-model.js');
test('HR tokens use 256 random bits and links retain the GitHub Pages base', () => {
  const id = M.token(require('node:crypto').webcrypto);
  assert.equal(id.length, 64); assert.ok(M.validToken(id));
  assert.notEqual(id, M.token(require('node:crypto').webcrypto));
  assert.equal(M.link('https://reza5208.github.io/RezaOT-v2/', id), 'https://reza5208.github.io/RezaOT-v2/hr.html#' + id);
  for (const bad of ['', '../users/default', 'x'.repeat(64), 'a'.repeat(63)]) {
    assert.equal(M.validToken(bad), false); assert.throws(() => M.link('https://example.test/', bad));
  }
});
test('HR snapshot format validates print-only bounded text and rejects malformed content', () => {
  const report = {title:'OT',header:'Name',footer:'Total',headings:Array(8).fill('Column'),rows:[Array(8).fill('Text')],totalLabel:'TOTAL OT',total:'3.00'};
  const value = {version:1,month:'Oktober 2026',updatedAt:1,expiresAt:2,report:JSON.stringify(report)};
  assert.deepEqual(M.validate(value), report);
  for (const patch of [{version:2},{expiresAt:0},{report:'{}'},{report:'x'.repeat(250001)},{report:JSON.stringify({...report,rows:[]})},{report:JSON.stringify({...report,rows:[['bad']]})}]) {
    assert.throws(() => M.validate({...value,...patch}));
  }
});
