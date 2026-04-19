const pool = require("../configs/connection_cars");
const logger = require("../logger.js");

const getCarDataByNumber = async (req, res) => {
  try {
    const { CARNUMBER } = req.query;
    logger.info("getCarDataByNumber called", { CARNUMBER });

    if (!CARNUMBER) {
      logger.warn("getCarDataByNumber missing CARNUMBER parameter");
      return res.status(400).json({
        status: "error",
        message: "Missing required query parameter: CARNUMBER",
      });
    }

    const query = `
      SELECT 
        MANUFACTURER, 
        MODEL, 
        MANUFACTURE_YEAR, 
        ENGINE_MODEL, 
        CAPACITY, 
        GAS, 
        GEAR, 
        PROPULSION, 
        DOORS, 
        BODY,
        YEAR_LIMIT,
        MODEL_CODE
      FROM cars  
      WHERE license_number = ?;
    `;
    const [results] = await pool.query(query, [CARNUMBER]);
    logger.info("getCarDataByNumber result", { result: results });

    res.status(200).json({
      status: "success",
      result: results.length > 0 ? results[0] : null,
    });
  } catch (err) {
    logger.error("getCarDataByNumber Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error fetching CarDataByNumber",
    });
  }
};

const getProdactsByCar = async (req, res) => {
  try {
    const { U_TYPE } = req.query;
    const rowLimit = U_TYPE === 'מנהל' ? 50 : 20;
    console.log("[DEBUG] getProdactsByCar U_TYPE:", JSON.stringify(U_TYPE), "rowLimit:", rowLimit);
    const {
      MANUFACTURER,
      MODEL,
      MANUFACTURE_YEAR,
      YEAR_LIMIT,
      GEAR,
      BODY,
      DOORS,
      ENGINE_MODEL,
      PROPULSION,
      NOTE,
      PAGE = 1,
      LIMIT = rowLimit,
    } = req.query;

    logger.info("getProdactsByCar called", {
      MANUFACTURER,
      MODEL,
      MANUFACTURE_YEAR,
      YEAR_LIMIT,
      GEAR,
      BODY,
      DOORS,
      ENGINE_MODEL,
      PROPULSION,
      NOTE,
      PAGE,
      LIMIT,
    });

    if (!MANUFACTURER) {
      logger.warn("getProdactsByCar missing MANUFACTURER parameter");
      return res.status(400).json({
        status: "error",
        message: "Missing required query parameter: MANUFACTURER",
      });
    }

    const offset = (parseInt(PAGE) - 1) * parseInt(LIMIT);
    const query = `
      SELECT 
        noam.MANUFACTURER,
        noam.MODEL,
        noam.PARENT_GROUP,
        noam.ITEM_GROUP,
        noam.CHILD_GROUP,
        noam.DESCRIPTION_NOTE,
        noam.FROM_YEAR,
        noam.UNTIL_YEAR,
        noam.CAPACITY,
        noam.CAR_NOTE,
        noam.YEAR_LIMIT,
        cards.IMAGE,
        cards.sku_code,
        cards.delivery_date
      FROM noam
      JOIN cards 
        ON noam.catalog_number = cards.catalog_number
      WHERE 
        noam.manufacturer = ?
        AND (? = '' OR noam.model = ?)
        AND (? = '' OR FIND_IN_SET(?, noam.manufacture_years) OR noam.manufacture_years = '')
        AND (? = '' OR FIND_IN_SET(?, noam.engine_model) OR noam.engine_model = '')
        AND (? = '' OR noam.gear = ? OR noam.gear = '')
        AND (? = '' OR noam.propulsion = ? OR noam.propulsion = '')
        AND (? = '' OR noam.doors = ? OR noam.doors = '')
        AND (? = '' OR noam.body = ? OR noam.body = '')
        AND (? = '' OR FIND_IN_SET(?, noam.year_limit) OR noam.year_limit = '')
        AND (? = '' OR noam.car_note = ? OR noam.car_note = '')
        AND cards.site_display = "זמין לגולשים"
      GROUP BY
        noam.MANUFACTURER,
        noam.MODEL,
        noam.PARENT_GROUP,
        noam.ITEM_GROUP,
        noam.CHILD_GROUP,
        noam.DESCRIPTION_NOTE,
        noam.FROM_YEAR,
        noam.UNTIL_YEAR,
        noam.CAR_NOTE,
        noam.YEAR_LIMIT
      ORDER BY 
        noam.CHILD_GROUP
      LIMIT ? OFFSET ?;
    `;
    const [results] = await pool.query(query, [
      MANUFACTURER,
      MODEL,
      MODEL,
      MANUFACTURE_YEAR,
      MANUFACTURE_YEAR,
      ENGINE_MODEL,
      ENGINE_MODEL,
      GEAR,
      GEAR,
      PROPULSION,
      PROPULSION,
      DOORS,
      DOORS,
      BODY,
      BODY,
      YEAR_LIMIT,
      YEAR_LIMIT,
      NOTE,
      NOTE,
      parseInt(LIMIT),
      parseInt(offset),
    ]);
    logger.info("getProdactsByCar result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getProdactsByCar Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error fetching ProdactsByCar data",
    });
  }
};

