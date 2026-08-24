const pool = require("../configs/connection_cars");
const logger = require("../logger.js");

const PAGE_SIZE = 500;

const NOAM_COLUMNS = `
  id,
  parent_group,
  item_group,
  child_group,
  catalog_number,
  manufacturer,
  model,
  capacity,
  from_year,
  until_year,
  year_limit,
  car_note,
  description_note,
  note,
  engine_model,
  manufacture_years,
  propulsion,
  gear,
  body,
  doors,
  gas
`;

const getNoamList = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.PAGE, 10) || 1, 1);
    const offset = (page - 1) * PAGE_SIZE;

    logger.info("getNoamList called", { page, offset, limit: PAGE_SIZE });

    const [rows] = await pool.query(
      `SELECT ${NOAM_COLUMNS} FROM noam ORDER BY id LIMIT ? OFFSET ?;`,
      [PAGE_SIZE, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM noam;`);

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

module.exports = {
  getNoamList,
};
