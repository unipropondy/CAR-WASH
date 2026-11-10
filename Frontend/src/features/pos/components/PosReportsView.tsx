import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PosOrder } from '../../../types/pos.types';
import { BayMasterRecord } from '../../../services/carwashOrderApi';
import { IconMenu, IconClock } from '../../../components/common/AppIcons';
import { printOrderReceipt } from '../../../services/printerApi';
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

export const PosReportsView: React.FC<PosReportsViewProps> = ({
  orders = [],
  bays = [],
  cashierName = 'Ferra Alexandra',
  onBackToOrders,
  onToggleSidebar,
}) => {
  const [selectedPeriodTab, setSelectedPeriodTab] = useState<ReportPeriodTab>('MONTHLY');
  const [dashboardData, setDashboardData] = useState<FullDashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTrendIdx, setActiveTrendIdx] = useState<number>(0);

  const loadDashboard = useCallback(async (tab: ReportPeriodTab, isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);
    try {
      const data = await fetchFullSalesDashboard(tab);
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
  }, []);

  useEffect(() => {
    loadDashboard(selectedPeriodTab);
  }, [selectedPeriodTab, loadDashboard]);

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

  const maxTrendWashes = Math.max(10, ...washTrendList.map(w => w.completedWashes || 0));
  const maxTrendRevenue = Math.max(100, ...washTrendList.map(w => w.dailyRevenue || 0));

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

  const SERVICE_PALETTE = ['#EF4444', '#F87171', '#F59E0B', '#8B5CF6', '#3B82F6', '#10B981'];
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

  return (
    <View style={styles.container}>
      {/* ============================================================== */}
      {/* 1. TOP HEADER SECTION */}
      {/* ============================================================== */}
      <View style={styles.topHeader}>
        {/* Left: Menu button, Logo & Sales Analytics Title */}
        <View style={styles.brandTitleGroup}>
          {onToggleSidebar && (
            <>
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={onToggleSidebar}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Toggle side menu"
              >
                <IconMenu size={18} color="#FFFFFF" strokeWidth={2.4} />
              </TouchableOpacity>
              <View style={styles.headerVerticalDivider} />
            </>
          )}

          {/* Custom Reports Icon */}
          <Image
            source={require('../../../../assets/images/reports_icon.png')}
            style={styles.headerIconImage}
            resizeMode="contain"
          />

          {/* Title & Subtitle */}
          <View style={styles.titleTextCol}>
            <View style={styles.titleRow}>
              <Text style={styles.salesAnalyticsTitle}>Sales Analytics</Text>
              <View style={styles.liveStatusChip}>
                <View style={styles.liveDot} />
                <Text style={styles.liveStatusText}>Live SQL Server</Text>
              </View>
            </View>
            <Text style={styles.salesSubtitle}>Real-time performance, revenue trends and bay metrics</Text>
          </View>
        </View>

        {/* Right Controls: Refresh & Profile */}
        <View style={styles.topRightControls}>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={() => loadDashboard(selectedPeriodTab, true)}
            activeOpacity={0.8}
            accessibilityLabel="Refresh reports"
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#ED0712" />
            ) : (
              <>
                <Text style={styles.refreshBtnIcon}>🔄</Text>
                <Text style={styles.refreshBtnText}>SYNC DATA</Text>
              </>
            )}
          </TouchableOpacity>

          {/* User Profile Pill */}
          <View style={styles.userProfilePill}>
            <View style={styles.userAvatarCircle}>
              <Text style={styles.userAvatarText}>FA</Text>
            </View>
            <View>
              <Text style={styles.userNameText}>{cashierName}</Text>
              <View style={styles.roleChevronRow}>
                <Text style={styles.userRoleText}>Admin</Text>
                {renderSvg(10, '0 0 24 24', [{ d: 'M6 9l6 6 6-6', stroke: '#64748B', strokeWidth: 2 }])}
              </View>
            </View>
          </View>
        </View>
      </View>

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
              onPress={() => setSelectedPeriodTab(tab)}
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
      {/* 3. ROW 1: 4 TOP KPI CARDS */}
      {/* ============================================================== */}
      <View style={styles.kpiRowFour}>
        {/* Card 1: Total Washes (Red Gradient) */}
        <View style={styles.kpiCardRedGradient}>
          <View style={styles.kpiTopRow}>
            <View style={styles.iconCircleWhite}>
              {renderSvg(22, '0 0 24 24', [
                { d: 'M5 11l2-4h10l2 4', stroke: '#ED0712', strokeWidth: 2 },
                { d: 'M3 11h18v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z', stroke: '#ED0712', strokeWidth: 2 },
                { d: 'M7 16a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', stroke: '#ED0712', strokeWidth: 1.5, fill: '#ED0712' },
                { d: 'M17 16a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', stroke: '#ED0712', strokeWidth: 1.5, fill: '#ED0712' },
              ])}
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
              {renderSvg(22, '0 0 24 24', [
                { d: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', stroke: '#ED0712', strokeWidth: 2 },
              ])}
            </View>
            <View style={styles.pillGreenLight}>
              <Text style={styles.pillGreenText}>SGD Gross</Text>
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
              {renderSvg(20, '0 0 24 24', [
                { d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', stroke: '#ED0712', strokeWidth: 2 },
                { d: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', stroke: '#ED0712', strokeWidth: 2 },
                { d: 'M23 21v-2a4 4 0 0 0-3-3.87', stroke: '#ED0712', strokeWidth: 2 },
                { d: 'M16 3.13a4 4 0 0 1 0 7.75', stroke: '#ED0712', strokeWidth: 2 },
              ])}
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
              {renderSvg(20, '0 0 24 24', [
                { d: 'M5 11l2-4h10l2 4', stroke: '#ED0712', strokeWidth: 2 },
                { d: 'M3 11h18v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z', stroke: '#ED0712', strokeWidth: 2 },
                { d: 'M7 16a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', stroke: '#ED0712', strokeWidth: 1.5, fill: '#ED0712' },
                { d: 'M17 16a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', stroke: '#ED0712', strokeWidth: 1.5, fill: '#ED0712' },
              ])}
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
              {Platform.OS === 'web' ? (
                <svg width="120" height="120" viewBox="0 0 120 120" style={{ display: 'block', margin: '0 auto' }}>
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#FEE2E2" strokeWidth="12" />
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    fill="none"
                    stroke="#EF4444"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray="301.6"
                    strokeDashoffset={301.6 * (1 - Math.min(100, Math.max(0, calculatedUtilizationPct)) / 100)}
                    transform="rotate(-90 60 60)"
                  />
                </svg>
              ) : null}

              <View style={styles.donutCenterLabel}>
                <Text style={styles.donutPctText}>{calculatedUtilizationPct}%</Text>
                <Text style={styles.donutSubText}>Utilization</Text>
              </View>
            </View>

            {/* Stats Breakdown shown UNDER the diagram */}
            <View style={styles.breakdownListUnder}>
              <View style={styles.underItemRow}>
                <View style={styles.bayStatLeft}>
                  {renderSvg(16, '0 0 24 24', [
                    { d: 'M5 11l2-4h10l2 4', stroke: '#EF4444', strokeWidth: 2 },
                    { d: 'M3 11h18v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z', stroke: '#EF4444', strokeWidth: 2 },
                  ])}
                  <Text style={styles.bayStatLabel}>Total Bays</Text>
                </View>
                <Text style={styles.bayStatVal}>{totalBaysCount}</Text>
              </View>

              <View style={styles.underItemRow}>
                <View style={styles.bayStatLeft}>
                  {renderSvg(16, '0 0 24 24', [{ d: 'M5 3l14 9-14 9V3z', stroke: '#22C55E', strokeWidth: 2, fill: '#22C55E' }])}
                  <Text style={styles.bayStatLabel}>Bays in Use</Text>
                </View>
                <Text style={styles.bayStatVal}>{inUseBaysCount}</Text>
              </View>

              <View style={styles.underItemRow}>
                <View style={styles.bayStatLeft}>
                  {renderSvg(16, '0 0 24 24', [{ d: 'M6 4h4v16H6zM14 4h4v16h-4z', stroke: '#F59E0B', strokeWidth: 2, fill: '#F59E0B' }])}
                  <Text style={styles.bayStatLabel}>Bays Idle</Text>
                </View>
                <Text style={styles.bayStatVal}>{idleBaysCount}</Text>
              </View>

              <View style={styles.bayStatDivider} />

              <View style={styles.underItemRow}>
                <View style={styles.bayStatLeft}>
                  {renderSvg(16, '0 0 24 24', [
                    { d: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', stroke: '#0F172A', strokeWidth: 2 },
                    { d: 'M12 6v6l4 2', stroke: '#0F172A', strokeWidth: 2 },
                  ])}
                  <Text style={styles.bayStatLabel}>Avg. Service Time</Text>
                </View>
                <Text style={styles.bayStatValBold}>{averageBayServiceMinutes} min</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Card 2: Wash Trend (Paired Bar Chart) */}
        <View style={styles.cardFlexOnePointTwo}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Wash Trend</Text>
              <Text style={styles.cardSubtitle}>Timeline comparison of washes and revenue</Text>
            </View>
            <View style={styles.smallDropdownPill}>
              <Text style={styles.smallDropdownText}>{selectedPeriodTab}</Text>
            </View>
          </View>

          {/* Legends */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
              <Text style={styles.legendText}>Number of Washes</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FECDD3' }]} />
              <Text style={styles.legendText}>Revenue (SGD)</Text>
            </View>
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
              {activeTrendItem && washTrendList.length > 0 && (
                <View
                  style={[
                    styles.activeTooltipCard,
                    {
                      left: `${((activeTrendIdx + 0.5) / washTrendList.length) * 100}%`,
                      transform: [{ translateX: -65 }],
                    },
                  ]}
                >
                  <View style={styles.tooltipRow}>
                    <View style={[styles.tooltipDot, { backgroundColor: '#FFFFFF' }]} />
                    <Text style={styles.tooltipTextWhite}>{(activeTrendItem.completedWashes || 0).toLocaleString()} Washes</Text>
                  </View>
                  <View style={styles.tooltipRow}>
                    <View style={[styles.tooltipDot, { backgroundColor: '#FCA5A5' }]} />
                    <Text style={styles.tooltipTextPink}>${(activeTrendItem.dailyRevenue || 0).toFixed(2)} Revenue</Text>
                  </View>
                  <View style={styles.tooltipArrow} />
                </View>
              )}

              {/* Bars Row */}
              <View style={styles.barsContainer}>
                {washTrendList.length > 0 ? (
                  washTrendList.map((item, idx) => {
                    const isActive = activeTrendIdx === idx;
                    const washesHeightPct = Math.min(100, Math.max(8, ((item.completedWashes || 0) / maxTrendWashes) * 100));
                    const revHeightPct = Math.min(100, Math.max(6, ((item.dailyRevenue || 0) / maxTrendRevenue) * 100));
                    const dayLabel = item.dayName || (item.orderDate ? item.orderDate.slice(5) : `D${idx+1}`);

                    return (
                      <TouchableOpacity
                        key={item.orderDate || idx}
                        style={styles.monthColGroup}
                        onPress={() => setActiveTrendIdx(idx)}
                        activeOpacity={0.8}
                      >
                        {isActive && <View style={styles.activeMarkerDotRed} />}

                        <View style={styles.pairedBarsRow}>
                          <View style={[styles.barRedPrimary, { height: `${washesHeightPct}%` }]} />
                          <View style={[styles.barPinkSecondary, { height: `${revHeightPct}%` }]} />
                        </View>

                        <Text style={[styles.monthLabelText, isActive && styles.monthLabelTextActive]} numberOfLines={1}>
                          {dayLabel}
                        </Text>
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
        </View>

        {/* Card 3: Service Distribution (Moved to Right Side) */}
        <View style={styles.cardFlexOne}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Service Distribution</Text>
              <Text style={styles.cardSubtitle}>Wash services by count</Text>
            </View>
            <View style={styles.smallDropdownPill}>
              <Text style={styles.smallDropdownText}>{selectedPeriodTab}</Text>
            </View>
          </View>

          {/* Horseshoe Multi-Arc Radial SVG Chart */}
          <View style={styles.concentricChartWrap}>
            {Platform.OS === 'web' ? (
              <svg width="200" height="180" viewBox="0 0 200 180" style={{ display: 'block', margin: '0 auto' }}>
                {serviceDistributionList.slice(0, 4).map((item, idx) => {
                  const r = 78 - idx * 15;
                  const trackColor = idx === 0 ? '#FEE2E2' : idx === 1 ? '#FEE2E2' : idx === 2 ? '#FEF3C7' : '#EDE9FE';
                  const strokeColor = SERVICE_PALETTE[idx % SERVICE_PALETTE.length];
                  const pct = Math.min(100, Math.max(0, item.washSharePercentage || 0));
                  const arcSpan = 270;
                  const endAngle = -135 + (arcSpan * pct) / 100;
                  return (
                    <React.Fragment key={idx}>
                      <path d={describeArc(100, 95, r, -135, 135)} fill="none" stroke={trackColor} strokeWidth="8" strokeLinecap="round" />
                      {pct > 0 && (
                        <path d={describeArc(100, 95, r, -135, endAngle)} fill="none" stroke={strokeColor} strokeWidth="8" strokeLinecap="round" />
                      )}
                    </React.Fragment>
                  );
                })}
              </svg>
            ) : null}

            {/* Center Content */}
            <View style={styles.centerRingOverlay}>
              <View style={styles.centerRedCarIcon}>
                {renderSvg(20, '0 0 24 24', [
                  { d: 'M5 11l2-4h10l2 4', stroke: '#ED0712', strokeWidth: 2 },
                  { d: 'M3 11h18v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z', stroke: '#ED0712', strokeWidth: 2 },
                  { d: 'M7 16a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', stroke: '#ED0712', strokeWidth: 1.5, fill: '#ED0712' },
                  { d: 'M17 16a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', stroke: '#ED0712', strokeWidth: 1.5, fill: '#ED0712' },
                ])}
              </View>
              <Text style={styles.centerWashesVal}>{totalWashesCount.toLocaleString()}</Text>
              <Text style={styles.centerWashesLabel}>Total Washes</Text>
              <View style={styles.centerBadgeGreen}>
                <Text style={styles.centerBadgeGreenText}>{selectedPeriodTab}</Text>
              </View>
            </View>
          </View>

          {/* Breakdown List */}
          <View style={styles.serviceBreakdownList}>
            {serviceDistributionList.length > 0 ? (
              serviceDistributionList.slice(0, 4).map((item, idx) => (
                <View key={item.packageId || idx} style={styles.serviceBreakdownItem}>
                  <View style={styles.serviceItemLeft}>
                    <View style={[styles.serviceColorDot, { backgroundColor: SERVICE_PALETTE[idx % SERVICE_PALETTE.length] }]} />
                    <Text style={styles.serviceNameText} numberOfLines={1}>{item.packageName}</Text>
                  </View>
                  <View style={styles.serviceItemRight}>
                    <Text style={styles.serviceCountText}>{item.totalWashes.toLocaleString()}</Text>
                    <View style={styles.serviceBadgeGreen}>
                      <Text style={styles.serviceBadgeGreenText}>{item.washSharePercentage}%</Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <Text style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', marginVertical: 12 }}>
                No services recorded for this period
              </Text>
            )}
          </View>
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
            <View style={styles.metricLiveChip}>
              <View style={styles.metricLiveDot} />
              <Text style={styles.metricLiveText}>LIVE SQL</Text>
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
                    <View key={c.paymentChannel} style={[styles.channelInfographicCard, { borderTopColor: color }]}>
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

        {/* Card 2: Key Metrics (4 Essential KPIs) */}
        <View style={styles.rowThreeCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>📊 Key Metrics</Text>
              <Text style={styles.cardSubtitle}>Performance & efficiency KPIs</Text>
            </View>
            <View style={styles.metricLiveChip}>
              <View style={styles.metricLiveDot} />
              <Text style={styles.metricLiveText}>LIVE</Text>
            </View>
          </View>

          <View style={styles.keyMetricsListNew}>
            {[
              {
                label: 'Avg Check (AOV)',
                sub: 'Per wash order',
                val: `$${summary.averageOrderValue.toFixed(2)}`,
                icon: 'wallet-outline',
                iconBg: '#EEF2FF',
                iconColor: '#4F46E5',
              },
              {
                label: 'Completed Washes',
                sub: `${closedWashesCount} closed • ${summary.totalBookings} booked`,
                val: `${completedWashesCount}`,
                icon: 'car-sport-outline',
                iconBg: '#ECFDF5',
                iconColor: '#059669',
              },
              {
                label: 'Avg Wash Duration',
                sub: 'Door-to-door cycle',
                val: `${summary.avgWashDurationMinutes} min`,
                icon: 'timer-outline',
                iconBg: '#FFFBEB',
                iconColor: '#D97706',
              },
              {
                label: 'GST Collected',
                sub: `Net: $${summary.totalNetRevenue.toFixed(2)}`,
                val: `$${summary.totalGSTAmount.toFixed(2)}`,
                icon: 'receipt-outline',
                iconBg: '#F0F9FF',
                iconColor: '#0284C7',
              },
            ].map((m) => (
              <View key={m.label} style={styles.keyMetricRowCardNew}>
                <View style={[styles.keyMetricIconCircle, { backgroundColor: m.iconBg }]}>
                  <Ionicons name={m.icon as any} size={18} color={m.iconColor} />
                </View>
                <View style={styles.keyMetricInfoCol}>
                  <Text style={styles.keyMetricNameNew}>{m.label}</Text>
                  <Text style={styles.keyMetricSubtextNew}>{m.sub}</Text>
                </View>
                <Text style={styles.keyMetricValueBoldNew}>{m.val}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Card 3: Payment Breakdown (Redesigned with Distribution Bar & Method Cards) */}
        <View style={styles.rowThreeCardWide}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>💳 Payment Breakdown</Text>
              <Text style={styles.cardSubtitle}>Reconciled by settlement channel</Text>
            </View>
            <View style={styles.paymentTotalBadge}>
              <Text style={styles.paymentTotalBadgeLabel}>Total</Text>
              <Text style={styles.paymentTotalBadgeVal}>${summary.totalRevenue.toFixed(2)}</Text>
            </View>
          </View>

          {/* Multi-segment distribution progress bar */}
          {payMixList.length > 0 && (
            <View style={styles.paymentDistBarContainer}>
              <View style={styles.paymentDistBar}>
                {payMixList.map((p, idx) => {
                  const palette = ['#DC2626', '#2563EB', '#7C3AED', '#059669', '#D97706'];
                  const segColor = palette[idx % palette.length];
                  const pct = Math.max(3, p.revenuePercentage || 0);
                  return (
                    <View
                      key={p.paymentChannel || idx}
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: segColor,
                      }}
                    />
                  );
                })}
              </View>
            </View>
          )}

          {/* Payment Method Cards List */}
          <View style={styles.paymentCardsListNew}>
            {payMixList.length > 0 ? (
              payMixList.map((p, idx) => {
                const isCash = p.paymentChannel === 'CASH';
                const isCredit = p.paymentChannel === 'CREDIT' || p.paymentChannel === 'CARD';
                const isMember = p.paymentChannel === 'MEMBER';

                const iconName = isCash ? 'cash-outline' : isCredit ? 'card-outline' : isMember ? 'id-card-outline' : 'qr-code-outline';
                const themeColor = isCash ? '#DC2626' : isCredit ? '#2563EB' : isMember ? '#7C3AED' : '#059669';
                const themeBg = isCash ? '#FEF2F2' : isCredit ? '#EFF6FF' : isMember ? '#FAF5FF' : '#ECFDF5';
                const themeBorder = isCash ? '#FEE2E2' : isCredit ? '#DBEAFE' : isMember ? '#F3E8FF' : '#D1FAE5';

                return (
                  <View
                    key={p.paymentChannel || idx}
                    style={[styles.paymentMethodCardNew, { borderColor: themeBorder }]}
                  >
                    <View style={[styles.paymentMethodIconBox, { backgroundColor: themeBg }]}>
                      <Ionicons name={iconName as any} size={20} color={themeColor} />
                    </View>

                    <View style={styles.paymentMethodInfoCol}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.paymentMethodTitle, { color: themeColor }]}>
                          {p.paymentChannelName || p.paymentChannel}
                        </Text>
                        <View style={[styles.paymentSharePill, { backgroundColor: themeBg }]}>
                          <Text style={[styles.paymentShareText, { color: themeColor }]}>
                            {p.revenuePercentage}%
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.paymentMethodSub}>
                        {p.transactionCount} transactions • Avg ${(p.totalAmount / (p.transactionCount || 1)).toFixed(2)}
                      </Text>

                      {/* Mini Channel Progress Bar */}
                      <View style={styles.paymentMiniTrack}>
                        <View
                          style={[
                            styles.paymentMiniFill,
                            { width: `${Math.min(100, Math.max(4, p.revenuePercentage))}%`, backgroundColor: themeColor },
                          ]}
                        />
                      </View>
                    </View>

                    <View style={styles.paymentMethodAmountCol}>
                      <Text style={styles.paymentMethodAmount}>${p.totalAmount.toFixed(2)}</Text>
                      <Text style={styles.paymentMethodTxnCount}>{p.transactionCount} txns</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: '#94A3B8', fontSize: 12 }}>No transaction breakdown recorded</Text>
              </View>
            )}
          </View>

          {/* Bottom Reconciliation Summary */}
          <View style={styles.paymentReconciliationFooter}>
            <View style={styles.reconcileItem}>
              <Ionicons name="shield-checkmark" size={15} color="#059669" />
              <Text style={styles.reconcileText}>100% Reconciled</Text>
            </View>
            <View style={styles.reconcileItem}>
              <Text style={styles.reconcileLabel}>Net:</Text>
              <Text style={styles.reconcileVal}>${summary.totalNetRevenue.toFixed(2)}</Text>
            </View>
            <View style={styles.reconcileItem}>
              <Text style={styles.reconcileLabel}>GST:</Text>
              <Text style={styles.reconcileVal}>${summary.totalGSTAmount.toFixed(2)}</Text>
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
                <Text style={styles.cardTitle}>Recent Washes</Text>
                <Text style={styles.cardSubtitleText}>Live order tracking and fulfillment</Text>
              </View>
            </View>
            <View style={styles.countBadgePill}>
              <View style={styles.countBadgeDot} />
              <Text style={styles.countBadgeText}>
                {recentWashesList.length} Orders
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
                {recentWashesList.length > 0 ? (
                  recentWashesList.map((row, i) => {
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
                <Text style={styles.cardTitle}>Recent Transactions</Text>
                <Text style={styles.cardSubtitleText}>Live settlement activity feed</Text>
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
            {recentTransactionsList.length > 0 ? (
              recentTransactionsList.map((tx, i) => {
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
    backgroundColor: '#ED0712',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 4px 12px rgba(237, 7, 18, 0.3)' } as any) : {}),
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
    minWidth: 310,
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
    minWidth: 330,
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
    minWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)' } as any) : { elevation: 2 }),
  },
  cardFlexOnePointTwo: {
    flex: 1.35,
    minWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)' } as any) : { elevation: 2 }),
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

  /* CONCENTRIC RADIAL CHART */
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
  serviceBreakdownList: {
    marginTop: 10,
    gap: 9,
  },
  serviceBreakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceColorDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  serviceNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  serviceItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceCountText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0F172A',
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
  chartWrapper: {
    flexDirection: 'row',
    height: 220,
    width: '100%',
    position: 'relative',
  },
  yAxisCol: {
    width: 44,
    height: 180,
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
    borderStyle: 'dashed',
  },
  barsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 210,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingBottom: 24,
  },
  monthColGroup: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    position: 'relative',
    paddingHorizontal: 6,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  pairedBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 160,
  },
  barRedPrimary: {
    width: 14,
    backgroundColor: '#DC2626',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    minHeight: 10,
  },
  barPinkSecondary: {
    width: 14,
    backgroundColor: '#FECDD3',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    minHeight: 10,
  },
  monthLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 6,
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
    top: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    zIndex: 20,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 4px 14px rgba(0,0,0,0.25)' } as any) : {}),
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 1,
  },
  tooltipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  tooltipTextWhite: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tooltipTextPink: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FECDD3',
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
    marginTop: 10,
    marginBottom: 6,
  },
  paymentDistBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    overflow: 'hidden',
    width: '100%',
  },
  paymentCardsListNew: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 8,
    marginVertical: 10,
  },
  paymentMethodCardNew: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    minHeight: 50,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)' } as any) : { elevation: 1 }),
  },
  paymentMethodIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentMethodInfoCol: {
    flex: 1,
    marginRight: 10,
  },
  paymentMethodTitle: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  paymentSharePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  paymentShareText: {
    fontSize: 10,
    fontWeight: '800',
  },
  paymentMethodSub: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  paymentMiniTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F1F5F9',
    marginTop: 5,
    overflow: 'hidden',
    width: '90%',
  },
  paymentMiniFill: {
    height: '100%',
    borderRadius: 2,
  },
  paymentMethodAmountCol: {
    alignItems: 'flex-end',
  },
  paymentMethodAmount: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  paymentMethodTxnCount: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    marginTop: 2,
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
});
