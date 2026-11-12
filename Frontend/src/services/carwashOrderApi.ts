import { getApiBaseUrl, apiFetch } from './apiConfig';

const getBaseUrl = (): string => {
  return `${getApiBaseUrl()}/api/carwash`;
};

export interface PayModeOption {
  position: number;
  payMode: string;
  description: string;
  active: boolean;
  extraCharges?: number;
  commission?: number;
}

export interface CreateOrderPayload {
  customerName: string;
  vehicleNumber: string;
  mobileNumber: string;
  vehicleTypeId: number;
  serviceCategoryId: number;
  packageId: number;
}

export interface CreatedOrderResponse {
  orderId: number;
  orderNo: string;
  customerName: string;
  vehicleNumber: string;
  mobileNumber: string;
  vehicleTypeId: number;
  serviceCategoryId: number;
  packageId: number;
  packageName: string;
  packagePrice: number;
  gstPercent: number;
  gstAmount: number;
  totalAmount: number;
  currencyCode: string;
  paymentStatus: string;
  statusCode: number;
  statusName: string;
  createdDate: string;
}

export interface UpdatePaymentPayload {
  payMode: string;
  paymentReference?: string;
  confirmPaid?: boolean;
  changedBy?: string;
  remarks?: string;
}

export interface UpdateStatusPayload {
  statusCode: number;
  bayId?: number;
  remarks?: string;
  changedBy?: string;
}

export interface ApiOrder {
  orderId: number;
  orderNo: string;
  customerName: string;
  vehicleNumber: string;
  mobileNumber: string;
  vehicleTypeId: number;
  vehicleTypeName: string;
  vehicleTypeCode: string;
  serviceCategoryId: number;
  serviceCategoryName: string;
  serviceCategoryCode: string;
  packageId: number;
  packageName: string;
  packageCode: string;
  durationMinutes?: number;
  packagePrice: number;
  gstPercent: number;
  gstAmount: number;
  totalAmount: number;
  currencyCode: string;
  payMode: string;
  paymentStatus: 'PAID' | 'PENDING' | 'CANCELLED';
  paymentReference?: string;
  statusCode: number;
  statusName: string;
  bayId?: number;
  bayStatus: string;
  waitTime: string;
  waitMinutes: number;
  createdDate: string;
  paidDate?: string;
  startedDate?: string;
  completedDate?: string;
  closedDate?: string;
}

export interface OrderStatusHistoryItem {
  historyId: number;
  orderId: number;
  oldStatusCode?: number;
  oldStatusName?: string;
  newStatusCode: number;
  newStatusName: string;
  remarks?: string;
  changedBy: string;
  changedDate: string;
}

/**
 * 1. Fetch active payment modes from dbo.Paymode
 */
export async function fetchPaymodes(): Promise<PayModeOption[]> {
  const url = `${getBaseUrl()}/paymodes`;
  const res = await apiFetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch paymodes: HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data || [];
}

/**
 * 2. Save customer booking in dbo.CarWashOrder (Kiosk Step 4)
 */
export async function createCarWashOrder(payload: CreateOrderPayload): Promise<CreatedOrderResponse> {
  const url = `${getBaseUrl()}/orders`;
  const res = await apiFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Failed to create order: HTTP ${res.status}`);
  }
  return json.data;
}

/**
 * 3. Update payment mode or confirm payment in dbo.CarWashOrder
 */
export async function updateOrderPayment(
  orderId: number,
  payload: UpdatePaymentPayload,
  token?: string
): Promise<any> {
  const url = `${getBaseUrl()}/orders/${orderId}/payment`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await apiFetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Failed to update payment: HTTP ${res.status}`);
  }
  return json.data;
}

/**
 * 4. Fetch orders for Staff POS Order Queue
 */
export async function fetchCarWashOrders(
  filter: string = 'ALL',
  search: string = '',
  date: string = 'today',
  dayId?: number,
  token?: string
): Promise<ApiOrder[]> {
  const queryParams = new URLSearchParams();
  if (filter) queryParams.append('filter', filter);
  if (search) queryParams.append('search', search);
  if (dayId) {
    queryParams.append('dayId', String(dayId));
  } else if (date) {
    queryParams.append('date', date);
  }

  const url = `${getBaseUrl()}/orders?${queryParams.toString()}`;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await apiFetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch orders: HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data || [];
}

/**
 * 5. Fetch single order details
 */