const getCategorisByCar = async (req, res) => {
  try {
    const {
      MANUFACTURER,
      MODEL,
      MANUFACTURE_YEAR,
      YEAR_LIMIT,
      GEAR,
      BODY,
      DOORS,
      ENGINE_MODEL,
      PROPULSION,
      NOTE,
    } = req.query;
    logger.info("getCategorisByCar called", {
      MANUFACTURER,
      MODEL,
      MANUFACTURE_YEAR,
      YEAR_LIMIT,
      GEAR,
      BODY,
      DOORS,
      ENGINE_MODEL,
      PROPULSION,
      NOTE,
    });

    const query = `
    SELECT DISTINCT
        noam.PARENT_GROUP,
        noam.ITEM_GROUP,
        noam.CHILD_GROUP
    FROM noam
    JOIN cards ON noam.catalog_number = cards.catalog_number 
    WHERE 
        noam.manufacturer = ?
        AND (? = "" OR noam.model = ?)
        AND (? = "" 
            OR CONCAT(",", noam.manufacture_years, ",") LIKE CONCAT("%,", ?, ",%")
            OR noam.manufacture_years = "")
        AND (? = "" 
            OR noam.engine_model = ?
            OR noam.engine_model LIKE CONCAT("%,", ?, ",%")
            OR noam.engine_model LIKE CONCAT(?, ",%")
            OR noam.engine_model LIKE CONCAT("%,", ?)
            OR noam.engine_model = "")
        AND (? = "" OR noam.gear = ? OR noam.gear = "")
        AND (? = "" OR noam.propulsion = ? OR noam.propulsion = "")
        AND (? = "" OR noam.doors = ? OR noam.doors = "")
        AND (? = "" OR noam.body = ? OR noam.body = "")
        AND (? = "" 
            OR noam.year_limit = ?
            OR noam.year_limit LIKE CONCAT("%,", ?, ",%")
            OR noam.year_limit LIKE CONCAT(?, ",%")
            OR noam.year_limit LIKE CONCAT("%,", ?)
            OR noam.year_limit = "")
        AND (? = "" OR noam.car_note = ? OR noam.car_note = "")
        AND cards.site_display = "זמין לגולשים";
    `;
    const values = [
      MANUFACTURER,
      MODEL,
      MODEL,
      MANUFACTURE_YEAR,
      MANUFACTURE_YEAR,
      ENGINE_MODEL,
      ENGINE_MODEL,
      ENGINE_MODEL,
      ENGINE_MODEL,
      ENGINE_MODEL,
      GEAR,
      GEAR,
      PROPULSION,
      PROPULSION,
      DOORS,
      DOORS,
      BODY,
      BODY,
      YEAR_LIMIT,
      YEAR_LIMIT,
      YEAR_LIMIT,
      YEAR_LIMIT,
      YEAR_LIMIT,
      NOTE,
      NOTE,
    ];
    const [results] = await pool.query(query, values);
    logger.info("getCategorisByCar result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getCategorisByCar Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error CategorisByCar fetching data",
    });
  }
};

