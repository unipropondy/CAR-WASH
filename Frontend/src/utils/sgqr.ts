/**
 * Singapore SGQR / PayNow EMVCo Specification Generator
 * Generates mathematically valid TLV (Tag-Length-Value) PayNow QR strings with CRC16-CCITT checksum.
 */

/**
 * Calculates standard CRC16-CCITT checksum (polynomial 0x1021, seed 0xFFFF)
 */
export function calculateCrc16Ccitt(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Helper to encode standard EMVCo Tag-Length-Value
 */
function formatTlv(id: string, val: string): string {
  const len = val.length.toString().padStart(2, '0');
  return `${id}${len}${val}`;
}

export interface BuildSgQrOptions {
  uen: string;
  amount: number;
  orderRef?: string;
  merchantName?: string;
}

/**
 * Generates authentic EMVCo SGQR string for PayNow
 */
export function buildValidSgQrString({
  uen,
  amount,
  orderRef = 'RB-001',
  merchantName = 'REDBAY CAR WASH',
}: BuildSgQrOptions): string {
  const cleanUen = uen.trim();
  if (!cleanUen) return '';

  const amtStr = Number(amount).toFixed(2);

  // Tag 26: PayNow Merchant Account Information Template
  const paynowSub =
    formatTlv('00', 'SG.PAYNOW') +
    formatTlv('01', '2') + // 2 = UEN Proxy Type
    formatTlv('02', cleanUen) + // Merchant UEN
    formatTlv('03', '0'); // 0 = Fixed Amount (not customer-editable)

  const tag00 = formatTlv('00', '01'); // Payload Format Indicator
  const tag01 = formatTlv('01', '12'); // Dynamic QR Code
  const tag26 = formatTlv('26', paynowSub);
  const tag52 = formatTlv('52', '5812'); // Merchant Category Code (MCC)
  const tag53 = formatTlv('53', '702'); // Transaction Currency (702 = SGD)
  const tag54 = formatTlv('54', amtStr); // Transaction Amount (Exact length-prefixed)
  const tag58 = formatTlv('58', 'SG'); // Country Code
  const tag59 = formatTlv('59', merchantName.substring(0, 25)); // Merchant Name
  const tag60 = formatTlv('60', 'Singapore'); // Merchant City

  // Tag 62: Additional Data Field (Order Reference)
  const cleanRef = orderRef.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 25);
  const addDataSub = formatTlv('01', cleanRef || 'RB-001');
  const tag62 = formatTlv('62', addDataSub);

  // Tag 63: CRC16 Checksum
  const rawPayloadWithoutCrc = `${tag00}${tag01}${tag26}${tag52}${tag53}${tag54}${tag58}${tag59}${tag60}${tag62}6304`;
  const checksum = calculateCrc16Ccitt(rawPayloadWithoutCrc);

  return `${rawPayloadWithoutCrc}${checksum}`;
}
