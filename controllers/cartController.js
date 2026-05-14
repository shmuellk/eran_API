const pool = require("../configs/connection_cars");
const logger = require("../logger.js");
const axios = require("axios");

const checkVehicleNumberRequired = async (req, res) => {
  const { cardCode, userName } = req.query;
  if (!cardCode || !userName) {
    return res.status(400).json({ status: "error", message: "Missing cardCode or userName" });
  }
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM NOAM N
       INNER JOIN BENZI_APP_USERS_CART C ON C.ITEMCODE = N.CATALOG_NUMBER
       WHERE N.car_NOTE = 'לפי מספר רישוי בלבד'
         AND C.CARD_CODE = ?
         AND C.USER_NAME = ?`,
      [cardCode, userName]
    );
    res.status(200).json({ required: rows[0].cnt > 0 });
  } catch (err) {
    logger.error("checkVehicleNumberRequired error", { error: err.message });
    res.status(500).json({ status: "error", message: err.message });
  }
};

const addOrder = async (req, res) => {
  try {
    logger.info("addOrder called", { body: req.body });

    // Validate vehicle number if any cart item requires it
    const cardCode = req.body.Orders?.[0]?.CardCode;
    const userName = req.body.Orders?.[0]?.U_User_Name;
    if (cardCode && userName) {
      const [rows] = await pool.query(
        `SELECT COUNT(*) AS cnt
         FROM NOAM N
         INNER JOIN BENZI_APP_USERS_CART C ON C.ITEMCODE = N.CATALOG_NUMBER
         WHERE N.car_NOTE = 'לפי מספר רישוי בלבד'
           AND C.CARD_CODE = ?
           AND C.USER_NAME = ?`,
        [cardCode, userName]
      );
      if (rows[0].cnt > 0 && !req.body.Orders?.[0]?.VehicleNumber) {
        return res.status(400).json({ status: "error", message: "נדרש מספר רכב" });
      }
    }

    const sapUrl = "http://app.record.a-zuzit.co.il/XIS_Record.SLWS/SAPB1_API/B1SLW/AddOrder";
    logger.info("addOrder sending to SAP", { url: sapUrl, body: req.body });
    const response = await axios.post(
      sapUrl,
      req.body,
      { headers: { "Content-Type": "application/json" } }
    );
    res.status(response.status).json(response.data);
  } catch (err) {
    logger.error("addOrder error", {
      error: err.message,
      responseStatus: err.response?.status,
      responseData: err.response?.data,
    });
    const status = err.response?.status || 500;
    res.status(status).json({ status: "error", message: err.message });
  }
};

const getCartList = async (req, res) => {
  const cardCode = req.query.cardCode;
  const userName = req.query.userName;

  try {
    logger.info("getCartList called", { cardCode, userName });
    const query = `
      SELECT
          ROW_NUMBER() OVER (ORDER BY CART.ITEMCODE) AS ID,
          CART.ITEMCODE,
          CART.QUANTITY,
          cards.IMAGE,
          cards.BRAND,
          cards.NET_PRICE,
          cards.GARAGE9_PRICE,
          cards.GROSS_PRICE,
          noam.CHILD_GROUP,
          noam.DESCRIPTION_NOTE,
          noam.MODEL,
          noam.CAR_NOTE,
          noam.FROM_YEAR,
          noam.UNTIL_YEAR,
          noam.CAPACITY,
          cards.quantity as AMOUNT,
          cards.SKU_CODE
      FROM
          BENZI_APP_USERS_CART CART
      JOIN
          cards ON CART.ITEMCODE = cards.CATALOG_NUMBER
      JOIN
          noam ON CART.ITEMCODE = noam.CATALOG_NUMBER
      WHERE
          CART.CARD_CODE = ?
          AND CART.USER_NAME = ?
      GROUP BY CART.ITEMCODE;
    `;
    const [results] = await pool.query(query, [cardCode, userName]);
    logger.info("getCartList result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getCartList Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error getCartList fetching data",
    });
  }
};

const addItemToCart = async (req, res) => {
  const cardCode = req.query.cardCode;
  const userName = req.query.userName;
  const item_code = req.query.item_code;
  const amountToBy = req.query.amountToBy;
  const status = req.query.status;

  // בטיחות מול סימנים מיוחדים
  const safeitem_code = item_code.replace(/'/g, "''");

  try {
    logger.info("addItemToCart called", {
      cardCode,
      userName,
      item_code,
      amountToBy,
      status,
    });
    // שימוש בפרמטרים (parameterized query) למניעת SQL Injection
    const query = `CALL SP_BENZI_APP_CART(?, ?, ?, ?, ?);`;
    const [results] = await pool.query(query, [
      cardCode,
      userName,
      safeitem_code,
      amountToBy,
      status,
    ]);
    logger.info("addItemToCart result", { result: results });
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("addItemToCart Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error addItemToCart fetching data",
    });
  }
};

const deleteItemFromCart = async (req, res) => {
  const cardCode = req.query.cardCode;
  const userName = req.query.userName;

  try {
    logger.info("deleteItemFromCart called", { cardCode, userName });
    const [results] = await pool.query(
      `DELETE FROM BENZI_APP_USERS_CART WHERE USER_NAME = ? AND CARD_CODE = ?;`,
      [userName, cardCode]
    );
    logger.info("deleteItemFromCart result", {
      affectedRows: results.affectedRows,
    });

    if (results.affectedRows > 0) {
      res.status(200).json({
        status: "success",
        message: "Item deleted successfully",
      });
    } else {
      res.status(404).json({
        status: "error",
        message: "No matching records found",
      });
    }
  } catch (err) {
    logger.error("deleteItemFromCart Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error deleting item from cart",
    });
  }
};

const activateCart = async (req, res) => {
  try {
    logger.info("activateCart called");
    const sapUrl = "http://app.record.a-zuzit.co.il/XIS_Record.SLWS/SAPB1_API/B1SLW/ActivateWagon";
    const response = await axios.post(sapUrl, req.body || {}, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });
    logger.info("activateCart success", { status: response.status });
    res.status(response.status).json(response.data);
  } catch (err) {
    logger.error("activateCart error", {
      error: err.message,
      responseStatus: err.response?.status,
      responseData: err.response?.data,
    });
    const status = err.response?.status || 500;
    res.status(status).json({ status: "error", message: err.message });
  }
};

module.exports = {
  getCartList,
  addItemToCart,
  deleteItemFromCart,
  addOrder,
  checkVehicleNumberRequired,
  activateCart,
};