const getProdactsById = async (req, res) => {
  try {
    const CATALOG_NUMBER = req.query.CATALOG_NUMBER;
    logger.info("getProdactsById called", { CATALOG_NUMBER });

    const [results] = await pool.query(
      `SELECT distinct
        noam.CATALOG_NUMBER,
        noam.CHILD_GROUP, 
        noam.DESCRIPTION_NOTE,
        noam.MODEL, 
        noam.FROM_YEAR, 
        noam.UNTIL_YEAR, 
        noam.CAPACITY, 
        noam.CAR_NOTE,
        noam.MANUFACTURER,
        cards.IMAGE,
        cards.quantity,
        cards.brand,
        cards.sku_code,
        cards.delivery_date
      FROM 
        noam  
      JOIN 
        cards ON noam.CATALOG_NUMBER = cards.CATALOG_NUMBER 
      WHERE
        cards.site_display = "זמין לגולשים"
      AND (
        cards.alternative_skus  LIKE CONCAT("%,", ?, ",%")
        OR cards.alternative_skus  LIKE CONCAT(?, ",%")
        OR cards.alternative_skus  LIKE CONCAT("%,", ?)
        OR cards.alternative_skus  = ?
      )
      GROUP BY  
        noam.child_group, 
        noam.description_note;`,
      [CATALOG_NUMBER, CATALOG_NUMBER, CATALOG_NUMBER, CATALOG_NUMBER]
    );
    logger.info("getProdactsById result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getProdactsById Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error ProdactsById fetching data",
    });
  }
};

const getProdactsByPARENT_GROUP = async (req, res) => {
  try {
    const {
      MANUFACTURER,
      MODEL,
      MANUFACTURE_YEAR,
      YEAR_LIMIT,
      GEAR,
      BODY,
      DOORS,
      ENGINE_MODEL,
      PROPULSION,
      NOTE,
      PARENT_GROUP,
      U_TYPE,
    } = req.query;
    const rowLimit = U_TYPE === 'מנהל' ? 50 : 20;
    console.log("[DEBUG] getProdactsByPARENT_GROUP U_TYPE:", JSON.stringify(U_TYPE), "rowLimit:", rowLimit);
    logger.info("getProdactsByPARENT_GROUP called", {
      MANUFACTURER,
      MODEL,
      MANUFACTURE_YEAR,
      YEAR_LIMIT,
      GEAR,
      BODY,
      DOORS,
      ENGINE_MODEL,
      PROPULSION,
      NOTE,
      PARENT_GROUP,
    });

    const [results] = await pool.query(`
SELECT 
    noam.MANUFACTURER,
    noam.MODEL,
    noam.PARENT_GROUP,
    noam.ITEM_GROUP,
    noam.CHILD_GROUP,
    noam.DESCRIPTION_NOTE,
    noam.FROM_YEAR,
    noam.UNTIL_YEAR,
    noam.CAPACITY,
    noam.CAR_NOTE,
    noam.YEAR_LIMIT,
    cards.IMAGE,
    cards.sku_code,
    cards.delivery_date
FROM noam
JOIN cards 
    ON noam.catalog_number = cards.catalog_number
WHERE 
    noam.manufacturer = "${MANUFACTURER}"
    AND (
        "${MODEL}" = "" 
        OR noam.model = "${MODEL}"
    )
    AND (
        "${MANUFACTURE_YEAR}" = "" 
        OR CONCAT(',', noam.manufacture_years, ',')
           LIKE CONCAT('%,', "${MANUFACTURE_YEAR}", ',%')
        OR noam.manufacture_years = ""
    )
    AND (
       "${ENGINE_MODEL}" = "" 
        OR noam.engine_model = "${ENGINE_MODEL}"
        OR noam.engine_model LIKE CONCAT('%,', "${ENGINE_MODEL}", ',%')
        OR noam.engine_model LIKE CONCAT("${ENGINE_MODEL}", ',%')
        OR noam.engine_model LIKE CONCAT('%,', "${ENGINE_MODEL}")
        OR noam.engine_model = ""
    )
    AND (
        "${GEAR}" = "" 
        OR noam.gear = "${GEAR}"
        OR noam.gear = ""
    )
    AND (
        "${PROPULSION}" = "" 
        OR noam.propulsion = "${PROPULSION}"
        OR noam.propulsion = ""
    )
    AND (
        "${DOORS}" = "" 
        OR noam.doors = "${DOORS}"
        OR noam.doors = ""
    )
    AND (
        "${BODY}" = "" 
        OR noam.body = "${BODY}"
        OR noam.body = ""
    )
    AND (
       "${YEAR_LIMIT}" = "" 
        OR noam.year_limit = "${YEAR_LIMIT}"
        OR noam.year_limit LIKE CONCAT('%,', "${YEAR_LIMIT}", ',%')
        OR noam.year_limit LIKE CONCAT("${YEAR_LIMIT}", ',%')
        OR noam.year_limit LIKE CONCAT('%,', "${YEAR_LIMIT}")
        OR noam.year_limit = ""
    )
    AND (
        "${NOTE}" = "" 
        OR noam.car_note = "${NOTE}"
        OR noam.car_note = ""
    )
    AND cards.site_display = "זמין לגולשים"
    AND noam.PARENT_GROUP = "${PARENT_GROUP}"
GROUP BY
    noam.MANUFACTURER,
    noam.MODEL,
    noam.PARENT_GROUP,
    noam.ITEM_GROUP,
    noam.CHILD_GROUP,
    noam.DESCRIPTION_NOTE,
    noam.FROM_YEAR,
    noam.UNTIL_YEAR,
    noam.CAR_NOTE,
    noam.YEAR_LIMIT
ORDER BY
    noam.CHILD_GROUP
LIMIT ${rowLimit};
`);
    logger.info("getProdactsByPARENT_GROUP result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getProdactsByPARENT_GROUP Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error ProdactsByPARENT_GROUP fetching data",
    });
  }
};

