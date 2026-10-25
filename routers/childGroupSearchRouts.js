const express = require("express");
const router = express.Router();
const childGroupSearchController = require("../controllers/childGroupSearchController");

router.get("/getList", childGroupSearchController.getChildGroupSearchList);

module.exports = router;
