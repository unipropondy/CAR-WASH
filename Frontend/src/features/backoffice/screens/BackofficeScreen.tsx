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

// ── Auth & Store ──
import { useAuthStore } from '../../auth/store/authStore';

// ── POS Queue screen ──
import { PosDashboardScreen } from '../../pos/screens/PosDashboardScreen';
import { PosNavTab } from '../../pos/components/PosSidebar';

// ── Dealer Management Views ──
import { DealerCreditHistoryView } from '../components/DealerCreditHistoryView';
import { DealerCreditSettlementView } from '../components/DealerCreditSettlementView';
import { DealerVehicleHistoryView } from '../components/DealerVehicleHistoryView';

// ── Services & APIs ──
import {
  fetchFullSalesDashboard,
  FullDashboardPayload,
  SalesSummaryData,
  PaymentChannelMixItem,
  WashTrendItem,
  ReportPeriodTab,
} from '../../../services/salesReportApi';

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
  fetchAuditLogs,
  AuditLogRecord,
  getExportUrl,
} from '../../../services/masterApi';

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
  fetchActiveHelpRequests,
  resolveHelpRequest,
  clearAllHelpRequests,
  HelpRequestItem,
} from '../../../services/helpNotificationService';

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
  | 'users'
  | 'user-groups'
  | 'settings'
  | 'audit'
  | 'export'
  | 'alerts';

type SettingsSubTab = 'VEHICLES' | 'CATEGORIES' | 'PACKAGES' | 'BAYS' | 'DEALERS' | 'COMPANY' | 'PRINTERS';