const getProdactsByITEM_GROUP = async (req, res) => {
  try {
    const {
      MANUFACTURER,
      MODEL,
      MANUFACTURE_YEAR,
      YEAR_LIMIT,
      GEAR,
      BODY,
      DOORS,
      ENGINE_MODEL,
      PROPULSION,
      NOTE,
      PARENT_GROUP,
      ITEM_GROUP,
      U_TYPE,
    } = req.query;
    const rowLimit = U_TYPE === 'מנהל' ? 50 : 20;
    logger.info("getProdactsByITEM_GROUP called", {
      MANUFACTURER,
      MODEL,
      MANUFACTURE_YEAR,
      YEAR_LIMIT,
      GEAR,
      BODY,
      DOORS,
      ENGINE_MODEL,
      PROPULSION,
      NOTE,
      PARENT_GROUP,
      ITEM_GROUP,
    });

    const [results] = await pool.query(`
SELECT 
    noam.MANUFACTURER,
    noam.MODEL,
    noam.PARENT_GROUP,
    noam.ITEM_GROUP,
    noam.CHILD_GROUP,
    noam.DESCRIPTION_NOTE,
    noam.FROM_YEAR,
    noam.UNTIL_YEAR,
    noam.CAPACITY,
    noam.CAR_NOTE,
    noam.YEAR_LIMIT,
    cards.IMAGE,
    cards.sku_code,
    cards.delivery_date
FROM noam
JOIN cards 
    ON noam.catalog_number = cards.catalog_number
WHERE 
    noam.manufacturer = "${MANUFACTURER}"
    AND (
        "${MODEL}" = "" 
        OR noam.model = "${MODEL}"
    )
    AND (
        "${MANUFACTURE_YEAR}" = "" 
        OR CONCAT(',', noam.manufacture_years, ',')
           LIKE CONCAT('%,', "${MANUFACTURE_YEAR}", ',%')
        OR noam.manufacture_years = ""
    )
    AND (
       "${ENGINE_MODEL}" = "" 
        OR noam.engine_model = "${ENGINE_MODEL}"
        OR noam.engine_model LIKE CONCAT('%,', "${ENGINE_MODEL}", ',%')
        OR noam.engine_model LIKE CONCAT("${ENGINE_MODEL}", ',%')
        OR noam.engine_model LIKE CONCAT('%,', "${ENGINE_MODEL}")
        OR noam.engine_model = ""
    )
    AND (
        "${GEAR}" = "" 
        OR noam.gear = "${GEAR}"
        OR noam.gear = ""
    )
    AND (
        "${PROPULSION}" = "" 
        OR noam.propulsion = "${PROPULSION}"
        OR noam.propulsion = ""
    )
    AND (
        "${DOORS}" = "" 
        OR noam.doors = "${DOORS}"
        OR noam.doors = ""
    )
    AND (
        "${BODY}" = "" 
        OR noam.body = "${BODY}"
        OR noam.body = ""
    )
    AND (
       "${YEAR_LIMIT}" = "" 
        OR noam.year_limit = "${YEAR_LIMIT}"
        OR noam.year_limit LIKE CONCAT('%,', "${YEAR_LIMIT}", ',%')
        OR noam.year_limit LIKE CONCAT("${YEAR_LIMIT}", ',%')
        OR noam.year_limit LIKE CONCAT('%,', "${YEAR_LIMIT}")
        OR noam.year_limit = ""
    )
    AND (
        "${NOTE}" = "" 
        OR noam.car_note = "${NOTE}"
        OR noam.car_note = ""
    )
    AND cards.site_display = "זמין לגולשים"
    AND noam.PARENT_GROUP = "${PARENT_GROUP}"
    AND noam.ITEM_GROUP   = "${ITEM_GROUP}"
GROUP BY
    noam.MANUFACTURER,
    noam.MODEL,
    noam.PARENT_GROUP,
    noam.ITEM_GROUP,
    noam.CHILD_GROUP,
    noam.DESCRIPTION_NOTE,
    noam.FROM_YEAR,
    noam.UNTIL_YEAR,
    noam.CAR_NOTE,
    noam.YEAR_LIMIT
ORDER BY
    noam.CHILD_GROUP
LIMIT ${rowLimit};
`);
    logger.info("getProdactsByITEM_GROUP result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getProdactsByITEM_GROUP Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error ProdactsByITEM_GROUP fetching data",
    });
  }
};

