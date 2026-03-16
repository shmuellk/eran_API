const express = require("express");
const router = express.Router();
const FavoritsController = require("../controllers/FavoritsController");

router.get("/getFavoritsList", FavoritsController.getFavoritsList);
router.get("/addItemToFavorits", FavoritsController.addItemToFavorits);

module.exports = router;
// , UserAuthenticate