export interface BackofficeScreenProps {
  onLogout?: () => void;
}

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
  const [salesStartDate, setSalesStartDate] = useState<string>(getTodayISO());
  const [salesEndDate, setSalesEndDate] = useState<string>(getTodayISO());

  const [dashLoading, setDashLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<SalesSummaryData | null>(null);
  const [washTrends, setWashTrends] = useState<WashTrendItem[]>([]);
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannelMixItem[]>([]);
  const [liveBays, setLiveBays] = useState<BayMasterRecord[]>([]);
  const [totalStaffCount, setTotalStaffCount] = useState<number>(0);

  const handleSelectPeriodMode = (mode: SalesPeriodMode) => {
    setSalesPeriodMode(mode);
    const today = getTodayISO();
    if (mode === 'DAILY') {
      setSalesStartDate(today);
      setSalesEndDate(today);
    } else if (mode === 'WEEKLY') {
      setSalesStartDate(getWeekStartISO());
      setSalesEndDate(today);
    } else if (mode === 'MONTHLY') {
      setSalesStartDate(getMonthStartISO());
      setSalesEndDate(today);
    } else if (mode === 'YEARLY') {
      setSalesStartDate(getYearStartISO());
      setSalesEndDate(today);
    }
  };

  const handleStartDateChange = (val: string) => {
    if (!val) return;
    setSalesStartDate(val);
    if (salesPeriodMode === 'DAILY') {
      setSalesEndDate(val);
    } else if (val > salesEndDate) {
      setSalesEndDate(val);
    }
  };

  const handleEndDateChange = (val: string) => {
    if (!val) return;
    setSalesEndDate(val);
    if (val < salesStartDate) {
      setSalesStartDate(val);
    }
  };

  const handleStepPrevDay = () => {
    const parts = (salesStartDate || getTodayISO()).split('-').map(Number);
    const prev = new Date(parts[0], parts[1] - 1, parts[2]);
    prev.setDate(prev.getDate() - 1);
    const prevISO = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
    setSalesStartDate(prevISO);
    setSalesEndDate(prevISO);
  };

  const handleStepNextDay = () => {
    const today = getTodayISO();
    if (salesStartDate >= today) return;
    const parts = (salesStartDate || getTodayISO()).split('-').map(Number);
    const next = new Date(parts[0], parts[1] - 1, parts[2]);
    next.setDate(next.getDate() + 1);
    const nextISO = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
    if (nextISO <= today) {
      setSalesStartDate(nextISO);
      setSalesEndDate(nextISO);
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
  const [pGst, setPGst] = useState('9.0');
  const [pDuration, setPDuration] = useState('20');
  const [pOrder, setPOrder] = useState('1');
  const [pActive, setPActive] = useState(true);
  const [pFeatures, setPFeatures] = useState('');

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

  // 3e. Company Profile
  const [compSettings, setCompSettings] = useState<CompanySettings | null>(null);
  const [compName, setCompName] = useState('');
  const [compAddr, setCompAddr] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compEmail, setCompEmail] = useState('');
  const [compGstNo, setCompGstNo] = useState('');
  const [compGstRate, setCompGstRate] = useState('9.0');
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
      } else if (settingsTab === 'BAYS') {
        const data = await fetchBayMasterList();
        setBays(data);
      } else if (settingsTab === 'DEALERS') {
        const data = await fetchAllDealers(true);
        setDealers(data);
      } else if (settingsTab === 'COMPANY') {
        const data = await fetchCompanySettings();
        if (data) {
          setCompSettings(data);
          setCompName(data.CompanyName || '');
          setCompAddr(data.Address || '');
          setCompPhone(data.Phone || '');
          setCompEmail(data.Email || '');
          setCompGstNo(data.GSTNo || '');
          setCompGstRate(String(data.GSTPercentage ?? 9));
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

  useEffect(() => {
    if (activeNav === 'settings') {
      loadSettingsData();
    }
  }, [activeNav, settingsTab, loadSettingsData]);

  // Vehicle Type Save
  const handleSaveVehicleType = async () => {
    if (!vCode.trim() || !vName.trim()) {
      showAlert('Validation Error', 'Vehicle Type Code and Name are required.');
      return;
    }
    try {
      if (editingVehicle) {
        await updateVehicleType(editingVehicle.vehicleTypeId, {
          vehicleTypeCode: vCode.trim(),
          vehicleTypeName: vName.trim(),
          description: vDesc.trim(),
          displayOrder: parseInt(vOrder || '1', 10),
          isActive: vActive,
          imageData: vImage || undefined,
        });
        showAlert('Success', `Vehicle type "${vName}" updated.`);
      } else {
        await createVehicleType({
          vehicleTypeCode: vCode.trim(),
          vehicleTypeName: vName.trim(),
          description: vDesc.trim(),
          displayOrder: parseInt(vOrder || '1', 10),
          isActive: vActive,
          imageData: vImage || undefined,
        });
        showAlert('Success', `Vehicle type "${vName}" created.`);
      }
      setVehicleModalOpen(false);
      loadSettingsData();
    } catch (err: any) {
      showAlert('Error', err.message || 'Operation failed');
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
          await deleteVehicleType(id);
          showAlert('Success', 'Vehicle type permanently deleted.');
          loadSettingsData();
        } catch (err: any) {
          showAlert('Error', err.message || 'Failed to delete vehicle type');
        }
      },
    });
  };

  // Category Save
  const handleSaveCategory = async () => {
    if (!cCode.trim() || !cName.trim()) {
      showAlert('Validation Error', 'Category Code and Name are required.');
      return;
    }
    try {
      if (editingCategory) {
        await updateServiceCategory(editingCategory.serviceCategoryId, {
          serviceCategoryCode: cCode.trim(),
          categoryName: cName.trim(),
          description: cDesc.trim(),
          displayOrder: parseInt(cOrder || '1', 10),
          isActive: cActive,
          imageData: cImage || undefined,
          iconData: cIcon || undefined,
        });
        showAlert('Success', `Category "${cName}" updated.`);
      } else {
        await createServiceCategory({
          serviceCategoryCode: cCode.trim(),
          categoryName: cName.trim(),
          description: cDesc.trim(),
          displayOrder: parseInt(cOrder || '1', 10),
          isActive: cActive,
          imageData: cImage || undefined,
          iconData: cIcon || undefined,
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
          await deleteServiceCategory(id);
          showAlert('Success', 'Category permanently deleted.');
          loadSettingsData();
        } catch (err: any) {
          showAlert('Error', err.message || 'Failed to delete category');
        }
      },
    });
  };

  // Package Save
  const handleSavePackage = async () => {
    if (!pCode.trim() || !pName.trim()) {
      showAlert('Validation Error', 'Package Code and Name are required.');
      return;
    }
    if (isNaN(parseFloat(pPrice))) {
      showAlert('Validation Error', 'Valid Package Price is required.');
      return;
    }
    try {
      const featArray = pFeatures
        .split('\n')
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

      if (editingPkg) {
        await updatePackage(editingPkg.packageId, {
          serviceCategoryId: pCatId,
          packageCode: pCode.trim(),
          packageName: pName.trim(),
          description: pDesc.trim(),
          price: parseFloat(pPrice),
          gstPercent: parseFloat(pGst || '9'),
          durationMinutes: parseInt(pDuration || '20', 10),
          displayOrder: parseInt(pOrder || '1', 10),
          isActive: pActive,
          features: featArray,
        });
        showAlert('Success', `Package "${pName}" updated.`);
      } else {
        await createPackage({
          serviceCategoryId: pCatId,
          packageCode: pCode.trim(),
          packageName: pName.trim(),
          description: pDesc.trim(),
          price: parseFloat(pPrice),
          gstPercent: parseFloat(pGst || '9'),
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
    }
  };

  const handleDeletePackage = (id: number) => {
    showConfirm({
      title: 'Delete Service Package',
      message: 'Are you sure you want to permanently delete this service package from database?',
      confirmText: 'Delete Permanently',
      confirmButtonColor: '#EF4444',
      onConfirm: async () => {
        try {
          await deletePackage(id);
          showAlert('Success', 'Package permanently deleted.');
          loadSettingsData();
        } catch (err: any) {
          showAlert('Error', err.message || 'Failed to delete package');
        }
      },
    });
  };

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
          await deleteDealer(id);
          showAlert('Success', 'Dealer account deleted.');
          loadSettingsData();
        } catch (err: any) {
          showAlert('Error', err.message || 'Failed to delete dealer');
        }
      },
    });
  };

  // Company Settings Save
  const handleSaveCompanyProfile = async () => {
    try {
      setSavingComp(true);
      await updateCompanySettings({
        CompanyName: compName.trim(),
        Address: compAddr.trim(),
        Phone: compPhone.trim(),
        Email: compEmail.trim(),
        GSTNo: compGstNo.trim(),
        GSTPercentage: parseFloat(compGstRate || '9'),
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
    <ScrollView style={styles.scrollPane} contentContainerStyle={styles.scrollPad}>
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
    <ScrollView style={styles.scrollPane} contentContainerStyle={styles.scrollPad}>
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
                    <Pressable style={styles.btnAction} onPress={() => handleOpenEditUser(u)}>
                      <Ionicons name="create-outline" size={16} color="#3B82F6" />
                    </Pressable>
                    <Pressable style={styles.btnAction} onPress={() => handleDeleteUser(u)}>
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </View>

      {/* Add / Edit User Modal */}
      <Modal visible={userModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingUser ? 'Edit User Account' : 'Create New User'}</Text>
              <Pressable onPress={() => setUserModalOpen(false)}>
                <Ionicons name="close" size={22} color={C.textSec} />
              </Pressable>
            </View>

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
    <ScrollView style={styles.scrollPane} contentContainerStyle={styles.scrollPad}>
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
                      <Pressable style={styles.btnAction} onPress={() => handleOpenEditGroup(g)}>
                        <Ionicons name="create-outline" size={16} color="#3B82F6" />
                      </Pressable>
                      <Pressable style={styles.btnAction} onPress={() => handleDeleteGroup(g)}>
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </Pressable>
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

  /* ── 3. Configuration & Masters View ── */
  const renderSettings = () => (
    <ScrollView style={styles.scrollPane} contentContainerStyle={styles.scrollPad}>
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.screenTitle}>System Configuration</Text>
          <Text style={styles.screenSub}>Manage masters, vehicle classifications, pricing, and hardware devices</Text>
        </View>
      </View>

      {/* Sub Tabs */}
      <View style={styles.subTabsRow}>
        {[
          { id: 'VEHICLES', label: 'Vehicle Types' },
          { id: 'CATEGORIES', label: 'Categories' },
          { id: 'PACKAGES', label: 'Service Packages' },
          { id: 'BAYS', label: 'Washing Bays' },
          { id: 'DEALERS', label: 'Dealers' },
          { id: 'COMPANY', label: 'Station Profile' },
          { id: 'PRINTERS', label: 'Printers' },
        ].map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.subTabPill, settingsTab === tab.id && styles.subTabPillActive]}
            onPress={() => setSettingsTab(tab.id as SettingsSubTab)}
          >
            <Text style={[styles.subTabPillText, settingsTab === tab.id && styles.subTabPillTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab 3a: Vehicle Types */}
      {settingsTab === 'VEHICLES' && (
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderAction}>
            <Text style={styles.cardHeading}>Vehicle Classifications (VehicleTypeMaster)</Text>
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
            <Text style={[styles.th, { flex: 0.8 }]}>ORDER</Text>
            <Text style={[styles.th, { flex: 1 }]}>STATUS</Text>
            <Text style={[styles.th, { flex: 1 }]}>ACTIONS</Text>
          </View>

          {vehicles.map((v) => (
            <View key={v.vehicleTypeId} style={styles.tableRow}>
              <View style={{ flex: 0.8, justifyContent: 'center' }}>
                {v.imageUrl ? (
                  <Image
                    source={{ uri: v.imageUrl }}
                    style={styles.tableThumb}
                  />
                ) : (
                  <View style={styles.tableThumbPlaceholder}>
                    <Ionicons name="car-outline" size={16} color={C.textMuted} />
                  </View>
                )}
              </View>
              <Text style={[styles.td, styles.textAccent, { flex: 1, fontWeight: '700' }]}>{v.vehicleTypeCode}</Text>
              <Text style={[styles.td, styles.textWhite, { flex: 1.5, fontWeight: '700' }]}>{v.vehicleTypeName}</Text>
              <Text style={[styles.td, styles.textSec, { flex: 2 }]}>{v.description || '-'}</Text>
              <Text style={[styles.td, styles.textSec, { flex: 0.8 }]}>{v.displayOrder}</Text>
              <View style={{ flex: 1 }}>
                <View style={[styles.statusBadge, v.isActive ? styles.statusBadgeOn : styles.statusBadgeOff]}>
                  <Text style={[styles.statusBadgeText, v.isActive ? { color: '#22C55E' } : { color: '#EF4444' }]}>
                    {v.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
              <View style={[styles.actionRow, { flex: 1 }]}>
                <Pressable
                  style={styles.btnAction}
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
                </Pressable>
                <Pressable style={styles.btnAction} onPress={() => handleDeleteVehicleType(v.vehicleTypeId)}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Tab 3b: Categories */}
      {settingsTab === 'CATEGORIES' && (
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderAction}>
            <Text style={styles.cardHeading}>Service Categories (ServiceCategoryMaster)</Text>
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
            <Text style={[styles.th, { flex: 0.7 }]}>ORDER</Text>
            <Text style={[styles.th, { flex: 0.9 }]}>STATUS</Text>
            <Text style={[styles.th, { flex: 0.9 }]}>ACTIONS</Text>
          </View>

          {categories.map((c) => (
            <View key={c.serviceCategoryId} style={styles.tableRow}>
              <View style={{ flex: 0.9, justifyContent: 'center' }}>
                {c.imageUrl ? (
                  <Image
                    source={{ uri: c.imageUrl }}
                    style={styles.tableThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.tableThumbPlaceholder}>
                    <Ionicons name="image-outline" size={16} color={C.textMuted} />
                  </View>
                )}
              </View>
              <View style={{ flex: 0.7, justifyContent: 'center' }}>
                {c.iconUrl ? (
                  <Image
                    source={{ uri: c.iconUrl }}
                    style={[styles.tableThumb, { width: 32, height: 32, borderRadius: 6 }]}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[styles.tableThumbPlaceholder, { width: 32, height: 32 }]}>
                    <Ionicons name="sparkles-outline" size={14} color={C.textMuted} />
                  </View>
                )}
              </View>
              <Text style={[styles.td, styles.textAccent, { flex: 1.1, fontWeight: '700' }]}>{c.serviceCategoryCode}</Text>
              <Text style={[styles.td, styles.textWhite, { flex: 1.4, fontWeight: '700' }]}>{c.categoryName}</Text>
              <Text style={[styles.td, styles.textSec, { flex: 2 }]}>{c.description || '-'}</Text>
              <Text style={[styles.td, styles.textSec, { flex: 0.7 }]}>{c.displayOrder}</Text>
              <View style={{ flex: 0.9 }}>
                <View style={[styles.statusBadge, c.isActive ? styles.statusBadgeOn : styles.statusBadgeOff]}>
                  <Text style={[styles.statusBadgeText, c.isActive ? { color: '#22C55E' } : { color: '#EF4444' }]}>
                    {c.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
              <View style={[styles.actionRow, { flex: 0.9 }]}>
                <Pressable
                  style={styles.btnAction}
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
                </Pressable>
                <Pressable style={styles.btnAction} onPress={() => handleDeleteCategory(c.serviceCategoryId)}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Tab 3c: Service Packages */}
      {settingsTab === 'PACKAGES' && (
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderAction}>
            <Text style={styles.cardHeading}>Service Packages & Rates (ServicePackageMaster)</Text>
            <Pressable
              style={styles.btnPrimary}
              onPress={() => {
                setEditingPkg(null);
                setPCode('');
                setPName('');
                setPDesc('');
                setPPrice('15.00');
                setPGst('9.0');
                setPDuration('20');
                setPOrder('1');
                setPActive(true);
                setPFeatures('');
                setPkgModalOpen(true);
              }}
            >
              <Ionicons name="add" size={16} color={C.white} />
              <Text style={styles.btnPrimaryText}>Add Service Package</Text>
            </Pressable>
          </View>

          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 1.5 }]}>CATEGORY</Text>
            <Text style={[styles.th, { flex: 1 }]}>CODE</Text>
            <Text style={[styles.th, { flex: 1.8 }]}>PACKAGE NAME</Text>
            <Text style={[styles.th, { flex: 1 }]}>PRICE ($)</Text>
            <Text style={[styles.th, { flex: 0.8 }]}>GST %</Text>
            <Text style={[styles.th, { flex: 1 }]}>STATUS</Text>
            <Text style={[styles.th, { flex: 1 }]}>ACTIONS</Text>
          </View>

          {packages.map((pkg) => (
            <View key={pkg.packageId} style={styles.tableRow}>
              <Text style={[styles.td, styles.textSec, { flex: 1.5 }]}>{pkg.serviceCategoryName || 'Wash'}</Text>
              <Text style={[styles.td, styles.textAccent, { flex: 1, fontWeight: '700' }]}>{pkg.packageCode}</Text>
              <Text style={[styles.td, styles.textWhite, { flex: 1.8, fontWeight: '700' }]}>{pkg.packageName}</Text>
              <Text style={[styles.td, { flex: 1, color: '#22C55E', fontWeight: '800' }]}>${pkg.price.toFixed(2)}</Text>
              <Text style={[styles.td, styles.textSec, { flex: 0.8 }]}>{pkg.gstPercent}%</Text>
              <View style={{ flex: 1 }}>
                <View style={[styles.statusBadge, pkg.isActive ? styles.statusBadgeOn : styles.statusBadgeOff]}>
                  <Text style={[styles.statusBadgeText, pkg.isActive ? { color: '#22C55E' } : { color: '#EF4444' }]}>
                    {pkg.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
              <View style={[styles.actionRow, { flex: 1 }]}>
                <Pressable
                  style={styles.btnAction}
                  onPress={() => {
                    setEditingPkg(pkg);
                    setPCatId(pkg.serviceCategoryId);
                    setPCode(pkg.packageCode);
                    setPName(pkg.packageName);
                    setPDesc(pkg.description || '');
                    setPPrice(String(pkg.price));
                    setPGst(String(pkg.gstPercent));
                    setPDuration(String(pkg.durationMinutes || 20));
                    setPOrder(String(pkg.displayOrder));
                    setPActive(pkg.isActive);
                    setPFeatures((pkg.features || []).join('\n'));
                    setPkgModalOpen(true);
                  }}
                >
                  <Ionicons name="create-outline" size={16} color="#3B82F6" />
                </Pressable>
                <Pressable style={styles.btnAction} onPress={() => handleDeletePackage(pkg.packageId)}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Tab 3d: Washing Bays */}
      {settingsTab === 'BAYS' && (
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderAction}>
            <Text style={styles.cardHeading}>Washing Bay Master</Text>
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
                <Pressable
                  style={styles.btnAction}
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
                </Pressable>
                <Pressable style={styles.btnAction} onPress={() => handleDeleteBay(b.bayNumber)}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </Pressable>
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
              <Text style={styles.cardHeading}>Dealer Accounts (DealerMaster)</Text>
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

          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 0.8 }]}>LOGO</Text>
            <Text style={[styles.th, { flex: 1.1 }]}>UNIQUE ID</Text>
            <Text style={[styles.th, { flex: 1.8 }]}>DEALER NAME</Text>
            <Text style={[styles.th, { flex: 1.3 }]}>CONTACT NO</Text>
            <Text style={[styles.th, { flex: 2.2 }]}>ADDRESS</Text>
            <Text style={[styles.th, { flex: 0.9 }]}>PIN</Text>
            <Text style={[styles.th, { flex: 1 }]}>STATUS</Text>
            <Text style={[styles.th, { flex: 1 }]}>ACTIONS</Text>
          </View>

          {dealers.map((d) => (
            <View key={d.dealerId || d.uniqueCode} style={styles.tableRow}>
              {/* Logo Column */}
              <View style={{ flex: 0.8, justifyContent: 'center' }}>
                {d.logoUrl ? (
                  <Image source={{ uri: d.logoUrl }} style={styles.tableThumb} resizeMode="contain" />
                ) : (
                  <View style={styles.tableThumbPlaceholder}>
                    <Ionicons name="business-outline" size={16} color={C.textMuted} />
                  </View>
                )}
              </View>

              {/* Unique ID */}
              <Text style={[styles.td, styles.textAccent, { flex: 1.1, fontWeight: '800' }]}>
                {d.uniqueCode}
              </Text>

              {/* Dealer Name */}
              <View style={{ flex: 1.8, justifyContent: 'center' }}>
                <Text style={[styles.td, styles.textWhite, { fontWeight: '700' }]}>{d.dealerName}</Text>
                {d.contactPerson ? (
                  <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    Attn: {d.contactPerson}
                  </Text>
                ) : null}
              </View>

              {/* Contact Number */}
              <Text style={[styles.td, styles.textSec, { flex: 1.3 }]}>
                {d.contactNumber || '-'}
              </Text>

              {/* Address */}
              <Text style={[styles.td, styles.textSec, { flex: 2.2 }]} numberOfLines={2}>
                {d.address || '-'}
              </Text>

              {/* Security PIN */}
              <Text style={[styles.td, styles.textSec, { flex: 0.9, letterSpacing: 2, fontFamily: 'monospace' }]}>
                {d.securityPin || '1234'}
              </Text>

              {/* Status */}
              <View style={{ flex: 1 }}>
                <View style={[styles.statusBadge, d.isActive ? styles.statusBadgeOn : styles.statusBadgeOff]}>
                  <Text style={[styles.statusBadgeText, d.isActive ? { color: '#22C55E' } : { color: '#EF4444' }]}>
                    {d.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View style={[styles.actionRow, { flex: 1 }]}>
                <Pressable
                  style={styles.btnAction}
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
                </Pressable>
                <Pressable style={styles.btnAction} onPress={() => handleDeleteDealer(d.dealerId)}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          ))}

          {dealers.length === 0 && !settingsLoading && (
            <View style={{ padding: 30, alignItems: 'center' }}>
              <Text style={{ color: C.textMuted, fontSize: 13 }}>
                No dealers registered yet. Click "+ Add Dealer" to create one.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Tab 3e: Company Profile */}
      {settingsTab === 'COMPANY' && (
        <View style={styles.glassCard}>
          <Text style={styles.cardHeading}>Company & Tax Settings (CompanySettings)</Text>
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
            <Text style={styles.cardHeading}>Hardware & Network Receipt Printers (PrintMaster)</Text>
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
                <Pressable style={styles.btnAction} onPress={() => handleTestPrinter(p)}>
                  <Ionicons name="print-outline" size={16} color="#10B981" />
                </Pressable>
                <Pressable
                  style={styles.btnAction}
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
                </Pressable>
                <Pressable style={styles.btnAction} onPress={() => handleDeletePrinter(p.printerId)}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Modals for Masters */}
      {/* Vehicle Type Modal */}
      <Modal visible={vehicleModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingVehicle ? 'Edit Vehicle Type' : 'Add Vehicle Type'}</Text>
              <Pressable onPress={() => setVehicleModalOpen(false)}><Ionicons name="close" size={22} color={C.textSec} /></Pressable>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>CODE *</Text>
              <TextInput style={styles.fieldInput} value={vCode} onChangeText={setVCode} autoCapitalize="characters" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>NAME *</Text>
              <TextInput style={styles.fieldInput} value={vName} onChangeText={setVName} />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>DESCRIPTION</Text>
              <TextInput style={styles.fieldInput} value={vDesc} onChangeText={setVDesc} />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>DISPLAY ORDER</Text>
              <TextInput style={styles.fieldInput} value={vOrder} onChangeText={setVOrder} keyboardType="numeric" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>VEHICLE IMAGE</Text>
              <View style={styles.uploadRow}>
                {vImage ? (
                  <View style={styles.previewBox}>
                    <Image source={{ uri: vImage }} style={styles.previewImg} />
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
            <View style={styles.modalFooter}>
              <Pressable style={styles.btnSecondary} onPress={() => setVehicleModalOpen(false)}><Text style={styles.btnSecondaryText}>Cancel</Text></Pressable>
              <Pressable style={styles.btnPrimary} onPress={handleSaveVehicleType}><Text style={styles.btnPrimaryText}>Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Modal */}
      <Modal visible={categoryModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCategory ? 'Edit Category' : 'Add Category'}</Text>
              <Pressable onPress={() => setCategoryModalOpen(false)}><Ionicons name="close" size={22} color={C.textSec} /></Pressable>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>CODE *</Text>
              <TextInput style={styles.fieldInput} value={cCode} onChangeText={setCCode} autoCapitalize="characters" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>CATEGORY NAME *</Text>
              <TextInput style={styles.fieldInput} value={cName} onChangeText={setCName} />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>DESCRIPTION</Text>
              <TextInput style={styles.fieldInput} value={cDesc} onChangeText={setCDesc} />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>CATEGORY COVER / HERO IMAGE</Text>
              <View style={styles.uploadRow}>
                {cImage ? (
                  <View style={styles.previewBox}>
                    <Image source={{ uri: cImage }} style={styles.previewImg} resizeMode="cover" />
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
                    <Image source={{ uri: cIcon }} style={[styles.previewImg, { width: 44, height: 44 }]} resizeMode="contain" />
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
            <View style={styles.modalFooter}>
              <Pressable style={styles.btnSecondary} onPress={() => setCategoryModalOpen(false)}><Text style={styles.btnSecondaryText}>Cancel</Text></Pressable>
              <Pressable style={styles.btnPrimary} onPress={handleSaveCategory}><Text style={styles.btnPrimaryText}>Save</Text></Pressable>
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
              <Pressable onPress={() => setPkgModalOpen(false)}><Ionicons name="close" size={22} color={C.textSec} /></Pressable>
            </View>
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
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>PRICE ($) *</Text>
                <TextInput style={styles.fieldInput} value={pPrice} onChangeText={setPPrice} keyboardType="numeric" />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>DURATION (MINS)</Text>
                <TextInput style={styles.fieldInput} value={pDuration} onChangeText={setPDuration} keyboardType="numeric" />
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>FEATURES (one per line)</Text>
              <TextInput style={[styles.fieldInput, { height: 70 }]} value={pFeatures} onChangeText={setPFeatures} multiline />
            </View>
            <View style={styles.modalFooter}>
              <Pressable style={styles.btnSecondary} onPress={() => setPkgModalOpen(false)}><Text style={styles.btnSecondaryText}>Cancel</Text></Pressable>
              <Pressable style={styles.btnPrimary} onPress={handleSavePackage}><Text style={styles.btnPrimaryText}>Save</Text></Pressable>
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
                      <Image source={{ uri: dLogo }} style={styles.previewImg} resizeMode="contain" />
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
    </ScrollView>
  );

  /* ── 4. Audit Logs View ── */
  const renderAudit = () => (
    <ScrollView style={styles.scrollPane} contentContainerStyle={styles.scrollPad}>
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
                  {new Date(log.changedDate).toLocaleString()}
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
    <ScrollView style={styles.scrollPane} contentContainerStyle={styles.scrollPad}>
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
    <ScrollView style={styles.scrollPane} contentContainerStyle={styles.scrollPad}>
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
                  {alt.timestamp ? new Date(alt.timestamp).toLocaleTimeString() : 'N/A'}
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
      case 'users':
        return renderUsers();
      case 'user-groups':
        return renderUserGroups();
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

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
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
              <Text style={styles.topbarPageName}>{activeNav.replace('-', ' ').toUpperCase()}</Text>
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
    padding: 6, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
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
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  /* Modal Styles */
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalCard: {
    width: '100%', maxWidth: 480,
    backgroundColor: '#181818',
    borderWidth: 1, borderColor: 'rgba(255,26,26,0.3)',
    borderRadius: 16, padding: 20,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 20px 50px rgba(0,0,0,0.8)' } as any) : {}),
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { color: C.white, fontSize: 16, fontWeight: '800' },
  modalFooter: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 10,
    marginTop: 20,
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
