import { apiFetch, getApiBaseUrl } from './apiConfig';
import { Platform } from 'react-native';

export interface PrinterConfig {
  printerId: string;
  printerName: string;
  printerPath: string;
  printerIP: string;
  printerPort: number;
  printerType: number; // 1: Receipt / Thermal, 2: Detailing Bay / Service, 3: Kiosk / Billing
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
 * Test print a ticket to a printer
 */
export async function testPrinter(id?: string, ip?: string, port = 9100, printerName = 'Printer'): Promise<{ success: boolean; message: string }> {
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

/**
 * Automatically select the active receipt printer in PrintMaster and print receipt
 */
export async function printOrderReceipt(order: any): Promise<PrintReceiptResponse> {
  const url = `${getApiBaseUrl()}/api/printers/print-receipt`;
  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to print receipt (HTTP ${res.status})`);
  }

  const json: PrintReceiptResponse = await res.json();

  // If in web environment and user wants browser print fallback when no physical printer responded
  if (Platform.OS === 'web' && json.printedVia === 'NO_PRINTER_CONFIGURED') {
    triggerBrowserReceiptPrint(order);
  }

  return json;
}

/**
 * Clean browser thermal receipt print fallback
 */
export function triggerBrowserReceiptPrint(order: any): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  const billNo = order.billNumber || order.orderNo || 'RB-0001';
  const custName = order.customerDetails?.customerName || order.customerName || 'Walk-in Customer';
  const plate = order.customerDetails?.vehicleNumber || order.vehicleNumber || 'WALK-IN';
  const mobile = order.customerDetails?.mobileNumber || order.mobileNumber || '-';
  const pkgName = order.selectedPackage?.name || order.packageName || 'Express Foam Wash';
  const total = Number(order.totalAmount || 0).toFixed(2);
  const gst = Number(order.gstAmount || 0).toFixed(2);
  const net = (Number(total) - Number(gst)).toFixed(2);
  const payMode = (order.paymentMode || order.payMode || 'CASH').toUpperCase();
  const payStatus = (order.paymentStatus || (payMode === 'CASH' ? 'PENDING' : 'PAID')).toUpperCase();
  const timeStr = order.createdAt || new Date().toLocaleTimeString('en-SG');

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
        <div class="center bold title">RED BAY CAR WASH</div>
        <div class="center" style="font-size: 11px; margin-top: 2px;">EXPRESS VEHICLE CARE & DETAILING</div>
        <div class="center" style="font-size: 11px;">48 Toh Guan Rd East, Singapore 608586</div>
        <div class="center" style="font-size: 11px;">Tel: +65 6789 0123  |  GST: M90382711</div>
        <div class="double-divider"></div>
        <div class="bill-box">
          <div style="font-size: 11px; font-weight: bold; letter-spacing: 1px;">OFFICIAL QUEUE TICKET</div>
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
            <span class="bold">SGD $${total}</span>
          </div>
        </div>
        <div class="divider"></div>
        <div class="section">
          <div class="row">
            <span>Subtotal (Net):</span>
            <span>SGD $${net}</span>
          </div>
          <div class="row">
            <span>GST (9% Included):</span>
            <span>SGD $${gst}</span>
          </div>
        </div>
        <div class="divider"></div>
        <div class="row bold" style="font-size: 14px; margin: 6px 0;">
          <span>TOTAL PAID:</span>
          <span>SGD $${total}</span>
        </div>
        <div class="divider"></div>
        <div class="row">
          <span>Payment Method:</span>
          <span>${payMode} [${payStatus}]</span>
        </div>
        <div class="double-divider"></div>
        <div class="center" style="margin-top: 8px;">Watch bay monitors for your queue</div>
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

