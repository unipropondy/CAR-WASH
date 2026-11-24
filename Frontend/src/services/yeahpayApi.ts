import { apiFetch, getApiBaseUrl } from './apiConfig';

export interface ProcessYeahPayRequest {
  orderId?: number;
  payMode: 'YEAHPAY_QR' | 'YEAHPAY_CARD' | string;
  cashierName?: string;
  amount?: number;
  deviceSn?: string;
  salt?: string;
  timeoutMs?: number;
}

export interface YeahPayResponse {
  success: boolean;
  code: number;
  message?: string;
  msg?: string;
  bizOrderId?: string;
  orderId?: number;
  statusCode?: number;
  qrCode?: string;
  qrImageUrl?: string;
  data?: any;
}

/**
 * Dispatches payment transaction to backend, which communicates with YeahPay Smart Terminal.
 * Uses 180,000ms (3 minutes) timeout by default to allow customer time to scan SGQR or tap card.
 */
export async function processYeahPayPayment(
  payload: ProcessYeahPayRequest,
  token?: string,
  timeoutMs: number = 180000
): Promise<YeahPayResponse> {
  const isCard = String(payload.payMode).toUpperCase().includes('CARD');
  const endpoint = isCard ? '/api/yeahpay/card-payment' : '/api/yeahpay/paynow-payment';
  const url = `${getApiBaseUrl()}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const effectiveTimeout = payload.timeoutMs || timeoutMs;

  const res = await apiFetch(
    url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    },
    effectiveTimeout
  );

  const json = await res.json();
  if (!res.ok || (!json.success && json.code !== 0)) {
    throw new Error(json.msg || json.message || `YeahPay payment failed (HTTP ${res.status})`);
  }

  return json;
}
