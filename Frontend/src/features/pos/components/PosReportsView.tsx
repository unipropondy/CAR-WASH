import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { PosOrder } from '../../../types/pos.types';
import { BayMasterRecord } from '../../../services/carwashOrderApi';
import { IconMenu, IconClock } from '../../../components/common/AppIcons';
import { printOrderReceipt } from '../../../services/printerApi';
import { ScreenNameBadge } from '../../../components/common/ScreenNameBadge';
import { 
  fetchFullSalesDashboard, 
  FullDashboardPayload, 
  ReportPeriodTab,
  ServiceDistributionItem,
  PaymentChannelMixItem,
  WashTrendItem,
  RecentWashItem,
  RecentTransactionItem 
} from '../../../services/salesReportApi';

interface PosReportsViewProps {
  orders?: PosOrder[];
  bays?: BayMasterRecord[];
  cashierName?: string;
  onBackToOrders?: () => void;
  onToggleSidebar?: () => void;
  refreshTrigger?: number;
  isFilterOpen?: boolean;
  onCloseFilter?: () => void;
  isDownloadModalOpen?: boolean;
  onCloseDownloadModal?: () => void;
}

// Monthly chart data matching reference design
interface MonthData {
  month: string;
  washes: number;
  revenueK: number;
  revenueFormatted: string;
}

const MONTHLY_TREND_DATA: MonthData[] = [
  { month: 'Jan', washes: 1600, revenueK: 36.5, revenueFormatted: '$36,500' },
  { month: 'Feb', washes: 2150, revenueK: 48.2, revenueFormatted: '$48,200' },
  { month: 'Mar', washes: 1420, revenueK: 32.8, revenueFormatted: '$32,800' },
  { month: 'Apr', washes: 2487, revenueK: 56.84, revenueFormatted: '$56,840' },
  { month: 'May', washes: 1450, revenueK: 33.6, revenueFormatted: '$33,600' },
  { month: 'Jun', washes: 1980, revenueK: 44.5, revenueFormatted: '$44,500' },
  { month: 'Jul', washes: 1520, revenueK: 35.0, revenueFormatted: '$35,000' },
];

// Polar coordinate helpers to draw exact circular arcs
const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
};

const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', start.x.toFixed(2), start.y.toFixed(2),
    'A', r, r, 0, largeArcFlag, 0, end.x.toFixed(2), end.y.toFixed(2),
  ].join(' ');
};

// Helper to render crisp inline SVGs on web
const renderSvg = (
  size: number,
  viewBox: string,
  paths: Array<{
    d?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    strokeLinecap?: 'round' | 'butt';
    strokeLinejoin?: 'round' | 'miter';
  }>
) => {
  if (Platform.OS === 'web') {
    return React.createElement(
      'svg',
      {
        width: size,
        height: size,
        viewBox,
        style: { display: 'inline-block', verticalAlign: 'middle' },
      },
      paths.map((p, i) =>
        React.createElement('path', {
          key: i,
          d: p.d,
          fill: p.fill || 'none',
          stroke: p.stroke || 'currentColor',
          strokeWidth: p.strokeWidth ?? 2,
          strokeLinecap: p.strokeLinecap || 'round',
          strokeLinejoin: p.strokeLinejoin || 'round',
        })
      )
    );
  }
  return <View style={{ width: size, height: size }} />;
};

interface PeriodRangeInfo {
  startISO: string;
  endISO: string;
  weekdayLabel?: string;
  mainDateText: string;
  subDateText?: string;
  arrowLabel?: string;
}

const formatISOToDDMMYYYY = (isoStr: string): string => {
  if (!isoStr) return '';
  const clean = isoStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return clean;
};

const calculatePeriodRange = (tab: ReportPeriodTab, anchor: Date): PeriodRangeInfo => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const formatFriendly = (d: Date, withWeekday = false) => {
    return d.toLocaleDateString('en-GB', {
      weekday: withWeekday ? 'short' : undefined,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (tab === 'DAILY') {
    const rawD = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    const d = rawD > todayMidnight ? todayMidnight : rawD;
    const iso = toISO(d);
    return {
      startISO: iso,
      endISO: iso,
      weekdayLabel: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      mainDateText: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    };
  }

  if (tab === 'WEEKLY') {
    const dayOfWeek = anchor.getDay(); // 0 = Sun, 1 = Mon...
    const diffToMonday = anchor.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), diffToMonday);
    const rawEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    // Never exceed today/present date
    const end = rawEnd > todayMidnight ? todayMidnight : rawEnd;
    return {
      startISO: toISO(start),
      endISO: toISO(end),
      mainDateText: formatFriendly(start),
      arrowLabel: '➔',
      subDateText: formatFriendly(end),
    };
  }

  if (tab === 'MONTHLY') {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const rawEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    // Never exceed today/present date for current month
    const end = rawEnd > todayMidnight ? todayMidnight : rawEnd;
    return {
      startISO: toISO(start),
      endISO: toISO(end),
      mainDateText: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      subDateText: `${formatFriendly(start)} – ${formatFriendly(end)}`,
    };
  }

  // YEARLY
  const start = new Date(anchor.getFullYear(), 0, 1);
  const rawEnd = new Date(anchor.getFullYear(), 11, 31);
  // Never exceed today/present date for current year
  const end = rawEnd > todayMidnight ? todayMidnight : rawEnd;
  return {
    startISO: toISO(start),
    endISO: toISO(end),
    mainDateText: `Year ${anchor.getFullYear()}`,
    subDateText: `${formatFriendly(start)} – ${formatFriendly(end)}`,
  };
};

export type DownloadPeriodType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';

export const getDownloadPeriodRange = (
  period: DownloadPeriodType,
  customStart?: string,
  customEnd?: string
): { startISO: string; endISO: string; displayLabel: string } => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date();
  const todayISOStr = toISO(today);

  if (period === 'CUSTOM') {
    const s = customStart || todayISOStr;
    const e = customEnd || todayISOStr;
    return {
      startISO: s,
      endISO: e,
      displayLabel: `${formatISOToDDMMYYYY(s)} – ${formatISOToDDMMYYYY(e)}`,
    };
  }

  if (period === 'DAILY') {
    return {
      startISO: todayISOStr,
      endISO: todayISOStr,
      displayLabel: `Daily (${formatISOToDDMMYYYY(todayISOStr)})`,
    };
  }

  if (period === 'WEEKLY') {
    const dayOfWeek = today.getDay();
    const diffToMonday = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const start = new Date(today.getFullYear(), today.getMonth(), diffToMonday);
    const s = toISO(start);
    return {
      startISO: s,
      endISO: todayISOStr,
      displayLabel: `Weekly (${formatISOToDDMMYYYY(s)} – ${formatISOToDDMMYYYY(todayISOStr)})`,
    };
  }

  if (period === 'MONTHLY') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const s = toISO(start);
    return {
      startISO: s,
      endISO: todayISOStr,
      displayLabel: `Monthly (${today.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}: ${formatISOToDDMMYYYY(s)} – ${formatISOToDDMMYYYY(todayISOStr)})`,
    };
  }

  // YEARLY
  const start = new Date(today.getFullYear(), 0, 1);
  const s = toISO(start);
  return {
    startISO: s,
    endISO: todayISOStr,
    displayLabel: `Yearly (${today.getFullYear()}: ${formatISOToDDMMYYYY(s)} – ${formatISOToDDMMYYYY(todayISOStr)})`,
  };
};

