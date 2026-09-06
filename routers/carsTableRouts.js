const express = require("express");
const router = express.Router();
const carsController = require("../controllers/carsController");

router.get("/getCarsList", carsController.getCarsList);
router.get("/getDistinctValues", carsController.getDistinctValues);
router.post("/updateColumn", carsController.updateColumn);
router.post("/saveChanges", carsController.saveChanges);
router.delete("/deleteRow", carsController.deleteRow);

module.exports = router;
