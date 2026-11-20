import { apiFetch, getApiBaseUrl } from './apiConfig';

export interface PaymodeRecord {
  position: number;
  payMode: string;
  code: string;
  description: string;
  commission: number;
  active: boolean;
  isActive: boolean;
  serviceCharge: number;
  isEntertainment: boolean;
  isVoucher: boolean;
  paymodeImage?: string | null;
  extraCharges: number;
  deviceSN?: string;
  deviceSalt?: string;
  yeahPayEnabled?: boolean;
  createDate?: string;
  modifyDate?: string;
}

export interface SavePaymodeDto {
  payMode: string;
  newPayMode?: string;
  description: string;
  position?: number;
  commission?: number;
  active?: boolean;
  isActive?: boolean;
  serviceCharge?: number;
  isEntertainment?: boolean;
  isVoucher?: boolean;
  paymodeImage?: string | null;
  extraCharges?: number;
  deviceSN?: string;
  deviceSalt?: string;
  yeahPayEnabled?: boolean;
}

/**
 * Fetch all payment modes from dbo.Paymode
 */
export async function fetchAllPaymodes(includeInactive = true, search = ''): Promise<PaymodeRecord[]> {
  try {
    const params = new URLSearchParams();
    if (includeInactive) params.append('all', 'true');
    if (search && search.trim()) params.append('search', search.trim());

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await apiFetch(`/api/paymodes${qs}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch paymodes: HTTP ${res.status}`);
    }
    const json = await res.json();
    return json.data || [];
  } catch (err: any) {
    console.error('[paymodeApi] fetchAllPaymodes error:', err);
    throw err;
  }
}

/**
 * Fetch a single payment mode by code
 */
export async function fetchPaymodeById(payMode: string): Promise<PaymodeRecord> {
  const enc = encodeURIComponent(payMode.trim());
  const res = await apiFetch(`/api/paymodes/${enc}`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Failed to fetch paymode '${payMode}'`);
  }
  return json.data;
}

/**
 * Create a new payment mode in dbo.Paymode
 */
export async function createPaymode(payload: SavePaymodeDto): Promise<PaymodeRecord> {
  const res = await apiFetch('/api/paymodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Failed to create payment mode (${res.status})`);
  }
  return json.data;
}

/**
 * Update an existing payment mode in dbo.Paymode
 */
export async function updatePaymode(
  currentPayMode: string,
  payload: Partial<SavePaymodeDto> & { newPayMode?: string }
): Promise<PaymodeRecord> {
  const enc = encodeURIComponent(currentPayMode.trim());
  const res = await apiFetch(`/api/paymodes/${enc}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Failed to update payment mode '${currentPayMode}'`);
  }
  return json.data;
}

/**
 * Quick toggle active status
 */
export async function togglePaymodeActive(payMode: string, active: boolean): Promise<any> {
  const enc = encodeURIComponent(payMode.trim());
  const res = await apiFetch(`/api/paymodes/${enc}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Failed to update status for '${payMode}'`);
  }
  return json.data;
}

/**
 * Delete a payment mode from dbo.Paymode
 */
export async function deletePaymode(payMode: string, force = false): Promise<any> {
  const enc = encodeURIComponent(payMode.trim());
  const qs = force ? '?force=true' : '';
  const res = await apiFetch(`/api/paymodes/${enc}${qs}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    const error: any = new Error(json.message || `Failed to delete payment mode '${payMode}'`);
    error.isUsedInOrders = Boolean(json.isUsedInOrders);
    error.orderCount = json.orderCount;
    throw error;
  }
  return json;
}
