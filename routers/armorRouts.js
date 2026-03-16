const express = require("express");
const router = express.Router();
const armorController = require("../controllers/armorController");

router.get("/getArmorsList", armorController.getArmorsList);
router.get("/addItemToArmors", armorController.addItemToArmors);
router.get("/updateArmorsList", armorController.updateArmorsList);
router.get("/getArmorsInStock", armorController.getArmorsInStock);
router.get("/getArmorsForManag", armorController.getArmorsForManag);
router.get("/getBrandFromArmors", armorController.getBrandFromArmors);

module.exports = router;
