import { apiFetch, getApiBaseUrl } from './apiConfig';

export interface CompanySettings {
  Id?: string;
  CompanyName: string;
  Address: string;
  GSTNo?: string;
  GSTPercentage: number;
  Phone?: string;
  Email?: string;
  ReportEmail?: string;
  CashierName?: string;
  Currency: string;
  CurrencySymbol: string;
  CompanyLogoUrl?: string;
  HalalLogoUrl?: string;
  ShowCompanyLogo?: boolean;
  ShowHalalLogo?: boolean;
  PrinterIP?: string;
  TaxMode?: string;
  UpdatedOn?: string;
}

const CACHE_STORAGE_KEY = 'redbay_company_settings_cache_v1';

// In-memory cache for dynamic global settings access across all components
let cachedSettings: CompanySettings | null = null;

// Initialize cache immediately from localStorage on Web
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const stored = window.localStorage.getItem(CACHE_STORAGE_KEY);
    if (stored) {
      cachedSettings = JSON.parse(stored);
    }
  } catch (e) {
    // Ignore storage parse errors
  }
}

type SettingsListener = (settings: CompanySettings | null) => void;
const listeners = new Set<SettingsListener>();

export function subscribeCompanySettings(listener: SettingsListener): () => void {
  listeners.add(listener);
  if (cachedSettings) {
    try {
      listener(cachedSettings);
    } catch (e) {
      console.warn('Error in initial companySettings listener call:', e);
    }
  }
  return () => {
    listeners.delete(listener);
  };
}

function notifySettingsListeners(settings: CompanySettings | null): void {
  listeners.forEach((listener) => {
    try {
      listener(settings);
    } catch (e) {
      console.warn('Error in companySettings listener:', e);
    }
  });
}

export function getCachedCompanySettings(): CompanySettings | null {
  return cachedSettings;
}

export function getCachedGstRate(): number {
  return cachedSettings?.GSTPercentage != null ? Number(cachedSettings.GSTPercentage) : 0;
}

export function setCachedCompanySettings(settings: CompanySettings | null): void {
  cachedSettings = settings;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      if (settings) {
        window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(settings));
      } else {
        window.localStorage.removeItem(CACHE_STORAGE_KEY);
      }
    } catch (e) {
      // Ignore storage errors
    }
  }
  notifySettingsListeners(settings);
}

/**
 * Fetch company settings from dbo.CompanySettings
 */
export async function fetchCompanySettings(): Promise<CompanySettings> {
  const url = `${getApiBaseUrl()}/api/settings/company`;
  const res = await apiFetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load company settings (HTTP ${res.status})`);
  }
  const json = await res.json();
  if (!json.success || !json.settings) {
    throw new Error(json.message || 'Error fetching company settings');
  }
  setCachedCompanySettings(json.settings);
  return json.settings;
}

/**
 * Returns the full URL to the company logo served from SQL Server.
 * Always includes a cache-bust version keyed to UpdatedOn so changes propagate.
 */
export function getCompanyLogoUrl(settings?: CompanySettings | null): string {
  const base = getApiBaseUrl();
  const v = settings?.UpdatedOn ? new Date(settings.UpdatedOn).getTime() : 1;
  return `${base}/api/company-settings/logo?v=${v}`;
}

/**
 * Returns the full URL to the company banner (the pill-logo strip) served from SQL Server.
 */
export function getCompanyBannerUrl(settings?: CompanySettings | null): string {
  const base = getApiBaseUrl();
  const v = settings?.UpdatedOn ? new Date(settings.UpdatedOn).getTime() : 1;
  return `${base}/api/company-settings/banner?v=${v}`;
}


/**
 * Update company settings in dbo.CompanySettings
 */
export async function updateCompanySettings(data: Partial<CompanySettings>): Promise<CompanySettings> {
  const url = `${getApiBaseUrl()}/api/settings/company`;
  const res = await apiFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyName: data.CompanyName,
      address: data.Address,
      gstNo: data.GSTNo,
      gstPercentage: data.GSTPercentage,
      phone: data.Phone,
      email: data.Email,
      reportEmail: data.ReportEmail || (data as any).reportEmail,
      currency: data.Currency,
      currencySymbol: data.CurrencySymbol,
      taxMode: data.TaxMode,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to update company settings (HTTP ${res.status})`);
  }

  const json = await res.json();
  if (!json.success || !json.settings) {
    throw new Error(json.message || 'Error updating company settings');
  }
  setCachedCompanySettings(json.settings);
  return json.settings;
}


