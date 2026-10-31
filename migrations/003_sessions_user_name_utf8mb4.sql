-- Run once, after 002_staff_users.sql.
-- AUTH_SESSIONS.user_name was created as latin1 (the database default), which cannot hold
-- Hebrew. Customer user names are ID numbers, but staff (mosofon) names are Hebrew, so
-- creating their session failed. Existing values are ASCII and convert unchanged.
ALTER TABLE AUTH_SESSIONS
  MODIFY user_name VARCHAR(255) CHARACTER SET utf8mb4 NOT NULL;
