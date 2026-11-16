import { NativeModules, Platform } from 'react-native';
import { CompanySettings } from '../../companySettingsApi';
import { PrinterFormatter } from '../PrinterFormatter';
import {
  IPrinterDriver,
  PaperWidth,
  PrinterStatusResult,
  PrintOptions,
  PrintResult,
  UniversalPrinterConfig,
} from '../PrinterTypes';

const { UniversalPrinterModule } = NativeModules;

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;

    base64 += chars[b0 >> 2];
    base64 += chars[((b0 & 3) << 4) | (b1 >> 4)];
    base64 += i + 1 < len ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    base64 += i + 2 < len ? chars[b2 & 63] : '=';
  }
  return base64;
}

/**
 * SUNMI built-in thermal printer driver.
 *
 * Config is passed explicitly by the calling UniversalPrinterService so the
 * correct POS or Kiosk configuration is used.  The driver no longer reads
 * from a shared global printerConfigManager.
 */
export class SunmiPrinterDriver implements IPrinterDriver {
  readonly type = 'SUNMI' as const;

  private resolveConfig(config?: UniversalPrinterConfig): UniversalPrinterConfig {
    return config ?? {
      type: 'SUNMI',
      printerName: 'SUNMI Thermal Printer',
      paperWidth: '58mm',
      lanIp: '',
      lanPort: 9100,
      autoCut: true,
      openDrawer: false,
      copies: 1,
      timeoutMs: 4000,
    };
  }

