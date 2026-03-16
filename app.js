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

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.get("/", (req, res) => {
  res.send("welcom to the testing api");
});
app.use("/cars", carRouter);
app.use("/filter", filterRouter);
app.use("/itemCard", itemCardRouts);
app.use("/users", usersRouts);
app.use("/cart", cartRoute);
app.use("/favorits", FavoritsRoute);
app.use("/armor", armorRouts);
app.use("/cron", cronRouter);
app.use("/bar", barRouter);

module.exports = app;
