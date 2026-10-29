-- Run against the same MySQL database as BENZI_APP_USERS before deploying.
CREATE TABLE IF NOT EXISTS AUTH_SESSIONS (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_name VARCHAR(255) NOT NULL,
  card_code VARCHAR(255) NOT NULL,
  credential_fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  last_activity BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  revoked TINYINT(1) NOT NULL DEFAULT 0,
  INDEX auth_sessions_user (user_name, card_code),
  INDEX auth_sessions_expiry (expires_at)
) ENGINE=InnoDB;
-- Periodic housekeeping: DELETE FROM AUTH_SESSIONS WHERE expires_at < UNIX_TIMESTAMP() * 1000;

CREATE TABLE IF NOT EXISTS AUTH_LOGIN_ATTEMPTS (
  attempt_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  window_id BIGINT NOT NULL,
  attempts INT NOT NULL
) ENGINE=InnoDB;
-- Periodic housekeeping: DELETE FROM AUTH_LOGIN_ATTEMPTS WHERE window_id < FLOOR(UNIX_TIMESTAMP() / 900) - 1;
