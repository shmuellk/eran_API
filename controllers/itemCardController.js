const pool = require("../configs/connection_cars");
const logger = require("../logger.js");

const getItemBrand = async (req, res) => {
  try {
    const CATALOG_NUMBER = req.query.CATALOG_NUMBER;
    const CHILD_GROUP = req.query.CHILD_GROUP;
    const DESCRIPTION_NOTE = req.query.DESCRIPTION_NOTE;

    if (!CATALOG_NUMBER) {
      logger.warn("getItemBrand missing required parameter: CATALOG_NUMBER", {
        CATALOG_NUMBER,
      });
      return res.status(400).json({
        status: "error",
        message: "Missing required query parameters",
      });
    }

    logger.info("getItemBrand called", {
      CATALOG_NUMBER,
      CHILD_GROUP,
      DESCRIPTION_NOTE,
    });

    const query = `
      SELECT DISTINCT
        cards.sku_code,
        noam.catalog_number,
        cards.gross_price,
        cards.net_price,
        cards.garage9_price,
        cards.brand,
        cards.quantity,
        cards.size,
        cards.teeth,
        cards.delivery_date
      FROM noam
      JOIN cards ON noam.catalog_number = cards.catalog_number
      WHERE 
        (
          FIND_IN_SET(?, REPLACE(cards.alternative_skus, ',', ',')) 
          OR cards.catalog_number = ?
        )
        AND noam.child_group = ?
        AND noam.description_note = ?
        AND cards.site_display = "זמין לגולשים";
    `;

    const [results] = await pool.query(query, [
      CATALOG_NUMBER,
      CATALOG_NUMBER,
      CHILD_GROUP,
      DESCRIPTION_NOTE,
    ]);
    logger.info("getItemBrand result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getItemBrand Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error fetching ItemBrand data",
    });
  }
};

const getCarsByItem = async (req, res) => {
  try {
    const { CATALOG_NUMBER } = req.query;
    if (!CATALOG_NUMBER) {
      logger.warn("getCarsByItem missing required parameter: CATALOG_NUMBER", {
        CATALOG_NUMBER,
      });
      return res.status(400).json({
        status: "error",
        message: "Missing required query parameter: CATALOG_NUMBER",
      });
    }
    logger.info("getCarsByItem called", { CATALOG_NUMBER });

    const query = `
      SELECT 
        model,
        from_year,
        until_year,
        capacity
      FROM 
        noam 
      WHERE 
        catalog_number = ?;
    `;

    const [results] = await pool.query(query, [CATALOG_NUMBER]);
    logger.info("getCarsByItem result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getCarsByItem Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error fetching CarsByItem data",
    });
  }
};

const getAlternativeSkus = async (req, res) => {
  try {
    const { CATALOG_NUMBER } = req.query;
    if (!CATALOG_NUMBER) {
      logger.warn(
        "getAlternativeSkus missing required parameter: CATALOG_NUMBER",
        { CATALOG_NUMBER }
      );
      return res.status(400).json({
        status: "error",
        message: "Missing required query parameter: CATALOG_NUMBER",
      });
    }
    logger.info("getAlternativeSkus called", { CATALOG_NUMBER });

    const query = `
      SELECT alternative_skus
      FROM cards 
      WHERE catalog_number = ?;
    `;

    const [results] = await pool.query(query, [CATALOG_NUMBER]);
    logger.info("getAlternativeSkus result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getAlternativeSkus Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error fetching AlternativeSkus data",
    });
  }
};

const getItemBrandByCar = async (req, res) => {
  const {
    PARENT_GROUP,
    ITEM_GROUP,
    CHILD_GROUP,
    MANUFACTURER,
    MODEL,
    CAPACITY,
    FROM_YEAR,
    UNTIL_YEAR,
    YEAR_LIMIT,
    CAR_NOTE,
    DESCRIPTION_NOTE,
  } = req.query;

  try {
    logger.info("getItemBrandByCar called", {
      PARENT_GROUP,
      ITEM_GROUP,
      CHILD_GROUP,
      MANUFACTURER,
      MODEL,
      CAPACITY,
      FROM_YEAR,
      UNTIL_YEAR,
      YEAR_LIMIT,
      CAR_NOTE,
      DESCRIPTION_NOTE,
    });

    const query = `
      SELECT DISTINCT
          noam.catalog_number,
          cards.gross_price,
          cards.net_price,
          cards.garage9_price,
          cards.brand,
          cards.quantity,  
          cards.size,
          cards.teeth,
          cards.sku_code,
          cards.delivery_date
      FROM noam
      JOIN cards ON noam.catalog_number = cards.catalog_number 
      WHERE 
          noam.parent_group = ?
          AND noam.item_group = ?
          AND noam.child_group = ?
          AND noam.manufacturer = ?
          AND noam.model = ?
          AND noam.capacity = ?
          AND noam.from_year = ?
          AND noam.until_year = ?
          AND noam.year_limit = ?
          AND noam.car_note = ?
          AND noam.description_note = ?
          AND cards.site_display = "זמין לגולשים";
    `;

    const values = [
      PARENT_GROUP,
      ITEM_GROUP,
      CHILD_GROUP,
      MANUFACTURER,
      MODEL,
      CAPACITY,
      FROM_YEAR,
      UNTIL_YEAR,
      YEAR_LIMIT,
      CAR_NOTE,
      DESCRIPTION_NOTE,
    ];

    const [results] = await pool.query(query, values);
    logger.info("getItemBrandByCar result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getItemBrandByCar Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error ItemBrand fetching data",
    });
  }
};

module.exports = {
  getItemBrand,
  getCarsByItem,
  getAlternativeSkus,
  getItemBrandByCar,
};
