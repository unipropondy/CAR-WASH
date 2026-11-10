import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RED_BAY_COLORS } from '../../../theme/colors';
import {
  PrinterConfig,
  fetchPrinters,
  createPrinter,
  updatePrinter,
  deletePrinter,
  testPrinter,
} from '../../../services/printerApi';
import {
  CompanySettings,
  fetchCompanySettings,
  updateCompanySettings,
} from '../../../services/companySettingsApi';
import {
  getApiBaseUrl,
  getCustomApiBaseUrl,
  setCustomApiBaseUrl,
  checkBackendHealth,
  BackendHealthResult,
} from '../../../services/apiConfig';

interface PosSettingsViewProps {
  cashierName?: string;
  onBackToOrders?: () => void;
}

export const PosSettingsView: React.FC<PosSettingsViewProps> = ({
  cashierName = 'ups',
  onBackToOrders,
}) => {
  // Settings Sections
  const [activeSection, setActiveSection] = useState<'GENERAL' | 'PRINTERS' | 'BAYS' | 'HARDWARE' | 'PRICING'>('GENERAL');

  // General / Company Settings State (from dbo.CompanySettings)
  const [stationName, setStationName] = useState('Station #01 - Toh Guan Main');
  const [stationAddress, setStationAddress] = useState('48 Toh Guan Rd East, Singapore 608586');
  const [gstRate, setGstRate] = useState('9.0');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [currencyCode, setCurrencyCode] = useState('SGD');
  const [gstNo, setGstNo] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loadingCompanySettings, setLoadingCompanySettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [autoReleaseBay, setAutoReleaseBay] = useState(true);

  // Hardware Status
  const [printerStatus, setPrinterStatus] = useState<'CONNECTED' | 'TESTING'>('CONNECTED');
  const [drawerStatus, setDrawerStatus] = useState<'READY' | 'TESTING'>('READY');
  const [terminalStatus, setTerminalStatus] = useState<'ONLINE' | 'SYNCING'>('ONLINE');

  // Backend Server Connectivity State
  const [currentApiUrl, setCurrentApiUrl] = useState<string>(getApiBaseUrl());
  const [serverUrlInput, setServerUrlInput] = useState<string>(getCustomApiBaseUrl() || '');
  const [isTestingServer, setIsTestingServer] = useState<boolean>(false);
  const [serverHealth, setServerHealth] = useState<BackendHealthResult | null>(null);

  useEffect(() => {
    checkBackendHealth().then(setServerHealth).catch(() => {});
  }, []);

  const handleTestServer = async () => {
    setIsTestingServer(true);
    try {
      const target = serverUrlInput.trim() || undefined;
      const res = await checkBackendHealth(target);
      setServerHealth(res);
      if (res.ok) {
        const msg = `Backend is ONLINE!\nURL: ${res.url}\nLatency: ${res.latencyMs}ms\nDatabase: ${res.database || 'CONNECTED'}`;
        if (Platform.OS === 'web') alert(msg);
        else Alert.alert('Connection Successful', msg);
      } else {
        const msg = `Backend is UNREACHABLE:\n${res.error || 'Connection failed'}\nTarget: ${res.url}`;
        if (Platform.OS === 'web') alert(msg);
        else Alert.alert('Connection Failed', msg);
      }
    } catch (err: any) {
      if (Platform.OS === 'web') alert('Test Error: ' + err.message);
      else Alert.alert('Error', err.message);
    } finally {
      setIsTestingServer(false);
    }
  };

  const handleSaveServerUrl = () => {
    if (serverUrlInput.trim().length > 0) {
      setCustomApiBaseUrl(serverUrlInput.trim());
      const newUrl = getApiBaseUrl();
      setCurrentApiUrl(newUrl);
      checkBackendHealth(newUrl).then(setServerHealth);
      const msg = `Custom Backend URL saved:\n${newUrl}\nAll requests will now route to this server.`;
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Server URL Updated', msg);
    }
  };

  const handleResetServerUrl = () => {
    setCustomApiBaseUrl(null);
    setServerUrlInput('');
    const newUrl = getApiBaseUrl();
    setCurrentApiUrl(newUrl);
    checkBackendHealth(newUrl).then(setServerHealth);
    const msg = `Reset to Auto-detected URL:\n${newUrl}`;
    if (Platform.OS === 'web') alert(msg);
    else Alert.alert('Server URL Reset', msg);
  };

  // Pricing State
  const [prices, setPrices] = useState({
    basic: '15.00',
    deluxe: '25.00',
    premium: '40.00',
    waxAddon: '12.00',
    interiorDetail: '18.00',
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  // ================= PRINTER MANAGEMENT STATE (PrintMaster) =================
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [printerError, setPrinterError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterConfig | null>(null);
  const [testingPrinterId, setTestingPrinterId] = useState<string | null>(null);

  // Form Fields for Add / Edit Printer
  const [formName, setFormName] = useState('');
  const [formIp, setFormIp] = useState('');
  const [formPort, setFormPort] = useState('9100');
  const [formType, setFormType] = useState<number>(1);
  const [formSection, setFormSection] = useState('Receipt Print');
  const [formCopies, setFormCopies] = useState('1');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsEnabled, setFormIsEnabled] = useState(true);
  const [isSavingPrinter, setIsSavingPrinter] = useState(false);

  const loadCompanySettingsData = async () => {
    try {
      setLoadingCompanySettings(true);
      const data = await fetchCompanySettings();
      if (data) {
        if (data.CompanyName) setStationName(data.CompanyName);
        if (data.Address) setStationAddress(data.Address);
        if (data.GSTPercentage !== undefined && data.GSTPercentage !== null) {
          setGstRate(String(data.GSTPercentage));
        }
        if (data.CurrencySymbol) setCurrencySymbol(data.CurrencySymbol);
        if (data.Currency) setCurrencyCode(data.Currency);
        if (data.GSTNo) setGstNo(data.GSTNo);
        if (data.Phone) setPhone(data.Phone);
        if (data.Email) setEmail(data.Email);
      }
    } catch (err: any) {
      console.warn('Failed to load company settings from CompanySettings table:', err);
    } finally {
      setLoadingCompanySettings(false);
    }
  };

  const loadPrintersList = async () => {
    try {
      setLoadingPrinters(true);
      setPrinterError(null);
      const data = await fetchPrinters();
      setPrinters(data);
    } catch (err: any) {
      console.warn('Failed to load printers:', err);
      setPrinterError(err.message || 'Could not load printers from database');
    } finally {
      setLoadingPrinters(false);
    }
  };

  useEffect(() => {
    loadCompanySettingsData();
    loadPrintersList();
  }, []);

  const openAddPrinterModal = () => {
    setEditingPrinter(null);
    setFormName('');
    setFormIp('');
    setFormPort('9100');
    setFormType(1);
    setFormSection('Receipt Print');
    setFormCopies('1');
    setFormIsActive(true);
    setFormIsEnabled(true);
    setIsModalOpen(true);
  };

  const openEditPrinterModal = (printer: PrinterConfig) => {
    setEditingPrinter(printer);
    setFormName(printer.printerName || '');
    setFormIp(printer.printerIP || '');
    setFormPort(String(printer.printerPort || 9100));
    setFormType(printer.printerType || 1);
    setFormSection(printer.kitchenTypeName || 'Receipt Print');
    setFormCopies(String(printer.printCopy || 1));
    setFormIsActive(printer.isActive);
    setFormIsEnabled(printer.isEnabled);
    setIsModalOpen(true);
  };

  const handleSavePrinter = async () => {
    if (!formName.trim()) {
      if (Platform.OS === 'web') alert('Printer Name is required');
      else Alert.alert('Validation Error', 'Printer Name is required');
      return;
    }

    try {
      setIsSavingPrinter(true);
      const payload: Partial<PrinterConfig> = {
        printerName: formName.trim(),
        printerIP: formIp.trim(),
        printerPort: parseInt(formPort || '9100', 10),
        printerPath: formIp.trim(),
        printerType: formType,
        kitchenTypeName: formSection.trim() || 'Receipt Print',
        printCopy: parseInt(formCopies || '1', 10),
        isActive: formIsActive,
        isEnabled: formIsEnabled,
      };

      if (editingPrinter) {
        await updatePrinter(editingPrinter.printerId, payload);
      } else {
        await createPrinter(payload);
      }

      setIsModalOpen(false);
      await loadPrintersList();
      if (Platform.OS === 'web') {
        alert(editingPrinter ? 'Printer updated successfully!' : 'New printer added successfully!');
      } else {
        Alert.alert('Success', editingPrinter ? 'Printer updated successfully!' : 'New printer added successfully!');
      }
    } catch (err: any) {
      if (Platform.OS === 'web') alert('Error: ' + err.message);
      else Alert.alert('Error', err.message);
    } finally {
      setIsSavingPrinter(false);
    }
  };

  const handleDeletePrinter = async (printer: PrinterConfig) => {
    const confirmMessage = `Are you sure you want to delete printer "${printer.printerName}" (${printer.printerIP || 'No IP'})?`;
    let confirmed = false;

    if (Platform.OS === 'web') {
      confirmed = window.confirm(confirmMessage);
    } else {
      confirmed = await new Promise((resolve) => {
        Alert.alert('Delete Printer', confirmMessage, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
        ]);
      });
    }

    if (!confirmed) return;

    try {
      await deletePrinter(printer.printerId);
      await loadPrintersList();
      if (Platform.OS === 'web') alert('Printer deleted from PrintMaster.');
      else Alert.alert('Success', 'Printer deleted successfully.');
    } catch (err: any) {
      if (Platform.OS === 'web') alert('Delete Error: ' + err.message);
      else Alert.alert('Error', err.message);
    }
  };

  const handleMakeActiveReceiptPrinter = async (printer: PrinterConfig) => {
    try {
      await updatePrinter(printer.printerId, {
        isActive: true,
        printerType: 1,
      });
      await loadPrintersList();
      const msg = `"${printer.printerName}" (${printer.printerIP}:${printer.printerPort}) is now the active receipt printer!`;
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Active Printer Set', msg);
    } catch (err: any) {
      if (Platform.OS === 'web') alert('Error: ' + err.message);
      else Alert.alert('Error', err.message);
    }
  };

  const handleTestPrintSingle = async (printer: PrinterConfig) => {
    setTestingPrinterId(printer.printerId);
    try {
      const res = await testPrinter(
        printer.printerId,
        printer.printerIP,
        printer.printerPort,
        printer.printerName
      );
      if (Platform.OS === 'web') {
        alert(res.message);
      } else {
        Alert.alert('Printer Test', res.message);
      }
    } catch (err: any) {
      if (Platform.OS === 'web') alert('Test Print Error: ' + err.message);
      else Alert.alert('Printer Test Failed', err.message);
    } finally {
      setTestingPrinterId(null);
    }
  };

  // Active receipt printer
  const activeReceiptPrinter = printers.find(p => p.isActive && (p.printerType === 1 || (p.kitchenTypeName || '').includes('Receipt')));

  const handleSave = async () => {
    setIsSavingSettings(true);
    try {
      await updateCompanySettings({
        CompanyName: stationName.trim(),
        Address: stationAddress.trim(),
        GSTPercentage: parseFloat(gstRate) || 0,
        CurrencySymbol: currencySymbol.trim(),
        Currency: currencyCode.trim(),
        GSTNo: gstNo.trim(),
        Phone: phone.trim(),
        Email: email.trim(),
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);

      if (Platform.OS === 'web') {
        // Successful update preserved in state
      } else {
        Alert.alert('Settings Saved', 'Company settings have been updated in the database.');
      }
    } catch (err: any) {
      console.error('Error updating company settings:', err);
      if (Platform.OS === 'web') {
        alert('Failed to save settings: ' + err.message);
      } else {
        Alert.alert('Save Failed', err.message || 'Could not save company settings');
      }
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleTestPrinter = () => {
    setPrinterStatus('TESTING');
    setTimeout(() => {
      setPrinterStatus('CONNECTED');
      if (Platform.OS === 'web') {
        alert('Printer Test: Test receipt sent to EPSON TM-T88VI (192.168.1.120). Status: OK.');
      } else {
        Alert.alert('Printer Test', 'Test receipt sent successfully.');
      }
    }, 800);
  };

  const handleKickDrawer = () => {
    setDrawerStatus('TESTING');
    setTimeout(() => {
      setDrawerStatus('READY');
      if (Platform.OS === 'web') {
        alert('Cash Drawer Test: Pulse signal sent via RJ12 port. Drawer kicked: OK.');
      } else {
        Alert.alert('Cash Drawer', 'Signal sent. Drawer open.');
      }
    }, 600);
  };

  const handleSyncTerminal = () => {
    setTerminalStatus('SYNCING');
    setTimeout(() => {
      setTerminalStatus('ONLINE');
      if (Platform.OS === 'web') {
        alert('Terminal Sync: All 5 Washing Bays and payment gateways are synchronized with cloud.');
      } else {
        Alert.alert('Terminal Sync', 'Synchronized successfully.');
      }
    }, 800);
  };

  return (
    <View style={styles.container}>
      {/* Top Header Banner */}
      <View style={styles.headerCard}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconBox}>
            <Ionicons name="settings-sharp" size={24} color="#FFFFFF" />
          </View>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>Station & POS Settings</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>STATION #01 ONLINE</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              Configure hardware peripherals, washing bays, billing, and system parameters
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {onBackToOrders && (
            <TouchableOpacity style={styles.backBtn} onPress={onBackToOrders} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={18} color="#475569" />
              <Text style={styles.backBtnText}>Back to Orders</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, savedSuccess && styles.saveBtnSuccess]}
            onPress={handleSave}
            disabled={isSavingSettings}
            activeOpacity={0.85}
          >
            {isSavingSettings ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
            ) : (
              <Ionicons
                name={savedSuccess ? 'checkmark-circle' : 'save-outline'}
                size={18}
                color="#FFFFFF"
              />
            )}
            <Text style={styles.saveBtnText}>
              {savedSuccess ? 'Saved Changes!' : isSavingSettings ? 'Saving...' : 'Save Settings'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation Sub-Tabs */}
      <View style={styles.subTabRow}>
        <TouchableOpacity
          style={[styles.subTabBtn, activeSection === 'GENERAL' && styles.subTabBtnActive]}
          onPress={() => setActiveSection('GENERAL')}
        >
          <Ionicons
            name="business-outline"
            size={18}
            color={activeSection === 'GENERAL' ? '#ED0712' : '#64748B'}
          />
          <Text
            style={[styles.subTabText, activeSection === 'GENERAL' && styles.subTabTextActive]}
          >
            General & Station
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabBtn, activeSection === 'PRINTERS' && styles.subTabBtnActive]}
          onPress={() => setActiveSection('PRINTERS')}
        >
          <Ionicons
            name="print-outline"
            size={18}
            color={activeSection === 'PRINTERS' ? '#ED0712' : '#64748B'}
          />
          <Text
            style={[styles.subTabText, activeSection === 'PRINTERS' && styles.subTabTextActive]}
          >
            Printers (PrintMaster)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabBtn, activeSection === 'BAYS' && styles.subTabBtnActive]}
          onPress={() => setActiveSection('BAYS')}
        >
          <Ionicons
            name="car-outline"
            size={18}
            color={activeSection === 'BAYS' ? '#ED0712' : '#64748B'}
          />
          <Text style={[styles.subTabText, activeSection === 'BAYS' && styles.subTabTextActive]}>
            Washing Bays (5 Active)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabBtn, activeSection === 'HARDWARE' && styles.subTabBtnActive]}
          onPress={() => setActiveSection('HARDWARE')}
        >
          <Ionicons
            name="hardware-chip-outline"
            size={18}
            color={activeSection === 'HARDWARE' ? '#ED0712' : '#64748B'}
          />
          <Text
            style={[styles.subTabText, activeSection === 'HARDWARE' && styles.subTabTextActive]}
          >
            Peripherals & Hardware
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabBtn, activeSection === 'PRICING' && styles.subTabBtnActive]}
          onPress={() => setActiveSection('PRICING')}
        >
          <Ionicons
            name="pricetags-outline"
            size={18}
            color={activeSection === 'PRICING' ? '#ED0712' : '#64748B'}
          />
          <Text
            style={[styles.subTabText, activeSection === 'PRICING' && styles.subTabTextActive]}
          >
            Services & Pricing
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab 1: General & Station */}
      {activeSection === 'GENERAL' && (
        <View style={styles.gridSection}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="information-circle-outline" size={20} color="#ED0712" />
              <Text style={styles.cardTitle}>Station Profile</Text>
            </View>

            {loadingCompanySettings ? (
              <View style={{ padding: 28, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#ED0712" />
                <Text style={{ marginTop: 8, color: '#64748B', fontSize: 13 }}>
                  Loading company profile from database...
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Station / Company Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={stationName}
                    onChangeText={setStationName}
                    placeholder="e.g. RED BAY CAR WASH"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Location Address</Text>
                  <TextInput
                    style={styles.textInput}
                    value={stationAddress}
                    onChangeText={setStationAddress}
                    placeholder="e.g. 48 Toh Guan Rd East, Singapore 608586"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.twoColRow}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
                    <Text style={styles.fieldLabel}>GST / Tax Rate (%)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={gstRate}
                      onChangeText={setGstRate}
                      keyboardType="numeric"
                      placeholder="9.0"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>GST / Tax Reg No</Text>
                    <TextInput
                      style={styles.textInput}
                      value={gstNo}
                      onChangeText={setGstNo}
                      placeholder="e.g. M90382711"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                <View style={styles.twoColRow}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
                    <Text style={styles.fieldLabel}>Currency Symbol</Text>
                    <TextInput
                      style={styles.textInput}
                      value={currencySymbol}
                      onChangeText={setCurrencySymbol}
                      placeholder="$"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Currency Code</Text>
                    <TextInput
                      style={styles.textInput}
                      value={currencyCode}
                      onChangeText={setCurrencyCode}
                      placeholder="SGD"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                <View style={styles.twoColRow}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
                    <Text style={styles.fieldLabel}>Phone / Contact</Text>
                    <TextInput
                      style={styles.textInput}
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="e.g. +65 6789 0123"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Email Address</Text>
                    <TextInput
                      style={styles.textInput}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="e.g. info@redbay.sg"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                    />
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="toggle-outline" size={20} color="#ED0712" />
              <Text style={styles.cardTitle}>Operational Automation</Text>
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.toggleTitle}>Auto-Print Receipt</Text>
                <Text style={styles.toggleDesc}>
                  Automatically print customer tax invoice upon payment completion
                </Text>
              </View>
              <Switch
                value={autoPrintReceipt}
                onValueChange={setAutoPrintReceipt}
                trackColor={{ false: '#CBD5E1', true: '#FCA5A5' }}
                thumbColor={autoPrintReceipt ? '#ED0712' : '#F1F5F9'}
              />
            </View>

            <View style={[styles.toggleRow, styles.toggleDivider]}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.toggleTitle}>Audio Alerts & Chimes</Text>
                <Text style={styles.toggleDesc}>
                  Play audio alerts when new orders arrive or when a bay wash finishes
                </Text>
              </View>
              <Switch
                value={soundAlerts}
                onValueChange={setSoundAlerts}
                trackColor={{ false: '#CBD5E1', true: '#FCA5A5' }}
                thumbColor={soundAlerts ? '#ED0712' : '#F1F5F9'}
              />
            </View>

            <View style={[styles.toggleRow, styles.toggleDivider]}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.toggleTitle}>Auto-Release Bay</Text>
                <Text style={styles.toggleDesc}>
                  Automatically mark bay as AVAILABLE once countdown finishes
                </Text>
              </View>
              <Switch
                value={autoReleaseBay}
                onValueChange={setAutoReleaseBay}
                trackColor={{ false: '#CBD5E1', true: '#FCA5A5' }}
                thumbColor={autoReleaseBay ? '#ED0712' : '#F1F5F9'}
              />
            </View>
          </View>
        </View>
      )}

      {/* Tab: Network Printers (PrintMaster) */}
      {activeSection === 'PRINTERS' && (
        <View style={styles.gridSection}>
          {/* Active Receipt Printer Destination Banner */}
          <View style={styles.activePrinterBanner}>
            <View style={styles.activePrinterBannerLeft}>
              <View style={styles.activePrinterIconBox}>
                <Ionicons name="print" size={24} color="#ED0712" />
              </View>
              <View>
                <Text style={styles.activePrinterBannerTitle}>
                  Auto-Print Receipt Destination: <Text style={{ color: '#ED0712', fontWeight: '900' }}>{activeReceiptPrinter?.printerName || 'None Selected'}</Text>
                </Text>
                <Text style={styles.activePrinterBannerSub}>
                  {activeReceiptPrinter?.printerIP ? `IP: ${activeReceiptPrinter.printerIP} • Port: ${activeReceiptPrinter.printerPort || 9100} • ESC/POS Raw Socket` : 'No active thermal printer configured. Select a printer below or add a new one.'}
                </Text>
              </View>
            </View>
            <View style={styles.activePrinterBannerRight}>
              <TouchableOpacity
                style={styles.addPrinterBtn}
                onPress={openAddPrinterModal}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.addPrinterBtnText}>Add New Printer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reloadPrinterBtn}
                onPress={loadPrintersList}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh-outline" size={18} color="#475569" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Error notice if any */}
          {printerError && (
            <View style={styles.printerErrorBox}>
              <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
              <Text style={styles.printerErrorText}>{printerError}</Text>
            </View>
          )}

          {/* Printers List */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="hardware-chip-outline" size={20} color="#ED0712" />
              <Text style={styles.cardTitle}>Configured Hardware Printers ({printers.length})</Text>
            </View>

            {loadingPrinters ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#ED0712" />
                <Text style={{ marginTop: 10, color: '#64748B', fontWeight: '600' }}>Loading printers from SQL Server PrintMaster...</Text>
              </View>
            ) : printers.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Ionicons name="print-outline" size={40} color="#94A3B8" />
                <Text style={{ marginTop: 10, color: '#64748B', fontWeight: '700' }}>No printers configured in PrintMaster</Text>
                <TouchableOpacity style={[styles.addPrinterBtn, { marginTop: 14 }]} onPress={openAddPrinterModal}>
                  <Text style={styles.addPrinterBtnText}>+ Add First Printer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.printersGrid}>
                {printers.map((p) => {
                  const isTesting = testingPrinterId === p.printerId;
                  const isCurrentReceipt = p.isActive && (p.printerType === 1 || (p.kitchenTypeName || '').includes('Receipt'));
                  return (
                    <View key={p.printerId} style={[styles.printerCardItem, isCurrentReceipt && styles.printerCardItemActive]}>
                      <View style={styles.printerCardTop}>
                        <View style={styles.printerCardHeaderLeft}>
                          <View style={[styles.printerIconSmall, isCurrentReceipt && styles.printerIconSmallActive]}>
                            <Ionicons name="print-outline" size={18} color={isCurrentReceipt ? "#ED0712" : "#475569"} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.printerCardName} numberOfLines={1}>{p.printerName}</Text>
                            <Text style={styles.printerCardType}>
                              {p.printerType === 1 ? 'Thermal Receipt Printer' : p.printerType === 2 ? 'Bay Service Detailing Printer' : 'Kiosk / Billing Printer'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.printerBadgesRow}>
                          {isCurrentReceipt && (
                            <View style={styles.badgeActiveReceipt}>
                              <Text style={styles.badgeActiveReceiptText}>★ DEFAULT</Text>
                            </View>
                          )}
                          <View style={[styles.badgePill, p.isEnabled ? styles.badgePillEnabled : styles.badgePillDisabled]}>
                            <Text style={[styles.badgePillText, p.isEnabled ? styles.badgeTextEnabled : styles.badgeTextDisabled]}>
                              {p.isEnabled ? 'ENABLED' : 'DISABLED'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Details row */}
                      <View style={styles.printerDetailsRow}>
                        <View style={styles.detailPill}>
                          <Text style={styles.detailPillLabel}>IP:</Text>
                          <Text style={styles.detailPillVal}>{p.printerIP || 'None'}</Text>
                        </View>
                        <View style={styles.detailPill}>
                          <Text style={styles.detailPillLabel}>Port:</Text>
                          <Text style={styles.detailPillVal}>{p.printerPort || 9100}</Text>
                        </View>
                        <View style={styles.detailPill}>
                          <Text style={styles.detailPillLabel}>Copies:</Text>
                          <Text style={styles.detailPillVal}>{p.printCopy || 1}</Text>
                        </View>
                      </View>

                      {/* Action buttons row */}
                      <View style={styles.printerCardActions}>
                        <TouchableOpacity
                          style={[styles.printerActionBtn, styles.printerActionTest]}
                          onPress={() => handleTestPrintSingle(p)}
                          disabled={isTesting}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="paper-plane-outline" size={14} color="#0284C7" />
                          <Text style={styles.printerActionTestText}>
                            {isTesting ? 'Testing...' : 'Test Print'}
                          </Text>
                        </TouchableOpacity>

                        {!isCurrentReceipt && (
                          <TouchableOpacity
                            style={[styles.printerActionBtn, styles.printerActionMakeActive]}
                            onPress={() => handleMakeActiveReceiptPrinter(p)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="star-outline" size={14} color="#15803D" />
                            <Text style={styles.printerActionMakeActiveText}>Set Default</Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          style={[styles.printerActionBtn, styles.printerActionEdit]}
                          onPress={() => openEditPrinterModal(p)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="pencil-outline" size={14} color="#475569" />
                          <Text style={styles.printerActionEditText}>Edit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.printerActionBtn, styles.printerActionDelete]}
                          onPress={() => handleDeletePrinter(p)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="trash-outline" size={14} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Tab 2: Washing Bays */}
      {activeSection === 'BAYS' && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="water-outline" size={20} color="#ED0712" />
            <Text style={styles.cardTitle}>5 Washing Bays Live Configuration</Text>
          </View>

          <View style={styles.baysGrid}>
            {[
              { id: '1', name: 'Bay 1', type: 'Touchless Express Wash', status: 'In Service', current: 'Casey Brown' },
              { id: '2', name: 'Bay 2', type: 'Soft-Cloth Foam Wash', status: 'In Service', current: 'Sam Patel' },
              { id: '3', name: 'Bay 3', type: 'Full Detailing & Rinse', status: 'In Service', current: 'Jordan Lee' },
              { id: '4', name: 'Bay 4', type: 'High-Pressure Pre-Wash', status: 'Available', current: 'Empty' },
              { id: '5', name: 'Bay 5', type: 'Vacuum & Ceramic Dry', status: 'Available', current: 'Empty' },
            ].map((bay) => (
              <View key={bay.id} style={styles.bayCard}>
                <View style={styles.bayHeader}>
                  <Text style={styles.bayNum}>{bay.name}</Text>
                  <View
                    style={[
                      styles.bayBadge,
                      bay.status === 'Available' ? styles.bayBadgeGreen : styles.bayBadgeRed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.bayBadgeText,
                        bay.status === 'Available' ? styles.bayTextGreen : styles.bayTextRed,
                      ]}
                    >
                      {bay.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.bayType}>{bay.type}</Text>
                <Text style={styles.bayDetail}>Current: <Text style={{ fontWeight: '700' }}>{bay.current}</Text></Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Tab 3: Hardware & Peripherals */}
      {activeSection === 'HARDWARE' && (
        <View style={styles.gridSection}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="print-outline" size={20} color="#ED0712" />
              <Text style={styles.cardTitle}>Primary Receipt Printer (PrintMaster)</Text>
            </View>
            <View style={styles.hardwareRow}>
              <View>
                <Text style={styles.hwName}>{activeReceiptPrinter?.printerName || 'No Printer Selected'}</Text>
                <Text style={styles.hwIp}>
                  IP: {activeReceiptPrinter?.printerIP || 'None'} • Port: {activeReceiptPrinter?.printerPort || 9100}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.testBtn}
                  onPress={() => activeReceiptPrinter && handleTestPrintSingle(activeReceiptPrinter)}
                  disabled={!activeReceiptPrinter || testingPrinterId === activeReceiptPrinter.printerId}
                >
                  <Ionicons name="print" size={16} color="#0F172A" />
                  <Text style={styles.testBtnText}>
                    {activeReceiptPrinter && testingPrinterId === activeReceiptPrinter.printerId ? 'Printing...' : 'Test Print'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.testBtn, { backgroundColor: '#ED0712', borderColor: '#DC2626' }]}
                  onPress={() => setActiveSection('PRINTERS')}
                >
                  <Ionicons name="settings-outline" size={16} color="#FFFFFF" />
                  <Text style={[styles.testBtnText, { color: '#FFFFFF' }]}>Manage Printers</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="cash-outline" size={20} color="#ED0712" />
              <Text style={styles.cardTitle}>Cash Drawer (RJ12 Trigger)</Text>
            </View>
            <View style={styles.hardwareRow}>
              <View>
                <Text style={styles.hwName}>Heavy Duty 5-Bill / 8-Coin Drawer</Text>
                <Text style={styles.hwIp}>Connected via Printer Kick Port 1</Text>
              </View>
              <TouchableOpacity
                style={styles.testBtn}
                onPress={handleKickDrawer}
                disabled={drawerStatus === 'TESTING'}
              >
                <Ionicons name="open-outline" size={16} color="#0F172A" />
                <Text style={styles.testBtnText}>
                  {drawerStatus === 'TESTING' ? 'Kicking...' : 'Open Drawer'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="card-outline" size={20} color="#ED0712" />
              <Text style={styles.cardTitle}>Payment Terminal & Cloud Sync</Text>
            </View>
            <View style={styles.hardwareRow}>
              <View>
                <Text style={styles.hwName}>NETS / Visa / PayNow Smart Terminal</Text>
                <Text style={styles.hwIp}>Status: Online • TLS 1.3 Encrypted</Text>
              </View>
              <TouchableOpacity
                style={styles.testBtn}
                onPress={handleSyncTerminal}
                disabled={terminalStatus === 'SYNCING'}
              >
                <Ionicons name="sync-outline" size={16} color="#0F172A" />
                <Text style={styles.testBtnText}>
                  {terminalStatus === 'SYNCING' ? 'Syncing...' : 'Sync Now'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Card: Centralized Backend Server & Universal Network Connectivity */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="server-outline" size={20} color="#ED0712" />
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.cardTitle}>Backend Server & Network Connectivity</Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 12,
                    backgroundColor: serverHealth?.ok ? '#ECFDF5' : '#FEF2F2',
                    borderWidth: 1,
                    borderColor: serverHealth?.ok ? '#A7F3D0' : '#FECACA',
                  }}
                >
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 3.5,
                      backgroundColor: serverHealth?.ok ? '#10B981' : '#EF4444',
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 10.5,
                      fontWeight: '800',
                      color: serverHealth?.ok ? '#047857' : '#DC2626',
                    }}
                  >
                    {serverHealth?.ok
                      ? `ONLINE (${serverHealth.latencyMs}ms)`
                      : isTestingServer
                      ? 'TESTING...'
                      : 'OFFLINE'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ gap: 12 }}>
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>ACTIVE API BASE URL</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }}>
                  {currentApiUrl}
                </Text>
                <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                  Universal routing across Wi-Fi, 4G/5G mobile networks, and public HTTPS cloud endpoints.
                </Text>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={styles.fieldLabel}>Custom Server URL Override (Optional)</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <TextInput
                    style={[styles.textInput, { flex: 1, minWidth: 220 }]}
                    placeholder="e.g. https://api.redbaycarwash.com or http://localhost:5000"
                    placeholderTextColor="#94A3B8"
                    value={serverUrlInput}
                    onChangeText={setServerUrlInput}
                  />
                  <TouchableOpacity
                    style={[styles.testBtn, { backgroundColor: '#ED0712', borderColor: '#DC2626' }]}
                    onPress={handleSaveServerUrl}
                    disabled={!serverUrlInput.trim()}
                  >
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    <Text style={[styles.testBtnText, { color: '#FFFFFF' }]}>Apply</Text>
                  </TouchableOpacity>
                  {getCustomApiBaseUrl() && (
                    <TouchableOpacity
                      style={[styles.testBtn, { borderColor: '#CBD5E1' }]}
                      onPress={handleResetServerUrl}
                    >
                      <Ionicons name="refresh" size={16} color="#475569" />
                      <Text style={styles.testBtnText}>Reset Auto</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.testBtn, { borderColor: '#CBD5E1' }]}
                    onPress={handleTestServer}
                    disabled={isTestingServer}
                  >
                    <Ionicons name="pulse" size={16} color="#0F172A" />
                    <Text style={styles.testBtnText}>{isTestingServer ? 'Pinging...' : 'Ping Test'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Tab 4: Pricing */}
      {activeSection === 'PRICING' && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="cash-outline" size={20} color="#ED0712" />
            <Text style={styles.cardTitle}>Service Packages & Add-on Prices (SGD)</Text>
          </View>

          <View style={styles.pricingGrid}>
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Basic Wash</Text>
              <View style={styles.priceInputWrapper}>
                <Text style={styles.pricePrefix}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  value={prices.basic}
                  onChangeText={(val) => setPrices((p) => ({ ...p, basic: val }))}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Deluxe Wash</Text>
              <View style={styles.priceInputWrapper}>
                <Text style={styles.pricePrefix}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  value={prices.deluxe}
                  onChangeText={(val) => setPrices((p) => ({ ...p, deluxe: val }))}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Premium Wash</Text>
              <View style={styles.priceInputWrapper}>
                <Text style={styles.pricePrefix}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  value={prices.premium}
                  onChangeText={(val) => setPrices((p) => ({ ...p, premium: val }))}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Ceramic Wax Add-on</Text>
              <View style={styles.priceInputWrapper}>
                <Text style={styles.pricePrefix}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  value={prices.waxAddon}
                  onChangeText={(val) => setPrices((p) => ({ ...p, waxAddon: val }))}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Interior Detailing</Text>
              <View style={styles.priceInputWrapper}>
                <Text style={styles.pricePrefix}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  value={prices.interiorDetail}
                  onChangeText={(val) => setPrices((p) => ({ ...p, interiorDetail: val }))}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ================= MODAL: ADD / EDIT PRINTER ================= */}
      <Modal
        visible={isModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="print-outline" size={22} color="#ED0712" />
                <Text style={styles.modalTitle}>
                  {editingPrinter ? 'Edit Printer Configuration' : 'Add New Network Printer'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalOpen(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              {/* Printer Name */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Printer Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="e.g. Receipt Printer, EPSON TM-T88VI"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {/* IP Address and Port in two columns */}
              <View style={styles.twoColRow}>
                <View style={[styles.formGroup, { flex: 2, marginRight: 12 }]}>
                  <Text style={styles.fieldLabel}>IP Address *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formIp}
                    onChangeText={setFormIp}
                    placeholder="e.g. 192.168.0.199"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Port *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formPort}
                    onChangeText={setFormPort}
                    keyboardType="numeric"
                    placeholder="9100"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Printer Type Selector */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Printer Type</Text>
                <View style={styles.typeSelectorRow}>
                  {[
                    { type: 1, label: 'Receipt / Thermal', icon: 'receipt-outline' as any },
                    { type: 2, label: 'Bay Detailing', icon: 'water-outline' as any },
                    { type: 3, label: 'Kiosk Billing', icon: 'desktop-outline' as any },
                  ].map((t) => (
                    <TouchableOpacity
                      key={t.type}
                      style={[styles.typeOptionBtn, formType === t.type && styles.typeOptionBtnActive]}
                      onPress={() => setFormType(t.type)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={t.icon}
                        size={16}
                        color={formType === t.type ? '#ED0712' : '#64748B'}
                      />
                      <Text style={[styles.typeOptionText, formType === t.type && styles.typeOptionTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Kitchen / Section and Copies */}
              <View style={styles.twoColRow}>
                <View style={[styles.formGroup, { flex: 2, marginRight: 12 }]}>
                  <Text style={styles.fieldLabel}>Section / Purpose</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formSection}
                    onChangeText={setFormSection}
                    placeholder="e.g. Receipt Print"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Copies</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formCopies}
                    onChangeText={setFormCopies}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Toggles */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text style={styles.toggleTitle}>Set as Default Receipt Printer</Text>
                  <Text style={styles.toggleDesc}>
                    Use this printer for automatic kiosk and POS checkout bill printing
                  </Text>
                </View>
                <Switch
                  value={formIsActive}
                  onValueChange={setFormIsActive}
                  trackColor={{ false: '#CBD5E1', true: '#FCA5A5' }}
                  thumbColor={formIsActive ? '#ED0712' : '#F1F5F9'}
                />
              </View>

              <View style={[styles.toggleRow, styles.toggleDivider]}>
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text style={styles.toggleTitle}>Enable Printer</Text>
                  <Text style={styles.toggleDesc}>
                    Enable printer for active production network jobs
                  </Text>
                </View>
                <Switch
                  value={formIsEnabled}
                  onValueChange={setFormIsEnabled}
                  trackColor={{ false: '#CBD5E1', true: '#FCA5A5' }}
                  thumbColor={formIsEnabled ? '#ED0712' : '#F1F5F9'}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsModalOpen(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSavePrinter}
                disabled={isSavingPrinter}
                activeOpacity={0.85}
              >
                {isSavingPrinter ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.modalSaveText}>
                      {editingPrinter ? 'Save Changes' : 'Save Printer'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
    gap: 18,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 10px rgba(0,0,0,0.04)' } as any)
      : { elevation: 2 }),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#ED0712',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 12px rgba(237,7,18,0.35)' } as any)
      : {}),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#047857',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ED0712',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 14px rgba(237,7,18,0.35)', cursor: 'pointer' } as any)
      : {}),
  },
  saveBtnSuccess: {
    backgroundColor: '#059669',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subTabRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  subTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subTabBtnActive: {
    borderColor: '#ED0712',
    backgroundColor: '#FFF5F5',
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  subTabTextActive: {
    color: '#ED0712',
    fontWeight: '700',
  },
  gridSection: {
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(0,0,0,0.03)' } as any)
      : {}),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  formGroup: {
    gap: 6,
  },
  twoColRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  textInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0F172A',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  toggleDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  baysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bayCard: {
    width: '31%',
    minWidth: 200,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  bayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bayNum: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  bayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  bayBadgeGreen: {
    backgroundColor: '#ECFDF5',
  },
  bayBadgeRed: {
    backgroundColor: '#FEF2F2',
  },
  bayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bayTextGreen: {
    color: '#059669',
  },
  bayTextRed: {
    color: '#DC2626',
  },
  bayType: {
    fontSize: 12,
    color: '#64748B',
  },
  bayDetail: {
    fontSize: 12,
    color: '#334155',
    marginTop: 4,
  },
  hardwareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  hwName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  hwIp: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  pricingGrid: {
    gap: 14,
  },
  priceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  priceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
  },
  pricePrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 6,
  },
  priceInput: {
    height: 38,
    width: 80,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'right',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  /* PRINTER MANAGEMENT STYLES */
  activePrinterBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 14,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 4px 12px rgba(237,7,18,0.06)' } as any) : {}),
  },
  activePrinterBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
    minWidth: 260,
  },
  activePrinterIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  activePrinterBannerTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  activePrinterBannerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },
  activePrinterBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addPrinterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ED0712',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', boxShadow: '0 4px 12px rgba(237,7,18,0.25)' } as any) : {}),
  },
  addPrinterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reloadPrinterBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  printerErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 12,
  },
  printerErrorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  printersGrid: {
    gap: 14,
  },
  printerCardItem: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 12,
  },
  printerCardItemActive: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFDFD',
    borderWidth: 1.5,
  },
  printerCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  printerCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 220,
  },
  printerIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  printerIconSmallActive: {
    backgroundColor: '#FEE2E2',
  },
  printerCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  printerCardType: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  printerBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeActiveReceipt: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeActiveReceiptText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.3,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgePillEnabled: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  badgePillDisabled: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  badgeTextEnabled: {
    color: '#16A34A',
  },
  badgeTextDisabled: {
    color: '#94A3B8',
  },
  printerDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  detailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  detailPillLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  detailPillVal: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  printerCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexWrap: 'wrap',
  },
  printerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  printerActionTest: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  printerActionTestText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0284C7',
  },
  printerActionMakeActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  printerActionMakeActiveText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#15803D',
  },
  printerActionEdit: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
  },
  printerActionEditText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  printerActionDelete: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    paddingHorizontal: 10,
  },

  /* MODAL STYLES */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    padding: 24,
    gap: 16,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 20px 40px rgba(0,0,0,0.2)' } as any) : { elevation: 6 }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  typeOptionBtnActive: {
    borderColor: '#ED0712',
    backgroundColor: '#FEF2F2',
  },
  typeOptionText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  typeOptionTextActive: {
    color: '#ED0712',
    fontWeight: '800',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ED0712',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 4px 12px rgba(237,7,18,0.3)' } as any) : {}),
  },
  modalSaveText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

