import { apiFetch, getApiBaseUrl } from './apiConfig';
import { Platform } from 'react-native';
import { posPrinter, kioskPrinter, universalPrinter } from './printer/UniversalPrinter';
import { fetchCompanySettings, CompanySettings } from './companySettingsApi';
import { PrintOptions } from './printer/PrinterTypes';

export interface PrinterConfig {
  printerId: string;
  printerName: string;
  printerPath: string;
  printerIP: string;
  printerPort: number;
  /**
   * PrinterType mapping from SQL PrintMaster:
   *   1 — POS Receipt / Thermal
   *   2 — Detailing Bay / Service
   *   3 — Kiosk / Billing
   */
  printerType: number;
  kitchenTypeName?: string;
  kitchenTypeValue?: number;
  isActive: boolean;
  printCopy: number;
  isEnabled: boolean;
}

export interface PrintReceiptResponse {
  success: boolean;
  printedVia?: string;
  printer?: string;
  ip?: string;
  port?: number;
  message?: string;
  orderNo?: string;
  offlineReason?: string;
}

/**
 * Fetch all configured printers from PrintMaster
 */
export async function fetchPrinters(): Promise<PrinterConfig[]> {
  const url = `${getApiBaseUrl()}/api/printers`;
  const res = await apiFetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load printers (HTTP ${res.status})`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.message || 'Error fetching printers');
  }
  return json.printers.map((p: any) => ({
    printerId: p.PrinterId || p.printerId,
    printerName: p.PrinterName || p.printerName || 'Printer',
    printerPath: p.PrinterPath || p.printerPath || '',
    printerIP: p.PrinterIP || p.printerIP || '',
    printerPort: p.PrinterPort || p.printerPort || 9100,
    printerType: p.PrinterType !== undefined ? p.PrinterType : (p.printerType ?? 1),
    kitchenTypeName: p.KitchenTypeName || p.kitchenTypeName || '',
    kitchenTypeValue: p.KitchenTypeValue || p.kitchenTypeValue || 0,
    isActive: Boolean(p.IsActive !== undefined ? p.IsActive : p.isActive),
    printCopy: p.PrintCopy || p.printCopy || 1,
    isEnabled: Boolean(p.IsEnabled !== undefined ? p.IsEnabled : p.isEnabled),
  }));
}

/**
 * Add a new printer configuration into PrintMaster
 */
export async function createPrinter(data: Partial<PrinterConfig>): Promise<PrinterConfig> {
  const url = `${getApiBaseUrl()}/api/printers`;
  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to add printer (HTTP ${res.status})`);
  }
  const json = await res.json();
  return json.printer;
}

/**
 * Update an existing printer configuration in PrintMaster
 */
export async function updatePrinter(id: string, data: Partial<PrinterConfig>): Promise<PrinterConfig> {
  const url = `${getApiBaseUrl()}/api/printers/${id}`;
  const res = await apiFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to update printer (HTTP ${res.status})`);
  }
  const json = await res.json();
  return json.printer;
}

/**
 * Delete a printer configuration from PrintMaster
 */
export async function deletePrinter(id: string): Promise<boolean> {
  const url = `${getApiBaseUrl()}/api/printers/${id}`;
  const res = await apiFetch(url, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to delete printer (HTTP ${res.status})`);
  }
  return true;
}

/**
 * Test print a ticket to a printer.
 * On Android, delegates to the POS printer (native universal printer).
 */
