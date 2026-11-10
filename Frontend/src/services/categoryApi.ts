import { ServiceCategory } from '../features/kiosk/types/kiosk.types';
import { apiFetch, getApiBaseUrl } from './apiConfig';

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

    return list.map((item) => ({
      id: item.serviceCategoryCode || String(item.serviceCategoryId),
      serviceCategoryId: item.serviceCategoryId,
      serviceCategoryCode: item.serviceCategoryCode,
      title: item.categoryName,
      description: item.description || '',
      subtitle: item.description || '',
      imageUrl: item.imageUrl || `${baseUrl}/api/service-categories/${item.serviceCategoryId}/image`,
      imageContentType: item.imageContentType || null,
      hasImage: Boolean(item.hasImage),
      displayOrder: item.displayOrder,
      isActive: item.isActive,
    }));
  } catch (error: any) {
    console.error('[categoryApi] Failed to fetch service categories:', error);
    throw new Error(
      error?.message || 'Unable to connect to the service category API. Please check backend status.'
    );
  }
}
