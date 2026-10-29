const express = require("express");
const router = express.Router();
const barController = require("../controllers/barController");

router.get("/getMessage", barController.getMessage);
router.post("/updateMessage", require("../security/sessions").requireAdmin, barController.updateMessage);

module.exports = router;
