require('dotenv').config();
const pool = require('../configs/connection_cars');
async function main() {
  let failed = false;
  const secret = process.env.SESSION_FINGERPRINT_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) {
    console.error('FAIL SESSION_FINGERPRINT_SECRET: missing or shorter than 32 characters');
    failed = true;
  } else console.log('OK SESSION_FINGERPRINT_SECRET configured (value hidden)');
  for (const [name, query] of [
    ['AUTH_LOGIN_ATTEMPTS', 'SELECT attempt_key, window_id, attempts FROM AUTH_LOGIN_ATTEMPTS LIMIT 0'],
    ['AUTH_SESSIONS', 'SELECT token_hash, user_name, card_code, credential_fingerprint, last_activity, expires_at, revoked FROM AUTH_SESSIONS LIMIT 0'],
    ['BENZI_APP_USERS', 'SELECT U_USER_NAME, U_CARD_CODE, U_PASSWORD, U_TYPE FROM BENZI_APP_USERS LIMIT 0'],
  ]) {
    try { await pool.query(query); console.log(`OK ${name} schema readable`); }
    catch (error) { console.error(`FAIL ${name}: ${error.code || 'DATABASE_ERROR'}`); failed = true; }
  }
  await pool.end();
  process.exitCode = failed ? 1 : 0;
}
main().catch(() => { console.error('FAIL authentication readiness check'); process.exitCode = 1; });
