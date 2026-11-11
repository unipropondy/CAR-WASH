import { apiFetch, getApiBaseUrl } from './apiConfig';

export interface DayStatusResponse {
  success: boolean;
  isOpen: boolean;
  activeDayId: number | null;
  businessDate?: string;
  message?: string;
  activeDay?: DayMetrics | null;
  lastClosedDay?: any | null;
}

export interface DayTenderItem {
  payMode: string;
  count: number;
  amount: number;
}

export interface PackageBreakdownItem {
  packageName: string;
  orderCount: number;
  totalAmount: number;
}

export interface DayMetrics {
  dayId: number;
  businessDate: string;
  dayStatus: 'OPEN' | 'CLOSED';
  startedBy: string;
  startedDate: string;
  endedBy?: string | null;
  endedDate?: string | null;
  startRemarks?: string | null;
  closingRemarks?: string | null;
  openingCash: number;
  closingCash?: number | null;
  expectedCash: number;
  cashDifference?: number | null;
  totalOrders: number;
  totalSales: number;
  totalCustomerSales: number;
  totalDealerSales: number;
  packageSales: number;
  addonSales: number;
  aLaCarteSales: number;
  cashSales: number;
  cardSales: number;
  onlineSales: number;
  otherSales: number;
  totalCashIn: number;
  totalCashOut: number;
  totalDiscounts: number;
  totalRefunds: number;
  cashRefunds: number;
  pendingPaymentsCount: number;
  pendingPaymentsAmount: number;
  incompleteWashOrdersCount: number;
  completedWashOrdersCount: number;
  closedWashOrdersCount: number;
  cancelledWashOrdersCount: number;
  tenders: DayTenderItem[];
  packageBreakdown: PackageBreakdownItem[];
}

export interface DenominationItem {
  type: 'NOTE' | 'COIN';
  value: number;
  label: string;
  count: number;
}

export interface ClosingPreviewResponse {
  success: boolean;
  canClose: boolean;
  blockingIssues: string[];
  warnings: string[];
  summary: DayMetrics;
  standardDenominations: { type: 'NOTE' | 'COIN'; value: number; label: string }[];
}

export interface CashMovementRecord {
  movementId: number;
  dayId: number;
  movementType: 'CASH_IN' | 'CASH_OUT';
  amount: number;
  reason: string;
  remarks?: string | null;
  performedBy: string;
  createdDate: string;
}

export interface DayAuditRecord {
  auditId: number;
  dayId: number;
  eventType: string;
  actionBy: string;
  actionDate: string;
  details?: any;
  ipAddress?: string | null;
  remarks?: string | null;
}

export interface DayClosingReport {
  dayId: number;
  businessDate: string;
  dayStatus: 'CLOSED';
  startedBy: string;
  startedDate: string;
  endedBy: string;
  endedDate: string;
  openingCash: number;
  actualClosingCash: number;
  expectedCash: number;
  cashDifference: number;
  varianceStatus: 'BALANCED' | 'SURPLUS' | 'SHORTAGE';
  totalOrders: number;
  totalSales: number;
  totalCustomerSales: number;
  totalDealerSales: number;
  packageSales: number;
  addonSales: number;
  aLaCarteSales: number;
  cashSales: number;
  cardSales: number;
  onlineSales: number;
  otherSales: number;
  totalCashIn: number;
  totalCashOut: number;
  totalRefunds: number;
  closingRemarks: string;
  tenders: DayTenderItem[];
  packageBreakdown: PackageBreakdownItem[];
}

/**
 * 1. GET /api/day-management/status
 */
export async function fetchDayStatus(): Promise<DayStatusResponse> {
  const res = await apiFetch('/api/day-management/status');
  if (!res.ok) {
    throw new Error(`Failed to fetch day status: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * 2. POST /api/day-management/start
 */
export async function startBusinessDay(payload: {
  openingCash: number;
  remarks?: string;
  startedBy?: string;
  businessDate?: string;
}): Promise<{ success: boolean; message: string; data: any }> {
  const res = await apiFetch('/api/day-management/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Failed to start business day: HTTP ${res.status}`);
  }
  return json;
}

/**
 * 3. GET /api/day-management/summary
 */
export async function fetchDaySummary(dayId?: number): Promise<DayMetrics> {
  const url = dayId ? `/api/day-management/summary?dayId=${dayId}` : '/api/day-management/summary';
  const res = await apiFetch(url);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Failed to fetch day summary: HTTP ${res.status}`);
  }
  return json.data;
}

/**
 * 4. POST /api/day-management/cash-movement
 */
export async function submitCashMovement(payload: {
  movementType: 'CASH_IN' | 'CASH_OUT';
  amount: number;
  reason: string;
  remarks?: string;
  performedBy?: string;
}): Promise<{ success: boolean; message: string; data: CashMovementRecord }> {
  const res = await apiFetch('/api/day-management/cash-movement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Failed to record cash movement: HTTP ${res.status}`);
  }
  return json;
}

/**
 * 5. GET /api/day-management/closing-preview
 */
export async function fetchClosingPreview(): Promise<ClosingPreviewResponse> {
  const res = await apiFetch('/api/day-management/closing-preview');
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Failed to fetch closing preview: HTTP ${res.status}`);
  }
  return json;
}

/**
 * 6. POST /api/day-management/close
 */
export async function closeBusinessDay(payload: {
  closingCash: number;
  denominations?: { type: string; value: number; count: number }[];
  closingRemarks?: string;
  endedBy?: string;
  forceClose?: boolean;
}): Promise<{ success: boolean; message: string; report: DayClosingReport }> {
  const res = await apiFetch('/api/day-management/close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Failed to close business day: HTTP ${res.status}`);
  }
  return json;
}

/**
 * 7. GET /api/day-management/history
 */
export async function fetchDayHistory(params?: {
  startDate?: string;
  endDate?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<DayMetrics[]> {
  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);
  if (params?.status) searchParams.append('status', params.status);
  if (params?.limit) searchParams.append('limit', String(params.limit));
  if (params?.offset) searchParams.append('offset', String(params.offset));

  const qs = searchParams.toString();
  const url = `/api/day-management/history${qs ? `?${qs}` : ''}`;
  const res = await apiFetch(url);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Failed to fetch day history: HTTP ${res.status}`);
  }
  return json.data || [];
}

/**
 * 8. GET /api/day-management/:dayId/details
 */
export async function fetchDayDetails(dayId: number): Promise<any> {
  const res = await apiFetch(`/api/day-management/${dayId}/details`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Failed to fetch day details: HTTP ${res.status}`);
  }
  return json.data;
}

/**
 * 9. GET /api/day-management/:dayId/audit
 */
export async function fetchDayAudit(dayId: number): Promise<DayAuditRecord[]> {
  const res = await apiFetch(`/api/day-management/${dayId}/audit`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Failed to fetch day audit: HTTP ${res.status}`);
  }
  return json.data || [];
}

