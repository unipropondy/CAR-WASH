import { apiFetch, resolveApiUrl, getApiBaseUrl } from './apiConfig';

export interface KioskPromotion {
  promotionId: number;
  promotionName: string;
  description: string;
  imagePath: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  displayOrder: number;
  isActive: boolean;
  createdDate?: string;
  updatedDate?: string;
}

export interface CreatePromotionPayload {
  promotionName: string;
  description?: string;
  imagePath: string;
  startDate: string;
  endDate: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdatePromotionPayload {
  promotionName?: string;
  description?: string;
  imagePath?: string;
  startDate?: string;
  endDate?: string;
  displayOrder?: number;
  isActive?: boolean;
}

const PROMOTIONS_CACHE_KEY = '@redbay_active_promotions';
let activePromotionsMemoryCache: KioskPromotion[] | null = null;

export function getCachedActivePromotions(): KioskPromotion[] {
  if (activePromotionsMemoryCache && activePromotionsMemoryCache.length > 0) {
    return activePromotionsMemoryCache;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(PROMOTIONS_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          activePromotionsMemoryCache = parsed;
          return parsed;
        }
      }
    } catch (e) {}
  }
  return [];
}

export function setCachedActivePromotions(promotions: KioskPromotion[]) {
  activePromotionsMemoryCache = promotions;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(PROMOTIONS_CACHE_KEY, JSON.stringify(promotions));
    } catch (e) {}
  }
}

/**
 * Fetch all promotions for Backoffice listing
 */
export async function fetchAllPromotions(search?: string, activeOnly?: boolean): Promise<KioskPromotion[]> {
  const params = new URLSearchParams();
  if (search && search.trim()) params.append('search', search.trim());
  if (activeOnly) params.append('activeOnly', 'true');

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiFetch(`/api/promotions${query}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch promotions (HTTP ${response.status})`);
  }

  const json = await response.json();
  return json.data || [];
}

/**
 * Fetch currently active promotions within StartDate & EndDate for Kiosk Slideshow
 */
export async function fetchActivePromotions(): Promise<KioskPromotion[]> {
  try {
    const response = await apiFetch('/api/promotions/active', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }, 10000);

    if (!response.ok) {
      throw new Error(`Failed to fetch active promotions (HTTP ${response.status})`);
    }

    const json = await response.json();
    const promotions: KioskPromotion[] = json.data || [];
    setCachedActivePromotions(promotions);
    return promotions;
  } catch (err) {
    const cached = getCachedActivePromotions();
    if (cached && cached.length > 0) {
      console.warn('[promotionApi] Using cached active promotions due to network error:', err);
      return cached;
    }
    console.warn('[promotionApi] fetchActivePromotions failed and no cache available:', err);
    throw err;
  }
}

/**
 * Upload promotional poster image (supports File object or Base64 data URL)
 */
export async function uploadPromotionPoster(
  fileOrBase64: File | Blob | string,
  fileName?: string
): Promise<{ imagePath: string; fileName: string }> {
  // If string (Base64 or data URL)
  if (typeof fileOrBase64 === 'string') {
    const response = await apiFetch('/api/promotions/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: fileOrBase64,
        fileName: fileName || 'poster.png',
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.message || `Upload failed (HTTP ${response.status})`);
    }

    const json = await response.json();
    return {
      imagePath: json.imagePath,
      fileName: json.fileName,
    };
  }

  // If File / Blob via FormData
  const formData = new FormData();
  formData.append('image', fileOrBase64, fileName || (fileOrBase64 as File).name || 'poster.png');

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl.replace(/\/+$/, '')}/api/promotions/upload`;

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.message || `Upload failed (HTTP ${response.status})`);
  }

  const json = await response.json();
  return {
    imagePath: json.imagePath,
    fileName: json.fileName,
  };
}

/**
 * Create a new promotion record
 */
export async function createPromotion(payload: CreatePromotionPayload): Promise<KioskPromotion> {
  const response = await apiFetch('/api/promotions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.message || `Failed to create promotion (HTTP ${response.status})`);
  }

  const json = await response.json();
  return json.data;
}

/**
 * Update an existing promotion record
 */
export async function updatePromotion(id: number, payload: UpdatePromotionPayload): Promise<KioskPromotion> {
  const response = await apiFetch(`/api/promotions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.message || `Failed to update promotion (HTTP ${response.status})`);
  }

  const json = await response.json();
  return json.data;
}

/**
 * Delete a promotion record
 */
export async function deletePromotion(id: number): Promise<boolean> {
  const response = await apiFetch(`/api/promotions/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.message || `Failed to delete promotion (HTTP ${response.status})`);
  }

  return true;
}
