const express = require("express");
const cors = require("cors");

const carRouter = require("./routers/carRouts");
const filterRouter = require("./routers/filterRouts");
const itemCardRouts = require("./routers/itemCardRouts");
const usersRouts = require("./routers/usersRouts");
const cartRoute = require("./routers/cartRouts");
const FavoritsRoute = require("./routers/FavoritsRouts");
const armorRouts = require("./routers/armorRouts");
const cronRouter = require("./routers/cronRouter");
const barRouter = require("./routers/barRouts");
const noamRouter = require("./routers/noamRouts");
const carsTableRouter = require("./routers/carsTableRouts");
const childGroupSearchRouter = require("./routers/childGroupSearchRouts");

const app = express();
// Configure only known reverse-proxy addresses/CIDRs, never trust arbitrary forwarded headers.
if (process.env.TRUSTED_PROXY_CIDRS) app.set('trust proxy', process.env.TRUSTED_PROXY_CIDRS.split(',').map(value => value.trim()));
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.get("/", (req, res) => {
  res.send("welcom to the testing api");
});
const { authenticate, requireSuperAdmin } = require('./security/sessions');
const customerScope = require('./security/customerScope');
app.use('/users', usersRouts);
app.use(authenticate, customerScope);
app.use(['/cron', '/noam', '/carsTable', '/childGroupSearch'], requireSuperAdmin);
app.use('/cars', carRouter);
app.use("/filter", filterRouter);
app.use("/itemCard", itemCardRouts);

app.use("/cart", cartRoute);
app.use("/favorits", FavoritsRoute);
app.use("/armor", armorRouts);
app.use("/cron", cronRouter);
app.use("/bar", barRouter);
app.use("/noam", noamRouter);
app.use("/carsTable", carsTableRouter);
app.use("/childGroupSearch", childGroupSearchRouter);

module.exports = app;
