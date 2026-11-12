const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = {
  user: process.env.DB_USER || 'ups',
  password: process.env.DB_PASSWORD || 'ups',
  server: process.env.DB_SERVER || '202.156.19.151',
  port: parseInt(process.env.DB_PORT || '9199', 10),
  database: process.env.DB_NAME || 'UCSSMOKE',
  connectionTimeout: 45000,
  requestTimeout: 45000,
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
async function getPool(retries = 3, delayMs = 2000) {
  if (pool && pool.connected) {
    return pool;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (pool) {
        try { await pool.close(); } catch (_) {}
        pool = null;
      }
      const newPool = new sql.ConnectionPool(config);
      await newPool.connect();
      pool = newPool;
      console.log(`[Database] Connected to SQL Server database "${config.database}" at ${config.server}:${config.port}`);
      return pool;
    } catch (err) {
      console.error(`[Database] Connection attempt ${attempt}/${retries} failed:`, err.message);
      if (pool) {
        try { await pool.close(); } catch (_) {}
        pool = null;
      }
      if (attempt === retries) {
        throw err;
      }
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

module.exports = {
  sql,
  getPool,
};

