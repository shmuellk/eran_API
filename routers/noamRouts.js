const express = require("express");
const router = express.Router();
const noamController = require("../controllers/noamController");

router.get("/getNoamList", noamController.getNoamList);

module.exports = router;