const getProdactsByCHILD_GROUP = async (req, res) => {
  try {
    const {
      MANUFACTURER,
      MODEL,
      MANUFACTURE_YEAR,
      YEAR_LIMIT,
      GEAR,
      BODY,
      DOORS,
      ENGINE_MODEL,
      PROPULSION,
      NOTE,
      PARENT_GROUP,
      ITEM_GROUP,
      CHILD_GROUP,
      U_TYPE,
    } = req.query;
    const rowLimit = U_TYPE === 'מנהל' ? 50 : 20;
    logger.info("getProdactsByCHILD_GROUP called", {
      MANUFACTURER,
      MODEL,
      MANUFACTURE_YEAR,
      YEAR_LIMIT,
      GEAR,
      BODY,
      DOORS,
      ENGINE_MODEL,
      PROPULSION,
      NOTE,
      PARENT_GROUP,
      ITEM_GROUP,
      CHILD_GROUP,
    });

    const [results] = await pool.query(`
SELECT 
    noam.MANUFACTURER,
    noam.MODEL,
    noam.PARENT_GROUP,
    noam.ITEM_GROUP,
    noam.CHILD_GROUP,
    noam.DESCRIPTION_NOTE,
    noam.FROM_YEAR,
    noam.UNTIL_YEAR,
    noam.CAPACITY,
    noam.CAR_NOTE,
    noam.YEAR_LIMIT,
    cards.IMAGE,
    cards.sku_code,
    cards.delivery_date
FROM noam
JOIN cards 
    ON noam.catalog_number = cards.catalog_number
WHERE 
    noam.manufacturer = "${MANUFACTURER}"
    AND (
        "${MODEL}" = "" 
        OR noam.model = "${MODEL}"
    )
    AND (
        "${MANUFACTURE_YEAR}" = "" 
        OR CONCAT(',', noam.manufacture_years, ',')
           LIKE CONCAT('%,', "${MANUFACTURE_YEAR}", ',%')
        OR noam.manufacture_years = ""
    )
    AND (
       "${ENGINE_MODEL}" = "" 
        OR noam.engine_model = "${ENGINE_MODEL}"
        OR noam.engine_model LIKE CONCAT('%,', "${ENGINE_MODEL}", ',%')
        OR noam.engine_model LIKE CONCAT("${ENGINE_MODEL}", ',%')
        OR noam.engine_model LIKE CONCAT('%,', "${ENGINE_MODEL}")
        OR noam.engine_model = ""
    )
    AND (
        "${GEAR}" = "" 
        OR noam.gear = "${GEAR}"
        OR noam.gear = ""
    )
    AND (
        "${PROPULSION}" = "" 
        OR noam.propulsion = "${PROPULSION}"
        OR noam.propulsion = ""
    )
    AND (
        "${DOORS}" = "" 
        OR noam.doors = "${DOORS}"
        OR noam.doors = ""
    )
    AND (
        "${BODY}" = "" 
        OR noam.body = "${BODY}"
        OR noam.body = ""
    )
    AND (
       "${YEAR_LIMIT}" = "" 
        OR noam.year_limit = "${YEAR_LIMIT}"
        OR noam.year_limit LIKE CONCAT('%,', "${YEAR_LIMIT}", ',%')
        OR noam.year_limit LIKE CONCAT("${YEAR_LIMIT}", ',%')
        OR noam.year_limit LIKE CONCAT('%,', "${YEAR_LIMIT}")
        OR noam.year_limit = ""
    )
    AND (
        "${NOTE}" = "" 
        OR noam.car_note = "${NOTE}"
        OR noam.car_note = ""
    )
    AND cards.site_display = "זמין לגולשים"
    AND noam.PARENT_GROUP = "${PARENT_GROUP}"
    AND noam.ITEM_GROUP   = "${ITEM_GROUP}"
    AND noam.CHILD_GROUP  = "${CHILD_GROUP}"
GROUP BY
    noam.MANUFACTURER,
    noam.MODEL,
    noam.PARENT_GROUP,
    noam.ITEM_GROUP,
    noam.CHILD_GROUP,
    noam.DESCRIPTION_NOTE,
    noam.FROM_YEAR,
    noam.UNTIL_YEAR,
    noam.CAR_NOTE,
    noam.YEAR_LIMIT
ORDER BY
    noam.CHILD_GROUP
LIMIT ${rowLimit};
`);
    logger.info("getProdactsByCHILD_GROUP result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getProdactsByCHILD_GROUP Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error ProdactsByCHILD_GROUP fetching data",
    });
  }
};

