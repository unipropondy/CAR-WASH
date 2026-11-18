import { VehicleOption } from '../features/kiosk/types/kiosk.types';
import { apiFetch, getApiBaseUrl, resolveApiUrl } from './apiConfig';

export interface VehicleTypeDto {
  vehicleTypeId: number;
  vehicleTypeCode: string;
  vehicleTypeName: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  imageContentType?: string | null;
  imageUrl?: string | null;
  hasImage?: boolean;
}

const VEHICLE_CACHE_KEY = '@redbay_cached_vehicle_types_v2';
let memoryVehicleCache: VehicleOption[] | null = null;

// Initial instant default vehicles in case of cold cache on first load
export const DEFAULT_FALLBACK_VEHICLES: VehicleOption[] = [
  { id: '1', vehicleTypeId: 1, vehicleTypeCode: 'SEDAN', name: 'Sedan', description: 'Standard 4-door passenger sedans', hasImage: false },
  { id: '2', vehicleTypeId: 2, vehicleTypeCode: 'SUV', name: 'SUV', description: 'Compact & full-size sports utility vehicles', hasImage: false },
  { id: '3', vehicleTypeId: 3, vehicleTypeCode: 'MPV', name: 'MPV', description: 'Multi-purpose 7-seater family passenger vehicles', hasImage: false },
  { id: '4', vehicleTypeId: 4, vehicleTypeCode: 'BIG_MPV', name: 'Big MPV', description: 'Large luxury vans (Alphard, Vellfire, Carnival)', hasImage: false },
  { id: '5', vehicleTypeId: 5, vehicleTypeCode: 'HATCHBACK', name: 'Hatchback', description: 'Compact 5-door hatchback city vehicles', hasImage: false },
  { id: '6', vehicleTypeId: 6, vehicleTypeCode: 'COUPE', name: 'Coupe', description: 'Sporty 2-door and performance coupes', hasImage: false },
];

/**
 * Synchronously retrieve cached vehicle types (from memory or localStorage)
 */
export function getCachedVehicleTypes(): VehicleOption[] {
  if (memoryVehicleCache && memoryVehicleCache.length > 0) {
    return memoryVehicleCache;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(VEHICLE_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryVehicleCache = parsed;
          return parsed;
        }
      }
    } catch (e) {
      // Ignore localStorage parse errors
    }
  }
  return DEFAULT_FALLBACK_VEHICLES;
}

export function setCachedVehicleTypes(vehicles: VehicleOption[]) {
  if (!Array.isArray(vehicles) || vehicles.length === 0) return;
  memoryVehicleCache = vehicles;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(VEHICLE_CACHE_KEY, JSON.stringify(vehicles));
    } catch (e) {
      // Ignore quota/storage errors
    }
  }
}

/**
 * Fetch active vehicle types from the SQL Server backend API
 */
export async function fetchVehicleTypes(): Promise<VehicleOption[]> {
  try {
    const response = await apiFetch('/api/vehicle-types');

    if (!response.ok) {
      throw new Error(`Server returned error status: ${response.status}`);
    }

    const json = await response.json();
    const list: VehicleTypeDto[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
      ? json.data
      : [];

    const baseUrl = getApiBaseUrl();

    const mapped: VehicleOption[] = list.map((item) => ({
      id: String(item.vehicleTypeId),
      vehicleTypeId: item.vehicleTypeId,
      vehicleTypeCode: item.vehicleTypeCode,
      name: item.vehicleTypeName,
      description: item.description || '',
      imageUrl: resolveApiUrl(item.imageUrl || `/api/vehicle-types/${item.vehicleTypeId}/image`),
      imageContentType: item.imageContentType || null,
      hasImage: Boolean(item.hasImage),
    }));

    if (mapped.length > 0) {
      setCachedVehicleTypes(mapped);
    }

    return mapped.length > 0 ? mapped : getCachedVehicleTypes();
  } catch (error: any) {
    console.error('[vehicleApi] Failed to fetch vehicle types:', error);
    const cached = getCachedVehicleTypes();
    if (cached.length > 0) {
      return cached;
    }
    throw new Error(
      error?.message || 'Unable to connect to the vehicle service. Please check backend status.'
    );
  }
}
