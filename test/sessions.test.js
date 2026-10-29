const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');
function setup({ userPatch = {}, sessionPatch = {}, missingUser = false, dbFails = false } = {}) {
  const user = { U_USER_NAME: 'alice', U_CARD_CODE: 'C1', U_PASSWORD: 'secret', U_TYPE: 'לקוח', SITE: 1 };
  const calls = [];
  let api;
  const session = { token_hash: 'hash', user_name: 'alice', card_code: 'C1', last_activity: Date.now(), expires_at: Date.now() + 3600000, revoked: 0, ...sessionPatch };
  const pool = { query: async (sql, params) => {
    calls.push([sql, params]);
    if (dbFails) throw new Error('offline');
    if (sql.startsWith('SELECT * FROM AUTH_SESSIONS')) return [[session]];
    if (sql.startsWith('SELECT * FROM BENZI')) return [missingUser ? [] : [{ ...user, ...userPatch }]];
    return [{ affectedRows: 1 }];
  } };
  const context = { module: { exports: {} }, require: name => name === 'node:crypto' ? crypto : name.includes('connection_cars') ? pool : { isAdminType: type => ['מנהל', 'מנהל על'].includes(type) }, process: { env: { SESSION_FINGERPRINT_SECRET: 'a'.repeat(32) } }, console: { error() {}, info() {} } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../security/sessions'), 'utf8'), context);
  api = context.module.exports;
  session.credential_fingerprint = api.fingerprint(user);
  const req = { headers: { authorization: `Bearer ${'b'.repeat(64)}` }, body: {} };
  const res = { statusCode: 200, headers: {}, set(k, v) { this.headers[k] = v; return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  return { api, req, res, calls, user, session };
}
test('valid token loads current identity without credentials', async () => {
  const { api, req, res } = setup(); let passed = false;
  await api.authenticate(req, res, () => { passed = true; });
  assert.equal(passed, true); assert.equal(req.auth.user.U_USER_NAME, 'alice'); assert.equal(req.auth.user.U_PASSWORD, undefined); assert.equal(res.headers['Cache-Control'], 'no-store');
});
for (const [name, options] of [
  ['revoked session', { sessionPatch: { revoked: 1 } }],
  ['idle expiry', { sessionPatch: { last_activity: Date.now() - 31 * 60000 } }],
  ['absolute expiry', { sessionPatch: { expires_at: Date.now() - 1 } }],
  ['password changed', { userPatch: { U_PASSWORD: 'new' } }],
  ['user deleted', { missingUser: true }],
]) test(name + ' rejects authentication', async () => {
  const { api, req, res } = setup(options);
  await api.authenticate(req, res, () => assert.fail('must not authorize'));
  assert.equal(res.statusCode, 401);
});
for (const [name, userPatch] of [
  ['role changed', { U_TYPE: 'מנהל' }],
  ['network restrictions changed', { U_IP: '192.0.2.1' }],
  ['permissions changed', { SITE: 0 }],
  ['display details changed', { U_CARD_NAME: 'Alice Ltd' }],
]) test(name + ' keeps the session and applies the current values', async () => {
  const { api, req, res, calls } = setup({ userPatch }); let passed = false;
  await api.authenticate(req, res, () => { passed = true; });
  assert.equal(passed, true); assert.equal(res.statusCode, 200);
  for (const [key, value] of Object.entries(userPatch)) assert.equal(req.auth.user[key], value);
  assert.equal(calls.some(([sql]) => sql.includes('revoked = 1')), false);
});
test('malformed and legacy JWT tokens are rejected', async () => {
  for (const token of ['', 'Bearer old.jwt.token', 'Basic abc']) {
    const { api, req, res, calls } = setup(); req.headers.authorization = token;
    await api.authenticate(req, res, () => assert.fail());
    assert.equal(res.statusCode, 401); assert.equal(calls.length, 0);
  }
});
test('database failure fails closed', async () => {
  const { api, req, res } = setup({ dbFails: true });
  await api.authenticate(req, res, () => assert.fail()); assert.equal(res.statusCode, 503);
});
test('polling does not extend idle timeout; activity does', async () => {
  for (const activity of [false, true]) {
    const { api, req, res, calls } = setup();
    if (activity) req.headers['x-session-activity'] = '1';
    await api.authenticate(req, res, () => {});
    assert.equal(calls.some(([sql]) => sql.includes('GREATEST(last_activity')), activity);
  }
});
test('login persists only a hash of a cryptographically random token', async () => {
  const { api, calls, user } = setup(); const session = await api.createSession(user);
  assert.match(session.token, /^[a-f0-9]{64}$/); assert.equal(calls[0][1][0], crypto.createHash('sha256').update(session.token).digest('hex'));
  assert.equal(calls[0][1].includes(session.token), false);
});
test('only super admin can disconnect; all sessions of exact account are revoked', async () => {
  const { api, req, res, calls } = setup();
  req.auth = { user: { U_TYPE: 'מנהל' } };
  api.requireSuperAdmin(req, res, () => assert.fail()); assert.equal(res.statusCode, 403);
  req.auth.user.U_TYPE = 'מנהל על'; let passed = false;
  api.requireSuperAdmin(req, res, () => { passed = true; }); assert.equal(passed, true);
  req.body = { userName: 'alice', cardCode: 'C1' };
  await api.disconnectUser(req, res); assert.equal(calls[0][1].join(','), 'alice,C1'); assert.match(calls[0][0], /revoked = 1/);
});
test('logout revokes current token on the server', async () => {
  const { api, req, res, calls } = setup(); req.auth = { tokenHash: 'current' };
  await api.logout(req, res); assert.equal(calls[0][1][0], 'current'); assert.match(calls[0][0], /revoked = 1/);
});
test('customer scope binds missing, forged and nested identifiers; admins retain filters', () => {
  const scope = require('../security/customerScope');
  const req = { auth: { user: { U_USER_NAME: 'alice', U_CARD_CODE: 'C1', U_TYPE: 'לקוח' } }, query: { CARDCODE: 'C2' }, body: { Orders: [{ CardCode: 'C2', userName: 'bob' }] } };
  scope(req, {}, () => {});
  assert.equal(req.query.CARDCODE, 'C1'); assert.equal(req.body.Orders[0].CardCode, 'C1'); assert.equal(req.body.Orders[0].userName, 'alice');
  req.auth.user.U_TYPE = 'מנהל'; req.query.CARDCODE = 'C2'; scope(req, {}, () => {}); assert.equal(req.query.CARDCODE, 'C2');
});
