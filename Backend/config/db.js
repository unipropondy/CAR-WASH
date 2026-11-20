// Polyfill Promise.withResolvers for Node.js < 22 runtimes (e.g. Node 18/20 in containers)
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = {
  user: process.env.DB_USER || 'ups',
  password: process.env.DB_PASSWORD || 'ups',
  server: process.env.DB_SERVER || '202.156.19.151',
  port: parseInt(process.env.DB_PORT || '9199', 10),
  database: process.env.DB_NAME || 'UCSCARWASH',
  connectionTimeout: 45000,
  requestTimeout: 45000,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 30,
    min: 2,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;
let poolConnecting = null;

/**
 * Get or initialize the MSSQL connection pool
 */
async function getPool(retries = 3, delayMs = 2000) {
  if (pool && pool.connected) {
    return pool;
  }
  if (poolConnecting) {
    return poolConnecting;
  }

  poolConnecting = (async () => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (pool && !pool.connected) {
          try { await pool.close(); } catch (_) {}
          pool = null;
        }
        const currentConfig = { ...config };
        if (attempt === 2 && currentConfig.server === 'myerpcloud.dyndns.org') {
          currentConfig.server = '202.156.19.151';
        }
        const newPool = new sql.ConnectionPool(currentConfig);
        await newPool.connect();
        pool = newPool;
        console.log(`[Database] Connected to SQL Server database "${currentConfig.database}" at ${currentConfig.server}:${currentConfig.port}`);
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
  })();

  try {
    return await poolConnecting;
  } finally {
    poolConnecting = null;
  }
}

module.exports = {
  sql,
  getPool,
};

