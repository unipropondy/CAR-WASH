import { NativeModules, Platform } from 'react-native';
import { CompanySettings } from '../../companySettingsApi';
import { PrinterFormatter } from '../PrinterFormatter';
import {
  IPrinterDriver,
  PrinterStatusResult,
  PrintOptions,
  PrintResult,
  UsbDeviceInfo,
  UniversalPrinterConfig,
} from '../PrinterTypes';
import { uint8ArrayToBase64 } from './SunmiPrinter';

const { UniversalPrinterModule } = NativeModules;

/**
 * USB Host thermal printer driver.
 *
 * Config is passed explicitly by the calling UniversalPrinterService so the
 * correct POS or Kiosk USB device binding is applied.
 */
export class UsbPrinterDriver implements IPrinterDriver {
  readonly type = 'USB' as const;

  private resolveConfig(config?: UniversalPrinterConfig): UniversalPrinterConfig {
    return config ?? {
      type: 'USB',
      printerName: 'USB Thermal Printer',
      paperWidth: '80mm',
      lanIp: '',
      lanPort: 9100,
      autoCut: true,
      openDrawer: false,
      copies: 1,
      timeoutMs: 4000,
    };
  }

  /**
   * Enumerate all connected USB devices and filter for printer interfaces.
   */
  public async listDevices(): Promise<UsbDeviceInfo[]> {
    if (Platform.OS !== 'android' || !UniversalPrinterModule?.listUsbPrinters) {
      return [];
    }
    try {
      const devices = await UniversalPrinterModule.listUsbPrinters();
      return Array.isArray(devices) ? devices : [];
    } catch (err) {
      console.warn('[UsbPrinterDriver] listDevices error:', err);
      return [];
    }
  }

  /**
   * Request Android USB Host permission for a specific USB device ID.
   */
  public async requestPermission(deviceId: number): Promise<boolean> {
    if (Platform.OS !== 'android' || !UniversalPrinterModule?.requestUsbPermission) {
      return false;
    }
    try {
      return await UniversalPrinterModule.requestUsbPermission(deviceId);
    } catch (err) {
      console.warn('[UsbPrinterDriver] requestPermission error:', err);
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
        printerName: cfg.printerName || 'USB Thermal Printer',
        paperWidth: cfg.paperWidth,
        errorMessage: 'USB Host printing is only supported on Android devices.',
      };
    }

