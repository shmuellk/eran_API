const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");

router.get("/getCartList", cartController.getCartList);
router.get("/addItemToCart", cartController.addItemToCart);
router.delete("/deleteItemFromCart", cartController.deleteItemFromCart);

module.exports = router;
// , UserAuthenticate
