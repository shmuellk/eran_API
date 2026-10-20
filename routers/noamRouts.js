const express = require("express");
const router = express.Router();
const noamController = require("../controllers/noamController");

router.get("/getNoamList", noamController.getNoamList);
router.get("/exportCsv", noamController.exportCsv);
router.get("/getDistinctValues", noamController.getDistinctValues);
router.post("/updateColumn", noamController.updateColumn);
router.post("/saveChanges", noamController.saveChanges);
router.delete("/deleteRow", noamController.deleteRow);

module.exports = router;
