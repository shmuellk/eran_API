const crypto = require('node:crypto');
const pool = require('../configs/connection_cars');
const { getClientIp } = require('./ipPolicy');
// Database counters are shared across workers and survive application restarts.
module.exports = async function loginLimit(req, res, next) {
  const username = typeof req.body.userName === 'string' ? req.body.userName.toLowerCase().slice(0, 255) : '';
  const windowId = Math.floor(Date.now() / 900000);
  try {
    // Count per real customer address, not per (shared, rotating) Cloudflare edge address.
    const ip = getClientIp(req);
    for (const [identity, limit] of [[ip, 100], [`${ip}:${username}`, 10]]) {
      const key = crypto.createHash('sha256').update(String(identity)).digest('hex');
      await pool.query(`INSERT INTO AUTH_LOGIN_ATTEMPTS (attempt_key, window_id, attempts) VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE attempts = IF(window_id = VALUES(window_id), attempts + 1, 1), window_id = VALUES(window_id)`, [key, windowId]);
      const [rows] = await pool.query('SELECT attempts FROM AUTH_LOGIN_ATTEMPTS WHERE attempt_key = ?', [key]);
      if (Number(rows[0].attempts) > limit) {
        res.set('Retry-After', String(900 - Math.floor(Date.now() / 1000) % 900));
        return res.status(429).json({ message: 'Too many login attempts. Try again later.' });
      }
    }
    next();
  } catch (error) {
    // Do not log SQL, parameters or the request body: those can contain credentials.
    console.error('Login rate limiter unavailable:', error.code || 'DATABASE_ERROR');
    res.status(503).json({ message: 'Authentication temporarily unavailable' });
  }
};
