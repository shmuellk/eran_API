const pool = require("../configs/connection_cars");
const logger = require("../logger.js");

const getAllManufacturer = async (req, res) => {
  try {
    logger.info("getAllManufacturer called");
    const [results] = await pool.query(
      "SELECT DISTINCT MANUFACTURER FROM cars ORDER BY MANUFACTURER ASC;"
    );
    logger.info("getAllManufacturer result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("AllManufacturer Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error AllManufacturer fetching data",
    });
  }
};

const getAllModel = async (req, res) => {
  try {
    const Manufacturer = req.query.Manufacturer;
    if (!Manufacturer) {
      logger.warn("getAllModel missing parameter Manufacturer");
      return res.status(400).json({
        status: "error",
        message: "Missing required parameter: Manufacturer",
      });
    }
    const safeManufacturer = Manufacturer.replace(/'/g, "''");

    logger.info("getAllModel called", { Manufacturer: safeManufacturer });
    const [results] = await pool.query(
      `SELECT DISTINCT model FROM cars WHERE manufacturer = '${safeManufacturer}' ORDER BY model ASC;`
    );
    logger.info("getAllModel result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("AllModel Error querying the database", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error AllModel fetching data",
    });
  }
};

const getAllmanufactureYear = async (req, res) => {
  const Manufacturer = req.query.MANUFACTURER;
  const Model = req.query.MODEL;

  const safeManufacturer = Manufacturer.replace(/'/g, "''");

  try {
    logger.info("getAllmanufactureYear called", {
      Manufacturer: safeManufacturer,
      Model,
    });
    const [results] = await pool.query(
      `SELECT DISTINCT 
            manufacture_year 
        FROM 
            cars
        WHERE
            manufacturer = '${safeManufacturer}'
            AND
            Model = "${Model}"
            ORDER BY manufacture_year ASC;`
    );
    logger.info("getAllmanufactureYear result", { result: results });
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("AllmanufactureYear Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error AllmanufactureYear fetching data",
    });
  }
};

const getAllEngineModel = async (req, res) => {
  const Manufacturer = req.query.MANUFACTURER;
  const Model = req.query.MODEL;
  const Manufacture_year = req.query.MANUFACTURE_YEAR;

  const safeManufacturer = Manufacturer.replace(/'/g, "''");

  try {
    logger.info("getAllEngineModel called", {
      Manufacturer: safeManufacturer,
      Model,
      Manufacture_year,
    });
    const [results] = await pool.query(
      `SELECT DISTINCT 
        engine_model 
    FROM 
        cars
    WHERE
        manufacturer = '${safeManufacturer}'
        AND
        model = "${Model}"
        AND
        manufacture_year ="${Manufacture_year}";`
    );
    logger.info("getAllEngineModel result", { result: results });
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("AllEngineModel Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error AllEngineModel fetching data",
    });
  }
};

const getAllCapacity = async (req, res) => {
  const Manufacturer = req.query.MANUFACTURER;
  const Model = req.query.MODEL;
  const Manufacture_year = req.query.MANUFACTURE_YEAR;
  const Engine_model = req.query.ENGINE_MODEL;

  const safeManufacturer = Manufacturer.replace(/'/g, "''");

  try {
    logger.info("getAllCapacity called", {
      Manufacturer: safeManufacturer,
      Model,
      Manufacture_year,
      Engine_model,
    });
    const [results] = await pool.query(
      `SELECT DISTINCT 
        Capacity 
    FROM 
        cars
    WHERE
        manufacturer = '${safeManufacturer}'
        AND
        model = "${Model}"
        AND
        manufacture_year = "${Manufacture_year}"
        AND
        engine_model = "${Engine_model}";`
    );
    logger.info("getAllCapacity result", { result: results });
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("AllCapacity Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error AllCapacity fetching data",
    });
  }
};

