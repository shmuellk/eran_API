const crypto = require("node:crypto");
const pool = require("../configs/connection_cars");
const nodemailer = require("nodemailer");
const logger = require("../logger.js");
const { isIpExemptType, ADMIN_TYPES_SQL } = require("./userTypes");
require("dotenv").config();

const { createSession, publicUser } = require("../security/sessions");
const { checkLoginIp, getClientIp } = require("../security/ipPolicy");

const logIn = async (req, res) => {
  const userName = req.body.userName;
  const Password = req.body.Password;

  if (typeof userName !== "string" || typeof Password !== "string" || !userName || !Password || userName.length > 255 || Password.length > 1024) {
    logger.warn("logIn missing required parameters", { userName });
    return res.status(400).json({
      status: "error",
      message: "Missing required query parameters: userName or Password",
    });
  }

  logger.info("logIn called", { userName });
  try {
    // Using parameterized query to prevent SQL injection
    const query = `
      SELECT *
      FROM BENZI_APP_USERS
      WHERE U_USER_NAME = ?;
    `;
    const [results] = await pool.query(query, [userName]);
    // MySQL string comparison may be case-insensitive; verify credentials exactly.
    const supplied = Buffer.from(Password);
    const stored = Buffer.from(String(results[0]?.U_PASSWORD ?? ''));
    if (results.length !== 1 || supplied.length !== stored.length || !crypto.timingSafeEqual(supplied, stored)) {
      return res.status(401).json({ status: 'error', code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }

    const user = results[0];
    // Admins (WEB_MANAG) and staff (mosofon, cellular data) are not IP-restricted.
    if (!isIpExemptType(user.U_TYPE)) {
      const ipCheck = checkLoginIp(user, getClientIp(req));
      if (!ipCheck.allowed) {
        logger.warn("logIn blocked by IP", { userName, code: ipCheck.code, client: ipCheck.client, allowedIp: ipCheck.allowedIp, allowedPrefix: ipCheck.allowedPrefix });
        // The caller's own address is returned so an admin can register the address the API actually sees
        // (it can differ from "what is my IP" sites behind VPN/WARP/iCloud Private Relay).
        return res.status(403).json({ status: "blocked", code: ipCheck.code, clientIp: ipCheck.client?.ip ?? null, clientIpv6Prefix: ipCheck.client?.prefix64 ?? null });
      }
    }

    const session = await createSession(results[0]);
    res.set("Cache-Control", "no-store");
    res.status(200).json({ status: "success", result: [publicUser(results[0])], ...session });
  } catch (err) {
    logger.error("logIn failed", { code: err.code || "AUTH_ERROR" });
    res.status(500).json({
      status: "error",
      message: "Error logIn fetching data",
    });
  }
};

const getWhatsAppUsers = async (req, res) => {
  logger.info("getWhatsAppUsers called");
  const search = req.query.search || "";

  try {
    const [results] = await pool.query(`SELECT * FROM WHATSAPP_LINK;`);
    logger.info("getWhatsAppUsers result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getWhatsAppUsers Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error getWhatsAppUsers fetching data",
    });
  }
};

const sendEmail = async (req, res) => {
  const cartData = req.body.cart;
  const userData = req.body.userData;

  if (!cartData || !userData) {
    logger.warn("sendEmail missing required body data", { cartData, userData });
    return res.status(400).json({
      status: "error",
      message: "Missing required body parameters: cart and userData",
    });
  }

  // Configure the email transport
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASS,
    },
  });

  // Construct email body with HTML
  let emailBody = `
    <div style="direction: rtl; font-family: Arial, sans-serif; font-size: 16px; color: #333;">
      <p><strong style="color: red;">⚠ קיימת הזמנה שנכשלה עבור:</strong> ${userData}⚠</p>
      <p><strong>קוד לקוח:</strong> ${cartData.Orders[0].CardCode}</p>
      <p><strong>דרך שילוח:</strong> ${cartData.Orders[0].U_Ordr_Rec_shiptype}</p>
      <p><strong>שם המזמין:</strong> ${cartData.Orders[0].U_Ordr_Rec_Name}</p>
      <p><strong>טלפון:</strong> ${cartData.Orders[0].U_Ordr_Rec_Phone}</p>
      <p><strong>הערות למשלוח:</strong> ${cartData.Orders[0].Comments}</p>
      <hr style="border-top: 1px solid #000;">
      <h3 style="color: blue;">📦 פרטי ההזמנה:</h3>
      <table style="width: 100%; border-collapse: collapse; text-align: right;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #ddd; padding: 8px;">#</th>
            <th style="border: 1px solid #ddd; padding: 8px;">קוד פריט</th>
            <th style="border: 1px solid #ddd; padding: 8px;">כמות</th>
          </tr>
        </thead>
        <tbody>
  `;

  cartData.Orders[0].Rows.forEach((item, index) => {
    emailBody += `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${index + 1}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${
              item.ItemCode
            }</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${
              item.Quantity
            }</td>
          </tr>
    `;
  });

  emailBody += `
        </tbody>
      </table>
    </div>
  `;

  const mailOptions = {
    from: "recordfailed@gmail.com",
    to: [
      "Shmuel@recordltd.co.il",
      "Etamar@recordltd.co.il",
      "noam@recordltd.co.il",
      "benzi@recordltd.co.il",
      "hezi@recordltd.co.il",
      "shmuel13e@gmail.com",
    ],
    subject: `הזמנה נכשלה`,
    html: emailBody, // Use HTML instead of text
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info("Email sent successfully", { to: mailOptions.to });
    res
      .status(200)
      .json({ status: "success", message: "Email sent successfully" });
  } catch (error) {
    logger.error("Error sending email", { error });
    res.status(500).json({ status: "error", message: "Error sending email" });
  }
};

