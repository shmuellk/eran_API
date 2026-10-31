const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
// Values created inside the vm context have foreign prototypes; compare them as plain JSON.
const plain = value => JSON.parse(JSON.stringify(value));
function setup(existing = {}, { failInsert = false } = {}) {
  const inserts = []; const log = [];
  const connection = { beginTransaction: async () => log.push('begin'), commit: async () => log.push('commit'), rollback: async () => log.push('rollback'), release() {},
    query: async (sql, params) => { if (failInsert) throw new Error('boom'); inserts.push(params); } };
  const pool = { query: async (sql, [name]) => [existing[name] ? [{ U_USER_NAME: name, U_TYPE: existing[name] }] : []], getConnection: async () => connection };
  const context = { module: { exports: {} }, console: { error() {} }, require: name => name.includes('connection_cars') ? pool : require('../controllers/userTypes') };
  vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/mosofonImportController'), 'utf8'), context);
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
  const req = body => ({ body, auth: { user: { U_USER_NAME: 'boss', U_TYPE: 'מנהל על' } } });
  return { api: context.module.exports, req, res, inserts, log };
}
test('mosofon import dry run writes nothing and renames taken names', async () => {
  const { api, req, res, inserts } = setup({ 'נועם': 'לקוח', yossi: 'עובד' });
  await api.importMosofonUsers(req({ users: [{ userName: 'נועם' }, { userName: 'yossi' }, { userName: 'avi' }], cardCode: '99' }), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.applied, false); assert.equal(inserts.length, 0);
  assert.deepEqual(plain(res.body.renamed.map(u => [u.original, u.name])), [['נועם', 'נועם2']]);
  assert.deepEqual(plain(res.body.skipped), [{ name: 'yossi', migratedAs: 'yossi' }]);
});
test('mosofon import apply creates staff accounts with password = user name', async () => {
  const { api, req, res, inserts, log } = setup({ dani: 'מנהל', dani2: 'לקוח' });
  await api.importMosofonUsers(req({ users: [{ userName: 'dani' }], cardCode: '99', apply: true }), res);
  assert.equal(res.statusCode, 200); assert.deepEqual(log, ['begin', 'commit']);
  assert.deepEqual(plain(inserts[0]), ['99', 'dani3', 'dani3', 'עובד', 'dani3', 'dani3', 'boss']);
});
test('mosofon import rolls back on failure and rejects bad input', async () => {
  const failing = setup({}, { failInsert: true });
  await failing.api.importMosofonUsers(failing.req({ users: [{ userName: 'a' }], cardCode: '99', apply: true }), failing.res);
  assert.equal(failing.res.statusCode, 500); assert.deepEqual(failing.log, ['begin', 'rollback']);
  const { api, req, res } = setup();
  await api.importMosofonUsers(req({ users: [{ userName: 'a' }] }), res); assert.equal(res.statusCode, 400);
});
