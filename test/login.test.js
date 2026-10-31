const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
function setup(password = 'CorrectCase!', overrides = {}) {
  const user = { U_USER_NAME: 'admin', U_PASSWORD: 'CorrectCase!', U_TYPE: 'מנהל על', U_CARD_CODE: 'C1', ...overrides };
  const queries = [];
  const pool = { query: async (...args) => { queries.push(args); return [[user]]; } };
  const logger = { info() {}, warn() {}, error() {} };
  const context = { module: { exports: {} }, Buffer, console, require: name => {
    if (name === 'node:crypto') return crypto;
    if (name.includes('connection_cars')) return pool;
    if (name.includes('logger')) return logger;
    if (name === 'dotenv') return { config() {} };
    if (name.includes('userTypes')) return require('../controllers/userTypes');
    if (name.includes('ipPolicy')) return require('../security/ipPolicy');
    if (name.includes('security/sessions')) return { createSession: async () => ({ token: 'opaque-token' }), publicUser: ({ U_PASSWORD, ...safe }) => safe };
    return {};
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/usersController'), 'utf8'), context);
  const req = { body: { userName: 'admin', Password: password }, ip: '192.0.2.1' };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, set() { return this; }, json(data) { this.body = data; return this; } };
  return { api: context.module.exports, req, res, queries };
}
test('login verifies exact password case even when database collation does not', async () => {
  const { api, req, res } = setup('correctcase!');
  await api.logIn(req, res); assert.equal(res.statusCode, 401);
});
test('login never passes plaintext password to SQL and returns safe profile', async () => {
  const { api, req, res, queries } = setup();
  await api.logIn(req, res); assert.equal(res.statusCode, 200);
  assert.equal(queries[0][1].length, 1); assert.equal(res.body.result[0].U_PASSWORD, undefined); assert.equal(res.body.token, 'opaque-token');
});
test('login rejects non-string credentials without querying database', async () => {
  const { api, req, res, queries } = setup({ $ne: '' });
  await api.logIn(req, res); assert.equal(res.statusCode, 400); assert.equal(queries.length, 0);
});
test('staff (mosofon) login is not IP-restricted', async () => {
  const { api, req, res } = setup('CorrectCase!', { U_TYPE: 'עובד', U_IP: null, U_IP6: null });
  await api.logIn(req, res); assert.equal(res.statusCode, 200); assert.equal(res.body.token, 'opaque-token');
});
test('customer without configured IP is still blocked', async () => {
  const { api, req, res } = setup('CorrectCase!', { U_TYPE: 'לקוח', U_IP: null, U_IP6: null });
  await api.logIn(req, res); assert.equal(res.statusCode, 403); assert.equal(res.body.code, 'IP_NOT_CONFIGURED');
});