const getUserExistStatus = async (req, res) => {
  const U_CARD_CODE = req.query.U_CARD_CODE;
  const U_USER_NAME = req.query.U_USER_NAME;
  console.log("U_CARD_CODE = " + U_CARD_CODE);
  console.log("U_USER_NAME = " + U_USER_NAME);

  if (!U_CARD_CODE || !U_USER_NAME) {
    logger.warn("logIn missing required parameters", {
      U_CARD_CODE,
      U_USER_NAME,
    });
    return res.status(400).json({
      status: "error",
      message: "Missing required query parameters: userName or Password",
    });
  }

  logger.info("logIn called", { U_USER_NAME });
  try {
    // Using parameterized query to prevent SQL injection
    const query = `
    SELECT * FROM BENZI_APP_USERS WHERE U_CARD_CODE = ? AND U_USER_NAME = ?;
    `;
    const [results] = await pool.query(query, [U_CARD_CODE, U_USER_NAME]);


    res.status(200).json({
      status: "success",
      result: results.map(publicUser),
    });
  } catch (err) {
    logger.error("getUserExistStatus Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error getUserExistStatus fetching data",
    });
  }
};

const toNullIfEmpty = (val) => {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  return str === "" ? null : str;
};

const creatNewUser = async (req, res) => {
  const U_CARD_CODE = toNullIfEmpty(req.body.U_CARD_CODE);
  const U_CARD_NAME = toNullIfEmpty(req.body.U_CARD_NAME);
  const U_VIEW_NAME = toNullIfEmpty(req.body.U_VIEW_NAME);
  const U_SHIPTYPE = toNullIfEmpty(req.body.U_SHIPTYPE);
  const U_TYPE = toNullIfEmpty(req.body.U_TYPE);
  const U_USER_NAME = toNullIfEmpty(req.body.U_USER_NAME);
  const U_PASSWORD = toNullIfEmpty(req.body.U_PASSWORD);
  const U_EILAT_USER = req.body.U_EILAT_USER ?? "0";
  const U_CREATE_BY = toNullIfEmpty(req.body.U_CREATE_BY);
  const U_IP = toNullIfEmpty(req.body.U_IP);
  const U_IP6 = toNullIfEmpty(req.body.U_IP6);
  const SITE = req.body.SITE ? 1 : 0;
  const APP = req.body.APP ? 1 : 0;
  const GIUL = req.body.GIUL === undefined ? 1 : req.body.GIUL ? 1 : 0; // shown by default

  console.log("U_CARD_CODE = " + U_CARD_CODE);
  console.log("U_CARD_NAME = " + U_CARD_NAME);
  console.log("U_VIEW_NAME = " + U_VIEW_NAME);
  console.log("U_SHIPTYPE = " + U_SHIPTYPE);
  console.log("U_TYPE = " + U_TYPE);
  console.log("U_USER_NAME = " + U_USER_NAME);
  console.log("U_EILAT_USER = " + U_EILAT_USER);
  console.log("U_CREATE_BY = " + U_CREATE_BY);
  console.log("U_IP = " + U_IP);
  console.log("U_IP6 = " + U_IP6);

  try {
    // Using parameterized query to prevent SQL injection
    const query = `
  INSERT INTO BENZI_APP_USERS
    (U_CARD_CODE, U_CARD_NAME, U_VIEW_NAME, U_SHIPTYPE, U_TYPE, U_USER_NAME, U_PASSWORD, U_EILAT_USER, U_CREATE_BY, U_IP, U_IP6, SITE, APP, GIUL)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;
    const [results] = await pool.query(query, [
      U_CARD_CODE,
      U_CARD_NAME,
      U_VIEW_NAME,
      U_SHIPTYPE,
      U_TYPE,
      U_USER_NAME,
      U_PASSWORD,
      U_EILAT_USER,
      U_CREATE_BY,
      U_IP,
      U_IP6,
      SITE,
      APP,
      GIUL,
    ]);
    logger.info("creatNewUser result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("creatNewUser Database error", { code: err.code });
    res.status(500).json({
      status: "error",
      message: "Error creatNewUser fetching data",
    });
  }
};

const getAllAppAuthor = async (req, res) => {
  logger.info("getAllAppAuthor called");

  try {
    // שאילתת נתונים עם דפדוף
    const [results] = await pool.query(
      `SELECT DISTINCT U_CREATE_BY FROM BENZI_APP_USERS`
    );

    logger.info("getAllAppUsers result = " + results);

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getAllAppUsers Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error fetching paged users",
    });
  }
};

const getAllAppUsers = async (req, res) => {
  logger.info("getAllAppUsers called");

  // קבלת פרמטרים מה-query
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || "";
  const createBy = req.query.U_CREATE_BY || "";
  const offset = (page - 1) * limit;

  try {
    const baseWhere = createBy
      ? "WHERE (U_CARD_NAME LIKE ? OR U_CARD_CODE LIKE ?) AND U_CREATE_BY = ?"
      : "WHERE (U_CARD_NAME LIKE ? OR U_CARD_CODE LIKE ?)";
    const baseParams = createBy
      ? [`%${search}%`, `%${search}%`, createBy]
      : [`%${search}%`, `%${search}%`];

    // שאילתת נתונים עם דפדוף
    const [results] = await pool.query(
      `SELECT * FROM BENZI_APP_USERS ${baseWhere} ORDER BY U_CREATE_TIME DESC LIMIT ? OFFSET ?`,
      [...baseParams, limit, offset]
    );

    // שאילתת ספירה כללית
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM BENZI_APP_USERS ${baseWhere}`,
      baseParams
    );

    const counterWhere = createBy
      ? `WHERE U_TYPE NOT IN (${ADMIN_TYPES_SQL}) AND U_CREATE_BY = ?`
      : `WHERE U_TYPE NOT IN (${ADMIN_TYPES_SQL})`;
    const counterParams = createBy ? [createBy] : [];
    const [[{ counter }]] = await pool.query(
      `SELECT COUNT(DISTINCT U_CARD_CODE) AS counter FROM BENZI_APP_USERS ${counterWhere}`,
      counterParams
    );

    logger.info(
      "getAllAppUsers result = " + results.length + " total =" + total
    );

    res.status(200).json({
      status: "success",
      result: results,
      total,
      page,
      counter,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error("getAllAppUsers Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error fetching paged users",
    });
  }
};

