// Single source of truth for which noam columns are filterable/sortable/updatable
// from the frontend, and how each one should be treated in SQL.
//
// type:
//   "text"        - plain VARCHAR, string operators
//   "numeric_text"- VARCHAR that holds a number (years, door count); needs CAST
//   "integer"     - a genuine INT column (id) - compared directly, no CAST/REGEXP,
//                   so the DB can actually use its index (matters a lot on large tables)
//   "csv_list"    - VARCHAR holding a comma-separated list (manufacture_years)
//
// writable: whether "Update column" is allowed to target this column.

const NOAM_COLUMNS_CONFIG = {
  id: { column: "id", type: "integer", writable: false },
  parent_group: { column: "parent_group", type: "text", writable: true },
  item_group: { column: "item_group", type: "text", writable: true },
  child_group: { column: "child_group", type: "text", writable: true },
  catalog_number: { column: "catalog_number", type: "text", writable: false },
  manufacturer: { column: "manufacturer", type: "text", writable: true },
  model: { column: "model", type: "text", writable: true },
  capacity: { column: "capacity", type: "text", writable: true },
  from_year: { column: "from_year", type: "numeric_text", writable: true },
  until_year: { column: "until_year", type: "numeric_text", writable: true },
  year_limit: { column: "year_limit", type: "numeric_text", writable: true },
  car_note: { column: "car_note", type: "text", writable: true },
  description_note: { column: "description_note", type: "text", writable: true },
  note: { column: "note", type: "text", writable: true },
  engine_model: { column: "engine_model", type: "text", writable: true },
  manufacture_years: { column: "manufacture_years", type: "csv_list", writable: true },
  propulsion: { column: "propulsion", type: "text", writable: true },
  gear: { column: "gear", type: "text", writable: true },
  body: { column: "body", type: "text", writable: true },
  doors: { column: "doors", type: "numeric_text", writable: true },
  gas: { column: "gas", type: "text", writable: true },
};

const SELECT_COLUMNS = Object.keys(NOAM_COLUMNS_CONFIG);

// Columns a single row's own edit/insert may set - everything except the
// server-generated id. This is deliberately broader than `writable` above:
// `writable` gates the mass "update whole column" action (where catalog_number
// is excluded, since it never makes sense to bulk-set), but a single row's own
// catalog_number IS a normal, expected field to fill in when adding/editing that row.
const ROW_EDITABLE_COLUMNS = SELECT_COLUMNS.filter((key) => key !== "id");

module.exports = { NOAM_COLUMNS_CONFIG, SELECT_COLUMNS, ROW_EDITABLE_COLUMNS };
