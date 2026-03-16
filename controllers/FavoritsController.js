const pool = require("../configs/connection_cars");
const logger = require("../logger.js");

const getFavoritsList = async (req, res) => {
  const cardCode = req.query.cardCode;
  const userName = req.query.userName;

  try {
    logger.info("getFavoritsList called", { cardCode, userName });
    const query = `
      SELECT 
          ROW_NUMBER() OVER (ORDER BY BENZI_APP_USERS_FAVORITES.ITEMCODE) AS ID,
          BENZI_APP_USERS_FAVORITES.ITEMCODE,
          cards.IMAGE,
          cards.NET_PRICE,
          cards.GROSS_PRICE,
          cards.GARAGE9_PRICE,
          noam.CHILD_GROUP,
          noam.DESCRIPTION_NOTE,
          cards.QUANTITY,
          cards.BRAND,
          cards.SKU_CODE,
          cards.delivery_date
      FROM 
          BENZI_APP_USERS_FAVORITES 
      JOIN 
          cards ON BENZI_APP_USERS_FAVORITES.ITEMCODE = cards.CATALOG_NUMBER
      JOIN 
          noam ON BENZI_APP_USERS_FAVORITES.ITEMCODE = noam.CATALOG_NUMBER
      WHERE 
          BENZI_APP_USERS_FAVORITES.CARD_CODE = ?
          AND BENZI_APP_USERS_FAVORITES.USER_NAME = ?
      GROUP BY BENZI_APP_USERS_FAVORITES.ITEMCODE;
    `;
    const [results] = await pool.query(query, [cardCode, userName]);
    logger.info("getFavoritsList result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getFavoritsList Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error getFavoritsList fetching data",
    });
  }
};

const addItemToFavorits = async (req, res) => {
  const cardCode = req.query.cardCode;
  const userName = req.query.userName;
  const item_code = req.query.item_code;
  const status = req.query.status;

  try {
    logger.info("addItemToFavorits called", {
      cardCode,
      userName,
      item_code,
      status,
    });
    const query = `CALL SP_BENZI_APP_FAVORITES(?, ?, ?, ?);`;
    const [results] = await pool.query(query, [
      cardCode,
      userName,
      item_code,
      status,
    ]);
    logger.info("addItemToFavorits result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("addItemToFavorits Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error addItemToFavorits fetching data",
    });
  }
};

module.exports = {
  getFavoritsList,
  addItemToFavorits,
};