const CountAppUsers = async (req, res) => {
  const U_CREATE_BY = req.query.U_CREATE_BY;
  logger.info("CountAppUsers called");
  try {
    const [[{ counter }]] = await pool.query(
      `SELECT COUNT(DISTINCT U_CARD_CODE) AS counter
        FROM BENZI_APP_USERS 
        WHERE U_TYPE NOT IN (${ADMIN_TYPES_SQL}) AND U_CREATE_BY =?;`,
      [U_CREATE_BY]
    );

    res.status(200).json({
      status: "success",
      counter,
    });
  } catch (err) {
    logger.error("CountAppUsers Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error fetching paged users",
    });
  }
};

const deleteUser = async (req, res) => {
  const cardCode = req.query.cardCode;
  const userName = req.query.userName;

  if (!userName || !cardCode) {
    logger.warn("deleteUser missing required parameters", {
      userName,
      cardCode,
    });
    return res.status(400).json({
      status: "error",
      message: "Missing required query parameters: userName or cardCode",
    });
  }

  logger.info("deleteUser called", { userName });
  try {
    // Using parameterized query to prevent SQL injection
    const query = `
      DELETE
      FROM BENZI_APP_USERS
      WHERE U_USER_NAME = ? AND U_CARD_CODE = ?;
    `;
    const [results] = await pool.query(query, [userName, cardCode]);


    await pool.query('UPDATE AUTH_SESSIONS SET revoked = 1 WHERE user_name = ? AND card_code = ?', [userName, cardCode]);
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("logIn failed", { code: err.code || "AUTH_ERROR" });
    res.status(500).json({
      status: "error",
      message: "Error logIn fetching data",
    });
  }
};

