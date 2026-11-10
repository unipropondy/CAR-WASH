import { Platform } from 'react-native';
import { 
  KioskUserType, 
  DealerOption, 
  VehicleOption, 
  ServiceCategory, 
  ServicePackage, 
  CustomerDetails, 
  PaymentMode, 
  KioskOrder 
} from '../types/kiosk.types';

export interface KioskSessionData {
  userType?: KioskUserType;
  selectedDealer?: DealerOption;
  isDealerAuthenticated?: boolean;
  selectedVehicle?: VehicleOption;
  selectedVehicleTypeId?: number;
  selectedVehicleTypeCode?: string;
  selectedCategory?: ServiceCategory;
  selectedServiceCategoryId?: number;
  selectedServiceCategoryCode?: string;
  selectedPackage?: ServicePackage;
  selectedPackageId?: number;
  selectedPackageCode?: string;
  customerDetails?: CustomerDetails;
  paymentMode?: PaymentMode;
  activeOrderId?: number;
  activeOrderNo?: string;
  billCounter?: number;
  completedOrder?: KioskOrder | null;
}

const KIOSK_SESSION_STORAGE_KEY = 'redbay_kiosk_active_session';

export function saveKioskSession(data: Partial<KioskSessionData>): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(data);
    window.sessionStorage?.setItem(KIOSK_SESSION_STORAGE_KEY, serialized);
    window.localStorage?.setItem(KIOSK_SESSION_STORAGE_KEY, serialized);
  } catch (e) {
    console.warn('Failed to save kiosk session', e);
  }
}

export function loadKioskSession(): KioskSessionData | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage?.getItem(KIOSK_SESSION_STORAGE_KEY) ||
                window.localStorage?.getItem(KIOSK_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as KioskSessionData;
  } catch (e) {
    console.warn('Failed to load kiosk session', e);
    return null;
  }
}

export function clearKioskSession(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.sessionStorage?.removeItem(KIOSK_SESSION_STORAGE_KEY);
    window.localStorage?.removeItem(KIOSK_SESSION_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear kiosk session', e);
  }
}