const webCustomDateInputStyle: any = {
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  fontSize: '13px',
  fontWeight: '700',
  color: '#0F172A',
  width: '100%',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

export const PosReportsView: React.FC<PosReportsViewProps> = ({
  orders = [],
  bays = [],
  cashierName = 'Ferra Alexandra',
  onBackToOrders,
  onToggleSidebar,
  refreshTrigger,
  isFilterOpen = false,
  onCloseFilter,
  isDownloadModalOpen = false,
  onCloseDownloadModal,
}) => {
  const [selectedPeriodTab, setSelectedPeriodTab] = useState<ReportPeriodTab>('YEARLY');
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [customStartDate, setCustomStartDate] = useState<string | null>(null);
  const [customEndDate, setCustomEndDate] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<FullDashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTrendIdx, setActiveTrendIdx] = useState<number>(0);

  // Easy Filter States
  const [filterSortBy, setFilterSortBy] = useState<'NEWEST' | 'HIGHEST_AMOUNT'>('NEWEST');
  const [filterPaymentMode, setFilterPaymentMode] = useState<string>('ALL');
  const [filterShowCancelled, setFilterShowCancelled] = useState<boolean>(true);

  // Staged Filter States for Modal
  const [stagedSortBy, setStagedSortBy] = useState<'NEWEST' | 'HIGHEST_AMOUNT'>('NEWEST');
  const [stagedPaymentMode, setStagedPaymentMode] = useState<string>('ALL');
  const [stagedShowCancelled, setStagedShowCancelled] = useState<boolean>(true);

  // Download Modal States
  const [downloadPeriod, setDownloadPeriod] = useState<DownloadPeriodType>('DAILY');
  const [customDownloadStart, setCustomDownloadStart] = useState<string>('');
  const [customDownloadEnd, setCustomDownloadEnd] = useState<string>('');
  const [isExporting, setIsExporting] = useState<'PDF' | 'EXCEL' | null>(null);

  useEffect(() => {
    if (isFilterOpen) {
      setStagedSortBy(filterSortBy);
      setStagedPaymentMode(filterPaymentMode);
      setStagedShowCancelled(filterShowCancelled);
    }
  }, [isFilterOpen, filterSortBy, filterPaymentMode, filterShowCancelled]);

  const dateRange = useMemo(() => {
    return calculatePeriodRange(selectedPeriodTab, anchorDate);
  }, [selectedPeriodTab, anchorDate]);

  const effectiveStartISO = customStartDate || dateRange.startISO;
  const effectiveEndISO = customEndDate || dateRange.endISO;

  useEffect(() => {
    if (isDownloadModalOpen) {
      setDownloadPeriod((selectedPeriodTab as DownloadPeriodType) || 'DAILY');
      setCustomDownloadStart(effectiveStartISO);
      setCustomDownloadEnd(effectiveEndISO);
    }
  }, [isDownloadModalOpen, selectedPeriodTab, effectiveStartISO, effectiveEndISO]);

  const downloadRange = useMemo(() => {
    return getDownloadPeriodRange(downloadPeriod, customDownloadStart, customDownloadEnd);
  }, [downloadPeriod, customDownloadStart, customDownloadEnd]);

  const todayISO = useMemo(() => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  }, []);

  const isAtPresent = useMemo(() => {
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (selectedPeriodTab === 'DAILY') {
      const anchorMidnight = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
      return anchorMidnight >= todayMidnight;
    }
    if (selectedPeriodTab === 'WEEKLY') {
      const dayOfWeek = anchorDate.getDay();
      const diffToMonday = anchorDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), diffToMonday);
      return start >= todayMidnight || anchorDate >= todayMidnight;
    }
    if (selectedPeriodTab === 'MONTHLY') {
      return (
        anchorDate.getFullYear() > today.getFullYear() ||
        (anchorDate.getFullYear() === today.getFullYear() && anchorDate.getMonth() >= today.getMonth())
      );
    }
    // YEARLY
    return anchorDate.getFullYear() >= today.getFullYear();
  }, [selectedPeriodTab, anchorDate]);

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadDashboard(selectedPeriodTab, true);
    }
  }, [refreshTrigger]);

  const isCurrentDate = useMemo(() => {
    const today = new Date();
    return (
      today.getFullYear() === anchorDate.getFullYear() &&
      today.getMonth() === anchorDate.getMonth() &&
      today.getDate() === anchorDate.getDate()
    );
  }, [anchorDate]);

  const handlePrevious = () => {
    setCustomStartDate(null);
    setCustomEndDate(null);
    setAnchorDate((prev) => {
      const next = new Date(prev);
      if (selectedPeriodTab === 'DAILY') {
        next.setDate(next.getDate() - 1);
      } else if (selectedPeriodTab === 'WEEKLY') {
        next.setDate(next.getDate() - 7);
      } else if (selectedPeriodTab === 'MONTHLY') {
        next.setMonth(next.getMonth() - 1);
      } else if (selectedPeriodTab === 'YEARLY') {
        next.setFullYear(next.getFullYear() - 1);
      }
      return next;
    });
  };

  const handleNext = () => {
    if (isAtPresent) return;
    setCustomStartDate(null);
    setCustomEndDate(null);
    setAnchorDate((prev) => {
      const today = new Date();
      const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const next = new Date(prev);
      if (selectedPeriodTab === 'DAILY') {
        next.setDate(next.getDate() + 1);
      } else if (selectedPeriodTab === 'WEEKLY') {
        next.setDate(next.getDate() + 7);
      } else if (selectedPeriodTab === 'MONTHLY') {
        next.setMonth(next.getMonth() + 1);
      } else if (selectedPeriodTab === 'YEARLY') {
        next.setFullYear(next.getFullYear() + 1);
      }
      return next > todayMidnight ? todayMidnight : next;
    });
  };

  const handleResetToCurrent = () => {
    setCustomStartDate(null);
    setCustomEndDate(null);
    setAnchorDate(new Date());
  };

  const loadDashboard = useCallback(
    async (
      tab: ReportPeriodTab,
      isManual: boolean = false,
      customStart?: string,
      customEnd?: string
    ) => {
      if (isManual) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setLoadError(null);
      try {
        const start = customStart || effectiveStartISO;
        const end = customEnd || effectiveEndISO;
        const data = await fetchFullSalesDashboard(tab, start, end);
        setDashboardData(data);
        if (data.washTrend && data.washTrend.length > 0) {
          setActiveTrendIdx(data.washTrend.length - 1);
        }
      } catch (err: any) {
        console.warn('Failed to load sales dashboard:', err);
        setLoadError(err?.message || 'Could not fetch dashboard metrics');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [effectiveStartISO, effectiveEndISO]
  );

  useEffect(() => {
    loadDashboard(selectedPeriodTab, false, effectiveStartISO, effectiveEndISO);
  }, [selectedPeriodTab, effectiveStartISO, effectiveEndISO, loadDashboard]);

  // Live SQL Server metrics extracted from dashboard payload
  const summary = dashboardData?.summary || {
    totalWashes: 0,
    totalCompletedWashes: 0,
    totalClosedWashes: 0,
    totalActiveWashes: 0,
    totalCancelledWashes: 0,
    totalBookings: 0,
    totalRevenue: 0,
    totalNetRevenue: 0,
    totalGSTAmount: 0,
    totalUniqueCustomers: 0,
    totalUniqueVehicles: 0,
    averageOrderValue: 0,
    avgWashDurationMinutes: 0,
  };

  const totalWashesCount = summary.totalWashes ?? (summary.totalCompletedWashes + (summary.totalClosedWashes || 0));
  const completedWashesCount = summary.totalCompletedWashes || 0;
  const closedWashesCount = summary.totalClosedWashes || 0;

  let washesBadgeText = '✓ Fulfilled';
  if (completedWashesCount > 0 && closedWashesCount > 0) {
    washesBadgeText = `✓ ${completedWashesCount} Completed • ${closedWashesCount} Closed`;
  } else if (closedWashesCount > 0) {
    washesBadgeText = `✓ ${closedWashesCount} Closed`;
  } else if (completedWashesCount > 0) {
    washesBadgeText = `✓ ${completedWashesCount} Completed`;
  } else {
    washesBadgeText = '0 Washes';
  }

  const serviceDistributionList = dashboardData?.serviceDistribution && dashboardData.serviceDistribution.length > 0
    ? dashboardData.serviceDistribution
    : [];

  const bayUtilList = dashboardData?.bayUtilization && dashboardData.bayUtilization.length > 0
    ? dashboardData.bayUtilization
    : [];

  const payMixList = dashboardData?.paymentChannelMix && dashboardData.paymentChannelMix.length > 0
    ? dashboardData.paymentChannelMix
    : [];

  const washTrendList = dashboardData?.washTrend && dashboardData.washTrend.length > 0
    ? dashboardData.washTrend
    : [];

  const recentWashesList = dashboardData?.recentWashes && dashboardData.recentWashes.length > 0
    ? dashboardData.recentWashes
    : [];

  const recentTransactionsList = dashboardData?.recentTransactions && dashboardData.recentTransactions.length > 0
    ? dashboardData.recentTransactions
    : [];

  // Filtered & Sorted Lists based on Easy Filter modal selections
  const filteredRecentWashes = useMemo(() => {
    let list = [...recentWashesList];

    // Visibility filter (cancelled orders)
    if (!filterShowCancelled) {
      list = list.filter((w) => {
        const s = (w.statusName || '').toUpperCase();
        return !s.includes('CANCEL');
      });
    }

    // Payment mode filter
    if (filterPaymentMode !== 'ALL') {
      list = list.filter((w) => {
        const matchingTx = recentTransactionsList.find((t) => t.orderId === w.orderId || t.orderNo === w.orderNo);
        const mode = (matchingTx?.payMode || matchingTx?.payModeDescription || '').toUpperCase();
        return mode.includes(filterPaymentMode);
      });
    }

    // Sort by
    if (filterSortBy === 'HIGHEST_AMOUNT') {
      list.sort((a, b) => (Number(b.totalAmount) || 0) - (Number(a.totalAmount) || 0));
    } else {
      // NEWEST
      list.sort((a, b) => {
        const timeA = new Date(a.completedDate || a.startedDate || a.createdDate || 0).getTime();
        const timeB = new Date(b.completedDate || b.startedDate || b.createdDate || 0).getTime();
        return timeB - timeA;
      });
    }

    return list;
  }, [recentWashesList, recentTransactionsList, filterShowCancelled, filterPaymentMode, filterSortBy]);

  const filteredRecentTransactions = useMemo(() => {
    let list = [...recentTransactionsList];

    // Payment mode filter
    if (filterPaymentMode !== 'ALL') {
      list = list.filter((t) => {
        const mode = (t.payMode || t.payModeDescription || '').toUpperCase();
        return mode.includes(filterPaymentMode);
      });
    }

    // Sort by
    if (filterSortBy === 'HIGHEST_AMOUNT') {
      list.sort((a, b) => (Number(b.totalAmount) || 0) - (Number(a.totalAmount) || 0));
    } else {
      // NEWEST
      list.sort((a, b) => {
        const timeA = new Date(a.paidDate || a.createdDate || 0).getTime();
        const timeB = new Date(b.paidDate || b.createdDate || 0).getTime();
        return timeB - timeA;
      });
    }

    return list;
  }, [recentTransactionsList, filterPaymentMode, filterSortBy]);

  const getDownloadPayload = async (
    period: DownloadPeriodType,
    startISO: string,
    endISO: string
  ): Promise<FullDashboardPayload> => {
    if (
      dashboardData &&
      period !== 'CUSTOM' &&
      period === selectedPeriodTab &&
      effectiveStartISO === startISO &&
      effectiveEndISO === endISO
    ) {
      return dashboardData;
    }

    try {
      const tabParam: ReportPeriodTab = period === 'CUSTOM' ? 'MONTHLY' : (period as ReportPeriodTab);
      const res = await fetchFullSalesDashboard(tabParam, startISO, endISO);
      return res;
    } catch (e) {
      console.warn('Fallback to current dashboard data for export:', e);
      return (
        dashboardData || {
          success: true,
          period: { startDate: startISO, endDate: endISO },
          summary,
          serviceDistribution: serviceDistributionList,
          bayUtilization: bayUtilList,
          paymentChannelMix: payMixList,
          washTrend: washTrendList,
          recentWashes: recentWashesList,
          recentTransactions: recentTransactionsList,
        }
      );
    }
  };

  const handleDownloadExcel = async () => {
    setIsExporting('EXCEL');
    try {
      const payload = await getDownloadPayload(
        downloadPeriod,
        downloadRange.startISO,
        downloadRange.endISO
      );

      const sum = payload.summary || summary;
      const washes = payload.recentWashes || recentWashesList || [];
      const channels = payload.paymentChannelMix || payMixList || [];
      const services = payload.serviceDistribution || serviceDistributionList || [];

      const lines: string[] = [];
      lines.push(`CAR WASH - SALES ANALYTICS & REVENUE REPORT`);
      lines.push(`Period:,${downloadPeriod}`);
      lines.push(`Date Range:,${formatISOToDDMMYYYY(downloadRange.startISO)} to ${formatISOToDDMMYYYY(downloadRange.endISO)}`);
      lines.push(`Generated By:,${cashierName || 'Admin'}`);
      lines.push(`Generated At:,${new Date().toLocaleString('en-GB')}`);
      lines.push(``);

      lines.push(`--- SUMMARY KPI METRICS ---`);
      lines.push(`Metric,Value`);
      lines.push(`Total Revenue,$${Number(sum.totalRevenue || 0).toFixed(2)}`);
      lines.push(`Net Sales,$${Number(sum.totalNetRevenue || 0).toFixed(2)}`);
      lines.push(`GST Collected,$${Number(sum.totalGSTAmount || 0).toFixed(2)}`);
      lines.push(`Total Washes Booked,${sum.totalBookings || sum.totalWashes || washes.length}`);
      lines.push(`Completed Washes,${sum.totalCompletedWashes || washes.length}`);
      lines.push(`Closed Washes,${sum.totalClosedWashes || 0}`);
      lines.push(`Average Order Value,$${Number(sum.averageOrderValue || 0).toFixed(2)}`);
      lines.push(`Unique Customers,${sum.totalUniqueCustomers || 0}`);
      lines.push(`Unique Vehicles,${sum.totalUniqueVehicles || 0}`);
      lines.push(``);

      if (channels.length > 0) {
        lines.push(`--- PAYMENT CHANNEL MIX ---`);
        lines.push(`Payment Method,Transactions,Volume %,Net Sales ($),GST ($),Total Revenue ($),Revenue %`);
        channels.forEach((ch) => {
          lines.push(
            `"${ch.paymentChannelName || ch.paymentChannel}",${ch.transactionCount || 0},${(ch.volumePercentage || 0).toFixed(1)}%,$${Number(ch.netSales || 0).toFixed(2)},$${Number(ch.gstAmount || 0).toFixed(2)},$${Number(ch.totalAmount || 0).toFixed(2)},${(ch.revenuePercentage || 0).toFixed(1)}%`
          );
        });
        lines.push(``);
      }

      if (services.length > 0) {
        lines.push(`--- SERVICE PACKAGE DISTRIBUTION ---`);
        lines.push(`Category,Package Name,Total Washes,Share %,Net Sales ($),GST ($),Gross Revenue ($)`);
        services.forEach((sv) => {
          lines.push(
            `"${sv.serviceCategoryName || ''}","${sv.packageName || ''}",${sv.totalWashes || 0},${(sv.washSharePercentage || 0).toFixed(1)}%,$${Number(sv.netSales || 0).toFixed(2)},$${Number(sv.gstSales || 0).toFixed(2)},$${Number(sv.grossRevenue || 0).toFixed(2)}`
          );
        });
        lines.push(``);
      }

      lines.push(`--- COMPLETED WASHES & TRANSACTIONS ---`);
      lines.push(`Order ID,Order No,Vehicle Plate,Customer Name,Package,Total Amount ($),Status,Date & Time`);
      washes.forEach((w: any) => {
        lines.push(
          `"${w.orderId || ''}","${w.orderNo || ''}","${w.vehicleNumber || w.plateNumber || ''}","${(w.customerName || '').replace(/"/g, '""')}","${(w.packageName || w.serviceName || '').replace(/"/g, '""')}",$${Number(w.totalAmount || w.amount || 0).toFixed(2)},"${w.statusName || w.status || ''}","${w.createdDate || w.completedDate || w.startedDate || ''}"`
        );
      });

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const csvContent = '\uFEFF' + lines.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `CarWash_SalesReport_${downloadPeriod}_${downloadRange.startISO}_to_${downloadRange.endISO}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Error generating Excel report:', err);
    } finally {
      setIsExporting(null);
    }
  };

  const handleDownloadPdf = async () => {
    setIsExporting('PDF');
    try {
      const payload = await getDownloadPayload(
        downloadPeriod,
        downloadRange.startISO,
        downloadRange.endISO
      );

      const sum = payload.summary || summary;
      const washes = payload.recentWashes || recentWashesList || [];
      const channels = payload.paymentChannelMix || payMixList || [];

      const rowsHtml = washes
        .slice(0, 100)
        .map(
          (w: any) => `
          <tr>
            <td><strong>#${w.orderNo || w.orderId}</strong></td>
            <td><span class="plate-badge">${w.vehicleNumber || w.plateNumber || '—'}</span></td>
            <td>${w.customerName || 'Walk-in Customer'}</td>
            <td>${w.packageName || w.serviceName || 'Standard Wash'}</td>
            <td style="text-align: right; font-weight: 700; color: #0F172A;">$${Number(w.totalAmount || w.amount || 0).toFixed(2)}</td>
            <td><span class="status-badge status-done">${w.statusName || w.status || 'Completed'}</span></td>
            <td style="color: #64748B; font-size: 11px;">${w.createdDate ? new Date(w.createdDate).toLocaleDateString('en-GB') : '—'}</td>
          </tr>
        `
        )
        .join('');

      const channelRowsHtml = channels
        .map(
          (c) => `
          <tr>
            <td><strong>${c.paymentChannelName || c.paymentChannel}</strong></td>
            <td style="text-align: center;">${c.transactionCount}</td>
            <td style="text-align: right; font-weight: 700;">$${Number(c.totalAmount || 0).toFixed(2)}</td>
            <td style="text-align: right; color: #E60012; font-weight: 600;">${(c.revenuePercentage || 0).toFixed(1)}%</td>
          </tr>
        `
        )
        .join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Car Wash Sales Report - ${downloadPeriod}</title>
            <style>
              @page { size: A4; margin: 12mm; }
              * { box-sizing: border-box; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                color: #0F172A;
                background: #FFFFFF;
                margin: 0;
                padding: 24px;
                font-size: 12px;
                line-height: 1.4;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                border-bottom: 2px solid #E60012;
                padding-bottom: 16px;
                margin-bottom: 20px;
              }
              .brand-col h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 900;
                color: #E60012;
                letter-spacing: -0.5px;
              }
              .brand-col p {
                margin: 4px 0 0;
                font-size: 13px;
                color: #64748B;
                font-weight: 500;
              }
              .meta-col {
                text-align: right;
                font-size: 11px;
                color: #475569;
              }
              .meta-pill {
                display: inline-block;
                background: #FEF2F2;
                border: 1px solid #FECACA;
                color: #E60012;
                padding: 4px 10px;
                border-radius: 9999px;
                font-weight: 700;
                font-size: 11px;
                margin-bottom: 6px;
              }
              .kpi-row {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
                margin-bottom: 24px;
              }
              .kpi-box {
                background: #F8FAFC;
                border: 1px solid #E2E8F0;
                border-radius: 10px;
                padding: 12px 14px;
              }
              .kpi-box.highlight {
                background: #FEF2F2;
                border-color: #FECACA;
              }
              .kpi-label {
                font-size: 10px;
                font-weight: 800;
                text-transform: uppercase;
                color: #64748B;
                letter-spacing: 0.5px;
                margin-bottom: 4px;
              }
              .kpi-box.highlight .kpi-label {
                color: #E60012;
              }
              .kpi-val {
                font-size: 22px;
                font-weight: 900;
                color: #0F172A;
              }
              .kpi-box.highlight .kpi-val {
                color: #E60012;
              }
              .section-heading {
                font-size: 13px;
                font-weight: 800;
                color: #0F172A;
                margin: 20px 0 10px;
                display: flex;
                align-items: center;
                gap: 8px;
              }
              .section-heading::before {
                content: '';
                width: 4px;
                height: 16px;
                background: #E60012;
                border-radius: 2px;
                display: inline-block;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 16px;
                font-size: 11px;
              }
              th {
                background: #F1F5F9;
                color: #475569;
                font-weight: 700;
                text-align: left;
                padding: 8px 10px;
                border-top: 1px solid #E2E8F0;
                border-bottom: 2px solid #CBD5E1;
                text-transform: uppercase;
                font-size: 10px;
                letter-spacing: 0.4px;
              }
              td {
                padding: 8px 10px;
                border-bottom: 1px solid #F1F5F9;
              }
              tr:nth-child(even) td {
                background: #FBFCFD;
              }
              .plate-badge {
                display: inline-block;
                background: #0F172A;
                color: #FFFFFF;
                font-weight: 700;
                padding: 2px 7px;
                border-radius: 4px;
                font-size: 10px;
                letter-spacing: 0.5px;
              }
              .status-badge {
                display: inline-block;
                padding: 2px 8px;
                border-radius: 9999px;
                font-size: 10px;
                font-weight: 700;
              }
              .status-done {
                background: #DCFCE7;
                color: #166534;
              }
              .footer {
                margin-top: 24px;
                padding-top: 12px;
                border-top: 1px solid #E2E8F0;
                display: flex;
                justify-content: space-between;
                color: #94A3B8;
                font-size: 10px;
              }
              @media print {
                body { padding: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="brand-col">
                <h1>CAR WASH SALES REPORT</h1>
                <p>Official Sales & Revenue Analytics Statement</p>
              </div>
              <div class="meta-col">
                <div class="meta-pill">${downloadPeriod} REPORT</div>
                <div><strong>Date Range:</strong> ${formatISOToDDMMYYYY(downloadRange.startISO)} – ${formatISOToDDMMYYYY(downloadRange.endISO)}</div>
                <div><strong>Generated:</strong> ${new Date().toLocaleString('en-GB')}</div>
                <div><strong>Cashier / Staff:</strong> ${cashierName || 'Admin'}</div>
              </div>
            </div>

            <div class="kpi-row">
              <div class="kpi-box highlight">
                <div class="kpi-label">Gross Revenue</div>
                <div class="kpi-val">$${Number(sum.totalRevenue || 0).toFixed(2)}</div>
              </div>
              <div class="kpi-box">
                <div class="kpi-label">Net Sales</div>
                <div class="kpi-val">$${Number(sum.totalNetRevenue || 0).toFixed(2)}</div>
              </div>
              <div class="kpi-box">
                <div class="kpi-label">Completed Washes</div>
                <div class="kpi-val">${sum.totalCompletedWashes || washes.length}</div>
              </div>
              <div class="kpi-box">
                <div class="kpi-label">Avg Order Value</div>
                <div class="kpi-val">$${Number(sum.averageOrderValue || 0).toFixed(2)}</div>
              </div>
            </div>

            ${
              channels.length > 0
                ? `
              <div class="section-heading">Payment Channel Breakdown</div>
              <table>
                <thead>
                  <tr>
                    <th>Payment Channel</th>
                    <th style="text-align: center;">Transactions</th>
                    <th style="text-align: right;">Total Amount</th>
                    <th style="text-align: right;">Revenue Share</th>
                  </tr>
                </thead>
                <tbody>
                  ${channelRowsHtml}
                </tbody>
              </table>
            `
                : ''
            }

            <div class="section-heading">Completed Wash Orders (${washes.length})</div>
            <table>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Vehicle Plate</th>
                  <th>Customer</th>
                  <th>Service Package</th>
                  <th style="text-align: right;">Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colspan="7" style="text-align: center; color: #94A3B8; padding: 20px;">No completed orders recorded for this period</td></tr>'}
              </tbody>
            </table>

            <div class="footer">
              <div>Unipro Car Wash Management System • Confidential</div>
              <div>Generated via Antigravity POS</div>
            </div>
          </body>
        </html>
      `;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(htmlContent);
          doc.close();
          iframe.contentWindow?.focus();
          setTimeout(() => {
            iframe.contentWindow?.print();
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            }, 2000);
          }, 500);
        }
      }
    } catch (err) {
      console.error('Error generating PDF report:', err);
    } finally {
      setIsExporting(null);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__exportReportsCsv = handleDownloadExcel;
      (window as any).__exportReportsPdf = handleDownloadPdf;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__exportReportsCsv;
        delete (window as any).__exportReportsPdf;
      }
    };
  }, [handleDownloadExcel, handleDownloadPdf]);

  // Bay stats calculations
  const totalBaysCount = bayUtilList.length > 0 
    ? bayUtilList.length 
    : (bays.length > 0 ? bays.length : 5);

  const inUseBaysCount = bayUtilList.length > 0
    ? bayUtilList.filter(b => b.currentStatus && (b.currentStatus.toUpperCase().includes('OCCUPIED') || b.currentStatus.toUpperCase().includes('SERVICE'))).length
    : bays.filter(b => b.bayStatus && (b.bayStatus.toUpperCase().includes('OCCUPIED') || b.bayStatus.toUpperCase().includes('SERVICE'))).length;

  const idleBaysCount = Math.max(0, totalBaysCount - inUseBaysCount);

  const calculatedUtilizationPct = bayUtilList.length > 0
    ? Math.round(bayUtilList.reduce((acc, b) => acc + (b.utilizationPercentage || 0), 0) / bayUtilList.length)
    : (totalBaysCount > 0 ? Math.round((inUseBaysCount / totalBaysCount) * 100) : 0);

  const averageBayServiceMinutes = bayUtilList.length > 0
    ? Math.round(bayUtilList.reduce((acc, b) => acc + (b.avgServiceMinutesPerCar || 0), 0) / bayUtilList.length)
    : (summary.avgWashDurationMinutes || 18);

  // Active trend item for tooltip
  const activeTrendItem = washTrendList[activeTrendIdx] || washTrendList[0] || null;

  // Service Distribution State
  const [activeServiceIdx, setActiveServiceIdx] = useState<number | null>(null);
  const activeServiceItem = activeServiceIdx !== null ? serviceDistributionList[activeServiceIdx] : null;
  const topServiceItem = serviceDistributionList.length > 0 
    ? [...serviceDistributionList].sort((a, b) => (b.totalWashes || 0) - (a.totalWashes || 0))[0] 
    : null;
  const totalDistWashes = serviceDistributionList.reduce((acc, s) => acc + (s.totalWashes || 0), 0) || 1;

  // Ranked Top Using Packages List
  const topPackagesList = useMemo(() => {
    return [...serviceDistributionList].sort(
      (a, b) => (b.totalWashes || 0) - (a.totalWashes || 0) || (b.grossRevenue || 0) - (a.grossRevenue || 0)
    );
  }, [serviceDistributionList]);

  const totalPackageRevenue = useMemo(() => {
    return topPackagesList.reduce((acc, p) => acc + (p.grossRevenue || 0), 0);
  }, [topPackagesList]);

  const totalPackageWashes = useMemo(() => {
    return topPackagesList.reduce((acc, p) => acc + (p.totalWashes || 0), 0);
  }, [topPackagesList]);

  const maxTrendWashes = Math.max(10, ...washTrendList.map(w => w.completedWashes || 0));
  const maxTrendRevenue = Math.max(100, ...washTrendList.map(w => w.dailyRevenue || 0));
  const peakTrendItem = washTrendList.length > 0 
    ? [...washTrendList].sort((a, b) => (b.completedWashes || 0) - (a.completedWashes || 0))[0]
    : null;
  const totalTrendWashes = washTrendList.reduce((acc, w) => acc + (w.completedWashes || 0), 0);
  const totalTrendRevenue = washTrendList.reduce((acc, w) => acc + (w.dailyRevenue || 0), 0);
  const avgDailyWashes = washTrendList.length > 0 ? (totalTrendWashes / washTrendList.length).toFixed(1) : '0';

  const formatOrderNo = (orderNo?: string | number): string => {
    if (!orderNo) return '0000';
    const str = String(orderNo).trim();
    return str.length >= 4 ? str.slice(-4) : str.padStart(4, '0');
  };

  // Full Wash Details Modal State
  const [selectedWashOrder, setSelectedWashOrder] = useState<RecentWashItem | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isReprinting, setIsReprinting] = useState(false);

  const handleOpenOrderDetails = (order: RecentWashItem) => {
    setSelectedWashOrder(order);
    setIsDetailsModalOpen(true);
  };

  const handleReprintOrder = async (order?: RecentWashItem | null) => {
    if (!order) return;
    try {
      setIsReprinting(true);
      await printOrderReceipt({
        billNumber: order.orderNo,
        customerDetails: {
          customerName: order.customerName,
          vehicleNumber: order.vehicleNumber,
        },
        vehicle: {
          name: order.vehicleTypeName || 'Standard Vehicle',
        },
        selectedPackage: {
          name: order.packageName,
        },
        totalAmount: order.totalAmount,
        gstAmount: order.totalAmount * 0.09 / 1.09,
        paymentMode: 'CASH',
        paymentStatus: order.statusName || 'PAID',
      });
      if (Platform.OS === 'web') {
        alert(`Receipt ticket sent to printer for Order ${order.orderNo}`);
      }
    } catch (err: any) {
      if (Platform.OS === 'web') alert('Print Error: ' + err.message);
    } finally {
      setIsReprinting(false);
    }
  };

  const formatRelativeTime = (dateStr?: string | null): string => {
    if (!dateStr) return 'Recently';
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} mins ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'Recently';
    }
  };

  const SERVICE_THEMES = [
    { stroke: '#ED0712', bg: '#FEF2F2', border: '#FEE2E2', text: '#ED0712' },
    { stroke: '#6366F1', bg: '#EEF2FF', border: '#E0E7FF', text: '#4F46E5' },
    { stroke: '#F59E0B', bg: '#FFFBEB', border: '#FEF3C7', text: '#D97706' },
    { stroke: '#06B6D4', bg: '#ECFEFF', border: '#CFFAFE', text: '#0891B2' },
    { stroke: '#10B981', bg: '#ECFDF5', border: '#D1FAE5', text: '#059669' },
    { stroke: '#EC4899', bg: '#FDF2F8', border: '#FCE7F3', text: '#DB2777' },
  ];
  const SERVICE_PALETTE = SERVICE_THEMES.map(t => t.stroke);
  const PAYMENT_PALETTE: Record<string, string> = {
    CASH: '#ED0712',
    ONLINE: '#F43F5E',
    CARD: '#F97316',
    MEMBER: '#A855F7',
    FOC: '#8B5CF6',
    CREDIT: '#3B82F6',
    NETS: '#06B6D4',
    PAYNOW: '#10B981',
  };

  const PACKAGE_THEMES = [
    {
      rank: '#1',
      rankBg: '#FEF2F2',
      rankBorder: '#FECACA',
      rankText: '#DC2626',
      stroke: '#ED0712',
      cardBg: '#FFFBFB',
      cardBorder: '#FEE2E2',
      pillBg: '#FEF2F2',
      pillText: '#DC2626',
      pillBorder: '#FECACA',
      isLeader: true,
    },
    {
      rank: '#2',
      rankBg: '#EFF6FF',
      rankBorder: '#BFDBFE',
      rankText: '#2563EB',
      stroke: '#2563EB',
      cardBg: '#FFFFFF',
      cardBorder: '#E2E8F0',
      pillBg: '#EFF6FF',
      pillText: '#2563EB',
      pillBorder: '#BFDBFE',
      isLeader: false,
    },
    {
      rank: '#3',
      rankBg: '#F0FDF4',
      rankBorder: '#BBF7D0',
      rankText: '#16A34A',
      stroke: '#16A34A',
      cardBg: '#FFFFFF',
      cardBorder: '#E2E8F0',
      pillBg: '#F0FDF4',
      pillText: '#16A34A',
      pillBorder: '#BBF7D0',
      isLeader: false,
    },
    {
      rank: '#4',
      rankBg: '#FFFBEB',
      rankBorder: '#FDE68A',
      rankText: '#D97706',
      stroke: '#D97706',
      cardBg: '#FFFFFF',
      cardBorder: '#E2E8F0',
      pillBg: '#FFFBEB',
      pillText: '#D97706',
      pillBorder: '#FDE68A',
      isLeader: false,
    },
  ];

  const { width } = useWindowDimensions();
  const isMobile = width < 680;
  const isTablet = width >= 680 && width < 1024;

  return (
    <View style={styles.container}>
      {/* Optional Error Banner */}
      {loadError && (
        <View style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#DC2626', fontSize: 13, fontWeight: '700' }}>⚠️ {loadError}</Text>
          <TouchableOpacity onPress={() => loadDashboard(selectedPeriodTab, true)} style={{ backgroundColor: '#DC2626', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 11 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ============================================================== */}
      {/* 2. TIME PERIOD TABS BAR (DAILY | WEEKLY | MONTHLY | YEARLY) */}
      {/* ============================================================== */}
      <View style={styles.periodTabsContainer}>
        {(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const).map((tab) => {
          const isActive = selectedPeriodTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.periodTabItem, isActive && styles.periodTabItemActive]}
              onPress={() => {
                setSelectedPeriodTab(tab);
                setCustomStartDate(null);
                setCustomEndDate(null);
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.periodTabText, isActive && styles.periodTabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ============================================================== */}
      {/* 2.1 SLEEK DATE SELECTOR BAR */}
      {/* ============================================================== */}
      <View style={styles.dateSelectorBar}>
        {/* Previous Button */}
        <TouchableOpacity
          style={styles.navSquareBtn}
          onPress={handlePrevious}
          activeOpacity={0.7}
          accessibilityLabel="Previous date"
        >
          <Ionicons name="chevron-back" size={20} color="#0F172A" />
        </TouchableOpacity>

        {selectedPeriodTab === 'DAILY' ? (
          /* SINGLE DATE CARD FOR DAILY VIEW */
          <View style={styles.singleDateCard}>
            <View style={styles.singleDateCenter}>
              <View style={styles.dateIconCircleSmall}>
                <Ionicons name="calendar-outline" size={16} color="#E60012" />
              </View>
              <Text style={styles.singleDateValue}>
                {formatISOToDDMMYYYY(effectiveStartISO)}
              </Text>
            </View>

            {Platform.OS === 'web' && (
              <input
                type="date"
                value={effectiveStartISO}
                max={todayISO}
                onChange={(e) => {
                  if (e.target.value) {
                    const val = e.target.value > todayISO ? todayISO : e.target.value;
                    setCustomStartDate(val);
                    setCustomEndDate(val);
                  }
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                } as any}
              />
            )}
          </View>
        ) : (
          /* RANGE CARDS FOR WEEKLY, MONTHLY, YEARLY */
          <>
            {/* FROM DATE Card */}
            <View style={styles.dateCard}>
              <View style={styles.dateCardInner}>
                <View style={styles.dateIconCircleSmall}>
                  <Ionicons name="calendar-outline" size={15} color="#E60012" />
                </View>
                <View style={styles.dateCardTextCol}>
                  <Text style={styles.dateCardLabel}>FROM DATE</Text>
                  <Text style={styles.dateCardValue}>{formatISOToDDMMYYYY(effectiveStartISO)}</Text>
                </View>
              </View>
              {Platform.OS === 'web' && (
                <input
                  type="date"
                  value={effectiveStartISO}
                  max={todayISO}
                  onChange={(e) => {
                    if (e.target.value) {
                      const val = e.target.value > todayISO ? todayISO : e.target.value;
                      setCustomStartDate(val);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                  } as any}
                />
              )}
            </View>

            {/* Range Separator Arrow */}
            <View style={styles.rangeArrowBox}>
              <Text style={styles.rangeArrowText}>➔</Text>
            </View>

            {/* TO DATE Card */}
            <View style={styles.dateCard}>
              <View style={styles.dateCardInner}>
                <View style={styles.dateIconCircleSmall}>
                  <Ionicons name="calendar-outline" size={15} color="#E60012" />
                </View>
                <View style={styles.dateCardTextCol}>
                  <Text style={styles.dateCardLabel}>TO DATE</Text>
                  <Text style={styles.dateCardValue}>{formatISOToDDMMYYYY(effectiveEndISO)}</Text>
                </View>
              </View>
              {Platform.OS === 'web' && (
                <input
                  type="date"
                  value={effectiveEndISO}
                  max={todayISO}
                  onChange={(e) => {
                    if (e.target.value) {
                      const val = e.target.value > todayISO ? todayISO : e.target.value;
                      setCustomEndDate(val);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                  } as any}
                />
              )}
            </View>
          </>
        )}

        {/* Next Button */}
        <TouchableOpacity
          style={[styles.navSquareBtn, isAtPresent && { opacity: 0.35 }]}
          onPress={handleNext}
          disabled={isAtPresent}
          activeOpacity={isAtPresent ? 1 : 0.7}
          accessibilityLabel="Next date"
        >
          <Ionicons name="chevron-forward" size={20} color="#0F172A" />
        </TouchableOpacity>
      </View>

      {/* ============================================================== */}
      {/* 3. ROW 1: 4 TOP KPI CARDS */}
      {/* ============================================================== */}
      <View style={styles.kpiRowFour}>
        {/* Card 1: Total Washes (Red Gradient) */}
        <View style={styles.kpiCardRedGradient}>
          <View style={styles.kpiTopRow}>
            <View style={styles.iconCircleWhite}>
              <Ionicons name="car-sport" size={20} color="#ED0712" />
            </View>
            <View style={styles.pillGreenOnDark}>
              <Text style={styles.pillGreenTextOnDark}>{washesBadgeText}</Text>
            </View>
          </View>
          <Text style={styles.kpiLabelOnDark}>Total Washes</Text>
          <Text style={styles.kpiValueOnDark}>{totalWashesCount.toLocaleString()}</Text>
          <Text style={styles.kpiCompareOnDark}>
            Completed: {completedWashesCount} • Closed: {closedWashesCount} • In Service: {summary.totalActiveWashes}
          </Text>
        </View>

        {/* Card 2: Total Revenue (White with red wave) */}
        <View style={styles.kpiCardWhite}>
          <View style={styles.kpiTopRow}>
            <View style={styles.iconCircleRedSoft}>
              <Ionicons name="cash-outline" size={20} color="#ED0712" />
            </View>
            <View style={styles.pillGreenLight}>
              <Text style={styles.pillGreenText}>Gross</Text>
            </View>
          </View>
          <Text style={styles.kpiLabel}>Total Revenue</Text>
          <Text style={styles.kpiValue}>${summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          <Text style={styles.kpiCompare}>Net: ${summary.totalNetRevenue.toFixed(2)} • GST: ${summary.totalGSTAmount.toFixed(2)}</Text>
        </View>

        {/* Card 3: Total Customers (White with red wave) */}
        <View style={styles.kpiCardWhite}>
          <View style={styles.kpiTopRow}>
            <View style={styles.iconCircleRedSoft}>
              <Ionicons name="people-outline" size={20} color="#ED0712" />
            </View>
            <View style={styles.pillRedLight}>
              <Text style={styles.pillRedText}>Active</Text>
            </View>
          </View>
          <Text style={styles.kpiLabel}>Total Customers</Text>
          <Text style={styles.kpiValue}>{summary.totalUniqueCustomers.toLocaleString()}</Text>
          <Text style={styles.kpiCompare}>Unique customer accounts</Text>
        </View>

        {/* Card 4: Total Vehicles (White with red wave) */}
        <View style={styles.kpiCardWhite}>
          <View style={styles.kpiTopRow}>
            <View style={styles.iconCircleRedSoft}>
              <Ionicons name="car-outline" size={20} color="#ED0712" />
            </View>
            <View style={styles.pillGreenLight}>
              <Text style={styles.pillGreenText}>Serviced</Text>
            </View>
          </View>
          <Text style={styles.kpiLabel}>Total Vehicles</Text>
          <Text style={styles.kpiValue}>{summary.totalUniqueVehicles.toLocaleString()}</Text>
          <Text style={styles.kpiCompare}>Unique vehicle plates</Text>
        </View>
      </View>

      {/* ============================================================== */}
      {/* 4. ROW 2: BAY UTILIZATION | WASH TREND | SERVICE DISTRIBUTION */}
      {/* ============================================================== */}
      <View style={styles.threeCardsRow}>
        {/* Card 1: Bay Utilization (Moved to Left Side) */}
        <View style={styles.cardFlexOne}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Bay Utilization</Text>
              <Text style={styles.cardSubtitle}>Service bay usage & availability</Text>
            </View>
            <View style={styles.smallDropdownPill}>
              <Text style={styles.smallDropdownText}>{selectedPeriodTab}</Text>
            </View>
          </View>

          <View style={styles.verticalDiagramCardContent}>
            {/* Centered Donut Gauge */}
            <View style={styles.centeredDonutBox}>
              <Svg width={120} height={120} viewBox="0 0 120 120">
                <Circle cx="60" cy="60" r="48" fill="none" stroke="#FEE2E2" strokeWidth="12" />
                <Circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray="301.6"
                  strokeDashoffset={301.6 * (1 - Math.min(100, Math.max(0, calculatedUtilizationPct)) / 100)}
                  rotation="-90"
                  origin="60, 60"
                />
              </Svg>

              <View style={styles.donutCenterLabel}>
                <Text style={styles.donutPctText}>{calculatedUtilizationPct}%</Text>
                <Text style={styles.donutSubText}>Utilization</Text>
              </View>
            </View>

            {/* Stats Breakdown shown UNDER the diagram */}
            <View style={styles.breakdownListUnder}>
              <View style={styles.underItemRow}>
                <View style={styles.bayStatLeft}>
                  <Ionicons name="car-sport-outline" size={15} color="#EF4444" />
                  <Text style={styles.bayStatLabel}>Total Bays</Text>
                </View>
                <Text style={styles.bayStatVal}>{totalBaysCount}</Text>
              </View>

              <View style={styles.underItemRow}>
                <View style={styles.bayStatLeft}>
                  <Ionicons name="radio-button-on" size={15} color="#22C55E" />
                  <Text style={styles.bayStatLabel}>Bays in Use</Text>
                </View>
                <Text style={styles.bayStatVal}>{inUseBaysCount}</Text>
              </View>

              <View style={styles.underItemRow}>
                <View style={styles.bayStatLeft}>
                  <Ionicons name="pause-circle-outline" size={15} color="#F59E0B" />
                  <Text style={styles.bayStatLabel}>Bays Idle</Text>
                </View>
                <Text style={styles.bayStatVal}>{idleBaysCount}</Text>
              </View>

              <View style={styles.bayStatDivider} />

              <View style={styles.underItemRow}>
                <View style={styles.bayStatLeft}>
                  <Ionicons name="time-outline" size={15} color="#0F172A" />
                  <Text style={styles.bayStatLabel}>Avg. Service Time</Text>
                </View>
                <Text style={styles.bayStatValBold}>{averageBayServiceMinutes} min</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Card 2: Wash Trend (Paired Bar Chart - Elevated SaaS Design) */}
        <View style={styles.cardFlexOnePointTwo}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.sectionHeaderIconBox, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="trending-up" size={17} color="#ED0712" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Wash Trend</Text>
                <Text style={styles.cardSubtitle}>Timeline comparison of washes and revenue</Text>
              </View>
            </View>
            <View style={styles.smallDropdownPill}>
              <Text style={styles.smallDropdownText}>{selectedPeriodTab}</Text>
            </View>
          </View>

          {/* Legends & Active Day Indicator */}
          <View style={styles.trendLegendBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={styles.legendItem}>
                <View style={[styles.legendPillDot, { backgroundColor: '#ED0712' }]} />
                <Text style={styles.legendText}>Washes</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendPillDot, { backgroundColor: '#FDA4AF' }]} />
                <Text style={styles.legendText}>Revenue ($)</Text>
              </View>
            </View>
            {activeTrendItem && (
              <View style={styles.activeDayPill}>
                <View style={styles.activeDayDot} />
                <Text style={styles.activeDayText}>
                  {activeTrendItem.dayName ? activeTrendItem.dayName.slice(0, 3) : 'Day'}: {(activeTrendItem.completedWashes || 0)}w · ${(activeTrendItem.dailyRevenue || 0).toFixed(0)}
                </Text>
              </View>
            )}
          </View>

          {/* Chart Wrapper */}
          <View style={styles.chartWrapper}>
            <View style={styles.yAxisCol}>
              {[
                maxTrendWashes.toString(),
                Math.round(maxTrendWashes * 0.75).toString(),
                Math.round(maxTrendWashes * 0.5).toString(),
                Math.round(maxTrendWashes * 0.25).toString(),
                '0',
              ].map((label, i) => (
                <Text key={i} style={styles.yAxisLabel}>{label}</Text>
              ))}
            </View>

            <View style={styles.plotArea}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={[styles.gridLine, { top: `${(i / 4) * 100}%` }]} />
              ))}

              {/* Active Tooltip over current item */}
              {activeTrendItem && washTrendList.length > 0 && (() => {
                const totalItems = washTrendList.length;
                const isNearRight = activeTrendIdx >= totalItems - 2;
                const isNearLeft = activeTrendIdx <= 1;
                return (
                  <View
                    style={[
                      styles.activeTooltipCard,
                      isNearRight
                        ? { right: 8, left: undefined }
                        : isNearLeft
                        ? { left: 8 }
                        : {
                            left: `${((activeTrendIdx + 0.5) / totalItems) * 100}%`,
                            transform: [{ translateX: -70 }],
                          },
                    ]}
                  >
                    <Text style={styles.tooltipTitle} numberOfLines={1}>
                      {activeTrendItem.dayName || 'Selected Day'}
                    </Text>
                    <View style={styles.tooltipRow}>
                      <View style={[styles.tooltipDot, { backgroundColor: '#ED0712' }]} />
                      <Text style={styles.tooltipTextWhite}>{(activeTrendItem.completedWashes || 0).toLocaleString()} Washes</Text>
                    </View>
                    <View style={styles.tooltipRow}>
                      <View style={[styles.tooltipDot, { backgroundColor: '#FDA4AF' }]} />
                      <Text style={styles.tooltipTextPink}>${(activeTrendItem.dailyRevenue || 0).toFixed(2)} Revenue</Text>
                    </View>
                    <View
                      style={[
                        styles.tooltipArrow,
                        isNearRight
                          ? { right: activeTrendIdx === totalItems - 1 ? 16 : 46, left: undefined }
                          : isNearLeft
                          ? { left: activeTrendIdx === 0 ? 16 : 46 }
                          : { left: '50%', marginLeft: -5 },
                      ]}
                    />
                  </View>
                );
              })()}

              {/* Bars Row */}
              <View style={styles.barsContainer}>
                {washTrendList.length > 0 ? (
                  washTrendList.map((item, idx) => {
                    const isActive = activeTrendIdx === idx;
                    const washesHeightPct = Math.min(100, Math.max(8, ((item.completedWashes || 0) / maxTrendWashes) * 100));
                    const revHeightPct = Math.min(100, Math.max(6, ((item.dailyRevenue || 0) / maxTrendRevenue) * 100));
                    const dayLabel = item.dayName ? item.dayName.slice(0, 3) : (item.orderDate ? item.orderDate.slice(5) : `D${idx+1}`);
                    const barWidth = washTrendList.length > 6 ? 8 : 11;

                    return (
                      <TouchableOpacity
                        key={item.orderDate || idx}
                        style={[styles.monthColGroup, isActive && styles.monthColGroupActive]}
                        onPress={() => setActiveTrendIdx(idx)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.slotTrack, isActive && styles.slotTrackActive]}>
                          <View style={styles.pairedBarsRow}>
                            <View style={[styles.barRedPrimary, { height: `${washesHeightPct}%`, width: barWidth }]} />
                            <View style={[styles.barPinkSecondary, { height: `${revHeightPct}%`, width: barWidth }]} />
                          </View>
                        </View>

                        <View style={styles.dayLabelWrap}>
                          {isActive && <View style={styles.activeDayIndicatorDot} />}
                          <Text style={[styles.monthLabelText, isActive && styles.monthLabelTextActive]} numberOfLines={1}>
                            {dayLabel}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#94A3B8', fontSize: 12 }}>No trend data for this period</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Bottom KPI Summary Footer */}
          <View style={styles.trendSummaryFooter}>
            <View style={styles.trendFooterStat}>
              <Text style={styles.trendFooterLabel}>Peak Day</Text>
              <Text style={styles.trendFooterValBold}>
                {peakTrendItem ? `${peakTrendItem.dayName || 'Peak'} (${peakTrendItem.completedWashes}w)` : '-'}
              </Text>
            </View>
            <View style={styles.trendFooterDivider} />
            <View style={styles.trendFooterStat}>
              <Text style={styles.trendFooterLabel}>Daily Average</Text>
              <Text style={styles.trendFooterVal}>{avgDailyWashes} washes</Text>
            </View>
            <View style={styles.trendFooterDivider} />
            <View style={styles.trendFooterStat}>
              <Text style={styles.trendFooterLabel}>Trend Revenue</Text>
              <Text style={[styles.trendFooterValBold, { color: '#059669' }]}>
                ${totalTrendRevenue.toFixed(0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Card 3: Service Distribution (Elevated Segmented Donut Analytics Card) */}
        <View style={styles.cardFlexOne}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.sectionHeaderIconBox, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="pie-chart" size={17} color="#ED0712" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Service Distribution</Text>
                <Text style={styles.cardSubtitle}>Wash packages by volume & share</Text>
              </View>
            </View>
            <View style={styles.smallDropdownPill}>
              <Text style={styles.smallDropdownText}>{selectedPeriodTab}</Text>
            </View>
          </View>

          {/* Interactive Segmented Donut SVG Chart */}
          <View style={styles.serviceDonutWrap}>
            <Svg width={150} height={150} viewBox="0 0 150 150">
              {/* Background Track */}
              <Circle cx="75" cy="75" r="54" fill="none" stroke="#F1F5F9" strokeWidth={14} />
              {(() => {
                let accumulatedPct = 0;
                const C = 2 * Math.PI * 54;
                const gap = serviceDistributionList.length > 1 ? 4 : 0;
                return serviceDistributionList.slice(0, 5).map((item, idx) => {
                  const theme = SERVICE_THEMES[idx % SERVICE_THEMES.length];
                  const pct = totalDistWashes > 0 ? ((item.totalWashes || 0) / totalDistWashes) * 100 : 0;
                  const sliceLen = Math.max(0, (pct / 100) * C - gap);
                  const dashArray = `${sliceLen.toFixed(1)}, ${(C - sliceLen).toFixed(1)}`;
                  const dashOffset = (-(accumulatedPct / 100) * C);
                  accumulatedPct += pct;
                  const isSliceActive = activeServiceIdx === idx;

                  return (
                    <Circle
                      key={item.packageId || idx}
                      cx="75"
                      cy="75"
                      r="54"
                      fill="none"
                      stroke={theme.stroke}
                      strokeWidth={isSliceActive ? 18 : 14}
                      strokeDasharray={dashArray}
                      strokeDashoffset={dashOffset}
                      strokeLinecap="butt"
                      rotation="-90"
                      origin="75, 75"
                      opacity={activeServiceIdx !== null && !isSliceActive ? 0.45 : 1}
                      onPress={() => setActiveServiceIdx(activeServiceIdx === idx ? null : idx)}
                    />
                  );
                });
              })()}
            </Svg>

            {/* Center Content Overlay */}
            <View style={styles.donutCenterLabel}>
              {activeServiceItem ? (
                <>
                  {(() => {
                    const theme = SERVICE_THEMES[(activeServiceIdx ?? 0) % SERVICE_THEMES.length];
                    return (
                      <>
                        <View style={[styles.activeServiceIndicatorPill, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                          <View style={[styles.activeServiceDot, { backgroundColor: theme.stroke }]} />
                          <Text style={[styles.activeServicePctText, { color: theme.text }]}>
                            {activeServiceItem.washSharePercentage}%
                          </Text>
                        </View>
                        <Text style={styles.donutValText}>{activeServiceItem.totalWashes}</Text>
                        <Text style={styles.serviceDonutSubText} numberOfLines={2}>
                          {activeServiceItem.packageName}
                        </Text>
                      </>
                    );
                  })()}
                </>
              ) : (
                <>
                  <View style={[styles.serviceCenterIconBox, { backgroundColor: '#FEF2F2' }]}>
                    <Ionicons name="sparkles" size={14} color="#ED0712" />
                  </View>
                  <Text style={styles.donutValText}>{totalWashesCount.toLocaleString()}</Text>
                  <Text style={styles.serviceDonutSubText}>Total Washes</Text>
                </>
              )}
            </View>
          </View>

          {/* Proportional Multi-Segment Progress Bar */}
          <View style={styles.proportionalBarContainer}>
            {serviceDistributionList.map((item, idx) => {
              const theme = SERVICE_THEMES[idx % SERVICE_THEMES.length];
              const pct = totalDistWashes > 0 ? ((item.totalWashes || 0) / totalDistWashes) * 100 : 0;
              if (pct <= 0) return null;
              return (
                <View
                  key={item.packageId || idx}
                  style={[
                    styles.proportionalBarSegment,
                    {
                      flex: Math.max(1, Math.round(pct)),
                      backgroundColor: theme.stroke,
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Breakdown List of Cards */}
          <View style={styles.serviceBreakdownList}>
            {serviceDistributionList.length > 0 ? (
              serviceDistributionList.slice(0, 4).map((item, idx) => {
                const theme = SERVICE_THEMES[idx % SERVICE_THEMES.length];
                const isActive = activeServiceIdx === idx;
                return (
                  <TouchableOpacity
                    key={item.packageId || idx}
                    activeOpacity={0.85}
                    onPress={() => setActiveServiceIdx(activeServiceIdx === idx ? null : idx)}
                    {...(Platform.OS === 'web'
                      ? ({
                          onMouseEnter: () => setActiveServiceIdx(idx),
                          onMouseLeave: () => setActiveServiceIdx(null),
                        } as any)
                      : {})}
                    style={[
                      styles.serviceBreakdownCard,
                      isActive && {
                        backgroundColor: theme.bg,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View style={styles.serviceCardTopRow}>
                      <View style={styles.serviceItemLeft}>
                        <View style={[styles.serviceColorBar, { backgroundColor: theme.stroke }]} />
                        <Text
                          style={[styles.serviceNameText, isActive && { color: '#0F172A', fontWeight: '800' }]}
                          numberOfLines={1}
                        >
                          {item.packageName}
                        </Text>
                      </View>
                      <View style={styles.serviceItemRight}>
                        <Text style={styles.serviceCountText}>
                          {item.totalWashes.toLocaleString()}{' '}
                          <Text style={styles.serviceCountUnit}>washes</Text>
                        </Text>
                        <View style={[styles.serviceSharePill, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                          <Text style={[styles.serviceSharePillText, { color: theme.text }]}>
                            {item.washSharePercentage}%
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Mini Progress Track */}
                    <View style={styles.serviceTrackBg}>
                      <View
                        style={[
                          styles.serviceTrackFill,
                          {
                            width: `${Math.min(100, Math.max(5, item.washSharePercentage || 0))}%`,
                            backgroundColor: theme.stroke,
                          },
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.emptyServiceText}>
                No wash services recorded for this period
              </Text>
            )}
          </View>

          {/* Service Summary Footer */}
          {serviceDistributionList.length > 0 && (
            <View style={styles.serviceSummaryFooter}>
              <View style={styles.serviceFooterLeft}>
                <Ionicons name="sparkles" size={13} color="#ED0712" />
                <Text style={styles.serviceFooterTopText} numberOfLines={1}>
                  Top:{' '}
                  <Text style={styles.serviceFooterTopBold}>
                    {topServiceItem?.packageName || 'N/A'} ({topServiceItem?.washSharePercentage || 0}%)
                  </Text>
                </Text>
              </View>
              <View style={styles.serviceFooterBadge}>
                <Text style={styles.serviceFooterBadgeText}>
                  {serviceDistributionList.length} Active Tiers
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* ============================================================== */}
      {/* 5. ROW 3: PAYMENT CHANNEL MIX | KEY METRICS | PAYMENT BREAKDOWN */}
      {/* ============================================================== */}
      <View style={styles.rowThreeContainer}>
        {/* Card 1: Payment Channel Mix (Infographic Circular Chart) */}
        <View style={[styles.rowThreeCard, { flex: 1.35, minWidth: 440 }]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Payment Channel Mix</Text>
              <Text style={styles.cardSubtitle}>Revenue distribution by mode</Text>
            </View>
          </View>

          <View style={styles.channelMixBody}>
            {/* Infographic Stepped Circular Chart (Reduced & Moved to Top Side) */}
            {Platform.OS === 'web' && payMixList.length > 0 ? (
              <View style={styles.infographicSvgContainer}>
                {(() => {
                  const cx = 280;
                  const cy = 135;
                  const rInner = 44;
                  const rMid = 68;

                  // Infographic gradient & color definitions matching reference
                  const channelStyles: Record<
                    string,
                    { gradId: string; primary: string; light: string; deep: string }
                  > = {
                    PAYNOW: {
                      gradId: 'grad_paynow',
                      primary: '#FF2A7A',
                      light: '#FF639B',
                      deep: '#E11D48',
                    },
                    MEMBER: {
                      gradId: 'grad_member',
                      primary: '#FF9900',
                      light: '#FFB82E',
                      deep: '#D97706',
                    },
                    CASH: {
                      gradId: 'grad_cash',
                      primary: '#7C3AED',
                      light: '#9B51E0',
                      deep: '#581C87',
                    },
                    CREDIT: {
                      gradId: 'grad_credit',
                      primary: '#C026D3',
                      light: '#E879F9',
                      deep: '#86198F',
                    },
                    CARD: {
                      gradId: 'grad_card',
                      primary: '#2563EB',
                      light: '#60A5FA',
                      deep: '#1D4ED8',
                    },
                    ONLINE: {
                      gradId: 'grad_online',
                      primary: '#4F46E5',
                      light: '#818CF8',
                      deep: '#3730A3',
                    },
                  };

                  const fallbackList = [
                    { gradId: 'grad_paynow', primary: '#FF2A7A', light: '#FF639B', deep: '#E11D48' },
                    { gradId: 'grad_member', primary: '#FF9900', light: '#FFB82E', deep: '#D97706' },
                    { gradId: 'grad_cash', primary: '#7C3AED', light: '#9B51E0', deep: '#581C87' },
                    { gradId: 'grad_credit', primary: '#C026D3', light: '#E879F9', deep: '#86198F' },
                    { gradId: 'grad_online', primary: '#4F46E5', light: '#818CF8', deep: '#3730A3' },
                  ];

                  const toRad = (deg: number) => (deg * Math.PI) / 180;
                  const polarToXY = (r: number, deg: number) => ({
                    x: cx + r * Math.cos(toRad(deg)),
                    y: cy + r * Math.sin(toRad(deg)),
                  });

                  const describeArc = (rIn: number, rOut: number, a1: number, a2: number) => {
                    const diff = a2 - a1;
                    const safeA2 = diff >= 359.99 ? a1 + 359.99 : a2;
                    const p1 = polarToXY(rOut, a1);
                    const p2 = polarToXY(rOut, safeA2);
                    const p3 = polarToXY(rIn, safeA2);
                    const p4 = polarToXY(rIn, a1);
                    const largeArc = diff > 180 ? 1 : 0;
                    return `M ${p1.x} ${p1.y} A ${rOut} ${rOut} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rIn} ${rIn} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`;
                  };

                  const describeArcLine = (r: number, a1: number, a2: number) => {
                    const diff = a2 - a1;
                    const safeA2 = diff >= 359.99 ? a1 + 359.99 : a2;
                    const p1 = polarToXY(r, a1);
                    const p2 = polarToXY(r, safeA2);
                    const largeArc = diff > 180 ? 1 : 0;
                    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
                  };

                  const totalPct =
                    payMixList.reduce((acc, cur) => acc + (cur.revenuePercentage || 0), 0) || 100;
                  let curAngle = -75; // Pinwheel start angle matching reference layout

                  // Stepped outer radii offsets (scaled compactly)
                  const getStepRadius = (idx: number, count: number) => {
                    if (count === 1) return 122;
                    if (count === 2) return idx === 0 ? 126 : 106;
                    if (count === 3) {
                      const tiers = [126, 102, 116];
                      return tiers[idx % 3];
                    }
                    if (count === 4) {
                      const tiers = [126, 98, 118, 108];
                      return tiers[idx % 4];
                    }
                    // 5 or more slices
                    const tiers = [126, 96, 120, 104, 128];
                    return tiers[idx % tiers.length];
                  };

                  const computedSlices = payMixList.map((item, idx) => {
                    const pct = Math.max(0, item.revenuePercentage || 0);
                    const span = (pct / totalPct) * 360;
                    const startA = curAngle;
                    const endA = curAngle + span;
                    curAngle += span;

                    const midA = (startA + endA) / 2;
                    const style =
                      channelStyles[item.paymentChannel] ||
                      fallbackList[idx % fallbackList.length];

                    const rOut = getStepRadius(idx, payMixList.length);

                    // Clean white radial seam between slices
                    const gap = span > 10 ? 2 : 0.6;
                    const safeStartA = startA + gap;
                    const safeEndA = endA - gap;

                    // Compute leader line coordinates with ample top clearance
                    const startPt = polarToXY(rOut + 3, midA);
                    const isTop = Math.sin(toRad(midA)) < 0;
                    const isTopApex = midA < -30 && midA > -90;
                    const isRight = isTopApex ? false : Math.cos(toRad(midA)) >= 0;

                    let rawKneeX: number;
                    let rawKneeY: number;

                    if (isTopApex) {
                      // Top slice (e.g. PAYNOW): route vertically up into pure whitespace above circle
                      rawKneeX = startPt.x;
                      rawKneeY = 16;
                    } else {
                      const diagDist = 20;
                      rawKneeX = startPt.x + Math.cos(toRad(midA)) * diagDist;
                      rawKneeY = startPt.y + Math.sin(toRad(midA)) * diagDist;

                      // Top slice leader line: pull up above the circle to avoid text overlap
                      if (isTop && Math.sin(toRad(midA)) < -0.35) {
                        rawKneeY = Math.min(rawKneeY, startPt.y - 18);
                      }
                    }

                    return {
                      item,
                      pct,
                      startA: safeStartA,
                      endA: safeEndA,
                      midA,
                      rOut,
                      style,
                      idx,
                      startPt,
                      isRight,
                      isTop,
                      isTopApex,
                      rawKneeX,
                      rawKneeY,
                    };
                  });

                  // Collision relaxation for leader line callouts
                  const relaxSide = (slices: typeof computedSlices) => {
                    slices.sort((a, b) => a.rawKneeY - b.rawKneeY);
                    const minY = 16;
                    const maxY = 248;
                    const minGap = 42;

                    for (let i = 0; i < slices.length; i++) {
                      if (slices[i].rawKneeY < minY) slices[i].rawKneeY = minY;
                    }
                    for (let i = 1; i < slices.length; i++) {
                      if (slices[i].rawKneeY - slices[i - 1].rawKneeY < minGap) {
                        slices[i].rawKneeY = slices[i - 1].rawKneeY + minGap;
                      }
                    }
                    if (slices.length > 0 && slices[slices.length - 1].rawKneeY > maxY) {
                      slices[slices.length - 1].rawKneeY = maxY;
                      for (let i = slices.length - 2; i >= 0; i--) {
                        if (slices[i + 1].rawKneeY - slices[i].rawKneeY < minGap) {
                          slices[i].rawKneeY = slices[i + 1].rawKneeY - minGap;
                        }
                      }
                    }
                  };

                  const rightSlices = computedSlices.filter((s) => s.isRight);
                  const leftSlices = computedSlices.filter((s) => !s.isRight);
                  relaxSide(rightSlices);
                  relaxSide(leftSlices);

                  return (
                    <svg
                      width="100%"
                      height="270"
                      viewBox="0 0 560 270"
                      style={{
                        display: 'block',
                        margin: '0 auto',
                        overflow: 'visible',
                        animation: 'infographicEntrance 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                      }}
                    >
                      <defs>
                        <style>
                          {`
                            @keyframes infographicEntrance {
                              0% { opacity: 0; transform: scale(0.95); }
                              100% { opacity: 1; transform: scale(1); }
                            }
                          `}
                        </style>

                        {/* Drop shadow for center white ring */}
                        <filter id="centerRingShadow" x="-30%" y="-30%" width="160%" height="160%">
                          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="rgba(0, 0, 0, 0.14)" />
                        </filter>
                        {/* Drop shadow for center pink button */}
                        <filter id="buttonShadow" x="-30%" y="-30%" width="160%" height="160%">
                          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="rgba(230, 0, 103, 0.45)" />
                        </filter>
                        {/* Soft drop shadow for outer 3D slices */}
                        <filter id="segmentShadow" x="-15%" y="-15%" width="130%" height="130%">
                          <feDropShadow dx="0" dy="2.5" stdDeviation="4" floodColor="rgba(0, 0, 0, 0.10)" />
                        </filter>

                        {/* Center Pink Button Gradient */}
                        <linearGradient id="pinkCenterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#FF1E8A" />
                          <stop offset="55%" stopColor="#E60067" />
                          <stop offset="100%" stopColor="#A21CAF" />
                        </linearGradient>

                        {/* Glossy specular reflection for center button */}
                        <linearGradient id="glossHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
                          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                        </linearGradient>

                        {/* Radial gradients for each segment matching reference */}
                        <linearGradient id="grad_paynow" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#FF337A" />
                          <stop offset="100%" stopColor="#E11D48" />
                        </linearGradient>
                        <linearGradient id="grad_member" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#FFB300" />
                          <stop offset="100%" stopColor="#F59E0B" />
                        </linearGradient>
                        <linearGradient id="grad_cash" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#8B5CF6" />
                          <stop offset="100%" stopColor="#5B21B6" />
                        </linearGradient>
                        <linearGradient id="grad_credit" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#E879F9" />
                          <stop offset="100%" stopColor="#A21CAF" />
                        </linearGradient>
                        <linearGradient id="grad_card" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#60A5FA" />
                          <stop offset="100%" stopColor="#1D4ED8" />
                        </linearGradient>
                        <linearGradient id="grad_online" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#6366F1" />
                          <stop offset="100%" stopColor="#3730A3" />
                        </linearGradient>
                      </defs>

                      {/* 1. SEAMLESS SOLID SECTORS WITH STEPPED RADII (From rInner to rOut) */}
                      {computedSlices.map((s) => {
                        const dMain = describeArc(rInner, s.rOut, s.startA, s.endA);
                        const dInnerGlow = describeArc(rInner, rMid, s.startA, s.endA);
                        const dArcLine = describeArcLine(rMid, s.startA, s.endA);

                        return (
                          <g key={`slice-${s.idx}`}>
                            {/* Solid Continuous Wedge */}
                            <path
                              d={dMain}
                              fill={`url(#${s.style.gradId})`}
                              stroke="#FFFFFF"
                              strokeWidth="2.8"
                              strokeLinejoin="round"
                              filter="url(#segmentShadow)"
                            />

                            {/* Inner Band Translucent White Sheen */}
                            <path
                              d={dInnerGlow}
                              fill="rgba(255, 255, 255, 0.16)"
                              stroke="none"
                            />

                            {/* Concentric Step Dividing Line */}
                            <path
                              d={dArcLine}
                              fill="none"
                              stroke="rgba(255, 255, 255, 0.42)"
                              strokeWidth="1.2"
                            />
                          </g>
                        );
                      })}

                      {/* 2. WHITE INWARD CHEVRONS & HIGH-DEFINITION VECTOR ICONS */}
                      {computedSlices.map((s) => {
                        const rIcon = (rInner + rMid) / 2; // 56px
                        const iconPos = polarToXY(rIcon, s.midA);
                        const tipPt = polarToXY(rInner, s.midA);
                        const lPt = polarToXY(rInner + 4, s.midA - 2.8);
                        const rPt = polarToXY(rInner + 4, s.midA + 2.8);
                        const ch = s.item.paymentChannel.toUpperCase();

                        return (
                          <g key={`icon-group-${s.idx}`}>
                            {/* Inward-pointing triangular notch */}
                            <polygon
                              points={`${tipPt.x},${tipPt.y} ${lPt.x},${lPt.y} ${rPt.x},${rPt.y}`}
                              fill="#FFFFFF"
                            />

                            {/* Vector Icons Matching Reference Template */}
                            <g transform={`translate(${iconPos.x}, ${iconPos.y})`}>
                              {/* 1. Target with Dart (MEMBER or fallback idx 0) */}
                              {(ch.includes('MEMBER') || s.idx === 0) && (
                                <g transform="scale(0.8)">
                                  <circle cx="0" cy="0" r="8" fill="none" stroke="#FFFFFF" strokeWidth="2" />
                                  <circle cx="0" cy="0" r="4.2" fill="none" stroke="#FFFFFF" strokeWidth="1.7" />
                                  <circle cx="0" cy="0" r="1.6" fill="#FFFFFF" />
                                  <path d="M 3.5 -3.5 L 9 -9 M 6 -3.5 L 9.5 -7 M 3.5 -6 L 7 -9.5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
                                </g>
                              )}

                              {/* 2. Magnifying Glass with Dollar Sign (PAYNOW or fallback idx 1) */}
                              {(ch.includes('PAYNOW') || s.idx === 1) && !ch.includes('MEMBER') && (
                                <g transform="scale(0.8)">
                                  <circle cx="-1.5" cy="-1.5" r="6.2" fill="none" stroke="#FFFFFF" strokeWidth="2" />
                                  <line x1="3.5" y1="3.5" x2="8" y2="8" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
                                  <text x="-1.5" y="1.2" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="900" fontFamily="sans-serif">$</text>
                                </g>
                              )}

                              {/* 3. Ascending 3-Column Bar Chart (CASH or fallback idx 2) */}
                              {(ch.includes('CASH') || s.idx === 2) && !ch.includes('MEMBER') && !ch.includes('PAYNOW') && (
                                <g transform="scale(0.8)">
                                  <line x1="-7" y1="6.5" x2="7" y2="6.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
                                  <rect x="-6" y="1.5" width="3" height="5" fill="#FFFFFF" rx="0.5" />
                                  <rect x="-1" y="-2" width="3" height="8.5" fill="#FFFFFF" rx="0.5" />
                                  <rect x="4" y="-6" width="3" height="12.5" fill="#FFFFFF" rx="0.5" />
                                </g>
                              )}

                              {/* 4. Interlocking Gears (CREDIT or fallback idx 3) */}
                              {(ch.includes('CARD') || ch.includes('CREDIT') || s.idx === 3) && !ch.includes('MEMBER') && !ch.includes('PAYNOW') && !ch.includes('CASH') && (
                                <g transform="scale(0.8)">
                                  <circle cx="-2.5" cy="2.5" r="4.5" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeDasharray="2.5 1.8" />
                                  <circle cx="-2.5" cy="2.5" r="1.5" fill="#FFFFFF" />
                                  <circle cx="3.8" cy="-3" r="3.4" fill="none" stroke="#FFFFFF" strokeWidth="1.4" strokeDasharray="2.2 1.5" />
                                  <circle cx="3.8" cy="-3" r="1.1" fill="#FFFFFF" />
                                </g>
                              )}

                              {/* 5. Globe Grid (ONLINE or other) */}
                              {!ch.includes('MEMBER') && !ch.includes('PAYNOW') && !ch.includes('CASH') && !ch.includes('CARD') && !ch.includes('CREDIT') && (
                                <g transform="scale(0.8)">
                                  <circle cx="0" cy="0" r="7" fill="none" stroke="#FFFFFF" strokeWidth="1.8" />
                                  <ellipse cx="0" cy="0" rx="3.2" ry="7" fill="none" stroke="#FFFFFF" strokeWidth="1.4" />
                                  <line x1="-7" y1="0" x2="7" y2="0" stroke="#FFFFFF" strokeWidth="1.4" />
                                </g>
                              )}
                            </g>
                          </g>
                        );
                      })}

                      {/* 3. THICK WHITE CIRCULAR RING (Elevated 3D Depth) */}
                      <circle cx={cx} cy={cy} r="44" fill="#FFFFFF" filter="url(#centerRingShadow)" />
                      <circle cx={cx} cy={cy} r="44" fill="none" stroke="#F1F5F9" strokeWidth="1.5" />

                      {/* 4. ATTRACTIVE PINK GRADIENT CENTER CIRCLE WITH 3D SHINE */}
                      <circle cx={cx} cy={cy} r="33" fill="url(#pinkCenterGrad)" stroke="#FFFFFF" strokeWidth="2.2" filter="url(#buttonShadow)" />
                      {/* Glossy top-dome reflection overlay */}
                      <path
                        d={`M ${cx - 25} ${cy - 6} A 26 26 0 0 1 ${cx + 25} ${cy - 6} A 25 12 0 0 0 ${cx - 25} ${cy - 6} Z`}
                        fill="url(#glossHighlight)"
                      />

                      {/* Center Disc Typography */}
                      <text
                        x={cx}
                        y={cy - 8}
                        textAnchor="middle"
                        fill="rgba(255, 255, 255, 0.92)"
                        fontSize="7.5"
                        fontWeight="800"
                        letterSpacing="1.4"
                        fontFamily="system-ui, -apple-system, sans-serif"
                      >
                        TOTAL
                      </text>
                      <text
                        x={cx}
                        y={cy + 6}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="15"
                        fontWeight="900"
                        fontFamily="system-ui, -apple-system, sans-serif"
                      >
                        ${summary.totalRevenue.toFixed(0)}
                      </text>
                      <text
                        x={cx}
                        y={cy + 16}
                        textAnchor="middle"
                        fill="rgba(255, 255, 255, 0.88)"
                        fontSize="6.5"
                        fontWeight="700"
                        letterSpacing="1.1"
                        fontFamily="system-ui, -apple-system, sans-serif"
                      >
                        REVENUE
                      </text>

                      {/* 5. EXTERNAL CONNECTING LINES WITH CIRCULAR NODES & DETAILS */}
                      {computedSlices.map((s) => {
                        const kneeX = s.rawKneeX;
                        const kneeY = s.rawKneeY;
                        const horizLen = 26;
                        const endX = kneeX + (s.isRight ? horizLen : -horizLen);
                        const endY = kneeY;

                        const textX = endX + (s.isRight ? 8 : -8);
                        const textAnchor = s.isRight ? 'start' : 'end';

                        return (
                          <g key={`leader-${s.idx}`}>
                            {/* Connecting Line (Diagonal/Vertical + Horizontal) */}
                            <path
                              d={`M ${s.startPt.x} ${s.startPt.y} L ${kneeX} ${kneeY} L ${endX} ${endY}`}
                              fill="none"
                              stroke={s.style.primary}
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />

                            {/* Small Circular Endpoint (Hollow node matching reference) */}
                            <circle
                              cx={endX}
                              cy={endY}
                              r="3.5"
                              fill="#FFFFFF"
                              stroke={s.style.primary}
                              strokeWidth="2"
                            />

                            {/* High-Contrast Frosted Badge Behind Text for 100% Guaranteed Legibility */}
                            <rect
                              x={s.isRight ? textX - 4 : textX - 86}
                              y={endY - 14}
                              width="90"
                              height="40"
                              fill="rgba(255, 255, 255, 0.94)"
                              rx="6"
                            />

                            {/* Dynamic Percentage */}
                            <text
                              x={textX}
                              y={endY - 3}
                              textAnchor={textAnchor}
                              fill={s.style.primary}
                              fontSize="17"
                              fontWeight="900"
                              fontFamily="system-ui, -apple-system, sans-serif"
                            >
                              {s.pct}%
                            </text>

                            {/* Payment Mode Title */}
                            <text
                              x={textX}
                              y={endY + 10}
                              textAnchor={textAnchor}
                              fill="#0F172A"
                              fontSize="11.5"
                              fontWeight="800"
                              letterSpacing="0.4"
                              fontFamily="system-ui, -apple-system, sans-serif"
                            >
                              {s.item.paymentChannelName || s.item.paymentChannel}
                            </text>

                            {/* Revenue Amount & Transaction Count */}
                            <text
                              x={textX}
                              y={endY + 22}
                              textAnchor={textAnchor}
                              fill="#64748B"
                              fontSize="9.5"
                              fontWeight="600"
                              fontFamily="system-ui, -apple-system, sans-serif"
                            >
                              ${s.item.totalAmount.toFixed(0)} · {s.item.transactionCount || 0} orders
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </View>
            ) : null}

            {/* Proportional Segmented Payment Channel Mix Bar (Active on Native & Mobile) */}
            {payMixList.length > 0 && (
              <View style={styles.payMixProportionalBar}>
                {payMixList.map((c) => {
                  const colorMap: Record<string, string> = {
                    PAYNOW: '#FF2A7A',
                    MEMBER: '#FF9900',
                    CASH: '#7C3AED',
                    CREDIT: '#C026D3',
                    CARD: '#2563EB',
                    ONLINE: '#4F46E5',
                  };
                  const color = colorMap[c.paymentChannel] || '#7C3AED';
                  const pct = Math.max(1, Math.round(c.revenuePercentage || 1));
                  return (
                    <View
                      key={c.paymentChannel}
                      style={[styles.payMixSegment, { flex: pct, backgroundColor: color }]}
                    />
                  );
                })}
              </View>
            )}

            {/* Breakdown Cards underneath (3 Columns Grid - 3 Rows Per Card) */}
            <View style={styles.channelInfographicGridWrap}>
              {payMixList.length > 0 ? (
                payMixList.map((c) => {
                  const colorMap: Record<string, string> = {
                    PAYNOW: '#FF2A7A',
                    MEMBER: '#FF9900',
                    CASH: '#7C3AED',
                    CREDIT: '#C026D3',
                    CARD: '#2563EB',
                    ONLINE: '#4F46E5',
                  };
                  const color = colorMap[c.paymentChannel] || '#7C3AED';
                  return (
                    <View key={c.paymentChannel} style={[styles.channelInfographicCard, isMobile && { width: '48%' }, { borderTopColor: color }]}>
                      {/* Row 1: Mode Dot + Full Payment Name */}
                      <View style={styles.channelCardRow1}>
                        <View style={[styles.channelDot, { backgroundColor: color }]} />
                        <Text style={styles.channelCardTitle} numberOfLines={1}>
                          {c.paymentChannelName || c.paymentChannel}
                        </Text>
                      </View>
                      {/* Row 2: Total Revenue Amount */}
                      <View style={styles.channelCardRow2}>
                        <Text style={styles.channelCardAmt}>${c.totalAmount.toFixed(0)}</Text>
                      </View>
                      {/* Row 3: Percentage & Orders Count */}
                      <View style={styles.channelCardRow3}>
                        <Text style={[styles.channelCardPct, { color }]}>
                          {c.revenuePercentage}%
                        </Text>
                        <Text style={styles.channelCardTxn}>{c.transactionCount || 0} orders</Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={{ color: '#94A3B8', fontSize: 11, textAlign: 'center', marginVertical: 8 }}>
                  No payments recorded
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Card 2: Key Metrics (4 Essential KPIs - Modern 2x2 Scorecard Grid) */}
        <View style={styles.rowThreeCard}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.sectionHeaderIconBox, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="stats-chart" size={17} color="#4F46E5" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Key Metrics</Text>
                <Text style={styles.cardSubtitle}>Performance & efficiency KPIs</Text>
              </View>
            </View>
          </View>

          <View style={styles.keyMetricsGrid}>
            {[
              {
                label: 'Avg Check (AOV)',
                sub: 'Per wash order',
                val: `$${summary.averageOrderValue.toFixed(2)}`,
                tag: 'AOV',
                icon: 'wallet',
                iconBg: '#EEF2FF',
                iconColor: '#4F46E5',
              },
              {
                label: 'Completed Washes',
                sub: `${closedWashesCount} closed • ${summary.totalBookings} booked`,
                val: `${completedWashesCount > 0 ? completedWashesCount : (closedWashesCount > 0 ? closedWashesCount : 0)}`,
                tag: 'Fulfilled',
                icon: 'car-sport',
                iconBg: '#ECFDF5',
                iconColor: '#059669',
              },
              {
                label: 'Avg Duration',
                sub: 'Door-to-door cycle',
                val: `${summary.avgWashDurationMinutes} min`,
                tag: 'Speed',
                icon: 'time',
                iconBg: '#FFFBEB',
                iconColor: '#D97706',
              },
              {
                label: 'GST Collected',
                sub: `Net: $${summary.totalNetRevenue.toFixed(2)}`,
                val: `$${summary.totalGSTAmount.toFixed(2)}`,
                tag: '9% GST',
                icon: 'receipt',
                iconBg: '#F0F9FF',
                iconColor: '#0284C7',
              },
            ].map((m) => (
              <View key={m.label} style={styles.kpiTile}>
                <View style={styles.kpiTileTopRow}>
                  <View style={[styles.kpiTileIconCircle, { backgroundColor: m.iconBg }]}>
                    <Ionicons name={m.icon as any} size={18} color={m.iconColor} />
                  </View>
                  <View style={[styles.kpiTileTag, { backgroundColor: m.iconBg }]}>
                    <Text style={[styles.kpiTileTagText, { color: m.iconColor }]}>{m.tag}</Text>
                  </View>
                </View>
                <View style={styles.kpiTileMiddle}>
                  <Text style={styles.kpiTileValue}>{m.val}</Text>
                  <Text style={styles.kpiTileLabel} numberOfLines={1}>{m.label}</Text>
                  <Text style={styles.kpiTileSubtext} numberOfLines={1}>{m.sub}</Text>
                </View>
                <View style={styles.kpiTileBottomTrack}>
                  <View style={[styles.kpiTileBottomFill, { backgroundColor: m.iconColor }]} />
                </View>
              </View>
            ))}
          </View>

          <View style={styles.metricsSummaryBanner}>
            <View style={styles.summaryBannerLeft}>
              <View style={styles.summaryBannerIcon}>
                <Ionicons name="shield-checkmark" size={16} color="#059669" />
              </View>
              <View>
                <Text style={styles.summaryBannerTitle}>Telemetry: Active</Text>
                <Text style={styles.summaryBannerSub}>100% telemetry synced from wash bays</Text>
              </View>
            </View>
            <View style={styles.summaryBannerRight}>
              <Text style={styles.summaryBannerStat}>
                {completedWashesCount > 0 ? completedWashesCount : (closedWashesCount > 0 ? closedWashesCount : 0)} Washes
              </Text>
              <Text style={styles.summaryBannerStatSub}>Fulfilled</Text>
            </View>
          </View>
        </View>

        {/* Card 3: Top Using Packages List (Executive Edition) */}
        <View style={styles.rowThreeCardWide}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.sectionHeaderIconBox, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderWidth: 1 }]}>
                <Ionicons name="sparkles" size={17} color="#0F172A" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Top Packages</Text>
                <Text style={styles.cardSubtitle}>Volume & revenue performance</Text>
              </View>
            </View>
            <View style={styles.darkTotalBadge}>
              <Text style={styles.darkTotalBadgeLabel}>Total</Text>
              <Text style={styles.darkTotalBadgeVal}>
                ${totalPackageRevenue > 0 ? totalPackageRevenue.toFixed(2) : summary.totalRevenue.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Top Packages Cards List */}
          <View style={styles.topPkgCardsList}>
            {topPackagesList.length > 0 ? (
              topPackagesList.map((p, idx) => {
                const theme = PACKAGE_THEMES[idx % PACKAGE_THEMES.length];
                const pct = totalPackageWashes > 0
                  ? (((p.totalWashes || 0) / totalPackageWashes) * 100).toFixed(1)
                  : String(p.washSharePercentage || 0);

                return (
                  <View
                    key={p.packageId || idx}
                    style={[
                      styles.topPkgItemCard,
                      {
                        backgroundColor: theme.cardBg,
                        borderColor: theme.cardBorder,
                      },
                      theme.isLeader && styles.topPkgItemCardLeader,
                    ]}
                  >
                    {/* Top Row: Rank pill + Full Package Name + Revenue */}
                    <View style={styles.topPkgItemHeader}>
                      <View style={styles.topPkgItemTitleCol}>
                        <View style={[styles.topPkgRankBadge, { backgroundColor: theme.rankBg, borderColor: theme.rankBorder }]}>
                          <Text style={[styles.topPkgRankText, { color: theme.rankText }]}>{theme.rank}</Text>
                        </View>
                        <Text style={styles.topPkgItemTitle} numberOfLines={2}>
                          {p.packageName}
                        </Text>
                      </View>
                      <Text style={styles.topPkgItemAmount}>
                        ${Number(p.grossRevenue || 0).toFixed(2)}
                      </Text>
                    </View>

                    {/* Progress Bar Track */}
                    <View style={styles.topPkgItemProgressTrack}>
                      <View
                        style={[
                          styles.topPkgItemProgressFill,
                          {
                            width: `${Math.min(100, Math.max(4, parseFloat(pct)))}%`,
                            backgroundColor: theme.stroke,
                          },
                        ]}
                      />
                    </View>

                    {/* Bottom Row: Wash Count + Average Check + Share Pill */}
                    <View style={styles.topPkgItemMetaRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="car-sport-outline" size={13} color="#64748B" />
                        <Text style={styles.topPkgItemMetaText}>
                          {p.totalWashes} {p.totalWashes === 1 ? 'wash' : 'washes'} • Avg ${(Number(p.grossRevenue || 0) / (p.totalWashes || 1)).toFixed(2)}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.topPkgShareBadge,
                          {
                            backgroundColor: theme.pillBg,
                            borderColor: theme.pillBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.topPkgShareBadgeText, { color: theme.pillText }]}>
                          {pct}%
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>
                  No wash packages recorded for this period
                </Text>
              </View>
            )}
          </View>

          {/* Bottom Summary Footer */}
          <View style={styles.topPkgFooter}>
            <View style={styles.topPkgFooterLeft}>
              <Ionicons name="trophy" size={14} color="#D97706" />
              <Text style={styles.topPkgFooterLeader} numberOfLines={1}>
                Leader: <Text style={styles.topPkgFooterLeaderBold}>{topPackagesList[0]?.packageName || '-'}</Text>
              </Text>
            </View>
            <View style={styles.topPkgFooterRightPill}>
              <Text style={styles.topPkgFooterRightText}>
                {totalPackageWashes} washes • {topPackagesList.length} Tiers
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ============================================================== */}
      {/* 6. ROW 4: RECENT WASHES TABLE & RECENT TRANSACTIONS FEED */}
      {/* ============================================================== */}
      <View style={styles.bottomRow}>
        {/* Left: Recent Washes Table matching reference design */}
        <View style={styles.recentWashesCard}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.sectionHeaderIconBox}>
                <Ionicons name="car-sport" size={18} color="#ED0712" />
              </View>
              <View>
                <Text style={styles.cardTitle}>
                  {selectedPeriodTab === 'DAILY'
                    ? 'Daily Washes'
                    : selectedPeriodTab === 'WEEKLY'
                    ? 'Weekly Washes'
                    : selectedPeriodTab === 'MONTHLY'
                    ? 'Monthly Washes'
                    : 'Yearly Washes'}
                </Text>
                <Text style={styles.cardSubtitleText}>
                  {selectedPeriodTab === 'DAILY'
                    ? 'Today’s order tracking and fulfillment'
                    : selectedPeriodTab === 'WEEKLY'
                    ? 'This week’s order tracking and fulfillment'
                    : selectedPeriodTab === 'MONTHLY'
                    ? 'This month’s order tracking and fulfillment'
                    : 'This year’s order tracking and fulfillment'}
                </Text>
              </View>
            </View>
            <View style={styles.countBadgePill}>
              <View style={styles.countBadgeDot} />
              <Text style={styles.countBadgeText}>
                {filteredRecentWashes.length} Orders
              </Text>
            </View>
          </View>

          <View style={styles.tableContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: '100%' }}>
              <View style={{ width: '100%', minWidth: 560 }}>
                {/* Table Header: Exactly 5 Columns (ORDER NO, NAME, VEHICLE, AMOUNT, ACTION) */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.thText, { flex: 1.1, minWidth: 95 }]}>ORDER NO</Text>
                  <Text style={[styles.thText, { flex: 2, minWidth: 150, paddingLeft: 8 }]}>NAME</Text>
                  <Text style={[styles.thText, { flex: 1.4, minWidth: 120 }]}>VEHICLE</Text>
                  <Text style={[styles.thText, { flex: 1.2, minWidth: 100 }]}>AMOUNT</Text>
                  <Text style={[styles.thText, { flex: 0.9, minWidth: 80, textAlign: 'center' }]}>ACTION</Text>
                </View>

                {/* Table Rows */}
                {filteredRecentWashes.length > 0 ? (
                  filteredRecentWashes.map((row, i) => {
                    const avatarGradients = [
                      { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE' },
                      { bg: '#F0FDFA', text: '#0D9488', border: '#99F6E4' },
                      { bg: '#FFF7ED', text: '#EA580C', border: '#FFEDD5' },
                      { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
                      { bg: '#FAF5FF', text: '#7C3AED', border: '#E9D5FF' },
                    ];
                    const avatarStyle = avatarGradients[i % avatarGradients.length];
                    const isEven = i % 2 === 0;
                    const isWalkIn = !row.vehicleNumber || row.vehicleNumber.trim().toUpperCase() === 'WALK-IN';

                    return (
                      <View 
                        key={row.orderId || i} 
                        style={[
                          styles.tableDataRow, 
                          { backgroundColor: isEven ? '#FFFFFF' : '#FBFDFF' }
                        ]}
                      >
                        {/* 1. ORDER NO */}
                        <View style={{ flex: 1.1, minWidth: 95, justifyContent: 'center' }}>
                          <View style={styles.orderIdBadge}>
                            <View style={styles.orderIdAccentBar} />
                            <Text style={styles.orderIdNumberText}>#{formatOrderNo(row.orderNo)}</Text>
                          </View>
                        </View>

                        {/* 2. NAME */}
                        <View style={[styles.customerCell, { flex: 2, minWidth: 150, paddingLeft: 8 }]}>
                          <View style={[styles.customerAvatarBox, { backgroundColor: avatarStyle.bg, borderColor: avatarStyle.border }]}>
                            <Text style={[styles.customerAvatarText, { color: avatarStyle.text }]}>
                              {(row.customerName || 'CU').slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.customerNameText} numberOfLines={1}>
                              {row.customerName || 'Walk-in'}
                            </Text>
                            <Text style={styles.customerSubText} numberOfLines={1}>
                              {row.packageName || 'Standard Wash'}
                            </Text>
                          </View>
                        </View>

                        {/* 3. VEHICLE */}
                        <View style={[styles.vehicleCell, { flex: 1.4, minWidth: 120 }]}>
                          {isWalkIn ? (
                            <View style={styles.walkinPlatePill}>
                              <Ionicons name="walk-outline" size={12} color="#64748B" style={{ marginRight: 3 }} />
                              <Text style={styles.walkinPlateText}>WALK-IN</Text>
                            </View>
                          ) : (
                            <View style={styles.embossedPlatePill}>
                              <View style={styles.plateDot} />
                              <Text style={styles.embossedPlateText} numberOfLines={1}>{row.vehicleNumber}</Text>
                              <View style={styles.plateDot} />
                            </View>
                          )}
                        </View>

                        {/* 4. AMOUNT */}
                        <View style={{ flex: 1.2, minWidth: 100, justifyContent: 'center' }}>
                          <Text style={styles.amountBoldText}>${row.totalAmount.toFixed(2)}</Text>
                          <View style={styles.amountPaidPill}>
                            <View style={styles.paidDotMini} />
                            <Text style={styles.paidTextMini}>PAID</Text>
                          </View>
                        </View>

                        {/* 5. ACTION (View Button Opening Full Order Details Modal) */}
                        <View style={{ flex: 0.9, minWidth: 80, alignItems: 'center', justifyContent: 'center' }}>
                          <TouchableOpacity 
                            style={styles.modernViewBtn} 
                            activeOpacity={0.75}
                            onPress={() => handleOpenOrderDetails(row)}
                          >
                            <Ionicons name="eye-outline" size={13} color="#2563EB" />
                            <Text style={styles.modernViewBtnText}>View</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={{ padding: 32, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="car-outline" size={32} color="#CBD5E1" />
                    <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700', marginTop: 8 }}>
                      No washes recorded for this period
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Right: Recent Transactions Activity Feed */}
        <View style={styles.recentTransactionsCard}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.sectionHeaderIconBox, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="flash-outline" size={18} color="#16A34A" />
              </View>
              <View>
                <Text style={styles.cardTitle}>
                  {selectedPeriodTab === 'DAILY'
                    ? 'Daily Transactions'
                    : selectedPeriodTab === 'WEEKLY'
                    ? 'Weekly Transactions'
                    : selectedPeriodTab === 'MONTHLY'
                    ? 'Monthly Transactions'
                    : 'Yearly Transactions'}
                </Text>
                <Text style={styles.cardSubtitleText}>
                  {selectedPeriodTab === 'DAILY'
                    ? 'Today’s settlement activity feed'
                    : selectedPeriodTab === 'WEEKLY'
                    ? 'This week’s settlement activity feed'
                    : selectedPeriodTab === 'MONTHLY'
                    ? 'This month’s settlement activity feed'
                    : 'This year’s settlement activity feed'}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.modernRefreshBtn} 
              onPress={() => loadDashboard(selectedPeriodTab, true)}
              activeOpacity={0.8}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#ED0712" />
              ) : (
                <>
                  <Ionicons name="sync-outline" size={13} color="#ED0712" />
                  <Text style={styles.modernRefreshBtnText}>REFRESH</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.txFeedScrollView} 
            contentContainerStyle={styles.txFeedContent} 
            showsVerticalScrollIndicator={false}
          >
            {filteredRecentTransactions.length > 0 ? (
              filteredRecentTransactions.map((tx, i) => {
                const modeUpper = (tx.payMode || '').toUpperCase();
                let badge = {
                  bg: '#EFF6FF',
                  border: '#DBEAFE',
                  color: '#2563EB',
                  icon: 'card-outline',
                  label: tx.payMode || 'CARD',
                };

                if (modeUpper.includes('PAYNOW')) {
                  badge = {
                    bg: '#FDF2F8',
                    border: '#FCE7F3',
                    color: '#DB2777',
                    icon: 'qr-code-outline',
                    label: 'PAYNOW',
                  };
                } else if (modeUpper.includes('MEMBER')) {
                  badge = {
                    bg: '#FEF3C7',
                    border: '#FDE68A',
                    color: '#D97706',
                    icon: 'ribbon-outline',
                    label: 'MEMBER',
                  };
                } else if (modeUpper.includes('CASH')) {
                  badge = {
                    bg: '#F5F3FF',
                    border: '#DDD6FE',
                    color: '#7C3AED',
                    icon: 'cash-outline',
                    label: 'CASH',
                  };
                }

                const time = formatRelativeTime(tx.paidDate || tx.createdDate);

                return (
                  <View key={tx.orderId || i} style={styles.txCardRow}>
                    {/* Left: Channel Branded Avatar */}
                    <View style={[styles.txAvatarBox, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                      <Ionicons name={badge.icon as any} size={16} color={badge.color} />
                    </View>

                    {/* Middle: Customer + Order Info */}
                    <View style={styles.txInfoCol}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.txCustomerName} numberOfLines={1}>
                          {tx.customerName || 'Walk-in Customer'}
                        </Text>
                        <Text style={styles.txOrderTag}>#{formatOrderNo(tx.orderNo)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <View style={[styles.txModePill, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                          <Text style={[styles.txModeText, { color: badge.color }]}>{badge.label}</Text>
                        </View>
                        <View style={styles.txPaidStatusRow}>
                          <View style={styles.paidDotMini} />
                          <Text style={styles.txPaidText}>Paid</Text>
                        </View>
                      </View>
                    </View>

                    {/* Right: Amount + Time */}
                    <View style={styles.txAmountCol}>
                      <Text style={styles.txAmountVal}>+${tx.totalAmount.toFixed(2)}</Text>
                      <Text style={styles.txTimeVal}>{time}</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={{ padding: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="receipt-outline" size={32} color="#CBD5E1" />
                <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700', marginTop: 8 }}>
                  No recent transactions recorded
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
      {/* ============================================================== */}
      {/* 7. FULL WASH DETAILS MODAL */}
      {/* ============================================================== */}
      <Modal
        visible={isDetailsModalOpen && !!selectedWashOrder}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDetailsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="receipt-outline" size={22} color="#ED0712" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Order Full Details</Text>
                  <Text style={styles.modalSubtitle}>
                    Order #{formatOrderNo(selectedWashOrder?.orderNo)} • {selectedWashOrder?.orderNo || ''}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsDetailsModalOpen(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* 4 PRIMARY HIGHLIGHT CARDS: Order No, Customer Name, Vehicle, Amount */}
            <View style={styles.modalKeyCardsRow}>
              {/* 1. ORDER NO */}
              <View style={[styles.modalKeyCard, { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }]}>
                <Text style={styles.modalKeyLabel}>ORDER NO</Text>
                <Text style={styles.modalKeyValueBold}>
                  #{formatOrderNo(selectedWashOrder?.orderNo)}
                </Text>
                <Text style={styles.modalKeySub} numberOfLines={1}>
                  {selectedWashOrder?.orderNo || 'Order ID: ' + selectedWashOrder?.orderId}
                </Text>
              </View>

              {/* 2. CUSTOMER NAME */}
              <View style={[styles.modalKeyCard, { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }]}>
                <Text style={styles.modalKeyLabel}>CUSTOMER NAME</Text>
                <Text style={styles.modalKeyValueBold} numberOfLines={1}>
                  {selectedWashOrder?.customerName || 'Walk-in Customer'}
                </Text>
                <Text style={styles.modalKeySub}>Retail Walk-in</Text>
              </View>

              {/* 3. VEHICLE */}
              <View style={[styles.modalKeyCard, { borderColor: '#0F172A', backgroundColor: '#F8FAFC' }]}>
                <Text style={styles.modalKeyLabel}>VEHICLE</Text>
                <View style={styles.platePillModal}>
                  <Text style={styles.plateTextModal}>
                    {selectedWashOrder?.vehicleNumber || 'WALK-IN'}
                  </Text>
                </View>
                <Text style={styles.modalKeySub} numberOfLines={1}>
                  {selectedWashOrder?.vehicleTypeName || 'Standard Vehicle'}
                </Text>
              </View>

              {/* 4. TOTAL AMOUNT */}
              <View style={[styles.modalKeyCard, { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }]}>
                <Text style={[styles.modalKeyLabel, { color: '#DC2626' }]}>TOTAL AMOUNT</Text>
                <Text style={[styles.modalKeyValueBold, { color: '#DC2626', fontSize: 18 }]}>
                  $ {(selectedWashOrder?.totalAmount || 0).toFixed(2)}
                </Text>
                <Text style={[styles.modalKeySub, { color: '#991B1B' }]}>
                  Incl. 9% GST
                </Text>
              </View>
            </View>

            {/* Comprehensive Detail Breakdown */}
            <View style={styles.modalDetailsCard}>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Service Package</Text>
                <Text style={styles.modalDetailValBold}>{selectedWashOrder?.packageName || '-'}</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Service Category</Text>
                <Text style={styles.modalDetailVal}>{selectedWashOrder?.serviceCategoryName || 'CAR WASH'}</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Bay Allocation</Text>
                <View style={styles.bayBadge}>
                  <Text style={styles.bayWaterDrop}>💧</Text>
                  <Text style={styles.bayBadgeText}>{selectedWashOrder?.bayName || 'Unassigned'}</Text>
                </View>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Status</Text>
                <View style={styles.paidBadge}>
                  <Text style={styles.paidCheckmark}>✓</Text>
                  <Text style={styles.paidBadgeText}>{selectedWashOrder?.statusName || 'Completed'}</Text>
                </View>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Payment Mode</Text>
                <View style={[styles.paidBadge, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                  <Ionicons name="card-outline" size={13} color="#0F172A" style={{ marginRight: 4 }} />
                  <Text style={[styles.paidBadgeText, { color: '#0F172A' }]}>
                    {(() => {
                      const matchingTx = recentTransactionsList.find(
                        (t) => t.orderId === selectedWashOrder?.orderId || t.orderNo === selectedWashOrder?.orderNo
                      );
                      return matchingTx?.payModeDescription || matchingTx?.payMode || 'CASH';
                    })()}
                  </Text>
                </View>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Duration</Text>
                <Text style={styles.modalDetailVal}>
                  {selectedWashOrder?.durationMinutes != null ? `${selectedWashOrder.durationMinutes} minutes` : 'In progress'}
                </Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Net Subtotal</Text>
                <Text style={styles.modalDetailVal}>
                  $ {((selectedWashOrder?.totalAmount || 0) - ((selectedWashOrder?.totalAmount || 0) * 0.09 / 1.09)).toFixed(2)}
                </Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>GST (9% Included)</Text>
                <Text style={styles.modalDetailVal}>
                  $ {(((selectedWashOrder?.totalAmount || 0) * 0.09 / 1.09)).toFixed(2)}
                </Text>
              </View>
              <View style={[styles.modalDetailRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.modalDetailLabel}>Order Timestamp</Text>
                <Text style={styles.modalDetailVal}>
                  {selectedWashOrder?.createdDate ? new Date(selectedWashOrder.createdDate).toLocaleString('en-SG') : '-'}
                </Text>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalFooterActions}>
              <TouchableOpacity
                style={styles.modalPrintBtn}
                onPress={() => handleReprintOrder(selectedWashOrder)}
                disabled={isReprinting}
                activeOpacity={0.85}
              >
                {isReprinting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                ) : (
                  <Ionicons name="print-outline" size={18} color="#FFFFFF" />
                )}
                <Text style={styles.modalPrintBtnText}>
                  {isReprinting ? 'Printing...' : 'Print Ticket'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCloseFooterBtn}
                onPress={() => setIsDetailsModalOpen(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalCloseFooterBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* 11. EASY FILTER MODAL / POPOVER */}
      {/* ============================================================== */}
      <Modal
        visible={isFilterOpen}
        transparent
        animationType="fade"
        onRequestClose={onCloseFilter}
      >
        <View style={styles.filterModalOverlay}>
          <TouchableOpacity
            style={styles.filterBackdrop}
            activeOpacity={1}
            onPress={onCloseFilter}
          />
          <View style={styles.filterCard}>
            {/* Header */}
            <View style={styles.filterHeaderRow}>
              <View style={styles.filterTitleRow}>
                <Ionicons name="options-outline" size={18} color="#E60012" />
                <Text style={styles.filterMainTitle}>Easy Filter</Text>
              </View>
              <TouchableOpacity onPress={onCloseFilter} style={styles.filterCloseBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={true} style={styles.filterScrollView}>
              {/* SORT BY */}
              <Text style={styles.filterSectionTitle}>SORT BY</Text>
              <View style={styles.filterOptionsGroup}>
                <TouchableOpacity
                  style={[
                    styles.filterOptionBtn,
                    stagedSortBy === 'NEWEST' && styles.filterOptionBtnActive,
                  ]}
                  onPress={() => setStagedSortBy('NEWEST')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={stagedSortBy === 'NEWEST' ? '#E60012' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.filterOptionText,
                      stagedSortBy === 'NEWEST' && styles.filterOptionTextActive,
                    ]}
                  >
                    Newest First
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterOptionBtn,
                    stagedSortBy === 'HIGHEST_AMOUNT' && styles.filterOptionBtnActive,
                  ]}
                  onPress={() => setStagedSortBy('HIGHEST_AMOUNT')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="trending-up-outline"
                    size={18}
                    color={stagedSortBy === 'HIGHEST_AMOUNT' ? '#E60012' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.filterOptionText,
                      stagedSortBy === 'HIGHEST_AMOUNT' && styles.filterOptionTextActive,
                    ]}
                  >
                    Highest Amount
                  </Text>
                </TouchableOpacity>
              </View>

              {/* PAYMENT MODES */}
              <Text style={styles.filterSectionTitle}>PAYMENT MODES</Text>
              <View style={styles.filterOptionsGroup}>
                {[
                  { id: 'ALL', label: 'All Payment Modes', icon: 'wallet-outline' },
                  { id: 'CASH', label: 'Cash', icon: 'cash-outline' },
                  { id: 'CARD', label: 'Card / Terminal', icon: 'card-outline' },
                  { id: 'PAYNOW', label: 'PayNow / QR', icon: 'qr-code-outline' },
                  { id: 'NETS', label: 'NETS', icon: 'flash-outline' },
                ].map((pm) => {
                  const isSelected = stagedPaymentMode === pm.id;
                  return (
                    <TouchableOpacity
                      key={pm.id}
                      style={[
                        styles.filterOptionBtn,
                        isSelected && styles.filterOptionBtnActive,
                      ]}
                      onPress={() => setStagedPaymentMode(pm.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={pm.icon as any}
                        size={18}
                        color={isSelected ? '#E60012' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.filterOptionText,
                          isSelected && styles.filterOptionTextActive,
                        ]}
                      >
                        {pm.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* VISIBILITY */}
              <Text style={styles.filterSectionTitle}>VISIBILITY</Text>
              <View style={styles.filterOptionsGroup}>
                <TouchableOpacity
                  style={[
                    styles.filterOptionBtn,
                    stagedShowCancelled && styles.filterOptionBtnActive,
                  ]}
                  onPress={() => setStagedShowCancelled((prev) => !prev)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={stagedShowCancelled ? 'eye-outline' : 'eye-off-outline'}
                    size={18}
                    color={stagedShowCancelled ? '#E60012' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.filterOptionText,
                      stagedShowCancelled && styles.filterOptionTextActive,
                    ]}
                  >
                    {stagedShowCancelled ? 'Showing Cancelled Orders' : 'Hide Cancelled Orders'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.filterFooter}>
              <TouchableOpacity
                style={styles.filterResetBtn}
                onPress={() => {
                  setStagedSortBy('NEWEST');
                  setStagedPaymentMode('ALL');
                  setStagedShowCancelled(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.filterResetText}>RESET ALL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => {
                  setFilterSortBy(stagedSortBy);
                  setFilterPaymentMode(stagedPaymentMode);
                  setFilterShowCancelled(stagedShowCancelled);
                  if (onCloseFilter) onCloseFilter();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.filterApplyText}>APPLY</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* 12. SALES REPORT DOWNLOAD MODAL (EXCEL & PDF) */}
      {/* ============================================================== */}
      <Modal
        visible={isDownloadModalOpen}
        transparent
        animationType="fade"
        onRequestClose={onCloseDownloadModal}
      >
        <View style={styles.downloadModalOverlay}>
          <TouchableOpacity
            style={styles.downloadModalBackdrop}
            activeOpacity={1}
            onPress={onCloseDownloadModal}
          />

          <View style={styles.downloadModalCard}>
            {/* Header: Sales Report & Close Button */}
            <View style={styles.downloadModalHeader}>
              <View style={styles.downloadModalTitleCol}>
                <Text style={styles.downloadModalTitle}>Sales Report</Text>
                <Text style={styles.downloadModalSubtitle}>
                  Select period and download format
                </Text>
              </View>

              <TouchableOpacity
                onPress={onCloseDownloadModal}
                style={styles.downloadModalCloseBtn}
                activeOpacity={0.7}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {/* Section 1: SELECT TIME PERIOD */}
            <View style={styles.downloadPeriodSection}>
              <Text style={styles.downloadSectionLabel}>SELECT TIME PERIOD</Text>

              <View style={styles.downloadPeriodCardsRow}>
                {[
                  { id: 'DAILY', label: 'Daily', icon: 'calendar-outline' },
                  { id: 'WEEKLY', label: 'Weekly', icon: 'calendar-outline' },
                  { id: 'MONTHLY', label: 'Monthly', icon: 'grid-outline' },
                  { id: 'YEARLY', label: 'Yearly', icon: 'star-outline' },
                  { id: 'CUSTOM', label: 'Custom', icon: 'options-outline' },
                ].map((item) => {
                  const isActive = downloadPeriod === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.downloadPeriodCard,
                        isActive && styles.downloadPeriodCardActive,
                      ]}
                      onPress={() => setDownloadPeriod(item.id as any)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={22}
                        color={isActive ? '#FFFFFF' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.downloadPeriodCardText,
                          isActive && styles.downloadPeriodCardTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* If Custom is selected, show From & To date pickers */}
              {downloadPeriod === 'CUSTOM' && (
                <View style={styles.downloadCustomPickersRow}>
                  <View style={styles.downloadCustomPickerCol}>
                    <Text style={styles.downloadPickerLabel}>FROM DATE</Text>
                    <View style={styles.downloadInputBox}>
                      <Ionicons name="calendar-outline" size={15} color="#E60012" style={{ marginRight: 6 }} />
                      {Platform.OS === 'web' ? (
                        <input
                          type="date"
                          max={todayISO}
                          value={customDownloadStart || todayISO}
                          onChange={(e) => setCustomDownloadStart(e.target.value)}
                          style={webCustomDateInputStyle}
                        />
                      ) : (
                        <Text style={styles.downloadPickerValue}>{formatISOToDDMMYYYY(customDownloadStart)}</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.downloadArrowCircle}>
                    <Ionicons name="arrow-forward" size={14} color="#64748B" />
                  </View>

                  <View style={styles.downloadCustomPickerCol}>
                    <Text style={styles.downloadPickerLabel}>TO DATE</Text>
                    <View style={styles.downloadInputBox}>
                      <Ionicons name="calendar-outline" size={15} color="#E60012" style={{ marginRight: 6 }} />
                      {Platform.OS === 'web' ? (
                        <input
                          type="date"
                          max={todayISO}
                          value={customDownloadEnd || todayISO}
                          onChange={(e) => setCustomDownloadEnd(e.target.value)}
                          style={webCustomDateInputStyle}
                        />
                      ) : (
                        <Text style={styles.downloadPickerValue}>{formatISOToDDMMYYYY(customDownloadEnd)}</Text>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {/* Selected Period Range Preview */}
              <View style={styles.downloadRangeBanner}>
                <Ionicons name="calendar" size={13} color="#E60012" />
                <Text style={styles.downloadRangeBannerText}>
                  Active Range: <Text style={styles.downloadRangeBannerBold}>{downloadRange.displayLabel}</Text>
                </Text>
              </View>
            </View>

            {/* Section 2: Direct Download Container */}
            <View style={styles.downloadDirectSection}>
              <View style={styles.downloadDirectHeaderRow}>
                <View style={styles.downloadDirectIconBox}>
                  <Ionicons name="document-text" size={24} color="#E60012" />
                </View>
                <View style={styles.downloadDirectTitleCol}>
                  <Text style={styles.downloadDirectTitle}>Direct Download</Text>
                  <Text style={styles.downloadDirectSubtitle}>
                    Generate PDF or Excel and save to device
                  </Text>
                </View>
              </View>

              {/* Action Buttons: PDF & Excel */}
              <View style={styles.downloadActionButtonsCol}>
                {/* Download PDF Button */}
                <TouchableOpacity
                  style={[
                    styles.downloadPdfBtn,
                    isExporting !== null && { opacity: 0.7 },
                  ]}
                  onPress={handleDownloadPdf}
                  disabled={isExporting !== null}
                  activeOpacity={0.85}
                >
                  {isExporting === 'PDF' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  ) : (
                    <Ionicons
                      name="cloud-download-outline"
                      size={22}
                      color="#FFFFFF"
                      style={{ marginRight: 8 }}
                    />
                  )}
                  <Text style={styles.downloadPdfBtnText}>
                    {isExporting === 'PDF' ? 'Generating PDF...' : 'Download PDF'}
                  </Text>
                </TouchableOpacity>

                {/* Download Excel Button */}
                <TouchableOpacity
                  style={[
                    styles.downloadExcelBtn,
                    isExporting !== null && { opacity: 0.7 },
                  ]}
                  onPress={handleDownloadExcel}
                  disabled={isExporting !== null}
                  activeOpacity={0.85}
                >
                  {isExporting === 'EXCEL' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  ) : (
                    <Ionicons
                      name="download-outline"
                      size={21}
                      color="#FFFFFF"
                      style={{ marginRight: 8 }}
                    />
                  )}
                  <Text style={styles.downloadExcelBtnText}>
                    {isExporting === 'EXCEL' ? 'Generating Excel...' : 'Download Excel'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  scrollWrapper: {
    width: '100%',
  },
  container: {
    width: '100%',
    maxWidth: 1380,
    paddingBottom: 48,
    gap: 18,
  },

  /* 1. TOP HEADER */
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 4px 16px rgba(0,0,0,0.03)' } as any) : { elevation: 2 }),
  },
  brandTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  brandLogoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTextCol: {
    flexDirection: 'column',
  },
  brandNameBold: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 15,
  },
  brandNameSub: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  headerVerticalDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E2E8F0',
  },
  headerIconImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
    ...(Platform.OS === 'web' ? ({ filter: 'drop-shadow(0 4px 10px rgba(237, 7, 18, 0.28))' } as any) : {}),
  },
  titleTextCol: {
    flexDirection: 'column',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  salesAnalyticsTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  liveStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  liveStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
    letterSpacing: 0.3,
  },
  salesSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  topRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userProfilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userAvatarCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ED0712',
  },
  userNameText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  roleChevronRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  userRoleText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },

  /* 2. TIME PERIOD TABS */
  periodTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 2px 10px rgba(0,0,0,0.03)' } as any) : {}),
  },
  periodTabItem: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  periodTabItemActive: {
    backgroundColor: '#E60012',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 4px 14px rgba(230, 0, 18, 0.35)' } as any) : {}),
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  periodTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  /* 2.1 SLEEK DATE SELECTOR BAR */
  dateSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginVertical: 4,
  },
  navSquareBtn: {
    width: 48,
    height: 58,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
          transition: 'all 0.15s ease',
        } as any)
      : { elevation: 1 }),
  },
  singleDateCard: {
    flex: 1,
    height: 58,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
        } as any)
      : { elevation: 1 }),
  },
  singleDateCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  singleDateValue: {
    fontSize: 16.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  dateCard: {
    flex: 1,
    height: 58,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    justifyContent: 'center',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
        } as any)
      : { elevation: 1 }),
  },
  dateCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateIconCircleSmall: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCardTextCol: {
    justifyContent: 'center',
  },
  dateCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  dateCardValue: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  rangeArrowBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeArrowText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#E60012',
  },

  /* 3. ROW 1: 4 KPI CARDS */
  kpiRowFour: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    flexWrap: 'wrap',
  },
  kpiCardRedGradient: {
    flex: 1,
    minWidth: 240,
    backgroundColor: '#ED0712',
    borderRadius: 22,
    padding: 20,
    ...(Platform.OS === 'web'
      ? ({
        backgroundImage: 'linear-gradient(135deg, #EF4444 0%, #DC2626 50%, #B91C1C 100%)',
        boxShadow: '0 10px 24px -4px rgba(220, 38, 38, 0.35)',
      } as any)
      : { elevation: 4 }),
  },
  kpiCardWhite: {
    flex: 1,
    minWidth: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    ...(Platform.OS === 'web'
      ? ({
        boxShadow: '0 6px 18px -2px rgba(15, 23, 42, 0.04)',
      } as any)
      : { elevation: 2 }),
  },
  kpiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircleWhite: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleRedSoft: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillGreenOnDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  pillGreenTextOnDark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  pillGreenLight: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  pillGreenText: {
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '900',
  },
  pillRedLight: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  pillRedText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '900',
  },
  kpiLabelOnDark: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
  },
  kpiValueOnDark: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  kpiCompareOnDark: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    fontWeight: '600',
  },
  kpiLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
  },
  kpiValue: {
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  kpiCompare: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },

  /* ROW CONTAINERS */
  threeCardsRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    flexWrap: 'wrap',
  },
  rowThreeContainer: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    alignItems: 'stretch',
    flexWrap: 'wrap',
  },
  rowThreeCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    flexDirection: 'column',
    justifyContent: 'space-between',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)' } as any) : { elevation: 2 }),
  },
  rowThreeCardWide: {
    flex: 1.15,
    minWidth: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    flexDirection: 'column',
    justifyContent: 'space-between',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)' } as any) : { elevation: 2 }),
  },
  cardFlexOne: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)' } as any) : { elevation: 2 }),
  },
  cardFlexOnePointTwo: {
    flex: 1.4,
    minWidth: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)' } as any) : { elevation: 2 }),
  },
  nativeGaugeOuter: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  nativeGaugeTrackRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 10,
    borderColor: '#FEE2E2',
    position: 'absolute',
  },
  gaugeRadialTick: {
    width: 5,
    height: 12,
    borderRadius: 2.5,
    position: 'absolute',
    top: 54,
    left: 57.5,
  },
  nativeGaugeRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 12,
    borderColor: '#FEE2E2',
  },
  nativeDonutContainer: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  nativeDonutTrackRing: {
    width: 122,
    height: 122,
    borderRadius: 61,
    borderWidth: 12,
    borderColor: '#F1F5F9',
    position: 'absolute',
  },
  donutRadialTick: {
    width: 5,
    height: 15,
    borderRadius: 2.5,
    position: 'absolute',
    top: 67.5,
    left: 72.5,
  },
  nativeDonutRing: {
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 14,
    borderColor: '#F1F5F9',
  },
  proportionalBarContainer: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    marginHorizontal: 8,
    marginTop: 10,
    marginBottom: 12,
  },
  proportionalBarSegment: {
    height: '100%',
  },
  payMixProportionalBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
    width: '100%',
  },
  payMixSegment: {
    height: '100%',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  smallDropdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  smallDropdownText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },

  /* SERVICE DISTRIBUTION - ELEVATED SEGMENTED DONUT */
  serviceDonutWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  serviceCenterIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  activeServiceIndicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 2,
  },
  activeServiceDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  activeServicePctText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  donutValText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  serviceDonutSubText: {
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '700',
    color: '#64748B',
    maxWidth: 86,
    textAlign: 'center',
  },
  serviceBreakdownList: {
    marginTop: 6,
    gap: 6,
  },
  serviceBreakdownCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 6,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'all 0.15s ease' } as any) : {}),
  },
  serviceCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    marginRight: 6,
  },
  serviceColorBar: {
    width: 3.5,
    height: 13,
    borderRadius: 2,
  },
  serviceNameText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E293B',
    flexShrink: 1,
  },
  serviceItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serviceCountText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  serviceCountUnit: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
  serviceSharePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceSharePillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  serviceTrackBg: {
    height: 3.5,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginTop: 5,
    overflow: 'hidden',
  },
  serviceTrackFill: {
    height: '100%',
    borderRadius: 2,
  },
  serviceSummaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  serviceFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    marginRight: 6,
  },
  serviceFooterTopText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  serviceFooterTopBold: {
    color: '#0F172A',
    fontWeight: '800',
  },
  serviceFooterBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  serviceFooterBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
  },
  emptyServiceText: {
    color: '#94A3B8',
    fontSize: 11.5,
    textAlign: 'center',
    marginVertical: 12,
  },
  // Legacy compatibility fallbacks
  concentricChartWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  centerRingOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    top: 40,
  },
  centerRedCarIcon: {
    marginBottom: 2,
  },
  centerWashesVal: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  centerWashesLabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '700',
  },
  centerBadgeGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 3,
  },
  centerBadgeGreenText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#16A34A',
  },
  serviceBreakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceColorDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  serviceBadgeGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    minWidth: 42,
    alignItems: 'center',
  },
  serviceBadgeGreenText: {
    color: '#16A34A',
    fontSize: 10.5,
    fontWeight: '800',
  },
  serviceBadgeRed: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    minWidth: 42,
    alignItems: 'center',
  },
  serviceBadgeRedText: {
    color: '#EF4444',
    fontSize: 10.5,
    fontWeight: '800',
  },

  /* WASH TREND */
  trendLegendBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  activeDayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  activeDayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#ED0712',
  },
  activeDayText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#ED0712',
  },
  chartWrapper: {
    flexDirection: 'row',
    height: 200,
    width: '100%',
    position: 'relative',
  },
  yAxisCol: {
    width: 36,
    height: 165,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  yAxisLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
  },
  plotArea: {
    flex: 1,
    height: '100%',
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  barsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 195,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingBottom: 22,
    paddingHorizontal: 8,
  },
  monthColGroup: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    position: 'relative',
    maxWidth: 40,
    minWidth: 0,
    paddingHorizontal: 1,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  monthColGroupActive: {
    transform: [{ scale: 1.02 }],
  },
  slotTrack: {
    paddingHorizontal: 2,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  slotTrackActive: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  pairedBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 145,
  },
  barRedPrimary: {
    width: 10,
    backgroundColor: '#ED0712',
    borderRadius: 4,
    minHeight: 8,
  },
  barPinkSecondary: {
    width: 10,
    backgroundColor: '#FDA4AF',
    borderRadius: 4,
    minHeight: 8,
  },
  dayLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginTop: 6,
    width: '100%',
  },
  activeDayIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ED0712',
  },
  monthLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },
  monthLabelTextActive: {
    color: '#0F172A',
    fontWeight: '900',
  },
  activeMarkerDotRed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0F172A',
    position: 'absolute',
    top: 20,
    zIndex: 10,
  },
  activeTooltipCard: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    zIndex: 20,
    width: 140,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 20px rgba(0,0,0,0.25)' } as any) : { elevation: 6 }),
  },
  tooltipTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 1.5,
  },
  tooltipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  tooltipTextWhite: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tooltipTextPink: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FDA4AF',
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -5,
    left: '50%',
    marginLeft: -5,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#0F172A',
  },
  trendSummaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  trendFooterStat: {
    alignItems: 'center',
    flex: 1,
  },
  trendFooterDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E2E8F0',
  },
  trendFooterLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  trendFooterVal: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  trendFooterValBold: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 1,
  },

  /* BAY UTILIZATION */
  /* Centered Diagram & Underneath Breakdown Styles */
  verticalDiagramCardContent: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  centeredDonutBox: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  breakdownListUnder: {
    width: '100%',
    marginTop: 12,
    gap: 9,
  },
  underItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  bayUtilContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  donutGaugeBox: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutPctText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  donutSubText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  bayStatsCol: {
    flex: 1,
    gap: 8,
  },
  bayStatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bayStatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bayStatLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  bayStatVal: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
  },
  bayStatDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 2,
  },
  bayStatValBold: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
  },

  /* ROW 3: PAYMENT CHANNEL MIX */
  channelMixBody: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
    paddingTop: 2,
  },
  infographicSvgContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 0,
  },
  channelInfographicGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    marginTop: 10,
    justifyContent: 'flex-start',
  },
  channelInfographicCard: {
    ...(Platform.OS === 'web' ? ({ width: 'calc((100% - 16px) / 3)' } as any) : { width: '31.5%' }),
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderTopWidth: 3,
  },
  channelCardRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  channelCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
    flex: 1,
  },
  channelCardRow2: {
    marginBottom: 2,
  },
  channelCardAmt: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  channelCardRow3: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  channelCardPct: {
    fontSize: 11,
    fontWeight: '800',
  },
  channelCardTxn: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  channelMixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
  },
  channelDonutBox: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelDonutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelTotalLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  channelTotalVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  channelMixListWrap: {
    width: '100%',
    flex: 1,
    justifyContent: 'space-evenly',
    gap: 8,
    marginTop: 10,
  },
  channelMixItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  channelList: {
    flex: 1,
    gap: 6,
  },
  channelItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  channelItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  channelDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  channelLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  channelPctText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },

  /* REDESIGNED KEY METRICS */
  metricLiveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  metricLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ED0712',
  },
  metricLiveText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ED0712',
    letterSpacing: 0.5,
  },
  keyMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
    width: '100%',
  },
  kpiTile: {
    ...(Platform.OS === 'web'
      ? ({
          width: 'calc(50% - 5px)',
          minWidth: 'calc(50% - 5px)',
          maxWidth: 'calc(50% - 5px)',
          boxSizing: 'border-box',
        } as any)
      : { width: '48.5%', minWidth: '48.5%', maxWidth: '48.5%' }),
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 132,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 13,
    justifyContent: 'space-between',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)' } as any) : { elevation: 1 }),
  },
  kpiTileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiTileIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiTileTag: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  kpiTileTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  kpiTileMiddle: {
    marginVertical: 4,
  },
  kpiTileValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  kpiTileLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 3,
  },
  kpiTileSubtext: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  kpiTileBottomTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#E2E8F0',
    width: '100%',
    overflow: 'hidden',
    marginTop: 6,
  },
  kpiTileBottomFill: {
    height: '100%',
    width: '45%',
    borderRadius: 1.5,
  },
  metricsSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  summaryBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  summaryBannerSub: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  summaryBannerRight: {
    alignItems: 'flex-end',
  },
  summaryBannerStat: {
    fontSize: 12,
    fontWeight: '900',
    color: '#059669',
  },
  summaryBannerStatSub: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
  },
  metricsFooterStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EDF2F7',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  metricsFooterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  keyMetricsListNew: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
  },
  keyMetricRowCardNew: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    minHeight: 54,
  },
  keyMetricIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  keyMetricInfoCol: {
    flex: 1,
  },
  keyMetricNameNew: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 16,
  },
  keyMetricSubtextNew: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  keyMetricValueBoldNew: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },

  /* REDESIGNED PAYMENT BREAKDOWN */
  paymentTotalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  paymentTotalBadgeLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  paymentTotalBadgeVal: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '900',
  },
  paymentDistBarContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  paymentDistBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    overflow: 'hidden',
    width: '100%',
  },
  paymentCardsListNew: {
    flex: 1,
    flexDirection: 'column',
    gap: 7,
    marginVertical: 4,
  },
  paymentMethodCardNew: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' } as any) : { elevation: 1 }),
  },
  paymentMethodIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  paymentMethodInfoCol: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  paymentSharePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  paymentShareText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  paymentMethodSub: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  paymentMiniTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#F1F5F9',
    marginTop: 5,
    overflow: 'hidden',
    width: '100%',
  },
  paymentMiniFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  paymentMethodAmountCol: {
    alignItems: 'flex-end',
  },
  paymentMethodAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  paymentMethodTxnCount: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  paymentReconciliationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  /* Executive Top Packages Component Styles */
  darkTotalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  darkTotalBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  darkTotalBadgeVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  topPkgDistBarTrack: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    marginTop: 14,
    marginBottom: 12,
    gap: 2,
  },
  topPkgCardsList: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-evenly',
    marginVertical: 12,
    gap: 10,
  },
  topPkgItemCard: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)' } as any)
      : { elevation: 1 }),
  },
  topPkgItemCardLeader: {
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 14px rgba(237, 7, 18, 0.07)' } as any)
      : { elevation: 2 }),
  },
  topPkgItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  topPkgItemTitleCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 8,
  },
  topPkgRankBadge: {
    width: 25,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topPkgRankText: {
    fontSize: 11,
    fontWeight: '900',
  },
  topPkgItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
    lineHeight: 18,
  },
  topPkgItemAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginLeft: 6,
    textAlign: 'right',
  },
  topPkgItemProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F1F5F9',
    marginTop: 8,
    marginBottom: 7,
    overflow: 'hidden',
    width: '100%',
  },
  topPkgItemProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  topPkgItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topPkgItemMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  topPkgShareBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  topPkgShareBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  topPkgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  topPkgFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  topPkgFooterLeader: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
    flex: 1,
  },
  topPkgFooterLeaderBold: {
    fontWeight: '800',
    color: '#0F172A',
  },
  topPkgFooterRightPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topPkgFooterRightText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  reconcileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reconcileText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  reconcileLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  reconcileVal: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0F172A',
  },

  /* ROW 4: RECENT TABLES */
  bottomRow: {
    flexDirection: 'row',
    gap: 18,
    width: '100%',
    flexWrap: 'wrap',
    alignItems: 'stretch',
  },
  sectionHeaderIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSubtitleText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  countBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  countBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  countBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  recentWashesCard: {
    flex: 1.55,
    minWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)' } as any) : { elevation: 2 }),
  },
  tableContainer: {
    marginTop: 16,
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  thText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  tableDataRowOverdue: {
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 4,
    borderLeftColor: '#ED0712',
  },
  // ORDER NO Column
  orderIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  orderIdAccentBar: {
    width: 3.5,
    alignSelf: 'stretch',
    backgroundColor: '#ED0712',
  },
  orderIdNumberText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0F172A',
    paddingVertical: 4,
    paddingHorizontal: 8,
    letterSpacing: 0.5,
  },
  orderIdChip: {
    backgroundColor: '#F1F4F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderIdText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  // NAME Column
  customerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customerAvatarBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: 11,
    fontWeight: '900',
  },
  customerNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  customerSubText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 1,
  },
  customerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // VEHICLE Column
  vehicleCell: {
    justifyContent: 'center',
  },
  embossedPlatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    ...(Platform.OS === 'web' ? ({ boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.1)' } as any) : {}),
  },
  plateDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#64748B',
  },
  embossedPlateText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  walkinPlatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  walkinPlateText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  platePill: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  plateText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // AMOUNT Column
  amountBoldText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  amountPaidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  paidDotMini: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  paidTextMini: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  cashTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  // ACTION Column
  modernViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  modernViewBtnText: {
    color: '#2563EB',
    fontWeight: '800',
    fontSize: 11.5,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    cursor: 'pointer',
  },
  viewBtnText: {
    color: '#1D4ED8',
    fontWeight: '800',
    fontSize: 11.5,
  },
  // PAYMENT Column (Modal)
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  paidCheckmark: {
    fontSize: 12,
    fontWeight: '900',
    color: '#059669',
    marginRight: 2,
  },
  paidBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#059669',
  },
  // BAY Column (Modal)
  bayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  bayWaterDrop: {
    fontSize: 11,
    marginRight: 2,
  },
  bayBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#1D4ED8',
  },

  /* RECENT TRANSACTIONS */
  recentTransactionsCard: {
    flex: 1,
    minWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)' } as any) : { elevation: 2 }),
  },
  modernRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  modernRefreshBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ED0712',
    letterSpacing: 0.5,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  refreshBtnIcon: {
    fontSize: 11,
  },
  refreshBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ED0712',
    letterSpacing: 0.5,
  },
  txFeedScrollView: {
    maxHeight: 520,
    marginTop: 14,
  },
  txFeedContent: {
    gap: 10,
    paddingVertical: 2,
  },
  txCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  txAvatarBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  txCustomerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  txOrderTag: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  txModePill: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  txModeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  txPaidStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  txPaidText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
  },
  txAmountCol: {
    alignItems: 'flex-end',
  },
  txAmountVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  txTimeVal: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  feedList: {
    marginTop: 14,
    gap: 14,
  },
  feedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  feedIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedIconText: {
    fontSize: 14,
    fontWeight: '800',
  },
  feedContentCol: {
    flex: 1,
  },
  feedTitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 16,
  },
  feedTimeText: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '600',
  },

  /* FULL WASH DETAILS MODAL STYLES */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 20px 40px rgba(0,0,0,0.2)' } as any) : { elevation: 10 }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  modalKeyCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  modalKeyCard: {
    flex: 1,
    minWidth: 125,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  modalKeyLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  modalKeyValueBold: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalKeySub: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 3,
  },
  platePillModal: {
    backgroundColor: '#0F172A',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  plateTextModal: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalDetailsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  modalDetailLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  modalDetailVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalDetailValBold: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalFooterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ED0712',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  modalPrintBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  modalCloseFooterBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  modalCloseFooterBtnText: {
    color: '#475569',
    fontWeight: '800',
    fontSize: 13,
  },

  /* EASY FILTER MODAL */
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 68,
    paddingRight: 24,
    zIndex: 9999,
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  filterCard: {
    width: 320,
    maxHeight: 560,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)',
        } as any)
      : { elevation: 8 }),
    zIndex: 10,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterMainTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  filterCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  filterScrollView: {
    maxHeight: 380,
    marginVertical: 4,
  },
  filterSectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
  },
  filterOptionsGroup: {
    gap: 7,
  },
  filterOptionBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'all 0.15s ease' } as any) : {}),
  },
  filterOptionBtnActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#E60012',
  },
  filterOptionText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569',
  },
  filterOptionTextActive: {
    color: '#E60012',
    fontWeight: '800',
  },
  filterFooter: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  filterResetBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  filterResetText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  filterApplyBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#E60012',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(230, 0, 18, 0.35)',
        } as any)
      : { elevation: 2 }),
  },
  filterApplyText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  /* ============================================================== */
  /* SALES REPORT DOWNLOAD MODAL STYLES */
  /* ============================================================== */
  downloadModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(4px)' } as any) : {}),
  },
  downloadModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  downloadModalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 24px 60px -12px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(0,0,0,0.06)',
        } as any)
      : { elevation: 12 }),
  },
  downloadModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  downloadModalTitleCol: {
    flex: 1,
  },
  downloadModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  downloadModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 3,
  },
  downloadModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'all 0.15s ease' } as any) : {}),
  },
  downloadPeriodSection: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#F8FAFC',
    marginBottom: 16,
  },
  downloadSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  downloadPeriodCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  downloadPeriodCard: {
    flex: 1,
    minHeight: 74,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'all 0.15s ease' } as any) : {}),
  },
  downloadPeriodCardActive: {
    backgroundColor: '#E60012',
    borderColor: '#E60012',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 12px rgba(230, 0, 18, 0.24)',
        } as any)
      : { elevation: 3 }),
  },
  downloadPeriodCardText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 6,
  },
  downloadPeriodCardTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  downloadCustomPickersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  downloadCustomPickerCol: {
    flex: 1,
  },
  downloadPickerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  downloadInputBox: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    ...(Platform.OS === 'web' ? ({ transition: 'border-color 0.15s ease' } as any) : {}),
  },
  downloadArrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginHorizontal: 4,
  },
  downloadPickerValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  downloadRangeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  downloadRangeBannerText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  downloadRangeBannerBold: {
    fontSize: 12,
    color: '#E60012',
    fontWeight: '800',
  },
  downloadDirectSection: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#F8FAFC',
  },
  downloadDirectHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  downloadDirectIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  downloadDirectTitleCol: {
    flex: 1,
  },
  downloadDirectTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  downloadDirectSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
  },
  downloadActionButtonsCol: {
    gap: 10,
  },
  downloadPdfBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E60012',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(230, 0, 18, 0.25)',
        } as any)
      : { elevation: 3 }),
  },
  downloadPdfBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  downloadExcelBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(22, 163, 74, 0.22)',
        } as any)
      : { elevation: 3 }),
  },
  downloadExcelBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