const updateUser = async (req, res) => {
  const U_CARD_CODE = req.body.U_CARD_CODE;
  const U_CARD_NAME = req.body.U_CARD_NAME;
  const U_VIEW_NAME = req.body.U_VIEW_NAME;
  const U_SHIPTYPE = req.body.U_SHIPTYPE ? req.body.U_SHIPTYPE : "";
  const U_TYPE = req.body.U_TYPE;
  const U_USER_NAME = req.body.U_USER_NAME;
  const U_USER_NAME_ORIGINAL = req.body.U_USER_NAME_ORIGINAL || U_USER_NAME;
  const U_PASSWORD = req.body.U_PASSWORD;
  const U_EILAT_USER = req.body.U_EILAT_USER;
  const U_IP = req.body.U_IP ?? "";
  const U_IP6 = req.body.U_IP6 ?? "";
  const SITE = req.body.SITE ? 1 : 0;
  const APP = req.body.APP ? 1 : 0;
  const GIUL = req.body.GIUL ? 1 : 0;

  console.log("[updateUser] U_CARD_CODE =", U_CARD_CODE);
  console.log("[updateUser] U_CARD_NAME =", U_CARD_NAME);
  console.log("[updateUser] U_USER_NAME_ORIGINAL =", U_USER_NAME_ORIGINAL);
  console.log("[updateUser] U_USER_NAME (new) =", U_USER_NAME);
  console.log("[updateUser] U_SHIPTYPE =", U_SHIPTYPE);
  console.log("[updateUser] U_TYPE =", U_TYPE);
  console.log("[updateUser] U_EILAT_USER =", U_EILAT_USER);
  console.log("[updateUser] U_IP =", U_IP);
  console.log("[updateUser] U_IP6 =", U_IP6);

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    // Using parameterized query to prevent SQL injection
    const query = `
  UPDATE BENZI_APP_USERS SET
    U_CARD_NAME = ?,
    U_VIEW_NAME = ?,
    U_SHIPTYPE = ?,
    U_TYPE = ?,
    U_USER_NAME = ?,
    U_PASSWORD = ?,
    U_EILAT_USER = ?,
    U_IP = ?,
    U_IP6 = ?,
    SITE = ?,
    APP = ?,
    GIUL = ?
  WHERE U_CARD_CODE = ? AND U_USER_NAME = ?
`;

    const [results] = await connection.query(query, [
      U_CARD_NAME,
      U_VIEW_NAME,
      U_SHIPTYPE,
      U_TYPE,
      U_USER_NAME,
      U_PASSWORD,
      U_EILAT_USER,
      U_IP,
      U_IP6,
      SITE,
      APP,
      GIUL,
      U_CARD_CODE,
      U_USER_NAME_ORIGINAL,
    ]);
    console.log("[updateUser] affectedRows =", results.affectedRows, "changedRows =", results.changedRows);
    logger.info("updateUser result", { affectedRows: results.affectedRows, changedRows: results.changedRows });

    if (results.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: "error",
        message: `לא נמצא משתמש עם קוד ${U_CARD_CODE} ושם משתמש ${U_USER_NAME_ORIGINAL}`,
      });
    }

    // Sessions stay alive across edits: a renamed user keeps their session under the new name.
    // A password change is caught by the credential fingerprint on the user's next request.
    await connection.query('UPDATE AUTH_SESSIONS SET user_name = ? WHERE user_name = ? AND card_code = ? AND revoked = 0', [U_USER_NAME, U_USER_NAME_ORIGINAL, String(U_CARD_CODE)]);
    await connection.commit();
    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    await connection?.rollback().catch(() => {});
    logger.error("updateUser Database error", { code: err.code });
    res.status(500).json({
      status: "error",
      message: "Error creatNewUser fetching data",
    });
  } finally {
    connection?.release();
  }
};

module.exports = {
  logIn,
  getWhatsAppUsers,
  sendEmail,
  getUserExistStatus,
  creatNewUser,
  getAllAppUsers,
  getAllAppAuthor,
  deleteUser,
  updateUser,
  CountAppUsers,
};
