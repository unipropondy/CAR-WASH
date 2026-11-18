import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  posPrinterConfigManager,
  kioskPrinterConfigManager,
  PrinterConfigManager,
} from '../../../services/printer/PrinterConfig';
import {
  PaperWidth,
  PrinterConnectionStatus,
  PrinterContext,
  PrinterType,
  UniversalPrinterConfig,
  UsbDeviceInfo,
} from '../../../services/printer/PrinterTypes';
import { posPrinter, kioskPrinter, UniversalPrinterService } from '../../../services/printer/UniversalPrinter';
import { usbPrinterDriver } from '../../../services/printer/drivers/UsbPrinter';
import { sunmiPrinterDriver } from '../../../services/printer/drivers/SunmiPrinter';
import { fetchPrinters, createPrinter, updatePrinter } from '../../../services/printerApi';

interface Props {
  onClose?: () => void;
  showHeader?: boolean;
  /**
   * Which printer context this settings panel configures.
   * Defaults to 'POS' for backward-compatibility with existing usage.
   */
  printerContext?: PrinterContext;
  /** Callback fired after printer configuration is successfully saved / synced */
  onConfigSaved?: () => void;
}

export const PrinterSettingsScreen: React.FC<Props> = ({
  onClose,
  showHeader = true,
  printerContext = 'POS',
  onConfigSaved,
}) => {
  // ── Resolve the correct manager / service for the selected context ──────────
  const configManager: PrinterConfigManager =
    printerContext === 'KIOSK' ? kioskPrinterConfigManager : posPrinterConfigManager;
  const printerService: UniversalPrinterService =
    printerContext === 'KIOSK' ? kioskPrinter : posPrinter;

  const [config, setConfig] = useState<UniversalPrinterConfig>(configManager.getConfig());
  const [status, setStatus] = useState<PrinterConnectionStatus>('DISCONNECTED');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusDetails, setStatusDetails] = useState<any>(null);

  // Loading flags
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // USB Devices List
  const [usbDevices, setUsbDevices] = useState<UsbDeviceInfo[]>([]);
  const [loadingUsbList, setLoadingUsbList] = useState<boolean>(false);

  // Sunmi Hardware info
  const [isSunmiDevice, setIsSunmiDevice] = useState<boolean>(false);

  useEffect(() => {
    // Load config for the correct context
    configManager.loadConfig().then((loaded: UniversalPrinterConfig) => {
      setConfig(loaded);
      checkLiveStatus();
    });

    // Check if device is SUNMI hardware
    sunmiPrinterDriver.isAvailable().then((isSunmi) => {
      setIsSunmiDevice(isSunmi);
    });

    // If currently USB, load USB device list
    if (config.type === 'USB') {
      scanUsbDevices();
    }
  }, [printerContext]);

  const checkLiveStatus = async () => {
    try {
      const res = await printerService.getStatus();
      setStatus(res.status);
      setStatusDetails(res.details);
      if (res.errorMessage) {
        setStatusMessage(res.errorMessage);
      } else if (res.connected) {
        setStatusMessage(`Connected (${res.paperWidth})`);
      } else {
        setStatusMessage('Disconnected');
      }
    } catch (err: any) {
      setStatus('ERROR');
      setStatusMessage(err?.message || 'Error querying status');
    }
  };

  const scanUsbDevices = async () => {
    setLoadingUsbList(true);
    try {
      const list = await usbPrinterDriver.listDevices();
      setUsbDevices(list);
      if (list.length > 0 && !config.usbDeviceId) {
        const defaultDev = list.find((d) => d.isPrinter) || list[0];
        setConfig((prev) => ({
          ...prev,
          usbDeviceId: defaultDev.deviceId,
          usbVendorId: defaultDev.vendorId,
          usbProductId: defaultDev.productId,
          usbDeviceName: defaultDev.productName || defaultDev.deviceName,
        }));
      }
    } catch (err: any) {
      console.warn('scanUsbDevices error:', err);
    } finally {
      setLoadingUsbList(false);
    }
  };

  const handleTypeChange = async (type: PrinterType) => {
    const updated: UniversalPrinterConfig = { ...config, type };

    if (type === 'SUNMI') {
      updated.printerName = 'SUNMI Built-in Thermal Printer';
      updated.paperWidth = '58mm';
    } else if (type === 'LAN') {
      updated.printerName = 'Network Thermal Printer';
      if (!updated.lanIp) updated.lanIp = '192.168.1.100';
      if (!updated.lanPort) updated.lanPort = 9100;
    } else if (type === 'USB') {
      updated.printerName = 'USB Thermal Printer';
      scanUsbDevices();
    }

    setConfig(updated);
    await configManager.saveConfig(updated);
    setTimeout(checkLiveStatus, 200);
  };

  const handleDetectPrinter = async () => {
    setIsDetecting(true);
    setStatusMessage('Detecting hardware...');
    try {
      if (config.type === 'SUNMI') {
        const isSunmi = await sunmiPrinterDriver.isAvailable();
        setIsSunmiDevice(isSunmi);
        if (isSunmi) {
          const res = await sunmiPrinterDriver.connect(config);
          setStatus(res.status);
          setStatusMessage(
            res.connected ? `SUNMI Detected (${res.paperWidth})` : res.errorMessage || 'SUNMI Error'
          );
        } else {
          setStatus('OFFLINE');
          setStatusMessage('Not a SUNMI device or AIDL service unavailable.');
        }
      } else if (config.type === 'USB') {
        await scanUsbDevices();
        const devices = await usbPrinterDriver.listDevices();
        if (devices.length > 0) {
          setStatus('CONNECTED');
          setStatusMessage(`Found ${devices.length} USB device(s)`);
        } else {
          setStatus('DISCONNECTED');
          setStatusMessage('No USB printers detected. Check OTG cable / USB port.');
        }
      } else {
        // LAN — connect via the correct context's service
        const res = await printerService.connect();
        setStatus(res.status);
        setStatusMessage(
          res.connected
            ? `${printerContext} LAN Printer Reached at ${config.lanIp}:${config.lanPort}`
            : res.errorMessage || `${printerContext} LAN Printer Unreachable`
        );
      }
    } catch (err: any) {
      setStatus('ERROR');
      setStatusMessage(err?.message || 'Detection failed');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setStatusMessage('Connecting...');
    try {
      const res = await printerService.connect(config);
      setStatus(res.status);
      setStatusDetails(res.details);
      if (res.connected) {
        setStatusMessage(`Successfully connected to ${res.printerName}`);
      } else {
        setStatusMessage(res.errorMessage || 'Connection failed');
      }
    } catch (err: any) {
      setStatus('ERROR');
      setStatusMessage(err?.message || 'Connection error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await printerService.disconnect();
      setStatus('DISCONNECTED');
      setStatusMessage('Printer disconnected');
    } catch (err: any) {
      setStatusMessage(err?.message || 'Disconnect error');
    }
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    setStatusMessage('Printing test receipt...');
    try {
      // Pass in-flight config so any freshly typed IP/port is tested directly
      const res = await printerService.testPrint(config);
      if (res.success) {
        setStatus('CONNECTED');
        setStatusMessage(`Test slip printed successfully in ${res.durationMs || 0}ms!`);
        const msg = `Diagnostic test slip printed via ${res.printerType} driver (${printerContext} context).`;
        if (Platform.OS === 'web') alert(`✓ Test Print Successful!\n${msg}`);
        else Alert.alert('Test Print Successful', msg);
      } else {
        setStatus('ERROR');
        setStatusMessage(res.message);
        if (Platform.OS === 'web') alert(`✗ Test Print Failed\n${res.message}`);
        else Alert.alert('Test Print Failed', res.message);
      }
    } catch (err: any) {
      setStatus('ERROR');
      setStatusMessage(err?.message || 'Print error');
      if (Platform.OS === 'web') alert(`✗ Error\n${err?.message || 'Test print failed'}`);
      else Alert.alert('Error', err?.message || 'Test print failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      // 1. Save to device storage (key: redbay_printer_config_pos_v1 or kiosk_v1)
      await configManager.saveConfig(config);

      // Auto-sync LAN settings to other context so both POS and Kiosk can print to the configured hardware
      if (config.type === 'LAN' && config.lanIp && config.lanIp.trim().length > 0) {
        try {
          if (printerContext === 'POS') {
            const kioskCfg = kioskPrinterConfigManager.getConfig();
            if (!kioskCfg.lanIp || kioskCfg.lanIp === '192.168.1.100' || kioskCfg.lanIp === config.lanIp) {
              await kioskPrinterConfigManager.saveConfig({
                ...config,
                printerName: 'Kiosk Network Printer',
              });
            }
          } else {
            const posCfg = posPrinterConfigManager.getConfig();
            if (!posCfg.lanIp || posCfg.lanIp === '192.168.1.100') {
              await posPrinterConfigManager.saveConfig({
                ...config,
                printerName: 'POS Receipt Printer',
              });
            }
          }
        } catch (_) {}
      }

      // 2. If it is a LAN/Wi-Fi printer, sync to SQL PrintMaster table
      // Requirement 5: PrinterType = 1 for POS, PrinterType = 3 for Kiosk
      let syncedToDb = false;
      if (config.type === 'LAN' && config.lanIp && config.lanIp.trim().length > 0) {
        try {
          const targetPrinterType = printerContext === 'KIOSK' ? 3 : 1;
          const targetKitchenType = printerContext === 'KIOSK' ? 'Kiosk Receipt' : 'Receipt Print';
          const cleanIP = config.lanIp.trim();
          const cleanPort = config.lanPort || 9100;
          const pName = config.printerName?.trim() || (printerContext === 'KIOSK' ? 'Kiosk Network Printer' : 'POS Receipt Printer');

          const existingList = await fetchPrinters();
          const match = existingList.find((p) => p.printerType === targetPrinterType);

          if (match) {
            await updatePrinter(match.printerId, {
              printerName: pName,
              printerIP: cleanIP,
              printerPort: cleanPort,
              printerType: targetPrinterType,
              kitchenTypeName: targetKitchenType,
              isActive: true,
              isEnabled: true,
            });
          } else {
            await createPrinter({
              printerName: pName,
              printerIP: cleanIP,
              printerPort: cleanPort,
              printerType: targetPrinterType,
              kitchenTypeName: targetKitchenType,
              isActive: true,
              isEnabled: true,
            });
          }
          syncedToDb = true;
        } catch (dbErr: any) {
          console.warn(`[PrinterSettingsScreen:${printerContext}] Could not sync LAN printer to SQL PrintMaster:`, dbErr?.message);
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Notify parent view (PosSettingsView) to refresh active printer banners & SQL list
      if (onConfigSaved) {
        onConfigSaved();
      }

      const saveNote = `${printerContext} printer settings successfully saved!${syncedToDb ? '\n• Persisted to local device storage\n• Synced to SQL PrintMaster (PrinterType = ' + (printerContext === 'KIOSK' ? '3' : '1') + ')' : '\n• Persisted to local device storage'}`;
      if (Platform.OS === 'web') {
        alert(saveNote);
      } else {
        Alert.alert('Configuration Saved', saveNote);
      }

      checkLiveStatus();
    } catch (err: any) {
      const errNote = err?.message || 'Failed to persist printer settings';
      if (Platform.OS === 'web') alert(`Save Failed: ${errNote}`);
      else Alert.alert('Save Failed', errNote);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectUsbDevice = async (dev: UsbDeviceInfo) => {
    const updated: UniversalPrinterConfig = {
      ...config,
      usbDeviceId: dev.deviceId,
      usbVendorId: dev.vendorId,
      usbProductId: dev.productId,
      usbDeviceName: dev.productName || dev.deviceName || 'USB Thermal Printer',
    };
    setConfig(updated);
    await configManager.saveConfig(updated);

    if (!dev.hasPermission) {
      const granted = await usbPrinterDriver.requestPermission(dev.deviceId);
      if (granted) {
        scanUsbDevices();
      }
    }
  };

  const contextLabel = printerContext === 'KIOSK' ? 'Kiosk' : 'POS';
  const contextColor = printerContext === 'KIOSK' ? '#7C3AED' : '#ED0712';

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={[styles.headerRow, { backgroundColor: printerContext === 'KIOSK' ? '#1E1B4B' : '#0F172A' }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.headerIconBox, { backgroundColor: contextColor }]}>
              <Ionicons name="print" size={22} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.headerTitle}>{contextLabel} Thermal Printer</Text>
              <Text style={styles.headerSubtitle}>
                SUNMI Built-in • LAN / Wi-Fi ESC/POS • USB Host Thermal
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <View
              style={[
                styles.statusBadge,
                status === 'CONNECTED'
                  ? styles.statusBadgeConnected
                  : status === 'CONNECTING'
                  ? styles.statusBadgeConnecting
                  : styles.statusBadgeDisconnected,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  status === 'CONNECTED'
                    ? styles.statusDotConnected
                    : status === 'CONNECTING'
                    ? styles.statusDotConnecting
                    : styles.statusDotDisconnected,
                ]}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  status === 'CONNECTED'
                    ? styles.statusTextConnected
                    : status === 'CONNECTING'
                    ? styles.statusTextConnecting
                    : styles.statusTextDisconnected,
                ]}
              >
                {status}
              </Text>
            </View>

            {onClose && (
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={20} color="#475569" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Status banner */}
      {statusMessage.length > 0 && (
        <View style={styles.statusBanner}>
          <Ionicons
            name={status === 'CONNECTED' ? 'checkmark-circle' : 'information-circle'}
            size={18}
            color={status === 'CONNECTED' ? '#10B981' : '#F59E0B'}
          />
          <Text style={styles.statusBannerText}>{statusMessage}</Text>
        </View>
      )}

      <ScrollView
        scrollEnabled={false}
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. PRINTER TYPE SELECTOR */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>1. SELECT {contextLabel.toUpperCase()} PRINTER TYPE</Text>
          <View style={styles.typeButtonGroup}>
            {/* SUNMI */}
            <TouchableOpacity
              style={[styles.typeButton, config.type === 'SUNMI' && [styles.typeButtonActive, { backgroundColor: contextColor, borderColor: contextColor }]]}
              onPress={() => handleTypeChange('SUNMI')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="phone-portrait-outline"
                size={20}
                color={config.type === 'SUNMI' ? '#FFFFFF' : '#475569'}
              />
              <Text style={[styles.typeButtonText, config.type === 'SUNMI' && styles.typeButtonTextActive]}>
                SUNMI
              </Text>
              <Text style={[styles.typeButtonSub, config.type === 'SUNMI' && styles.typeButtonSubActive]}>
                Built-in AIDL
              </Text>
            </TouchableOpacity>

            {/* LAN / Wi-Fi */}
            <TouchableOpacity
              style={[styles.typeButton, config.type === 'LAN' && [styles.typeButtonActive, { backgroundColor: contextColor, borderColor: contextColor }]]}
              onPress={() => handleTypeChange('LAN')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="wifi-outline"
                size={20}
                color={config.type === 'LAN' ? '#FFFFFF' : '#475569'}
              />
              <Text style={[styles.typeButtonText, config.type === 'LAN' && styles.typeButtonTextActive]}>
                LAN / Wi-Fi
              </Text>
              <Text style={[styles.typeButtonSub, config.type === 'LAN' && styles.typeButtonSubActive]}>
                TCP Socket
              </Text>
            </TouchableOpacity>

            {/* USB */}
            <TouchableOpacity
              style={[styles.typeButton, config.type === 'USB' && [styles.typeButtonActive, { backgroundColor: contextColor, borderColor: contextColor }]]}
              onPress={() => handleTypeChange('USB')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="hardware-chip-outline"
                size={20}
                color={config.type === 'USB' ? '#FFFFFF' : '#475569'}
              />
              <Text style={[styles.typeButtonText, config.type === 'USB' && styles.typeButtonTextActive]}>
                USB Host
              </Text>
              <Text style={[styles.typeButtonSub, config.type === 'USB' && styles.typeButtonSubActive]}>
                Direct OTG
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. DYNAMIC PRINTER CONFIGURATION FIELDS */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>2. {contextLabel.toUpperCase()} PRINTER HARDWARE CONFIGURATION</Text>

          {/* Printer Friendly Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Printer Display Name</Text>
            <TextInput
              style={styles.textInput}
              value={config.printerName}
              onChangeText={(text) => setConfig({ ...config, printerName: text })}
              placeholder="e.g. Counter Thermal Printer"
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Paper Width Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Thermal Paper Width</Text>
            <View style={styles.paperWidthGroup}>
              <TouchableOpacity
                style={[styles.paperWidthBtn, config.paperWidth === '58mm' && styles.paperWidthBtnActive]}
                onPress={() => setConfig({ ...config, paperWidth: '58mm' })}
              >
                <Text
                  style={[
                    styles.paperWidthBtnText,
                    config.paperWidth === '58mm' && styles.paperWidthBtnTextActive,
                  ]}
                >
                  58mm (Receipt / Sunmi)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paperWidthBtn, config.paperWidth === '80mm' && styles.paperWidthBtnActive]}
                onPress={() => setConfig({ ...config, paperWidth: '80mm' })}
              >
                <Text
                  style={[
                    styles.paperWidthBtnText,
                    config.paperWidth === '80mm' && styles.paperWidthBtnTextActive,
                  ]}
                >
                  80mm (Standard POS / Kitchen)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ============ SUNMI SPECIFIC UI ============ */}
          {config.type === 'SUNMI' && (
            <View style={styles.typeSpecificBox}>
              <View style={styles.infoRow}>
                <Ionicons name="information-circle-outline" size={20} color="#0284C7" />
                <Text style={styles.infoText}>
                  Communicates directly with the built-in SUNMI AIDL service (woyou.aidlservice.jiuv5).
                  Automatically configures paper size and handles hardware cutting.
                </Text>
              </View>

              <View style={styles.deviceMetaRow}>
                <Text style={styles.metaLabel}>SUNMI Device Detected:</Text>
                <Text
                  style={[
                    styles.metaValue,
                    { color: isSunmiDevice ? '#10B981' : '#EF4444', fontWeight: 'bold' },
                  ]}
                >
                  {isSunmiDevice ? 'YES (Official Hardware)' : 'NO (Android Generic or Emulator)'}
                </Text>
              </View>

              {statusDetails?.serviceVersion && (
                <View style={styles.deviceMetaRow}>
                  <Text style={styles.metaLabel}>Service Version:</Text>
                  <Text style={styles.metaValue}>{statusDetails.serviceVersion}</Text>
                </View>
              )}
            </View>
          )}

          {/* ============ LAN / WI-FI SPECIFIC UI ============ */}
          {config.type === 'LAN' && (
            <View style={styles.typeSpecificBox}>
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 2, marginRight: 12 }]}>
                  <Text style={styles.inputLabel}>Printer IP Address *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={config.lanIp}
                    onChangeText={(text) => setConfig({ ...config, lanIp: text.trim() })}
                    placeholder="192.168.1.100"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numbers-and-punctuation"
                    autoCapitalize="none"
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Port</Text>
                  <TextInput
                    style={styles.textInput}
                    value={String(config.lanPort || 9100)}
                    onChangeText={(text) =>
                      setConfig({ ...config, lanPort: parseInt(text, 10) || 9100 })
                    }
                    placeholder="9100"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Socket Timeout (Milliseconds)</Text>
                <TextInput
                  style={styles.textInput}
                  value={String(config.timeoutMs || 4000)}
                  onChangeText={(text) =>
                    setConfig({ ...config, timeoutMs: parseInt(text, 10) || 4000 })
                  }
                  placeholder="4000"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />
              </View>
            </View>
          )}

          {/* ============ USB HOST SPECIFIC UI ============ */}
          {config.type === 'USB' && (
            <View style={styles.typeSpecificBox}>
              <View style={styles.usbHeaderRow}>
                <Text style={styles.subSectionTitle}>Connected USB Thermal Printers</Text>
                <TouchableOpacity
                  style={styles.scanBtn}
                  onPress={scanUsbDevices}
                  disabled={loadingUsbList}
                >
                  {loadingUsbList ? (
                    <ActivityIndicator size="small" color="#0284C7" />
                  ) : (
                    <>
                      <Ionicons name="refresh" size={14} color="#0284C7" />
                      <Text style={styles.scanBtnText}>Refresh USB</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {usbDevices.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="hardware-chip-outline" size={28} color="#94A3B8" />
                  <Text style={styles.emptyBoxText}>
                    No USB printers detected on this device.
                  </Text>
                  <Text style={styles.emptyBoxSub}>
                    Ensure your thermal printer is connected via OTG/USB cable and powered ON.
                  </Text>
                </View>
              ) : (
                <View style={styles.usbList}>
                  {usbDevices.map((dev) => {
                    const isSelected = config.usbDeviceId === dev.deviceId;
                    return (
                      <TouchableOpacity
                        key={dev.deviceId}
                        style={[styles.usbCard, isSelected && styles.usbCardSelected]}
                        onPress={() => handleSelectUsbDevice(dev)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.usbCardLeft}>
                          <Ionicons
                            name={dev.isPrinter ? 'print' : 'hardware-chip'}
                            size={20}
                            color={isSelected ? contextColor : '#64748B'}
                          />
                          <View style={{ marginLeft: 10 }}>
                            <Text style={[styles.usbCardTitle, isSelected && { color: contextColor }]}>
                              {dev.productName || dev.deviceName || 'USB Device'}
                            </Text>
                            <Text style={styles.usbCardSubtitle}>
                              VID: 0x{dev.vendorId.toString(16).toUpperCase()} • PID: 0x
                              {dev.productId.toString(16).toUpperCase()} • ID: {dev.deviceId}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.usbCardRight}>
                          <View
                            style={[
                              styles.permBadge,
                              dev.hasPermission ? styles.permBadgeGreen : styles.permBadgeRed,
                            ]}
                          >
                            <Text
                              style={[
                                styles.permBadgeText,
                                dev.hasPermission ? styles.permTextGreen : styles.permTextRed,
                              ]}
                            >
                              {dev.hasPermission ? 'Granted' : 'Permission Needed'}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Preferences Row */}
          <View style={styles.prefRow}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setConfig({ ...config, autoCut: !config.autoCut })}
              activeOpacity={0.7}
            >
              <Ionicons
                name={config.autoCut ? 'checkbox' : 'square-outline'}
                size={20}
                color={config.autoCut ? contextColor : '#94A3B8'}
              />
              <Text style={styles.checkboxLabel}>Auto Cut Paper</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setConfig({ ...config, openDrawer: !config.openDrawer })}
              activeOpacity={0.7}
            >
              <Ionicons
                name={config.openDrawer ? 'checkbox' : 'square-outline'}
                size={20}
                color={config.openDrawer ? contextColor : '#94A3B8'}
              />
              <Text style={styles.checkboxLabel}>Open Cash Drawer</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. HARDWARE CONTROL ACTION BUTTONS */}
        <View style={styles.actionCard}>
          <Text style={styles.sectionTitle}>3. ACTIONS &amp; TESTING ({contextLabel})</Text>

          <View style={styles.actionButtonsRow}>
            {/* Detect Button */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.detectBtn]}
              onPress={handleDetectPrinter}
              disabled={isDetecting}
              activeOpacity={0.8}
            >
              {isDetecting ? (
                <ActivityIndicator size="small" color="#0F172A" />
              ) : (
                <>
                  <Ionicons name="search" size={16} color="#0F172A" />
                  <Text style={styles.actionBtnTextDark}>Detect</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Connect Button */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.connectBtn]}
              onPress={handleConnect}
              disabled={isConnecting}
              activeOpacity={0.8}
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="link" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnTextLight}>Connect</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Disconnect Button */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.disconnectBtn]}
              onPress={handleDisconnect}
              activeOpacity={0.8}
            >
              <Ionicons name="unlink" size={16} color="#475569" />
              <Text style={styles.actionBtnTextDark}>Disconnect</Text>
            </TouchableOpacity>

            {/* Test Print Button */}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: contextColor, borderColor: contextColor }]}
              onPress={handleTestPrint}
              disabled={isTesting}
              activeOpacity={0.8}
            >
              {isTesting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="print" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnTextLight}>Test Print</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Save Configuration Button */}
          <TouchableOpacity
            style={[styles.saveBtn, saveSuccess && styles.saveBtnSuccess]}
            onPress={handleSaveConfig}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name={saveSuccess ? 'checkmark-circle' : 'save'}
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.saveBtnText}>
                  {saveSuccess ? 'Saved Successfully!' : `Save ${contextLabel} Configuration`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 11.5,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  statusBadgeConnected: { backgroundColor: '#064E3B' },
  statusBadgeConnecting: { backgroundColor: '#78350F' },
  statusBadgeDisconnected: { backgroundColor: '#334155' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusDotConnected: { backgroundColor: '#10B981' },
  statusDotConnecting: { backgroundColor: '#F59E0B' },
  statusDotDisconnected: { backgroundColor: '#94A3B8' },
  statusBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  statusTextConnected: { color: '#A7F3D0' },
  statusTextConnecting: { color: '#FDE68A' },
  statusTextDisconnected: { color: '#CBD5E1' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    gap: 8,
  },
  statusBannerText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#64748B',
  },
  typeButtonGroup: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeButton: {
    flex: 1,
    minWidth: 85,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  typeButtonActive: { backgroundColor: '#ED0712', borderColor: '#DC2626' },
  typeButtonText: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 6 },
  typeButtonTextActive: { color: '#FFFFFF' },
  typeButtonSub: { fontSize: 10.5, color: '#64748B', marginTop: 2 },
  typeButtonSubActive: { color: '#FEE2E2' },
  inputGroup: { gap: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#334155' },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: '#0F172A',
  },
  paperWidthGroup: { flexDirection: 'row', gap: 10 },
  paperWidthBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  paperWidthBtnActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  paperWidthBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  paperWidthBtnTextActive: { color: '#FFFFFF' },
  typeSpecificBox: {
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 11.5, color: '#0369A1', flex: 1, lineHeight: 16 },
  deviceMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  metaLabel: { fontSize: 12, color: '#64748B' },
  metaValue: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  usbHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subSectionTitle: { fontSize: 12, fontWeight: '700', color: '#334155' },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#E0F2FE',
  },
  scanBtnText: { fontSize: 11, fontWeight: '700', color: '#0284C7' },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 4 },
  emptyBoxText: { fontSize: 12.5, fontWeight: '700', color: '#64748B', marginTop: 6 },
  emptyBoxSub: { fontSize: 11, color: '#94A3B8', textAlign: 'center', maxWidth: 300 },
  usbList: { gap: 8 },
  usbCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  usbCardSelected: { borderColor: '#ED0712', backgroundColor: '#FFF5F5' },
  usbCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  usbCardTitle: { fontSize: 12.5, fontWeight: '700', color: '#0F172A' },
  usbCardSubtitle: { fontSize: 10.5, color: '#64748B', marginTop: 1 },
  usbCardRight: { marginLeft: 8 },
  permBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  permBadgeGreen: { backgroundColor: '#DCFCE7' },
  permBadgeRed: { backgroundColor: '#FEE2E2' },
  permBadgeText: { fontSize: 10, fontWeight: '700' },
  permTextGreen: { color: '#15803D' },
  permTextRed: { color: '#DC2626' },
  prefRow: { flexDirection: 'row', gap: 20, marginTop: 4 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkboxLabel: { fontSize: 12.5, color: '#334155', fontWeight: '600' },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  actionButtonsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: {
    flex: 1,
    minWidth: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
  },
  detectBtn: { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
  connectBtn: { backgroundColor: '#0284C7', borderColor: '#0284C7' },
  disconnectBtn: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
  actionBtnTextDark: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  actionBtnTextLight: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingVertical: 13,
    borderRadius: 9,
    marginTop: 6,
  },
  saveBtnSuccess: { backgroundColor: '#059669' },
  saveBtnText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '800', letterSpacing: 0.3 },
});
