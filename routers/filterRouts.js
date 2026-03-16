const express = require("express");
const router = express.Router();
const filterController = require("../controllers/filterController");

router.get("/getAllManufacturer", filterController.getAllManufacturer);
router.get("/getAllModel", filterController.getAllModel);
router.get("/getAllmanufactureYear", filterController.getAllmanufactureYear);
router.get("/getAllEngineModel", filterController.getAllEngineModel);
router.get("/getAllCapacity", filterController.getAllCapacity);
router.get("/getAllGas", filterController.getAllGas);
router.get("/getAllGear", filterController.getAllGear);
router.get("/getAllPropulsion", filterController.getAllPropulsion);
router.get("/getAllDoors", filterController.getAllDoors);
router.get("/getAllBooy", filterController.getAllBooy);
router.get("/getAlternativeSKU", filterController.getAlternativeSKU);
router.get("/getComplitSerch", filterController.getComplitSerch);
router.get("/getAllDeliverys", filterController.getAllDeliverys);
router.get("/getShippingExitTime", filterController.getShippingExitTime);

module.exports = router;
