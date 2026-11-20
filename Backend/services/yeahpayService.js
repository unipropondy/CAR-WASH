const crypto = require('crypto');

const YEAPAY_SYNC_URL = process.env.YEAPAY_SYNC_URL || 'https://business.yeahpay.sg/acceptance/acceptance-mis-pos/sync';

/**
 * Recursively sorts object keys alphabetically (matching YeahPay signing specification)
 */
function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  return Object.keys(obj)
    .sort()
    .reduce((res, key) => {
      if (obj[key] !== null && obj[key] !== undefined && obj[key] !== '') {
        res[key] = sortObjectKeys(obj[key]);
      }
      return res;
    }, {});
}

/**
 * Formats public key string into PEM if missing headers
 */
function formatPublicKey(pem) {
  if (!pem) return '';
  const clean = pem.replace(/\\n/g, '\n').trim();
  if (clean.includes('-----BEGIN')) return clean;
  return `-----BEGIN PUBLIC KEY-----\n${clean}\n-----END PUBLIC KEY-----`;
}

/**
 * Formats private key string into PEM if missing headers
 */
function formatPrivateKey(pem) {
  if (!pem) return '';
  const clean = pem.replace(/\\n/g, '\n').trim();
  if (clean.includes('-----BEGIN')) return clean;
  // Fallback to RSA PRIVATE KEY header if not specified
  return `-----BEGIN RSA PRIVATE KEY-----\n${clean}\n-----END RSA PRIVATE KEY-----`;
}

/**
 * Encrypt payload using AES-128-CBC and RSA-2048 PKCS1
 */
function encryptYeahPayPayload(data, salt, serverPublicKeyPem) {
  const aesKey = crypto.randomBytes(16);
  const iv = crypto.randomBytes(16);

  const sortedData = sortObjectKeys(data);
  const dataJson = JSON.stringify(sortedData);

  // SHA256 Signature: (salt + dataJson)
  const sign = crypto.createHash('sha256').update((salt || '') + dataJson).digest('hex');

  // AES-128-CBC Encrypt
  const cipher = crypto.createCipheriv('aes-128-cbc', aesKey, iv);
  let encryptedData = cipher.update(dataJson, 'utf8', 'hex');
  encryptedData += cipher.final('hex');

  // RSA Encrypt AES Key with YeahPay Public Key
  const pubKey = formatPublicKey(serverPublicKeyPem);
  const encryptedKey = crypto.publicEncrypt(
    { key: pubKey, padding: crypto.constants.RSA_PKCS1_PADDING },
    aesKey
  ).toString('hex');

  return {
    encryptedKey,
    encryptedData,
    ivHex: iv.toString('hex'),
    sign
  };
}

/**
 * Decrypt response using RSA Client Private Key and AES-128-CBC
 */
function decryptYeahPayResponse(encryptedKeyHex, encryptedDataHex, ivHex, clientPrivateKeyPem) {
  const privKey = formatPrivateKey(clientPrivateKeyPem);
  const decryptedAesKey = crypto.privateDecrypt(
    { key: privKey, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(encryptedKeyHex, 'hex')
  );

  const decipher = crypto.createDecipheriv(
    'aes-128-cbc',
    decryptedAesKey,
    Buffer.from(ivHex, 'hex')
  );

  let decrypted = decipher.update(encryptedDataHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

/**
 * Main dispatcher to send encrypted payload to YeahPay Terminal API
 */
async function sendYeahPayRequest({
  action,
  data,
  deviceSn,
  salt,
  appId,
  serverPublicKey,
  clientPrivateKey,
  timeoutMs = 180000
}) {
  if (!serverPublicKey) {
    throw new Error('YeahPay Server Public Key (YEAPAY_PUBLIC_KEY) is not configured');
  }
  if (!clientPrivateKey) {
    throw new Error('YeahPay Client Private Key (YEAPAY_PRIVATE_KEY) is not configured');
  }
  if (!deviceSn) {
    throw new Error('Terminal DeviceSN is required');
  }

  const { encryptedKey, encryptedData, ivHex, sign } = encryptYeahPayPayload(
    data,
    salt,
    serverPublicKey
  );

  const requestBody = {
    key: encryptedKey,
    data: encryptedData,
    messageHeader: {
      action,
      deviceSn,
      messageType: 'Request',
      protocolVersion: '1.0',
      serviceId: crypto.randomUUID()
    },
    securityTrailer: {
      cryptoVersion: '1.0',
      nonce: ivHex,
      sign
    }
  };

  const response = await fetch(YEAPAY_SYNC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      appId: appId || ''
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`YeahPay Gateway HTTP Error ${response.status}: ${errorText}`);
  }

  const respJson = await response.json();

  if (!respJson.key || !respJson.data) {
    throw new Error(`Invalid response structure from YeahPay: ${JSON.stringify(respJson)}`);
  }

  const nonce = respJson.securityTrailer?.nonce;
  const parsed = decryptYeahPayResponse(
    respJson.key,
    respJson.data,
    nonce,
    clientPrivateKey
  );

  return {
    success: parsed.code === 0,
    code: parsed.code,
    msg: parsed.msg,
    data: parsed
  };
}

module.exports = {
  sortObjectKeys,
  encryptYeahPayPayload,
  decryptYeahPayResponse,
  sendYeahPayRequest
};
