import { apiFetch } from './apiConfig';
import { fetchPaymodes, PayModeOption } from './carwashOrderApi';

export type { PayModeOption };

export interface DealerRecord {
  dealerId: number;
  uniqueCode: string;
  dealerName: string;
  contactNumber: string;
  contactPerson?: string;
  address: string;
  securityPin: string;
  billingCycle?: string;
  logoUrl?: string;
  isActive: boolean;
  createdDate?: string;
}

export interface CreateDealerPayload {
  uniqueCode: string;
  dealerName: string;
  contactNumber?: string;
  contactPerson?: string;
  address?: string;
  securityPin?: string;
  billingCycle?: string;
  logoUrl?: string;
  isActive?: boolean;
}

const DEALER_CACHE_KEY = '@redbay_cached_dealers';
let memoryDealerCache: DealerRecord[] | null = null;

export function getCachedDealers(): DealerRecord[] {
  if (memoryDealerCache && memoryDealerCache.length > 0) {
    return memoryDealerCache;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(DEALER_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryDealerCache = parsed;
          return parsed;
        }
      }
    } catch (e) {}
  }
  return [];
}

export function setCachedDealers(dealers: DealerRecord[]) {
  if (!Array.isArray(dealers) || dealers.length === 0) return;
  memoryDealerCache = dealers;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(DEALER_CACHE_KEY, JSON.stringify(dealers));
    } catch (e) {}
  }
}

