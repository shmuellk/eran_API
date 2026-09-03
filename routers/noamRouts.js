const express = require("express");
const router = express.Router();
const noamController = require("../controllers/noamController");

router.get("/getNoamList", noamController.getNoamList);
router.get("/getDistinctValues", noamController.getDistinctValues);
router.post("/updateColumn", noamController.updateColumn);

module.exports = router;
