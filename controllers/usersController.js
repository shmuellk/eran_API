const pool = require("../configs/connection_cars");
const nodemailer = require("nodemailer");
const logger = require("../logger.js");
require("dotenv").config();

const logIn = async (req, res) => {
  const userName = req.query.userName;
  const Password = req.query.Password;
  const source = req.query.source || "";

  if (!userName || !Password) {
    logger.warn("logIn missing required parameters", { userName, Password });
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
      WHERE U_USER_NAME = ? AND U_PASSWORD = ?;
    `;
    const [results] = await pool.query(query, [userName, Password]);
    logger.info("logIn result", { result: results });

    if (results.length > 0) {
      const user = results[0];
      if (source !== "record_dev" || user.U_TYPE === 'מנהל') {
        // WEB_MANAG or admin — ללא בדיקת IP
      } else {
      const allowedIp = user.U_IP == null ? null : user.U_IP.toString().trim();
      if (allowedIp === null) {
        logger.warn("logIn blocked - U_IP is NULL", { userName });
        return res.status(403).json({ status: "blocked" });
      }
      if (allowedIp !== "") {
        const isIPv4 = (ip) => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);
        const allIps = [
          ...(req.headers["x-forwarded-for"] ?? "").split(",").map(s => s.trim()),
          req.headers["x-real-ip"],
          req.headers["cf-connecting-ip"],
          req.ip,
          req.socket?.remoteAddress,
        ].filter(Boolean).map(ip => ip.replace(/^::ffff:/, ""));

        const clientIp = allIps.find(isIPv4) ?? "";

        if (!clientIp || clientIp !== allowedIp) {
          logger.warn("logIn blocked by IP", { userName, clientIp, allowedIp });
          return res.status(403).json({ status: "blocked" });
        }
      }
      }
    }

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("logIn Database error", { error: err });
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

  logger.info("sendEmail called", { userData });

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
    ],
    subject: "הזמנה באפליקציה נכשלה",
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
    logger.info("getUserExistStatus result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("getUserExistStatus Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error getUserExistStatus fetching data",
    });
  }
};

const creatNewUser = async (req, res) => {
  const U_CARD_CODE = req.body.U_CARD_CODE;
  const U_CARD_NAME = req.body.U_CARD_NAME;
  const U_VIEW_NAME = req.body.U_VIEW_NAME;
  const U_SHIPTYPE = req.body.U_SHIPTYPE ? req.body.U_SHIPTYPE : "";
  const U_TYPE = req.body.U_TYPE;
  const U_USER_NAME = req.body.U_USER_NAME;
  const U_PASSWORD = req.body.U_PASSWORD;
  const U_EILAT_USER = req.body.U_EILAT_USER;
  const U_CREATE_BY = req.body.U_CREATE_BY;
  const U_IP = req.body.U_IP || "";

  console.log("U_CARD_CODE = " + U_CARD_CODE);
  console.log("U_CARD_NAME = " + U_CARD_NAME);
  console.log("U_VIEW_NAME = " + U_VIEW_NAME);
  console.log("U_SHIPTYPE = " + U_SHIPTYPE);
  console.log("U_TYPE = " + U_TYPE);
  console.log("U_USER_NAME = " + U_USER_NAME);
  console.log("U_PASSWORD = " + U_PASSWORD);
  console.log("U_EILAT_USER = " + U_EILAT_USER);
  console.log("U_CREATE_BY = " + U_CREATE_BY);
  console.log("U_IP = " + U_IP);

  try {
    // Using parameterized query to prevent SQL injection
    const query = `
  INSERT INTO BENZI_APP_USERS
    (U_CARD_CODE, U_CARD_NAME, U_VIEW_NAME, U_SHIPTYPE, U_TYPE, U_USER_NAME, U_PASSWORD, U_EILAT_USER, U_CREATE_BY, U_IP)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    ]);
    logger.info("creatNewUser result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("creatNewUser Database error", { error: err });
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
      ? "WHERE U_TYPE <> 'מנהל' AND U_CREATE_BY = ?"
      : "WHERE U_TYPE <> 'מנהל'";
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
        WHERE U_TYPE <> 'מנהל' AND U_CREATE_BY =?;`,
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
    logger.info("logIn result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("logIn Database error", { error: err });
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
  const U_PASSWORD = req.body.U_PASSWORD;
  const U_EILAT_USER = req.body.U_EILAT_USER;
  const U_IP = req.body.U_IP ?? "";

  console.log("U_CARD_CODE = " + U_CARD_CODE);
  console.log("U_CARD_NAME = " + U_CARD_NAME);
  console.log("U_VIEW_NAME = " + U_VIEW_NAME);
  console.log("U_SHIPTYPE = " + U_SHIPTYPE);
  console.log("U_TYPE = " + U_TYPE);
  console.log("U_USER_NAME = " + U_USER_NAME);
  console.log("U_PASSWORD = " + U_PASSWORD);
  console.log("U_EILAT_USER = " + U_EILAT_USER);
  console.log("U_IP = " + U_IP);

  try {
    // Using parameterized query to prevent SQL injection
    const query = `
  UPDATE BENZI_APP_USERS SET
    U_CARD_NAME = ?,
    U_VIEW_NAME = ?,
    U_SHIPTYPE = ?,
    U_TYPE = ?,
    U_PASSWORD = ?,
    U_EILAT_USER = ?,
    U_IP = ?
  WHERE U_CARD_CODE = ? AND U_USER_NAME = ?
`;

    const [results] = await pool.query(query, [
      U_CARD_NAME,
      U_VIEW_NAME,
      U_SHIPTYPE,
      U_TYPE,
      U_PASSWORD,
      U_EILAT_USER,
      U_IP,
      U_CARD_CODE,
      U_USER_NAME,
    ]);
    logger.info("updateUser result", { result: results });

    res.status(200).json({
      status: "success",
      result: results,
    });
  } catch (err) {
    logger.error("updateUser Database error", { error: err });
    res.status(500).json({
      status: "error",
      message: "Error creatNewUser fetching data",
    });
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
