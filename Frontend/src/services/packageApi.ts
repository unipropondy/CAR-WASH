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

    return list.map((item) => ({
      id: String(item.packageId),
      packageId: item.packageId,
      serviceCategoryId: item.serviceCategoryId,
      packageCode: item.packageCode,
      categoryId: String(item.serviceCategoryId),
      name: item.packageName,
      description: item.description || '',
      price: Number(item.price),
      currencyCode: item.currencyCode || 'SGD',
      gstPercent: Number(item.gstPercent || 9),
      isTaxInclusive: Boolean(item.isTaxInclusive),
      durationMinutes: item.durationMinutes,
      displayOrder: item.displayOrder,
      isActive: item.isActive,
      features: Array.isArray(item.features) ? item.features : [],
    }));
  } catch (error: any) {
    console.error('[packageApi] Failed to fetch packages:', error);
    throw new Error(
      error?.message || 'Unable to connect to the package service. Please check backend status.'
    );
  }
}
