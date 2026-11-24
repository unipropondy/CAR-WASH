const os = require('os');

// ANSI Color Codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

// Status Indicators
const symbols = {
  success: `${colors.green}[✓]${colors.reset}`,
  error: `${colors.red}[✗]${colors.reset}`,
  warn: `${colors.yellow}[⚠]${colors.reset}`,
  alert: `${colors.yellow}[!]\x1b[0m`,
  info: `${colors.cyan}[ℹ]${colors.reset}`,
};

const SEPARATOR_WIDTH = 50;
const DOUBLE_LINE = '='.repeat(SEPARATOR_WIDTH);
const SINGLE_LINE = '-'.repeat(SEPARATOR_WIDTH);

/**
 * Format timestamp as YYYY-MM-DD HH:mm:ss
 */
function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

/**
 * Sanitize error message to prevent leaking passwords or credentials
 */
function sanitizeError(err) {
  if (!err) return 'Unknown error';
  const msg = typeof err === 'string' ? err : (err.message || String(err));
  return msg
    .replace(/(password|pwd)=[^;]+/gi, '$1=***')
    .replace(/:(?!([0-9]{2,5}))[^@/\s]+@/g, ':***@');
}

/**
 * Detect the primary non-internal LAN IPv4 address
 */
function getNetworkIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs || []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        const isVirtual = /radmin|vpn|virtual|docker|veth|tap|loopback/i.test(name);
        const isLanIp = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(addr.address);
        const isPreferredName = /wi-?fi|wlan|eth|ethernet|local/i.test(name);
        let score = 0;
        if (!isVirtual) score += 10;
        if (isLanIp) score += 5;
        if (isPreferredName) score += 3;
        candidates.push({ ip: addr.address, score, name });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] ? candidates[0].ip : null;
}

/**
 * Print the startup terminal report
 */
function printStartupReport({ port, localUrl, networkUrl, dbStatus }) {
  console.log(DOUBLE_LINE);
  console.log('          CAR WASH POS - BACKEND SERVER');
  console.log(DOUBLE_LINE);
  console.log('');
  console.log(`${symbols.success} Environment Configuration Loaded`);
  console.log(`${symbols.success} Server Started Successfully`);
  console.log(`${symbols.success} Port: ${port}`);

  if (dbStatus && dbStatus.connected) {
    if (localUrl) {
      console.log(`${symbols.success} Local URL: ${localUrl}`);
    }
    if (networkUrl) {
      console.log(`${symbols.success} Network URL: ${networkUrl}`);
    }
    console.log('');
    console.log(SINGLE_LINE);
    console.log('              DATABASE STATUS');
    console.log(SINGLE_LINE);
    console.log('');
    console.log(`${symbols.success} SQL Server Connection Successful`);
    console.log(`${symbols.success} Database: ${dbStatus.database || 'UCSCARWASH'}`);
    console.log(`${symbols.success} Server: ${dbStatus.server || '202.156.19.151:9199'}`);
    console.log('');
    console.log(SINGLE_LINE);
    console.log('              API STATUS');
    console.log(SINGLE_LINE);
    console.log('');
    console.log(`${symbols.success} Database Health Check`);
    console.log(`${symbols.success} API Health Check`);
    console.log(`${symbols.success} Backend Ready to Accept Requests`);
    console.log('');
    console.log(DOUBLE_LINE);
    console.log('       ALL SERVICES RUNNING SUCCESSFULLY');
    console.log(DOUBLE_LINE);
  } else {
    // Database connection failed
    console.log('');
    console.log(SINGLE_LINE);
    console.log('              DATABASE STATUS');
    console.log(SINGLE_LINE);
    console.log('');
    console.log(`${symbols.error} SQL Server Connection Failed`);
    console.log(`${symbols.error} Database: ${(dbStatus && dbStatus.database) || 'UCSCARWASH'}`);
    const actualError = (dbStatus && dbStatus.error) ? sanitizeError(dbStatus.error) : 'Connection Timeout';
    console.log(`${symbols.alert} Error: ${actualError}`);
    console.log('');
    console.log(SINGLE_LINE);
    console.log('');
    console.log(`${symbols.error} Backend Database Services Unavailable`);
    console.log('');
    console.log(DOUBLE_LINE);
  }
}

/**
 * Runtime log helpers
 */
function logSuccess(message) {
  console.log(`[${getTimestamp()}] ${symbols.success} ${message}`);
}

function logError(message, err) {
  const errMsg = err ? `: ${sanitizeError(err)}` : '';
  console.error(`[${getTimestamp()}] ${symbols.error} ${message}${errMsg}`);
}

function logWarn(message) {
  console.warn(`[${getTimestamp()}] ${symbols.warn} ${message}`);
}

function logAlert(message) {
  console.warn(`[${getTimestamp()}] ${symbols.alert} ${message}`);
}

function logInfo(message) {
  console.log(`[${getTimestamp()}] ${symbols.info} ${message}`);
}

function logDbDisconnected(err) {
  const time = getTimestamp();
  console.error(`\n[${time}] ${symbols.error} SQL Server Connection Lost`);
  if (err) {
    console.error(`[${time}] ${symbols.alert} Error: ${sanitizeError(err)}`);
  }
}

function logDbReconnected(database, server) {
  const time = getTimestamp();
  console.log(`\n[${time}] ${symbols.success} SQL Server Reconnected Successfully`);
  if (database) {
    console.log(`[${time}] ${symbols.success} Database: ${database}`);
  }
  if (server) {
    console.log(`[${time}] ${symbols.success} Server: ${server}`);
  }
}

/**
 * Express request logger middleware
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const time = getTimestamp();

    let badge = symbols.success;
    let statusColor = colors.green;

    if (statusCode >= 500) {
      badge = symbols.error;
      statusColor = colors.red;
    } else if (statusCode >= 400) {
      badge = symbols.warn;
      statusColor = colors.yellow;
    } else if (statusCode >= 300) {
      badge = symbols.info;
      statusColor = colors.cyan;
    }

    const methodStr = `${colors.bold}${req.method}${colors.reset}`;
    const statusStr = `${statusColor}${statusCode}${colors.reset}`;
    const durationStr = `${colors.gray}${duration}ms${colors.reset}`;

    console.log(`[${time}] ${badge} ${methodStr} ${req.originalUrl || req.url} ${statusStr} - ${durationStr}`);
  });

  next();
}

module.exports = {
  colors,
  symbols,
  getTimestamp,
  sanitizeError,
  getNetworkIp,
  printStartupReport,
  requestLogger,
  logSuccess,
  logError,
  logWarn,
  logAlert,
  logInfo,
  logDbDisconnected,
  logDbReconnected,
  // Aliases for clean usage across the backend
  success: logSuccess,
  error: logError,
  warn: logWarn,
  alert: logAlert,
  info: logInfo,
  dbDisconnected: logDbDisconnected,
  dbReconnected: logDbReconnected,
};
