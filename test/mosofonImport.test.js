const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
// Values created inside the vm context have foreign prototypes; compare them as plain JSON.
const plain = value => JSON.parse(JSON.stringify(value));
function setup(existingStaff = [], { failInsert = false } = {}) {
  const inserts = []; const log = []; const selects = [];
  const connection = { beginTransaction: async () => log.push('begin'), commit: async () => log.push('commit'), rollback: async () => log.push('rollback'), release() {},
    query: async (sql, params) => { if (failInsert) throw new Error('boom'); inserts.push([sql, params]); } };
  const pool = { query: async (sql, [name]) => { selects.push(sql); return [existingStaff.includes(name) ? [{ U_USER_NAME: name }] : []]; }, getConnection: async () => connection };
  const context = { module: { exports: {} }, console: { error() {} }, require: () => pool };
  vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/mosofonImportController'), 'utf8'), context);
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
  const req = body => ({ body, auth: { user: { U_USER_NAME: 'boss', U_TYPE: 'מנהל על' } } });
  return { api: context.module.exports, req, res, inserts, log, selects };
}
test('mosofon import dry run writes nothing and only checks the staff table', async () => {
  const { api, req, res, inserts, selects } = setup(['yossi']);
  await api.importMosofonUsers(req({ users: [{ userName: 'נועם' }, { userName: 'yossi' }, { userName: ' נועם ' }] }), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.applied, false); assert.equal(inserts.length, 0);
  assert.deepEqual(plain(res.body.created), ['נועם']); assert.deepEqual(plain(res.body.skipped), ['yossi']);
  assert.ok(selects.every(sql => sql.includes('BENZI_STAFF_USERS')));
});
test('mosofon import apply inserts staff with password = user name', async () => {
  const { api, req, res, inserts, log } = setup();
  await api.importMosofonUsers(req({ users: [{ userName: 'dani' }], apply: true }), res);
  assert.equal(res.statusCode, 200); assert.deepEqual(log, ['begin', 'commit']);
  assert.match(inserts[0][0], /INSERT INTO BENZI_STAFF_USERS/); assert.deepEqual(plain(inserts[0][1]), ['dani', 'dani', 'dani', 'boss']);
});
test('mosofon import rolls back on failure and rejects bad input', async () => {
  const failing = setup([], { failInsert: true });
  await failing.api.importMosofonUsers(failing.req({ users: [{ userName: 'a' }], apply: true }), failing.res);
  assert.equal(failing.res.statusCode, 500); assert.deepEqual(failing.log, ['begin', 'rollback']);
  const { api, req, res } = setup();
  await api.importMosofonUsers(req({ users: 'nope' }), res); assert.equal(res.statusCode, 400);
});
