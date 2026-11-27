/**
 * BackofficeScreen.tsx
 * Complete Backend and Database Integration for RedBay Car Wash Backoffice
 * Fully connected to Node.js backend and Microsoft SQL Server (UCSSMOKE).
 *
 * Implements complete CRUD, live dynamic lists, real-time KPI metrics,
 * forms with validations, duplicate checking, audit logging (CreatedBy/ModifiedBy),
 * search, filters, and CSV export.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  StatusBar,
  Pressable,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { ScreenNameBadge } from '../../../components/common/ScreenNameBadge';
import { formatSgDateTime, formatSgTime } from '../../../services/timeService';

// ── Auth & Store ──
import { useAuthStore } from '../../auth/store/authStore';

// ── POS Queue screen ──
import { PosDashboardScreen } from '../../pos/screens/PosDashboardScreen';
import { PosNavTab } from '../../pos/components/PosSidebar';

// ── Dealer Management Views ──
import { DealerCreditHistoryView } from '../components/DealerCreditHistoryView';
import { DealerCreditSettlementView } from '../components/DealerCreditSettlementView';
import { DealerVehicleHistoryView } from '../components/DealerVehicleHistoryView';
import { OffersPromotionsView } from '../components/OffersPromotionsView';

// ── Services & APIs ──
import {
  fetchFullSalesDashboard,
  FullDashboardPayload,
  SalesSummaryData,
  PaymentChannelMixItem,
  WashTrendItem,
  ReportPeriodTab,
} from '../../../services/salesReportApi';
import { useDayManagementStore } from '../../dayManagement/store/dayManagementStore';

import {
  fetchBayMasterList,
  BayMasterRecord,
  createBayMaster,
  updateBayMaster,
  deleteBayMaster,
} from '../../../services/carwashOrderApi';

import {
  fetchUsers,
  fetchUserGroups,
  createUser,
  updateUser,
  deleteUser,
  createUserGroup,
  updateUserGroup,
  deleteUserGroup,
  UserRecord,
  UserGroupRecord,
} from '../../../services/userApi';

import {
  fetchAllVehicleTypes,
  createVehicleType,
  updateVehicleType,
  deleteVehicleType,
  VehicleTypeRecord,
  fetchAllServiceCategories,
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
  ServiceCategoryRecord,
  fetchAllPackages,
  createPackage,
  updatePackage,
  deletePackage,
  ServicePackageRecord,
  fetchAllAddons,
  createAddon,
  updateAddon,
  deleteAddon,
  ServiceAddonRecord,
  fetchAuditLogs,
  AuditLogRecord,
  getExportUrl,
} from '../../../services/masterApi';

import {
  fetchVehicleTypePricesForPackage,
  updateVehicleTypePrice,
  VehicleTypePrice,
} from '../../../services/packageApi';

import {
  fetchCompanySettings,
  updateCompanySettings,
  CompanySettings,
} from '../../../services/companySettingsApi';

import {
  fetchPrinters,
  createPrinter,
  updatePrinter,
  deletePrinter,
  testPrinter,
  PrinterConfig,
} from '../../../services/printerApi';

import {
  fetchAllDealers,
  createDealer,
  updateDealer,
  deleteDealer,
  DealerRecord,
} from '../../../services/dealerApi';

import {
  fetchAccountTypes,
  createAccountType,
  updateAccountType,
  deleteAccountType,
  AccountTypeOption,
} from '../../../services/accountTypeApi';

import {
  fetchAllPaymodes,
  fetchPaymodeById,
  createPaymode,
  updatePaymode,
  togglePaymodeActive,
  deletePaymode,
  PaymodeRecord,
} from '../../../services/paymodeApi';

import {
  fetchActiveHelpRequests,
  resolveHelpRequest,
  clearAllHelpRequests,
  HelpRequestItem,
} from '../../../services/helpNotificationService';

import { resolveApiUrl } from '../../../services/apiConfig';

const VEHICLE_FALLBACKS: Record<string, any> = {
  sedan: require('../../../../assets/images/vehicles/sedan.png'),
  suv: require('../../../../assets/images/vehicles/suv.png'),
  mpv: require('../../../../assets/images/vehicles/mpv.png'),
  big_mpv: require('../../../../assets/images/vehicles/big_mpv.png'),
  'big mpv': require('../../../../assets/images/vehicles/big_mpv.png'),
  hatchback: require('../../../../assets/images/vehicles/hatchback.png'),
  coupe: require('../../../../assets/images/vehicles/coupe.png'),
};

const CATEGORY_FALLBACKS: Record<string, any> = {
  car_wash: require('../../../../assets/images/categories/car_wash.jpg'),
  'car wash': require('../../../../assets/images/categories/car_wash.jpg'),
  polishing: require('../../../../assets/images/categories/polishing.jpg'),
  polish: require('../../../../assets/images/categories/polishing.jpg'),
  alcare: require('../../../../assets/images/categories/alcare.jpg'),
};

interface BackofficeImageThumbProps {
  uri?: string | null;
  fallbackKey?: string;
  type?: 'vehicle' | 'category' | 'dealer' | 'account' | 'paymode';
  style?: any;
  resizeMode?: 'contain' | 'cover';
}

const BackofficeImageThumb: React.FC<BackofficeImageThumbProps> = ({
  uri,
  fallbackKey,
  type = 'vehicle',
  style,
  resizeMode = 'contain',
}) => {
  const [loadFailed, setLoadFailed] = useState(false);
  const resolved = uri ? resolveApiUrl(uri) : '';

  useEffect(() => {
    setLoadFailed(false);
  }, [uri]);

  const normKey = (fallbackKey || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  let localAsset: any = null;
  if (type === 'vehicle') {
    localAsset = VEHICLE_FALLBACKS[normKey] || null;
    if (!localAsset) {
      for (const [k, v] of Object.entries(VEHICLE_FALLBACKS)) {
        if (normKey.includes(k) || k.includes(normKey)) {
          localAsset = v;
          break;
        }
      }
    }
  } else if (type === 'category') {
    localAsset = CATEGORY_FALLBACKS[normKey] || null;
    if (!localAsset) {
      if (normKey.includes('polish') || normKey.includes('wax')) localAsset = CATEGORY_FALLBACKS.polishing;
      else if (normKey.includes('wash') || normKey.includes('foam')) localAsset = CATEGORY_FALLBACKS.car_wash;
      else if (normKey.includes('alcare') || normKey.includes('interior')) localAsset = CATEGORY_FALLBACKS.alcare;
    }
  }

  if (resolved && !loadFailed) {
    return (
      <Image
        source={{ uri: resolved }}
        style={style}
        resizeMode={resizeMode}
        onError={() => setLoadFailed(true)}
      />
    );
  }

  if (localAsset) {
    return (
      <Image
        source={localAsset}
        style={style}
        resizeMode={resizeMode}
      />
    );
  }

  return (
    <View style={[styles.tableThumbPlaceholder, style]}>
      <Ionicons
        name={
          type === 'vehicle'
            ? 'car-outline'
            : type === 'category'
            ? 'image-outline'
            : type === 'dealer'
            ? 'business-outline'
            : type === 'paymode'
            ? 'wallet-outline'
            : 'shield-outline'
        }
        size={16}
        color={C.textMuted}
      />
    </View>
  );
};

const getTodayISO = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getYesterdayISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekStartISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthStartISO = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

const getYearStartISO = () => {
  const today = new Date();
  return `${today.getFullYear()}-01-01`;
};

const webDashboardDateInputStyle: any = {
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  fontSize: '12.5px',
  fontWeight: '700',
  color: '#FFFFFF',
  fontFamily: 'inherit',
  cursor: 'pointer',
  padding: '0 4px',
  colorScheme: 'dark',
};

/* ─────────────────────── Design tokens ─────────────────────── */
const C = {
  bg:         '#080808',
  surface:    '#111111',
  surfaceAlt: '#151515',
  card:       'rgba(21,21,21,0.85)',
  cardBorder: 'rgba(255,26,26,0.18)',
  accent:     '#FF1A1A',
  accentDark: '#8B0000',
  accentGlow: 'rgba(255,26,26,0.35)',
  white:      '#FFFFFF',
  textSec:    '#BDBDBD',
  textMuted:  'rgba(255,255,255,0.35)',
  divider:    'rgba(255,255,255,0.06)',
  sidebarW:   220,
};

/* ─────────────────────── Navigation IDs ─────────────────────── */
type NavId =
  | 'dashboard'
  | 'carwash'
  | 'dealer-credit'
  | 'dealer-settlement'
  | 'dealer-history'
  | 'promotions'
  | 'paymodes'
  | 'users'
  | 'user-groups'
  | 'settings'
  | 'audit'
  | 'export'
  | 'alerts';

type SettingsSubTab = 'VEHICLES' | 'CATEGORIES' | 'PACKAGES' | 'ADDONS' | 'BAYS' | 'DEALERS' | 'ACCOUNT_TYPES' | 'COMPANY' | 'PRINTERS';

export interface BackofficeScreenProps {
  onLogout?: () => void;
}

/** Inline editable row for one vehicle type's customer + dealer price in the package modal */
const VehiclePriceRow: React.FC<{
  row: VehicleTypePrice;
  onSave: (custPrice: number, dlrPrice: number) => Promise<void>;
  onChange?: (custPrice: number, dlrPrice: number) => void;
  C: any;
  styles: any;
}> = ({ row, onSave, onChange, C, styles }) => {
  const [cust, setCust] = React.useState(
    typeof row.customerPrice === 'number' && !isNaN(row.customerPrice)
      ? row.customerPrice.toFixed(2)
      : '0.00'
  );
  const [dlr, setDlr] = React.useState(
    typeof row.dealerPrice === 'number' && !isNaN(row.dealerPrice)
      ? row.dealerPrice.toFixed(2)
      : '0.00'
  );
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  // Track active focus so parent re-renders do not overwrite user's typing
  const isCustFocused = React.useRef(false);
  const isDlrFocused = React.useRef(false);

  // Sync only on row initialization/switch (not on active keystrokes)
  React.useEffect(() => {
    if (!isCustFocused.current) {
      const num = typeof row.customerPrice === 'number' && !isNaN(row.customerPrice) ? row.customerPrice : 0;
      setCust(num.toFixed(2));
    }
    if (!isDlrFocused.current) {
      const num = typeof row.dealerPrice === 'number' && !isNaN(row.dealerPrice) ? row.dealerPrice : 0;
      setDlr(num.toFixed(2));
    }
  }, [row.vehicleTypeId, row.packageId]);

  const sanitizeInput = (val: string) => {
    let clean = val.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = parts[0] + '.' + parts.slice(1).join('');
    }
    return clean;
  };

  const handleCustChange = (val: string) => {
    const clean = sanitizeInput(val);
    setCust(clean);
    if (onChange) {
      const c = parseFloat(clean);
      const d = parseFloat(dlr);
      onChange(isNaN(c) ? 0 : c, isNaN(d) ? 0 : d);
    }
  };

  const handleCustBlur = () => {
    isCustFocused.current = false;
    const clean = sanitizeInput(cust);
    const parsed = parseFloat(clean);
    const formatted = isNaN(parsed) ? '0.00' : parsed.toFixed(2);
    setCust(formatted);
    if (onChange) {
      const d = parseFloat(dlr) || 0;
      onChange(isNaN(parsed) ? 0 : parsed, d);
    }
  };

  const handleDlrChange = (val: string) => {
    const clean = sanitizeInput(val);
    setDlr(clean);
    if (onChange) {
      const c = parseFloat(cust);
      const d = parseFloat(clean);
      onChange(isNaN(c) ? 0 : c, isNaN(d) ? 0 : d);
    }
  };

  const handleDlrBlur = () => {
    isDlrFocused.current = false;
    const clean = sanitizeInput(dlr);
    const parsed = parseFloat(clean);
    const formatted = isNaN(parsed) ? '0.00' : parsed.toFixed(2);
    setDlr(formatted);
    if (onChange) {
      const c = parseFloat(cust) || 0;
      onChange(c, isNaN(parsed) ? 0 : parsed);
    }
  };

  const handleSave = async () => {
    const c = parseFloat(cust) || 0;
    const d = parseFloat(dlr) || 0;
    setSaving(true);
    try {
      await onSave(c, d);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.warn('Failed to save rate:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: C.divider }}>
      <Text style={[styles.td, { flex: 1.6, fontWeight: '700', color: C.white }]} numberOfLines={1}>
        {row.vehicleTypeName}
      </Text>
      <View style={{ flex: 1.2, paddingHorizontal: 4 }}>
        <TextInput
          style={[styles.fieldInput, { textAlign: 'center', paddingVertical: 4, fontSize: 13 }]}
          value={cust}
          onChangeText={handleCustChange}
          onFocus={() => {
            isCustFocused.current = true;
          }}
          onBlur={handleCustBlur}
          keyboardType="numeric"
          selectTextOnFocus
          placeholder="0.00"
          placeholderTextColor={C.textSec}
        />
      </View>
      <View style={{ flex: 1.2, paddingHorizontal: 4 }}>
        <TextInput
          style={[styles.fieldInput, { textAlign: 'center', paddingVertical: 4, fontSize: 13 }]}
          value={dlr}
          onChangeText={handleDlrChange}
          onFocus={() => {
            isDlrFocused.current = true;
          }}
          onBlur={handleDlrBlur}
          keyboardType="numeric"
          selectTextOnFocus
          placeholder="0.00"
          placeholderTextColor={C.textSec}
        />
      </View>
      <Pressable
        style={{ flex: 0.8, alignItems: 'center', justifyContent: 'center' }}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color={C.accent} />
        ) : saved ? (
          <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
        ) : (
          <Ionicons name="save-outline" size={18} color="#3B82F6" />
        )}
      </Pressable>
    </View>
  );
};

