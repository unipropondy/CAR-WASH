import { getApiBaseUrl, apiFetch } from './apiConfig';

/* ==================== 1. VEHICLE TYPES (VehicleTypeMaster) ==================== */
export interface VehicleTypeRecord {
  vehicleTypeId: number;
  vehicleTypeCode: string;
  vehicleTypeName: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  createdDate?: string;
  imageUrl?: string;
  hasImage?: boolean;
}

export async function fetchAllVehicleTypes(includeAll: boolean = true, search?: string): Promise<VehicleTypeRecord[]> {
  const params = new URLSearchParams();
  if (includeAll) params.append('all', 'true');
  if (search) params.append('search', search);

  const res = await apiFetch(`/api/vehicle-types?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch vehicle types');
  }
  const data = await res.json();
  return data.data || [];
}

export async function createVehicleType(payload: {
  vehicleTypeCode: string;
  vehicleTypeName: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}): Promise<VehicleTypeRecord> {
  const res = await apiFetch('/api/vehicle-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to create vehicle type');
  }
  return data.data;
}

export async function updateVehicleType(id: number, payload: Partial<VehicleTypeRecord>): Promise<VehicleTypeRecord> {
  const res = await apiFetch(`/api/vehicle-types/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to update vehicle type');
  }
  return data.data;
}

export async function deleteVehicleType(id: number): Promise<any> {
  const res = await apiFetch(`/api/vehicle-types/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to delete vehicle type');
  }
  return data;
}

/* ==================== 2. SERVICE CATEGORIES (ServiceCategoryMaster) ==================== */
export interface ServiceCategoryRecord {
  serviceCategoryId: number;
  serviceCategoryCode: string;
  categoryName: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  createdDate?: string;
  imageUrl?: string;
  hasImage?: boolean;
}

export async function fetchAllServiceCategories(includeAll: boolean = true, search?: string): Promise<ServiceCategoryRecord[]> {
  const params = new URLSearchParams();
  if (includeAll) params.append('all', 'true');
  if (search) params.append('search', search);

  const res = await apiFetch(`/api/service-categories?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch service categories');
  }
  const data = await res.json();
  return data.data || [];
}

export async function createServiceCategory(payload: {
  serviceCategoryCode: string;
  categoryName: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}): Promise<ServiceCategoryRecord> {
  const res = await apiFetch('/api/service-categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to create service category');
  }
  return data.data;
}

export async function updateServiceCategory(id: number, payload: Partial<ServiceCategoryRecord>): Promise<ServiceCategoryRecord> {
  const res = await apiFetch(`/api/service-categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to update service category');
  }
  return data.data;
}

export async function deleteServiceCategory(id: number): Promise<any> {
  const res = await apiFetch(`/api/service-categories/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to delete service category');
  }
  return data;
}

/* ==================== 3. SERVICE PACKAGES (ServicePackageMaster & Feature) ==================== */
export interface ServicePackageRecord {
  packageId: number;
  serviceCategoryId: number;
  serviceCategoryName: string;
  serviceCategoryCode: string;
  packageCode: string;
  packageName: string;
  description: string;
  price: number;
  currencyCode: string;
  gstPercent: number;
  isTaxInclusive: boolean;
  durationMinutes?: number | null;
  displayOrder: number;
  isActive: boolean;
  createdDate?: string;
  features: string[];
}

export async function fetchAllPackages(categoryId?: number, includeAll: boolean = true, search?: string): Promise<ServicePackageRecord[]> {
  const params = new URLSearchParams();
  if (categoryId) params.append('categoryId', String(categoryId));
  if (includeAll) params.append('all', 'true');
  if (search) params.append('search', search);

  const res = await apiFetch(`/api/service-packages?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch service packages');
  }
  const data = await res.json();
  return data.data || [];
}

export async function createPackage(payload: {
  serviceCategoryId: number;
  packageCode: string;
  packageName: string;
  description?: string;
  price: number;
  currencyCode?: string;
  gstPercent?: number;
  isTaxInclusive?: boolean;
  durationMinutes?: number;
  displayOrder?: number;
  isActive?: boolean;
  features?: string[];
}): Promise<ServicePackageRecord> {
  const res = await apiFetch('/api/service-packages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to create service package');
  }
  return data.data;
}

export async function updatePackage(id: number, payload: Partial<ServicePackageRecord>): Promise<ServicePackageRecord> {
  const res = await apiFetch(`/api/service-packages/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to update service package');
  }
  return data.data;
}

export async function deletePackage(id: number): Promise<any> {
  const res = await apiFetch(`/api/service-packages/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to delete service package');
  }
  return data;
}

/* ==================== 4. AUDIT LOGS (CarWashOrderStatusHistory) ==================== */
export interface AuditLogRecord {
  historyId: number;
  orderId: number;
  orderNo: string;
  customerName: string;
  vehicleNumber: string;
  totalAmount: number;
  bayId?: number | null;
  packageName: string;
  oldStatusCode?: number | null;
  oldStatusName: string;
  newStatusCode: number;
  newStatusName: string;
  remarks: string;
  changedBy: string;
  changedDate: string;
}

export async function fetchAuditLogs(params: {
  search?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  limit?: number;
} = {}): Promise<AuditLogRecord[]> {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  if (params.status) query.append('status', params.status);
  if (params.limit) query.append('limit', String(params.limit));

  const res = await apiFetch(`/api/carwash/audit?${query.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch audit logs');
  }
  const data = await res.json();
  return data.data || [];
}

/* ==================== 5. DATA EXPORT (CSV / JSON) ==================== */
export function getExportUrl(params: {
  format?: 'csv' | 'json';
  startDate?: string;
  endDate?: string;
  status?: string;
} = {}): string {
  const base = getApiBaseUrl();
  const query = new URLSearchParams();
  query.append('format', params.format || 'csv');
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  if (params.status) query.append('status', params.status);

  return `${base}/api/carwash/export?${query.toString()}`;
}

