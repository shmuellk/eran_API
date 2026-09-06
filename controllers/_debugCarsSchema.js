const pool = require("../configs/connection_cars");

const debugCarsSchema = async (req, res) => {
  try {
    const [columns] = await pool.query("SHOW COLUMNS FROM cars;");
    const [indexes] = await pool.query("SHOW INDEX FROM cars;");
    const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM cars;");
    const [sample] = await pool.query("SELECT * FROM cars LIMIT 3;");
    res.status(200).json({ status: "success", columns, indexes, total, sample });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

module.exports = { debugCarsSchema };