const getAllGas = async (req, res) => {
  const Manufacturer = req.query.MANUFACTURER;
  const Model = req.query.MODEL;
  const Manufacture_year = req.query.MANUFACTURE_YEAR;
  const Engine_model = req.query.ENGINE_MODEL;
  const Capacity = req.query.CAPACITY;

  const safeManufacturer = Manufacturer.replace(/'/g, "''");

  try {
    logger.info("getAllGas called", {
      Manufacturer: safeManufacturer,
      Model,
      Manufacture_year,
      Engine_model,
      Capacity,
    });
    const [results] = await pool.query(
      `SELECT DISTINCT 
        gas 
    FROM 
        cars
    WHERE
        manufacturer = '${safeManufacturer}'
        AND
        model = "${Model}"
        AND
        manufacture_year = "${Manufacture_year}"
        AND
        engine_model = "${Engine_model}"
        AND
        Capacity = "${Capacity}";`
    );
    logger.info("getAllGas result", { result: results });
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("AllGas Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error AllGas fetching data",
    });
  }
};

const getAllGear = async (req, res) => {
  const Manufacturer = req.query.MANUFACTURER;
  const Model = req.query.MODEL;
  const Manufacture_year = req.query.MANUFACTURE_YEAR;
  const Engine_model = req.query.ENGINE_MODEL;
  const Capacity = req.query.CAPACITY;
  const gas = req.query.GAS;

  const safeManufacturer = Manufacturer.replace(/'/g, "''");

  try {
    logger.info("getAllGear called", {
      Manufacturer: safeManufacturer,
      Model,
      Manufacture_year,
      Engine_model,
      Capacity,
      gas,
    });
    const [results] = await pool.query(
      `SELECT DISTINCT 
        gear 
    FROM 
        cars
    WHERE
        manufacturer = '${safeManufacturer}'
        AND
        model = "${Model}"
        AND
        manufacture_year = "${Manufacture_year}"
        AND
        engine_model = "${Engine_model}"
        AND
        Capacity = "${Capacity}"
        AND
        gas = "${gas}";`
    );
    logger.info("getAllGear result", { result: results });
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("AllGear Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error AllGear fetching data",
    });
  }
};

const getAllPropulsion = async (req, res) => {
  const Manufacturer = req.query.MANUFACTURER;
  const Model = req.query.MODEL;
  const Manufacture_year = req.query.MANUFACTURE_YEAR;
  const Engine_model = req.query.ENGINE_MODEL;
  const Capacity = req.query.CAPACITY;
  const gas = req.query.GAS;
  const gear = req.query.GEAR;

  const safeManufacturer = Manufacturer.replace(/'/g, "''");

  try {
    logger.info("getAllPropulsion called", {
      Manufacturer: safeManufacturer,
      Model,
      Manufacture_year,
      Engine_model,
      Capacity,
      gas,
      gear,
    });
    const [results] = await pool.query(
      `SELECT DISTINCT
        Propulsion
     FROM
         cars
     WHERE
         manufacturer = '${safeManufacturer}'
         AND
         model = "${Model}"
         AND
         manufacture_year = "${Manufacture_year}"
         AND
         engine_model = "${Engine_model}"
         AND         
         Capacity = "${Capacity}"      
         AND
         gas = "${gas}"
         AND
         gear = "${gear}";`
    );
    logger.info("getAllPropulsion result", { result: results });
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("AllPropulsion Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error AllPropulsion fetching data",
    });
  }
};

const getAllDoors = async (req, res) => {
  const Manufacturer = req.query.MANUFACTURER;
  const Model = req.query.MODEL;
  const Manufacture_year = req.query.MANUFACTURE_YEAR;
  const Engine_model = req.query.ENGINE_MODEL;
  const Capacity = req.query.CAPACITY;
  const gas = req.query.GAS;
  const gear = req.query.GEAR;
  const Propulsion = req.query.PROPULSION;
  const safeManufacturer = Manufacturer.replace(/'/g, "''");

  try {
    logger.info("getAllDoors called", {
      Manufacturer: safeManufacturer,
      Model,
      Manufacture_year,
      Engine_model,
      Capacity,
      gas,
      gear,
      Propulsion,
    });
    const [results] = await pool.query(
      `SELECT DISTINCT 
         doors
    FROM 
        cars
    WHERE
        manufacturer = '${safeManufacturer}'
        AND
        model = "${Model}"
        AND
        manufacture_year = "${Manufacture_year}"
        AND
        engine_model = "${Engine_model}"
        AND
        Capacity = "${Capacity}"
        AND
        gas = "${gas}"
        AND
        gear = "${gear}"
        AND
        propulsion = "${Propulsion}";`
    );
    logger.info("getAllDoors result", { result: results });
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("AllDoors Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error AllDoors fetching data",
    });
  }
};

