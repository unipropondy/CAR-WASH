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
const logger = require('../utils/logger');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

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
let isConnected = false;
let hasReportedStartup = false;
let monitorInterval = null;

function markStartupReported() {
  hasReportedStartup = true;
}

function isDbConnected() {
  return isConnected && pool && pool.connected;
}

function attachPoolErrorListener(targetPool) {
  if (!targetPool || targetPool._hasCustomErrorHandler) return;
  targetPool._hasCustomErrorHandler = true;

  targetPool.on('error', (err) => {
    if (isConnected) {
      isConnected = false;
      if (hasReportedStartup) {
        logger.logDbDisconnected(err.message);
      }
    }
  });
}

/**
 * Initial fast connection probe for startup status report
 */
async function checkInitialConnection() {
  const currentConfig = { ...config };
  try {
    const probePool = new sql.ConnectionPool({
      ...currentConfig,
      connectionTimeout: 5000,
      requestTimeout: 5000,
    });
    await probePool.connect();
    pool = probePool;
    isConnected = true;
    attachPoolErrorListener(pool);

    return {
      connected: true,
      database: currentConfig.database,
      server: `${currentConfig.server}:${currentConfig.port}`,
    };
  } catch (err) {
    isConnected = false;
    return {
      connected: false,
      database: currentConfig.database,
      server: `${currentConfig.server}:${currentConfig.port}`,
      error: err.message,
    };
  }
}

/**
 * Periodic background monitor to detect disconnections and automatic reconnects
 */
function startConnectionMonitor(intervalMs = 15000) {
  if (monitorInterval) return;

  monitorInterval = setInterval(async () => {
    if (pool && isConnected) {
      try {
        await pool.request().query('SELECT 1');
      } catch (err) {
        if (isConnected) {
          isConnected = false;
          if (hasReportedStartup) {
            logger.logDbDisconnected(err.message);
          }
          try { await pool.close(); } catch (_) {}
          pool = null;
        }
      }
    } else if (!isConnected && hasReportedStartup) {
      try {
        await getPool(1, 1000);
      } catch (_) {
        // Silently retry on the next cycle
      }
    }
  }, intervalMs);

  if (monitorInterval.unref) {
    monitorInterval.unref();
  }
}

/**
 * Get or initialize the MSSQL connection pool
 */
async function getPool(retries = 3, delayMs = 2000) {
  if (pool && pool.connected) {
    isConnected = true;
    return pool;
  }
  if (poolConnecting) {
    return poolConnecting;
  }

  poolConnecting = (async () => {
    const wasDisconnected = !isConnected && hasReportedStartup;

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
        isConnected = true;
        attachPoolErrorListener(pool);

        if (wasDisconnected) {
          logger.logDbReconnected(currentConfig.database, `${currentConfig.server}:${currentConfig.port}`);
        }

        return pool;
      } catch (err) {
        if (pool) {
          try { await pool.close(); } catch (_) {}
          pool = null;
        }
        if (attempt === retries) {
          if (isConnected) {
            isConnected = false;
            if (hasReportedStartup) {
              logger.logDbDisconnected(err.message);
            }
          }
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
  checkInitialConnection,
  startConnectionMonitor,
  markStartupReported,
  isDbConnected,
};
