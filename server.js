require("dotenv").config();
const fs = require("fs");
const http = require("http");
const https = require("https");
const app = require("./app");

// הגדרת פורטים עבור HTTP ו-HTTPS
const httpPort = process.env.port || 80;
const httpsPort = process.env.sslPort || 443;

// קריאת קבצי המפתח והאישור עבור HTTPS
const httpsOptions = {
  key: fs.readFileSync("key.pem"),
  cert: fs.readFileSync("cert.pem"),
};

// יצירת שרת HTTP
const httpServer = http.createServer(app);
httpServer.listen(httpPort, () => {
  console.log(`שרת HTTP מאזין על הפורט ${httpPort}`);
});

// יצירת שרת HTTPS
const httpsServer = https.createServer(httpsOptions, app);
httpsServer.listen(httpsPort, () => {
  console.log(`שרת HTTPS מאזין על הפורט ${httpsPort}`);
});
