-- Run once against the same MySQL database as BENZI_APP_USERS, after 001_auth_sessions.sql
-- and before deploying the staff (mosofon) login.

-- Company staff using the mosofon app (messengers / warehouse). Kept apart from
-- BENZI_APP_USERS so a staff name can never clash with a customer or admin account.
-- U_PASSWORD equals U_USER_NAME by design: the app signs in with the user name only.
CREATE TABLE IF NOT EXISTS BENZI_STAFF_USERS (
  U_USER_NAME VARCHAR(255) NOT NULL PRIMARY KEY,
  U_PASSWORD VARCHAR(255) NOT NULL,
  U_VIEW_NAME VARCHAR(255) NULL,
  U_CREATE_BY VARCHAR(255) NULL,
  U_CREATE_TIME DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Which table a session belongs to: 'customer' = BENZI_APP_USERS, 'staff' = BENZI_STAFF_USERS.
-- Existing sessions default to 'customer'. Staff sessions store an empty card_code.
ALTER TABLE AUTH_SESSIONS
  ADD COLUMN account_kind VARCHAR(16) CHARACTER SET ascii NOT NULL DEFAULT 'customer';
