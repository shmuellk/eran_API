const crypto = require('node:crypto');
const pool = require('../configs/connection_cars');
const { isAdminType, STAFF_TYPE, SUPER_ADMIN_TYPE } = require('../controllers/userTypes');
const positive = (value, fallback) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
const idleMs = positive(process.env.SESSION_IDLE_MINUTES, 300) * 60000;
const absoluteMs = positive(process.env.SESSION_MAX_HOURS, 12) * 3600000;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
// Only a password change invalidates sessions. Other account fields (type, permissions, IP)
// are re-read from the database on every request, so edits apply without signing the user out.
function fingerprint(user) {
  const secret = process.env.SESSION_FINGERPRINT_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_FINGERPRINT_SECRET must contain at least 32 characters');
  return crypto.createHmac('sha256', secret).update(JSON.stringify([user.U_PASSWORD])).digest('hex');
}
function publicUser(user) {
  const { U_PASSWORD, ...safe } = user;
  return safe;
}
// kind 'customer' = BENZI_APP_USERS (customers/admins), 'staff' = BENZI_STAFF_USERS (mosofon).
async function createSession(user, kind = 'customer') {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const cardCode = kind === 'staff' ? '' : String(user.U_CARD_CODE);
  await pool.query(`INSERT INTO AUTH_SESSIONS
    (token_hash, user_name, card_code, credential_fingerprint, last_activity, expires_at, account_kind)
    VALUES (?, ?, ?, ?, ?, ?, ?)`, [hash(token), user.U_USER_NAME, cardCode, fingerprint(user), now, now + absoluteMs, kind]);
  return { token, idleTimeoutMs: idleMs, expiresAt: now + absoluteMs };
}
// Staff rows carry no U_TYPE column; the type is implied by the table.
async function loadStaffUsers(userName) {
  const [rows] = await pool.query('SELECT * FROM BENZI_STAFF_USERS WHERE U_USER_NAME = ?', [userName]);
  return [rows.map(row => ({ ...row, U_TYPE: STAFF_TYPE }))];
}
const unauthorized = res => res.status(401).json({ status: 'error', code: 'SESSION_INVALID', message: 'Please sign in again' });
async function authenticate(req, res, next) {
  res.set('Cache-Control', 'no-store');
  const match = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
  if (!match) return unauthorized(res);
  try {
    const tokenHash = hash(match[1]);
    const [sessions] = await pool.query('SELECT * FROM AUTH_SESSIONS WHERE token_hash = ?', [tokenHash]);
    const session = sessions[0];
    const now = Date.now();
    if (!session || session.revoked || now >= Number(session.expires_at) || now - Number(session.last_activity) >= idleMs) return unauthorized(res);
    const [users] = session.account_kind === 'staff'
      ? await loadStaffUsers(session.user_name)
      : await pool.query('SELECT * FROM BENZI_APP_USERS WHERE U_USER_NAME = ? AND U_CARD_CODE = ?', [session.user_name, session.card_code]);
    if (users.length !== 1 || fingerprint(users[0]) !== session.credential_fingerprint) {
      await pool.query('UPDATE AUTH_SESSIONS SET revoked = 1 WHERE token_hash = ?', [tokenHash]);
      return unauthorized(res);
    }
    req.auth = { user: publicUser(users[0]), tokenHash };
    // Status checks never extend the session. Only explicit user activity does.
    if (req.headers['x-session-activity'] === '1') {
      const [updated] = await pool.query(`UPDATE AUTH_SESSIONS SET last_activity = GREATEST(last_activity, ?)
        WHERE token_hash = ? AND revoked = 0 AND expires_at > ? AND last_activity > ?`, [now, tokenHash, now, now - idleMs]);
      if (!updated.affectedRows) return unauthorized(res);
    }
    next();
  } catch (error) {
    console.error('Session validation unavailable:', error.code || 'configuration/database error');
    return res.status(503).json({ status: 'error', message: 'Authentication temporarily unavailable' });
  }
}
function requireAdmin(req, res, next) {
  return isAdminType(req.auth.user.U_TYPE) ? next() : res.status(403).json({ message: 'Administrator required' });
}
function requireSuperAdmin(req, res, next) {
  return req.auth.user.U_TYPE === SUPER_ADMIN_TYPE ? next() : res.status(403).json({ message: 'Super administrator required' });
}
async function logout(req, res) {
  try {
    await pool.query('UPDATE AUTH_SESSIONS SET revoked = 1 WHERE token_hash = ?', [req.auth.tokenHash]);
    res.json({ status: 'success' });
  } catch { res.status(503).json({ message: 'Unable to revoke session' }); }
}
// Body { userName, cardCode } for a customer/admin, or { userName, staff: true } for staff.
async function disconnectUser(req, res) {
  const { userName, cardCode, staff } = req.body;
  if (typeof userName !== 'string' || !userName) return res.status(400).json({ message: 'userName required' });
  if (staff !== true && (typeof cardCode !== 'string' || !cardCode)) return res.status(400).json({ message: 'userName and cardCode required' });
  try {
    const [result] = staff === true
      ? await pool.query("UPDATE AUTH_SESSIONS SET revoked = 1 WHERE user_name = ? AND account_kind = 'staff' AND revoked = 0", [userName])
      : await pool.query("UPDATE AUTH_SESSIONS SET revoked = 1 WHERE user_name = ? AND card_code = ? AND account_kind = 'customer' AND revoked = 0", [userName, cardCode]);
    console.info('Sessions revoked by administrator', { actor: req.auth.user.U_USER_NAME, userName, cardCode });
    res.json({ status: 'success', revoked: result.affectedRows });
  } catch { res.status(503).json({ message: 'Unable to revoke sessions' }); }
}
module.exports = { authenticate, createSession, publicUser, fingerprint, requireAdmin, requireSuperAdmin, logout, disconnectUser, idleMs };