export const BackofficeScreen: React.FC<BackofficeScreenProps> = ({ onLogout }) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isMid  = width >= 600;

  const loggedInUser = useAuthStore((state) => state.user);

  const [activeNav, setActiveNav] = useState<NavId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cwTab, setCwTab] = useState<PosNavTab>('ORDERS');

  /* ─────────────────────── Custom In-App Popup Modal System ─────────────────────── */
  interface PopupState {
    visible: boolean;
    type: 'confirm' | 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmButtonColor?: string;
    icon?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }

  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const closePopup = useCallback(() => {
    setPopup((prev) => ({ ...prev, visible: false }));
  }, []);

  const showAlert = useCallback((title: string, message: string, customType?: 'success' | 'error' | 'warning' | 'info') => {
    if (Platform.OS !== 'web') {
      Alert.alert(title, message, [{ text: 'OK' }]);
      return;
    }

    let resolvedType: 'success' | 'error' | 'warning' | 'info' = customType || 'info';
    if (!customType) {
      const lower = (title || '').toLowerCase() + ' ' + (message || '').toLowerCase();
      if (lower.includes('error') || lower.includes('failed') || lower.includes('required') || lower.includes('invalid')) {
        resolvedType = 'error';
      } else if (lower.includes('success') || lower.includes('created') || lower.includes('updated') || lower.includes('saved') || lower.includes('deleted') || lower.includes('removed')) {
        resolvedType = 'success';
      } else if (lower.includes('warn') || lower.includes('caution')) {
        resolvedType = 'warning';
      }
    }

    setPopup({
      visible: true,
      type: resolvedType,
      title,
      message,
      confirmText: 'OK',
    });
  }, []);

  const showConfirm = useCallback(({
    title,
    message,
    confirmText = 'Delete',
    cancelText = 'Cancel',
    confirmButtonColor = '#EF4444',
    icon = 'trash-outline',
    onConfirm,
    onCancel,
  }: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmButtonColor?: string;
    icon?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }) => {
    if (Platform.OS !== 'web') {
      Alert.alert(
        title,
        message,
        [
          {
            text: cancelText,
            style: 'cancel',
            onPress: () => {
              if (onCancel) onCancel();
            },
          },
          {
            text: confirmText,
            style: 'destructive',
            onPress: () => {
              if (onConfirm) onConfirm();
            },
          },
        ],
        { cancelable: true }
      );
      return;
    }

    setPopup({
      visible: true,
      type: 'confirm',
      title,
      message,
      confirmText,
      cancelText,
      confirmButtonColor,
      icon,
      onConfirm,
      onCancel,
    });
  }, []);

  /* ═══════════════════════════════════════════════════════════════
     1. DASHBOARD LIVE DATA & SALES DATE FILTER
  ═══════════════════════════════════════════════════════════════ */
  type SalesPeriodMode = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  const [salesPeriodMode, setSalesPeriodMode] = useState<SalesPeriodMode>('DAILY');
  const [yearlyTrendView, setYearlyTrendView] = useState<'MONTHS' | 'DAYS'>('MONTHS');

  const storeBusinessDate = useDayManagementStore((state) => state.businessDate);
  const activeDay = useDayManagementStore((state) => state.activeDay);
  const lastClosedDay = useDayManagementStore((state) => state.lastClosedDay);
  const checkDayStatus = useDayManagementStore((state) => state.checkStatus);

  const activeBusinessDateStr = useMemo(() => {
    const raw = storeBusinessDate || activeDay?.businessDate || lastClosedDay?.businessDate;
    if (raw) return typeof raw === 'string' ? raw.split('T')[0] : null;
    return null;
  }, [storeBusinessDate, activeDay, lastClosedDay]);

  const effectiveReferenceDate = activeBusinessDateStr || getTodayISO();

  const [salesStartDate, setSalesStartDate] = useState<string>(() => {
    const raw = useDayManagementStore.getState().businessDate || 
                useDayManagementStore.getState().activeDay?.businessDate || 
                useDayManagementStore.getState().lastClosedDay?.businessDate;
    if (raw && typeof raw === 'string') return raw.split('T')[0];
    return getTodayISO();
  });
  const [salesEndDate, setSalesEndDate] = useState<string>(() => {
    const raw = useDayManagementStore.getState().businessDate || 
                useDayManagementStore.getState().activeDay?.businessDate || 
                useDayManagementStore.getState().lastClosedDay?.businessDate;
    if (raw && typeof raw === 'string') return raw.split('T')[0];
    return getTodayISO();
  });

  const [hasUserNavigatedDate, setHasUserNavigatedDate] = useState<boolean>(false);

  useEffect(() => {
    checkDayStatus();
  }, []);

  useEffect(() => {
    if (activeBusinessDateStr && !hasUserNavigatedDate) {
      setSalesStartDate(activeBusinessDateStr);
      setSalesEndDate(activeBusinessDateStr);
    }
  }, [activeBusinessDateStr, hasUserNavigatedDate]);

  const [dashLoading, setDashLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<SalesSummaryData | null>(null);
  const [washTrends, setWashTrends] = useState<WashTrendItem[]>([]);
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannelMixItem[]>([]);
  const [liveBays, setLiveBays] = useState<BayMasterRecord[]>([]);
  const [totalStaffCount, setTotalStaffCount] = useState<number>(0);

  const handleSelectPeriodMode = (mode: SalesPeriodMode) => {
    setSalesPeriodMode(mode);
    setHasUserNavigatedDate(false);
    const today = effectiveReferenceDate;
    if (mode === 'DAILY') {
      setSalesStartDate(today);
      setSalesEndDate(today);
    } else if (mode === 'WEEKLY') {
      const parts = today.split('-').map(Number);
      const start = new Date(parts[0], parts[1] - 1, parts[2] - 7);
      const startISO = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
      setSalesStartDate(startISO);
      setSalesEndDate(today);
    } else if (mode === 'MONTHLY') {
      const parts = today.split('-').map(Number);
      const start = new Date(parts[0], parts[1] - 1, 1);
      const startISO = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
      setSalesStartDate(startISO);
      setSalesEndDate(today);
    } else if (mode === 'YEARLY') {
      const parts = today.split('-').map(Number);
      const start = new Date(parts[0], 0, 1);
      const startISO = `${start.getFullYear()}-01-01`;
      setSalesStartDate(startISO);
      setSalesEndDate(today);
    }
  };

  const handleStartDateChange = (val: string) => {
    if (!val) return;
    setHasUserNavigatedDate(true);
    setSalesStartDate(val);
    if (salesPeriodMode === 'DAILY') {
      setSalesEndDate(val);
    } else if (val > salesEndDate) {
      setSalesEndDate(val);
    }
  };

  const handleEndDateChange = (val: string) => {
    if (!val) return;
    setHasUserNavigatedDate(true);
    setSalesEndDate(val);
    if (val < salesStartDate) {
      setSalesStartDate(val);
    }
  };

  const handleStepPrevDay = () => {
    setHasUserNavigatedDate(true);
    const parts = (salesStartDate || effectiveReferenceDate).split('-').map(Number);
    const prev = new Date(parts[0], parts[1] - 1, parts[2]);
    prev.setDate(prev.getDate() - 1);
    const prevISO = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
    setSalesStartDate(prevISO);
    setSalesEndDate(prevISO);
  };

  const handleStepNextDay = () => {
    const today = effectiveReferenceDate;
    if (salesStartDate >= today) return;
    const parts = (salesStartDate || effectiveReferenceDate).split('-').map(Number);
    const next = new Date(parts[0], parts[1] - 1, parts[2]);
    next.setDate(next.getDate() + 1);
    const nextISO = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
    if (nextISO <= today) {
      setSalesStartDate(nextISO);
      setSalesEndDate(nextISO);
      if (nextISO >= today) {
        setHasUserNavigatedDate(false);
      }
    }
  };

  const getPeriodDisplayLabel = useCallback(() => {
    if (salesPeriodMode === 'DAILY') {
      return salesStartDate === getTodayISO()
        ? `Daily • Today (${salesStartDate})`
        : `Daily • ${salesStartDate}`;
    }
    const modeName = salesPeriodMode.charAt(0) + salesPeriodMode.slice(1).toLowerCase();
    return `${modeName} • From ${salesStartDate} to ${salesEndDate}`;
  }, [salesPeriodMode, salesStartDate, salesEndDate]);

  const getKpiPeriodLabel = useCallback(() => {
    if (salesPeriodMode === 'DAILY') {
      return salesStartDate === getTodayISO() ? 'Today' : salesStartDate;
    }
    if (salesPeriodMode === 'WEEKLY') return 'Weekly';
    if (salesPeriodMode === 'MONTHLY') return 'Monthly';
    if (salesPeriodMode === 'YEARLY') return 'Yearly';
    return `${salesStartDate} to ${salesEndDate}`;
  }, [salesPeriodMode, salesStartDate, salesEndDate]);

  const loadDashboardData = useCallback(async () => {
    try {
      setDashLoading(true);
      const dashPromise = fetchFullSalesDashboard(
        salesPeriodMode,
        salesStartDate,
        salesEndDate
      );

      const [dash, bays, userList] = await Promise.all([
        dashPromise.catch((err) => {
          console.warn('[fetchFullSalesDashboard error]', err);
          return null;
        }),
        fetchBayMasterList().catch(() => []),
        fetchUsers().catch(() => []),
      ]);

      if (dash && dash.summary) {
        setSummaryData(dash.summary);
        setWashTrends(dash.washTrend || []);
        setPaymentChannels(dash.paymentChannelMix || []);
      }
      setLiveBays(bays || []);
      setTotalStaffCount((userList || []).filter((u) => !u.isDisabled).length);
    } catch (err: any) {
      console.warn('[loadDashboardData Error]', err);
    } finally {
      setDashLoading(false);
    }
  }, [salesPeriodMode, salesStartDate, salesEndDate]);

  useEffect(() => {
    if (activeNav === 'dashboard') {
      loadDashboardData();
    }
  }, [activeNav, loadDashboardData]);

  const washesCompletedCount = useMemo(() => {
    if (summaryData?.totalWashes && summaryData.totalWashes > 0) {
      return summaryData.totalWashes;
    }
    if (summaryData?.totalCompletedWashes && summaryData.totalCompletedWashes > 0) {
      return summaryData.totalCompletedWashes;
    }
    const trendSum = washTrends.reduce(
      (acc, curr) => acc + (curr.completedWashes || curr.totalOrders || 0),
      0
    );
    if (trendSum > 0) return trendSum;
    return summaryData?.totalCompletedWashes ?? summaryData?.totalWashes ?? 0;
  }, [summaryData, washTrends]);

  const computedWashTrends = useMemo(() => {
    const normDate = (val: any): string => {
      if (!val) return '';
      if (val instanceof Date) {
        return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
      }
      const str = String(val).trim();
      if (str.includes('T')) return str.split('T')[0];
      if (str.includes(' ')) return str.split(' ')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
      if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
        const [dd, mm, yyyy] = str.split('-');
        return `${yyyy}-${mm}-${dd}`;
      }
      return str;
    };

    const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const trendMap = new Map<string, { count: number; revenue: number }>();
    washTrends.forEach((t) => {
      const nd = normDate(t.orderDate);
      if (nd) {
        const prev = trendMap.get(nd) || { count: 0, revenue: 0 };
        trendMap.set(nd, {
          count: prev.count + (t.completedWashes || t.totalOrders || 0),
          revenue: prev.revenue + (t.dailyRevenue || 0),
        });
      }
    });

    // 1. YEARLY MODE - MONTHLY VIEW (DEFAULT)
    if (salesPeriodMode === 'YEARLY' && yearlyTrendView === 'MONTHS') {
      const yr = (salesStartDate || getTodayISO()).split('-')[0];
      return monthNames.map((mName, mIdx) => {
        const mStr = String(mIdx + 1).padStart(2, '0');
        let mCount = 0;
        let mRev = 0;
        trendMap.forEach((val, dStr) => {
          const parts = dStr.split('-');
          if (parts[0] === yr && parts[1] === mStr) {
            mCount += val.count;
            mRev += val.revenue;
          }
        });
        return {
          key: `m-${mIdx}`,
          label: mName,
          subLabel: yr,
          count: mCount,
          revenue: mRev,
        };
      });
    }

    // 2. DAILY, WEEKLY, MONTHLY OR YEARLY (DAILY VIEW) -> GENERATE EVERY DAY IN RANGE
    const sStr = salesStartDate || getTodayISO();
    const eStr = salesEndDate || sStr;

    const [sY, sM, sD] = sStr.split('-').map(Number);
    const [eY, eM, eD] = eStr.split('-').map(Number);

    const cur = new Date(sY, sM - 1, sD);
    const end = new Date(eY, eM - 1, eD);

    const days: { key: string; label: string; subLabel: string; count: number; revenue?: number; fullDate?: string }[] = [];
    let limit = 0;
    while (cur <= end && limit < 370) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${d}`;

      const dayName = dayNamesShort[cur.getDay()];
      const record = trendMap.get(dateKey);

      days.push({
        key: dateKey,
        label: dayName,
        subLabel: `${d}/${m}`,
        count: record ? record.count : 0,
        revenue: record ? record.revenue : 0,
        fullDate: dateKey,
      });

      cur.setDate(cur.getDate() + 1);
      limit++;
    }

    if (days.length === 0) {
      return [{
        key: sStr,
        label: 'Today',
        subLabel: sStr.slice(5),
        count: summaryData?.totalWashes || summaryData?.totalCompletedWashes || 0,
      }];
    }

    return days;
  }, [washTrends, salesPeriodMode, yearlyTrendView, salesStartDate, salesEndDate, summaryData]);

  /* ═══════════════════════════════════════════════════════════════
     2. USER MANAGEMENT STATE & CRUD
  ═══════════════════════════════════════════════════════════════ */
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroupRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // User Modal State
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [uCode, setUCode] = useState('');
  const [uName, setUName] = useState('');
  const [uFullName, setUFullName] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uGroupId, setUGroupId] = useState('');
  const [uDisabled, setUDisabled] = useState(false);
  const [savingUser, setSavingUser] = useState(false);

  // User Group State & Modal
  const [groupSearch, setGroupSearch] = useState('');
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroupRecord | null>(null);
  const [gCode, setGCode] = useState('');
  const [gName, setGName] = useState('');
  const [gActive, setGActive] = useState(true);
  const [savingGroup, setSavingGroup] = useState(false);

  const filteredUserGroups = useMemo(() => {
    if (!groupSearch.trim()) return userGroups;
    const term = groupSearch.trim().toLowerCase();
    return userGroups.filter(
      (g) =>
        (g.userGroupCode && g.userGroupCode.toLowerCase().includes(term)) ||
        (g.userGroupName && g.userGroupName.toLowerCase().includes(term))
    );
  }, [userGroups, groupSearch]);

  const loadUsersList = useCallback(async (searchQuery?: string) => {
    try {
      setUsersLoading(true);
      const [uList, gList] = await Promise.all([
        fetchUsers(searchQuery),
        fetchUserGroups(),
      ]);
      setUsers(uList);
      setUserGroups(gList);
      if (gList.length > 0 && !uGroupId) {
        setUGroupId(gList[0].userGroupId);
      }
    } catch (err: any) {
      console.warn('Failed to load users:', err);
    } finally {
      setUsersLoading(false);
    }
  }, [uGroupId]);

  useEffect(() => {
    if (activeNav === 'users' || activeNav === 'user-groups') {
      loadUsersList();
    }
  }, [activeNav, loadUsersList]);

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUCode(`USR${Date.now().toString().slice(-6)}`);
    setUName('');
    setUFullName('');
    setUPassword('');
    setUGroupId(userGroups[0]?.userGroupId || '');
    setUDisabled(false);
    setUserModalOpen(true);
  };

  const handleOpenEditUser = (user: UserRecord) => {
    setEditingUser(user);
    setUCode(user.userCode);
    setUName(user.userName);
    setUFullName(user.fullName);
    setUPassword(''); // Leave blank to keep existing
    setUGroupId(user.userGroupId || userGroups[0]?.userGroupId || '');
    setUDisabled(user.isDisabled);
    setUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!uName.trim()) {
      showAlert('Validation Error', 'User Name (login ID) is required.');
      return;
    }
    if (!editingUser && !uPassword.trim()) {
      showAlert('Validation Error', 'Password is required for new user.');
      return;
    }

    try {
      setSavingUser(true);
      if (editingUser) {
        await updateUser(editingUser.userId, {
          userName: uName.trim(),
          fullName: uFullName.trim(),
          userGroupId: uGroupId || undefined,
          password: uPassword.trim() || undefined,
          isDisabled: uDisabled,
          modifiedBy: loggedInUser?.userId || undefined,
        });
        showAlert('Success', `User "${uName}" updated successfully in database.`);
      } else {
        await createUser({
          userCode: uCode.trim(),
          userName: uName.trim(),
          fullName: uFullName.trim(),
          password: uPassword.trim(),
          userGroupId: uGroupId || undefined,
          isDisabled: uDisabled,
          createdBy: loggedInUser?.userId || undefined,
        });
        showAlert('Success', `User "${uName}" created successfully in database.`);
      }
      setUserModalOpen(false);
      loadUsersList(userSearch);
    } catch (err: any) {
      showAlert('Error', err.message || 'Operation failed.');
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = (user: UserRecord) => {
    showConfirm({
      title: 'Delete User Account',
      message: `Are you sure you want to permanently delete user "${user.userName}" (${user.fullName || user.userCode}) from UserMaster? This action cannot be undone.`,
      confirmText: 'Delete Permanently',
      confirmButtonColor: '#EF4444',
      icon: 'trash-outline',
      onConfirm: () => performDeleteUser(user.userId),
    });
  };

  const performDeleteUser = async (userId: string) => {
    try {
      await deleteUser(userId, true);
      showAlert('Success', 'User account permanently deleted from database.');
      loadUsersList(userSearch);
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to delete user.');
    }
  };

  /* ── User Group Handlers ── */
  const handleOpenAddGroup = () => {
    setEditingGroup(null);
    setGCode(`GRP_${(userGroups.length + 1).toString().padStart(3, '0')}`);
    setGName('');
    setGActive(true);
    setGroupModalOpen(true);
  };

  const handleOpenEditGroup = (group: UserGroupRecord) => {
    setEditingGroup(group);
    setGCode(group.userGroupCode);
    setGName(group.userGroupName);
    setGActive(group.isActive !== false);
    setGroupModalOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!gCode.trim()) {
      showAlert('Validation Error', 'Group Code is required.');
      return;
    }
    if (!gName.trim()) {
      showAlert('Validation Error', 'Group Name is required.');
      return;
    }

    try {
      setSavingGroup(true);
      if (editingGroup) {
        await updateUserGroup(editingGroup.userGroupId, {
          userGroupCode: gCode.trim(),
          userGroupName: gName.trim(),
          isActive: gActive,
        });
        showAlert('Success', `User group "${gName}" updated successfully in database.`);
      } else {
        await createUserGroup({
          userGroupCode: gCode.trim(),
          userGroupName: gName.trim(),
          isActive: gActive,
        });
        showAlert('Success', `User group "${gName}" created successfully in database.`);
      }
      setGroupModalOpen(false);
      loadUsersList();
    } catch (err: any) {
      showAlert('Error', err.message || 'Operation failed.');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = (group: UserGroupRecord) => {
    const assignedUsers = users.filter((u) => u.userGroupId === group.userGroupId);
    const message = assignedUsers.length > 0
      ? `"${group.userGroupName}" currently has ${assignedUsers.length} assigned user(s). Deleting will unlink those users and permanently delete this user group from database.`
      : `Are you sure you want to permanently delete user group "${group.userGroupName}" from database? This action cannot be undone.`;

    showConfirm({
      title: 'Delete User Group',
      message,
      confirmText: 'Delete Permanently',
      confirmButtonColor: '#EF4444',
      icon: 'trash-outline',
      onConfirm: async () => {
        try {
          await deleteUserGroup(group.userGroupId);
          showAlert('Success', `User group "${group.userGroupName}" permanently deleted.`);
          loadUsersList();
        } catch (err: any) {
          showAlert('Error', err.message || 'Failed to delete user group.');
        }
      },
    });
  };

  /* ═══════════════════════════════════════════════════════════════
     3. SETTINGS & MASTER MANAGEMENT STATE & CRUD
  ═══════════════════════════════════════════════════════════════ */
  const [settingsTab, setSettingsTab] = useState<SettingsSubTab>('VEHICLES');
  const [settingsLoading, setSettingsLoading] = useState(false);

  // 3a. Vehicle Types
  const [vehicles, setVehicles] = useState<VehicleTypeRecord[]>([]);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleTypeRecord | null>(null);
  const [vCode, setVCode] = useState('');
  const [vName, setVName] = useState('');
  const [vDesc, setVDesc] = useState('');
  const [vOrder, setVOrder] = useState('1');
  const [vActive, setVActive] = useState(true);
  const [vImage, setVImage] = useState('');
  const [vehicleSortAsc, setVehicleSortAsc] = useState<boolean>(true);

  // 3b. Categories
  const [categories, setCategories] = useState<ServiceCategoryRecord[]>([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategoryRecord | null>(null);
  const [cCode, setCCode] = useState('');
  const [cName, setCName] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cOrder, setCOrder] = useState('1');
  const [cActive, setCActive] = useState(true);
  const [cImage, setCImage] = useState('');
  const [cIcon, setCIcon] = useState('');
  const [categorySortAsc, setCategorySortAsc] = useState<boolean>(true);

  const handlePickImage = async (onSuccess: (base64: string) => void) => {
    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            if (file.size > 5 * 1024 * 1024) {
              showAlert('File Too Large', 'Please select an image smaller than 5MB.');
              return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
              const base64 = event.target?.result as string;
              onSuccess(base64);
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
        return;
      }

      // Native Android / iOS via expo-image-picker
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert('Permission Required', 'Please enable photo library access in settings to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          const mimeType = asset.mimeType || 'image/jpeg';
          const fullBase64 = `data:${mimeType};base64,${asset.base64}`;
          onSuccess(fullBase64);
        } else if (asset.uri) {
          onSuccess(asset.uri);
        }
      }
    } catch (err: any) {
      console.warn('Failed to pick image:', err);
      showAlert('Upload Error', err?.message || 'Could not select the chosen image.');
    }
  };

  // 3c. Packages
  const [packages, setPackages] = useState<ServicePackageRecord[]>([]);
  const [pkgModalOpen, setPkgModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<ServicePackageRecord | null>(null);
  const [pCatId, setPCatId] = useState<number>(1);
  const [pCode, setPCode] = useState('');
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pPrice, setPPrice] = useState('15.00');
  const [pDealerPrice, setPDealerPrice] = useState('15.00');
  const [pDuration, setPDuration] = useState('20');
  const [pOrder, setPOrder] = useState('1');
  const [pActive, setPActive] = useState(true);
  const [pFeatures, setPFeatures] = useState('');
  const [packageSortAsc, setPackageSortAsc] = useState<boolean>(true);

  // Vehicle-type pricing rows for the edit/add package modal
  const [pkgVehiclePrices, setPkgVehiclePrices] = useState<VehicleTypePrice[]>([]);
  const [pkgVehiclePricesLoading, setPkgVehiclePricesLoading] = useState(false);
  const [pkgVehiclePricesSaving, setPkgVehiclePricesSaving] = useState(false);
  const [pkgSaving, setPkgSaving] = useState(false);

  // Standalone Vehicle Rates Modal (opened directly from package row)
  const [ratesModalOpen, setRatesModalOpen] = useState(false);
  const [ratesPkg, setRatesPkg] = useState<ServicePackageRecord | null>(null);
  const [ratesList, setRatesList] = useState<VehicleTypePrice[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesSaving, setRatesSaving] = useState(false);

  // 3c2. À La Carte Add-ons
  const [addonsList, setAddonsList] = useState<ServiceAddonRecord[]>([]);
  const [addonModalOpen, setAddonModalOpen] = useState(false);
  const [editingAddon, setEditingAddon] = useState<ServiceAddonRecord | null>(null);
  const [adCode, setAdCode] = useState('');
  const [adName, setAdName] = useState('');
  const [adCategory, setAdCategory] = useState<'EXTERIOR' | 'INTERIOR'>('EXTERIOR');
  const [adCustomerPrice, setAdCustomerPrice] = useState('10.00');
  const [adDealerPrice, setAdDealerPrice] = useState('7.50');
  const [adDesc, setAdDesc] = useState('');
  const [adOrder, setAdOrder] = useState('1');
  const [adActive, setAdActive] = useState(true);
  const [adPackageIds, setAdPackageIds] = useState<number[]>([]);
  const [addonSearch, setAddonSearch] = useState('');
  const [addonCategoryFilter, setAddonCategoryFilter] = useState<'ALL' | 'INTERIOR' | 'EXTERIOR'>('ALL');
  const [addonPackageFilter, setAddonPackageFilter] = useState<string>('ALL');
  const [addonSortAsc, setAddonSortAsc] = useState<boolean>(true);

  // 3d. Bays
  const [bays, setBays] = useState<BayMasterRecord[]>([]);
  const [bayModalOpen, setBayModalOpen] = useState(false);
  const [editingBay, setEditingBay] = useState<BayMasterRecord | null>(null);
  const [bNum, setBNum] = useState('1');
  const [bName, setBName] = useState('');
  const [bType, setBType] = useState('CAR WASH');
  const [bStatus, setBStatus] = useState('AVAILABLE');
  const [bRemarks, setBRemarks] = useState('');

  // 3e. Dealers
  const [dealers, setDealers] = useState<DealerRecord[]>([]);
  const [dealerModalOpen, setDealerModalOpen] = useState(false);
  const [editingDealer, setEditingDealer] = useState<DealerRecord | null>(null);
  const [dCode, setDCode] = useState('');
  const [dName, setDName] = useState('');
  const [dPhone, setDPhone] = useState('');
  const [dContactPerson, setDContactPerson] = useState('');
  const [dAddress, setDAddress] = useState('');
  const [dPin, setDPin] = useState('1234');
  const [dLogo, setDLogo] = useState('');
  const [dActive, setDActive] = useState(true);
  const [dealerSortAsc, setDealerSortAsc] = useState<boolean>(true);
  const [dealerSortField, setDealerSortField] = useState<'code' | 'name'>('code');

  // 3e2. Account Types (AccountTypeMaster)
  const [accountTypesList, setAccountTypesList] = useState<AccountTypeOption[]>([]);
  const [accountTypeModalOpen, setAccountTypeModalOpen] = useState(false);
  const [editingAccountType, setEditingAccountType] = useState<AccountTypeOption | null>(null);
  const [atCode, setAtCode] = useState('');
  const [atName, setAtName] = useState('');
  const [atDesc, setAtDesc] = useState('');
  const [atIcon, setAtIcon] = useState('car-sport');
  const [atOrder, setAtOrder] = useState('1');
  const [atActive, setAtActive] = useState(true);
  const [atImage, setAtImage] = useState('');
  const [savingAccountType, setSavingAccountType] = useState(false);
  const [atModalError, setAtModalError] = useState('');

  // 3e3. Payment Modes (dbo.Paymode)
  const [paymodesList, setPaymodesList] = useState<PaymodeRecord[]>([]);
  const [paymodeModalOpen, setPaymodeModalOpen] = useState(false);
  const [editingPaymode, setEditingPaymode] = useState<PaymodeRecord | null>(null);
  const [pmCode, setPmCode] = useState('');
  const [pmDesc, setPmDesc] = useState('');
  const [pmPosition, setPmPosition] = useState('1');
  const [pmExtraCharges, setPmExtraCharges] = useState('0.00');
  const [pmCommission, setPmCommission] = useState('0.00');
  const [pmServiceCharge, setPmServiceCharge] = useState('0.00');
  const [pmDeviceSN, setPmDeviceSN] = useState('');
  const [pmDeviceSalt, setPmDeviceSalt] = useState('');
  const [pmYeahPayEnabled, setPmYeahPayEnabled] = useState(false);
  const [pmActive, setPmActive] = useState(true);
  const [pmIsVoucher, setPmIsVoucher] = useState(false);
  const [pmIsEntertainment, setPmIsEntertainment] = useState(false);
  const [pmImage, setPmImage] = useState('');
  const [pmSearch, setPmSearch] = useState('');
  const [pmStatusFilter, setPmStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [savingPaymode, setSavingPaymode] = useState(false);
  const [pmModalError, setPmModalError] = useState('');

  // 3e. Company Profile
  const [compSettings, setCompSettings] = useState<CompanySettings | null>(null);
  const [compName, setCompName] = useState('');
  const [compAddr, setCompAddr] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compEmail, setCompEmail] = useState('');
  const [compReportEmail, setCompReportEmail] = useState('');
  const [compGstNo, setCompGstNo] = useState('');
  const [compGstRate, setCompGstRate] = useState('0');
  const [compCurrency, setCompCurrency] = useState('SGD');
  const [compSymbol, setCompSymbol] = useState('$');
  const [savingComp, setSavingComp] = useState(false);

  // 3f. Printers
  const [printersList, setPrintersList] = useState<PrinterConfig[]>([]);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [editingPrn, setEditingPrn] = useState<PrinterConfig | null>(null);
  const [prnName, setPrnName] = useState('');
  const [prnIp, setPrnIp] = useState('');
  const [prnPort, setPrnPort] = useState('9100');
  const [prnType, setPrnType] = useState<number>(1);
  const [prnCopies, setPrnCopies] = useState('1');

  const loadSettingsData = useCallback(async () => {
    try {
      setSettingsLoading(true);
      if (settingsTab === 'VEHICLES') {
        const data = await fetchAllVehicleTypes(true);
        setVehicles(data);
      } else if (settingsTab === 'CATEGORIES') {
        const data = await fetchAllServiceCategories(true);
        setCategories(data);
      } else if (settingsTab === 'PACKAGES') {
        const [pkgs, cats] = await Promise.all([
          fetchAllPackages(undefined, true),
          fetchAllServiceCategories(true),
        ]);
        setPackages(pkgs);
        setCategories(cats);
        if (cats.length > 0 && !pCatId) setPCatId(cats[0].serviceCategoryId);
      } else if (settingsTab === 'ADDONS') {
        const [data, pkgs] = await Promise.all([
          fetchAllAddons(false),
          fetchAllPackages(undefined, true),
        ]);
        setAddonsList(data);
        setPackages(pkgs);
      } else if (settingsTab === 'BAYS') {
        const data = await fetchBayMasterList();
        setBays(data);
      } else if (settingsTab === 'DEALERS') {
        const data = await fetchAllDealers(true);
        setDealers(data);
      } else if (settingsTab === 'ACCOUNT_TYPES') {
        const data = await fetchAccountTypes(true);
        setAccountTypesList(data);
      } else if (settingsTab === 'COMPANY') {
        const data = await fetchCompanySettings();
        if (data) {
          setCompSettings(data);
          setCompName(data.CompanyName || '');
          setCompAddr(data.Address || '');
          setCompPhone(data.Phone || '');
          setCompEmail(data.Email || '');
          setCompReportEmail(data.ReportEmail || '');
          setCompGstNo(data.GSTNo || '');
          setCompGstRate(String(data.GSTPercentage ?? 0));
          setCompCurrency(data.Currency || 'SGD');
          setCompSymbol(data.CurrencySymbol || '$');
        }
      } else if (settingsTab === 'PRINTERS') {
        const data = await fetchPrinters();
        setPrintersList(data);
      }
    } catch (err: any) {
      console.warn('Failed to load settings tab:', err);
    } finally {
      setSettingsLoading(false);
    }
  }, [settingsTab, pCatId]);

  const loadPaymodesData = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const data = await fetchAllPaymodes(true, pmSearch);
      setPaymodesList(data);
    } catch (err: any) {
      console.warn('Failed to load paymodes:', err);
    } finally {
      setSettingsLoading(false);
    }
  }, [pmSearch]);

  useEffect(() => {
    if (activeNav === 'settings') {
      loadSettingsData();
    } else if (activeNav === 'paymodes') {
      loadPaymodesData();
    }
  }, [activeNav, settingsTab, loadSettingsData, loadPaymodesData]);

  // Vehicle Type Save
  const handleSaveVehicleType = async () => {
    if (!vCode.trim() || !vName.trim()) {
      showAlert('Validation Error', 'Vehicle Type Code and Name are required.');
      return;
    }
    const payloadImage =
      vImage === ''
        ? ''
        : vImage && vImage.startsWith('data:')
        ? vImage
        : undefined;

    try {
      if (editingVehicle) {
        await updateVehicleType(editingVehicle.vehicleTypeId, {
          vehicleTypeCode: vCode.trim(),
          vehicleTypeName: vName.trim(),
          description: vDesc.trim(),
          displayOrder: parseInt(vOrder || '1', 10),
          isActive: vActive,
          imageData: payloadImage,
        });

        // Update local state with fresh cache-busting timestamp
        const cacheBuster = Date.now();
        setVehicles((prev) =>
          prev.map((item) =>
            item.vehicleTypeId === editingVehicle.vehicleTypeId
              ? {
                  ...item,
                  vehicleTypeCode: vCode.trim(),
                  vehicleTypeName: vName.trim(),
                  description: vDesc.trim(),
                  displayOrder: parseInt(vOrder || '1', 10),
                  isActive: vActive,
                  imageUrl:
                    payloadImage === ''
                      ? ''
                      : `/api/vehicle-types/${editingVehicle.vehicleTypeId}/image?v=${cacheBuster}`,
                  hasImage: payloadImage === '' ? false : (payloadImage ? true : item.hasImage),
                }
              : item
          )
        );

        showAlert('Success', `Vehicle type "${vName}" updated.`);
      } else {
        await createVehicleType({
          vehicleTypeCode: vCode.trim(),
          vehicleTypeName: vName.trim(),
          description: vDesc.trim(),
          displayOrder: parseInt(vOrder || '1', 10),
          isActive: vActive,
          imageData: payloadImage,
        });
        showAlert('Success', `Vehicle type "${vName}" created.`);
      }
      setVehicleModalOpen(false);
      loadSettingsData();
    } catch (err: any) {
      showAlert('Error', err.message || 'Operation failed');
      loadSettingsData();
    }
  };

  const handleDeleteVehicleType = (id: number) => {
    showConfirm({
      title: 'Delete Vehicle Type',
      message: 'Are you sure you want to permanently delete this vehicle type from database?',
      confirmText: 'Delete Permanently',
      confirmButtonColor: '#EF4444',
      onConfirm: async () => {
        try {
          setVehicles((prev) => prev.filter((v) => v.vehicleTypeId !== id));
          await deleteVehicleType(id);
          showAlert('Success', 'Vehicle type permanently deleted.');
          await loadSettingsData();
        } catch (err: any) {
          showAlert('Error', err.message || 'Failed to delete vehicle type');
          await loadSettingsData();
        }
      },
    });
  };

  const handleToggleVehicleStatus = async (veh: VehicleTypeRecord) => {
    const nextStatus = !veh.isActive;
    setVehicles((prev) =>
      prev.map((v) => (v.vehicleTypeId === veh.vehicleTypeId ? { ...v, isActive: nextStatus } : v))
    );
    try {
      await updateVehicleType(veh.vehicleTypeId, {
        vehicleTypeCode: veh.vehicleTypeCode,
        vehicleTypeName: veh.vehicleTypeName,
        description: veh.description || '',
        displayOrder: veh.displayOrder,
        isActive: nextStatus,
      });
    } catch (err: any) {
      setVehicles((prev) =>
        prev.map((v) => (v.vehicleTypeId === veh.vehicleTypeId ? { ...v, isActive: veh.isActive } : v))
      );
      showAlert('Error', err.message || 'Failed to update vehicle status');
    }
  };

  // Category Save
  const handleSaveCategory = async () => {
    if (!cCode.trim() || !cName.trim()) {
      showAlert('Validation Error', 'Category Code and Name are required.');
      return;
    }
    try {
      const payloadImageData = cImage === '' ? '' : (cImage.startsWith('data:') ? cImage : undefined);
      const payloadIconData = cIcon === '' ? '' : (cIcon.startsWith('data:') ? cIcon : undefined);

      if (editingCategory) {
        await updateServiceCategory(editingCategory.serviceCategoryId, {
          serviceCategoryCode: cCode.trim(),
          categoryName: cName.trim(),
          description: cDesc.trim(),
          displayOrder: parseInt(cOrder || '1', 10),
          isActive: cActive,
          imageData: payloadImageData,
          iconData: payloadIconData,
        });
        showAlert('Success', `Category "${cName}" updated.`);
      } else {
        await createServiceCategory({
          serviceCategoryCode: cCode.trim(),
          categoryName: cName.trim(),
          description: cDesc.trim(),
          displayOrder: parseInt(cOrder || '1', 10),
          isActive: cActive,
          imageData: payloadImageData || undefined,
          iconData: payloadIconData || undefined,
        });
        showAlert('Success', `Category "${cName}" created.`);
      }
      setCategoryModalOpen(false);
      loadSettingsData();
    } catch (err: any) {
      showAlert('Error', err.message || 'Operation failed');
    }
  };

  const handleDeleteCategory = (id: number) => {
    showConfirm({
      title: 'Delete Service Category',
      message: 'Are you sure you want to permanently delete this category from database?',
      confirmText: 'Delete Permanently',
      confirmButtonColor: '#EF4444',
      onConfirm: async () => {
        try {
          setCategories((prev) => prev.filter((c) => c.serviceCategoryId !== id));
          await deleteServiceCategory(id);
          showAlert('Success', 'Category permanently deleted.');
          await loadSettingsData();
        } catch (err: any) {
          showAlert('Error', err.message || 'Failed to delete category');
          await loadSettingsData();
        }
      },
    });
  };

  const handleToggleCategoryStatus = async (cat: ServiceCategoryRecord) => {
    const nextStatus = !cat.isActive;
    setCategories((prev) =>
      prev.map((c) => (c.serviceCategoryId === cat.serviceCategoryId ? { ...c, isActive: nextStatus } : c))
    );
    try {
      await updateServiceCategory(cat.serviceCategoryId, {
        serviceCategoryCode: cat.serviceCategoryCode,
        categoryName: cat.categoryName,
        description: cat.description || '',
        displayOrder: cat.displayOrder,
        isActive: nextStatus,
      });
    } catch (err: any) {
      setCategories((prev) =>
        prev.map((c) => (c.serviceCategoryId === cat.serviceCategoryId ? { ...c, isActive: cat.isActive } : c))
      );
      showAlert('Error', err.message || 'Failed to update category status');
    }
  };

  const handleQuickReorderCategory = async (cat: ServiceCategoryRecord, direction: number) => {
    const currentOrder = cat.displayOrder ?? 1;
    const newOrder = Math.max(1, currentOrder + direction);
    if (newOrder === currentOrder) return;
    try {
      await updateServiceCategory(cat.serviceCategoryId, {
        serviceCategoryCode: cat.serviceCategoryCode,
        categoryName: cat.categoryName,
        description: cat.description || '',
        displayOrder: newOrder,
        isActive: cat.isActive,
      });
      loadSettingsData();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to reorder category');
    }
  };

  const handleQuickReorderVehicle = async (veh: VehicleTypeRecord, direction: number) => {
    const currentOrder = veh.displayOrder ?? 1;
    const newOrder = Math.max(1, currentOrder + direction);
    if (newOrder === currentOrder) return;
    try {
      await updateVehicleType(veh.vehicleTypeId, {
        vehicleTypeCode: veh.vehicleTypeCode,
        vehicleTypeName: veh.vehicleTypeName,
        description: veh.description || '',
        displayOrder: newOrder,
        isActive: veh.isActive,
      });
      loadSettingsData();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to reorder vehicle type');
    }
  };

  const handleQuickReorderPackage = async (pkg: ServicePackageRecord, direction: number) => {
    const currentOrder = pkg.displayOrder ?? 1;
    const newOrder = Math.max(1, currentOrder + direction);
    if (newOrder === currentOrder) return;
    try {
      await updatePackage(pkg.packageId, {
        serviceCategoryId: pkg.serviceCategoryId,
        packageCode: pkg.packageCode,
        packageName: pkg.packageName,
        description: pkg.description || '',
        price: pkg.price,
        dealerPrice: pkg.dealerPrice,
        displayOrder: newOrder,
        isActive: pkg.isActive,
      });
      loadSettingsData();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to reorder package');
    }
  };

  const handleQuickReorderAddon = async (addon: ServiceAddonRecord, direction: number) => {
    const currentOrder = addon.displayOrder ?? 1;
    const newOrder = Math.max(1, currentOrder + direction);
    if (newOrder === currentOrder) return;
    try {
      await updateAddon(addon.addonId, {
        addonCode: addon.addonCode,
        addonName: addon.addonName,
        category: addon.category,
        customerPrice: addon.customerPrice,
        dealerPrice: addon.dealerPrice,
        description: addon.description || '',
        displayOrder: newOrder,
        isActive: addon.isActive,
        packageIds: addon.packageIds,
      });
      loadSettingsData();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to reorder add-on');
    }
  };

  const handleOpenVehicleRates = async (pkg: ServicePackageRecord) => {
    setRatesPkg(pkg);
    setRatesList([]);
    setRatesLoading(true);
    setRatesModalOpen(true);
    try {
      const rows = await fetchVehicleTypePricesForPackage(pkg.packageId);
      setRatesList(rows);
    } catch {
      setRatesList([]);
    } finally {
      setRatesLoading(false);
    }
  };

  // Package Save
  const handleSavePackage = async () => {
    if (!pCode.trim() || !pName.trim()) {
      showAlert('Validation Error', 'Package Code and Name are required.');
      return;
    }
    const cleanPrice = pPrice.replace(/[^0-9.]/g, '');
    if (!cleanPrice || isNaN(parseFloat(cleanPrice))) {
      showAlert('Validation Error', 'Valid Package Price is required.');
      return;
    }
    const parsedPrice = parseFloat(cleanPrice);
    const cleanDealerPrice = pDealerPrice ? pDealerPrice.replace(/[^0-9.]/g, '') : '';
    const parsedDealerPrice = cleanDealerPrice && !isNaN(parseFloat(cleanDealerPrice)) 
      ? parseFloat(cleanDealerPrice) 
      : parsedPrice;

    const catId = pCatId || (categories.length > 0 ? categories[0].serviceCategoryId : 1);

    setPkgSaving(true);
    try {
      const featArray = pFeatures
        .split('\n')
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

      if (editingPkg) {
        await updatePackage(editingPkg.packageId, {
          serviceCategoryId: catId,
          packageCode: pCode.trim(),
          packageName: pName.trim(),
          description: pDesc.trim(),
          price: parsedPrice,
          dealerPrice: parsedDealerPrice,
          gstPercent: 0,
          isTaxInclusive: false,
          durationMinutes: parseInt(pDuration || '20', 10),
          displayOrder: parseInt(pOrder || '1', 10),
          isActive: pActive,
          features: featArray,
        });

        // Also save any edited vehicle-type prices
        if (pkgVehiclePrices.length > 0) {
          try {
            await Promise.all(
              pkgVehiclePrices.map((vp) =>
                updateVehicleTypePrice(
                  editingPkg.packageId,
                  vp.vehicleTypeId,
                  vp.customerPrice,
                  vp.dealerPrice
                )
              )
            );
          } catch (e) {
            console.warn('[handleSavePackage] Vehicle prices auto-save warning:', e);
          }
        }

        showAlert('Success', `Package "${pName}" updated.`);
      } else {
        await createPackage({
          serviceCategoryId: catId,
          packageCode: pCode.trim(),
          packageName: pName.trim(),
          description: pDesc.trim(),
          price: parsedPrice,
          dealerPrice: parsedDealerPrice,
          gstPercent: 0,
          isTaxInclusive: false,
          durationMinutes: parseInt(pDuration || '20', 10),
          displayOrder: parseInt(pOrder || '1', 10),
          isActive: pActive,
          features: featArray,
        });
        showAlert('Success', `Package "${pName}" created.`);
      }
      setPkgModalOpen(false);
      loadSettingsData();
    } catch (err: any) {
      showAlert('Error', err.message || 'Operation failed');
    } finally {
      setPkgSaving(false);
    }
  };

  const handleDeletePackage = (id: number) => {
    showConfirm({
      title: 'Delete Service Package',
      message: 'Are you sure you want to permanently delete this service package?',
      confirmText: 'Delete',
      confirmButtonColor: '#EF4444',
      onConfirm: async () => {
        try {
          // Optimistically remove from state
          setPackages((prev) => prev.filter((p) => p.packageId !== id));
          await deletePackage(id);
          showAlert('Success', 'Package deleted successfully.');
          await loadSettingsData();
        } catch (err: any) {
          showAlert('Error', err.message || 'Failed to delete package');
          await loadSettingsData();
        }
      },
    });
  };

  const handleTogglePackageStatus = async (pkg: ServicePackageRecord) => {
    const nextStatus = !pkg.isActive;
    // Optimistic UI update for snappy and reliable feel
    setPackages((prev) =>
      prev.map((p) => (p.packageId === pkg.packageId ? { ...p, isActive: nextStatus } : p))
    );
    try {
      const updated = await updatePackage(pkg.packageId, { isActive: nextStatus });
      setPackages((prev) =>
        prev.map((p) =>
          p.packageId === pkg.packageId
            ? { ...p, isActive: (updated && updated.isActive !== undefined) ? updated.isActive : nextStatus }
            : p
        )
      );
    } catch (err: any) {
      // Revert if failed
      setPackages((prev) =>
        prev.map((p) => (p.packageId === pkg.packageId ? { ...p, isActive: pkg.isActive } : p))
      );
      showAlert('Error', err.message || 'Failed to update package status');
    }
  };

  // 3c2. À La Carte Add-on Handlers
  const handleSaveAddon = async () => {
    if (!adCode.trim() || !adName.trim()) {
      showAlert('Validation Error', 'Add-on Code and Name are required.');
      return;
    }
    const cleanCustomerPrice = adCustomerPrice.replace(/[^0-9.]/g, '');
    if (!cleanCustomerPrice || isNaN(parseFloat(cleanCustomerPrice))) {
      showAlert('Validation Error', 'Valid Customer Price is required.');
      return;
    }
    const cPrice = parseFloat(cleanCustomerPrice);
    const cleanDealerPrice = adDealerPrice.replace(/[^0-9.]/g, '');
    const dPrice = cleanDealerPrice && !isNaN(parseFloat(cleanDealerPrice)) ? parseFloat(cleanDealerPrice) : cPrice * 0.75;

    try {
      if (editingAddon) {
        await updateAddon(editingAddon.addonId, {
          addonCode: adCode.trim().toUpperCase().replace(/\s+/g, '_'),
          addonName: adName.trim(),
          category: adCategory,
          customerPrice: cPrice,
          dealerPrice: dPrice,
          description: adDesc.trim(),
          displayOrder: parseInt(adOrder || '1', 10),
          isActive: adActive,
          packageIds: adPackageIds,
        });
        showAlert('Success', `Add-on service "${adName}" updated.`);
      } else {
        await createAddon({
          addonCode: adCode.trim().toUpperCase().replace(/\s+/g, '_'),
          addonName: adName.trim(),
          category: adCategory,
          customerPrice: cPrice,
          dealerPrice: dPrice,
          description: adDesc.trim(),
          displayOrder: parseInt(adOrder || '1', 10),
          isActive: adActive,
          packageIds: adPackageIds,
        });
        showAlert('Success', `Add-on service "${adName}" created.`);
      }
      setAddonModalOpen(false);
      loadSettingsData();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to save add-on service.');
    }
  };

  const handleDeleteAddon = (id: number) => {
    showConfirm({
      title: 'Delete À La Carte Service',
      message: 'Are you sure you want to delete this add-on service?',
      confirmText: 'Delete',
      confirmButtonColor: '#EF4444',
      onConfirm: async () => {
        try {
          setAddonsList((prev) => prev.filter((a) => a.addonId !== id));
          await deleteAddon(id);
          showAlert('Success', 'Add-on service deleted.');
          await loadSettingsData();
        } catch (err: any) {
          showAlert('Error', err.message || 'Failed to delete add-on service.');
          await loadSettingsData();
        }
      },
    });
  };

  const handleToggleAddonStatus = async (addon: ServiceAddonRecord) => {
    const nextStatus = !addon.isActive;
    setAddonsList((prev) =>
      prev.map((a) => (a.addonId === addon.addonId ? { ...a, isActive: nextStatus } : a))
    );
    try {
      await updateAddon(addon.addonId, {
        addonCode: addon.addonCode,
        addonName: addon.addonName,
        category: addon.category,
        customerPrice: addon.customerPrice,
        dealerPrice: addon.dealerPrice,
        displayOrder: addon.displayOrder,
        isActive: nextStatus,
      });
    } catch (err: any) {
      setAddonsList((prev) =>
        prev.map((a) => (a.addonId === addon.addonId ? { ...a, isActive: addon.isActive } : a))
      );
      showAlert('Error', err.message || 'Failed to update add-on status');
    }
  };

  const filteredAddons = useMemo(() => {
    return addonsList.filter((addon) => {
      if (addonCategoryFilter !== 'ALL' && addon.category !== addonCategoryFilter) {
        return false;
      }
      if (addonPackageFilter !== 'ALL') {
        const matchPkg =
          addon.packageNames?.some((pn) => pn.toLowerCase().includes(addonPackageFilter.toLowerCase())) ||
          addon.packageCodes?.some((pc) => pc.toLowerCase() === addonPackageFilter.toLowerCase());
        if (!matchPkg) return false;
      }
      if (addonSearch.trim()) {
        const q = addonSearch.trim().toLowerCase();
        const matchName = addon.addonName?.toLowerCase().includes(q);
        const matchCode = addon.addonCode?.toLowerCase().includes(q);
        const matchCat = addon.category?.toLowerCase().includes(q);
        const matchPkg = addon.packageNames?.some((pn) => pn.toLowerCase().includes(q));
        if (!matchName && !matchCode && !matchCat && !matchPkg) {
          return false;
        }
      }
      return true;
    });
  }, [addonsList, addonCategoryFilter, addonPackageFilter, addonSearch]);

  // Bay Save
  const handleSaveBay = async () => {
    if (!bNum || isNaN(parseInt(bNum, 10))) {
      showAlert('Validation Error', 'Valid Bay Number is required.');
      return;
    }
    try {
      if (editingBay) {
        await updateBayMaster(editingBay.bayNumber, {
          bayName: bName.trim() || `BAY ${bNum}`,
          bayType: bType.trim(),
          bayStatus: (bStatus.trim() as any) || 'AVAILABLE',
          remarks: bRemarks.trim(),
        });
        showAlert('Success', `Bay ${bNum} updated.`);
      } else {
        await createBayMaster({
          bayNumber: parseInt(bNum, 10),
          bayName: bName.trim() || `BAY ${bNum}`,
          bayType: bType.trim(),
          bayStatus: (bStatus.trim() as any) || 'AVAILABLE',
          remarks: bRemarks.trim(),
        });
        showAlert('Success', `Bay ${bNum} created in BayMaster.`);
      }
      setBayModalOpen(false);
      loadSettingsData();
    } catch (err: any) {
      showAlert('Error', err.message || 'Operation failed');
    }
  };

  const handleDeleteBay = (bayNum: number) => {
    showConfirm({
      title: 'Deactivate Wash Bay',
      message: `Are you sure you want to deactivate Bay ${bayNum}?`,
      confirmText: 'Deactivate Bay',
      confirmButtonColor: '#EF4444',
      onConfirm: async () => {
        try {
          await deleteBayMaster(bayNum);
          showAlert('Success', `Bay ${bayNum} deactivated in database.`);
          loadSettingsData();
        } catch (err: any) {
          showAlert('Error', err.message || 'Failed to delete bay');
        }
      },
    });
  };

  // Dealer Save
  const handleSaveDealer = async () => {
    if (!dCode.trim()) {
      showAlert('Validation Error', 'Unique Dealer ID/Code is required.');
      return;
    }
    if (!dName.trim()) {
      showAlert('Validation Error', 'Dealer Name is required.');
      return;
    }
    if (!dPhone.trim()) {
      showAlert('Validation Error', 'Contact Number is required.');
      return;
    }
    if (!dAddress.trim()) {
      showAlert('Validation Error', 'Dealer Address is required.');
      return;
    }
    try {
      if (editingDealer) {
        await updateDealer(editingDealer.dealerId, {
          uniqueCode: dCode.trim().toUpperCase(),
          dealerName: dName.trim(),
          contactNumber: dPhone.trim(),
          contactPerson: dContactPerson.trim(),
          address: dAddress.trim(),
          securityPin: dPin.trim() || '1234',
          logoUrl: dLogo,
          isActive: dActive,
        });
        showAlert('Success', `Dealer "${dName}" updated successfully.`);
      } else {
        await createDealer({
          uniqueCode: dCode.trim().toUpperCase(),
          dealerName: dName.trim(),
          contactNumber: dPhone.trim(),
          contactPerson: dContactPerson.trim(),
          address: dAddress.trim(),
          securityPin: dPin.trim() || '1234',
          logoUrl: dLogo,
          isActive: dActive,
        });
        showAlert('Success', `Dealer "${dName}" created with Unique ID "${dCode.trim().toUpperCase()}".`);
      }
      setDealerModalOpen(false);
      loadSettingsData();
    } catch (err: any) {
      showAlert('Error', err.message || 'Operation failed');
    }
  };

  const handleDeleteDealer = (id: number | string) => {
    showConfirm({
      title: 'Delete Dealer Account',
      message: 'Are you sure you want to permanently delete this commercial dealer account?',
      confirmText: 'Delete Permanently',
      confirmButtonColor: '#EF4444',
      onConfirm: async () => {
        try {
          setDealers((prev) => prev.filter((item) => (item.dealerId || item.uniqueCode) !== id));
          await deleteDealer(id);
          showAlert('Success', 'Dealer account deleted.');
          loadSettingsData();
        } catch (err: any) {
          showAlert('Error', err.message || 'Failed to delete dealer');
          loadSettingsData();
        }
      },
    });
  };

  const handleToggleDealerStatus = async (dealer: DealerRecord) => {
    const nextStatus = !dealer.isActive;
    const dId = dealer.dealerId || dealer.uniqueCode;
    // Optimistic UI update
    setDealers((prev) =>
      prev.map((d) => ((d.dealerId || d.uniqueCode) === dId ? { ...d, isActive: nextStatus } : d))
    );
    try {
      await updateDealer(dId, { isActive: nextStatus });
    } catch (err: any) {
      setDealers((prev) =>
        prev.map((d) => ((d.dealerId || d.uniqueCode) === dId ? { ...d, isActive: dealer.isActive } : d))
      );
      showAlert('Error', err.message || 'Failed to update dealer status');
    }
  };

  // Account Type Save & Delete
  const handleSaveAccountType = async () => {
    setAtModalError('');
    if (!atCode.trim()) {
      setAtModalError('Account Type Code is required (e.g. CUSTOMER, DEALER).');
      return;
    }
    if (!atName.trim()) {
      setAtModalError('Display Name is required.');
      return;
    }
    try {
      setSavingAccountType(true);
      if (editingAccountType) {
        await updateAccountType(editingAccountType.accountTypeId, {
          typeCode: atCode.trim().toUpperCase(),
          typeName: atName.trim(),
          description: atDesc.trim(),
          iconName: atIcon.trim() || undefined,
          displayOrder: parseInt(atOrder || '1', 10),
          isActive: atActive,
          imageData: atImage || undefined,
        });
        showAlert('Success', `Account type "${atName}" updated successfully.`);
      } else {
        await createAccountType({
          typeCode: atCode.trim().toUpperCase(),
          typeName: atName.trim(),
          description: atDesc.trim(),
          iconName: atIcon.trim() || undefined,
          displayOrder: parseInt(atOrder || '1', 10),
          isActive: atActive,
          imageData: atImage || undefined,
        });
        showAlert('Success', `Account type "${atName}" created successfully.`);
      }
      setAccountTypeModalOpen(false);
      loadSettingsData();
    } catch (err: any) {
      console.error('[handleSaveAccountType Error]', err);
      const errMsg = err.message || 'Failed to save account type.';
      setAtModalError(errMsg);
      showAlert('Save Failed', errMsg);
    } finally {
      setSavingAccountType(false);
    }
  };

  const handleDeleteAccountType = (id: number, name: string) => {
    showConfirm({
      title: 'Delete Account Type',
      message: `Are you sure you want to permanently delete "${name}" from kiosk account types?`,
      confirmText: 'Delete Permanently',
      confirmButtonColor: '#EF4444',
      onConfirm: async () => {
        try {
          await deleteAccountType(id, true);
          showAlert('Success', `Account type "${name}" permanently deleted.`);
          loadSettingsData();
        } catch (err: any) {
          showAlert('Error', err.message || 'Failed to delete account type');
        }
      },
    });
  };

  // ── Paymode Handlers ──
  const openAddPaymodeModal = () => {
    setEditingPaymode(null);
    setPmCode('');
    setPmDesc('');
    setPmPosition(String((paymodesList.length || 0) + 1));
    setPmExtraCharges('0.00');
    setPmCommission('0.00');
    setPmServiceCharge('0.00');
    setPmDeviceSN('');
    setPmDeviceSalt('');
    setPmYeahPayEnabled(false);
    setPmActive(true);
    setPmIsVoucher(false);
    setPmIsEntertainment(false);
    setPmImage('');
    setPmModalError('');
    setPaymodeModalOpen(true);
  };

  const openEditPaymodeModal = (pm: PaymodeRecord) => {
    setEditingPaymode(pm);
    setPmCode(pm.payMode);
    setPmDesc(pm.description || '');
    setPmPosition(String(pm.position ?? 1));
    setPmExtraCharges(pm.extraCharges != null ? Number(pm.extraCharges).toFixed(2) : '0.00');
    setPmCommission(pm.commission != null ? Number(pm.commission).toFixed(2) : '0.00');
    setPmServiceCharge(pm.serviceCharge != null ? Number(pm.serviceCharge).toFixed(2) : '0.00');
    setPmDeviceSN(pm.deviceSN || '');
    setPmDeviceSalt(pm.deviceSalt || '');
    setPmYeahPayEnabled(Boolean(pm.yeahPayEnabled));
    setPmActive(pm.active);
    setPmIsVoucher(Boolean(pm.isVoucher));
    setPmIsEntertainment(Boolean(pm.isEntertainment));
    setPmImage(pm.paymodeImage || '');
    setPmModalError('');
    setPaymodeModalOpen(true);
  };

  const handleSavePaymode = async () => {
    if (!pmCode.trim()) {
      setPmModalError('PayMode code is required (e.g. CASH, NETS, PAYNOW).');
      return;
    }
    if (pmCode.trim().length > 10) {
      setPmModalError('PayMode code cannot exceed 10 characters.');
      return;
    }
    if (!pmDesc.trim()) {
      setPmModalError('Description is required.');
      return;
    }
    if (pmDesc.trim().length > 50) {
      setPmModalError('Description cannot exceed 50 characters.');
      return;
    }

    try {
      setSavingPaymode(true);
      setPmModalError('');

      const parsedPos = parseInt(pmPosition || '1', 10);
      const parsedExtra = parseFloat(pmExtraCharges || '0');
      const parsedComm = parseFloat(pmCommission || '0');
      const parsedService = parseFloat(pmServiceCharge || '0');

      if (editingPaymode) {
        await updatePaymode(editingPaymode.payMode, {
          newPayMode: pmCode.trim().toUpperCase(),
          description: pmDesc.trim(),
          position: isNaN(parsedPos) ? 1 : parsedPos,
          extraCharges: isNaN(parsedExtra) ? 0 : parsedExtra,
          commission: isNaN(parsedComm) ? 0 : parsedComm,
          serviceCharge: isNaN(parsedService) ? 0 : parsedService,
          deviceSN: pmDeviceSN.trim() || undefined,
          deviceSalt: pmDeviceSalt.trim() || undefined,
          yeahPayEnabled: pmYeahPayEnabled,
          active: pmActive,
          isVoucher: pmIsVoucher,
          isEntertainment: pmIsEntertainment,
          paymodeImage: pmImage.trim() || null,
        });
        showAlert('Success', `Payment mode "${pmCode.trim().toUpperCase()}" updated successfully.`);
      } else {
        await createPaymode({
          payMode: pmCode.trim().toUpperCase(),
          description: pmDesc.trim(),
          position: isNaN(parsedPos) ? 1 : parsedPos,
          extraCharges: isNaN(parsedExtra) ? 0 : parsedExtra,
          commission: isNaN(parsedComm) ? 0 : parsedComm,
          serviceCharge: isNaN(parsedService) ? 0 : parsedService,
          deviceSN: pmDeviceSN.trim() || undefined,
          deviceSalt: pmDeviceSalt.trim() || undefined,
          yeahPayEnabled: pmYeahPayEnabled,
          active: pmActive,
          isVoucher: pmIsVoucher,
          isEntertainment: pmIsEntertainment,
          paymodeImage: pmImage.trim() || null,
        });
        showAlert('Success', `Payment mode "${pmCode.trim().toUpperCase()}" created successfully.`);
      }
      setPaymodeModalOpen(false);
      loadPaymodesData();
    } catch (err: any) {
      console.error('[handleSavePaymode Error]', err);
      const errMsg = err.message || 'Failed to save payment mode.';
      setPmModalError(errMsg);
      showAlert('Save Failed', errMsg);
    } finally {
      setSavingPaymode(false);
    }
  };

  const handleTogglePaymodeActive = async (pm: PaymodeRecord) => {
    try {
      const nextActive = !pm.active;
      await togglePaymodeActive(pm.payMode, nextActive);
      setPaymodesList((prev) =>
        prev.map((item) => (item.payMode === pm.payMode ? { ...item, active: nextActive, isActive: nextActive } : item))
      );
      showAlert(
        'Status Updated',
        `Payment mode "${pm.payMode}" is now ${nextActive ? 'Active (Visible)' : 'Inactive (Hidden)'}.`
      );
    } catch (err: any) {
      showAlert('Status Update Failed', err.message || 'Failed to update payment mode status');
    }
  };

  const handleDeletePaymode = (pm: PaymodeRecord) => {
    showConfirm({
      title: 'Delete Payment Mode',
      message: `Are you sure you want to delete "${pm.payMode}" (${pm.description}) from dbo.Paymode?`,
      confirmText: 'Delete Permanently',
      confirmButtonColor: '#EF4444',
      onConfirm: async () => {
        try {
          await deletePaymode(pm.payMode);
          showAlert('Success', `Payment mode "${pm.payMode}" deleted successfully.`);
          loadPaymodesData();
        } catch (err: any) {
          if (err.isUsedInOrders) {
            showConfirm({
              title: 'Tender In Use',
              message: `${err.message}\n\nWould you like to deactivate "${pm.payMode}" instead so it is hidden without breaking existing records?`,
              confirmText: 'Deactivate Mode',
              confirmButtonColor: '#F59E0B',
              onConfirm: async () => {
                try {
                  await togglePaymodeActive(pm.payMode, false);
                  showAlert('Deactivated', `Payment mode "${pm.payMode}" has been deactivated.`);
                  loadPaymodesData();
                } catch (deactErr: any) {
                  showAlert('Error', deactErr.message || 'Failed to deactivate.');
                }
              },
            });
          } else {
            showAlert('Delete Failed', err.message || 'Failed to delete payment mode');
          }
        }
      },
    });
  };

  const filteredPaymodes = useMemo(() => {
    return paymodesList.filter((pm) => {
      if (pmStatusFilter === 'ACTIVE' && !pm.active) return false;
      if (pmStatusFilter === 'INACTIVE' && pm.active) return false;
      if (pmSearch && pmSearch.trim()) {
        const query = pmSearch.toLowerCase().trim();
        const code = (pm.payMode || '').toLowerCase();
        const desc = (pm.description || '').toLowerCase();
        return code.includes(query) || desc.includes(query);
      }
      return true;
    });
  }, [paymodesList, pmStatusFilter, pmSearch]);

  // Company Settings Save
  const handleSaveCompanyProfile = async () => {
    try {
      setSavingComp(true);
      await updateCompanySettings({
        CompanyName: compName.trim(),
        Address: compAddr.trim(),
        Phone: compPhone.trim(),
        Email: compEmail.trim(),
        ReportEmail: compReportEmail.trim(),
        GSTNo: compGstNo.trim(),
        GSTPercentage: parseFloat(compGstRate || '0'),
        Currency: compCurrency.trim(),
        CurrencySymbol: compSymbol.trim(),
      });
      showAlert('Success', 'Station Profile & Company Settings saved in database.');
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to save settings');
    } finally {
      setSavingComp(false);
    }
  };

  // Printer Save & Test
  const handleSavePrinter = async () => {
    if (!prnName.trim() || !prnIp.trim()) {
      showAlert('Validation Error', 'Printer Name and IP are required.');
      return;
    }
    try {
      const payload: Partial<PrinterConfig> = {
        printerName: prnName.trim(),
        printerIP: prnIp.trim(),
        printerPort: parseInt(prnPort || '9100', 10),
        printerPath: prnIp.trim(),
        printerType: prnType,
        printCopy: parseInt(prnCopies || '1', 10),
        isActive: true,
        isEnabled: true,
      };

      if (editingPrn) {
        await updatePrinter(editingPrn.printerId, payload);
        showAlert('Success', 'Printer updated.');
      } else {
        await createPrinter(payload);
        showAlert('Success', 'Printer created in PrintMaster.');
      }
      setPrinterModalOpen(false);
      loadSettingsData();
    } catch (err: any) {
      showAlert('Error', err.message || 'Operation failed');
    }
  };

  const handleTestPrinter = async (p: PrinterConfig) => {
    try {
      showAlert('Testing', `Sending test page to ${p.printerName} (${p.printerIP}:${p.printerPort})...`);
      const res = await testPrinter(p.printerId, p.printerIP, p.printerPort, p.printerName);
      if (res.success) {
        showAlert('Printer Online', `Successfully connected to ${p.printerName}! Test print sent.`);
      } else {
        showAlert('Printer Test', res.message || 'Printer response received.');
      }
    } catch (err: any) {
      showAlert('Printer Error', err.message || 'Failed to reach printer');
    }
  };

  const handleDeletePrinter = (id: string) => {
    showConfirm({
      title: 'Delete Printer Configuration',
      message: 'Are you sure you want to permanently delete this printer configuration?',
      confirmText: 'Delete Printer',
      confirmButtonColor: '#EF4444',
      onConfirm: async () => {
        try {
          await deletePrinter(id);
          showAlert('Success', 'Printer deleted.');
          loadSettingsData();
        } catch (err: any) {
          showAlert('Error', err.message || 'Failed to delete printer');
        }
      },
    });
  };

  /* ═══════════════════════════════════════════════════════════════
     4. AUDIT LOGS STATE
  ═══════════════════════════════════════════════════════════════ */
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');

  const loadAuditLogs = useCallback(async () => {
    try {
      setAuditLoading(true);
      const data = await fetchAuditLogs({
        search: auditSearch.trim() || undefined,
        startDate: auditStartDate || undefined,
        endDate: auditEndDate || undefined,
        limit: 150,
      });
      setAuditLogs(data);
    } catch (err: any) {
      console.warn('Failed to load audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  }, [auditSearch, auditStartDate, auditEndDate]);

  useEffect(() => {
    if (activeNav === 'audit') {
      loadAuditLogs();
    }
  }, [activeNav, loadAuditLogs]);

  /* ═══════════════════════════════════════════════════════════════
     5. KIOSK ALERTS STATE
  ═══════════════════════════════════════════════════════════════ */
  const [kioskAlerts, setKioskAlerts] = useState<HelpRequestItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  const loadKioskAlerts = useCallback(async () => {
    try {
      setAlertsLoading(true);
      const data = await fetchActiveHelpRequests();
      setKioskAlerts(data);
    } catch (err: any) {
      console.warn('Failed to load alerts:', err);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeNav === 'alerts') {
      loadKioskAlerts();
    }
  }, [activeNav, loadKioskAlerts]);

  const handleResolveAlert = async (id: string) => {
    try {
      await resolveHelpRequest(id);
      loadKioskAlerts();
      showAlert('Alert Resolved', `Request #${id} marked as resolved.`);
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to resolve alert');
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     6. NAVIGATION HELPER
  ═══════════════════════════════════════════════════════════════ */
  const navigateTo = (id: NavId) => {
    setActiveNav(id);
    if (!isWide) setSidebarOpen(false);
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER SUB-PANELS
  ═══════════════════════════════════════════════════════════════ */

  /* ── 1. Dashboard View ── */
  const renderDashboard = () => (
    <ScrollView style={styles.scrollPane} contentContainerStyle={styles.scrollPad} keyboardShouldPersistTaps="handled">
      {/* Hero Banner */}
      <View style={styles.heroBanner}>
        <View style={styles.heroInner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Backoffice Operations</Text>
            <Text style={styles.heroSub}>
              Real-time synchronization with CarWashOrder, BayMaster, and SQL Server tables.
            </Text>
          </View>
          <View style={styles.heroRightIcon}>
            <Ionicons name="shield-checkmark" size={36} color={C.white} />
          </View>
        </View>
      </View>

      {/* Sales Period & Date Filter Card */}
      <View style={styles.dateFilterCard}>
        {/* Top Header Row */}
        <View style={styles.dateFilterTopRow}>
          <View style={styles.dateFilterMeta}>
            <View style={styles.dateFilterIconBox}>
              <Ionicons name="calendar-outline" size={17} color={C.accent} />
            </View>
            <View>
              <Text style={styles.dateFilterTitle}>SALES DATE FILTER</Text>
              <Text style={styles.dateFilterSub}>
                Viewing sales for:{' '}
                <Text style={{ color: C.accent, fontWeight: '800' }}>{getPeriodDisplayLabel()}</Text>
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.dateFilterRefreshBtn}
            onPress={() => loadDashboardData()}
          >
            {dashLoading ? (
              <ActivityIndicator size="small" color={C.white} />
            ) : (
              <>
                <Ionicons name="refresh" size={14} color={C.white} />
                <Text style={styles.dateFilterRefreshText}>Refresh Data</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Divider Line */}
        <View style={styles.dateFilterDivider} />

        {/* Toolbar Row: Presets on Left, Date Controls on Right */}
        <View style={styles.dateFilterToolbarRow}>
          {/* Quick Preset Pills: Daily, Weekly, Monthly, Yearly */}
          <View style={styles.datePresetRow}>
            {[
              { id: 'DAILY', label: 'Daily' },
              { id: 'WEEKLY', label: 'Weekly' },
              { id: 'MONTHLY', label: 'Monthly' },
              { id: 'YEARLY', label: 'Yearly' },
            ].map((p) => {
              const active = salesPeriodMode === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.datePresetPill, active && styles.datePresetPillActive]}
                  onPress={() => handleSelectPeriodMode(p.id as SalesPeriodMode)}
                >
                  <Text style={[styles.datePresetPillText, active && styles.datePresetPillTextActive]}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Date Controls: Daily shows Prev/Next/Date picker; Weekly, Monthly, Yearly shows FROM & TO */}
          {salesPeriodMode === 'DAILY' ? (
            <View style={styles.dateControlRow}>
              <Pressable
                style={styles.dateStepBtn}
                onPress={handleStepPrevDay}
              >
                <Ionicons name="chevron-back" size={15} color={C.white} />
                <Text style={styles.dateStepBtnText}>Prev Day</Text>
              </Pressable>

              <View style={styles.dateInputWrapper}>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    max={getTodayISO()}
                    value={salesStartDate}
                    onChange={(e) => {
                      if (e.target.value) handleStartDateChange(e.target.value);
                    }}
                    style={webDashboardDateInputStyle}
                  />
                ) : (
                  <TextInput
                    style={styles.dateNativeInput}
                    value={salesStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={C.textMuted}
                    onChangeText={handleStartDateChange}
                  />
                )}
              </View>

              <Pressable
                style={[styles.dateStepBtn, salesStartDate >= getTodayISO() && styles.dateStepBtnDisabled]}
                onPress={handleStepNextDay}
                disabled={salesStartDate >= getTodayISO()}
              >
                <Text style={[styles.dateStepBtnText, salesStartDate >= getTodayISO() && { color: C.textMuted }]}>
                  Next Day
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={15}
                  color={salesStartDate >= getTodayISO() ? C.textMuted : C.white}
                />
              </Pressable>
            </View>
          ) : (
            <View style={styles.dateRangeControlRow}>
              {/* FROM DATE */}
              <View style={styles.rangeInputGroup}>
                <Text style={styles.rangeLabel}>FROM</Text>
                <View style={styles.dateInputWrapper}>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={salesStartDate}
                      onChange={(e) => {
                        if (e.target.value) handleStartDateChange(e.target.value);
                      }}
                      style={webDashboardDateInputStyle}
                    />
                  ) : (
                    <TextInput
                      style={styles.dateNativeInput}
                      value={salesStartDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={C.textMuted}
                      onChangeText={handleStartDateChange}
                    />
                  )}
                </View>
              </View>

              {/* ARROW */}
              <View style={styles.rangeArrow}>
                <Ionicons name="arrow-forward" size={14} color={C.accent} />
              </View>

              {/* TO DATE */}
              <View style={styles.rangeInputGroup}>
                <Text style={styles.rangeLabel}>TO</Text>
                <View style={styles.dateInputWrapper}>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={salesEndDate}
                      onChange={(e) => {
                        if (e.target.value) handleEndDateChange(e.target.value);
                      }}
                      style={webDashboardDateInputStyle}
                    />
                  ) : (
                    <TextInput
                      style={styles.dateNativeInput}
                      value={salesEndDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={C.textMuted}
                      onChangeText={handleEndDateChange}
                    />
                  )}
                </View>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* KPI Cards */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>
          PERFORMANCE METRICS ({getKpiPeriodLabel().toUpperCase()})
        </Text>
        {dashLoading && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ActivityIndicator size="small" color={C.accent} />
            <Text style={{ color: C.textSec, fontSize: 11 }}>Loading sales data...</Text>
          </View>
        )}
      </View>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Ionicons name="water-outline" size={20} color={C.accent} />
          <Text style={styles.kpiVal}>{washesCompletedCount}</Text>
          <Text style={styles.kpiLabel}>Washes Completed</Text>
          <Text style={styles.kpiSub}>{getKpiPeriodLabel()} completed cars</Text>
        </View>

        <View style={styles.kpiCard}>
          <Ionicons name="cash-outline" size={20} color="#22C55E" />
          <Text style={styles.kpiVal}>${(summaryData?.totalRevenue ?? 0).toFixed(2)}</Text>
          <Text style={styles.kpiLabel}>Revenue ({getKpiPeriodLabel()})</Text>
          <Text style={styles.kpiSub}>Total Gross Sales</Text>
        </View>

        <View style={styles.kpiCard}>
          <Ionicons name="people-outline" size={20} color="#3B82F6" />
          <Text style={styles.kpiVal}>{totalStaffCount}</Text>
          <Text style={styles.kpiLabel}>Active Staff</Text>
          <Text style={styles.kpiSub}>UserMaster active accounts</Text>
        </View>

        <View style={styles.kpiCard}>
          <Ionicons name="business-outline" size={20} color="#F59E0B" />
          <Text style={styles.kpiVal}>
            {liveBays.filter((b) => b.bayStatus !== 'MAINTENANCE').length} / {liveBays.length || 5}
          </Text>
          <Text style={styles.kpiLabel}>Bays Online</Text>
          <Text style={styles.kpiSub}>Operational bays</Text>
        </View>

        <View style={styles.kpiCard}>
          <Ionicons name="hourglass-outline" size={20} color="#8B5CF6" />
          <Text style={styles.kpiVal}>{summaryData?.totalActiveWashes ?? '0'}</Text>
          <Text style={styles.kpiLabel}>In-Service / Queue</Text>
          <Text style={styles.kpiSub}>Active wash orders</Text>
        </View>

        <View style={styles.kpiCard}>
          <Ionicons name="speedometer-outline" size={20} color="#EC4899" />
          <Text style={styles.kpiVal}>
            {summaryData?.avgWashDurationMinutes ? `${summaryData.avgWashDurationMinutes}m` : '18m'}
          </Text>
          <Text style={styles.kpiLabel}>Avg Wash Duration</Text>
          <Text style={styles.kpiSub}>Turnaround time</Text>
        </View>
      </View>

      {/* Analytics Snapshot */}
      <View style={styles.chartAndPaymentRow}>
        <View style={[styles.glassCard, { flex: 2 }]}>
          <View style={styles.glassCardHeader}>
            <View>
              <Text style={styles.cardHeading}>Wash Volume Trend</Text>
              <Text style={styles.cardSubhead}>{getPeriodDisplayLabel()}</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.barsScrollContent,
              computedWashTrends.length <= 12 && { flex: 1, justifyContent: 'space-around' },
            ]}
          >
            {(() => {
              const maxCount = Math.max(...computedWashTrends.map((i) => i.count), 1);
              return computedWashTrends.map((t) => {
                const isZero = t.count === 0;
                const barHeight = isZero ? 4 : Math.max(14, Math.round((t.count / maxCount) * 85));
                return (
                  <View key={t.key} style={[styles.barItem, computedWashTrends.length > 12 && styles.barItemCompact]}>
                    <Text style={[styles.barTopVal, !isZero && styles.barTopValActive]}>
                      {t.count}
                    </Text>
                    <View
                      style={[
                        styles.barVisual,
                        isZero ? styles.barVisualZero : { height: barHeight },
                      ]}
                    />
                    <Text style={[styles.barBottomLabel, !isZero && { color: C.white }]}>
                      {t.label}
                    </Text>
                    <Text style={styles.barSubDateLabel}>{t.subLabel}</Text>
                  </View>
                );
              });
            })()}
          </ScrollView>
        </View>

        <View style={[styles.glassCard, { flex: 1 }]}>
          <Text style={styles.cardHeading}>Payment Channels</Text>
          <Text style={styles.cardSubhead}>{getPeriodDisplayLabel()}</Text>
          <View style={{ marginTop: 14, gap: 10 }}>
            {(paymentChannels.length > 0 ? paymentChannels : [
              { paymentChannelName: 'Cash', revenuePercentage: 45, totalAmount: 450 },
              { paymentChannelName: 'Credit Card', revenuePercentage: 35, totalAmount: 350 },
              { paymentChannelName: 'PayNow', revenuePercentage: 20, totalAmount: 200 },
            ]).map((pm, i) => (
              <View key={i}>
                <View style={styles.flexRowBetween}>
                  <Text style={styles.textWhite}>{pm.paymentChannelName || 'Other'}</Text>
                  <Text style={styles.textAccent}>{pm.revenuePercentage}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressBar, { width: `${pm.revenuePercentage}%` }]} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );

  /* ── 2. User Management View ── */
  const renderUsers = () => (
    <ScrollView style={styles.scrollPane} contentContainerStyle={styles.scrollPad} keyboardShouldPersistTaps="handled">
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.screenTitle}>User Management</Text>
          <Text style={styles.screenSub}>Manage staff credentials, access levels and active accounts in UserMaster</Text>
        </View>
        <Pressable style={styles.btnPrimary} onPress={handleOpenAddUser}>
          <Ionicons name="person-add-outline" size={16} color={C.white} />
          <Text style={styles.btnPrimaryText}>Add New User</Text>
        </Pressable>
      </View>

      {/* Sub Tabs: User Management vs User Group Master */}
      <View style={styles.subTabsRow}>
        <Pressable
          style={[styles.subTabPill, activeNav === 'users' && styles.subTabPillActive, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
          onPress={() => navigateTo('users')}
        >
          <Ionicons name="people-outline" size={15} color={activeNav === 'users' ? C.white : C.textSec} />
          <Text style={[styles.subTabPillText, activeNav === 'users' && styles.subTabPillTextActive]}>
            User Management ({users.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.subTabPill, activeNav === 'user-groups' && styles.subTabPillActive, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
          onPress={() => navigateTo('user-groups')}
        >
          <Ionicons name="shield-checkmark-outline" size={15} color={activeNav === 'user-groups' ? C.white : C.textSec} />
          <Text style={[styles.subTabPillText, activeNav === 'user-groups' && styles.subTabPillTextActive]}>
            User Group Master ({userGroups.length})
          </Text>
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={C.textSec} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by User Code, Name or Full Name..."
          placeholderTextColor={C.textMuted}
          value={userSearch}
          onChangeText={(txt) => {
            setUserSearch(txt);
            loadUsersList(txt);
          }}
        />
        {userSearch.length > 0 && (
          <Pressable onPress={() => { setUserSearch(''); loadUsersList(''); }}>
            <Ionicons name="close-circle" size={16} color={C.textSec} />
          </Pressable>
        )}
      </View>

      {/* Table */}
      <View style={styles.glassCard}>
        {usersLoading ? (
          <ActivityIndicator size="large" color={C.accent} style={{ padding: 40 }} />
        ) : (
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 1.2 }]}>USER CODE</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>LOGIN ID</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>FULL NAME</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>ROLE / GROUP</Text>
              <Text style={[styles.th, { flex: 1 }]}>STATUS</Text>
              <Text style={[styles.th, { flex: 1 }]}>ACTIONS</Text>
            </View>

            {users.length === 0 ? (
              <Text style={styles.emptyText}>No users found in database.</Text>
            ) : (
              users.map((u) => (
                <View key={u.userId} style={styles.tableRow}>
                  <Text style={[styles.td, styles.textAccent, { flex: 1.2, fontWeight: '700' }]}>{u.userCode}</Text>
                  <Text style={[styles.td, styles.textWhite, { flex: 1.2, fontWeight: '700' }]}>{u.userName}</Text>
                  <Text style={[styles.td, styles.textSec, { flex: 1.5 }]}>{u.fullName || '-'}</Text>
                  <View style={{ flex: 1.2 }}>
                    <View style={styles.roleChip}>
                      <Text style={styles.roleChipText}>{u.userGroupName || 'User'}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={[styles.statusBadge, u.isDisabled ? styles.statusBadgeOff : styles.statusBadgeOn]}>
                      <Text style={[styles.statusBadgeText, u.isDisabled ? { color: '#EF4444' } : { color: '#22C55E' }]}>
                        {u.isDisabled ? 'Disabled' : 'Active'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.actionRow, { flex: 1 }]}>
                    <TouchableOpacity
                      style={styles.btnAction}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => handleOpenEditUser(u)}
                    >
                      <Ionicons name="create-outline" size={16} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnAction}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => handleDeleteUser(u)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </View>

      {/* Add / Edit User Modal */}
      <Modal visible={userModalOpen} transparent animationType="fade" onRequestClose={() => setUserModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingUser ? 'Edit User Account' : 'Create New User'}</Text>
              <Pressable onPress={() => setUserModalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={C.textSec} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScrollBody}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>USER CODE</Text>
                <TextInput
                  style={[styles.fieldInput, editingUser && { opacity: 0.6 }]}
                  value={uCode}
                  onChangeText={setUCode}
                  editable={!editingUser}
                  placeholder="e.g. USR001"
                  placeholderTextColor={C.textMuted}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>LOGIN USER NAME *</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={uName}
                  onChangeText={setUName}
                  placeholder="Username or Staff ID"
                  placeholderTextColor={C.textMuted}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>FULL NAME</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={uFullName}
                  onChangeText={setUFullName}
                  placeholder="Staff Full Legal Name"
                  placeholderTextColor={C.textMuted}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>
                  {editingUser ? 'NEW PASSWORD (leave blank to keep current)' : 'PASSWORD *'}
                </Text>
                <TextInput
                  style={styles.fieldInput}
                  value={uPassword}
                  onChangeText={setUPassword}
                  placeholder="Enter password"
                  placeholderTextColor={C.textMuted}
                  secureTextEntry
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>USER GROUP / ROLE</Text>
                <View style={styles.groupPickerRow}>
                  {userGroups.map((g) => (
                    <Pressable
                      key={g.userGroupId}
                      style={[styles.groupPill, uGroupId === g.userGroupId && styles.groupPillActive]}
                      onPress={() => setUGroupId(g.userGroupId)}
                    >
                      <Text style={[styles.groupPillText, uGroupId === g.userGroupId && { color: C.white, fontWeight: '700' }]}>
                        {g.userGroupName}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {editingUser && (
                <View style={[styles.flexRowBetween, { marginTop: 10 }]}>
                  <Text style={styles.fieldLabel}>ACCOUNT STATUS</Text>
                  <Pressable
                    style={[styles.statusBadge, uDisabled ? styles.statusBadgeOff : styles.statusBadgeOn]}
                    onPress={() => setUDisabled(!uDisabled)}
                  >
                    <Text style={[styles.statusBadgeText, uDisabled ? { color: '#EF4444' } : { color: '#22C55E' }]}>
                      {uDisabled ? 'Disabled' : 'Active'} (Click to toggle)
                    </Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.btnSecondary} onPress={() => setUserModalOpen(false)}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnPrimary} onPress={handleSaveUser} disabled={savingUser}>
                {savingUser ? (
                  <ActivityIndicator color={C.white} />
                ) : (
                  <Text style={styles.btnPrimaryText}>{editingUser ? 'Save Changes' : 'Create User'}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );

  /* ── 2b. User Group Master View ── */
  const renderUserGroups = () => (
    <ScrollView style={styles.scrollPane} contentContainerStyle={styles.scrollPad} keyboardShouldPersistTaps="handled">
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.screenTitle}>User Group Master</Text>
          <Text style={styles.screenSub}>Manage access roles, security profiles and permissions in UserGroupMaster</Text>
        </View>
        <Pressable style={styles.btnPrimary} onPress={handleOpenAddGroup}>
          <Ionicons name="add-circle-outline" size={16} color={C.white} />
          <Text style={styles.btnPrimaryText}>Add New User Group</Text>
        </Pressable>
      </View>

      {/* Sub Tabs: User Management vs User Group Master */}
      <View style={styles.subTabsRow}>
        <Pressable
          style={[styles.subTabPill, activeNav === 'users' && styles.subTabPillActive, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
          onPress={() => navigateTo('users')}
        >
          <Ionicons name="people-outline" size={15} color={activeNav === 'users' ? C.white : C.textSec} />
          <Text style={[styles.subTabPillText, activeNav === 'users' && styles.subTabPillTextActive]}>
            User Management ({users.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.subTabPill, activeNav === 'user-groups' && styles.subTabPillActive, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
          onPress={() => navigateTo('user-groups')}
        >
          <Ionicons name="shield-checkmark-outline" size={15} color={activeNav === 'user-groups' ? C.white : C.textSec} />
          <Text style={[styles.subTabPillText, activeNav === 'user-groups' && styles.subTabPillTextActive]}>
            User Group Master ({userGroups.length})
          </Text>
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={C.textSec} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Group Code or Group Name..."
          placeholderTextColor={C.textMuted}
          value={groupSearch}
          onChangeText={setGroupSearch}
        />
        {groupSearch.length > 0 && (
          <Pressable onPress={() => setGroupSearch('')}>
            <Ionicons name="close-circle" size={16} color={C.textSec} />
          </Pressable>
        )}
      </View>

      {/* Table */}
      <View style={styles.glassCard}>
        {usersLoading ? (
          <ActivityIndicator size="large" color={C.accent} style={{ padding: 40 }} />
        ) : (
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 1.2 }]}>GROUP CODE</Text>
              <Text style={[styles.th, { flex: 1.8 }]}>GROUP NAME</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>ASSIGNED USERS</Text>
              <Text style={[styles.th, { flex: 1 }]}>STATUS</Text>
              <Text style={[styles.th, { flex: 1 }]}>ACTIONS</Text>
            </View>

            {filteredUserGroups.length === 0 ? (
              <Text style={styles.emptyText}>No user groups found in UserGroupMaster.</Text>
            ) : (
              filteredUserGroups.map((g: UserGroupRecord) => {
                const assignedCount = g.userCount !== undefined
                  ? g.userCount
                  : users.filter((u) => u.userGroupId === g.userGroupId).length;
                return (
                  <View key={g.userGroupId} style={styles.tableRow}>
                    <Text style={[styles.td, styles.textAccent, { flex: 1.2, fontWeight: '700' }]}>
                      {g.userGroupCode || '-'}
                    </Text>
                    <Text style={[styles.td, styles.textWhite, { flex: 1.8, fontWeight: '700' }]}>
                      {g.userGroupName}
                    </Text>
                    <View style={{ flex: 1.2 }}>
                      <View style={[styles.roleChip, assignedCount > 0 && { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)' }]}>
                        <Ionicons name="people" size={11} color={assignedCount > 0 ? C.accent : C.textSec} style={{ marginRight: 4 }} />
                        <Text style={[styles.roleChipText, assignedCount > 0 && { color: C.accent, fontWeight: '800' }]}>
                          {assignedCount} {assignedCount === 1 ? 'User' : 'Users'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={[styles.statusBadge, g.isActive === false ? styles.statusBadgeOff : styles.statusBadgeOn]}>
                        <Text style={[styles.statusBadgeText, g.isActive === false ? { color: '#EF4444' } : { color: '#22C55E' }]}>
                          {g.isActive === false ? 'Disabled' : 'Active'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.actionRow, { flex: 1 }]}>
                      <TouchableOpacity
                        style={styles.btnAction}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        onPress={() => handleOpenEditGroup(g)}
                      >
                        <Ionicons name="create-outline" size={16} color="#3B82F6" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.btnAction}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        onPress={() => handleDeleteGroup(g)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </View>

      {/* Add / Edit Group Modal */}
      <Modal visible={groupModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingGroup ? 'Edit User Group' : 'Create New User Group'}</Text>
              <Pressable onPress={() => setGroupModalOpen(false)}>
                <Ionicons name="close" size={22} color={C.textSec} />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>GROUP CODE *</Text>
              <TextInput
                style={styles.fieldInput}
                value={gCode}
                onChangeText={setGCode}
                placeholder="e.g. GRP_ADMIN, GRP_CASHIER"
                placeholderTextColor={C.textMuted}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>GROUP NAME *</Text>
              <TextInput
                style={styles.fieldInput}
                value={gName}
                onChangeText={setGName}
                placeholder="e.g. Administrator, Cashier, Supervisor"
                placeholderTextColor={C.textMuted}
              />
            </View>

            <View style={[styles.flexRowBetween, { marginTop: 10 }]}>
              <Text style={styles.fieldLabel}>GROUP STATUS</Text>
              <Pressable
                style={[styles.statusBadge, !gActive ? styles.statusBadgeOff : styles.statusBadgeOn]}
                onPress={() => setGActive(!gActive)}
              >
                <Text style={[styles.statusBadgeText, !gActive ? { color: '#EF4444' } : { color: '#22C55E' }]}>
                  {gActive ? 'Active' : 'Disabled'} (Click to toggle)
                </Text>
              </Pressable>
            </View>

            <View style={styles.modalFooter}>
              <Pressable style={styles.btnSecondary} onPress={() => setGroupModalOpen(false)}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnPrimary} onPress={handleSaveGroup} disabled={savingGroup}>
                {savingGroup ? (
                  <ActivityIndicator color={C.white} />
                ) : (
                  <Text style={styles.btnPrimaryText}>{editingGroup ? 'Save Changes' : 'Create Group'}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );

  /* ── 2b. Payment Modes View (dbo.Paymode) ── */
  const renderPaymodesView = () => {
    const totalCount = paymodesList.length;
    const activeCount = paymodesList.filter((p) => p.active).length;
    const inactiveCount = totalCount - activeCount;

    return (
      <View style={styles.glassCard}>
        {/* Card Header & Add Button */}
        <View style={styles.cardHeaderAction}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="wallet-outline" size={22} color={C.accent} />
              <Text style={styles.cardHeading}>Payment Tender Modes (dbo.Paymode)</Text>
            </View>
            <Text style={styles.cardSubhead}>
              Configure POS & Kiosk payment channels, positions, surcharge extra charges, commissions, and visibility
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable
              style={styles.btnSecondary}
              onPress={loadPaymodesData}
            >
              <Ionicons name="refresh" size={16} color={C.white} />
              <Text style={styles.btnSecondaryText}>Refresh</Text>
            </Pressable>
            <Pressable
              style={styles.btnPrimary}
              onPress={openAddPaymodeModal}
            >
              <Ionicons name="add" size={16} color={C.white} />
              <Text style={styles.btnPrimaryText}>Add PayMode</Text>
            </Pressable>
          </View>
        </View>

        {/* Quick Filter & Stats Bar */}
        <View style={{ flexDirection: isMid ? 'row' : 'column', justifyContent: 'space-between', alignItems: isMid ? 'center' : 'stretch', gap: 12, marginTop: 16, marginBottom: 16 }}>
          {/* Search Box */}
          <View style={{ flex: 1, maxWidth: isMid ? 360 : undefined, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 12 }}>
            <Ionicons name="search" size={16} color={C.textSec} style={{ marginRight: 8 }} />
            <TextInput
              style={{ flex: 1, height: 38, color: C.white, fontSize: 13 }}
              placeholder="Search code or description..."
              placeholderTextColor={C.textMuted}
              value={pmSearch}
              onChangeText={setPmSearch}
            />
            {pmSearch ? (
              <Pressable onPress={() => setPmSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={C.textSec} />
              </Pressable>
            ) : null}
          </View>

          {/* Filter Pills */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Pressable
              style={[styles.groupPill, pmStatusFilter === 'ALL' && styles.groupPillActive]}
              onPress={() => setPmStatusFilter('ALL')}
            >
              <Text style={[styles.groupPillText, pmStatusFilter === 'ALL' && { color: C.white, fontWeight: '700' }]}>
                All ({totalCount})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.groupPill, pmStatusFilter === 'ACTIVE' && styles.groupPillActive]}
              onPress={() => setPmStatusFilter('ACTIVE')}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 5 }} />
              <Text style={[styles.groupPillText, pmStatusFilter === 'ACTIVE' && { color: C.white, fontWeight: '700' }]}>
                Active ({activeCount})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.groupPill, pmStatusFilter === 'INACTIVE' && styles.groupPillActive]}
              onPress={() => setPmStatusFilter('INACTIVE')}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444', marginRight: 5 }} />
              <Text style={[styles.groupPillText, pmStatusFilter === 'INACTIVE' && { color: C.white, fontWeight: '700' }]}>
                Inactive ({inactiveCount})
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Paymodes Table */}
        <ScrollView horizontal showsHorizontalScrollIndicator keyboardShouldPersistTaps="handled" style={{ width: '100%', marginTop: 8 }} contentContainerStyle={{ minWidth: 1420 }}>
          <View style={{ flex: 1 }}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: 50 }]}>POS</Text>
              <Text style={[styles.th, { width: 60 }]}>ICON</Text>
              <Text style={[styles.th, { width: 120 }]}>PAYMODE CODE</Text>
              <Text style={[styles.th, { width: 190 }]}>DESCRIPTION</Text>
              <Text style={[styles.th, { width: 100 }]}>EXTRA CHG</Text>
              <Text style={[styles.th, { width: 95 }]}>COMMISSION</Text>
              <Text style={[styles.th, { width: 100 }]}>SERVICE CHG</Text>
              <Text style={[styles.th, { width: 140 }]}>DEVICE SN</Text>
              <Text style={[styles.th, { width: 140 }]}>DEVICE SALT</Text>
              <Text style={[styles.th, { width: 115 }]}>YEAHPAY</Text>
              <Text style={[styles.th, { width: 100 }]}>STATUS</Text>
              <Text style={[styles.th, { width: 90 }]}>ACTIONS</Text>
            </View>

            {/* Table Rows */}
            {filteredPaymodes.map((pm, idx) => (
              <View key={pm.payMode || idx} style={styles.tableRow}>
                {/* Position */}
                <View style={{ width: 50, justifyContent: 'center' }}>
                  <Text style={[styles.td, styles.textSec, { fontWeight: '700' }]}>
                    {pm.position ?? idx + 1}
                  </Text>
                </View>

                {/* Logo / Icon */}
                <View style={{ width: 60, justifyContent: 'center' }}>
                  <BackofficeImageThumb
                    uri={pm.paymodeImage}
                    fallbackKey={pm.payMode}
                    type="paymode"
                    style={styles.tableThumb}
                    resizeMode="contain"
                  />
                </View>

                {/* PayMode Code */}
                <View style={{ width: 120, justifyContent: 'center' }}>
                  <Text style={[styles.td, styles.textAccent, { fontWeight: '800' }]}>
                    {pm.payMode}
                  </Text>
                </View>

                {/* Description */}
                <View style={{ width: 190, justifyContent: 'center' }}>
                  <Text style={[styles.td, styles.textWhite, { fontWeight: '600' }]} numberOfLines={2}>
                    {pm.description || <Text style={{ fontStyle: 'italic', color: C.textMuted }}>No description</Text>}
                  </Text>
                </View>

                {/* Extra Charges */}
                <View style={{ width: 100, justifyContent: 'center' }}>
                  <Text style={[styles.td, styles.textSec, { fontWeight: '600' }]}>
                    {pm.extraCharges ? `S$ ${Number(pm.extraCharges).toFixed(2)}` : 'S$ 0.00'}
                  </Text>
                </View>

                {/* Commission */}
                <View style={{ width: 95, justifyContent: 'center' }}>
                  <Text style={[styles.td, styles.textSec, { fontWeight: '600' }]}>
                    {pm.commission ? `${Number(pm.commission).toFixed(2)}%` : '0.00%'}
                  </Text>
                </View>

                {/* Service Charge */}
                <View style={{ width: 100, justifyContent: 'center' }}>
                  <Text style={[styles.td, styles.textSec, { fontWeight: '600' }]}>
                    {pm.serviceCharge ? `S$ ${Number(pm.serviceCharge).toFixed(2)}` : 'S$ 0.00'}
                  </Text>
                </View>

                {/* Device SN */}
                <View style={{ width: 140, justifyContent: 'center' }}>
                  {pm.deviceSN ? (
                    <View style={[styles.roleChip, { backgroundColor: 'rgba(59, 130, 246, 0.12)', borderColor: 'rgba(59, 130, 246, 0.35)', borderWidth: 1, paddingVertical: 2 }]}>
                      <Text style={{ color: '#93C5FD', fontSize: 11, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, fontWeight: '700' }} numberOfLines={1}>
                        {pm.deviceSN}
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ color: C.textMuted, fontSize: 12 }}>-</Text>
                  )}
                </View>

                {/* Device Salt */}
                <View style={{ width: 140, justifyContent: 'center' }}>
                  {pm.deviceSalt ? (
                    <View style={[styles.roleChip, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.35)', borderWidth: 1, paddingVertical: 2 }]}>
                      <Text style={{ color: '#FCD34D', fontSize: 11, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, fontWeight: '600' }} numberOfLines={1}>
                        {pm.deviceSalt}
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ color: C.textMuted, fontSize: 12 }}>-</Text>
                  )}
                </View>

                {/* YeahPay Enabled */}
                <View style={{ width: 115, justifyContent: 'center' }}>
                  <View style={[
                    styles.statusBadge,
                    pm.yeahPayEnabled
                      ? { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981', borderWidth: 1 }
                      : { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1 }
                  ]}>
                    <Text style={[
                      styles.statusBadgeText,
                      { color: pm.yeahPayEnabled ? '#34D399' : C.textMuted, fontWeight: '800', fontSize: 10 }
                    ]}>
                      {pm.yeahPayEnabled ? '✓ ENABLED' : 'DISABLED'}
                    </Text>
                  </View>
                </View>

                {/* Status with Quick Toggle */}
                <View style={{ width: 100, justifyContent: 'center' }}>
                  <Pressable
                    onPress={() => handleTogglePaymodeActive(pm)}
                    style={[styles.statusBadge, pm.active ? styles.statusBadgeOn : styles.statusBadgeOff]}
                  >
                    <Text style={[styles.statusBadgeText, pm.active ? { color: '#22C55E' } : { color: '#EF4444' }]}>
                      {pm.active ? 'Active' : 'Inactive'}
                    </Text>
                  </Pressable>
                </View>

                {/* Actions */}
                <View style={[styles.actionRow, { width: 90 }]}>
                  <TouchableOpacity
                    style={styles.btnAction}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => openEditPaymodeModal(pm)}
                  >
                    <Ionicons name="create-outline" size={16} color="#3B82F6" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnAction}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => handleDeletePaymode(pm)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {filteredPaymodes.length === 0 && !settingsLoading && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="wallet-outline" size={36} color={C.textMuted} style={{ marginBottom: 8 }} />
            <Text style={{ color: C.textMuted, fontSize: 14, fontWeight: '600' }}>
              {pmSearch ? 'No payment modes match your search.' : 'No payment modes found in dbo.Paymode.'}
            </Text>
            <Pressable
              style={[styles.btnPrimary, { marginTop: 12 }]}
              onPress={openAddPaymodeModal}
            >
              <Ionicons name="add" size={16} color={C.white} />
              <Text style={styles.btnPrimaryText}>Add PayMode</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  /* ── Paymode Modal ── */
  const renderPaymodeModal = () => (
    <Modal
      visible={paymodeModalOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setPaymodeModalOpen(false)}
    >
      <View style={[styles.modalBackdrop, { padding: 12 }]}>
        <View style={{
          width: '95%',
          maxWidth: 580,
          maxHeight: '90%',
          backgroundColor: '#181818',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.14)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          ...(Platform.OS === 'web' ? { boxShadow: '0 25px 60px rgba(0,0,0,0.9)' } : {}),
        }}>
          {/* Fixed Header */}
          <View style={{
            flexShrink: 0,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255, 255, 255, 0.08)',
            backgroundColor: '#1F1F1F',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: 'rgba(255, 26, 26, 0.15)', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="wallet-outline" size={18} color={C.accent} />
              </View>
              <View>
                <Text style={{ color: C.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 }}>
                  {editingPaymode ? `Edit Payment Mode: ${editingPaymode.payMode}` : 'Add Payment Mode'}
                </Text>
                <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 1 }}>
                  Configure tender credentials, terminals, and pricing
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => setPaymodeModalOpen(false)}
              hitSlop={10}
              style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name="close" size={18} color={C.textSec} />
            </Pressable>
          </View>

          {/* Scrollable Body */}
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, gap: 14 }}
            showsVerticalScrollIndicator={true}
          >
            {pmModalError ? (
              <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: '#EF4444', borderRadius: 8, padding: 10 }}>
                <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}>{pmModalError}</Text>
              </View>
            ) : null}

            {/* Section: Tender Info */}
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="card-outline" size={13} color={C.accent} />
                <Text style={{ color: C.textSec, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }}>
                  TENDER IDENTIFICATION
                </Text>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1.2, marginBottom: 0 }]}>
                  <Text style={styles.fieldLabel}>PAYMODE CODE * (MAX 10 CHARS)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={pmCode}
                    onChangeText={(val) => setPmCode(val.toUpperCase())}
                    placeholder="e.g. CASH, NETS, PAYNOW"
                    placeholderTextColor={C.textMuted}
                    autoCapitalize="characters"
                    maxLength={10}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 0.8, marginBottom: 0 }]}>
                  <Text style={styles.fieldLabel}>POSITION / ORDER</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={pmPosition}
                    onChangeText={setPmPosition}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor={C.textMuted}
                  />
                </View>
              </View>

              <View style={[styles.formGroup, { marginBottom: 0 }]}>
                <Text style={styles.fieldLabel}>DESCRIPTION * (MAX 50 CHARS)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={pmDesc}
                  onChangeText={setPmDesc}
                  placeholder="e.g. Cash Counter Payment, DBS PayNow QR"
                  placeholderTextColor={C.textMuted}
                  maxLength={50}
                />
              </View>
            </View>

            {/* Section: Fees & Commissions */}
            <View style={{ gap: 10, marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="cash-outline" size={13} color="#10B981" />
                <Text style={{ color: C.textSec, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }}>
                  FEES & COMMISSIONS
                </Text>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginBottom: 0 }]}>
                  <Text style={styles.fieldLabel}>EXTRA CHARGE (S$)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={pmExtraCharges}
                    onChangeText={setPmExtraCharges}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={C.textMuted}
                  />
                  <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>Customer surcharge</Text>
                </View>

                <View style={[styles.formGroup, { flex: 1, marginBottom: 0 }]}>
                  <Text style={styles.fieldLabel}>COMMISSION (%)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={pmCommission}
                    onChangeText={setPmCommission}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={C.textMuted}
                  />
                  <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>Gateway deduction</Text>
                </View>

                <View style={[styles.formGroup, { flex: 1, marginBottom: 0 }]}>
                  <Text style={styles.fieldLabel}>SERVICE CHG (S$)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={pmServiceCharge}
                    onChangeText={setPmServiceCharge}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={C.textMuted}
                  />
                  <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>Service fee</Text>
                </View>
              </View>
            </View>

            {/* Section: Hardware Terminal & YeahPay */}
            <View style={{
              backgroundColor: pmYeahPayEnabled ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)',
              borderWidth: 1,
              borderColor: pmYeahPayEnabled ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 255, 255, 0.08)',
              borderRadius: 12,
              padding: 14,
              gap: 10,
              marginTop: 4,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="hardware-chip-outline" size={14} color={pmYeahPayEnabled ? '#34D399' : '#60A5FA'} />
                  <Text style={{ color: pmYeahPayEnabled ? '#34D399' : '#93C5FD', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>
                    HARDWARE TERMINAL & YEAHPAY
                  </Text>
                </View>

                {/* YeahPay Switch Button */}
                <Pressable
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 20,
                    backgroundColor: pmYeahPayEnabled ? '#10B981' : 'rgba(255, 255, 255, 0.08)',
                    borderWidth: 1,
                    borderColor: pmYeahPayEnabled ? '#059669' : 'rgba(255, 255, 255, 0.12)',
                  }}
                  onPress={() => setPmYeahPayEnabled(!pmYeahPayEnabled)}
                >
                  <Ionicons
                    name={pmYeahPayEnabled ? 'checkmark-circle' : 'close-circle-outline'}
                    size={14}
                    color={pmYeahPayEnabled ? C.white : C.textSec}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={{ color: pmYeahPayEnabled ? C.white : C.textSec, fontWeight: '800', fontSize: 11 }}>
                    {pmYeahPayEnabled ? 'YeahPay Enabled' : 'Disabled'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginBottom: 0 }]}>
                  <Text style={styles.fieldLabel}>DEVICE SERIAL NUMBER</Text>
                  <TextInput
                    style={[styles.fieldInput, { fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }]}
                    value={pmDeviceSN}
                    onChangeText={setPmDeviceSN}
                    placeholder="e.g. N5-POS-98124501"
                    placeholderTextColor={C.textMuted}
                    autoCapitalize="none"
                  />
                  <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>Terminal serial number for payment processing</Text>
                </View>

                <View style={[styles.formGroup, { flex: 1, marginBottom: 0 }]}>
                  <Text style={styles.fieldLabel}>DEVICE ENCRYPTION SALT</Text>
                  <TextInput
                    style={[styles.fieldInput, { fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }]}
                    value={pmDeviceSalt}
                    onChangeText={setPmDeviceSalt}
                    placeholder="e.g. 7f9a1b2c4d8e..."
                    placeholderTextColor={C.textMuted}
                    autoCapitalize="none"
                  />
                  <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>Terminal encryption security salt</Text>
                </View>
              </View>
            </View>

            {/* Section: Status */}
            <View style={{ gap: 10, marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle-outline" size={13} color="#22C55E" />
                <Text style={{ color: C.textSec, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }}>
                  VISIBILITY & STATUS
                </Text>
              </View>

              <View style={[styles.formGroup, { marginBottom: 0 }]}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    style={[styles.groupPill, pmActive && { backgroundColor: 'rgba(34, 197, 94, 0.2)', borderWidth: 1, borderColor: '#22C55E' }, { paddingHorizontal: 16, paddingVertical: 8 }]}
                    onPress={() => setPmActive(true)}
                  >
                    <Ionicons name="checkmark-circle" size={15} color={pmActive ? '#22C55E' : C.textSec} style={{ marginRight: 6 }} />
                    <Text style={[styles.groupPillText, pmActive && { color: '#22C55E', fontWeight: '800' }]}>
                      Active (Visible in POS & Kiosk)
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.groupPill, !pmActive && { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderWidth: 1, borderColor: '#EF4444' }, { paddingHorizontal: 16, paddingVertical: 8 }]}
                    onPress={() => setPmActive(false)}
                  >
                    <Ionicons name="close-circle" size={15} color={!pmActive ? '#EF4444' : C.textSec} style={{ marginRight: 6 }} />
                    <Text style={[styles.groupPillText, !pmActive && { color: '#EF4444', fontWeight: '800' }]}>
                      Inactive (Hidden)
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Section: Logo */}
            <View style={{ gap: 8, marginTop: 4 }}>
              <Text style={styles.fieldLabel}>TENDER LOGO / BADGE (OPTIONAL)</Text>
              <View style={styles.uploadRow}>
                {pmImage ? (
                  <View style={styles.previewBox}>
                    <Image source={{ uri: resolveApiUrl(pmImage) }} style={styles.previewImg} resizeMode="contain" />
                    <Pressable style={styles.previewRemoveBtn} onPress={() => setPmImage('')}>
                      <Ionicons name="trash" size={12} color="#EF4444" />
                    </Pressable>
                  </View>
                ) : (
                  <View style={[styles.previewBoxPlaceholder, { backgroundColor: '#1E293B' }]}>
                    <Ionicons name="card-outline" size={22} color="#94A3B8" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Pressable
                    style={styles.btnUpload}
                    onPress={() => handlePickImage((base64) => setPmImage(base64))}
                  >
                    <Ionicons name="cloud-upload-outline" size={15} color={C.white} />
                    <Text style={styles.btnUploadText}>{pmImage ? 'Change Image' : 'Upload Tender Icon'}</Text>
                  </Pressable>
                  <Text style={styles.uploadHint}>Used on kiosk touch buttons</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Fixed Footer */}
          <View style={{
            flexShrink: 0,
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255, 255, 255, 0.08)',
            backgroundColor: '#161616',
          }}>
            <Pressable style={styles.btnSecondary} onPress={() => setPaymodeModalOpen(false)}>
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btnPrimary, savingPaymode && { opacity: 0.7 }]}
              onPress={handleSavePaymode}
              disabled={savingPaymode}
            >
              {savingPaymode ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-sharp" size={15} color={C.white} style={{ marginRight: 4 }} />
                  <Text style={styles.btnPrimaryText}>{editingPaymode ? 'Update PayMode' : 'Save PayMode'}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  /* ── 3. Configuration & Masters View ── */
  const renderSettings = () => (
    <ScrollView style={styles.scrollPane} contentContainerStyle={styles.scrollPad} keyboardShouldPersistTaps="handled">
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.screenTitle}>System Configuration</Text>
          <Text style={styles.screenSub}>Manage vehicle classifications, pricing, services, and hardware devices</Text>
        </View>
      </View>

      {/* Sub Tabs */}
      <View style={styles.subTabsRow}>
        {[
          { id: 'VEHICLES', label: 'Vehicle Types' },
          { id: 'CATEGORIES', label: 'Categories' },
          { id: 'PACKAGES', label: 'Service Packages' },
          { id: 'ADDONS', label: 'À La Carte Services' },
          { id: 'BAYS', label: 'Washing Bays' },
          { id: 'DEALERS', label: 'Dealers' },
          { id: 'ACCOUNT_TYPES', label: 'Account Types' },
          { id: 'COMPANY', label: 'Station Profile' },
          { id: 'PRINTERS', label: 'Printers' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.subTabPill, settingsTab === tab.id && styles.subTabPillActive]}
            onPress={() => setSettingsTab(tab.id as SettingsSubTab)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Text style={[styles.subTabPillText, settingsTab === tab.id && styles.subTabPillTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab 3a: Vehicle Types */}
      {settingsTab === 'VEHICLES' && (
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderAction}>
            <Text style={styles.cardHeading}>Vehicle Classifications</Text>
            <Pressable
              style={styles.btnPrimary}
              onPress={() => {
                setEditingVehicle(null);
                setVCode('');
                setVName('');
                setVDesc('');
                setVOrder('1');
                setVActive(true);
                setVImage('');
                setVehicleModalOpen(true);
              }}
            >
              <Ionicons name="add" size={16} color={C.white} />
              <Text style={styles.btnPrimaryText}>Add Vehicle Type</Text>
            </Pressable>
          </View>

          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 0.8 }]}>IMAGE</Text>
            <Text style={[styles.th, { flex: 1 }]}>CODE</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>TYPE NAME</Text>
            <Text style={[styles.th, { flex: 2 }]}>DESCRIPTION</Text>
            <TouchableOpacity
              style={{ flex: 0.8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
              onPress={() => setVehicleSortAsc((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Text style={[styles.th, { color: C.accent, fontWeight: '800' }]}>ORDER</Text>
              <Ionicons
                name={vehicleSortAsc ? 'arrow-up' : 'arrow-down'}
                size={13}
                color={C.accent}
              />
            </TouchableOpacity>
            <Text style={[styles.th, { flex: 1 }]}>STATUS</Text>
            <Text style={[styles.th, { flex: 1 }]}>ACTIONS</Text>
          </View>

          {[...vehicles]
            .sort((a, b) => {
              const orderA = a.displayOrder ?? 1;
              const orderB = b.displayOrder ?? 1;
              return vehicleSortAsc ? orderA - orderB : orderB - orderA;
            })
            .map((v) => (
            <View key={v.vehicleTypeId} style={styles.tableRow}>
              <View style={{ flex: 0.8, justifyContent: 'center' }}>
                <BackofficeImageThumb
                  uri={v.imageUrl}
                  fallbackKey={v.vehicleTypeCode || v.vehicleTypeName}
                  type="vehicle"
                  style={styles.tableThumb}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.td, styles.textAccent, { flex: 1, fontWeight: '700' }]}>{v.vehicleTypeCode}</Text>
              <Text style={[styles.td, styles.textWhite, { flex: 1.5, fontWeight: '700' }]}>{v.vehicleTypeName}</Text>
              <Text style={[styles.td, styles.textSec, { flex: 2 }]}>{v.description || '-'}</Text>
              <View style={{ flex: 0.8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[styles.td, styles.textWhite, { fontWeight: '800', minWidth: 16 }]}>{v.displayOrder}</Text>
                <View style={{ flexDirection: 'column', gap: 2 }}>
                  <TouchableOpacity
                    style={styles.orderSmallBtn}
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    onPress={() => handleQuickReorderVehicle(v, -1)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-up" size={12} color={C.white} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.orderSmallBtn}
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    onPress={() => handleQuickReorderVehicle(v, 1)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-down" size={12} color={C.white} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => handleToggleVehicleStatus(v)}
                  style={[
                    styles.statusBadge,
                    v.isActive ? styles.statusBadgeOn : styles.statusBadgeOff,
                    { cursor: 'pointer', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' } as any,
                  ]}
                >
                  <Ionicons
                    name={v.isActive ? 'checkmark-circle' : 'close-circle'}
                    size={12}
                    color={v.isActive ? '#22C55E' : '#EF4444'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.statusBadgeText, v.isActive ? { color: '#22C55E' } : { color: '#EF4444' }]}>
                    {v.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.actionRow, { flex: 1 }]}>
                <TouchableOpacity
                  style={styles.btnAction}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => {
                    setEditingVehicle(v);
                    setVCode(v.vehicleTypeCode);
                    setVName(v.vehicleTypeName);
                    setVDesc(v.description || '');
                    setVOrder(String(v.displayOrder));
                    setVActive(v.isActive);
                    setVImage(v.imageUrl || '');
                    setVehicleModalOpen(true);
                  }}
                >
                  <Ionicons name="create-outline" size={16} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnAction}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => handleDeleteVehicleType(v.vehicleTypeId)}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Tab 3b: Categories */}
      {settingsTab === 'CATEGORIES' && (
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderAction}>
            <Text style={styles.cardHeading}>Service Categories</Text>
            <Pressable
              style={styles.btnPrimary}
              onPress={() => {
                setEditingCategory(null);
                setCCode('');
                setCName('');
                setCDesc('');
                setCOrder('1');
                setCActive(true);
                setCImage('');
                setCIcon('');
                setCategoryModalOpen(true);
              }}
            >
              <Ionicons name="add" size={16} color={C.white} />
              <Text style={styles.btnPrimaryText}>Add Category</Text>
            </Pressable>
          </View>

          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 0.9 }]}>COVER IMAGE</Text>
            <Text style={[styles.th, { flex: 0.7 }]}>ICON</Text>
            <Text style={[styles.th, { flex: 1.1 }]}>CODE</Text>
            <Text style={[styles.th, { flex: 1.4 }]}>CATEGORY NAME</Text>
            <Text style={[styles.th, { flex: 2 }]}>DESCRIPTION</Text>
            <TouchableOpacity
              style={{ flex: 0.9, flexDirection: 'row', alignItems: 'center', gap: 5 }}
              onPress={() => setCategorySortAsc((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Text style={[styles.th, { color: C.accent, fontWeight: '800' }]}>ORDER</Text>
              <Ionicons
                name={categorySortAsc ? 'arrow-up' : 'arrow-down'}
                size={13}
                color={C.accent}
              />
            </TouchableOpacity>
            <Text style={[styles.th, { flex: 0.9 }]}>STATUS</Text>
            <Text style={[styles.th, { flex: 0.9 }]}>ACTIONS</Text>
          </View>

          {[...categories]
            .sort((a, b) => {
              const orderA = a.displayOrder ?? 1;
              const orderB = b.displayOrder ?? 1;
              return categorySortAsc ? orderA - orderB : orderB - orderA;
            })
            .map((c) => (
            <View key={c.serviceCategoryId} style={styles.tableRow}>
              <View style={{ flex: 0.9, justifyContent: 'center' }}>
                <BackofficeImageThumb
                  uri={c.imageUrl}
                  fallbackKey={c.serviceCategoryCode || c.categoryName}
                  type="category"
                  style={styles.tableThumb}
                  resizeMode="cover"
                />
              </View>
              <View style={{ flex: 0.7, justifyContent: 'center' }}>
                <BackofficeImageThumb
                  uri={c.iconUrl}
                  fallbackKey={c.serviceCategoryCode || c.categoryName}
                  type="category"
                  style={[styles.tableThumb, { width: 32, height: 32, borderRadius: 6 }]}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.td, styles.textAccent, { flex: 1.1, fontWeight: '700' }]}>{c.serviceCategoryCode}</Text>
              <Text style={[styles.td, styles.textWhite, { flex: 1.4, fontWeight: '700' }]}>{c.categoryName}</Text>
              <Text style={[styles.td, styles.textSec, { flex: 2 }]}>{c.description || '-'}</Text>
              <View style={{ flex: 0.9, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.td, styles.textWhite, { fontWeight: '800', minWidth: 18 }]}>{c.displayOrder}</Text>
                <View style={{ flexDirection: 'column', gap: 2 }}>
                  <TouchableOpacity
                    style={styles.orderSmallBtn}
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    onPress={() => handleQuickReorderCategory(c, -1)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-up" size={12} color={C.white} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.orderSmallBtn}
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    onPress={() => handleQuickReorderCategory(c, 1)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-down" size={12} color={C.white} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ flex: 0.9 }}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => handleToggleCategoryStatus(c)}
                  style={[
                    styles.statusBadge,
                    c.isActive ? styles.statusBadgeOn : styles.statusBadgeOff,
                    { cursor: 'pointer', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' } as any,
                  ]}
                >
                  <Ionicons
                    name={c.isActive ? 'checkmark-circle' : 'close-circle'}
                    size={12}
                    color={c.isActive ? '#22C55E' : '#EF4444'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.statusBadgeText, c.isActive ? { color: '#22C55E' } : { color: '#EF4444' }]}>
                    {c.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.actionRow, { flex: 0.9 }]}>
                <TouchableOpacity
                  style={styles.btnAction}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => {
                    setEditingCategory(c);
                    setCCode(c.serviceCategoryCode);
                    setCName(c.categoryName);
                    setCDesc(c.description || '');
                    setCOrder(String(c.displayOrder));
                    setCActive(c.isActive);
                    setCImage(c.imageUrl || '');
                    setCIcon(c.iconUrl || '');
                    setCategoryModalOpen(true);
                  }}
                >
                  <Ionicons name="create-outline" size={16} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnAction}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => handleDeleteCategory(c.serviceCategoryId)}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Tab 3c: Service Packages */}
      {settingsTab === 'PACKAGES' && (
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderAction}>
            <Text style={styles.cardHeading}>Service Packages & Rates</Text>
            <Pressable
              style={styles.btnPrimary}
              onPress={() => {
                setEditingPkg(null);
                setPCode('');
                setPName('');
                setPDesc('');
                setPPrice('15.00');
                setPDealerPrice('15.00');
                setPDuration('20');
                setPOrder('1');
                setPActive(true);
                setPFeatures('');
                setPkgVehiclePrices([]);
                setPkgVehiclePricesLoading(false);
                setPkgModalOpen(true);
              }}
            >
              <Ionicons name="add" size={16} color={C.white} />
              <Text style={styles.btnPrimaryText}>Add Service Package</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ width: '100%' }} contentContainerStyle={{ minWidth: 1090, flexDirection: 'column' }}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: 140, paddingRight: 10 }]}>CATEGORY</Text>
              <Text style={[styles.th, { width: 170, paddingRight: 10 }]}>CODE</Text>
              <Text style={[styles.th, { width: 220, paddingRight: 10 }]}>PACKAGE NAME</Text>
              <Text style={[styles.th, { width: 85, paddingRight: 8 }]}>PRICE ($)</Text>
              <Text style={[styles.th, { width: 85, paddingRight: 8 }]}>DEALER ($)</Text>
              <TouchableOpacity
                style={{ width: 75, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                onPress={() => setPackageSortAsc((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Text style={[styles.th, { color: C.accent, fontWeight: '800' }]}>ORDER</Text>
                <Ionicons
                  name={packageSortAsc ? 'arrow-up' : 'arrow-down'}
                  size={13}
                  color={C.accent}
                />
              </TouchableOpacity>
              <Text style={[styles.th, { width: 130, textAlign: 'center', paddingRight: 8 }]}>VEHICLE RATES</Text>
              <Text style={[styles.th, { width: 100, textAlign: 'center', paddingRight: 8 }]}>STATUS</Text>
              <Text style={[styles.th, { width: 85, textAlign: 'center' }]}>ACTIONS</Text>
            </View>

            {[...packages]
              .sort((a, b) => {
                const orderA = a.displayOrder ?? 1;
                const orderB = b.displayOrder ?? 1;
                return packageSortAsc ? orderA - orderB : orderB - orderA;
              })
              .map((pkg) => (
              <View key={pkg.packageId} style={styles.tableRow}>
                <Text style={[styles.td, styles.textSec, { width: 140, paddingRight: 10 }]} numberOfLines={1}>{pkg.serviceCategoryName || 'Wash'}</Text>
                <Text style={[styles.td, styles.textAccent, { width: 170, paddingRight: 10, fontWeight: '700' }]} numberOfLines={1}>{pkg.packageCode}</Text>
                <Text style={[styles.td, styles.textWhite, { width: 220, paddingRight: 10, fontWeight: '700' }]} numberOfLines={2}>{pkg.packageName}</Text>
                <Text style={[styles.td, { width: 85, paddingRight: 8, color: '#22C55E', fontWeight: '800' }]}>${pkg.price.toFixed(2)}</Text>
                <Text style={[styles.td, { width: 85, paddingRight: 8, color: '#F59E0B', fontWeight: '800' }]}>
                  {pkg.dealerPrice != null ? `$${Number(pkg.dealerPrice).toFixed(2)}` : `$${pkg.price.toFixed(2)}`}
                </Text>
                <View style={{ width: 75, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.td, styles.textWhite, { fontWeight: '800', minWidth: 16 }]}>{pkg.displayOrder}</Text>
                  <View style={{ flexDirection: 'column', gap: 2 }}>
                    <TouchableOpacity
                      style={styles.orderSmallBtn}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                      onPress={() => handleQuickReorderPackage(pkg, -1)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chevron-up" size={12} color={C.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.orderSmallBtn}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                      onPress={() => handleQuickReorderPackage(pkg, 1)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chevron-down" size={12} color={C.white} />
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Direct Vehicle Rates button */}
                <View style={{ width: 130, paddingRight: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleOpenVehicleRates(pkg)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 6,
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      borderWidth: 1,
                      borderColor: 'rgba(59, 130, 246, 0.4)',
                      cursor: 'pointer' as any,
                    }}
                  >
                    <Ionicons name="car-sport" size={13} color="#60A5FA" />
                    <Text style={{ color: '#60A5FA', fontSize: 11, fontWeight: '700' }}>Change Rates</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ width: 100, paddingRight: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => handleTogglePackageStatus(pkg)}
                    style={[
                      styles.statusBadge,
                      pkg.isActive ? styles.statusBadgeOn : styles.statusBadgeOff,
                      { cursor: 'pointer', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minWidth: 80 } as any,
                    ]}
                  >
                    <Ionicons
                      name={pkg.isActive ? 'checkmark-circle' : 'close-circle'}
                      size={12}
                      color={pkg.isActive ? '#22C55E' : '#EF4444'}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.statusBadgeText, pkg.isActive ? { color: '#22C55E' } : { color: '#EF4444' }]}>
                      {pkg.isActive ? 'Active' : 'Inactive'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.actionRow, { width: 85, justifyContent: 'center' }]}>
                  <TouchableOpacity
                    style={styles.btnAction}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => {
                      setEditingPkg(pkg);
                      setPCatId(pkg.serviceCategoryId);
                      setPCode(pkg.packageCode);
                      setPName(pkg.packageName);
                      setPDesc(pkg.description || '');
                      setPPrice(String(pkg.price));
                      setPDealerPrice(pkg.dealerPrice != null ? String(pkg.dealerPrice) : String(pkg.price));
                      setPDuration(String(pkg.durationMinutes || 20));
                      setPOrder(String(pkg.displayOrder));
                      setPActive(pkg.isActive);
                      setPFeatures((pkg.features || []).join('\n'));
                      // Load vehicle type prices
                      setPkgVehiclePrices([]);
                      setPkgVehiclePricesLoading(true);
                      setPkgModalOpen(true);
                      fetchVehicleTypePricesForPackage(pkg.packageId).then((rows) => {
                        setPkgVehiclePrices(rows);
                        setPkgVehiclePricesLoading(false);
                      }).catch(() => setPkgVehiclePricesLoading(false));
                    }}
                  >
                    <Ionicons name="create-outline" size={16} color="#3B82F6" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnAction}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => handleDeletePackage(pkg.packageId)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Tab 3c2: À La Carte Services & Upgrades */}
      {settingsTab === 'ADDONS' && (
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderAction}>
            <View>
              <Text style={styles.cardHeading}>À La Carte Services & Upgrades</Text>
              <Text style={styles.cardSubhead}>Individual services, add-on upgrades, and customer/dealer prices</Text>
            </View>
            <Pressable
              style={styles.btnPrimary}
              onPress={() => {
                setEditingAddon(null);
                setAdCode('');
                setAdName('');
                setAdCategory('EXTERIOR');
                setAdCustomerPrice('10.00');
                setAdDealerPrice('7.50');
                setAdDesc('');
                setAdOrder('1');
                setAdActive(true);
                setAdPackageIds([]);
                setAddonModalOpen(true);
              }}
            >
              <Ionicons name="add" size={16} color={C.white} />
              <Text style={styles.btnPrimaryText}>Add À La Carte Service</Text>
            </Pressable>
          </View>

          {/* Search & Filter Bar */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 16,
              marginBottom: 16,
            }}
          >
            {/* Search Input Box */}
            <View
              style={{
                flex: 1,
                minWidth: 260,
                maxWidth: 420,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
                borderRadius: 8,
                paddingHorizontal: 12,
              }}
            >
              <Ionicons name="search" size={16} color={C.textSec} style={{ marginRight: 8 }} />
              <TextInput
                style={{ flex: 1, height: 38, color: C.white, fontSize: 13 }}
                placeholder="Search by service name, code, package..."
                placeholderTextColor={C.textMuted}
                value={addonSearch}
                onChangeText={setAddonSearch}
              />
              {addonSearch ? (
                <Pressable onPress={() => setAddonSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={C.textSec} />
                </Pressable>
              ) : null}
            </View>

            {/* Quick Filter Buttons */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Pressable
                style={[
                  styles.groupPill,
                  addonCategoryFilter === 'ALL' && styles.groupPillActive,
                ]}
                onPress={() => setAddonCategoryFilter('ALL')}
              >
                <Text
                  style={[
                    styles.groupPillText,
                    addonCategoryFilter === 'ALL' && { color: C.white, fontWeight: '700' },
                  ]}
                >
                  All ({addonsList.length})
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.groupPill,
                  addonCategoryFilter === 'INTERIOR' && {
                    backgroundColor: 'rgba(168, 85, 247, 0.25)',
                    borderColor: '#A855F7',
                  },
                ]}
                onPress={() => setAddonCategoryFilter('INTERIOR')}
              >
                <Ionicons name="sparkles" size={12} color="#C084FC" style={{ marginRight: 4 }} />
                <Text
                  style={[
                    styles.groupPillText,
                    addonCategoryFilter === 'INTERIOR' && { color: '#C084FC', fontWeight: '700' },
                  ]}
                >
                  Interior ({addonsList.filter((a) => a.category === 'INTERIOR').length})
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.groupPill,
                  addonCategoryFilter === 'EXTERIOR' && {
                    backgroundColor: 'rgba(59, 130, 246, 0.25)',
                    borderColor: '#3B82F6',
                  },
                ]}
                onPress={() => setAddonCategoryFilter('EXTERIOR')}
              >
                <Ionicons name="car-sport" size={12} color="#60A5FA" style={{ marginRight: 4 }} />
                <Text
                  style={[
                    styles.groupPillText,
                    addonCategoryFilter === 'EXTERIOR' && { color: '#60A5FA', fontWeight: '700' },
                  ]}
                >
                  Exterior ({addonsList.filter((a) => a.category === 'EXTERIOR').length})
                </Text>
              </Pressable>

              {/* Reset button if any filter is active */}
              {(addonSearch || addonCategoryFilter !== 'ALL' || addonPackageFilter !== 'ALL') && (
                <Pressable
                  onPress={() => {
                    setAddonSearch('');
                    setAddonCategoryFilter('ALL');
                    setAddonPackageFilter('ALL');
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 6,
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    borderWidth: 1,
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <Ionicons name="refresh" size={13} color="#EF4444" />
                  <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}>Reset</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 0.8, paddingRight: 6 }]}>CATEGORY</Text>
            <Text style={[styles.th, { flex: 1.2, paddingRight: 8 }]}>CODE</Text>
            <Text style={[styles.th, { flex: 1.5, paddingRight: 8 }]}>SERVICE NAME</Text>
            <Text style={[styles.th, { flex: 2.1, paddingRight: 8 }]}>APPLICABLE PACKAGES</Text>
            <Text style={[styles.th, { flex: 0.8, paddingRight: 4 }]}>CUSTOMER ($)</Text>
            <Text style={[styles.th, { flex: 0.8, paddingRight: 4 }]}>DEALER ($)</Text>
            <TouchableOpacity
              style={{ flex: 0.8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
              onPress={() => setAddonSortAsc((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Text style={[styles.th, { color: C.accent, fontWeight: '800' }]}>ORDER</Text>
              <Ionicons
                name={addonSortAsc ? 'arrow-up' : 'arrow-down'}
                size={13}
                color={C.accent}
              />
            </TouchableOpacity>
            <Text style={[styles.th, { flex: 0.7, paddingRight: 6 }]}>STATUS</Text>
            <Text style={[styles.th, { flex: 0.7 }]}>ACTIONS</Text>
          </View>

          {[...filteredAddons]
            .sort((a, b) => {
              const orderA = a.displayOrder ?? 1;
              const orderB = b.displayOrder ?? 1;
              return addonSortAsc ? orderA - orderB : orderB - orderA;
            })
            .map((addon) => {
            const isAllPackages = packages.length > 0 && (addon.packageIds?.length || 0) >= packages.length;
            const packageCount = addon.packageNames?.length || 0;

            return (
              <View key={addon.addonId} style={styles.tableRow}>
                <View style={{ flex: 0.8, paddingRight: 6 }}>
                  <View
                    style={[
                      styles.statusBadge,
                      addon.category === 'EXTERIOR'
                        ? { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.4)' }
                        : { backgroundColor: 'rgba(168, 85, 247, 0.15)', borderColor: 'rgba(168, 85, 247, 0.4)' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        addon.category === 'EXTERIOR' ? { color: '#60A5FA' } : { color: '#C084FC' },
                      ]}
                    >
                      {addon.category}
                    </Text>
                  </View>
                </View>
                <View style={{ flex: 1.3, paddingRight: 10, minWidth: 0 }}>
                  <Text style={[styles.td, styles.textAccent, { fontWeight: '700', fontSize: 11 }]} numberOfLines={1}>
                    {addon.addonCode}
                  </Text>
                </View>
                <View style={{ flex: 1.6, paddingRight: 10, minWidth: 0 }}>
                  <Text style={[styles.td, styles.textWhite, { fontWeight: '700', fontSize: 12 }]} numberOfLines={2}>
                    {addon.addonName}
                  </Text>
                </View>
                <View style={{ flex: 2.3, paddingRight: 10 }}>
                  {packageCount === 0 ? (
                    <View
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(239, 68, 68, 0.3)',
                        borderRadius: 4,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        alignSelf: 'flex-start',
                      }}
                    >
                      <Text style={{ color: '#F87171', fontSize: 10, fontWeight: '600' }}>No Packages</Text>
                    </View>
                  ) : isAllPackages ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        borderWidth: 1,
                        borderColor: 'rgba(16, 185, 129, 0.4)',
                        borderRadius: 4,
                        paddingHorizontal: 7,
                        paddingVertical: 3,
                        alignSelf: 'flex-start',
                      }}
                    >
                      <Ionicons name="checkmark-done-circle" size={12} color="#10B981" />
                      <Text style={{ color: '#34D399', fontSize: 11, fontWeight: '700' }}>
                        All Packages ({packageCount})
                      </Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                      {addon.packageNames!.slice(0, 2).map((pName, idx) => (
                        <View
                          key={idx}
                          style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.12)',
                            borderWidth: 1,
                            borderColor: 'rgba(239, 68, 68, 0.35)',
                            borderRadius: 4,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                          }}
                        >
                          <Text style={{ color: '#FCA5A5', fontSize: 10, fontWeight: '700' }} numberOfLines={1}>
                            {pName.replace(/\s+Package$/i, '')}
                          </Text>
                        </View>
                      ))}
                      {packageCount > 2 && (
                        <View
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            borderRadius: 4,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                          }}
                        >
                          <Text style={{ color: '#E5E7EB', fontSize: 10, fontWeight: '700' }}>
                            +{packageCount - 2} more
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
                <Text style={[styles.td, { flex: 0.8, color: '#22C55E', fontWeight: '800', paddingRight: 4 }]}>
                  ${addon.customerPrice.toFixed(2)}
                </Text>
                <Text style={[styles.td, { flex: 0.8, color: '#F59E0B', fontWeight: '800', paddingRight: 4 }]}>
                  ${addon.dealerPrice.toFixed(2)}
                </Text>
                <View style={{ flex: 0.8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={[styles.td, styles.textWhite, { fontWeight: '800', minWidth: 16 }]}>{addon.displayOrder}</Text>
                  <View style={{ flexDirection: 'column', gap: 2 }}>
                    <TouchableOpacity
                      style={styles.orderSmallBtn}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                      onPress={() => handleQuickReorderAddon(addon, -1)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chevron-up" size={12} color={C.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.orderSmallBtn}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                      onPress={() => handleQuickReorderAddon(addon, 1)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chevron-down" size={12} color={C.white} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ flex: 0.7, paddingRight: 6 }}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => handleToggleAddonStatus(addon)}
                    style={[
                      styles.statusBadge,
                      addon.isActive ? styles.statusBadgeOn : styles.statusBadgeOff,
                      { cursor: 'pointer', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' } as any,
                    ]}
                  >
                    <Ionicons
                      name={addon.isActive ? 'checkmark-circle' : 'close-circle'}
                      size={12}
                      color={addon.isActive ? '#22C55E' : '#EF4444'}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.statusBadgeText, addon.isActive ? { color: '#22C55E' } : { color: '#EF4444' }]}>
                      {addon.isActive ? 'Active' : 'Inactive'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.actionRow, { flex: 0.7 }]}>
                  <TouchableOpacity
                    style={styles.btnAction}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => {
                      setEditingAddon(addon);
                      setAdCode(addon.addonCode);
                      setAdName(addon.addonName);
                      setAdCategory(addon.category);
                      setAdCustomerPrice(String(addon.customerPrice));
                      setAdDealerPrice(String(addon.dealerPrice));
                      setAdDesc(addon.description || '');
                      setAdOrder(String(addon.displayOrder));
                      setAdActive(addon.isActive);
                      setAdPackageIds(addon.packageIds || []);
                      setAddonModalOpen(true);
                    }}
                  >
                    <Ionicons name="create-outline" size={16} color="#3B82F6" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnAction}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => handleDeleteAddon(addon.addonId)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {filteredAddons.length === 0 && (
            <View style={{ paddingVertical: 45, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="search-outline" size={36} color={C.textMuted} style={{ marginBottom: 8 }} />
              <Text style={{ color: C.white, fontSize: 14, fontWeight: '700' }}>
                No À La Carte Services Found
              </Text>
              <Text style={{ color: C.textSec, fontSize: 12, marginTop: 4 }}>
                {addonSearch
                  ? `No services match "${addonSearch}". Try searching by service name, code, or package name.`
                  : 'No services match the selected category filter.'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Tab 3d: Washing Bays */}
      {settingsTab === 'BAYS' && (
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderAction}>
            <Text style={styles.cardHeading}>Washing Bays</Text>
            <Pressable
              style={styles.btnPrimary}
              onPress={() => {
                setEditingBay(null);
                setBNum(String((bays.length || 5) + 1));
                setBName(`BAY ${(bays.length || 5) + 1}`);
                setBType('CAR WASH');
                setBStatus('AVAILABLE');
                setBRemarks('');
                setBayModalOpen(true);
              }}
            >
              <Ionicons name="add" size={16} color={C.white} />
              <Text style={styles.btnPrimaryText}>Add Washing Bay</Text>
            </Pressable>
          </View>

          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 0.8 }]}>BAY #</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>BAY NAME</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>BAY TYPE</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>STATUS</Text>
            <Text style={[styles.th, { flex: 2 }]}>REMARKS</Text>
            <Text style={[styles.th, { flex: 1 }]}>ACTIONS</Text>
          </View>

          {bays.map((b) => (
            <View key={b.bayNumber} style={styles.tableRow}>
              <Text style={[styles.td, styles.textAccent, { flex: 0.8, fontWeight: '800' }]}>{b.bayNumber}</Text>
              <Text style={[styles.td, styles.textWhite, { flex: 1.5, fontWeight: '700' }]}>{b.bayName}</Text>
              <Text style={[styles.td, styles.textSec, { flex: 1.2 }]}>{b.bayType}</Text>
              <View style={{ flex: 1.2 }}>
                <View
                  style={[
                    styles.statusBadge,
                    b.bayStatus === 'AVAILABLE' ? styles.statusBadgeOn : styles.statusBadgeOff,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      b.bayStatus === 'AVAILABLE' ? { color: '#22C55E' } : { color: '#EF4444' },
                    ]}
                  >
                    {b.bayStatus}
                  </Text>
                </View>
              </View>
              <Text style={[styles.td, styles.textSec, { flex: 2 }]}>{b.remarks || '-'}</Text>
              <View style={[styles.actionRow, { flex: 1 }]}>
                <TouchableOpacity
                  style={styles.btnAction}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => {
                    setEditingBay(b);
                    setBNum(String(b.bayNumber));
                    setBName(b.bayName);
                    setBType(b.bayType);
                    setBStatus(b.bayStatus);
                    setBRemarks(b.remarks || '');
                    setBayModalOpen(true);
                  }}
                >
                  <Ionicons name="create-outline" size={16} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnAction}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => handleDeleteBay(b.bayNumber)}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Tab: Dealers */}
      {settingsTab === 'DEALERS' && (
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderAction}>
            <View>
              <Text style={styles.cardHeading}>Dealer Accounts</Text>
              <Text style={styles.cardSubhead}>
                Manage commercial dealer accounts, unique IDs, contact details, and custom logos
              </Text>
            </View>
            <Pressable
              style={styles.btnPrimary}
              onPress={() => {
                setEditingDealer(null);
                setDCode(`DLR-${String((dealers.length || 0) + 1).padStart(2, '0')}`);
                setDName('');
                setDPhone('');
                setDContactPerson('');
                setDAddress('');
                setDPin('1234');
                setDLogo('');
                setDActive(true);
                setDealerModalOpen(true);
              }}
            >
              <Ionicons name="add" size={16} color={C.white} />
              <Text style={styles.btnPrimaryText}>Add Dealer</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ width: '100%' }} contentContainerStyle={{ minWidth: 980, flexDirection: 'column' }}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: 70, paddingRight: 8 }]}>LOGO</Text>
              <TouchableOpacity
                style={{ width: 120, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                onPress={() => {
                  if (dealerSortField === 'code') {
                    setDealerSortAsc((prev) => !prev);
                  } else {
                    setDealerSortField('code');
                    setDealerSortAsc(true);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.th, { color: dealerSortField === 'code' ? C.accent : C.textMuted, fontWeight: '800' }]}>
                  UNIQUE ID
                </Text>
                <Ionicons
                  name={
                    dealerSortField === 'code'
                      ? dealerSortAsc
                        ? 'arrow-up'
                        : 'arrow-down'
                      : 'swap-vertical-outline'
                  }
                  size={13}
                  color={dealerSortField === 'code' ? C.accent : C.textMuted}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={{ width: 200, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                onPress={() => {
                  if (dealerSortField === 'name') {
                    setDealerSortAsc((prev) => !prev);
                  } else {
                    setDealerSortField('name');
                    setDealerSortAsc(true);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.th, { color: dealerSortField === 'name' ? C.accent : C.textMuted, fontWeight: '800' }]}>
                  DEALER NAME
                </Text>
                <Ionicons
                  name={
                    dealerSortField === 'name'
                      ? dealerSortAsc
                        ? 'arrow-up'
                        : 'arrow-down'
                      : 'swap-vertical-outline'
                  }
                  size={13}
                  color={dealerSortField === 'name' ? C.accent : C.textMuted}
                />
              </TouchableOpacity>
              <Text style={[styles.th, { width: 130, paddingRight: 8 }]}>CONTACT NO</Text>
              <Text style={[styles.th, { flex: 1, minWidth: 200, paddingRight: 8 }]}>ADDRESS</Text>
              <Text style={[styles.th, { width: 80, paddingRight: 8 }]}>PIN</Text>
              <Text style={[styles.th, { width: 95, textAlign: 'center', paddingRight: 8 }]}>STATUS</Text>
              <Text style={[styles.th, { width: 85, textAlign: 'center' }]}>ACTIONS</Text>
            </View>

            {[...dealers]
              .sort((a, b) => {
                if (dealerSortField === 'code') {
                  const codeA = (a.uniqueCode || '').trim();
                  const codeB = (b.uniqueCode || '').trim();
                  const cmp = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
                  return dealerSortAsc ? cmp : -cmp;
                } else {
                  const nameA = (a.dealerName || '').trim();
                  const nameB = (b.dealerName || '').trim();
                  const cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
                  return dealerSortAsc ? cmp : -cmp;
                }
              })
              .map((d) => (
              <View key={d.dealerId || d.uniqueCode} style={styles.tableRow}>
                {/* Logo Column */}
                <View style={{ width: 70, justifyContent: 'center', paddingRight: 8 }}>
                  <BackofficeImageThumb
                    uri={d.logoUrl}
                    fallbackKey={d.dealerName}
                    type="dealer"
                    style={styles.tableThumb}
                    resizeMode="contain"
                  />
                </View>

                {/* Unique ID */}
                <Text style={[styles.td, styles.textAccent, { width: 120, paddingRight: 8, fontWeight: '800' }]} numberOfLines={1}>
                  {d.uniqueCode}
                </Text>

                {/* Dealer Name */}
                <View style={{ width: 200, justifyContent: 'center', paddingRight: 8 }}>
                  <Text style={[styles.td, styles.textWhite, { fontWeight: '700' }]} numberOfLines={1}>{d.dealerName}</Text>
                  {d.contactPerson ? (
                    <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }} numberOfLines={1}>
                      Attn: {d.contactPerson}
                    </Text>
                  ) : null}
                </View>

                {/* Contact Number */}
                <Text style={[styles.td, styles.textSec, { width: 130, paddingRight: 8 }]} numberOfLines={1}>
                  {d.contactNumber || '-'}
                </Text>

                {/* Address */}
                <Text style={[styles.td, styles.textSec, { flex: 1, minWidth: 200, paddingRight: 8 }]} numberOfLines={2}>
                  {d.address || '-'}
                </Text>

                {/* Security PIN */}
                <Text style={[styles.td, styles.textSec, { width: 80, paddingRight: 8, letterSpacing: 2, fontFamily: 'monospace' }]}>
                  {d.securityPin || '1234'}
                </Text>

                {/* Status Toggle Button */}
                <View style={{ width: 95, paddingRight: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => handleToggleDealerStatus(d)}
                    style={[
                      styles.statusBadge,
                      d.isActive ? styles.statusBadgeOn : styles.statusBadgeOff,
                      { cursor: 'pointer', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minWidth: 78 } as any,
                    ]}
                  >
                    <Ionicons
                      name={d.isActive ? 'checkmark-circle' : 'close-circle'}
                      size={12}
                      color={d.isActive ? '#22C55E' : '#EF4444'}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.statusBadgeText, d.isActive ? { color: '#22C55E' } : { color: '#EF4444' }]}>
                      {d.isActive ? 'Active' : 'Inactive'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Actions */}
                <View style={[styles.actionRow, { width: 85, justifyContent: 'center' }]}>
                  <TouchableOpacity
                    style={styles.btnAction}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => {
                      setEditingDealer(d);
                      setDCode(d.uniqueCode);
                      setDName(d.dealerName);
                      setDPhone(d.contactNumber || '');
                      setDContactPerson(d.contactPerson || '');
                      setDAddress(d.address || '');
                      setDPin(d.securityPin || '1234');
                      setDLogo(d.logoUrl || '');
                      setDActive(d.isActive);
                      setDealerModalOpen(true);
                    }}
                  >
                    <Ionicons name="create-outline" size={16} color="#3B82F6" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnAction}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => handleDeleteDealer(d.dealerId || d.uniqueCode)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          {dealers.length === 0 && !settingsLoading && (
            <View style={{ padding: 30, alignItems: 'center' }}>
              <Text style={{ color: C.textMuted, fontSize: 13 }}>
                No dealers registered yet. Click "+ Add Dealer" to create one.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Tab 3e2: Kiosk Account Types */}
      {settingsTab === 'ACCOUNT_TYPES' && (
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderAction}>
            <View>
              <Text style={styles.cardHeading}>Kiosk Account Types</Text>
              <Text style={styles.cardSubhead}>
                Manage welcome screen customer/dealer account cards, names, descriptions, order, and badges
              </Text>
            </View>
            <Pressable
              style={styles.btnPrimary}
              onPress={() => {
                setEditingAccountType(null);
                setAtCode('');
                setAtName('');
                setAtDesc('');
                setAtIcon('car-sport');
                setAtOrder(String((accountTypesList.length || 0) + 1));
                setAtActive(true);
                setAtImage('');
                setAtModalError('');
                setAccountTypeModalOpen(true);
              }}
            >
              <Ionicons name="add" size={16} color={C.white} />
              <Text style={styles.btnPrimaryText}>Add Account Type</Text>
            </Pressable>
          </View>

          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 0.6 }]}>NO</Text>
            <Text style={[styles.th, { flex: 0.9 }]}>IMAGE / ICON</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>CODE</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>TYPE NAME</Text>
            <Text style={[styles.th, { flex: 2.2 }]}>DESCRIPTION</Text>
            <Text style={[styles.th, { flex: 0.8 }]}>ORDER</Text>
            <Text style={[styles.th, { flex: 1 }]}>STATUS</Text>
            <Text style={[styles.th, { flex: 1 }]}>ACTIONS</Text>
          </View>

          {accountTypesList.map((at, idx) => (
            <View key={String(at.accountTypeId || at.code || idx)} style={styles.tableRow}>
              {/* No / ID */}
              <Text style={[styles.td, styles.textSec, { flex: 0.6, fontWeight: '700' }]}>
                {at.displayOrder ?? idx + 1}
              </Text>

              {/* Logo / Icon */}
              <View style={{ flex: 0.9, justifyContent: 'center' }}>
                <BackofficeImageThumb
                  uri={at.imageUrl}
                  fallbackKey={at.code}
                  type="account"
                  style={styles.tableThumb}
                  resizeMode="contain"
                />
              </View>

              {/* Code */}
              <Text style={[styles.td, styles.textAccent, { flex: 1.2, fontWeight: '800' }]}>
                {at.code}
              </Text>

              {/* Name */}
              <Text style={[styles.td, styles.textWhite, { flex: 1.5, fontWeight: '700' }]}>
                {at.name}
              </Text>

              {/* Description */}
              <Text style={[styles.td, styles.textSec, { flex: 2.2 }]} numberOfLines={2}>
                {at.description || <Text style={{ fontStyle: 'italic', color: C.textMuted }}>No description</Text>}
              </Text>

              {/* Order */}
              <Text style={[styles.td, styles.textSec, { flex: 0.8 }]}>
                {at.displayOrder ?? 1}
              </Text>

              {/* Status */}
              <View style={{ flex: 1 }}>
                <View style={[styles.statusBadge, at.isActive ? styles.statusBadgeOn : styles.statusBadgeOff]}>
                  <Text style={[styles.statusBadgeText, at.isActive ? { color: '#22C55E' } : { color: '#EF4444' }]}>
                    {at.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View style={[styles.actionRow, { flex: 1 }]}>
                <TouchableOpacity
                  style={styles.btnAction}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => {
                    setEditingAccountType(at);
                    setAtCode(at.code);
                    setAtName(at.name);
                    setAtDesc(at.description || '');
                    setAtIcon(at.iconName || (at.code === 'DEALER' ? 'business' : 'car-sport'));
                    setAtOrder(String(at.displayOrder ?? 1));
                    setAtActive(at.isActive);
                    setAtImage(at.imageUrl || '');
                    setAtModalError('');
                    setAccountTypeModalOpen(true);
                  }}
                >
                  <Ionicons name="create-outline" size={16} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.btnAction} 
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => handleDeleteAccountType(at.accountTypeId, at.name)}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {accountTypesList.length === 0 && !settingsLoading && (
            <View style={{ padding: 30, alignItems: 'center' }}>
              <Text style={{ color: C.textMuted, fontSize: 13 }}>
                No account types found. Click "+ Add Account Type" to create one.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Tab 3e: Company Profile */}
      {settingsTab === 'COMPANY' && (
        <View style={styles.glassCard}>
          <Text style={styles.cardHeading}>Company & Tax Settings</Text>
          <Text style={styles.cardSubhead}>Applied to receipts, GST calculations, and official kiosk tickets</Text>

          <View style={{ marginTop: 20, gap: 14 }}>
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>COMPANY NAME</Text>
              <TextInput style={styles.fieldInput} value={compName} onChangeText={setCompName} />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>STATION ADDRESS</Text>
              <TextInput style={styles.fieldInput} value={compAddr} onChangeText={setCompAddr} multiline />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>PHONE</Text>
                <TextInput style={styles.fieldInput} value={compPhone} onChangeText={setCompPhone} />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>EMAIL</Text>
                <TextInput style={styles.fieldInput} value={compEmail} onChangeText={setCompEmail} />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>REPORT EMAIL (DAY END REPORTS)</Text>
              <TextInput
                style={styles.fieldInput}
                value={compReportEmail}
                onChangeText={setCompReportEmail}
                placeholder="e.g. reports@uniprosg.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>GST REGISTRATION NO</Text>
                <TextInput style={styles.fieldInput} value={compGstNo} onChangeText={setCompGstNo} />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>GST RATE (%)</Text>
                <TextInput style={styles.fieldInput} value={compGstRate} onChangeText={setCompGstRate} keyboardType="numeric" />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>CURRENCY CODE</Text>
                <TextInput style={styles.fieldInput} value={compCurrency} onChangeText={setCompCurrency} />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>CURRENCY SYMBOL</Text>
                <TextInput style={styles.fieldInput} value={compSymbol} onChangeText={setCompSymbol} />
              </View>
            </View>

            <Pressable style={[styles.btnPrimary, { alignSelf: 'flex-start', marginTop: 10 }]} onPress={handleSaveCompanyProfile} disabled={savingComp}>
              {savingComp ? <ActivityIndicator color={C.white} /> : <Text style={styles.btnPrimaryText}>Save Company Settings</Text>}
            </Pressable>
          </View>
        </View>
      )}

      {/* Tab 3f: Printers */}
      {settingsTab === 'PRINTERS' && (
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderAction}>
            <Text style={styles.cardHeading}>Hardware & Network Receipt Printers</Text>
            <Pressable
              style={styles.btnPrimary}
              onPress={() => {
                setEditingPrn(null);
                setPrnName('');
                setPrnIp('192.168.0.200');
                setPrnPort('9100');
                setPrnType(1);
                setPrnCopies('1');
                setPrinterModalOpen(true);
              }}
            >
              <Ionicons name="add" size={16} color={C.white} />
              <Text style={styles.btnPrimaryText}>Add Network Printer</Text>
            </Pressable>
          </View>

          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 1.5 }]}>PRINTER NAME</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>IP ADDRESS</Text>
            <Text style={[styles.th, { flex: 0.8 }]}>PORT</Text>
            <Text style={[styles.th, { flex: 0.8 }]}>COPIES</Text>
            <Text style={[styles.th, { flex: 1 }]}>STATUS</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>ACTIONS</Text>
          </View>

          {printersList.map((p) => (
            <View key={p.printerId} style={styles.tableRow}>
              <Text style={[styles.td, styles.textWhite, { flex: 1.5, fontWeight: '700' }]}>{p.printerName}</Text>
              <Text style={[styles.td, styles.textAccent, { flex: 1.5 }]}>{p.printerIP}</Text>
              <Text style={[styles.td, styles.textSec, { flex: 0.8 }]}>{p.printerPort}</Text>
              <Text style={[styles.td, styles.textSec, { flex: 0.8 }]}>{p.printCopy}</Text>
              <View style={{ flex: 1 }}>
                <View style={[styles.statusBadge, p.isActive ? styles.statusBadgeOn : styles.statusBadgeOff]}>
                  <Text style={[styles.statusBadgeText, p.isActive ? { color: '#22C55E' } : { color: '#EF4444' }]}>
                    {p.isActive ? 'Active' : 'Offline'}
                  </Text>
                </View>
              </View>
              <View style={[styles.actionRow, { flex: 1.5 }]}>
                <TouchableOpacity
                  style={styles.btnAction}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => handleTestPrinter(p)}
                >
                  <Ionicons name="print-outline" size={16} color="#10B981" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnAction}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => {
                    setEditingPrn(p);
                    setPrnName(p.printerName);
                    setPrnIp(p.printerIP);
                    setPrnPort(String(p.printerPort));
                    setPrnType(p.printerType);
                    setPrnCopies(String(p.printCopy));
                    setPrinterModalOpen(true);
                  }}
                >
                  <Ionicons name="create-outline" size={16} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnAction}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => handleDeletePrinter(p.printerId)}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Modals for Masters */}
      {/* Vehicle Type Modal */}
      <Modal visible={vehicleModalOpen} transparent animationType="fade" onRequestClose={() => setVehicleModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingVehicle ? 'Edit Vehicle Type' : 'Add Vehicle Type'}</Text>
              <Pressable onPress={() => setVehicleModalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={C.textSec} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScrollBody}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>CODE *</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={vCode}
                  onChangeText={setVCode}
                  autoCapitalize="characters"
                  placeholder="e.g. SEDAN"
                  placeholderTextColor={C.textSec}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>NAME *</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={vName}
                  onChangeText={setVName}
                  placeholder="e.g. Sedan"
                  placeholderTextColor={C.textSec}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>DESCRIPTION</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={vDesc}
                  onChangeText={setVDesc}
                  placeholder="Vehicle type description"
                  placeholderTextColor={C.textSec}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>DISPLAY ORDER</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={vOrder}
                  onChangeText={setVOrder}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={C.textSec}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>VEHICLE IMAGE</Text>
                <View style={styles.uploadRow}>
                  {vImage ? (
                    <View style={styles.previewBox}>
                      <Image source={{ uri: resolveApiUrl(vImage) }} style={styles.previewImg} resizeMode="contain" />
                      <Pressable style={styles.previewRemoveBtn} onPress={() => setVImage('')}>
                        <Ionicons name="trash" size={12} color="#EF4444" />
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.previewBoxPlaceholder}>
                      <Ionicons name="car-outline" size={24} color={C.textMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Pressable
                      style={styles.btnUpload}
                      onPress={() => handlePickImage((base64) => setVImage(base64))}
                    >
                      <Ionicons name="cloud-upload-outline" size={16} color={C.white} />
                      <Text style={styles.btnUploadText}>{vImage ? 'Change Image' : 'Upload Image'}</Text>
                    </Pressable>
                    <Text style={styles.uploadHint}>PNG, JPEG or SVG (stored in MSSQL)</Text>
                  </View>
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>STATUS</Text>
                <View style={styles.groupPickerRow}>
                  <Pressable
                    style={[
                      styles.groupPill,
                      vActive && { backgroundColor: '#16A34A', borderColor: '#22C55E' },
                    ]}
                    onPress={() => setVActive(true)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="checkmark-circle" size={15} color={vActive ? '#FFFFFF' : C.textSec} />
                      <Text style={[styles.groupPillText, vActive && { color: C.white, fontWeight: '700' }]}>
                        Active
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.groupPill,
                      !vActive && { backgroundColor: '#DC2626', borderColor: '#EF4444' },
                    ]}
                    onPress={() => setVActive(false)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="close-circle" size={15} color={!vActive ? '#FFFFFF' : C.textSec} />
                      <Text style={[styles.groupPillText, !vActive && { color: C.white, fontWeight: '700' }]}>
                        Inactive
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.btnSecondary} onPress={() => setVehicleModalOpen(false)}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnPrimary} onPress={handleSaveVehicleType}>
                <Text style={styles.btnPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Modal */}
      <Modal visible={categoryModalOpen} transparent animationType="fade" onRequestClose={() => setCategoryModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCategory ? 'Edit Category' : 'Add Category'}</Text>
              <Pressable onPress={() => setCategoryModalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={C.textSec} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScrollBody} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1.3 }]}>
                  <Text style={styles.fieldLabel}>CODE *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={cCode}
                    onChangeText={setCCode}
                    autoCapitalize="characters"
                    placeholder="e.g. CAR_WASH"
                    placeholderTextColor={C.textSec}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>SORT ORDER *</Text>
                  <View style={styles.orderStepperBox}>
                    <Pressable
                      style={styles.orderStepperBtn}
                      onPress={() => {
                        const val = Math.max(1, (parseInt(cOrder, 10) || 1) - 1);
                        setCOrder(String(val));
                      }}
                    >
                      <Ionicons name="remove" size={15} color={C.white} />
                    </Pressable>
                    <TextInput
                      style={styles.orderStepperInput}
                      value={cOrder}
                      onChangeText={setCOrder}
                      keyboardType="numeric"
                      textAlign="center"
                    />
                    <Pressable
                      style={styles.orderStepperBtn}
                      onPress={() => {
                        const val = (parseInt(cOrder, 10) || 1) + 1;
                        setCOrder(String(val));
                      }}
                    >
                      <Ionicons name="add" size={15} color={C.white} />
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>CATEGORY NAME *</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={cName}
                  onChangeText={setCName}
                  placeholder="e.g. Car Wash"
                  placeholderTextColor={C.textSec}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>DESCRIPTION</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={cDesc}
                  onChangeText={setCDesc}
                  placeholder="Optional category description"
                  placeholderTextColor={C.textSec}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>CATEGORY COVER / HERO IMAGE</Text>
                <View style={styles.uploadRow}>
                  {cImage ? (
                    <View style={styles.previewBox}>
                      <Image source={{ uri: resolveApiUrl(cImage) }} style={styles.previewImg} resizeMode="cover" />
                      <Pressable style={styles.previewRemoveBtn} onPress={() => setCImage('')}>
                        <Ionicons name="trash" size={12} color="#EF4444" />
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.previewBoxPlaceholder}>
                      <Ionicons name="image-outline" size={24} color={C.textMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Pressable
                      style={styles.btnUpload}
                      onPress={() => handlePickImage((base64) => setCImage(base64))}
                    >
                      <Ionicons name="cloud-upload-outline" size={16} color={C.white} />
                      <Text style={styles.btnUploadText}>{cImage ? 'Change Cover Image' : 'Upload Cover Image'}</Text>
                    </Pressable>
                    <Text style={styles.uploadHint}>Top banner image displayed on Kiosk category card</Text>
                  </View>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>CATEGORY EMBLEM / ICON</Text>
                <View style={styles.uploadRow}>
                  {cIcon ? (
                    <View style={[styles.previewBox, { width: 56, height: 56, borderRadius: 12 }]}>
                      <Image source={{ uri: resolveApiUrl(cIcon) }} style={[styles.previewImg, { width: 44, height: 44 }]} resizeMode="contain" />
                      <Pressable style={styles.previewRemoveBtn} onPress={() => setCIcon('')}>
                        <Ionicons name="trash" size={12} color="#EF4444" />
                      </Pressable>
                    </View>
                  ) : (
                    <View style={[styles.previewBoxPlaceholder, { width: 56, height: 56, borderRadius: 12 }]}>
                      <Ionicons name="sparkles-outline" size={22} color={C.textMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Pressable
                      style={styles.btnUpload}
                      onPress={() => handlePickImage((base64) => setCIcon(base64))}
                    >
                      <Ionicons name="cloud-upload-outline" size={16} color={C.white} />
                      <Text style={styles.btnUploadText}>{cIcon ? 'Change Icon' : 'Upload Icon'}</Text>
                    </Pressable>
                    <Text style={styles.uploadHint}>Emblem badge icon shown inside the category badge</Text>
                  </View>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>STATUS</Text>
                <View style={styles.groupPickerRow}>
                  <Pressable
                    style={[
                      styles.groupPill,
                      cActive && { backgroundColor: '#16A34A', borderColor: '#22C55E' },
                    ]}
                    onPress={() => setCActive(true)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="checkmark-circle" size={15} color={cActive ? '#FFFFFF' : C.textSec} />
                      <Text style={[styles.groupPillText, cActive && { color: C.white, fontWeight: '700' }]}>
                        Active
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.groupPill,
                      !cActive && { backgroundColor: '#DC2626', borderColor: '#EF4444' },
                    ]}
                    onPress={() => setCActive(false)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="close-circle" size={15} color={!cActive ? '#FFFFFF' : C.textSec} />
                      <Text style={[styles.groupPillText, !cActive && { color: C.white, fontWeight: '700' }]}>
                        Inactive
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.btnSecondary} onPress={() => setCategoryModalOpen(false)}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnPrimary} onPress={handleSaveCategory}>
                <Text style={styles.btnPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Package Modal */}
      <Modal visible={pkgModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingPkg ? 'Edit Package' : 'Add Service Package'}</Text>
              <Pressable onPress={() => setPkgModalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Ionicons name="close" size={22} color={C.textSec} /></Pressable>
            </View>
            <ScrollView style={styles.modalScrollBody} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>SERVICE CATEGORY</Text>
                <View style={styles.groupPickerRow}>
                  {categories.map((c) => (
                    <Pressable
                      key={c.serviceCategoryId}
                      style={[styles.groupPill, pCatId === c.serviceCategoryId && styles.groupPillActive]}
                      onPress={() => setPCatId(c.serviceCategoryId)}
                    >
                      <Text style={[styles.groupPillText, pCatId === c.serviceCategoryId && { color: C.white, fontWeight: '700' }]}>
                        {c.categoryName}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>CODE *</Text>
                  <TextInput style={styles.fieldInput} value={pCode} onChangeText={setPCode} autoCapitalize="characters" />
                </View>
                <View style={[styles.formGroup, { flex: 1.5 }]}>
                  <Text style={styles.fieldLabel}>NAME *</Text>
                  <TextInput style={styles.fieldInput} value={pName} onChangeText={setPName} />
                </View>
              </View>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1.2 }]}>
                  <Text style={styles.fieldLabel}>CUSTOMER PRICE ($) *</Text>
                  <TextInput style={styles.fieldInput} value={pPrice} onChangeText={setPPrice} keyboardType="numeric" />
                </View>
                <View style={[styles.formGroup, { flex: 1.2 }]}>
                  <Text style={styles.fieldLabel}>DEALER PRICE ($) *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={pDealerPrice}
                    onChangeText={setPDealerPrice}
                    keyboardType="numeric"
                    placeholder="e.g. 22.40"
                    placeholderTextColor={C.textSec}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>MINS</Text>
                  <TextInput style={styles.fieldInput} value={pDuration} onChangeText={setPDuration} keyboardType="numeric" />
                </View>
                <View style={[styles.formGroup, { flex: 0.9 }]}>
                  <Text style={styles.fieldLabel}>ORDER *</Text>
                  <TextInput style={[styles.fieldInput, { textAlign: 'center', fontWeight: '800' }]} value={pOrder} onChangeText={setPOrder} keyboardType="numeric" />
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>FEATURES (one per line)</Text>
                <TextInput style={[styles.fieldInput, { height: 70 }]} value={pFeatures} onChangeText={setPFeatures} multiline />
              </View>

              {/* Vehicle-Type Pricing Section */}
              {editingPkg && (
                <View style={styles.formGroup}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                    <Ionicons name="car-outline" size={16} color={C.textSec} />
                    <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>VEHICLE-TYPE PRICING</Text>
                    {pkgVehiclePricesLoading && <ActivityIndicator size="small" color={C.accent} />}
                  </View>

                  {pkgVehiclePrices.length === 0 && !pkgVehiclePricesLoading && (
                    <Text style={[styles.textSec, { fontSize: 12, fontStyle: 'italic' }]}>
                      No vehicle types found. Prices will be seeded from vehicle type master on first load.
                    </Text>
                  )}

                  {pkgVehiclePrices.length > 0 && (
                    <>
                      {/* Table header */}
                      <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8, marginBottom: 4 }}>
                        <Text style={[styles.th, { flex: 1.6 }]}>VEHICLE TYPE</Text>
                        <Text style={[styles.th, { flex: 1.2, textAlign: 'center' }]}>CUST PRICE ($)</Text>
                        <Text style={[styles.th, { flex: 1.2, textAlign: 'center' }]}>DEALER PRICE ($)</Text>
                        <Text style={[styles.th, { flex: 0.8, textAlign: 'center' }]}>SAVE</Text>
                      </View>

                      {pkgVehiclePrices.map((row, idx) => (
                        <VehiclePriceRow
                          key={row.vehicleTypeId}
                          row={row}
                          onChange={(custPrice, dlrPrice) => {
                            setPkgVehiclePrices((prev) =>
                              prev.map((r) =>
                                r.vehicleTypeId === row.vehicleTypeId
                                  ? { ...r, customerPrice: custPrice, dealerPrice: dlrPrice }
                                  : r
                              )
                            );
                          }}
                          onSave={async (custPrice, dlrPrice) => {
                            setPkgVehiclePricesSaving(true);
                            try {
                              const ok = await updateVehicleTypePrice(row.packageId, row.vehicleTypeId, custPrice, dlrPrice);
                              if (ok) {
                                setPkgVehiclePrices((prev) =>
                                  prev.map((r) =>
                                    r.vehicleTypeId === row.vehicleTypeId
                                      ? { ...r, customerPrice: custPrice, dealerPrice: dlrPrice }
                                      : r
                                  )
                                );
                              }
                            } finally {
                              setPkgVehiclePricesSaving(false);
                            }
                          }}
                          C={C}
                          styles={styles}
                        />
                      ))}
                    </>
                  )}
                </View>
              )}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>STATUS</Text>
                <View style={styles.groupPickerRow}>
                  <Pressable
                    style={[
                      styles.groupPill,
                      pActive && { backgroundColor: '#16A34A', borderColor: '#22C55E' },
                    ]}
                    onPress={() => setPActive(true)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="checkmark-circle" size={15} color={pActive ? '#FFFFFF' : C.textSec} />
                      <Text style={[styles.groupPillText, pActive && { color: C.white, fontWeight: '700' }]}>
                        Active
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.groupPill,
                      !pActive && { backgroundColor: '#DC2626', borderColor: '#EF4444' },
                    ]}
                    onPress={() => setPActive(false)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="close-circle" size={15} color={!pActive ? '#FFFFFF' : C.textSec} />
                      <Text style={[styles.groupPillText, !pActive && { color: C.white, fontWeight: '700' }]}>
                        Inactive
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable style={styles.btnSecondary} onPress={() => setPkgModalOpen(false)}><Text style={styles.btnSecondaryText}>Cancel</Text></Pressable>
              <Pressable
                style={[styles.btnPrimary, pkgSaving && { opacity: 0.6 }]}
                disabled={pkgSaving}
                onPress={handleSavePackage}
              >
                {pkgSaving ? (
                  <ActivityIndicator size="small" color={C.white} />
                ) : (
                  <Text style={styles.btnPrimaryText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Standalone Vehicle Rates Modal */}
      <Modal visible={ratesModalOpen} transparent animationType="fade" onRequestClose={() => setRatesModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 650 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="car-sport" size={20} color={C.accent} />
                <View>
                  <Text style={styles.modalTitle}>
                    {ratesPkg ? `${ratesPkg.packageName} — Rates` : 'Vehicle-Type Pricing'}
                  </Text>
                  {ratesPkg?.packageCode ? (
                    <Text style={{ color: C.textSec, fontSize: 12 }}>
                      Code: {ratesPkg.packageCode} | Category: {ratesPkg.serviceCategoryName || 'Wash'}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Pressable onPress={() => setRatesModalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={C.textSec} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScrollBody} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              {ratesLoading ? (
                <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="large" color={C.accent} />
                  <Text style={[styles.textSec, { marginTop: 12 }]}>Loading rates from database...</Text>
                </View>
              ) : ratesList.length === 0 ? (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <Text style={[styles.textSec, { fontStyle: 'italic' }]}>
                    No vehicle rates configured for this package yet.
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: 4 }}>
                  <Text style={[styles.textSec, { fontSize: 12, marginBottom: 12 }]}>
                    Configure separate walk-in Customer Price and Dealer Price for each vehicle type. Changes take effect on Kiosk and POS immediately.
                  </Text>
                  {/* Table Header */}
                  <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6 }}>
                    <Text style={[styles.th, { flex: 1.8 }]}>VEHICLE TYPE</Text>
                    <Text style={[styles.th, { flex: 1.2, textAlign: 'center' }]}>CUSTOMER ($)</Text>
                    <Text style={[styles.th, { flex: 1.2, textAlign: 'center' }]}>DEALER ($)</Text>
                    <Text style={[styles.th, { flex: 0.8, textAlign: 'center' }]}>ACTION</Text>
                  </View>

                  {ratesList.map((row) => (
                    <VehiclePriceRow
                      key={row.vehicleTypeId}
                      row={row}
                      onChange={(custPrice, dlrPrice) => {
                        setRatesList((prev) =>
                          prev.map((r) =>
                            r.vehicleTypeId === row.vehicleTypeId
                              ? { ...r, customerPrice: custPrice, dealerPrice: dlrPrice }
                              : r
                          )
                        );
                      }}
                      onSave={async (custPrice, dlrPrice) => {
                        if (!ratesPkg) return;
                        setRatesSaving(true);
                        try {
                          await updateVehicleTypePrice(ratesPkg.packageId, row.vehicleTypeId, custPrice, dlrPrice);
                          setRatesList((prev) =>
                            prev.map((r) =>
                              r.vehicleTypeId === row.vehicleTypeId
                                ? { ...r, customerPrice: custPrice, dealerPrice: dlrPrice }
                                : r
                            )
                          );
                        } finally {
                          setRatesSaving(false);
                        }
                      }}
                      C={C}
                      styles={styles}
                    />
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.btnSecondary} onPress={() => setRatesModalOpen(false)}>
                <Text style={styles.btnSecondaryText}>Close</Text>
              </Pressable>
              <Pressable
                style={[styles.btnPrimary, ratesSaving && { opacity: 0.6 }]}
                disabled={ratesSaving}
                onPress={async () => {
                  if (ratesPkg && ratesList.length > 0) {
                    setRatesSaving(true);
                    try {
                      await Promise.all(
                        ratesList.map((r) =>
                          updateVehicleTypePrice(
                            ratesPkg.packageId,
                            r.vehicleTypeId,
                            r.customerPrice,
                            r.dealerPrice
                          )
                        )
                      );
                      showAlert('Success', 'All vehicle-type rates saved successfully.');
                    } catch (err: any) {
                      showAlert('Error', 'Failed to save some rates.');
                    } finally {
                      setRatesSaving(false);
                    }
                  }
                  setRatesModalOpen(false);
                }}
              >
                {ratesSaving ? (
                  <ActivityIndicator size="small" color={C.white} />
                ) : (
                  <Text style={styles.btnPrimaryText}>Save & Close</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Addon Modal */}
      <Modal visible={addonModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingAddon ? 'Edit À La Carte Service' : 'Add À La Carte Service'}</Text>
              <Pressable onPress={() => setAddonModalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={C.textSec} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScrollBody} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>CATEGORY *</Text>
                <View style={styles.groupPickerRow}>
                  {(['EXTERIOR', 'INTERIOR'] as const).map((cat) => (
                    <Pressable
                      key={cat}
                      style={[styles.groupPill, adCategory === cat && styles.groupPillActive]}
                      onPress={() => setAdCategory(cat)}
                    >
                      <Text style={[styles.groupPillText, adCategory === cat && { color: C.white, fontWeight: '700' }]}>
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>CODE *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={adCode}
                    onChangeText={setAdCode}
                    autoCapitalize="characters"
                    placeholder="e.g. WATER_WAX"
                    placeholderTextColor={C.textSec}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1.5 }]}>
                  <Text style={styles.fieldLabel}>SERVICE NAME *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={adName}
                    onChangeText={setAdName}
                    placeholder="e.g. Water Wax Finish"
                    placeholderTextColor={C.textSec}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>CUSTOMER PRICE ($) *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={adCustomerPrice}
                    onChangeText={setAdCustomerPrice}
                    keyboardType="numeric"
                    placeholder="10.00"
                    placeholderTextColor={C.textSec}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>DEALER PRICE ($) *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={adDealerPrice}
                    onChangeText={setAdDealerPrice}
                    keyboardType="numeric"
                    placeholder="7.50"
                    placeholderTextColor={C.textSec}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>DISPLAY ORDER</Text>
                  <TextInput
                    style={[styles.fieldInput, { textAlign: 'center', fontWeight: '800' }]}
                    value={adOrder}
                    onChangeText={setAdOrder}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Applicable Packages Multi-Select */}
              <View style={styles.formGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.fieldLabel}>
                    APPLICABLE PACKAGES ({adPackageIds.length} of {packages.length} selected)
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => setAdPackageIds(packages.map((p) => p.packageId))}
                      style={{ paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4, backgroundColor: 'rgba(239, 68, 68, 0.2)' }}
                    >
                      <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}>Select All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setAdPackageIds([])}
                      style={{ paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4, backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                    >
                      <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '700' }}>Clear All</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View
                  style={{
                    backgroundColor: '#1E1E28',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#2E2E3E',
                    padding: 8,
                    maxHeight: 180,
                  }}
                >
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {packages.map((pkg) => {
                        const isSelected = adPackageIds.includes(pkg.packageId);
                        return (
                          <TouchableOpacity
                            key={pkg.packageId}
                            activeOpacity={0.7}
                            onPress={() => {
                              setAdPackageIds((prev) =>
                                prev.includes(pkg.packageId)
                                  ? prev.filter((id) => id !== pkg.packageId)
                                  : [...prev, pkg.packageId]
                              );
                            }}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                              paddingVertical: 6,
                              paddingHorizontal: 10,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: isSelected ? '#EF4444' : '#374151',
                              backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                              minWidth: '47%',
                              flexGrow: 1,
                            }}
                          >
                            <Ionicons
                              name={isSelected ? 'checkbox' : 'square-outline'}
                              size={18}
                              color={isSelected ? '#EF4444' : '#9CA3AF'}
                            />
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  color: isSelected ? '#FFFFFF' : '#D1D5DB',
                                  fontSize: 12,
                                  fontWeight: isSelected ? '700' : '500',
                                }}
                                numberOfLines={1}
                              >
                                {pkg.packageName}
                              </Text>
                              <Text style={{ color: '#9CA3AF', fontSize: 10 }}>
                                {pkg.packageCode} • ${pkg.price?.toFixed(2)}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
                <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
                  * This add-on service will only be offered to customers who choose one of the selected packages.
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>DESCRIPTION</Text>
                <TextInput
                  style={[styles.fieldInput, { height: 60 }]}
                  value={adDesc}
                  onChangeText={setAdDesc}
                  multiline
                  placeholder="Brief customer-friendly description of this add-on..."
                  placeholderTextColor={C.textSec}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>STATUS</Text>
                <View style={styles.groupPickerRow}>
                  <Pressable
                    style={[styles.groupPill, adActive && styles.groupPillActive]}
                    onPress={() => setAdActive(true)}
                  >
                    <Text style={[styles.groupPillText, adActive && { color: C.white, fontWeight: '700' }]}>Active</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.groupPill, !adActive && styles.groupPillActive]}
                    onPress={() => setAdActive(false)}
                  >
                    <Text style={[styles.groupPillText, !adActive && { color: C.white, fontWeight: '700' }]}>Inactive</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.btnSecondary} onPress={() => setAddonModalOpen(false)}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnPrimary} onPress={handleSaveAddon}>
                <Text style={styles.btnPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bay Modal */}
      <Modal visible={bayModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingBay ? 'Edit Washing Bay' : 'Add Washing Bay'}</Text>
              <Pressable onPress={() => setBayModalOpen(false)}><Ionicons name="close" size={22} color={C.textSec} /></Pressable>
            </View>
            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>BAY NUMBER *</Text>
                <TextInput
                  style={[styles.fieldInput, editingBay && { opacity: 0.6 }]}
                  value={bNum}
                  onChangeText={setBNum}
                  keyboardType="numeric"
                  editable={!editingBay}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1.5 }]}>
                <Text style={styles.fieldLabel}>BAY NAME</Text>
                <TextInput style={styles.fieldInput} value={bName} onChangeText={setBName} />
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>STATUS</Text>
              <View style={styles.groupPickerRow}>
                {['AVAILABLE', 'IN_SERVICE', 'CLEANING', 'MAINTENANCE'].map((st) => (
                  <Pressable
                    key={st}
                    style={[styles.groupPill, bStatus === st && styles.groupPillActive]}
                    onPress={() => setBStatus(st)}
                  >
                    <Text style={[styles.groupPillText, bStatus === st && { color: C.white, fontWeight: '700' }]}>{st}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>REMARKS</Text>
              <TextInput style={styles.fieldInput} value={bRemarks} onChangeText={setBRemarks} />
            </View>
            <View style={styles.modalFooter}>
              <Pressable style={styles.btnSecondary} onPress={() => setBayModalOpen(false)}><Text style={styles.btnSecondaryText}>Cancel</Text></Pressable>
              <Pressable style={styles.btnPrimary} onPress={handleSaveBay}><Text style={styles.btnPrimaryText}>Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Printer Modal */}
      <Modal visible={printerModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingPrn ? 'Edit Printer' : 'Add Printer'}</Text>
              <Pressable onPress={() => setPrinterModalOpen(false)}><Ionicons name="close" size={22} color={C.textSec} /></Pressable>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>PRINTER NAME *</Text>
              <TextInput style={styles.fieldInput} value={prnName} onChangeText={setPrnName} placeholder="e.g. Cashier Counter 1" />
            </View>
            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 2 }]}>
                <Text style={styles.fieldLabel}>IP ADDRESS *</Text>
                <TextInput style={styles.fieldInput} value={prnIp} onChangeText={setPrnIp} placeholder="192.168.0.200" />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>PORT</Text>
                <TextInput style={styles.fieldInput} value={prnPort} onChangeText={setPrnPort} keyboardType="numeric" />
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>PRINT COPIES</Text>
              <TextInput style={styles.fieldInput} value={prnCopies} onChangeText={setPrnCopies} keyboardType="numeric" />
            </View>
            <View style={styles.modalFooter}>
              <Pressable style={styles.btnSecondary} onPress={() => setPrinterModalOpen(false)}><Text style={styles.btnSecondaryText}>Cancel</Text></Pressable>
              <Pressable style={styles.btnPrimary} onPress={handleSavePrinter}><Text style={styles.btnPrimaryText}>Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Dealer Modal */}
      <Modal visible={dealerModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 540 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingDealer ? 'Edit Dealer Account' : 'Add New Dealer Account'}</Text>
              <Pressable onPress={() => setDealerModalOpen(false)}>
                <Ionicons name="close" size={22} color={C.textSec} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 520 }}>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1.2 }]}>
                  <Text style={styles.fieldLabel}>UNIQUE DEALER ID / CODE *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={dCode}
                    onChangeText={setDCode}
                    placeholder="e.g. DLR-A-01"
                    autoCapitalize="characters"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 0.8 }]}>
                  <Text style={styles.fieldLabel}>SECURITY PIN *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={dPin}
                    onChangeText={setDPin}
                    placeholder="4 digits"
                    maxLength={6}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>DEALER / COMPANY NAME *</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={dName}
                  onChangeText={setDName}
                  placeholder="e.g. Dealer A - Apex Automotive"
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>CONTACT NUMBER *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={dPhone}
                    onChangeText={setDPhone}
                    placeholder="+65 9123 4567"
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>CONTACT PERSON</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={dContactPerson}
                    onChangeText={setDContactPerson}
                    placeholder="e.g. David Tan"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>DEALER ADDRESS *</Text>
                <TextInput
                  style={[styles.fieldInput, { height: 60, textAlignVertical: 'top' }]}
                  value={dAddress}
                  onChangeText={setDAddress}
                  placeholder="e.g. 10 Toh Guan Road, #01-02, Singapore 608838"
                  multiline
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>DEALER LOGO IMAGE</Text>
                <View style={styles.uploadRow}>
                  {dLogo ? (
                    <View style={styles.previewBox}>
                      <Image source={{ uri: resolveApiUrl(dLogo) }} style={styles.previewImg} resizeMode="contain" />
                      <Pressable style={styles.previewRemoveBtn} onPress={() => setDLogo('')}>
                        <Ionicons name="trash" size={12} color="#EF4444" />
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.previewBoxPlaceholder}>
                      <Ionicons name="business-outline" size={24} color={C.textMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Pressable
                      style={styles.btnUpload}
                      onPress={() => handlePickImage((base64) => setDLogo(base64))}
                    >
                      <Ionicons name="cloud-upload-outline" size={16} color={C.white} />
                      <Text style={styles.btnUploadText}>{dLogo ? 'Change Logo' : 'Upload Logo Image'}</Text>
                    </Pressable>
                    <Text style={styles.uploadHint}>PNG, JPEG or SVG (stored in MSSQL / cloud)</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.formGroup, { marginTop: 4 }]}>
                <Text style={styles.fieldLabel}>ACCOUNT STATUS</Text>
                <View style={styles.groupPickerRow}>
                  <Pressable
                    style={[styles.groupPill, dActive && styles.groupPillActive]}
                    onPress={() => setDActive(true)}
                  >
                    <Text style={[styles.groupPillText, dActive && { color: C.white, fontWeight: '700' }]}>Active</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.groupPill, !dActive && styles.groupPillActive]}
                    onPress={() => setDActive(false)}
                  >
                    <Text style={[styles.groupPillText, !dActive && { color: C.white, fontWeight: '700' }]}>Inactive</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.btnSecondary} onPress={() => setDealerModalOpen(false)}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnPrimary} onPress={handleSaveDealer}>
                <Text style={styles.btnPrimaryText}>Save Dealer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Account Type Modal */}
      <Modal visible={accountTypeModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 520 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAccountType ? 'Edit Kiosk Account Type' : 'Add Kiosk Account Type'}
              </Text>
              <Pressable onPress={() => setAccountTypeModalOpen(false)}>
                <Ionicons name="close" size={22} color={C.textSec} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              {atModalError ? (
                <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: '#EF4444', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                  <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}>{atModalError}</Text>
                </View>
              ) : null}

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>TYPE CODE *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={atCode}
                    onChangeText={setAtCode}
                    placeholder="e.g. CUSTOMER, DEALER"
                    autoCapitalize="characters"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 0.8 }]}>
                  <Text style={styles.fieldLabel}>DISPLAY ORDER</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={atOrder}
                    onChangeText={setAtOrder}
                    keyboardType="numeric"
                    placeholder="1"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>DISPLAY NAME *</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={atName}
                  onChangeText={setAtName}
                  placeholder="e.g. CUSTOMER or DEALER"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>DESCRIPTION (OPTIONAL)</Text>
                <TextInput
                  style={[styles.fieldInput, { height: 60, textAlignVertical: 'top' }]}
                  value={atDesc}
                  onChangeText={setAtDesc}
                  placeholder="Subheading shown on kiosk card (leave blank to center the title)"
                  multiline
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>EMBLEM ICON</Text>
                <View style={[styles.groupPickerRow, { flexWrap: 'wrap', gap: 6 }]}>
                  {[
                    { id: 'car-sport', label: 'Car' },
                    { id: 'business', label: 'Dealer/Building' },
                    { id: 'shield-checkmark', label: 'Shield' },
                    { id: 'sparkles', label: 'Sparkles' },
                    { id: 'people', label: 'People' },
                    { id: 'briefcase', label: 'Corporate' },
                  ].map((ic) => (
                    <Pressable
                      key={ic.id}
                      style={[styles.groupPill, atIcon === ic.id && styles.groupPillActive]}
                      onPress={() => setAtIcon(ic.id)}
                    >
                      <Ionicons name={ic.id as any} size={13} color={atIcon === ic.id ? C.white : C.textSec} style={{ marginRight: 4 }} />
                      <Text style={[styles.groupPillText, atIcon === ic.id && { color: C.white, fontWeight: '700' }]}>
                        {ic.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>BADGE IMAGE (OPTIONAL)</Text>
                <View style={styles.uploadRow}>
                  {atImage ? (
                    <View style={styles.previewBox}>
                      <Image source={{ uri: resolveApiUrl(atImage) }} style={styles.previewImg} resizeMode="contain" />
                      <Pressable style={styles.previewRemoveBtn} onPress={() => setAtImage('')}>
                        <Ionicons name="trash" size={12} color="#EF4444" />
                      </Pressable>
                    </View>
                  ) : (
                    <View style={[styles.previewBoxPlaceholder, { backgroundColor: atCode === 'DEALER' ? '#0F172A' : '#EF4444' }]}>
                      <Ionicons name={(atIcon || 'car-sport') as any} size={24} color="#FFFFFF" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Pressable
                      style={styles.btnUpload}
                      onPress={() => handlePickImage((base64) => setAtImage(base64))}
                    >
                      <Ionicons name="cloud-upload-outline" size={16} color={C.white} />
                      <Text style={styles.btnUploadText}>{atImage ? 'Change Image' : 'Upload Badge Image'}</Text>
                    </Pressable>
                    <Text style={styles.uploadHint}>Replaces the icon on the kiosk card</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.formGroup, { marginTop: 4 }]}>
                <Text style={styles.fieldLabel}>STATUS</Text>
                <View style={styles.groupPickerRow}>
                  <Pressable
                    style={[styles.groupPill, atActive && styles.groupPillActive]}
                    onPress={() => setAtActive(true)}
                  >
                    <Text style={[styles.groupPillText, atActive && { color: C.white, fontWeight: '700' }]}>Active (Visible on Kiosk)</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.groupPill, !atActive && styles.groupPillActive]}
                    onPress={() => setAtActive(false)}
                  >
                    <Text style={[styles.groupPillText, !atActive && { color: C.white, fontWeight: '700' }]}>Disabled (Hidden)</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.btnSecondary} onPress={() => setAccountTypeModalOpen(false)}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.btnPrimary, savingAccountType && { opacity: 0.7 }]} 
                onPress={handleSaveAccountType}
                disabled={savingAccountType}
              >
                {savingAccountType ? (
                  <ActivityIndicator color={C.white} size="small" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Save Account Type</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );

  /* ── 4. Audit Logs View ── */
  const renderAudit = () => (
    <ScrollView style={styles.scrollPane} contentContainerStyle={styles.scrollPad} keyboardShouldPersistTaps="handled">
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.screenTitle}>Audit Logs & System History</Text>
          <Text style={styles.screenSub}>Full lifecycle tracking of CarWashOrder transitions and cashier actions</Text>
        </View>
        <Pressable style={styles.btnPrimary} onPress={loadAuditLogs}>
          <Ionicons name="refresh" size={16} color={C.white} />
          <Text style={styles.btnPrimaryText}>Refresh</Text>
        </Pressable>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={C.textSec} />
        <TextInput
          style={styles.searchInput}
          placeholder="Filter by Order No, Customer, Plate, Cashier or Remarks..."
          placeholderTextColor={C.textMuted}
          value={auditSearch}
          onChangeText={(txt) => {
            setAuditSearch(txt);
          }}
          onSubmitEditing={loadAuditLogs}
        />
        <Pressable style={styles.btnPrimary} onPress={loadAuditLogs}>
          <Text style={styles.btnPrimaryText}>Filter</Text>
        </Pressable>
      </View>

      <View style={styles.glassCard}>
        {auditLoading ? (
          <ActivityIndicator size="large" color={C.accent} style={{ padding: 40 }} />
        ) : auditLogs.length === 0 ? (
          <Text style={styles.emptyText}>No audit records found matching query.</Text>
        ) : (
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 1.2 }]}>ORDER NO</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>CUSTOMER</Text>
              <Text style={[styles.th, { flex: 1 }]}>VEHICLE</Text>
              <Text style={[styles.th, { flex: 2 }]}>STATUS TRANSITION</Text>
              <Text style={[styles.th, { flex: 1 }]}>ACTION BY</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>TIMESTAMP</Text>
              <Text style={[styles.th, { flex: 2 }]}>REMARKS</Text>
            </View>

            {auditLogs.map((log) => (
              <View key={log.historyId} style={styles.tableRow}>
                <Text style={[styles.td, styles.textAccent, { flex: 1.2, fontWeight: '800' }]}>{log.orderNo}</Text>
                <Text style={[styles.td, styles.textWhite, { flex: 1.5, fontWeight: '700' }]}>{log.customerName}</Text>
                <Text style={[styles.td, styles.textSec, { flex: 1 }]}>{log.vehicleNumber}</Text>
                <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.statusBadgeText, { color: C.textSec }]}>{log.oldStatusName}</Text>
                  <Ionicons name="arrow-forward" size={12} color={C.accent} />
                  <Text style={[styles.statusBadgeText, { color: '#22C55E', fontWeight: '800' }]}>{log.newStatusName}</Text>
                </View>
                <Text style={[styles.td, styles.textWhite, { flex: 1, fontWeight: '700' }]}>{log.changedBy}</Text>
                <Text style={[styles.td, styles.textMuted, { flex: 1.5, fontSize: 11 }]}>
                  {formatSgDateTime(log.changedDate)}
                </Text>
                <Text style={[styles.td, styles.textSec, { flex: 2 }]}>{log.remarks || '-'}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );

  /* ── 5. Data Export View ── */
  const renderExport = () => (
    <ScrollView style={styles.scrollPane} contentContainerStyle={styles.scrollPad} keyboardShouldPersistTaps="handled">
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.screenTitle}>Data Export Center</Text>
          <Text style={styles.screenSub}>Export complete car wash transactions, customer bookings and revenue to CSV</Text>
        </View>
      </View>

      <View style={styles.glassCard}>
        <Text style={styles.cardHeading}>Export Car Wash Orders to CSV</Text>
        <Text style={styles.cardSubhead}>Export complete order records and transactions</Text>

        <View style={{ marginTop: 24, gap: 16 }}>
          <View style={styles.exportTile}>
            <View style={styles.exportTileIcon}>
              <Ionicons name="document-text-outline" size={32} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.textWhiteBold}>All Wash Orders & Payments</Text>
              <Text style={styles.textSec}>Includes OrderNo, Customer, Plate, Package, Amount, GST, Bay, and Timestamps</Text>
            </View>
            <Pressable
              style={styles.btnPrimary}
              onPress={() => {
                const url = getExportUrl({ format: 'csv' });
                if (Platform.OS === 'web') {
                  window.open(url, '_blank');
                } else {
                  showAlert('Export URL', url);
                }
              }}
            >
              <Ionicons name="download-outline" size={16} color={C.white} />
              <Text style={styles.btnPrimaryText}>Download CSV</Text>
            </Pressable>
          </View>

          <View style={styles.exportTile}>
            <View style={styles.exportTileIcon}>
              <Ionicons name="shield-checkmark-outline" size={32} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.textWhiteBold}>Completed Washes Only</Text>
              <Text style={styles.textSec}>Filtered by StatusCode 60 (COMPLETED) and 70 (CLOSED)</Text>
            </View>
            <Pressable
              style={styles.btnSecondary}
              onPress={() => {
                const url = getExportUrl({ format: 'csv', status: 'PAID' });
                if (Platform.OS === 'web') {
                  window.open(url, '_blank');
                } else {
                  showAlert('Export URL', url);
                }
              }}
            >
              <Ionicons name="download-outline" size={16} color={C.white} />
              <Text style={styles.btnSecondaryText}>Download Paid CSV</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  /* ── 6. Kiosk Alerts View ── */
  const renderAlerts = () => (
    <ScrollView style={styles.scrollPane} contentContainerStyle={styles.scrollPad} keyboardShouldPersistTaps="handled">
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.screenTitle}>Kiosk Customer Alerts</Text>
          <Text style={styles.screenSub}>Real-time assistance requests triggered by customers on self-service kiosks</Text>
        </View>
        <Pressable style={styles.btnPrimary} onPress={loadKioskAlerts}>
          <Ionicons name="refresh" size={16} color={C.white} />
          <Text style={styles.btnPrimaryText}>Refresh</Text>
        </Pressable>
      </View>

      <View style={styles.glassCard}>
        {alertsLoading ? (
          <ActivityIndicator size="large" color={C.accent} style={{ padding: 40 }} />
        ) : kioskAlerts.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="checkmark-circle-outline" size={48} color="#22C55E" />
            <Text style={[styles.textWhiteBold, { marginTop: 12 }]}>No Active Customer Alerts</Text>
            <Text style={styles.textSec}>All kiosks operating smoothly</Text>
          </View>
        ) : (
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 1 }]}>ALERT ID</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>STATION / SOURCE</Text>
              <Text style={[styles.th, { flex: 2 }]}>MESSAGE</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>TIMESTAMP</Text>
              <Text style={[styles.th, { flex: 1 }]}>ACTION</Text>
            </View>

            {kioskAlerts.map((alt) => (
              <View key={alt.id} style={styles.tableRow}>
                <Text style={[styles.td, styles.textAccent, { flex: 1, fontWeight: '800' }]}>#{alt.id.slice(-6)}</Text>
                <Text style={[styles.td, styles.textWhite, { flex: 1.5, fontWeight: '700' }]}>
                  {alt.location || alt.kioskId || 'Kiosk #01'}
                </Text>
                <Text style={[styles.td, styles.textSec, { flex: 2 }]}>{alt.message || 'Help requested at kiosk'}</Text>
                <Text style={[styles.td, styles.textMuted, { flex: 1.5, fontSize: 11 }]}>
                  {alt.timestamp ? formatSgTime(alt.timestamp) : 'N/A'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Pressable style={styles.btnPrimarySmall} onPress={() => handleResolveAlert(alt.id)}>
                    <Text style={styles.btnPrimarySmallText}>Resolve</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );

  /* ── Main Router ── */
  const renderActiveScreen = () => {
    switch (activeNav) {
      case 'carwash':
        return (
          <View style={styles.posWrapper}>
            <PosDashboardScreen
              currentMode="POS"
              cashierName={loggedInUser?.userName || 'Admin'}
              currentTab={cwTab}
              onTabChange={setCwTab}
              onLogout={onLogout}
            />
          </View>
        );
      case 'dealer-credit':
        return <DealerCreditHistoryView />;
      case 'dealer-settlement':
        return <DealerCreditSettlementView />;
      case 'dealer-history':
        return <DealerVehicleHistoryView />;
      case 'promotions':
        return (
          <OffersPromotionsView
            onShowAlert={showAlert}
            onConfirm={(title, message, onYes) => {
              setPopup({
                visible: true,
                type: 'confirm',
                title,
                message,
                confirmText: 'Delete',
                confirmButtonColor: '#EF4444',
                onConfirm: onYes,
              });
            }}
          />
        );
      case 'users':
        return renderUsers();
      case 'user-groups':
        return renderUserGroups();
      case 'paymodes':
        return (
          <ScrollView style={styles.scrollPane} contentContainerStyle={styles.scrollPad} keyboardShouldPersistTaps="handled">
            {renderPaymodesView()}
          </ScrollView>
        );
      case 'settings':
        return renderSettings();
      case 'audit':
        return renderAudit();
      case 'export':
        return renderExport();
      case 'alerts':
        return renderAlerts();
      case 'dashboard':
      default:
        return renderDashboard();
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     SIDEBAR
  ═══════════════════════════════════════════════════════════════ */
  const Sidebar = () => (
    <View style={[styles.sidebar, !isWide && styles.sidebarMobile]}>
      {!isWide && (
        <View style={styles.sidebarMobileClose}>
          <Pressable onPress={() => setSidebarOpen(false)} hitSlop={12}>
            <Ionicons name="close" size={22} color={C.textSec} />
          </Pressable>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        {/* Navigation Group: OVERVIEW */}
        <Text style={styles.navGroupLabel}>OVERVIEW</Text>
        <Pressable
          style={[styles.navItem, activeNav === 'dashboard' && styles.navItemActive]}
          onPress={() => navigateTo('dashboard')}
        >
          {activeNav === 'dashboard' && <View style={styles.navActiveLine} />}
          <View style={[styles.navIconBox, activeNav === 'dashboard' && styles.navIconBoxActive]}>
            <Ionicons name="grid-outline" size={17} color={activeNav === 'dashboard' ? C.white : C.textSec} />
          </View>
          <Text style={[styles.navLabel, activeNav === 'dashboard' && styles.navLabelActive]}>Dashboard</Text>
        </Pressable>


        {/* Navigation Group: DEALER CREDIT */}
        <Text style={styles.navGroupLabel}>DEALER CREDIT</Text>
        {[
          { id: 'dealer-credit', icon: 'card-outline', label: 'Credit History' },
          { id: 'dealer-settlement', icon: 'cash-outline', label: 'Credit Settlement' },
          { id: 'dealer-history', icon: 'car-outline', label: 'Fleet & Visits' },
        ].map((item) => {
          const active = activeNav === item.id;
          return (
            <Pressable
              key={item.id}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => navigateTo(item.id as NavId)}
            >
              {active && <View style={styles.navActiveLine} />}
              <View style={[styles.navIconBox, active && styles.navIconBoxActive]}>
                <Ionicons name={item.icon as any} size={17} color={active ? C.white : C.textSec} />
              </View>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}

        {/* Navigation Group: SYSTEM */}
        <Text style={styles.navGroupLabel}>SYSTEM</Text>
        {[
          { id: 'promotions', icon: 'images-outline', label: 'Offers & Promotions' },
          { id: 'paymodes', icon: 'wallet-outline', label: 'Payment Modes' },
          { id: 'users', icon: 'people-outline', label: 'User Management' },
          { id: 'settings', icon: 'settings-outline', label: 'Configuration' },
          { id: 'audit', icon: 'shield-outline', label: 'Audit Logs' },
          { id: 'export', icon: 'cloud-upload-outline', label: 'Data Export' },
          { id: 'alerts', icon: 'notifications-outline', label: 'Alerts', badge: kioskAlerts.length > 0 ? String(kioskAlerts.length) : undefined },
        ].map((item) => {
          const active = activeNav === item.id;
          return (
            <Pressable
              key={item.id}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => navigateTo(item.id as NavId)}
            >
              {active && <View style={styles.navActiveLine} />}
              <View style={[styles.navIconBox, active && styles.navIconBoxActive]}>
                <Ionicons name={item.icon as any} size={17} color={active ? C.white : C.textSec} />
              </View>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
              {item.badge && (
                <View style={styles.navBadgeNew}>
                  <Text style={styles.navBadgeText}>{item.badge}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Sidebar Footer User Info */}
      <View style={styles.sidebarFooter}>
        <View style={styles.sidebarUserRow}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={14} color={C.white} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sidebarUserName}>{loggedInUser?.userName || '123'}</Text>
            <Text style={styles.sidebarUserRole}>{loggedInUser?.userGroupName || 'Administrator'}</Text>
          </View>
          {onLogout && (
            <Pressable onPress={onLogout} hitSlop={8}>
              <Ionicons name="log-out-outline" size={18} color={C.textSec} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Top Bar */}
      <View style={styles.topbar}>
        <View style={styles.topbarLeft}>
          {!isWide && (
            <Pressable style={styles.hamburger} onPress={() => setSidebarOpen((v) => !v)} hitSlop={8}>
              <Ionicons name="menu-outline" size={24} color={C.white} />
            </Pressable>
          )}
          {isWide && (
            <>
              <View style={styles.topbarLogoBox}>
                <Ionicons name="shield-checkmark" size={16} color={C.white} />
              </View>
              <Text style={styles.topbarTitle}>RedBay Backoffice</Text>
              <View style={styles.topbarSep} />
              <Text style={styles.topbarPageName}>
                {activeNav === 'promotions'
                  ? 'OFFERS & PROMOTIONS'
                  : activeNav === 'paymodes'
                  ? 'PAYMENT MODES'
                  : activeNav.replace('-', ' ').toUpperCase()}
              </Text>
              <ScreenNameBadge name="BackofficeScreen.tsx" variant="dark" style={{ marginLeft: 8 }} />
            </>
          )}
        </View>

        <View style={styles.topbarRight}>
          <View style={styles.adminBadge}>
            <Ionicons name="person-outline" size={13} color={C.accent} />
            <Text style={styles.adminBadgeText}>{loggedInUser?.userName || 'Admin'}</Text>
          </View>
          {onLogout && (
            <Pressable style={styles.logoutBtn} onPress={onLogout}>
              <Ionicons name="log-out-outline" size={17} color={C.white} />
              {isWide && <Text style={styles.logoutText}>Logout</Text>}
            </Pressable>
          )}
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {isWide && <Sidebar />}
        {!isWide && sidebarOpen && (
          <>
            <Pressable style={styles.overlay} onPress={() => setSidebarOpen(false)} />
            <Sidebar />
          </>
        )}
        <View style={styles.contentArea}>{renderActiveScreen()}</View>
      </View>

      {/* Paymode Management Modal */}
      {renderPaymodeModal()}

      {/* Universal In-App Popup Modal (Replaces browser window.alert & window.confirm) */}
      <Modal visible={popup.visible} transparent animationType="fade" onRequestClose={closePopup}>
        <View style={styles.popupBackdrop}>
          <View style={styles.popupCard}>
            {/* Icon Header */}
            <View
              style={[
                styles.popupIconBox,
                popup.type === 'confirm' || popup.type === 'error'
                  ? styles.popupIconBoxError
                  : popup.type === 'success'
                  ? styles.popupIconBoxSuccess
                  : styles.popupIconBoxWarning,
              ]}
            >
              <Ionicons
                name={
                  popup.icon
                    ? (popup.icon as any)
                    : popup.type === 'confirm'
                    ? 'trash-outline'
                    : popup.type === 'error'
                    ? 'alert-circle-outline'
                    : popup.type === 'success'
                    ? 'checkmark-circle-outline'
                    : 'warning-outline'
                }
                size={30}
                color={
                  popup.type === 'confirm' || popup.type === 'error'
                    ? '#EF4444'
                    : popup.type === 'success'
                    ? '#22C55E'
                    : '#F59E0B'
                }
              />
            </View>

            {/* Title & Message */}
            <Text style={styles.popupTitle}>{popup.title}</Text>
            <Text style={styles.popupMessage}>{popup.message}</Text>

            {/* Action Buttons */}
            {popup.type === 'confirm' ? (
              <View style={styles.popupActionsRow}>
                <Pressable
                  style={styles.popupBtnCancel}
                  onPress={() => {
                    closePopup();
                    if (popup.onCancel) popup.onCancel();
                  }}
                >
                  <Text style={styles.popupBtnCancelText}>{popup.cancelText || 'Cancel'}</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.popupBtnConfirm,
                    popup.confirmButtonColor ? { backgroundColor: popup.confirmButtonColor } : {},
                  ]}
                  onPress={() => {
                    const fn = popup.onConfirm;
                    closePopup();
                    if (fn) fn();
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color={C.white} style={{ marginRight: 6 }} />
                  <Text style={styles.popupBtnConfirmText}>{popup.confirmText || 'Delete'}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[
                  styles.popupBtnSingle,
                  popup.type === 'error'
                    ? { backgroundColor: '#EF4444' }
                    : popup.type === 'success'
                    ? { backgroundColor: '#10B981' }
                    : { backgroundColor: C.accent },
                ]}
                onPress={() => {
                  const fn = popup.onConfirm;
                  closePopup();
                  if (fn) fn();
                }}
              >
                <Text style={styles.popupBtnSingleText}>{popup.confirmText || 'OK'}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default BackofficeScreen;

/* ═══════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    ...(Platform.OS === 'web' ? ({ position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0 } as any) : {}),
  },

  /* Topbar */
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
    backgroundColor: 'rgba(8,8,8,0.95)',
    zIndex: 100,
  },
  topbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topbarLogoBox: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: C.accentDark,
    alignItems: 'center', justifyContent: 'center',
  },
  topbarTitle: { color: C.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  topbarSep: { width: 1, height: 16, backgroundColor: C.divider, marginHorizontal: 4 },
  topbarPageName: { color: C.textSec, fontSize: 13, fontWeight: '600' },
  hamburger: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  topbarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  systemStatusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
    backgroundColor: 'rgba(34,197,94,0.07)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.18)',
  },
  systemStatusDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#22C55E' },
  systemStatusText: { color: '#22C55E', fontSize: 10, fontWeight: '700' },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
    backgroundColor: 'rgba(255,26,26,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,26,26,0.22)',
  },
  adminBadgeText: { color: C.accent, fontSize: 11, fontWeight: '700' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  logoutText: { color: C.white, fontSize: 12, fontWeight: '700' },

  /* Body */
  body: { flex: 1, flexDirection: 'row', overflow: 'hidden' as any },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 50 },
  contentArea: { flex: 1, overflow: 'hidden' as any },
  posWrapper: { flex: 1 },

  /* Sidebar */
  sidebar: {
    width: C.sidebarW,
    backgroundColor: C.surface,
    borderRightWidth: 1,
    borderRightColor: C.divider,
    paddingTop: 6,
    paddingBottom: 12,
    zIndex: 60,
  },
  sidebarMobile: { position: 'absolute' as any, top: 0, left: 0, bottom: 0, zIndex: 70 },
  sidebarMobileClose: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 14, paddingVertical: 10 },
  navGroupLabel: {
    color: C.textMuted,
    fontSize: 9, fontWeight: '800', letterSpacing: 1.4,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 5,
  },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 14, paddingVertical: 10,
    marginHorizontal: 6, marginBottom: 1,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: 'rgba(255,26,26,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,26,26,0.2)',
  },
  navItemCarWash: {
    backgroundColor: 'rgba(255,26,26,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,26,26,0.12)',
  },
  navActiveLine: {
    position: 'absolute', left: 0, top: 8, bottom: 8,
    width: 3, borderRadius: 2, backgroundColor: C.accent,
  },
  navIconBox: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  navIconBoxActive: { backgroundColor: 'rgba(255,26,26,0.15)' },
  navLabel: { flex: 1, color: C.textSec, fontSize: 12, fontWeight: '600' },
  navLabelActive: { color: C.white, fontWeight: '700' },
  navBadgeLive: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5,
    backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
  },
  navBadgeNew: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5,
    backgroundColor: 'rgba(255,26,26,0.15)', borderWidth: 1, borderColor: 'rgba(255,26,26,0.3)',
  },
  navBadgeText: { color: C.white, fontSize: 8, fontWeight: '800' },

  sidebarFooter: {
    paddingHorizontal: 10, paddingTop: 10, marginTop: 6,
    borderTopWidth: 1, borderTopColor: C.divider,
  },
  sidebarUserRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 9, borderRadius: 10,
    borderWidth: 1, borderColor: C.divider,
  },
  avatarRing: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, borderColor: 'rgba(255,26,26,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.accentDark,
    alignItems: 'center', justifyContent: 'center',
  },
  sidebarUserName: { color: C.white, fontSize: 11, fontWeight: '700' },
  sidebarUserRole: { color: C.textMuted, fontSize: 9 },

  /* Content Scroll */
  scrollPane: { flex: 1 },
  scrollPad: { padding: 22, paddingBottom: 50 },

  /* Screen Header */
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  screenTitle: { color: C.white, fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  screenSub: { color: C.textSec, fontSize: 12, marginTop: 3 },

  /* Hero Banner */
  heroBanner: {
    borderRadius: 18, overflow: 'hidden', marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,26,26,0.2)',
    backgroundColor: C.surfaceAlt,
    padding: 24,
  },
  heroInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.1)',
    alignSelf: 'flex-start', marginBottom: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  badgeText: { color: '#22C55E', fontSize: 10, fontWeight: '800' },
  heroTitle: { color: C.white, fontSize: 26, fontWeight: '900', marginBottom: 6 },
  heroSub: { color: C.textSec, fontSize: 12, maxWidth: 450, marginBottom: 16 },
  heroRightIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: C.accentDark,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,26,26,0.5)',
  },

  /* Buttons */
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
    backgroundColor: C.accent,
  },
  btnPrimaryText: { color: C.white, fontSize: 12, fontWeight: '700' },
  btnSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  btnSecondaryText: { color: C.white, fontSize: 12, fontWeight: '600' },
  btnPrimarySmall: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
    backgroundColor: C.accent, alignItems: 'center',
  },
  btnPrimarySmallText: { color: C.white, fontSize: 11, fontWeight: '700' },
  btnAction: {
    padding: 8,
    minWidth: 36,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Section Head */
  sectionHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { color: C.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  refreshChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
    backgroundColor: 'rgba(255,26,26,0.08)',
  },
  refreshChipText: { color: C.accent, fontSize: 10, fontWeight: '700' },

  /* KPI Grid */
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  kpiCard: {
    flex: 1, minWidth: 130,
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.cardBorder,
    borderRadius: 14, padding: 14,
  },
  kpiVal: { color: C.white, fontSize: 22, fontWeight: '900', marginTop: 8, marginBottom: 2 },
  kpiLabel: { color: C.white, fontSize: 11, fontWeight: '700', marginBottom: 1 },
  kpiSub: { color: C.textMuted, fontSize: 9 },

  /* Glass Card */
  glassCard: {
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.cardBorder,
    borderRadius: 14, padding: 18, marginBottom: 20,
  },
  glassCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  cardHeading: { color: C.white, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  cardSubhead: { color: C.textMuted, fontSize: 11 },
  cardHeaderAction: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },

  /* Chart & Payment */
  chartAndPaymentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  barsContainer: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    height: 120, paddingHorizontal: 10,
  },
  barsScrollContent: {
    flexDirection: 'row', alignItems: 'flex-end',
    minHeight: 130, paddingHorizontal: 6, paddingBottom: 6,
  },
  barItem: { alignItems: 'center', gap: 3, flex: 1, minWidth: 26 },
  barItemCompact: { flex: 0, minWidth: 32, paddingHorizontal: 3 },
  barTopVal: { color: C.textMuted, fontSize: 9 },
  barTopValActive: { color: C.white, fontWeight: '700' },
  barVisual: {
    width: 20, borderRadius: 4,
    backgroundColor: C.accent,
  },
  barVisualZero: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  barBottomLabel: { color: C.textSec, fontSize: 9, fontWeight: '600' },
  barSubDateLabel: { color: C.textMuted, fontSize: 8.5, marginTop: 1 },
  trendToggleContainer: {
    flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 8, padding: 2,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  trendToggleBtn: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  trendToggleBtnActive: {
    backgroundColor: C.accent,
  },
  trendToggleBtnText: {
    color: C.textSec, fontSize: 10, fontWeight: '600',
  },
  trendToggleBtnTextActive: {
    color: C.white, fontWeight: '700',
  },
  progressTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden', marginTop: 4,
  },
  progressBar: { height: '100%', borderRadius: 3, backgroundColor: C.accent },

  /* Search Bar */
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder,
    borderRadius: 10, paddingHorizontal: 14, height: 44,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1, color: C.white, fontSize: 13,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  /* Sub Tabs */
  subTabsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginBottom: 18,
  },
  subTabPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  subTabPillActive: {
    backgroundColor: 'rgba(255,26,26,0.12)',
    borderColor: C.accent,
  },
  subTabPillText: { color: C.textSec, fontSize: 12, fontWeight: '600' },
  subTabPillTextActive: { color: C.white, fontWeight: '800' },

  /* Table Styles */
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.divider,
  },
  th: { color: C.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  td: { fontSize: 12 },
  emptyText: { color: C.textMuted, fontSize: 12, textAlign: 'center', padding: 30 },

  /* Chips & Badges */
  roleChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)', alignSelf: 'flex-start',
  },
  roleChipText: { color: C.white, fontSize: 10, fontWeight: '700' },
  statusBadge: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeOn: { backgroundColor: 'rgba(34,197,94,0.1)' },
  statusBadgeOff: { backgroundColor: 'rgba(239,68,68,0.1)' },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 10 },

  /* Modal Styles */
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalCard: {
    width: '100%', maxWidth: 500,
    maxHeight: '90%',
    backgroundColor: '#181818',
    borderWidth: 1, borderColor: 'rgba(255,26,26,0.3)',
    borderRadius: 16, padding: 20,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 20px 50px rgba(0,0,0,0.8)', maxHeight: '88vh' } as any) : {}),
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
    flexShrink: 0,
  },
  modalTitle: { color: C.white, fontSize: 16, fontWeight: '800' },
  modalScrollBody: {
    flex: 1,
    width: '100%',
  },
  modalScrollContent: {
    paddingVertical: 2,
    paddingRight: 2,
  },
  modalFooter: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    flexShrink: 0,
  },

  /* Forms */
  formGroup: { marginBottom: 12 },
  formRow: { flexDirection: 'row', gap: 10 },
  fieldLabel: { color: C.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 5 },
  fieldInput: {
    height: 42, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12, color: C.white, fontSize: 13,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  groupPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  groupPill: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  groupPillActive: { backgroundColor: C.accent },
  groupPillText: { color: C.textSec, fontSize: 11 },

  /* Order Sorting & Step Controls */
  orderStepperBox: {
    height: 42,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  orderStepperBtn: {
    width: 38,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  orderStepperInput: {
    flex: 1,
    height: 42,
    color: C.white,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 4,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  orderInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderStepBtn: {
    width: 38,
    height: 42,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderFieldInput: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 15,
  },
  orderQuickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    marginTop: -4,
  },
  orderQuickLabel: {
    fontSize: 11,
    color: C.textSec,
    fontWeight: '600',
  },
  orderPresetBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderPresetBtnActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  orderPresetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textSec,
  },
  orderPresetBtnTextActive: {
    color: C.white,
    fontWeight: '900',
  },
  orderSmallBtn: {
    width: 20,
    height: 16,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },

  /* Export Tiles */
  exportTile: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: C.divider,
    borderRadius: 12, padding: 16,
  },
  exportTileIcon: {
    width: 50, height: 50, borderRadius: 12,
    backgroundColor: 'rgba(255,26,26,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  /* Image Upload & Thumbnails */
  tableThumb: {
    width: 44,
    height: 28,
    borderRadius: 6,
    resizeMode: 'contain',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tableThumbPlaceholder: {
    width: 44,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 10,
  },
  previewBox: {
    width: 64,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: C.accent,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBoxPlaceholder: {
    width: 64,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImg: {
    width: 60,
    height: 44,
    borderRadius: 6,
    resizeMode: 'contain',
  },
  previewRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  btnUpload: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,26,26,0.15)',
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  btnUploadText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '700',
  },
  uploadHint: {
    color: C.textMuted,
    fontSize: 10,
    marginTop: 4,
  },

  /* Utility */
  textWhite: { color: C.white, fontSize: 12 },
  textWhiteBold: { color: C.white, fontSize: 14, fontWeight: '800' },
  textAccent: { color: C.accent, fontSize: 12 },
  textSec: { color: C.textSec, fontSize: 12 },
  textMuted: { color: C.textMuted, fontSize: 11 },
  flexRowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  /* Universal Popup Modal Styles */
  popupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  popupCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#121214',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)' } as any)
      : { elevation: 12 }),
  },
  popupIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
  },
  popupIconBoxError: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  popupIconBoxSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  popupIconBoxWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  popupTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  popupMessage: {
    fontSize: 13.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  popupActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  popupBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupBtnCancelText: {
    color: '#CBD5E1',
    fontSize: 13.5,
    fontWeight: '700',
  },
  popupBtnConfirm: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupBtnConfirmText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  popupBtnSingle: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupBtnSingleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  /* Sales Date Filter Card Styles */
  dateFilterCard: {
    backgroundColor: 'rgba(21, 21, 21, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 26, 26, 0.22)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  dateFilterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  dateFilterMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateFilterIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 26, 26, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 26, 26, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateFilterTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateFilterSub: {
    color: C.textSec,
    fontSize: 12,
    marginTop: 2,
  },
  dateFilterRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.accent,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
  },
  dateFilterRefreshText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  dateFilterDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    marginVertical: 14,
  },
  dateFilterToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  datePresetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  datePresetPill: {
    paddingHorizontal: 14,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  datePresetPillActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  datePresetPillText: {
    color: C.textSec,
    fontSize: 12,
    fontWeight: '600',
  },
  datePresetPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dateControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
  },
  dateStepBtnDisabled: {
    opacity: 0.35,
  },
  dateStepBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: 'rgba(255, 26, 26, 0.3)',
    justifyContent: 'center',
  },
  dateNativeInput: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    minWidth: 100,
  },
  dateRangeControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  rangeInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rangeLabel: {
    color: C.textSec,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  rangeArrow: {
    paddingHorizontal: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
