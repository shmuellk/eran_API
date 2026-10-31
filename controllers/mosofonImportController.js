// Creates "עובד" accounts in BENZI_APP_USERS for the legacy mosofon users (MSSQL `users`
// table on My_SQL_Server). Password = user name, as in the old app.
//
// Existing accounts are never touched: login looks users up by name only, so a name already
// used by a customer/admin gets a number appended instead (נועם -> נועם2, or נועם3 if נועם2
// is taken too). Used by POST /users/importMosofonUsers and scripts/import-mosofon-users.js.
const pool = require("../configs/connection_cars");
const { STAFF_TYPE } = require("./userTypes");

// Trimmed, non-empty, case-insensitively unique user names.
function normalizeNames(users) {
  const seen = new Set();
  return users
    .map((user) => String(user?.userName ?? "").trim())
    .filter((name) => name && !seen.has(name.toLowerCase()) && seen.add(name.toLowerCase()));
}

async function lookup(name) {
  const [rows] = await pool.query(
    "SELECT U_USER_NAME, U_TYPE FROM BENZI_APP_USERS WHERE U_USER_NAME = ?",
    [name]
  );
  if (rows.length === 0) return "free";
  return rows.every((row) => row.U_TYPE === STAFF_TYPE) ? "staff" : "taken";
}

// Returns { toCreate: [{ name, original }], skipped: [{ name, migratedAs }] } without writing.
async function planImport(names) {
  // Every legacy name is reserved, so a renamed user never takes another legacy user's name.
  const claimed = new Set(names.map((name) => name.toLowerCase()));
  const toCreate = [];
  const skipped = [];
  for (const name of names) {
    const status = await lookup(name);
    if (status === "free") {
      toCreate.push({ name, original: name });
      continue;
    }
    if (status === "staff") {
      skipped.push({ name, migratedAs: name });
      continue;
    }
    // Name used by a customer/admin: first free numbered variant. A staff account on a
    // numbered name means an earlier run already renamed this user.
    for (let n = 2; ; n++) {
      const candidate = `${name}${n}`;
      if (claimed.has(candidate.toLowerCase())) continue;
      const candidateStatus = await lookup(candidate);
      if (candidateStatus === "taken") continue;
      if (candidateStatus === "staff") {
        skipped.push({ name, migratedAs: candidate });
      } else {
        claimed.add(candidate.toLowerCase());
        toCreate.push({ name: candidate, original: name });
      }
      break;
    }
  }
  return { toCreate, skipped };
}

// Inserts all planned accounts in one transaction: either all are created or none.
async function applyImport(toCreate, { cardCode, createdBy }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const { name } of toCreate) {
      // Staff are IP-exempt at login; SITE/APP stay off so the account cannot use the customer platforms.
      await connection.query(
        `INSERT INTO BENZI_APP_USERS
          (U_CARD_CODE, U_CARD_NAME, U_VIEW_NAME, U_SHIPTYPE, U_TYPE, U_USER_NAME, U_PASSWORD, U_EILAT_USER, U_CREATE_BY, U_IP, U_IP6, SITE, APP, GIUL)
         VALUES (?, ?, ?, NULL, ?, ?, ?, '0', ?, '', '', 0, 0, 0)`,
        [cardCode, name, name, STAFF_TYPE, name, name, createdBy]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// POST /users/importMosofonUsers  { users: [{ userName }], cardCode, createdBy?, apply? }
// Super admin only. Without apply: true it only reports what would happen.
async function importMosofonUsers(req, res) {
  const { users, cardCode, apply } = req.body;
  const createdBy = typeof req.body.createdBy === "string" && req.body.createdBy.trim()
    ? req.body.createdBy.trim()
    : req.auth.user.U_USER_NAME;
  if (!Array.isArray(users) || users.length > 2000) {
    return res.status(400).json({ status: "error", message: "users must be an array (max 2000)" });
  }
  if (typeof cardCode !== "string" || !cardCode.trim() || cardCode.length > 50) {
    return res.status(400).json({ status: "error", message: "cardCode required" });
  }
  const names = normalizeNames(users).filter((name) => name.length <= 200);
  try {
    const { toCreate, skipped } = await planImport(names);
    if (apply === true) await applyImport(toCreate, { cardCode: cardCode.trim(), createdBy });
    res.json({
      status: "success",
      applied: apply === true,
      total: names.length,
      created: toCreate,
      renamed: toCreate.filter((user) => user.name !== user.original),
      skipped,
    });
  } catch (error) {
    console.error("importMosofonUsers failed:", error.code || error.message);
    res.status(500).json({ status: "error", message: "Import failed, nothing was written" });
  }
}

module.exports = { normalizeNames, planImport, applyImport, importMosofonUsers };
