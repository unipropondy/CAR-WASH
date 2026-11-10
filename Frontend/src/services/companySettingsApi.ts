import { apiFetch, getApiBaseUrl } from './apiConfig';

export interface CompanySettings {
  Id?: string;
  CompanyName: string;
  Address: string;
  GSTNo?: string;
  GSTPercentage: number;
  Phone?: string;
  Email?: string;
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
  return json.settings;
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
  return json.settings;
}