const getAllBooy = async (req, res) => {
  const Manufacturer = req.query.MANUFACTURER;
  const Model = req.query.MODEL;
  const Manufacture_year = req.query.MANUFACTURE_YEAR;
  const Engine_model = req.query.ENGINE_MODEL;
  const Capacity = req.query.CAPACITY;
  const gas = req.query.GAS;
  const gear = req.query.GEAR;
  const Propulsion = req.query.PROPULSION;
  const doors = req.query.DOORS;

  const safeManufacturer = Manufacturer.replace(/'/g, "''");

  try {
    logger.info("getAllBooy called", {
      Manufacturer: safeManufacturer,
      Model,
      Manufacture_year,
      Engine_model,
      Capacity,
      gas,
      gear,
      Propulsion,
      doors,
    });
    const [results] = await pool.query(
      `SELECT DISTINCT 
         body
    FROM 
        cars
    WHERE
        manufacturer = '${safeManufacturer}'
        AND
        model = "${Model}"
        AND
        manufacture_year = "${Manufacture_year}"
        AND
        engine_model = "${Engine_model}"
        AND
        Capacity = "${Capacity}"
        AND
        gas = "${gas}"
        AND
        gear = "${gear}"
        AND
        propulsion = "${Propulsion}"
        AND
        doors = "${doors}";`
    );
    logger.info("getAllBooy result", { result: results });
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("AllBooy Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error AllBooy fetching data",
    });
  }
};

const getAlternativeSKU = async (req, res) => {
  // const SKU = req.body.SKU;
  const SKU = req.query.SKU;
  if (!SKU) {
    logger.warn("getAlternativeSKU missing SKU parameter");
    return res.status(400).json({
      status: "error",
      message: "Missing required parameter: SKU",
    });
  }
  const safeSKU = SKU.replace(/'/g, "''");

  try {
    logger.info("getAlternativeSKU called", { SKU: safeSKU });
    const [results] = await pool.query(
      `SELECT DISTINCT 
            cards.ALTERNATIVE_SKUS AS result_value 
        FROM 
            cards
        WHERE
         LOWER(cards.ALTERNATIVE_SKUS) LIKE CONCAT('%', LOWER('${safeSKU}'),'%')
         AND 
         cards.site_display = "זמין לגולשים"
         GROUP BY  
        result_value
        limit 150
        ;`
    );
    logger.info("getAlternativeSKU result", { result: results });
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("AlternativeSKU Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error AlternativeSKU fetching data",
    });
  }
};

const getComplitSerch = async (req, res) => {
  const search_value = req.query.search_value;
  if (!search_value) {
    logger.warn("getComplitSerch missing search_value parameter");
    return res.status(400).json({
      status: "error",
      message: "Missing required parameter: search_value",
    });
  }
  const safesearch_value = search_value.replace(/'/g, "''");

  try {
    logger.info("getComplitSerch called", { search_value: safesearch_value });
    const [results] = await pool.query(
      `SELECT DISTINCT 
    child_group_search.site_search AS result_value  
FROM child_group_search
WHERE 
    child_group_search.site_search LIKE CONCAT('%', '${safesearch_value}', '%');`
    );
    logger.info("getComplitSerch result", { result: results });
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getComplitSerch Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error AlternativeSKU fetching data",
    });
  }
};

const getAllDeliverys = async (req, res) => {
  try {
    logger.info("getAllDeliverys called");
    const [results] = await pool.query(`
      SELECT DISTINCT
       shipping_type
      FROM
       shipping
    `);
    logger.info("getAllDeliverys result", { result: results });
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getAllDeliverys Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error AlternativeSKU fetching data",
    });
  }
};