const getInfoBySKU = async (req, res) => {
  try {
    const { CATALOG_NUMBER, CHILD_GROUP, DESCRIPTION_NOTE } = req.query;
    logger.info("getInfoBySKU called", {
      CATALOG_NUMBER,
      CHILD_GROUP,
      DESCRIPTION_NOTE,
    });

    const [results] = await pool.query(
      `SELECT DISTINCT
        noam.catalog_number,
        noam.child_group,
        cards.sku_code,
        noam.description_note,
        cards.brand,
        cards.net_price,
        cards.garage9_price,
        cards.gross_price,
	      cards.size,
	      cards.teeth,
        cards.image,
        cards.quantity,
        cards.sku_code
      FROM noam
      JOIN cards ON noam.catalog_number = cards.catalog_number
      WHERE 
        noam.catalog_number = ?
      AND 
        noam.child_group = ?
      AND
        noam.description_note = ?;`,
      [CATALOG_NUMBER, CHILD_GROUP, DESCRIPTION_NOTE]
    );
    logger.info("getInfoBySKU result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getInfoBySKU Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error InfoBySKU fetching data",
    });
  }
};

const getProdactsBySerch = async (req, res) => {
  try {
    // אם יש צורך ב-req.body יש לשנות בהתאם, כאן אנחנו משתמשים ב-body
    const { serchData } = req.body;
    logger.info("getProdactsBySerch called", { serchData });

    const [results] = await pool.query(
      `SELECT DISTINCT 
        child_group_search.site_search AS result_value
      FROM child_group_search
      WHERE 
        child_group_search.site_search LIKE CONCAT('%', ?, '%')
      LIMIT 10;`,
      [serchData]
    );
    logger.info("getProdactsBySerch result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getProdactsBySerch Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error getProdactsBySerch fetching data",
    });
  }
};

