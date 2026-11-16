import { NativeModules, Platform } from 'react-native';
import { UniversalPrinterConfig, PrinterType, PaperWidth } from './PrinterTypes';

const { UniversalPrinterModule } = NativeModules;

/**
 * Storage keys — intentionally separate so POS and Kiosk never overwrite each other.
 */
export const POS_CONFIG_STORAGE_KEY = 'redbay_printer_config_pos_v1';
export const KIOSK_CONFIG_STORAGE_KEY = 'redbay_printer_config_kiosk_v1';

/** @deprecated Use POS_CONFIG_STORAGE_KEY */
const LEGACY_CONFIG_STORAGE_KEY = 'redbay_universal_printer_config_v1';

export const DEFAULT_PRINTER_CONFIG: UniversalPrinterConfig = {
  type: 'LAN',
  printerName: 'Thermal Receipt Printer',
  paperWidth: '80mm',
  lanIp: '192.168.1.100',
  lanPort: 9100,
  usbDeviceId: undefined,
  usbVendorId: undefined,
  usbProductId: undefined,
  usbDeviceName: undefined,
  autoCut: true,
  openDrawer: false,
  copies: 1,
  timeoutMs: 4000,
};

type ConfigChangeListener = (config: UniversalPrinterConfig) => void;

/**
 * PrinterConfigManager — manages one independent printer configuration.
 *
 * Two instances are exported:
 *   - posPrinterConfigManager   (key: redbay_printer_config_pos_v1)
 *   - kioskPrinterConfigManager (key: redbay_printer_config_kiosk_v1)
 *
 * They are entirely independent: saving one never touches the other.
 */
export class PrinterConfigManager {
  private currentConfig: UniversalPrinterConfig = { ...DEFAULT_PRINTER_CONFIG };
  private listeners: Set<ConfigChangeListener> = new Set();
  private isLoaded: boolean = false;
  private readonly storageKey: string;
  private readonly label: string; // 'POS' or 'KIOSK' — for log messages only

  constructor(storageKey: string, label: string = 'PRINTER') {
    this.storageKey = storageKey;
    this.label = label;
    this.loadConfig();
  }

  /**
   * Load stored printer configuration asynchronously.
   * Falls back to the legacy key (once) so existing installations migrate gracefully.
   */
  public async loadConfig(): Promise<UniversalPrinterConfig> {
    try {
      let rawJson: string | null = null;

      if (UniversalPrinterModule && UniversalPrinterModule.getPersistentConfig) {
        try {
          rawJson = await UniversalPrinterModule.getPersistentConfig(this.storageKey, '');
        } catch (nativeErr) {
          console.warn(`[PrinterConfigManager:${this.label}] Native storage read error:`, nativeErr);
        }

        // One-time legacy migration: only for POS (the original single-config slot)
        if ((!rawJson || rawJson.trim().length === 0) && this.storageKey === POS_CONFIG_STORAGE_KEY) {
          try {
            const legacyRaw = await UniversalPrinterModule.getPersistentConfig(LEGACY_CONFIG_STORAGE_KEY, '');
            if (legacyRaw && legacyRaw.trim().length > 0) {
              rawJson = legacyRaw;
              console.info(`[PrinterConfigManager:${this.label}] Migrated from legacy key.`);
            }
          } catch (_) {}
        }
      }

      if (!rawJson && Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        rawJson = window.localStorage.getItem(this.storageKey);

        // Web legacy migration for POS
        if ((!rawJson || rawJson.trim().length === 0) && this.storageKey === POS_CONFIG_STORAGE_KEY) {
          rawJson = window.localStorage.getItem(LEGACY_CONFIG_STORAGE_KEY);
        }
      }

      if (rawJson && rawJson.trim().length > 0) {
        const parsed = JSON.parse(rawJson);
        this.currentConfig = {
          ...DEFAULT_PRINTER_CONFIG,
          ...parsed,
        };
      } else {
        // Auto-detect SUNMI only for the POS config (device-level hardware)
        if (UniversalPrinterModule && UniversalPrinterModule.isSunmiDevice) {
          try {
            const isSunmi = await UniversalPrinterModule.isSunmiDevice();
            if (isSunmi) {
              this.currentConfig.type = 'SUNMI';
              this.currentConfig.printerName = 'SUNMI Built-in Thermal Printer';
              this.currentConfig.paperWidth = '58mm';
            }
          } catch (ignored) {}
        }
      }
    } catch (err) {
      console.warn(`[PrinterConfigManager:${this.label}] Could not load stored printer config:`, err);
      this.currentConfig = { ...DEFAULT_PRINTER_CONFIG };
    } finally {
      this.isLoaded = true;
      this.notifyListeners();
    }
    return this.currentConfig;
  }

  /**
   * Get the current in-memory printer configuration synchronously.
   */
  public getConfig(): UniversalPrinterConfig {
    return { ...this.currentConfig };
  }

  /**
   * Save and persist printer configuration.
   * Only writes to this instance's own key — never touches the other instance.
   */
  public async saveConfig(newConfig: Partial<UniversalPrinterConfig>): Promise<UniversalPrinterConfig> {
    this.currentConfig = {
      ...this.currentConfig,
      ...newConfig,
    };

    const serialized = JSON.stringify(this.currentConfig);

    // Save to native SharedPreferences on Android
    if (UniversalPrinterModule && UniversalPrinterModule.savePersistentConfig) {
      try {
        await UniversalPrinterModule.savePersistentConfig(this.storageKey, serialized);
      } catch (nativeErr) {
        console.warn(`[PrinterConfigManager:${this.label}] Native save error:`, nativeErr);
      }
    }

    // Save to localStorage on Web
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(this.storageKey, serialized);
      } catch (webErr) {
        console.warn(`[PrinterConfigManager:${this.label}] Web localStorage save error:`, webErr);
      }
    }

    this.notifyListeners();
    return { ...this.currentConfig };
  }

  /**
   * Subscribe to printer configuration updates.
   */
  public subscribe(listener: ConfigChangeListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.currentConfig });
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const copy = { ...this.currentConfig };
    this.listeners.forEach((fn) => {
      try {
        fn(copy);
      } catch (e) {
        console.error(`[PrinterConfigManager:${this.label}] Listener error:`, e);
      }
    });
  }
}

// ─── Singleton instances ─────────────────────────────────────────────────────

/** POS printer configuration — stored under POS_CONFIG_STORAGE_KEY */
export const posPrinterConfigManager = new PrinterConfigManager(POS_CONFIG_STORAGE_KEY, 'POS');

/** Kiosk printer configuration — stored under KIOSK_CONFIG_STORAGE_KEY */
export const kioskPrinterConfigManager = new PrinterConfigManager(KIOSK_CONFIG_STORAGE_KEY, 'KIOSK');

/**
 * @deprecated Use posPrinterConfigManager directly.
 * Kept for backward-compatibility with any existing imports of `printerConfigManager`.
 * All POS code that imported the old singleton continues to work correctly.
 */
export const printerConfig = posPrinterConfigManager;
export const printerConfigManager = posPrinterConfigManager;
