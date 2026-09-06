const pool = require("../configs/connection_cars");
const logger = require("../logger.js");
const { CARS_COLUMNS_CONFIG, SELECT_COLUMNS, ROW_EDITABLE_COLUMNS } = require("./carsColumns");
const { buildWhere, buildOrderBy } = require("./sqlFilterBuilder");
const buildCarsWhere = (filters) => buildWhere(CARS_COLUMNS_CONFIG, filters);
const buildCarsOrderBy = (sort) => buildOrderBy(CARS_COLUMNS_CONFIG, sort);

// CARS_BENZI_TEST is a test table with the exact same schema as the real
// (5.1M-row, production) cars table - this admin feature targets the test
// copy, not production, until told otherwise.
const TABLE_NAME = "CARS_BENZI_TEST";

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

const getCarsList = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.PAGE, 10) || 1, 1);
    const offset = (page - 1) * PAGE_SIZE;
    const filters = parseFilters(req.query.FILTERS);
    const sort = req.query.SORT_COLUMN
      ? { column: req.query.SORT_COLUMN, dir: req.query.SORT_DIR }
      : null;

    const { whereSql, params } = buildCarsWhere(filters);
    const orderBySql = buildCarsOrderBy(sort);

    logger.info("getCarsList called", { page, offset, limit: PAGE_SIZE, filters, sort });

    const [rows] = await pool.query(
      `SELECT ${SELECT_COLUMNS.join(", ")} FROM ${TABLE_NAME} ${whereSql} ${orderBySql} LIMIT ? OFFSET ?;`,
      [...params, PAGE_SIZE, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM ${TABLE_NAME} ${whereSql};`,
      params
    );

    logger.info("getCarsList result", { count: rows.length, total });

    res.status(200).json({
      status: "success",
      result: rows,
      page,
      limit: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (err) {
    logger.error("getCarsList Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error fetching cars list",
    });
  }
};

// Distinct values for a single column's filter checklist, optionally text-searched
// and optionally narrowed by the OTHER currently-active column filters (never by
// the filter on this same column, so picking a value never shrinks its own list).
const getDistinctValues = async (req, res) => {
  try {
    const { COLUMN, SEARCH = "" } = req.query;
    const config = CARS_COLUMNS_CONFIG[COLUMN];
    if (!config) {
      return res.status(400).json({ status: "error", message: "Invalid column" });
    }

    const filters = parseFilters(req.query.FILTERS);
    delete filters[COLUMN];

    const { whereSql, params } = buildCarsWhere(filters);
    const limit = Math.min(parseInt(req.query.LIMIT, 10) || 200, MAX_DISTINCT_VALUES);

    logger.info("getDistinctValues called", { column: COLUMN, search: SEARCH, filters, limit });

    const [rows] = await pool.query(
      `SELECT DISTINCT ${config.column} AS value
       FROM ${TABLE_NAME}
       ${whereSql}
       ${whereSql ? "AND" : "WHERE"} ${config.column} <> '' AND ${config.column} LIKE ?
       ORDER BY ${config.column}
       LIMIT ?;`,
      [...params, `%${SEARCH}%`, limit]
    );

    res.status(200).json({ status: "success", result: rows.map((r) => r.value) });
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
    const config = CARS_COLUMNS_CONFIG[column];

    if (!config) {
      return res.status(400).json({ status: "error", message: "Invalid column" });
    }
    if (!config.writable) {
      return res.status(400).json({ status: "error", message: "Column is not updatable" });
    }
    if (value === undefined || value === null) {
      return res.status(400).json({ status: "error", message: "Missing value" });
    }

    const { whereSql, params } = buildCarsWhere(filters);

    logger.info("updateColumn called", { column, value, filters, whereSql });

    const [result] = await pool.query(
      `UPDATE ${TABLE_NAME} SET ${config.column} = ? ${whereSql};`,
      [value, ...params]
    );

    logger.info("updateColumn result", { affectedRows: result.affectedRows });

    res.status(200).json({
      status: "success",
      affectedRows: result.affectedRows,
    });
  } catch (err) {
    logger.error("updateColumn Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error updating cars column",
    });
  }
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
        `DELETE FROM ${TABLE_NAME} WHERE id IN (${deleteIds.map(() => "?").join(",")});`,
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

      const setSql = changeEntries
        .map(([key]) => `${CARS_COLUMNS_CONFIG[key].column} = ?`)
        .join(", ");
      const params = [...changeEntries.map(([, value]) => value ?? ""), id];

      const [result] = await connection.query(
        `UPDATE ${TABLE_NAME} SET ${setSql} WHERE id = ?;`,
        params
      );
      updatedCount += result.affectedRows;
    }

    const insertedRows = [];
    for (const row of inserts) {
      const hasContent = ROW_EDITABLE_COLUMNS.some((key) => (row[key] ?? "") !== "");
      if (!hasContent) continue; // skip a row the user added but never filled in

      const columnSql = ROW_EDITABLE_COLUMNS.map((key) => CARS_COLUMNS_CONFIG[key].column).join(", ");
      const placeholders = ROW_EDITABLE_COLUMNS.map(() => "?").join(", ");
      const params = ROW_EDITABLE_COLUMNS.map((key) => row[key] ?? "");

      const [result] = await connection.query(
        `INSERT INTO ${TABLE_NAME} (${columnSql}) VALUES (${placeholders});`,
        params
      );
      insertedRows.push({ tempId: row._tempId, id: result.insertId });
    }

    await connection.commit();
    logger.info("saveChanges result", {
      updatedCount,
      insertedCount: insertedRows.length,
      deletedCount,
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

    const [result] = await pool.query(`DELETE FROM ${TABLE_NAME} WHERE id = ?;`, [id]);
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
  getCarsList,
  getDistinctValues,
  updateColumn,
  saveChanges,
  deleteRow,
};
