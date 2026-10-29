const express = require("express");
const router = express.Router();
const usersController = require("../controllers/usersController");

const { authenticate, requireAdmin, requireSuperAdmin, logout, disconnectUser } = require('../security/sessions');
const customerScope = require('../security/customerScope');
router.post('/logIn', require('../security/loginLimit'), usersController.logIn);
router.use(authenticate);
router.get('/session', (req, res) => res.json({ user: req.auth.user }));
router.post('/logout', logout);
router.post('/disconnect', requireSuperAdmin, disconnectUser);
router.use(customerScope);
router.get('/getUserExistStatus', usersController.getUserExistStatus);
router.post('/sendEmail', usersController.sendEmail);
router.get("/getWhatsAppUsers", usersController.getWhatsAppUsers);
router.use(requireAdmin);
router.use(['/creatNewUser', '/updateUser', '/deleteUser'], require('../security/accountPolicy'));


router.post("/creatNewUser", usersController.creatNewUser);
router.get("/getAllAppUsers", usersController.getAllAppUsers);
router.get("/getAllAppAuthor", usersController.getAllAppAuthor);
router.get("/CountAppUsers", usersController.CountAppUsers);
router.delete("/deleteUser", usersController.deleteUser);
router.post("/updateUser", usersController.updateUser);
router.get("/myIp", (req, res) => {
  const isIPv4 = (ip) => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);
  const allIps = [
    ...(req.headers["x-forwarded-for"] ?? "").split(",").map(s => s.trim()),
    req.headers["x-real-ip"],
    req.headers["cf-connecting-ip"],
    req.ip,
  ].filter(Boolean).map(ip => ip.replace(/^::ffff:/, ""));
  res.json({ allIps, firstIPv4: allIps.find(isIPv4) ?? null });
});

module.exports = router;
// , UserAuthenticate
