// "חיפוש באתר" admin tab: lists every row of child_group_search (the site search
// words, comma separated, per child_group). Read-only.
//
// The table's full schema isn't spelled out anywhere in this codebase, so the
// column list comes from the query result itself instead of being hardcoded.

const pool = require("../configs/connection_cars");
const logger = require("../logger.js");

const getChildGroupSearchList = async (req, res) => {
  try {
    const [rows, fields] = await pool.query("SELECT * FROM child_group_search ORDER BY child_group;");
    res.status(200).json({ columns: fields.map((f) => f.name), result: rows, total: rows.length });
  } catch (error) {
    logger.error("getChildGroupSearchList Database error", { error });
    res.status(500).json({ status: "error", message: "Error fetching child_group_search" });
  }
};

module.exports = { getChildGroupSearchList };
