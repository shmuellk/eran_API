const express = require("express");
const router = express.Router();
const cronController = require("../controllers/cronController");

// POST /cron/updatePaginated is mounted in app.js with the cron secret, not a user session.
router.get("/triggerCron", cronController.triggerCron);

module.exports = router;
