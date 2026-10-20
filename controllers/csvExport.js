// Generic, table-agnostic "export by filter" - streams every row matching the
// given WHERE straight from MySQL to the HTTP response as CSV, row by row, so
// even a multi-million-row result never sits in the server's (or browser's)
// memory all at once. Shared by the noam and cars admin tables.

const logger = require("../logger.js");

// Excel can't open more rows than this in a single sheet anyway (1,048,576
// incl. header), so streaming past it would only produce an unusable file.
const MAX_EXPORT_ROWS = 1000000;

const csvCell = (value) => `"${(value ?? "").toString().replace(/"/g, '""')}"`;

// The frontend owns the Hebrew labels and the visible column order, so it sends
// [{ key, label }]; keys are validated against the table's columnsConfig so only
// known, whitelisted columns ever reach the SELECT.
const parseExportColumns = (raw, columnsConfig) => {
  let parsed;
  try {
    parsed = JSON.parse(raw || "[]");
  } catch (e) {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((c) => c && columnsConfig[c.key])
    .map((c) => ({ key: c.key, label: String(c.label ?? c.key) }));
};

// pool: the promise pool (configs/connection_*); its underlying callback pool
// (pool.pool) is what exposes mysql2's row streaming.
const streamCsvExport = ({ req, res, pool, table, columnsConfig, columns, whereSql, orderBySql, params, fileName }) => {
  const selectSql = columns.map((c) => `${columnsConfig[c.key].column} AS \`${c.key}\``).join(", ");
  const sql = `SELECT ${selectSql} FROM ${table} ${whereSql} ${orderBySql} LIMIT ?;`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="export.csv"; filename*=UTF-8''${encodeURIComponent(fileName)}`
  );

  // BOM so Excel detects UTF-8 (Hebrew) correctly
  res.write("﻿" + columns.map((c) => csvCell(c.label)).join(",") + "\r\n");

  let count = 0;
  const query = pool.pool.query(sql, [...params, MAX_EXPORT_ROWS]);
  const stream = query.stream({ highWaterMark: 1000 });

  // Stop pulling rows from MySQL if the user cancels the download mid-way
  req.on("close", () => {
    if (!res.writableEnded) stream.destroy();
  });

  stream.on("data", (row) => {
    count++;
    const ok = res.write(columns.map((c) => csvCell(row[c.key])).join(",") + "\r\n");
    if (!ok) {
      stream.pause();
      res.once("drain", () => stream.resume());
    }
  });
  stream.on("end", () => {
    logger.info("csv export finished", { table, rows: count });
    res.end();
  });
  stream.on("error", (err) => {
    logger.error("csv export Database error", { table, error: err, rowsSoFar: count });
    // Headers/partial body are already sent, so the only honest signal left is
    // to abort the connection - the browser then marks the download as failed.
    res.destroy(err);
  });
};

module.exports = { streamCsvExport, parseExportColumns, MAX_EXPORT_ROWS };
