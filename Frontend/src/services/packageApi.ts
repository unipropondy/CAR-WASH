import { ServicePackage } from '../features/kiosk/types/kiosk.types';
import { apiFetch } from './apiConfig';

export interface ServicePackageDto {
  packageId: number;
  serviceCategoryId: number;
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
  features: string[];
}

const PACKAGE_CACHE_KEY = '@redbay_cached_packages';
let memoryPackageMap: Record<string, ServicePackage[]> = {};

export const DEFAULT_FALLBACK_PACKAGES: ServicePackage[] = [
  {
    id: '1',
    packageId: 1,
    serviceCategoryId: 1,
    packageCode: 'EXPRESS_WASH',
    categoryId: '1',
    name: 'Express Foam Wash',
    description: 'High-density snow foam shampoo, wheel face degreasing, clean soft chamois hand dry',
    price: 15.0,
    currencyCode: 'SGD',
    gstPercent: 0,
    isTaxInclusive: false,
    durationMinutes: 15,
    displayOrder: 1,
    isActive: true,
    features: ['High-density snow foam shampoo', 'Wheel face degreasing', 'Clean soft chamois hand dry'],
  },
  {
    id: '2',
    packageId: 2,
    serviceCategoryId: 1,
    packageCode: 'DELUXE_VACUUM',
    categoryId: '1',
    name: 'Deluxe Wash & Vacuum',
    description: 'Premium exterior snow foam wash, complete interior cabin vacuum, soft chamois dry & wipe down',
    price: 25.0,
    currencyCode: 'SGD',
    gstPercent: 0,
    isTaxInclusive: false,
    durationMinutes: 30,
    displayOrder: 2,
    isActive: true,
    features: ['Premium exterior snow foam wash', 'Complete interior cabin vacuum', 'Soft chamois dry & wipe down'],
  },
  {
    id: '3',
    packageId: 3,
    serviceCategoryId: 1,
    packageCode: 'HYDRO_PROTECT',
    categoryId: '1',
    name: 'Hydrophobic Ceramic Wax',
    description: 'Hydrophobic protective wax coat, deep exterior foam wash, tire shine & wheel degreasing',
    price: 45.0,
    currencyCode: 'SGD',
    gstPercent: 0,
    isTaxInclusive: false,
    durationMinutes: 45,
    displayOrder: 3,
    isActive: true,
    features: ['Hydrophobic protective wax coat', 'Deep exterior foam wash', 'Tire shine & wheel degreasing'],
  },
];

export function getCachedPackages(serviceCategoryId?: number | string): ServicePackage[] {
  const key = serviceCategoryId ? String(serviceCategoryId) : 'all';
  if (memoryPackageMap[key] && memoryPackageMap[key].length > 0) {
    return memoryPackageMap[key];
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(`${PACKAGE_CACHE_KEY}_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryPackageMap[key] = parsed;
          return parsed;
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  if (!serviceCategoryId || String(serviceCategoryId) === '1' || String(serviceCategoryId).toUpperCase().includes('WASH')) {
    return DEFAULT_FALLBACK_PACKAGES;
  }
  return [];
}

export function setCachedPackages(serviceCategoryId: number | string | undefined, packages: ServicePackage[]) {
  if (!Array.isArray(packages) || packages.length === 0) return;
  const key = serviceCategoryId ? String(serviceCategoryId) : 'all';
  memoryPackageMap[key] = packages;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(`${PACKAGE_CACHE_KEY}_${key}`, JSON.stringify(packages));
    } catch (e) {
      // Ignore quota errors
    }
  }
}

/**
 * Fetch active service packages for a specific category from SQL Server backend API
 */
export async function fetchPackagesByCategory(
  serviceCategoryId?: number | string
): Promise<ServicePackage[]> {
  try {
    const endpoint = serviceCategoryId
      ? `/api/service-packages?categoryId=${serviceCategoryId}`
      : `/api/service-packages`;

    const response = await apiFetch(endpoint);
    if (!response.ok) {
      throw new Error(`Server returned error status: ${response.status}`);
    }

    const json = await response.json();
    const list: ServicePackageDto[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
      ? json.data
      : [];

    const mapped: ServicePackage[] = list.map((item) => ({
      id: String(item.packageId),
      packageId: item.packageId,
      serviceCategoryId: item.serviceCategoryId,
      packageCode: item.packageCode,
      categoryId: String(item.serviceCategoryId),
      name: item.packageName,
      description: item.description || '',
      price: Number(item.price),
      currencyCode: item.currencyCode || 'SGD',
      gstPercent: Number(item.gstPercent || 0),
      isTaxInclusive: false,
      durationMinutes: item.durationMinutes,
      displayOrder: item.displayOrder,
      isActive: item.isActive,
      features: Array.isArray(item.features) ? item.features : [],
    }));

    if (mapped.length > 0) {
      setCachedPackages(serviceCategoryId, mapped);
    }

    return mapped.length > 0 ? mapped : getCachedPackages(serviceCategoryId);
  } catch (error: any) {
    console.error('[packageApi] Failed to fetch packages:', error);
    const cached = getCachedPackages(serviceCategoryId);
    if (cached.length > 0) {
      return cached;
    }
    throw new Error(
      error?.message || 'Unable to connect to the package service. Please check backend status.'
    );
  }
}
