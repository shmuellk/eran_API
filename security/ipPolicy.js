const net = require('node:net');
// Customer login IP restrictions.
// api.recordltd.co.il is proxied by Cloudflare straight to this server (ports 80/443), so the TCP peer is
// a Cloudflare edge address that changes per request. The real customer address is in CF-Connecting-IP,
// which is trusted ONLY when the TCP peer itself is a Cloudflare address (https://www.cloudflare.com/ips/);
// a client connecting directly cannot spoof it.
const CLOUDFLARE_RANGES = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
  '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
  '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
  '2a06:98c0::/29', '2c0f:f248::/32',
];
const cloudflare = new net.BlockList();
for (const range of CLOUDFLARE_RANGES) {
  const [address, bits] = range.split('/');
  cloudflare.addSubnet(address, Number(bits), net.isIPv6(address) ? 'ipv6' : 'ipv4');
}
function isCloudflare(raw) {
  const peer = normalizeClientIp(raw);
  return !!peer && cloudflare.check(peer.ip, peer.family === 6 ? 'ipv6' : 'ipv4');
}

// The customer's real address for this request.
function getClientIp(req) {
  if (isCloudflare(req.socket?.remoteAddress)) {
    const forwarded = normalizeClientIp(req.headers['cf-connecting-ip']);
    if (forwarded) return forwarded.ip;
  }
  // Not via Cloudflare: Express's req.ip (honours TRUSTED_PROXY_CIDRS only, see app.js).
  return req.ip;
}

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

module.exports = { normalizeClientIp, normalizeAllowedPrefix64, checkLoginIp, getClientIp };
