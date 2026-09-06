// Single source of truth for which cars columns are filterable/sortable/updatable
// from the frontend, and how each one should be treated in SQL. Mirrors
// noamColumns.js exactly - see that file for the type/writable semantics.
//
// Real schema confirmed directly (id is the unique primary key; every other
// column is VARCHAR). Unlike noam, there is no CSV-list column here -
// manufacture_year holds a single year per row, not a comma-separated list.

const CARS_COLUMNS_CONFIG = {
  id: { column: "id", type: "integer", writable: false },
  model_code: { column: "model_code", type: "text", writable: false },
  manufacturer: { column: "manufacturer", type: "text", writable: true },
  model: { column: "model", type: "text", writable: true },
  engine_model: { column: "engine_model", type: "text", writable: true },
  capacity: { column: "capacity", type: "text", writable: true },
  capacity2: { column: "capacity2", type: "text", writable: true },
  gas: { column: "gas", type: "text", writable: true },
  manufacture_year: { column: "manufacture_year", type: "numeric_text", writable: true },
  year_limit: { column: "year_limit", type: "numeric_text", writable: true },
  license_number: { column: "license_number", type: "text", writable: false },
  frame: { column: "frame", type: "text", writable: true },
  propulsion: { column: "propulsion", type: "text", writable: true },
  gear: { column: "gear", type: "text", writable: true },
  body: { column: "body", type: "text", writable: true },
  finish: { column: "finish", type: "text", writable: true },
  doors: { column: "doors", type: "numeric_text", writable: true },
  horse_power: { column: "horse_power", type: "numeric_text", writable: true },
  seats: { column: "seats", type: "numeric_text", writable: true },
  product_code: { column: "product_code", type: "text", writable: false },
  model_code2: { column: "model_code2", type: "text", writable: false },
  car_model_code: { column: "car_model_code", type: "text", writable: false },
};

const SELECT_COLUMNS = Object.keys(CARS_COLUMNS_CONFIG);

// Columns a single row's own edit/insert may set - everything except the
// server-generated id (broader than `writable`, same reasoning as noam's
// ROW_EDITABLE_COLUMNS: identifier/code columns are fine to set per-row,
// just excluded from the mass "update whole column" action).
const ROW_EDITABLE_COLUMNS = SELECT_COLUMNS.filter((key) => key !== "id");

module.exports = { CARS_COLUMNS_CONFIG, SELECT_COLUMNS, ROW_EDITABLE_COLUMNS };