const getShippingExitTime = async (req, res) => {
  const search_value = req.query.search_value;
  if (!search_value) {
    logger.warn("getShippingExitTime missing search_value parameter");
    return res.status(400).json({
      status: "error",
      message: "Missing required parameter: search_value",
    });
  }
  const safesearch_value = search_value.replace(/'/g, "''");

  try {
    logger.info("getShippingExitTime called", {
      search_value: safesearch_value,
    });
    const [results] = await pool.query(`
      SELECT 
        CASE 
          WHEN DAYOFWEEK(final_date) = 6 
               AND next_time > '12:00:00'
          THEN DATE_FORMAT(STR_TO_DATE(SUBSTRING_INDEX(schedule, ',', 1), '%H:%i'), '%H:%i')
          ELSE DATE_FORMAT(next_time, '%H:%i')
        END AS next_time,
        DATE_FORMAT(
          CASE 
            WHEN DAYOFWEEK(final_date) = 6 
                 AND next_time > '12:00:00'
            THEN DATE_ADD(final_date, INTERVAL 2 DAY)
            ELSE final_date
          END, '%d/%m/%Y'
        ) AS schedule_date
      FROM (
          SELECT 
              s.shipping_type,
              s.schedule,
              STR_TO_DATE(
                  SUBSTRING_INDEX(SUBSTRING_INDEX(s.schedule, ',', n.n), ',', -1),
                  '%H:%i'
              ) AS next_time,
              CASE 
                  WHEN STR_TO_DATE(
                           SUBSTRING_INDEX(SUBSTRING_INDEX(s.schedule, ',', n.n), ',', -1),
                           '%H:%i'
                       ) > CURTIME() THEN CURDATE()
                  ELSE DATE_ADD(CURDATE(), INTERVAL 1 DAY)
              END AS candidate_date,
              IF(
                  DAYOFWEEK(
                      CASE 
                          WHEN STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(s.schedule, ',', n.n), ',', -1), '%H:%i') > CURTIME()
                          THEN CURDATE()
                          ELSE DATE_ADD(CURDATE(), INTERVAL 1 DAY)
                      END
                  ) = 7,
                  DATE_ADD(
                      CASE 
                          WHEN STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(s.schedule, ',', n.n), ',', -1), '%H:%i') > CURTIME()
                          THEN CURDATE()
                          ELSE DATE_ADD(CURDATE(), INTERVAL 1 DAY)
                      END,
                      INTERVAL 1 DAY
                  ),
                  CASE 
                      WHEN STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(s.schedule, ',', n.n), ',', -1), '%H:%i') > CURTIME()
                      THEN CURDATE()
                      ELSE DATE_ADD(CURDATE(), INTERVAL 1 DAY)
                  END
              ) AS final_date
          FROM shipping s
          JOIN (
              SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
              UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
          ) n ON 1 = 1
          WHERE s.shipping_type = '${safesearch_value}'
            AND STR_TO_DATE(
                  SUBSTRING_INDEX(SUBSTRING_INDEX(s.schedule, ',', n.n), ',', -1),
                  '%H:%i'
                ) IS NOT NULL
          ORDER BY 
              (STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(s.schedule, ',', n.n), ',', -1), '%H:%i') <= CURTIME()),
              STR_TO_DATE(SUBSTRING_INDEX(SUBSTRING_INDEX(s.schedule, ',', n.n), ',', -1), '%H:%i')
          LIMIT 1
      ) base;
    `);
    logger.info("getShippingExitTime result", { result: results });
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getShippingExitTime Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error AlternativeSKU fetching data",
    });
  }
};

module.exports = {
  getAllManufacturer,
  getAllModel,
  getAllmanufactureYear,
  getAllEngineModel,
  getAllCapacity,
  getAllGas,
  getAllGear,
  getAllPropulsion,
  getAllDoors,
  getAllBooy,
  getAlternativeSKU,
  getComplitSerch,
  getAllDeliverys,
  getShippingExitTime,
};
