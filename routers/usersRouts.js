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
router.get("/myIp", (req, res) => {
  const ips = [
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim(),
    req.headers["x-real-ip"],
    req.headers["cf-connecting-ip"],
    req.ip,
    req.socket?.remoteAddress,
  ].filter(Boolean).map((ip) => ip.replace(/^::ffff:/, ""));
  res.json({ ips });
});

module.exports = router;
// , UserAuthenticate
