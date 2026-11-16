import { CompanySettings, fetchCompanySettings } from '../companySettingsApi';
import { lanPrinterDriver } from './drivers/LanPrinter';
import { sunmiPrinterDriver } from './drivers/SunmiPrinter';
import { usbPrinterDriver } from './drivers/UsbPrinter';
import {
  posPrinterConfigManager,
  kioskPrinterConfigManager,
  PrinterConfigManager,
} from './PrinterConfig';
import { printerQueue } from './PrinterQueue';
import {
  IPrinterDriver,
  PrinterContext,
  PrinterStatusResult,
  PrinterType,
  PrintOptions,
  PrintResult,
  UniversalPrinterConfig,
} from './PrinterTypes';

/**
 * UniversalPrinterService
 *
 * Context-aware universal printer.  Instantiate with a PrinterContext so the
 * service always reads and writes the correct configuration store:
 *
 *   posPrinter   — reads/writes posPrinterConfigManager   (key: redbay_printer_config_pos_v1)
 *   kioskPrinter — reads/writes kioskPrinterConfigManager (key: redbay_printer_config_kiosk_v1)
 *
 * POS and Kiosk printer configs are completely independent and never overwrite
 * each other.
 */
export class UniversalPrinterService {
  private activeDriver: IPrinterDriver;
  private cachedCompany: CompanySettings | null = null;
  private lastCompanyFetchTime: number = 0;
  private readonly configManager: PrinterConfigManager;
  public readonly context: PrinterContext;

  constructor(context: PrinterContext) {
    this.context = context;
    this.configManager = context === 'KIOSK' ? kioskPrinterConfigManager : posPrinterConfigManager;
    this.activeDriver = this.resolveDriver(this.configManager.getConfig().type);

    // React to runtime configuration changes
    this.configManager.subscribe((newConfig: UniversalPrinterConfig) => {
      this.activeDriver = this.resolveDriver(newConfig.type);
    });
  }

  private resolveDriver(type: PrinterType): IPrinterDriver {
    switch (type) {
      case 'SUNMI':
        return sunmiPrinterDriver;
      case 'USB':
        return usbPrinterDriver;
      case 'LAN':
      default:
        return lanPrinterDriver;
    }
  }

  /**
   * Return the config manager for this context (POS or Kiosk).
   * Callers that need to read/save config must use this — never reach across to
   * the other context's manager.
   */
  public getConfigManager(): PrinterConfigManager {
    return this.configManager;
  }

  /**
   * Get the driver for the currently active printer type in this context.
   */
  public getActiveDriver(): IPrinterDriver {
    const config = this.configManager.getConfig();
    if (this.activeDriver.type !== config.type) {
      this.activeDriver = this.resolveDriver(config.type);
    }
    return this.activeDriver;
  }

  /**
   * Get a driver by explicit printer type (does not change active driver).
   */
  public getDriver(type: PrinterType): IPrinterDriver {
    return this.resolveDriver(type);
  }

  /**
   * Dynamically fetch company details from the SQL Server CompanySettings table.
   * Cached for 30 seconds to reduce database round-trips.
   */
  public async getCompanySettings(forceRefresh: boolean = false): Promise<CompanySettings> {
    const now = Date.now();
    if (!forceRefresh && this.cachedCompany && now - this.lastCompanyFetchTime < 30000) {
      return this.cachedCompany;
    }

    try {
      const company = await fetchCompanySettings();
      if (company && company.CompanyName) {
        this.cachedCompany = company;
        this.lastCompanyFetchTime = now;
        return company;
      }
    } catch (err) {
      console.warn(`[UniversalPrinter:${this.context}] Could not fetch CompanySettings:`, err);
    }

    if (this.cachedCompany) {
      return this.cachedCompany;
    }

    // Safe fallback — no hardcoded company data
    return {
      CompanyName: '',
      Address: '',
      GSTNo: '',
      GSTPercentage: 9,
      Phone: '',
      Email: '',
      CashierName: '',
      Currency: 'SGD',
      CurrencySymbol: '$',
    };
  }

  /** Connect to the currently active printer driver for this context. */
  public async connect(overrideConfig?: UniversalPrinterConfig): Promise<PrinterStatusResult> {
    const cfg = overrideConfig || this.configManager.getConfig();
    return await this.getActiveDriver().connect(cfg);
  }

  /** Disconnect the currently active printer driver for this context. */
  public async disconnect(): Promise<boolean> {
    return await this.getActiveDriver().disconnect();
  }

  /** Retrieve connection status of the currently active printer in this context. */
  public async getStatus(overrideConfig?: UniversalPrinterConfig): Promise<PrinterStatusResult> {
    const cfg = overrideConfig || this.configManager.getConfig();
    return await this.getActiveDriver().getStatus(cfg);
  }

  /**
   * Print a customer receipt.
   *  - From POS  → uses posPrinterConfigManager  (key: redbay_printer_config_pos_v1)
   *  - From Kiosk → uses kioskPrinterConfigManager (key: redbay_printer_config_kiosk_v1)
   *
   * The active config is snapshotted at enqueue time and passed to the driver so
   * the job is always printed with the config that was current when it was queued.
   */
  public async printReceipt(order: any, options?: PrintOptions): Promise<PrintResult> {
    const company = await this.getCompanySettings();
    const driver = this.getActiveDriver();
    const config = this.configManager.getConfig();

    return await printerQueue.enqueue(
      driver,
      options?.isReprint ? 'REPRINT' : 'RECEIPT',
      order,
      company,
      options,
      config
    );
  }

  /**
   * Print a Kitchen / Wash Bay Order Ticket (KOT) — POS only.
   */
  public async printKOT(order: any, options?: PrintOptions): Promise<PrintResult> {
    const company = await this.getCompanySettings();
    const driver = this.getActiveDriver();
    const config = this.configManager.getConfig();

    return await printerQueue.enqueue(driver, 'KOT', order, company, options, config);
  }

  /**
   * Reprint a receipt (bypasses duplicate-print protection).
   */
  public async reprintReceipt(order: any, options?: PrintOptions): Promise<PrintResult> {
    return await this.printReceipt(order, { ...options, isReprint: true });
  }

  /**
   * Print a diagnostic test slip on the currently configured printer for this context.
   */
  public async testPrint(overrideConfig?: UniversalPrinterConfig): Promise<PrintResult> {
    const company = await this.getCompanySettings(true);
    const driver = this.getActiveDriver();
    const config = overrideConfig || this.configManager.getConfig();

    return await printerQueue.enqueue(driver, 'TEST', {}, company, { autoCut: true }, config);
  }
}

// ─── Context-specific singletons ─────────────────────────────────────────────

/**
 * POS printer service.
 * Uses posPrinterConfigManager (key: redbay_printer_config_pos_v1).
 * Use for: POS receipt, KOT, reprint.
 */
export const posPrinter = new UniversalPrinterService('POS');

/**
 * Kiosk printer service.
 * Uses kioskPrinterConfigManager (key: redbay_printer_config_kiosk_v1).
 * Use for: Kiosk receipt, Kiosk order-success print.
 */
export const kioskPrinter = new UniversalPrinterService('KIOSK');

/**
 * @deprecated Use posPrinter for POS contexts or kioskPrinter for Kiosk contexts.
 * Alias kept for backward-compatibility with existing imports of `universalPrinter`.
 */
export const universalPrinter = posPrinter;
