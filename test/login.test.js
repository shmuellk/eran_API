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
    if (name.includes('appClient')) return require('../security/appClient');
    if (name.includes('staffUsersController')) return {};
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
test('customer without configured IP is still blocked', async () => {
  const { api, req, res } = setup('CorrectCase!', { U_TYPE: 'לקוח', SITE: 1, U_IP: null, U_IP6: null });
  await api.logIn(req, res); assert.equal(res.statusCode, 403); assert.equal(res.body.code, 'IP_NOT_CONFIGURED');
});
function staffSetup(rows) {
  const queries = []; const sessions = [];
  const pool = { query: async (...args) => { queries.push(args); return [rows]; } };
  const context = { module: { exports: {} }, Buffer, require: name => {
    if (name === 'node:crypto') return crypto;
    if (name.includes('connection_cars')) return pool;
    if (name.includes('logger')) return { info() {}, warn() {}, error() {} };
    if (name.includes('userTypes')) return require('../controllers/userTypes');
    if (name.includes('security/sessions')) return { createSession: async (user, kind) => { sessions.push([user, kind]); return { token: 'staff-token' }; }, publicUser: ({ U_PASSWORD, ...safe }) => safe };
    return {};
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/staffUsersController'), 'utf8'), context);
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, set() { return this; }, json(data) { this.body = data; return this; } };
  return { api: context.module.exports, res, queries, sessions };
}
test('staff login reads only the staff table and opens a staff session', async () => {
  const { api, res, queries, sessions } = staffSetup([{ U_USER_NAME: 'נועם', U_PASSWORD: 'נועם', U_VIEW_NAME: 'נועם' }]);
  await api.staffLogIn({ body: { userName: 'נועם', Password: 'נועם' } }, res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.token, 'staff-token');
  assert.match(queries[0][0], /FROM BENZI_STAFF_USERS/); assert.equal(sessions[0][1], 'staff');
  assert.equal(res.body.result[0].U_TYPE, 'עובד'); assert.equal(res.body.result[0].U_PASSWORD, undefined);
});
test('staff login rejects a wrong password and an unknown name', async () => {
  for (const rows of [[{ U_USER_NAME: 'noam', U_PASSWORD: 'noam' }], []]) {
    const { api, res, sessions } = staffSetup(rows);
    await api.staffLogIn({ body: { userName: 'noam', Password: 'Noam' } }, res);
    assert.equal(res.statusCode, 401); assert.equal(sessions.length, 0);
  }
});
const APP_HEADER = { 'x-record-app': 'rwxyiSAgQ-7I1tR6LQYlMjG4Q3YBrwyr' };
const fromApp = ctx => { ctx.req.headers = { ...APP_HEADER }; return ctx; };
test('app login skips the customer IP rule that the website login applies', async () => {
  const site = setup('CorrectCase!', { U_TYPE: 'לקוח', SITE: 1, U_IP: null, U_IP6: null, APP: 1 });
  await site.api.logIn(site.req, site.res); assert.equal(site.res.statusCode, 403);
  const app = fromApp(setup('CorrectCase!', { U_TYPE: 'לקוח', U_IP: null, U_IP6: null, APP: 1 }));
  await app.api.appLogIn(app.req, app.res); assert.equal(app.res.statusCode, 200); assert.equal(app.res.body.token, 'opaque-token');
});
test('app login still rejects a wrong password', async () => {
  const ctx = fromApp(setup('wrong', { U_TYPE: 'לקוח', APP: 1 }));
  await ctx.api.appLogIn(ctx.req, ctx.res); assert.equal(ctx.res.statusCode, 401);
});
test('app login without the app header is refused before any database lookup', async () => {
  for (const headers of [{}, { 'x-record-app': 'guess' }]) {
    const ctx = setup('CorrectCase!', { U_TYPE: 'לקוח', APP: 1 }); ctx.req.headers = headers;
    await ctx.api.appLogIn(ctx.req, ctx.res);
    assert.equal(ctx.res.statusCode, 403); assert.equal(ctx.res.body.code, 'APP_ONLY'); assert.equal(ctx.queries.length, 0);
  }
});
test('app login requires the APP flag for customers but not for admins', async () => {
  for (const app of [0, '0', null]) {
    const ctx = fromApp(setup('CorrectCase!', { U_TYPE: 'לקוח', APP: app }));
    await ctx.api.appLogIn(ctx.req, ctx.res); assert.equal(ctx.res.statusCode, 403); assert.equal(ctx.res.body.code, 'APP_NOT_ALLOWED');
  }
  const admin = fromApp(setup('CorrectCase!', { U_TYPE: 'מנהל על', APP: 0 }));
  await admin.api.appLogIn(admin.req, admin.res); assert.equal(admin.res.statusCode, 200);
});
test('website login requires the SITE flag for customers but not for admins', async () => {
  for (const site of [0, '0', null, undefined]) {
    const ctx = setup('CorrectCase!', { U_TYPE: 'לקוח', SITE: site, U_IP: '', U_IP6: '' });
    await ctx.api.logIn(ctx.req, ctx.res); assert.equal(ctx.res.statusCode, 403); assert.equal(ctx.res.body.code, 'SITE_NOT_ALLOWED');
  }
  const customer = setup('CorrectCase!', { U_TYPE: 'לקוח', SITE: 1, U_IP: '', U_IP6: '' });
  await customer.api.logIn(customer.req, customer.res); assert.equal(customer.res.statusCode, 200);
  for (const type of ['מנהל', 'מנהל על']) {
    const admin = setup('CorrectCase!', { U_TYPE: type, SITE: 0, U_IP: '', U_IP6: '' });
    await admin.api.logIn(admin.req, admin.res); assert.equal(admin.res.statusCode, 200);
  }
});
test('the app login ignores the SITE flag', async () => {
  const ctx = fromApp(setup('CorrectCase!', { U_TYPE: 'לקוח', APP: 1, SITE: 0 }));
  await ctx.api.appLogIn(ctx.req, ctx.res); assert.equal(ctx.res.statusCode, 200);
});
test('"מנהל" is IP-restricted like a customer; empty rule means unrestricted', async () => {
  const blocked = setup('CorrectCase!', { U_TYPE: 'מנהל', U_IP: '198.51.100.7', U_IP6: '' });
  await blocked.api.logIn(blocked.req, blocked.res); assert.equal(blocked.res.statusCode, 403); assert.equal(blocked.res.body.code, 'IP_NOT_ALLOWED');
  const unconfigured = setup('CorrectCase!', { U_TYPE: 'מנהל', U_IP: null, U_IP6: null });
  await unconfigured.api.logIn(unconfigured.req, unconfigured.res); assert.equal(unconfigured.res.body.code, 'IP_NOT_CONFIGURED');
  const allowed = setup('CorrectCase!', { U_TYPE: 'מנהל', U_IP: '192.0.2.1', U_IP6: '' });
  await allowed.api.logIn(allowed.req, allowed.res); assert.equal(allowed.res.statusCode, 200);
  const open = setup('CorrectCase!', { U_TYPE: 'מנהל', U_IP: '', U_IP6: '' });
  await open.api.logIn(open.req, open.res); assert.equal(open.res.statusCode, 200);
});
test('"מנהל על" is never IP-restricted', async () => {
  for (const ip of [{ U_IP: '198.51.100.7', U_IP6: '' }, { U_IP: null, U_IP6: null }]) {
    const ctx = setup('CorrectCase!', { U_TYPE: 'מנהל על', ...ip });
    await ctx.api.logIn(ctx.req, ctx.res); assert.equal(ctx.res.statusCode, 200);
  }
});
