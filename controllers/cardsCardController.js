// "כרטיס פריט" popup in the admin noam table: shows every column of the `cards`
// row(s) for one catalog number and lets the admin edit all of them except a
// fixed set of locked fields.
//
// The cards table is filled/updated by an external sync (cronController), and its
// full schema isn't spelled out anywhere in this codebase, so the column list is
// read from the DB itself (SHOW COLUMNS) instead of being hardcoded - a column
// added later automatically shows up, and only real column names ever reach SQL.

const pool = require("../configs/connection_cars");
const logger = require("../logger.js");

// Never editable from the popup (compared case-insensitively). catalog_number is
// the item code itself - the key the external sync and the noam join both rely on.
const LOCKED_COLUMNS = new Set([
  "catalog_number", // קוד פריט
  "sku_invoice", // מק"ט לחשבונית
  "alternative_skus", // מק"טים חלופיים
  "item_description", // תיאור פריט
  "brand", // מותג
  "gross_price", // מחיר ברוטו
  "net_price", // מחיר נטו
  "quantity", // מלאי במחסן כללי
]);

const SCHEMA_TTL_MS = 10 * 60 * 1000;
let schemaCache = null; // { columns: [{ name, type }], primaryKey: [name], loadedAt }

const loadSchema = async () => {
  if (schemaCache && Date.now() - schemaCache.loadedAt < SCHEMA_TTL_MS) return schemaCache;
  const [cols] = await pool.query("SHOW COLUMNS FROM cards;");
  schemaCache = {
    columns: cols.map((c) => ({ name: c.Field, type: c.Type })),
    primaryKey: cols.filter((c) => c.Key === "PRI").map((c) => c.Field),
    loadedAt: Date.now(),
  };
  return schemaCache;
};

const isEditable = (name, schema) =>
  !LOCKED_COLUMNS.has(name.toLowerCase()) && !schema.primaryKey.includes(name);

const getCardsByCatalog = async (req, res) => {
  try {
    const { CATALOG_NUMBER } = req.query;
    if (!CATALOG_NUMBER) {
      return res.status(400).json({ status: "error", message: "Missing CATALOG_NUMBER" });
    }
    const schema = await loadSchema();
    logger.info("getCardsByCatalog called", { CATALOG_NUMBER });

    const [rows] = await pool.query("SELECT * FROM cards WHERE catalog_number = ?;", [CATALOG_NUMBER]);

    res.status(200).json({
      status: "success",
      columns: schema.columns.map((c) => ({ ...c, editable: isEditable(c.name, schema) })),
      primaryKey: schema.primaryKey,
      result: rows,
    });
  } catch (err) {
    logger.error("getCardsByCatalog Database error", { error: err });
    res.status(500).json({ status: "error", message: "Error fetching item card" });
  }
};

// body: { catalogNumber, key: { pkCol: value } (only when cards has a primary key),
//         changes: { column: value } }
// Updates exactly one row - if the WHERE would hit more (e.g. no primary key and
// several cards share the catalog number), the transaction is rolled back.
const updateCard = async (req, res) => {
  const { catalogNumber, key = {}, changes = {} } = req.body || {};
  if (!catalogNumber) {
    return res.status(400).json({ status: "error", message: "Missing catalogNumber" });
  }

  let connection;
  try {
    const schema = await loadSchema();
    const columnNames = new Set(schema.columns.map((c) => c.name));

    const changeEntries = Object.entries(changes).filter(
      ([name]) => columnNames.has(name) && isEditable(name, schema)
    );
    const rejected = Object.keys(changes).filter((name) => !changeEntries.some(([n]) => n === name));
    if (rejected.length > 0) {
      return res.status(400).json({ status: "error", message: `שדות לא ניתנים לעריכה: ${rejected.join(", ")}` });
    }
    if (changeEntries.length === 0) {
      return res.status(400).json({ status: "error", message: "No changes" });
    }

    const whereParts = ["catalog_number = ?"];
    const whereParams = [catalogNumber];
    for (const pk of schema.primaryKey) {
      if (key[pk] === undefined) {
        return res.status(400).json({ status: "error", message: `Missing key ${pk}` });
      }
      whereParts.push(`\`${pk}\` = ?`);
      whereParams.push(key[pk]);
    }

    const setSql = changeEntries.map(([name]) => `\`${name}\` = ?`).join(", ");
    // Empty stays "" (not NULL) - same convention as the external sync, and safe for NOT NULL columns
    const setParams = changeEntries.map(([, value]) => value ?? "");

    logger.info("updateCard called", { catalogNumber, key, changes });

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.query(
      `UPDATE cards SET ${setSql} WHERE ${whereParts.join(" AND ")};`,
      [...setParams, ...whereParams]
    );
    if (result.affectedRows !== 1) {
      await connection.rollback();
      logger.warn("updateCard rolled back - unexpected row count", { affectedRows: result.affectedRows });
      return res.status(409).json({
        status: "error",
        message:
          result.affectedRows === 0
            ? "הפריט לא נמצא"
            : "נמצאו כמה כרטיסים עם אותו קוד פריט - העדכון בוטל",
      });
    }
    await connection.commit();

    res.status(200).json({ status: "success", affectedRows: 1 });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    logger.error("updateCard Database error", { error: err });
    res.status(500).json({ status: "error", message: "Error updating item card" });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { getCardsByCatalog, updateCard };
