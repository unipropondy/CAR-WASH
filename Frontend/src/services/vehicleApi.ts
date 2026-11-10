import { VehicleOption } from '../features/kiosk/types/kiosk.types';
import { apiFetch, getApiBaseUrl } from './apiConfig';

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

    return list.map((item) => ({
      id: String(item.vehicleTypeId),
      vehicleTypeId: item.vehicleTypeId,
      vehicleTypeCode: item.vehicleTypeCode,
      name: item.vehicleTypeName,
      description: item.description || '',
      imageUrl: item.imageUrl || `${baseUrl}/api/vehicle-types/${item.vehicleTypeId}/image`,
      imageContentType: item.imageContentType || null,
      hasImage: Boolean(item.hasImage),
    }));
  } catch (error: any) {
    console.error('[vehicleApi] Failed to fetch vehicle types:', error);
    throw new Error(
      error?.message || 'Unable to connect to the vehicle service. Please check backend status.'
    );
  }
}
