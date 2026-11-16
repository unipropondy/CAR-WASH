import { CompanySettings } from '../companySettingsApi';

export type PrinterType = 'SUNMI' | 'LAN' | 'USB';

/**
 * Identifies which subsystem is sending the print job.
 *  'POS'   — counter / cashier terminal  (uses posPrinterConfigManager)
 *  'KIOSK' — self-service kiosk terminal (uses kioskPrinterConfigManager)
 */
export type PrinterContext = 'POS' | 'KIOSK';

export type PaperWidth = '58mm' | '80mm';

export type PrintJobType = 'RECEIPT' | 'KOT' | 'REPRINT' | 'PAYMENT' | 'TEST';

export type PrinterConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR' | 'OFFLINE';

export interface UsbDeviceInfo {
  deviceId: number;
  deviceName: string;
  vendorId: number;
  productId: number;
  manufacturerName?: string;
  productName?: string;
  hasPermission: boolean;
  isPrinter: boolean;
}

export interface UniversalPrinterConfig {
  type: PrinterType;
  printerName: string;
  paperWidth: PaperWidth;
  // LAN fields
  lanIp: string;
  lanPort: number;
  // USB fields
  usbDeviceId?: number;
  usbVendorId?: number;
  usbProductId?: number;
  usbDeviceName?: string;
  // Preferences
  autoCut: boolean;
  openDrawer: boolean;
  copies: number;
  timeoutMs: number;
}

export interface PrintOptions {
  jobType?: PrintJobType;
  copies?: number;
  autoCut?: boolean;
  openDrawer?: boolean;
  isReprint?: boolean;
  cashierName?: string;
  stationName?: string;
}

export interface PrintResult {
  success: boolean;
  jobId: string;
  printerType: PrinterType;
  printerName: string;
  message: string;
  orderNo?: string;
  offlineReason?: string;
  durationMs?: number;
}

export interface PrinterStatusResult {
  connected: boolean;
  status: PrinterConnectionStatus;
  type: PrinterType;
  printerName: string;
  paperWidth: PaperWidth;
  details?: Record<string, any>;
  errorMessage?: string;
}

export interface PrintJob {
  id: string;
  type: PrintJobType;
  order: any;
  company: CompanySettings;
  options: PrintOptions;
  /**
   * The UniversalPrinterConfig that was active when the job was enqueued.
   * Drivers use this to avoid reading from a shared global and ensure the
   * correct POS or Kiosk config is applied throughout the job lifecycle.
   */
  config?: UniversalPrinterConfig;
  createdAt: number;
  retries: number;
  status: 'PENDING' | 'PRINTING' | 'SUCCESS' | 'FAILED';
  error?: string;
}

export interface IPrinterDriver {
  readonly type: PrinterType;
  connect(config?: UniversalPrinterConfig): Promise<PrinterStatusResult>;
  disconnect(): Promise<boolean>;
  getStatus(config?: UniversalPrinterConfig): Promise<PrinterStatusResult>;
  printRaw(data: Uint8Array, options?: PrintOptions, config?: UniversalPrinterConfig): Promise<boolean>;
  printReceipt(order: any, company: CompanySettings, options?: PrintOptions, config?: UniversalPrinterConfig): Promise<PrintResult>;
  printKOT(order: any, company: CompanySettings, options?: PrintOptions, config?: UniversalPrinterConfig): Promise<PrintResult>;
  testPrint(company: CompanySettings, config?: UniversalPrinterConfig): Promise<PrintResult>;
}
