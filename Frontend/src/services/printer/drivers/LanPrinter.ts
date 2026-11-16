import { NativeModules, Platform } from 'react-native';
import { CompanySettings } from '../../companySettingsApi';
import { apiFetch } from '../../apiConfig';
import { PrinterFormatter } from '../PrinterFormatter';
import {
  IPrinterDriver,
  PrinterStatusResult,
  PrintOptions,
  PrintResult,
  UniversalPrinterConfig,
} from '../PrinterTypes';
import { uint8ArrayToBase64 } from './SunmiPrinter';

const { UniversalPrinterModule } = NativeModules;

/**
 * LAN/Wi-Fi ESC-POS printer driver.
 *
 * The driver no longer imports a global printerConfigManager.  Instead every
 * public method accepts an optional `config` parameter.  When supplied, that
 * config is used (enabling POS and Kiosk instances to inject their own config
 * independently).  When omitted the driver falls back to a sensible no-op /
 * error path so legacy callers that don't pass config still compile safely.
 *
 * The UniversalPrinterService always passes `config` explicitly, so there is
 * no ambiguity at runtime.
 */
export class LanPrinterDriver implements IPrinterDriver {
  readonly type = 'LAN' as const;
  private isConnectedCache: boolean = false;
  private lastTestedAt: number = 0;

  // ── helpers ─────────────────────────────────────────────────────────────────

  /** Resolve config: prefer the explicitly provided one, fall back to defaults. */
  private resolveConfig(config?: UniversalPrinterConfig): UniversalPrinterConfig {
    return config ?? {
      type: 'LAN',
      printerName: 'Thermal Printer',
      paperWidth: '80mm',
      lanIp: '',
      lanPort: 9100,
      autoCut: true,
      openDrawer: false,
      copies: 1,
      timeoutMs: 4000,
    };
  }

  // ── IPrinterDriver implementation ───────────────────────────────────────────

