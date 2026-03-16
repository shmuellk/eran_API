const cron = require("node-cron");
const pool = require("../configs/connection_cars");
const logger = require("../logger.js");

// פונקציה לעדכון נתונים (נקראת דרך API)
const updatePaginated = async (req, res) => {
  try {
    const { items, pagination } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({
        status: "error",
        message: "items חייב להיות מערך",
      });
    }

    let results = [];

    for (const item of items) {
      // ערכי ברירת מחדל במקום NULL / undefined
      const catalogNumber = item.ITEMCODE ?? "";
      const itemDescription = item.item_description ?? "";
      const alternativeSkus = item.alternative_skus ?? "";
      const skuInvoice = item.sku_invoice ?? "";
      const grossPrice = item.gross_price ?? "";
      const netPrice = item.net_price ?? "";
      const siteDisplay = item.site_display ?? "";
      const brand = item.brand ?? "";
      const garage9_price = item.garage9_price ?? "";

      // טיפול בתאריך
      let deliveryDate = null;
      if (item.delivery_date) {
        const dateObj = new Date(item.delivery_date);
        if (!isNaN(dateObj.getTime())) {
          const day = String(dateObj.getDate()).padStart(2, "0");
          const month = String(dateObj.getMonth() + 1).padStart(2, "0");
          const year = dateObj.getFullYear();
          deliveryDate = `${year}-${month}-${day}`; // פורמט תקין ל־DB
        }
      }

      const [result] = await pool.query(
        `
        UPDATE cards
        SET
          garage9_price = ?,
          item_description = ?,
          alternative_skus = ?,
          sku_invoice = ?,
          gross_price = ?,
          net_price = ?,
          delivery_date = ?,
          brand = ?,
          site_display = ?
        WHERE catalog_number = ?
        `,
        [
          garage9_price,
          itemDescription,
          alternativeSkus,
          skuInvoice,
          grossPrice,
          netPrice,
          deliveryDate,
          brand,
          siteDisplay,
          catalogNumber,
        ]
      );

      results.push({
        catalogNumber,
        affectedRows: result.affectedRows,
      });
    }

    const pageInfo = pagination
      ? `page ${pagination.page} of ${pagination.totalPages}`
      : "pagination not provided";

    console.log(pageInfo);
    logger.info(pageInfo);

    return res.status(200).json({
      status: "success",
      updatedCount: results.length,
      results,
    });
  } catch (err) {
    console.error("שגיאה בעדכון הנתונים בשרת 2:", err);
    logger.error("שגיאה בעדכון הנתונים בשרת 2", err);

    return res.status(500).json({
      status: "error",
      message: err.message,
      description: "שגיאה בעדכון הנתונים בשרת 2",
    });
  }
};

module.exports = {
  updatePaginated,
};
