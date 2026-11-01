const { test } = require('node:test');
const assert = require('node:assert/strict');
const requireCronSecret = require('../security/cronSecret');
const SECRET = 's'.repeat(40);
function call(header, envSecret = SECRET) {
  const saved = process.env.CRON_SECRET;
  if (envSecret === null) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = envSecret;
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() { return this; } };
  let passed = false;
  requireCronSecret({ headers: header === undefined ? {} : { 'x-cron-secret': header } }, res, () => { passed = true; });
  if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved;
  return { passed, status: res.statusCode };
}
test('cron secret admits the matching header only', () => {
  assert.deepEqual(call(SECRET), { passed: true, status: 200 });
  for (const header of [undefined, '', 'wrong', SECRET + 'x', SECRET.slice(1)]) assert.deepEqual(call(header), { passed: false, status: 401 });
});
test('cron route fails closed when the secret is missing or too short', () => {
  assert.deepEqual(call('anything', null), { passed: false, status: 503 });
  assert.deepEqual(call('short', 'short'), { passed: false, status: 503 });
});
