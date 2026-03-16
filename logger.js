const { createLogger, format, transports } = require("winston");
require("winston-daily-rotate-file");

const { combine, timestamp, printf, colorize } = format;

const customFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

const transport = new transports.DailyRotateFile({
  filename: "logs/%DATE%-app.log",
  datePattern: "YYYY-[W]WW", // פורמט שבועי: למשל 2025-W11
  zippedArchive: true, // דחיסת קבצים ישנים
  maxSize: "20m",
  maxFiles: "4w", // שומרים קבצים של 4 שבועות אחרונים
});

const logger = createLogger({
  level: "info",
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), customFormat),
  transports: [
    transport,
    new transports.Console({
      format: combine(colorize(), timestamp(), customFormat),
    }),
  ],
});

module.exports = logger;