  public async connect(config?: UniversalPrinterConfig): Promise<PrinterStatusResult> {
    const cfg = this.resolveConfig(config);
    const ip = cfg.lanIp?.trim();
    const port = cfg.lanPort || 9100;
    const timeout = cfg.timeoutMs || 4000;

    if (!ip) {
      return {
        connected: false,
        status: 'DISCONNECTED',
        type: this.type,
        printerName: cfg.printerName,
        paperWidth: cfg.paperWidth,
        errorMessage: 'LAN printer IP address is not configured',
      };
    }

    // On Android APK, use native socket probe
    if (Platform.OS === 'android' && UniversalPrinterModule?.testLanConnection) {
      try {
        const res = await UniversalPrinterModule.testLanConnection(ip, port, timeout);
        this.isConnectedCache = !!res?.success;
        this.lastTestedAt = Date.now();

        return {
          connected: this.isConnectedCache,
          status: this.isConnectedCache ? 'CONNECTED' : 'DISCONNECTED',
          type: this.type,
          printerName: cfg.printerName,
          paperWidth: cfg.paperWidth,
          details: { ip, port, ...res },
          errorMessage: this.isConnectedCache ? undefined : res?.message,
        };
      } catch (err: any) {
        this.isConnectedCache = false;
        return {
          connected: false,
          status: 'ERROR',
          type: this.type,
          printerName: cfg.printerName,
          paperWidth: cfg.paperWidth,
          errorMessage: err?.message || `Cannot connect to ${ip}:${port}`,
        };
      }
    }

    // On web / other environments, probe TCP socket through backend
    try {
      const res = await apiFetch('/api/printers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, port, printerName: cfg.printerName }),
      });
      const data = await res.json().catch(() => ({}));
      this.isConnectedCache = !!(res.ok && data.success);
      this.lastTestedAt = Date.now();

      return {
        connected: this.isConnectedCache,
        status: this.isConnectedCache ? 'CONNECTED' : 'DISCONNECTED',
        type: this.type,
        printerName: cfg.printerName,
        paperWidth: cfg.paperWidth,
        details: { ip, port, ...data },
        errorMessage: this.isConnectedCache ? undefined : data?.message || `Cannot connect to ${ip}:${port}`,
      };
    } catch (err: any) {
      this.isConnectedCache = false;
      return {
        connected: false,
        status: 'ERROR',
        type: this.type,
        printerName: cfg.printerName,
        paperWidth: cfg.paperWidth,
        errorMessage: err?.message || `Cannot connect to ${ip}:${port}`,
      };
    }
  }

  public async disconnect(): Promise<boolean> {
    this.isConnectedCache = false;
    return true;
  }

  public async getStatus(config?: UniversalPrinterConfig): Promise<PrinterStatusResult> {
    const cfg = this.resolveConfig(config);
    // Cache for 10 seconds to avoid flooding network on rapid status queries
    if (Date.now() - this.lastTestedAt < 10000 && this.isConnectedCache) {
      return {
        connected: true,
        status: 'CONNECTED',
        type: this.type,
        printerName: cfg.printerName,
        paperWidth: cfg.paperWidth,
        details: { ip: cfg.lanIp, port: cfg.lanPort },
      };
    }

    return await this.connect(cfg);
  }

  public async printRaw(
    data: Uint8Array,
    options?: PrintOptions,
    config?: UniversalPrinterConfig
  ): Promise<boolean> {
    const cfg = this.resolveConfig(config);
    const ip = cfg.lanIp?.trim();
    const port = cfg.lanPort || 9100;
    const timeout = cfg.timeoutMs || 4000;

    if (!ip) {
      throw new Error('LAN printer IP address is not configured');
    }

    const base64 = uint8ArrayToBase64(data);

    if (Platform.OS === 'android' && UniversalPrinterModule?.printLanRaw) {
      return await UniversalPrinterModule.printLanRaw(ip, port, base64, timeout);
    }

    // Web / fallback: relay via backend endpoint to direct TCP socket
    try {
      const response = await apiFetch('/api/printers/print-raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, port, dataBase64: base64, timeoutMs: timeout }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || `Server returned HTTP ${response.status}`);
      }
      return true;
    } catch (err: any) {
      throw new Error(`LAN printer TCP socket error: ${err?.message}`);
    }
  }

  public async printReceipt(
    order: any,
    company: CompanySettings,
    options?: PrintOptions,
    config?: UniversalPrinterConfig
  ): Promise<PrintResult> {
    const startTime = Date.now();
    const cfg = this.resolveConfig(config);
    const jobId = `LAN-REC-${Date.now()}`;
    const orderNo = order?.OrderNo || order?.OrderNumber || order?.id || 'RECEIPT';

    try {
      const rawData = PrinterFormatter.buildOrderReceipt(order, company, cfg.paperWidth, options);
      const copies = Math.max(1, options?.copies ?? cfg.copies ?? 1);

      for (let i = 0; i < copies; i++) {
        await this.printRaw(rawData, options, cfg);
      }

      this.isConnectedCache = true;
      return {
        success: true,
        jobId,
        printerType: this.type,
        printerName: cfg.printerName,
        orderNo: String(orderNo),
        message: `Receipt printed successfully to LAN printer (${cfg.lanIp}:${cfg.lanPort})`,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      this.isConnectedCache = false;
      return {
        success: false,
        jobId,
        printerType: this.type,
        printerName: cfg.printerName,
        orderNo: String(orderNo),
        message: `LAN print failed: ${err?.message || 'Connection error'}`,
        offlineReason: err?.message,
        durationMs: Date.now() - startTime,
      };
    }
  }

  public async printKOT(
    order: any,
    company: CompanySettings,
    options?: PrintOptions,
    config?: UniversalPrinterConfig
  ): Promise<PrintResult> {
    const startTime = Date.now();
    const cfg = this.resolveConfig(config);
    const jobId = `LAN-KOT-${Date.now()}`;
    const orderNo = order?.OrderNo || order?.OrderNumber || order?.id || 'KOT';

    try {
      const rawData = PrinterFormatter.buildKOTReceipt(order, company, cfg.paperWidth, options);
      await this.printRaw(rawData, options, cfg);

      this.isConnectedCache = true;
      return {
        success: true,
        jobId,
        printerType: this.type,
        printerName: cfg.printerName,
        orderNo: String(orderNo),
        message: `KOT printed to LAN printer (${cfg.lanIp})`,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      this.isConnectedCache = false;
      return {
        success: false,
        jobId,
        printerType: this.type,
        printerName: cfg.printerName,
        orderNo: String(orderNo),
        message: `LAN KOT print failed: ${err?.message || 'Connection error'}`,
        offlineReason: err?.message,
        durationMs: Date.now() - startTime,
      };
    }
  }

  public async testPrint(
    company: CompanySettings,
    config?: UniversalPrinterConfig
  ): Promise<PrintResult> {
    const startTime = Date.now();
    const cfg = this.resolveConfig(config);
    const jobId = `LAN-TEST-${Date.now()}`;

    try {
      const rawData = PrinterFormatter.buildTestPrint(
        'LAN / WI-FI THERMAL',
        `${cfg.printerName} (${cfg.lanIp}:${cfg.lanPort})`,
        company,
        cfg.paperWidth
      );
      await this.printRaw(rawData, { autoCut: true }, cfg);

      this.isConnectedCache = true;
      return {
        success: true,
        jobId,
        printerType: this.type,
        printerName: cfg.printerName,
        message: `LAN test slip printed successfully to ${cfg.lanIp}:${cfg.lanPort}`,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      this.isConnectedCache = false;
      return {
        success: false,
        jobId,
        printerType: this.type,
        printerName: cfg.printerName,
        message: `LAN test print failed: ${err?.message || 'Cannot reach printer'}`,
        offlineReason: err?.message,
        durationMs: Date.now() - startTime,
      };
    }
  }
}

export const lanPrinterDriver = new LanPrinterDriver();
