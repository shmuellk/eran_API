// Mosofon staff accounts (BENZI_STAFF_USERS). They appear in MANAG user management next to
// customers with U_TYPE "עובד", but live in their own table so names never clash.
// The password is always the user name: the mosofon app signs in with the name only.
const crypto = require("node:crypto");
const pool = require("../configs/connection_cars");
const logger = require("../logger.js");
const { STAFF_TYPE } = require("./userTypes");
const { createSession, publicUser } = require("../security/sessions");

const clean = (value) => (typeof value === "string" ? value.trim() : "");

// Shapes a staff row like a BENZI_APP_USERS row so the MANAG table and forms can show it.
const asAppUser = (row) => ({
  U_CARD_CODE: null,
  U_CARD_NAME: null,
  U_VIEW_NAME: row.U_VIEW_NAME,
  U_SHIPTYPE: null,
  U_TYPE: STAFF_TYPE,
  U_USER_NAME: row.U_USER_NAME,
  U_PASSWORD: row.U_PASSWORD,
  U_EILAT_USER: null,
  U_CREATE_BY: row.U_CREATE_BY,
  U_CREATE_TIME: row.U_CREATE_TIME,
  U_IP: null,
  U_IP6: null,
  SITE: 0,
  APP: 0,
  GIUL: 0,
});

// POST /users/staffLogIn { userName, Password }: mosofon login, staff table only, no IP rule.
const staffLogIn = async (req, res) => {
  const { userName, Password } = req.body;
  if (typeof userName !== "string" || typeof Password !== "string" || !userName || !Password || userName.length > 255 || Password.length > 1024) {
    return res.status(400).json({ status: "error", message: "Missing userName or Password" });
  }
  try {
    const [rows] = await pool.query("SELECT * FROM BENZI_STAFF_USERS WHERE U_USER_NAME = ?", [userName]);
    // MySQL string comparison may be case-insensitive; verify credentials exactly.
    const supplied = Buffer.from(Password);
    const stored = Buffer.from(String(rows[0]?.U_PASSWORD ?? ""));
    if (rows.length !== 1 || supplied.length !== stored.length || !crypto.timingSafeEqual(supplied, stored)) {
      return res.status(401).json({ status: "error", code: "INVALID_CREDENTIALS", message: "Invalid credentials" });
    }
    const user = { ...rows[0], U_TYPE: STAFF_TYPE };
    const session = await createSession(user, "staff");
    res.set("Cache-Control", "no-store");
    res.status(200).json({ status: "success", result: [publicUser(user)], ...session });
  } catch (err) {
    logger.error("staffLogIn failed", { code: err.code || "AUTH_ERROR" });
    res.status(500).json({ status: "error", message: "Error staffLogIn" });
  }
};

const createStaff = async (req, res) => {
  const userName = clean(req.body.U_USER_NAME);
  const viewName = clean(req.body.U_VIEW_NAME) || userName;
  if (!userName || userName.length > 255) {
    return res.status(400).json({ status: "error", message: "שם משתמש חסר" });
  }
  try {
    await pool.query(
      "INSERT INTO BENZI_STAFF_USERS (U_USER_NAME, U_PASSWORD, U_VIEW_NAME, U_CREATE_BY) VALUES (?, ?, ?, ?)",
      [userName, userName, viewName, clean(req.body.U_CREATE_BY) || null]
    );
    res.status(200).json({ status: "success" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ status: "error", message: `עובד בשם ${userName} כבר קיים` });
    }
    logger.error("createStaff Database error", { code: err.code });
    res.status(500).json({ status: "error", message: "Error createStaff" });
  }
};

const updateStaff = async (req, res) => {
  const original = clean(req.body.U_USER_NAME_ORIGINAL) || clean(req.body.U_USER_NAME);
  const userName = clean(req.body.U_USER_NAME);
  const viewName = clean(req.body.U_VIEW_NAME) || userName;
  if (!original || !userName || userName.length > 255) {
    return res.status(400).json({ status: "error", message: "שם משתמש חסר" });
  }
  try {
    // A rename also changes the password (= user name), which ends the worker's current sessions.
    const [result] = await pool.query(
      "UPDATE BENZI_STAFF_USERS SET U_USER_NAME = ?, U_PASSWORD = ?, U_VIEW_NAME = ? WHERE U_USER_NAME = ?",
      [userName, userName, viewName, original]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: "error", message: `לא נמצא עובד בשם ${original}` });
    }
    res.status(200).json({ status: "success", result });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ status: "error", message: `עובד בשם ${userName} כבר קיים` });
    }
    logger.error("updateStaff Database error", { code: err.code });
    res.status(500).json({ status: "error", message: "Error updateStaff" });
  }
};

const deleteStaff = async (req, res) => {
  const userName = clean(req.query.userName);
  if (!userName) return res.status(400).json({ status: "error", message: "Missing userName" });
  try {
    const [result] = await pool.query("DELETE FROM BENZI_STAFF_USERS WHERE U_USER_NAME = ?", [userName]);
    await pool.query("UPDATE AUTH_SESSIONS SET revoked = 1 WHERE user_name = ? AND account_kind = 'staff'", [userName]);
    res.status(200).json({ status: "success", result });
  } catch (err) {
    logger.error("deleteStaff Database error", { code: err.code });
    res.status(500).json({ status: "error", message: "Error deleteStaff" });
  }
};

// Newest-first staff rows matching the MANAG search, shaped as app users. `max` caps the rows
// so the caller can merge them with a page of customers.
const findStaff = async ({ search, createBy, max }) => {
  const where = createBy
    ? "WHERE (U_USER_NAME LIKE ? OR U_VIEW_NAME LIKE ?) AND U_CREATE_BY = ?"
    : "WHERE (U_USER_NAME LIKE ? OR U_VIEW_NAME LIKE ?)";
  const params = createBy ? [`%${search}%`, `%${search}%`, createBy] : [`%${search}%`, `%${search}%`];
  const [rows] = await pool.query(
    `SELECT * FROM BENZI_STAFF_USERS ${where} ORDER BY U_CREATE_TIME DESC LIMIT ?`,
    [...params, max]
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM BENZI_STAFF_USERS ${where}`, params);
  return { rows: rows.map(asAppUser), total };
};

const staffAuthors = async () => {
  const [rows] = await pool.query("SELECT DISTINCT U_CREATE_BY FROM BENZI_STAFF_USERS");
  return rows;
};

module.exports = { staffLogIn, createStaff, updateStaff, deleteStaff, findStaff, staffAuthors };