const getProdactsByCHILD_GROUPSerch = async (req, res) => {
  try {
    const {
      MANUFACTURER,
      MODEL,
      MANUFACTURE_YEAR,
      YEAR_LIMIT,
      GEAR,
      BODY,
      DOORS,
      ENGINE_MODEL,
      PROPULSION,
      NOTE,
      CHILD_GROUP,
      U_TYPE,
    } = req.query;
    const rowLimit = U_TYPE === 'מנהל' ? 50 : 20;
    logger.info("getProdactsByCHILD_GROUPSerch called", {
      MANUFACTURER,
      MODEL,
      MANUFACTURE_YEAR,
      YEAR_LIMIT,
      GEAR,
      BODY,
      DOORS,
      ENGINE_MODEL,
      PROPULSION,
      NOTE,
      CHILD_GROUP,
    });

    const query = `
    SELECT 
        noam.MANUFACTURER,
        noam.MODEL,
        noam.PARENT_GROUP,
        noam.ITEM_GROUP,
        noam.CHILD_GROUP,
        noam.DESCRIPTION_NOTE,
        noam.FROM_YEAR,
        noam.UNTIL_YEAR,
        noam.CAPACITY,
        noam.CAR_NOTE,
        noam.YEAR_LIMIT,
        cards.IMAGE,
        cards.sku_code,
        cards.delivery_date
    FROM noam
    JOIN cards 
        ON noam.catalog_number = cards.catalog_number
    WHERE 
        noam.manufacturer = ?
        AND (? = "" OR noam.model = ?)
        AND (? = "" 
            OR CONCAT(',', noam.manufacture_years, ',') LIKE CONCAT('%,', ?, ',%')
            OR noam.manufacture_years = "")
        AND (? = "" 
            OR noam.engine_model = ?
            OR noam.engine_model LIKE CONCAT('%,', ?, ',%')
            OR noam.engine_model LIKE CONCAT(?, ',%')
            OR noam.engine_model LIKE CONCAT('%,', ?)
            OR noam.engine_model = "")
        AND (? = "" OR noam.gear = ? OR noam.gear = "")
        AND (? = "" OR noam.propulsion = ? OR noam.propulsion = "")
        AND (? = "" OR noam.doors = ? OR noam.doors = "")
        AND (? = "" OR noam.body = ? OR noam.body = "")
        AND (? = "" 
            OR noam.year_limit = ?
            OR noam.year_limit LIKE CONCAT('%,', ?, ',%')
            OR noam.year_limit LIKE CONCAT(?, ',%')
            OR noam.year_limit LIKE CONCAT('%,', ?)
            OR noam.year_limit = "")
        AND (? = "" OR noam.car_note = ? OR noam.car_note = "")
        AND cards.site_display = "זמין לגולשים"
        AND (
            noam.CHILD_GROUP IN (
                SELECT DISTINCT child_group_search.child_group
                FROM child_group_search
                WHERE 
                    child_group_search.site_search LIKE CONCAT('%,', ?, ',%')
                    OR child_group_search.site_search LIKE CONCAT(?, ',%')
                    OR child_group_search.site_search LIKE CONCAT('%,', ?)
                    OR child_group_search.site_search = ?
            )
            OR ? = "" 
        )
    GROUP BY
        noam.MANUFACTURER,
        noam.MODEL,
        noam.PARENT_GROUP,
        noam.ITEM_GROUP,
        noam.CHILD_GROUP,
        noam.DESCRIPTION_NOTE,
        noam.FROM_YEAR,
        noam.UNTIL_YEAR,
        noam.CAR_NOTE,
        noam.YEAR_LIMIT
    ORDER BY
        noam.CHILD_GROUP
    LIMIT ?;
    `;
    const values = [
      MANUFACTURER,
      MODEL,
      MODEL,
      MANUFACTURE_YEAR,
      MANUFACTURE_YEAR,
      ENGINE_MODEL,
      ENGINE_MODEL,
      ENGINE_MODEL,
      ENGINE_MODEL,
      ENGINE_MODEL,
      GEAR,
      GEAR,
      PROPULSION,
      PROPULSION,
      DOORS,
      DOORS,
      BODY,
      BODY,
      YEAR_LIMIT,
      YEAR_LIMIT,
      YEAR_LIMIT,
      YEAR_LIMIT,
      YEAR_LIMIT,
      NOTE,
      NOTE,
      CHILD_GROUP,
      CHILD_GROUP,
      CHILD_GROUP,
      CHILD_GROUP,
      CHILD_GROUP,
      rowLimit,
    ];

    const [results] = await pool.query(query, values);
    logger.info("getProdactsByCHILD_GROUPSerch result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getProdactsByCHILD_GROUPSerch Database error", {
      error: err,
    });
    res.status(500).json({
      status: "error",
      message: "Error ProdactsByCHILD_GROUPSerch fetching data",
    });
  }
};

module.exports = {
  getCarDataByNumber,
  getProdactsByCar,
  getProdactsById,
  getCategorisByCar,
  getProdactsByPARENT_GROUP,
  getProdactsByITEM_GROUP,
  getProdactsByCHILD_GROUP,
  getInfoBySKU,
  getProdactsBySerch,
  getProdactsByCHILD_GROUPSerch,
};
