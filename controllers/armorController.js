const pool = require("../configs/connection_cars");
const logger = require("../logger.js");

const getArmorsList = async (req, res) => {
  const cardCode = req.query.cardCode;
  const userName = req.query.userName;

  try {
    logger.info("getArmorsList called", { cardCode, userName });
    const [results] = await pool.query(
      `
      SELECT 
          ROW_NUMBER() OVER (ORDER BY BENZI_APP_USERS_WISHLIST.ITEMCODE) AS ID,
          BENZI_APP_USERS_WISHLIST.ITEMCODE,
          BENZI_APP_USERS_WISHLIST.AMOUNT,
          cards.IMAGE,
          cards.NET_PRICE,
          cards.GARAGE9_PRICE,
          cards.GROSS_PRICE,
          noam.CHILD_GROUP,
          noam.DESCRIPTION_NOTE,
          cards.QUANTITY,
          cards.SKU_CODE,
          cards.BRAND
      FROM 
          BENZI_APP_USERS_WISHLIST 
      JOIN 
          cards ON BENZI_APP_USERS_WISHLIST.ITEMCODE = cards.CATALOG_NUMBER
      JOIN 
          noam ON BENZI_APP_USERS_WISHLIST.ITEMCODE = noam.CATALOG_NUMBER
      WHERE 
          BENZI_APP_USERS_WISHLIST.CARD_CODE = ?
          AND BENZI_APP_USERS_WISHLIST.USER_NAME = ?
      GROUP BY BENZI_APP_USERS_WISHLIST.ITEMCODE;
      `,
      [cardCode, userName]
    );
    logger.info("getArmorsList result", { result: results });
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getArmorsList Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error fetching armors list",
    });
  }
};

const addItemToArmors = async (req, res) => {
  const cardCode = req.query.cardCode;
  const userName = req.query.userName;
  const item_code = req.query.item_code;
  const note = req.query.note;
  const status = req.query.status;

  try {
    logger.info("addItemToArmors called", {
      cardCode,
      userName,
      item_code,
      status,
      note,
    });
    const [results] = await pool.query(
      `CALL SP_BENZI_APP_WISHLIST(?, ?, ?, ?, ?);`,
      [cardCode, userName, item_code, status, note]
    );
    logger.info("addItemToArmors result", { result: results });
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("addItemToArmors Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error adding item to armors list",
    });
  }
};

const updateArmorsList = async (req, res) => {
  const cardCode = req.query.cardCode;
  const userName = req.query.userName;
  const item_code = req.query.item_code;
  const amountToArmor = req.query.amountToArmor;

  try {
    logger.info("updateArmorsList called", {
      cardCode,
      userName,
      item_code,
      amountToArmor,
    });
    // שינוי לכתיבה מאובטחת עם פרמטרים:
    const [results] = await pool.query(
      `UPDATE BENZI_APP_USERS_WISHLIST
       SET AMOUNT = ?
       WHERE CARD_CODE = ?
         AND USER_NAME = ?
         AND ITEMCODE = ?;`,
      [amountToArmor, cardCode, userName, item_code]
    );
    logger.info("updateArmorsList result", { result: results });
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("updateArmorsList Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error updating armors list",
    });
  }
};

const getArmorsInStock = async (req, res) => {
  const cardCode = req.query.cardCode;
  const userName = req.query.userName;

  try {
    logger.info("getArmorsInStock called", { cardCode, userName });
    const [results] = await pool.query(
      `
      SELECT 1
      FROM BENZI_APP_USERS_WISHLIST
      LEFT JOIN cards 
        ON BENZI_APP_USERS_WISHLIST.ITEMCODE = cards.catalog_number
      WHERE 
        cards.QUANTITY > 0
        AND BENZI_APP_USERS_WISHLIST.CARD_CODE = ?
        AND BENZI_APP_USERS_WISHLIST.USER_NAME = ?
      LIMIT 1;
      `,
      [cardCode, userName]
    );

    const hasStock = results.length > 0;
    logger.info("getArmorsInStock result", { inStock: hasStock });
    res.status(200).json({
      status: "success",
      inStock: hasStock,
    });
  } catch (err) {
    logger.error("getArmorsInStock Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error fetching armors in stock",
    });
  }
};

const getArmorsForManag = async (req, res) => {
  const brand = req.query.brand;
  const userName = req.query.userName;
  const item_code = req.query.item_code;
  const limit = req.query.limit;
  const offset = req.query.offset;

  try {
    logger.info("addItemToArmors called", {
      brand,
      userName,
      item_code,
      limit,
      offset,
    });
    const [results] = await pool.query(
      `CALL SP_BENZI_APP_WISHLIST_MANAGE(?, ?, ?, ?, ?);`,
      [brand, item_code, userName, limit, offset]
    );
    logger.info("addItemToArmors result", { result: results });
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("addItemToArmors Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error adding item to armors list",
    });
  }
};

const getBrandFromArmors = async (req, res) => {
  const brand = req.query.brand;
  const item_code = req.query.item_code;
  const userName = req.query.userName;

  try {
    logger.info("getBrandFromArmors called", {
      brand,
      userName,
      item_code,
    });
    const [results] = await pool.query(
      `CALL SP_BENZI_APP_WISHLIST_BRANDS(?, ?, ?);`,
      [brand, item_code, userName]
    );
    logger.info("getBrandFromArmors result", { result: results });
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getBrandFromArmors Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error adding item to armors list",
    });
  }
};

module.exports = {
  getArmorsList,
  addItemToArmors,
  updateArmorsList,
  getArmorsInStock,
  getArmorsForManag,
  getBrandFromArmors,
};
