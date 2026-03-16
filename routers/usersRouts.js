const express = require("express");
const router = express.Router();
const usersController = require("../controllers/usersController");

router.get("/logIn", usersController.logIn);
router.get("/getUserExistStatus", usersController.getUserExistStatus);
router.get("/getWhatsAppUsers", usersController.getWhatsAppUsers);
router.post("/sendEmail", usersController.sendEmail);
router.post("/creatNewUser", usersController.creatNewUser);
router.get("/getAllAppUsers", usersController.getAllAppUsers);
router.get("/getAllAppAuthor", usersController.getAllAppAuthor);
router.get("/CountAppUsers", usersController.CountAppUsers);
router.delete("/deleteUser", usersController.deleteUser);
router.post("/updateUser", usersController.updateUser);

module.exports = router;
// , UserAuthenticate