export async function fetchCarWashOrderById(orderId: number, token?: string): Promise<ApiOrder> {
  const url = `${getBaseUrl()}/orders/${orderId}`;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await apiFetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch order ${orderId}: HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

/**
 * 6. Update order status (Cashier operations: Bay Assign, In Service, Complete, Close)
 */
export async function updateOrderStatus(
  orderId: number,
  payload: UpdateStatusPayload,
  token?: string
): Promise<any> {
  const url = `${getBaseUrl()}/orders/${orderId}/status`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await apiFetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Failed to update status: HTTP ${res.status}`);
  }
  return json.data;
}

/**
 * 7. Fetch audit status history for an order
 */
export async function fetchCarWashOrderHistory(
  orderId: number,
  token?: string
): Promise<OrderStatusHistoryItem[]> {
  const url = `${getBaseUrl()}/orders/${orderId}/history`;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await apiFetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch history for order ${orderId}: HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data || [];
}

/**
 * =======================================================================
 * BAY MASTER MANAGEMENT (dbo.BayMaster ONLY)
 * STRICT RULE: All bay operations read & write dbo.BayMaster exclusively.
 * TableMaster is NOT used and remains strictly for restaurant POS.
 * =======================================================================
 */

export interface BayMasterRecord {
  bayId: string;
  bayNumber: number;
  bayName: string;
  bayType: string;
  bayStatus: 'AVAILABLE' | 'IN_SERVICE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE';
  xSize: number;
  ySize: number;
  xPos: number;
  yPos: number;
  customerName?: string | null;
  customerMobile?: string | null;
  vehicleNumber?: string | null;
  currentOrderId?: string | null;
  totalAmount?: number;
  isLocked?: boolean;
  remarks?: string | null;
  status?: boolean;
}

/**
 * 8. Fetch all bays dynamically from dbo.BayMaster
 */
export async function fetchBayMasterList(token?: string): Promise<BayMasterRecord[]> {
  const url = `${getBaseUrl()}/bays`;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await apiFetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch bays from BayMaster: HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data || [];
}

/**
 * 9. Update bay status in dbo.BayMaster
 */
export async function updateBayMasterStatus(
  bayIdOrNumber: string | number,
  bayStatus: string,
  token?: string
): Promise<BayMasterRecord> {
  const url = `${getBaseUrl()}/bays/${bayIdOrNumber}/status`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await apiFetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ bayStatus }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Failed to update bay status in BayMaster');
  }
  return json.data;
}

/**
 * 10. Assign customer & vehicle to bay in dbo.BayMaster
 */
export async function assignBayMaster(
  bayIdOrNumber: string | number,
  payload: {
    customerName?: string;
    customerMobile?: string;
    vehicleNumber?: string;
    currentOrderId?: string;
    totalAmount?: number;
    remarks?: string;
  },
  token?: string
): Promise<BayMasterRecord> {
  const url = `${getBaseUrl()}/bays/${bayIdOrNumber}/assign`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await apiFetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Failed to assign bay in BayMaster');
  }
  return json.data;
}

/**
 * 11. Release bay back to AVAILABLE in dbo.BayMaster
 */
export async function releaseBayMaster(
  bayIdOrNumber: string | number,
  token?: string
): Promise<BayMasterRecord> {
  const url = `${getBaseUrl()}/bays/${bayIdOrNumber}/release`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await apiFetch(url, { method: 'PUT', headers });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Failed to release bay in BayMaster');
  }
  return json.data;
}

/**
 * 12. Batch update bay layout positions (XPos, YPos, XSize, YSize) in dbo.BayMaster
 */
export async function updateBayMasterLayout(
  bays: Array<{
    bayId?: string;
    bayNumber?: number;
    xPos: number;
    yPos: number;
    xSize?: number;
    ySize?: number;
  }>,
  token?: string
): Promise<BayMasterRecord[]> {
  const url = `${getBaseUrl()}/bays/layout`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await apiFetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ bays }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Failed to update bay layout in BayMaster');
  }
  return json.data;
}

/**
 * 13. Create a new bay in dbo.BayMaster
 */
export async function createBayMaster(
  payload: {
    bayNumber: number;
    bayName: string;
    bayType?: string;
    bayStatus?: string;
    xSize?: number;
    ySize?: number;
    remarks?: string;
  },
  token?: string
): Promise<BayMasterRecord> {
  const url = `${getBaseUrl()}/bays`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await apiFetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Failed to create bay in BayMaster');
  }
  return json.data;
}

/**
 * 14. Update bay properties in dbo.BayMaster
 */
export async function updateBayMaster(
  bayIdOrNumber: string | number,
  payload: Partial<BayMasterRecord>,
  token?: string
): Promise<BayMasterRecord> {
  const url = `${getBaseUrl()}/bays/${bayIdOrNumber}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await apiFetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Failed to update bay in BayMaster');
  }
  return json.data;
}

/**
 * 15. Deactivate or delete bay in dbo.BayMaster
 */
export async function deleteBayMaster(
  bayIdOrNumber: string | number,
  token?: string
): Promise<any> {
  const url = `${getBaseUrl()}/bays/${bayIdOrNumber}`;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await apiFetch(url, {
    method: 'DELETE',
    headers,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Failed to deactivate bay in BayMaster');
  }
  return json;
}

