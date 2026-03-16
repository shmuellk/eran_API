const express = require("express");
const router = express.Router();
const cronController = require("../controllers/cronController");

router.post("/updatePaginated", cronController.updatePaginated);

module.exports = router;
