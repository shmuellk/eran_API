# Server-backed authentication rollout

The customer website (`record_dev`) and management website (`web_manag`) now use opaque bearer sessions issued by `eran_API`. `My_SQL_Server` validates every protected request against that service over HTTPS, with no authorization cache. Protected API routes fail closed if validation is unavailable. Root health endpoints and public product media remain public.

## Deployment prerequisites

1. Back up the MySQL database and run `migrations/001_auth_sessions.sql` in the same database as `BENZI_APP_USERS`. Do not deploy the application before both new tables exist.
2. Set `SESSION_FINGERPRINT_SECRET` to a cryptographically random secret of at least 32 characters in `eran_API` (for example, generate with `openssl rand -hex 32`). See `.env.auth.example`. Changing this secret invalidates existing sessions.
3. Set `AUTH_SERVICE_URL=https://api.recordltd.co.il` in `My_SQL_Server`. Confirm outbound HTTPS connectivity, TLS certificates and proxy routing to `/users/session`.
4. If behind a reverse proxy, set `TRUSTED_PROXY_CIDRS` to its actual source addresses. The proxy must overwrite forwarded IP headers. Customer login IP restrictions and login throttling use Express's trusted `req.ip`; arbitrary client-supplied forwarding headers no longer bypass restrictions.
5. Deploy both servers and both website builds together. All existing logins must sign in again. Existing integrations, cron callers, the mobile `RecordApp`, and any direct SAP/client callers **must be migrated before rollout**: GET login and legacy JWTs are no longer accepted; protected requests need the new bearer session. The mobile app is not migrated in this change.
6. In staging, verify against real database schemas/procedures: login from an allowed/blocked address, customer reads and orders, order/document ownership, debts and payment-link creation, normal admin actions, super-admin disconnect, password/role updates, idle and absolute expiry. Unit tests use database doubles; no live database or payment provider was contacted.
7. Schedule deletion of expired session rows and old login-counter rows using the cleanup SQL comments in the migration.

## Contract and behavior

- `POST /users/logIn` JSON `{ "userName": "...", "Password": "..." }` returns `result` with the safe user profile, `token`, `expiresAt`, `idleTimeoutMs`. Passwords are absent from the login/status response and tokens contain no account data.
- Every protected request sends `Authorization: Bearer <token>`. Only the SHA-256 hash of the random 256-bit token is stored.
- `GET /users/session` validates and returns `{ user }`. It is also used for server-to-server validation. It does not renew activity unless `X-Session-Activity: 1` is explicitly present.
- Physical browser interaction marks activity. Background validation runs every 15 seconds without manufacturing activity. Defaults: idle timeout 30 minutes; absolute lifetime 12 hours. Server enforcement uses database timestamps and is independent of browser timers. Browser timers can be delayed when suspended; protected requests still reject revoked/expired sessions immediately at validation time.
- `POST /users/logout` revokes the current token. Local state clears even offline; an offline revocation cannot reach the server, so server expiry remains the fallback.
- `POST /users/disconnect` JSON `{ "userName": "...", "cardCode": "..." }` revokes all current sessions of that account. Only a currently authenticated `מנהל על` may invoke it. This signs the user out; it does not disable future login.
- Every validation reloads the account and compares a keyed fingerprint of password, username, customer code, role, platform permissions, GIUL and IP rules. A mismatch or deleted account rejects the session. User edits/deletion through management also explicitly revoke that account's sessions.
- Login counters persist across workers/restarts: 10 attempts per IP+username and 100 per IP per fixed 15-minute window. Configure proxy trust accurately. These counters include successful logins; remove stale counters periodically.
- Customer identifiers are bound to the authenticated account. Management operations require current server-verified roles. Regular admins can manage ordinary accounts but cannot edit/delete/grant super-admin accounts.
- SQL line-item endpoints include account predicates. Printing authorizes ownership using a fixed object-type/table allowlist; web-order details check ORDR ownership. Confirm those mappings against production views and stored procedures during staging. Unknown print types fail closed. Delivery administration endpoints require admin.

## Remaining hardening

This is a session/authentication change, not a complete security audit. Existing `BENZI_APP_USERS` password storage and administrative password viewing remain legacy plaintext and need a coordinated password-hashing migration (including mobile and management forms). Rotate credentials currently embedded in server configuration and remove them from source/history. Add MFA for administrators, a durable security-event audit log, and application-specific authorization tests for every stored procedure/integration. Confirm stored procedures honor their supplied customer filters and existing payment/order business validation.

Browser tokens use sessionStorage, are scoped to the tab and are never sent to origins outside the two configured APIs. They remain accessible to injected JavaScript; a future same-origin backend-for-frontend with HttpOnly Secure cookies and CSRF protection can reduce that exposure. Profiles stored in localStorage are presentation data, never server authorization. "Remember me" keeps only the management profile, not a persistent authenticated session. Avoid logging complete Axios errors or raw user rows containing passwords.

Session idle/absolute expiration follows the server-enforcement model in the [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

Validation: `npm test` in `eran_API`; `npm run build` in each website. Run staging end-to-end checks above before production deployment.
