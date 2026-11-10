const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;

/**
 * Get or initialize the MSSQL connection pool
 */
async function getPool() {
  if (pool && pool.connected) {
    return pool;
  }

  try {
    pool = await sql.connect(config);
    console.log(`[Database] Connected to SQL Server database "${config.database}" at ${config.server}:${config.port}`);
    return pool;
  } catch (err) {
    console.error('[Database] Connection failed:', err.message);
    pool = null;
    throw err;
  }
}

module.exports = {
  sql,
  getPool,
};

