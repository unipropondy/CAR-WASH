import { apiFetch, getApiBaseUrl } from './apiConfig';

export interface AccountTypeOption {
  id: string | number;
  accountTypeId: number;
  code: string; // 'CUSTOMER' | 'DEALER'
  name: string;
  description: string;
  iconName?: string | null;
  imageUrl?: string | null;
  hasImage?: boolean;
  displayOrder: number;
  isActive: boolean;
}

const CACHE_STORAGE_KEY = '@redbay_account_types_cache_v1';
let memoryCachedAccountTypes: AccountTypeOption[] | null = null;

export function getCachedAccountTypes(): AccountTypeOption[] | null {
  if (memoryCachedAccountTypes && memoryCachedAccountTypes.length > 0) {
    return memoryCachedAccountTypes;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(CACHE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryCachedAccountTypes = parsed;
          return parsed;
        }
      }
    } catch (e) {
      // Ignore localStorage parse errors
    }
  }
  return null;
}

export function setCachedAccountTypes(list: AccountTypeOption[]): void {
  memoryCachedAccountTypes = list;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(list));
    } catch (_) {}
  }
}

export const FALLBACK_ACCOUNT_TYPES: AccountTypeOption[] = [
  {
    id: 1,
    accountTypeId: 1,
    code: 'CUSTOMER',
    name: 'CUSTOMER',
    description: 'Standard customer wash & detailing packages',
    iconName: 'car-sport',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 2,
    accountTypeId: 2,
    code: 'DEALER',
    name: 'DEALER',
    description: 'Commercial corporate dealer account billing',
    iconName: 'business',
    displayOrder: 2,
    isActive: true,
  },
];

/**
 * Fetch kiosk account types from the SQL Server backend API (dbo.AccountTypeMaster)
 * @param includeAll If true, includes inactive records for backoffice management
 */
export async function fetchAccountTypes(includeAll = false): Promise<AccountTypeOption[]> {
  try {
    const url = includeAll ? '/api/account-types?all=true' : '/api/account-types';
    const response = await apiFetch(url);

    if (!response.ok) {
      console.warn(`[accountTypeApi] Server error ${response.status}, using fallbacks`);
      return FALLBACK_ACCOUNT_TYPES;
    }

    const json = await response.json();
    const list = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
      ? json.data
      : [];

    if (!list || list.length === 0) {
      return FALLBACK_ACCOUNT_TYPES;
    }

    const baseUrl = getApiBaseUrl();

    const resultList: AccountTypeOption[] = list.map((item: any) => ({
      id: String(item.accountTypeId || item.id),
      accountTypeId: item.accountTypeId || item.id,
      code: (item.code || item.typeCode || 'CUSTOMER').toUpperCase(),
      name: item.name || item.typeName || (item.code === 'DEALER' ? 'DEALER' : 'CUSTOMER'),
      description: item.description ? item.description.trim() : '',
      iconName: item.iconName || (item.code === 'DEALER' ? 'business' : 'car-sport'),
      imageUrl: item.imageUrl || (item.hasImage ? `${baseUrl}/api/account-types/${item.accountTypeId}/image` : null),
      hasImage: Boolean(item.hasImage),
      displayOrder: item.displayOrder ?? item.no ?? 1,
      isActive: item.isActive !== undefined ? Boolean(item.isActive) : true,
    }));

    if (!includeAll && resultList.length > 0) {
      setCachedAccountTypes(resultList);
    }

    return resultList;
  } catch (error: any) {
    console.warn('[accountTypeApi] Failed to fetch account types, using fallbacks:', error);
    return FALLBACK_ACCOUNT_TYPES;
  }
}

export interface SaveAccountTypeDto {
  typeCode: string;
  typeName: string;
  description?: string;
  iconName?: string;
  displayOrder?: number;
  isActive?: boolean;
  imageData?: string;
}

export async function createAccountType(payload: SaveAccountTypeDto): Promise<any> {
  const response = await apiFetch('/api/account-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.message || `Failed to create account type (${response.status})`);
  }
  return json;
}

export async function updateAccountType(id: number, payload: Partial<SaveAccountTypeDto>): Promise<any> {
  const response = await apiFetch(`/api/account-types/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.message || `Failed to update account type (${response.status})`);
  }
  return json;
}

export async function deleteAccountType(id: number, permanent = false): Promise<any> {
  const url = permanent ? `/api/account-types/${id}?permanent=true` : `/api/account-types/${id}`;
  const response = await apiFetch(url, {
    method: 'DELETE',
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.message || `Failed to delete account type (${response.status})`);
  }
  return json;
}