  public async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android' || !UniversalPrinterModule) return false;
    try {
      return await UniversalPrinterModule.isSunmiDevice();
    } catch {
      return false;
    }
  }

  public async connect(config?: UniversalPrinterConfig): Promise<PrinterStatusResult> {
    const cfg = this.resolveConfig(config);
    if (Platform.OS !== 'android' || !UniversalPrinterModule) {
      return {
        connected: false,
        status: 'OFFLINE',
        type: this.type,
        printerName: cfg.printerName || 'SUNMI Thermal Printer',
        paperWidth: cfg.paperWidth,
        errorMessage: 'SUNMI hardware AIDL driver is only supported on Android SUNMI devices.',
      };
    }

    try {
      const res = await UniversalPrinterModule.connectSunmi();
      const detectedWidth: PaperWidth = res?.paperWidth === '80mm' ? '80mm' : '58mm';

      return {
        connected: true,
        status: 'CONNECTED',
        type: this.type,
        printerName: cfg.printerName || 'SUNMI Built-in Thermal Printer',
        paperWidth: detectedWidth,
        details: res,
      };
    } catch (err: any) {
      console.warn('[SunmiPrinterDriver] connect failed:', err);
      return {
        connected: false,
        status: 'ERROR',
        type: this.type,
        printerName: cfg.printerName || 'SUNMI Thermal Printer',
        paperWidth: cfg.paperWidth,
        errorMessage: err?.message || 'Failed to connect to SUNMI AIDL service',
      };
    }
  }

  public async disconnect(): Promise<boolean> {
    if (Platform.OS !== 'android' || !UniversalPrinterModule) return true;
    try {
      return await UniversalPrinterModule.disconnectSunmi();
    } catch (err) {
      console.warn('[SunmiPrinterDriver] disconnect failed:', err);
      return false;
    }
  }

  public async getStatus(config?: UniversalPrinterConfig): Promise<PrinterStatusResult> {
    const cfg = this.resolveConfig(config);
    if (Platform.OS !== 'android' || !UniversalPrinterModule) {
      return {
        connected: false,
        status: 'OFFLINE',
        type: this.type,
        printerName: cfg.printerName,
        paperWidth: cfg.paperWidth,
      };
    }

    try {
      const res = await UniversalPrinterModule.getSunmiStatus();
      const isConnected = !!res?.connected;
      const paperWidth: PaperWidth = res?.paperWidth === '80mm' ? '80mm' : '58mm';

      return {
        connected: isConnected,
        status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
        type: this.type,
        printerName: res?.printerModal || cfg.printerName,
        paperWidth,
        details: res,
      };
    } catch (err: any) {
      return {
        connected: false,
        status: 'ERROR',
        type: this.type,
        printerName: cfg.printerName,
        paperWidth: cfg.paperWidth,
        errorMessage: err?.message,
      };
    }
  }

  public async printRaw(
    data: Uint8Array,
    options?: PrintOptions,
    config?: UniversalPrinterConfig
  ): Promise<boolean> {
    if (Platform.OS !== 'android' || !UniversalPrinterModule) {
      throw new Error('SUNMI printing requires native Android SUNMI hardware.');
    }

    const cfg = this.resolveConfig(config);
    const autoCut = options?.autoCut ?? cfg.autoCut ?? true;
    const base64 = uint8ArrayToBase64(data);

    return await UniversalPrinterModule.printSunmiRaw(base64, autoCut);
  }

  public async printReceipt(
    order: any,
    company: CompanySettings,
    options?: PrintOptions,
    config?: UniversalPrinterConfig
  ): Promise<PrintResult> {
    const startTime = Date.now();
    const cfg = this.resolveConfig(config);
    const jobId = `SUNMI-REC-${Date.now()}`;
    const orderNo = order?.OrderNo || order?.OrderNumber || order?.id || 'RECEIPT';

    try {
      const status = await this.getStatus(cfg);
      if (!status.connected) {
        const connectRes = await this.connect(cfg);
        if (!connectRes.connected) {
          throw new Error(connectRes.errorMessage || 'SUNMI printer service not connected');
        }
      }

      const rawData = PrinterFormatter.buildOrderReceipt(order, company, cfg.paperWidth, options);
      const copies = Math.max(1, options?.copies ?? cfg.copies ?? 1);

      for (let i = 0; i < copies; i++) {
        await this.printRaw(rawData, options, cfg);
      }

      return {
        success: true,
        jobId,
        printerType: this.type,
        printerName: cfg.printerName,
        orderNo: String(orderNo),
        message: 'Receipt printed successfully on SUNMI printer',
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        jobId,
        printerType: this.type,
        printerName: cfg.printerName,
        orderNo: String(orderNo),
        message: `SUNMI print failed: ${err?.message || 'Unknown error'}`,
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
    const jobId = `SUNMI-KOT-${Date.now()}`;
    const orderNo = order?.OrderNo || order?.OrderNumber || order?.id || 'KOT';

    try {
      const status = await this.getStatus(cfg);
      if (!status.connected) {
        await this.connect(cfg);
      }

      const rawData = PrinterFormatter.buildKOTReceipt(order, company, cfg.paperWidth, options);
      await this.printRaw(rawData, options, cfg);

      return {
        success: true,
        jobId,
        printerType: this.type,
        printerName: cfg.printerName,
        orderNo: String(orderNo),
        message: 'KOT printed successfully on SUNMI printer',
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        jobId,
        printerType: this.type,
        printerName: cfg.printerName,
        orderNo: String(orderNo),
        message: `SUNMI KOT print failed: ${err?.message || 'Unknown error'}`,
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
    const jobId = `SUNMI-TEST-${Date.now()}`;

    try {
      await this.connect(cfg);
      const rawData = PrinterFormatter.buildTestPrint(
        'SUNMI BUILT-IN THERMAL',
        cfg.printerName || 'Sunmi Device',
        company,
        cfg.paperWidth
      );
      await this.printRaw(rawData, { autoCut: true }, cfg);

      return {
        success: true,
        jobId,
        printerType: this.type,
        printerName: cfg.printerName,
        message: 'SUNMI diagnostic test slip printed successfully',
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        jobId,
        printerType: this.type,
        printerName: cfg.printerName,
        message: `SUNMI test print failed: ${err?.message || 'Unknown error'}`,
        offlineReason: err?.message,
        durationMs: Date.now() - startTime,
      };
    }
  }
}

export const sunmiPrinterDriver = new SunmiPrinterDriver();
