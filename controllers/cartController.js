const pool = require("../configs/connection_cars");
const logger = require("../logger.js");

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

module.exports = {
  getCartList,
  addItemToCart,
  deleteItemFromCart,
};
