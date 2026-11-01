const crypto = require('node:crypto');
// Server-to-server cron calls (My_SQL_Server's nightly item sync) have no user session.
// They authenticate with a shared secret: CRON_SECRET in both servers' .env, sent as the
// X-Cron-Secret header over HTTPS. Fails closed when the secret is not configured.
module.exports = function requireCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return res.status(503).json({ message: 'Cron secret not configured' });
  const supplied = Buffer.from(String(req.headers['x-cron-secret'] || ''));
  const expected = Buffer.from(secret);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ message: 'Invalid cron secret' });
  }
  next();
};
