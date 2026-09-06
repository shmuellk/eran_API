// Generic, table-agnostic WHERE/ORDER BY builder. Takes a columnsConfig map
// ({ frontendKey: { column, type, writable } }) as a parameter rather than
// importing one directly, so the same safe, parameterized logic can be reused
// by any table's controller (noam, cars, ...) without duplicating it.

const toInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

const buildTextCondition = (column, op, filter) => {
  switch (op) {
    case "eq":
      return { sql: `${column} = ?`, params: [filter.value] };
    case "neq":
      return { sql: `${column} <> ?`, params: [filter.value] };
    case "contains":
      return { sql: `${column} LIKE ?`, params: [`%${filter.value}%`] };
    case "not_contains":
      return { sql: `${column} NOT LIKE ?`, params: [`%${filter.value}%`] };
    case "starts_with":
      return { sql: `${column} LIKE ?`, params: [`${filter.value}%`] };
    case "ends_with":
      return { sql: `${column} LIKE ?`, params: [`%${filter.value}`] };
    case "is_empty":
      return { sql: `${column} = ''`, params: [] };
    case "is_not_empty":
      return { sql: `${column} <> ''`, params: [] };
    case "in":
      return buildInCondition(column, filter);
    default:
      return null;
  }
};

// Values-checklist membership, shared by all column types: selected exact
// values IN (...), optionally OR'd with `column = ''` when the "ריק" (empty)
// box is checked. This is the operator the frontend's column-menu checklist uses.
const buildInCondition = (column, filter) => {
  const values = Array.isArray(filter.values)
    ? filter.values.filter((v) => v !== "" && v != null)
    : [];
  const parts = [];
  const params = [];

  if (values.length > 0) {
    parts.push(`${column} IN (${values.map(() => "?").join(",")})`);
    params.push(...values);
  }
  if (filter.includeEmpty) {
    parts.push(`${column} = ''`);
  }

  if (parts.length === 0) return null;
  return { sql: parts.length > 1 ? `(${parts.join(" OR ")})` : parts[0], params };
};

// For VARCHAR columns that hold numbers (e.g. years, door counts). The REGEXP
// guard excludes empty/non-numeric values instead of silently casting them to 0.
const buildNumericCondition = (column, op, filter) => {
  if (op === "in") return buildInCondition(column, filter);

  const cast = `CAST(${column} AS UNSIGNED)`;
  const guard = `${column} REGEXP '^[0-9]+$'`;

  const n1 = toInt(filter.value);
  if (op !== "between" && n1 === null) return null;

  switch (op) {
    case "eq":
      return { sql: `(${guard} AND ${cast} = ?)`, params: [n1] };
    case "neq":
      return { sql: `(${guard} AND ${cast} <> ?)`, params: [n1] };
    case "gt":
      return { sql: `(${guard} AND ${cast} > ?)`, params: [n1] };
    case "gte":
      return { sql: `(${guard} AND ${cast} >= ?)`, params: [n1] };
    case "lt":
      return { sql: `(${guard} AND ${cast} < ?)`, params: [n1] };
    case "lte":
      return { sql: `(${guard} AND ${cast} <= ?)`, params: [n1] };
    case "between": {
      const from = toInt(filter.value);
      const to = toInt(filter.value2);
      if (from === null || to === null) return null;
      return { sql: `(${guard} AND ${cast} BETWEEN ? AND ?)`, params: [from, to] };
    }
    default:
      return null;
  }
};

// For VARCHAR columns holding a comma-separated list (e.g. noam.manufacture_years:
// "2018,2019,2020"). Membership test via the FIND_IN_SET-style pattern already
// used elsewhere in this codebase (see carController.js).
const buildCsvListCondition = (column, op, filter) => {
  const membership = `CONCAT(',', ${column}, ',') LIKE CONCAT('%,', ?, ',%')`;
  switch (op) {
    case "contains_value":
      return filter.value ? { sql: membership, params: [filter.value] } : null;
    case "in": {
      const values = Array.isArray(filter.values) ? filter.values.filter(Boolean) : [];
      const parts = values.map(() => membership);
      const params = [...values];
      if (filter.includeEmpty) {
        parts.push(`${column} = ''`);
      }
      if (parts.length === 0) return null;
      return { sql: `(${parts.join(" OR ")})`, params };
    }
    default:
      return null;
  }
};

// Builds a parameterized WHERE clause from a { colKey: {op, value|values} } filter
// map, resolved through the given columnsConfig whitelist. Unknown column keys and
// unknown/invalid operators are silently dropped rather than trusted - the
// frontend can never smuggle arbitrary SQL through this path.
const buildWhere = (columnsConfig, filters) => {
  if (!filters || typeof filters !== "object") return { whereSql: "", params: [] };

  const clauses = [];
  const params = [];

  for (const [key, filter] of Object.entries(filters)) {
    const config = columnsConfig[key];
    if (!config || !filter || !filter.op) continue;

    let condition = null;
    if (config.type === "text") {
      condition = buildTextCondition(config.column, filter.op, filter);
    } else if (config.type === "numeric_text") {
      condition = buildNumericCondition(config.column, filter.op, filter);
    } else if (config.type === "csv_list") {
      condition = buildCsvListCondition(config.column, filter.op, filter);
    }

    if (condition) {
      clauses.push(condition.sql);
      params.push(...condition.params);
    }
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
};

// Builds a validated ORDER BY fragment - column and direction are both resolved
// through the whitelist, never taken as raw input.
const buildOrderBy = (columnsConfig, sort) => {
  if (!sort || !sort.column) return "";
  const config = columnsConfig[sort.column];
  if (!config) return "";
  const dir = String(sort.dir).toLowerCase() === "desc" ? "DESC" : "ASC";
  return `ORDER BY ${config.column} ${dir}`;
};

module.exports = { buildWhere, buildOrderBy };
