const pool = require("../configs/connection_cars");
const logger = require("../logger.js");
const { NOAM_COLUMNS_CONFIG, SELECT_COLUMNS, ROW_EDITABLE_COLUMNS } = require("./noamColumns");
const { buildWhere, buildOrderBy } = require("./sqlFilterBuilder");
const buildNoamWhere = (filters) => buildWhere(NOAM_COLUMNS_CONFIG, filters);
const buildNoamOrderBy = (sort) => buildOrderBy(NOAM_COLUMNS_CONFIG, sort);
const { streamCsvExport, parseExportColumns } = require("./csvExport");
const { manufactureYearsFor } = require("./manufactureYears");
const YEAR_RANGE_KEYS = ["from_year", "until_year"];

const PAGE_SIZE = 500;
const MAX_DISTINCT_VALUES = 500;

const parseFilters = (raw) => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
};

const getNoamList = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.PAGE, 10) || 1, 1);
    const offset = (page - 1) * PAGE_SIZE;
    const filters = parseFilters(req.query.FILTERS);
    // Default is id DESC (newest rows first) at the query level itself, not
    // merely something the frontend happens to request - so this holds true
    // for any caller, not just the current frontend's default state.
    const sort = req.query.SORT_COLUMN
      ? { column: req.query.SORT_COLUMN, dir: req.query.SORT_DIR }
      : { column: "id", dir: "desc" };

    const { whereSql, params } = buildNoamWhere(filters);
    const orderBySql = buildNoamOrderBy(sort);

    logger.info("getNoamList called", { page, offset, limit: PAGE_SIZE, filters, sort });

    const [rows] = await pool.query(
      `SELECT ${SELECT_COLUMNS.join(", ")} FROM noam ${whereSql} ${orderBySql} LIMIT ? OFFSET ?;`,
      [...params, PAGE_SIZE, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM noam ${whereSql};`,
      params
    );

    logger.info("getNoamList result", { count: rows.length, total });

    res.status(200).json({
      status: "success",
      result: rows,
      page,
      limit: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (err) {
    logger.error("getNoamList Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error fetching noam list",
    });
  }
};

// "ייצוא לפי סינון" - streams EVERY row matching the current filters/sort as CSV,
// not just the pages loaded in the browser.
const exportCsv = (req, res) => {
  try {
    const columns = parseExportColumns(req.query.COLUMNS, NOAM_COLUMNS_CONFIG);
    if (columns.length === 0) {
      return res.status(400).json({ status: "error", message: "Invalid columns" });
    }
    const filters = parseFilters(req.query.FILTERS);
    const sort = req.query.SORT_COLUMN
      ? { column: req.query.SORT_COLUMN, dir: req.query.SORT_DIR }
      : { column: "id", dir: "desc" };
    const { whereSql, params } = buildNoamWhere(filters);
    const orderBySql = buildNoamOrderBy(sort);

    logger.info("noam exportCsv called", { filters, sort });

    streamCsvExport({
      req,
      res,
      pool,
      table: "noam",
      columnsConfig: NOAM_COLUMNS_CONFIG,
      columns,
      whereSql,
      orderBySql,
      params,
      fileName: "טבלת_נועם_לפי_סינון.csv",
    });
  } catch (err) {
    logger.error("noam exportCsv error", { error: err });
    if (!res.headersSent) {
      res.status(500).json({ status: "error", message: "Error exporting noam" });
    }
  }
};

// Distinct values for a single column's filter checklist, optionally text-searched
// and optionally narrowed by the OTHER currently-active column filters (never by
// the filter on this same column, so picking a value never shrinks its own list).
const getDistinctValues = async (req, res) => {
  try {
    const { COLUMN, SEARCH = "" } = req.query;
    const config = NOAM_COLUMNS_CONFIG[COLUMN];
    if (!config) {
      return res.status(400).json({ status: "error", message: "Invalid column" });
    }

    const filters = parseFilters(req.query.FILTERS);
    delete filters[COLUMN];

    const { whereSql, params } = buildNoamWhere(filters);
    const limit = Math.min(parseInt(req.query.LIMIT, 10) || 200, MAX_DISTINCT_VALUES);

    logger.info("getDistinctValues called", { column: COLUMN, search: SEARCH, filters, limit });

    let values;
    if (config.type === "csv_years") {
      // manufacture_years stores whole CSV strings per row ("2018,2019,2020"), so the
      // useful "distinct values" for a checklist are the individual years across all
      // matching rows, not the distinct raw CSV strings. Flatten + dedupe in JS since
      // MySQL has no clean way to split a CSV column into rows here.
      const [rawRows] = await pool.query(
        `SELECT DISTINCT ${config.column} AS value
         FROM noam
         ${whereSql}
         ${whereSql ? "AND" : "WHERE"} ${config.column} <> '';`,
        params
      );
      const yearSet = new Set();
      rawRows.forEach((r) => {
        String(r.value)
          .split(",")
          .map((y) => y.trim())
          .filter(Boolean)
          .forEach((y) => yearSet.add(y));
      });
      values = [...yearSet]
        .filter((y) => y.includes(SEARCH))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .slice(0, limit);
    } else {
      const [rows] = await pool.query(
        `SELECT DISTINCT ${config.column} AS value
         FROM noam
         ${whereSql}
         ${whereSql ? "AND" : "WHERE"} ${config.column} <> '' AND ${config.column} LIKE ?
         ORDER BY ${config.column}
         LIMIT ?;`,
        [...params, `%${SEARCH}%`, limit]
      );
      values = rows.map((r) => r.value);
    }

    res.status(200).json({ status: "success", result: values });
  } catch (err) {
    logger.error("getDistinctValues Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error fetching distinct values",
    });
  }
};

// Mass update: applies to EVERY row matching the given filters, not just loaded rows.
// column is validated against the writable whitelist; the WHERE clause is built by
// the same shared, parameterized function used for reads.
const updateColumn = async (req, res) => {
  try {
    const { column, value, filters } = req.body || {};
    const config = NOAM_COLUMNS_CONFIG[column];

    if (!config) {
      return res.status(400).json({ status: "error", message: "Invalid column" });
    }
    if (!config.writable) {
      return res.status(400).json({ status: "error", message: "Column is not updatable" });
    }
    if (value === undefined || value === null) {
      return res.status(400).json({ status: "error", message: "Missing value" });
    }

    const { whereSql, params } = buildNoamWhere(filters);

    logger.info("updateColumn called", { column, value, filters, whereSql });

    // The rows are picked BEFORE the update: the filter may be on the very column being
    // changed, and afterwards the same WHERE would no longer find them.
    let yearRows = [];
    if (YEAR_RANGE_KEYS.includes(column)) {
      [yearRows] = await pool.query(`SELECT id, from_year, until_year FROM noam ${whereSql};`, params);
    }

    const [result] = await pool.query(
      `UPDATE noam SET ${config.column} = ? ${whereSql};`,
      [value, ...params]
    );

    // "שנת ייצור" follows "משנה" / "עד שנה"
    for (const row of yearRows) {
      const years = manufactureYearsFor(
        column === "from_year" ? value : row.from_year,
        column === "until_year" ? value : row.until_year
      );
      if (years !== null) {
        await pool.query("UPDATE noam SET manufacture_years = ? WHERE id = ?;", [years, row.id]);
      }
    }

    logger.info("updateColumn result", { affectedRows: result.affectedRows });

    res.status(200).json({
      status: "success",
      affectedRows: result.affectedRows,
    });
  } catch (err) {
    logger.error("updateColumn Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error updating noam column",
    });
  }
};

// The SAP cron (cronController) only UPDATEs existing cards rows, so an item first
// created here would never get its data or show up on the site. When a new noam row's
// catalog_number has no cards row yet, create a bare one: the catalog number and the
// three category fields, everything else left for the cron to fill in. The other
// columns are NOT NULL without defaults, so they get explicit empty values.
const CARDS_EMPTY_COLUMNS = [
  "status", "site_display", "item_description", "length", "size", "teeth",
  "alternative_skus", "sku_code", "site_search", "image", "gross_price", "net_price",
  "sku_invoice", "brand", "quantity", "garage9_price",
];

const ensureCardsRow = async (connection, row) => {
  const catalogNumber = String(row.catalog_number ?? "").trim();
  if (catalogNumber === "") return false;

  const [existing] = await connection.query(
    "SELECT 1 FROM cards WHERE catalog_number = ? LIMIT 1;",
    [catalogNumber]
  );
  if (existing.length > 0) return false;

  const columns = ["catalog_number", "parent_group", "item_group", "child_group", "show_random", ...CARDS_EMPTY_COLUMNS];
  const params = [
    catalogNumber,
    row.parent_group ?? "",
    row.item_group ?? "",
    row.child_group ?? "",
    0,
    ...CARDS_EMPTY_COLUMNS.map(() => ""),
  ];
  await connection.query(
    `INSERT INTO cards (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")});`,
    params
  );
  return true;
};

// Persists the "שמירה" (save) action: every edited cell, every newly-added row,
// and every row marked for deletion, all of which sat only in the browser's local
// state until now. Runs as a single transaction so a partial failure never leaves
// some rows saved/deleted and others not.
//
// updates: [{ id, changes: { colKey: value, ... } }]  - existing rows, changed columns only
// inserts: [{ _tempId, ...colKey: value }]             - brand new rows, not yet in the DB
// deletes: [id, id, ...]                               - existing rows to remove
const saveChanges = async (req, res) => {
  const { updates = [], inserts = [], deletes = [] } = req.body || {};
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const deleteIds = deletes
      .map((id) => parseInt(id, 10))
      .filter((id) => Number.isFinite(id));

    let deletedCount = 0;
    if (deleteIds.length > 0) {
      const [result] = await connection.query(
        `DELETE FROM noam WHERE id IN (${deleteIds.map(() => "?").join(",")});`,
        deleteIds
      );
      deletedCount = result.affectedRows;
    }
    const deleteIdSet = new Set(deleteIds);

    let updatedCount = 0;
    for (const update of updates) {
      const id = parseInt(update?.id, 10);
      if (!Number.isFinite(id) || deleteIdSet.has(id)) continue; // a deleted row is never also updated

      const changeEntries = Object.entries(update.changes || {}).filter(
        ([key]) => ROW_EDITABLE_COLUMNS.includes(key)
      );
      if (changeEntries.length === 0) continue;

      // "שנת ייצור" follows "משנה" / "עד שנה": when either changed, recompute it from the
      // row's resulting range (the other end comes from the DB if it wasn't edited).
      if (changeEntries.some(([key]) => YEAR_RANGE_KEYS.includes(key))) {
        const [[current] = []] = await connection.query(
          "SELECT from_year, until_year FROM noam WHERE id = ?;",
          [id]
        );
        const changes = Object.fromEntries(changeEntries);
        const years = manufactureYearsFor(
          "from_year" in changes ? changes.from_year : current?.from_year,
          "until_year" in changes ? changes.until_year : current?.until_year
        );
        if (years !== null) {
          const idx = changeEntries.findIndex(([key]) => key === "manufacture_years");
          if (idx >= 0) changeEntries[idx] = ["manufacture_years", years];
          else changeEntries.push(["manufacture_years", years]);
        }
      }

      const setSql = changeEntries
        .map(([key]) => `${NOAM_COLUMNS_CONFIG[key].column} = ?`)
        .join(", ");
      const params = [...changeEntries.map(([, value]) => value ?? ""), id];

      const [result] = await connection.query(
        `UPDATE noam SET ${setSql} WHERE id = ?;`,
        params
      );
      updatedCount += result.affectedRows;
    }

    const insertedRows = [];
    let createdCardsCount = 0;
    for (const row of inserts) {
      const hasContent = ROW_EDITABLE_COLUMNS.some((key) => (row[key] ?? "") !== "");
      if (!hasContent) continue; // skip a row the user added but never filled in

      const columnSql = ROW_EDITABLE_COLUMNS.map((key) => NOAM_COLUMNS_CONFIG[key].column).join(", ");
      const placeholders = ROW_EDITABLE_COLUMNS.map(() => "?").join(", ");
      const years = manufactureYearsFor(row.from_year, row.until_year);
      const params = ROW_EDITABLE_COLUMNS.map((key) =>
        key === "manufacture_years" && years !== null ? years : row[key] ?? ""
      );

      const [result] = await connection.query(
        `INSERT INTO noam (${columnSql}) VALUES (${placeholders});`,
        params
      );
      insertedRows.push({ tempId: row._tempId, id: result.insertId });
      if (await ensureCardsRow(connection, row)) createdCardsCount++;
    }

    await connection.commit();
    logger.info("saveChanges result", {
      updatedCount,
      insertedCount: insertedRows.length,
      deletedCount,
      createdCardsCount,
    });

    res.status(200).json({
      status: "success",
      updatedCount,
      insertedRows,
      deletedCount,
    });
  } catch (err) {
    await connection.rollback();
    logger.error("saveChanges Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error saving changes",
    });
  } finally {
    connection.release();
  }
};

// Deletes a single row by its primary key. Not exposed in the UI yet - added so
// test/junk rows can be cleaned up directly via the API when needed.
const deleteRow = async (req, res) => {
  try {
    const id = parseInt(req.query.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: "error", message: "Invalid id" });
    }

    const [result] = await pool.query("DELETE FROM noam WHERE id = ?;", [id]);
    logger.info("deleteRow result", { id, affectedRows: result.affectedRows });

    res.status(200).json({ status: "success", affectedRows: result.affectedRows });
  } catch (err) {
    logger.error("deleteRow Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error deleting row",
    });
  }
};

module.exports = {
  getNoamList,
  exportCsv,
  getDistinctValues,
  updateColumn,
  saveChanges,
  deleteRow,
};
