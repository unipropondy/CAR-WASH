import { ServiceCategory } from '../features/kiosk/types/kiosk.types';
import { apiFetch, getApiBaseUrl, resolveApiUrl } from './apiConfig';

export interface ServiceCategoryDto {
  serviceCategoryId: number;
  serviceCategoryCode: string;
  categoryName: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  imageContentType?: string | null;
  imageUrl?: string | null;
  hasImage?: boolean;
  iconContentType?: string | null;
  iconUrl?: string | null;
  hasIcon?: boolean;
}

const CATEGORY_CACHE_KEY = '@redbay_cached_service_categories_v2';
let memoryCategoryCache: ServiceCategory[] | null = null;

export const DEFAULT_FALLBACK_CATEGORIES: ServiceCategory[] = [
  {
    id: 'CAR_WASH',
    serviceCategoryId: 1,
    serviceCategoryCode: 'CAR_WASH',
    title: 'Car Wash',
    description: 'Express foam wash, vacuuming and detailing treatments',
    subtitle: 'Express foam wash, vacuuming and detailing treatments',
    imageUrl: null,
    imageContentType: null,
    hasImage: false,
    iconUrl: null,
    iconContentType: null,
    hasIcon: false,
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'POLISHING',
    serviceCategoryId: 2,
    serviceCategoryCode: 'POLISHING',
    title: 'Polishing',
    description: 'Paint correction, swirl removal, and multi-stage gloss polishing',
    subtitle: 'Paint correction, swirl removal, and multi-stage gloss polishing',
    imageUrl: null,
    imageContentType: null,
    hasImage: false,
    iconUrl: null,
    iconContentType: null,
    hasIcon: false,
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'ALCARE_CARE',
    serviceCategoryId: 3,
    serviceCategoryCode: 'ALCARE_CARE',
    title: 'Alcare Care',
    description: 'Exclusive interior antimicrobial sanitation and surface protection',
    subtitle: 'Exclusive interior antimicrobial sanitation and surface protection',
    imageUrl: null,
    imageContentType: null,
    hasImage: false,
    iconUrl: null,
    iconContentType: null,
    hasIcon: false,
    displayOrder: 3,
    isActive: true,
  },
];

export function getCachedServiceCategories(): ServiceCategory[] {
  if (memoryCategoryCache && memoryCategoryCache.length > 0) {
    return memoryCategoryCache;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(CATEGORY_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryCategoryCache = parsed;
          return parsed;
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  return DEFAULT_FALLBACK_CATEGORIES;
}

export function setCachedServiceCategories(categories: ServiceCategory[]) {
  if (!Array.isArray(categories) || categories.length === 0) return;
  memoryCategoryCache = categories;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(CATEGORY_CACHE_KEY, JSON.stringify(categories));
    } catch (e) {
      // Ignore quota errors
    }
  }
}

/**
 * Fetch active service categories from SQL Server backend API
 */
export async function fetchServiceCategories(): Promise<ServiceCategory[]> {
  try {
    const response = await apiFetch('/api/service-categories');

    if (!response.ok) {
      throw new Error(`Server returned error status: ${response.status}`);
    }

    const json = await response.json();
    const list: ServiceCategoryDto[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
      ? json.data
      : [];

    const baseUrl = getApiBaseUrl();

    const mapped: ServiceCategory[] = list.map((item) => ({
      id: item.serviceCategoryCode || String(item.serviceCategoryId),
      serviceCategoryId: item.serviceCategoryId,
      serviceCategoryCode: item.serviceCategoryCode,
      title: item.categoryName,
      description: item.description || '',
      subtitle: item.description || '',
      imageUrl: resolveApiUrl(item.imageUrl || `/api/service-categories/${item.serviceCategoryId}/image`),
      imageContentType: item.imageContentType || null,
      hasImage: Boolean(item.hasImage),
      iconUrl: resolveApiUrl(item.iconUrl || `/api/service-categories/${item.serviceCategoryId}/icon`),
      iconContentType: item.iconContentType || null,
      hasIcon: Boolean(item.hasIcon),
      displayOrder: item.displayOrder,
      isActive: item.isActive,
    }));

    if (mapped.length > 0) {
      setCachedServiceCategories(mapped);
    }

    return mapped.length > 0 ? mapped : getCachedServiceCategories();
  } catch (error: any) {
    console.error('[categoryApi] Failed to fetch service categories:', error);
    const cached = getCachedServiceCategories();
    if (cached.length > 0) {
      return cached;
    }
    throw new Error(
      error?.message || 'Unable to connect to the service category API. Please check backend status.'
    );
  }
}
