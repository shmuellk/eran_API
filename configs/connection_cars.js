const mysql = require("mysql2");
const dotenv = require("dotenv").config();

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.host,
  user: process.env.user,
  password: process.env.password,
  database: process.env.database,
  waitForConnections: true,
  connectionLimit: 10, // Set a limit on concurrent connections
  queueLimit: 0, // Allow unlimited queue for requests
});

module.exports = pool.promise(); // Export the pool with promise support