export async function fetchAllDealers(includeAll: boolean = true, search?: string): Promise<DealerRecord[]> {
  const params = new URLSearchParams();
  if (includeAll) params.append('all', 'true');
  if (search) params.append('search', search);

  try {
    const res = await apiFetch(`/api/dealers?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch dealers');
    }
    const data = await res.json();
    const list = data.data || [];
    if (!includeAll && !search && list.length > 0) {
      setCachedDealers(list);
    }
    return list;
  } catch (err: any) {
    const cached = getCachedDealers();
    if (cached.length > 0) {
      return cached;
    }
    throw err;
  }
}

export async function createDealer(payload: CreateDealerPayload): Promise<DealerRecord> {
  const res = await apiFetch('/api/dealers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to create dealer');
  }
  return data.data;
}

export async function updateDealer(
  id: number | string,
  payload: Partial<CreateDealerPayload>
): Promise<DealerRecord> {
  const res = await apiFetch(`/api/dealers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to update dealer');
  }
  return data.data;
}

export async function deleteDealer(id: number | string): Promise<boolean> {
  const res = await apiFetch(`/api/dealers/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to delete dealer');
  }
  return true;
}

// =========================================================================
// DEALER CREDIT & SETTLEMENT INTERFACES & API METHODS
// =========================================================================

export interface DealerCreditAppliedPayment {
  paymentId: number;
  receiptNo: string;
  paymentDate: string;
  paymentMode: string;
  allocatedAmount: number;
  previousOutstanding: number;
  newOutstanding: number;
  billStatusAfterPayment: string;
  referenceNo?: string;
  remarks?: string;
  processedBy?: string;
}

export interface DealerCreditBillItem {
  orderId: number;
  billNumber: string;
  orderDateTime: string;
  dealerId: number;
  dealerName: string;
  dealerCode: string;
  dealerPhone?: string;
  dealerContactPerson?: string;
  vehicleNumber: string;
  vehicleTypeId?: number;
  vehicleType: string;
  packageId?: number;
  selectedPackage: string;
  additionalServices: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  creditStatus: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | string;
  statusCode?: number;
  paymentStatus?: string;
  payments?: DealerCreditAppliedPayment[];
}

export interface DealerCreditSummary {
  totalCreditSales: number;
  totalPaidAmount: number;
  totalOutstandingAmount: number;
  totalBillsCount: number;
}

export interface DealerCreditHistoryResponse {
  success: boolean;
  count: number;
  summary: DealerCreditSummary;
  data: DealerCreditBillItem[];
}

export async function fetchDealerCreditHistory(params?: {
  dealerId?: number;
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}): Promise<DealerCreditHistoryResponse> {
  const q = new URLSearchParams();
  if (params?.dealerId) q.append('dealerId', String(params.dealerId));
  if (params?.status) q.append('status', params.status);
  if (params?.search) q.append('search', params.search);
  if (params?.startDate) q.append('startDate', params.startDate);
  if (params?.endDate) q.append('endDate', params.endDate);

  const res = await apiFetch(`/api/dealers/credit/history?${q.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch credit history');
  }
  return res.json();
}

export async function fetchDealerOutstandingBills(dealerId?: number): Promise<{
  success: boolean;
  count: number;
  totalOutstanding: number;
  data: DealerCreditBillItem[];
}> {
  const q = new URLSearchParams();
  if (dealerId) q.append('dealerId', String(dealerId));

  const res = await apiFetch(`/api/dealers/credit/outstanding?${q.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch outstanding credit bills');
  }
  return res.json();
}

export interface SettleDealerCreditPayload {
  dealerId: number;
  paymentAmount: number;
  paymentMode: string;
  referenceNo?: string;
  remarks?: string;
  processedBy?: string;
  selectedBillIds?: number[];
  billAllocations?: Array<{ orderId: number; amount: number }>;
}

export interface SettleDealerCreditResult {
  paymentId: number;
  receiptNo: string;
  dealerId: number;
  dealerName: string;
  paymentDate: string;
  paymentAmount: number;
  paymentMode: string;
  referenceNo?: string;
  remarks?: string;
  processedBy: string;
  settledBills: Array<{
    orderId: number;
    orderNo: string;
    allocatedAmount: number;
    previousOutstanding: number;
    newOutstanding: number;
    creditStatus: string;
    isClosed: boolean;
  }>;
}

export async function settleDealerCreditPayment(payload: SettleDealerCreditPayload): Promise<{
  success: boolean;
  message: string;
  data: SettleDealerCreditResult;
}> {
  const res = await apiFetch('/api/dealers/credit/settle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to settle dealer credit');
  }
  return data;
}

export interface DealerPaymentRecord {
  paymentId: number;
  receiptNo: string;
  dealerId: number;
  dealerName: string;
  dealerCode?: string;
  paymentDate: string;
  paymentAmount: number;
  paymentMode: string;
  referenceNo: string;
  remarks: string;
  processedBy: string;
  settledBills: Array<{
    orderId: number;
    billNumber: string;
    allocatedAmount: number;
    previousOutstanding: number;
    newOutstanding: number;
    billStatusAfterPayment: string;
  }>;
}

export async function fetchDealerPaymentHistory(dealerId?: number): Promise<DealerPaymentRecord[]> {
  const q = new URLSearchParams();
  if (dealerId) q.append('dealerId', String(dealerId));

  const res = await apiFetch(`/api/dealers/credit/payments?${q.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch payment history');
  }
  const data = await res.json();
  return data.data || [];
}

export interface DealerVehicleHistorySummary {
  dealerId: number;
  uniqueCode: string;
  dealerName: string;
  contactNumber: string;
  contactPerson: string;
  billingCycle?: string;
  isActive: boolean;
  totalVisits: number;
  totalVehiclesServiced: number;
  totalOrders: number;
  totalAmount: number;
  totalPaidAmount: number;
  totalOutstandingCredit: number;
  lastVisitDate: string | null;
}

export async function fetchDealerVehicleHistorySummary(): Promise<DealerVehicleHistorySummary[]> {
  const res = await apiFetch('/api/dealers/history/summary');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch dealer vehicle history summary');
  }
  const data = await res.json();
  return data.data || [];
}

export interface DealerDetailedVisit {
  orderId: number;
  visitDateTime: string;
  billNumber: string;
  dealerId: number;
  dealerName: string;
  dealerCode?: string;
  vehicleNumber: string;
  vehicleType: string;
  packageSelected: string;
  additionalServices: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  paymentStatus: string;
  washStatus: string;
}

export async function fetchDealerPaymodes(): Promise<PayModeOption[]> {
  try {
    const res = await apiFetch('/api/dealers/paymodes');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        return json.data;
      }
    }
  } catch {
    // fallback
  }
  return fetchPaymodes();
}

export async function fetchDealerDetailedVisits(dealerId?: number, search?: string): Promise<DealerDetailedVisit[]> {
  const q = new URLSearchParams();
  if (dealerId) q.append('dealerId', String(dealerId));
  if (search) q.append('search', search);

  const res = await apiFetch(`/api/dealers/history/visits?${q.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch detailed visits');
  }
  const data = await res.json();
  return data.data || [];
}
