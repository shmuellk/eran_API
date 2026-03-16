const pool = require("../configs/connection_cars");
const logger = require("../logger.js");

const getMessage = async (req, res) => {
  try {
    logger.info("getMessage called");

    const query = `SELECT MESSAGE FROM BENZI_WEB_BAR`;
    const [results] = await pool.query(query);

    logger.info("getMessage result", { result: results });

    res.status(200).json({
      status: "success",
      result: results.length > 0 ? results[0] : null,
    });
  } catch (err) {
    logger.error("getMessage Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error fetching bar message",
    });
  }
};

const updateMessage = async (req, res) => {
  try {
    const { message } = req.body;
    logger.info("updateMessage called", { message });

    if (message === undefined || message === null) {
      logger.warn("updateMessage missing message parameter");
      return res.status(400).json({
        status: "error",
        message: "Missing required parameter: message",
      });
    }

    const query = `UPDATE BENZI_WEB_BAR SET MESSAGE = ?`;
    const [results] = await pool.query(query, [message]);

    logger.info("updateMessage result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("updateMessage Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error updating bar message",
    });
  }
};

const barController = {
  getMessage,
  updateMessage,
};

module.exports = barController;
