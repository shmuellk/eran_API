const express = require("express");
const router = express.Router();
const armorController = require("../controllers/armorController");

router.get("/getArmorsList", armorController.getArmorsList);
router.get("/addItemToArmors", armorController.addItemToArmors);
router.get("/updateArmorsList", armorController.updateArmorsList);
router.get("/getArmorsInStock", armorController.getArmorsInStock);
router.get("/getArmorsForManag", require("../security/sessions").requireAdmin, armorController.getArmorsForManag);
router.get("/getBrandFromArmors", require("../security/sessions").requireAdmin, armorController.getBrandFromArmors);

module.exports = router;
