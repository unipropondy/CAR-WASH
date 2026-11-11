import { apiFetch } from './apiConfig';

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

export async function fetchAllDealers(includeAll: boolean = true, search?: string): Promise<DealerRecord[]> {
  const params = new URLSearchParams();
  if (includeAll) params.append('all', 'true');
  if (search) params.append('search', search);

  const res = await apiFetch(`/api/dealers?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch dealers');
  }
  const data = await res.json();
  return data.data || [];
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