export async function testPrinter(
  id?: string,
  ip?: string,
  port = 9100,
  printerName = 'Printer'
): Promise<{ success: boolean; message: string }> {
  // First attempt native POS printer test on Android devices
  if (Platform.OS === 'android') {
    try {
      const nativeRes = await posPrinter.testPrint();
      if (nativeRes.success) {
        return { success: true, message: nativeRes.message };
      }
    } catch (ignored) {}
  }

  const url = id
    ? `${getApiBaseUrl()}/api/printers/${id}/test`
    : `${getApiBaseUrl()}/api/printers/test`;

  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip, port, printerName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Printer test failed (HTTP ${res.status})`);
  }
  return await res.json();
}

// ─── POS Print Functions ──────────────────────────────────────────────────────

/**
 * Print a POS order receipt / KOT / reprint.
 *
 * Always uses the POS printer config (posPrinterConfigManager).
 * Never touches the Kiosk printer config.
 *
 * Routing priority:
 *  1. Native Android POS printer (SUNMI / LAN / USB via posPrinter)
 *  2. Backend API fallback (PrintMaster PrinterType=1 — POS receipt)
 *  3. Web browser print dialog
 */
export async function printOrderReceipt(
  order: any,
  options?: PrintOptions
): Promise<PrintReceiptResponse> {
  // 1. Primary: Use Native POS Universal Printer on Android devices
  if (Platform.OS === 'android') {
    try {
      const nativeResult = await posPrinter.printReceipt(order, options);
      if (nativeResult.success) {
        return {
          success: true,
          printedVia: nativeResult.printerType,
          printer: nativeResult.printerName,
          orderNo: nativeResult.orderNo,
          message: nativeResult.message,
        };
      } else {
        console.warn('[printOrderReceipt:POS] POS printer direct print failed:', nativeResult.message);
      }
    } catch (nativeErr: any) {
      console.warn('[printOrderReceipt:POS] POS printer direct exception:', nativeErr);
    }
  }

  // 2. Secondary: Fallback to backend API (uses PrinterType=1 — POS receipt printer)
  try {
    const url = `${getApiBaseUrl()}/api/printers/print-receipt`;
    const res = await apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });

    if (res.ok) {
      const json: PrintReceiptResponse = await res.json();
      if (Platform.OS === 'web' && json.printedVia === 'NO_PRINTER_CONFIGURED') {
        const company = await fetchCompanySettings().catch(() => ({} as CompanySettings));
        triggerBrowserReceiptPrint(order, company);
      }
      return json;
    }
  } catch (backendErr) {
    console.warn('[printOrderReceipt:POS] Backend print failed:', backendErr);
  }

  // 3. Web fallback: browser print
  if (Platform.OS === 'web') {
    const company = await fetchCompanySettings().catch(() => ({} as CompanySettings));
    triggerBrowserReceiptPrint(order, company);
    return {
      success: true,
      printedVia: 'BROWSER_DIALOG',
      message: 'Printed via browser print dialog',
      orderNo: String(order?.OrderNo || order?.OrderNumber || order?.id || ''),
    };
  }

  return {
    success: false,
    printedVia: 'NONE',
    message: 'Could not connect to POS thermal printer. Check POS printer settings.',
  };
}

// ─── Kiosk Print Functions ────────────────────────────────────────────────────

/**
 * Print a Kiosk order receipt (Kiosk Receipt or Kiosk Order Success).
 *
 * Always uses the Kiosk printer config (kioskPrinterConfigManager).
 * Never touches the POS printer config.
 *
 * Routing priority:
 *  1. Native Android Kiosk printer (SUNMI / LAN / USB via kioskPrinter)
 *  2. Backend API fallback (PrintMaster PrinterType=3 — Kiosk billing printer)
 *  3. Web browser print dialog
 */
export async function printKioskReceipt(
  order: any,
  options?: PrintOptions
): Promise<PrintReceiptResponse> {
  // 1. Primary: Use Native Kiosk Universal Printer on Android devices
  if (Platform.OS === 'android') {
    try {
      const nativeResult = await kioskPrinter.printReceipt(order, options);
      if (nativeResult.success) {
        return {
          success: true,
          printedVia: nativeResult.printerType,
          printer: nativeResult.printerName,
          orderNo: nativeResult.orderNo,
          message: nativeResult.message,
        };
      } else {
        console.warn('[printKioskReceipt] Kiosk printer direct print failed:', nativeResult.message);
      }
    } catch (nativeErr: any) {
      console.warn('[printKioskReceipt] Kiosk printer direct exception:', nativeErr);
    }
  }

  // 2. Secondary: Fallback to backend API (uses PrinterType=3 — Kiosk billing printer)
  try {
    const url = `${getApiBaseUrl()}/api/printers/print-kiosk-receipt`;
    const res = await apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });

    if (res.ok) {
      const json: PrintReceiptResponse = await res.json();
      if (Platform.OS === 'web' && json.printedVia === 'NO_PRINTER_CONFIGURED') {
        const company = await fetchCompanySettings().catch(() => ({} as CompanySettings));
        triggerBrowserReceiptPrint(order, company);
      }
      return json;
    }
  } catch (backendErr) {
    console.warn('[printKioskReceipt] Backend kiosk print failed:', backendErr);
  }

  // 3. Web fallback: browser print
  if (Platform.OS === 'web') {
    const company = await fetchCompanySettings().catch(() => ({} as CompanySettings));
    triggerBrowserReceiptPrint(order, company);
    return {
      success: true,
      printedVia: 'BROWSER_DIALOG',
      message: 'Kiosk receipt printed via browser print dialog',
      orderNo: String(order?.OrderNo || order?.OrderNumber || order?.id || ''),
    };
  }

  return {
    success: false,
    printedVia: 'NONE',
    message: 'Could not connect to Kiosk thermal printer. Check Kiosk printer settings.',
  };
}

// ─── Browser Fallback ─────────────────────────────────────────────────────────

/**
 * Clean browser thermal receipt print fallback using dynamic CompanySettings.
 */
export function triggerBrowserReceiptPrint(order: any, company?: Partial<CompanySettings>): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  const billNo = order.billNumber || order.orderNo || order.OrderNo || 'RB-0001';
  const custName = order.customerDetails?.customerName || order.customerName || order.CustomerName || 'Walk-in Customer';
  const plate = order.customerDetails?.vehicleNumber || order.vehicleNumber || order.VehicleNo || order.VehicleNumber || 'WALK-IN';
  const mobile = order.customerDetails?.mobileNumber || order.mobileNumber || order.Phone || order.ContactNo || '-';
  const pkgName = order.selectedPackage?.name || order.packageName || order.PackageName || 'Express Foam Wash';
  const total = Number(order.totalAmount || order.TotalAmount || 0).toFixed(2);
  const gst = Number(order.gstAmount || order.TaxAmount || 0).toFixed(2);
  const net = (Number(total) - Number(gst)).toFixed(2);
  const payMode = (order.paymentMode || order.payMode || order.PaymentMode || 'CASH').toUpperCase();
  const payStatus = (order.paymentStatus || (payMode === 'CASH' ? 'PENDING' : 'PAID')).toUpperCase();
  const timeStr = order.createdAt || new Date().toLocaleTimeString('en-SG');

  // Dynamic Company Details from dbo.CompanySettings
  const companyName = company?.CompanyName || 'CAR WASH';
  const address = company?.Address || '';
  const phone = company?.Phone ? `Tel: ${company.Phone}` : '';
  const gstNo = company?.GSTNo ? `GST Reg: ${company.GSTNo}` : '';
  const email = company?.Email ? `Email: ${company.Email}` : '';
  const currencySymbol = company?.CurrencySymbol || '$';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt - ${billNo}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 76mm;
            margin: 0 auto;
            padding: 16px 8px;
            color: #000;
            font-size: 13px;
            line-height: 1.45;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .title { font-size: 17px; font-weight: 900; letter-spacing: 0.5px; }
          .bill-box {
            border: 2px dashed #000;
            padding: 10px 6px;
            margin: 12px 0;
            text-align: center;
          }
          .bill-num { font-size: 22px; font-weight: 900; margin-top: 4px; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .double-divider { border-top: 2px solid #000; margin: 10px 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .section { margin: 8px 0; }
        </style>
      </head>
      <body>
        <div class="center bold title">${companyName}</div>
        ${address ? `<div class="center" style="font-size: 11px; margin-top: 2px;">${address.replace(/\n/g, '<br/>')}</div>` : ''}
        ${phone || gstNo ? `<div class="center" style="font-size: 11px;">${phone} ${phone && gstNo ? '|' : ''} ${gstNo}</div>` : ''}
        ${email ? `<div class="center" style="font-size: 10px;">${email}</div>` : ''}
        <div class="double-divider"></div>
        <div class="bill-box">
          <div style="font-size: 11px; font-weight: bold; letter-spacing: 1px;">OFFICIAL RECEIPT</div>
          <div class="bill-num">${billNo}</div>
        </div>
        <div class="double-divider"></div>
        <div class="section">
          <div class="row"><span>Date: ${new Date().toLocaleDateString('en-GB')}</span><span>Time: ${timeStr}</span></div>
          <div style="margin-top: 4px;">Customer: ${custName}</div>
          <div>Vehicle:  ${plate}</div>
          <div>Contact:  ${mobile}</div>
        </div>
        <div class="divider"></div>
        <div class="row bold" style="font-size: 12px;">
          <span>ITEM / SERVICE</span>
          <span>AMOUNT</span>
        </div>
        <div class="divider"></div>
        <div class="section">
          <div class="bold">${pkgName}</div>
          <div class="row">
            <span style="color: #444; font-size: 11px;">  Vehicle Care Service</span>
            <span class="bold">${currencySymbol}${total}</span>
          </div>
        </div>
        <div class="divider"></div>
        <div class="section">
          <div class="row">
            <span>Subtotal (Net):</span>
            <span>${currencySymbol}${net}</span>
          </div>
          <div class="row">
            <span>GST (${company?.GSTPercentage ?? 9}% Included):</span>
            <span>${currencySymbol}${gst}</span>
          </div>
        </div>
        <div class="divider"></div>
        <div class="row bold" style="font-size: 14px; margin: 6px 0;">
          <span>TOTAL PAID:</span>
          <span>${currencySymbol}${total}</span>
        </div>
        <div class="divider"></div>
        <div class="row">
          <span>Payment Method:</span>
          <span>${payMode} [${payStatus}]</span>
        </div>
        <div class="double-divider"></div>
        <div class="center" style="margin-top: 8px;">Please watch bay monitors for your queue</div>
        <div class="center bold" style="margin-top: 4px; font-size: 13px;">DRIVE IN. SHINE OUT.</div>
        <div class="center" style="font-size: 11px; margin-top: 2px;">Thank you for your visit!</div>
        <div style="height: 30px;"></div>
      </body>
    </html>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  }
}

// Re-export for callers that import universalPrinter directly from printerApi
export { universalPrinter, posPrinter, kioskPrinter };
