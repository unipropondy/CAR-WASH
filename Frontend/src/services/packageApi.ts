import { ServicePackage } from '../features/kiosk/types/kiosk.types';
import { apiFetch } from './apiConfig';

export interface ServicePackageDto {
  packageId: number;
  serviceCategoryId: number;
  packageCode: string;
  packageName: string;
  description: string;
  price: number;
  dealerPrice?: number;
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
    id: '6',
    packageId: 6,
    serviceCategoryId: 1,
    packageCode: 'CARLING_PACKAGE',
    categoryId: '1',
    name: 'Carling Package',
    description: '• Snow Foam Hand Wash\n• Tyre Dressing & Shine\n• Rim Detailing\n• Interior Vacuuming\n• Dashboard Cleaning & Shine',
    price: 15.0,
    dealerPrice: 15.0,
    currencyCode: 'SGD',
    gstPercent: 9.0,
    isTaxInclusive: false,
    durationMinutes: 20,
    displayOrder: 1,
    isActive: true,
    features: ['Snow Foam Hand Wash', 'Tyre Dressing & Shine', 'Rim Detailing', 'Interior Vacuuming', 'Dashboard Cleaning & Shine'],
  },
  {
    id: '7',
    packageId: 7,
    serviceCategoryId: 1,
    packageCode: 'PREMIER_PACKAGE',
    categoryId: '1',
    name: 'Premier Package (Most Popular)',
    description: '• Snow Foam Hand Wash\n• Tyre Dressing & Shine\n• Rim Detailing\n• Water Wax Finish\n• Interior Vacuuming\n• Dashboard Cleaning & Shine\n• Dettol Interior Wipe-Down',
    price: 28.0,
    dealerPrice: 22.4,
    currencyCode: 'SGD',
    gstPercent: 9.0,
    isTaxInclusive: false,
    durationMinutes: 30,
    displayOrder: 2,
    isActive: true,
    features: ['Snow Foam Hand Wash', 'Tyre Dressing & Shine', 'Rim Detailing', 'Water Wax Finish', 'Interior Vacuuming', 'Dashboard Cleaning & Shine', 'Dettol Interior Wipe-Down'],
  },
  {
    id: '8',
    packageId: 8,
    serviceCategoryId: 1,
    packageCode: 'CHAMPION_PACKAGE',
    categoryId: '1',
    name: 'Champion Package',
    description: '• Snow Foam Hand Wash\n• Tyre Dressing & Shine\n• Rim Detailing\n• Water Wax Finish\n• Deep Interior Vacuuming\n• Dashboard Cleaning & Shine\n• Dettol Interior Wipe-Down\n• Interior Leather Care\n• Interior Fumigation\n• Engine Bay Wash & Shine',
    price: 55.0,
    dealerPrice: 44.0,
    currencyCode: 'SGD',
    gstPercent: 9.0,
    isTaxInclusive: false,
    durationMinutes: 45,
    displayOrder: 3,
    isActive: true,
    features: ['Snow Foam Hand Wash', 'Tyre Dressing & Shine', 'Rim Detailing', 'Water Wax Finish', 'Deep Interior Vacuuming', 'Dashboard Cleaning & Shine', 'Dettol Interior Wipe-Down', 'Interior Leather Care', 'Interior Fumigation', 'Engine Bay Wash & Shine'],
  },
];

export const POLISHING_FALLBACK_PACKAGES: ServicePackage[] = [
  {
    id: '9',
    packageId: 9,
    serviceCategoryId: 2,
    packageCode: 'CLUB_PACKAGE',
    categoryId: '2',
    name: 'Club Package',
    description: '• Premier Wash Package\n• 3-in-1 Quick Polish\n• Clay Bar Treatment\n• Interior Care',
    price: 100.0,
    dealerPrice: 80.0,
    currencyCode: 'SGD',
    gstPercent: 9.0,
    isTaxInclusive: false,
    durationMinutes: 60,
    displayOrder: 1,
    isActive: true,
    features: ['Premier Wash Package', '3-in-1 Quick Polish', 'Clay Bar Treatment', 'Interior Care'],
  },
  {
    id: '10',
    packageId: 10,
    serviceCategoryId: 2,
    packageCode: 'EURO_PACKAGE',
    categoryId: '2',
    name: 'Euro Package (Most Popular)',
    description: '• Champion Package\n• 3-Layer Detailed Polishing & Sealant\n• Clay Bar Treatment\n• Glass Polishing\n• Glass Shield Coating',
    price: 140.0,
    dealerPrice: 112.0,
    currencyCode: 'SGD',
    gstPercent: 9.0,
    isTaxInclusive: false,
    durationMinutes: 90,
    displayOrder: 2,
    isActive: true,
    features: ['Champion Package', '3-Layer Detailed Polishing & Sealant', 'Clay Bar Treatment', 'Glass Polishing', 'Glass Shield Coating'],
  },
  {
    id: '11',
    packageId: 11,
    serviceCategoryId: 2,
    packageCode: 'WORLD_CUP_PACKAGE',
    categoryId: '2',
    name: 'World Cup Package',
    description: '• Champion Package\n• 3-Layer Detailed Polishing & Sealant\n• Clay Bar Treatment\n• Steam Extraction/Cleaning\n• Glass Polishing\n• Glass Shield Coating',
    price: 180.0,
    dealerPrice: 144.0,
    currencyCode: 'SGD',
    gstPercent: 9.0,
    isTaxInclusive: false,
    durationMinutes: 120,
    displayOrder: 3,
    isActive: true,
    features: ['Champion Package', '3-Layer Detailed Polishing & Sealant', 'Clay Bar Treatment', 'Steam Extraction/Cleaning', 'Glass Polishing', 'Glass Shield Coating'],
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
  if (String(serviceCategoryId) === '2' || String(serviceCategoryId).toUpperCase().includes('POLISH')) {
    return POLISHING_FALLBACK_PACKAGES;
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
      dealerPrice: item.dealerPrice != null ? Number(item.dealerPrice) : Number(item.price),
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
