const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeClientIp, normalizeAllowedPrefix64, checkLoginIp } = require('../security/ipPolicy');

// User 11 as configured in MANAG.
const user11 = { U_TYPE: 'לקוח', U_IP: '104.28.244.18', U_IP6: '2001:4860:7:617' };

test('IPv4-mapped IPv6 is treated as IPv4', () => {
  assert.deepEqual(normalizeClientIp('::ffff:104.28.244.18'), { family: 4, ip: '104.28.244.18' });
  assert.deepEqual(normalizeClientIp('::ffff:681c:f412'), { family: 4, ip: '104.28.244.18' });
});
test('IPv6 prefix is normalized regardless of compression, zeros and case', () => {
  for (const ip of ['2001:4860:7:617::fb', '2001:4860:0007:0617:0:0:0:fb', '2001:4860:7:617:1:2:3:4', '2001:4860:7:617::']) {
    assert.equal(normalizeClientIp(ip).prefix64, '2001:4860:7:617', ip);
  }
  assert.equal(normalizeClientIp('2001:db8::1').prefix64, '2001:db8:0:0');
  for (const p of ['2001:4860:7:617', '2001:4860:0007:0617', '2001:4860:7:617::', '2001:4860:7:617::/64', ' 2001:4860:7:617 ', '2001:4860:7:617::fb']) {
    assert.equal(normalizeAllowedPrefix64(p), '2001:4860:7:617', p);
  }
  assert.equal(normalizeAllowedPrefix64('2001:DB8::'), '2001:db8:0:0');
});
test('allowed addresses log in by the family of the request', () => {
  assert.equal(checkLoginIp(user11, '104.28.244.18').allowed, true);
  assert.equal(checkLoginIp(user11, '::ffff:104.28.244.18').allowed, true);
  assert.equal(checkLoginIp(user11, '2001:4860:7:617::fb').allowed, true);
  assert.equal(checkLoginIp(user11, '2001:4860:0007:0617:abcd::1').allowed, true);
});
test('unauthorised addresses are rejected with IP_NOT_ALLOWED', () => {
  // The address this machine actually reaches the API from via Cloudflare WARP.
  for (const ip of ['104.28.244.17', '2a09:bac5:3a98:ec8::179:1ab', '2001:4860:7:618::fb', '', undefined]) {
    const result = checkLoginIp(user11, ip);
    assert.equal(result.allowed, false, String(ip)); assert.equal(result.code, 'IP_NOT_ALLOWED');
  }
});
test('IPv6-only or IPv4-only rules do not require the other family', () => {
  assert.equal(checkLoginIp({ U_IP: '', U_IP6: '2001:4860:7:617' }, '2001:4860:7:617::1').allowed, true);
  assert.equal(checkLoginIp({ U_IP: '', U_IP6: '2001:4860:7:617' }, '104.28.244.18').allowed, false);
  assert.equal(checkLoginIp({ U_IP: '104.28.244.18', U_IP6: '' }, '104.28.244.18').allowed, true);
  assert.equal(checkLoginIp({ U_IP: '104.28.244.18', U_IP6: '' }, '2001:4860:7:617::1').allowed, false);
});
test('unconfigured (NULL) blocks; empty strings mean unrestricted', () => {
  assert.equal(checkLoginIp({ U_IP: null, U_IP6: null }, '104.28.244.18').code, 'IP_NOT_CONFIGURED');
  assert.equal(checkLoginIp({ U_IP: '', U_IP6: '' }, '8.8.8.8').allowed, true);
});
