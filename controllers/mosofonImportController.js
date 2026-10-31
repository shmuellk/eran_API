// Copies the legacy mosofon users (MSSQL `users` table on My_SQL_Server) into
// BENZI_STAFF_USERS. Password = user name, as in the old app. Names already in the staff
// table are skipped, so the import can be re-run safely. Customers/admins live in another
// table, so their names never clash with staff.
// Used by POST /users/importMosofonUsers and scripts/import-mosofon-users.js.
const pool = require("../configs/connection_cars");

// Trimmed, non-empty, case-insensitively unique user names.
function normalizeNames(users) {
  const seen = new Set();
  return users
    .map((user) => String(user?.userName ?? "").trim())
    .filter((name) => name && !seen.has(name.toLowerCase()) && seen.add(name.toLowerCase()));
}

// Returns { toCreate: [name], skipped: [name] } without writing.
async function planImport(names) {
  const toCreate = [];
  const skipped = [];
  for (const name of names) {
    const [rows] = await pool.query("SELECT U_USER_NAME FROM BENZI_STAFF_USERS WHERE U_USER_NAME = ?", [name]);
    (rows.length ? skipped : toCreate).push(name);
  }
  return { toCreate, skipped };
}

// Inserts all planned accounts in one transaction: either all are created or none.
async function applyImport(toCreate, { createdBy }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const name of toCreate) {
      await connection.query(
        "INSERT INTO BENZI_STAFF_USERS (U_USER_NAME, U_PASSWORD, U_VIEW_NAME, U_CREATE_BY) VALUES (?, ?, ?, ?)",
        [name, name, name, createdBy]
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

// POST /users/importMosofonUsers  { users: [{ userName }], createdBy?, apply? }
// Super admin only. Without apply: true it only reports what would happen.
async function importMosofonUsers(req, res) {
  const { users, apply } = req.body;
  const createdBy = typeof req.body.createdBy === "string" && req.body.createdBy.trim()
    ? req.body.createdBy.trim()
    : req.auth.user.U_USER_NAME;
  if (!Array.isArray(users) || users.length > 2000) {
    return res.status(400).json({ status: "error", message: "users must be an array (max 2000)" });
  }
  const names = normalizeNames(users).filter((name) => name.length <= 255);
  try {
    const { toCreate, skipped } = await planImport(names);
    if (apply === true) await applyImport(toCreate, { createdBy });
    res.json({ status: "success", applied: apply === true, total: names.length, created: toCreate, skipped });
  } catch (error) {
    console.error("importMosofonUsers failed:", error.code || error.message);
    res.status(500).json({ status: "error", message: "Import failed, nothing was written" });
  }
}

module.exports = { normalizeNames, planImport, applyImport, importMosofonUsers };
