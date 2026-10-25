const express = require("express");
const router = express.Router();
const noamController = require("../controllers/noamController");
const cardsCardController = require("../controllers/cardsCardController");

router.get("/getNoamList", noamController.getNoamList);
router.get("/exportCsv", noamController.exportCsv);
router.get("/getDistinctValues", noamController.getDistinctValues);
router.post("/updateColumn", noamController.updateColumn);
router.post("/saveChanges", noamController.saveChanges);
router.delete("/deleteRow", noamController.deleteRow);
router.get("/getItemCard", cardsCardController.getCardsByCatalog);
router.post("/updateItemCard", cardsCardController.updateCard);

module.exports = router;