    try {
      let targetDeviceId = cfg.usbDeviceId;

      if (targetDeviceId == null) {
        const devices = await this.listDevices();
        const printerDev = devices.find((d) => d.isPrinter) || devices[0];
        if (!printerDev) {
          return {
            connected: false,
            status: 'DISCONNECTED',
            type: this.type,
            printerName: cfg.printerName,
            paperWidth: cfg.paperWidth,
            errorMessage:
              'No USB printer detected. Please connect a USB printer via OTG or USB port.',
          };
        }
        targetDeviceId = printerDev.deviceId;
      }

      // Check / request permission
      try {
        await this.requestPermission(targetDeviceId);
      } catch (permErr: any) {
        return {
          connected: false,
          status: 'ERROR',
          type: this.type,
          printerName: cfg.printerName,
          paperWidth: cfg.paperWidth,
          errorMessage: `USB Permission Denied: ${permErr?.message || 'Please grant USB access'}`,
        };
      }

      const res = await UniversalPrinterModule.connectUsb(targetDeviceId);

      return {
        connected: true,
        status: 'CONNECTED',
        type: this.type,
        printerName: res?.productName || cfg.usbDeviceName || cfg.printerName,
        paperWidth: cfg.paperWidth,
        details: res,
      };
    } catch (err: any) {
      console.warn('[UsbPrinterDriver] connect failed:', err);
      return {
        connected: false,
        status: 'ERROR',
        type: this.type,
        printerName: cfg.printerName,
        paperWidth: cfg.paperWidth,
        errorMessage: err?.message || 'Failed to connect to USB printer',
      };
    }
  }

  public async disconnect(): Promise<boolean> {
    if (Platform.OS !== 'android' || !UniversalPrinterModule?.disconnectUsb) {
      return true;
    }
    try {
      return await UniversalPrinterModule.disconnectUsb();
    } catch (err) {
      console.warn('[UsbPrinterDriver] disconnect failed:', err);
      return false;
    }
  }

  public async getStatus(config?: UniversalPrinterConfig): Promise<PrinterStatusResult> {
    const cfg = this.resolveConfig(config);

    if (Platform.OS !== 'android' || !UniversalPrinterModule?.getUsbStatus) {
      return {
        connected: false,
        status: 'OFFLINE',
        type: this.type,
        printerName: cfg.printerName,
        paperWidth: cfg.paperWidth,
      };
    }

    try {
      const res = await UniversalPrinterModule.getUsbStatus();
      const isConnected = !!res?.connected;

      return {
        connected: isConnected,
        status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
        type: this.type,
        printerName: res?.productName || cfg.usbDeviceName || cfg.printerName,
        paperWidth: cfg.paperWidth,
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
    _config?: UniversalPrinterConfig
  ): Promise<boolean> {
    if (Platform.OS !== 'android' || !UniversalPrinterModule?.printUsbRaw) {
      throw new Error('USB printing is only available on native Android devices.');
    }

    const base64 = uint8ArrayToBase64(data);
    return await UniversalPrinterModule.printUsbRaw(base64);
  }

  public async printReceipt(
    order: any,
    company: CompanySettings,
    options?: PrintOptions,
    config?: UniversalPrinterConfig
  ): Promise<PrintResult> {
    const startTime = Date.now();
    const cfg = this.resolveConfig(config);
    const jobId = `USB-REC-${Date.now()}`;
    const orderNo = order?.OrderNo || order?.OrderNumber || order?.id || 'RECEIPT';

    try {
      const status = await this.getStatus(cfg);
      if (!status.connected) {
        const connectRes = await this.connect(cfg);
        if (!connectRes.connected) {
          throw new Error(connectRes.errorMessage || 'USB printer is not connected');
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
        printerName: cfg.usbDeviceName || cfg.printerName,
        orderNo: String(orderNo),
        message: 'Receipt printed successfully on USB printer',
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        jobId,
        printerType: this.type,
        printerName: cfg.usbDeviceName || cfg.printerName,
        orderNo: String(orderNo),
        message: `USB print failed: ${err?.message || 'Unknown error'}`,
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
    const jobId = `USB-KOT-${Date.now()}`;
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
        printerName: cfg.usbDeviceName || cfg.printerName,
        orderNo: String(orderNo),
        message: 'KOT printed successfully on USB printer',
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        jobId,
        printerType: this.type,
        printerName: cfg.usbDeviceName || cfg.printerName,
        orderNo: String(orderNo),
        message: `USB KOT print failed: ${err?.message || 'Unknown error'}`,
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
    const jobId = `USB-TEST-${Date.now()}`;

    try {
      await this.connect(cfg);
      const rawData = PrinterFormatter.buildTestPrint(
        'USB THERMAL (HOST API)',
        cfg.usbDeviceName || cfg.printerName,
        company,
        cfg.paperWidth
      );
      await this.printRaw(rawData, { autoCut: true }, cfg);

      return {
        success: true,
        jobId,
        printerType: this.type,
        printerName: cfg.usbDeviceName || cfg.printerName,
        message: 'USB test slip printed successfully',
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        jobId,
        printerType: this.type,
        printerName: cfg.usbDeviceName || cfg.printerName,
        message: `USB test print failed: ${err?.message || 'Communication error'}`,
        offlineReason: err?.message,
        durationMs: Date.now() - startTime,
      };
    }
  }
}

export const usbPrinterDriver = new UsbPrinterDriver();
