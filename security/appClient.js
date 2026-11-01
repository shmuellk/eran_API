const crypto = require('node:crypto');
// POST /users/appLogIn (no customer IP rule) is meant for the RecordApp mobile app only.
// The app sends this key in the X-Record-App header. It is NOT a secret: it ships inside the
// APK and can be extracted from it, so it only keeps casual callers (someone who found the
// route and tries it from a computer) out. Real device attestation would need Google Play
// Integrity / Apple App Attest. The same value is in RecordApp/model/session.js; changing it
// requires a new app build, and older builds stop being able to log in.
const APP_CLIENT_KEY = 'rwxyiSAgQ-7I1tR6LQYlMjG4Q3YBrwyr';

function isRecordApp(req) {
  const supplied = Buffer.from(String(req.headers['x-record-app'] || ''));
  const expected = Buffer.from(APP_CLIENT_KEY);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

module.exports = { isRecordApp };
