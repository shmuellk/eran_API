const express = require("express");
const router = express.Router();
const itemCardController = require("../controllers/itemCardController");

router.get("/getItemBrand", itemCardController.getItemBrand);
router.get("/getCarsByItem", itemCardController.getCarsByItem);
router.get("/getAlternativeSkus", itemCardController.getAlternativeSkus);
router.get("/getItemBrandByCar", itemCardController.getItemBrandByCar);

module.exports = router;
