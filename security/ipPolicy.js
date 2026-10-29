const net = require('node:net');
// Customer login IP restrictions. The client address is Express's req.ip, which honours only
// TRUSTED_PROXY_CIDRS (see app.js); raw forwarding headers are never trusted here.

// Expand any IPv6 text form (compressed, leading zeros, embedded IPv4) to 8 numeric hextets.
function ipv6Hextets(ip) {
  if (net.isIPv6(ip) !== true) return null;
  let text = ip.toLowerCase();
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text);
  if (v4) {
    const [a, b, c, d] = v4[1].split('.').map(Number);
    text = text.slice(0, -v4[1].length) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16);
  }
  const [head, tail] = text.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const zeros = text.includes('::') ? 8 - left.length - right.length : 0;
  return [...left, ...Array(zeros).fill('0'), ...right].map(group => parseInt(group, 16));
}

// Returns { family: 4|6, ip, prefix64 } or null. IPv4-mapped IPv6 (::ffff:a.b.c.d) is treated as IPv4.
function normalizeClientIp(raw) {
  const ip = String(raw || '').trim().replace(/%.*$/, '');
  if (net.isIPv4(ip)) return { family: 4, ip };
  const hextets = ipv6Hextets(ip);
  if (!hextets) return null;
  if (hextets.slice(0, 5).every(h => h === 0) && hextets[5] === 0xffff) {
    return { family: 4, ip: [hextets[6] >> 8, hextets[6] & 255, hextets[7] >> 8, hextets[7] & 255].join('.') };
  }
  return { family: 6, ip, prefix64: hextets.slice(0, 4).map(h => h.toString(16)).join(':') };
}

// Admins enter only the first four groups ("2001:4860:7:617"), but also accept a full address,
// a trailing "::", a "/64" suffix, leading zeros and upper case.
function normalizeAllowedPrefix64(raw) {
  const text = String(raw || '').trim().toLowerCase().replace(/\/\d+$/, '');
  if (!text) return null;
  const groups = text.split(':');
  if (!text.includes('::') && groups.length === 4 && groups.every(g => /^[0-9a-f]{1,4}$/.test(g))) {
    return groups.map(g => parseInt(g, 16).toString(16)).join(':');
  }
  const hextets = ipv6Hextets(text);
  return hextets ? hextets.slice(0, 4).map(h => h.toString(16)).join(':') : null;
}

// Decide whether a non-admin user may log in from clientIp.
// NULL in both columns means the account was never configured and stays blocked;
// empty strings mean "no restriction". The request is matched only against the rule for its
// own address family; it never has to satisfy both IPv4 and IPv6.
function checkLoginIp(user, rawClientIp) {
  const client = normalizeClientIp(rawClientIp);
  if (user.U_IP == null && user.U_IP6 == null) return { allowed: false, code: 'IP_NOT_CONFIGURED', client };
  const allowedIp = String(user.U_IP ?? '').trim();
  const allowedPrefix = normalizeAllowedPrefix64(user.U_IP6);
  if (!allowedIp && !String(user.U_IP6 ?? '').trim()) return { allowed: true, client };
  const allowed = !!client && (client.family === 4
    ? !!allowedIp && client.ip === allowedIp
    : !!allowedPrefix && client.prefix64 === allowedPrefix);
  return allowed ? { allowed, client } : { allowed, code: 'IP_NOT_ALLOWED', client, allowedIp: allowedIp || null, allowedPrefix };
}

module.exports = { normalizeClientIp, normalizeAllowedPrefix64, checkLoginIp };
