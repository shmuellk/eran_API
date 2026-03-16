const express = require("express");
const router = express.Router();
const carController = require("../controllers/carController");

router.get("/serchCarNumber", carController.getCarDataByNumber);
router.get("/FindProductsByCar", carController.getProdactsByCar);
router.get("/FindCategorisByCar", carController.getCategorisByCar);
router.get("/FindProductsById", carController.getProdactsById);
router.get(
  "/FindProductsByPARENT_GROUP",
  carController.getProdactsByPARENT_GROUP
);
router.get("/FindProductsByITEM_GROUP", carController.getProdactsByITEM_GROUP);
router.get(
  "/FindProductsByCHILD_GROUP",
  carController.getProdactsByCHILD_GROUP
);
router.get("/getInfoBySKU", carController.getInfoBySKU);
router.get("/getProdactsBySerch", carController.getProdactsBySerch);
router.get(
  "/getProdactsByCHILD_GROUPSerch",
  carController.getProdactsByCHILD_GROUPSerch
);

module.exports = router;
// , UserAuthenticate
